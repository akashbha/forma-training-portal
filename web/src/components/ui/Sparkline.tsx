import React from 'react';
import { cn } from '../../lib/utils';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 24,
  color = 'var(--primary)',
  className,
}) => {
  if (!data || data.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">—</span>;
  }

  if (data.length === 1) {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 2;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastPoint = points.split(' ').pop() || '0,0';
  const [lastX, lastY] = lastPoint.split(',');

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible inline-block align-middle', className)}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
};
