import { INSIGHTS_CONFIG } from './config.js';

export interface AtRiskRuleResult {
  triggered: boolean;
  reason?: string;
}

export type AtRiskSeverity = 'NONE' | 'MEDIUM' | 'HIGH';

export interface AtRiskEvaluation {
  isAtRisk: boolean;
  severity: AtRiskSeverity;
  reasons: string[];
  rulesTriggered: number;
}

/**
 * Rule 1: Last 3 scores strictly falling by > 10 points in total
 * Scores array is assumed ordered chronologically [oldest ... newest].
 */
export function checkScoreDropRule(scores: number[]): AtRiskRuleResult {
  if (!scores || scores.length < INSIGHTS_CONFIG.SCORE_DROP.MIN_SESSIONS) {
    return { triggered: false };
  }

  const last3 = scores.slice(-INSIGHTS_CONFIG.SCORE_DROP.MIN_SESSIONS);
  const [s1, s2, s3] = last3;

  // Check strictly falling: s1 > s2 > s3
  const isStrictlyFalling = s1 > s2 && s2 > s3;
  const totalDrop = s1 - s3;

  if (isStrictlyFalling && totalDrop > INSIGHTS_CONFIG.SCORE_DROP.MIN_TOTAL_DROP) {
    return {
      triggered: true,
      reason: `Scores steadily declined over the last 3 sessions (${s1.toFixed(1)} → ${s2.toFixed(1)} → ${s3.toFixed(1)}, total drop: ${totalDrop.toFixed(1)} pts)`,
    };
  }

  return { triggered: false };
}

/**
 * Rule 2: Errors up more than 30% versus the trainee's previous 3 sessions
 * Errors array ordered chronologically [oldest ... newest].
 * Requires at least 4 sessions (3 baseline + 1 latest).
 */
export function checkErrorIncreaseRule(errors: number[]): AtRiskRuleResult {
  if (!errors || errors.length < INSIGHTS_CONFIG.ERROR_INCREASE.WINDOW_SIZE + 1) {
    return { triggered: false };
  }

  const latestError = errors[errors.length - 1];
  const priorWindow = errors.slice(-(INSIGHTS_CONFIG.ERROR_INCREASE.WINDOW_SIZE + 1), -1);
  const priorAvg = priorWindow.reduce((sum, e) => sum + e, 0) / priorWindow.length;

  if (priorAvg === 0) {
    // If prior avg was 0 and latest has errors > 0, that's an infinite jump
    if (latestError > 0) {
      return {
        triggered: true,
        reason: `Errors spiked to ${latestError} in latest session (previous average was 0.0)`,
      };
    }
    return { triggered: false };
  }

  const percentageIncrease = (latestError - priorAvg) / priorAvg;

  if (percentageIncrease > INSIGHTS_CONFIG.ERROR_INCREASE.INCREASE_PERCENT_THRESHOLD) {
    const pctDisplay = Math.round(percentageIncrease * 100);
    return {
      triggered: true,
      reason: `Error count jumped by ${pctDisplay}% in the latest session (${latestError} errors vs ${priorAvg.toFixed(1)} prior average)`,
    };
  }

  return { triggered: false };
}

/**
 * Rule 3: Trainee average score is > 15 points below batch average
 */
export function checkBatchDeficitRule(
  traineeAverage: number | null | undefined,
  batchAverage: number | null | undefined
): AtRiskRuleResult {
  if (
    traineeAverage === null ||
    traineeAverage === undefined ||
    batchAverage === null ||
    batchAverage === undefined
  ) {
    return { triggered: false };
  }

  const deficit = batchAverage - traineeAverage;
  if (deficit > INSIGHTS_CONFIG.BATCH_DEFICIT.DEFICIT_POINTS) {
    return {
      triggered: true,
      reason: `Average score (${traineeAverage.toFixed(1)}) is ${deficit.toFixed(1)} points below the batch benchmark (${batchAverage.toFixed(1)})`,
    };
  }

  return { triggered: false };
}

/**
 * Rule 4: 2 or more absences in the last 5 sessions
 * Attendance statuses array ordered chronologically [oldest ... newest].
 */
export function checkAbsenceRule(attendances: string[]): AtRiskRuleResult {
  if (!attendances || attendances.length === 0) {
    return { triggered: false };
  }

  const recentWindow = attendances.slice(-INSIGHTS_CONFIG.ABSENCE.WINDOW_SIZE);
  const absenceCount = recentWindow.filter((status) => status === 'ABSENT').length;

  if (absenceCount >= INSIGHTS_CONFIG.ABSENCE.MIN_ABSENCE_COUNT) {
    return {
      triggered: true,
      reason: `Recorded ${absenceCount} absences in the last ${recentWindow.length} scheduled sessions`,
    };
  }

  return { triggered: false };
}

/**
 * Combined at-risk evaluation
 */
export function evaluateAtRisk(params: {
  scores: number[];
  errors: number[];
  traineeAverage: number | null | undefined;
  batchAverage: number | null | undefined;
  recentAttendance: string[];
}): AtRiskEvaluation {
  const reasons: string[] = [];

  const r1 = checkScoreDropRule(params.scores);
  if (r1.triggered && r1.reason) reasons.push(r1.reason);

  const r2 = checkErrorIncreaseRule(params.errors);
  if (r2.triggered && r2.reason) reasons.push(r2.reason);

  const r3 = checkBatchDeficitRule(params.traineeAverage, params.batchAverage);
  if (r3.triggered && r3.reason) reasons.push(r3.reason);

  const r4 = checkAbsenceRule(params.recentAttendance);
  if (r4.triggered && r4.reason) reasons.push(r4.reason);

  const rulesTriggered = reasons.length;
  const isAtRisk = rulesTriggered > 0;
  const severity: AtRiskSeverity =
    rulesTriggered >= INSIGHTS_CONFIG.SEVERITY.HIGH_TRIGGER_COUNT
      ? 'HIGH'
      : rulesTriggered === 1
      ? 'MEDIUM'
      : 'NONE';

  return {
    isAtRisk,
    severity,
    reasons,
    rulesTriggered,
  };
}
