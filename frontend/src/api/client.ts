import axios, { type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

export interface ApiRequestConfig extends InternalAxiosRequestConfig {
  silent?: boolean;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const cfg = (err?.config ?? {}) as ApiRequestConfig;
    const status: number | undefined = err?.response?.status;
    const url: string = cfg.url ?? '';
    const msg = err?.response?.data?.error ?? err.message;

    const isAuthProbe = url.endsWith('/auth/me') || url.endsWith('/auth/login');

    if (status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !isAuthProbe) {
        window.location.href = '/login';
      }
    } else if (status && status >= 400 && !cfg.silent && !isAuthProbe) {
      toast.error(msg, { id: `api:${status}:${msg}` });
    }
    return Promise.reject(err);
  }
);
