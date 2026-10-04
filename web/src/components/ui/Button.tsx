import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-[8px] transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none';

    const variants = {
      primary: 'bg-[var(--primary)] text-white hover:bg-blue-700 active:bg-blue-800',
      secondary:
        'bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-blue-100 active:bg-blue-200 border border-transparent',
      outline:
        'bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-main)] hover:bg-slate-50 active:bg-slate-100',
      ghost: 'bg-transparent text-[var(--text-main)] hover:bg-slate-100 active:bg-slate-200',
      danger: 'bg-[var(--danger)] text-white hover:bg-orange-700 active:bg-orange-800',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-4 py-2 h-9 gap-2',
      lg: 'text-base px-5 py-2.5 h-11 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
