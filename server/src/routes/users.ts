import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

/**
 * PATCH /api/v1/users/profile
 * Updates user preferences (theme, emailDigestEnabled)
 */
usersRouter.patch('/profile', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { theme, emailDigestEnabled } = req.body;

  const dataToUpdate: any = {};
  if (typeof theme === 'string' && ['light', 'dark', 'system'].includes(theme)) {
    dataToUpdate.theme = theme;
  }
  if (typeof emailDigestEnabled === 'boolean') {
    dataToUpdate.emailDigestEnabled = emailDigestEnabled;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: dataToUpdate,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      theme: true,
      emailDigestEnabled: true,
    },
  });

  res.json({ data: updatedUser });
});
