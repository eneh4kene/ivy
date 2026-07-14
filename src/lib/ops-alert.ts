import logger from '../utils/logger'
import prisma from '../utils/prisma'
import { Sentry } from './sentry'
import { sendTelegramAdmin } from '../utils/telegram-admin'
import { serverAnalytics } from './analytics'
import config from '../config'

/**
 * Central ops alerting — the "nothing fails silently" choke point.
 *
 * Every handled-but-important failure routes through opsAlert() so it lands in
 * all four places at once: Winston (grep `[ops]` in Fly logs), Sentry (tagged,
 * so handled errors are no longer invisible there), admin Telegram (warn and
 * critical only), and PostHog (`system_failure`, so funnels can distinguish
 * breakage from drop-off).
 *
 * Guarantees:
 * - Never throws. An alerting failure must not take down the job it observes.
 * - Throttled per `severity:source:title` key (detail/userId excluded — they
 *   vary per item and would defeat dedup). Repeats inside the window collapse
 *   into one roll-up message. Criticals use a shorter 5-minute window.
 * - Throttle state is in-memory, i.e. per Fly machine. Worst case a few
 *   duplicate Telegrams until the OpsEvent-backed dedup lands (Phase 1).
 */

export type OpsSeverity = 'info' | 'warn' | 'critical'

export interface OpsAlertInput {
  severity: OpsSeverity
  /** Stable origin: 'arming-loop', 'inngest:ivy-initiate-call', 'webhook:stripe'… */
  source: string
  /** Stable failure name, part of the dedup key: 'stage_failed', 'no_delivery_channel'… */
  title: string
  /** Free text — ids, error messages. Not part of the dedup key. */
  detail?: string
  userId?: string
  entity?: { type: string; id: string }
  /** When present → Sentry.captureException; otherwise captureMessage. */
  error?: unknown
}

const CRITICAL_WINDOW_MS = 5 * 60 * 1000
const MAX_SAMPLE_IDS = 3

interface ThrottleEntry {
  lastSentAt: number
  suppressed: number
  sampleIds: string[]
  severity: OpsSeverity
  source: string
  title: string
}

const throttleMap = new Map<string, ThrottleEntry>()

function windowMsFor(severity: OpsSeverity): number {
  if (severity === 'critical') return CRITICAL_WINDOW_MS
  return config.ops.alertThrottleMin * 60 * 1000
}

function severityEmoji(severity: OpsSeverity): string {
  return severity === 'critical' ? '🔴' : severity === 'warn' ? '🟠' : 'ℹ️'
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : JSON.stringify(error)
}

function logAlert(input: OpsAlertInput): void {
  const meta = {
    opsAlert: true,
    source: input.source,
    title: input.title,
    userId: input.userId,
    entity: input.entity,
  }
  const line = `[ops] ${input.source}: ${input.title}${input.detail ? ` — ${input.detail}` : ''}`
  if (input.severity === 'critical') logger.error(line, input.error ?? meta)
  else if (input.severity === 'warn') logger.warn(line, input.error ?? meta)
  else logger.info(line, meta)
}

function sentryCapture(input: OpsAlertInput): void {
  const scopeData = {
    tags: {
      ops_source: input.source,
      ops_title: input.title,
      ops_severity: input.severity,
    },
    user: input.userId ? { id: input.userId } : undefined,
    extra: {
      detail: input.detail,
      entity: input.entity,
    },
  }
  if (input.error) {
    Sentry.captureException(input.error, scopeData)
  } else {
    Sentry.captureMessage(`${input.source}: ${input.title}${input.detail ? ` — ${input.detail}` : ''}`, {
      level: input.severity === 'critical' ? 'error' : input.severity === 'warn' ? 'warning' : 'info',
      ...scopeData,
    })
  }
}

function telegramText(input: OpsAlertInput): string {
  const parts = [
    `${severityEmoji(input.severity)} [${input.source}] ${input.title}`,
    input.detail,
    input.userId ? `user ${shortId(input.userId)}` : undefined,
    input.entity ? `${input.entity.type} ${shortId(input.entity.id)}` : undefined,
  ].filter(Boolean)
  return parts.join(' — ')
}

async function sendTelegram(text: string): Promise<void> {
  if (config.ops.alertsMuted) return
  await sendTelegramAdmin(text)
}

/**
 * Persist to ops_events and dedup across Fly machines: an in-window row with
 * the same severity:source:title means another instance (or an earlier call)
 * already paged — roll our occurrence into its count instead of re-sending.
 *
 * Returns true when rolled up (caller should skip Telegram). Never throws;
 * tolerates the table not existing yet (deploy-before-migrate ordering).
 */
async function persistOpsEvent(input: OpsAlertInput, rollupCount = 1): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowMsFor(input.severity))
    const existing = await prisma.opsEvent.findFirst({
      where: {
        severity: input.severity,
        source: input.source,
        title: input.title,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (existing) {
      await prisma.opsEvent.update({
        where: { id: existing.id },
        data: { count: { increment: rollupCount } },
      })
      return true
    }
    await prisma.opsEvent.create({
      data: {
        severity: input.severity,
        source: input.source,
        title: input.title,
        detail: input.detail?.slice(0, 4000),
        userId: input.userId,
        entityType: input.entity?.type,
        entityId: input.entity?.id,
        count: rollupCount,
      },
    })
    return false
  } catch (err) {
    logger.warn('[ops] OpsEvent persistence failed (table missing or DB down) — alert continues', err)
    return false
  }
}

/** Flush a throttle entry's suppressed repeats as one roll-up message. */
async function flushRollup(key: string, entry: ThrottleEntry): Promise<void> {
  if (entry.suppressed === 0) return
  const ids = entry.sampleIds.length
    ? ` (${entry.sampleIds.map(shortId).join(', ')}${entry.suppressed > entry.sampleIds.length ? `, +${entry.suppressed - entry.sampleIds.length}` : ''})`
    : ''
  const text = `${severityEmoji(entry.severity)} [${entry.source}] ${entry.title} ×${entry.suppressed} suppressed in last window${ids}`
  entry.suppressed = 0
  entry.sampleIds = []
  entry.lastSentAt = Date.now()
  throttleMap.set(key, entry)
  await sendTelegram(text)
}

// Lazy background flusher so roll-ups still go out when a key goes quiet.
const flusher = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of throttleMap) {
    if (now - entry.lastSentAt >= windowMsFor(entry.severity)) {
      if (entry.suppressed > 0) {
        void flushRollup(key, entry)
      } else {
        throttleMap.delete(key) // idle key — drop to keep the map bounded
      }
    }
  }
}, 60_000)
flusher.unref?.()

