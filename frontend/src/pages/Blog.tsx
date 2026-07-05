import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { useList } from '../hooks/useList';
import { Field } from '../components/Field';
import CoverUploader from '../components/CoverUploader';
import { formatDate, todayISO } from '../lib/format';

// Siteye özel "callout" (vurgu kutusu) bloğu için tek-tık komut.
const calloutCommand: ICommand = {
  name: 'callout',
  keyCommand: 'callout',
  buttonProps: { 'aria-label': 'Vurgu kutusu', title: 'Vurgu kutusu (callout)' },
  icon: <Megaphone size={12} />,
  execute: (state: any, apiCmd: any) => {
    const text = state.selectedText || 'Vurgulanan önemli not.';
    apiCmd.replaceSelection(`\n:::callout\n${text}\n:::\n`);
  },
};

// İçerik editörünün araç çubuğu — sitedeki tasarımlı blokların hepsi tek tıkla.
const editorCommands: ICommand[] = [
  commands.bold, commands.italic, commands.strikethrough, commands.divider,
  commands.heading2, commands.heading3, commands.divider,
  commands.link, commands.quote, calloutCommand, commands.code, commands.codeBlock, commands.divider,
  commands.unorderedListCommand, commands.orderedListCommand, commands.divider,
  commands.image,
];

interface FaqItem { q: string; a: string }

interface BlogRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  cover: string;
  status: 'draft' | 'published';
  published_at: string;
  updated_at: string;
}

interface BlogDetail extends BlogRow {
  body_markdown: string;
  faq: FaqItem[];
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  return String(input ?? '')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m)
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

