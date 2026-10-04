import { prisma } from '../db/prisma.js';
import { calculatePerformanceStatus, PerformanceStatus } from '../constants/thresholds.js';
import { NotFoundError } from '../utils/errors.js';
import { calculateGoalProgress } from './goals.js';
import { GoalScope, AttendanceStatus } from '@prisma/client';
import {
  calculateImprovement,
  calculateConsistency,
  calculateScoreProjection,
  evaluateAtRisk,
} from '../insights/index.js';

export interface OverviewMetrics {
  avgScore: number;
  errorRate: number;
  avgTimeSeconds: number;
  traineesAtRisk: number;
  totalResults: number;
  totalSessions: number;
}

export interface OverviewAnalyticsResponse {
  current: OverviewMetrics;
  previous: OverviewMetrics;
  delta: {
    avgScore: number;
    errorRate: number;
    avgTimeSeconds: number;
    traineesAtRisk: number;
  };
  timeWindow: {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
  };
  goals?: any[];
}

function buildDateRangeCondition(field: string, startDate: Date, endDate: Date): string {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return `(
    (typeof(${field}) = 'integer' AND ${field} >= ${startMs} AND ${field} <= ${endMs})
    OR 
    (typeof(${field}) != 'integer' AND ${field} >= '${startIso}' AND ${field} <= '${endIso}')
  )`;
}

