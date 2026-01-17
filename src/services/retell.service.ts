import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

export interface RetellCallParams {
  phoneNumber: string;
  agentId: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

class RetellService {
  private apiKey: string;
  private baseUrl = 'https://api.retellai.com/v2';

  constructor() {
    this.apiKey = config.retell.apiKey || '';
  }

  /**
   * Initiate an outbound call via Retell AI
   */
  async initiateCall(params: RetellCallParams): Promise<any> {
    if (!this.apiKey) {
      logger.warn('Retell API key not configured, simulating call');
      return this.simulateCall(params);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/create-phone-call`,
        {
          from_number: config.twilio.phoneNumber,
          to_number: params.phoneNumber,
          agent_id: params.agentId,
          override_agent_id: params.agentId,
          retell_llm_dynamic_variables: params.variables || {},
          metadata: params.metadata || {},
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Retell call initiated: ${response.data.call_id}`);

      return response.data;
    } catch (error) {
      logger.error('Retell API error:', error);
      throw error;
    }
  }

  /**
   * Generate dynamic prompt variables for call
   */
  generatePromptVariables(callType: string, userContext: Record<string, any>): Record<string, any> {
    const baseVars = {
      user_name: userContext.name || 'there',
      track: userContext.track || 'fitness',
      goal: userContext.goal || 'staying consistent',
      current_streak: userContext.currentStreak || 0,
      longest_streak: userContext.longestStreak || 0,
      workouts_this_week: userContext.workoutsThisWeek || 0,
      total_donated: userContext.totalDonated || 0,
      charity_name: userContext.charity || 'charity',
      charity_impact: userContext.charityImpact || 'making a difference',
    };

    // Add call-type specific variables
    switch (callType) {
      case 'MORNING_PLANNING':
        return {
          ...baseVars,
          call_purpose: 'planning today\'s workout',
          greeting: 'Good morning',
        };

      case 'EVENING_REVIEW':
        return {
          ...baseVars,
          call_purpose: 'checking in on today\'s workout',
          greeting: 'Hey',
        };

      case 'RESCUE':
        return {
          ...baseVars,
          call_purpose: 'supporting you when you\'re struggling',
          minimum_action: userContext.minimumMode || 'a 10-minute walk',
          gift_frame: userContext.giftFrame || 'yourself',
          greeting: 'Hey',
        };

      case 'WEEKLY_PLANNING':
        return {
          ...baseVars,
          call_purpose: 'planning the week ahead',
          greeting: 'Happy Sunday',
        };

      case 'MONTHLY_CHECKIN':
        return {
          ...baseVars,
          call_purpose: 'reflecting on your transformation',
          greeting: 'Hey',
        };

      default:
        return baseVars;
    }
  }

  /**
   * Get agent ID based on call type and user tier
   */
  getAgentId(callType: string, userTier?: string): string {
    // In production, you might have different agents for B2B vs B2C
    if (userTier === 'B2B') {
      return config.retell.agentIds.b2b || 'default-agent';
    }

    return config.retell.agentIds.b2c || 'default-agent';
  }

  /**
   * Get call details from Retell
   */
  async getCallDetails(callId: string): Promise<any> {
    if (!this.apiKey) {
      logger.warn('Retell API key not configured');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/get-call/${callId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Error fetching call details:', error);
      throw error;
    }
  }

  /**
   * Cancel an ongoing call
   */
  async cancelCall(callId: string): Promise<void> {
    if (!this.apiKey) {
      logger.warn('Retell API key not configured');
      return;
    }

    try {
      await axios.post(
        `${this.baseUrl}/cancel-call/${callId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      logger.info(`Retell call cancelled: ${callId}`);
    } catch (error) {
      logger.error('Error cancelling call:', error);
      throw error;
    }
  }

  /**
   * Simulate call for testing without Retell API
   */
  private simulateCall(params: RetellCallParams) {
    const simulatedCallId = `sim_${Date.now()}`;

    logger.info(`[SIMULATED] Retell call to ${params.phoneNumber}`);
    logger.info(`[SIMULATED] Agent: ${params.agentId}`);
    logger.info(`[SIMULATED] Variables:`, params.variables);

    return {
      call_id: simulatedCallId,
      agent_id: params.agentId,
      status: 'registered',
      metadata: params.metadata,
    };
  }
}

export default new RetellService();
