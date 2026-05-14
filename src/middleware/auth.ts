import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';
import prisma from '../utils/prisma';

export interface AuthRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    id: string;
    email: string;
    role: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    stripeSubscriptionId: string | null;
    companyId: string | null;
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      userId: string;
      email: string;
    };

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      stripeSubscriptionId: user.stripeSubscriptionId,
      companyId: user.companyId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

export const requireSuperAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'superadmin') {
    next(new UnauthorizedError('Superadmin access required'));
    return;
  }
  next();
};

export const requireTier = (...tiers: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!tiers.includes(req.user.subscriptionTier)) {
      throw new UnauthorizedError('Insufficient subscription tier');
    }

    next();
  };
};
