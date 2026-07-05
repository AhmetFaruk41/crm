import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const UPLOAD_DIR = path.resolve('uploads/drive');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 12);
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

export const driveRouter = Router();

// --- Yardımcılar -----------------------------------------------------------

function fileDiskPath(storageKey: string) {
  // storage_key her zaman güvenli, rastgele bir dosya adıdır (path yok).
  return path.join(UPLOAD_DIR, path.basename(storageKey));
}

function sha256OfFile(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(p);
    s.on('error', reject);
    s.on('data', (d) => hash.update(d));
    s.on('end', () => resolve(hash.digest('hex')));
  });
}

// Bir dosya listesine etiketlerini iliştir (tek sorguda).
async function attachTags<T extends { id: number }>(files: T[]): Promise<(T & { tags: any[] })[]> {
  if (files.length === 0) return files as any;
  const ids = files.map((f) => f.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<any>(
    `SELECT ft.file_id, t.id, t.name, t.color
       FROM drive_file_tags ft JOIN drive_tags t ON t.id = ft.tag_id
      WHERE ft.file_id IN (${placeholders})
      ORDER BY t.name`,
    ids
  );
  const byFile = new Map<number, any[]>();
  for (const r of rows) {
    const list = byFile.get(r.file_id) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    byFile.set(r.file_id, list);
  }
  return files.map((f) => ({ ...f, tags: byFile.get(f.id) ?? [] }));
}

async function buildBreadcrumb(folderId: number | null) {
  const crumbs: { id: number; name: string }[] = [];
  let current = folderId;
  const guard = new Set<number>();
  while (current != null) {
    if (guard.has(current)) break; // döngü koruması
    guard.add(current);
    const f = await queryOne<any>('SELECT id, name, parent_id FROM drive_folders WHERE id = ?', [current]);
    if (!f) break;
    crumbs.unshift({ id: f.id, name: f.name });
    current = f.parent_id;
  }
  return crumbs;
}

// --- Klasör + dosya listeleme ---------------------------------------------

// GET /api/drive?folder=<id>&q=<arama>&tag=<id>
driveRouter.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const tagId = req.query.tag ? Number(req.query.tag) : null;
  const searchMode = q.length > 0 || !!tagId;

  if (searchMode) {
    // Arama/etiket modu: tüm klasörlerdeki eşleşen dosyalar.
    const where: string[] = [];
    const params: any[] = [];
    if (q) { where.push('f.original_name LIKE ?'); params.push(`%${q}%`); }
    if (tagId) {
      where.push('f.id IN (SELECT file_id FROM drive_file_tags WHERE tag_id = ?)');
      params.push(tagId);
    }
    const files = await query<any>(
      `SELECT f.id, f.folder_id, f.original_name, f.mime, f.size, f.create_date
         FROM drive_files f
        WHERE ${where.join(' AND ')}
        ORDER BY f.create_date DESC
        LIMIT 500`,
      params
    );
    return res.json({ folder: null, breadcrumb: [], folders: [], files: await attachTags(files), search: true });
  }

  const folderId = req.query.folder ? Number(req.query.folder) : null;
  const folder = folderId ? await queryOne<any>('SELECT id, name, parent_id FROM drive_folders WHERE id = ?', [folderId]) : null;
  if (folderId && !folder) throw new HttpError(404, 'Klasör bulunamadı');

  const folders = await query<any>(
    `SELECT id, name, parent_id,
            (SELECT COUNT(*) FROM drive_folders c WHERE c.parent_id = drive_folders.id) AS folderCount,
            (SELECT COUNT(*) FROM drive_files fi WHERE fi.folder_id = drive_folders.id) AS fileCount
       FROM drive_folders
      WHERE parent_id ${folderId ? '= ?' : 'IS NULL'}
      ORDER BY name`,
    folderId ? [folderId] : []
  );
  const files = await query<any>(
    `SELECT id, folder_id, original_name, mime, size, create_date
       FROM drive_files
      WHERE folder_id ${folderId ? '= ?' : 'IS NULL'}
      ORDER BY original_name`,
    folderId ? [folderId] : []
  );

  res.json({
    folder,
    breadcrumb: await buildBreadcrumb(folderId),
    folders,
    files: await attachTags(files),
    search: false,
  });
}));

