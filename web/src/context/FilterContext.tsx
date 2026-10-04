import React, { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface FilterContextType {
  batchId: string;
  setBatchId: (batchId: string) => void;
  dateRange: { from?: string; to?: string };
  setDateRange: (from?: string, to?: string) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const batchId = searchParams.get('batchId') || '';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  const setBatchId = (newBatchId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newBatchId) {
        next.set('batchId', newBatchId);
      } else {
        next.delete('batchId');
      }
      return next;
    });
  };

  const setDateRange = (newFrom?: string, newTo?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newFrom) next.set('from', newFrom);
      else next.delete('from');

      if (newTo) next.set('to', newTo);
      else next.delete('to');

      return next;
    });
  };

  const clearFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('batchId');
      next.delete('from');
      next.delete('to');
      return next;
    });
  };

  const dateRange = useMemo(() => ({ from, to }), [from, to]);

  return (
    <FilterContext.Provider
      value={{
        batchId,
        setBatchId,
        dateRange,
        setDateRange,
        clearFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
