import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, testPrisma, TestContext } from './setup.js';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

describe('SQL-Computed Analytics Engine', () => {
  const app = createApp();
  let ctx: TestContext;
  let trainee3Profile: any;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
    const passwordHash = await bcrypt.hash('testPassword123!', 10);

    // Create 3rd trainee in batch 1 to test at-risk thresholds
    const trainee3User = await testPrisma.user.create({
      data: {
        name: 'Trainee Charlie',
        email: 'charlie.test@forma.internal',
        passwordHash,
        role: Role.TRAINEE,
      },
    });

    trainee3Profile = await testPrisma.trainee.create({
      data: {
        userId: trainee3User.id,
        batchId: ctx.batch1.id,
      },
    });

    // Populate controlled known dataset in Session 1:
    // Trainee 1 (Alice): score 90, errors 1, time 1000
    // Trainee 3 (Charlie): score 40, errors 6, time 3000 (At risk: < 50)
    // Trainee 2 (Bob in Batch 2): score 80, errors 2, time 2000
    await testPrisma.result.createMany({
      data: [
        {
          sessionId: ctx.session1.id,
          traineeId: ctx.trainee1Profile.id,
          score: 90,
          errors: 1,
          timeSeconds: 1000,
        },
        {
          sessionId: ctx.session1.id,
          traineeId: trainee3Profile.id,
          score: 40,
          errors: 6,
          timeSeconds: 3000,
        },
        {
          sessionId: ctx.session2.id,
          traineeId: ctx.trainee2Profile.id,
          score: 80,
          errors: 2,
          timeSeconds: 2000,
        },
      ],
    });
  });

  it('computes exact overview averages and at-risk count for batch 1', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/overview?batchId=${ctx.batch1.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    const { current } = res.body.data;

    // Expected for Batch 1 (scores 90 & 40):
    // avgScore = (90 + 40) / 2 = 65.0
    // errorRate = (1 + 6) / 2 = 3.5
    // avgTimeSeconds = (1000 + 3000) / 2 = 2000
    // traineesAtRisk = 1 (Charlie)
    expect(current.avgScore).toBe(65);
    expect(current.errorRate).toBe(3.5);
    expect(current.avgTimeSeconds).toBe(2000);
    expect(current.traineesAtRisk).toBe(1);
    expect(current.totalResults).toBe(2);
  });

  it('computes trend series with sample sizes', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/trend?batchId=${ctx.batch1.id}&groupBy=session`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.groupBy).toBe('session');
    expect(res.body.series.length).toBeGreaterThan(0);
    expect(res.body.series[0].sampleSize).toBe(2);
    expect(res.body.series[0].avgScore).toBe(65);
  });

  it('computes multi-batch comparison matrix', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/batches/compare')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);

    const b1 = res.body.data.find((b: any) => b.batchId === ctx.batch1.id);
    expect(b1).toBeDefined();
    expect(b1.avgScore).toBe(65);
    expect(b1.atRiskCount).toBe(1);
  });

  it('computes individual trainee analytics and status', async () => {
    // Check Alice (score 90 -> ON_TRACK)
    const aliceRes = await request(app)
      .get(`/api/v1/analytics/trainees/${ctx.trainee1Profile.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.data.summary.avgScore).toBe(90);
    expect(aliceRes.body.data.summary.status).toBe('ON_TRACK');

    // Check Charlie (score 40 -> AT_RISK)
    const charlieRes = await request(app)
      .get(`/api/v1/analytics/trainees/${trainee3Profile.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(charlieRes.status).toBe(200);
    expect(charlieRes.body.data.summary.avgScore).toBe(40);
    expect(charlieRes.body.data.summary.status).toBe('AT_RISK');
  });

  it('generates heatmap matrix for a batch', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/heatmap?batchId=${ctx.batch1.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.batch.id).toBe(ctx.batch1.id);
    expect(res.body.data.matrix.length).toBe(2);
  });
});
