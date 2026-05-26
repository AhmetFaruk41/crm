import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const financeRouter = Router();

const TRANSACTION_TYPES = new Set(['income', 'expense']);

function requiredText(value: unknown, name: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpError(400, `${name} gerekli`);
  return text;
}

function positiveAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Tutar geçersiz');
  return amount;
}

function requiredDate(value: unknown): string {
  const date = requiredText(value, 'İşlem tarihi');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    throw new HttpError(400, 'İşlem tarihi geçersiz');
  }
  return date;
}

function transactionPayload(body: any) {
  const transactionType = String(body?.transaction_type ?? '');
  if (!TRANSACTION_TYPES.has(transactionType)) throw new HttpError(400, 'Hareket türü geçersiz');
  return {
    transactionType,
    category: requiredText(body?.category, 'Kategori'),
    title: requiredText(body?.title, 'Başlık'),
    amount: positiveAmount(body?.amount),
    transactionDate: requiredDate(body?.transaction_date),
    paymentMethod: String(body?.payment_method ?? '').trim() || null,
    reference: String(body?.reference ?? '').trim() || null,
    notes: String(body?.notes ?? '').trim() || null,
  };
}

financeRouter.get('/', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  const type = String(req.query.type ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  if (type && !TRANSACTION_TYPES.has(type)) throw new HttpError(400, 'Hareket türü geçersiz');

  const conditions: string[] = [];
  const params: any[] = [];
  if (from) {
    conditions.push('DATE(transaction_date) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('DATE(transaction_date) <= ?');
    params.push(to);
  }
  if (type) {
    conditions.push('transaction_type = ?');
    params.push(type);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const transactions = await query<any>(`
    SELECT *
    FROM (
      SELECT CONCAT('billing-', b.id) AS row_id, NULL AS manual_id,
             'income' AS transaction_type, 'Proje Tahsilatı' AS category,
             CONCAT('#', p.offer_id, ' ', p.title) AS title,
             ROUND(b.pay * 100 / (100 + COALESCE(p.kdv, 0)), 2) AS amount,
             b.create_date AS transaction_date,
             'Proje Ödemesi' AS payment_method,
             pp.title AS reference, c.title AS contact_name,
             'KDV hariç net tutar' AS notes, p.offer_id AS offer_id,
             'project_payment' AS source, NULL AS user_name
      FROM projects_billings b
      JOIN projects p ON p.offer_id = b.offer_id
      LEFT JOIN project_payment_plans pp ON pp.id = b.payment_plan_id
      LEFT JOIN clients c ON c.id = p.client_id
      UNION ALL
      SELECT CONCAT('manual-', f.id) AS row_id, f.id AS manual_id,
             f.transaction_type, f.category, f.title, f.amount,
             f.transaction_date, f.payment_method, f.reference,
             NULL AS contact_name, f.notes, NULL AS offer_id,
             'manual' AS source, u.fullname AS user_name
      FROM finance_transactions f
      LEFT JOIN users u ON u.id = f.user_id
    ) transactions
    ${where}
    ORDER BY transaction_date DESC, row_id DESC
  `, params);

  const normalized = transactions.map((row) => ({ ...row, amount: Number(row.amount) }));
  const income = normalized.filter((row) => row.transaction_type === 'income').reduce((sum, row) => sum + row.amount, 0);
  const expense = normalized.filter((row) => row.transaction_type === 'expense').reduce((sum, row) => sum + row.amount, 0);
  const autoIncome = normalized.filter((row) => row.source === 'project_payment').reduce((sum, row) => sum + row.amount, 0);
  const manualIncome = income - autoIncome;
  const categoryMap = new Map<string, { category: string; transaction_type: string; amount: number; count: number }>();
  for (const row of normalized) {
    const key = `${row.transaction_type}:${row.category}`;
    const current = categoryMap.get(key) ?? { category: row.category, transaction_type: row.transaction_type, amount: 0, count: 0 };
    current.amount += row.amount;
    current.count += 1;
    categoryMap.set(key, current);
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  const availableCategories = Array.from(new Set(normalized.map((row) => row.category))).sort();

  res.json({
    summary: { income, expense, net: income - expense, autoIncome, manualIncome, count: normalized.length },
    categories,
    availableCategories,
    transactions: normalized,
  });
}));

financeRouter.post('/', asyncHandler(async (req, res) => {
  const item = transactionPayload(req.body);
  const result = await execute(
    `INSERT INTO finance_transactions
      (transaction_type, category, title, amount, transaction_date, payment_method, reference, notes, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.transactionType, item.category, item.title, item.amount, item.transactionDate,
      item.paymentMethod, item.reference, item.notes, req.user?.id ?? null,
    ]
  );
  res.json({ id: result.insertId });
}));

financeRouter.put('/:id', asyncHandler(async (req, res) => {
  const item = transactionPayload(req.body);
  const existing = await queryOne('SELECT id FROM finance_transactions WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Finans hareketi bulunamadı');
  await execute(
    `UPDATE finance_transactions
     SET transaction_type = ?, category = ?, title = ?, amount = ?, transaction_date = ?,
         payment_method = ?, reference = ?, notes = ?
     WHERE id = ?`,
    [
      item.transactionType, item.category, item.title, item.amount, item.transactionDate,
      item.paymentMethod, item.reference, item.notes, req.params.id,
    ]
  );
  res.json({ ok: true });
}));

financeRouter.delete('/:id', asyncHandler(async (req, res) => {
  const result = await execute('DELETE FROM finance_transactions WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Finans hareketi bulunamadı');
  res.json({ ok: true });
}));
