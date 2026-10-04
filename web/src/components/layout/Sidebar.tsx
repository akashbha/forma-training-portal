import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Users,
  Calendar,
  Sparkles,
  UserCheck,
  Target,
  Shield,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const Sidebar: React.FC<{ className?: string; onClose?: () => void }> = ({
  className,
  onClose,
}) => {
  const { user, isTrainee, isAdmin, logout } = useAuth();

  const navItems = isTrainee
    ? [
        {
          label: 'My Progress',
          to: user?.traineeId ? `/trainees/${user.traineeId}` : '/trainees',
          icon: UserCheck,
        },
        { label: 'Goals', to: '/goals', icon: Target },
      ]
    : [
        { label: 'Overview', to: '/', icon: LayoutDashboard },
        { label: 'Batches', to: '/batches', icon: Layers },
        { label: 'Trainees', to: '/trainees', icon: Users },
        { label: 'Sessions', to: '/sessions', icon: Calendar },
        { label: 'Goals', to: '/goals', icon: Target },
        { label: 'Compare', to: '/compare', icon: ArrowLeftRight },
      ];

  return (
    <aside
      className={cn(
        'w-64 bg-[var(--surface)] border-r border-[var(--border-main)] flex flex-col justify-between shrink-0 select-none h-full',
        className
      )}
    >
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[var(--border-main)]">
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 font-bold text-lg text-[var(--text-main)] tracking-tight focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded px-1"
          >
            <div className="w-8 h-8 rounded-[6px] bg-[var(--primary)] text-white flex items-center justify-center font-mono font-bold text-base">
              f.
            </div>
            <span>forma</span>
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 flex flex-col gap-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-main)]',
                    'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {isAdmin && (
            <NavLink
              to="/audit"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors duration-150',
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-main)]',
                  'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none'
                )
              }
            >
              <Shield className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Audit Log</span>
            </NavLink>
          )}

          <div className="my-2 border-t border-[var(--border-main)]" />

          <NavLink
            to="/design"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors duration-150',
                isActive
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-main)]',
                'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none'
              )
            }
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Design System</span>
          </NavLink>
        </nav>
      </div>

      {/* User Footer info & Logout */}
      <div className="p-4 border-t border-[var(--border-main)] bg-[var(--background)]/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-[var(--text-main)] truncate">{user?.name}</p>
              <p className="text-[11px] text-[var(--text-muted)] capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-[6px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
