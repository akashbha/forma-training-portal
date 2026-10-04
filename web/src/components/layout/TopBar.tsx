import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, Filter, Calendar, LogOut, Sun, Moon, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '../../context/FilterContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';
import { Batch } from '../../types/api';

export const TopBar: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const { user, isTrainee, logout } = useAuth();
  const { batchId, setBatchId, dateRange, setDateRange } = useFilters();
  const { effectiveTheme, toggleTheme } = useTheme();

  // Fetch batches for filter dropdown (if not trainee)
  const { data: batchesResponse } = useQuery({
    queryKey: ['batches-filter'],
    queryFn: () => api.get<{ data: Batch[] }>('/api/v1/batches?limit=50'),
    enabled: !isTrainee,
  });

  const batches = batchesResponse?.data || [];

  return (
    <header className="h-16 bg-[var(--surface)] border-b border-[var(--border-main)] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
      {/* Mobile Sidebar Trigger & Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="sidebar-toggle-btn p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--background)] rounded-md focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Quick Search Button trigger (Cmd+K) */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
            );
          }}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--background)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
          title="Search anything (Ctrl+K / Cmd+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick search...</span>
          <kbd className="font-mono text-[10px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border-main)] text-[var(--text-muted)]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Global Filter Controls (Batch & Date Range stored in URL) */}
      {!isTrainee ? (
        <div className="flex items-center gap-2.5 flex-wrap flex-1 max-w-lg">
          {/* Batch Selector */}
          <div className="flex items-center gap-1.5 min-w-[170px] flex-1">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 hidden md:inline-block" />
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              aria-label="Filter by training batch"
              className="w-full text-xs font-medium bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-main)] rounded-md px-2.5 py-1.5 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none transition-colors"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Range Preset Selector */}
          <div className="flex items-center gap-1.5 hidden lg:flex">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <select
              value={dateRange.from ? 'custom' : 'all'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setDateRange(undefined, undefined);
                } else if (val === '30d') {
                  const to = new Date().toISOString();
                  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                  setDateRange(from, to);
                } else if (val === '90d') {
                  const to = new Date().toISOString();
                  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
                  setDateRange(from, to);
                }
              }}
              aria-label="Filter by time range"
              className="text-xs font-medium bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-main)] rounded-md px-2.5 py-1.5 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none transition-colors"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="flex-1 text-xs text-[var(--text-muted)] truncate">
          <span className="font-semibold text-[var(--text-main)]">Trainee Portal</span> &mdash; Individual progress & analytics
        </div>
      )}

      {/* Right controls: Theme toggle, User Profile Quick Info, Logout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--background)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
          title={`Switch to ${effectiveTheme === 'light' ? 'Dark' : 'Light'} theme`}
          aria-label={`Switch to ${effectiveTheme === 'light' ? 'Dark' : 'Light'} theme`}
        >
          {effectiveTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* User initials & quick name */}
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-semibold text-[var(--text-main)]">{user?.name}</span>
          <span className="text-[11px] text-[var(--text-muted)] capitalize">{user?.role?.toLowerCase()}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center border border-[var(--border-main)] shrink-0">
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] p-1.5 rounded focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
