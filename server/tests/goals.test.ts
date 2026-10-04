import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext, testPrisma } from './setup.js';

describe('Goals Foundation & Progress Tracking', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('trainer can only create and manage goals for their assigned batches', async () => {
    // Trainer 1 tries to create a goal for Batch Beta (owned by Trainer 2) -> Forbidden 403
    const forbiddenRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        scope: 'BATCH',
        scopeId: ctx.batch2.id,
        metric: 'SCORE',
        targetValue: 85,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    // Trainer 1 creates a goal for Batch Alpha (owned by Trainer 1) -> Success 201
    const successRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        scope: 'BATCH',
        scopeId: ctx.batch1.id,
        metric: 'SCORE',
        targetValue: 85,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(successRes.status).toBe(201);
    expect(successRes.body.data.scope).toBe('BATCH');
    expect(successRes.body.data.targetValue).toBe(85);
  });

  it('calculates goal progress accurately on a known dataset', async () => {
    // Known dataset:
    // Create 2 results for Batch Alpha with known scores: 80 and 90 -> average = 85.0
    await testPrisma.result.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 80,
        errors: 2,
        timeSeconds: 2000,
      },
    });

    // Create second trainee in Batch Alpha
    const tUser = await testPrisma.user.create({
      data: {
        name: 'Trainee Charlie',
        email: 'charlie.test@forma.internal',
        passwordHash: 'hash',
        role: 'TRAINEE',
      },
    });
    const tProfile = await testPrisma.trainee.create({
      data: {
        userId: tUser.id,
        batchId: ctx.batch1.id,
      },
    });

    await testPrisma.result.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: tProfile.id,
        score: 90,
        errors: 4,
        timeSeconds: 2200,
      },
    });

    // Goal 1: Score target 85.0 (Target = 85, Current = 85.0 -> 100% achieved)
    const goalRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({
        scope: 'BATCH',
        scopeId: ctx.batch1.id,
        metric: 'SCORE',
        targetValue: 85,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(goalRes.status).toBe(201);
    expect(goalRes.body.data.progress.currentValue).toBe(85);
    expect(goalRes.body.data.progress.targetValue).toBe(85);
    expect(goalRes.body.data.progress.percentage).toBe(100);
    expect(goalRes.body.data.progress.isAchieved).toBe(true);
    expect(goalRes.body.data.progress.sampleCount).toBe(2);

    // Goal 2: Error cap 2.0 (Target = 2.0, Current = 3.0 avg errors -> not achieved)
    const errorGoalRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({
        scope: 'BATCH',
        scopeId: ctx.batch1.id,
        metric: 'ERRORS',
        targetValue: 2,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(errorGoalRes.status).toBe(201);
    expect(errorGoalRes.body.data.progress.currentValue).toBe(3);
    expect(errorGoalRes.body.data.progress.isAchieved).toBe(false);
  });
});
