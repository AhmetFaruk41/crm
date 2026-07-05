import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, FileDown, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { Field } from '../components/Field';
import { addDaysISO, formatDate, formatMoney, todayISO, truncate } from '../lib/format';
import type { AgreementRow, Job } from '../types';

const STATUS = [
  { value: 0, label: 'Sözleşme Oluşturuldu', cls: 'badge-neutral' },
  { value: 1, label: 'Sözleşme İletildi', cls: 'badge-warning' },
  { value: 2, label: 'Proje Başlatıldı', cls: 'badge-success' },
  { value: 3, label: 'Proje Tamamlandı', cls: 'badge-success' },
];

export function AgreementsList() {
  const [rows, setRows] = useState<AgreementRow[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      const [r, j] = await Promise.all([api.get<AgreementRow[]>('/agreements'), api.get<Job[]>('/jobs')]);
      setRows(r.data);
      setJobs(j.data);
    } catch {
      setError(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(offerID: number, status: number) {
    await api.put(`/agreements/by-offer-id/${offerID}/status`, { status });
    toast.success('Durum güncellendi');
    load();
  }
  async function del(offerID: number) {
    if (!await confirm({ message: 'Sözleşme silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/agreements/by-offer-id/${offerID}`);
    toast.success('Silindi');
    load();
  }

  const cols: Column<AgreementRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'offerID', header: 'No', sortValue: (r) => r.offerID, render: (r) => `#${r.offerID}` },
    { key: 'agreementStatus', header: 'Durum', render: (r) => (
      <select className="input py-1 text-xs w-full md:w-44" value={r.agreementStatus} onChange={(e) => setStatus(r.offerID, Number(e.target.value))}>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    ) },
    { key: 'agreementType', header: 'Tip', render: (r) => (
      <span className="badge-neutral">{jobs.find((j) => j.id === r.agreementType)?.title ?? '-'}</span>
    ) },
    { key: 'agreementTitle', header: 'Başlık', sortValue: (r) => r.agreementTitle, render: (r) => (
      <div>
        <div className="font-medium">{r.agreementTitle}</div>
        <div className="text-xs text-ink-500">{truncate(r.agreementText, 80)}</div>
      </div>
    ) },
    { key: 'clientTitle', header: 'Müşteri', render: (r) =>
      r.clientID ? <Link to={`/clients/${r.clientID}/edit`} className="hover:underline">{r.clientTitle}</Link> : '-'
    },
    { key: 'price', header: 'Tutar', render: (r) => formatMoney(r.price) },
    { key: 'agreementStartDate', header: 'Başlangıç', sortValue: (r) => r.agreementStartDate, render: (r) => formatDate(r.agreementStartDate) },
    { key: 'agreementEndDate', header: 'Bitiş', sortValue: (r) => r.agreementEndDate, render: (r) => formatDate(r.agreementEndDate) },
    { key: '_actions', header: '', width: '170px', render: (r) => (
      <div className="flex gap-1 flex-wrap">
        <Link to={`/agreements/${r.offerID}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        <a href={`/api/pdf/agreement/${r.offerID}`} target="_blank" rel="noreferrer" className="btn-ghost p-2" title="PDF"><FileDown size={14} /></a>
        <Link to={`/projects/new?offer=${r.offerID}`} className="btn-ghost p-2" title="Projeyi Başlat"><Briefcase size={14} /></Link>
        <button onClick={() => del(r.offerID)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (error) return <ErrorState onRetry={() => { setError(false); load(); }} />;
  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Sözleşmeler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Sözleşmeler' }]}
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.offerID} ${r.agreementTitle} ${r.clientTitle ?? ''}`} />
    </div>
  );
}

export function AgreementForm() {
  const { offerId: paramOfferId } = useParams();
  const [searchParams] = useSearchParams();
  const queryOffer = searchParams.get('offer');
  const offerId = paramOfferId ?? queryOffer;
  const editing = Boolean(paramOfferId);
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [matters, setMatters] = useState<any[]>([]);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(30));

  useEffect(() => {
    if (!offerId) return;
    api.get(`/agreements/by-offer-id/${offerId}`).then((r) => {
      setOffer(r.data.offer);
      setAgreement(r.data.agreement);
      setClient(r.data.client);
      setMatters(r.data.matters);
      setIncluded(new Set(r.data.matters.filter((m: any) => m.included).map((m: any) => m.id)));
      if (r.data.agreement) {
        setTitle(r.data.agreement.agreement_title);
        setStartDate(String(r.data.agreement.start_date).slice(0, 10));
        setEndDate(String(r.data.agreement.end_date).slice(0, 10));
      } else {
        setTitle(r.data.offer.offer_title);
      }
      setLoading(false);
    });
  }, [offerId]);

  function toggle(mid: number) {
    setIncluded((s) => {
      const n = new Set(s);
      if (n.has(mid)) n.delete(mid); else n.add(mid);
      return n;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (included.size === 0) {
      toast.error('En az bir madde seçin');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        offer_id: offer.offer_id,
        agreement_title: title,
        start_date: startDate,
        end_date: endDate,
        included_matter_ids: Array.from(included),
      };
      if (editing && agreement) {
        await api.put(`/agreements/by-offer-id/${offer.offer_id}`, payload);
        toast.success('Sözleşme güncellendi');
      } else {
        await api.post('/agreements', payload);
        toast.success('Sözleşme oluşturuldu');
      }
      nav('/agreements');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!offer) return <div>Teklif bulunamadı</div>;

  const total = matters
    .filter((m) => included.has(m.id))
    .reduce((s, m) => s + Number(m.matter_price) * Number(m.matter_unit || 1), 0);

  return (
    <div>
      <PageHeader
        title={editing ? 'Sözleşme Düzenle' : 'Sözleşme Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Sözleşmeler', to: '/agreements' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <a href={`/api/pdf/offer/${offer.offer_id}`} target="_blank" rel="noreferrer" className="btn-secondary"><FileDown size={14} /> Teklif PDF</a>
            {agreement && <a href={`/api/pdf/agreement/${offer.offer_id}`} target="_blank" rel="noreferrer" className="btn-secondary"><FileDown size={14} /> Sözleşme PDF</a>}
          </div>
        }
      />

      <form onSubmit={submit} className="space-y-4 max-w-5xl">
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Sözleşme Numarası">
                <input className="input" value={offer.offer_id} disabled />
              </Field>
              <Field label="Müşteri">
                <input className="input" value={client?.title ?? '-'} disabled />
              </Field>
              <Field label="Toplam Tutar">
                <input className="input" value={formatMoney(total)} disabled />
              </Field>
            </div>

            <Field label="Sözleşme Başlığı">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Başlangıç Tarihi">
                <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </Field>
              <Field label="Bitiş Tarihi">
                <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {matters.map((m, i) => (
            <div key={m.id} className={`card ${included.has(m.id) ? '' : 'opacity-50'}`}>
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Madde #{i + 1}</h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={included.has(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4" />
                    <span>{included.has(m.id) ? 'Sözleşmeye Dahil' : 'Dahil Değil'}</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Başlık"><input className="input" value={m.matter_title} disabled /></Field>
                  <Field label="Adet · Birim Fiyat">
                    <input className="input" value={`${m.matter_unit} × ${formatMoney(m.matter_price)}`} disabled />
                  </Field>
                </div>
                {m.matter_description && (
                  <div className="mt-3">
                    <div className="text-xs text-ink-500 mb-1">Açıklama</div>
                    <div className="text-sm whitespace-pre-wrap">{m.matter_description}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link to="/agreements" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
          <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>
            {editing ? 'Sözleşmeyi Güncelle' : 'Sözleşmeyi Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}
