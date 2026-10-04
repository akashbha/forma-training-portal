import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, assertBatchAccess, assertTraineeAccess } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  AnalyticsOverviewQuerySchema,
  AnalyticsTrendQuerySchema,
  AnalyticsHeatmapQuerySchema,
  IdParamSchema,
} from '../schemas/api.js';
import {
  getOverviewAnalytics,
  getTrendAnalytics,
  getBatchesComparison,
  getTraineeAnalytics,
  getHeatmapAnalytics,
} from '../services/analytics.js';
import { ForbiddenError } from '../utils/errors.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

/**
 * GET /api/v1/analytics/overview?batchId&from&to
 */
analyticsRouter.get(
  '/overview',
  validateRequest({ query: AnalyticsOverviewQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId, from, to } = req.query as any;

      let trainerBatchIds: string[] | undefined = undefined;
      if (batchId) {
        await assertBatchAccess(req.user!, batchId);
      } else if (req.user!.role === 'TRAINER') {
        const myBatches = await prisma.batch.findMany({
          where: { trainerId: req.user!.id },
          select: { id: true },
        });
        trainerBatchIds = myBatches.map((b) => b.id);
      }

      const effectiveBatchId = req.user!.role === 'TRAINEE' ? req.user!.batchId || undefined : batchId;

      const overview = await getOverviewAnalytics({
        batchId: effectiveBatchId,
        batchIds: trainerBatchIds,
        from,
        to,
      });

      res.status(200).json({ data: overview });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/analytics/trend?batchId&from&to&groupBy=week
 */
analyticsRouter.get(
  '/trend',
  validateRequest({ query: AnalyticsTrendQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId, from, to, groupBy = 'week' } = req.query as any;

      let trainerBatchIds: string[] | undefined = undefined;
      if (batchId) {
        await assertBatchAccess(req.user!, batchId);
      } else if (req.user!.role === 'TRAINER') {
        const myBatches = await prisma.batch.findMany({
          where: { trainerId: req.user!.id },
          select: { id: true },
        });
        trainerBatchIds = myBatches.map((b) => b.id);
      }

      const effectiveBatchId = req.user!.role === 'TRAINEE' ? req.user!.batchId || undefined : batchId;

      const series = await getTrendAnalytics({
        batchId: effectiveBatchId,
        batchIds: trainerBatchIds,
        from,
        to,
        groupBy,
      });

      res.status(200).json({
        groupBy,
        series,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/analytics/batches/compare
 */
analyticsRouter.get('/batches/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === 'TRAINEE') {
      res.status(200).json({ data: [] });
      return;
    }

    const comparison = await getBatchesComparison();

    // If trainer, filter to only their batches
    const data =
      req.user!.role === 'TRAINER'
        ? comparison.filter((b) => b.trainer.email === req.user!.email)
        : comparison;

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/trainees/:id
 */
analyticsRouter.get(
  '/trainees/:id',
  validateRequest({ params: IdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await assertTraineeAccess(req.user!, id);

      const analytics = await getTraineeAnalytics(id);
      res.status(200).json({ data: analytics });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/analytics/heatmap?batchId
 */
analyticsRouter.get(
  '/heatmap',
  validateRequest({ query: AnalyticsHeatmapQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId } = req.query as any;
      await assertBatchAccess(req.user!, batchId);

      const heatmap = await getHeatmapAnalytics(batchId);
      res.status(200).json({ data: heatmap });
    } catch (err) {
      next(err);
    }
  }
);
