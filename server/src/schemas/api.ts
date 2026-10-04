import { z } from 'zod';
import { PAGINATION } from '../constants/thresholds.js';

// Common pagination and ID schemas
export const IdParamSchema = z
  .object({
    id: z.string().min(1, 'ID parameter is required'),
  })
  .strict();

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

// Auth Schemas
export const LoginBodySchema = z
  .object({
    email: z.string().email('Valid email address is required'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const RefreshTokenBodySchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .strict();

// Batches Schemas
export const ListBatchesQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  trainerId: z.string().optional(),
}).strict();

export const CreateBatchBodySchema = z
  .object({
    name: z.string().min(1, 'Batch name is required').max(100),
    program: z.string().min(1, 'Program name is required').max(100),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    trainerId: z.string().min(1, 'Trainer ID is required'),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const UpdateBatchBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    program: z.string().min(1).max(100).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    trainerId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

// Trainees Schemas
export const ListTraineesQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  batchId: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

export const CreateTraineeBodySchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    batchId: z.string().min(1, 'Batch ID is required'),
  })
  .strict();

export const UpdateTraineeBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    batchId: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
  })
  .strict();

// Topics Schemas
export const CreateTopicBodySchema = z
  .object({
    name: z.string().min(1, 'Topic name is required').max(100),
  })
  .strict();

// Sessions Schemas
export const ListSessionsQuerySchema = PaginationQuerySchema.extend({
  batchId: z.string().optional(),
  topicId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict();

export const CreateSessionBodySchema = z
  .object({
    batchId: z.string().min(1, 'Batch ID is required'),
    topicId: z.string().min(1, 'Topic ID is required'),
    title: z.string().min(1, 'Session title is required').max(200),
    heldOn: z.coerce.date(),
    passMark: z.number().int().min(0).max(100).default(70),
  })
  .strict();

export const UpdateSessionBodySchema = z
  .object({
    batchId: z.string().min(1).optional(),
    topicId: z.string().min(1).optional(),
    title: z.string().min(1).max(200).optional(),
    heldOn: z.coerce.date().optional(),
    passMark: z.number().int().min(0).max(100).optional(),
  })
  .strict();

// Results Schemas
export const CreateResultBodySchema = z
  .object({
    sessionId: z.string().min(1, 'Session ID is required'),
    traineeId: z.string().min(1, 'Trainee ID is required'),
    score: z
      .number()
      .min(0, 'Score must be at least 0')
      .max(100, 'Score cannot exceed 100'),
    errors: z.number().int('Errors must be an integer').min(0, 'Errors cannot be negative'),
    timeSeconds: z
      .number()
      .int('Time must be an integer')
      .positive('Time must be greater than 0'),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict();

export const BulkResultItemSchema = z
  .object({
    traineeId: z.string().min(1, 'Trainee ID is required'),
    score: z
      .number()
      .min(0, 'Score must be at least 0')
      .max(100, 'Score cannot exceed 100'),
    errors: z.number().int('Errors must be an integer').min(0, 'Errors cannot be negative'),
    timeSeconds: z
      .number()
      .int('Time must be an integer')
      .positive('Time must be greater than 0'),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict();

export const BulkResultsBodySchema = z
  .object({
    sessionId: z.string().min(1, 'Session ID is required'),
    results: z.array(BulkResultItemSchema).min(1, 'At least one result record is required'),
  })
  .strict();

export const UpdateResultBodySchema = z
  .object({
    score: z.number().min(0).max(100).optional(),
    errors: z.number().int().min(0).optional(),
    timeSeconds: z.number().int().positive().optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict();

// Analytics Schemas
export const AnalyticsOverviewQuerySchema = z
  .object({
    batchId: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export const AnalyticsTrendQuerySchema = z
  .object({
    batchId: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    groupBy: z.enum(['week', 'session']).default('week'),
  })
  .strict();

export const AnalyticsHeatmapQuerySchema = z
  .object({
    batchId: z.string().min(1, 'batchId is required for heatmap analytics'),
  })
  .strict();

// ==========================================
// 1. GOALS SCHEMAS
// ==========================================
export const GoalScopeEnum = z.enum(['BATCH', 'TOPIC', 'TRAINEE']);
export const GoalMetricEnum = z.enum(['SCORE', 'ERRORS', 'TIME']);

export const CreateGoalBodySchema = z
  .object({
    scope: GoalScopeEnum,
    scopeId: z.string().min(1, 'Scope ID is required'),
    metric: GoalMetricEnum,
    targetValue: z.number().positive('Target value must be a positive number'),
    dueDate: z.coerce.date(),
  })
  .strict();

export const UpdateGoalBodySchema = z
  .object({
    targetValue: z.number().positive('Target value must be a positive number').optional(),
    dueDate: z.coerce.date().optional(),
  })
  .strict();

export const ListGoalsQuerySchema = PaginationQuerySchema.extend({
  scope: GoalScopeEnum.optional(),
  scopeId: z.string().optional(),
  metric: GoalMetricEnum.optional(),
  batchId: z.string().optional(),
}).strict();

// ==========================================
// 2. ATTENDANCE SCHEMAS
// ==========================================
export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const RecordAttendanceItemSchema = z
  .object({
    traineeId: z.string().min(1, 'Trainee ID is required'),
    status: AttendanceStatusEnum.default('PRESENT'),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

export const BulkAttendanceBodySchema = z
  .object({
    sessionId: z.string().min(1, 'Session ID is required'),
    attendances: z.array(RecordAttendanceItemSchema).min(1, 'At least one attendance record is required'),
  })
  .strict();

export const UpdateAttendanceBodySchema = z
  .object({
    status: AttendanceStatusEnum.optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

export const ListAttendanceQuerySchema = PaginationQuerySchema.extend({
  sessionId: z.string().optional(),
  traineeId: z.string().optional(),
  status: AttendanceStatusEnum.optional(),
}).strict();

// ==========================================
// 3. AUDIT LOG SCHEMAS
// ==========================================
export const AuditActionEnum = z.enum(['CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'LOGIN']);

export const ListAuditLogsQuerySchema = PaginationQuerySchema.extend({
  actorId: z.string().optional(),
  entity: z.string().optional(),
  action: AuditActionEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict();
