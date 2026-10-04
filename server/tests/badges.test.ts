import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext, testPrisma } from './setup.js';
import { evaluateAndAwardBadges } from '../src/services/badges.js';

describe('Milestone Badges Feature', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('evaluates and awards badges idempotently without duplicate records', async () => {
    // Create a result for trainee 1 so they qualify for FIRST_SESSION
    await testPrisma.result.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 88,
        errors: 1,
        timeSeconds: 1200,
      },
    });

    // First evaluation
    const firstRun = await evaluateAndAwardBadges(ctx.trainee1Profile.id);
    expect(firstRun).toContain('FIRST_SESSION');

    const badgesCount1 = await testPrisma.traineeBadge.count({
      where: { traineeId: ctx.trainee1Profile.id },
    });
    expect(badgesCount1).toBeGreaterThanOrEqual(1);

    // Second evaluation should award 0 duplicates
    const secondRun = await evaluateAndAwardBadges(ctx.trainee1Profile.id);
    expect(secondRun.length).toBe(0);

    const badgesCount2 = await testPrisma.traineeBadge.count({
      where: { traineeId: ctx.trainee1Profile.id },
    });
    expect(badgesCount2).toBe(badgesCount1);
  });

  it('GET /api/v1/badges/trainee/:id returns earned badges and full badge catalog', async () => {
    const res = await request(app)
      .get(`/api/v1/badges/trainee/${ctx.trainee1Profile.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('earned');
    expect(res.body.data).toHaveProperty('catalog');
    expect(res.body.data.catalog.length).toBeGreaterThanOrEqual(5);
  });
});
