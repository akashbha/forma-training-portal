import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/ui/DataTable';
import { Heatmap } from '../components/ui/Heatmap';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Sparkline } from '../components/ui/Sparkline';
import { WeakTopicsHeatmap, BatchWeakTopic, TraineeTopicRow } from '../components/ui/WeakTopicsHeatmap';
import { AtRiskPanel, AtRiskTraineeItem } from '../components/ui/AtRiskPanel';
import { api } from '../lib/api';
import { Batch, HeatmapData } from '../types/api';
import { formatDate, formatScore, getPerformanceStatus } from '../lib/utils';
import { ArrowLeft, User, Calendar, Layers, ArrowLeftRight } from 'lucide-react';

interface TraineeRankingRow {
  id: string;
  rank: number;
  name: string;
  email: string;
  sessionsCount: number;
  avgScore: number;
  scoresHistory: number[];
  status: 'ON_TRACK' | 'NEEDS_SUPPORT' | 'AT_RISK';
}

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1. Fetch Batch Details
  const {
    data: batchData,
    isLoading: isBatchLoading,
    isError: isBatchError,
    refetch: refetchBatch,
  } = useQuery({
    queryKey: ['batch-detail', id],
    queryFn: () => api.get<{ data: Batch }>(`/api/v1/batches/${id}`),
    enabled: Boolean(id),
  });

  // 2. Fetch Heatmap Matrix Data
  const {
    data: heatmapData,
    isLoading: isHeatmapLoading,
    isError: isHeatmapError,
  } = useQuery({
    queryKey: ['batch-heatmap', id],
    queryFn: () => api.get<{ data: HeatmapData }>(`/api/v1/analytics/heatmap?batchId=${id}`),
    enabled: Boolean(id),
  });

  // 3. Fetch Weak Topics for this batch
  const {
    data: weakTopicsData,
    isLoading: isWeakTopicsLoading,
  } = useQuery({
    queryKey: ['batch-weak-topics', id],
    queryFn: () =>
      api.get<{
        data: {
          rankedWeakest: BatchWeakTopic[];
          matrix: { topics: { id: string; name: string }[]; rows: TraineeTopicRow[] };
        };
      }>(`/api/v1/insights/weak-topics?batchId=${id}`),
    enabled: Boolean(id),
  });

  // 4. Fetch At-Risk trainees for this batch
  const {
    data: atRiskData,
    isLoading: isAtRiskLoading,
  } = useQuery({
    queryKey: ['batch-at-risk', id],
    queryFn: () =>
      api.get<{ data: { trainees: AtRiskTraineeItem[] } }>(`/api/v1/insights/at-risk?batchId=${id}`),
    enabled: Boolean(id),
  });

  if (isBatchError || isHeatmapError) {
    return (
      <ErrorState
        title="Failed to load batch details"
        message="Could not retrieve batch records. Please verify the ID and try again."
        onRetry={() => refetchBatch()}
      />
    );
  }

  const batch = batchData?.data;
  const heatmap = heatmapData?.data;
  const weakTopics = weakTopicsData?.data;
  const atRiskTrainees = atRiskData?.data.trainees || [];

  // Compute Ranking Table from Heatmap Matrix
  const rankingRows: TraineeRankingRow[] = [];
  if (heatmap?.matrix) {
    heatmap.matrix.forEach((item) => {
      const validScores: number[] = [];
      Object.values(item.scores).forEach((val) => {
        if (val && typeof val.score === 'number') {
          validScores.push(val.score);
        }
      });

      const avgScore =
        validScores.length > 0
          ? validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length
          : 0;

      rankingRows.push({
        id: item.traineeId,
        rank: 0,
        name: item.name,
        email: item.email,
        sessionsCount: validScores.length,
        avgScore: Number(avgScore.toFixed(1)),
        scoresHistory: validScores,
        status: getPerformanceStatus(avgScore),
      });
    });

    // Sort descending by avgScore
    rankingRows.sort((a, b) => b.avgScore - a.avgScore);
    rankingRows.forEach((row, idx) => {
      row.rank = idx + 1;
    });
  }

  const rankingColumns: ColumnDef<TraineeRankingRow>[] = [
    {
      accessorKey: 'rank',
      header: 'Rank',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-bold text-xs text-[var(--text-muted)]">#{row.original.rank}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Trainee',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{row.original.name}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'scoresHistory',
      header: 'Progression Trend',
      cell: ({ row }) => <Sparkline data={row.original.scoresHistory} />,
    },
    {
      accessorKey: 'sessionsCount',
      header: 'Sessions',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono">{row.original.sessionsCount}</span>
      ),
    },
    {
      accessorKey: 'avgScore',
      header: 'Average Score',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-bold text-[var(--text-main)]">{formatScore(row.original.avgScore)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Performance Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Back button and quick actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded py-1 px-1 -ml-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Batches
        </button>

        <Link
          to={`/compare?type=batch&idA=${id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--background)] transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Compare this Cohort</span>
        </Link>
      </div>

      {/* Batch Header Info */}
      {isBatchLoading ? (
        <Skeleton variant="card" className="h-32" />
      ) : (
        <div className="card-flat p-6 bg-[var(--surface)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-semibold mb-2">
                <Layers className="w-3.5 h-3.5" />
                {batch?.program}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
                {batch?.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] border-t md:border-t-0 md:border-l border-[var(--border-main)] pt-3 md:pt-0 md:pl-6">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-[var(--primary)]" />
                <div>
                  <span className="text-[11px] block">Lead Trainer</span>
                  <span className="font-semibold text-[var(--text-main)]">{batch?.trainer?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[var(--primary)]" />
                <div>
                  <span className="text-[11px] block">Duration</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {formatDate(batch?.startDate)} &ndash; {formatDate(batch?.endDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* At-Risk Trainees Panel for this batch */}
      {atRiskTrainees.length > 0 && (
        <AtRiskPanel trainees={atRiskTrainees} isLoading={isAtRiskLoading} />
      )}

      {/* Weak Topic Analysis & Ranking */}
      {weakTopics && (
        <WeakTopicsHeatmap
          rankedWeakest={weakTopics.rankedWeakest}
          topics={weakTopics.matrix.topics}
          rows={weakTopics.matrix.rows}
        />
      )}

      {/* 1. Trainee Performance Heatmap Matrix */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--text-main)]">
          Session-by-Session Evaluation Heatmap
        </h2>
        {isHeatmapLoading || !heatmap ? (
          <Skeleton variant="chart" />
        ) : (
          <Heatmap
            data={heatmap}
            onCellClick={(traineeId) => navigate(`/trainees/${traineeId}`)}
          />
        )}
      </section>

      {/* 2. Trainee Standings & Ranking Table */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--text-main)]">
          Cohort Standings & Ranking Table
        </h2>
        <DataTable
          columns={rankingColumns}
          data={rankingRows}
          isLoading={isHeatmapLoading}
          onRowClick={(row) => navigate(`/trainees/${row.id}`)}
          emptyTitle="No trainees enrolled"
          emptyMessage="No trainee performance records found for this cohort."
        />
      </section>
    </div>
  );
};
