import { Router } from 'express';
import { execute, pool, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const leadsRouter = Router();

const STAGES = new Set(['new', 'contacted', 'meeting', 'proposal_preparing', 'offer_sent', 'follow_up', 'won', 'lost']);
const TEMPERATURES = new Set(['hot', 'warm', 'cold']);
const ACTIVITY_TYPES = new Set(['call', 'whatsapp', 'email', 'meeting', 'form_sent', 'note', 'offer', 'status']);
const TAG_COLORS = new Set(['slate', 'red', 'amber', 'emerald', 'sky', 'indigo', 'violet', 'pink', 'rose', 'lime']);
const STAGE_LABELS: Record<string, string> = {
  new: 'Yeni Aday',
  contacted: 'İlk Temas',
  meeting: 'İhtiyaç Görüşmesi',
  proposal_preparing: 'Teklif Hazırlanıyor',
  offer_sent: 'Teklif Gönderildi',
  follow_up: 'Takip Bekleniyor',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpError(400, `${label} zorunlu`);
  return text;
}

function optionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function validDate(value: unknown, label: string): string | null {
  if (value == null || value === '') return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00`))) {
    throw new HttpError(400, `${label} geçerli bir tarih olmalı`);
  }
  return text;
}

function validDateTime(value: unknown): string {
  if (value == null || value === '') {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 19).replace('T', ' ');
  }
  const text = String(value).replace('T', ' ').slice(0, 19);
  if (Number.isNaN(Date.parse(String(value)))) throw new HttpError(400, 'İşlem tarihi geçersiz');
  return text;
}

function stageValue(value: unknown): string {
  const stage = String(value ?? 'new');
  if (!STAGES.has(stage)) throw new HttpError(400, 'Satış aşaması geçersiz');
  return stage;
}

function temperatureValue(value: unknown): string {
  const temperature = String(value ?? 'warm');
  if (!TEMPERATURES.has(temperature)) throw new HttpError(400, 'Sıcaklık durumu geçersiz');
  return temperature;
}

function amountValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, 'Tahmini değer geçersiz');
  return amount;
}

function tagColor(value: unknown): string {
  const color = String(value ?? 'slate').trim().toLowerCase();
  if (!TAG_COLORS.has(color)) throw new HttpError(400, 'Etiket rengi geçersiz');
  return color;
}

function parseTagIds(value: unknown): number[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const ids = arr
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(ids));
}

async function loadLeadTagsMap(leadIds: number[]): Promise<Record<number, Array<{ id: number; name: string; color: string }>>> {
  if (!leadIds.length) return {};
  const placeholders = leadIds.map(() => '?').join(',');
  const rows = await query<{ lead_id: number; id: number; name: string; color: string }>(
    `SELECT a.lead_id, t.id, t.name, t.color
       FROM lead_tag_assignments a
       JOIN lead_tags t ON t.id = a.tag_id
      WHERE a.lead_id IN (${placeholders})
      ORDER BY t.name`,
    leadIds
  );
  const map: Record<number, Array<{ id: number; name: string; color: string }>> = {};
  for (const row of rows) {
    if (!map[row.lead_id]) map[row.lead_id] = [];
    map[row.lead_id].push({ id: row.id, name: row.name, color: row.color });
  }
  return map;
}

async function syncLeadTags(leadId: number, tagIds: number[]): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM lead_tag_assignments WHERE lead_id = ?', [leadId]);
    if (tagIds.length) {
      const placeholders = tagIds.map(() => '(?, ?)').join(',');
      const values: (string | number)[] = [];
      for (const tagId of tagIds) {
        values.push(leadId, tagId);
      }
      await conn.execute(
        `INSERT INTO lead_tag_assignments (lead_id, tag_id) VALUES ${placeholders}`,
        values
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

leadsRouter.get('/', asyncHandler(async (req, res) => {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (req.query.stage) {
    filters.push('l.stage = ?');
    params.push(stageValue(req.query.stage));
  }
  if (req.query.temperature) {
    filters.push('l.temperature = ?');
    params.push(temperatureValue(req.query.temperature));
  }
  if (req.query.followUp === 'overdue') {
    filters.push("l.next_follow_up_date < CURDATE() AND l.stage NOT IN ('won', 'lost')");
  } else if (req.query.followUp === 'today') {
    filters.push("l.next_follow_up_date = CURDATE() AND l.stage NOT IN ('won', 'lost')");
  }
  const tagId = req.query.tag ? Number(req.query.tag) : NaN;
  if (Number.isInteger(tagId) && tagId > 0) {
    filters.push('EXISTS (SELECT 1 FROM lead_tag_assignments lta WHERE lta.lead_id = l.id AND lta.tag_id = ?)');
    params.push(tagId);
  }

  const rows = await query<any>(`
    SELECT l.id, l.company_name, l.contact_name, l.phone, l.email,
           l.service_interest, l.source, l.estimated_value, l.stage, l.temperature,
           l.next_follow_up_date, l.lost_reason, l.converted_client_id, l.converted_offer_id,
           l.create_date, l.updated_at,
           CASE
             WHEN l.notes LIKE 'CSV içe aktarma:%' THEN CONCAT(
               SUBSTRING_INDEX(SUBSTRING_INDEX(l.notes, CHAR(10), 2), CHAR(10), -1), ' ',
               SUBSTRING_INDEX(SUBSTRING_INDEX(l.notes, CHAR(10), 3), CHAR(10), -1)
             )
             ELSE LEFT(l.notes, 300)
           END AS notes_preview,
           c.title AS client_title,
           o.offer_id,
           (SELECT MAX(a.activity_date) FROM lead_activities a WHERE a.lead_id = l.id) AS last_activity_date,
           (SELECT COUNT(*) FROM lead_activities a WHERE a.lead_id = l.id) AS activity_count
    FROM leads l
    LEFT JOIN clients c ON c.id = l.converted_client_id
    LEFT JOIN offers o ON o.id = l.converted_offer_id
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY
      CASE WHEN l.stage NOT IN ('won', 'lost') AND l.next_follow_up_date < CURDATE() THEN 0 ELSE 1 END,
      l.next_follow_up_date IS NULL,
      l.next_follow_up_date,
      l.updated_at DESC
  `, params as any[]);
  const tagsMap = await loadLeadTagsMap(rows.map((row) => row.id));
  for (const row of rows) {
    row.tags = tagsMap[row.id] ?? [];
  }
  res.json(rows);
}));

leadsRouter.get('/tags', asyncHandler(async (_req, res) => {
  const tags = await query(`
    SELECT t.id, t.name, t.color,
           (SELECT COUNT(*) FROM lead_tag_assignments a WHERE a.tag_id = t.id) AS usage_count
      FROM lead_tags t
      ORDER BY t.name
  `);
  res.json(tags);
}));

leadsRouter.post('/tags', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const name = requiredText(body.name, 'Etiket adı');
  if (name.length > 80) throw new HttpError(400, 'Etiket adı en fazla 80 karakter olabilir');
  const color = tagColor(body.color);
  const existing = await queryOne<{ id: number }>('SELECT id FROM lead_tags WHERE name = ?', [name]);
  if (existing) throw new HttpError(409, 'Bu isimde bir etiket zaten var');
  const r = await execute('INSERT INTO lead_tags (name, color) VALUES (?, ?)', [name, color]);
  res.json({ id: r.insertId, name, color, usage_count: 0 });
}));

leadsRouter.put('/tags/:id', asyncHandler(async (req, res) => {
  const tag = await queryOne<{ id: number }>('SELECT id FROM lead_tags WHERE id = ?', [req.params.id]);
  if (!tag) throw new HttpError(404, 'Etiket bulunamadı');
  const body = req.body ?? {};
  const name = requiredText(body.name, 'Etiket adı');
  if (name.length > 80) throw new HttpError(400, 'Etiket adı en fazla 80 karakter olabilir');
  const color = tagColor(body.color);
  const dup = await queryOne<{ id: number }>('SELECT id FROM lead_tags WHERE name = ? AND id <> ?', [name, req.params.id]);
  if (dup) throw new HttpError(409, 'Bu isimde bir etiket zaten var');
  await execute('UPDATE lead_tags SET name = ?, color = ? WHERE id = ?', [name, color, req.params.id]);
  res.json({ ok: true });
}));

leadsRouter.delete('/tags/:id', asyncHandler(async (req, res) => {
  const tag = await queryOne<{ id: number }>('SELECT id FROM lead_tags WHERE id = ?', [req.params.id]);
  if (!tag) throw new HttpError(404, 'Etiket bulunamadı');
  await execute('DELETE FROM lead_tag_assignments WHERE tag_id = ?', [req.params.id]);
  await execute('DELETE FROM lead_tags WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

leadsRouter.get('/:id', asyncHandler(async (req, res) => {
  const lead = await queryOne<any>(`
    SELECT l.*, c.title AS client_title, o.offer_id
    FROM leads l
    LEFT JOIN clients c ON c.id = l.converted_client_id
    LEFT JOIN offers o ON o.id = l.converted_offer_id
    WHERE l.id = ?
  `, [req.params.id]);
  if (!lead) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
  const activities = await query(`
    SELECT a.*, u.fullname AS user_name
    FROM lead_activities a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.lead_id = ?
    ORDER BY a.activity_date DESC, a.id DESC
  `, [req.params.id]);
  const offers = await query(`
    SELECT id, offer_id, offer_status, offer_title, offer_date, final_date
    FROM offers WHERE lead_id = ? ORDER BY create_date DESC, id DESC
  `, [req.params.id]);
  const tagsMap = await loadLeadTagsMap([Number(req.params.id)]);
  lead.tags = tagsMap[Number(req.params.id)] ?? [];
  res.json({ lead, activities, offers });
}));

leadsRouter.post('/', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const companyName = requiredText(body.company_name, 'Firma veya kişi adı');
  const stage = stageValue(body.stage);
  const temperature = temperatureValue(body.temperature);
  const followUp = validDate(body.next_follow_up_date, 'Takip tarihi');
  if (stage === 'lost' && !optionalText(body.lost_reason)) throw new HttpError(400, 'Kaybedilme nedeni zorunlu');

  const r = await execute(`
    INSERT INTO leads (
      company_name, contact_name, phone, email, service_interest, source,
      estimated_value, stage, temperature, next_follow_up_date, notes, lost_reason, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    companyName, optionalText(body.contact_name), optionalText(body.phone), optionalText(body.email),
    optionalText(body.service_interest), optionalText(body.source), amountValue(body.estimated_value),
    stage, temperature, followUp, optionalText(body.notes), optionalText(body.lost_reason),
    req.user?.id ?? null,
  ]);
  await execute(
    'INSERT INTO lead_activities (lead_id, activity_type, description, activity_date, next_action_date, user_id) VALUES (?, ?, ?, NOW(), ?, ?)',
    [r.insertId, 'status', 'Potansiyel müşteri kaydı oluşturuldu.', followUp, req.user?.id ?? null]
  );
  const tagIds = parseTagIds(body.tag_ids);
  if (tagIds.length) await syncLeadTags(r.insertId, tagIds);
  res.json({ id: r.insertId });
}));