// --- Klasör CRUD -----------------------------------------------------------

driveRouter.post('/folders', asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const parentId = req.body?.parent_id ? Number(req.body.parent_id) : null;
  if (!name) throw new HttpError(400, 'Klasör adı gerekli');
  if (parentId) {
    const parent = await queryOne('SELECT id FROM drive_folders WHERE id = ?', [parentId]);
    if (!parent) throw new HttpError(404, 'Üst klasör bulunamadı');
  }
  const r = await execute(
    'INSERT INTO drive_folders (parent_id, name, created_by) VALUES (?, ?, ?)',
    [parentId, name, req.user?.id ?? null]
  );
  res.json({ id: r.insertId });
}));

driveRouter.put('/folders/:id', asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Klasör adı gerekli');
  const r = await execute('UPDATE drive_folders SET name = ? WHERE id = ?', [name, Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Klasör bulunamadı');
  res.json({ ok: true });
}));

driveRouter.delete('/folders/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const folder = await queryOne('SELECT id FROM drive_folders WHERE id = ?', [id]);
  if (!folder) throw new HttpError(404, 'Klasör bulunamadı');

  // Alt klasörlerdeki tüm dosyaların fiziksel kopyalarını topla ve sil,
  // ardından klasörü sil (FK CASCADE alt klasör + dosya satırlarını temizler).
  const descendantFiles = await query<any>(
    `WITH RECURSIVE sub AS (
       SELECT id FROM drive_folders WHERE id = ?
       UNION ALL
       SELECT c.id FROM drive_folders c JOIN sub ON c.parent_id = sub.id
     )
     SELECT storage_key FROM drive_files WHERE folder_id IN (SELECT id FROM sub)`,
    [id]
  );
  for (const f of descendantFiles) {
    fs.promises.unlink(fileDiskPath(f.storage_key)).catch(() => {});
  }
  await execute('DELETE FROM drive_folders WHERE id = ?', [id]);
  res.json({ ok: true });
}));

// --- Dosya yükleme / indirme / yönetim ------------------------------------

