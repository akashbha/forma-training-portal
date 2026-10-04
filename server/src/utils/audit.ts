import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordHash',
  'token',
  'accesstoken',
  'accessToken',
  'refreshtoken',
  'refreshToken',
  'cookie_secret',
  'jwt_secret',
  'secret',
]);

/**
 * Recursively scrubs sensitive credentials from audit payloads
 */
export function sanitizeAuditPayload(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditPayload(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface AuditLogOptions {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string | null;
}

/**
 * Writes an immutable audit entry within the current transaction or standalone
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient | typeof prisma,
  options: AuditLogOptions
): Promise<void> {
  const sanitizedBefore = options.before !== undefined && options.before !== null
    ? JSON.stringify(sanitizeAuditPayload(options.before))
    : null;

  const sanitizedAfter = options.after !== undefined && options.after !== null
    ? JSON.stringify(sanitizeAuditPayload(options.after))
    : null;

  await tx.auditLog.create({
    data: {
      actorId: options.actorId ?? null,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId,
      before: sanitizedBefore,
      after: sanitizedAfter,
      ip: options.ip ?? null,
    },
  });
}
