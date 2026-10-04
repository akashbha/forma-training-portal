import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PerformanceStatus } from '../types/api.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date consistently as '12 Oct 2026'
 */
export function formatDate(dateStringOrDate: string | Date | null | undefined): string {
  if (!dateStringOrDate) return '—';
  const date = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date with time: '12 Oct 2026, 14:30'
 */
export function formatDateTime(dateStringOrDate: string | Date | null | undefined): string {
  if (!dateStringOrDate) return '—';
  const date = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format score to one decimal place: e.g. 84.5%
 */
export function formatScore(score: number | null | undefined, includePercent: boolean = true): string {
  if (score === null || score === undefined || isNaN(score)) return '—';
  const formatted = Number(score).toFixed(1);
  return includePercent ? `${formatted}%` : formatted;
}

/**
 * Format duration in seconds: e.g. '14 min' or '1 hr 12 min'
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return '0 min';

  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
}

/**
 * Determine performance status from score
 */
export function getPerformanceStatus(score: number): PerformanceStatus {
  if (score >= 70) return 'ON_TRACK';
  if (score >= 50) return 'NEEDS_SUPPORT';
  return 'AT_RISK';
}

/**
 * Get display label for performance status
 */
export function getStatusLabel(status: PerformanceStatus | string): string {
  switch (status) {
    case 'ON_TRACK':
      return 'On Track';
    case 'NEEDS_SUPPORT':
      return 'Needs Support';
    case 'AT_RISK':
      return 'At Risk';
    default:
      return status || '—';
  }
}
