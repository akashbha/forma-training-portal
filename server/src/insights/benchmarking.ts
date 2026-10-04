export interface MetricBenchmark {
  value: number;
  batchAverage: number;
  batchMedian: number;
  percentile: number; // 0 - 100
}

export interface TraineeBenchmarkResult {
  score: MetricBenchmark;
  errors: MetricBenchmark;
  timeSeconds: MetricBenchmark;
}

export interface TraineeSafeBenchmark {
  traineeAverageScore: number;
  traineeAverageErrors: number;
  traineeAverageTime: number;
  batchAverageScore: number;
  batchAverageErrors: number;
  batchAverageTime: number;
  scoreImprovement: number;
  errorReduction: number;
  timeImprovement: number;
}

export interface EntityComparison<T> {
  entityA: T;
  entityB: T;
  metrics: {
    name: string;
    valueA: number;
    valueB: number;
    delta: number;
    favors: 'A' | 'B' | 'EQUAL';
  }[];
}

/**
 * Calculates percentile ranking (0 - 100)
 * Uses mid-point percentile rank formula: (countBelow + 0.5 * countTied) / N * 100
 */
export function calculatePercentile(
  targetValue: number,
  allValues: number[],
  higherIsBetter: boolean = true
): number {
  if (!allValues || allValues.length === 0) return 50;
  if (allValues.length === 1) return 100;

  let countBelow = 0;
  let countTied = 0;

  for (const v of allValues) {
    if (v === targetValue) {
      countTied += 1;
    } else if (higherIsBetter ? v < targetValue : v > targetValue) {
      countBelow += 1;
    }
  }

  const rank = ((countBelow + 0.5 * countTied) / allValues.length) * 100;
  return Math.round(Math.max(0, Math.min(100, rank)));
}

/**
 * Calculates median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Computes benchmark for a trainee against their batch cohort
 */
export function computeTraineeBenchmark(
  trainee: { score: number; errors: number; timeSeconds: number },
  batchPeers: { score: number; errors: number; timeSeconds: number }[]
): TraineeBenchmarkResult {
  const scores = batchPeers.map((p) => p.score);
  const errors = batchPeers.map((p) => p.errors);
  const times = batchPeers.map((p) => p.timeSeconds);

  const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const avgErrors = errors.reduce((a, b) => a + b, 0) / (errors.length || 1);
  const avgTime = times.reduce((a, b) => a + b, 0) / (times.length || 1);

  return {
    score: {
      value: Math.round(trainee.score * 10) / 10,
      batchAverage: Math.round(avgScore * 10) / 10,
      batchMedian: Math.round(calculateMedian(scores) * 10) / 10,
      percentile: calculatePercentile(trainee.score, scores, true),
    },
    errors: {
      value: Math.round(trainee.errors * 10) / 10,
      batchAverage: Math.round(avgErrors * 10) / 10,
      batchMedian: Math.round(calculateMedian(errors) * 10) / 10,
      percentile: calculatePercentile(trainee.errors, errors, false),
    },
    timeSeconds: {
      value: Math.round(trainee.timeSeconds),
      batchAverage: Math.round(avgTime),
      batchMedian: Math.round(calculateMedian(times)),
      percentile: calculatePercentile(trainee.timeSeconds, times, false),
    },
  };
}

/**
 * Trainee-safe self comparison: shows personal metrics vs batch baseline without names or competitor ranks
 */
export function computeTraineeSafeBenchmark(
  traineeHistory: { score: number; errors: number; timeSeconds: number }[],
  batchAverages: { score: number; errors: number; timeSeconds: number }
): TraineeSafeBenchmark {
  if (traineeHistory.length === 0) {
    return {
      traineeAverageScore: 0,
      traineeAverageErrors: 0,
      traineeAverageTime: 0,
      batchAverageScore: batchAverages.score,
      batchAverageErrors: batchAverages.errors,
      batchAverageTime: batchAverages.timeSeconds,
      scoreImprovement: 0,
      errorReduction: 0,
      timeImprovement: 0,
    };
  }

  const avgScore = traineeHistory.reduce((s, h) => s + h.score, 0) / traineeHistory.length;
  const avgErrors = traineeHistory.reduce((s, h) => s + h.errors, 0) / traineeHistory.length;
  const avgTime = traineeHistory.reduce((s, h) => s + h.timeSeconds, 0) / traineeHistory.length;

  const firstScore = traineeHistory[0].score;
  const lastScore = traineeHistory[traineeHistory.length - 1].score;
  const firstErrors = traineeHistory[0].errors;
  const lastErrors = traineeHistory[traineeHistory.length - 1].errors;
  const firstTime = traineeHistory[0].timeSeconds;
  const lastTime = traineeHistory[traineeHistory.length - 1].timeSeconds;

  return {
    traineeAverageScore: Math.round(avgScore * 10) / 10,
    traineeAverageErrors: Math.round(avgErrors * 10) / 10,
    traineeAverageTime: Math.round(avgTime),
    batchAverageScore: Math.round(batchAverages.score * 10) / 10,
    batchAverageErrors: Math.round(batchAverages.errors * 10) / 10,
    batchAverageTime: Math.round(batchAverages.timeSeconds),
    scoreImprovement: Math.round((lastScore - firstScore) * 10) / 10,
    errorReduction: Math.round((firstErrors - lastErrors) * 10) / 10,
    timeImprovement: Math.round(firstTime - lastTime),
  };
}
