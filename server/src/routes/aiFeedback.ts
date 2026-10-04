import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateFeedbackDraft } from '../services/aiFeedback.js';

export const aiFeedbackRouter = Router();
aiFeedbackRouter.use(requireAuth);
aiFeedbackRouter.use(requireRole(Role.TRAINER, Role.ADMIN));

/**
 * POST /api/v1/ai/feedback-draft
 * Generates an editable feedback draft for a trainee
 */
aiFeedbackRouter.post('/feedback-draft', async (req: Request, res: Response): Promise<void> => {
  const { traineeId } = req.body;
  if (!traineeId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'traineeId is required' } });
    return;
  }

  try {
    const result = await generateFeedbackDraft({
      traineeId,
      actorId: req.user!.id,
      ip: req.ip || req.socket.remoteAddress,
    });

    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'GENERATION_ERROR', message: err.message || 'Failed to generate feedback draft' } });
  }
});
