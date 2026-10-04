import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connectivity with a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'forma-api',
    });
  } catch (error) {
    console.error('Database connectivity error during health check:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Database query failed',
      timestamp: new Date().toISOString(),
      service: 'forma-api',
    });
  }
});
