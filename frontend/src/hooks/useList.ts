import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ApiRequestConfig } from '../api/client';

export interface ListState<T> {
  data: T | null;
  error: boolean;
  loading: boolean;
  reload: () => void;
  /** Optimistic/yerel güncellemeler için doğrudan set. */
  setData: (value: T) => void;
}

/**
 * Liste verisini yükleyen ortak hook. Eski `useState(null) + useEffect(load)`
 * kalıbının aksine fetch başarısız olursa `error` set edilir; böylece sayfa
 * sonsuza dek "Yükleniyor..."da takılı kalmaz ve tekrar denenebilir.
 */
export function useList<T>(url: string): ListState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setData(null);
    // silent: interceptor'ın kendi toast'ını bastırmıyoruz; ama sayfa da
    // kendi hata durumunu gösteriyor. İkisi birlikte kabul edilebilir.
    api
      .get<T>(url)
      .then((r) => {
        if (!cancelled) setData(r.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  return { data, error, loading: data === null && !error, reload, setData };
}

export type { ApiRequestConfig };
