import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) throw new HttpError(400, 'Kullanıcı adı ve şifre gerekli');

  const user = await queryOne<any>(
    'SELECT id, username, fullname, password, level FROM users WHERE username = ?',
    [String(username).trim()]
  );
  if (!user) throw new HttpError(401, 'Kullanıcı veya şifre hatalı');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new HttpError(401, 'Kullanıcı veya şifre hatalı');

  const token = signToken({ id: user.id, username: user.username, fullname: user.fullname, level: user.level });
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ id: user.id, username: user.username, fullname: user.fullname, level: user.level });
}));

authRouter.post('/logout', (req, res) => {
  res.clearCookie(env.COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await queryOne<any>(
    'SELECT id, username, fullname, level, phone, email FROM users WHERE id = ?',
    [req.user!.id]
  );
  if (!user) throw new HttpError(401, 'Kullanıcı bulunamadı');
  res.json(user);
}));
