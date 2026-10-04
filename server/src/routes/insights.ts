import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import {
  evaluateAtRisk,
  rankWeakestTopics,
  buildTraineeTopicGrid,
  calculateImprovement,
  calculateConsistency,
  calculateScoreProjection,
  computeTraineeBenchmark,
  computeTraineeSafeBenchmark,
  generateInsightSentences,
  RawTopicResult,
} from '../insights/index.js';

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

/**
 * GET /api/v1/insights/at-risk
 * Scoped by role: Trainers see only their batches; Admins see all
 */
insightsRouter.get('/at-risk', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { batchId } = req.query;

  let batchFilter: any = {};
  if (user.role === 'TRAINER') {
    batchFilter.trainerId = user.id;
  }
  if (batchId && typeof batchId === 'string') {
    batchFilter.id = batchId;
  }

  const batches = await prisma.batch.findMany({
    where: batchFilter,
    include: {
      trainees: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          results: {
            include: { session: true },
            orderBy: { session: { heldOn: 'asc' } },
          },
          attendances: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      sessions: {
        include: { results: true },
      },
    },
  });

  const atRiskList: any[] = [];

  for (const b of batches) {
    const allBatchResults = b.sessions.flatMap((s) => s.results);
    const batchAvg = allBatchResults.length
      ? allBatchResults.reduce((sum, r) => sum + r.score, 0) / allBatchResults.length
      : 75;

    for (const t of b.trainees) {
      const scores = t.results.map((r) => r.score);
      const errors = t.results.map((r) => r.errors);
      const attendances = t.attendances.map((a) => a.status);
      const tAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const evalResult = evaluateAtRisk({
        scores,
        errors,
        traineeAverage: tAvg,
        batchAverage: batchAvg,
        recentAttendance: attendances,
      });

      if (evalResult.isAtRisk) {
        atRiskList.push({
          traineeId: t.id,
          traineeName: t.user.name,
          traineeEmail: t.user.email,
          batchId: b.id,
          batchName: b.name,
          severity: evalResult.severity,
          reasons: evalResult.reasons,
          averageScore: tAvg ? Math.round(tAvg * 10) / 10 : null,
          batchAverageScore: Math.round(batchAvg * 10) / 10,
          totalSessions: scores.length,
        });
      }
    }
  }

  // Sort HIGH severity first
  atRiskList.sort((a, b) => (a.severity === 'HIGH' ? -1 : 1));

  res.json({
    data: {
      count: atRiskList.length,
      trainees: atRiskList,
    },
  });
});

/**
 * GET /api/v1/insights/weak-topics
 * Returns ranked weakest topics and trainee x topic matrix
 */
insightsRouter.get('/weak-topics', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { batchId } = req.query;

  let sessionFilter: any = {};
  if (user.role === 'TRAINER') {
    sessionFilter.batch = { trainerId: user.id };
  }
  if (batchId && typeof batchId === 'string') {
    sessionFilter.batchId = batchId;
  }

  const results = await prisma.result.findMany({
    where: {
      session: sessionFilter,
    },
    include: {
      trainee: {
        include: { user: { select: { name: true } } },
      },
      session: {
        include: { topic: true },
      },
    },
  });

  const rawTopicData: RawTopicResult[] = results.map((r) => ({
    traineeId: r.traineeId,
    traineeName: r.trainee.user.name,
    topicId: r.session.topic.id,
    topicName: r.session.topic.name,
    score: r.score,
    errors: r.errors,
    passMark: r.session.passMark,
  }));

  const rankedWeakest = rankWeakestTopics(rawTopicData);
  const topicGrid = buildTraineeTopicGrid(rawTopicData);

  res.json({
    data: {
      rankedWeakest,
      matrix: topicGrid,
    },
  });
});

/**
 * GET /api/v1/insights/overview-sentences
 * Max 5 data-grounded template insight sentences
 */
