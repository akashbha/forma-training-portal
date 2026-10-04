import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { evaluateAndAwardBadges, BADGE_DEFINITIONS } from '../services/badges.js';

export const badgesRouter = Router();
badgesRouter.use(requireAuth);

/**
 * GET /api/v1/badges/trainee/:traineeId
 * Returns earned badges and available badge catalog for a trainee
 */
badgesRouter.get('/trainee/:traineeId', async (req: Request, res: Response): Promise<void> => {
  const { traineeId } = req.params;

  // Evaluate any newly qualified badges
  await evaluateAndAwardBadges(traineeId);

  const earned = await prisma.traineeBadge.findMany({
    where: { traineeId },
    orderBy: { awardedAt: 'asc' },
  });

  const earnedTypes = new Set(earned.map((b) => b.badgeType));

  const catalog = Object.values(BADGE_DEFINITIONS).map((def) => ({
    ...def,
    isEarned: earnedTypes.has(def.type),
    awardedAt: earned.find((b) => b.badgeType === def.type)?.awardedAt || null,
  }));

  res.json({
    data: {
      earned,
      catalog,
    },
  });
});

/**
 * POST /api/v1/badges/evaluate/:traineeId
 * Explicitly triggers badge evaluation
 */
badgesRouter.post('/evaluate/:traineeId', async (req: Request, res: Response): Promise<void> => {
  const { traineeId } = req.params;
  const newlyAwarded = await evaluateAndAwardBadges(traineeId);

  res.json({
    data: {
      newlyAwarded,
    },
  });
});
