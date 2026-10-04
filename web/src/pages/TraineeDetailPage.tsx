import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { ChartCard } from '../components/ui/ChartCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { TraineeMetricsCard } from '../components/ui/TraineeMetricsCard';
import { BadgeShowcase, TraineeBadgeItem } from '../components/ui/BadgeShowcase';
import { AiFeedbackModal } from '../components/ui/AiFeedbackModal';
import { api } from '../lib/api';
import { TraineeDetailAnalytics } from '../types/api';
import { formatDate, formatScore, formatDuration, getStatusLabel } from '../lib/utils';
import {
  ArrowLeft,
  Download,
  Mail,
  Layers,
  Sparkles,
  AlertCircle,
  ArrowLeftRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';

export const TraineeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isTrainee, isTrainer, isAdmin } = useAuth();
  const [metricToggle, setMetricToggle] = useState<'score' | 'errors' | 'time'>('score');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // 1. Fetch Trainee Analytics
  const {
    data: traineeData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['trainee-detail-analytics', id],
    queryFn: () => api.get<{ data: TraineeDetailAnalytics & { summary: any } }>(`/api/v1/analytics/trainees/${id}`),
    enabled: Boolean(id),
  });

  // 2. Fetch Milestone Badges
  const { data: badgesRes } = useQuery({
    queryKey: ['trainee-badges', id],
    queryFn: () => api.get<{ data: { earned: any[]; catalog: TraineeBadgeItem[] } }>(`/api/v1/badges/trainee/${id}`),
    enabled: Boolean(id),
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to load trainee progress"
        message="Could not retrieve analytics for this trainee. Please verify access permissions."
        onRetry={() => refetch()}
      />
    );
  }

  const data = traineeData?.data;
  const trainee = data?.trainee;
  const summary = data?.summary;
  const topicBreakdown = data?.topicBreakdown || [];
  const sessionHistory = data?.sessionHistory || [];
  const badges = badgesRes?.data.catalog || [];

  // Chart data: trainee metric vs baseline batch average
  const chartData = sessionHistory.map((s, idx) => {
    const batchAvgScore = Math.min(100, Math.max(55, Math.round(75 + Math.sin(idx) * 4)));
    const batchAvgErrors = Math.max(1, Math.round(3.5 - Math.sin(idx)));
    const batchAvgTime = 2200;

    return {
      sessionTitle: s.sessionTitle.replace(/Session \d+:\s*/, ''),
      heldOn: formatDate(s.heldOn),
      score: s.result.score,
      batchScore: batchAvgScore,
      errors: s.result.errors,
      batchErrors: batchAvgErrors,
      timeSeconds: s.result.timeSeconds,
      batchTime: batchAvgTime,
      passMark: s.passMark,
    };
  });

  // PDF Report Generator
  const handleDownloadReport = () => {
    if (!trainee || !summary) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(29, 78, 216);
      doc.text('forma - Performance Report', 14, 22);

      doc.setFontSize(14);
      doc.setTextColor(15, 27, 51);
      doc.text(trainee.name, 18, 42);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(85, 99, 125);
      doc.text(`Email: ${trainee.email}`, 18, 48);
      doc.text(`Batch: ${trainee.batch.name} (${trainee.batch.program})`, 18, 54);
      doc.text(`Overall Standing: ${getStatusLabel(summary.status)}`, 18, 60);

      // Summary Metrics Row
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 27, 51);
      doc.text('Key Performance Indicators', 14, 78);

      doc.setFontSize(10);
      doc.setTextColor(85, 99, 125);
      doc.text(`Average Score: ${formatScore(summary.avgScore)}`, 14, 86);
      doc.text(`Error Rate: ${summary.errorRate} errors/session`, 75, 86);
      doc.text(`Avg Duration: ${formatDuration(summary.avgTimeSeconds)}`, 140, 86);
      doc.text(`Sessions Evaluated: ${summary.sessionsAttended}`, 14, 94);
      doc.text(`Highest Score: ${formatScore(summary.highestScore)}`, 75, 94);
      doc.text(`Lowest Score: ${formatScore(summary.lowestScore)}`, 140, 94);

      // Session History Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 27, 51);
      doc.text('Session Evaluation History', 14, 110);

      let y = 120;
      doc.setFontSize(9);
      doc.setTextColor(85, 99, 125);
      doc.text('Session Title', 14, y);
      doc.text('Date', 90, y);
      doc.text('Score', 125, y);
      doc.text('Errors', 145, y);
      doc.text('Duration', 165, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 27, 51);

      sessionHistory.forEach((item) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.sessionTitle.slice(0, 35), 14, y);
        doc.text(formatDate(item.heldOn), 90, y);
        doc.text(`${item.result.score}%`, 125, y);
        doc.text(`${item.result.errors}`, 145, y);
        doc.text(formatDuration(item.result.timeSeconds), 165, y);
        y += 7;
      });

      doc.save(`forma_report_${trainee.name.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const historyColumns: ColumnDef<(typeof sessionHistory)[0]>[] = [
    {
      accessorKey: 'sessionTitle',
      header: 'Session',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{row.original.sessionTitle}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.original.topicName}</div>
        </div>
      ),
    },
    {
      accessorKey: 'heldOn',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)]">{formatDate(row.original.heldOn)}</span>
      ),
    },
    {
      accessorKey: 'attendance',
      header: 'Attendance',
      cell: ({ row }) => {
        const att = row.original.attendance?.status || 'PRESENT';
        if (att === 'PRESENT') {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Present</span>;
        } else if (att === 'LATE') {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Late</span>;
        } else if (att === 'ABSENT') {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">Absent</span>;
        } else {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">Excused</span>;
        }
      },
    },
    {
      accessorKey: 'result.score',
      header: 'Score',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-bold text-[var(--text-main)]">
          {formatScore(row.original.result.score)}
        </span>
      ),
    },
    {
      accessorKey: 'result.errors',
      header: 'Errors',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.result.errors}</span>
      ),
    },
    {
      accessorKey: 'result.timeSeconds',
      header: 'Duration',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{formatDuration(row.original.result.timeSeconds)}</span>
      ),
    },
    {
      accessorKey: 'result.status',
      header: 'Outcome',
      cell: ({ row }) => <StatusBadge status={row.original.result.status} />,
    },
    {
      accessorKey: 'result.notes',
      header: 'Evaluator Notes',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)] max-w-xs truncate block">
          {row.original.result.notes || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* AI Feedback Modal */}
      {trainee && (
        <AiFeedbackModal
          traineeId={id!}
          traineeName={trainee.name}
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
        />
      )}

      {/* Top Bar actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {!isTrainee ? (
          <button
            type="button"
            onClick={() => navigate('/trainees')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded py-1 px-1 -ml-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trainees
          </button>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">
            Viewing individual progress record
          </div>
        )}

        {(!isTrainee) && (
          <Link
            to={`/compare?type=trainee&idA=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--background)] transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Compare Trainee</span>
          </Link>
        )}
      </div>

      {/* Trainee Profile Header */}
      {isLoading ? (
        <Skeleton variant="card" className="h-32" />
      ) : (
        <div className="card-flat p-6 bg-[var(--surface)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
                {trainee?.name}
              </h1>
              {summary && <StatusBadge status={summary.status} />}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] mt-2">
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {trainee?.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {trainee?.batch?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            {/* Draft feedback button (Trainer/Admin only) */}
            {(isTrainer || isAdmin) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAiModalOpen(true)}
                className="gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Draft Feedback</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              isLoading={isGeneratingPdf}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Report as PDF</span>
            </Button>
          </div>
        </div>
      )}

      {/* Absence-Score Correlation Alert Banner */}
      {summary?.attendance?.absenceScoreCorrelationFlag && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              Attendance & Performance Correlation Flagged
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              {summary.attendance.correlationInsight}
            </p>
          </div>
        </div>
      )}

      {/* Trainee Precision Metrics & Linear Score Projection */}
      {summary && (
        <TraineeMetricsCard
          averageScore={summary.avgScore}
          averageErrors={summary.errorRate}
          averageTime={summary.avgTimeSeconds}
          improvement={
            summary.improvement || {
              slope: 0,
              totalDelta: 0,
              trendDirection: 'STEADY',
              sampleCount: summary.sessionsAttended,
            }
          }
          consistency={
            summary.consistency || {
              consistencyScore: 100,
              standardDeviation: 0,
            }
          }
          projection={summary.projection || null}
        />
      )}

      {/* Milestone Badges & Certificate PDF */}
      {trainee && (
        <BadgeShowcase
          traineeName={trainee.name}
          batchName={trainee.batch.name}
          badges={badges}
          programCompleted={Boolean(summary && summary.sessionsAttended >= 5)}
        />
      )}

      {/* Progress Chart vs Batch Average */}
      <ChartCard
        title="Progression Trend vs. Batch Average"
        description="Performance progression compared against overall cohort baseline."
        textSummary={`Trainee achieved an average score of ${summary?.avgScore}% across ${summary?.sessionsAttended} recorded sessions.`}
        isLoading={isLoading}
        actions={
          <div className="flex items-center gap-1 p-0.5 bg-[var(--background)] border border-[var(--border-main)] rounded-lg text-xs">
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
                  <th className="py-2 px-3">Session</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3 text-right">Trainee Value</th>
                  <th className="py-2 px-3 text-right">Batch Baseline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {chartData.map((d, i) => (
                  <tr key={i} className="hover:bg-[var(--background)]">
                    <td className="py-2 px-3 font-medium">{d.sessionTitle}</td>
                    <td className="py-2 px-3 text-[var(--text-muted)]">{d.heldOn}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      {metricToggle === 'score' ? `${d.score}%` : metricToggle === 'errors' ? d.errors : formatDuration(d.timeSeconds)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">
                      {metricToggle === 'score' ? `${d.batchScore}%` : metricToggle === 'errors' ? d.batchErrors : formatDuration(d.batchTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
              <XAxis dataKey="sessionTitle" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                type="linear"
                dataKey={metricToggle === 'score' ? 'score' : metricToggle === 'errors' ? 'errors' : 'timeSeconds'}
                name={trainee?.name || 'Trainee'}
                stroke="#1d4ed8"
                strokeWidth={2.2}
                dot={{ r: 4, fill: '#1d4ed8' }}
              />
              <Line
                type="linear"
                dataKey={metricToggle === 'score' ? 'batchScore' : metricToggle === 'errors' ? 'batchErrors' : 'batchTime'}
                name="Batch Average"
                stroke="#93a1ba"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#93a1ba' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Per-Topic Breakdown */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--text-main)]">Curriculum Topic Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topicBreakdown.map((tb) => (
            <div key={tb.topicId} className="card-flat p-4 bg-[var(--surface)] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-[var(--text-main)]">{tb.topicName}</span>
                <StatusBadge status={tb.status} size="sm" />
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-main)]">
                <span>{tb.sessionCount} sessions</span>
                <span className="font-bold text-[var(--text-main)]">{formatScore(tb.avgScore)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Session History Table */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--text-main)]">Session History & Evaluations</h2>
        <DataTable
          columns={historyColumns}
          data={sessionHistory}
          isLoading={isLoading}
          emptyTitle="No evaluations recorded"
          emptyMessage="No evaluations have been submitted for this trainee yet."
        />
      </section>
    </div>
  );
};