insightsRouter.get('/overview-sentences', async (req: Request, res: Response): Promise<void> => {
  const batches = await prisma.batch.findMany({
    include: {
      trainees: {
        include: {
          user: { select: { name: true } },
          results: { include: { session: true }, orderBy: { session: { heldOn: 'asc' } } },
          attendances: true,
        },
      },
      sessions: {
        include: { results: true, topic: true },
        orderBy: { heldOn: 'asc' },
      },
    },
  });

  const batchInputs: any[] = [];
  const traineeInputs: any[] = [];

  for (const b of batches) {
    const allResults = b.sessions.flatMap((s) => s.results);
    const scores = allResults.map((r) => r.score);
    const imp = calculateImprovement(scores);
    const cons = calculateConsistency(scores);

    const rawTopics: RawTopicResult[] = allResults.map((r) => {
      const parentSession = b.sessions.find((s) => s.id === r.sessionId)!;
      return {
        traineeId: r.traineeId,
        traineeName: '',
        topicId: parentSession.topicId,
        topicName: parentSession.topic.name,
        score: r.score,
        errors: r.errors,
      };
    });

    const rankedTopics = rankWeakestTopics(rawTopics);
    const weakest = rankedTopics[0];

    // At risk count
    let atRiskCount = 0;
    for (const t of b.trainees) {
      const tScores = t.results.map((r) => r.score);
      const tErrors = t.results.map((r) => r.errors);
      const tAttend = t.attendances.map((a) => a.status);
      const tAvg = tScores.length ? tScores.reduce((a, b) => a + b, 0) / tScores.length : null;
      const bAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const evalRes = evaluateAtRisk({
        scores: tScores,
        errors: tErrors,
        traineeAverage: tAvg,
        batchAverage: bAvg,
        recentAttendance: tAttend,
      });

      if (evalRes.isAtRisk) {
        atRiskCount++;
        traineeInputs.push({
          traineeId: t.id,
          traineeName: t.user.name,
          batchName: b.name,
          sampleCount: tScores.length,
          isAtRisk: true,
          atRiskReason: evalRes.reasons[0],
        });
      } else {
        const tImp = calculateImprovement(tScores);
        traineeInputs.push({
          traineeId: t.id,
          traineeName: t.user.name,
          batchName: b.name,
          sampleCount: tScores.length,
          deltaPoints: tImp.totalDelta,
        });
      }
    }

    batchInputs.push({
      batchId: b.id,
      batchName: b.name,
      sampleCount: b.sessions.length,
      deltaPoints: imp.totalDelta,
      weakestTopicName: weakest?.topicName,
      weakestTopicScore: weakest?.averageScore,
      consistencyScore: cons.consistencyScore,
      atRiskCount,
    });
  }

  const sentences = generateInsightSentences(batchInputs, traineeInputs);

  res.json({
    data: {
      sentences,
    },
  });
});

/**
 * GET /api/v1/insights/compare
 * Side by side comparison for 2 trainees or 2 batches
 */
