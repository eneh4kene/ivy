import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { NotFoundError, BadRequestError } from '../utils/errors'

// ─── Phase 4b types ──────────────────────────────────────────────────────────

/**
 * WitnessedStakeStatus — the stake visibility data surfaced to circle members.
 *
 * GUARDRAIL: this is PURE READ / VISIBILITY only.  No money movement at all.
 * The amount shown is the member's OWN stake slice — never transferred to others.
 */
export interface WitnessedStakeStatus {
  userId: string
  firstName: string
  shareStakeWithCircle: boolean   // opted in?
  stakeStatus: 'armed' | 'completed' | 'forfeited' | 'unarmed' | 'no_stake' | 'private'
  sliceAmount: number | null      // their OWN daily slice (null if private or no stake)
  cycleId: string | null
}

class CircleService {

  async createCircle(data: {
    name: string
    track: string
    tier: string
    seasonTheme?: string
    companyId?: string
    coachId?: string
    maxSize?: number
  }) {
    const circle = await prisma.ivyCircle.create({
      data: {
        name: data.name,
        track: data.track,
        tier: data.tier,
        seasonTheme: data.seasonTheme,
        companyId: data.companyId,
        coachId: data.coachId,
        maxSize: data.maxSize ?? (data.tier === 'pro' || data.tier === 'celebrity' ? 4 : 8),
      },
      include: { members: { include: { user: { select: { id: true, firstName: true } } } } },
    })
    logger.info(`Circle created: ${circle.id} — ${circle.name}`)
    return circle
  }

