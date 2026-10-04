import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
  unit?: string;
  infoTooltip?: string;
  isPositiveImprovement?: boolean; // If true (e.g. score), positive delta is good. If false (e.g. errors), negative delta is good.
  isLoading?: boolean;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  deltaLabel = 'vs previous period',
  unit,
  infoTooltip,
  isPositiveImprovement = true,
  isLoading = false,
  onClick,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn('card-flat p-5 flex flex-col justify-between h-32', className)}>
        <Skeleton variant="text" className="w-24 h-4 mb-2" />
        <Skeleton variant="text" className="w-32 h-8 my-1" />
        <Skeleton variant="text" className="w-40 h-3 mt-2" />
      </div>
    );
  }

  const isInteractive = Boolean(onClick);

  // Delta calculation & status color
  let isGoodDelta = false;
  let isBadDelta = false;
  if (delta !== undefined && delta !== null && delta !== 0) {
    if (isPositiveImprovement) {
      isGoodDelta = delta > 0;
      isBadDelta = delta < 0;
    } else {
      // e.g. for errors or time taken, a reduction is good
      isGoodDelta = delta < 0;
      isBadDelta = delta > 0;
    }
  }

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'card-flat card-hover p-5 flex flex-col justify-between transition-all duration-200',
        isInteractive &&
          'hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
        {infoTooltip && (
          <div className="group relative inline-flex items-center cursor-help">
            <Info className="w-4 h-4 text-[var(--text-muted)]" />
            <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block z-20 w-48 p-2 text-xs bg-[var(--text-main)] text-white rounded-[4px] shadow-sm pointer-events-none">
              {infoTooltip}
            </div>
          </div>
        )}
      </div>

      <div className="my-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-[var(--text-main)]">{value}</span>
        {unit && <span className="text-sm font-medium text-[var(--text-muted)]">{unit}</span>}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {delta !== undefined && delta !== null ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded',
                isGoodDelta && 'text-[var(--success)] bg-emerald-50',
                isBadDelta && 'text-[var(--danger)] bg-orange-50',
                delta === 0 && 'text-[var(--text-muted)] bg-slate-100'
              )}
            >
              {delta > 0 && <TrendingUp className="w-3 h-3" />}
              {delta < 0 && <TrendingDown className="w-3 h-3" />}
              {delta === 0 && <Minus className="w-3 h-3" />}
              {delta > 0 ? `+${delta}` : delta}
            </span>
            <span>{deltaLabel}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">No previous data</span>
        )}
      </div>
    </div>
  );
};
