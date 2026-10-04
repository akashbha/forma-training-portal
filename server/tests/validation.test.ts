import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext } from './setup.js';

describe('Validation & Constraints Enforcement', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('rejects result with score greater than 100 (score: 101)', async () => {
    const res = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 101,
        errors: 0,
        timeSeconds: 1200,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.score).toBeDefined();
  });

  it('rejects result with negative error count (errors: -1)', async () => {
    const res = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 85,
        errors: -1,
        timeSeconds: 1200,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.errors).toBeDefined();
  });

  it('rejects non-positive timeSeconds (0 or negative)', async () => {
    const res = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 85,
        errors: 2,
        timeSeconds: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.timeSeconds).toBeDefined();
  });

  it('rejects duplicate result for same (sessionId, traineeId) with 409 Conflict', async () => {
    // 1. Create first result
    const firstRes = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 85,
        errors: 1,
        timeSeconds: 1500,
      });

    expect(firstRes.status).toBe(201);

    // 2. Duplicate submission
    const duplicateRes = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 90,
        errors: 0,
        timeSeconds: 1400,
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('CONFLICT');
  });

  it('rejects unknown request fields due to strict schema parsing', async () => {
    const res = await request(app)
      .post('/api/v1/topics')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        name: 'Distributed Systems',
        unknownField: 'malicious payload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
