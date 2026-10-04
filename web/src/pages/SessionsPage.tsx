import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/ui/DataTable.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select } from '../components/ui/FormField.js';
import { useFilters } from '../context/FilterContext.js';
import { api } from '../lib/api.js';
import { Session, Batch, Topic } from '../types/api.js';
import { formatDate } from '../lib/utils.js';
import { Search, Plus, Calendar, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const SessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { batchId, setBatchId } = useFilters();
  const { isTrainer, isAdmin, isTrainee } = useAuth();

  const [search, setSearch] = useState('');
  const [topicId, setTopicId] = useState('');

  // 1. Fetch Sessions
  const {
    data: sessionsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sessions-list', batchId, topicId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      if (topicId) params.append('topicId', topicId);
      params.append('limit', '100');
      return api.get<{ data: Session[] }>(`/api/v1/sessions?${params.toString()}`);
    },
  });

  // 2. Fetch Batches for filter dropdown
  const { data: batchesData } = useQuery({
    queryKey: ['batches-filter'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=50'),
    enabled: !isTrainee,
  });

  // 3. Fetch Topics for filter dropdown
  const { data: topicsData } = useQuery({
    queryKey: ['topics-filter'],
    queryFn: () => api.get<{ data: Topic[] }>('/api/v1/topics'),
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to load sessions"
        message="Could not retrieve training sessions from the server."
        onRetry={() => refetch()}
      />
    );
  }

  const sessions = sessionsData?.data || [];
  const batches = batchesData?.data || [];
  const topics = topicsData?.data || [];

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.batch.name.toLowerCase().includes(search.toLowerCase()) ||
      s.topic.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: ColumnDef<Session>[] = [
    {
      accessorKey: 'title',
      header: 'Session Title',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{row.original.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.original.batch.name}</div>
        </div>
      ),
    },
    {
      accessorKey: 'topic.name',
      header: 'Topic',
      cell: ({ row }) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-[var(--text-main)] border border-slate-200">
          {row.original.topic.name}
        </span>
      ),
    },
    {
      accessorKey: 'heldOn',
      header: 'Held On Date',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)]">{formatDate(row.original.heldOn)}</span>
      ),
    },
    {
      accessorKey: 'passMark',
      header: 'Pass Mark',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono font-semibold">{row.original.passMark}%</span>
      ),
    },
    {
      accessorKey: 'resultsCount',
      header: 'Submissions',
      meta: { isNumeric: true },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.resultsCount ?? 0}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Training Sessions
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Practical evaluations, topic assessments, and recorded session submissions.
          </p>
        </div>

        {(isTrainer || isAdmin) && (
          <Link to="/sessions/new">
            <Button variant="primary" size="sm" className="gap-1.5 shadow-xs">
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Controls */}
      <div className="card-flat p-4 bg-[var(--surface)] flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by session title, batch, or topic..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {!isTrainee && (
            <Select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="text-xs w-full md:w-52"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="text-xs w-full md:w-48"
          >
            <option value="">All Topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Sessions DataTable */}
      <DataTable
        columns={columns}
        data={filteredSessions}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/sessions/${row.id}`)}
        emptyTitle="No sessions found"
        emptyMessage="No training sessions match your criteria."
      />
    </div>
  );
};
