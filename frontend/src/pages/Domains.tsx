import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, BadgeDollarSign, RotateCcw, Search,
  Globe, AlertTriangle, Hourglass, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { formatDate } from '../lib/format';
import type { DomainPricing, DomainRow } from '../types';

const RENEWAL_SOON_DAYS = 30;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const d = new Date(text + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function nextRenewalDate(row: { expires_at?: string | null; create_date?: string | null }): Date | null {
  const explicit = parseDate(row.expires_at);
  if (explicit) return explicit;
  const base = parseDate(row.create_date);
  if (!base) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(base);
  next.setFullYear(today.getFullYear());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

type FilterKey = 'all' | 'customer' | 'pending' | 'soon' | 'inactive';

export function DomainsList() {
  const [rows, setRows] = useState<DomainRow[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

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
  async function markPending(id: number) {
    if (!await confirm({ message: 'Yenileme bekliyor durumuna alınsın mı?', confirmLabel: 'Evet' })) return;
    await api.put(`/domains/${id}/unpay`);
    toast.success('Yenileme bekliyor olarak işaretlendi');
    load();
  }
  async function del(id: number) {
    if (!await confirm({ message: 'Domain silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/domains/${id}`);
    toast.success('Silindi');
    load();
  }

  const enriched = useMemo(() => (rows ?? []).map((r) => {
    const renewal = nextRenewalDate(r);
    const days = renewal ? daysUntil(renewal) : null;
    const renewalSource: 'explicit' | 'anniversary' | 'none' = r.expires_at ? 'explicit' : (renewal ? 'anniversary' : 'none');
    return { ...r, _renewal: renewal, _days: days, _renewalSource: renewalSource };
  }), [rows]);

  const summary = useMemo(() => {
    const customers = enriched.filter((r) => r.status === 1);
    const paying = customers.filter((r) => r.pay_status === 1);
    const pending = customers.filter((r) => r.pay_status === 0);
    const soon = customers.filter((r) => r._days !== null && r._days <= RENEWAL_SOON_DAYS);
    const revenue = customers.reduce((sum, r) => sum + Number(r.full_price ?? 0), 0);
    return {
      customers: customers.length,
      paying: paying.length,
      pending: pending.length,
      soon: soon.length,
      inactive: enriched.length - customers.length,
      revenue,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'customer') list = list.filter((r) => r.status === 1);
    else if (filter === 'pending') list = list.filter((r) => r.status === 1 && r.pay_status === 0);
    else if (filter === 'soon') list = list.filter((r) => r.status === 1 && r._days !== null && r._days <= RENEWAL_SOON_DAYS);
    else if (filter === 'inactive') list = list.filter((r) => r.status === 0);
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      list = list.filter((r) => `${r.name} ${r.fullname ?? ''} ${r.email ?? ''} ${r.phone ?? ''}`.toLocaleLowerCase('tr-TR').includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a._renewal?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bv = b._renewal?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return av - bv;
    });
  }, [enriched, filter, search]);

  type EnrichedRow = (typeof enriched)[number];

  function renewalBadge(r: EnrichedRow) {
    if (r.status !== 1 || !r._renewal || r._days === null) return null;
    if (r._days < 0) return <span className="badge-danger ml-2">Yenileme gecikti</span>;
    if (r._days === 0) return <span className="badge-warning ml-2">Bugün yenilenecek</span>;
    if (r._days <= RENEWAL_SOON_DAYS) return <span className="badge-warning ml-2">{r._days} gün kaldı</span>;
    return null;
  }

  const cols: Column<EnrichedRow>[] = [
    { key: 'name', header: 'Domain', sortValue: (r) => r.name, render: (r) => (
      <div className="min-w-0">
        <a href={`https://${r.name}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline break-all">{r.name}</a>
        {Number(r.sub_domain) > 0 && <div className="text-xs text-ink-500">{r.sub_domain} alt domain</div>}
      </div>
    ) },
    { key: 'subscription', header: 'Abonelik', render: (r) => (
      <div>
        <div>{r.sub_title ?? '-'}</div>
        {r.full_price && <div className="text-xs text-ink-500">{r.full_price}$/yıl</div>}
      </div>
    ) },
    { key: 'registrar', header: 'Sağlayıcı', render: (r) => (
      <div>
        <div>{r.registrar || <span className="text-ink-400">-</span>}</div>
        {r.registrar_account && <div className="text-xs text-ink-500 break-all">{r.registrar_account}</div>}
        {Number(r.auto_renew) === 1 && <span className="badge-success text-[10px] mt-1">Otomatik yenileme</span>}
      </div>
    ) },
    { key: 'create_date', header: 'Kurulum', sortValue: (r) => r.create_date, render: (r) => formatDate(r.create_date) },
    { key: '_renewal', header: 'Sonraki Yenileme', sortValue: (r) => r._renewal?.getTime() ?? Number.MAX_SAFE_INTEGER, render: (r) => (
      r.status === 1 && r._renewal
        ? (
          <div>
            {formatDate(r._renewal.toISOString().slice(0, 10))}
            {renewalBadge(r)}
            {r._renewalSource === 'anniversary' && (
              <div className="text-[10px] text-ink-400 mt-0.5">kurulumdan tahmini</div>
            )}
          </div>
        )
        : <span className="text-ink-400">-</span>
    ) },
    { key: 'fullname', header: 'Yetkili', render: (r) => (
      <div className="min-w-0">
        <div>{r.fullname || '-'}</div>
        {r.phone && <div className="text-xs text-ink-500">{r.phone}</div>}
      </div>
    ) },
    { key: 'status', header: 'Durum', render: (r) => (
      <span className={r.status === 1 ? (r.pay_status === 1 ? 'badge-success' : 'badge-warning') : 'badge-neutral'}>
        {r.status === 1 ? (r.pay_status === 1 ? 'Müşteri · Ödendi' : 'Müşteri · Ödeme Bekliyor') : 'Müşteri Değil'}
      </span>
    ) },
    { key: '_actions', header: '', width: '180px', render: (r) => (
      <div className="flex gap-1">
        {r.status === 1 && r.pay_status === 0 && (
          <button onClick={() => pay(r.id)} className="btn-ghost p-2 text-emerald-700" title="Ödendi olarak işaretle"><BadgeDollarSign size={14} /></button>
        )}
        {r.status === 1 && r.pay_status === 1 && (
          <button onClick={() => markPending(r.id)} className="btn-ghost p-2 text-amber-600" title="Yenileme bekliyor moduna al"><RotateCcw size={14} /></button>
        )}
        <Link to={`/domains/${r.id}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: enriched.length },
    { key: 'customer', label: 'Müşteri', count: summary.customers },
    { key: 'pending', label: 'Ödeme Bekliyor', count: summary.pending },
    { key: 'soon', label: 'Yenileme Yakın', count: summary.soon },
    { key: 'inactive', label: 'Müşteri Değil', count: summary.inactive },
  ];

  if (!rows) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Domainler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Domainler' }]}
        actions={<Link to="/domains/new" className="btn-primary"><Plus size={16} /> Yeni Domain</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="card card-body">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Aktif Müşteri</div>
              <div className="text-2xl sm:text-3xl font-semibold mt-1">{summary.customers}</div>
              <div className="text-xs text-ink-500 mt-1">{summary.paying} ödenmiş</div>
            </div>
            <div className="h-10 w-10 grid place-items-center rounded-full bg-ink-100 text-ink-700 shrink-0"><Globe size={18} /></div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Yenileme Yakın</div>
              <div className="text-2xl sm:text-3xl font-semibold mt-1 text-amber-600">{summary.soon}</div>
              <div className="text-xs text-ink-500 mt-1">{RENEWAL_SOON_DAYS} gün içinde</div>
            </div>
            <div className="h-10 w-10 grid place-items-center rounded-full bg-amber-50 text-amber-700 shrink-0"><AlertTriangle size={18} /></div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Ödeme Bekliyor</div>
              <div className="text-2xl sm:text-3xl font-semibold mt-1">{summary.pending}</div>
              <div className="text-xs text-ink-500 mt-1">tahsil edilmemiş</div>
            </div>
            <div className="h-10 w-10 grid place-items-center rounded-full bg-ink-100 text-ink-700 shrink-0"><Hourglass size={18} /></div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Yıllık Gelir</div>
              <div className="text-2xl sm:text-3xl font-semibold mt-1">{summary.revenue}<span className="text-base text-ink-500 ml-0.5">$</span></div>
              <div className="text-xs text-ink-500 mt-1">listelenen müşterilerden</div>
            </div>
            <div className="h-10 w-10 grid place-items-center rounded-full bg-emerald-50 text-emerald-700 shrink-0"><DollarSign size={18} /></div>
          </div>
        </div>
      </div>

      <div className="card card-body mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap gap-2 flex-1">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
                  filter === t.key
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
                }`}
              >
                {t.label}
                <span className={`text-xs rounded-md px-1.5 py-0.5 ${filter === t.key ? 'bg-white/15' : 'bg-ink-100 text-ink-600'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="md:w-72">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="Domain, yetkili, e-posta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <DataTable
        rows={filtered}
        columns={cols}
        rowKey={(r) => r.id}
      />
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
    expires_at: '',
    status: 1,
    subscription: 1,
    registrar: '',
    registrar_account: '',
    auto_renew: 0,
    notes: '',
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
          expires_at: r.data.expires_at ? String(r.data.expires_at).slice(0, 10) : '',
          registrar: r.data.registrar ?? '',
          registrar_account: r.data.registrar_account ?? '',
          auto_renew: Number(r.data.auto_renew ?? 0),
          notes: r.data.notes ?? '',
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Kurulum Tarihi">
              <input type="date" className="input" value={d.create_date} onChange={(e) => setD({ ...d, create_date: e.target.value })} disabled={editing} />
            </Field>
            <Field label="Bitiş Tarihi">
              <input type="date" className="input" value={d.expires_at || ''} onChange={(e) => setD({ ...d, expires_at: e.target.value })} />
            </Field>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sağlayıcı (Registrar)">
              <input
                className="input"
                list="domain-registrars"
                value={d.registrar || ''}
                onChange={(e) => setD({ ...d, registrar: e.target.value })}
                placeholder="Ör. NameCheap, GoDaddy, Natro"
              />
              <datalist id="domain-registrars">
                <option value="NameCheap" />
                <option value="GoDaddy" />
                <option value="Natro" />
                <option value="Hosting.com.tr" />
                <option value="Turhost" />
                <option value="İsim Tescil" />
                <option value="Cloudflare" />
              </datalist>
            </Field>
            <Field label="Sağlayıcı Hesabı / E-posta">
              <input
                className="input"
                value={d.registrar_account || ''}
                onChange={(e) => setD({ ...d, registrar_account: e.target.value })}
                placeholder="Hesabın kayıtlı olduğu e-posta"
              />
            </Field>
          </div>
          <Field label="Otomatik Yenileme">
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Number(d.auto_renew) === 1}
                onChange={(e) => setD({ ...d, auto_renew: e.target.checked ? 1 : 0 })}
              />
              Sağlayıcı tarafında otomatik yenileme açık
            </label>
          </Field>
          <Field label="Yetkili Kişi">
            <input className="input" value={d.fullname || ''} onChange={(e) => setD({ ...d, fullname: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telefon">
              <input className="input" value={d.phone || ''} onChange={(e) => setD({ ...d, phone: e.target.value })} />
            </Field>
            <Field label="E-Posta">
              <input type="email" className="input" value={d.email || ''} onChange={(e) => setD({ ...d, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Notlar">
            <textarea
              className="input min-h-20"
              value={d.notes || ''}
              onChange={(e) => setD({ ...d, notes: e.target.value })}
              placeholder="DNS ayarları, panel linki, özel notlar..."
            />
          </Field>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Link to="/domains" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
            <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>{editing ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
