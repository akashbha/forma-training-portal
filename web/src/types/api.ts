export type Role = 'ADMIN' | 'TRAINER' | 'TRAINEE';
export type PerformanceStatus = 'ON_TRACK' | 'NEEDS_SUPPORT' | 'AT_RISK';

export type GoalScope = 'BATCH' | 'TOPIC' | 'TRAINEE';
export type GoalMetric = 'SCORE' | 'ERRORS' | 'TIME';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'LOGIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  traineeId?: string | null;
  batchId?: string | null;
  createdAt?: string;
}

export interface Batch {
  id: string;
  name: string;
  program: string;
  startDate: string;
  endDate: string;
  trainer: {
    id: string;
    name: string;
    email: string;
  };
  traineeCount?: number;
  sessionCount?: number;
  createdAt: string;
}

export interface Trainee {
  id: string;
  userId: string;
  name: string;
  email: string;
  batch: {
    id: string;
    name: string;
    program: string;
    trainer?: {
      id: string;
      name: string;
      email: string;
    };
  };
  resultsCount?: number;
  attendancesCount?: number;
  createdAt: string;
}

export interface Topic {
  id: string;
  name: string;
  sessionCount?: number;
  createdAt: string;
}

export interface Session {
  id: string;
  title: string;
  heldOn: string;
  passMark: number;
  topic: Topic;
  batch: {
    id: string;
    name: string;
    program?: string;
    trainer?: { id: string; name: string };
  };
  resultsCount?: number;
  attendancesCount?: number;
  createdAt: string;
}

export interface Attendance {
  id: string;
  sessionId: string;
  traineeId: string;
  status: AttendanceStatus;
  notes?: string | null;
  createdAt: string;
  trainee?: {
    id: string;
    user: { id: string; name: string; email: string };
  };
  session?: {
    id: string;
    title: string;
    heldOn: string;
  };
}

export interface Result {
  id: string;
  sessionId: string;
  traineeId: string;
  score: number;
  errors: number;
  timeSeconds: number;
  notes?: string | null;
  createdAt: string;
  session?: {
    id: string;
    title: string;
    passMark: number;
    heldOn?: string;
  };
  trainee?: {
    id: string;
    user: { id: string; name: string; email?: string };
  };
}

export interface Goal {
  id: string;
  scope: GoalScope;
  scopeId: string;
  scopeName?: string;
  metric: GoalMetric;
  targetValue: number;
  dueDate: string;
  createdBy: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  progress?: {
    currentValue: number;
    targetValue: number;
    percentage: number;
    isAchieved: boolean;
    sampleCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string | null;
  createdAt: string;
}

export interface OverviewMetrics {
  avgScore: number;
  errorRate: number;
  avgTimeSeconds: number;
  traineesAtRisk: number;
  totalResults: number;
  totalSessions: number;
}

export interface OverviewAnalytics {
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
  goals?: Goal[];
}

export interface TrendPoint {
  period: string;
  sessionId?: string;
  date?: string;
  avgScore: number;
  avgErrors: number;
  avgTimeSeconds: number;
  sampleSize: number;
}

export interface BatchComparisonRow {
  batchId: string;
  batchName: string;
  program: string;
  startDate: string;
  endDate: string;
  trainer: {
    name: string;
    email: string;
  };
  traineeCount: number;
  sessionCount: number;
  totalResults: number;
  avgScore: number;
  avgErrors: number;
  avgTimeSeconds: number;
  atRiskCount: number;
  status: PerformanceStatus;
}

export interface TraineeDetailAnalytics {
  trainee: {
    id: string;
    userId: string;
    name: string;
    email: string;
    batch: {
      id: string;
      name: string;
      program: string;
      trainer?: { id: string; name: string; email: string };
    };
  };
  summary: {
    avgScore: number;
    errorRate: number;
    avgTimeSeconds: number;
    sessionsAttended: number;
    highestScore: number;
    lowestScore: number;
    status: PerformanceStatus;
    attendance?: {
      rate: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      totalScheduled: number;
      absenceScoreCorrelationFlag: boolean;
      correlationInsight: string;
    };
  };
  goals?: Goal[];
  topicBreakdown: Array<{
    topicId: string;
    topicName: string;
    sessionCount: number;
    avgScore: number;
    avgErrors: number;
    avgTimeSeconds: number;
    status: PerformanceStatus;
  }>;
  sessionHistory: Array<{
    sessionId: string;
    sessionTitle: string;
    topicName: string;
    heldOn: string;
    passMark: number;
    attendance?: {
      status: AttendanceStatus;
      notes?: string | null;
    };
    result: {
      id: string;
      score: number;
      errors: number;
      timeSeconds: number;
      notes?: string | null;
      passed: boolean;
      status: PerformanceStatus;
      createdAt: string;
    };
  }>;
}

export interface HeatmapData {
  batch: {
    id: string;
    name: string;
    program: string;
  };
  sessions: Array<{
    id: string;
    title: string;
    heldOn: string;
    passMark: number;
  }>;
  matrix: Array<{
    traineeId: string;
    name: string;
    email: string;
    scores: Record<
      string,
      {
        resultId: string;
        score: number;
        errors: number;
        timeSeconds: number;
        status: PerformanceStatus;
      } | null
    >;
  }>;
}
