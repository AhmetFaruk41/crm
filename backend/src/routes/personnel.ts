import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const personnelRouter = Router();

personnelRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await query('SELECT id, fullname, email, phone FROM personel ORDER BY fullname'));
}));

personnelRouter.get('/:id', asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT id, fullname, email, phone FROM personel WHERE id = ?', [req.params.id]);
  if (!p) throw new HttpError(404, 'Personel bulunamadı');
  res.json(p);
}));

personnelRouter.post('/', asyncHandler(async (req, res) => {
  const { fullname, email, phone } = req.body ?? {};
  if (!fullname) throw new HttpError(400, 'İsim gerekli');
  const r = await execute('INSERT INTO personel (fullname, email, phone) VALUES (?, ?, ?)', [fullname, email ?? '', phone ?? '']);
  res.json({ id: r.insertId });
}));

personnelRouter.put('/:id', asyncHandler(async (req, res) => {
  const { fullname, email, phone } = req.body ?? {};
  if (!fullname) throw new HttpError(400, 'İsim gerekli');
  const r = await execute('UPDATE personel SET fullname = ?, email = ?, phone = ? WHERE id = ?', [fullname, email ?? '', phone ?? '', req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Personel bulunamadı');
  res.json({ ok: true });
}));

personnelRouter.delete('/:id', asyncHandler(async (req, res) => {
  // block if any project references this personel
  const proj = await queryOne('SELECT id FROM projects WHERE personel_id = ?', [req.params.id]);
  if (proj) throw new HttpError(409, 'Bu personel bir projeye atanmış. Önce projeyi düzenleyin.');
  const r = await execute('DELETE FROM personel WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Personel bulunamadı');
  res.json({ ok: true });
}));
