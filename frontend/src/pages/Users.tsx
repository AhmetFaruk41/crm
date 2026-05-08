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
import { useAuth } from '../context/AuthContext';

interface UserRow {
  id: number;
  fullname: string;
  username: string;
  level: number;
  phone: string;
  email: string;
}

export function UsersList() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[] | null>(null);

  async function load() {
    const r = await api.get<UserRow[]>('/users');
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!await confirm({ message: 'Kullanıcı silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/users/${id}`);
    toast.success('Silindi');
    load();
  }

  const cols: Column<UserRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'level', header: 'Yetki', render: (r) => (
      <span className="badge-neutral">{r.level === 1 ? 'Yönetici' : 'Kullanıcı'}</span>
    ), sortValue: (r) => r.level },
    { key: 'fullname', header: 'Kullanıcı', render: (r) => (
      <div>
        <div className="font-medium">{r.fullname} {me?.id === r.id && <span className="text-xs text-ink-400">(siz)</span>}</div>
        <div className="text-xs text-ink-500">@{r.username}</div>
      </div>
    ), sortValue: (r) => r.fullname },
    { key: 'phone', header: 'Telefon', render: (r) => r.phone || '-' },
    { key: 'email', header: 'E-Posta', render: (r) => r.email || '-' },
    { key: '_actions', header: '', width: '110px', render: (r) => (
      <div className="flex gap-1">
        <Link to={`/users/${r.id}/edit`} className="btn-ghost p-2"><Pencil size={14} /></Link>
        {me?.id !== r.id && (
          <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600"><Trash2 size={14} /></button>
        )}
      </div>
    ) },
  ];

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Kullanıcılar' }]}
        actions={<Link to="/users/new" className="btn-primary"><Plus size={16} /> Yeni</Link>}
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.fullname} ${r.username} ${r.email} ${r.phone}`} />
    </div>
  );
}

export function UserForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({ fullname: '', username: '', password: '', level: 0, phone: '', email: '' });
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');

  useEffect(() => {
    if (!editing) return;
    api.get(`/users/${id}`).then((r) => {
      setData({ ...r.data, password: '' });
      setLoading(false);
    });
  }, [id, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/users/${id}`, { fullname: data.fullname, username: data.username, level: data.level, phone: data.phone, email: data.email });
        toast.success('Güncellendi');
      } else {
        if ((data.password || '').length < 8) {
          toast.error('Şifre en az 8 karakter olmalı');
          return;
        }
        await api.post('/users', data);
        toast.success('Oluşturuldu');
      }
      nav('/users');
    } finally {
      setBusy(false);
    }
  }

  async function changePw() {
    if (newPw.length < 8) {
      toast.error('Şifre en az 8 karakter');
      return;
    }
    await api.put(`/users/${id}/password`, { password: newPw });
    toast.success('Şifre değişti');
    setPwOpen(false);
    setNewPw('');
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Kullanıcı Düzenle' : 'Kullanıcı Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Kullanıcılar', to: '/users' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
      />
      <div className="card max-w-3xl">
        <form onSubmit={submit} className="card-body space-y-4">
          <Field label="İsim & Soyisim">
            <input className="input" value={data.fullname} onChange={(e) => setData({ ...data, fullname: e.target.value })} required />
          </Field>
          <Field label="Yetki Düzeyi">
            <select className="input" value={data.level} onChange={(e) => setData({ ...data, level: Number(e.target.value) })}>
              <option value={0}>Kullanıcı</option>
              <option value={1}>Yönetici</option>
            </select>
          </Field>
          <Field label="Kullanıcı Adı">
            <input className="input" value={data.username} onChange={(e) => setData({ ...data, username: e.target.value })} required />
          </Field>
          {!editing && (
            <Field label="Şifre">
              <input type="password" minLength={8} className="input" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} required />
            </Field>
          )}
          {editing && (
            <Field label="Şifre">
              {pwOpen ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="password" minLength={8} className="input flex-1" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Yeni şifre (en az 8)" />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={changePw}>Kaydet</button>
                    <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setPwOpen(false)}>İptal</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setPwOpen(true)}>Şifre Değiştir</button>
              )}
            </Field>
          )}
          <Field label="Telefon">
            <input className="input" value={data.phone || ''} onChange={(e) => setData({ ...data, phone: e.target.value })} />
          </Field>
          <Field label="E-Posta">
            <input type="email" className="input" value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} />
          </Field>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {editing ? 'Güncelle' : 'Oluştur'}
            </button>
            <Link to="/users" className="btn-secondary justify-center">İptal</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
