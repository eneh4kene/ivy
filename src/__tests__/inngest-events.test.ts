/**
 * Inngest event functions (Phase 2) — Unit Tests
 *
 * Covers the handlers that replaced the Bull call/message processors:
 *   M1 — sendSmsHandler: success → message status SENT + usage logged
 *   M2 — sendSmsHandler: Twilio error → status FAILED + rethrows
 *   M3 — sendSmsHandler: Twilio not configured → skips (no send)
 *   M4 — sendTelegramHandler: success → status SENT + usage logged
 *   M5 — sendTelegramHandler: API error → status FAILED + rethrows
 *   C1 — initiateCallHandler: dials Retell + marks IN_PROGRESS
 *   C2 — initiateCallHandler: future scheduledAt → sleepUntil is awaited first
 *   C3 — initiateCallHandler: call no longer SCHEDULED → skips (cancellation guard)
 *   C4 — initiateCallHandler: Retell throws → marks FAILED + rethrows
 *
 * step is faked so run() executes its body inline and sleepUntil() is observable.
 */

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock('../inngest/client', () => ({
  inngest: { createFunction: jest.fn((_cfg: any, handler: any) => handler) },
}));

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    message: { update: jest.fn().mockResolvedValue({}) },
    call: { findUnique: jest.fn() },
  },
}));

const mockTwilioCreate = jest.fn();
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: mockTwilioCreate } })));

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

jest.mock('../services/usage.service', () => ({ logUsage: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../services/retell.service', () => ({
  __esModule: true,
  default: { registerPhoneCall: jest.fn(), buildSipUri: jest.fn() },
}));

jest.mock('../services/outbound-call.service', () => ({
  __esModule: true,
  default: { placeCall: jest.fn() },
}));

jest.mock('../services/call.service', () => ({
  __esModule: true,
  default: {
    getUserContext: jest.fn().mockResolvedValue({ track: 'default', subscription_tier: 'PRO' }),
    getCoachPonderContext: jest.fn().mockResolvedValue({}),
    updateCallStatus: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../services/brief.service', () => ({
  __esModule: true,
  default: { generateCallBrief: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../services/prompt.service', () => ({
  __esModule: true,
  default: { buildSystemPrompt: jest.fn().mockReturnValue('system') },
  buildPonderPrompt: jest.fn().mockReturnValue('ponder'),
}));

jest.mock('../config/tracks', () => ({ getTrackConfig: jest.fn().mockReturnValue({}) }));
jest.mock('../utils/retell', () => ({ flattenContext: jest.fn().mockReturnValue({}) }));

jest.mock('../config', () => ({
  config: {
    logging: { level: 'error' },
    server: { env: 'test' },
    twilio: { accountSid: 'AC', authToken: 'tok', phoneNumber: '+1', phoneNumberUs: '+1us' },
    telegram: { botToken: 'bot' },
    retell: { agentIds: { b2c: 'agent-b2c', b2b: 'agent-b2b' } },
  },
}));

import prisma from '../utils/prisma';
import axios from 'axios';
import { logUsage } from '../services/usage.service';
import outboundCallService from '../services/outbound-call.service';
import callService from '../services/call.service';
import { sendSmsHandler, sendTelegramHandler } from '../inngest/messaging';
import { initiateCallHandler } from '../inngest/calls';

// step fake: run() executes inline; sleepUntil() records its call.
const makeStep = () => ({
  run: jest.fn((_id: string, fn: () => any) => Promise.resolve(fn())),
  sleepUntil: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => jest.clearAllMocks());

describe('sendSmsHandler', () => {
  const event = { data: { messageId: 'm1', userId: 'u1', phone: '+44', content: 'hi' } };

  test('M1 — success marks SENT + logs usage', async () => {
    mockTwilioCreate.mockResolvedValue({ sid: 'SM1' });
    const res = await sendSmsHandler({ event, step: makeStep() });
    expect(mockTwilioCreate).toHaveBeenCalledWith({ body: 'hi', from: '+1', to: '+44' });
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'SENT' } });
    expect(logUsage).toHaveBeenCalledWith('twilio', 'sms', 1, 'u1', { messageId: 'm1', sid: 'SM1' });
    expect(res).toEqual({ success: true, sid: 'SM1' });
  });

  test('M2 — Twilio error marks FAILED + rethrows', async () => {
    mockTwilioCreate.mockRejectedValue(new Error('twilio down'));
    await expect(sendSmsHandler({ event, step: makeStep() })).rejects.toThrow('twilio down');
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'FAILED' } });
  });
});

