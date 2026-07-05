import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err?.status ?? 500;
  if (status >= 500) console.error('[error]', err);
  // 5xx hatalarında iç detayı (stack/SQL mesajı vb.) istemciye sızdırma;
  // yalnızca bilinçli HttpError (4xx) mesajları kullanıcıya gösterilir.
  const message =
    status >= 500
      ? env.NODE_ENV === 'production'
        ? 'Sunucu hatası'
        : err?.message ?? 'Internal server error'
      : err?.message ?? 'İstek işlenemedi';
  res.status(status).json({ error: message });
}
