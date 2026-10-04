import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

export const searchRouter = Router();
searchRouter.use(requireAuth);

/**
 * GET /api/v1/search?q=query
 * Scoped search across Batches, Trainees, and Sessions
 */
searchRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const q = ((req.query.q as string) || '').trim();

  if (!q) {
    res.json({ data: { batches: [], trainees: [], sessions: [] } });
    return;
  }

  // Role Scoping
  if (user.role === 'TRAINEE') {
    const traineeProfile = await prisma.trainee.findUnique({
      where: { userId: user.id },
      include: { batch: true },
    });

    if (!traineeProfile) {
      res.json({ data: { batches: [], trainees: [], sessions: [] } });
      return;
    }

    const sessions = await prisma.session.findMany({
      where: {
        batchId: traineeProfile.batchId,
        title: { contains: q },
      },
      take: 5,
    });

    res.json({
      data: {
        batches: traineeProfile.batch.name.toLowerCase().includes(q.toLowerCase())
          ? [{ id: traineeProfile.batch.id, name: traineeProfile.batch.name, program: traineeProfile.batch.program, type: 'batch' }]
          : [],
        trainees: [{ id: traineeProfile.id, name: user.name, email: user.email, type: 'trainee' }],
        sessions: sessions.map((s) => ({ id: s.id, title: s.title, heldOn: s.heldOn, type: 'session' })),
      },
    });
    return;
  }

  // Trainer Scoping
  let batchFilter: any = {};
  if (user.role === 'TRAINER') {
    batchFilter.trainerId = user.id;
  }

  const [batches, trainees, sessions] = await Promise.all([
    prisma.batch.findMany({
      where: {
        ...batchFilter,
        OR: [
          { name: { contains: q } },
          { program: { contains: q } },
        ],
      },
      take: 5,
    }),
    prisma.trainee.findMany({
      where: {
        batch: batchFilter,
        user: {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        batch: { select: { name: true } },
      },
      take: 5,
    }),
    prisma.session.findMany({
      where: {
        batch: batchFilter,
        title: { contains: q },
      },
      include: {
        batch: { select: { name: true } },
      },
      take: 5,
    }),
  ]);

  res.json({
    data: {
      batches: batches.map((b) => ({
        id: b.id,
        name: b.name,
        subtitle: b.program,
        url: `/batches/${b.id}`,
        type: 'batch',
      })),
      trainees: trainees.map((t) => ({
        id: t.id,
        name: t.user.name,
        subtitle: `${t.batch.name} • ${t.user.email}`,
        url: `/trainees/${t.id}`,
        type: 'trainee',
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.title,
        subtitle: `${s.batch.name} • ${new Date(s.heldOn).toLocaleDateString()}`,
        url: `/sessions/${s.id}`,
        type: 'session',
      })),
    },
  });
});
