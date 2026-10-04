import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/ui/DataTable.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { Input, FormField } from '../components/ui/FormField.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../lib/api.js';
import { Session, Result } from '../types/api.js';
import { formatDate, formatScore, formatDuration, getPerformanceStatus } from '../lib/utils.js';
import { ArrowLeft, Edit2, Check, X, Trash2, Calendar, BookOpen, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SessionWithResults extends Session {
  results: Array<
    Result & {
      trainee: {
        id: string;
        user: { id: string; name: string; email: string };
      };
    }
  >;
}

export const SessionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTrainer, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editErrors, setEditErrors] = useState<number>(0);
  const [editTimeMins, setEditTimeMins] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // 1. Fetch Session Details & Results
  const {
    data: sessionData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['session-detail', id],
    queryFn: () => api.get<{ data: SessionWithResults }>(`/api/v1/sessions/${id}`),
    enabled: Boolean(id),
  });

  // 2. Update Result Mutation
  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; score: number; errors: number; timeSeconds: number; notes: string }) =>
      api.patch(`/api/v1/results/${payload.id}`, {
        score: payload.score,
        errors: payload.errors,
        timeSeconds: payload.timeSeconds,
        notes: payload.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-detail', id] });
      setEditingResultId(null);
      showToast({ type: 'success', message: 'Trainee score updated successfully.' });
    },
    onError: (err: any) => {
      showToast({ type: 'error', message: err?.message || 'Failed to update result.' });
    },
  });

  // 3. Delete Session Mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/sessions/${id}`),
    onSuccess: () => {
      showToast({ type: 'success', message: 'Session deleted.' });
      navigate('/sessions');
    },
    onError: (err: any) => {
      showToast({ type: 'error', message: err?.message || 'Failed to delete session.' });
    },
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to load session details"
        message="Could not retrieve session records."
        onRetry={() => refetch()}
      />
    );
  }

  const session = sessionData?.data;
  const results = session?.results || [];

  const handleStartEdit = (res: (typeof results)[0]) => {
    setEditingResultId(res.id);
    setEditScore(res.score);
    setEditErrors(res.errors);
    setEditTimeMins(Math.round(res.timeSeconds / 60));
    setEditNotes(res.notes || '');
  };

  const handleSaveEdit = (resId: string) => {
    if (editScore < 0 || editScore > 100) {
      showToast({ type: 'error', message: 'Score must be between 0 and 100.' });
      return;
    }
    if (editErrors < 0) {
      showToast({ type: 'error', message: 'Errors cannot be negative.' });
      return;
    }
    if (editTimeMins <= 0) {
      showToast({ type: 'error', message: 'Duration must be greater than 0 minutes.' });
      return;
    }

    updateMutation.mutate({
      id: resId,
      score: editScore,
      errors: editErrors,
      timeSeconds: editTimeMins * 60,
      notes: editNotes,
    });
  };

  const columns: ColumnDef<(typeof results)[0]>[] = [
    {
      accessorKey: 'trainee.user.name',
      header: 'Trainee Name',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">
            {row.original.trainee.user.name}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {row.original.trainee.user.email}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'score',
      header: 'Score (0-100)',
      meta: { isNumeric: true },
      cell: ({ row }) => {
        if (editingResultId === row.original.id) {
          return (
            <Input
              type="number"
              min="0"
              max="100"
              value={editScore}
              onChange={(e) => setEditScore(Number(e.target.value))}
              className="w-20 text-right h-7 text-xs font-mono"
            />
          );
        }
        return (
          <span className="font-bold text-[var(--text-main)]">
            {formatScore(row.original.score)}
          </span>
        );
      },
    },
    {
      accessorKey: 'errors',
      header: 'Errors',
      meta: { isNumeric: true },
      cell: ({ row }) => {
        if (editingResultId === row.original.id) {
          return (
            <Input
              type="number"
              min="0"
              value={editErrors}
              onChange={(e) => setEditErrors(Number(e.target.value))}
              className="w-16 text-right h-7 text-xs font-mono"
            />
          );
        }
        return <span className="font-mono text-xs">{row.original.errors}</span>;
      },
    },
    {
      accessorKey: 'timeSeconds',
      header: 'Duration',
      meta: { isNumeric: true },
      cell: ({ row }) => {
        if (editingResultId === row.original.id) {
          return (
            <div className="inline-flex items-center gap-1">
              <Input
                type="number"
                min="1"
                value={editTimeMins}
                onChange={(e) => setEditTimeMins(Number(e.target.value))}
                className="w-16 text-right h-7 text-xs font-mono"
              />
              <span className="text-xs text-[var(--text-muted)]">min</span>
            </div>
          );
        }
        return <span className="font-mono text-xs">{formatDuration(row.original.timeSeconds)}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Outcome',
      cell: ({ row }) => (
        <StatusBadge status={getPerformanceStatus(row.original.score)} size="sm" />
      ),
    },
    {
      accessorKey: 'notes',
      header: 'Evaluator Notes',
      cell: ({ row }) => {
        if (editingResultId === row.original.id) {
          return (
            <Input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add feedback notes..."
              className="w-48 h-7 text-xs"
            />
          );
        }
        return (
          <span className="text-xs text-[var(--text-muted)] max-w-xs truncate block">
            {row.original.notes || '—'}
          </span>
        );
      },
    },
    ...(isTrainer || isAdmin
      ? [
          {
            id: 'actions',
            header: 'Actions',
            meta: { isNumeric: true },
            cell: ({ row }: any) => {
              const isEditing = editingResultId === row.original.id;
              if (isEditing) {
                return (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveEdit(row.original.id)}
                      isLoading={updateMutation.isPending}
                      className="h-7 px-2"
                      title="Save changes"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingResultId(null)}
                      className="h-7 px-2"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(row.original)}
                    className="h-7 px-2 text-[var(--text-muted)] hover:text-[var(--primary)]"
                    title="Edit result"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            },
          } as ColumnDef<(typeof results)[0]>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6 pb-12">
      <button
        type="button"
        onClick={() => navigate('/sessions')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded py-1 px-1 -ml-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sessions
      </button>

      {/* Session Details Header */}
      {isLoading ? (
        <Skeleton variant="card" className="h-32" />
      ) : (
        <div className="card-flat p-6 bg-[var(--surface)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[var(--text-main)] text-xs font-semibold mb-2 border border-slate-200">
              <BookOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
              {session?.topic.name}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              {session?.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] mt-2">
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {session?.batch.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(session?.heldOn)}
              </span>
              <span>Pass Mark: <strong>{session?.passMark}%</strong></span>
            </div>
          </div>

          {(isTrainer || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-[var(--danger)] hover:bg-orange-50 border-orange-200 self-start md:self-auto gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete Session
            </Button>
          )}
        </div>
      )}

      {/* Trainee Submissions Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--text-main)]">
            Trainee Evaluation Submissions ({results.length})
          </h2>
        </div>
        <DataTable
          columns={columns}
          data={results}
          isLoading={isLoading}
          emptyTitle="No evaluation submissions"
          emptyMessage="No trainee scores have been recorded for this session yet."
        />
      </section>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Session Record"
        message="Are you sure you want to delete this session? All recorded scores and trainee notes will be permanently removed."
        confirmLabel="Delete Session"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
