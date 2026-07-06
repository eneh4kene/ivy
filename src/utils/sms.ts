import { config } from '../config';

/**
 * Pick the SMS "From" for a destination number.
 *
 * US long codes cannot deliver SMS to international destinations (Twilio
 * error 21612 — learned live when the +1 650 number failed to reach a +44
 * mobile), so the sender must be chosen per destination:
 *
 *   - US destination → the US number (US carriers REJECT alphanumeric senders)
 *   - destination matches a number we own in that country → use that number
 *     (two-way SMS keeps working, e.g. the missed-call "reply CALL" flow)
 *   - anything else → the alphanumeric sender "Ivy". The UK and most non-US
 *     networks accept unregistered alpha senders; one-way only, which fits
 *     OTPs and nudges. This is the interim path until the UK regulatory
 *     bundle lands and TWILIO_PHONE_NUMBER becomes a real +44 — at which
 *     point UK traffic automatically reverts to the two-way number.
 */
export function smsFrom(to: string): string {
  const primary = config.twilio.phoneNumber;   // "+44 slot" (may temporarily hold a +1)
  const us = config.twilio.phoneNumberUs;

  if (to.startsWith('+1')) return us ?? primary ?? '';
  if (to.startsWith('+44') && primary?.startsWith('+44')) return primary;
  return 'Ivy';
}
