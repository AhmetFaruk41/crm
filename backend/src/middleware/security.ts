import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './error.js';
import { env } from '../config/env.js';

// Harici bağımlılık (helmet) eklemeden temel güvenlik başlıkları. Bu bir API
// sunucusu olduğu için yalnızca anlamlı olan başlıklar set edilir.
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// Basit in-memory sabit-pencere rate limiter. Tek-instance bir CRM paneli için
// yeterli; yatay ölçeklenirse Redis tabanlı bir çözüme geçilmeli.
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, message = 'Çok fazla deneme yaptınız, lütfen biraz sonra tekrar deneyin' } = opts;

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Bellek sızıntısını önlemek için ara sıra süresi dolmuş kayıtları temizle.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(new HttpError(429, message));
    }
    next();
  };
}
