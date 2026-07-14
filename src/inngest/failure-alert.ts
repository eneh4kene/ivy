import { inngest } from './client'
import { opsAlert } from '../lib/ops-alert'
import { markHeartbeatFailed } from './with-heartbeat'
import { JOB_REGISTRY } from './watchdog'

/**
 * Fleet-wide terminal failure alert.
 *
 * Inngest emits the internal `inngest/function.failed` event once a function
 * has exhausted its retries. One listener here covers every registered
 * function — crons and event workers alike — so a Message stuck FAILED after
 * 3 send attempts or a call initiation that never went through pages the
 * admin instead of rotting in the DB.
 *
 * Payload shape per inngest v4 `FailureEventPayload`:
 * data = { function_id, run_id, error: { name, message, stack? }, event }.
 */
export const functionFailedAlert = inngest.createFunction(
  {
    id: 'ops-function-failed',
    name: 'Ops: Inngest function failed (terminal)',
    retries: 0,
    triggers: { event: 'inngest/function.failed' },
  },
  async ({ event }) => {
    const { function_id: functionId, run_id: runId, error, event: original } = event.data as {
      function_id: string
      run_id: string
      error?: { name?: string; message?: string }
      event?: { name?: string; data?: Record<string, unknown> }
    }

    // Recursion guard: if this alerter itself fails, log-only via opsAlert's
    // own never-throw path is fine, but never re-alert on our own failure event.
    if (functionId?.endsWith('ops-function-failed')) return { skipped: true }

    const data = original?.data ?? {}
    const userId = typeof data.userId === 'string' ? data.userId : undefined
    const entity =
      typeof data.callId === 'string'
        ? { type: 'call', id: data.callId }
        : typeof data.messageId === 'string'
          ? { type: 'message', id: data.messageId }
          : undefined

    // Inngest prefixes function ids with the app id ("ivy-arming-loop") —
    // normalize so registry lookups and alert sources read cleanly.
    const appPrefix = `${inngest.id}-`
    const jobName = functionId?.startsWith(appPrefix) ? functionId.slice(appPrefix.length) : functionId

    // Let the watchdog see the terminal state too (skip = already paged here).
    if (jobName && JOB_REGISTRY[jobName]) {
      await markHeartbeatFailed(jobName, error?.message ?? 'unknown')
    }

    await opsAlert({
      severity: 'critical',
      source: `inngest:${jobName}`,
      title: 'function_failed_terminal',
      detail:
        `${error?.name ?? 'Error'}: ${error?.message ?? 'unknown'}` +
        ` | run=${runId}` +
        (original?.name ? ` | event=${original.name}` : '') +
        ` | data=${JSON.stringify(data).slice(0, 300)}`,
      userId,
      entity,
      error: new Error(error?.message ?? `inngest function ${functionId} failed`),
    })

    return { alerted: functionId }
  }
)
