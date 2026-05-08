import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Crumb { label: string; to?: string }

export default function PageHeader({ title, crumbs, actions }: { title: string; crumbs?: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        {crumbs && crumbs.length > 0 && (
          <nav className="mt-1 text-xs text-ink-500 flex items-center gap-1">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.to ? <Link to={c.to} className="hover:text-ink-700">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
