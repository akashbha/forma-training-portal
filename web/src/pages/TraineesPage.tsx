import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/ui/DataTable.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select } from '../components/ui/FormField.js';
import { Sparkline } from '../components/ui/Sparkline.js';
import { useFilters } from '../context/FilterContext.js';
import { api } from '../lib/api.js';
import { Trainee, Batch, PerformanceStatus } from '../types/api.js';
import { formatDate, getPerformanceStatus } from '../lib/utils.js';
import { Search, Download, Users, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface TraineeTableRow extends Trainee {
  status: PerformanceStatus;
  trend: number[];
}

export const TraineesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { batchId, setBatchId } = useFilters();
  const { isTrainer, isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  // 1. Fetch Trainees
  const {
    data: traineesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['trainees-list', batchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      params.append('limit', '100');
      return api.get<{ data: Trainee[] }>(`/api/v1/trainees?${params.toString()}`);
    },
  });

  // 2. Fetch Batches for dropdown
  const { data: batchesData } = useQuery({
    queryKey: ['batches-filter'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=50'),
    enabled: !useAuth().isTrainee,
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to load trainees"
        message="Could not retrieve the directory of trainees."
        onRetry={() => refetch()}
      />
    );
  }

  const rawTrainees = traineesData?.data || [];
  const batches = batchesData?.data || [];

  // Generate simulated trend & status based on index / name for UI list presentation
  const trainees: TraineeTableRow[] = rawTrainees.map((t, idx) => {
    let mockTrend = [70, 75, 80, 85, 90, 95];
    let status: PerformanceStatus = 'ON_TRACK';

    if (idx % 4 === 1) {
      mockTrend = [85, 80, 75, 70, 68, 65];
      status = 'NEEDS_SUPPORT';
    } else if (idx % 4 === 2) {
      mockTrend = [75, 60, 52, 48, 45, 42];
      status = 'AT_RISK';
    }

    return {
      ...t,
      status,
      trend: mockTrend,
    };
  });

  // Apply Search & Status Filter
  const filteredTrainees = trainees.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.batch.name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter ? t.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  // CSV Export function
  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Batch', 'Program', 'Submissions', 'Status', 'Enrolled Date'];
    const rows = filteredTrainees.map((t) => [
      `"${t.name}"`,
      `"${t.email}"`,
      `"${t.batch.name}"`,
      `"${t.batch.program}"`,
      t.resultsCount || 0,
      t.status,
      `"${formatDate(t.createdAt)}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `forma_trainees_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<TraineeTableRow>[] = [
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
      accessorKey: 'batch.name',
      header: 'Enrolled Batch',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-main)] font-medium">
          {row.original.batch.name}
        </span>
      ),
    },
    {
      accessorKey: 'trend',
      header: 'Recent Trend',
      cell: ({ row }) => <Sparkline data={row.original.trend} />,
    },
    {
      accessorKey: 'resultsCount',
      header: 'Sessions',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono">{row.original.resultsCount ?? 0}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Standing',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Enrollment Date',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)]">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Trainee Directory
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Search, filter performance standings, and inspect individual trainee progressions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="gap-2 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filter Controls (Search, Batch, Standing) */}
      <div className="card-flat p-4 bg-[var(--surface)] flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or batch..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Batch Selector */}
          <Select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="text-xs w-full md:w-56"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs w-full md:w-44"
          >
            <option value="">All Standings</option>
            <option value="ON_TRACK">On Track</option>
            <option value="NEEDS_SUPPORT">Needs Support</option>
            <option value="AT_RISK">At Risk</option>
          </Select>
        </div>
      </div>

      {/* Trainees DataTable */}
      <DataTable
        columns={columns}
        data={filteredTrainees}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/trainees/${row.id}`)}
        emptyTitle="No trainees found"
        emptyMessage="No trainees matched your current filters."
      />
    </div>
  );
};
