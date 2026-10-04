import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, assertBatchAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  ListBatchesQuerySchema,
  CreateBatchBodySchema,
  UpdateBatchBodySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { AuditAction } from '@prisma/client';

export const batchesRouter = Router();

// Apply auth to all batch routes
batchesRouter.use(requireAuth);

/**
 * GET /api/v1/batches
 */
batchesRouter.get(
  '/',
  validateRequest({ query: ListBatchesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, trainerId, page = 1, limit = 20 } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {};

      // Role scoping
      if (req.user!.role === 'TRAINER') {
        where.trainerId = req.user!.id;
      } else if (req.user!.role === 'TRAINEE') {
        if (!req.user!.batchId) {
          return res.status(200).json({ data: [], total: 0, page, limit });
        }
        where.id = req.user!.batchId;
      } else if (trainerId) {
        where.trainerId = trainerId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { program: { contains: search } },
        ];
      }

      const [total, batches] = await Promise.all([
        prisma.batch.count({ where }),
        prisma.batch.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startDate: 'desc' },
          include: {
            trainer: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: {
                trainees: true,
                sessions: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        data: batches.map((b) => ({
          id: b.id,
          name: b.name,
          program: b.program,
          startDate: b.startDate,
          endDate: b.endDate,
          trainer: b.trainer,
          traineeCount: b._count.trainees,
          sessionCount: b._count.sessions,
          createdAt: b.createdAt,
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
 * GET /api/v1/batches/:id
 */
batchesRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertBatchAccess(req.user!, id);

      const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
          trainer: {
            select: { id: true, name: true, email: true },
          },
          trainees: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          sessions: {
            orderBy: { heldOn: 'asc' },
            include: {
              topic: true,
              _count: {
                select: { results: true, attendances: true },
              },
            },
          },
        },
      });

      if (!batch) {
        throw new NotFoundError('Batch not found');
      }

      res.status(200).json({ data: batch });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/batches
 */
batchesRouter.post(
  '/',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: CreateBatchBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, program, startDate, endDate, trainerId } = req.body;

      if (req.user!.role === 'TRAINER' && trainerId !== req.user!.id) {
        throw new ForbiddenError('Trainers can only create batches assigned to themselves');
      }

      const batch = await prisma.$transaction(async (tx) => {
        const created = await tx.batch.create({
          data: {
            name,
            program,
            startDate,
            endDate,
            trainerId,
          },
          include: {
            trainer: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.CREATE,
          entity: 'Batch',
          entityId: created.id,
          after: created,
          ip: req.ip,
        });

        return created;
      });

      res.status(201).json({
        message: 'Batch created successfully',
        data: batch,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/batches/:id
 */
batchesRouter.patch(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema, body: UpdateBatchBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertBatchAccess(req.user!, id);

      const existing = await prisma.batch.findUnique({
        where: { id },
        include: { trainer: { select: { id: true, name: true, email: true } } },
      });

      if (!existing) {
        throw new NotFoundError('Batch not found');
      }

      if (req.user!.role === 'TRAINER' && req.body.trainerId && req.body.trainerId !== req.user!.id) {
        throw new ForbiddenError('Trainers cannot reassign batches to other trainers');
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.batch.update({
          where: { id },
          data: req.body,
          include: {
            trainer: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Batch',
          entityId: result.id,
          before: existing,
          after: result,
          ip: req.ip,
        });

        return result;
      });

      res.status(200).json({
        message: 'Batch updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/batches/:id
 */
batchesRouter.delete(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertBatchAccess(req.user!, id);

      const existing = await prisma.batch.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('Batch not found');
      }

      await prisma.$transaction(async (tx) => {
        await tx.batch.delete({
          where: { id },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.DELETE,
          entity: 'Batch',
          entityId: id,
          before: existing,
          ip: req.ip,
        });
      });

      res.status(200).json({
        message: 'Batch deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);
