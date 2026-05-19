import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

export interface RetellCallParams {
  phoneNumber: string;   // destination (user's number)
  fromNumber?: string;   // override which Twilio number to call from (defaults to config.twilio.phoneNumber)
  agentId: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
  systemPrompt?: string; // passed via override_llm_config.general_prompt — replaces agent's static prompt
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
      const body: Record<string, any> = {
        from_number: params.fromNumber ?? config.twilio.phoneNumber,
        to_number: params.phoneNumber,
        agent_id: params.agentId,
        override_agent_id: params.agentId,
        retell_llm_dynamic_variables: params.variables || {},
        metadata: params.metadata || {},
      };

      if (params.systemPrompt) {
        body.override_llm_config = { general_prompt: params.systemPrompt };
      }

      const response = await axios.post(
        `${this.baseUrl}/create-phone-call`,
        body,
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
