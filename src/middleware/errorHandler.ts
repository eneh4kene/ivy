import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import { config } from '../config';
import { Sentry } from '../lib/sentry';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Only genuine server-side failures go to Sentry — expected 4xx (AppError,
  // Zod validation) would drown real bugs in noise. Prisma/unhandled errors
  // are exactly the "silent failure" class this exists to catch.
  const isExpectedClientError = err instanceof AppError || err.name === 'ZodError';
  if (!isExpectedClientError) {
    Sentry.captureException(err, { extra: { url: req.url, method: req.method } });
  }

  // Handle known AppError
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // Handle Prisma errors
  if (err.constructor.name.includes('Prisma')) {
    return sendError(res, 'Database error occurred', 500, 'DATABASE_ERROR');
  }

  // Handle validation errors (Zod)
  if (err.name === 'ZodError') {
    return sendError(res, 'Validation error', 422, 'VALIDATION_ERROR');
  }

  // Default to 500 server error
  const message = config.server.env === 'production'
    ? 'Internal server error'
    : err.message;

  return sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
};

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(res, `Route ${req.url} not found`, 404, 'NOT_FOUND');
};
