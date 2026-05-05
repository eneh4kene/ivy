import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';
import authService from '../../services/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import logger from '../../utils/logger';

class AdminController {
  private requireCompany(req: AuthRequest, res: Response): string | null {
    const companyId = req.user?.companyId;
    if (!companyId) {
      sendError(res, 'Company membership required', 403);
      return null;
    }
    return companyId;
  }

  private async getWeeklyParticipation(companyId: string, weeks: number) {
    const results = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const [totalActive, usersWithWorkouts] = await Promise.all([
        prisma.user.count({ where: { companyId, isOnboarded: true, isActive: true } }),
        prisma.workout.findMany({
          where: { user: { companyId }, plannedDate: { gte: weekStart, lt: weekEnd } },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

      results.push({
        week: weeks - w,
        rate: totalActive > 0 ? Math.round((usersWithWorkouts.length / totalActive) * 100) : 0,
      });
    }
    return results;
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        sendError(res, 'Company not found', 404);
        return;
      }

      const [employees, workoutStats, donationTotal, trackGroups] = await Promise.all([
        prisma.user.findMany({
          where: { companyId },
          select: { id: true, isOnboarded: true, isActive: true, track: true },
        }),
        prisma.workout.groupBy({
          by: ['status'],
          where: { user: { companyId } },
          _count: true,
        }),
        prisma.donation.aggregate({
          where: { user: { companyId } },
          _sum: { amount: true },
        }),
        prisma.user.groupBy({
          by: ['track'],
          where: { companyId },
          _count: true,
        }),
      ]);

      const totalEmployees = employees.length;
      const activeEmployees = employees.filter(e => e.isOnboarded && e.isActive).length;
      const pendingEmployees = employees.filter(e => !e.isOnboarded).length;

      // Participation: users with at least one planned workout this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const usersThisWeek = await prisma.workout.findMany({
        where: { user: { companyId }, plannedDate: { gte: weekStart } },
        select: { userId: true },
        distinct: ['userId'],
      });
      const participationRate = totalEmployees > 0
        ? Math.round((usersThisWeek.length / totalEmployees) * 100)
        : 0;

      const completedCount = workoutStats.find(w => w.status === 'COMPLETED')?._count ?? 0;
      const totalWorkouts = workoutStats.reduce((sum, w) => sum + w._count, 0);
      const consistencyRate = totalWorkouts > 0
        ? Math.round((completedCount / totalWorkouts) * 100)
        : 0;

      const tracks = trackGroups.map(t => ({
        track: t.track || 'unknown',
        count: t._count,
        percentage: totalEmployees > 0 ? Math.round((t._count / totalEmployees) * 100) : 0,
      }));

      const weeklyParticipation = await this.getWeeklyParticipation(companyId, 6);

      const now = new Date();
      const daysRemaining = company.seasonEndDate
        ? Math.max(0, Math.ceil((company.seasonEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      sendSuccess(res, {
        season: {
          name: `Season ${company.currentSeason}`,
          startDate: company.seasonStartDate?.toISOString().split('T')[0] ?? null,
          endDate: company.seasonEndDate?.toISOString().split('T')[0] ?? null,
          daysRemaining,
        },
        enrollment: { total: totalEmployees, active: activeEmployees, pending: pendingEmployees },
        participation: { rate: participationRate },
        consistency: { rate: consistencyRate },
        donations: { total: Number(donationTotal._sum.amount ?? 0) },
        tracks,
        weeklyParticipation,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEmployees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const employees = await prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isOnboarded: true,
          isActive: true,
          track: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, employees.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        email: e.email,
        status: !e.isActive ? 'inactive' : !e.isOnboarded ? 'pending' : 'active',
        track: e.track || '-',
        joinedAt: e.createdAt.toISOString().split('T')[0],
      })));
    } catch (error) {
      next(error);
    }
  }

  async inviteEmployees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const { emails } = req.body;
      if (!Array.isArray(emails) || emails.length === 0) {
        sendError(res, 'emails array required', 400);
        return;
      }

      const results: { email: string; status: string; error?: string }[] = [];

      for (const rawEmail of emails) {
        const email = String(rawEmail).toLowerCase().trim();
        if (!email.includes('@')) {
          results.push({ email, status: 'skipped', error: 'Invalid email' });
          continue;
        }

        try {
          await prisma.user.upsert({
            where: { email },
            create: {
              email,
              firstName: email.split('@')[0],
              lastName: '',
              companyId,
              subscriptionTier: 'B2B',
              track: 'fitness',
              goal: 'TBD',
            },
            update: { companyId },
          });

          await authService.sendMagicLink(email);
          results.push({ email, status: 'invited' });
          logger.info(`Invited employee ${email} to company ${companyId}`);
        } catch (err: any) {
          logger.error(`Failed to invite ${email}:`, err);
          results.push({ email, status: 'failed', error: err.message });
        }
      }

