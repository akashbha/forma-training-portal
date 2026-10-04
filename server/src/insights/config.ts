/**
 * Insights Engine Configuration
 * 
 * All thresholds and tuneable constants for at-risk detection,
 * benchmarking, scoring metrics, and projection calculations.
 */

export const INSIGHTS_CONFIG = {
  // AT-RISK RULE 1: Score Drop
  // Last 3 scores strictly falling (s1 > s2 > s3) by more than 10 points in total (s1 - s3 > 10)
  SCORE_DROP: {
    MIN_SESSIONS: 3,
    MIN_TOTAL_DROP: 10,
  },

  // AT-RISK RULE 2: Error Spike
  // Latest session error count is up more than 30% versus the trainee's previous 3 sessions' average errors
  ERROR_INCREASE: {
    WINDOW_SIZE: 3,
    INCREASE_PERCENT_THRESHOLD: 0.30, // 30%
  },

  // AT-RISK RULE 3: Batch Benchmark Deficit
  // Trainee's overall average score is more than 15 points below the batch overall average
  BATCH_DEFICIT: {
    DEFICIT_POINTS: 15,
  },

  // AT-RISK RULE 4: Chronic Absences
  // 2 or more ABSENT statuses in the trainee's last 5 recorded sessions
  ABSENCE: {
    WINDOW_SIZE: 5,
    MIN_ABSENCE_COUNT: 2,
  },

  // SEVERITY DETERMINATION
  // HIGH if 2 or more rules fire; MEDIUM if 1 rule fires; NONE if 0 rules fire
  SEVERITY: {
    HIGH_TRIGGER_COUNT: 2,
  },

  // PROJECTIONS & INSIGHT STATS
  // Minimum required completed sessions before calculating trend projection or generating insight sentences
  MIN_SESSIONS_FOR_PROJECTION: 5,
  MIN_SAMPLE_FOR_INSIGHT_SENTENCE: 5,

  // CONSISTENCY SCALING
  // Maximum realistic standard deviation for score scaling (0-100 scale)
  MAX_SCORE_STD_DEV: 35,
};
