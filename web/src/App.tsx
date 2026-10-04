import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FilterProvider } from './context/FilterContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DesignPage } from './pages/DesignPage';
import { OverviewPage } from './pages/OverviewPage';
import { BatchesPage } from './pages/BatchesPage';
import { BatchDetailPage } from './pages/BatchDetailPage';
import { TraineesPage } from './pages/TraineesPage';
import { TraineeDetailPage } from './pages/TraineeDetailPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { NewSessionPage } from './pages/NewSessionPage';
import { GoalsPage } from './pages/GoalsPage';
import { AuditPage } from './pages/AuditPage';
import { ComparePage } from './pages/ComparePage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-sm text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
          Loading forma portal...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Trainee role guard: trainees can see their own progress page, design showcase, and goals
  if (user.role === 'TRAINEE') {
    const traineeId = user.traineeId;
    const isAllowedTraineePage =
      (traineeId && location.pathname === `/trainees/${traineeId}`) ||
      location.pathname === '/trainees' ||
      location.pathname === '/goals' ||
      location.pathname === '/design';

    if (!isAllowedTraineePage && traineeId) {
      return <Navigate to={`/trainees/${traineeId}`} replace />;
    }
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <FilterProvider>
              <ToastProvider>
                <Routes>
                  {/* Public Route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected Portal Routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/design" element={<DesignPage />} />
                    <Route path="/batches" element={<BatchesPage />} />
                    <Route path="/batches/:id" element={<BatchDetailPage />} />
                    <Route path="/trainees" element={<TraineesPage />} />
                    <Route path="/trainees/:id" element={<TraineeDetailPage />} />
                    <Route path="/sessions" element={<SessionsPage />} />
                    <Route path="/sessions/new" element={<NewSessionPage />} />
                    <Route path="/sessions/:id" element={<SessionDetailPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/compare" element={<ComparePage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </ToastProvider>
            </FilterProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
