import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** If set, render as Link to this path */
  to?: string;
  /** Label for the back link (e.g. "Back to Inventory"). Default "Back" */
  label?: string;
  className?: string;
}

export function BackButton({ to, label = 'Back', className = '' }: BackButtonProps) {
  const navigate = useNavigate();

  const baseClass =
    'inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors';

  if (to) {
    return (
      <Link to={to} className={`${baseClass} ${className}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => navigate(-1)} className={`${baseClass} ${className}`}>
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
