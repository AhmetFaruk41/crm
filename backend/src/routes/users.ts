import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const usersRouter = Router();

usersRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query('SELECT id, fullname, username, level, phone, email, create_date FROM users ORDER BY level, fullname');
  res.json(rows);
}));

usersRouter.get('/:id', asyncHandler(async (req, res) => {
  const u = await queryOne('SELECT id, fullname, username, level, phone, email FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw new HttpError(404, 'Kullanıcı bulunamadı');
  res.json(u);
}));

usersRouter.post('/', asyncHandler(async (req, res) => {
  const { fullname, username, password, level, phone, email } = req.body ?? {};
  if (!fullname || !username || !password) throw new HttpError(400, 'Eksik alan');
  if (String(password).length < 8) throw new HttpError(400, 'Şifre en az 8 karakter olmalı');

  const dup = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (dup) throw new HttpError(409, 'Bu kullanıcı adı zaten var');

  const hash = await bcrypt.hash(password, 10);
  const r = await execute(
    'INSERT INTO users (fullname, username, password, level, phone, email) VALUES (?, ?, ?, ?, ?, ?)',
    [fullname, username, hash, Number(level) || 0, phone ?? '', email ?? '']
  );
  res.json({ id: r.insertId });
}));

usersRouter.put('/:id', asyncHandler(async (req, res) => {
  const { fullname, username, level, phone, email } = req.body ?? {};
  if (!fullname || !username) throw new HttpError(400, 'Eksik alan');
  const targetId = Number(req.params.id);

  // username uniqueness (allow keeping own)
  const dup = await queryOne('SELECT id FROM users WHERE username = ? AND id <> ?', [username, targetId]);
  if (dup) throw new HttpError(409, 'Bu kullanıcı adı başka bir kullanıcıya ait');

  // last-admin guard
  if (Number(level) !== 1) {
    const target = await queryOne<any>('SELECT level FROM users WHERE id = ?', [targetId]);
    if (target?.level === 1) {
      const admins = await queryOne<any>('SELECT COUNT(*) AS c FROM users WHERE level = 1');
      if (Number(admins?.c) <= 1) throw new HttpError(400, 'Son yöneticiyi normal kullanıcıya çeviremezsiniz');
    }
  }

  await execute(
    'UPDATE users SET fullname = ?, username = ?, level = ?, phone = ?, email = ? WHERE id = ?',
    [fullname, username, Number(level) || 0, phone ?? '', email ?? '', targetId]
  );
  res.json({ ok: true });
}));

usersRouter.put('/:id/password', asyncHandler(async (req, res) => {
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) throw new HttpError(400, 'Şifre en az 8 karakter olmalı');
  const hash = await bcrypt.hash(password, 10);
  await execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
  res.json({ ok: true });
}));

usersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user?.id === targetId) throw new HttpError(400, 'Kendi hesabınızı silemezsiniz');

  const target = await queryOne<any>('SELECT level FROM users WHERE id = ?', [targetId]);
  if (target?.level === 1) {
    const admins = await queryOne<any>('SELECT COUNT(*) AS c FROM users WHERE level = 1');
    if (Number(admins?.c) <= 1) throw new HttpError(400, 'Son yöneticiyi silemezsiniz');
  }

  await execute('DELETE FROM users WHERE id = ?', [targetId]);
  res.json({ ok: true });
}));