      sendSuccess(res, { results });
    } catch (error) {
      next(error);
    }
  }

  async getCalls(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const limit = Math.min(Number(req.query.limit ?? 30), 100);
      const offset = Number(req.query.offset ?? 0);
      const callType = req.query.callType as string | undefined;
      const sentiment = req.query.sentiment as string | undefined;
      const userId = req.query.userId as string | undefined;

      const where: Record<string, unknown> = {
        user: { companyId },
        status: 'COMPLETED',
      };
      if (callType) where.callType = callType;
      if (sentiment) where.sentiment = sentiment;
      if (userId) where.userId = userId;

      const [calls, total] = await Promise.all([
        prisma.call.findMany({
          where,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, track: true, goal: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.call.count({ where }),
      ]);

      // For each call, check if a workout was logged within 12h (the close rate signal)
      const enriched = await Promise.all(
        calls.map(async (call) => {
          const workoutAfter = call.endedAt
            ? await prisma.workout.findFirst({
                where: {
                  userId: call.userId,
                  status: { in: ['COMPLETED', 'PARTIAL'] },
                  completedAt: {
                    gte: call.scheduledAt,
                    lte: new Date(call.scheduledAt.getTime() + 12 * 60 * 60 * 1000),
                  },
                },
                select: { id: true, activity: true, status: true },
              })
            : null;

          return {
            id: call.id,
            callType: call.callType,
            scheduledAt: call.scheduledAt,
            duration: call.duration,
            outcome: call.outcome,
            sentiment: call.sentiment,
            transcript: call.transcript,
            user: call.user,
            workoutFollowed: workoutAfter
              ? { activity: workoutAfter.activity, status: workoutAfter.status }
              : null,
          };
        })
      );

      sendSuccess(res, enriched, 200, { total, limit, offset });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const days = Number(req.query.days ?? 30);

      // Get all user IDs in this company
      const companyUsers = await prisma.user.findMany({
        where: { companyId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      const userIds = companyUsers.map(u => u.id);

      if (userIds.length === 0) {
        sendSuccess(res, { byService: [], byUser: [], totalCostGbp: 0 });
        return;
      }

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Per-service breakdown for company users
      const byService = await prisma.apiUsageLog.groupBy({
        by: ['service', 'operation'],
        where: { userId: { in: userIds }, createdAt: { gte: since } },
        _sum: { costGbp: true, units: true },
        _count: true,
      });

      // Per-user cost breakdown (top spenders)
      const byUserRaw = await prisma.apiUsageLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: since } },
        _sum: { costGbp: true },
        orderBy: { _sum: { costGbp: 'desc' } },
        take: 20,
      });

      const userMap = new Map(companyUsers.map(u => [u.id, u]));

      const byUser = byUserRaw.map(row => ({
        userId: row.userId,
        name: `${userMap.get(row.userId ?? '')?.firstName ?? ''} ${userMap.get(row.userId ?? '')?.lastName ?? ''}`.trim(),
        email: userMap.get(row.userId ?? '')?.email ?? '',
        totalCostGbp: Number((row._sum.costGbp ?? 0).toFixed(4)),
      }));

      const totalCostGbp = byService.reduce((sum, row) => sum + Number(row._sum.costGbp ?? 0), 0);

      sendSuccess(res, {
        periodDays: days,
        totalCostGbp: Number(totalCostGbp.toFixed(4)),
        byService: byService.map(row => ({
          service: row.service,
          operation: row.operation,
          totalCostGbp: Number((row._sum.costGbp ?? 0).toFixed(4)),
          totalUnits: Number((row._sum.units ?? 0).toFixed(2)),
          count: row._count,
        })),
        byUser,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReportData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.requireCompany(req, res);
      if (!companyId) return;

      const { type = 'summary' } = req.query;

      if (type === 'employees') {
        const employees = await prisma.user.findMany({
          where: { companyId },
          select: { id: true, firstName: true, lastName: true, email: true, isOnboarded: true, isActive: true, track: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const rows = [
          'Name,Email,Status,Track,Joined',
          ...employees.map(e => [
            `"${e.firstName} ${e.lastName}".trim()`,
            e.email,
            !e.isActive ? 'inactive' : !e.isOnboarded ? 'pending' : 'active',
            e.track || '-',
            e.createdAt.toISOString().split('T')[0],
          ].join(',')),
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="ivy-employees.csv"');
        res.send(rows.join('\n'));
        return;
      }

      // Default: JSON summary (consumed by frontend for other reports)
      const [workoutStats, donationTotal, employees] = await Promise.all([
        prisma.workout.groupBy({ by: ['status'], where: { user: { companyId } }, _count: true }),
        prisma.donation.aggregate({ where: { user: { companyId } }, _sum: { amount: true } }),
        prisma.user.count({ where: { companyId } }),
      ]);

      sendSuccess(res, {
        reportType: type,
        generatedAt: new Date().toISOString(),
        totalEmployees: employees,
        totalDonated: Number(donationTotal._sum.amount ?? 0),
        workoutsByStatus: Object.fromEntries(workoutStats.map(w => [w.status, w._count])),
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
