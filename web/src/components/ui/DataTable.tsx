import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  className?: string;
  stickyHeader?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no records matching your current filter criteria.',
  onRowClick,
  pageSize = 10,
  className,
  stickyHeader = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  if (isLoading) {
    return (
      <div className={cn('card-flat overflow-hidden', className)}>
        <div className="p-4 border-b border-[var(--border-main)] flex gap-4">
          <Skeleton variant="text" className="w-1/4 h-4" />
          <Skeleton variant="text" className="w-1/4 h-4" />
          <Skeleton variant="text" className="w-1/4 h-4" />
        </div>
        <div className="divide-y divide-[var(--border-main)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        className={className}
      />
    );
  }

  return (
    <div className={cn('card-flat overflow-hidden flex flex-col', className)}>
      <div className="overflow-x-auto table-responsive-container">
        <table className="w-full text-left border-collapse text-sm table-sticky-col">
          <thead className={cn('bg-[var(--surface)] border-b border-[var(--border-main)]', stickyHeader && 'sticky top-0 z-10')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isNumeric = (header.column.columnDef.meta as any)?.isNumeric;
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        'py-3 px-4 font-semibold text-xs text-[var(--text-muted)] tracking-normal',
                        isNumeric ? 'text-right' : 'text-left'
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 font-semibold text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded px-1 -mx-1',
                            isNumeric && 'flex-row-reverse'
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === 'asc' && <ArrowUp className="w-3.5 h-3.5 text-[var(--primary)]" />}
                          {sortDirection === 'desc' && <ArrowDown className="w-3.5 h-3.5 text-[var(--primary)]" />}
                          {!sortDirection && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border-main)] bg-[var(--surface)]">
            {table.getRowModel().rows.map((row) => {
              const isClickable = Boolean(onRowClick);
              return (
                <tr
                  key={row.id}
                  onClick={isClickable ? () => onRowClick?.(row.original) : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === 'Enter') {
                            onRowClick?.(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'transition-colors duration-100',
                    isClickable &&
                      'hover:bg-blue-50/40 cursor-pointer focus-visible:outline-none focus-visible:bg-blue-50/70'
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = (cell.column.columnDef.meta as any)?.isNumeric;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'py-3 px-4 text-[var(--text-main)] whitespace-nowrap align-middle',
                          isNumeric ? 'text-right font-mono text-xs' : 'text-left'
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-main)] bg-slate-50/50 text-xs text-[var(--text-muted)]">
          <div>
            Showing{' '}
            <span className="font-semibold text-[var(--text-main)]">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-[var(--text-main)]">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                data.length
              )}
            </span>{' '}
            of <span className="font-semibold text-[var(--text-main)]">{data.length}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 px-2"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="font-medium text-[var(--text-main)]">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 px-2"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
