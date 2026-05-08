import { Router } from 'express';
import { execute, pool, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const offerTemplatesRouter = Router();

offerTemplatesRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT t.id, t.title, t.description, t.offer_type AS offerType,
           t.default_offer_title AS defaultOfferTitle,
           t.default_offer_text AS defaultOfferText,
           t.default_validity_days AS defaultValidityDays,
           t.is_active AS isActive, t.create_date AS createDate,
           j.title AS offerTypeTitle,
           (SELECT COUNT(*) FROM offer_template_matters m WHERE m.template_id = t.id) AS matterCount,
           (SELECT COALESCE(SUM(m.matter_price * m.matter_unit), 0) FROM offer_template_matters m WHERE m.template_id = t.id) AS totalPrice
    FROM offer_templates t
    LEFT JOIN jobs j ON j.id = t.offer_type
    ORDER BY t.is_active DESC, t.create_date DESC, t.id DESC
  `);
  res.json(rows);
}));

offerTemplatesRouter.get('/:id', asyncHandler(async (req, res) => {
  const tpl = await queryOne<any>('SELECT * FROM offer_templates WHERE id = ?', [req.params.id]);
  if (!tpl) throw new HttpError(404, 'Şablon bulunamadı');
  const matters = await query(
    'SELECT * FROM offer_template_matters WHERE template_id = ? ORDER BY ordering, id',
    [tpl.id]
  );
  res.json({ template: tpl, matters });
}));

offerTemplatesRouter.post('/', asyncHandler(async (req, res) => {
  const {
    title,
    description,
    offer_type,
    default_offer_title,
    default_offer_text,
    default_validity_days,
    is_active,
    matters,
  } = req.body ?? {};
  if (!title) throw new HttpError(400, 'Şablon başlığı zorunludur');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO offer_templates
        (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description ?? '',
        offer_type ? Number(offer_type) : null,
        default_offer_title ?? '',
        default_offer_text ?? '',
        Number(default_validity_days) || 15,
        is_active === false || is_active === 0 ? 0 : 1,
      ]
    );
    const insertId = (r as any).insertId;
    if (Array.isArray(matters)) {
      for (let i = 0; i < matters.length; i++) {
        const m = matters[i];
        if (!m?.matter_title) continue;
        await conn.execute(
          `INSERT INTO offer_template_matters
            (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            insertId,
            i,
            m.matter_title,
            m.matter_description ?? '',
            m.matter_extra ?? '',
            Number(m.matter_unit) || 1,
            m.matter_old_price ? Number(m.matter_old_price) : null,
            Number(m.matter_price) || 0,
          ]
        );
      }
    }
    await conn.commit();
    res.json({ id: insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offerTemplatesRouter.put('/:id', asyncHandler(async (req, res) => {
  const {
    title,
    description,
    offer_type,
    default_offer_title,
    default_offer_text,
    default_validity_days,
    is_active,
    matters,
  } = req.body ?? {};
  if (!title) throw new HttpError(400, 'Şablon başlığı zorunludur');
  const tpl = await queryOne<any>('SELECT id FROM offer_templates WHERE id = ?', [req.params.id]);
  if (!tpl) throw new HttpError(404, 'Şablon bulunamadı');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE offer_templates
        SET title = ?, description = ?, offer_type = ?, default_offer_title = ?, default_offer_text = ?,
            default_validity_days = ?, is_active = ?
        WHERE id = ?`,
      [
        title,
        description ?? '',
        offer_type ? Number(offer_type) : null,
        default_offer_title ?? '',
        default_offer_text ?? '',
        Number(default_validity_days) || 15,
        is_active === false || is_active === 0 ? 0 : 1,
        req.params.id,
      ]
    );
    if (Array.isArray(matters)) {
      await conn.execute('DELETE FROM offer_template_matters WHERE template_id = ?', [req.params.id]);
      for (let i = 0; i < matters.length; i++) {
        const m = matters[i];
        if (!m?.matter_title) continue;
        await conn.execute(
          `INSERT INTO offer_template_matters
            (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
            i,
            m.matter_title,
            m.matter_description ?? '',
            m.matter_extra ?? '',
            Number(m.matter_unit) || 1,
            m.matter_old_price ? Number(m.matter_old_price) : null,
            Number(m.matter_price) || 0,
          ]
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

offerTemplatesRouter.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const tpl = await queryOne<any>('SELECT * FROM offer_templates WHERE id = ?', [req.params.id]);
  if (!tpl) throw new HttpError(404, 'Şablon bulunamadı');
  const matters = await query<any>(
    'SELECT * FROM offer_template_matters WHERE template_id = ? ORDER BY ordering',
    [tpl.id]
  );
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO offer_templates
        (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `${tpl.title} (Kopya)`,
        tpl.description,
        tpl.offer_type,
        tpl.default_offer_title,
        tpl.default_offer_text,
        tpl.default_validity_days,
        tpl.is_active,
      ]
    );
    const newId = (r as any).insertId;
    for (let i = 0; i < matters.length; i++) {
      const m = matters[i];
      await conn.execute(
        `INSERT INTO offer_template_matters
          (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          i,
          m.matter_title,
          m.matter_description,
          m.matter_extra,
          m.matter_unit,
          m.matter_old_price,
          m.matter_price,
        ]
      );
    }
    await conn.commit();
    res.json({ id: newId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offerTemplatesRouter.post('/from-offer/:offerRowId', asyncHandler(async (req, res) => {
  const { title, description } = req.body ?? {};
  if (!title) throw new HttpError(400, 'Şablon başlığı zorunludur');
  const offer = await queryOne<any>('SELECT * FROM offers WHERE id = ?', [req.params.offerRowId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const matters = await query<any>(
    'SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering',
    [offer.offer_id]
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO offer_templates
        (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active)
       VALUES (?, ?, ?, ?, ?, 15, 1)`,
      [
        title,
        description ?? '',
        offer.offer_type ?? null,
        offer.offer_title ?? '',
        offer.offer_text ?? '',
      ]
    );
    const newId = (r as any).insertId;
    for (let i = 0; i < matters.length; i++) {
      const m = matters[i];
      await conn.execute(
        `INSERT INTO offer_template_matters
          (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_old_price, matter_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          i,
          m.matter_title,
          m.matter_description,
          m.matter_extra,
          m.matter_unit,
          m.matter_old_price,
          m.matter_price,
        ]
      );
    }
    await conn.commit();
    res.json({ id: newId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

offerTemplatesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const tpl = await queryOne('SELECT id FROM offer_templates WHERE id = ?', [req.params.id]);
  if (!tpl) throw new HttpError(404, 'Şablon bulunamadı');
  await execute('DELETE FROM offer_template_matters WHERE template_id = ?', [req.params.id]);
  await execute('DELETE FROM offer_templates WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
