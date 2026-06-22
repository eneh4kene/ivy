/**
 * Inngest call functions (Phase 2) — replaces the Bull `call-schedule` queue.
 *
 * `initiateCall` is a faithful port of the old src/workers/call.processor.ts
 * `initiate-call` job. Delayed scheduling (previously Bull's `{ delay }`) is now
 * a durable `step.sleepUntil` so Inngest Cloud holds the call until its time —
 * no Redis, no always-on poller. Cancellation (previously `job.remove()`) is a
 * `call/cancelled` event matched via `cancelOn`.
 */
import { inngest } from './client';
import callService from '../services/call.service';
import retellService from '../services/retell.service';
import promptService, { buildPonderPrompt } from '../services/prompt.service';
import briefService from '../services/brief.service';
import { getTrackConfig } from '../config/tracks';
import { flattenContext } from '../utils/retell';
import prisma from '../utils/prisma';
import { config } from '../config';
import logger from '../utils/logger';

function getAgentId(_callType: string, isB2B: boolean): string {
  if (isB2B) return config.retell.agentIds.b2b || config.retell.agentIds.b2c || '';
  return config.retell.agentIds.b2c || '';
}

/**
 * event: `call/scheduled`
 * data: { callId, userId, callType, phone, userName, contextData?, scheduledAt (ISO) }
 *
 * idempotency on callId stops a duplicate enqueue firing two calls (and two
 * Retell charges). cancelOn drops the run if the call is cancelled while it
 * sleeps. retries:3 mirrors the old Bull attempts:3.
 */
type StepLike = {
  run: <T>(id: string, fn: () => Promise<T> | T) => Promise<T>;
  sleepUntil: (id: string, until: Date) => Promise<unknown>;
};

/** Exported for unit tests — the body createFunction wraps. */
export async function initiateCallHandler({ event, step }: { event: any; step: StepLike }) {
    const { callId, userId, callType, phone, userName, contextData, scheduledAt } = event.data as {
      callId: string;
      userId: string;
      callType: string;
      phone: string;
      userName: string;
      contextData?: Record<string, any>;
      scheduledAt?: string;
    };

    // Hold the call until its scheduled time (was Bull's { delay }). Past-dated
    // calls fall straight through, matching the old "add immediately" branch.
    if (scheduledAt && new Date(scheduledAt).getTime() > Date.now()) {
      await step.sleepUntil('await-scheduled-time', new Date(scheduledAt));
    }

    return step.run('initiate-call', async () => {
      // Guard against a cancel that landed before the cancelOn match (or for the
      // immediate path): never dial a call that's no longer SCHEDULED.
      const current = await prisma.call.findUnique({ where: { id: callId }, select: { status: true } });
      if (current && current.status !== 'SCHEDULED') {
        logger.info(`Call ${callId} no longer SCHEDULED (${current.status}) — skipping initiate`);
        return { skipped: true, status: current.status };
      }

      try {
        logger.info(`Initiating ${callType} call ${callId} for ${userName}`);

        // Fetch fresh context at execution time so memory layers reflect calls that
        // happened after this job was scheduled (e.g. morning summary for evening call)
        let ctx = contextData ?? {};
        try {
          if (callType === 'COACH_PONDER') {
            ctx = await callService.getCoachPonderContext(userId);
          } else {
            ctx = await callService.getUserContext(userId, callType);
          }
        } catch (err) {
          logger.warn(`Fresh context fetch failed for ${callId} — falling back to scheduled snapshot:`, err);
        }

        const isB2B = ctx.subscription_tier === 'B2B';
        const agentId = getAgentId(callType, isB2B);

        // Generate a call-specific brief via Haiku — falls back to static flow if unavailable
        const isPonder = callType === 'COACH_PONDER';
        const trackConfig = isPonder ? null : getTrackConfig(ctx.track);
        const brief = isPonder ? null : await briefService.generateCallBrief(callType, ctx, trackConfig!);
        const systemPrompt = isPonder
          ? buildPonderPrompt(ctx)
          : promptService.buildSystemPrompt(callType, ctx, isB2B, brief ?? undefined);

        // Call from the UK number for GBP users, US number for USD users (falls back to UK if US not configured)
        const fromNumber = (ctx.currency === 'USD' && config.twilio.phoneNumberUs)
          ? config.twilio.phoneNumberUs
          : config.twilio.phoneNumber;

        const retellCall = await retellService.initiateCall({
          phoneNumber: phone,
          fromNumber,
          agentId,
          variables: flattenContext({ ...ctx, call_type: callType.toLowerCase() }),
          metadata: { callId, userId, callType },
          systemPrompt,
        });

        // Update call record with Retell's call ID
        if (retellCall?.call_id) {
          await callService.updateCallStatus(callId, 'IN_PROGRESS', {
            retellCallId: retellCall.call_id,
          });
        }

        logger.info(`Retell call initiated: ${retellCall?.call_id ?? 'simulated'}`);

        return { success: true, callId, retellCallId: retellCall?.call_id };
      } catch (error) {
        logger.error(`Call ${callId} failed to initiate:`, error);
        await callService.updateCallStatus(callId, 'FAILED', { outcome: 'error' });
        throw error;
      }
    });
}

export const initiateCall = inngest.createFunction(
  {
    id: 'initiate-call',
    name: 'Initiate scheduled call',
    retries: 3,
    idempotency: 'event.data.callId',
    cancelOn: [{ event: 'call/cancelled', if: 'event.data.callId == async.data.callId' }],
    triggers: { event: 'call/scheduled' },
  },
  initiateCallHandler
);

export const callFunctions = [initiateCall];
