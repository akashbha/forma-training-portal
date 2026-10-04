import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { httpLogger } from './utils/logger.js';
import { openApiSpec } from './docs/openapi.js';
import { errorHandler, NotFoundError } from './utils/errors.js';

// Route Imports
import { authRouter } from './routes/auth.js';
import { batchesRouter } from './routes/batches.js';
import { traineesRouter } from './routes/trainees.js';
import { topicsRouter } from './routes/topics.js';
import { sessionsRouter } from './routes/sessions.js';
import { resultsRouter } from './routes/results.js';
import { analyticsRouter } from './routes/analytics.js';
import { healthRouter } from './routes/health.js';
import { goalsRouter } from './routes/goals.js';
import { attendanceRouter } from './routes/attendance.js';
import { auditRouter } from './routes/audit.js';
import { insightsRouter } from './routes/insights.js';
import { digestRouter } from './routes/digest.js';
import { badgesRouter } from './routes/badges.js';
import { searchRouter } from './routes/search.js';
import { aiFeedbackRouter } from './routes/aiFeedback.js';
import { usersRouter } from './routes/users.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers with CSP
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite handles CSP in dev
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS configuration limited to configured web origin
  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : [config.CORS_ORIGIN, config.APP_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // 3. Body parsers with request size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Cookie parser with signing secret
  app.use(cookieParser(config.COOKIE_SECRET));

  // 5. Structured HTTP logging with request IDs
  app.use(httpLogger);

  // 6. OpenAPI / Swagger Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // 7. Base and Health Routes
  app.use('/api', healthRouter);

  // 8. Auth Routes
  app.use('/api/auth', authRouter);
  app.use('/api/v1/auth', authRouter);

  // 9. Versioned REST Resources (/api/v1)
  app.use('/api/v1/batches', batchesRouter);
  app.use('/api/v1/trainees', traineesRouter);
  app.use('/api/v1/topics', topicsRouter);
  app.use('/api/v1/sessions', sessionsRouter);
  app.use('/api/v1/results', resultsRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/goals', goalsRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/insights', insightsRouter);
  app.use('/api/v1/digest', digestRouter);
  app.use('/api/v1/badges', badgesRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/ai', aiFeedbackRouter);
  app.use('/api/v1/users', usersRouter);

  // 10. 404 handler for API routes
  app.use('/api/*', (_req: Request, _res: Response) => {
    throw new NotFoundError('API endpoint not found');
  });

  // 11. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
