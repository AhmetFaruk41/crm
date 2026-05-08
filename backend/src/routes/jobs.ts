import { Router } from 'express';
import { execute, query } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const jobsRouter = Router();

jobsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await query('SELECT id, title FROM jobs ORDER BY id'));
}));

jobsRouter.post('/', asyncHandler(async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) throw new HttpError(400, 'Başlık gerekli');
  const r = await execute('INSERT INTO jobs (title) VALUES (?)', [title]);
  res.json({ id: r.insertId });
}));

jobsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) throw new HttpError(400, 'Başlık gerekli');
  const r = await execute('UPDATE jobs SET title = ? WHERE id = ?', [title, req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Tip bulunamadı');
  res.json({ ok: true });
}));

jobsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const r = await execute('DELETE FROM jobs WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Tip bulunamadı');
  res.json({ ok: true });
}));
