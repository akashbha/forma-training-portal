import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Goal, GoalScope, GoalMetric, Batch, Trainee, Topic } from '../types/api';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { FormField, Input, Select } from '../components/ui/FormField';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { Target, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';

export const GoalsPage: React.FC = () => {
  const { isTrainee } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  // Form State
  const [scope, setScope] = useState<GoalScope>('BATCH');
  const [scopeId, setScopeId] = useState<string>('');
  const [metric, setMetric] = useState<GoalMetric>('SCORE');
  const [targetValue, setTargetValue] = useState<number>(85);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Fetch Goals
  const { data: goalsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get<{ data: Goal[] }>('/api/v1/goals'),
  });

  // Fetch batches and topics for form selectors
  const { data: batchesData } = useQuery({
    queryKey: ['batches-all'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=50'),
    enabled: !isTrainee,
  });

  const { data: topicsData } = useQuery({
    queryKey: ['topics-all'],
    queryFn: () => api.get<{ data: Topic[] }>('/api/v1/topics?limit=50'),
    enabled: !isTrainee,
  });

  const { data: traineesData } = useQuery({
    queryKey: ['trainees-all'],
    queryFn: () => api.get<{ data: Trainee[] }>('/api/v1/trainees?limit=50'),
    enabled: !isTrainee,
  });

  // Create Goal Mutation
  const createMutation = useMutation({
    mutationFn: (newGoal: any) => api.post('/api/v1/goals', newGoal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      setIsCreateOpen(false);
      showToast({ type: 'success', message: 'Goal created successfully' });
    },
    onError: (err: any) => {
      showToast({ type: 'error', message: err.message || 'Failed to create goal' });
    },
  });

  // Delete Goal Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      setDeleteGoalId(null);
      showToast({ type: 'success', message: 'Goal deleted successfully' });
    },
    onError: (err: any) => {
      showToast({ type: 'error', message: err.message || 'Failed to delete goal' });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeId) {
      showToast({ type: 'error', message: 'Please select a valid target scope' });
      return;
    }

    createMutation.mutate({
      scope,
      scopeId,
      metric,
      targetValue: Number(targetValue),
      dueDate: new Date(dueDate).toISOString(),
    });
  };

  const columns = [
    {
      header: 'Scope',
      accessorKey: 'scope',
      cell: ({ row }: any) => {
        const g: Goal = row.original;
        return (
          <div>
            <span className="font-semibold text-xs text-[var(--text-main)] block">
              {g.scopeName || g.scope}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Scope: {g.scope}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Metric & Target',
      accessorKey: 'metric',
      cell: ({ row }: any) => {
        const g: Goal = row.original;
        const unit = g.metric === 'SCORE' ? '%' : g.metric === 'ERRORS' ? ' max errors' : 's max time';
        return (
          <div className="font-mono text-xs">
            <span className="font-semibold text-[var(--primary)]">{g.metric}</span>
            <span className="text-[var(--text-muted)] ml-1.5">Target: {g.targetValue}{unit}</span>
          </div>
        );
      },
    },
    {
      header: 'Current Progress',
      id: 'progress',
      cell: ({ row }: any) => {
        const p = row.original.progress;
        if (!p) return <span className="text-xs text-[var(--text-muted)]">—</span>;

        const isAchieved = p.isAchieved;
        return (
          <div className="w-48 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-medium text-[var(--text-main)]">
                {p.currentValue} / {p.targetValue}
              </span>
              <span className={isAchieved ? 'text-emerald-700 font-bold' : 'text-[var(--text-muted)]'}>
                {p.percentage}%
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isAchieved ? 'bg-emerald-700' : 'bg-[var(--primary)]'
                }`}
                style={{ width: `${Math.min(100, p.percentage)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }: any) => {
        const isAchieved = row.original.progress?.isAchieved;
        return isAchieved ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Achieved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            In Progress
          </span>
        );
      },
    },
    {
      header: 'Due Date',
      accessorKey: 'dueDate',
      cell: ({ row }: any) => (
        <span className="text-xs text-[var(--text-muted)]">
          {formatDate(row.original.dueDate)}
        </span>
      ),
    },
    ...((!isTrainee)
      ? [
          {
            header: 'Actions',
            id: 'actions',
            cell: ({ row }: any) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteGoalId(row.original.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                title="Delete Goal"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Performance Goals
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Target className="w-3.5 h-3.5" />
              KPI Benchmarks
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Set and monitor score benchmarks, error reduction targets, and execution time goals.
          </p>
        </div>

        {!isTrainee && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (batchesData?.data?.length && !scopeId) {
                setScopeId(batchesData.data[0].id);
              }
              setIsCreateOpen(true);
            }}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Set New Goal
          </Button>
        )}
      </div>

      {/* Goals Table */}
      {isError ? (
        <ErrorState
          title="Unable to load goals"
          message="An error occurred while loading performance goals."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns as any}
          data={goalsData?.data || []}
          isLoading={isLoading}
        />
      )}

      {/* Create Goal Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[var(--surface)] w-full max-w-lg rounded-xl border border-[var(--border)] shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-base text-[var(--text-main)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--primary)]" />
                Define Performance Goal
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Goal Scope" required>
                  <Select
                    value={scope}
                    onChange={(e) => {
                      const newScope = e.target.value as GoalScope;
                      setScope(newScope);
                      if (newScope === 'BATCH' && batchesData?.data?.length) {
                        setScopeId(batchesData.data[0].id);
                      } else if (newScope === 'TOPIC' && topicsData?.data?.length) {
                        setScopeId(topicsData.data[0].id);
                      } else if (newScope === 'TRAINEE' && traineesData?.data?.length) {
                        setScopeId(traineesData.data[0].id);
                      }
                    }}
                  >
                    <option value="BATCH">Batch / Cohort</option>
                    <option value="TOPIC">Topic Benchmark</option>
                    <option value="TRAINEE">Individual Trainee</option>
                  </Select>
                </FormField>

                <FormField label="Metric" required>
                  <Select
                    value={metric}
                    onChange={(e) => {
                      const newMetric = e.target.value as GoalMetric;
                      setMetric(newMetric);
                      if (newMetric === 'SCORE') setTargetValue(85);
                      else if (newMetric === 'ERRORS') setTargetValue(2);
                      else if (newMetric === 'TIME') setTargetValue(2100);
                    }}
                  >
                    <option value="SCORE">Average Score (Min %)</option>
                    <option value="ERRORS">Error Rate (Max Errors)</option>
                    <option value="TIME">Duration (Max Seconds)</option>
                  </Select>
                </FormField>
              </div>

              {/* Scope Target Selector */}
              <div>
                {scope === 'BATCH' && (
                  <FormField label="Select Target Batch" required>
                    <Select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                    >
                      <option value="">Select a Batch</option>
                      {batchesData?.data?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.program})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}

                {scope === 'TOPIC' && (
                  <FormField label="Select Target Topic" required>
                    <Select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                    >
                      <option value="">Select a Topic</option>
                      {topicsData?.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}

                {scope === 'TRAINEE' && (
                  <FormField label="Select Trainee" required>
                    <Select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                    >
                      <option value="">Select a Trainee</option>
                      {traineesData?.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={`Target Value (${metric === 'SCORE' ? 'Score %' : metric === 'ERRORS' ? 'Errors' : 'Seconds'})`} required>
                  <Input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    required
                  />
                </FormField>

                <FormField label="Due Date" required>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </FormField>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={createMutation.isPending}>
                  Save Goal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteGoalId)}
        title="Delete Performance Goal"
        message="Are you sure you want to delete this goal? This action is permanent and will be logged in the system audit trail."
        confirmLabel="Delete Goal"
        variant="danger"
        onConfirm={() => {
          if (deleteGoalId) deleteMutation.mutate(deleteGoalId);
        }}
        onCancel={() => setDeleteGoalId(null)}
      />
    </div>
  );
};
