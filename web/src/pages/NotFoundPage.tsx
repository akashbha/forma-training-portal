import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mb-4">
        <HelpCircle className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">Page Not Found</h1>
      <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary" size="sm">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
