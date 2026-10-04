import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { CreateTopicBodySchema } from '../schemas/api.js';

export const topicsRouter = Router();

topicsRouter.use(requireAuth);

/**
 * GET /api/v1/topics
 */
topicsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });

    res.status(200).json({
      data: topics.map((t) => ({
        id: t.id,
        name: t.name,
        sessionCount: t._count.sessions,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/topics
 */
topicsRouter.post(
  '/',
  requireRole('ADMIN', 'TRAINER'),
  validateRequest({ body: CreateTopicBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;

      const topic = await prisma.topic.create({
        data: {
          name: name.trim(),
        },
      });

      res.status(201).json({
        message: 'Topic created successfully',
        data: topic,
      });
    } catch (err) {
      next(err);
    }
  }
);
