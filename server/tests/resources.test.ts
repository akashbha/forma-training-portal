import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, TestContext } from './setup.js';

describe('Resource CRUD Operations (/api/v1)', () => {
  const app = createApp();
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await seedTestDatabase();
  });

  describe('Batches Endpoints', () => {
    it('lists batches with trainer scoping', async () => {
      const res = await request(app)
        .get('/api/v1/batches')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(ctx.batch1.id);
    });

    it('admin creates and updates a batch', async () => {
      const now = new Date();
      const createRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: 'Batch Gamma',
          program: 'DevOps Engineering',
          trainerId: ctx.trainer1User.id,
          startDate: new Date(now.getTime() - 100000).toISOString(),
          endDate: new Date(now.getTime() + 100000).toISOString(),
        });

      expect(createRes.status).toBe(201);
      const batchId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: 'Batch Gamma (Updated)' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Batch Gamma (Updated)');
    });
  });

  describe('Topics Endpoints', () => {
    it('creates and lists topics', async () => {
      const createRes = await request(app)
        .post('/api/v1/topics')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({ name: 'Kubernetes Fundamentals' });

      expect(createRes.status).toBe(201);

      const listRes = await request(app)
        .get('/api/v1/topics')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t: any) => t.name === 'Kubernetes Fundamentals')).toBe(true);
    });
  });

  describe('Sessions Endpoints', () => {
    it('creates, gets, updates, and deletes a session', async () => {
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({
          batchId: ctx.batch1.id,
          topicId: ctx.topic1.id,
          title: 'Session 3: Advanced TypeScript',
          heldOn: new Date().toISOString(),
          passMark: 75,
        });

      expect(createRes.status).toBe(201);
      const sessionId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${ctx.trainer1Token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Session 3: Advanced TypeScript');

      const updateRes = await request(app)
        .patch(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({ passMark: 80 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.passMark).toBe(80);

      const deleteRes = await request(app)
        .delete(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${ctx.trainer1Token}`);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('Trainees Endpoints', () => {
    it('creates, lists, and updates a trainee', async () => {
      const createRes = await request(app)
        .post('/api/v1/trainees')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({
          name: 'David Miller',
          email: 'david.miller@forma.internal',
          password: 'securePassword123!',
          batchId: ctx.batch1.id,
        });

      expect(createRes.status).toBe(201);
      const traineeId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/v1/trainees')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t: any) => t.email === 'david.miller@forma.internal')).toBe(true);

      const updateRes = await request(app)
        .patch(`/api/v1/trainees/${traineeId}`)
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({ name: 'David Miller Jr.' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.user.name).toBe('David Miller Jr.');
    });
  });

  describe('Bulk Results Creation (Transaction)', () => {
    it('creates results in bulk atomically', async () => {
      const bulkRes = await request(app)
        .post('/api/v1/results/bulk')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({
          sessionId: ctx.session1.id,
          results: [
            {
              traineeId: ctx.trainee1Profile.id,
              score: 92,
              errors: 1,
              timeSeconds: 1600,
              notes: 'Excellent performance in transaction',
            },
          ],
        });

      expect(bulkRes.status).toBe(201);
      expect(bulkRes.body.count).toBe(1);
      expect(bulkRes.body.data[0].score).toBe(92);
    });

    it('rejects bulk creation if any trainee is from a different batch', async () => {
      const bulkRes = await request(app)
        .post('/api/v1/results/bulk')
        .set('Authorization', `Bearer ${ctx.trainer1Token}`)
        .send({
          sessionId: ctx.session1.id,
          results: [
            {
              traineeId: ctx.trainee2Profile.id, // Enrolled in Batch 2, not Batch 1
              score: 80,
              errors: 2,
              timeSeconds: 1500,
            },
          ],
        });

      expect(bulkRes.status).toBe(400);
      expect(bulkRes.body.error.message).toContain('not enrolled in batch');
    });
  });
});
