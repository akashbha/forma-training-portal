import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'TRAINER', 'TRAINEE']);

export const UserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: RoleEnum.default('TRAINEE'),
});

export const BatchSchema = z
  .object({
    name: z.string().min(1, 'Batch name is required').max(100),
    program: z.string().min(1, 'Program name is required').max(100),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    trainerId: z.string().min(1, 'Trainer ID is required'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const TraineeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  batchId: z.string().min(1, 'Batch ID is required'),
});

export const TopicSchema = z.object({
  name: z.string().min(1, 'Topic name is required').max(100),
});

export const SessionSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  topicId: z.string().min(1, 'Topic ID is required'),
  title: z.string().min(1, 'Session title is required').max(200),
  heldOn: z.coerce.date(),
  passMark: z.number().int().min(0).max(100).default(70),
});

export const ResultSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  traineeId: z.string().min(1, 'Trainee ID is required'),
  score: z.number().min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100'),
  errors: z.number().int('Errors must be an integer').min(0, 'Errors cannot be negative'),
  timeSeconds: z.number().int('Time must be an integer').positive('Time in seconds must be greater than 0'),
  notes: z.string().max(1000).optional().nullable(),
});
