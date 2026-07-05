import { useState, useCallback, useRef, useEffect } from 'react';

interface InputOpts { placeholder?: string; required?: boolean; initialValue?: string }
interface Opts { title?: string; message: string; confirmLabel?: string; danger?: boolean; input?: InputOpts }
type Resolver = (result: boolean | string | null) => void;

let openConfirm: ((opts: Opts) => Promise<boolean | string | null>) | null = null;

export function ConfirmHost() {
  const [opts, setOpts] = useState<Opts | null>(null);
  const [value, setValue] = useState('');
  const resolverRef = useRef<Resolver | null>(null);

  const show = useCallback((o: Opts) => {
    return new Promise<boolean | string | null>((resolve) => {
      resolverRef.current = resolve;
      setValue(o.input?.initialValue ?? '');
      setOpts(o);
    });
  }, []);

  useEffect(() => {
    openConfirm = show;
    return () => {
      openConfirm = null;
    };
  }, [show]);

  const close = useCallback((result: boolean | string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
    setValue('');
  }, []);

  if (!opts) return null;

  const hasInput = !!opts.input;
  const trimmed = value.trim();
  const confirmDisabled = hasInput && !!opts.input?.required && !trimmed;

  function onConfirm() {
    if (hasInput) close(trimmed || null);
    else close(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-ink-200">
          <h3 className="font-semibold">{opts.title ?? 'Onay'}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-ink-700 space-y-3">
          <div>{opts.message}</div>
          {hasInput && (
            <input
              autoFocus
              className="input"
              placeholder={opts.input?.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !confirmDisabled) onConfirm();
                if (e.key === 'Escape') close(hasInput ? null : false);
              }}
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-ink-200 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => close(hasInput ? null : false)}>İptal</button>
          <button
            className={opts.danger ? 'btn-danger' : 'btn-primary'}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {opts.confirmLabel ?? 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirm(opts: Omit<Opts, 'input'>): Promise<boolean> {
  if (!openConfirm) return Promise.resolve(window.confirm(opts.message));
  return openConfirm(opts).then((r) => r === true);
}

/** Metin girişi isteyen modal; onaylanınca değeri, iptal/boş bırakılınca null döner. */
export function promptText(opts: Omit<Opts, 'input'> & { input?: InputOpts }): Promise<string | null> {
  if (!openConfirm) {
    const r = window.prompt(opts.message);
    return Promise.resolve(r?.trim() ? r.trim() : null);
  }
  const merged: Opts = { ...opts, input: opts.input ?? { required: true } };
  return openConfirm(merged).then((r) => (typeof r === 'string' ? r : null));
}
