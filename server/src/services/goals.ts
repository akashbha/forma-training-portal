import { prisma } from '../db/prisma.js';
import { Goal, GoalScope, GoalMetric, Role } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export interface GoalWithProgress extends Goal {
  creator: {
    id: string;
    name: string;
    email: string;
  };
  scopeName: string;
  progress: {
    currentValue: number;
    targetValue: number;
    percentage: number;
    isAchieved: boolean;
    sampleCount: number;
  };
}

/**
 * Validates trainer ownership for goal scope
 */
export async function assertGoalTrainerScope(user: AuthenticatedUser, scope: GoalScope, scopeId: string): Promise<void> {
  if (user.role === Role.ADMIN) return;

  if (scope === GoalScope.BATCH) {
    const batch = await prisma.batch.findUnique({ where: { id: scopeId } });
    if (!batch || batch.trainerId !== user.id) {
      throw new ForbiddenError('You can only manage goals for your assigned batches');
    }
  } else if (scope === GoalScope.TRAINEE) {
    const trainee = await prisma.trainee.findUnique({
      where: { id: scopeId },
      include: { batch: true },
    });
    if (!trainee || trainee.batch.trainerId !== user.id) {
      throw new ForbiddenError('You can only manage goals for trainees in your assigned batches');
    }
  } else if (scope === GoalScope.TOPIC) {
    // Check if trainer has any batch or session on this topic
    const hasTopicSession = await prisma.session.findFirst({
      where: {
        topicId: scopeId,
        batch: { trainerId: user.id },
      },
    });
    if (!hasTopicSession) {
      throw new ForbiddenError('You can only manage topic goals for topics taught in your batches');
    }
  }
}

/**
 * Calculates current progress for a goal
 */
export async function calculateGoalProgress(goal: Goal): Promise<{
  currentValue: number;
  targetValue: number;
  percentage: number;
  isAchieved: boolean;
  sampleCount: number;
  scopeName: string;
}> {
  let sampleCount = 0;
  let sumScore = 0;
  let sumErrors = 0;
  let sumTime = 0;
  let scopeName = 'Unknown';

  if (goal.scope === GoalScope.BATCH) {
    const batch = await prisma.batch.findUnique({
      where: { id: goal.scopeId },
      include: {
        sessions: {
          include: {
            results: true,
          },
        },
      },
    });
    scopeName = batch ? batch.name : 'Unknown Batch';
    const allResults = batch?.sessions.flatMap((s) => s.results) || [];
    sampleCount = allResults.length;
    for (const r of allResults) {
      sumScore += r.score;
      sumErrors += r.errors;
      sumTime += r.timeSeconds;
    }
  } else if (goal.scope === GoalScope.TRAINEE) {
    const trainee = await prisma.trainee.findUnique({
      where: { id: goal.scopeId },
      include: {
        user: { select: { name: true } },
        results: true,
      },
    });
    scopeName = trainee?.user.name ? `Trainee: ${trainee.user.name}` : 'Unknown Trainee';
    const results = trainee?.results || [];
    sampleCount = results.length;
    for (const r of results) {
      sumScore += r.score;
      sumErrors += r.errors;
      sumTime += r.timeSeconds;
    }
  } else if (goal.scope === GoalScope.TOPIC) {
    const topic = await prisma.topic.findUnique({
      where: { id: goal.scopeId },
      include: {
        sessions: {
          include: {
            results: true,
          },
        },
      },
    });
    scopeName = topic ? `Topic: ${topic.name}` : 'Unknown Topic';
    const allResults = topic?.sessions.flatMap((s) => s.results) || [];
    sampleCount = allResults.length;
    for (const r of allResults) {
      sumScore += r.score;
      sumErrors += r.errors;
      sumTime += r.timeSeconds;
    }
  }

  let currentValue = 0;
  let percentage = 0;
  let isAchieved = false;

  if (sampleCount > 0) {
    if (goal.metric === GoalMetric.SCORE) {
      currentValue = Number((sumScore / sampleCount).toFixed(2));
      isAchieved = currentValue >= goal.targetValue;
      percentage = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));
    } else if (goal.metric === GoalMetric.ERRORS) {
      currentValue = Number((sumErrors / sampleCount).toFixed(2));
      isAchieved = currentValue <= goal.targetValue;
      if (currentValue <= goal.targetValue) {
        percentage = 100;
      } else {
        percentage = Math.max(0, Math.min(100, Math.round((goal.targetValue / currentValue) * 100)));
      }
    } else if (goal.metric === GoalMetric.TIME) {
      currentValue = Math.round(sumTime / sampleCount);
      isAchieved = currentValue <= goal.targetValue;
      if (currentValue <= goal.targetValue) {
        percentage = 100;
      } else {
        percentage = Math.max(0, Math.min(100, Math.round((goal.targetValue / currentValue) * 100)));
      }
    }
  }

  return {
    currentValue,
    targetValue: goal.targetValue,
    percentage,
    isAchieved,
    sampleCount,
    scopeName,
  };
}
