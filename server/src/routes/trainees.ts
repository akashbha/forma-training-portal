import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, assertTraineeAccess, assertBatchAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  ListTraineesQuerySchema,
  CreateTraineeBodySchema,
  UpdateTraineeBodySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { hashPassword } from '../utils/passwords.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { Role, AuditAction } from '@prisma/client';

export const traineesRouter = Router();

traineesRouter.use(requireAuth);

/**
 * GET /api/v1/trainees
 */
traineesRouter.get(
  '/',
  validateRequest({ query: ListTraineesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, batchId, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (req.user!.role === 'TRAINEE') {
        where.id = req.user!.traineeId;
      } else if (req.user!.role === 'TRAINER') {
        where.batch = {
          trainerId: req.user!.id,
        };
        if (batchId) {
          where.batchId = batchId;
        }
      } else if (batchId) {
        where.batchId = batchId;
      }

      if (search) {
        where.user = {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        };
      }

      let orderBy: any = {};
      if (sortBy === 'name' || sortBy === 'email') {
        orderBy = { user: { [sortBy]: sortOrder } };
      } else {
        orderBy = { [sortBy]: sortOrder };
      }

      const [total, trainees] = await Promise.all([
        prisma.trainee.count({ where }),
        prisma.trainee.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user: {
              select: { id: true, name: true, email: true, createdAt: true },
            },
            batch: {
              select: {
                id: true,
                name: true,
                program: true,
                trainer: { select: { id: true, name: true, email: true } },
              },
            },
            _count: {
              select: { results: true, attendances: true },
            },
          },
        }),
      ]);

      res.status(200).json({
        data: trainees.map((t) => ({
          id: t.id,
          userId: t.userId,
          name: t.user.name,
          email: t.user.email,
          batch: t.batch,
          resultsCount: t._count.results,
          attendancesCount: t._count.attendances,
          createdAt: t.createdAt,
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
 * GET /api/v1/trainees/:id
 */
traineesRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertTraineeAccess(req.user!, id);

      const trainee = await prisma.trainee.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
          batch: {
            include: {
              trainer: { select: { id: true, name: true, email: true } },
            },
          },
          attendances: {
            include: {
              session: { select: { id: true, title: true, heldOn: true } },
            },
            orderBy: { session: { heldOn: 'desc' } },
          },
          results: {
            include: {
              session: {
                include: { topic: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!trainee) {
        throw new NotFoundError('Trainee not found');
      }

      res.status(200).json({ data: trainee });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trainees
 */
traineesRouter.post(
  '/',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: CreateTraineeBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, batchId } = req.body;
      await assertBatchAccess(req.user!, batchId);

      const passwordHash = await hashPassword(password);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase().trim(),
            passwordHash,
            role: 'TRAINEE' as Role,
          },
        });

        const trainee = await tx.trainee.create({
          data: {
            userId: user.id,
            batchId,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            batch: true,
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.CREATE,
          entity: 'Trainee',
          entityId: trainee.id,
          after: {
            id: trainee.id,
            userId: trainee.userId,
            name: trainee.user.name,
            email: trainee.user.email,
            batchId: trainee.batchId,
          },
          ip: req.ip,
        });

        return trainee;
      });

      res.status(201).json({
        message: 'Trainee created successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/trainees/:id
 */
traineesRouter.patch(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema, body: UpdateTraineeBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertTraineeAccess(req.user!, id);

      const { name, email, batchId, password } = req.body;

      if (batchId) {
        await assertBatchAccess(req.user!, batchId);
      }

      const existing = await prisma.trainee.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!existing) {
        throw new NotFoundError('Trainee not found');
      }

      const updated = await prisma.$transaction(async (tx) => {
        const userUpdates: any = {};
        if (name) userUpdates.name = name;
        if (email) userUpdates.email = email.toLowerCase().trim();
        if (password) userUpdates.passwordHash = await hashPassword(password);

        if (Object.keys(userUpdates).length > 0) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userUpdates,
          });
        }

        const trainee = await tx.trainee.update({
          where: { id },
          data: batchId ? { batchId } : {},
          include: {
            user: { select: { id: true, name: true, email: true } },
            batch: true,
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Trainee',
          entityId: trainee.id,
          before: {
            id: existing.id,
            userId: existing.userId,
            name: existing.user.name,
            email: existing.user.email,
            batchId: existing.batchId,
          },
          after: {
            id: trainee.id,
            userId: trainee.userId,
            name: trainee.user.name,
            email: trainee.user.email,
            batchId: trainee.batchId,
          },
          ip: req.ip,
        });

        return trainee;
      });

      res.status(200).json({
        message: 'Trainee updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/trainees/:id
 */
traineesRouter.delete(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertTraineeAccess(req.user!, id);

      const trainee = await prisma.trainee.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!trainee) {
        throw new NotFoundError('Trainee not found');
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.delete({
          where: { id: trainee.userId },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.DELETE,
          entity: 'Trainee',
          entityId: id,
          before: {
            id: trainee.id,
            userId: trainee.userId,
            name: trainee.user.name,
            email: trainee.user.email,
            batchId: trainee.batchId,
          },
          ip: req.ip,
        });
      });

      res.status(200).json({
        message: 'Trainee deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);
