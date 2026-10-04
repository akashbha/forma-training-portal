import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AuditLog, AuditAction } from '../types/api';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { FormField, Select } from '../components/ui/FormField';
import { Shield, Eye, CheckCircle2, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const AuditPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState<number>(1);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [activeLog, setActiveLog] = useState<AuditLog | null>(null);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, selectedEntity, selectedAction],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '15');
      if (selectedEntity) params.append('entity', selectedEntity);
      if (selectedAction) params.append('action', selectedAction);
      return api.get<{ data: AuditLog[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
        `/api/v1/audit?${params.toString()}`
      );
    },
  });

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">CREATE</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">DELETE</span>;
      case 'LOGIN':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">LOGIN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-300">{action}</span>;
    }
  };

  const columns = [
    {
      header: 'Timestamp',
      accessorKey: 'createdAt',
      cell: ({ row }: any) => (
        <span className="text-xs text-[var(--text-muted)] font-mono">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Actor',
      accessorKey: 'actor',
      cell: ({ row }: any) => {
        const actor = row.original.actor;
        return (
          <div>
            <span className="text-xs font-medium text-[var(--text-main)]">
              {actor?.name || 'System / Anonymous'}
            </span>
            {actor && (
              <span className="block text-[11px] text-[var(--text-muted)]">
                {actor.email} ({actor.role})
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: ({ row }: any) => getActionBadge(row.original.action),
    },
    {
      header: 'Entity',
      accessorKey: 'entity',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-800">
            {row.original.entity}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[100px]" title={row.original.entityId}>
            #{row.original.entityId.slice(-6)}
          </span>
        </div>
      ),
    },
    {
      header: 'IP Address',
      accessorKey: 'ip',
      cell: ({ row }: any) => (
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {row.original.ip || '—'}
        </span>
      ),
    },
    {
      header: 'Payload Diff',
      id: 'actions',
      cell: ({ row }: any) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveLog(row.original)}
          className="gap-1.5 text-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          View Diff
        </Button>
      ),
    },
  ];

  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              System Audit Log
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Shield className="w-3.5 h-3.5" />
              Append-Only
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Immutable transaction logs tracking creation, mutations, deletions, and login events across the academy.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex flex-wrap items-center gap-4">
        <div className="w-48">
          <FormField label="Filter Entity">
            <Select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Entities</option>
              <option value="Result">Result</option>
              <option value="Session">Session</option>
              <option value="Batch">Batch</option>
              <option value="Trainee">Trainee</option>
              <option value="Goal">Goal</option>
              <option value="Attendance">Attendance</option>
              <option value="Auth">Auth / Login</option>
            </Select>
          </FormField>
        </div>

        <div className="w-48">
          <FormField label="Filter Action">
            <Select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
            </Select>
          </FormField>
        </div>

        {(selectedEntity || selectedAction) && (
          <div className="pt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedEntity('');
                setSelectedAction('');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {isError ? (
        <ErrorState
          title="Unable to load audit logs"
          message="Could not retrieve the system audit entries."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns as any}
            data={data?.data || []}
            isLoading={isLoading}
            pageSize={15}
          />

          {/* Server-side Pagination controls */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border-main)] rounded-lg text-xs">
              <span className="text-[var(--text-muted)]">
                Showing Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total transactions)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diff Inspector Modal */}
      {activeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[var(--surface)] w-full max-w-3xl rounded-xl border border-[var(--border)] shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-[var(--text-main)]">
                    Audit Transaction Details
                  </h3>
                  {getActionBadge(activeLog.action)}
                  <span className="font-mono text-xs px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700">
                    {activeLog.entity} #{activeLog.entityId}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Actor: {activeLog.actor?.name || 'System'} • {new Date(activeLog.createdAt).toLocaleString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveLog(null)}>
                Close
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-zinc-400" />
                    State Before Mutation
                  </div>
                  <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono overflow-x-auto text-zinc-800 max-h-60">
                    {activeLog.before ? JSON.stringify(activeLog.before, null, 2) : 'null (Newly Created)'}
                  </pre>
                </div>

                {/* After */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    State After Mutation
                  </div>
                  <pre className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-mono overflow-x-auto text-emerald-900 max-h-60">
                    {activeLog.after ? JSON.stringify(activeLog.after, null, 2) : 'null (Deleted)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-zinc-50 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setActiveLog(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
