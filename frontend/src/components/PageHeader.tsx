import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Crumb { label: string; to?: string }

export default function PageHeader({ title, crumbs, actions }: { title: string; crumbs?: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-ink-900 truncate">{title}</h1>
        {crumbs && crumbs.length > 0 && (
          <nav className="mt-1 text-xs text-ink-500 flex items-center gap-1 flex-wrap">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.to ? <Link to={c.to} className="hover:text-ink-700">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
