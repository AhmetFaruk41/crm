import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FolderPlus, Upload, Folder, FileText, Download, Pencil, Trash2, Tag, Search,
  ChevronRight, House, X, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { confirm, promptText } from '../components/ConfirmDialog';
import { formatSize, formatDate } from '../lib/format';
import { TAG_COLOR_OPTIONS, tagChipClass } from '../lib/tagColors';
import type { DriveListing, DriveTag, DriveFile } from '../types';

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLOR_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.label}
          onClick={() => onChange(opt.value)}
          className={`h-6 w-6 rounded-full ${opt.dot} ring-2 ring-offset-1 transition ${value === opt.value ? 'ring-ink-700' : 'ring-transparent'}`}
        />
      ))}
    </div>
  );
}

export default function Drive() {
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const q = params.get('q') ?? '';
  const tagFilter = params.get('tag');

  const [data, setData] = useState<DriveListing | null>(null);
  const [error, setError] = useState(false);
  const [tags, setTags] = useState<DriveTag[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [tagEditorFor, setTagEditorFor] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadTags = useCallback(async () => {
    const r = await api.get<DriveTag[]>('/drive/tags');
    setTags(r.data);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    setData(null);
    try {
      const r = await api.get<DriveListing>('/drive', {
        params: {
          folder: folderId || undefined,
          q: q || undefined,
          tag: tagFilter || undefined,
        },
      });
      setData(r.data);
    } catch {
      setError(true);
    }
  }, [folderId, q, tagFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTags(); }, [loadTags]);

  function goToFolder(id: number | null) {
    const next = new URLSearchParams();
    if (id) next.set('folder', String(id));
    setParams(next);
  }

  function setSearch(text: string) {
    const next = new URLSearchParams(params);
    if (text) next.set('q', text); else next.delete('q');
    next.delete('folder');
    next.delete('tag');
    setParams(next);
  }

  function setTagFilter(id: number | null) {
    const next = new URLSearchParams();
    if (id) next.set('tag', String(id));
    setParams(next);
  }

  async function newFolder() {
    const name = await promptText({ title: 'Yeni klasör', message: 'Klasör adı', confirmLabel: 'Oluştur' });
    if (!name) return;
    await api.post('/drive/folders', { name, parent_id: folderId || null });
    toast.success('Klasör oluşturuldu');
    load();
  }

  async function renameFolder(id: number, current: string) {
    const name = await promptText({ title: 'Klasörü yeniden adlandır', message: 'Yeni ad', confirmLabel: 'Kaydet', input: { initialValue: current, required: true } });
    if (!name || name === current) return;
    await api.put(`/drive/folders/${id}`, { name });
    load();
  }

  async function deleteFolder(id: number) {
    if (!await confirm({ message: 'Klasör ve içindeki tüm dosyalar silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/drive/folders/${id}`);
    toast.success('Klasör silindi');
    load();
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    if (folderId) fd.append('folder_id', folderId);
    Array.from(files).forEach((f) => fd.append('files', f));
    await toast.promise(
      api.post('/drive/files', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
      { loading: 'Yükleniyor…', success: 'Yüklendi', error: 'Yükleme başarısız' }
    );
    if (fileInput.current) fileInput.current.value = '';
    load();
  }

  async function renameFile(file: DriveFile) {
    const name = await promptText({ title: 'Dosyayı yeniden adlandır', message: 'Yeni ad', confirmLabel: 'Kaydet', input: { initialValue: file.original_name, required: true } });
    if (!name || name === file.original_name) return;
    await api.put(`/drive/files/${file.id}`, { original_name: name });
    load();
  }

  async function deleteFile(id: number) {
    if (!await confirm({ message: 'Dosya silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/drive/files/${id}`);
    toast.success('Dosya silindi');
    load();
  }

  async function toggleFileTag(file: DriveFile, tag: DriveTag) {
    const has = file.tags.some((t) => t.id === tag.id);
    const nextIds = has ? file.tags.filter((t) => t.id !== tag.id).map((t) => t.id) : [...file.tags.map((t) => t.id), tag.id];
    const r = await api.put<{ tags: DriveTag[] }>(`/drive/files/${file.id}/tags`, { tag_ids: nextIds });
    setData((cur) => cur ? { ...cur, files: cur.files.map((f) => f.id === file.id ? { ...f, tags: r.data.tags } : f) } : cur);
  }

  if (error) return (
    <div>
      <PageHeader title="Drive" crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Drive' }]} />
      <ErrorState onRetry={load} />
    </div>
  );
  if (!data) return <Loading />;

  const searching = data.search;

  return (
    <div>
      <PageHeader
        title="Drive"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Drive' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setShowTagManager((v) => !v)}><Tag size={16} /> Etiketler</button>
            <button className="btn-secondary" onClick={newFolder}><FolderPlus size={16} /> Yeni klasör</button>
            <button className="btn-primary" onClick={() => fileInput.current?.click()}><Upload size={16} /> Yükle</button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => onUpload(e.target.files)} />
          </div>
        }
      />

      {/* Arama + etiket filtresi */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Dosya ara…"
            defaultValue={q}
            onChange={(e) => setSearch(e.target.value.trim())}
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-500 mr-1">Etikete göre:</span>
            {tags.map((t) => {
              const active = String(t.id) === tagFilter;
              return (
                <button
                  key={t.id}
                  onClick={() => setTagFilter(active ? null : t.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition ${active ? tagChipClass(t.color) : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50'}`}
                >
                  {t.name}
                </button>
              );
            })}
            {tagFilter && <button className="text-xs text-ink-500 underline ml-1" onClick={() => setTagFilter(null)}>temizle</button>}
          </div>
        )}
      </div>

      {showTagManager && <TagManager tags={tags} onChange={() => { loadTags(); load(); }} onClose={() => setShowTagManager(false)} />}

      {/* Breadcrumb */}
      {!searching && (
        <div className="mb-3 flex items-center gap-1 text-sm text-ink-600 flex-wrap">
          <button className="inline-flex items-center gap-1 hover:text-ink-900" onClick={() => goToFolder(null)}><House size={15} /> Drive</button>
          {data.breadcrumb.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight size={14} className="text-ink-400" />
              <button className="hover:text-ink-900" onClick={() => goToFolder(c.id)}>{c.name}</button>
            </span>
          ))}
        </div>
      )}
      {searching && (
        <div className="mb-3 text-sm text-ink-500">Arama sonuçları — {data.files.length} dosya</div>
      )}

      {/* Klasörler */}
      {data.folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {data.folders.map((f) => (
            <div key={f.id} className="card group hover:border-ink-300 transition">
              <div className="card-body flex items-start gap-3 !p-3">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => goToFolder(f.id)}>
                  <Folder size={22} className="text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-xs text-ink-400">{(f.folderCount ?? 0)} klasör · {(f.fileCount ?? 0)} dosya</div>
                  </div>
                </button>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button className="btn-ghost p-1.5" title="Yeniden adlandır" onClick={() => renameFolder(f.id, f.name)}><Pencil size={13} /></button>
                  <button className="btn-ghost p-1.5 text-red-600" title="Sil" onClick={() => deleteFolder(f.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dosyalar */}
      {data.files.length > 0 ? (
        <div className="card">
          <div className="divide-y divide-ink-100">
            {data.files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50/50">
                <FileText size={20} className="text-sky-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{file.original_name}</div>
                  <div className="text-xs text-ink-400 flex items-center gap-2 flex-wrap">
                    <span>{formatSize(file.size)}</span>
                    <span>·</span>
                    <span>{formatDate(file.create_date)}</span>
                    {file.tags.map((t) => (
                      <span key={t.id} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tagChipClass(t.color)}`}>{t.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 relative">
                  <button className="btn-ghost p-1.5" title="Etiketle" onClick={() => setTagEditorFor(tagEditorFor === file.id ? null : file.id)}><Tag size={14} /></button>
                  {tagEditorFor === file.id && (
                    <FileTagPopover
                      file={file}
                      tags={tags}
                      onToggle={(t) => toggleFileTag(file, t)}
                      onClose={() => setTagEditorFor(null)}
                      onManage={() => { setTagEditorFor(null); setShowTagManager(true); }}
                    />
                  )}
                  <a className="btn-ghost p-1.5" title="İndir" href={`/api/drive/files/${file.id}/download`}><Download size={14} /></a>
                  <button className="btn-ghost p-1.5" title="Yeniden adlandır" onClick={() => renameFile(file)}><Pencil size={14} /></button>
                  <button className="btn-ghost p-1.5 text-red-600" title="Sil" onClick={() => deleteFile(file.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : data.folders.length === 0 && (
        <div className="card"><div className="card-body text-center text-sm text-ink-400 py-12">
          {searching ? 'Eşleşen dosya yok.' : 'Bu klasör boş. Dosya yükleyin veya klasör oluşturun.'}
        </div></div>
      )}
    </div>
  );
}

function FileTagPopover({ file, tags, onToggle, onClose, onManage }: {
  file: DriveFile; tags: DriveTag[]; onToggle: (t: DriveTag) => void; onClose: () => void; onManage: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-ink-200 bg-white shadow-lg p-2">
      {tags.length === 0 ? (
        <div className="text-xs text-ink-400 p-2">Henüz etiket yok.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {tags.map((t) => {
            const selected = file.tags.some((ft) => ft.id === t.id);
            return (
              <button
                key={t.id}
                onClick={() => onToggle(t)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition ${selected ? tagChipClass(t.color) : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50'}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      <button className="mt-2 w-full text-xs text-ink-500 hover:text-ink-800 text-left px-1" onClick={onManage}>+ Etiketleri yönet</button>
    </div>
  );
}

function TagManager({ tags, onChange, onClose }: { tags: DriveTag[]; onChange: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('slate');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/drive/tags', { name: name.trim(), color });
      setName(''); setColor('slate');
      onChange();
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!await confirm({ message: 'Etiket silinsin mi? Dosyalardaki bu etiket kaldırılır.', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/drive/tags/${id}`);
    onChange();
  }

  return (
    <div className="card mb-4">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Etiketler</h3>
          <button className="btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input className="input sm:max-w-xs" placeholder="Yeni etiket adı" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}><Plus size={15} /> Ekle</button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.map((t) => (
              <span key={t.id} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${tagChipClass(t.color)}`}>
                {t.name}
                <span className="text-ink-400">({t.usageCount ?? 0})</span>
                <button className="hover:text-red-600" title="Sil" onClick={() => remove(t.id)}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
