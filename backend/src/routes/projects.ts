import { Router } from 'express';
import { pool, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const projectsRouter = Router();
export const billingsRouter = Router();

const PROJECT_STATUSES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
const PROJECT_PRIORITIES = new Set([0, 1, 2, 3]);
const STAGE_STATUSES = new Set([0, 1, 2]);
const TASK_STATUSES = new Set([0, 1, 2, 3, 4]);
const PROJECT_STATUS_LABELS: Record<number, string> = {
  0: 'Planlama',
  1: 'Başlamadı',
  2: 'Devam Ediyor',
  3: 'Müşteri Bekleniyor',
  4: 'Revizyonda',
  5: 'Askıda',
  6: 'Tamamlandı',
  7: 'İptal Edildi',
};
const STAGE_STATUS_LABELS: Record<number, string> = {
  0: 'Bekliyor',
  1: 'Devam Ediyor',
  2: 'Tamamlandı',
};
const TASK_STATUS_LABELS: Record<number, string> = {
  0: 'Yapılacak',
  1: 'Devam Ediyor',
  2: 'Kontrol Bekliyor',
  3: 'Tamamlandı',
  4: 'İptal',
};

function numberInRange(value: unknown, name: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${name} geçersiz`);
  }
  return number;
}

function integerInRange(value: unknown, name: string, min: number, max: number): number {
  const number = numberInRange(value, name, min, max);
  if (!Number.isInteger(number)) throw new HttpError(400, `${name} geçersiz`);
  return number;
}

function priorityValue(value: unknown): number {
  const priority = integerInRange(value, 'Öncelik', 0, 3);
  if (!PROJECT_PRIORITIES.has(priority)) throw new HttpError(400, 'Öncelik geçersiz');
  return priority;
}

function requiredText(value: unknown, name: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpError(400, `${name} gerekli`);
  return text;
}

function validateDates(startDate: unknown, endDate: unknown): { startDate: string; endDate: string } {
  const start = requiredText(startDate, 'Başlangıç tarihi');
  const end = requiredText(endDate, 'Termin tarihi');
  if (end < start) throw new HttpError(400, 'Termin tarihi başlangıç tarihinden önce olamaz');
  return { startDate: start, endDate: end };
}

function optionalDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

async function addActivity(
  conn: any,
  projectId: number,
  userId: number | undefined,
  action: string,
  description: string
) {
  await conn.execute(
    'INSERT INTO project_activities (project_id, user_id, action, description) VALUES (?, ?, ?, ?)',
    [projectId, userId ?? null, action, description]
  );
}

function agreementStatusForProject(status: number): number {
  if (status === 6) return 3;
  if (status === 7) return 1;
  return 2;
}

async function refreshProjectProgress(conn: any, projectId: number) {
  const [taskRows] = await conn.execute(
    'SELECT COUNT(*) AS total, COALESCE(SUM(status = 3), 0) AS done FROM project_tasks WHERE project_id = ? AND status <> 4',
    [projectId]
  );
  const taskTotals = (taskRows as any[])[0];
  let progress: number;
  if (Number(taskTotals.total) > 0) {
    progress = Math.round((Number(taskTotals.done) / Number(taskTotals.total)) * 100);
  } else {
    const [stageRows] = await conn.execute(
      'SELECT COUNT(*) AS total, COALESCE(SUM(status = 2), 0) AS done FROM project_stages WHERE project_id = ?',
      [projectId]
    );
    const stageTotals = (stageRows as any[])[0];
    progress = Number(stageTotals.total) > 0
      ? Math.round((Number(stageTotals.done) / Number(stageTotals.total)) * 100)
      : 0;
  }
  await conn.execute('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}

async function syncStageFromTasks(conn: any, stageId: number) {
  const [taskRows] = await conn.execute(
    'SELECT status FROM project_tasks WHERE stage_id = ? AND status <> 4',
    [stageId]
  );
  const statuses = (taskRows as any[]).map((task) => Number(task.status));
  if (statuses.length === 0) {
    await conn.execute('UPDATE project_stages SET status = 0, completed_at = NULL WHERE id = ?', [stageId]);
    return;
  }
  const status = statuses.every((value) => value === 3)
    ? 2
    : statuses.some((value) => value > 0)
      ? 1
      : 0;
  await conn.execute(
    'UPDATE project_stages SET status = ?, completed_at = CASE WHEN ? = 2 THEN NOW() ELSE NULL END WHERE id = ?',
    [status, status, stageId]
  );
}

projectsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT p.id, p.offer_id AS offerID, p.status, p.type, p.title, p.description,
           p.priority, p.progress, p.create_date AS createDate, p.updated_at AS updatedAt,
           p.completed_at AS completedAt,
           p.start_date AS projectStartDate, p.end_date AS projectEndDate,
           p.price, p.kdv,
           COALESCE(b.paid, 0) AS paid,
           (p.price + (p.price * p.kdv / 100)) AS total,
           c.title AS clientTitle, c.id AS clientID,
           d.fullname AS personelName, d.id AS personelID
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN personel d ON d.id = p.personel_id
    LEFT JOIN (
      SELECT offer_id, SUM(pay) AS paid
      FROM projects_billings
      GROUP BY offer_id
    ) b ON b.offer_id = p.offer_id
    ORDER BY p.updated_at DESC, p.id DESC
  `);
  res.json(rows);
}));

