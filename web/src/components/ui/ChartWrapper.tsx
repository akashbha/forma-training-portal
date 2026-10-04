import React, { useState } from 'react';
import { BarChart3, Table as TableIcon } from 'lucide-react';

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  summaryText: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
  children: React.ReactNode;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  subtitle,
  summaryText,
  tableHeaders,
  tableRows,
  children,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <div className="card-flat p-4 sm:p-5 flex flex-col space-y-3">
      {/* Header bar with View Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center bg-[var(--background)] p-0.5 rounded-lg border border-[var(--border-main)] text-xs">
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            aria-pressed={viewMode === 'chart'}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            aria-pressed={viewMode === 'table'}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>View as Table</span>
          </button>
        </div>
      </div>

      {/* Main Display: Chart or Table */}
      <div className="pt-2 min-h-[220px]">
        {viewMode === 'chart' ? (
          children
        ) : (
          <div className="table-responsive-container max-h-[300px] border border-[var(--border-main)] rounded-lg">
            <table className="w-full text-left text-xs table-sticky-col">
              <thead className="bg-[var(--background)] border-b border-[var(--border-main)] text-[var(--text-muted)]">
                <tr>
                  {tableHeaders.map((header, idx) => (
                    <th key={idx} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[var(--background)] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-[var(--text-main)] font-mono text-xs">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Text Summary for Screen Readers & Quick Comprehension */}
      <div className="text-xs text-[var(--text-muted)] bg-[var(--background)] p-2.5 rounded-md border border-[var(--border-main)] flex items-start gap-2">
        <span className="font-semibold text-[var(--text-main)] shrink-0">Summary:</span>
        <span className="leading-relaxed">{summaryText}</span>
      </div>
    </div>
  );
};
