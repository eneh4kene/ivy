import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Turn an axios/Retell failure into one clean, actionable line instead of letting
 * Winston serialise the entire axios error (request + socket + agent) into a
 * thousands-of-lines dump that buries the real cause. Returns a short message and
 * the structured fields worth logging.
 */
function describeRetellError(error: unknown): { message: string; status?: number; detail?: unknown } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const data = error.response?.data;
    // Retell returns { error_message } or { message }; fall back to statusText.
    const apiMsg =
      (data && typeof data === 'object' && ((data as any).error_message ?? (data as any).message)) ||
      statusText ||
      error.message;
    const hint =
      status === 402
        ? ' (Retell account out of credit / billing required)'
        : status === 401 || status === 403
        ? ' (Retell API key invalid or unauthorised)'
        : '';
    return { message: `Retell ${status ?? '?'}: ${apiMsg}${hint}`, status, detail: data };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

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
  // Agent / LLM management endpoints live at the API ROOT, not under /v2
  // (only call endpoints are versioned). get-agent/get-retell-llm 404 on /v2.
  private rootUrl = 'https://api.retellai.com';

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
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell create-phone-call failed — ${message}`, { status, detail });
      // Throw a clean error so the caller (and call.failureReason) shows the cause,
      // not a 5,000-line axios object.
      throw new Error(message);
    }
  }

  /**
   * Register an OUTBOUND call with Retell WITHOUT a number registered in Retell
   * (BYOC "dial to SIP endpoint", aka jambonz Method 2). We bring our own carrier
   * (Twilio): Retell hands back a `call_id`, we then have Twilio dial the user and
   * bridge the audio to `sip:<call_id>@<retell-sip-host>`. Retell binds the SIP leg
   * to this registration by the call_id in the SIP user-part, so the agent +
   * dynamic variables + prompt override we set here apply to the live call.
   *
   * Returns the Retell call_id (used to build the SIP URI).
   */
  async registerPhoneCall(params: {
    agentId: string;
    fromNumber: string;
    toNumber: string;
    variables?: Record<string, any>;
    metadata?: Record<string, any>;
    systemPrompt?: string;
  }): Promise<string> {
    if (!this.apiKey) {
      logger.warn('Retell API key not configured, simulating register-phone-call');
      return `sim_${Date.now()}`;
    }
    const body: Record<string, any> = {
      agent_id: params.agentId,
      from_number: params.fromNumber,
      to_number: params.toNumber,
      direction: 'outbound',
      retell_llm_dynamic_variables: params.variables || {},
      metadata: params.metadata || {},
    };
    // Drive the agent's prompt via the {{system_prompt}} dynamic variable. The
    // agent's general_prompt is bound to "{{system_prompt}}" (see
    // /retell-bind-prompt), so injecting it here makes our per-call composed
    // prompt the actual prompt for this call. NOTE: register-phone-call's
    // agent_override.retell_llm does NOT support general_prompt (only model,
    // begin_message, temperature, …) — it is silently ignored — which is why the
    // earlier override never applied. Dynamic variable is the working path.
    if (params.systemPrompt) {
      body.retell_llm_dynamic_variables = {
        ...body.retell_llm_dynamic_variables,
        system_prompt: params.systemPrompt,
      };
    }
    try {
      const response = await axios.post(`${this.baseUrl}/register-phone-call`, body, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      const callId = response.data?.call_id;
      if (!callId) throw new Error('register-phone-call returned no call_id');
      logger.info(`Retell call registered (outbound BYOC): ${callId}`);
      return callId;
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell register-phone-call failed — ${message}`, { status, detail });
      throw new Error(message);
    }
  }

  /**
   * Build the SIP URI to bridge a Twilio leg into a registered Retell call.
   * RETELL_SIP_ENDPOINT may be a bare host, `sip:host`, or `sip:user@host`; we
   * keep only the host and put the registered call_id in the user-part.
   */
  buildSipUri(callId: string): string {
    const raw = (config.retell.sipEndpoint || '').trim();
    if (!raw) throw new Error('RETELL_SIP_ENDPOINT not configured');
    const host = raw.replace(/^sip:/i, '').split('@').pop() || '';
    if (!host) throw new Error(`RETELL_SIP_ENDPOINT has no host: ${raw}`);
    return `sip:${callId}@${host}`;
  }

  /**
   * List phone numbers registered in the Retell account. Used to diagnose
   * "Item <num> not found from phone-number" 404s — the from_number must be one
   * of these (purchased in Retell or imported via SIP/Twilio).
   */
  async listPhoneNumbers(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const response = await axios.get(`${this.baseUrl}/list-phone-numbers`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell list-phone-numbers failed — ${message}`, { status, detail });
      throw new Error(message);
    }
  }

  /**
   * Fetch an agent's config — used to learn its response_engine type so we know
   * how to override the prompt per-call (retell_llm vs conversation_flow).
   */
  async getAgent(agentId: string): Promise<any> {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.rootUrl}/get-agent/${agentId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.data;
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell get-agent failed — ${message}`, { status, detail });
      throw new Error(message);
    }
  }

  /** Patch an agent's config — e.g. repoint webhook_url to the live backend. */
  async updateAgent(agentId: string, patch: Record<string, any>): Promise<any> {
    if (!this.apiKey) return null;
    try {
      const response = await axios.patch(`${this.rootUrl}/update-agent/${agentId}`, patch, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info(`Retell agent ${agentId} updated (${Object.keys(patch).join(', ')})`);
      return response.data;
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell update-agent failed — ${message}`, { status, detail });
      throw new Error(message);
    }
  }

  /** Fetch a Retell LLM (response engine) config — to read its general_prompt. */
  async getRetellLlm(llmId: string): Promise<any> {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.rootUrl}/get-retell-llm/${llmId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.data;
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell get-retell-llm failed — ${message}`, { status, detail });
      throw new Error(message);
    }
  }

  /**
   * Patch a Retell LLM's config. We use this to set the agent's general_prompt to
   * a thin template that defers to our per-call composed prompt via the
   * {{system_prompt}} dynamic variable — so buildSystemPrompt fully drives every
   * call (name, streak, charity, brief) instead of a static dashboard prompt.
   */
  async updateRetellLlm(llmId: string, patch: Record<string, any>): Promise<any> {
    if (!this.apiKey) return null;
    try {
      const response = await axios.patch(`${this.rootUrl}/update-retell-llm/${llmId}`, patch, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info(`Retell LLM ${llmId} updated (${Object.keys(patch).join(', ')})`);
      return response.data;
    } catch (error) {
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell update-retell-llm failed — ${message}`, { status, detail });
      throw new Error(message);
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
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell get-call failed — ${message}`, { status, detail });
      throw new Error(message);
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
      const { message, status, detail } = describeRetellError(error);
      logger.error(`Retell cancel-call failed — ${message}`, { status, detail });
      throw new Error(message);
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
