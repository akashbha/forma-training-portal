import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { prisma } from '../db/prisma.js';

export interface AuthenticatedUser extends TokenPayload {
  id: string; // alias to userId
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication middleware verifying JWT from cookie or Bearer header
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check httpOnly cookie 'accessToken'
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // 2. Check Authorization Bearer header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token is missing');
    }

    const payload = verifyAccessToken(token);

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        trainee: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      traineeId: user.trainee?.id ?? null,
      batchId: user.trainee?.batchId ?? null,
    };

    next();
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return next(err);
    }
    if (err?.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    if (err?.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid access token'));
    }
    next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Role '${req.user.role}' is not authorized to perform this action`
        )
      );
    }

    next();
  };
}

/**
 * Trainee Read-Only Guard: Trainees can never make write operations
 */
export function denyTraineeWrites(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role === 'TRAINEE' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(new ForbiddenError('Trainees have read-only access'));
  }
  next();
}

/**
 * Verify access to a batch
 */
export async function assertBatchAccess(user: AuthenticatedUser, batchId: string): Promise<void> {
  if (user.role === 'ADMIN') return;

  if (user.role === 'TRAINER') {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { trainerId: true },
    });
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }
    if (batch.trainerId !== user.id) {
      throw new ForbiddenError('You do not have access to this batch');
    }
    return;
  }

  if (user.role === 'TRAINEE') {
    if (user.batchId !== batchId) {
      throw new ForbiddenError('You can only access your assigned batch');
    }
    return;
  }

  throw new ForbiddenError();
}

/**
 * Verify access to a trainee record
 */
export async function assertTraineeAccess(user: AuthenticatedUser, traineeId: string): Promise<void> {
  if (user.role === 'ADMIN') return;

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: { batch: true },
  });

  if (!trainee) {
    throw new NotFoundError('Trainee not found');
  }

  if (user.role === 'TRAINEE') {
    if (user.traineeId !== traineeId) {
      throw new ForbiddenError('Trainees can only access their own profile');
    }
    return;
  }

  if (user.role === 'TRAINER') {
    if (trainee.batch.trainerId !== user.id) {
      throw new ForbiddenError("You do not have access to trainees outside your assigned batches");
    }
    return;
  }

  throw new ForbiddenError();
}
