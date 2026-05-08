import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, FileDown, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { addDaysISO, formatDate, formatMoney, todayISO } from '../lib/format';
import type { Job, Personel, ProjectRow } from '../types';

const STATUS = [
  { value: 0, label: 'Proje Oluşturuldu' },
  { value: 1, label: 'Proje Tamamlandı' },
];

export function ProjectsList() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  async function load() {
    const [r, j] = await Promise.all([api.get<ProjectRow[]>('/projects'), api.get<Job[]>('/jobs')]);
    setRows(r.data);
    setJobs(j.data);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(offerID: number, status: number) {
    await api.put(`/projects/by-offer-id/${offerID}/status`, { status });
    toast.success('Durum güncellendi');
    load();
  }
  async function del(offerID: number) {
    if (!await confirm({ message: 'Proje silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/projects/by-offer-id/${offerID}`);
    toast.success('Silindi');
    load();
  }

  const cols: Column<ProjectRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'offerID', header: 'No', sortValue: (r) => r.offerID, render: (r) => `#${r.offerID}` },
    { key: 'status', header: 'Durum', render: (r) => (
      <select className="input py-1 text-xs w-full md:w-44" value={r.status} onChange={(e) => setStatus(r.offerID, Number(e.target.value))}>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    ) },
    { key: 'type', header: 'Tip', render: (r) => (
      <span className="badge-neutral">{jobs.find((j) => j.id === r.type)?.title ?? '-'}</span>
    ) },
    { key: 'title', header: 'Başlık', sortValue: (r) => r.title, render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'clientTitle', header: 'Müşteri' },
    { key: 'personelName', header: 'Personel' },
    { key: 'price', header: 'Tutar', render: (r) => formatMoney(r.price) },
    { key: 'projectStartDate', header: 'Başlangıç', render: (r) => formatDate(r.projectStartDate) },
    { key: 'projectEndDate', header: 'Termin', render: (r) => formatDate(r.projectEndDate) },
    { key: '_actions', header: '', width: '170px', render: (r) => (
      <div className="flex gap-1 flex-wrap">
        <Link to={`/billings/${r.offerID}`} className="btn-ghost p-2" title="Ödemeler"><CircleDollarSign size={14} /></Link>
        <Link to={`/projects/${r.offerID}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        <a href={`/api/pdf/agreement/${r.offerID}`} target="_blank" rel="noreferrer" className="btn-ghost p-2" title="PDF"><FileDown size={14} /></a>
        <button onClick={() => del(r.offerID)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader title="Projeler" crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler' }]} />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.offerID} ${r.title} ${r.clientTitle ?? ''} ${r.personelName ?? ''}`} />
    </div>
  );
}

export function ProjectForm() {
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
  const [project, setProject] = useState<any>(null);
  const [personnel, setPersonnel] = useState<Personel[]>([]);
  const [data, setData] = useState({ title: '', personel_id: 0, start_date: todayISO(), end_date: addDaysISO(30), kdv: 20 });

  useEffect(() => {
    if (!offerId) return;
    Promise.all([api.get(`/projects/by-offer-id/${offerId}`), api.get<Personel[]>('/personnel')]).then(([r, p]) => {
      setOffer(r.data.offer);
      setAgreement(r.data.agreement);
      setProject(r.data.project);
      setPersonnel(p.data);
      if (r.data.project) {
        setData({
          title: r.data.project.title,
          personel_id: r.data.project.personel_id,
          start_date: String(r.data.project.start_date).slice(0, 10),
          end_date: String(r.data.project.end_date).slice(0, 10),
          kdv: r.data.project.kdv,
        });
      } else {
        setData((d) => ({ ...d, title: r.data.agreement?.agreement_title ?? r.data.offer?.offer_title ?? '' }));
      }
      setLoading(false);
    });
  }, [offerId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!data.personel_id) {
      toast.error('Personel seçin');
      return;
    }
    setBusy(true);
    try {
      if (editing && project) {
        await api.put(`/projects/by-offer-id/${offer.offer_id}`, data);
        toast.success('Güncellendi');
      } else {
        await api.post('/projects', { offer_id: offer.offer_id, ...data });
        toast.success('Proje oluşturuldu');
      }
      nav('/projects');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!offer) return <div>Teklif bulunamadı</div>;
  if (!editing && !agreement) {
    return (
      <div>
        <PageHeader title="Proje Oluştur" crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler', to: '/projects' }, { label: 'Oluştur' }]} />
        <div className="card card-body">
          <p>Önce sözleşme oluşturmalısınız. <Link to={`/agreements/new?offer=${offer.offer_id}`} className="text-ink-900 underline">Sözleşme oluştur</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={editing ? 'Proje Düzenle' : 'Proje Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler', to: '/projects' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
      />
      <form onSubmit={submit} className="card max-w-3xl">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Proje Numarası">
              <input className="input" value={offer.offer_id} disabled />
            </Field>
            <Field label="Sözleşme Tutarı">
              <input className="input" value={formatMoney(agreement?.price ?? project?.price ?? 0)} disabled />
            </Field>
          </div>
          <Field label="Proje Başlığı">
            <input className="input" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} required />
          </Field>
          <Field label="Personel">
            <select className="input" value={data.personel_id} onChange={(e) => setData({ ...data, personel_id: Number(e.target.value) })} required>
              <option value={0} disabled>Seçiniz</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.fullname}</option>)}
            </select>
          </Field>
          <Field label="KDV (%)">
            <input type="number" className="input" value={data.kdv} onChange={(e) => setData({ ...data, kdv: Number(e.target.value) })} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Başlangıç Tarihi">
              <input type="date" className="input" value={data.start_date} onChange={(e) => setData({ ...data, start_date: e.target.value })} required />
            </Field>
            <Field label="Termin Tarihi">
              <input type="date" className="input" value={data.end_date} onChange={(e) => setData({ ...data, end_date: e.target.value })} required />
            </Field>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Link to="/projects" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
            <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>
              {editing ? 'Güncelle' : 'Projeyi Oluştur'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
