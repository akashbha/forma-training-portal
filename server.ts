import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Server } from 'http';
import { createApp } from './server/src/app.ts';
import { config } from './server/src/config.ts';
import { prisma } from './server/src/db/prisma.ts';
import { logger } from './server/src/utils/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server: Server | null = null;

async function startServer() {
  const app = createApp();
  const PORT = config.PORT || 3000;

  if (process.env.NODE_ENV !== 'production') {
    // In dev mode, mount Vite middleware with HTML fallback
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production, serve static files from dist
    const express = (await import('express')).default;
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 forma server running on port ${PORT} [${config.NODE_ENV}]`);
    logger.info(`📡 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
  });
}

// Graceful Shutdown
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await prisma.$disconnect();
        logger.info('Database disconnected cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error(err, 'Error during database disconnect.');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Shutdown timeout reached. Forcing exit.');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer().catch((err) => {
  logger.fatal(err, 'Fatal error starting server');
  process.exit(1);
});
