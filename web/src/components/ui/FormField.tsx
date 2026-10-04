import React from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  label: string;
  name?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  error,
  required,
  hint,
  className,
  children,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium text-[var(--text-main)]">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
        {hint && !error && <span className="text-xs text-[var(--text-muted)]">{hint}</span>}
      </div>

      {children}

      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)] mt-0.5 animate-in fade-in duration-100">
          {error}
        </p>
      )}
    </div>
  );
};

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
>(({ className, hasError, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-main)] border rounded-[8px] transition-colors duration-150',
        'border-[var(--border-main)] placeholder:text-slate-400',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:border-transparent focus-visible:outline-none',
        hasError && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
>(({ className, hasError, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-main)] border rounded-[8px] transition-colors duration-150',
        'border-[var(--border-main)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:border-transparent focus-visible:outline-none',
        hasError && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(({ className, hasError, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-main)] border rounded-[8px] transition-colors duration-150',
        'border-[var(--border-main)] placeholder:text-slate-400',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:border-transparent focus-visible:outline-none',
        hasError && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
