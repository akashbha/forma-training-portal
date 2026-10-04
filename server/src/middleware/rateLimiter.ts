import { Request, Response, NextFunction } from 'express';
import { RATE_LIMITS } from '../constants/thresholds.js';
import { TooManyRequestsError } from '../utils/errors.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory tracker for login rate limiting by IP + email key
const loginAttemptsMap = new Map<string, RateLimitRecord>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
}

export function loginRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const email = (req.body?.email || '').toString().toLowerCase().trim();
  const key = `${ip}:${email}`;
  const now = Date.now();

  const record = loginAttemptsMap.get(key);

  if (record) {
    if (now > record.resetTime) {
      // Window expired, reset
      loginAttemptsMap.set(key, { count: 1, resetTime: now + RATE_LIMITS.LOGIN_WINDOW_MS });
      return next();
    }

    if (record.count >= RATE_LIMITS.LOGIN_MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new TooManyRequestsError(
        `Too many login attempts. Please try again after ${retryAfterSeconds} seconds.`
      );
    }
  }

  next();
}

export function recordLoginFailure(req: Request): void {
  const ip = getClientIp(req);
  const email = (req.body?.email || '').toString().toLowerCase().trim();
  const key = `${ip}:${email}`;
  const now = Date.now();

  const record = loginAttemptsMap.get(key);
  if (!record || now > record.resetTime) {
    loginAttemptsMap.set(key, { count: 1, resetTime: now + RATE_LIMITS.LOGIN_WINDOW_MS });
  } else {
    record.count += 1;
  }
}

export function clearLoginAttempts(req: Request): void {
  const ip = getClientIp(req);
  const email = (req.body?.email || '').toString().toLowerCase().trim();
  const key = `${ip}:${email}`;
  loginAttemptsMap.delete(key);
}

export function resetAllRateLimits(): void {
  loginAttemptsMap.clear();
}
