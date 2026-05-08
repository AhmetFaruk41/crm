import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import type { Personel } from '../types';

export function PersonnelList() {
  const [rows, setRows] = useState<Personel[] | null>(null);

  async function load() {
    const r = await api.get<Personel[]>('/personnel');
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!await confirm({ message: 'Personel silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/personnel/${id}`);
    toast.success('Silindi');
    load();
  }

  const cols: Column<Personel>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'fullname', header: 'İsim', sortValue: (r) => r.fullname, render: (r) => <span className="font-medium">{r.fullname}</span> },
    { key: 'email', header: 'E-Posta', render: (r) => r.email || '-' },
    { key: 'phone', header: 'Telefon', render: (r) => r.phone || '-' },
    { key: '_actions', header: '', width: '110px', render: (r) => (
      <div className="flex gap-1">
        <Link to={`/personnel/${r.id}/edit`} className="btn-ghost p-2"><Pencil size={14} /></Link>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Personel"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Personel' }]}
        actions={<Link to="/personnel/new" className="btn-primary"><Plus size={16} /> Yeni</Link>}
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.fullname} ${r.email ?? ''} ${r.phone ?? ''}`} />
    </div>
  );
}

export function PersonnelForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState({ fullname: '', email: '', phone: '' });

  useEffect(() => {
    if (!editing) return;
    api.get(`/personnel/${id}`).then((r) => {
      setD({ fullname: r.data.fullname, email: r.data.email ?? '', phone: r.data.phone ?? '' });
      setLoading(false);
    });
  }, [id, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/personnel/${id}`, d);
        toast.success('Güncellendi');
      } else {
        await api.post('/personnel', d);
        toast.success('Oluşturuldu');
      }
      nav('/personnel');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Personel Düzenle' : 'Personel Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Personel', to: '/personnel' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
      />
      <form onSubmit={submit} className="card max-w-2xl">
        <div className="card-body space-y-4">
          <Field label="İsim & Soyisim">
            <input className="input" value={d.fullname} onChange={(e) => setD({ ...d, fullname: e.target.value })} required />
          </Field>
          <Field label="E-Posta">
            <input type="email" className="input" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className="input" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          </Field>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Link to="/personnel" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
            <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>{editing ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
