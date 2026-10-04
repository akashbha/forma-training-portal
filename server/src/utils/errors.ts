import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from './logger.js';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    stack?: string;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fields?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', fields?: Record<string, string[]>) {
    super(400, 'BAD_REQUEST', message, fields);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists or conflicts with existing state') {
    super(409, 'CONFLICT', message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If response is already committed, forward to default express error handler
  if (res.headersSent) {
    return _next(err);
  }

  // 1. Handled AppError
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const pathKey = issue.path.length > 0 ? issue.path.join('.') : 'general';
      if (!fields[pathKey]) {
        fields[pathKey] = [];
      }
      fields[pathKey].push(issue.message);
    }

    const response: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed for one or more fields',
        fields,
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
      },
    };
    res.status(400).json(response);
    return;
  }

  // 3. Prisma Unique Constraint or Foreign Key Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(', ')
        : 'unique field';
      res.status(409).json({
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: `A record with this ${target} already exists.`,
          ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record was not found.',
          ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        },
      });
      return;
    }

    if (err.code === 'P2003') {
      res.status(400).json({
        error: {
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'Referenced entity does not exist.',
          ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        },
      });
      return;
    }
  }

  // 4. Fallback 500 Internal Server Error
  logger.error(err, 'Unhandled server exception occurred');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
}
