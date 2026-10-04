import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext, testPrisma } from './setup.js';
import { buildTrainerDigest, sendWeeklyDigests } from '../src/services/digest.js';

describe('Weekly Digest Engagement Feature', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('builds comprehensive digest content for a seeded trainer', async () => {
    const digest = await buildTrainerDigest(ctx.trainer1User.id);
    expect(digest).not.toBeNull();
    expect(digest!.trainerName).toBe(ctx.trainer1User.name);
    expect(digest!.batchNames).toContain(ctx.batch1.name);
    expect(Array.isArray(digest!.topImprovers)).toBe(true);
    expect(Array.isArray(digest!.atRiskTrainees)).toBe(true);
    expect(Array.isArray(digest!.sessionsPendingResults)).toBe(true);
  });

  it('respects emailDigestEnabled user opt-out setting', async () => {
    // Turn off digest for trainer 1
    await testPrisma.user.update({
      where: { id: ctx.trainer1User.id },
      data: { emailDigestEnabled: false },
    });

    const result = await sendWeeklyDigests();
    expect(result.skipped).toBeGreaterThanOrEqual(1);

    // Verify trainer 1 was skipped
    const trainer1Preview = result.previews.find((p) => p.trainerId === ctx.trainer1User.id);
    expect(trainer1Preview).toBeUndefined();
  });

  it('allows trainer to preview their weekly digest via API', async () => {
    const res = await request(app)
      .get('/api/v1/digest/preview')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainerId).toBe(ctx.trainer1User.id);
  });
});
