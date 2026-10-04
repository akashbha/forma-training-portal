import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { Server } from 'http';

describe('Health Check Endpoint (GET /api/health)', () => {
  let server: Server;
  let port: number;

  it('responds with 200 and database connectivity status', async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.database).toBe('connected');
      expect(data.service).toBe('forma-api');
      expect(typeof data.timestamp).toBe('string');
      expect(typeof data.uptime).toBe('number');
    } finally {
      server.close();
    }
  });
});
