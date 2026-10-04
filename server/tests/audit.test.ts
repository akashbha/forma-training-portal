import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext, testPrisma } from './setup.js';

describe('Audit Logging System', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('creates an audit log entry for every write operation (results, sessions, batches, goals)', async () => {
    // 1. Create a session -> check audit log
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        batchId: ctx.batch1.id,
        topicId: ctx.topic1.id,
        title: 'Audit Test Session',
        heldOn: new Date().toISOString(),
        passMark: 75,
      });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.data.id;

    const sessionAudit = await testPrisma.auditLog.findFirst({
      where: { entity: 'Session', entityId: sessionId, action: 'CREATE' },
    });
    expect(sessionAudit).not.toBeNull();
    expect(sessionAudit?.actorId).toBe(ctx.trainer1User.id);

    // 2. Create a result -> check audit log
    const resultRes = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        sessionId,
        traineeId: ctx.trainee1Profile.id,
        score: 88,
        errors: 1,
        timeSeconds: 1950,
      });
    expect(resultRes.status).toBe(201);
    const resultId = resultRes.body.data.id;

    const resultAudit = await testPrisma.auditLog.findFirst({
      where: { entity: 'Result', entityId: resultId, action: 'CREATE' },
    });
    expect(resultAudit).not.toBeNull();
    expect(resultAudit?.actorId).toBe(ctx.trainer1User.id);

    // 3. Create a goal -> check audit log
    const goalRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`)
      .send({
        scope: 'BATCH',
        scopeId: ctx.batch1.id,
        metric: 'SCORE',
        targetValue: 90,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(goalRes.status).toBe(201);
    const goalId = goalRes.body.data.id;

    const goalAudit = await testPrisma.auditLog.findFirst({
      where: { entity: 'Goal', entityId: goalId, action: 'CREATE' },
    });
    expect(goalAudit).not.toBeNull();
    expect(goalAudit?.actorId).toBe(ctx.trainer1User.id);
  });

  it('trainer and trainee cannot read the audit logs (Admin only)', async () => {
    // Trainer attempt
    const trainerRes = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${ctx.trainer1Token}`);
    expect(trainerRes.status).toBe(403);
    expect(trainerRes.body.error.code).toBe('FORBIDDEN');

    // Trainee attempt
    const traineeRes = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${ctx.trainee1Token}`);
    expect(traineeRes.status).toBe(403);
    expect(traineeRes.body.error.code).toBe('FORBIDDEN');

    // Admin attempt succeeds
    const adminRes = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${ctx.adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body.data)).toBe(true);
  });

  it('never stores raw passwords or authentication tokens in before/after audit payloads', async () => {
    // Create a trainee with a password
    const createTraineeRes = await request(app)
      .post('/api/v1/trainees')
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({
        name: 'Secure Trainee',
        email: 'secure.trainee@forma.internal',
        password: 'SuperSecretPassword123!',
        batchId: ctx.batch1.id,
      });
    expect(createTraineeRes.status).toBe(201);

    const auditEntry = await testPrisma.auditLog.findFirst({
      where: { entity: 'Trainee', action: 'CREATE' },
    });

    expect(auditEntry).not.toBeNull();
    const rawAuditString = JSON.stringify(auditEntry);
    expect(rawAuditString).not.toContain('SuperSecretPassword123!');
    expect(rawAuditString).not.toContain('$2a$'); // bcrypt hash
    expect(rawAuditString).not.toContain('$2b$');
  });

  it('audit logs are append-only: no update or delete endpoints exist', async () => {
    const dummyAudit = await testPrisma.auditLog.create({
      data: {
        actorId: ctx.adminUser.id,
        action: 'CREATE',
        entity: 'Batch',
        entityId: ctx.batch1.id,
        after: JSON.stringify({ name: 'Batch Alpha' }),
      },
    });

    // Attempt PUT
    const putRes = await request(app)
      .put(`/api/v1/audit/${dummyAudit.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ action: 'DELETE' });
    expect(putRes.status).toBe(404);

    // Attempt PATCH
    const patchRes = await request(app)
      .patch(`/api/v1/audit/${dummyAudit.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ action: 'DELETE' });
    expect(patchRes.status).toBe(404);

    // Attempt DELETE
    const deleteRes = await request(app)
      .delete(`/api/v1/audit/${dummyAudit.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);
    expect(deleteRes.status).toBe(404);
  });
});
