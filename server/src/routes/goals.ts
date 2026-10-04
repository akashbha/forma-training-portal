import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  CreateGoalBodySchema,
  UpdateGoalBodySchema,
  ListGoalsQuerySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { assertGoalTrainerScope, calculateGoalProgress } from '../services/goals.js';
import { writeAuditLog } from '../utils/audit.js';
import { Role, AuditAction, GoalScope } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export const goalsRouter = Router();

goalsRouter.use(requireAuth);

/**
 * GET /api/v1/goals
 */
goalsRouter.get(
  '/',
  validateRequest({ query: ListGoalsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scope, scopeId, metric, batchId, page, limit } = req.query as any;

      const where: any = {};
      if (scope) where.scope = scope;
      if (scopeId) where.scopeId = scopeId;
      if (metric) where.metric = metric;

      if (batchId) {
        where.scope = GoalScope.BATCH;
        where.scopeId = batchId;
      }

      // If user is a trainee, restrict visibility to goals relevant to them
      if (req.user!.role === Role.TRAINEE) {
        const traineeId = req.user!.traineeId;
        const traineeBatchId = req.user!.batchId;

        where.OR = [
          { scope: GoalScope.BATCH, scopeId: traineeBatchId || 'NONE' },
          { scope: GoalScope.TRAINEE, scopeId: traineeId || 'NONE' },
          { scope: GoalScope.TOPIC },
        ];
      }

      const total = await prisma.goal.count({ where });
      const skip = (page - 1) * limit;

      const goals = await prisma.goal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const goalsWithProgress = await Promise.all(
        goals.map(async (g) => {
          const progress = await calculateGoalProgress(g);
          return {
            ...g,
            scopeName: progress.scopeName,
            progress,
          };
        })
      );

      res.status(200).json({
        data: goalsWithProgress,
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

/**
 * GET /api/v1/goals/:id
 */
goalsRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const goal = await prisma.goal.findUnique({
        where: { id },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      const progress = await calculateGoalProgress(goal);

      res.status(200).json({
        data: {
          ...goal,
          scopeName: progress.scopeName,
          progress,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/goals
 * Trainers can only create goals for their assigned batches / trainees
 */
goalsRouter.post(
  '/',
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest({ body: CreateGoalBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scope, scopeId, metric, targetValue, dueDate } = req.body;

      // Validate trainer batch ownership
      await assertGoalTrainerScope(req.user!, scope, scopeId);

      const result = await prisma.$transaction(async (tx) => {
        const goal = await tx.goal.create({
          data: {
            scope,
            scopeId,
            metric,
            targetValue,
            dueDate: new Date(dueDate),
            createdBy: req.user!.id,
          },
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        });

        // Audit log in same transaction
        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.CREATE,
          entity: 'Goal',
          entityId: goal.id,
          after: goal,
          ip: req.ip,
        });

        return goal;
      });

      const progress = await calculateGoalProgress(result);

      res.status(201).json({
        message: 'Goal created successfully',
        data: {
          ...result,
          scopeName: progress.scopeName,
          progress,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/goals/:id
 */
goalsRouter.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest({ params: IdParamSchema, body: UpdateGoalBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.goal.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundError('Goal not found');
      }

      await assertGoalTrainerScope(req.user!, existing.scope, existing.scopeId);

      const updateData: any = {};
      if (req.body.targetValue !== undefined) updateData.targetValue = req.body.targetValue;
      if (req.body.dueDate !== undefined) updateData.dueDate = new Date(req.body.dueDate);

      const updated = await prisma.$transaction(async (tx) => {
        const goal = await tx.goal.update({
          where: { id },
          data: updateData,
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Goal',
          entityId: goal.id,
          before: existing,
          after: goal,
          ip: req.ip,
        });

        return goal;
      });

      const progress = await calculateGoalProgress(updated);

      res.status(200).json({
        message: 'Goal updated successfully',
        data: {
          ...updated,
          scopeName: progress.scopeName,
          progress,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/goals/:id
 */
goalsRouter.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.goal.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundError('Goal not found');
      }

      await assertGoalTrainerScope(req.user!, existing.scope, existing.scopeId);

      await prisma.$transaction(async (tx) => {
        await tx.goal.delete({ where: { id } });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.DELETE,
          entity: 'Goal',
          entityId: id,
          before: existing,
          ip: req.ip,
        });
      });

      res.status(200).json({ message: 'Goal deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);
