import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import { config } from '../config';

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
