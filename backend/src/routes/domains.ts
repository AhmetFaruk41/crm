import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const domainsRouter = Router();

domainsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT d.id, d.name, d.status, d.base_id, d.pay_status, d.create_date,
           d.subscription, d.fullname, d.phone, d.email,
           COUNT(b.base_id) AS sub_domain,
           p.title AS sub_title, p.monthly_price, p.full_price, p.kdv
    FROM domains d
    LEFT JOIN domains b ON b.base_id = d.id
    LEFT JOIN domain_pricing p ON p.id = d.subscription
    WHERE d.base_id = 0
    GROUP BY d.id
    ORDER BY d.create_date DESC, d.id DESC
  `);
  res.json(rows);
}));

domainsRouter.get('/pricing', asyncHandler(async (_req, res) => {
  res.json(await query('SELECT id, title, monthly_price, full_price, kdv FROM domain_pricing ORDER BY id'));
}));

domainsRouter.get('/:id', asyncHandler(async (req, res) => {
  const d = await queryOne('SELECT * FROM domains WHERE id = ?', [req.params.id]);
  if (!d) throw new HttpError(404, 'Domain bulunamadı');
  res.json(d);
}));

domainsRouter.post('/', asyncHandler(async (req, res) => {
  const { name, create_date, status, subscription, fullname, phone, email } = req.body ?? {};
  if (!name) throw new HttpError(400, 'Domain adı gerekli');
  const r = await execute(
    'INSERT INTO domains (base_id, name, create_date, status, pay_status, subscription, fullname, phone, email) VALUES (0, ?, ?, ?, 0, ?, ?, ?, ?)',
    [name, create_date || new Date().toISOString().slice(0, 10), Number(status) ?? 1, Number(subscription) || 1, fullname || '', phone || '', email || '']
  );
  res.json({ id: r.insertId });
}));

domainsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { status, subscription, fullname, phone, email } = req.body ?? {};
  const r = await execute(
    'UPDATE domains SET status = ?, subscription = ?, fullname = ?, phone = ?, email = ? WHERE id = ?',
    [Number(status), Number(subscription) || 1, fullname || '', phone || '', email || '', req.params.id]
  );
  if (r.affectedRows === 0) throw new HttpError(404, 'Domain bulunamadı');
  res.json({ ok: true });
}));

domainsRouter.put('/:id/pay', asyncHandler(async (req, res) => {
  const r = await execute('UPDATE domains SET pay_status = 1 WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Domain bulunamadı');
  res.json({ ok: true });
}));

domainsRouter.put('/:id/unpay', asyncHandler(async (req, res) => {
  const r = await execute('UPDATE domains SET pay_status = 0 WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Domain bulunamadı');
  res.json({ ok: true });
}));

domainsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const r = await execute('DELETE FROM domains WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Domain bulunamadı');
  res.json({ ok: true });
}));