export async function getOverviewAnalytics(params: {
  batchId?: string;
  batchIds?: string[];
  from?: Date;
  to?: Date;
}): Promise<OverviewAnalyticsResponse> {
  const now = new Date();
  const to = params.to || now;
  // Default to 90 days if from is not specified
  const from = params.from || new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const durationMs = to.getTime() - from.getTime();

  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - durationMs);

  async function queryPeriodMetrics(startDate: Date, endDate: Date): Promise<OverviewMetrics> {
    const dateFilter = buildDateRangeCondition('s.heldOn', startDate, endDate);

    let baseQuery = `
      SELECT 
        COALESCE(AVG(r.score), 0) AS avgScore,
        COALESCE(AVG(CAST(r.errors AS REAL)), 0) AS errorRate,
        COALESCE(AVG(CAST(r.timeSeconds AS REAL)), 0) AS avgTimeSeconds,
        COUNT(r.id) AS totalResults,
        COUNT(DISTINCT s.id) AS totalSessions
      FROM Result r
      JOIN Session s ON r.sessionId = s.id
      WHERE ${dateFilter}
    `;

    if (params.batchId) {
      baseQuery += ` AND s.batchId = '${params.batchId}'`;
    } else if (params.batchIds && params.batchIds.length > 0) {
      const inList = params.batchIds.map((b) => `'${b}'`).join(',');
      baseQuery += ` AND s.batchId IN (${inList})`;
    } else if (params.batchIds && params.batchIds.length === 0) {
      baseQuery += ` AND 1 = 0`;
    }

    const rows: any = await prisma.$queryRawUnsafe(baseQuery);
    const row = rows[0] || {};

    let atRiskQuery = `
      SELECT COUNT(*) AS atRiskCount
      FROM (
        SELECT r.traineeId, AVG(r.score) AS avgScore
        FROM Result r
        JOIN Session s ON r.sessionId = s.id
        WHERE ${dateFilter}
          ${
            params.batchId
              ? `AND s.batchId = '${params.batchId}'`
              : params.batchIds && params.batchIds.length > 0
              ? `AND s.batchId IN (${params.batchIds.map((b) => `'${b}'`).join(',')})`
              : params.batchIds && params.batchIds.length === 0
              ? `AND 1 = 0`
              : ''
          }
        GROUP BY r.traineeId
        HAVING AVG(r.score) < 50
      )
    `;

    const atRiskRows: any = await prisma.$queryRawUnsafe(atRiskQuery);
    const atRiskCount = Number(atRiskRows[0]?.atRiskCount ?? 0);

    return {
      avgScore: Number(Number(row.avgScore || 0).toFixed(2)),
      errorRate: Number(Number(row.errorRate || 0).toFixed(2)),
      avgTimeSeconds: Math.round(Number(row.avgTimeSeconds || 0)),
      traineesAtRisk: atRiskCount,
      totalResults: Number(row.totalResults || 0),
      totalSessions: Number(row.totalSessions || 0),
    };
  }

  const [current, previous] = await Promise.all([
    queryPeriodMetrics(from, to),
    queryPeriodMetrics(prevFrom, prevTo),
  ]);

  // Query applicable goals with progress
  const goalsWhere: any = {};
  if (params.batchId) {
    goalsWhere.OR = [
      { scope: GoalScope.BATCH, scopeId: params.batchId },
      { scope: GoalScope.TOPIC },
    ];
  }

  const rawGoals = await prisma.goal.findMany({
    where: goalsWhere,
    take: 6,
    orderBy: { dueDate: 'asc' },
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  const goalsWithProgress = await Promise.all(
    rawGoals.map(async (g) => {
      const prog = await calculateGoalProgress(g);
      return {
        ...g,
        scopeName: prog.scopeName,
        progress: prog,
      };
    })
  );

  return {
    current,
    previous,
    delta: {
      avgScore: Number((current.avgScore - previous.avgScore).toFixed(2)),
      errorRate: Number((current.errorRate - previous.errorRate).toFixed(2)),
      avgTimeSeconds: current.avgTimeSeconds - previous.avgTimeSeconds,
      traineesAtRisk: current.traineesAtRisk - previous.traineesAtRisk,
    },
    timeWindow: {
      from: from.toISOString(),
      to: to.toISOString(),
      prevFrom: prevFrom.toISOString(),
      prevTo: prevTo.toISOString(),
    },
    goals: goalsWithProgress,
  };
}

export async function getTrendAnalytics(params: {
  batchId?: string;
  batchIds?: string[];
  from?: Date;
  to?: Date;
  groupBy: 'week' | 'session';
}) {
  let whereConditions = 'WHERE 1=1';

  if (params.from && params.to) {
    whereConditions += ` AND ${buildDateRangeCondition('s.heldOn', params.from, params.to)}`;
  } else if (params.from) {
    const startMs = params.from.getTime();
    const startIso = params.from.toISOString();
    whereConditions += ` AND ((typeof(s.heldOn) = 'integer' AND s.heldOn >= ${startMs}) OR (typeof(s.heldOn) != 'integer' AND s.heldOn >= '${startIso}'))`;
  } else if (params.to) {
    const endMs = params.to.getTime();
    const endIso = params.to.toISOString();
    whereConditions += ` AND ((typeof(s.heldOn) = 'integer' AND s.heldOn <= ${endMs}) OR (typeof(s.heldOn) != 'integer' AND s.heldOn <= '${endIso}'))`;
  }

  if (params.batchId) {
    whereConditions += ` AND s.batchId = '${params.batchId}'`;
  } else if (params.batchIds && params.batchIds.length > 0) {
    const inList = params.batchIds.map((b) => `'${b}'`).join(',');
    whereConditions += ` AND s.batchId IN (${inList})`;
  } else if (params.batchIds && params.batchIds.length === 0) {
    whereConditions += ` AND 1 = 0`;
  }

  if (params.groupBy === 'session') {
    const query = `
      SELECT 
        s.id AS sessionId,
        s.title AS period,
        s.heldOn AS date,
        COALESCE(AVG(r.score), 0) AS avgScore,
        COALESCE(AVG(CAST(r.errors AS REAL)), 0) AS avgErrors,
        COALESCE(AVG(CAST(r.timeSeconds AS REAL)), 0) AS avgTimeSeconds,
        COUNT(r.id) AS sampleSize
      FROM Result r
      JOIN Session s ON r.sessionId = s.id
      ${whereConditions}
      GROUP BY s.id, s.title, s.heldOn
      ORDER BY s.heldOn ASC
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(query);
    return rows.map((r) => ({
      period: r.period,
      sessionId: r.sessionId,
      date: r.date,
      avgScore: Number(Number(r.avgScore).toFixed(2)),
      avgErrors: Number(Number(r.avgErrors).toFixed(2)),
      avgTimeSeconds: Math.round(Number(r.avgTimeSeconds)),
      sampleSize: Number(r.sampleSize),
    }));
  }

  // Group by week
  const query = `
    SELECT 
      strftime('%Y-W%W', CASE 
        WHEN typeof(s.heldOn) = 'integer' THEN datetime(s.heldOn / 1000, 'unixepoch')
        ELSE s.heldOn 
      END) AS period,
      COALESCE(AVG(r.score), 0) AS avgScore,
      COALESCE(AVG(CAST(r.errors AS REAL)), 0) AS avgErrors,
      COALESCE(AVG(CAST(r.timeSeconds AS REAL)), 0) AS avgTimeSeconds,
      COUNT(r.id) AS sampleSize
    FROM Result r
    JOIN Session s ON r.sessionId = s.id
    ${whereConditions}
    GROUP BY period
    ORDER BY period ASC
  `;

  const rows: any[] = await prisma.$queryRawUnsafe(query);
  return rows.map((r) => ({
    period: r.period || 'Unknown',
    avgScore: Number(Number(r.avgScore).toFixed(2)),
    avgErrors: Number(Number(r.avgErrors).toFixed(2)),
    avgTimeSeconds: Math.round(Number(r.avgTimeSeconds)),
    sampleSize: Number(r.sampleSize),
  }));
}

export async function getBatchesComparison() {
  const batches = await prisma.batch.findMany({
    include: {
      trainer: { select: { name: true, email: true } },
      trainees: { select: { id: true } },
      sessions: {
        include: {
          results: {
            select: {
              id: true,
              traineeId: true,
              score: true,
              errors: true,
              timeSeconds: true,
            },
          },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  return batches.map((b) => {
    const allResults = b.sessions.flatMap((s) => s.results);
    const totalResults = allResults.length;
    const sessionCount = b.sessions.length;
    const traineeCount = b.trainees.length;

    let avgScore = 0;
    let avgErrors = 0;
    let avgTimeSeconds = 0;

    if (totalResults > 0) {
      const sumScore = allResults.reduce((acc, r) => acc + r.score, 0);
      const sumErrors = allResults.reduce((acc, r) => acc + r.errors, 0);
      const sumTime = allResults.reduce((acc, r) => acc + r.timeSeconds, 0);

      avgScore = Number((sumScore / totalResults).toFixed(2));
      avgErrors = Number((sumErrors / totalResults).toFixed(2));
      avgTimeSeconds = Math.round(sumTime / totalResults);
    }

    // At risk trainees in this batch (avg score < 50)
    const traineeScores = new Map<string, number[]>();
    for (const r of allResults) {
      const scores = traineeScores.get(r.traineeId) || [];
      scores.push(r.score);
      traineeScores.set(r.traineeId, scores);
    }

    let atRiskCount = 0;
    for (const scores of traineeScores.values()) {
      if (scores.length > 0) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (mean < 50) atRiskCount++;
      }
    }

    const status: PerformanceStatus = calculatePerformanceStatus(avgScore);

    return {
      batchId: b.id,
      batchName: b.name,
      program: b.program,
      startDate: b.startDate,
      endDate: b.endDate,
      trainer: {
        name: b.trainer?.name || 'Unassigned',
        email: b.trainer?.email || '',
      },
      traineeCount,
      sessionCount,
      totalResults,
      avgScore,
      avgErrors,
      avgTimeSeconds,
      atRiskCount,
      status,
    };
  });
}

export async function getTraineeAnalytics(traineeId: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      batch: {
        include: {
          trainer: { select: { id: true, name: true, email: true } },
          sessions: {
            select: { id: true, title: true, heldOn: true, passMark: true },
            orderBy: { heldOn: 'asc' },
          },
        },
      },
      attendances: {
        include: {
          session: { select: { id: true, title: true, heldOn: true } },
        },
      },
      results: {
        include: {
          session: {
            include: {
              topic: true,
            },
          },
        },
        orderBy: {
          session: {
            heldOn: 'asc',
          },
        },
      },
    },
  });

  if (!trainee) {
    throw new NotFoundError('Trainee not found');
  }

  const results = trainee.results;
  const sessionsAttended = results.length;

  let avgScore = 0;
  let errorRate = 0;
  let avgTimeSeconds = 0;
  let highestScore = 0;
  let lowestScore = 0;

  if (sessionsAttended > 0) {
    const sumScore = results.reduce((acc, r) => acc + r.score, 0);
    const sumErrors = results.reduce((acc, r) => acc + r.errors, 0);
    const sumTime = results.reduce((acc, r) => acc + r.timeSeconds, 0);
    const scores = results.map((r) => r.score);

    avgScore = Number((sumScore / sessionsAttended).toFixed(2));
    errorRate = Number((sumErrors / sessionsAttended).toFixed(2));
    avgTimeSeconds = Math.round(sumTime / sessionsAttended);
    highestScore = Math.max(...scores);
    lowestScore = Math.min(...scores);
  }

  // Attendance Analytics
  const batchSessions = trainee.batch.sessions;
  const totalScheduled = batchSessions.length;
  const attendanceMap = new Map(trainee.attendances.map((a) => [a.sessionId, a]));

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;

  for (const session of batchSessions) {
    const att = attendanceMap.get(session.id);
    if (!att) {
      // Default to PRESENT if session had results
      const hasResult = results.some((r) => r.sessionId === session.id);
      if (hasResult) presentCount++;
      else absentCount++;
    } else {
      if (att.status === AttendanceStatus.PRESENT) presentCount++;
      else if (att.status === AttendanceStatus.LATE) lateCount++;
      else if (att.status === AttendanceStatus.ABSENT) absentCount++;
      else if (att.status === AttendanceStatus.EXCUSED) excusedCount++;
    }
  }

  const effectiveTotal = Math.max(1, totalScheduled);
  const attendanceRate = Math.round(((presentCount + lateCount) / effectiveTotal) * 100);

  // Absence & Low Score Correlation Analysis
  let absenceScoreCorrelationFlag = false;
  let correlationInsight = 'Attendance is regular with no adverse performance impacts detected.';

  if (absentCount > 0 || lateCount > 0) {
    // Check scores for sessions with late/absent attendance vs present
    const presentScores: number[] = [];
    const disruptedScores: number[] = [];

    for (const r of results) {
      const att = attendanceMap.get(r.sessionId);
      if (att && (att.status === AttendanceStatus.ABSENT || att.status === AttendanceStatus.LATE)) {
        disruptedScores.push(r.score);
      } else {
        presentScores.push(r.score);
      }
    }

    const avgPresent = presentScores.length > 0 ? presentScores.reduce((a, b) => a + b, 0) / presentScores.length : avgScore;
    const avgDisrupted = disruptedScores.length > 0 ? disruptedScores.reduce((a, b) => a + b, 0) / disruptedScores.length : 0;

    if (absentCount >= 2 || (disruptedScores.length > 0 && avgDisrupted < avgPresent - 10)) {
      absenceScoreCorrelationFlag = true;
      correlationInsight = `Absences correlate with performance drop: average score drops from ${avgPresent.toFixed(1)}% (present) to ${avgDisrupted > 0 ? avgDisrupted.toFixed(1) + '%' : 'unassessed'} on missed/late sessions.`;
    }
  }

  // Topic breakdown
  const topicMap = new Map<string, { topicId: string; topicName: string; results: typeof results }>();
  for (const r of results) {
    const topic = r.session.topic;
    if (!topicMap.has(topic.id)) {
      topicMap.set(topic.id, { topicId: topic.id, topicName: topic.name, results: [] });
    }
    topicMap.get(topic.id)!.results.push(r);
  }

  const topicBreakdown = Array.from(topicMap.values()).map((t) => {
    const count = t.results.length;
    const avgS = Number((t.results.reduce((acc, r) => acc + r.score, 0) / count).toFixed(2));
    const avgE = Number((t.results.reduce((acc, r) => acc + r.errors, 0) / count).toFixed(2));
    const avgT = Math.round(t.results.reduce((acc, r) => acc + r.timeSeconds, 0) / count);

    return {
      topicId: t.topicId,
      topicName: t.topicName,
      sessionCount: count,
      avgScore: avgS,
      avgErrors: avgE,
      avgTimeSeconds: avgT,
      status: calculatePerformanceStatus(avgS),
    };
  });

  const sessionHistory = results.map((r) => {
    const att = attendanceMap.get(r.sessionId);
    return {
      sessionId: r.session.id,
      sessionTitle: r.session.title,
      topicName: r.session.topic.name,
      heldOn: r.session.heldOn,
      passMark: r.session.passMark,
      attendance: att ? { status: att.status, notes: att.notes } : { status: AttendanceStatus.PRESENT, notes: null },
      result: {
        id: r.id,
        score: r.score,
        errors: r.errors,
        timeSeconds: r.timeSeconds,
        notes: r.notes,
        passed: r.score >= r.session.passMark,
        status: calculatePerformanceStatus(r.score),
        createdAt: r.createdAt,
      },
    };
  });

  // Query trainee goals
  const traineeGoals = await prisma.goal.findMany({
    where: {
      OR: [
        { scope: GoalScope.TRAINEE, scopeId: trainee.id },
        { scope: GoalScope.BATCH, scopeId: trainee.batchId },
      ],
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  const goalsWithProgress = await Promise.all(
    traineeGoals.map(async (g) => {
      const prog = await calculateGoalProgress(g);
      return {
        ...g,
        scopeName: prog.scopeName,
        progress: prog,
      };
    })
  );

  return {
    trainee: {
      id: trainee.id,
      userId: trainee.userId,
      name: trainee.user.name,
      email: trainee.user.email,
      batch: {
        id: trainee.batch.id,
        name: trainee.batch.name,
        program: trainee.batch.program,
        trainer: trainee.batch.trainer,
      },
    },
    summary: {
      avgScore,
      errorRate,
      avgTimeSeconds,
      sessionsAttended,
      highestScore,
      lowestScore,
      status: calculatePerformanceStatus(avgScore),
      improvement: calculateImprovement(results.map((r) => r.score)),
      consistency: calculateConsistency(results.map((r) => r.score)),
      projection: calculateScoreProjection(results.map((r) => r.score), totalScheduled || 10),
      atRisk: evaluateAtRisk({
        scores: results.map((r) => r.score),
        errors: results.map((r) => r.errors),
        traineeAverage: avgScore,
        batchAverage: 75,
        recentAttendance: trainee.attendances.map((a) => a.status),
      }),
      attendance: {
        rate: attendanceRate,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        excused: excusedCount,
        totalScheduled,
        absenceScoreCorrelationFlag,
        correlationInsight,
      },
    },
    goals: goalsWithProgress,
    topicBreakdown,
    sessionHistory,
  };
}

export async function getHeatmapAnalytics(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, program: true },
  });

  if (!batch) {
    throw new NotFoundError('Batch not found');
  }

  const sessions = await prisma.session.findMany({
    where: { batchId },
    orderBy: { heldOn: 'asc' },
    select: { id: true, title: true, heldOn: true, passMark: true },
  });

  const trainees = await prisma.trainee.findMany({
    where: { batchId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      results: {
        where: {
          sessionId: { in: sessions.map((s) => s.id) },
        },
      },
    },
    orderBy: {
      user: { name: 'asc' },
    },
  });

  const matrix = trainees.map((t) => {
    const scoresMap: Record<string, any> = {};
    const resultsBySession = new Map(t.results.map((r) => [r.sessionId, r]));

    for (const session of sessions) {
      const result = resultsBySession.get(session.id);
      if (result) {
        scoresMap[session.id] = {
          resultId: result.id,
          score: result.score,
          errors: result.errors,
          timeSeconds: result.timeSeconds,
          status: calculatePerformanceStatus(result.score),
        };
      } else {
        scoresMap[session.id] = null;
      }
    }

    return {
      traineeId: t.id,
      name: t.user.name,
      email: t.user.email,
      scores: scoresMap,
    };
  });

  return {
    batch,
    sessions,
    matrix,
  };
}
