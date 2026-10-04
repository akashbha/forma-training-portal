export interface TraineeTopicStat {
  topicId: string;
  topicName: string;
  averageScore: number;
  averageErrors: number;
  sampleSize: number;
  isWeak: boolean; // Below 70% or below pass mark
}

export interface TraineeTopicRow {
  traineeId: string;
  traineeName: string;
  topicStats: Record<string, TraineeTopicStat>;
}

export interface BatchWeakTopic {
  topicId: string;
  topicName: string;
  averageScore: number;
  averageErrors: number;
  totalAttempts: number;
  passRate: number; // 0 to 100
  weakRank: number; // 1 = weakest
}

export interface RawTopicResult {
  traineeId: string;
  traineeName: string;
  topicId: string;
  topicName: string;
  score: number;
  errors: number;
  passMark?: number;
}

/**
 * Builds Trainee x Topic matrix with score and sample size
 */
export function buildTraineeTopicGrid(
  results: RawTopicResult[]
): {
  topics: { id: string; name: string }[];
  rows: TraineeTopicRow[];
} {
  const topicsMap = new Map<string, string>();
  const traineeMap = new Map<string, { name: string; resultsByTopic: Map<string, { scores: number[]; errors: number[]; passMark: number }> }>();

  for (const r of results) {
    topicsMap.set(r.topicId, r.topicName);

    if (!traineeMap.has(r.traineeId)) {
      traineeMap.set(r.traineeId, {
        name: r.traineeName,
        resultsByTopic: new Map(),
      });
    }

    const tEntry = traineeMap.get(r.traineeId)!;
    if (!tEntry.resultsByTopic.has(r.topicId)) {
      tEntry.resultsByTopic.set(r.topicId, { scores: [], errors: [], passMark: r.passMark || 70 });
    }
    const topicGroup = tEntry.resultsByTopic.get(r.topicId)!;
    topicGroup.scores.push(r.score);
    topicGroup.errors.push(r.errors);
  }

  const topicsList = Array.from(topicsMap.entries()).map(([id, name]) => ({ id, name }));

  const rows: TraineeTopicRow[] = [];
  for (const [traineeId, data] of traineeMap.entries()) {
    const topicStats: Record<string, TraineeTopicStat> = {};

    for (const topic of topicsList) {
      const entry = data.resultsByTopic.get(topic.id);
      if (entry && entry.scores.length > 0) {
        const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
        const avgErrors = entry.errors.reduce((a, b) => a + b, 0) / entry.errors.length;
        topicStats[topic.id] = {
          topicId: topic.id,
          topicName: topic.name,
          averageScore: Math.round(avgScore * 10) / 10,
          averageErrors: Math.round(avgErrors * 10) / 10,
          sampleSize: entry.scores.length,
          isWeak: avgScore < entry.passMark,
        };
      }
    }

    rows.push({
      traineeId,
      traineeName: data.name,
      topicStats,
    });
  }

  return { topics: topicsList, rows };
}

/**
 * Ranks weakest topics for a batch or whole academy
 */
export function rankWeakestTopics(results: RawTopicResult[]): BatchWeakTopic[] {
  const map = new Map<string, { name: string; scores: number[]; errors: number[]; passed: number }>();

  for (const r of results) {
    if (!map.has(r.topicId)) {
      map.set(r.topicId, { name: r.topicName, scores: [], errors: [], passed: 0 });
    }
    const group = map.get(r.topicId)!;
    group.scores.push(r.score);
    group.errors.push(r.errors);
    if (r.score >= (r.passMark || 70)) {
      group.passed += 1;
    }
  }

  const list: Omit<BatchWeakTopic, 'weakRank'>[] = [];
  for (const [topicId, data] of map.entries()) {
    if (data.scores.length === 0) continue;
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const avgErrors = data.errors.reduce((a, b) => a + b, 0) / data.errors.length;
    const passRate = (data.passed / data.scores.length) * 100;

    list.push({
      topicId,
      topicName: data.name,
      averageScore: Math.round(avgScore * 10) / 10,
      averageErrors: Math.round(avgErrors * 10) / 10,
      totalAttempts: data.scores.length,
      passRate: Math.round(passRate * 10) / 10,
    });
  }

  // Sort ascending by average score (weakest first)
  list.sort((a, b) => a.averageScore - b.averageScore);

  return list.map((item, index) => ({
    ...item,
    weakRank: index + 1,
  }));
}