/**
 * Record an occurrence in the throttle map.
 * Returns true when this occurrence should send a Telegram message now.
 */
function shouldSendNow(input: OpsAlertInput): boolean {
  const key = `${input.severity}:${input.source}:${input.title}`
  const now = Date.now()
  const entry = throttleMap.get(key)

  if (!entry || now - entry.lastSentAt >= windowMsFor(input.severity)) {
    if (entry) void flushRollup(key, entry)
    throttleMap.set(key, {
      lastSentAt: now,
      suppressed: 0,
      sampleIds: [],
      severity: input.severity,
      source: input.source,
      title: input.title,
    })
    return true
  }

  entry.suppressed++
  const id = input.userId ?? input.entity?.id
  if (id && entry.sampleIds.length < MAX_SAMPLE_IDS) entry.sampleIds.push(id)
  return false
}

/** Mark a key as just-sent so later single alerts dedup against a batch flush. */
function recordSent(severity: OpsSeverity, source: string, title: string): void {
  const key = `${severity}:${source}:${title}`
  const existing = throttleMap.get(key)
  throttleMap.set(key, {
    lastSentAt: Date.now(),
    suppressed: 0,
    sampleIds: [],
    severity,
    source,
    title,
    ...(existing ? { suppressed: existing.suppressed, sampleIds: existing.sampleIds } : {}),
  })
}

export async function opsAlert(input: OpsAlertInput): Promise<void> {
  try {
    logAlert(input)
    sentryCapture(input)
    if (input.userId) {
      serverAnalytics.systemFailure(input.userId, input.source, input.title, input.severity)
    }
    const dbDeduped = await persistOpsEvent(input)
    if (input.severity !== 'info' && shouldSendNow(input) && !dbDeduped) {
      await sendTelegram(telegramText(input))
    }
  } catch (err) {
    // Alerting must never break the caller — last-resort plain log.
    logger.error('[ops] opsAlert itself failed', err)
  }
}

export interface OpsBatch {
  add(item: Omit<OpsAlertInput, 'source'>): void
  flush(): Promise<void>
  readonly size: number
}

/**
 * Collect per-item failures during one cron run and flush them as ONE
 * aggregated alert (one Telegram, one Sentry event) instead of N.
 *
 * Flush bypasses the throttle window — a cron run is already naturally
 * rate-limited — but records into it so a subsequent single-item alert
 * for the same source/title dedups against the batch.
 */
export function opsBatch(source: string): OpsBatch {
  const items: OpsAlertInput[] = []
  return {
    add(item) {
      items.push({ ...item, source })
    },
    get size() {
      return items.length
    },
    async flush() {
      if (items.length === 0) return
      try {
        for (const item of items) {
          logAlert(item)
          if (item.userId) {
            serverAnalytics.systemFailure(item.userId, item.source, item.title, item.severity)
          }
          await persistOpsEvent(item)
        }

        const severity: OpsSeverity = items.some((i) => i.severity === 'critical')
          ? 'critical'
          : items.some((i) => i.severity === 'warn')
            ? 'warn'
            : 'info'
        const titles = [...new Set(items.map((i) => i.title))]
        const ids = [
          ...new Set(items.map((i) => i.userId ?? i.entity?.id).filter((v): v is string => Boolean(v))),
        ]
        const idsText = ids.length
          ? ` — ${ids.slice(0, MAX_SAMPLE_IDS).map(shortId).join(', ')}${ids.length > MAX_SAMPLE_IDS ? `, +${ids.length - MAX_SAMPLE_IDS}` : ''}`
          : ''
        const firstError = items.find((i) => i.error)
        const summary =
          `${severityEmoji(severity)} [${source}] ${items.length} failure${items.length === 1 ? '' : 's'}: ` +
          `${titles.join(', ')}${idsText}` +
          (firstError ? `\nfirst error: ${errorMessage(firstError.error)}` : '')

        Sentry.captureMessage(`${source}: batch of ${items.length} failures (${titles.join(', ')})`, {
          level: severity === 'critical' ? 'error' : 'warning',
          tags: { ops_source: source, ops_title: 'batch', ops_severity: severity },
          extra: {
            items: items.map((i) => ({
              title: i.title,
              detail: i.detail,
              userId: i.userId,
              entity: i.entity,
              error: i.error ? errorMessage(i.error) : undefined,
            })),
          },
        })

        for (const title of titles) recordSent(severity, source, title)
        if (severity !== 'info') await sendTelegram(summary)
      } catch (err) {
        logger.error('[ops] opsBatch flush failed', err)
      } finally {
        items.length = 0
      }
    },
  }
}

/** Test-only escape hatch: reset throttle state between cases. */
export function __resetOpsThrottleForTests(): void {
  throttleMap.clear()
}
