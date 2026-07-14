import prisma from '../utils/prisma'
import logger from '../utils/logger'

/**
 * Heartbeat wrapper for Inngest CRON functions — powers the watchdog
 * (src/inngest/watchdog.ts) and /health/jobs.
 *
 * Replay-safety: Inngest re-runs the whole handler top-to-bottom after every
 * step checkpoint, so the heartbeat writes MUST live inside `step.run` blocks
 * (memoized — executed exactly once per run, no matter how many replays).
 *
 * Rules:
 * - Wrap crons only. Never wrap event functions that sleep (`initiateCall`,
 *   `programmeUpdatedNotify`): their "staleness" is meaningless and the extra
 *   leading step would disturb long-lived in-flight runs.
 * - No try/catch here: a catch would fire on every step retry (wrong signal).
 *   Terminal failures are marked FAILED by the `inngest/function.failed`
 *   catch-all in failure-alert.ts.
 * - Heartbeat writes are best-effort (`.catch` inside the step): a missing
 *   job_heartbeats table (deploy-before-migrate) must not fail the actual job.
 */
export function withHeartbeat<TCtx extends { step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> } }, TResult>(
  jobName: string,
  body: (ctx: TCtx) => Promise<TResult>,
): (ctx: TCtx) => Promise<TResult> {
  return async (ctx: TCtx): Promise<TResult> => {
    await ctx.step.run('hb-start', () =>
      prisma.jobHeartbeat
        .upsert({
          where: { jobName },
          update: { lastStartedAt: new Date(), lastStatus: 'RUNNING', lastError: null },
          create: { jobName, lastStartedAt: new Date(), lastStatus: 'RUNNING' },
        })
        .catch((err) => logger.warn(`Heartbeat start write failed for ${jobName}`, err)),
    )

    const result = await body(ctx)

    await ctx.step.run('hb-finish', () =>
      prisma.jobHeartbeat
        .update({
          where: { jobName },
          data: { lastFinishedAt: new Date(), lastStatus: 'SUCCESS' },
        })
        .catch((err) => logger.warn(`Heartbeat finish write failed for ${jobName}`, err)),
    )

    return result
  }
}

/**
 * Mark a job's heartbeat FAILED — called by the terminal-failure catch-all
 * when `inngest/function.failed` fires for a registered cron.
 */
export async function markHeartbeatFailed(jobName: string, errorMessage: string): Promise<void> {
  await prisma.jobHeartbeat
    .upsert({
      where: { jobName },
      update: { lastStatus: 'FAILED', lastError: errorMessage.slice(0, 2000) },
      create: {
        jobName,
        lastStartedAt: new Date(),
        lastStatus: 'FAILED',
        lastError: errorMessage.slice(0, 2000),
      },
    })
    .catch(() => {})
}