projectsRouter.get('/by-offer-id/:offerId/detail', asyncHandler(async (req, res) => {
  const project = await queryOne<any>(`
    SELECT p.*, c.title AS client_title, d.fullname AS personel_name,
           j.title AS type_title, COALESCE(b.paid, 0) AS paid,
           (p.price + (p.price * p.kdv / 100)) AS total
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN personel d ON d.id = p.personel_id
    LEFT JOIN jobs j ON j.id = p.type
    LEFT JOIN (
      SELECT offer_id, SUM(pay) AS paid
      FROM projects_billings
      GROUP BY offer_id
    ) b ON b.offer_id = p.offer_id
    WHERE p.offer_id = ?
  `, [req.params.offerId]);
  if (!project) throw new HttpError(404, 'Proje bulunamadı');

  const [billings, activities, stages, tasks, paymentPlans] = await Promise.all([
    query<any>('SELECT id, pay, create_date FROM projects_billings WHERE offer_id = ? ORDER BY id DESC', [req.params.offerId]),
    query<any>(`
      SELECT a.id, a.action, a.description, a.create_date, u.fullname AS user_name
      FROM project_activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.project_id = ?
      ORDER BY a.create_date DESC, a.id DESC
      LIMIT 50
    `, [project.id]),
    query<any>('SELECT * FROM project_stages WHERE project_id = ? ORDER BY ordering, id', [project.id]),
    query<any>(`
      SELECT t.*, d.fullname AS personel_name
      FROM project_tasks t
      LEFT JOIN personel d ON d.id = t.personel_id
      WHERE t.project_id = ?
      ORDER BY t.stage_id, t.id
    `, [project.id]),
    query<any>(`
      SELECT pp.*, COALESCE(SUM(pb.pay), 0) AS paid
      FROM project_payment_plans pp
      LEFT JOIN projects_billings pb ON pb.payment_plan_id = pp.id
      WHERE pp.project_id = ?
      GROUP BY pp.id
      ORDER BY pp.due_date, pp.id
    `, [project.id]),
  ]);
  res.json({ project, billings, activities, stages, tasks, paymentPlans });
}));

projectsRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [req.params.offerId]);
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  const project = await queryOne<any>('SELECT * FROM projects WHERE offer_id = ?', [req.params.offerId]);
  res.json({ offer, agreement, project });
}));

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const { offer_id, title, personel_id, start_date, end_date, kdv, priority = 1, progress = 0, description = '' } = req.body ?? {};
  if (!offer_id) throw new HttpError(400, 'Teklif gerekli');
  const personnelId = integerInRange(personel_id, 'Personel', 1, Number.MAX_SAFE_INTEGER);
  const { startDate, endDate } = validateDates(start_date, end_date);
  const kdvNumber = numberInRange(kdv ?? 20, 'KDV', 0, 100);
  const priorityNumber = priorityValue(priority);
  const progressNumber = integerInRange(progress, 'İlerleme', 0, 100);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [offerRows] = await conn.execute('SELECT * FROM offers WHERE offer_id = ?', [offer_id]);
    const offer = (offerRows as any[])[0];
    if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
    const [agreementRows] = await conn.execute('SELECT * FROM agreements WHERE offer_id = ? FOR UPDATE', [offer_id]);
    const agreement = (agreementRows as any[])[0];
    if (!agreement) throw new HttpError(400, 'Önce sözleşme oluşturmalısınız');
    const [personRows] = await conn.execute('SELECT id FROM personel WHERE id = ?', [personnelId]);
    if (!(personRows as any[])[0]) throw new HttpError(400, 'Personel bulunamadı');

    const [r] = await conn.execute(
      `INSERT INTO projects
        (offer_id, client_id, personel_id, status, type, title, description, priority, progress, price, kdv, start_date, end_date)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        offer_id, offer.client_id, personnelId, offer.offer_type,
        String(title ?? agreement.agreement_title).trim() || agreement.agreement_title,
        String(description ?? '').trim() || null, priorityNumber, progressNumber,
        Number(agreement.price) || 0, kdvNumber, startDate, endDate,
      ]
    );
    const projectId = (r as any).insertId;
    await conn.execute('UPDATE agreements SET agreement_status = 2 WHERE offer_id = ?', [offer_id]);
    await addActivity(conn, projectId, req.user?.id, 'created', 'Proje oluşturuldu.');
    await conn.commit();
    res.json({ id: projectId });
  } catch (error: any) {
    await conn.rollback();
    if (error?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Bu teklif için zaten proje var');
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.put('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const { title, personel_id, start_date, end_date, kdv, priority = 1, progress = 0, description = '' } = req.body ?? {};
  const titleText = requiredText(title, 'Proje başlığı');
  const personnelId = integerInRange(personel_id, 'Personel', 1, Number.MAX_SAFE_INTEGER);
  const { startDate, endDate } = validateDates(start_date, end_date);
  const kdvNumber = numberInRange(kdv ?? 20, 'KDV', 0, 100);
  const priorityNumber = priorityValue(priority);
  const progressNumber = integerInRange(progress, 'İlerleme', 0, 100);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [projectRows] = await conn.execute('SELECT id FROM projects WHERE offer_id = ? FOR UPDATE', [req.params.offerId]);
    const project = (projectRows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    const [personRows] = await conn.execute('SELECT id FROM personel WHERE id = ?', [personnelId]);
    if (!(personRows as any[])[0]) throw new HttpError(400, 'Personel bulunamadı');
    await conn.execute(
      `UPDATE projects SET title = ?, description = ?, personel_id = ?, start_date = ?,
       end_date = ?, kdv = ?, priority = ?, progress = ? WHERE offer_id = ?`,
      [titleText, String(description ?? '').trim() || null, personnelId, startDate, endDate, kdvNumber, priorityNumber, progressNumber, req.params.offerId]
    );
    await addActivity(conn, project.id, req.user?.id, 'updated', 'Proje bilgileri güncellendi.');
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.put('/by-offer-id/:offerId/status', asyncHandler(async (req, res) => {
  const status = Number(req.body?.status);
  if (!PROJECT_STATUSES.has(status)) throw new HttpError(400, 'Proje durumu geçersiz');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, status FROM projects WHERE offer_id = ? FOR UPDATE', [req.params.offerId]);
    const project = (rows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    await conn.execute(
      `UPDATE projects
       SET status = ?, completed_at = CASE WHEN ? = 6 THEN NOW() ELSE NULL END,
           progress = CASE WHEN ? = 6 THEN 100 WHEN status = 6 AND progress = 100 THEN 90 ELSE progress END
       WHERE offer_id = ?`,
      [status, status, status, req.params.offerId]
    );
    await conn.execute('UPDATE agreements SET agreement_status = ? WHERE offer_id = ?', [agreementStatusForProject(status), req.params.offerId]);
    await addActivity(conn, project.id, req.user?.id, 'status_changed', `Proje durumu "${PROJECT_STATUS_LABELS[status]}" olarak güncellendi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.post('/by-offer-id/:offerId/stages', asyncHandler(async (req, res) => {
  const title = requiredText(req.body?.title, 'Aşama başlığı');
  const description = String(req.body?.description ?? '').trim() || null;
  const startDate = optionalDate(req.body?.start_date);
  const endDate = optionalDate(req.body?.end_date);
  if (startDate && endDate && endDate < startDate) throw new HttpError(400, 'Aşama bitiş tarihi başlangıç tarihinden önce olamaz');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [projectRows] = await conn.execute('SELECT id FROM projects WHERE offer_id = ? FOR UPDATE', [req.params.offerId]);
    const project = (projectRows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    const [orderingRows] = await conn.execute('SELECT COALESCE(MAX(ordering), -1) + 1 AS ordering FROM project_stages WHERE project_id = ?', [project.id]);
    const ordering = Number((orderingRows as any[])[0].ordering);
    const [result] = await conn.execute(
      'INSERT INTO project_stages (project_id, title, description, ordering, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
      [project.id, title, description, ordering, startDate, endDate]
    );
    await refreshProjectProgress(conn, project.id);
    await addActivity(conn, project.id, req.user?.id, 'stage_created', `"${title}" aşaması eklendi.`);
    await conn.commit();
    res.json({ id: (result as any).insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.put('/by-offer-id/:offerId/stages/:stageId/status', asyncHandler(async (req, res) => {
  const status = Number(req.body?.status);
  if (!STAGE_STATUSES.has(status)) throw new HttpError(400, 'Aşama durumu geçersiz');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT s.id, s.title, s.project_id
       FROM project_stages s JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.offer_id = ? FOR UPDATE`,
      [req.params.stageId, req.params.offerId]
    );
    const stage = (rows as any[])[0];
    if (!stage) throw new HttpError(404, 'Aşama bulunamadı');
    await conn.execute(
      'UPDATE project_stages SET status = ?, completed_at = CASE WHEN ? = 2 THEN NOW() ELSE NULL END WHERE id = ?',
      [status, status, stage.id]
    );
    await refreshProjectProgress(conn, stage.project_id);
    await addActivity(conn, stage.project_id, req.user?.id, 'stage_status_changed', `"${stage.title}" aşaması "${STAGE_STATUS_LABELS[status]}" olarak güncellendi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.delete('/by-offer-id/:offerId/stages/:stageId', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT s.id, s.title, s.project_id
       FROM project_stages s JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.offer_id = ? FOR UPDATE`,
      [req.params.stageId, req.params.offerId]
    );
    const stage = (rows as any[])[0];
    if (!stage) throw new HttpError(404, 'Aşama bulunamadı');
    const [taskRows] = await conn.execute('SELECT id FROM project_tasks WHERE stage_id = ? LIMIT 1', [stage.id]);
    if ((taskRows as any[]).length > 0) throw new HttpError(409, 'Aşamada görevler var. Önce görevleri silin.');
    await conn.execute('DELETE FROM project_stages WHERE id = ?', [stage.id]);
    await refreshProjectProgress(conn, stage.project_id);
    await addActivity(conn, stage.project_id, req.user?.id, 'stage_deleted', `"${stage.title}" aşaması silindi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.post('/by-offer-id/:offerId/stages/:stageId/tasks', asyncHandler(async (req, res) => {
  const title = requiredText(req.body?.title, 'Görev başlığı');
  const description = String(req.body?.description ?? '').trim() || null;
  const priority = priorityValue(req.body?.priority ?? 1);
  const dueDate = optionalDate(req.body?.due_date);
  const personnelId = req.body?.personel_id ? integerInRange(req.body.personel_id, 'Personel', 1, Number.MAX_SAFE_INTEGER) : null;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [stageRows] = await conn.execute(
      `SELECT s.id, s.title, s.project_id
       FROM project_stages s JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.offer_id = ? FOR UPDATE`,
      [req.params.stageId, req.params.offerId]
    );
    const stage = (stageRows as any[])[0];
    if (!stage) throw new HttpError(404, 'Aşama bulunamadı');
    if (personnelId) {
      const [personRows] = await conn.execute('SELECT id FROM personel WHERE id = ?', [personnelId]);
      if (!(personRows as any[])[0]) throw new HttpError(400, 'Personel bulunamadı');
    }
    const [result] = await conn.execute(
      'INSERT INTO project_tasks (project_id, stage_id, title, description, personel_id, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [stage.project_id, stage.id, title, description, personnelId, priority, dueDate]
    );
    await refreshProjectProgress(conn, stage.project_id);
    await addActivity(conn, stage.project_id, req.user?.id, 'task_created', `"${stage.title}" aşamasına "${title}" görevi eklendi.`);
    await conn.commit();
    res.json({ id: (result as any).insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.put('/by-offer-id/:offerId/tasks/:taskId/status', asyncHandler(async (req, res) => {
  const status = Number(req.body?.status);
  if (!TASK_STATUSES.has(status)) throw new HttpError(400, 'Görev durumu geçersiz');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT t.id, t.title, t.project_id, t.stage_id
       FROM project_tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.id = ? AND p.offer_id = ? FOR UPDATE`,
      [req.params.taskId, req.params.offerId]
    );
    const task = (rows as any[])[0];
    if (!task) throw new HttpError(404, 'Görev bulunamadı');
    await conn.execute(
      'UPDATE project_tasks SET status = ?, completed_at = CASE WHEN ? = 3 THEN NOW() ELSE NULL END WHERE id = ?',
      [status, status, task.id]
    );
    await syncStageFromTasks(conn, task.stage_id);
    await refreshProjectProgress(conn, task.project_id);
    await addActivity(conn, task.project_id, req.user?.id, 'task_status_changed', `"${task.title}" görevi "${TASK_STATUS_LABELS[status]}" olarak güncellendi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.delete('/by-offer-id/:offerId/tasks/:taskId', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT t.id, t.title, t.project_id, t.stage_id
       FROM project_tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.id = ? AND p.offer_id = ? FOR UPDATE`,
      [req.params.taskId, req.params.offerId]
    );
    const task = (rows as any[])[0];
    if (!task) throw new HttpError(404, 'Görev bulunamadı');
    await conn.execute('DELETE FROM project_tasks WHERE id = ?', [task.id]);
    await syncStageFromTasks(conn, task.stage_id);
    await refreshProjectProgress(conn, task.project_id);
    await addActivity(conn, task.project_id, req.user?.id, 'task_deleted', `"${task.title}" görevi silindi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

projectsRouter.delete('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id FROM projects WHERE offer_id = ? FOR UPDATE', [req.params.offerId]);
    const project = (rows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    await conn.execute('DELETE FROM projects_billings WHERE offer_id = ?', [req.params.offerId]);
    await conn.execute('DELETE FROM project_payment_plans WHERE project_id = ?', [project.id]);
    await conn.execute('DELETE FROM project_tasks WHERE project_id = ?', [project.id]);
    await conn.execute('DELETE FROM project_stages WHERE project_id = ?', [project.id]);
    await conn.execute('DELETE FROM project_activities WHERE project_id = ?', [project.id]);
    await conn.execute('DELETE FROM projects WHERE offer_id = ?', [req.params.offerId]);
    await conn.execute('UPDATE agreements SET agreement_status = 1 WHERE offer_id = ?', [req.params.offerId]);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

billingsRouter.get('/by-offer-id/:offerId', asyncHandler(async (req, res) => {
  const project = await queryOne<any>('SELECT * FROM projects WHERE offer_id = ?', [req.params.offerId]);
  if (!project) throw new HttpError(404, 'Proje bulunamadı');
  const billings = await query<any>(`
    SELECT b.id, b.pay, b.payment_plan_id, b.create_date, pp.title AS plan_title
    FROM projects_billings b
    LEFT JOIN project_payment_plans pp ON pp.id = b.payment_plan_id
    WHERE b.offer_id = ?
    ORDER BY b.id DESC
  `, [req.params.offerId]);
  const paymentPlans = await query<any>(`
    SELECT pp.*, COALESCE(SUM(b.pay), 0) AS paid
    FROM project_payment_plans pp
    LEFT JOIN projects_billings b ON b.payment_plan_id = pp.id
    WHERE pp.project_id = ?
    GROUP BY pp.id
    ORDER BY pp.due_date, pp.id
  `, [project.id]);
  const client = await queryOne<any>('SELECT id, title FROM clients WHERE id = ?', [project.client_id]);
  const personel = await queryOne<any>('SELECT id, fullname FROM personel WHERE id = ?', [project.personel_id]);
  res.json({ project, billings, paymentPlans, client, personel });
}));

billingsRouter.post('/', asyncHandler(async (req, res) => {
  const { offer_id, pay, payment_plan_id } = req.body ?? {};
  if (!offer_id) throw new HttpError(400, 'Proje gerekli');
  const payNumber = numberInRange(pay, 'Tutar', 0.01, Number.MAX_SAFE_INTEGER);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [projectRows] = await conn.execute('SELECT id, price, kdv FROM projects WHERE offer_id = ? FOR UPDATE', [offer_id]);
    const project = (projectRows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    const total = Number(project.price) + (Number(project.price) * Number(project.kdv)) / 100;
    const [paidRows] = await conn.execute('SELECT COALESCE(SUM(pay), 0) AS s FROM projects_billings WHERE offer_id = ?', [offer_id]);
    const paid = Number((paidRows as any[])[0]?.s) || 0;
    if (paid + payNumber > total) {
      throw new HttpError(400, `Kalan tutardan fazla ödeme girilemez. Kalan: ${Math.round((total - paid) * 100) / 100}`);
    }
    const planId = payment_plan_id ? integerInRange(payment_plan_id, 'Ödeme planı', 1, Number.MAX_SAFE_INTEGER) : null;
    let planText = '';
    if (planId) {
      const [planRows] = await conn.execute(
        'SELECT id, title, amount, status FROM project_payment_plans WHERE id = ? AND project_id = ? FOR UPDATE',
        [planId, project.id]
      );
      const plan = (planRows as any[])[0];
      if (!plan || Number(plan.status) === 1) throw new HttpError(400, 'Ödeme planı geçerli değil');
      const [planPaidRows] = await conn.execute('SELECT COALESCE(SUM(pay), 0) AS paid FROM projects_billings WHERE payment_plan_id = ?', [planId]);
      const planPaid = Number((planPaidRows as any[])[0].paid);
      if (planPaid + payNumber > Number(plan.amount)) {
        throw new HttpError(400, `Planlanan tutardan fazla ödeme girilemez. Kalan: ${Number(plan.amount) - planPaid}`);
      }
      planText = ` (${plan.title})`;
    }
    const [r] = await conn.execute('INSERT INTO projects_billings (offer_id, payment_plan_id, pay) VALUES (?, ?, ?)', [offer_id, planId, payNumber]);
    await addActivity(conn, project.id, req.user?.id, 'payment_added', `${payNumber} TL ödeme eklendi${planText}.`);
    await conn.commit();
    res.json({ id: (r as any).insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

billingsRouter.post('/by-offer-id/:offerId/plans', asyncHandler(async (req, res) => {
  const title = requiredText(req.body?.title, 'Ödeme planı başlığı');
  const amount = numberInRange(req.body?.amount, 'Tutar', 0.01, Number.MAX_SAFE_INTEGER);
  const dueDate = requiredText(req.body?.due_date, 'Vade tarihi');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [projectRows] = await conn.execute('SELECT id, price, kdv FROM projects WHERE offer_id = ? FOR UPDATE', [req.params.offerId]);
    const project = (projectRows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    const total = Number(project.price) + (Number(project.price) * Number(project.kdv)) / 100;
    const [plannedRows] = await conn.execute('SELECT COALESCE(SUM(amount), 0) AS planned FROM project_payment_plans WHERE project_id = ? AND status = 0', [project.id]);
    const planned = Number((plannedRows as any[])[0].planned);
    if (planned + amount > total) throw new HttpError(400, 'Planlanan ödemeler proje toplamını aşamaz');
    const [result] = await conn.execute(
      'INSERT INTO project_payment_plans (project_id, title, amount, due_date) VALUES (?, ?, ?, ?)',
      [project.id, title, amount, dueDate]
    );
    await addActivity(conn, project.id, req.user?.id, 'payment_plan_created', `"${title}" ödeme planı eklendi.`);
    await conn.commit();
    res.json({ id: (result as any).insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

billingsRouter.delete('/plans/:id', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [planRows] = await conn.execute('SELECT id, project_id, title FROM project_payment_plans WHERE id = ? FOR UPDATE', [req.params.id]);
    const plan = (planRows as any[])[0];
    if (!plan) throw new HttpError(404, 'Ödeme planı bulunamadı');
    const [billingRows] = await conn.execute('SELECT id FROM projects_billings WHERE payment_plan_id = ? LIMIT 1', [plan.id]);
    if ((billingRows as any[]).length > 0) throw new HttpError(409, 'Bu plana bağlı ödeme var; plan silinemez.');
    await conn.execute('DELETE FROM project_payment_plans WHERE id = ?', [plan.id]);
    await addActivity(conn, plan.project_id, req.user?.id, 'payment_plan_deleted', `"${plan.title}" ödeme planı silindi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

billingsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [billingRows] = await conn.execute('SELECT offer_id, pay FROM projects_billings WHERE id = ?', [req.params.id]);
    const billing = (billingRows as any[])[0];
    if (!billing) throw new HttpError(404, 'Ödeme bulunamadı');
    const [projectRows] = await conn.execute('SELECT id FROM projects WHERE offer_id = ? FOR UPDATE', [billing.offer_id]);
    const project = (projectRows as any[])[0];
    if (!project) throw new HttpError(404, 'Proje bulunamadı');
    await conn.execute('DELETE FROM projects_billings WHERE id = ?', [req.params.id]);
    await addActivity(conn, project.id, req.user?.id, 'payment_deleted', `${Number(billing.pay)} TL ödeme silindi.`);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));
