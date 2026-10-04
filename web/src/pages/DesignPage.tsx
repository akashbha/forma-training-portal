import React, { useState } from 'react';
import { Button } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ChartCard } from '../components/ui/ChartCard.js';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { FormField, Input, Select, Textarea } from '../components/ui/FormField.js';
import { Sparkline } from '../components/ui/Sparkline.js';
import { Heatmap } from '../components/ui/Heatmap.js';
import { useToast } from '../context/ToastContext.js';
import { ColumnDef } from '@tanstack/react-table';
import { formatScore, formatDate } from '../lib/utils.js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface DemoTrainee {
  id: string;
  name: string;
  email: string;
  batch: string;
  avgScore: number;
  status: 'ON_TRACK' | 'NEEDS_SUPPORT' | 'AT_RISK';
  trend: number[];
}

export const DesignPage: React.FC = () => {
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewState, setViewState] = useState<'normal' | 'loading' | 'empty' | 'error'>('normal');

  const demoTrainees: DemoTrainee[] = [
    {
      id: 't1',
      name: 'Alex Rivera',
      email: 'alex.rivera@forma.internal',
      batch: 'Full-Stack 2026A',
      avgScore: 92.5,
      status: 'ON_TRACK',
      trend: [65, 72, 80, 88, 92, 95],
    },
    {
      id: 't2',
      name: 'Beatrice Thorne',
      email: 'beatrice.thorne@forma.internal',
      batch: 'Data Analytics Alpha',
      avgScore: 64.0,
      status: 'NEEDS_SUPPORT',
      trend: [70, 68, 65, 60, 64, 64],
    },
    {
      id: 't3',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@forma.internal',
      batch: 'Cloud Architecture',
      avgScore: 42.5,
      status: 'AT_RISK',
      trend: [75, 68, 55, 48, 45, 42],
    },
  ];

  const columns: ColumnDef<DemoTrainee>[] = [
    {
      accessorKey: 'name',
      header: 'Trainee Name',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{row.original.name}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'batch',
      header: 'Batch',
    },
    {
      accessorKey: 'trend',
      header: '6-Week Trend',
      cell: ({ row }) => <Sparkline data={row.original.trend} />,
    },
    {
      accessorKey: 'avgScore',
      header: 'Avg Score',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-semibold">{formatScore(row.original.avgScore)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const demoChartData = [
    { week: 'W1', score: 62 },
    { week: 'W2', score: 68 },
    { week: 'W3', score: 71 },
    { week: 'W4', score: 75 },
    { week: 'W5', score: 82 },
    { week: 'W6', score: 88 },
  ];

  const demoHeatmapData = {
    batch: { id: 'b1', name: 'Demo Cohort', program: 'Engineering' },
    sessions: [
      { id: 's1', title: 'Session 1', heldOn: '2026-08-01', passMark: 70 },
      { id: 's2', title: 'Session 2', heldOn: '2026-08-15', passMark: 70 },
      { id: 's3', title: 'Session 3', heldOn: '2026-09-01', passMark: 70 },
      { id: 's4', title: 'Session 4', heldOn: '2026-09-15', passMark: 70 },
    ],
    matrix: [
      {
        traineeId: 't1',
        name: 'Alex Rivera',
        email: 'alex@forma.internal',
        scores: {
          s1: { resultId: 'r1', score: 78, errors: 2, timeSeconds: 1500, status: 'ON_TRACK' as const },
          s2: { resultId: 'r2', score: 84, errors: 1, timeSeconds: 1400, status: 'ON_TRACK' as const },
          s3: { resultId: 'r3', score: 91, errors: 0, timeSeconds: 1200, status: 'ON_TRACK' as const },
          s4: { resultId: 'r4', score: 96, errors: 0, timeSeconds: 1100, status: 'ON_TRACK' as const },
        },
      },
      {
        traineeId: 't2',
        name: 'Carlos Mendoza',
        email: 'carlos@forma.internal',
        scores: {
          s1: { resultId: 'r5', score: 68, errors: 4, timeSeconds: 2000, status: 'NEEDS_SUPPORT' as const },
          s2: { resultId: 'r6', score: 58, errors: 6, timeSeconds: 2300, status: 'NEEDS_SUPPORT' as const },
          s3: { resultId: 'r7', score: 48, errors: 9, timeSeconds: 2800, status: 'AT_RISK' as const },
          s4: { resultId: 'r8', score: 42, errors: 11, timeSeconds: 3100, status: 'AT_RISK' as const },
        },
      },
    ],
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & State Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-main)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Design System & Component Gallery
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Visual tokens, shared components, interactive states, and accessibility compliance.
          </p>
        </div>

        {/* State Toggle Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-[8px] border border-[var(--border-main)]">
          {(['normal', 'loading', 'empty', 'error'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setViewState(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-[6px] capitalize transition-colors ${
                viewState === s
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {s} State
            </button>
          ))}
        </div>
      </div>

      {/* 1. Brand Tokens & Status Badges */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          STATUS BADGES & TOKENS
        </h2>
        <div className="card-flat p-4 flex flex-wrap items-center gap-4 bg-[var(--surface)]">
          <StatusBadge status="ON_TRACK" />
          <StatusBadge status="NEEDS_SUPPORT" />
          <StatusBadge status="AT_RISK" />
          <StatusBadge status="ON_TRACK" size="sm" />
          <StatusBadge status="NEEDS_SUPPORT" size="sm" />
          <StatusBadge status="AT_RISK" size="sm" />
        </div>
      </section>

      {/* 2. StatCards Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          STAT CARDS
        </h2>
        {viewState === 'error' ? (
          <ErrorState message="Could not fetch overview metrics." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Average Score"
              value={viewState === 'empty' ? '—' : '84.5%'}
              delta={viewState === 'empty' ? null : 3.2}
              infoTooltip="Mean evaluation score across all evaluated sessions in the period."
              isLoading={viewState === 'loading'}
            />
            <StatCard
              label="Errors per Session"
              value={viewState === 'empty' ? '—' : '2.4'}
              delta={viewState === 'empty' ? null : -0.8}
              isPositiveImprovement={false}
              infoTooltip="Average compiler and logic errors per session."
              isLoading={viewState === 'loading'}
            />
            <StatCard
              label="Average Duration"
              value={viewState === 'empty' ? '—' : '38 min'}
              delta={viewState === 'empty' ? null : -4}
              isPositiveImprovement={false}
              infoTooltip="Average time taken to complete hands-on sessions."
              isLoading={viewState === 'loading'}
            />
            <StatCard
              label="Trainees at Risk"
              value={viewState === 'empty' ? '0' : '3'}
              delta={viewState === 'empty' ? null : 1}
              isPositiveImprovement={false}
              infoTooltip="Number of trainees with average score below 50%."
              isLoading={viewState === 'loading'}
            />
          </div>
        )}
      </section>

      {/* 3. DataTable Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          DATA TABLE (SORTABLE, STICKY HEADER, PAGINATED, SPARKLINE)
        </h2>
        {viewState === 'error' ? (
          <ErrorState message="Failed to load trainee directory." onRetry={() => setViewState('normal')} />
        ) : (
          <DataTable
            columns={columns}
            data={viewState === 'empty' ? [] : demoTrainees}
            isLoading={viewState === 'loading'}
            onRowClick={(row) => showToast({ type: 'info', message: `Clicked on ${row.name}` })}
          />
        )}
      </section>

      {/* 4. ChartCard Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          CHART CARD & TABLE VIEW
        </h2>
        {viewState === 'error' ? (
          <ErrorState message="Failed to load performance charts." />
        ) : viewState === 'empty' ? (
          <EmptyState
            title="No trend data available"
            message="Record sessions to view progress trends over time."
          />
        ) : (
          <ChartCard
            title="Weekly Score Progression"
            description="Average trainee score by week with pass mark threshold."
            textSummary="Average score rose from 62% to 88% over 6 consecutive weeks."
            isLoading={viewState === 'loading'}
            tableView={
              <div className="p-2">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2">Week</th>
                      <th className="py-2 text-right">Average Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoChartData.map((d) => (
                      <tr key={d.week} className="border-b">
                        <td className="py-1.5">{d.week}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{d.score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          >
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demoChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#55637d" fontSize={11} />
                  <YAxis stroke="#55637d" domain={[0, 100]} fontSize={11} />
                  <Tooltip />
                  <Line
                    type="linear"
                    dataKey="score"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#1d4ed8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </section>

      {/* 5. Heatmap Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          ACCESSIBLE HEATMAP MATRIX
        </h2>
        {viewState === 'error' ? (
          <ErrorState message="Failed to load batch heatmap." />
        ) : viewState === 'empty' ? (
          <EmptyState title="Heatmap Empty" message="No session scores recorded for this batch yet." />
        ) : viewState === 'loading' ? (
          <Skeleton variant="chart" />
        ) : (
          <Heatmap
            data={demoHeatmapData}
            onCellClick={(tId, sId) => showToast({ type: 'info', message: `Cell selected: Trainee ${tId}, Session ${sId}` })}
          />
        )}
      </section>

      {/* 6. Form Fields & Interactive Dialogs */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-muted)] tracking-wider">
          FORM FIELDS, TOASTS & CONFIRM DIALOG
        </h2>
        <div className="card-flat p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[var(--surface)]">
          <div className="space-y-4">
            <FormField label="Standard Input" hint="Helper hint text">
              <Input placeholder="Enter placeholder text..." />
            </FormField>

            <FormField label="Input with Error" error="Score must be between 0 and 100.">
              <Input hasError defaultValue="105" />
            </FormField>

            <FormField label="Select Dropdown" required>
              <Select defaultValue="option1">
                <option value="option1">Batch Alpha - Full Stack</option>
                <option value="option2">Batch Beta - Data Engineering</option>
              </Select>
            </FormField>
          </div>

          <div className="space-y-4 flex flex-col justify-between">
            <FormField label="Notes & Observations">
              <Textarea rows={3} placeholder="Add evaluation notes..." />
            </FormField>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  showToast({
                    type: 'success',
                    title: 'Session Saved',
                    message: 'Evaluation results recorded for 10 trainees.',
                    link: { text: 'View Session', url: '/sessions' },
                  })
                }
              >
                Trigger Success Toast
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Open Confirm Dialog
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Session Record?"
        message="This action will permanently delete this session and all associated trainee scores. This cannot be undone."
        confirmLabel="Delete Session"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          showToast({ type: 'info', message: 'Session deleted successfully.' });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
