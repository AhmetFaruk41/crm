import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

export interface AuthUser {
  id: number;
  username: string;
  fullname: string;
  level: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) return next(new HttpError(401, 'Yetkisiz erişim'));
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(new HttpError(401, 'Geçersiz oturum'));
  }
}

// Yönetici (level=1) gerektiren uçlar için. requireAuth'tan SONRA mount edilmeli.
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Yetkisiz erişim'));
  if (req.user.level !== 1) return next(new HttpError(403, 'Bu işlem için yönetici yetkisi gerekli'));
  next();
}
