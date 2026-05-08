import { Router } from 'express';
import { execute, pool, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const offersRouter = Router();

offersRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT o.id, o.offer_id AS offerID, o.main_offer_id AS mainOfferID,
           o.offer_status AS offerStatus, o.offer_type AS offerType,
           o.offer_title AS offerTitle, o.offer_text AS offerText,
           o.offer_date AS offerDate, o.final_date AS offerFinalDate,
           c.title AS clientTitle, c.id AS clientID
    FROM offers o
    LEFT JOIN clients c ON c.id = o.client_id
    ORDER BY o.create_date DESC, o.id DESC
  `);
  res.json(rows);
}));

offersRouter.get('/next-id', asyncHandler(async (_req, res) => {
  const r = await queryOne<any>('SELECT COALESCE(MAX(offer_id), 1400) AS lastOfferID FROM offers');
  res.json({ next: (r?.lastOfferID ?? 1400) + 1 });
}));

offersRouter.get('/by-row/:rowId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE id = ?', [req.params.rowId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const matters = await query('SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering, id', [offer.offer_id]);
  res.json({ offer, matters });
}));

offersRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ? ORDER BY id DESC LIMIT 1', [req.params.offerId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const matters = await query('SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering, id', [offer.offer_id]);
  res.json({ offer, matters });
}));

offersRouter.post('/', asyncHandler(async (req, res) => {
  const { client_id, offer_id, offer_type, offer_title, offer_text, offer_date, final_date, matters } = req.body ?? {};
  if (!offer_id || !offer_type || !offer_title || !offer_date || !final_date) throw new HttpError(400, 'Eksik alan');

  const dup = await queryOne('SELECT id FROM offers WHERE offer_id = ?', [offer_id]);
  if (dup) throw new HttpError(409, 'Bu teklif numarası daha önce kullanıldı');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [oRes] = await conn.execute(
      'INSERT INTO offers (client_id, offer_id, offer_status, offer_type, offer_title, offer_text, offer_date, final_date, user_id) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)',
      [Number(client_id) || 0, offer_id, offer_type, offer_title, offer_text ?? '', offer_date, final_date, (req.user?.id ?? null)]
    );
    const insertId = (oRes as any).insertId;

    if (Array.isArray(matters)) {
      for (let i = 0; i < matters.length; i++) {
        const m = matters[i];
        await conn.execute(
          'INSERT INTO offers_matters (ordering, offer_id, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [i, offer_id, m.matter_title, m.matter_description ?? '', m.matter_extra ?? '', Number(m.matter_unit) || 1, m.matter_old_price ? Number(m.matter_old_price) : null, Number(m.matter_price) || 0]
        );
      }
    }
    await conn.commit();
    res.json({ id: insertId, offer_id });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offersRouter.put('/:rowId', asyncHandler(async (req, res) => {
  const { client_id, offer_type, offer_title, offer_text, offer_date, final_date, matters } = req.body ?? {};
  const offer = await queryOne<any>('SELECT * FROM offers WHERE id = ?', [req.params.rowId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE offers SET client_id = ?, offer_type = ?, offer_title = ?, offer_text = ?, offer_date = ?, final_date = ? WHERE id = ?',
      [Number(client_id) || 0, offer_type, offer_title, offer_text ?? '', offer_date, final_date, req.params.rowId]
    );
    if (Array.isArray(matters)) {
      await conn.execute('DELETE FROM offers_matters WHERE offer_id = ?', [offer.offer_id]);
      for (let i = 0; i < matters.length; i++) {
        const m = matters[i];
        await conn.execute(
          'INSERT INTO offers_matters (ordering, offer_id, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [i, offer.offer_id, m.matter_title, m.matter_description ?? '', m.matter_extra ?? '', Number(m.matter_unit) || 1, m.matter_old_price ? Number(m.matter_old_price) : null, Number(m.matter_price) || 0]
        );
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offersRouter.put('/:rowId/status', asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  const r = await execute('UPDATE offers SET offer_status = ? WHERE id = ?', [Number(status), req.params.rowId]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Teklif bulunamadı');
  res.json({ ok: true });
}));

offersRouter.post('/by-offer-id/:offerId/revise', asyncHandler(async (req, res) => {
  const src = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [req.params.offerId]);
  if (!src) throw new HttpError(404, 'Teklif bulunamadı');
  const matters = await query<any>('SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering', [src.offer_id]);
  const next = await queryOne<any>('SELECT COALESCE(MAX(offer_id), 1400) AS lastOfferID FROM offers');
  const newOfferId = (next?.lastOfferID ?? 1400) + 1;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE offers SET offer_status = 3 WHERE offer_id = ?', [src.offer_id]);
    const [r] = await conn.execute(
      'INSERT INTO offers (client_id, offer_id, main_offer_id, offer_status, offer_type, offer_title, offer_text, offer_date, final_date, user_id) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
      [src.client_id, newOfferId, src.offer_id, src.offer_type, src.offer_title, src.offer_text, src.offer_date, src.final_date, req.user?.id ?? null]
    );
    const newRowId = (r as any).insertId;
    for (let i = 0; i < matters.length; i++) {
      const m = matters[i];
      await conn.execute(
        'INSERT INTO offers_matters (ordering, offer_id, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [i, newOfferId, m.matter_title, m.matter_description, m.matter_extra, m.matter_unit, m.matter_old_price, m.matter_price]
      );
    }
    await conn.commit();
    res.json({ id: newRowId, offer_id: newOfferId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offersRouter.delete('/:rowId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT offer_id FROM offers WHERE id = ?', [req.params.rowId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');

  // block if there's a downstream agreement/project for this offer_id
  // unless this row is a revision (main_offer_id is set) — only the active offer is linked
  const liveOffer = await queryOne<any>('SELECT id FROM offers WHERE offer_id = ? AND id <> ?', [offer.offer_id, req.params.rowId]);
  if (!liveOffer) {
    const agr = await queryOne('SELECT id FROM agreements WHERE offer_id = ?', [offer.offer_id]);
    if (agr) throw new HttpError(409, 'Bu teklifin sözleşmesi var. Önce sözleşmeyi silin.');
    await execute('DELETE FROM offers_matters WHERE offer_id = ?', [offer.offer_id]);
  }
  await execute('DELETE FROM offers WHERE id = ?', [req.params.rowId]);
  res.json({ ok: true });
}));
