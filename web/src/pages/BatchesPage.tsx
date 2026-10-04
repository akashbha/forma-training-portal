import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/ui/DataTable.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/FormField.js';
import { api } from '../lib/api.js';
import { BatchComparisonRow } from '../types/api.js';
import { formatDate, formatScore, formatDuration } from '../lib/utils.js';
import { Search, Layers, Calendar, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const BatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isTrainer, isAdmin } = useAuth();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics-batches-compare'],
    queryFn: () => api.get<{ data: BatchComparisonRow[] }>('/api/v1/analytics/batches/compare'),
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to load training batches"
        message="Could not retrieve batch comparison data from the server."
        onRetry={() => refetch()}
      />
    );
  }

  const allBatches = data?.data || [];
  const filteredBatches = allBatches.filter(
    (b) =>
      b.batchName.toLowerCase().includes(search.toLowerCase()) ||
      b.program.toLowerCase().includes(search.toLowerCase()) ||
      b.trainer.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: ColumnDef<BatchComparisonRow>[] = [
    {
      accessorKey: 'batchName',
      header: 'Cohort / Batch Name',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{row.original.batchName}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.original.program}</div>
        </div>
      ),
    },
    {
      accessorKey: 'trainer',
      header: 'Trainer',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-main)] font-medium">
          {row.original.trainer.name}
        </span>
      ),
    },
    {
      accessorKey: 'traineeCount',
      header: 'Trainees',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono">{row.original.traineeCount}</span>
      ),
    },
    {
      accessorKey: 'sessionCount',
      header: 'Sessions',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono">{row.original.sessionCount}</span>
      ),
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
      accessorKey: 'avgErrors',
      header: 'Avg Errors',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono">{row.original.avgErrors}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'dates',
      header: 'Timeline',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)]">
          {formatDate(row.original.startDate)} &ndash; {formatDate(row.original.endDate)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Training Batches
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Active and completed training cohorts, curricula, and aggregate standings.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch name, program, or trainer..."
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Batches DataTable */}
      <DataTable
        columns={columns}
        data={filteredBatches}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/batches/${row.batchId}`)}
        emptyTitle="No batches found"
        emptyMessage="No training batches matched your search query."
      />
    </div>
  );
};
