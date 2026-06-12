import { Router } from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { markdownToBlocks } from '../utils/markdown.js';
import { triggerSiteRevalidate } from '../services/revalidate.js';

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  return String(input ?? '')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** JSON kolonu hem string hem parse edilmiş gelebilir; güvenli çöz. */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Etiketleri diziye normalize et (dizi | JSON string | virgüllü string). */
function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) return parseJson<string[]>(text, []).map((t) => String(t).trim()).filter(Boolean);
  return text.split(',').map((t) => t.trim()).filter(Boolean);
}

interface FaqItem { q: string; a: string }
function normalizeFaq(value: unknown): FaqItem[] {
  const arr = Array.isArray(value) ? value : parseJson<unknown[]>(value, []);
  return (arr as any[])
    .map((f) => ({ q: String(f?.q ?? '').trim(), a: String(f?.a ?? '').trim() }))
    .filter((f) => f.q && f.a);
}

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/** DB satırını site'ın beklediği public şekle çevirir. */
function toPublic(row: any, includeBody: boolean) {
  const base = {
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? 'Genel',
    tags: parseJson<string[]>(row.tags, []),
    author: row.author ?? '',
    cover: row.cover ?? undefined,
    publishedAt: dateOnly(row.published_at) ?? dateOnly(row.created_at)!,
    updatedAt: dateOnly(row.updated_at) ?? undefined,
  };
  if (!includeBody) return base;
  return {
    ...base,
    body: parseJson<unknown[]>(row.body_json, []),
    faq: normalizeFaq(row.faq),
  };
}

/** Admin (panel) için satırı çevirir — taslaklar ve markdown kaynağı dahil. */
function toAdmin(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? 'Genel',
    tags: parseJson<string[]>(row.tags, []),
    author: row.author ?? '',
    cover: row.cover ?? '',
    body_markdown: row.body_markdown ?? '',
    faq: normalizeFaq(row.faq),
    status: row.status,
    published_at: dateOnly(row.published_at) ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const LIST_COLS =
  'id, slug, title, description, category, tags, author, cover, status, published_at, created_at, updated_at';

// ---------------------------------------------------------------------------
// PUBLIC — siteye servis (yetki gerektirmez, yalnızca yayınlananlar)
// ---------------------------------------------------------------------------

export const publicBlogRouter = Router();

publicBlogRouter.get('/posts', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT ${LIST_COLS} FROM blog_posts
     WHERE status = 'published'
     ORDER BY published_at DESC, id DESC`,
  );
  res.json(rows.map((r) => toPublic(r, false)));
}));

publicBlogRouter.get('/posts/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' LIMIT 1`,
    [req.params.slug],
  );
  if (!row) throw new HttpError(404, 'Yazı bulunamadı');
  res.json(toPublic(row, true));
}));

// ---------------------------------------------------------------------------
// ADMIN — CRM paneli (JWT auth, server.ts'te requireAuth ile mount edilir)
// ---------------------------------------------------------------------------

export const blogAdminRouter = Router();

blogAdminRouter.get('/posts', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT ${LIST_COLS} FROM blog_posts ORDER BY COALESCE(published_at, created_at) DESC, id DESC`,
  );
  res.json(rows.map(toAdmin));
}));

blogAdminRouter.get('/posts/:id', asyncHandler(async (req, res) => {
  const row = await queryOne('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Yazı bulunamadı');
  res.json(toAdmin(row));
}));

blogAdminRouter.post('/posts', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const title = String(b.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Başlık gerekli');

  const slug = slugify(b.slug || title);
  if (!slug) throw new HttpError(400, 'Geçerli bir slug üretilemedi');

  const bodyMarkdown = String(b.body_markdown ?? '');
  const status = b.status === 'published' ? 'published' : 'draft';
  const publishedAt =
    dateOnly(b.published_at) ?? (status === 'published' ? new Date().toISOString().slice(0, 10) : null);

  try {
    const r = await execute(
      `INSERT INTO blog_posts
         (slug, title, description, category, tags, author, cover,
          body_markdown, body_json, faq, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        title,
        String(b.description ?? '').slice(0, 320),
        String(b.category ?? 'Genel').slice(0, 80) || 'Genel',
        JSON.stringify(normalizeTags(b.tags)),
        String(b.author ?? '').slice(0, 120),
        String(b.cover ?? '').trim() || null,
        bodyMarkdown,
        JSON.stringify(markdownToBlocks(bodyMarkdown)),
        JSON.stringify(normalizeFaq(b.faq)),
        status,
        publishedAt,
      ],
    );
    triggerSiteRevalidate(slug);
    res.json({ id: r.insertId, slug });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Bu slug zaten kullanılıyor');
    throw err;
  }
}));

blogAdminRouter.put('/posts/:id', asyncHandler(async (req, res) => {
  const existing = await queryOne<any>('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Yazı bulunamadı');

  const b = req.body ?? {};
  const title = String(b.title ?? existing.title).trim();
  if (!title) throw new HttpError(400, 'Başlık gerekli');

  const slug = slugify(b.slug || existing.slug);
  const bodyMarkdown = b.body_markdown != null ? String(b.body_markdown) : existing.body_markdown;
  const status = b.status === 'published' ? 'published' : b.status === 'draft' ? 'draft' : existing.status;
  // Yayına ilk geçişte tarih yoksa bugünü ata.
  let publishedAt = dateOnly(b.published_at) ?? dateOnly(existing.published_at);
  if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString().slice(0, 10);

  try {
    await execute(
      `UPDATE blog_posts SET
         slug = ?, title = ?, description = ?, category = ?, tags = ?, author = ?,
         cover = ?, body_markdown = ?, body_json = ?, faq = ?, status = ?, published_at = ?
       WHERE id = ?`,
      [
        slug,
        title,
        String(b.description ?? existing.description ?? '').slice(0, 320),
        String(b.category ?? existing.category ?? 'Genel').slice(0, 80) || 'Genel',
        JSON.stringify(normalizeTags(b.tags ?? existing.tags)),
        String(b.author ?? existing.author ?? '').slice(0, 120),
        String(b.cover ?? existing.cover ?? '').trim() || null,
        bodyMarkdown,
        JSON.stringify(markdownToBlocks(bodyMarkdown)),
        JSON.stringify(normalizeFaq(b.faq ?? existing.faq)),
        status,
        publishedAt,
        req.params.id,
      ],
    );
    // Eski slug değiştiyse her iki yolu da tazele.
    triggerSiteRevalidate(slug);
    if (existing.slug !== slug) triggerSiteRevalidate(existing.slug);
    res.json({ ok: true, slug });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Bu slug zaten kullanılıyor');
    throw err;
  }
}));

blogAdminRouter.delete('/posts/:id', asyncHandler(async (req, res) => {
  const existing = await queryOne<any>('SELECT slug FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Yazı bulunamadı');
  await execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  triggerSiteRevalidate(existing.slug);
  res.json({ ok: true });
}));
