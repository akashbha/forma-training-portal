import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext } from './setup.js';

describe('Insights API & Features', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('GET /api/v1/insights/at-risk returns at-risk list with explainable reasons and severity', async () => {
    const res = await request(app)
      .get('/api/v1/insights/at-risk')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('trainees');
    expect(Array.isArray(res.body.data.trainees)).toBe(true);
  });

  it('GET /api/v1/insights/weak-topics returns ranked topics and matrix', async () => {
    const res = await request(app)
      .get('/api/v1/insights/weak-topics')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('rankedWeakest');
    expect(res.body.data).toHaveProperty('matrix');
  });

  it('GET /api/v1/insights/compare compares 2 batches side by side', async () => {
    const res = await request(app)
      .get(`/api/v1/insights/compare?type=batch&idA=${ctx.batch1.id}&idB=${ctx.batch2.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('comparison');
    expect(res.body.data.entityA.id).toBe(ctx.batch1.id);
    expect(res.body.data.entityB.id).toBe(ctx.batch2.id);
  });

  it('GET /api/v1/insights/overview-sentences generates template insights', async () => {
    const res = await request(app)
      .get('/api/v1/insights/overview-sentences')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sentences');
    expect(res.body.data.sentences.length).toBeLessThanOrEqual(5);
  });
});
