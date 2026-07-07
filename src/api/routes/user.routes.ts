import { Router, Response, NextFunction } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../../middleware/validate';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createUserSchema, updateUserSchema, getUserByIdSchema } from '../../types/user.schema';
import phoneVerifyService from '../../services/phone-verify.service';
import prisma from '../../utils/prisma';

const router = Router();

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Public
 */
router.post(
  '/',
  validate(createUserSchema),
  userController.createUser
);

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  userController.getCurrentUserProfile
);

/**
 * @route   PATCH /api/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.patch(
  '/me',
  authenticate,
  validate(updateUserSchema),
  userController.updateCurrentUserProfile
);

/**
 * @route   POST /api/users/me/onboard
 * @desc    Mark current user as onboarded
 * @access  Private
 */
router.post(
  '/me/onboard',
  authenticate,
  userController.markAsOnboarded
);

/**
 * @route   GET /api/users/me/export
 * @desc    GDPR data export — returns all user data as JSON
 * @access  Private
 */
router.get(
  '/me/export',
  authenticate,
  userController.exportMyData
);

/**
 * @route   POST /api/users/me/coach/accept
 * @desc    Accept a pending coach invite
 * @access  Private
 */
router.post(
  '/me/coach/accept',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { coachService } = await import('../../services/coach.service');
      await coachService.acceptCoachInvite(req.user!.id);
      const user = await import('../../services/user.service').then((m) => m.default.getUserById(req.user!.id));
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * @route   DELETE /api/users/me/coach
 * @desc    Leave coach programme or decline pending invite
 * @access  Private
 */
router.delete(
  '/me/coach',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { coachService } = await import('../../services/coach.service');
      await coachService.leaveCoach(req.user!.id);
      res.json({ success: true, data: { message: 'Left coach programme' } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   DELETE /api/users/me/telegram
 * @desc    Disconnect Telegram — clears telegramChatId
 * @access  Private
 */
router.delete(
  '/me/telegram',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.user.update({ where: { id: req.user!.id }, data: { telegramChatId: null } });
      res.json({ success: true, data: { message: 'Telegram disconnected' } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   DELETE /api/users/me
 * @desc    GDPR hard delete — permanently erases account and all data
 * @access  Private
 */
router.delete(
  '/me',
  authenticate,
  userController.deleteMyAccount
);

/**
 * @route   POST /api/users/phone/request-otp
 * @desc    Send a 6-digit OTP to a new phone number for verification
 * @access  Private
 */
router.post(
  '/phone/request-otp',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.body;
      if (!phone) { res.status(400).json({ success: false, error: 'phone is required' }); return; }
      await phoneVerifyService.requestOtp(req.user!.id, phone);
      res.json({ success: true, data: { message: 'Verification code sent' } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   POST /api/users/phone/verify
 * @desc    Verify OTP and update phone number
 * @access  Private
 */
router.post(
  '/phone/verify',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.body;
      if (!code) { res.status(400).json({ success: false, error: 'code is required' }); return; }
      const newPhone = await phoneVerifyService.verifyOtp(req.user!.id, code);
      res.json({ success: true, data: { phone: newPhone } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   POST /api/users/backfill-day-zero
 * @desc    One-off / repeatable backfill: run initializeUserResources +
 *          startDayZeroExperience for onboarded non-coach members who never got
 *          their welcome experience (circle + call) because the old code gated it
 *          behind Stripe checkout. Idempotent. Optional body { email } targets one
 *          user; otherwise it sweeps all onboarded non-coach users missing a circle.
 * @access  Admin (x-admin-token header must match ADMIN_BACKFILL_TOKEN)
 */
router.post(
  '/backfill-day-zero',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.header('x-admin-token');
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || token !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const userService = (await import('../../services/user.service')).default;
      const email = (req.body?.email as string | undefined)?.toLowerCase();

      const targets = email
        ? await prisma.user.findMany({
            where: { email, isOnboarded: true, subscriptionTier: { not: 'COACH' } },
            select: { id: true, email: true },
          })
        : await prisma.user.findMany({
            where: {
              isOnboarded: true,
              subscriptionTier: { not: 'COACH' },
              ivyCircles: { none: { isActive: true } },
            },
            select: { id: true, email: true },
          });

      const results: { email: string; ok: boolean; error?: string }[] = [];
      for (const u of targets) {
        try {
          await userService.initializeUserResources(u.id, 'FREE');
          await userService.startDayZeroExperience(u.id);
          results.push({ email: u.email, ok: true });
        } catch (err: any) {
          results.push({ email: u.email, ok: false, error: err?.message ?? String(err) });
        }
      }

      res.json({ success: true, data: { count: results.length, results } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   GET /api/users/retell-numbers
 * @desc    Diagnostic: list phone numbers registered in the Retell account so we
 *          know which from_number is valid (debugging the "Item <num> not found
 *          from phone-number" 404).
 * @access  Admin (x-admin-token)
 */
router.get(
  '/retell-numbers',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const retellService = (await import('../../services/retell.service')).default;
      const { config } = await import('../../config');
      const numbers = await retellService.listPhoneNumbers();

      // Inspect the B2C agent so we know how to override its prompt per-call.
      let agent: any = null;
      let llm: any = null;
      try {
        const a = await retellService.getAgent(config.retell.agentIds.b2c || '');
        agent = a && {
          agent_id: a.agent_id,
          agent_name: a.agent_name,
          response_engine: a.response_engine,  // { type: 'retell-llm' | 'conversation-flow', llm_id/... }
          voice_id: a.voice_id,
          webhook_url: a.webhook_url,          // must point at our /webhooks/retell for transcripts
        };
        // If it's a Retell LLM engine, fetch the LLM to see its general_prompt —
        // we need it to reference {{system_prompt}} for our composed prompt to apply.
        const llmId = a?.response_engine?.llm_id;
        if (llmId) {
          const l = await retellService.getRetellLlm(llmId);
          llm = l && {
            llm_id: l.llm_id,
            model: l.model,
            references_system_prompt: (l.general_prompt || '').includes('{{system_prompt}}'),
            general_prompt_chars: (l.general_prompt || '').length,
            general_prompt_preview: (l.general_prompt || '').slice(0, 400),
            begin_message: l.begin_message,
          };
        }
      } catch (e: any) {
        agent = { error: e?.message };
      }

      res.json({
        success: true,
        data: {
          configured: {
            uk: process.env.TWILIO_PHONE_NUMBER,
            us: process.env.TWILIO_PHONE_NUMBER_US,
            sipEndpointRaw: process.env.RETELL_SIP_ENDPOINT,
            sampleSipUri: (() => {
              try { return retellService.buildSipUri('TEST_CALL_ID'); } catch (e: any) { return `ERR: ${e?.message}`; }
            })(),
          },
          agent,
          llm,
          retell: numbers.map((n: any) => ({
            phone_number: n.phone_number,
            nickname: n.nickname,
            inbound_agent_id: n.inbound_agent_id,
            outbound_agent_id: n.outbound_agent_id,
          })),
        },
      });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   POST /api/users/retell-fix-webhook
 * @desc    Repoint the Retell agent(s) webhook_url to THIS backend so post-call
 *          events (call_ended / call_analyzed with transcript) actually reach us —
 *          they were pointing at a dead Railway URL, so no transcript, insight,
 *          memory, sentiment or callback has ever fired in prod. Body { url? }
 *          overrides the target (defaults to the Fly app's /webhooks/retell).
 * @access  Admin (x-admin-token)
 */
router.post(
  '/retell-fix-webhook',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const retellService = (await import('../../services/retell.service')).default;
      const { config } = await import('../../config');

      const target = (req.body?.url as string | undefined)
        ?? 'https://ivykeeps-api.fly.dev/webhooks/retell';

      const agentIds = [config.retell.agentIds.b2c, config.retell.agentIds.b2b]
        .filter((x): x is string => !!x);
      const seen = new Set<string>();
      const results: any[] = [];
      for (const agentId of agentIds) {
        if (seen.has(agentId)) continue;
        seen.add(agentId);
        const before = await retellService.getAgent(agentId);
        const prev = before?.webhook_url ?? null;
        if (prev === target) { results.push({ agentId, alreadySet: true, webhook_url: prev }); continue; }
        await retellService.updateAgent(agentId, { webhook_url: target });
        results.push({ agentId, updated: true, from: prev, to: target });
      }

      res.json({ success: true, data: { target, results } });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   POST /api/users/retell-bind-prompt
 * @desc    One-time (idempotent) setup: bind the B2C (and B2B if present) agent's
 *          Retell-LLM general_prompt to the literal "{{system_prompt}}" so our
 *          per-call composed buildSystemPrompt — injected as the system_prompt
 *          dynamic variable on every outbound/inbound call — fully drives the
 *          live agent (name, streak, charity, brief). Returns the previous prompt
 *          so nothing is lost. Without this, the agent runs its static dashboard
 *          prompt and Ivy has no idea who it's talking to.
 * @access  Admin (x-admin-token)
 */
router.post(
  '/retell-bind-prompt',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const retellService = (await import('../../services/retell.service')).default;
      const { config } = await import('../../config');

      const BOUND = '{{system_prompt}}';
      const agentIds = [config.retell.agentIds.b2c, config.retell.agentIds.b2b]
        .filter((x): x is string => !!x);

      const results: any[] = [];
      const seenLlms = new Set<string>();
      for (const agentId of agentIds) {
        const agent = await retellService.getAgent(agentId);
        const llmId = agent?.response_engine?.llm_id;
        const engineType = agent?.response_engine?.type;
        if (engineType !== 'retell-llm' || !llmId) {
          results.push({ agentId, skipped: true, reason: `engine ${engineType} / llm_id ${llmId}` });
          continue;
        }
        if (seenLlms.has(llmId)) { results.push({ agentId, llmId, skipped: true, reason: 'llm already bound' }); continue; }
        seenLlms.add(llmId);

        const before = await retellService.getRetellLlm(llmId);
        const prevPrompt = before?.general_prompt || '';
        if (prevPrompt.trim() === BOUND) {
          results.push({ agentId, llmId, alreadyBound: true });
          continue;
        }
        await retellService.updateRetellLlm(llmId, { general_prompt: BOUND });
        results.push({
          agentId,
          llmId,
          bound: true,
          previousPromptChars: prevPrompt.length,
          previousPromptPreview: prevPrompt.slice(0, 200),
        });
      }

      res.json({ success: true, data: { boundTo: BOUND, results } });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   POST /api/users/retell-enable-end-call
 * @desc    Idempotent: give the Retell LLM an `end_call` tool so Ivy can actually
 *          hang up when the conversation is over — without it she says "bye" but
 *          the call stays open and she loops into a fresh turn (observed: after
 *          locking a commitment she re-greeted and asked "did you do it?" IN THE
 *          SAME call). Also sets an agent-level silence backstop so a stuck call
 *          ends itself. Preserves any existing general_tools + general_prompt.
 * @access  Admin (x-admin-token)
 */
router.post(
  '/retell-enable-end-call',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const retellService = (await import('../../services/retell.service')).default;
      const { config } = await import('../../config');

      const END_CALL_TOOL = {
        type: 'end_call',
        name: 'end_call',
        description:
          'End and hang up the phone call. Call this once the conversation is genuinely ' +
          'complete — the plan/commitment is locked or a rest day is accepted, and you have ' +
          'said goodbye. Do not keep talking or start a new topic after deciding to end.',
      };
      const SILENCE_MS = 20000;        // agent-level backstop: hang up after 20s of silence
      const MAX_CALL_MS = 12 * 60 * 1000; // never let a call run past 12 minutes

      const agentIds = [config.retell.agentIds.b2c, config.retell.agentIds.b2b]
        .filter((x): x is string => !!x);

      const results: any[] = [];
      const seenLlms = new Set<string>();
      const seenAgents = new Set<string>();
      for (const agentId of agentIds) {
        if (seenAgents.has(agentId)) continue;
        seenAgents.add(agentId);

        const agent = await retellService.getAgent(agentId);
        const llmId = agent?.response_engine?.llm_id;
        const engineType = agent?.response_engine?.type;

        // Agent-level silence/duration backstops (idempotent)
        const agentPatch: Record<string, any> = {};
        if (agent?.end_call_after_silence_ms !== SILENCE_MS) agentPatch.end_call_after_silence_ms = SILENCE_MS;
        if (agent?.max_call_duration_ms !== MAX_CALL_MS) agentPatch.max_call_duration_ms = MAX_CALL_MS;
        if (Object.keys(agentPatch).length) await retellService.updateAgent(agentId, agentPatch);

        if (engineType !== 'retell-llm' || !llmId) {
          results.push({ agentId, agentPatch, skipped: 'llm', reason: `engine ${engineType} / llm_id ${llmId}` });
          continue;
        }
        if (seenLlms.has(llmId)) { results.push({ agentId, llmId, skipped: 'llm already done' }); continue; }
        seenLlms.add(llmId);

        const llm = await retellService.getRetellLlm(llmId);
        const tools: any[] = Array.isArray(llm?.general_tools) ? [...llm.general_tools] : [];
        const hasEndCall = tools.some((t) => t?.type === 'end_call');
        if (hasEndCall) {
          results.push({ agentId, llmId, agentPatch, endCallToolAlready: true });
          continue;
        }
        tools.push(END_CALL_TOOL);
        await retellService.updateRetellLlm(llmId, { general_tools: tools });
        results.push({ agentId, llmId, agentPatch, endCallToolAdded: true, toolCount: tools.length });
      }

      res.json({ success: true, data: { results } });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   POST /api/users/test-scheduled-call-now
 * @desc    Diagnostic: schedule a REAL DB-tracked call (default RESCUE) for
 *          { email } to fire immediately via the production Inngest→placeCall
 *          path — unlike /test-call-now this creates a calls row + retellCallId,
 *          so the post-call webhook can correlate and store the transcript. Use
 *          to prove the webhook + signature + callback pipeline end-to-end.
 * @access  Admin (x-admin-token)
 */
router.post(
  '/test-scheduled-call-now',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const email = (req.body?.email as string | undefined)?.toLowerCase();
      const callType = (req.body?.callType as string | undefined) ?? 'RESCUE';
      if (!email) { res.status(400).json({ success: false, error: 'email required' }); return; }

      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, phone: true } });
      if (!user) { res.status(404).json({ success: false, error: 'user not found' }); return; }
      if (!user.phone) { res.status(400).json({ success: false, error: 'user has no phone' }); return; }

      const callService = (await import('../../services/call.service')).default;
      // Fire immediately: a past/now scheduledAt makes the Inngest handler skip its
      // sleep and place the call straight away.
      const call = await callService.scheduleCall(user.id, callType as any, new Date());
      res.json({ success: true, data: { callId: call.id, callType, scheduledAt: call.scheduledAt } });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   POST /api/users/test-call-now
 * @desc    Diagnostic: synchronously dial an ONBOARDING call for { email } RIGHT
 *          NOW via the real prompt+Retell path, and return the Retell result (or
 *          the exact error) in the HTTP response — no Inngest delay, no polling.
 *          Optional { fromNumber } overrides the caller ID for testing.
 * @access  Admin (x-admin-token)
 */
router.post(
  '/test-call-now',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const expected = process.env.ADMIN_BACKFILL_TOKEN;
      if (!expected || req.header('x-admin-token') !== expected) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const email = (req.body?.email as string | undefined)?.toLowerCase();
      const fromOverride = req.body?.fromNumber as string | undefined;
      if (!email) {
        res.status(400).json({ success: false, error: 'email required' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) { res.status(404).json({ success: false, error: 'user not found' }); return; }
      if (!user.phone) { res.status(400).json({ success: false, error: 'user has no phone' }); return; }

      const callService = (await import('../../services/call.service')).default;
      const outboundCallService = (await import('../../services/outbound-call.service')).default;
      const promptService = (await import('../../services/prompt.service')).default;
      const briefService = (await import('../../services/brief.service')).default;
      const { getTrackConfig } = await import('../../config/tracks');
      const { flattenContext } = await import('../../utils/retell');
      const { config } = await import('../../config');

      const callType = 'ONBOARDING';
      const ctx = await callService.getUserContext(user.id, callType);
      const isB2B = ctx.subscription_tier === 'B2B';
      const agentId = isB2B
        ? (config.retell.agentIds.b2b || config.retell.agentIds.b2c || '')
        : (config.retell.agentIds.b2c || '');

      const trackConfig = getTrackConfig(ctx.track);
      const brief = (callType === 'ONBOARDING' && ctx.subscription_tier === 'COACH')
        ? null // coach partner briefing stays on its static flow
        : await briefService.generateCallBrief(callType, ctx, trackConfig!);
      const systemPrompt = promptService.buildSystemPrompt(callType, ctx, isB2B, brief ?? undefined);

      const fromNumber = fromOverride
        ?? ((ctx.currency === 'USD' && config.twilio.phoneNumberUs)
              ? config.twilio.phoneNumberUs
              : config.twilio.phoneNumber);
      if (!fromNumber) { res.status(500).json({ success: false, error: 'No Twilio from-number configured' }); return; }

      const placed = await outboundCallService.placeCall({
        toNumber: user.phone,
        fromNumber,
        agentId,
        variables: flattenContext({ ...ctx, call_type: callType.toLowerCase() }),
        metadata: { test: true, userId: user.id, callType },
        systemPrompt,
      });

      res.json({
        success: true,
        data: {
          dialed: { to: user.phone, from: fromNumber, agentId },
          retellCallId: placed.retellCallId,
          twilioSid: placed.twilioSid,
          sipUri: placed.sipUri,
          promptChars: systemPrompt.length,
          promptPreview: systemPrompt.slice(0, 280),
        },
      });
    } catch (err: any) {
      // The synchronous error IS the answer — surface it verbatim.
      res.status(502).json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  userController.getUserById
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user
 * @access  Private
 */
router.patch(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  validate(updateUserSchema),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  userController.deleteUser
);

export default router;
