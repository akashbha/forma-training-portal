import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, assertBatchAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  ListSessionsQuerySchema,
  CreateSessionBodySchema,
  UpdateSessionBodySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { NotFoundError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { AuditAction } from '@prisma/client';

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

/**
 * GET /api/v1/sessions
 */
sessionsRouter.get(
  '/',
  validateRequest({ query: ListSessionsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId, topicId, from, to, page = 1, limit = 20 } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (req.user!.role === 'TRAINER') {
        where.batch = {
          trainerId: req.user!.id,
        };
        if (batchId) {
          where.batchId = batchId;
        }
      } else if (req.user!.role === 'TRAINEE') {
        where.batchId = req.user!.batchId || 'none';
      } else if (batchId) {
        where.batchId = batchId;
      }

      if (topicId) {
        where.topicId = topicId;
      }

      if (from || to) {
        where.heldOn = {};
        if (from) where.heldOn.gte = from;
        if (to) where.heldOn.lte = to;
      }

      const [total, sessions] = await Promise.all([
        prisma.session.count({ where }),
        prisma.session.findMany({
          where,
          skip,
          take: limit,
          orderBy: { heldOn: 'desc' },
          include: {
            topic: true,
            batch: {
              select: { id: true, name: true, program: true, trainer: { select: { id: true, name: true } } },
            },
            _count: {
              select: { results: true, attendances: true },
            },
          },
        }),
      ]);

      res.status(200).json({
        data: sessions.map((s) => ({
          id: s.id,
          title: s.title,
          heldOn: s.heldOn,
          passMark: s.passMark,
          topic: s.topic,
          batch: s.batch,
          resultsCount: s._count.results,
          attendancesCount: s._count.attendances,
          createdAt: s.createdAt,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/sessions/:id
 */
sessionsRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const session = await prisma.session.findUnique({
        where: { id },
        include: {
          topic: true,
          batch: {
            include: {
              trainer: { select: { id: true, name: true, email: true } },
            },
          },
          attendances: {
            include: {
              trainee: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          results: {
            include: {
              trainee: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
            orderBy: { score: 'desc' },
          },
        },
      });

      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, session.batchId);

      res.status(200).json({ data: session });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/sessions
 */
sessionsRouter.post(
  '/',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: CreateSessionBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId, topicId, title, heldOn, passMark } = req.body;
      await assertBatchAccess(req.user!, batchId);

      const session = await prisma.$transaction(async (tx) => {
        const created = await tx.session.create({
          data: {
            batchId,
            topicId,
            title,
            heldOn,
            passMark,
          },
          include: {
            topic: true,
            batch: true,
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.CREATE,
          entity: 'Session',
          entityId: created.id,
          after: created,
          ip: req.ip,
        });

        return created;
      });

      res.status(201).json({
        message: 'Session created successfully',
        data: session,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/sessions/:id
 */
sessionsRouter.patch(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema, body: UpdateSessionBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.session.findUnique({
        where: { id },
        select: { id: true, batchId: true, topicId: true, title: true, heldOn: true, passMark: true },
      });

      if (!existing) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, existing.batchId);

      if (req.body.batchId && req.body.batchId !== existing.batchId) {
        await assertBatchAccess(req.user!, req.body.batchId);
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.session.update({
          where: { id },
          data: req.body,
          include: {
            topic: true,
            batch: true,
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Session',
          entityId: result.id,
          before: existing,
          after: result,
          ip: req.ip,
        });

        return result;
      });

      res.status(200).json({
        message: 'Session updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/sessions/:id
 */
sessionsRouter.delete(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.session.findUnique({
        where: { id },
        select: { id: true, batchId: true, title: true },
      });

      if (!existing) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, existing.batchId);

      await prisma.$transaction(async (tx) => {
        await tx.session.delete({
          where: { id },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.DELETE,
          entity: 'Session',
          entityId: id,
          before: existing,
          ip: req.ip,
        });
      });

      res.status(200).json({
        message: 'Session deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);
