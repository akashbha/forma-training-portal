import React, { useState } from 'react';
import { Table as TableIcon, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

export interface ChartCardProps {
  title: string;
  description?: string;
  textSummary?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  tableView?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  textSummary,
  actions,
  children,
  tableView,
  isLoading = false,
  className,
}) => {
  const [showTable, setShowTable] = useState(false);

  if (isLoading) {
    return <Skeleton variant="chart" className={className} />;
  }

  return (
    <div className={cn('card-flat p-5 flex flex-col justify-between', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border-main)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-main)]">{title}</h3>
          {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {tableView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTable(!showTable)}
              className="gap-1.5 text-xs h-7 px-2.5"
            >
              {showTable ? (
                <>
                  <BarChart2 className="w-3.5 h-3.5" />
                  View Chart
                </>
              ) : (
                <>
                  <TableIcon className="w-3.5 h-3.5" />
                  View as Table
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[220px]">
        {showTable && tableView ? tableView : children}
      </div>

      {textSummary && (
        <div className="mt-4 pt-3 border-t border-[var(--border-main)] text-xs text-[var(--text-muted)] flex items-center gap-1.5 bg-slate-50/70 p-2.5 rounded-[6px]">
          <span className="font-semibold text-[var(--text-main)]">Key takeaway:</span>
          <span>{textSummary}</span>
        </div>
      )}
    </div>
  );
};
