import { Job } from 'bull';
import { callScheduleQueue } from '../config/queues';
import callService from '../services/call.service';
import retellService from '../services/retell.service';
import { handleMissedCall as handleMissedCallComms } from '../services/communication.service';
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

// Flatten nested context into top-level Retell LLM variables
function flattenContext(ctx: Record<string, any> = {}): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, val] of Object.entries(ctx)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [k2, v2] of Object.entries(val as object)) {
        if (v2 !== null && v2 !== undefined) flat[`${key}_${k2}`] = String(v2);
      }
    } else if (Array.isArray(val)) {
      flat[key] = val.join(', ');
    } else {
      flat[key] = String(val);
    }
  }
  return flat;
}

callScheduleQueue.process('initiate-call', async (job: Job<CallJobData>) => {
  const { callId, userId, callType, phone, userName, contextData } = job.data;

  try {
    logger.info(`Initiating ${callType} call ${callId} for ${userName}`);

    await callService.updateCallStatus(callId, 'IN_PROGRESS', { startedAt: new Date() });

    const isB2B = contextData?.subscriptionTier === 'B2B';
    const agentId = getAgentId(callType, isB2B);

    const retellCall = await retellService.initiateCall({
      phoneNumber: phone,
      agentId,
      variables: flattenContext({ ...contextData, callType, userName }),
      metadata: { callId, userId, callType },
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

// Missed call handler — fires when Retell reports no answer
callScheduleQueue.process('missed-call-followup', async (job: Job<{ userId: string; callId: string }>) => {
  const { userId, callId: _callId } = job.data;
  try {
    await handleMissedCallComms(userId);
    logger.info(`Missed call followup sent for user ${userId}`);
  } catch (err) {
    logger.error(`Missed call followup failed for ${userId}:`, err);
  }
});

logger.info('Call processor worker started');

export default callScheduleQueue;
