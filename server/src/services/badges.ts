import { prisma } from '../db/prisma.js';

export interface BadgeDefinition {
  type: string;
  name: string;
  description: string;
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  FIRST_SESSION: {
    type: 'FIRST_SESSION',
    name: 'First Milestone',
    description: 'Completed your very first evaluation session.',
  },
  PASS_STREAK_5: {
    type: 'PASS_STREAK_5',
    name: '5-Session Pass Streak',
    description: 'Scored at or above pass mark in 5 sessions.',
  },
  ALL_TOPICS: {
    type: 'ALL_TOPICS',
    name: 'Topic Master',
    description: 'Successfully completed evaluations across all curriculum topics.',
  },
  MOST_IMPROVED: {
    type: 'MOST_IMPROVED',
    name: 'High Climber',
    description: 'Achieved an improvement gain of +10 points or more.',
  },
  PERFECT_ATTENDANCE: {
    type: 'PERFECT_ATTENDANCE',
    name: 'Perfect Attendance',
    description: 'Maintained 100% on-time attendance across 5 or more sessions.',
  },
};

/**
 * Idempotently evaluates and awards badges for a trainee
 */
export async function evaluateAndAwardBadges(traineeId: string): Promise<string[]> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: {
      results: {
        include: {
          session: {
            include: { topic: true },
          },
        },
        orderBy: { session: { heldOn: 'asc' } },
      },
      attendances: true,
      badges: true,
    },
  });

  if (!trainee) return [];

  const existingBadgeTypes = new Set(trainee.badges.map((b) => b.badgeType));
  const newlyAwarded: string[] = [];

  const allTopicsCount = await prisma.topic.count();

  // 1. FIRST_SESSION
  if (!existingBadgeTypes.has('FIRST_SESSION') && trainee.results.length >= 1) {
    await prisma.traineeBadge.create({
      data: {
        traineeId: trainee.id,
        badgeType: 'FIRST_SESSION',
        name: BADGE_DEFINITIONS.FIRST_SESSION.name,
        description: BADGE_DEFINITIONS.FIRST_SESSION.description,
      },
    });
    newlyAwarded.push('FIRST_SESSION');
  }

  // 2. PASS_STREAK_5
  if (!existingBadgeTypes.has('PASS_STREAK_5')) {
    const passedCount = trainee.results.filter((r) => r.score >= r.session.passMark).length;
    if (passedCount >= 5) {
      await prisma.traineeBadge.create({
        data: {
          traineeId: trainee.id,
          badgeType: 'PASS_STREAK_5',
          name: BADGE_DEFINITIONS.PASS_STREAK_5.name,
          description: BADGE_DEFINITIONS.PASS_STREAK_5.description,
        },
      });
      newlyAwarded.push('PASS_STREAK_5');
    }
  }

  // 3. ALL_TOPICS
  if (!existingBadgeTypes.has('ALL_TOPICS') && allTopicsCount > 0) {
    const distinctTopicIds = new Set(trainee.results.map((r) => r.session.topicId));
    if (distinctTopicIds.size >= allTopicsCount) {
      await prisma.traineeBadge.create({
        data: {
          traineeId: trainee.id,
          badgeType: 'ALL_TOPICS',
          name: BADGE_DEFINITIONS.ALL_TOPICS.name,
          description: BADGE_DEFINITIONS.ALL_TOPICS.description,
        },
      });
      newlyAwarded.push('ALL_TOPICS');
    }
  }

  // 4. MOST_IMPROVED
  if (!existingBadgeTypes.has('MOST_IMPROVED') && trainee.results.length >= 3) {
    const scores = trainee.results.map((r) => r.score);
    const firstScore = scores[0];
    const latestScore = scores[scores.length - 1];
    if (latestScore - firstScore >= 10) {
      await prisma.traineeBadge.create({
        data: {
          traineeId: trainee.id,
          badgeType: 'MOST_IMPROVED',
          name: BADGE_DEFINITIONS.MOST_IMPROVED.name,
          description: BADGE_DEFINITIONS.MOST_IMPROVED.description,
        },
      });
      newlyAwarded.push('MOST_IMPROVED');
    }
  }

  // 5. PERFECT_ATTENDANCE
  if (!existingBadgeTypes.has('PERFECT_ATTENDANCE') && trainee.attendances.length >= 5) {
    const perfect = trainee.attendances.every((a) => a.status === 'PRESENT');
    if (perfect) {
      await prisma.traineeBadge.create({
        data: {
          traineeId: trainee.id,
          badgeType: 'PERFECT_ATTENDANCE',
          name: BADGE_DEFINITIONS.PERFECT_ATTENDANCE.name,
          description: BADGE_DEFINITIONS.PERFECT_ATTENDANCE.description,
        },
      });
      newlyAwarded.push('PERFECT_ATTENDANCE');
    }
  }

  return newlyAwarded;
}
