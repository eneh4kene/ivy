/**
 * Outbound call orchestration — BYOC "dial to SIP endpoint" (no number in Retell).
 *
 * Flow (jambonz Method 2, https://docs.retellai.com/make-calls/custom-telephony):
 *   1. retellService.registerPhoneCall(...)  → binds agent + dynamic vars + prompt,
 *      returns a Retell call_id.
 *   2. Twilio places the PSTN call to the user FROM our Twilio number and, on
 *      answer, bridges the media to `sip:<call_id>@<retell-sip-host>` via TwiML.
 *      Retell matches the SIP leg to the registration by the call_id user-part.
 *
 * This replaces the old retellService.initiateCall (create-phone-call) path, which
 * required the caller number to be registered inside Retell (→ 404 "Item <num> not
 * found from phone-number").
 */
import twilio from 'twilio';
import retellService from './retell.service';
import { config } from '../config';
import logger from '../utils/logger';

export interface OutboundCallParams {
  toNumber: string;          // user's phone (E.164)
  fromNumber: string;        // our Twilio caller ID (E.164)
  agentId: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
  systemPrompt?: string;
}

export interface OutboundCallResult {
  retellCallId: string;
  twilioSid: string;
  sipUri: string;
}

class OutboundCallService {
  private client() {
    return twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  /**
   * Register the call with Retell, then have Twilio dial the user and bridge to
   * Retell's SIP endpoint. Returns the Retell call_id (for our call record) and
   * the Twilio call SID. Throws on any failure so the caller can mark FAILED with
   * the real reason.
   */
  async placeCall(params: OutboundCallParams): Promise<OutboundCallResult> {
    // 1) Register with Retell → call_id binds agent + context to the SIP leg.
    const retellCallId = await retellService.registerPhoneCall({
      agentId: params.agentId,
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      variables: params.variables,
      metadata: params.metadata,
      systemPrompt: params.systemPrompt,
    });

    const sipUri = retellService.buildSipUri(retellCallId);

    // 2) Twilio dials the user and bridges to Retell on answer. answerOnBridge so
    // the user isn't billed/ringing-state until Retell actually picks up the SIP.
    const twiml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      `<Dial answerOnBridge="true" callerId="${params.fromNumber}">` +
      `<Sip>${sipUri}</Sip>` +
      '</Dial>' +
      '</Response>';

    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
    }

    try {
      const call = await this.client().calls.create({
        to: params.toNumber,
        from: params.fromNumber,
        twiml,
      });
      logger.info(`Twilio outbound call placed: ${call.sid} → ${params.toNumber} (retell ${retellCallId})`);
      return { retellCallId, twilioSid: call.sid, sipUri };
    } catch (error: any) {
      // Twilio errors carry .code / .message — surface them cleanly.
      const msg = error?.code
        ? `Twilio ${error.code}: ${error.message}`
        : (error?.message ?? String(error));
      logger.error(`Twilio outbound dial failed — ${msg}`);
      throw new Error(msg);
    }
  }
}

export default new OutboundCallService();
