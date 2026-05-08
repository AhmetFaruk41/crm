import { Router } from 'express';
import { execute, pool, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const agreementsRouter = Router();

agreementsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT a.id, a.offer_id AS offerID, a.agreement_status AS agreementStatus,
           a.agreement_type AS agreementType, a.agreement_title AS agreementTitle,
           o.offer_text AS agreementText,
           a.start_date AS agreementStartDate, a.end_date AS agreementEndDate,
           a.price, a.kdv,
           c.title AS clientTitle, c.id AS clientID
    FROM agreements a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN offers o ON o.offer_id = a.offer_id
    ORDER BY a.create_date DESC, a.id DESC
  `);
  res.json(rows);
}));

agreementsRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [req.params.offerId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  const offerMatters = await query('SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering', [req.params.offerId]);
  const includedMatters = agreement
    ? await query<any>('SELECT offer_matter_id FROM agreements_matters WHERE offer_id = ?', [req.params.offerId])
    : [];
  const includedIds = new Set(includedMatters.map(m => m.offer_matter_id));
  const matters = offerMatters.map((m: any) => ({ ...m, included: agreement ? includedIds.has(m.id) : true }));
  const client = offer.client_id ? await queryOne<any>('SELECT * FROM clients WHERE id = ?', [offer.client_id]) : null;
  res.json({ offer, agreement, client, matters });
}));

agreementsRouter.post('/', asyncHandler(async (req, res) => {
  const { offer_id, agreement_title, start_date, end_date, included_matter_ids } = req.body ?? {};
  if (!offer_id || !start_date || !end_date) throw new HttpError(400, 'Eksik alan');

  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [offer_id]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const dup = await queryOne('SELECT id FROM agreements WHERE offer_id = ?', [offer_id]);
  if (dup) throw new HttpError(409, 'Bu teklif için zaten sözleşme var');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE offers SET offer_status = 2 WHERE offer_id = ?', [offer_id]);

    const [aRes] = await conn.execute(
      'INSERT INTO agreements (client_id, offer_id, agreement_type, agreement_status, agreement_title, start_date, end_date, price, kdv) VALUES (?, ?, ?, 0, ?, ?, ?, NULL, 20)',
      [offer.client_id, offer.offer_id, offer.offer_type, agreement_title || offer.offer_title, start_date, end_date]
    );
    const newId = (aRes as any).insertId;

    let total = 0;
    const ids: number[] = Array.isArray(included_matter_ids) ? included_matter_ids.map(Number) : [];
    for (let i = 0; i < ids.length; i++) {
      const mid = ids[i];
      const [mRows] = await conn.execute('SELECT * FROM offers_matters WHERE id = ?', [mid]);
      const m = (mRows as any[])[0];
      if (!m) continue;
      await conn.execute(
        'INSERT INTO agreements_matters (ordering, offer_id, offer_matter_id, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [i, offer.offer_id, m.id, m.matter_title, m.matter_description, m.matter_extra ?? '', m.matter_unit, m.matter_price]
      );
      total += Number(m.matter_price) * Number(m.matter_unit || 1);
    }
    await conn.execute('UPDATE agreements SET price = ? WHERE id = ?', [total, newId]);

    await conn.commit();
    res.json({ id: newId, offer_id });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

agreementsRouter.put('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const { agreement_title, start_date, end_date, included_matter_ids } = req.body ?? {};
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  if (!agreement) throw new HttpError(404, 'Sözleşme bulunamadı');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE agreements SET agreement_title = ?, start_date = ?, end_date = ? WHERE offer_id = ?',
      [agreement_title, start_date, end_date, req.params.offerId]
    );

    if (Array.isArray(included_matter_ids)) {
      await conn.execute('DELETE FROM agreements_matters WHERE offer_id = ?', [req.params.offerId]);
      let total = 0;
      const ids = included_matter_ids.map(Number);
      for (let i = 0; i < ids.length; i++) {
        const [mRows] = await conn.execute('SELECT * FROM offers_matters WHERE id = ?', [ids[i]]);
        const m = (mRows as any[])[0];
        if (!m) continue;
        await conn.execute(
          'INSERT INTO agreements_matters (ordering, offer_id, offer_matter_id, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [i, req.params.offerId, m.id, m.matter_title, m.matter_description, m.matter_extra ?? '', m.matter_unit, m.matter_price]
        );
        total += Number(m.matter_price) * Number(m.matter_unit || 1);
      }
      await conn.execute('UPDATE agreements SET price = ? WHERE offer_id = ?', [total, req.params.offerId]);
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

agreementsRouter.put('/by-offer-id/:offerId/status', asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  const r = await execute('UPDATE agreements SET agreement_status = ? WHERE offer_id = ?', [Number(status), req.params.offerId]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Sözleşme bulunamadı');
  res.json({ ok: true });
}));

agreementsRouter.delete('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  // block if project exists for this offer
  const prj = await queryOne('SELECT id FROM projects WHERE offer_id = ?', [req.params.offerId]);
  if (prj) throw new HttpError(409, 'Bu sözleşmenin projesi var. Önce projeyi silin.');

  const r = await execute('DELETE FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Sözleşme bulunamadı');
  await execute('DELETE FROM agreements_matters WHERE offer_id = ?', [req.params.offerId]);
  res.json({ ok: true });
}));
