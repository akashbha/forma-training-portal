import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Batch, Trainee } from '../types/api';
import { InfoTooltip } from '../components/ui/InfoTooltip';

export const ComparePage: React.FC = () => {
  const { isTrainee } = useAuth();
  const [compareType, setCompareType] = useState<'batch' | 'trainee'>('batch');
  const [idA, setIdA] = useState<string>('');
  const [idB, setIdB] = useState<string>('');

  // Fetch batches list
  const { data: batchesRes } = useQuery({
    queryKey: ['batches-compare-list'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=100'),
    enabled: !isTrainee,
  });

  // Fetch trainees list
  const { data: traineesRes } = useQuery({
    queryKey: ['trainees-compare-list'],
    queryFn: () => api.get<{ data: Trainee[] }>('/api/v1/trainees?limit=100'),
    enabled: !isTrainee,
  });

  const batches = batchesRes?.data || [];
  const trainees = traineesRes?.data || [];

  // Set default selections once loaded
  React.useEffect(() => {
    if (compareType === 'batch' && batches.length >= 2 && (!idA || !idB)) {
      setIdA(batches[0].id);
      setIdB(batches[1].id);
    } else if (compareType === 'trainee' && trainees.length >= 2 && (!idA || !idB)) {
      setIdA(trainees[0].id);
      setIdB(trainees[1].id);
    }
  }, [compareType, batches, trainees, idA, idB]);

  // Fetch comparison data
  const { data: comparisonRes, isLoading } = useQuery({
    queryKey: ['comparison-data', compareType, idA, idB],
    queryFn: () =>
      api.get<{
        data: {
          entityA: any;
          entityB: any;
          comparison: {
            metric: string;
            valueA: number;
            valueB: number;
            favors: 'A' | 'B' | 'EQUAL';
          }[];
        };
      }>(`/api/v1/insights/compare?type=${compareType}&idA=${idA}&idB=${idB}`),
    enabled: Boolean(idA && idB && idA !== idB),
  });

  const comparisonData = comparisonRes?.data;

  if (isTrainee) {
    return (
      <div className="card-flat p-8 text-center max-w-xl mx-auto my-12 space-y-4">
        <Sparkles className="w-12 h-12 text-[var(--primary)] mx-auto" />
        <h2 className="text-lg font-bold text-[var(--text-main)]">Private Trainee Benchmarking</h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          In accordance with privacy guidelines, trainees are evaluated purely on personal progress and baseline batch standards without peer comparative exposure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>Side-by-Side Performance Comparison</span>
            <InfoTooltip
              title="Comparative Engine"
              content="Enables direct benchmarking between any two batches or trainees across average score, error rates, growth slope (least squares regression delta), and stability."
            />
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Compare key analytical metrics side by side to identify cohort variations or training gaps.
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center bg-[var(--background)] p-1 rounded-lg border border-[var(--border-main)] text-xs">
          <button
            type="button"
            onClick={() => {
              setCompareType('batch');
              setIdA('');
              setIdB('');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              compareType === 'batch'
                ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Compare Batches
          </button>
          <button
            type="button"
            onClick={() => {
              setCompareType('trainee');
              setIdA('');
              setIdB('');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              compareType === 'trainee'
                ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Compare Trainees
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="card-flat p-4 sm:p-5 flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Selector A */}
        <div className="w-full md:w-5/12 space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
            <span>Select First {compareType === 'batch' ? 'Batch' : 'Trainee'} (Side A)</span>
          </label>
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="w-full text-xs font-medium bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-main)] rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            aria-label="Side A selection"
          >
            {compareType === 'batch'
              ? batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.program})
                  </option>
                ))
              : trainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.batch.name})
                  </option>
                ))}
          </select>
        </div>

        {/* Swap indicator */}
        <div className="p-2 rounded-full bg-[var(--background)] border border-[var(--border-main)] text-[var(--text-muted)] shrink-0 hidden md:flex items-center justify-center">
          <ArrowLeftRight className="w-4 h-4" />
        </div>

        {/* Selector B */}
        <div className="w-full md:w-5/12 space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Select Second {compareType === 'batch' ? 'Batch' : 'Trainee'} (Side B)</span>
          </label>
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="w-full text-xs font-medium bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-main)] rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            aria-label="Side B selection"
          >
            {compareType === 'batch'
              ? batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.program})
                  </option>
                ))
              : trainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.batch.name})
                  </option>
                ))}
          </select>
        </div>
      </div>

      {idA === idB && idA && (
        <div className="p-3 text-center text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200">
          Please select two different {compareType === 'batch' ? 'batches' : 'trainees'} to view comparative metrics.
        </div>
      )}

      {/* Comparison Grid Results */}
      {comparisonData && idA !== idB && (
        <div className="space-y-6">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-flat p-4 border-t-4 border-t-[var(--primary)]">
              <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">Side A</span>
              <h3 className="text-base font-bold text-[var(--text-main)] mt-1">{comparisonData.entityA.name}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {compareType === 'batch'
                  ? `Trainer: ${comparisonData.entityA.trainer} • ${comparisonData.entityA.traineeCount} Trainees`
                  : `Batch: ${comparisonData.entityA.batch} • ${comparisonData.entityA.sessionsCount} Sessions Evaluated`}
              </p>
            </div>

            <div className="card-flat p-4 border-t-4 border-t-emerald-500">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Side B</span>
              <h3 className="text-base font-bold text-[var(--text-main)] mt-1">{comparisonData.entityB.name}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {compareType === 'batch'
                  ? `Trainer: ${comparisonData.entityB.trainer} • ${comparisonData.entityB.traineeCount} Trainees`
                  : `Batch: ${comparisonData.entityB.batch} • ${comparisonData.entityB.sessionsCount} Sessions Evaluated`}
              </p>
            </div>
          </div>

          {/* Comparison Metrics Table */}
          <div className="card-flat overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-main)] font-semibold text-xs text-[var(--text-main)]">
              Key Metric Benchmarks
            </div>
            <div className="table-responsive-container">
              <table className="w-full text-left text-xs table-sticky-col">
                <thead className="bg-[var(--background)] border-b border-[var(--border-main)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[var(--text-main)]">Metric</th>
                    <th className="px-4 py-3 font-semibold text-[var(--primary)]">{comparisonData.entityA.name}</th>
                    <th className="px-4 py-3 font-semibold text-emerald-600">{comparisonData.entityB.name}</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Favors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {comparisonData.comparison.map((item, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-[var(--background)]/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-[var(--text-main)]">
                          {item.metric}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-xs">
                          {item.valueA}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-xs">
                          {item.valueB}
                        </td>
                        <td className="px-4 py-3">
                          {item.favors === 'EQUAL' ? (
                            <span className="text-[11px] text-[var(--text-muted)] font-medium">Tied</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full ${
                                item.favors === 'A'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{item.favors === 'A' ? comparisonData.entityA.name : comparisonData.entityB.name}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