driveRouter.post('/files', upload.array('files', 20), asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new HttpError(400, 'Dosya gerekli');
  const folderId = req.body?.folder_id ? Number(req.body.folder_id) : null;
  if (folderId) {
    const folder = await queryOne('SELECT id FROM drive_folders WHERE id = ?', [folderId]);
    if (!folder) {
      for (const f of files) fs.promises.unlink(f.path).catch(() => {});
      throw new HttpError(404, 'Klasör bulunamadı');
    }
  }

  const created: number[] = [];
  for (const f of files) {
    let checksum: string | null = null;
    try { checksum = await sha256OfFile(f.path); } catch { checksum = null; }
    const r = await execute(
      `INSERT INTO drive_files (folder_id, original_name, storage_key, mime, size, checksum, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [folderId, f.originalname, f.filename, f.mimetype ?? null, f.size, checksum, req.user?.id ?? null]
    );
    created.push(r.insertId);
  }
  res.json({ ids: created });
}));

driveRouter.get('/files/:id/download', asyncHandler(async (req, res) => {
  const file = await queryOne<any>('SELECT storage_key, original_name FROM drive_files WHERE id = ?', [Number(req.params.id)]);
  if (!file) throw new HttpError(404, 'Dosya bulunamadı');
  const diskPath = fileDiskPath(file.storage_key);
  if (!fs.existsSync(diskPath)) throw new HttpError(404, 'Dosya diskte yok');
  // res.download → Content-Disposition: attachment (tarayıcıda inline çalışmaz).
  res.download(diskPath, file.original_name);
}));

driveRouter.put('/files/:id', asyncHandler(async (req, res) => {
  const name = String(req.body?.original_name ?? '').trim();
  if (!name) throw new HttpError(400, 'Dosya adı gerekli');
  const r = await execute('UPDATE drive_files SET original_name = ? WHERE id = ?', [name, Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Dosya bulunamadı');
  res.json({ ok: true });
}));

driveRouter.delete('/files/:id', asyncHandler(async (req, res) => {
  const file = await queryOne<any>('SELECT storage_key FROM drive_files WHERE id = ?', [Number(req.params.id)]);
  if (!file) throw new HttpError(404, 'Dosya bulunamadı');
  await execute('DELETE FROM drive_files WHERE id = ?', [Number(req.params.id)]);
  fs.promises.unlink(fileDiskPath(file.storage_key)).catch(() => {});
  res.json({ ok: true });
}));

driveRouter.put('/files/:id/tags', asyncHandler(async (req, res) => {
  const fileId = Number(req.params.id);
  const tagIds: number[] = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids.map(Number).filter(Boolean) : [];
  const file = await queryOne('SELECT id FROM drive_files WHERE id = ?', [fileId]);
  if (!file) throw new HttpError(404, 'Dosya bulunamadı');

  await execute('DELETE FROM drive_file_tags WHERE file_id = ?', [fileId]);
  if (tagIds.length) {
    const placeholders = tagIds.map(() => '?').join(',');
    const valid = await query<{ id: number }>(`SELECT id FROM drive_tags WHERE id IN (${placeholders})`, tagIds);
    const validIds = valid.map((v) => v.id);
    if (validIds.length) {
      const values = validIds.map(() => '(?, ?)').join(',');
      const params = validIds.flatMap((tid) => [fileId, tid]);
      await execute(`INSERT INTO drive_file_tags (file_id, tag_id) VALUES ${values}`, params);
    }
  }
  const tags = await query<any>(
    `SELECT t.id, t.name, t.color FROM drive_file_tags ft JOIN drive_tags t ON t.id = ft.tag_id WHERE ft.file_id = ? ORDER BY t.name`,
    [fileId]
  );
  res.json({ tags });
}));

// --- Etiket CRUD -----------------------------------------------------------

driveRouter.get('/tags', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT t.id, t.name, t.color,
            (SELECT COUNT(*) FROM drive_file_tags ft WHERE ft.tag_id = t.id) AS usageCount
       FROM drive_tags t ORDER BY t.name`
  );
  res.json(rows);
}));

driveRouter.post('/tags', asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const color = String(req.body?.color ?? 'slate').trim() || 'slate';
  if (!name) throw new HttpError(400, 'Etiket adı gerekli');
  const dup = await queryOne('SELECT id FROM drive_tags WHERE name = ?', [name]);
  if (dup) throw new HttpError(409, 'Bu etiket zaten var');
  const r = await execute('INSERT INTO drive_tags (name, color) VALUES (?, ?)', [name, color]);
  res.json({ id: r.insertId, name, color });
}));

driveRouter.put('/tags/:id', asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const color = String(req.body?.color ?? 'slate').trim() || 'slate';
  if (!name) throw new HttpError(400, 'Etiket adı gerekli');
  const dup = await queryOne('SELECT id FROM drive_tags WHERE name = ? AND id <> ?', [name, Number(req.params.id)]);
  if (dup) throw new HttpError(409, 'Bu etiket adı başka bir etikete ait');
  const r = await execute('UPDATE drive_tags SET name = ?, color = ? WHERE id = ?', [name, color, Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Etiket bulunamadı');
  res.json({ ok: true });
}));

driveRouter.delete('/tags/:id', asyncHandler(async (req, res) => {
  const r = await execute('DELETE FROM drive_tags WHERE id = ?', [Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Etiket bulunamadı');
  res.json({ ok: true });
}));
