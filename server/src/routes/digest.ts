import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildTrainerDigest, sendWeeklyDigests } from '../services/digest.js';

export const digestRouter = Router();

/**
 * GET /api/v1/digest/preview
 * Previews the weekly digest for the current trainer (or specified trainer for admin)
 */
digestRouter.get('/preview', requireAuth, requireRole(Role.TRAINER, Role.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const targetTrainerId = user.role === 'ADMIN' && req.query.trainerId ? (req.query.trainerId as string) : user.id;

  const digest = await buildTrainerDigest(targetTrainerId);
  if (!digest) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No batches or sessions found for this trainer' } });
    return;
  }

  res.json({ data: digest });
});

/**
 * POST /api/v1/digest/send
 * Scheduled trigger or admin manual dispatch
 */
digestRouter.post('/send', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only admins can trigger mass digest dispatches' } });
    return;
  }

  const result = await sendWeeklyDigests();
  res.json({
    data: {
      message: 'Weekly digests processed successfully',
      sent: result.sent,
      skipped: result.skipped,
      previewsCount: result.previews.length,
    },
  });
});
