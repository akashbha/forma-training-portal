import React from 'react';
import { cn, getStatusLabel } from '../../lib/utils';
import { PerformanceStatus } from '../../types/api';

export interface StatusBadgeProps {
  status: PerformanceStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className }) => {
  const normalized = status.toUpperCase();

  let styles = 'bg-slate-100 text-[var(--text-muted)] border-slate-200';
  let dotColor = 'bg-slate-400';

  if (normalized === 'ON_TRACK' || normalized === 'PASSED') {
    styles = 'bg-emerald-50 text-[var(--success)] border-emerald-200';
    dotColor = 'bg-[var(--success)]';
  } else if (normalized === 'NEEDS_SUPPORT') {
    styles = 'bg-amber-50 text-[var(--warning)] border-amber-200';
    dotColor = 'bg-[var(--warning)]';
  } else if (normalized === 'AT_RISK' || normalized === 'FAILED') {
    styles = 'bg-orange-50 text-[var(--danger)] border-orange-200';
    dotColor = 'bg-[var(--danger)]';
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border',
        styles,
        sizes[size],
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      {getStatusLabel(status)}
    </span>
  );
};
