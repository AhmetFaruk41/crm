import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const projectsRouter = Router();

projectsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT p.id, o.offer_id AS offerID, p.status, p.type, p.title,
           p.start_date AS projectStartDate, p.end_date AS projectEndDate,
           p.price, p.kdv,
           c.title AS clientTitle, c.id AS clientID,
           d.fullname AS personelName, d.id AS personelID
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN offers o ON o.offer_id = p.offer_id
    LEFT JOIN personel d ON d.id = p.personel_id
    ORDER BY p.create_date DESC, p.id DESC
  `);
  res.json(rows);
}));

projectsRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [req.params.offerId]);
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  const project = await queryOne<any>('SELECT * FROM projects WHERE offer_id = ?', [req.params.offerId]);
  res.json({ offer, agreement, project });
}));

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const { offer_id, title, personel_id, start_date, end_date, kdv } = req.body ?? {};
  if (!offer_id || !personel_id || !start_date || !end_date) throw new HttpError(400, 'Eksik alan');

  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [offer_id]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [offer_id]);
  if (!agreement) throw new HttpError(400, 'Önce sözleşme oluşturmalısınız');

  const dup = await queryOne('SELECT id FROM projects WHERE offer_id = ?', [offer_id]);
  if (dup) throw new HttpError(409, 'Bu teklif için zaten proje var');

  await execute('UPDATE agreements SET agreement_status = 2 WHERE offer_id = ?', [offer_id]);

  const r = await execute(
    'INSERT INTO projects (offer_id, client_id, personel_id, status, type, title, price, kdv, start_date, end_date) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
    [offer_id, offer.client_id, Number(personel_id), offer.offer_type, title || agreement.agreement_title, Math.round(Number(agreement.price) || 0), Number(kdv) || 20, start_date, end_date]
  );
  res.json({ id: r.insertId });
}));

projectsRouter.put('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const { title, personel_id, start_date, end_date, kdv } = req.body ?? {};
  await execute(
    'UPDATE projects SET title = ?, personel_id = ?, start_date = ?, end_date = ?, kdv = ? WHERE offer_id = ?',
    [title, Number(personel_id), start_date, end_date, Number(kdv) || 20, req.params.offerId]
  );
  res.json({ ok: true });
}));

projectsRouter.put('/by-offer-id/:offerId/status', asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  const r = await execute('UPDATE projects SET status = ? WHERE offer_id = ?', [Number(status), req.params.offerId]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Proje bulunamadı');
  if (Number(status) === 1) {
    await execute('UPDATE agreements SET agreement_status = 3 WHERE offer_id = ?', [req.params.offerId]);
  }
  res.json({ ok: true });
}));

projectsRouter.delete('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  // also cascades billings
  await execute('DELETE FROM projects_billings WHERE offer_id = ?', [req.params.offerId]);
  const r = await execute('DELETE FROM projects WHERE offer_id = ?', [req.params.offerId]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Proje bulunamadı');
  res.json({ ok: true });
}));

// Billings
export const billingsRouter = Router();

billingsRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const project = await queryOne<any>('SELECT * FROM projects WHERE offer_id = ?', [req.params.offerId]);
  if (!project) throw new HttpError(404, 'Proje bulunamadı');
  const billings = await query<any>('SELECT id, pay, create_date FROM projects_billings WHERE offer_id = ? ORDER BY id', [req.params.offerId]);
  const client = await queryOne<any>('SELECT id, title FROM clients WHERE id = ?', [project.client_id]);
  const personel = await queryOne<any>('SELECT id, fullname FROM personel WHERE id = ?', [project.personel_id]);
  res.json({ project, billings, client, personel });
}));

billingsRouter.post('/', asyncHandler(async (req, res) => {
  const { offer_id, pay } = req.body ?? {};
  if (!offer_id || !pay) throw new HttpError(400, 'Eksik alan');
  const payNum = Math.round(Number(pay));
  if (payNum <= 0) throw new HttpError(400, 'Tutar 0\'dan büyük olmalı');

  const project = await queryOne<any>('SELECT price, kdv FROM projects WHERE offer_id = ?', [offer_id]);
  if (!project) throw new HttpError(404, 'Proje bulunamadı');

  const total = Number(project.price) + (Number(project.price) * Number(project.kdv)) / 100;
  const paidRow = await queryOne<any>('SELECT COALESCE(SUM(pay), 0) AS s FROM projects_billings WHERE offer_id = ?', [offer_id]);
  const paid = Number(paidRow?.s) || 0;
  if (paid + payNum > total) {
    throw new HttpError(400, `Kalan tutardan fazla ödeme girilemez. Kalan: ${Math.round(total - paid)}`);
  }

  const r = await execute('INSERT INTO projects_billings (offer_id, pay) VALUES (?, ?)', [offer_id, payNum]);
  res.json({ id: r.insertId });
}));

billingsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await execute('DELETE FROM projects_billings WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
