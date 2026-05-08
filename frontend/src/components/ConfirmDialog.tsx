import { useState, useCallback, useRef, useEffect } from 'react';

interface Opts { title?: string; message: string; confirmLabel?: string; danger?: boolean }
type Resolver = (ok: boolean) => void;

let openConfirm: ((opts: Opts) => Promise<boolean>) | null = null;

export function ConfirmHost() {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const show = useCallback((o: Opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(o);
    });
  }, []);

  useEffect(() => {
    openConfirm = show;
    return () => {
      openConfirm = null;
    };
  }, [show]);

  function close(ok: boolean) {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpts(null);
  }

  if (!opts) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-ink-200">
          <h3 className="font-semibold">{opts.title ?? 'Onay'}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-ink-700">{opts.message}</div>
        <div className="px-5 py-3 border-t border-ink-200 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => close(false)}>İptal</button>
          <button className={opts.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)}>
            {opts.confirmLabel ?? 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirm(opts: Opts): Promise<boolean> {
  if (!openConfirm) return Promise.resolve(window.confirm(opts.message));
  return openConfirm(opts);
}
