import { INSIGHTS_CONFIG } from './config.js';

export interface ScoreProjection {
  projectedScore: number;
  confidenceRange: [number, number];
  currentAverage: number;
  slope: number;
  sampleCount: number;
  label: string;
}

/**
 * Calculates a linear trend score projection with confidence intervals.
 * Returns null if sample count is below minimum (5 sessions).
 */
export function calculateScoreProjection(
  scores: number[],
  targetSessionNumber: number = 10
): ScoreProjection | null {
  if (!scores || scores.length < INSIGHTS_CONFIG.MIN_SESSIONS_FOR_PROJECTION) {
    return null;
  }

  const n = scores.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = scores[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Project at target index (targetSessionNumber - 1)
  const targetX = Math.max(n, targetSessionNumber - 1);
  const rawProjected = intercept + slope * targetX;
  const projectedScore = Math.max(0, Math.min(100, Math.round(rawProjected * 10) / 10));

  // Compute standard error of the estimate
  let sumResidualSq = 0;
  for (let i = 0; i < n; i++) {
    const fitted = intercept + slope * i;
    sumResidualSq += Math.pow(scores[i] - fitted, 2);
  }
  const stdErr = Math.sqrt(sumResidualSq / Math.max(1, n - 2));
  const margin = Math.round(stdErr * 1.5 * 10) / 10;

  const minRange = Math.max(0, Math.round((projectedScore - margin) * 10) / 10);
  const maxRange = Math.min(100, Math.round((projectedScore + margin) * 10) / 10);

  const currentAverage = Math.round((sumY / n) * 10) / 10;

  return {
    projectedScore,
    confidenceRange: [minRange, maxRange],
    currentAverage,
    slope: Math.round(slope * 100) / 100,
    sampleCount: n,
    label: 'Estimate based on the current trend',
  };
}
