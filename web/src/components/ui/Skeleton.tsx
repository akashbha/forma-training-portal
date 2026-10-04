import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'chart' | 'table-row';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'text' }) => {
  const baseStyles = 'animate-pulse bg-slate-200/80 rounded-[4px]';

  if (variant === 'circle') {
    return <div className={cn(baseStyles, 'rounded-full w-8 h-8', className)} />;
  }

  if (variant === 'card') {
    return <div className={cn(baseStyles, 'card-flat h-32 w-full', className)} />;
  }

  if (variant === 'chart') {
    return (
      <div className={cn('card-flat p-5 w-full h-72 flex flex-col justify-between', className)}>
        <div className="flex justify-between items-center">
          <div className={cn(baseStyles, 'w-36 h-5')} />
          <div className={cn(baseStyles, 'w-24 h-6')} />
        </div>
        <div className="flex items-end gap-2 h-44 pt-4">
          <div className={cn(baseStyles, 'flex-1 h-32')} />
          <div className={cn(baseStyles, 'flex-1 h-20')} />
          <div className={cn(baseStyles, 'flex-1 h-40')} />
          <div className={cn(baseStyles, 'flex-1 h-28')} />
          <div className={cn(baseStyles, 'flex-1 h-36')} />
          <div className={cn(baseStyles, 'flex-1 h-44')} />
        </div>
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={cn('flex items-center gap-4 py-3 px-4 border-b border-[var(--border-main)]', className)}>
        <div className={cn(baseStyles, 'w-1/4 h-4')} />
        <div className={cn(baseStyles, 'w-1/4 h-4')} />
        <div className={cn(baseStyles, 'w-1/6 h-4')} />
        <div className={cn(baseStyles, 'w-1/6 h-4')} />
        <div className={cn(baseStyles, 'w-1/6 h-4')} />
      </div>
    );
  }

  return <div className={cn(baseStyles, 'h-4 w-full', className)} />;
};
