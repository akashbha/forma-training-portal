import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext } from './setup.js';

describe('Global Search (Command Palette) & RBAC', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('admin search returns resources across all cohorts', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=Batch')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.batches.length).toBeGreaterThanOrEqual(2);
  });

  it('trainer search is scoped strictly to assigned batches and trainees', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=Batch')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`);

    expect(res.status).toBe(200);
    // Trainer 1 owns Batch Alpha, not Batch Beta
    const batchNames = res.body.data.batches.map((b: any) => b.name);
    expect(batchNames).toContain(ctx.batch1.name);
    expect(batchNames).not.toContain(ctx.batch2.name);
  });

  it('trainee search is scoped only to their own batch / profile', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=a')
      .set('Authorization', `Bearer ${ctx.trainee1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainees.length).toBeLessThanOrEqual(1);
  });
});