leadsRouter.put('/:id', asyncHandler(async (req, res) => {
  const current = await queryOne<any>('SELECT id, stage FROM leads WHERE id = ?', [req.params.id]);
  if (!current) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
  const body = req.body ?? {};
  const stage = stageValue(body.stage);
  const lostReason = optionalText(body.lost_reason);
  if (stage === 'lost' && !lostReason) throw new HttpError(400, 'Kaybedilme nedeni zorunlu');

  await execute(`
    UPDATE leads SET company_name = ?, contact_name = ?, phone = ?, email = ?,
      service_interest = ?, source = ?, estimated_value = ?, stage = ?, temperature = ?,
      next_follow_up_date = ?, notes = ?, lost_reason = ?
    WHERE id = ?
  `, [
    requiredText(body.company_name, 'Firma veya kişi adı'), optionalText(body.contact_name),
    optionalText(body.phone), optionalText(body.email), optionalText(body.service_interest),
    optionalText(body.source), amountValue(body.estimated_value), stage,
    temperatureValue(body.temperature), validDate(body.next_follow_up_date, 'Takip tarihi'),
    optionalText(body.notes), stage === 'lost' ? lostReason : null, req.params.id,
  ]);
  if (current.stage !== stage) {
    await execute(
      'INSERT INTO lead_activities (lead_id, activity_type, description, activity_date, user_id) VALUES (?, ?, ?, NOW(), ?)',
      [req.params.id, 'status', `Satış aşaması "${current.stage}" durumundan "${stage}" durumuna değiştirildi.`, req.user?.id ?? null]
    );
  }
  if (body.tag_ids !== undefined) {
    await syncLeadTags(Number(req.params.id), parseTagIds(body.tag_ids));
  }
  res.json({ ok: true });
}));

