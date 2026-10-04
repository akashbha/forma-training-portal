import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, assertBatchAccess, assertTraineeAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  CreateResultBodySchema,
  BulkResultsBodySchema,
  UpdateResultBodySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { AuditAction, Role } from '@prisma/client';

export const resultsRouter = Router();

resultsRouter.use(requireAuth);

/**
 * POST /api/v1/results (Create single result)
 */
resultsRouter.post(
  '/',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: CreateResultBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, traineeId, score, errors, timeSeconds, notes } = req.body;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, batchId: true },
      });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, session.batchId);
      await assertTraineeAccess(req.user!, traineeId);

      // Verify trainee belongs to the session's batch
      const trainee = await prisma.trainee.findUnique({
        where: { id: traineeId },
        select: { batchId: true },
      });
      if (!trainee || trainee.batchId !== session.batchId) {
        throw new BadRequestError('Trainee does not belong to the batch for this session');
      }

      const existing = await prisma.result.findUnique({
        where: {
          sessionId_traineeId: { sessionId, traineeId },
        },
      });
      if (existing) {
        throw new ConflictError('A result for this trainee and session already exists');
      }

      const result = await prisma.$transaction(async (tx) => {
        const created = await tx.result.create({
          data: {
            sessionId,
            traineeId,
            score,
            errors,
            timeSeconds,
            notes,
          },
          include: {
            session: { select: { id: true, title: true, passMark: true } },
            trainee: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.CREATE,
          entity: 'Result',
          entityId: created.id,
          after: created,
          ip: req.ip,
        });

        return created;
      });

      res.status(201).json({
        message: 'Result created successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/results/bulk (Bulk create results in a transaction)
 */
resultsRouter.post(
  '/bulk',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: BulkResultsBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, results } = req.body;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          batch: {
            include: {
              trainees: { select: { id: true } },
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, session.batchId);

      const validTraineeIds = new Set(session.batch.trainees.map((t) => t.id));

      for (const item of results) {
        if (!validTraineeIds.has(item.traineeId)) {
          throw new BadRequestError(
            `Trainee with ID '${item.traineeId}' is not enrolled in batch '${session.batch.name}'`
          );
        }
      }

      const submittedTraineeIds = new Set<string>();
      for (const item of results) {
        if (submittedTraineeIds.has(item.traineeId)) {
          throw new BadRequestError(`Duplicate traineeId '${item.traineeId}' in bulk submission`);
        }
        submittedTraineeIds.add(item.traineeId);
      }

      const createdRecords = await prisma.$transaction(async (tx) => {
        const records = [];
        for (const item of results) {
          const prev = await tx.result.findUnique({
            where: {
              sessionId_traineeId: {
                sessionId,
                traineeId: item.traineeId,
              },
            },
          });

          const rec = await tx.result.upsert({
            where: {
              sessionId_traineeId: {
                sessionId,
                traineeId: item.traineeId,
              },
            },
            update: {
              score: item.score,
              errors: item.errors,
              timeSeconds: item.timeSeconds,
              notes: item.notes,
            },
            create: {
              sessionId,
              traineeId: item.traineeId,
              score: item.score,
              errors: item.errors,
              timeSeconds: item.timeSeconds,
              notes: item.notes,
            },
            include: {
              trainee: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
          });

          await writeAuditLog(tx, {
            actorId: req.user!.id,
            action: prev ? AuditAction.UPDATE : AuditAction.CREATE,
            entity: 'Result',
            entityId: rec.id,
            before: prev,
            after: rec,
            ip: req.ip,
          });

          records.push(rec);
        }
        return records;
      });

      res.status(201).json({
        message: `Successfully processed ${createdRecords.length} results for session`,
        count: createdRecords.length,
        data: createdRecords,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/results/:id
 */
resultsRouter.patch(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema, body: UpdateResultBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const existing = await prisma.result.findUnique({
        where: { id },
        include: { session: true },
      });

      if (!existing) {
        throw new NotFoundError('Result not found');
      }

      await assertBatchAccess(req.user!, existing.session.batchId);

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.result.update({
          where: { id },
          data: req.body,
          include: {
            session: { select: { id: true, title: true } },
            trainee: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Result',
          entityId: result.id,
          before: existing,
          after: result,
          ip: req.ip,
        });

        return result;
      });

      res.status(200).json({
        message: 'Result updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/results/:id
 */
resultsRouter.delete(
  '/:id',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const existing = await prisma.result.findUnique({
        where: { id },
        include: { session: true },
      });

      if (!existing) {
        throw new NotFoundError('Result not found');
      }

      await assertBatchAccess(req.user!, existing.session.batchId);

      await prisma.$transaction(async (tx) => {
        await tx.result.delete({
          where: { id },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.DELETE,
          entity: 'Result',
          entityId: id,
          before: existing,
          ip: req.ip,
        });
      });

      res.status(200).json({
        message: 'Result deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);
