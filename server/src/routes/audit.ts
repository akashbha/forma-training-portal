import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { ListAuditLogsQuerySchema } from '../schemas/api.js';
import { Role } from '@prisma/client';

export const auditRouter = Router();

// Strictly ADMIN role only
auditRouter.use(requireAuth, requireRole(Role.ADMIN));

/**
 * GET /api/v1/audit
 * Append-only audit log reader with filters. No PUT/PATCH/DELETE endpoints exist.
 */
auditRouter.get(
  '/',
  validateRequest({ query: ListAuditLogsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actorId, entity, action, from, to, page, limit } = req.query as any;

      const where: any = {};

      if (actorId) {
        where.actorId = actorId;
      }

      if (entity) {
        where.entity = entity;
      }

      if (action) {
        where.action = action;
      }

      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const total = await prisma.auditLog.count({ where });

      const skip = (page - 1) * limit;
      const logs = await prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const parsedLogs = logs.map((log) => ({
        ...log,
        before: log.before ? JSON.parse(log.before) : null,
        after: log.after ? JSON.parse(log.after) : null,
      }));

      res.status(200).json({
        data: parsedLogs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
