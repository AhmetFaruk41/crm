import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, BadgeDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { formatDate } from '../lib/format';
import type { DomainPricing, DomainRow } from '../types';

export function DomainsList() {
  const [rows, setRows] = useState<DomainRow[] | null>(null);

  async function load() {
    const r = await api.get<DomainRow[]>('/domains');
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);

  async function pay(id: number) {
    if (!await confirm({ message: 'Ödeme yapıldı olarak işaretlensin mi?', confirmLabel: 'Evet' })) return;
    await api.put(`/domains/${id}/pay`);
    toast.success('Ödeme işaretlendi');
    load();
  }
  async function del(id: number) {
    if (!await confirm({ message: 'Domain silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/domains/${id}`);
    toast.success('Silindi');
    load();
  }

  const cols: Column<DomainRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'name', header: 'Domain', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'sub_domain', header: 'Sub Domain', render: (r) => Number(r.sub_domain) || '-' },
    { key: 'create_date', header: 'Kurulum', sortValue: (r) => r.create_date, render: (r) => formatDate(r.create_date) },
    { key: 'subscription', header: 'Abonelik', render: (r) => (
      <div>
        <div>{r.sub_title ?? '-'}</div>
        {r.full_price && <div className="text-xs text-ink-500">{r.full_price}$/yıl</div>}
      </div>
    ) },
    { key: 'fullname', header: 'Yetkili', render: (r) => r.fullname || '-' },
    { key: 'phone', header: 'Telefon', render: (r) => r.phone || '-' },
    { key: 'status', header: 'Durum', render: (r) => (
      <span className={r.status === 1 ? (r.pay_status === 1 ? 'badge-success' : 'badge-warning') : 'badge-neutral'}>
        {r.status === 1 ? (r.pay_status === 1 ? 'Müşteri · Ödendi' : 'Müşteri · Ödeme Bekliyor') : 'Müşteri Değil'}
      </span>
    ) },
    { key: '_actions', header: '', width: '160px', render: (r) => (
      <div className="flex gap-1">
        {r.status === 1 && r.pay_status === 0 && (
          <button onClick={() => pay(r.id)} className="btn-ghost p-2 text-emerald-700" title="Ödeme"><BadgeDollarSign size={14} /></button>
        )}
        <Link to={`/domains/${r.id}/edit`} className="btn-ghost p-2"><Pencil size={14} /></Link>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Domainler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Domainler' }]}
        actions={<Link to="/domains/new" className="btn-primary"><Plus size={16} /> Yeni Domain</Link>}
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.name} ${r.fullname ?? ''} ${r.email ?? ''}`} />
    </div>
  );
}

export function DomainForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState<DomainPricing[]>([]);
  const [d, setD] = useState<any>({
    name: '',
    create_date: new Date().toISOString().slice(0, 10),
    status: 1,
    subscription: 1,
    fullname: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    api.get<DomainPricing[]>('/domains/pricing').then(async (pr) => {
      setPricing(pr.data);
      if (pr.data[0]) setD((s: any) => ({ ...s, subscription: pr.data[0].id }));
      if (editing) {
        const r = await api.get(`/domains/${id}`);
        setD({
          ...r.data,
          create_date: String(r.data.create_date).slice(0, 10),
        });
      }
      setLoading(false);
    });
  }, [id, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/domains/${id}`, d);
        toast.success('Güncellendi');
      } else {
        await api.post('/domains', d);
        toast.success('Oluşturuldu');
      }
      nav('/domains');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Domain Düzenle' : 'Domain Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Domainler', to: '/domains' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
      />
      <form onSubmit={submit} className="card max-w-3xl">
        <div className="card-body space-y-4">
          <Field label="Domain Adı">
            <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required disabled={editing} />
          </Field>
          <Field label="Kurulum Tarihi">
            <input type="date" className="input" value={d.create_date} onChange={(e) => setD({ ...d, create_date: e.target.value })} disabled={editing} />
          </Field>
          <Field label="Müşteri mi?">
            <select className="input" value={d.status} onChange={(e) => setD({ ...d, status: Number(e.target.value) })}>
              <option value={1}>Müşteri</option>
              <option value={0}>Müşteri Değil</option>
            </select>
          </Field>
          <Field label="Abonelik">
            <select className="input" value={d.subscription} onChange={(e) => setD({ ...d, subscription: Number(e.target.value) })}>
              {pricing.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.full_price}$/yıl)</option>)}
            </select>
          </Field>
          <Field label="Yetkili Kişi">
            <input className="input" value={d.fullname || ''} onChange={(e) => setD({ ...d, fullname: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className="input" value={d.phone || ''} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          </Field>
          <Field label="E-Posta">
            <input type="email" className="input" value={d.email || ''} onChange={(e) => setD({ ...d, email: e.target.value })} />
          </Field>
          <div className="flex gap-2 justify-end">
            <Link to="/domains" className="btn-secondary">İptal</Link>
            <button type="submit" className="btn-primary" disabled={busy}>{editing ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
