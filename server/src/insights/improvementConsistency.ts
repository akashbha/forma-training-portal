import { INSIGHTS_CONFIG } from './config.js';

export interface ImprovementMetrics {
  slope: number; // Score change per session
  totalDelta: number; // Difference between first 3 and latest 3 sessions
  trendDirection: 'IMPROVING' | 'STEADY' | 'DECLINING';
  sampleCount: number;
}

export interface ConsistencyMetrics {
  consistencyScore: number; // 0 - 100 (100 = perfectly consistent)
  standardDeviation: number;
  mean: number;
}

/**
 * Calculates slope of score over session chronological progression using Ordinary Least Squares
 * and difference between first 3 sessions and latest 3 sessions.
 */
export function calculateImprovement(scores: number[]): ImprovementMetrics {
  if (!scores || scores.length === 0) {
    return {
      slope: 0,
      totalDelta: 0,
      trendDirection: 'STEADY',
      sampleCount: 0,
    };
  }

  const n = scores.length;
  if (n === 1) {
    return {
      slope: 0,
      totalDelta: 0,
      trendDirection: 'STEADY',
      sampleCount: 1,
    };
  }

  // Linear regression: x = 0 ... n-1, y = score
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
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;

  // Change from first 3 to latest 3
  let totalDelta = 0;
  if (n >= 3) {
    const first3 = scores.slice(0, 3);
    const last3 = scores.slice(-3);
    const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length;
    const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
    totalDelta = avgLast - avgFirst;
  } else {
    totalDelta = scores[scores.length - 1] - scores[0];
  }

  let trendDirection: 'IMPROVING' | 'STEADY' | 'DECLINING' = 'STEADY';
  if (slope > 0.5 || totalDelta > 2.0) {
    trendDirection = 'IMPROVING';
  } else if (slope < -0.5 || totalDelta < -2.0) {
    trendDirection = 'DECLINING';
  }

  return {
    slope: Math.round(slope * 100) / 100,
    totalDelta: Math.round(totalDelta * 10) / 10,
    trendDirection,
    sampleCount: n,
  };
}

/**
 * Calculates consistency index: 100 minus the scaled standard deviation of scores
 */
export function calculateConsistency(scores: number[]): ConsistencyMetrics {
  if (!scores || scores.length === 0) {
    return {
      consistencyScore: 100,
      standardDeviation: 0,
      mean: 0,
    };
  }

  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;

  if (n === 1) {
    return {
      consistencyScore: 100,
      standardDeviation: 0,
      mean: Math.round(mean * 10) / 10,
    };
  }

  const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Scaled against MAX_SCORE_STD_DEV
  const penalty = (stdDev / INSIGHTS_CONFIG.MAX_SCORE_STD_DEV) * 100;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return {
    consistencyScore,
    standardDeviation: Math.round(stdDev * 10) / 10,
    mean: Math.round(mean * 10) / 10,
  };
}
