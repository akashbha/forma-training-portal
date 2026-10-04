import { describe, it, expect } from 'vitest';
import {
  checkScoreDropRule,
  checkErrorIncreaseRule,
  checkBatchDeficitRule,
  checkAbsenceRule,
  evaluateAtRisk,
  calculateImprovement,
  calculateConsistency,
  calculatePercentile,
  calculateMedian,
  computeTraineeBenchmark,
  calculateScoreProjection,
  generateInsightSentences,
  rankWeakestTopics,
  buildTraineeTopicGrid,
} from '../src/insights/index.js';

describe('Insights Engine Unit Tests', () => {
  describe('At-Risk Rule 1: Score Drop', () => {
    it('handles empty / insufficient sessions safely', () => {
      expect(checkScoreDropRule([]).triggered).toBe(false);
      expect(checkScoreDropRule([85]).triggered).toBe(false);
      expect(checkScoreDropRule([85, 80]).triggered).toBe(false);
    });

    it('triggers when last 3 scores are strictly falling by > 10 pts total', () => {
      // 90 -> 82 -> 78: strictly falling, total drop = 90 - 78 = 12 (> 10)
      const res = checkScoreDropRule([70, 90, 82, 78]);
      expect(res.triggered).toBe(true);
      expect(res.reason).toBeDefined();
    });

    it('does not trigger on equal scores (ties / flat)', () => {
      const res = checkScoreDropRule([85, 85, 85]);
      expect(res.triggered).toBe(false);
    });

    it('does not trigger if drop is not strictly falling (e.g. slight bounce)', () => {
      // 90 -> 75 -> 76: drop is 14, but not strictly falling
      const res = checkScoreDropRule([90, 75, 76]);
      expect(res.triggered).toBe(false);
    });

    it('does not trigger if strictly falling but drop is <= 10 pts', () => {
      // 85 -> 80 -> 76: strictly falling, total drop = 9 (<= 10)
      const res = checkScoreDropRule([85, 80, 76]);
      expect(res.triggered).toBe(false);
    });
  });

  describe('At-Risk Rule 2: Error Increase', () => {
    it('handles insufficient history safely', () => {
      expect(checkErrorIncreaseRule([]).triggered).toBe(false);
      expect(checkErrorIncreaseRule([2, 2]).triggered).toBe(false);
    });

    it('triggers when latest errors are > 30% above prior 3 sessions average', () => {
      // Prior 3: [2, 2, 2] (avg = 2.0). Latest: 4 (jump = +100% > 30%)
      const res = checkErrorIncreaseRule([2, 2, 2, 4]);
      expect(res.triggered).toBe(true);
      expect(res.reason).toContain('jumped by 100%');
    });

    it('triggers when baseline was 0 and latest has errors', () => {
      const res = checkErrorIncreaseRule([0, 0, 0, 3]);
      expect(res.triggered).toBe(true);
      expect(res.reason).toContain('spiked to 3');
    });

    it('does not trigger when errors decrease or stay flat', () => {
      const res = checkErrorIncreaseRule([5, 5, 5, 5]);
      expect(res.triggered).toBe(false);
      const res2 = checkErrorIncreaseRule([5, 5, 5, 2]);
      expect(res2.triggered).toBe(false);
    });
  });

  describe('At-Risk Rule 3: Batch Benchmark Deficit', () => {
    it('handles null / undefined safely', () => {
      expect(checkBatchDeficitRule(null, 80).triggered).toBe(false);
      expect(checkBatchDeficitRule(80, null).triggered).toBe(false);
    });

    it('triggers when trainee average is > 15 points below batch average', () => {
      // Trainee = 64, Batch = 80 -> Deficit = 16 > 15
      const res = checkBatchDeficitRule(64, 80);
      expect(res.triggered).toBe(true);
      expect(res.reason).toContain('16.0 points below');
    });

    it('does not trigger when trainee is above or close to batch average', () => {
      expect(checkBatchDeficitRule(75, 80).triggered).toBe(false);
      expect(checkBatchDeficitRule(85, 80).triggered).toBe(false);
    });
  });

  describe('At-Risk Rule 4: Absence Spike', () => {
    it('handles empty attendance array safely', () => {
      expect(checkAbsenceRule([]).triggered).toBe(false);
    });

    it('triggers when 2 or more absences occur in the last 5 sessions', () => {
      const res = checkAbsenceRule(['PRESENT', 'ABSENT', 'PRESENT', 'ABSENT', 'PRESENT']);
      expect(res.triggered).toBe(true);
      expect(res.reason).toContain('2 absences');
    });

    it('does not trigger on 1 absence or only late / excused', () => {
      const res = checkAbsenceRule(['PRESENT', 'ABSENT', 'PRESENT', 'LATE', 'EXCUSED']);
      expect(res.triggered).toBe(false);
    });
  });

  describe('At-Risk Evaluation & Severity Classification', () => {
    it('classifies severity as HIGH when 2 or more rules trigger', () => {
      const res = evaluateAtRisk({
        scores: [90, 80, 70], // Rule 1 fires (-20 pts drop)
        errors: [1, 1, 1, 5], // Rule 2 fires (+400% error spike)
        traineeAverage: 75,
        batchAverage: 80,
        recentAttendance: ['PRESENT', 'PRESENT'],
      });

      expect(res.isAtRisk).toBe(true);
      expect(res.severity).toBe('HIGH');
      expect(res.reasons.length).toBe(2);
    });

    it('classifies severity as MEDIUM when exactly 1 rule triggers', () => {
      const res = evaluateAtRisk({
        scores: [85, 85, 85],
        errors: [2, 2, 2, 2],
        traineeAverage: 60, // Rule 3 fires (deficit = 25)
        batchAverage: 85,
        recentAttendance: ['PRESENT'],
      });

      expect(res.isAtRisk).toBe(true);
      expect(res.severity).toBe('MEDIUM');
      expect(res.reasons.length).toBe(1);
    });

    it('returns NONE severity when 0 rules trigger', () => {
      const res = evaluateAtRisk({
        scores: [80, 85, 90],
        errors: [3, 2, 1],
        traineeAverage: 85,
        batchAverage: 82,
        recentAttendance: ['PRESENT', 'PRESENT'],
      });

      expect(res.isAtRisk).toBe(false);
      expect(res.severity).toBe('NONE');
      expect(res.reasons.length).toBe(0);
    });
  });

  describe('Improvement & Consistency Algorithms', () => {
    it('handles edge cases: empty, single item, all identical scores', () => {
      expect(calculateImprovement([]).slope).toBe(0);
      expect(calculateImprovement([80]).slope).toBe(0);

      // All equal scores
      const flat = calculateImprovement([85, 85, 85, 85]);
      expect(flat.slope).toBe(0);
      expect(flat.totalDelta).toBe(0);
      expect(flat.trendDirection).toBe('STEADY');

      const flatConsistency = calculateConsistency([85, 85, 85]);
      expect(flatConsistency.consistencyScore).toBe(100);
      expect(flatConsistency.standardDeviation).toBe(0);
    });

    it('calculates linear progression slope and trend direction accurately', () => {
      // Upward trend: 60, 70, 80, 90, 100
      const up = calculateImprovement([60, 70, 80, 90, 100]);
      expect(up.slope).toBe(10);
      expect(up.totalDelta).toBe(20); // avg(80,90,100)=90 - avg(60,70,80)=70 = 20
      expect(up.trendDirection).toBe('IMPROVING');
    });

    it('calculates consistency score penalizing high volatility', () => {
      // High volatility: [40, 95, 45, 90]
      const volatile = calculateConsistency([40, 95, 45, 90]);
      expect(volatile.consistencyScore).toBeLessThan(50);
      expect(volatile.standardDeviation).toBeGreaterThan(20);
    });
  });

  describe('Benchmarking & Percentiles', () => {
    it('handles edge cases: single value, ties, all equal values', () => {
      expect(calculatePercentile(80, [80])).toBe(100);
      expect(calculateMedian([])).toBe(0);
      expect(calculateMedian([50])).toBe(50);
      expect(calculateMedian([20, 80])).toBe(50);

      // Ties
      const pTied = calculatePercentile(80, [80, 80, 80, 80]);
      expect(pTied).toBe(50); // Mid-point tied rank
    });

    it('computes metric benchmark with inversions (errors/time where lower is better)', () => {
      const benchmark = computeTraineeBenchmark(
        { score: 90, errors: 1, timeSeconds: 1500 },
        [
          { score: 70, errors: 5, timeSeconds: 2200 },
          { score: 80, errors: 3, timeSeconds: 1800 },
          { score: 90, errors: 1, timeSeconds: 1500 },
        ]
      );

      // Score 90 is top -> percentile should be high (> 80)
      expect(benchmark.score.percentile).toBeGreaterThanOrEqual(80);
      // Errors 1 is best (lowest) -> percentile should be high
      expect(benchmark.errors.percentile).toBeGreaterThanOrEqual(80);
      // Time 1500 is best (lowest) -> percentile should be high
      expect(benchmark.timeSeconds.percentile).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Score Projections & Insight Sentences', () => {
    it('hides projection when sample count is less than 5', () => {
      expect(calculateScoreProjection([70, 75, 80, 85])).toBeNull();
    });

    it('projects score with confidence range for >= 5 sessions', () => {
      const proj = calculateScoreProjection([70, 75, 80, 85, 90], 8);
      expect(proj).not.toBeNull();
      expect(proj!.projectedScore).toBeGreaterThanOrEqual(95);
      expect(proj!.label).toBe('Estimate based on the current trend');
      expect(proj!.confidenceRange[0]).toBeLessThanOrEqual(proj!.projectedScore);
      expect(proj!.confidenceRange[1]).toBeGreaterThanOrEqual(proj!.projectedScore);
    });

    it('generates template-based insight sentences skipping < 5 samples and capping at 5', () => {
      const sentences = generateInsightSentences(
        [
          {
            batchId: 'b1',
            batchName: 'Batch Alpha',
            sampleCount: 6,
            deltaPoints: 9.0,
            weakestTopicName: 'SQL',
            weakestTopicScore: 68.5,
            atRiskCount: 1,
            consistencyScore: 88,
          },
          {
            batchId: 'b2',
            batchName: 'Batch Tiny',
            sampleCount: 3, // Skipped because < 5
            deltaPoints: 12.0,
          },
        ],
        [
          {
            traineeId: 't1',
            traineeName: 'Alex Rivera',
            batchName: 'Batch Alpha',
            sampleCount: 6,
            deltaPoints: 10.0,
          },
        ]
      );

      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(5);
      expect(sentences.some((s) => s.text.includes('SQL'))).toBe(true);
      expect(sentences.some((s) => s.text.includes('Batch Tiny'))).toBe(false); // Ignored due to sample count < 5
    });
  });

  describe('Weak-Topic Matrix & Ranking', () => {
    it('ranks weakest topics in ascending order of average score', () => {
      const ranked = rankWeakestTopics([
        { traineeId: '1', traineeName: 'A', topicId: 't1', topicName: 'SQL', score: 60, errors: 4 },
        { traineeId: '2', traineeName: 'B', topicId: 't1', topicName: 'SQL', score: 70, errors: 2 },
        { traineeId: '1', traineeName: 'A', topicId: 't2', topicName: 'React', score: 90, errors: 0 },
        { traineeId: '2', traineeName: 'B', topicId: 't2', topicName: 'React', score: 95, errors: 1 },
      ]);

      expect(ranked[0].topicName).toBe('SQL');
      expect(ranked[0].averageScore).toBe(65);
      expect(ranked[0].weakRank).toBe(1);

      expect(ranked[1].topicName).toBe('React');
      expect(ranked[1].averageScore).toBe(92.5);
      expect(ranked[1].weakRank).toBe(2);
    });

    it('builds full Trainee x Topic grid matrix', () => {
      const grid = buildTraineeTopicGrid([
        { traineeId: 'tr1', traineeName: 'Alex', topicId: 'top1', topicName: 'Git', score: 85, errors: 1 },
        { traineeId: 'tr1', traineeName: 'Alex', topicId: 'top2', topicName: 'SQL', score: 65, errors: 3 },
      ]);

      expect(grid.topics.length).toBe(2);
      expect(grid.rows.length).toBe(1);
      expect(grid.rows[0].topicStats['top1'].averageScore).toBe(85);
      expect(grid.rows[0].topicStats['top2'].isWeak).toBe(true);
    });
  });
});
