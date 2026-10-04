import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext } from './setup.js';

describe('Role-Based Access Control (RBAC)', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  it('trainer cannot read another trainer’s batch', async () => {
    // Trainer 1 tries to access Batch Beta (owned by Trainer 2)
    const res = await request(app)
      .get(`/api/v1/batches/${ctx.batch2.id}`)
      .set('Authorization', `Bearer ${ctx.trainer1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('You do not have access to this batch');
  });

  it('trainee cannot read another trainee’s profile', async () => {
    // Trainee 1 (Alice) tries to read Trainee 2 (Bob)'s profile
    const res = await request(app)
      .get(`/api/v1/trainees/${ctx.trainee2Profile.id}`)
      .set('Authorization', `Bearer ${ctx.trainee1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Trainees can only access their own profile');
  });

  it('trainee cannot perform write operations (read-only)', async () => {
    // Trainee attempts to create a batch
    const createBatchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${ctx.trainee1Token}`)
      .send({
        name: 'Unauthorized Batch',
        program: 'Web',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        trainerId: ctx.trainer1User.id,
      });

    expect(createBatchRes.status).toBe(403);

    // Trainee attempts to create a session
    const createSessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${ctx.trainee1Token}`)
      .send({
        batchId: ctx.batch1.id,
        topicId: ctx.topic1.id,
        title: 'Hacked Session',
        heldOn: new Date().toISOString(),
        passMark: 70,
      });

    expect(createSessionRes.status).toBe(403);

    // Trainee attempts to delete a batch
    const deleteBatchRes = await request(app)
      .delete(`/api/v1/batches/${ctx.batch1.id}`)
      .set('Authorization', `Bearer ${ctx.trainee1Token}`);

    expect(deleteBatchRes.status).toBe(403);
  });

  it('admin can access any batch and trainee', async () => {
    const batchRes = await request(app)
      .get(`/api/v1/batches/${ctx.batch1.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(batchRes.status).toBe(200);

    const traineeRes = await request(app)
      .get(`/api/v1/trainees/${ctx.trainee1Profile.id}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(traineeRes.status).toBe(200);
  });
});