leadsRouter.put('/:id/tags', asyncHandler(async (req, res) => {
  const lead = await queryOne<{ id: number }>('SELECT id FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
  const tagIds = parseTagIds(req.body?.tag_ids);
  if (tagIds.length) {
    const placeholders = tagIds.map(() => '?').join(',');
    const valid = await query<{ id: number }>(`SELECT id FROM lead_tags WHERE id IN (${placeholders})`, tagIds);
    const validIds = new Set(valid.map((row) => row.id));
    for (const id of tagIds) {
      if (!validIds.has(id)) throw new HttpError(400, 'Geçersiz etiket seçimi');
    }
  }
  await syncLeadTags(Number(req.params.id), tagIds);
  const tagsMap = await loadLeadTagsMap([Number(req.params.id)]);
  res.json({ ok: true, tags: tagsMap[Number(req.params.id)] ?? [] });
}));

leadsRouter.put('/:id/stage', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const nextStage = stageValue(body.stage);
  const lostReason = optionalText(body.lost_reason);
  if (nextStage === 'lost' && !lostReason) throw new HttpError(400, 'Kaybedilme nedeni zorunlu');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, stage FROM leads WHERE id = ? FOR UPDATE', [req.params.id]);
    const current = (rows as any[])[0];
    if (!current) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
    if (current.stage === nextStage) {
      await conn.commit();
      res.json({ ok: true, stage: nextStage });
      return;
    }
    await conn.execute(
      'UPDATE leads SET stage = ?, lost_reason = ? WHERE id = ?',
      [nextStage, nextStage === 'lost' ? lostReason : null, req.params.id]
    );
    await conn.execute(
      'INSERT INTO lead_activities (lead_id, activity_type, description, activity_date, user_id) VALUES (?, ?, ?, NOW(), ?)',
      [
        req.params.id,
        'status',
        `Satış aşaması "${STAGE_LABELS[current.stage] ?? current.stage}" durumundan "${STAGE_LABELS[nextStage]}" durumuna değiştirildi.`,
        req.user?.id ?? null,
      ]
    );
    await conn.commit();
    res.json({ ok: true, stage: nextStage });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

leadsRouter.post('/:id/activities', asyncHandler(async (req, res) => {
  const lead = await queryOne('SELECT id FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
  const body = req.body ?? {};
  const activityType = String(body.activity_type ?? 'note');
  if (!ACTIVITY_TYPES.has(activityType)) throw new HttpError(400, 'Aktivite türü geçersiz');
  const nextActionDate = validDate(body.next_action_date, 'Sonraki aksiyon tarihi');
  const r = await execute(`
    INSERT INTO lead_activities (lead_id, activity_type, description, activity_date, next_action_date, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    req.params.id, activityType, requiredText(body.description, 'Aktivite açıklaması'),
    validDateTime(body.activity_date), nextActionDate, req.user?.id ?? null,
  ]);
  if (nextActionDate) {
    await execute('UPDATE leads SET next_follow_up_date = ? WHERE id = ?', [nextActionDate, req.params.id]);
  }
  res.json({ id: r.insertId });
}));

leadsRouter.delete('/:id/activities/:activityId', asyncHandler(async (req, res) => {
  const activity = await queryOne<any>(
    'SELECT activity_type FROM lead_activities WHERE id = ? AND lead_id = ?',
    [req.params.activityId, req.params.id]
  );
  if (!activity) throw new HttpError(404, 'Aktivite bulunamadı');
  if (['status', 'offer'].includes(activity.activity_type)) {
    throw new HttpError(409, 'Sistem tarafından oluşturulan satış geçmişi silinemez');
  }
  const r = await execute('DELETE FROM lead_activities WHERE id = ? AND lead_id = ?', [req.params.activityId, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Aktivite bulunamadı');
  res.json({ ok: true });
}));

leadsRouter.post('/:id/convert-to-client', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM leads WHERE id = ? FOR UPDATE', [req.params.id]);
    const lead = (rows as any[])[0];
    if (!lead) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');

    let clientId = lead.converted_client_id;
    if (!clientId) {
      const [result] = await conn.execute(
        'INSERT INTO clients (title, fullname, phone, email) VALUES (?, ?, ?, ?)',
        [lead.company_name, lead.contact_name || lead.company_name, lead.phone, lead.email]
      );
      clientId = (result as any).insertId;
    }
    await conn.execute(
      "UPDATE leads SET converted_client_id = ?, stage = CASE WHEN stage IN ('won', 'lost') THEN stage ELSE 'proposal_preparing' END WHERE id = ?",
      [clientId, req.params.id]
    );
    await conn.execute(
      'INSERT INTO lead_activities (lead_id, activity_type, description, activity_date, user_id) VALUES (?, ?, ?, NOW(), ?)',
      [req.params.id, 'status', 'Müşteri kaydı hazırlandı; teklif oluşturma aşamasına geçildi.', req.user?.id ?? null]
    );
    await conn.commit();
    res.json({ client_id: clientId, lead_id: Number(req.params.id) });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

leadsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const lead = await queryOne<any>('SELECT converted_client_id, converted_offer_id FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) throw new HttpError(404, 'Potansiyel müşteri bulunamadı');
  const offer = await queryOne('SELECT id FROM offers WHERE lead_id = ? LIMIT 1', [req.params.id]);
  if (lead.converted_client_id || lead.converted_offer_id || offer) {
    throw new HttpError(409, 'Müşteriye veya teklife dönüştürülmüş kayıt silinemez; aşamasını güncelleyin.');
  }
  await execute('DELETE FROM lead_tag_assignments WHERE lead_id = ?', [req.params.id]);
  await execute('DELETE FROM lead_activities WHERE lead_id = ?', [req.params.id]);
  await execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