insightsRouter.get('/compare', async (req: Request, res: Response): Promise<void> => {
  const { type, idA, idB } = req.query;

  if (type === 'batch') {
    const [batchA, batchB] = await Promise.all([
      prisma.batch.findUnique({
        where: { id: idA as string },
        include: {
          trainees: true,
          sessions: { include: { results: true } },
          trainer: { select: { name: true } },
        },
      }),
      prisma.batch.findUnique({
        where: { id: idB as string },
        include: {
          trainees: true,
          sessions: { include: { results: true } },
          trainer: { select: { name: true } },
        },
      }),
    ]);

    if (!batchA || !batchB) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'One or both batches not found' } });
      return;
    }

    const resultsA = batchA.sessions.flatMap((s) => s.results);
    const resultsB = batchB.sessions.flatMap((s) => s.results);

    const scoresA = resultsA.map((r) => r.score);
    const scoresB = resultsB.map((r) => r.score);

    const avgScoreA = scoresA.length ? scoresA.reduce((a, b) => a + b, 0) / scoresA.length : 0;
    const avgScoreB = scoresB.length ? scoresB.reduce((a, b) => a + b, 0) / scoresB.length : 0;

    const avgErrA = resultsA.length ? resultsA.reduce((a, b) => a + b.errors, 0) / resultsA.length : 0;
    const avgErrB = resultsB.length ? resultsB.reduce((a, b) => a + b.errors, 0) / resultsB.length : 0;

    const impA = calculateImprovement(scoresA);
    const impB = calculateImprovement(scoresB);
    const consA = calculateConsistency(scoresA);
    const consB = calculateConsistency(scoresB);

    res.json({
      data: {
        entityA: { id: batchA.id, name: batchA.name, trainer: batchA.trainer.name, traineeCount: batchA.trainees.length },
        entityB: { id: batchB.id, name: batchB.name, trainer: batchB.trainer.name, traineeCount: batchB.trainees.length },
        comparison: [
          { metric: 'Average Score', valueA: Math.round(avgScoreA * 10) / 10, valueB: Math.round(avgScoreB * 10) / 10, favors: avgScoreA >= avgScoreB ? 'A' : 'B' },
          { metric: 'Average Errors', valueA: Math.round(avgErrA * 10) / 10, valueB: Math.round(avgErrB * 10) / 10, favors: avgErrA <= avgErrB ? 'A' : 'B' },
          { metric: 'Improvement Delta', valueA: impA.totalDelta, valueB: impB.totalDelta, favors: impA.totalDelta >= impB.totalDelta ? 'A' : 'B' },
          { metric: 'Consistency Score', valueA: consA.consistencyScore, valueB: consB.consistencyScore, favors: consA.consistencyScore >= consB.consistencyScore ? 'A' : 'B' },
        ],
      },
    });
    return;
  }

  // Trainee comparison
  const [traineeA, traineeB] = await Promise.all([
    prisma.trainee.findUnique({
      where: { id: idA as string },
      include: {
        user: { select: { name: true } },
        batch: { select: { name: true } },
        results: { include: { session: true }, orderBy: { session: { heldOn: 'asc' } } },
        attendances: true,
      },
    }),
    prisma.trainee.findUnique({
      where: { id: idB as string },
      include: {
        user: { select: { name: true } },
        batch: { select: { name: true } },
        results: { include: { session: true }, orderBy: { session: { heldOn: 'asc' } } },
        attendances: true,
      },
    }),
  ]);

  if (!traineeA || !traineeB) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'One or both trainees not found' } });
    return;
  }

  const scoresA = traineeA.results.map((r) => r.score);
  const scoresB = traineeB.results.map((r) => r.score);

  const avgScoreA = scoresA.length ? scoresA.reduce((a, b) => a + b, 0) / scoresA.length : 0;
  const avgScoreB = scoresB.length ? scoresB.reduce((a, b) => a + b, 0) / scoresB.length : 0;

  const avgErrA = traineeA.results.length ? traineeA.results.reduce((a, b) => a + b.errors, 0) / traineeA.results.length : 0;
  const avgErrB = traineeB.results.length ? traineeB.results.reduce((a, b) => a + b.errors, 0) / traineeB.results.length : 0;

  const impA = calculateImprovement(scoresA);
  const impB = calculateImprovement(scoresB);
  const consA = calculateConsistency(scoresA);
  const consB = calculateConsistency(scoresB);

  const attendRateA = traineeA.attendances.length
    ? (traineeA.attendances.filter((a) => a.status === 'PRESENT').length / traineeA.attendances.length) * 100
    : 100;
  const attendRateB = traineeB.attendances.length
    ? (traineeB.attendances.filter((a) => a.status === 'PRESENT').length / traineeB.attendances.length) * 100
    : 100;

  res.json({
    data: {
      entityA: { id: traineeA.id, name: traineeA.user.name, batch: traineeA.batch.name, sessionsCount: traineeA.results.length },
      entityB: { id: traineeB.id, name: traineeB.user.name, batch: traineeB.batch.name, sessionsCount: traineeB.results.length },
      comparison: [
        { metric: 'Average Score', valueA: Math.round(avgScoreA * 10) / 10, valueB: Math.round(avgScoreB * 10) / 10, favors: avgScoreA >= avgScoreB ? 'A' : 'B' },
        { metric: 'Average Errors', valueA: Math.round(avgErrA * 10) / 10, valueB: Math.round(avgErrB * 10) / 10, favors: avgErrA <= avgErrB ? 'A' : 'B' },
        { metric: 'Improvement Delta', valueA: impA.totalDelta, valueB: impB.totalDelta, favors: impA.totalDelta >= impB.totalDelta ? 'A' : 'B' },
        { metric: 'Consistency Score', valueA: consA.consistencyScore, valueB: consB.consistencyScore, favors: consA.consistencyScore >= consB.consistencyScore ? 'A' : 'B' },
        { metric: 'Attendance Rate %', valueA: Math.round(attendRateA), valueB: Math.round(attendRateB), favors: attendRateA >= attendRateB ? 'A' : 'B' },
      ],
    },
  });
});
