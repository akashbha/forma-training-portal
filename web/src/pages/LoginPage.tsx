import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { FormField, Input } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { Shield, UserCheck, Users, Info } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [forgotPasswordNote, setForgotPasswordNote] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setGlobalError(null);
      const user = await login(values.email, values.password);
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        navigate(redirect);
      } else if (user.role === 'TRAINEE' && user.traineeId) {
        navigate(`/trainees/${user.traineeId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Unable to sign in. Please check your credentials or click a demo account below.');
      }
    }
  };

  const handleQuickLogin = (email: string) => {
    setValue('email', email);
    setValue('password', 'formaPassword123!');
    setGlobalError(null);
    setForgotPasswordNote(false);
    onSubmit({ email, password: 'formaPassword123!' });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[var(--primary)] text-white font-mono font-bold text-2xl mb-3 shadow-sm">
            f.
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Sign in to forma
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Training Analytics & Performance Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="card-flat bg-[var(--surface)] p-6 sm:p-8 shadow-sm space-y-4">
          {globalError && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-[var(--danger)] bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 rounded-md animate-in fade-in duration-150"
            >
              {globalError}
            </div>
          )}

          {forgotPasswordNote && (
            <div
              role="status"
              className="p-3 text-xs font-medium text-[var(--primary)] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-md animate-in fade-in duration-150 flex items-start gap-2"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>To reset access, please contact your academy administrator or use one of the one-click demo credentials below.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              label="Email address"
              name="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@organization.com"
                hasError={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>

            <FormField
              label="Password"
              name="password"
              required
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                hasError={Boolean(errors.password)}
                {...register('password')}
              />
            </FormField>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setForgotPasswordNote(true)}
                className="text-[var(--primary)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded text-left"
              >
                Forgot your password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Sign in
            </Button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-4 border-t border-[var(--border-main)] space-y-2">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">
              One-Click Demo Access
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@forma.internal')}
                className="flex flex-col items-center p-2 rounded-lg border border-[var(--border-main)] bg-[var(--background)] hover:bg-[var(--surface)] hover:border-[var(--primary)] transition-colors text-center"
              >
                <Shield className="w-4 h-4 text-amber-500 mb-1" />
                <span className="text-xs font-semibold text-[var(--text-main)]">Admin</span>
                <span className="text-[10px] text-[var(--text-muted)]">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('trainer.sarah@forma.internal')}
                className="flex flex-col items-center p-2 rounded-lg border border-[var(--border-main)] bg-[var(--background)] hover:bg-[var(--surface)] hover:border-[var(--primary)] transition-colors text-center"
              >
                <Users className="w-4 h-4 text-[var(--primary)] mb-1" />
                <span className="text-xs font-semibold text-[var(--text-main)]">Trainer</span>
                <span className="text-[10px] text-[var(--text-muted)]">Cohorts</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('trainee.alex.rivera@forma.internal')}
                className="flex flex-col items-center p-2 rounded-lg border border-[var(--border-main)] bg-[var(--background)] hover:bg-[var(--surface)] hover:border-[var(--primary)] transition-colors text-center"
              >
                <UserCheck className="w-4 h-4 text-emerald-500 mb-1" />
                <span className="text-xs font-semibold text-[var(--text-main)]">Trainee</span>
                <span className="text-[10px] text-[var(--text-muted)]">Progress</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
