import { Job } from 'bull';
import { callScheduleQueue } from '../config/queues';
import callService from '../services/call.service';
import logger from '../utils/logger';

// This would integrate with Retell AI in production
// For now, we'll create a placeholder that logs the call

interface CallJobData {
  callId: string;
  userId: string;
  callType: string;
  phone: string;
  userName: string;
  contextData?: Record<string, any>;
}

/**
 * Process call initiation jobs
 */
callScheduleQueue.process('initiate-call', async (job: Job<CallJobData>) => {
  const { callId, userId, callType, phone, userName, contextData } = job.data;

  try {
    logger.info(`Processing call initiation for call ${callId}`);

    // Update call status to IN_PROGRESS
    await callService.updateCallStatus(callId, 'IN_PROGRESS', {
      startedAt: new Date(),
    });

    // TODO: In production, this would call Retell AI API
    // const retellCall = await retellService.initiateCall({
    //   phoneNumber: phone,
    //   agentId: getAgentIdByCallType(callType),
    //   variables: contextData,
    // });

    // For now, simulate call
    logger.info(`[SIMULATED] Initiating ${callType} call to ${phone} for ${userName}`);
    logger.info(`[SIMULATED] Context:`, contextData);

    // Simulate call completion after 30 seconds
    setTimeout(async () => {
      try {
        await callService.updateCallStatus(callId, 'COMPLETED', {
          endedAt: new Date(),
          duration: 30,
          outcome: 'completed',
          sentiment: 'positive',
          transcript: `[SIMULATED] ${callType} call with ${userName}`,
        });
        logger.info(`[SIMULATED] Call ${callId} completed`);
      } catch (error) {
        logger.error(`Error completing simulated call ${callId}:`, error);
      }
    }, 30000);

    return {
      success: true,
      callId,
      message: 'Call initiated successfully',
    };
  } catch (error) {
    logger.error(`Error processing call ${callId}:`, error);

    // Update call status to FAILED
    await callService.updateCallStatus(callId, 'FAILED', {
      outcome: 'error',
    });

    throw error;
  }
});

logger.info('Call processor worker started');

export default callScheduleQueue;
