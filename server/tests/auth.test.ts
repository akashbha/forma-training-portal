import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedTestDatabase, testPrisma } from './setup.js';
import { resetAllRateLimits } from '../src/middleware/rateLimiter.js';

describe('Authentication & Session Management', () => {
  const app = createApp();

  beforeEach(async () => {
    resetAllRateLimits();
    await seedTestDatabase();
  });

  it('successfully logs in with valid credentials and sets secure httpOnly cookies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.test@forma.internal',
        password: 'testPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toMatchObject({
      email: 'admin.test@forma.internal',
      role: 'ADMIN',
    });

    // Check Set-Cookie headers
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeaderStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

    expect(cookieHeaderStr).toContain('accessToken=');
    expect(cookieHeaderStr).toContain('refreshToken=');
    expect(cookieHeaderStr).toContain('HttpOnly');
    expect(cookieHeaderStr).toContain('SameSite=Lax');
  });

  it('returns identical generic error for invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.test@forma.internal',
        password: 'wrongPassword999',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns identical generic error for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent.user@forma.internal',
        password: 'anyPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rate limits after 5 failed attempts with 429 Too Many Requests', async () => {
    const email = 'trainer1.test@forma.internal';

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongPassword' });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongPassword' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blockedRes.body.error.message).toContain('Too many login attempts');
  });

  it('refreshes access token successfully using stored refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice.test@forma.internal',
        password: 'testPassword123!',
      });

    const cookies = loginRes.headers['set-cookie'];

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
  });

  it('clears session cookies and revokes refresh token on logout', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.test@forma.internal',
        password: 'testPassword123!',
      });

    const cookies = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toContain('Logged out successfully');

    // Verify revoked in database
    const tokens = await testPrisma.refreshToken.findMany({
      where: { revoked: true },
    });
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('returns current profile via GET /api/auth/me when authenticated', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.test@forma.internal',
        password: 'testPassword123!',
      });

    const token = loginRes.body.accessToken;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('admin.test@forma.internal');
    expect(meRes.body.user.role).toBe('ADMIN');
  });
});