  async getCircle(circleId: string) {
    const circle = await prisma.ivyCircle.findUnique({
      where: { id: circleId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                // First name only — last names are PII we never surface to
                // circle peers (who may be strangers). See getCirclesForUser.
                id: true, firstName: true,
                track: true, streaks: true,
              },
            },
          },
        },
        sprintGoals: { orderBy: { sprintNumber: 'desc' }, take: 3 },
        sessions: { orderBy: { scheduledAt: 'desc' }, take: 5 },
      },
    })
    if (!circle) throw new NotFoundError('Circle not found')
    return circle
  }

  async isActiveMember(circleId: string, userId: string): Promise<boolean> {
    const member = await prisma.ivyCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      select: { isActive: true },
    })
    return !!member?.isActive
  }

  async getCirclesForUser(userId: string) {
    const rows = await prisma.ivyCircleMember.findMany({
      where: { userId, isActive: true },
      include: {
        circle: {
          include: {
            members: {
              where: { isActive: true },
              include: {
                user: { select: { id: true, firstName: true } },
              },
            },
            sprintGoals: { orderBy: { sprintNumber: 'desc' }, take: 1 },
          },
        },
      },
    })
    // The stored `size` counter drifts (cascade deletes never decrement it), so
    // report the live active-member count — the members are already loaded.
    return rows.map((row) => ({
      ...row,
      circle: { ...row.circle, size: row.circle.members.length },
    }))
  }

  async addMember(circleId: string, userId: string, role: 'member' | 'facilitator' = 'member') {
    const circle = await prisma.ivyCircle.findUnique({ where: { id: circleId } })
    if (!circle) throw new NotFoundError('Circle not found')
    if (!circle.isActive) throw new BadRequestError('Circle is no longer active')

    const memberCount = await prisma.ivyCircleMember.count({
      where: { circleId, isActive: true },
    })
    if (memberCount >= circle.maxSize) {
      throw new BadRequestError(`Circle is full (max ${circle.maxSize} members)`)
    }

    const member = await prisma.ivyCircleMember.upsert({
      where: { circleId_userId: { circleId, userId } },
      create: { circleId, userId, role },
      update: { isActive: true, role },
    })

    await this.syncCircleSize(circleId)

    // The moment a room becomes a room, it gets its game — and hears about it.
    //
    // Before this, seedSprintPact fired only at coach-circle formation and at
    // session close, so a PEER circle growing to three had no game at all
    // until the next fortnightly session rolled. The room crossed the
    // threshold, the Circle tab stopped saying "forming", and nothing
    // happened: no game, no beat, and nothing for Ivy to mention on the next
    // call, for up to two weeks.
    //
    // Idempotent by construction — seedSprintPact no-ops when a game is
    // already running, so later joiners cost one cheap query and nothing else.
    import('./circle-game.service')
      .then(({ default: circleGameService }) => circleGameService.seedSprintPact(circleId))
      .catch((err) => logger.warn(`Sprint game seed on join failed for ${circleId}:`, err))

    return member
  }

  async removeMember(circleId: string, userId: string) {
    await prisma.ivyCircleMember.update({
      where: { circleId_userId: { circleId, userId } },
      data: { isActive: false },
    })
    await this.syncCircleSize(circleId)
  }

  /**
   * Recompute `size` from the live active-member count instead of
   * incrementing/decrementing. Deltas drift: reactivating a member via upsert
   * double-counted, and hard-deleting a user cascades the membership row away
   * without ever decrementing — prod circles showed size 14 with 2 members.
   */
  private async syncCircleSize(circleId: string): Promise<void> {
    const count = await prisma.ivyCircleMember.count({
      where: { circleId, isActive: true },
    })
    await prisma.ivyCircle.update({ where: { id: circleId }, data: { size: count } })
  }

  // Evocative cohort names in the Living/Dawn voice — used when a brand-new
  // circle has to be seeded for a user. Cycled deterministically by scope count
  // so names stay readable and collisions are rare without a DB uniqueness rule.
  private static readonly CIRCLE_NAME_POOL = [
    'Dawn Runners',
    'First Light',
    'The Ember Club',
    'Morning Company',
    'The Steady Few',
    'Daybreak Crew',
    'The Long Game',
    'Kindling',
    'The Comeback',
    'True North',
  ]

  private nextCircleName(scopeCount: number): string {
    const pool = CircleService.CIRCLE_NAME_POOL
    const base = pool[scopeCount % pool.length]
    const round = Math.floor(scopeCount / pool.length)
    return round === 0 ? base : `${base} ${round + 1}`
  }

  /**
   * autoAssignToCircle — place a newly-onboarded user into a peer accountability
   * circle. The circle (shared sessions, games, witnessed stakes) is core to the
   * new-user experience and should be in place from Day Zero, independent of the
   * user's paid/trial state.
   *
   * Matching: prefer an existing OPEN circle on the user's track within their
   * company scope (B2C ⇒ companyId null / standalone), filling the fullest-but-
   * not-full circle first so cohorts complete quickly. If none has room, seed a
   * new circle with this user as the facilitator.
   *
   * Idempotent — if the user is already in an active circle, returns that one.
   * Coaches are skipped (they don't sit in peer circles). Safe to call
   * fire-and-forget; never block onboarding on it.
   */
  async autoAssignToCircle(
    userId: string,
  ): Promise<{ circleId: string; created: boolean } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, track: true, companyId: true, subscriptionTier: true, coachId: true },
    })
    if (!user) throw new NotFoundError('User not found')

    // Coaches don't belong to peer accountability circles.
    if (user.subscriptionTier === 'COACH') return null

    // Coached clients belong with their coach's cohort, not a random peer pod.
    // ensureCoachCircle forms the circle at the threshold and migrates the
    // whole book (including this user) into it — checked BEFORE the generic
    // idempotency below, or a coached user already sitting in a peer circle
    // would short-circuit and never move.
    if (user.coachId) {
      const coachCircle = await this.ensureCoachCircle(user.coachId)
      if (coachCircle) {
        const inIt = await prisma.ivyCircleMember.findFirst({
          where: { userId, circleId: coachCircle.id, isActive: true },
          select: { id: true },
        })
        if (inIt) return { circleId: coachCircle.id, created: false }
        // Coach circle exists but this user couldn't be placed (full) — fall
        // through to peer assignment so they're never circle-less.
      }
    }

    // Idempotent: already placed in an active circle?
    const existing = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    })
    if (existing) return { circleId: existing.circleId, created: false }

    const track = user.track || 'fitness'
    const companyId = user.companyId ?? null

    // Candidate open circles: same track + company scope, peer tier, active.
    const candidates = await prisma.ivyCircle.findMany({
      where: { isActive: true, track, companyId, tier: 'peer' },
      select: {
        id: true,
        maxSize: true,
        _count: { select: { members: { where: { isActive: true } } } },
      },
    })

    // Fill the fullest-but-not-full circle first.
    const open = candidates
      .filter((c) => c._count.members < c.maxSize)
      .sort((a, b) => b._count.members - a._count.members)

    for (const c of open) {
      try {
        await this.addMember(c.id, userId, 'member')
        logger.info(`Auto-assigned ${userId} to existing circle ${c.id} (track=${track})`)
        // Make the placement felt — both directions. Fire-and-forget.
        this.announcePeerJoin(c.id, userId).catch((err) =>
          logger.warn(`Peer-join announcement failed for ${userId}:`, err),
        )
        return { circleId: c.id, created: false }
      } catch (err) {
        // Lost the last seat to a concurrent join — fall through to the next.
        if (err instanceof BadRequestError) continue
        throw err
      }
    }

    // Nothing open in scope → seed a fresh circle; first member is the facilitator.
    const scopeCount = await prisma.ivyCircle.count({
      where: { companyId, tier: 'peer' },
    })
    const circle = await this.createCircle({
      name: this.nextCircleName(scopeCount),
      track,
      tier: 'peer',
      companyId: companyId ?? undefined,
    })
    await this.addMember(circle.id, userId, 'facilitator')
    logger.info(
      `Auto-assigned ${userId} to NEW circle ${circle.id} as facilitator (track=${track})`,
    )
    this.announcePeerJoin(circle.id, userId).catch((err) =>
      logger.warn(`Seed-circle announcement failed for ${userId}:`, err),
    )
    return { circleId: circle.id, created: true }
  }

  /**
   * A peer joining a circle is a small formation moment of its own: the
   * joiner learns who they're standing with, the room learns someone new
   * showed up. Circles are ≤8 and joins are rare, so this never spams.
   */
  private async announcePeerJoin(circleId: string, newUserId: string): Promise<void> {
    const [members, circle] = await Promise.all([
      prisma.ivyCircleMember.findMany({
        where: { circleId, isActive: true },
        select: { userId: true, user: { select: { firstName: true } } },
      }),
      prisma.ivyCircle.findUnique({ where: { id: circleId }, select: { name: true } }),
    ])
    if (!circle) return

    const joiner = members.find((m) => m.userId === newUserId)
    const others = members.filter((m) => m.userId !== newUserId)
    const chatService = (await import('./chat.service')).default

    const otherNames = others.map((o) => o.user.firstName).filter(Boolean)
    const names =
      otherNames.length > 3
        ? `${otherNames.slice(0, 3).join(', ')} and ${otherNames.length - 3} other${otherNames.length - 3 === 1 ? '' : 's'}`
        : otherNames.join(', ')

    chatService.postIvyMessage(
      newUserId,
      others.length > 0
        ? `You've landed in ${circle.name} — ${names} ${otherNames.length === 1 ? 'is' : 'are'} in there with you. They'll hear when you show up; you'll hear when they don't. Have a look at your Circle tab.`
        : `You're the first one in ${circle.name}. The room fills as others start — for now, you set the tone.`,
      { messageType: 'circle_formed', metadata: { circleId }, notify: false },
    ).catch((err) => logger.warn(`Join message failed for ${newUserId}:`, err))

    if (joiner?.user.firstName) {
      for (const o of others) {
        chatService.postIvyMessage(
          o.userId,
          `${joiner.user.firstName} just stepped into ${circle.name}. One more pair of eyes.`,
          { messageType: 'circle_formed', metadata: { circleId }, notify: false },
        ).catch((err) => logger.warn(`Join broadcast failed for ${o.userId}:`, err))
      }
    }
  }

  // ── Coach-scoped circles (backlog 12c) ─────────────────────────────────────

  /** Active clients required before a coach circle forms — below this a
   *  circle is a dead room, which is worse than a peer pod. */
  private static readonly COACH_CIRCLE_THRESHOLD = 5

  /**
   * Form/maintain the coach's client circle. Called from autoAssignToCircle
   * (every coached client's Day-Zero) and when an existing user links to a
   * coach — so the 5th activation is the kickoff, whichever path it arrives by.
   *
   * Shape (deliberate): tier 'pro', named after the coach's brand/programme,
   * clients migrated OUT of peer pods INTO it (one circle per client — the
   * one-active-circle assumption elsewhere stays true). The coach observes
   * through the console pulse and is NEVER a member: a coach in the room turns
   * 7am confiding into performing, and the honesty is the data moat.
   *
   * Returns the circle when it exists (formed now or earlier), else null.
   */
  async ensureCoachCircle(coachId: string): Promise<{ id: string; name: string } | null> {
    const clients = await prisma.user.findMany({
      where: { coachId, isOnboarded: true, isActive: true },
      select: { id: true, track: true },
    })

    let circle = await prisma.ivyCircle.findFirst({
      where: { coachId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    })
    let formedNow = false

    if (!circle) {
      if (clients.length < CircleService.COACH_CIRCLE_THRESHOLD) return null

      const [profile, coach] = await Promise.all([
        prisma.coachProfile.findUnique({
          where: { userId: coachId },
          select: { programmeName: true, brandName: true, whitelabelEnabled: true },
        }),
        prisma.user.findUnique({ where: { id: coachId }, select: { firstName: true } }),
      ])
      const name =
        (profile?.whitelabelEnabled && profile.brandName) ||
        profile?.programmeName ||
        `${coach?.firstName ?? 'Coach'}'s Cohort`

      // Dominant track across the book — the circle experience is track-themed.
      const trackTally = new Map<string, number>()
      for (const c of clients) {
        const t = c.track || 'fitness'
        trackTally.set(t, (trackTally.get(t) ?? 0) + 1)
      }
      const track = [...trackTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'fitness'

      const created = await this.createCircle({ name, track, tier: 'pro', coachId, maxSize: 10 })
      circle = { id: created.id, name: created.name }
      formedNow = true
      logger.info(`Coach circle formed for ${coachId}: ${circle.id} "${name}" (${clients.length} clients)`)
    }

    // Migrate every active client in — moving them out of peer pods. Full
    // circle (book > 10): remaining clients stay in their peer pods; an
    // overflow second circle is parked until a real book needs it.
    for (const client of clients) {
      const memberships = await prisma.ivyCircleMember.findMany({
        where: { userId: client.id, isActive: true },
        select: { circleId: true },
      })
      if (memberships.some((m) => m.circleId === circle!.id)) continue
      try {
        await this.addMember(circle.id, client.id, 'member')
      } catch (err) {
        if (err instanceof BadRequestError) {
          logger.warn(`Coach circle ${circle.id} full — ${client.id} stays in peer pod`)
          continue
        }
        throw err
      }
      for (const m of memberships) {
        await this.removeMember(m.circleId, client.id)
      }
      logger.info(`Moved client ${client.id} into coach circle ${circle.id}`)
    }

    // The formation MOMENT — fires exactly once, when the room comes alive.
    // Every member hears who they're standing with; the coach hears their
    // crew is official. Fire-and-forget: announcements never fail formation.
    if (formedNow) {
      this.announceCoachCircleFormation(circle.id, coachId).catch((err) =>
        logger.warn(`Coach circle formation announcement failed for ${circle!.id}:`, err),
      )
      // Ivy is the game master: a room that just came alive gets its first
      // game without anyone lifting a finger.
      import('./circle-game.service')
        .then(({ default: circleGameService }) => circleGameService.seedSprintPact(circle!.id))
        .catch((err) => logger.warn(`Sprint pact seed failed for ${circle!.id}:`, err))
    }

    return circle
  }

  private async announceCoachCircleFormation(circleId: string, coachId: string): Promise<void> {
    const [members, circle, coach] = await Promise.all([
      prisma.ivyCircleMember.findMany({
        where: { circleId, isActive: true },
        select: { userId: true, user: { select: { firstName: true } } },
      }),
      prisma.ivyCircle.findUnique({ where: { id: circleId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: coachId }, select: { firstName: true } }),
    ])
    if (!circle) return

    const chatService = (await import('./chat.service')).default

    for (const m of members) {
      const others = members
        .filter((o) => o.userId !== m.userId)
        .map((o) => o.user.firstName)
        .filter(Boolean)
      const names =
        others.length > 2
          ? `${others.slice(0, 2).join(', ')} and ${others.length - 2} other${others.length - 2 === 1 ? '' : 's'}`
          : others.join(' and ')
      chatService.postIvyMessage(
        m.userId,
        `Something's happened. ${coach?.firstName ?? 'Your coach'}'s crew just became official — you're now in ${circle.name} with ${names}. They'll hear when you show up; you'll hear when they go quiet. Check your Circle tab.`,
        { messageType: 'circle_formed', metadata: { circleId } },
      ).catch((err) => logger.warn(`Formation message failed for ${m.userId}:`, err))
    }

    chatService.postIvyMessage(
      coachId,
      `Your crew is official: ${circle.name} is live with ${members.length} of your clients in the room. They now show up in front of each other, not just in front of you — I'll bring the group pulse to your console and your ponder calls.`,
      { messageType: 'circle_formed', metadata: { circleId } },
    ).catch((err) => logger.warn(`Coach formation message failed for ${coachId}:`, err))
  }

  /**
   * Weekly pulse to every circle member — the group's week as one number,
   * plus where you stood in it. Turns the silent room into a rhythm. No LLM:
   * template lines, real math, pennies to run.
   */
  async sendWeeklyMemberPulse(): Promise<void> {
    const circles = await prisma.ivyCircle.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })
    const chatService = (await import('./chat.service')).default
    const weekAgo = new Date(Date.now() - 7 * 86_400_000)

    for (const circle of circles) {
      const members = await prisma.ivyCircleMember.findMany({
        where: { circleId: circle.id, isActive: true },
        select: { userId: true, user: { select: { firstName: true } } },
      })
      if (members.length < 2) continue // a pulse of one is just a mirror

      const workouts = await prisma.workout.findMany({
        where: { userId: { in: members.map((m) => m.userId) }, plannedDate: { gte: weekAgo } },
        select: { userId: true, status: true, armedAt: true },
      })
      if (workouts.length === 0) continue // nothing planned anywhere — stay quiet

      // In the arming product a kept day is an ARMED day (status often stays
      // PLANNED); explicit COMPLETED/PARTIAL still counts for legacy paths.
      const kept = (w: { status: string; armedAt: Date | null }) =>
        w.status === 'COMPLETED' || w.status === 'PARTIAL' ||
        (!!w.armedAt && w.status !== 'MISSED' && w.status !== 'SKIPPED')
      const groupRate = Math.round((workouts.filter(kept).length / workouts.length) * 100)

      // The game is part of the week's story — one line, if there is one.
      let gameLine = ''
      try {
        const circleGameService = (await import('./circle-game.service')).default
        gameLine = await circleGameService.circlePulseLine(circle.id)
      } catch { /* pulse still goes out without the game line */ }

      for (const m of members) {
        const mine = workouts.filter((w) => w.userId === m.userId)
        const myRate = mine.length > 0 ? mine.filter(kept).length / mine.length : null

        let personal: string
        if (myRate === null) {
          personal = `Nothing planned from you last week — the room notices quiet.`
        } else if (myRate >= 0.8) {
          personal = `You were one of the ones carrying it.`
        } else if (myRate > 0) {
          personal = `Every day you keep lifts the room's number.`
        } else {
          personal = `The room held without you this week — jump back in, they'll hear it.`
        }

        chatService.postIvyMessage(
          m.userId,
          `${circle.name} kept ${groupRate}% of planned days last week. ${personal}${gameLine ? ` ${gameLine}` : ''}`,
          { messageType: 'circle_pulse', metadata: { circleId: circle.id }, notify: false },
        ).catch((err) => logger.warn(`Circle pulse failed for ${m.userId}:`, err))
      }
    }
  }

  async setSprintGoal(circleId: string, data: {
    sprintNumber: number
    pledge: string
    theme?: string
    targetMetric?: string
    setByUserId?: string
  }) {
    return prisma.circleSprintGoal.upsert({
      where: { circleId_sprintNumber: { circleId, sprintNumber: data.sprintNumber } },
      create: { circleId, ...data },
      update: { pledge: data.pledge, theme: data.theme, targetMetric: data.targetMetric },
    })
  }

  async getSprintGoal(circleId: string, sprintNumber: number) {
    return prisma.circleSprintGoal.findUnique({
      where: { circleId_sprintNumber: { circleId, sprintNumber } },
    })
  }

  // Calculate group consistency rate for the current sprint window
  async getGroupConsistency(circleId: string): Promise<{
    rate: number
    topPerformers: string[]
    memberCount: number
  }> {
    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: { userId: true, user: { select: { firstName: true } } },
    })

    if (members.length === 0) return { rate: 0, topPerformers: [], memberCount: 0 }

    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) // last sprint window
    const userIds = members.map((m) => m.userId)

    const workouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        plannedDate: { gte: since },
      },
      select: { userId: true, status: true, armedAt: true },
    })

    const byUser = new Map<string, { completed: number; total: number }>()
    for (const u of members) {
      byUser.set(u.userId, { completed: 0, total: 0 })
    }
    for (const w of workouts) {
      const entry = byUser.get(w.userId)
      if (entry) {
        entry.total++
        // Armed days ARE kept days in the arming product (status often stays
        // PLANNED); explicit COMPLETED/PARTIAL still counts for legacy paths.
        if (
          w.status === 'COMPLETED' || w.status === 'PARTIAL' ||
          (!!w.armedAt && w.status !== 'MISSED' && w.status !== 'SKIPPED')
        ) entry.completed++
      }
    }

    const rates = [...byUser.entries()].map(([userId, { completed, total }]) => ({
      userId,
      rate: total > 0 ? completed / total : 0,
    }))

    const avgRate = rates.reduce((sum, r) => sum + r.rate, 0) / rates.length
    const sorted = rates.sort((a, b) => b.rate - a.rate)
    const topIds = sorted.slice(0, 3).map((r) => r.userId)
    const topNames = members
      .filter((m) => topIds.includes(m.userId))
      .map((m) => m.user.firstName)

    return {
      rate: Math.round(avgRate * 100),
      topPerformers: topNames,
      memberCount: members.length,
    }
  }

  // Full context blob for Ivy's call — everything she needs to reference the group
  async getCircleContextForUser(userId: string): Promise<CircleContext | null> {
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      include: {
        circle: {
          include: {
            sprintGoals: { orderBy: { sprintNumber: 'desc' }, take: 1 },
            company: { select: { name: true, wellnessTheme: true, wellnessGoal: true } },
          },
        },
      },
    })

    if (!membership) return null

    const { circle } = membership
    const consistency = await this.getGroupConsistency(circle.id)
    const latestGoal = circle.sprintGoals[0]

    return {
      circleName: circle.name,
      circleTrack: circle.track,
      seasonTheme: circle.seasonTheme ?? null,
      sprintPledge: latestGoal?.pledge ?? null,
      sprintTheme: latestGoal?.theme ?? null,
      groupConsistencyRate: consistency.rate,
      topPerformers: consistency.topPerformers,
      memberCount: consistency.memberCount,
      userRole: membership.role,
      companyWellnessTheme: circle.company?.wellnessTheme ?? null,
      companyWellnessGoal: circle.company?.wellnessGoal ?? null,
    }
  }

  async updateCircle(circleId: string, data: {
    name?: string
    seasonTheme?: string
    track?: string
  }) {
    return prisma.ivyCircle.update({ where: { id: circleId }, data })
  }

  // ── Phase 4b: Witnessed stakes (§4b mechanic 1) ───────────────────────────

  /**
   * setShareStakeWithCircle — member opts in or out of stake visibility.
   *
   * Pure flag toggle — NO money movement.  Other circle members can then call
   * getCircleStakeStatuses() to see opted-in members' stake status.
   */
  async setShareStakeWithCircle(circleId: string, userId: string, share: boolean): Promise<void> {
    await prisma.ivyCircleMember.update({
      where: { circleId_userId: { circleId, userId } },
      data: { shareStakeWithCircle: share },
    })
    logger.info(`Witnessed stakes: ${userId} set shareStakeWithCircle=${share} in circle ${circleId}`)
  }

  /**
   * getCircleStakeStatuses — surface opted-in members' stake status for the circle view.
   *
   * Returns one entry per active member.  Members who have NOT opted in get
   * stakeStatus='private' with sliceAmount=null — their data is never exposed.
   *
   * GUARDRAIL: this is READ-ONLY / VISIBILITY ONLY.  No money moves here.
   * The slice amounts shown are each member's OWN stake — never redistributed.
   *
   * Status semantics (for today's workout window):
   *   'armed'    — VN recorded, outcome still pending
   *   'completed'— slice outcome RELEASED (succeeded)
   *   'forfeited'— slice outcome FORFEITED (missed/unarmed, captured)
   *   'unarmed'  — no arming yet today (PENDING and no armedAt)
   *   'no_stake' — member has no open stake cycle
   *   'private'  — member has not opted in (shareStakeWithCircle = false)
   */
  async getCircleStakeStatuses(circleId: string): Promise<WitnessedStakeStatus[]> {
    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: {
        userId: true,
        shareStakeWithCircle: true,
        user: { select: { id: true, firstName: true } },
      },
    }) as Array<{ userId: string; shareStakeWithCircle: boolean; user: { id: string; firstName: string } }>

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const results: WitnessedStakeStatus[] = []

    for (const member of members) {
      if (!member.shareStakeWithCircle) {
        results.push({
          userId: member.userId,
          firstName: member.user.firstName,
          shareStakeWithCircle: false,
          stakeStatus: 'private',
          sliceAmount: null,
          cycleId: null,
        })
        continue
      }

      // Find their current open stake cycle
      const cycle = await prisma.stakeCycle.findFirst({
        where: { userId: member.userId, status: 'AUTHORIZED' },
        select: { id: true, stakeAmount: true, daysInCycle: true },
        orderBy: { periodStart: 'desc' },
      })

      if (!cycle) {
        results.push({
          userId: member.userId,
          firstName: member.user.firstName,
          shareStakeWithCircle: true,
          stakeStatus: 'no_stake',
          sliceAmount: null,
          cycleId: null,
        })
        continue
      }

      // Find today's workout in this cycle
      const workout = await prisma.workout.findFirst({
        where: {
          userId: member.userId,
          stakeCycleId: cycle.id,
          plannedDate: { gte: today, lt: tomorrow },
        },
        select: { armedAt: true, sliceOutcome: true, stakeSliceAmount: true },
      }) as { armedAt: Date | null; sliceOutcome: string; stakeSliceAmount: any } | null

      // Divide by the cycle's REAL forfeitable-day count — Foundation Runs are
      // often <7 days, and /7 understates their slice (same bug class as the
      // baton-stake fix in circle-game.service).
      const baseSlice = Math.round((Number(cycle.stakeAmount) / (cycle.daysInCycle || 7)) * 100) / 100
      const sliceAmount = workout?.stakeSliceAmount
        ? Math.round(Number(workout.stakeSliceAmount) * 100) / 100
        : baseSlice

      let stakeStatus: WitnessedStakeStatus['stakeStatus']
      if (!workout) {
        stakeStatus = 'unarmed'
      } else if (workout.sliceOutcome === 'RELEASED') {
        stakeStatus = 'completed'
      } else if (workout.sliceOutcome === 'FORFEITED') {
        stakeStatus = 'forfeited'
      } else if (workout.armedAt) {
        stakeStatus = 'armed'
      } else {
        stakeStatus = 'unarmed'
      }

      results.push({
        userId: member.userId,
        firstName: member.user.firstName,
        shareStakeWithCircle: true,
        stakeStatus,
        sliceAmount,
        cycleId: cycle.id,
      })
    }

    return results
  }

  // ── Phase 4b: Collective charity goal (§4b mechanic 2) ────────────────────

  /**
   * setCollectiveCharityGoal — nominate a shared charity cause for a sprint.
   *
   * Associates a Charity with the circle's sprint goal for the given sprint number.
   * When the linked collective game hits its target, collectiveGoalHitAt is set by
   * circle-game.service.ts.
   *
   * IMPORTANT: no donation is created here or in the game service — the actual
   * group donation rides on STAKE_SUCCESS which requires Phase 6 corporate funding.
   * TODO(phase6): wire STAKE_SUCCESS donations once Phase 6 corporate layer is live.
   */
  async setCollectiveCharityGoal(
    circleId: string,
    sprintNumber: number,
    charityId: string,
  ): Promise<void> {
    // Verify charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: charityId },
      select: { id: true, name: true, isActive: true },
    })
    if (!charity || !charity.isActive) {
      throw new NotFoundError(`Charity ${charityId} not found or inactive`)
    }

    const goal = await prisma.circleSprintGoal.findUnique({
      where: { circleId_sprintNumber: { circleId, sprintNumber } },
      select: { id: true },
    })
    if (!goal) {
      throw new NotFoundError(
        `No sprint goal found for circle ${circleId} sprint ${sprintNumber}. ` +
        'Create the sprint goal first with setSprintGoal().'
      )
    }

    await prisma.circleSprintGoal.update({
      where: { circleId_sprintNumber: { circleId, sprintNumber } },
      data: { collectiveCharityGoalId: charityId },
    })

    logger.info(
      `Collective charity goal set: circle=${circleId} sprint=${sprintNumber} ` +
      `charity=${charity.name} (${charityId}). No donation fired — Phase 6 TODO.`
    )
  }

  /**
   * getCollectiveCharityGoalStatus — read-only status for the sprint's collective goal.
   * Returns null if no collective charity goal is set.
   */
  async getCollectiveCharityGoalStatus(circleId: string, sprintNumber: number): Promise<{
    charityId: string
    charityName: string
    goalHitAt: Date | null
  } | null> {
    const goal = await prisma.circleSprintGoal.findUnique({
      where: { circleId_sprintNumber: { circleId, sprintNumber } },
      select: {
        collectiveCharityGoalId: true,
        collectiveGoalHitAt: true,
        collectiveCharity: { select: { id: true, name: true } },
      },
    }) as {
      collectiveCharityGoalId: string | null
      collectiveGoalHitAt: Date | null
      collectiveCharity: { id: string; name: string } | null
    } | null

    if (!goal?.collectiveCharityGoalId || !goal.collectiveCharity) return null

    return {
      charityId: goal.collectiveCharityGoalId,
      charityName: goal.collectiveCharity.name,
      goalHitAt: goal.collectiveGoalHitAt,
    }
  }

  async getCompanyCircles(companyId: string) {
    return prisma.ivyCircle.findMany({
      where: { companyId, isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, streaks: true } } },
        },
        sprintGoals: { orderBy: { sprintNumber: 'desc' }, take: 1 },
      },
    })
  }
}

export interface CircleContext {
  circleName: string
  circleTrack: string
  seasonTheme: string | null
  sprintPledge: string | null
  sprintTheme: string | null
  groupConsistencyRate: number  // 0–100
  topPerformers: string[]
  memberCount: number
  userRole: string
  companyWellnessTheme: string | null
  companyWellnessGoal: string | null
}

export default new CircleService()
