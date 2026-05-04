import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { NotFoundError, BadRequestError } from '../utils/errors'

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
