/**
 * Shared status thresholds and system constants
 */
export const PERFORMANCE_THRESHOLDS = {
  ON_TRACK_MIN: 70, // 70 and above: ON_TRACK
  NEEDS_SUPPORT_MIN: 50, // 50 to 69: NEEDS_SUPPORT
  // Below 50: AT_RISK
} as const;

export type PerformanceStatus = 'ON_TRACK' | 'NEEDS_SUPPORT' | 'AT_RISK';

export function calculatePerformanceStatus(score: number): PerformanceStatus {
  if (score >= PERFORMANCE_THRESHOLDS.ON_TRACK_MIN) {
    return 'ON_TRACK';
  }
  if (score >= PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT_MIN) {
    return 'NEEDS_SUPPORT';
  }
  return 'AT_RISK';
}

export const ROLES = {
  ADMIN: 'ADMIN',
  TRAINER: 'TRAINER',
  TRAINEE: 'TRAINEE',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const RATE_LIMITS = {
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
} as const;
