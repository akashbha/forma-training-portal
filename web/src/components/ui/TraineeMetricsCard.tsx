import React from 'react';
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Target, Sparkles } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface TraineeMetricsCardProps {
  averageScore: number;
  averageErrors: number;
  averageTime: number;
  improvement: {
    slope: number;
    totalDelta: number;
    trendDirection: 'IMPROVING' | 'STEADY' | 'DECLINING';
    sampleCount: number;
  };
  consistency: {
    consistencyScore: number;
    standardDeviation: number;
  };
  projection: {
    projectedScore: number;
    confidenceRange: [number, number];
    currentAverage: number;
    label: string;
    sampleCount: number;
  } | null;
}

export const TraineeMetricsCard: React.FC<TraineeMetricsCardProps> = ({
  averageScore,
  averageErrors,
  averageTime,
  improvement,
  consistency,
  projection,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Overall Average Score */}
        <div className="card-flat p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Overall Score Avg</span>
            <span className="font-semibold text-[var(--text-main)]">/ 100</span>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1.5">
            {averageScore.toFixed(1)}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Across {improvement.sampleCount} evaluated sessions
          </div>
        </div>

        {/* 2. Improvement Slope & Delta */}
        <div className="card-flat p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center">
              <span>Improvement Trend</span>
              <InfoTooltip
                title="Improvement Calculation"
                content="Improvement is measured using two parameters: (1) Ordinary Least Squares (OLS) slope of scores over chronological session index, and (2) Total Delta: average of the latest 3 sessions minus average of the first 3 sessions."
              />
            </span>
            {improvement.trendDirection === 'IMPROVING' ? (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Improving</span>
              </span>
            ) : improvement.trendDirection === 'DECLINING' ? (
              <span className="inline-flex items-center text-red-600 dark:text-red-400 font-bold text-xs gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Declining</span>
              </span>
            ) : (
              <span className="inline-flex items-center text-[var(--text-muted)] font-medium text-xs gap-0.5">
                <Minus className="w-3.5 h-3.5" />
                <span>Steady</span>
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1.5 flex items-baseline gap-2">
            <span>{improvement.totalDelta >= 0 ? `+${improvement.totalDelta.toFixed(1)}` : improvement.totalDelta.toFixed(1)}</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Slope: {improvement.slope > 0 ? `+${improvement.slope}` : improvement.slope} pts/session
          </div>
        </div>

        {/* 3. Consistency Index */}
        <div className="card-flat p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center">
              <span>Score Consistency</span>
              <InfoTooltip
                title="Consistency Calculation"
                content="Consistency index is computed as 100 minus the scaled sample standard deviation of scores (clamped between 0 and 100). Higher scores indicate steady, predictable evaluation results with minimal volatility."
              />
            </span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1.5 flex items-baseline gap-2">
            <span>{consistency.consistencyScore}</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">/ 100</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Std Dev: ±{consistency.standardDeviation.toFixed(1)} pts
          </div>
        </div>

        {/* 4. Errors & Time Efficiency */}
        <div className="card-flat p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Avg Errors & Time</span>
            <Target className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1.5">
            {averageErrors.toFixed(1)} <span className="text-xs font-normal text-[var(--text-muted)]">errs</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Avg Time: {formatTime(Math.round(averageTime))}
          </div>
        </div>
      </div>

      {/* Clearly Labelled Linear Score Projection (Hidden when < 5 sessions) */}
      {projection && (
        <div className="card-flat p-4 border-l-4 border-l-[var(--primary)] bg-gradient-to-r from-blue-50/50 to-[var(--surface)] dark:from-blue-950/20 dark:to-[var(--surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span className="text-xs font-bold text-[var(--primary)] tracking-wide uppercase">
                {projection.label}
              </span>
              <InfoTooltip
                title="Linear Trend Projection"
                content="Projected final score evaluated via ordinary least squares trend line at program completion, with confidence interval range [min - max]. Automatically hidden when fewer than 5 evaluated sessions exist."
              />
            </div>
            <p className="text-xs text-[var(--text-main)] font-medium">
              Projected Final Score Target: <strong className="font-mono text-sm">{projection.projectedScore}</strong> (Range: <span className="font-mono text-xs">{projection.confidenceRange[0]} – {projection.confidenceRange[1]}</span>)
            </p>
          </div>

          <span className="text-[11px] text-[var(--text-muted)] bg-[var(--background)] px-2.5 py-1 rounded border border-[var(--border-main)] self-start sm:self-center shrink-0">
            Based on {projection.sampleCount} sessions
          </span>
        </div>
      )}
    </div>
  );
};
