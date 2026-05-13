import { Job } from 'bull';
import { callScheduleQueue } from '../config/queues';
import callService from '../services/call.service';
import retellService from '../services/retell.service';
import promptService from '../services/prompt.service';
import briefService from '../services/brief.service';
import { getTrackConfig } from '../config/tracks';
import { flattenContext } from '../utils/retell';
import { config } from '../config';
import logger from '../utils/logger';

interface CallJobData {
  callId: string;
  userId: string;
  callType: string;
  phone: string;
  userName: string;
  contextData?: Record<string, any>;
}

function getAgentId(_callType: string, isB2B: boolean): string {
  if (isB2B) return config.retell.agentIds.b2b || config.retell.agentIds.b2c || '';
  return config.retell.agentIds.b2c || '';
}

callScheduleQueue.process('initiate-call', async (job: Job<CallJobData>) => {
  const { callId, userId, callType, phone, userName, contextData } = job.data;

  try {
    logger.info(`Initiating ${callType} call ${callId} for ${userName}`);

    // Fetch fresh context at execution time so memory layers reflect calls that
    // happened after this job was scheduled (e.g. morning summary for evening call)
    let ctx = contextData ?? {};
    try {
      ctx = await callService.getUserContext(userId, callType);
    } catch (err) {
      logger.warn(`Fresh context fetch failed for ${callId} — falling back to scheduled snapshot:`, err);
    }

    const isB2B = ctx.subscription_tier === 'B2B';
    const agentId = getAgentId(callType, isB2B);

    // Generate a call-specific brief via Haiku — falls back to static flow if unavailable
    const trackConfig = getTrackConfig(ctx.track);
    const brief = await briefService.generateCallBrief(callType, ctx, trackConfig);

    const systemPrompt = promptService.buildSystemPrompt(callType, ctx, isB2B, brief ?? undefined);

    const retellCall = await retellService.initiateCall({
      phoneNumber: phone,
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

logger.info('Call processor worker started');

export default callScheduleQueue;
