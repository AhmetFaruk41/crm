import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <header className="bg-white border-b border-ink-200 h-14 flex items-center justify-between px-6">
      <div className="text-sm text-ink-500"></div>
      <div className="relative" ref={ref}>
        <button
          className="flex items-center gap-2 text-sm text-ink-700 hover:text-ink-900 px-3 py-1.5 rounded hover:bg-ink-100"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="h-7 w-7 rounded-full bg-ink-200 grid place-items-center text-xs font-semibold">
            {user?.fullname?.[0] ?? '?'}
          </div>
          <span>{user?.fullname ?? '...'}</span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-44 bg-white border border-ink-200 rounded shadow-md py-1 z-10">
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={logout}
            >
              <LogOut size={14} /> Çıkış Yap
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
