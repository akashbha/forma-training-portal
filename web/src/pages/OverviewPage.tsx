import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { StatCard } from '../components/ui/StatCard';
import { ChartCard } from '../components/ui/ChartCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { InsightSentencesList, InsightSentenceItem } from '../components/ui/InsightSentencesList';
import { AtRiskPanel, AtRiskTraineeItem } from '../components/ui/AtRiskPanel';
import { useFilters } from '../context/FilterContext';
import { api } from '../lib/api';
import {
  OverviewAnalytics,
  TrendPoint,
  BatchComparisonRow,
  Trainee,
  Session,
} from '../types/api';
import { formatScore, formatDuration, formatDate } from '../lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Plus, ArrowRight, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { batchId, dateRange, setBatchId } = useFilters();
  const { isTrainer, isAdmin, isTrainee, user } = useAuth();
  const [metricToggle, setMetricToggle] = useState<'score' | 'errors' | 'time'>('score');

  // Trainee role guard: trainees should view their personal performance dashboard
  React.useEffect(() => {
    if (isTrainee) {
      const traineeId = user?.traineeId;
      if (traineeId) {
        navigate(`/trainees/${traineeId}`, { replace: true });
      } else {
        navigate('/trainees', { replace: true });
      }
    }
  }, [isTrainee, user, navigate]);

  // Query Overview Analytics
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['analytics-overview', batchId, dateRange],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      return api.get<{ data: OverviewAnalytics }>(`/api/v1/analytics/overview?${params.toString()}`);
    },
  });

  // Query Insight Sentences (Max 5 data-grounded insights)
  const {
    data: sentencesRes,
    isLoading: isSentencesLoading,
  } = useQuery({
    queryKey: ['insights-overview-sentences'],
    queryFn: () => api.get<{ data: { sentences: InsightSentenceItem[] } }>('/api/v1/insights/overview-sentences'),
  });

  // Query At-Risk Trainees with explainable reasons
  const {
    data: atRiskRes,
    isLoading: isAtRiskLoading,
  } = useQuery({
    queryKey: ['insights-at-risk', batchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      return api.get<{ data: { trainees: AtRiskTraineeItem[] } }>(`/api/v1/insights/at-risk?${params.toString()}`);
    },
  });

  // Query Trend Analytics
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isError: isTrendError,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: ['analytics-trend', batchId, dateRange],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      params.append('groupBy', 'week');
      return api.get<{ series: TrendPoint[] }>(`/api/v1/analytics/trend?${params.toString()}`);
    },
  });

  // Query Batch Comparison (only needed for Trainers / Admins)
  const {
    data: batchesData,
    isLoading: isBatchesLoading,
    isError: isBatchesError,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ['analytics-batches-compare'],
    queryFn: () => api.get<{ data: BatchComparisonRow[] }>('/api/v1/analytics/batches/compare'),
    enabled: !isTrainee,
  });

  // Query Recent Sessions
  const { data: recentSessionsData, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['recent-sessions', batchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      params.append('limit', '5');
      return api.get<{ data: Session[] }>(`/api/v1/sessions?${params.toString()}`);
    },
  });

  // Query Trainees for Needs Attention list
  const { data: traineesData, isLoading: isTraineesLoading } = useQuery({
    queryKey: ['trainees-attention', batchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      params.append('limit', '50');
      return api.get<{ data: Trainee[] }>(`/api/v1/trainees?${params.toString()}`);
    },
  });

  if (isOverviewError || isTrendError || (!isTrainee && isBatchesError)) {
    return (
      <ErrorState
        title="Unable to load dashboard metrics"
        message="An error occurred while fetching training analytics. Please check your connection."
        onRetry={() => {
          refetchOverview();
          refetchTrend();
          if (!isTrainee) refetchBatches();
        }}
      />
    );
  }

  const current = overviewData?.data.current;
  const delta = overviewData?.data.delta;
  const goals = overviewData?.data.goals || [];
  const series = trendData?.series || [];
  const batches = batchesData?.data || [];
  const recentSessions = recentSessionsData?.data || [];
  const sentences = sentencesRes?.data.sentences || [];
  const atRiskTrainees = atRiskRes?.data.trainees || [];

  // Find goal relevant to current metric toggle
  const activeMetricGoal = goals.find((g) => {
    if (metricToggle === 'score') return g.metric === 'SCORE';
    if (metricToggle === 'errors') return g.metric === 'ERRORS';
    return g.metric === 'TIME';
  });

  // Trend Chart dynamic summary
  let trendSummary = 'Performance metrics recorded across training weeks.';
  if (series.length >= 2) {
    const first = series[0];
    const last = series[series.length - 1];
    if (metricToggle === 'score') {
      const diff = last.avgScore - first.avgScore;
      trendSummary = `Average score changed from ${first.avgScore}% to ${last.avgScore}% (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%) across ${series.length} weeks.`;
    } else if (metricToggle === 'errors') {
      trendSummary = `Error rate shifted from ${first.avgErrors} to ${last.avgErrors} errors per session over ${series.length} weeks.`;
    } else {
      trendSummary = `Average duration changed from ${formatDuration(first.avgTimeSeconds)} to ${formatDuration(last.avgTimeSeconds)} over ${series.length} weeks.`;
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Heading & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Training Overview
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Real-time cohort evaluations, error rates, and progress analytics.
          </p>
        </div>

        {(isTrainer || isAdmin) && (
          <div className="flex items-center gap-2">
            <Link to="/compare">
              <Button variant="outline" size="sm">
                Compare Cohorts
              </Button>
            </Link>
            <Link to="/sessions/new">
              <Button variant="primary" size="sm" className="gap-1.5 shadow-xs">
                <Plus className="w-4 h-4" />
                Record Session Results
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 0. Insight Sentences Strip (Max 5 data-grounded insights) */}
      <InsightSentencesList sentences={sentences} isLoading={isSentencesLoading} />

      {/* 1. Four StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Average Score"
          value={current ? `${current.avgScore}%` : '—'}
          delta={delta?.avgScore}
          infoTooltip="Mean assessment score across all evaluated sessions in the selected period."
          isLoading={isOverviewLoading}
          onClick={() => navigate('/trainees')}
        />
        <StatCard
          label="Errors per Session"
          value={current ? current.errorRate : '—'}
          delta={delta?.errorRate}
          isPositiveImprovement={false}
          infoTooltip="Mean compilation, test, and logic errors recorded per trainee per session."
          isLoading={isOverviewLoading}
          onClick={() => navigate('/trainees')}
        />
        <StatCard
          label="Average Duration"
          value={current ? formatDuration(current.avgTimeSeconds) : '—'}
          delta={delta?.avgTimeSeconds ? Math.round(delta.avgTimeSeconds / 60) : undefined}
          unit={delta?.avgTimeSeconds ? 'min delta' : undefined}
          isPositiveImprovement={false}
          infoTooltip="Average completion duration across hands-on sessions."
          isLoading={isOverviewLoading}
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          label="Trainees at Risk"
          value={atRiskTrainees.length}
          delta={delta?.traineesAtRisk}
          isPositiveImprovement={false}
          infoTooltip="Number of trainees flagged by the rule-based explainable at-risk detection engine."
          isLoading={isOverviewLoading || isAtRiskLoading}
          onClick={() => navigate('/trainees')}
        />
      </div>

      {/* 1.2 At-Risk Trainees Action Panel */}
      <AtRiskPanel trainees={atRiskTrainees} isLoading={isAtRiskLoading} />

      {/* 1.5. Active Goals Progress Strip */}
      {goals.length > 0 && (
        <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border-main)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Active Goals & Targets
              </h3>
            </div>
            <Link to="/goals" className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1">
              View All Goals <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {goals.slice(0, 3).map((g) => (
              <div key={g.id} className="p-3 bg-[var(--background)] border border-[var(--border-main)] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-main)] truncate max-w-[180px]">
                    {g.scopeName || g.scope}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-[var(--primary)]">
                    Target: {g.targetValue}{g.metric === 'SCORE' ? '%' : g.metric === 'ERRORS' ? ' err' : 's'}
                  </span>
                </div>
                {g.progress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>Current: {g.progress.currentValue}</span>
                      <span className={g.progress.isAchieved ? 'text-emerald-600 font-bold' : ''}>
                        {g.progress.percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          g.progress.isAchieved ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, g.progress.percentage)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Charts Section (Progress Trend & Batch Comparison) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Progress Trend Chart (2 columns) */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Cohort Performance Progression"
            description="Weekly aggregated metrics with pass-mark baseline."
            textSummary={trendSummary}
            isLoading={isTrendLoading}
            actions={
              <div className="flex items-center gap-1 p-0.5 bg-[var(--background)] rounded-lg text-xs border border-[var(--border-main)]">
                {(['score', 'errors', 'time'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetricToggle(m)}
                    className={`px-2.5 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                      metricToggle === m
                        ? 'bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {m === 'time' ? 'Duration' : m}
                  </button>
                ))}
              </div>
            }
            tableView={
              <div className="p-2 table-responsive-container">
                <table className="w-full text-xs text-left table-sticky-col">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] font-semibold text-[var(--text-muted)]">
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3 text-right">Avg Score</th>
                      <th className="py-2 px-3 text-right">Avg Errors</th>
                      <th className="py-2 px-3 text-right">Avg Duration</th>
                      <th className="py-2 px-3 text-right">Sample Size (n)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {series.map((s) => (
                      <tr key={s.period} className="hover:bg-[var(--background)]">
                        <td className="py-2 px-3 font-medium">{s.period}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{s.avgScore}%</td>
                        <td className="py-2 px-3 text-right font-mono">{s.avgErrors}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatDuration(s.avgTimeSeconds)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{s.sampleSize}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          >
            {series.length === 0 ? (
              <EmptyState
                title="No trend points recorded"
                message="Add session evaluations to generate weekly performance charts."
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      domain={metricToggle === 'score' ? [0, 100] : ['auto', 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as TrendPoint;
                          return (
                            <div className="bg-[var(--surface)] p-2.5 border border-[var(--border-main)] rounded-lg shadow-md text-xs">
                              <p className="font-semibold text-[var(--text-main)] mb-1">
                                Week: {label}
                              </p>
                              {metricToggle === 'score' && (
                                <p className="text-[var(--primary)] font-bold">
                                  Score: {data.avgScore}%
                                </p>
                              )}
                              {metricToggle === 'errors' && (
                                <p className="text-[var(--danger)] font-bold">
                                  Errors: {data.avgErrors} avg
                                </p>
                              )}
                              {metricToggle === 'time' && (
                                <p className="text-[var(--text-main)] font-bold">
                                  Duration: {formatDuration(data.avgTimeSeconds)}
                                </p>
                              )}
                              <p className="text-[var(--text-muted)] mt-0.5">
                                Sample size: <span className="font-semibold">{data.sampleSize} results</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {metricToggle === 'score' && (
                      <ReferenceLine
                        y={70}
                        stroke="#15803d"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Pass Mark (70%)',
                          fill: '#15803d',
                          fontSize: 10,
                          position: 'top',
                        }}
                      />
                    )}
                    {activeMetricGoal && (
                      <ReferenceLine
                        y={activeMetricGoal.targetValue}
                        stroke="#e11d48"
                        strokeDasharray="6 4"
                        strokeWidth={1.8}
                        label={{
                          value: `Target Goal (${activeMetricGoal.targetValue}${metricToggle === 'score' ? '%' : ''})`,
                          fill: '#e11d48',
                          fontSize: 10,
                          position: 'bottom',
                        }}
                      />
                    )}
                    <Line
                      type="linear"
                      dataKey={
                        metricToggle === 'score'
                          ? 'avgScore'
                          : metricToggle === 'errors'
                          ? 'avgErrors'
                          : 'avgTimeSeconds'
                      }
                      stroke={metricToggle === 'errors' ? '#c2410c' : '#1d4ed8'}
                      strokeWidth={2.2}
                      dot={{ r: 4, fill: metricToggle === 'errors' ? '#c2410c' : '#1d4ed8' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Batch Comparison Bar Chart (1 column) */}
        <div>
          <ChartCard
            title="Batch Comparison"
            description="Average score comparison across active cohorts."
            textSummary="Click any cohort bar to filter the portal dashboard."
            isLoading={isBatchesLoading}
            tableView={
              <div className="p-2 table-responsive-container">
                <table className="w-full text-xs text-left table-sticky-col">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] font-semibold text-[var(--text-muted)]">
                      <th className="py-2 px-3">Batch</th>
                      <th className="py-2 px-3 text-right">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {batches.map((b) => (
                      <tr key={b.batchId} className="hover:bg-[var(--background)]">
                        <td className="py-2 px-3 font-medium">{b.batchName}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{b.avgScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          >
            {batches.length === 0 ? (
              <EmptyState title="No batches" message="No active batches found." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={batches}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length) {
                        const bId = (e.activePayload[0].payload as BatchComparisonRow).batchId;
                        setBatchId(bId);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-main)" />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} stroke="var(--text-muted)" />
                    <YAxis
                      dataKey="batchName"
                      type="category"
                      width={90}
                      fontSize={10}
                      stroke="var(--text-muted)"
                      tickFormatter={(val) => val.split(':')[0]}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Average Score']}
                      labelFormatter={(label) => `Cohort: ${label}`}
                    />
                    <Bar
                      dataKey="avgScore"
                      fill="#1d4ed8"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer hover:opacity-85"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* 3. Lower Section: "Needs Attention" List & "Recent Sessions" List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention List */}
        <div className="card-flat p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-main)]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
              <h3 className="text-base font-semibold text-[var(--text-main)]">Needs Attention</h3>
            </div>
            <Link
              to="/trainees?status=AT_RISK"
              className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              View all &rarr;
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-main)] my-2">
            {isTraineesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-3 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                    <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  </div>
                  <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                </div>
              ))
            ) : (
              (traineesData?.data || []).slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/trainees/${t.id}`)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-[var(--background)] px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">{t.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{t.batch.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status="NEEDS_SUPPORT" size="sm" />
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-main)]">
            Trainees with evaluation averages below pass mark or elevated compilation errors.
          </p>
        </div>

        {/* Recent Sessions List */}
        <div className="card-flat p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-main)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-base font-semibold text-[var(--text-main)]">Recent Sessions</h3>
            </div>
            <Link
              to="/sessions"
              className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              View all &rarr;
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-main)] my-2">
            {isSessionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-3 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="w-40 h-4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                    <div className="w-28 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  </div>
                  <div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                </div>
              ))
            ) : recentSessions.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">No sessions recorded yet.</p>
            ) : (
              recentSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-[var(--background)] px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="truncate">
                    <p className="text-sm font-semibold text-[var(--text-main)] truncate">{s.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {s.batch.name} &middot; {formatDate(s.heldOn)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-medium text-[var(--text-main)]">
                      {s.resultsCount} submissions
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-main)]">
            Click any session to view individual scores and feedback notes.
          </p>
        </div>
      </div>
    </div>
  );
};
