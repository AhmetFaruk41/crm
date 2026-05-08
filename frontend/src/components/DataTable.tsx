import { useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  searchable?: (row: T) => string;
  rowKey: (row: T) => string | number;
  empty?: string;
  pageSize?: number;
}

export default function DataTable<T>({
  rows,
  columns,
  searchable,
  rowKey,
  empty = 'Kayıt bulunamadı',
  pageSize = 25,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim() || !searchable) return rows;
    const s = search.toLowerCase().trim();
    return rows.filter((r) => searchable(r).toLowerCase().includes(s));
  }, [rows, search, searchable]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const arr = [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'desc' ? arr.reverse() : arr;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  }

  const dataCols = columns.filter((c) => !c.key.startsWith('_'));
  const actionCols = columns.filter((c) => c.key.startsWith('_'));

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="px-3 sm:px-4 py-3 border-b border-ink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-8"
              placeholder="Ara..."
            />
          </div>
          <div className="text-xs text-ink-500">{filtered.length} kayıt</div>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden">
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-ink-400 text-sm">{empty}</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {pageRows.map((row) => (
              <li key={String(rowKey(row))} className="px-4 py-3">
                <div className="space-y-1.5">
                  {dataCols.map((c) => {
                    const value = c.render ? c.render(row) : (row as any)[c.key];
                    return (
                      <div key={c.key} className="flex items-start gap-3 text-sm">
                        {c.header && (
                          <span className="text-ink-500 text-xs uppercase tracking-wide w-24 shrink-0 pt-0.5">
                            {c.header}
                          </span>
                        )}
                        <div className="min-w-0 flex-1 break-words">{value ?? <span className="text-ink-400">-</span>}</div>
                      </div>
                    );
                  })}
                </div>
                {actionCols.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap gap-1">
                    {actionCols.map((c) => (
                      <div key={c.key}>{c.render ? c.render(row) : null}</div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 border-b border-ink-200 text-left text-ink-600">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-medium select-none ${c.sortValue ? 'cursor-pointer hover:text-ink-900' : ''} ${c.className ?? ''}`}
                  style={c.width ? { width: c.width } : undefined}
                  onClick={() => c.sortValue && toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortValue && sortKey === c.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-ink-400">
                  {empty}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={String(rowKey(row))} className="border-b border-ink-100 hover:bg-ink-50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? ''}`}>
                      {c.render ? c.render(row) : (row as any)[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-3 sm:px-4 py-3 border-t border-ink-200 flex items-center justify-end gap-2 text-sm">
          <button className="btn-secondary disabled:opacity-50" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </button>
          <span className="text-ink-500">
            {safePage} / {totalPages}
          </span>
          <button className="btn-secondary disabled:opacity-50" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
