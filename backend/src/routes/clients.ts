import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const UPLOAD_DIR = path.resolve('uploads/clients');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// SVG dahil DEĞİL: SVG içine gömülü script /uploads'tan inline servis
// edildiğinde aynı origin'de çalışır (depolanmış XSS). Raster formatlar güvenli.
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 6);
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece PNG, JPG, WEBP ve GIF formatları kabul edilir'));
  },
});

export const clientsRouter = Router();

clientsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await query('SELECT id, title, vk_number, vk_name, address, fullname, phone, email, image, create_date FROM clients ORDER BY title'));
}));

clientsRouter.get('/:id', asyncHandler(async (req, res) => {
  const c = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Müşteri bulunamadı');
  res.json(c);
}));

clientsRouter.post('/', upload.single('image'), asyncHandler(async (req, res) => {
  const { title, vk_number, vk_name, address, fullname, phone, email } = req.body ?? {};
  if (!title || !fullname) throw new HttpError(400, 'Eksik alan');
  const image = req.file ? req.file.filename : null;
  const r = await execute(
    'INSERT INTO clients (title, vk_number, vk_name, address, fullname, phone, email, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, vk_number || null, vk_name || null, address || null, fullname, phone || null, email || null, image]
  );
  res.json({ id: r.insertId });
}));

clientsRouter.put('/:id', upload.single('image'), asyncHandler(async (req, res) => {
  const { title, vk_number, vk_name, address, fullname, phone, email, old_image } = req.body ?? {};
  if (!title || !fullname) throw new HttpError(400, 'Eksik alan');
  let image = old_image || null;
  if (req.file) {
    image = req.file.filename;
    if (old_image) {
      const oldPath = path.join(UPLOAD_DIR, old_image);
      fs.unlink(oldPath, () => {});
    }
  }
  const r = await execute(
    'UPDATE clients SET title = ?, vk_number = ?, vk_name = ?, address = ?, fullname = ?, phone = ?, email = ?, image = ? WHERE id = ?',
    [title, vk_number || null, vk_name || null, address || null, fullname, phone || null, email || null, image, req.params.id]
  );
  if (r.affectedRows === 0) throw new HttpError(404, 'Müşteri bulunamadı');
  res.json({ ok: true });
}));

clientsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const c = await queryOne<any>('SELECT image FROM clients WHERE id = ?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Müşteri bulunamadı');

  // block if offers/agreements/projects reference this client
  const ref = await queryOne(`
    SELECT 1 AS x FROM offers WHERE client_id = ?
    UNION SELECT 1 FROM agreements WHERE client_id = ?
    UNION SELECT 1 FROM projects WHERE client_id = ?
    LIMIT 1
  `, [req.params.id, req.params.id, req.params.id]);
  if (ref) throw new HttpError(409, 'Bu müşteriye bağlı teklif/sözleşme/proje var. Önce onları silin.');

  await execute('DELETE FROM clients WHERE id = ?', [req.params.id]);
  if (c.image) fs.unlink(path.join(UPLOAD_DIR, c.image), () => {});
  res.json({ ok: true });
}));
