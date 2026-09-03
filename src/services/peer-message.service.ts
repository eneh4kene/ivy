/**
 * Pair-to-pair messaging — the first member-to-member channel in the product.
 *
 * Every message in the system before this was Ivy <-> user. Opening a direct
 * channel between two members is the kind of thing that is easy to add and
 * expensive to retrofit safety onto, so the deliberate decisions are:
 *
 * NAMED, never anonymous. The product already attributes peer disclosure —
 * session shares carry firstName — and an accountability note from nobody
 * cannot be reciprocated, thanked, or held to account itself. In a 6-8 person
 * room anonymity is fiction anyway ("only Sam would say that"), so it would
 * buy the disinhibition without any of the protection.
 *
 * ONLY YOUR PARTNER. Not the room, not any member, not a search. The pair in a
 * Two by Two sprint share a single outcome, which is a REASON to talk; without
 * one this is just a DM system bolted onto an accountability app.
 *
 * DELIVERED INTO THE IVY THREAD, not a separate inbox. One place messages
 * live, one place to moderate, and no new surface to build or police.
 *
 * IT OUTLIVES THE GAME BY A WEEK. Scoping the channel to a running game is
 * right, but cutting it the instant the game ends severs a fortnight-old
 * conversation on a sprint roll — and since past notes stay readable, it left
 * people able to read what someone said and unable to answer. The window now
 * closes slowly, and the composer says when.
 *
 * BLOCK AND REPORT SHIP WITH IT, not after. The first bad message is the one
 * that decides whether someone stays in a circle at all.
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import circleGameService from './circle-game.service';

/** A note is a note, not an essay — and a cap is the cheapest abuse limit there is. */
export const MAX_CONTENT_LENGTH = 500;
/** Per sender, per day, to their partner. Enough to be warm, not enough to hound. */
export const DAILY_SEND_LIMIT = 3;

export type SendResult =
  | { ok: true; toName: string }
  | { ok: false; reason: 'no_partner' | 'blocked' | 'rate_limited' | 'empty' | 'too_long' };

export interface PartnerView {
  partnerId: string;
  firstName: string;
  gameId: string;
  gameName: string;
  /**
   * Days until the channel closes, when the game that granted it has already
   * ended. Null while the game is still running. Surfaced so the composer can
   * SAY the window out loud — a send button that silently disappears reads as
   * a bug, not as a boundary.
   */
  closingInDays: number | null;
  /** True when either side has blocked the other — contact is off, the game is not. */
  contactBlocked: boolean;
  /** Whether THIS user is the one who blocked (so the UI can offer unblock). */
  blockedByMe: boolean;
  sentToday: number;
  dailyLimit: number;
}

class PeerMessageService {
  /**
   * The partner this user may write to, if any.
   *
   * Solo members in an odd room have no partner and therefore no channel —
   * correct rather than unfortunate: the right to message is granted by the
   * shared outcome, and they do not have one.
   */
  async getPartner(userId: string): Promise<PartnerView | null> {
    const active = await circleGameService.getActiveGameForUser(userId);

    // A running pairing always wins, so nobody ever holds two channels: a new
    // sprint's partner replaces the last one rather than stacking on top.
    let game = active?.game?.templateType === 'pairs' ? active.game : null;
    let closingInDays: number | null = null;

    if (!game) {
      const ending = await circleGameService.recentlyEndedPairsGame(userId);
      if (!ending) return null;
      game = ending.game;
      closingInDays = ending.daysLeft;
    }

    const pair = circleGameService.pairOf(game.rules as Record<string, any>, userId);
    if (!pair?.partnerId) return null;

    const [partner, blocks, sentToday] = await Promise.all([
      prisma.user.findUnique({ where: { id: pair.partnerId }, select: { firstName: true } }),
      prisma.memberBlock.findMany({
        where: {
          OR: [
            { blockerId: userId, blockedId: pair.partnerId },
            { blockerId: pair.partnerId, blockedId: userId },
          ],
        },
        select: { blockerId: true },
      }),
      this.sentTodayCount(userId, pair.partnerId),
    ]);

    return {
      partnerId: pair.partnerId,
      firstName: partner?.firstName || 'Your partner',
      gameId: game.id,
      gameName: game.name,
      contactBlocked: blocks.length > 0,
      blockedByMe: blocks.some((b) => b.blockerId === userId),
      sentToday,
      dailyLimit: DAILY_SEND_LIMIT,
      closingInDays,
    };
  }

  private async sentTodayCount(fromUserId: string, toUserId: string): Promise<number> {
    const since = new Date(Date.now() - 86_400_000);
    return prisma.peerMessage.count({
      where: { fromUserId, toUserId, createdAt: { gte: since } },
    });
  }

