import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Layers, Calendar, X, CornerDownLeft } from 'lucide-react';
import { api } from '../../lib/api';

interface SearchResultItem {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  type: 'batch' | 'trainee' | 'session';
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search fetch
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get<{
          data: {
            batches: SearchResultItem[];
            trainees: SearchResultItem[];
            sessions: SearchResultItem[];
          };
        }>(`/api/v1/search?q=${encodeURIComponent(query)}`);

        const merged: SearchResultItem[] = [
          ...(res.data.batches || []),
          ...(res.data.trainees || []),
          ...(res.data.sessions || []),
        ];
        setResults(merged);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    navigate(item.url);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Global quick search palette"
    >
      <div
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--border-main)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border-main)] gap-3 bg-[var(--surface)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search trainees, cohorts, or sessions (type to filter)..."
            className="flex-1 bg-transparent border-0 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-0"
            aria-label="Search query"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border-main)]">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-2 divide-y divide-[var(--border-main)]">
          {isLoading && (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              Searching academy records...
            </div>
          )}

          {!isLoading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No matching results found for "{query}".
            </div>
          )}

          {!isLoading && !query.trim() && (
            <div className="py-6 px-4 text-xs text-[var(--text-muted)] space-y-2">
              <p className="font-semibold text-[var(--text-main)]">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/batches'); }}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--background)] text-left"
                >
                  <Layers className="w-4 h-4 text-[var(--primary)]" />
                  <span>Browse All Batches</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/trainees'); }}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--background)] text-left"
                >
                  <Users className="w-4 h-4 text-[var(--success)]" />
                  <span>Trainee Directory</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/compare'); }}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--background)] text-left"
                >
                  <Search className="w-4 h-4 text-[var(--warning)]" />
                  <span>Side-by-Side Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/sessions'); }}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--background)] text-left"
                >
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>Evaluations & Sessions</span>
                </button>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <ul className="space-y-1">
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon =
                  item.type === 'batch'
                    ? Layers
                    : item.type === 'trainee'
                    ? Users
                    : Calendar;

                return (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white'
                          : 'hover:bg-[var(--background)] text-[var(--text-main)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                        <div className="truncate">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-[var(--text-muted)]'}`}>
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-[11px] text-blue-100 shrink-0 ml-2">
                          <span>Select</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2 border-t border-[var(--border-main)] bg-[var(--surface)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="font-mono bg-[var(--background)] px-1 rounded border border-[var(--border-main)]">↑</kbd> <kbd className="font-mono bg-[var(--background)] px-1 rounded border border-[var(--border-main)]">↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-[var(--background)] px-1 rounded border border-[var(--border-main)]">↵</kbd> to jump</span>
          </div>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
};