export function BlogList() {
  const { data: rows, loading, error, reload } = useList<BlogRow[]>('/blog/posts');

  async function del(id: number) {
    if (!await confirm({ message: 'Yazı silinsin mi? Sitedeki sayfası da kaldırılır.', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/blog/posts/${id}`);
    toast.success('Silindi');
    reload();
  }

  const cols: Column<BlogRow>[] = [
    {
      key: 'title', header: 'Başlık', sortValue: (r) => r.title, render: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.title}</div>
          <div className="text-xs text-ink-500">/blog/{r.slug}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Kategori', sortValue: (r) => r.category, render: (r) => r.category || '-' },
    {
      key: 'status', header: 'Durum', sortValue: (r) => r.status, render: (r) => (
        <span className={r.status === 'published' ? 'badge-success' : 'badge-neutral'}>
          {r.status === 'published' ? 'Yayında' : 'Taslak'}
        </span>
      ),
    },
    { key: 'published_at', header: 'Yayın', sortValue: (r) => r.published_at, render: (r) => formatDate(r.published_at) || '-' },
    { key: 'updated_at', header: 'Güncelleme', sortValue: (r) => r.updated_at, render: (r) => formatDate(r.updated_at) },
    {
      key: '_actions', header: '', width: '140px', render: (r) => (
        <div className="flex gap-1">
          {r.status === 'published' && (
            <a href={`/blog/${r.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2" title="Sitede gör"><ExternalLink size={14} /></a>
          )}
          <Link to={`/blog/${r.id}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
          <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <Loading />;
  if (error || !rows) return <ErrorState onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Blog"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Blog' }]}
        actions={<Link to="/blog/new" className="btn-primary"><Plus size={16} /> Yeni Yazı</Link>}
      />
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.title} ${r.slug} ${r.category}`}
        empty="Henüz yazı yok. İlk yazını ekle."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const EMPTY: BlogDetail = {
  id: 0, slug: '', title: '', description: '', category: 'Genel',
  tags: [], author: '', cover: '', status: 'draft', published_at: '',
  updated_at: '', body_markdown: '', faq: [],
};

export function BlogForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [d, setD] = useState<BlogDetail>(EMPTY);

  useEffect(() => {
    if (!editing) return;
    api.get<BlogDetail>(`/blog/posts/${id}`).then((r) => {
      setD({ ...EMPTY, ...r.data });
      setTagsInput((r.data.tags ?? []).join(', '));
      setSlugTouched(true);
      setLoading(false);
    });
  }, [id, editing]);

  function setTitle(title: string) {
    setD((s) => ({ ...s, title, slug: slugTouched ? s.slug : slugify(title) }));
  }

  function addFaq() { setD((s) => ({ ...s, faq: [...s.faq, { q: '', a: '' }] })); }
  function setFaq(i: number, key: 'q' | 'a', val: string) {
    setD((s) => ({ ...s, faq: s.faq.map((f, idx) => idx === i ? { ...f, [key]: val } : f) }));
  }
  function removeFaq(i: number) { setD((s) => ({ ...s, faq: s.faq.filter((_, idx) => idx !== i) })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...d,
        slug: slugify(d.slug || d.title),
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        faq: d.faq.filter((f) => f.q.trim() && f.a.trim()),
        published_at: d.published_at || null,
      };
      if (editing) {
        await api.put(`/blog/posts/${id}`, payload);
        toast.success('Güncellendi · site tazeleniyor');
      } else {
        await api.post('/blog/posts', payload);
        toast.success('Oluşturuldu · site tazeleniyor');
      }
      nav('/blog');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Yazı Düzenle' : 'Yeni Yazı'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Blog', to: '/blog' }, { label: editing ? 'Düzenle' : 'Yeni' }]}
      />
      <form onSubmit={submit} className="card max-w-3xl">
        <div className="card-body space-y-4">
          <Field label="Başlık">
            <input className="input" value={d.title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Slug (URL)">
              <input
                className="input font-mono text-sm"
                value={d.slug}
                onChange={(e) => { setSlugTouched(true); setD({ ...d, slug: e.target.value }); }}
                placeholder="otomatik-uretilir"
              />
              <p className="mt-1 text-xs text-ink-500">cawelt.com/blog/{slugify(d.slug || d.title) || '...'}</p>
            </Field>
            <Field label="Kategori">
              <input className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="Rehber, Teknik, Strateji..." />
            </Field>
          </div>

          <Field label="Özet / Meta açıklama (SEO)">
            <textarea
              className="input min-h-16"
              value={d.description}
              maxLength={320}
              onChange={(e) => setD({ ...d, description: e.target.value })}
              placeholder="Arama sonuçlarında ve liste kartında görünür. 150-160 karakter idealdir."
            />
            <p className="mt-1 text-xs text-ink-500">{d.description.length}/320</p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Etiketler (virgülle)">
              <input className="input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="seo, next.js, web tasarım" />
            </Field>
            <Field label="Yazar">
              <input className="input" value={d.author} onChange={(e) => setD({ ...d, author: e.target.value })} placeholder="Cawelt Studio" />
            </Field>
          </div>

          <Field label="Kapak görseli (opsiyonel)">
            <CoverUploader value={d.cover} onChange={(url) => setD({ ...d, cover: url })} />
          </Field>

          <Field label="İçerik">
            <div data-color-mode="light" className="rounded-md border border-ink-200 overflow-hidden">
              <MDEditor
                value={d.body_markdown}
                onChange={(v) => setD({ ...d, body_markdown: v ?? '' })}
                height={460}
                preview="edit"
                commands={editorCommands}
                textareaProps={{
                  placeholder:
                    'İlk paragraf otomatik olarak "giriş" (lead) stiline alınır.\n\nÜstteki araç çubuğuyla başlık, liste, alıntı, vurgu kutusu (📣) ve kod ekleyebilirsin.',
                }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Araç çubuğundaki butonlar sitedeki tasarımlı blokları üretir: <b>H2/H3</b> başlık,
              liste, <b>alıntı</b> (alt satıra <code>— Kaynak</code> yazarsan kaynak olur),
              <b> 📣 vurgu kutusu</b>, kod. Sağ üstten önizleme/tam ekran açabilirsin.
              İlk paragraf otomatik <b>giriş</b> stiline geçer.
            </p>
          </Field>

          {/* SSS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Sıkça Sorulan Sorular (SEO — FAQ zengin sonucu)</label>
              <button type="button" onClick={addFaq} className="btn-secondary text-sm"><Plus size={14} /> Soru ekle</button>
            </div>
            <div className="space-y-3">
              {d.faq.length === 0 && <p className="text-xs text-ink-500">Opsiyonel. Eklenirse sayfada akordeon + FAQPage yapısal verisi olarak yayınlanır.</p>}
              {d.faq.map((f, i) => (
                <div key={i} className="rounded-md border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="input" value={f.q} onChange={(e) => setFaq(i, 'q', e.target.value)} placeholder="Soru" />
                    <button type="button" onClick={() => removeFaq(i)} className="btn-ghost p-2 text-red-600" title="Kaldır"><Trash2 size={14} /></button>
                  </div>
                  <textarea className="input min-h-16" value={f.a} onChange={(e) => setFaq(i, 'a', e.target.value)} placeholder="Cevap" />
                </div>
              ))}
            </div>
          </div>

          {/* Yayın durumu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-ink-100 pt-4">
            <Field label="Durum">
              <select className="input" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as 'draft' | 'published' })}>
                <option value="draft">Taslak (sitede görünmez)</option>
                <option value="published">Yayında</option>
              </select>
            </Field>
            <Field label="Yayın tarihi">
              <input
                type="date"
                className="input"
                value={d.published_at}
                onChange={(e) => setD({ ...d, published_at: e.target.value })}
              />
              {d.status === 'published' && !d.published_at && (
                <p className="mt-1 text-xs text-ink-500">Boş bırakılırsa bugün ({formatDate(todayISO())}) atanır.</p>
              )}
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Link to="/blog" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
            <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>{editing ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
