import { INSIGHTS_CONFIG } from './config.js';

export interface InsightSentence {
  id: string;
  category: 'IMPROVEMENT' | 'WEAK_TOPIC' | 'AT_RISK' | 'CONSISTENCY' | 'BENCHMARK';
  text: string;
  linkUrl: string;
  linkText: string;
  priority: number; // 1 = highest
}

export interface BatchInsightInput {
  batchId: string;
  batchName: string;
  sampleCount: number;
  deltaPoints?: number;
  weakestTopicName?: string;
  weakestTopicScore?: number;
  averageScore?: number;
  consistencyScore?: number;
  atRiskCount?: number;
}

export interface TraineeInsightInput {
  traineeId: string;
  traineeName: string;
  batchName: string;
  sampleCount: number;
  slope?: number;
  deltaPoints?: number;
  passStreak?: number;
  attendanceRate?: number;
  isAtRisk?: boolean;
  atRiskReason?: string;
}

/**
 * Generates verified template-based insight sentences from computed metrics.
 * Skips items where sampleCount < 5.
 * Limits output to max 5 sentences sorted by relevance/priority.
 */
export function generateInsightSentences(
  batches: BatchInsightInput[],
  trainees: TraineeInsightInput[]
): InsightSentence[] {
  const list: InsightSentence[] = [];

  // 1. Batch Improvement / Weak Topic combination sentence
  for (const b of batches) {
    if (b.sampleCount < INSIGHTS_CONFIG.MIN_SAMPLE_FOR_INSIGHT_SENTENCE) continue;

    if (b.deltaPoints !== undefined && b.weakestTopicName && b.weakestTopicScore !== undefined) {
      const verb = b.deltaPoints >= 0 ? `improved ${b.deltaPoints > 0 ? '+' : ''}${b.deltaPoints.toFixed(1)} points` : `dropped ${Math.abs(b.deltaPoints).toFixed(1)} points`;
      list.push({
        id: `batch-trend-${b.batchId}`,
        category: 'IMPROVEMENT',
        text: `${b.batchName} has ${verb} across recent sessions; ${b.weakestTopicName} is the weakest topic (avg ${b.weakestTopicScore.toFixed(1)}).`,
        linkUrl: `/batches/${b.batchId}`,
        linkText: `View ${b.batchName}`,
        priority: 1,
      });
    }

    if (b.atRiskCount && b.atRiskCount > 0) {
      list.push({
        id: `batch-risk-${b.batchId}`,
        category: 'AT_RISK',
        text: `${b.atRiskCount} ${b.atRiskCount === 1 ? 'trainee' : 'trainees'} in ${b.batchName} currently flagged with at-risk performance patterns.`,
        linkUrl: `/batches/${b.batchId}`,
        linkText: `Inspect at-risk trainees in ${b.batchName}`,
        priority: 2,
      });
    }

    if (b.consistencyScore && b.consistencyScore >= 85) {
      list.push({
        id: `batch-consistency-${b.batchId}`,
        category: 'CONSISTENCY',
        text: `${b.batchName} shows high cohort score consistency (${b.consistencyScore}/100 stability index).`,
        linkUrl: `/batches/${b.batchId}`,
        linkText: `View batch report`,
        priority: 4,
      });
    }
  }

  // 2. Trainee Highlights
  for (const t of trainees) {
    if (t.sampleCount < INSIGHTS_CONFIG.MIN_SAMPLE_FOR_INSIGHT_SENTENCE) continue;

    if (t.isAtRisk && t.atRiskReason) {
      list.push({
        id: `trainee-risk-${t.traineeId}`,
        category: 'AT_RISK',
        text: `${t.traineeName} (${t.batchName}) requires attention: ${t.atRiskReason}`,
        linkUrl: `/trainees/${t.traineeId}`,
        linkText: `Review ${t.traineeName}`,
        priority: 1,
      });
    } else if (t.deltaPoints && t.deltaPoints >= 8.0) {
      list.push({
        id: `trainee-improver-${t.traineeId}`,
        category: 'IMPROVEMENT',
        text: `${t.traineeName} demonstrated top growth with a +${t.deltaPoints.toFixed(1)} point progression in ${t.batchName}.`,
        linkUrl: `/trainees/${t.traineeId}`,
        linkText: `View trainee progress`,
        priority: 3,
      });
    }
  }

  // Sort by priority and clamp to maximum 5
  return list.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
