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
    maxSize?: number
  }) {
    const circle = await prisma.ivyCircle.create({
      data: {
        name: data.name,
        track: data.track,
        tier: data.tier,
        seasonTheme: data.seasonTheme,
        companyId: data.companyId,
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
                id: true, firstName: true, lastName: true,
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

  async getCirclesForUser(userId: string) {
    return prisma.ivyCircleMember.findMany({
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

    await prisma.ivyCircle.update({
      where: { id: circleId },
      data: { size: { increment: 1 } },
    })

    return member
  }

  async removeMember(circleId: string, userId: string) {
    await prisma.ivyCircleMember.update({
      where: { circleId_userId: { circleId, userId } },
      data: { isActive: false },
    })
    await prisma.ivyCircle.update({
      where: { id: circleId },
      data: { size: { decrement: 1 } },
    })
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
      select: { userId: true, status: true },
    })

    const byUser = new Map<string, { completed: number; total: number }>()
    for (const u of members) {
      byUser.set(u.userId, { completed: 0, total: 0 })
    }
    for (const w of workouts) {
      const entry = byUser.get(w.userId)
      if (entry) {
        entry.total++
        if (w.status === 'COMPLETED' || w.status === 'PARTIAL') entry.completed++
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
    await (prisma.ivyCircleMember as any).update({
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
    const members = await (prisma.ivyCircleMember as any).findMany({
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
        select: { id: true, stakeAmount: true },
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
      const workout = await (prisma.workout as any).findFirst({
        where: {
          userId: member.userId,
          stakeCycleId: cycle.id,
          plannedDate: { gte: today, lt: tomorrow },
        },
        select: { armedAt: true, sliceOutcome: true, stakeSliceAmount: true },
      }) as { armedAt: Date | null; sliceOutcome: string; stakeSliceAmount: any } | null

      const baseSlice = Math.round((Number(cycle.stakeAmount) / 7) * 100) / 100
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

    const goal = await (prisma.circleSprintGoal as any).findUnique({
      where: { circleId_sprintNumber: { circleId, sprintNumber } },
      select: { id: true },
    })
    if (!goal) {
      throw new NotFoundError(
        `No sprint goal found for circle ${circleId} sprint ${sprintNumber}. ` +
        'Create the sprint goal first with setSprintGoal().'
      )
    }

    await (prisma.circleSprintGoal as any).update({
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
    const goal = await (prisma.circleSprintGoal as any).findUnique({
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
