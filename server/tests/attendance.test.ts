import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext, testPrisma } from './setup.js';

describe('Attendance System & Analytics', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('enforces attendance uniqueness on (sessionId, traineeId)', async () => {
    // 1. Direct record
    await testPrisma.attendance.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        status: 'PRESENT',
      },
    });

    // 2. Duplicate insertion directly in database fails on unique constraint
    await expect(
      testPrisma.attendance.create({
        data: {
          sessionId: ctx.session1.id,
          traineeId: ctx.trainee1Profile.id,
          status: 'ABSENT',
        },
      })
    ).rejects.toThrow();
  });

  it('supports bulk attendance recording and updates existing records gracefully', async () => {
    const bulkRes = await request(app)
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        attendances: [
          {
            traineeId: ctx.trainee1Profile.id,
            status: 'PRESENT',
            notes: 'On time, active participation',
          },
        ],
      });

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data.length).toBe(1);
    expect(bulkRes.body.data[0].status).toBe('PRESENT');

    // Update via bulk
    const updateBulkRes = await request(app)
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId: ctx.session1.id,
        attendances: [
          {
            traineeId: ctx.trainee1Profile.id,
            status: 'LATE',
            notes: 'Delayed due to transit',
          },
        ],
      });

    expect(updateBulkRes.status).toBe(200);
    expect(updateBulkRes.body.data[0].status).toBe('LATE');
  });

  it('calculates trainee attendance rate and flags when absence correlates with lower scores', async () => {
    // Seed 4 sessions for batch1
    const s2 = await testPrisma.session.create({
      data: {
        batchId: ctx.batch1.id,
        topicId: ctx.topic1.id,
        title: 'Session 2: Advanced APIs',
        heldOn: new Date(Date.now() - 5 * 86400000),
        passMark: 70,
      },
    });

    // Session 1: Present, Score 90
    await testPrisma.result.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        score: 90,
        errors: 1,
        timeSeconds: 1800,
      },
    });
    await testPrisma.attendance.create({
      data: {
        sessionId: ctx.session1.id,
        traineeId: ctx.trainee1Profile.id,
        status: 'PRESENT',
      },
    });

    // Session 2: Absent, Score 45
    await testPrisma.result.create({
      data: {
        sessionId: s2.id,
        traineeId: ctx.trainee1Profile.id,
        score: 45,
        errors: 8,
        timeSeconds: 2900,
      },
    });
    await testPrisma.attendance.create({
      data: {
        sessionId: s2.id,
        traineeId: ctx.trainee1Profile.id,
        status: 'ABSENT',
      },
    });

    // Fetch Trainee Analytics
    const res = await request(app)
      .get(`/api/v1/analytics/trainees/${ctx.trainee1Profile.id}`)
      .set('Authorization', `Bearer ${ctx.trainer1Token}`);

    expect(res.status).toBe(200);
    const summary = res.body.data.summary;
    expect(summary.attendance).toBeDefined();
    expect(summary.attendance.present).toBe(1);
    expect(summary.attendance.absent).toBe(1);
    expect(summary.attendance.rate).toBe(50);
    expect(summary.attendance.absenceScoreCorrelationFlag).toBe(true);
    expect(summary.attendance.correlationInsight).toContain('Absences correlate with performance drop');
  });
});
