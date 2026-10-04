import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { validateRequest } from '../middleware/validate.js';
import { LoginBodySchema, RefreshTokenBodySchema } from '../schemas/api.js';
import { comparePassword } from '../utils/passwords.js';
import { signAccessToken, generateRefreshTokenString } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { loginRateLimiter, recordLoginFailure, clearLoginAttempts } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { writeAuditLog } from '../utils/audit.js';

export const authRouter = Router();

const isProduction = config.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * POST /api/auth/login
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: LoginBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      // Check user existence
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          trainee: {
            include: {
              batch: true,
            },
          },
        },
      });

      // Always return identical message for unknown email and wrong password
      const GENERIC_AUTH_ERROR = 'Invalid email or password';

      if (!user) {
        recordLoginFailure(req);
        throw new UnauthorizedError(GENERIC_AUTH_ERROR);
      }

      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        recordLoginFailure(req);
        throw new UnauthorizedError(GENERIC_AUTH_ERROR);
      }

      // Clear rate limit failures on success
      clearLoginAttempts(req);

      // Issue access token (15 mins) and refresh token (7 days)
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        traineeId: user.trainee?.id ?? null,
        batchId: user.trainee?.batchId ?? null,
      };

      const accessToken = signAccessToken(tokenPayload);
      const refreshTokenStr = generateRefreshTokenString();
      const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

      // Store refresh token in database and record audit log in transaction
      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.create({
          data: {
            token: refreshTokenStr,
            userId: user.id,
            expiresAt,
          },
        });

        await writeAuditLog(tx, {
          actorId: user.id,
          action: 'LOGIN' as any,
          entity: 'Auth',
          entityId: user.id,
          after: { email: user.email, role: user.role },
          ip: req.ip,
        });
      });

      // Set httpOnly, Secure, SameSite=Lax cookies
      res.cookie('accessToken', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('refreshToken', refreshTokenStr, {
        ...COOKIE_OPTIONS,
        maxAge: config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Authentication successful',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          traineeId: user.trainee?.id ?? null,
          batchId: user.trainee?.batchId ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/refresh
 */
authRouter.post(
  '/refresh',
  validateRequest({ body: RefreshTokenBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshTokenStr) {
        throw new UnauthorizedError('Refresh token is required');
      }

      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshTokenStr },
        include: {
          user: {
            include: {
              trainee: true,
            },
          },
        },
      });

      if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      const user = storedToken.user;
      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        traineeId: user.trainee?.id ?? null,
        batchId: user.trainee?.batchId ?? null,
      });

      res.cookie('accessToken', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Token refreshed successfully',
        accessToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshTokenStr) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshTokenStr },
        data: { revoked: true },
      });
    }

    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        trainee: {
          include: {
            batch: true,
          },
        },
        batchesLed: {
          select: {
            id: true,
            name: true,
            program: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        traineeId: user.trainee?.id ?? null,
        batchId: user.trainee?.batchId ?? null,
        trainee: user.trainee
          ? {
              id: user.trainee.id,
              batchId: user.trainee.batchId,
              batch: user.trainee.batch,
            }
          : null,
        batchesLed: user.batchesLed,
      },
    });
  } catch (err) {
    next(err);
  }
});