  /**
   * Send a note to your pair partner.
   *
   * Returns a typed refusal rather than throwing: every rejection here is an
   * ordinary product state (no partner, blocked, said too much today), and the
   * caller needs to say which one plainly.
   */
  async sendToPartner(userId: string, rawContent: string): Promise<SendResult> {
    const content = (rawContent ?? '').trim();
    if (!content) return { ok: false, reason: 'empty' };
    if (content.length > MAX_CONTENT_LENGTH) return { ok: false, reason: 'too_long' };

    const partner = await this.getPartner(userId);
    if (!partner) return { ok: false, reason: 'no_partner' };
    // A block is silent to the blocked party in effect, but the SENDER is told
    // plainly that it did not send — a message that vanishes without a word is
    // worse than one that is refused.
    if (partner.contactBlocked) return { ok: false, reason: 'blocked' };
    if (partner.sentToday >= DAILY_SEND_LIMIT) return { ok: false, reason: 'rate_limited' };

    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const fromName = sender?.firstName || 'Your partner';

    // Delivered into their Ivy thread, attributed in the text itself so it
    // reads correctly even where no custom UI renders the metadata.
    const chatService = (await import('./chat.service')).default;
    const delivered = await chatService.postIvyMessage(
      partner.partnerId,
      `${fromName} sent you a note:\n\n"${content}"`,
      {
        messageType: 'peer_message',
        metadata: { peer: { fromUserId: userId, fromName, gameId: partner.gameId } },
        notify: true,
      },
    );

    await prisma.peerMessage.create({
      data: {
        fromUserId: userId,
        toUserId: partner.partnerId,
        gameId: partner.gameId,
        content,
        deliveredMessageId: delivered?.id ?? null,
      },
    });

    logger.info(`peer-message: ${userId} → ${partner.partnerId} (game ${partner.gameId})`);
    return { ok: true, toName: partner.firstName };
  }

  /** Messages received, newest first — for a thread view or a report flow. */
  async inbox(userId: string, limit = 20) {
    return prisma.peerMessage.findMany({
      where: { toUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true,
        createdAt: true,
        content: true,
        fromUserId: true,
        fromUser: { select: { firstName: true } },
      },
    });
  }

  /**
   * Block a member. Idempotent.
   *
   * Stops CONTACT only. The pairs game is untouched, because banking a paired
   * day requires no interaction between the two people at all — they simply
   * both keep their own days. Dissolving a pair mid-sprint would corrupt game
   * state to solve a problem the block has already solved.
   */
  async blockMember(userId: string, targetId: string): Promise<{ blocked: true }> {
    if (userId === targetId) throw new Error('Cannot block yourself');
    await prisma.memberBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      create: { blockerId: userId, blockedId: targetId },
      update: {},
    });
    logger.info(`member-block: ${userId} blocked ${targetId}`);
    return { blocked: true };
  }

  async unblockMember(userId: string, targetId: string): Promise<{ blocked: false }> {
    await prisma.memberBlock.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
    logger.info(`member-block: ${userId} unblocked ${targetId}`);
    return { blocked: false };
  }

  /**
   * Report a member. Persists and pages ops for a HUMAN to read.
   *
   * Deliberately takes no automated action: whether a message crossed a line is
   * not a judgement this system should be making on its own, and an automated
   * suspension is far more damaging to get wrong than a delayed one.
   *
   * Reporting also blocks, because someone who has just reported another member
   * should not have to take a second action to stop hearing from them.
   */
  async reportMember(
    userId: string,
    targetId: string,
    reason: string,
    peerMessageId?: string,
  ): Promise<{ reported: true }> {
    if (userId === targetId) throw new Error('Cannot report yourself');

    const report = await prisma.memberReport.create({
      data: {
        reporterId: userId,
        reportedId: targetId,
        peerMessageId: peerMessageId ?? null,
        reason: (reason ?? '').trim().slice(0, 2000) || 'No reason given',
      },
    });

    await this.blockMember(userId, targetId).catch((err) =>
      logger.warn(`report auto-block failed for ${userId}:`, err),
    );

    // critical: a person has told us another person is hurting them. It should
    // interrupt someone, not sit in a dashboard nobody opens.
    await opsAlert({
      severity: 'critical',
      source: 'peer-message',
      title: 'member_reported',
      userId,
      entity: { type: 'member_report', id: report.id },
      detail: `Reporter ${userId} reported ${targetId}${peerMessageId ? ` over message ${peerMessageId}` : ''}. Reason: ${report.reason}`,
    }).catch(() => {});

    logger.info(`member-report: ${userId} reported ${targetId} (report ${report.id})`);
    return { reported: true };
  }
}

export default new PeerMessageService();
