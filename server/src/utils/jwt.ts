import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { Role } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
  traineeId?: string | null;
  batchId?: string | null;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'forma-auth',
    audience: 'forma-api',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET, {
    issuer: 'forma-auth',
    audience: 'forma-api',
  }) as TokenPayload;
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}
