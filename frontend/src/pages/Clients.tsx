import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { useList } from '../hooks/useList';
import { Field } from '../components/Field';
import type { Client } from '../types';

export function ClientsList() {
  const { data: rows, loading, error, reload } = useList<Client[]>('/clients');

  async function del(id: number) {
    if (!await confirm({ message: 'Müşteri silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/clients/${id}`);
    toast.success('Silindi');
    reload();
  }

  const cols: Column<Client>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'title', header: 'Firma', sortValue: (r) => r.title, render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'fullname', header: 'Yönetici', sortValue: (r) => r.fullname },
    { key: 'phone', header: 'Telefon', render: (r) => r.phone || '-' },
    { key: 'email', header: 'E-Posta', render: (r) => r.email || '-' },
    { key: 'image', header: 'Logo', render: (r) =>
      r.image ? <img src={`/uploads/clients/${r.image}`} alt="" className="h-10 w-10 object-contain rounded border border-ink-200 bg-white" /> : <span className="text-ink-400">-</span>
    },
    { key: '_actions', header: '', width: '110px', render: (r) => (
      <div className="flex gap-1">
        <Link to={`/clients/${r.id}/edit`} className="btn-ghost p-2"><Pencil size={14} /></Link>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (loading) return <Loading />;
  if (error || !rows) return <ErrorState onRetry={reload} />;
  return (
    <div>
      <PageHeader
        title="Müşteriler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Müşteriler' }]}
        actions={<Link to="/clients/new" className="btn-primary"><Plus size={16} /> Yeni</Link>}
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.title} ${r.fullname} ${r.email ?? ''} ${r.phone ?? ''}`} />
    </div>
  );
}

export function ClientForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState<any>({ title: '', vk_number: '', vk_name: '', address: '', fullname: '', phone: '', email: '' });
  const [file, setFile] = useState<File | null>(null);
  const [oldImage, setOldImage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    api.get(`/clients/${id}`).then((r) => {
      setC(r.data);
      setOldImage(r.data.image ?? null);
      setLoading(false);
    });
  }, [id, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(c).forEach(([k, v]) => {
        if (k === 'image' || k === 'create_date' || k === 'id') return;
        fd.append(k, (v ?? '') as string);
      });
      if (file) fd.append('image', file);
      if (editing) {
        if (oldImage) fd.append('old_image', oldImage);
        await api.put(`/clients/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Güncellendi');
      } else {
        await api.post('/clients', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Oluşturuldu');
      }
      nav('/clients');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Müşteri Düzenle' : 'Müşteri Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Müşteriler', to: '/clients' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
      />
      <div className="card max-w-3xl">
        <form onSubmit={submit} className="card-body space-y-4">
          <Field label="Firma Adı">
            <input className="input" value={c.title || ''} onChange={(e) => setC({ ...c, title: e.target.value })} required />
          </Field>
          <Field label="Vergi Numarası">
            <input className="input" value={c.vk_number || ''} onChange={(e) => setC({ ...c, vk_number: e.target.value })} />
          </Field>
          <Field label="Vergi Dairesi">
            <input className="input" value={c.vk_name || ''} onChange={(e) => setC({ ...c, vk_name: e.target.value })} />
          </Field>
          <Field label="Adres">
            <textarea rows={2} className="input" value={c.address || ''} onChange={(e) => setC({ ...c, address: e.target.value })} />
          </Field>
          <Field label="Yönetici">
            <input className="input" value={c.fullname || ''} onChange={(e) => setC({ ...c, fullname: e.target.value })} required />
          </Field>
          <Field label="Telefon">
            <input className="input" value={c.phone || ''} onChange={(e) => setC({ ...c, phone: e.target.value })} />
          </Field>
          <Field label="E-Posta">
            <input type="email" className="input" value={c.email || ''} onChange={(e) => setC({ ...c, email: e.target.value })} />
          </Field>
          <Field label="Logo">
            <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {oldImage && (
              <div className="mt-2">
                <img src={`/uploads/clients/${oldImage}`} alt="" className="h-24 object-contain bg-white border border-ink-200 rounded p-2" />
              </div>
            )}
          </Field>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {editing ? 'Güncelle' : 'Oluştur'}
            </button>
            <Link to="/clients" className="btn-secondary justify-center">İptal</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