describe('sendSmsHandler — not configured', () => {
  test('M3 — skips when Twilio creds missing', async () => {
    jest.resetModules();
    jest.doMock('../config', () => ({ config: { logging: { level: 'error' }, server: { env: 'test' }, twilio: {}, telegram: {}, retell: { agentIds: {} } } }));
    const { sendSmsHandler: handler } = require('../inngest/messaging');
    const res = await handler({ event: { data: { messageId: 'm1', userId: 'u1', phone: '+44', content: 'hi' } }, step: makeStep() });
    expect(res).toEqual({ skipped: true });
    expect(mockTwilioCreate).not.toHaveBeenCalled();
    jest.dontMock('../config');
  });
});

describe('sendTelegramHandler', () => {
  const event = { data: { messageId: 'm2', userId: 'u1', chatId: 'c1', content: 'yo' } };

  test('M4 — success marks SENT + logs usage', async () => {
    (axios.post as jest.Mock).mockResolvedValue({});
    const res = await sendTelegramHandler({ event, step: makeStep() });
    expect(axios.post).toHaveBeenCalled();
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { status: 'SENT' } });
    expect(logUsage).toHaveBeenCalledWith('telegram', 'telegram_message', 1, 'u1', { messageId: 'm2', chatId: 'c1' });
    expect(res).toEqual({ success: true });
  });

  test('M5 — API error marks FAILED + rethrows', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('tg down'));
    await expect(sendTelegramHandler({ event, step: makeStep() })).rejects.toThrow('tg down');
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { status: 'FAILED' } });
  });
});

describe('initiateCallHandler', () => {
  const baseData = {
    callId: 'call-1', userId: 'u1', callType: 'EVENING_REVIEW',
    phone: '+44', userName: 'Sam',
  };

  test('C1 — dials via outbound BYOC and marks IN_PROGRESS', async () => {
    (prisma.call.findUnique as jest.Mock).mockResolvedValue({ status: 'SCHEDULED' });
    (outboundCallService.placeCall as jest.Mock).mockResolvedValue({ retellCallId: 'retell-1', twilioSid: 'CA1', sipUri: 'sip:retell-1@host' });
    const step = makeStep();
    const res = await initiateCallHandler({ event: { data: baseData }, step });
    expect(step.sleepUntil).not.toHaveBeenCalled();
    expect(outboundCallService.placeCall).toHaveBeenCalled();
    expect(callService.updateCallStatus).toHaveBeenCalledWith('call-1', 'IN_PROGRESS', { retellCallId: 'retell-1' });
    expect(res).toMatchObject({ success: true, callId: 'call-1', retellCallId: 'retell-1' });
  });

  test('C2 — future scheduledAt sleeps until that time first', async () => {
    (prisma.call.findUnique as jest.Mock).mockResolvedValue({ status: 'SCHEDULED' });
    (outboundCallService.placeCall as jest.Mock).mockResolvedValue({ retellCallId: 'retell-2', twilioSid: 'CA2', sipUri: 'sip:retell-2@host' });
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const step = makeStep();
    await initiateCallHandler({ event: { data: { ...baseData, scheduledAt: future } }, step });
    expect(step.sleepUntil).toHaveBeenCalledWith('await-scheduled-time', new Date(future));
  });

  test('C3 — skips when call no longer SCHEDULED (cancelled)', async () => {
    (prisma.call.findUnique as jest.Mock).mockResolvedValue({ status: 'CANCELLED' });
    const res = await initiateCallHandler({ event: { data: baseData }, step: makeStep() });
    expect(res).toEqual({ skipped: true, status: 'CANCELLED' });
    expect(outboundCallService.placeCall).not.toHaveBeenCalled();
  });

  test('C4 — placeCall throws marks FAILED (with reason) + rethrows', async () => {
    (prisma.call.findUnique as jest.Mock).mockResolvedValue({ status: 'SCHEDULED' });
    (outboundCallService.placeCall as jest.Mock).mockRejectedValue(new Error('retell down'));
    await expect(initiateCallHandler({ event: { data: baseData }, step: makeStep() })).rejects.toThrow('retell down');
    expect(callService.updateCallStatus).toHaveBeenCalledWith('call-1', 'FAILED', { outcome: 'error: retell down' });
  });
});
