import { inngest } from './client'
import prisma from '../utils/prisma'
import { opsBatch } from '../lib/ops-alert'

/**
 * Watchdog — detects jobs that DIDN'T run.
 *
 * Every cron writes a JobHeartbeat row via withHeartbeat(). This function
 * (itself a cron) compares each registered job's last start against its
 * allowed staleness and pages when a job is overdue or hung. The watchdog
 * runs inside Inngest too, so "Inngest entirely down" is covered from the
 * outside by /health/jobs + the external uptime pinger, not by this.
 */

/** jobName → max minutes since lastStartedAt before it counts as overdue. */
export const JOB_REGISTRY: Record<string, { maxStalenessMin: number }> = {
  // */15 cron → two missed polls + slack
  'arming-loop': { maxStalenessMin: 35 },
  // */30 crons → two missed polls + slack
  'ponder-scheduler': { maxStalenessMin: 70 },
  'circle-session-lifecycle': { maxStalenessMin: 70 },
  'circle-game-clock': { maxStalenessMin: 70 },
  // dailies → 26h
  'daily-evening-calls': { maxStalenessMin: 26 * 60 },
  'daily-chat-memory': { maxStalenessMin: 26 * 60 },
  'stakecycle-settle': { maxStalenessMin: 26 * 60 }, // money — the one that must never rot
  'season-advance': { maxStalenessMin: 26 * 60 },
  'stuck-call-recovery': { maxStalenessMin: 26 * 60 },
  'daily-cost-alert': { maxStalenessMin: 26 * 60 },
  'ops-daily-guard': { maxStalenessMin: 26 * 60 },
  'ops-invariant-sweep': { maxStalenessMin: 3 * 60 },
  // weeklies → 8 days
  'weekly-buddy-digest': { maxStalenessMin: 8 * 24 * 60 },
  'weekly-coach-digest': { maxStalenessMin: 8 * 24 * 60 },
  'circle-member-pulse': { maxStalenessMin: 8 * 24 * 60 },
  'stakecycle-open': { maxStalenessMin: 8 * 24 * 60 },
  'ops-weekly-pulse': { maxStalenessMin: 8 * 24 * 60 },
  // monthly → 32 days
  'monthly-donation-dispatch': { maxStalenessMin: 32 * 24 * 60 },
}

const HUNG_AFTER_MIN = 60

export async function runWatchdog(): Promise<{ overdue: string[]; hung: string[]; neverRan: string[] }> {
  const rows = await prisma.jobHeartbeat.findMany()
  const byName = new Map(rows.map((r) => [r.jobName, r]))
  const now = Date.now()
  const failures = opsBatch('watchdog')
  const overdue: string[] = []
  const hung: string[] = []
  const neverRan: string[] = []

  for (const [jobName, spec] of Object.entries(JOB_REGISTRY)) {
    const hb = byName.get(jobName)

    if (!hb) {
      // Row appears after the job's first run post-deploy. Only page for
      // frequent jobs — a weekly with no row yet is just young, and its
      // overdue case is caught once the first row exists.
      if (spec.maxStalenessMin <= 70) {
        neverRan.push(jobName)
        failures.add({
          severity: 'warn',
          title: 'job_never_ran',
          detail: `${jobName} has no heartbeat — never ran since the heartbeat table was created`,
          entity: { type: 'job', id: jobName },
        })
      }
      continue
    }

    const staleMin = (now - hb.lastStartedAt.getTime()) / 60_000

    if (hb.lastStatus === 'FAILED') {
      // Terminal failure already paged by the inngest/function.failed catch-all.
      continue
    }

    if (staleMin > spec.maxStalenessMin) {
      overdue.push(jobName)
      failures.add({
        severity: 'critical',
        title: 'job_overdue',
        detail: `${jobName} last started ${Math.round(staleMin)}m ago (allowed ${spec.maxStalenessMin}m)`,
        entity: { type: 'job', id: jobName },
      })
      continue
    }

    if (hb.lastStatus === 'RUNNING' && staleMin > HUNG_AFTER_MIN) {
      hung.push(jobName)
      failures.add({
        severity: 'warn',
        title: 'job_hung',
        detail: `${jobName} started ${Math.round(staleMin)}m ago and never finished`,
        entity: { type: 'job', id: jobName },
      })
    }
  }

  await failures.flush()
  return { overdue, hung, neverRan }
}

// Every 30 minutes — check the whole cron fleet's pulse.
export const opsWatchdog = inngest.createFunction(
  { id: 'ops-watchdog', name: 'Ops: job watchdog', triggers: { cron: '*/30 * * * *' } },
  async ({ step }) => {
    const result = await step.run('check-heartbeats', () => runWatchdog())
    return result
  }
)
