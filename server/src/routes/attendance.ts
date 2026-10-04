import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, assertBatchAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  BulkAttendanceBodySchema,
  UpdateAttendanceBodySchema,
  ListAttendanceQuerySchema,
  IdParamSchema,
} from '../schemas/api.js';
import { writeAuditLog } from '../utils/audit.js';
import { Role, AuditAction } from '@prisma/client';
import { NotFoundError } from '../utils/errors.js';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

/**
 * GET /api/v1/attendance
 */
attendanceRouter.get(
  '/',
  validateRequest({ query: ListAttendanceQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, traineeId, status, page, limit } = req.query as any;

      const where: any = {};
      if (sessionId) where.sessionId = sessionId;
      if (traineeId) where.traineeId = traineeId;
      if (status) where.status = status;

      // Trainee role guard
      if (req.user!.role === Role.TRAINEE) {
        where.traineeId = req.user!.traineeId;
      }

      const total = await prisma.attendance.count({ where });
      const skip = (page - 1) * limit;

      const records = await prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trainee: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          session: {
            select: { id: true, title: true, heldOn: true, batchId: true },
          },
        },
      });

      res.status(200).json({
        data: records,
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
 * GET /api/v1/attendance/sessions/:sessionId
 * List all attendance for a specific session
 */
attendanceRouter.get(
  '/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { batch: true },
      });

      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, session.batchId);

      const records = await prisma.attendance.findMany({
        where: { sessionId },
        include: {
          trainee: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: {
          trainee: { user: { name: 'asc' } },
        },
      });

      res.status(200).json({ data: records });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/attendance/bulk
 * Upsert attendance for multiple trainees in a session
 */
attendanceRouter.post(
  '/bulk',
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest({ body: BulkAttendanceBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, attendances } = req.body;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { batch: true },
      });

      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await assertBatchAccess(req.user!, session.batchId);

      const savedRecords = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const item of attendances) {
          const existing = await tx.attendance.findUnique({
            where: {
              sessionId_traineeId: {
                sessionId,
                traineeId: item.traineeId,
              },
            },
          });

          let record;
          if (existing) {
            record = await tx.attendance.update({
              where: { id: existing.id },
              data: {
                status: item.status,
                notes: item.notes,
              },
            });
            await writeAuditLog(tx, {
              actorId: req.user!.id,
              action: AuditAction.UPDATE,
              entity: 'Attendance',
              entityId: record.id,
              before: existing,
              after: record,
              ip: req.ip,
            });
          } else {
            record = await tx.attendance.create({
              data: {
                sessionId,
                traineeId: item.traineeId,
                status: item.status,
                notes: item.notes,
              },
            });
            await writeAuditLog(tx, {
              actorId: req.user!.id,
              action: AuditAction.CREATE,
              entity: 'Attendance',
              entityId: record.id,
              after: record,
              ip: req.ip,
            });
          }
          results.push(record);
        }
        return results;
      });

      res.status(200).json({
        message: 'Attendance records saved successfully',
        data: savedRecords,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/attendance/:id
 */
attendanceRouter.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest({ params: IdParamSchema, body: UpdateAttendanceBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.attendance.findUnique({
        where: { id },
        include: { session: true },
      });

      if (!existing) {
        throw new NotFoundError('Attendance record not found');
      }

      await assertBatchAccess(req.user!, existing.session.batchId);

      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.attendance.update({
          where: { id },
          data: {
            status: req.body.status,
            notes: req.body.notes,
          },
        });

        await writeAuditLog(tx, {
          actorId: req.user!.id,
          action: AuditAction.UPDATE,
          entity: 'Attendance',
          entityId: record.id,
          before: existing,
          after: record,
          ip: req.ip,
        });

        return record;
      });

      res.status(200).json({
        message: 'Attendance updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);
