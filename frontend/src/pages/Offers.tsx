import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, FileDown, FilePlus2, RefreshCw, Trash, FileStack, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { addDaysISO, formatDate, formatMoney, todayISO, truncate } from '../lib/format';
import type { Client, Job, OfferMatter, OfferRow, OfferTemplateRow } from '../types';

const STATUS = [
  { value: 0, label: 'Teklif Oluşturuldu', cls: 'badge-neutral' },
  { value: 1, label: 'Teklif İletildi', cls: 'badge-warning' },
  { value: 2, label: 'Teklif Onaylandı', cls: 'badge-success' },
  { value: 3, label: 'Teklif Reddedildi', cls: 'badge-danger' },
];

export function OffersList() {
  const [rows, setRows] = useState<OfferRow[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  async function load() {
    const [r, j] = await Promise.all([api.get<OfferRow[]>('/offers'), api.get<Job[]>('/jobs')]);
    setRows(r.data);
    setJobs(j.data);
  }
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!await confirm({ message: 'Teklif silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/offers/${id}`);
    toast.success('Silindi');
    load();
  }
  async function setStatus(id: number, status: number) {
    await api.put(`/offers/${id}/status`, { status });
    toast.success('Durum güncellendi');
    load();
  }
  async function revise(offerID: number) {
    if (!await confirm({ message: `#${offerID} numaralı teklif revize edilsin mi? (Yeni numara ile kopyalanacak, eski reddedilmiş olarak işaretlenecek)`, confirmLabel: 'Revize Et' })) return;
    const r = await api.post(`/offers/by-offer-id/${offerID}/revise`);
    toast.success('Yeni teklif oluşturuldu');
    window.location.href = `/offers/${r.data.id}/edit`;
  }

  const cols: Column<OfferRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'offerID', header: 'No', sortValue: (r) => r.offerID, render: (r) => (
      <div>
        <div className="font-medium">#{r.offerID}</div>
        {r.mainOfferID && <div className="text-xs text-ink-500">Üst: #{r.mainOfferID}</div>}
      </div>
    ) },
    { key: 'offerStatus', header: 'Durum', sortValue: (r) => r.offerStatus, render: (r) => (
      <select className="input py-1 text-xs w-full md:w-44" value={r.offerStatus} onChange={(e) => setStatus(r.id, Number(e.target.value))}>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    ) },
    { key: 'offerType', header: 'Tip', render: (r) => (
      <span className="badge-neutral">{jobs.find((j) => j.id === r.offerType)?.title ?? '-'}</span>
    ) },
    { key: 'offerTitle', header: 'Başlık', sortValue: (r) => r.offerTitle, render: (r) => (
      <div className="md:max-w-md">
        <div className="font-medium md:truncate">{r.offerTitle}</div>
        <div className="text-xs text-ink-500">{truncate(r.offerText, 100)}</div>
      </div>
    ) },
    { key: 'clientTitle', header: 'Müşteri', render: (r) =>
      r.clientID ? <Link to={`/clients/${r.clientID}/edit`} className="hover:underline">{r.clientTitle}</Link> : <span className="text-ink-400">-</span>
    },
    { key: 'offerDate', header: 'Tarih', sortValue: (r) => r.offerDate, render: (r) => formatDate(r.offerDate) },
    { key: 'offerFinalDate', header: 'Son Tarih', sortValue: (r) => r.offerFinalDate, render: (r) => formatDate(r.offerFinalDate) },
    { key: '_actions', header: '', width: '180px', render: (r) => (
      <div className="flex gap-1 flex-wrap">
        <Link to={`/offers/${r.id}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        <a href={`/api/pdf/offer/${r.offerID}`} target="_blank" rel="noreferrer" className="btn-ghost p-2" title="PDF"><FileDown size={14} /></a>
        <Link to={`/agreements/new?offer=${r.offerID}`} className="btn-ghost p-2" title="Sözleşme Oluştur"><FilePlus2 size={14} /></Link>
        <button onClick={() => revise(r.offerID)} className="btn-ghost p-2" title="Revize Et"><RefreshCw size={14} /></button>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Teklifler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Teklifler' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/offer-templates" className="btn-secondary"><FileStack size={16} /> Şablonlar</Link>
            <Link to="/offers/new" className="btn-primary"><Plus size={16} /> Yeni Teklif</Link>
          </div>
        }
      />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.offerID} ${r.offerTitle} ${r.clientTitle ?? ''} ${r.offerText ?? ''}`} />
    </div>
  );
}

function emptyMatter(): OfferMatter {
  return { matter_title: '', matter_description: '', matter_extra: '', matter_unit: 1, matter_old_price: 0, matter_price: 0 };
}

export function OfferForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get('template');
  const leadIdParam = searchParams.get('lead');
  const clientIdParam = searchParams.get('client');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<OfferTemplateRow[]>([]);
  const [offerNum, setOfferNum] = useState<number>(0);
  const [data, setData] = useState({
    client_id: 0,
    offer_type: 0,
    offer_title: '',
    offer_text: '',
    offer_date: todayISO(),
    final_date: addDaysISO(15),
  });
  const [matters, setMatters] = useState<OfferMatter[]>([emptyMatter()]);
  const [offerStatus, setOfferStatus] = useState(0);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');

  async function applyTemplate(templateId: number) {
    try {
      const r = await api.get(`/offer-templates/${templateId}`);
      const t = r.data.template;
      setData((d) => ({
        ...d,
        offer_type: t.offer_type ?? d.offer_type,
        offer_title: t.default_offer_title || d.offer_title,
        offer_text: t.default_offer_text || d.offer_text,
        final_date: addDaysISO(Number(t.default_validity_days) || 15),
      }));
      const tplMatters: OfferMatter[] = (r.data.matters ?? []).map((m: any) => ({
        matter_title: m.matter_title,
        matter_description: m.matter_description ?? '',
        matter_extra: m.matter_extra ?? '',
        matter_unit: Number(m.matter_unit) || 1,
        matter_old_price: m.matter_old_price ?? 0,
        matter_price: Number(m.matter_price) || 0,
      }));
      setMatters(tplMatters.length ? tplMatters : [emptyMatter()]);
      toast.success(`"${t.title}" şablonu uygulandı`);
    } catch {
      toast.error('Şablon yüklenemedi');
    }
  }

  useEffect(() => {
    (async () => {
      const [jr, cr, tr] = await Promise.all([
        api.get<Job[]>('/jobs'),
        api.get<Client[]>('/clients'),
        api.get<OfferTemplateRow[]>('/offer-templates'),
      ]);
      setJobs(jr.data);
      setClients(cr.data);
      setTemplates(tr.data.filter((t) => t.isActive));
      if (!editing) {
        const nr = await api.get<{ next: number }>('/offers/next-id');
        setOfferNum(nr.data.next);
        if (clientIdParam) {
          setData((d) => ({ ...d, client_id: Number(clientIdParam) }));
        }
        if (templateIdParam) {
          await applyTemplate(Number(templateIdParam));
        }
      } else {
        const or = await api.get(`/offers/by-row/${id}`);
        const o = or.data.offer;
        setOfferNum(o.offer_id);
        setOfferStatus(o.offer_status);
        setData({
          client_id: o.client_id,
          offer_type: o.offer_type,
          offer_title: o.offer_title,
          offer_text: o.offer_text ?? '',
          offer_date: String(o.offer_date).slice(0, 10),
          final_date: String(o.final_date).slice(0, 10),
        });
        setMatters(or.data.matters.length ? or.data.matters : [emptyMatter()]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing, templateIdParam, clientIdParam]);

  async function saveAsTemplate() {
    if (!tplName.trim()) {
      toast.error('Şablon adı zorunlu');
      return;
    }
    if (!editing) {
      toast.error('Önce teklifi kaydedin');
      return;
    }
    try {
      await api.post(`/offer-templates/from-offer/${id}`, {
        title: tplName.trim(),
        description: tplDesc.trim(),
      });
      toast.success('Şablon oluşturuldu');
      setShowSaveTemplate(false);
      setTplName('');
      setTplDesc('');
    } catch {
      /* error handled by interceptor */
    }
  }

  const total = useMemo(() => matters.reduce((s, m) => s + Number(m.matter_price || 0) * Number(m.matter_unit || 1), 0), [matters]);

  function setMatter(i: number, patch: Partial<OfferMatter>) {
    setMatters((arr) => arr.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMatter() {
    setMatters((arr) => [...arr, emptyMatter()]);
  }
  function delMatter(i: number) {
    setMatters((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  async function setStatus(s: number) {
    await api.put(`/offers/${id}/status`, { status: s });
    setOfferStatus(s);
    toast.success('Durum güncellendi');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!data.offer_type) {
      toast.error('Teklif tipi seçin');
      return;
    }
    if (matters.some((m) => !m.matter_title || !m.matter_price)) {
      toast.error('Madde başlığı ve fiyatı zorunlu');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/offers/${id}`, { ...data, matters });
        toast.success('Güncellendi');
      } else {
        await api.post('/offers', { ...data, lead_id: leadIdParam ? Number(leadIdParam) : null, offer_id: offerNum, matters });
        toast.success('Oluşturuldu');
      }
      nav('/offers');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Teklif Düzenle' : 'Teklif Oluştur'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Teklifler', to: '/offers' }, { label: editing ? 'Düzenle' : 'Oluştur' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {editing && (
              <button type="button" onClick={() => setShowSaveTemplate((v) => !v)} className="btn-secondary">
                <Save size={14} /> Şablon Olarak Kaydet
              </button>
            )}
            {editing && (
              <a href={`/api/pdf/offer/${offerNum}`} target="_blank" rel="noreferrer" className="btn-secondary">
                <FileDown size={14} /> PDF
              </a>
            )}
          </div>
        }
      />
      {showSaveTemplate && editing && (
        <div className="card mb-4 max-w-5xl">
          <div className="card-body space-y-3">
            <div className="flex items-center gap-2">
              <FileStack size={16} className="text-ink-700" />
              <h4 className="font-semibold">Bu Teklifi Şablon Olarak Kaydet</h4>
            </div>
            <p className="text-sm text-ink-500">Bu teklifin tüm maddeleri ve içeriği yeni bir şablon olarak kaydedilir.</p>
            <Field label="Şablon Adı">
              <input
                className="input"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Örn: Sunucu Hizmeti, Kurumsal Web Sitesi"
              />
            </Field>
            <Field label="Açıklama (opsiyonel)">
              <textarea
                rows={2}
                className="input"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                placeholder="Bu şablonun ne için kullanılacağı"
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowSaveTemplate(false)} className="btn-secondary">İptal</button>
              <button type="button" onClick={saveAsTemplate} className="btn-primary">Şablonu Kaydet</button>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 max-w-5xl">
        {!editing && templates.length > 0 && (
          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-2">
                <FileStack size={16} className="text-ink-700" />
                <h4 className="font-semibold">Şablondan Başla</h4>
                <span className="text-xs text-ink-500">(opsiyonel)</span>
              </div>
              <p className="text-xs text-ink-500 mb-3">Bir şablon seçerek formu hızlıca doldurabilirsiniz. Sonrasında istediğiniz değişikliği yapabilirsiniz.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="input flex-1"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      applyTemplate(Number(v));
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Şablon seçin...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}{t.offerTypeTitle ? ` — ${t.offerTypeTitle}` : ''} ({t.matterCount} madde)
                    </option>
                  ))}
                </select>
                <Link to="/offer-templates" className="btn-secondary">
                  Şablonları Yönet
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Teklif Numarası">
                <input className="input" value={offerNum} onChange={(e) => setOfferNum(Number(e.target.value))} required disabled={editing} />
              </Field>
              <Field label="Teklif Tipi">
                <select className="input" value={data.offer_type} onChange={(e) => setData({ ...data, offer_type: Number(e.target.value) })} required>
                  <option value={0} disabled>Seçiniz</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </Field>
            </div>

            {editing && (
              <Field label="Teklif Durumu">
                <select className="input md:max-w-sm" value={offerStatus} onChange={(e) => setStatus(Number(e.target.value))}>
                  {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            )}

            <Field label="Firma/Yetkili - Başlık">
              <input className="input" value={data.offer_title} onChange={(e) => setData({ ...data, offer_title: e.target.value })} required />
            </Field>
            <Field label="İşin Adı/Açıklama">
              <textarea rows={3} className="input" value={data.offer_text} onChange={(e) => setData({ ...data, offer_text: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Teklif Başlangıç Tarihi">
                <input type="date" className="input" value={data.offer_date} onChange={(e) => setData({ ...data, offer_date: e.target.value })} required />
              </Field>
              <Field label="Son Geçerlilik Tarihi">
                <input type="date" className="input" value={data.final_date} onChange={(e) => setData({ ...data, final_date: e.target.value })} required />
              </Field>
            </div>

            <Field label="Müşteri">
              <select className="input" value={data.client_id} onChange={(e) => setData({ ...data, client_id: Number(e.target.value) })} required>
                <option value={0}>Müşteri Yok</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          {matters.map((m, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Teklif Maddesi #{i + 1}</h4>
                  <button type="button" onClick={() => delMatter(i)} className="btn-ghost text-red-600 p-1.5" disabled={matters.length <= 1}>
                    <Trash size={14} /> Sil
                  </button>
                </div>
                <div className="space-y-3">
                  <Field label="Başlık">
                    <input className="input" value={m.matter_title} onChange={(e) => setMatter(i, { matter_title: e.target.value })} required />
                  </Field>
                  <Field label="Açıklama">
                    <textarea rows={3} className="input" value={m.matter_description} onChange={(e) => setMatter(i, { matter_description: e.target.value })} />
                  </Field>
                  <Field label="Ekstra (PDF'e ek sayfa olarak çıkar)">
                    <textarea rows={2} className="input" value={m.matter_extra ?? ''} onChange={(e) => setMatter(i, { matter_extra: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Adet">
                      <input type="number" min={1} className="input" value={m.matter_unit} onChange={(e) => setMatter(i, { matter_unit: Number(e.target.value) })} required />
                    </Field>
                    <Field label="İlk Fiyat (üzeri çizilir, 0 ise gizli)">
                      <input type="number" step="any" min={0} className="input" value={m.matter_old_price ?? 0} onChange={(e) => setMatter(i, { matter_old_price: Number(e.target.value) })} />
                    </Field>
                    <Field label="Fiyat">
                      <input type="number" step="any" min={0} className="input" value={m.matter_price} onChange={(e) => setMatter(i, { matter_price: Number(e.target.value) })} required />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button type="button" onClick={addMatter} className="btn-secondary w-full sm:w-auto"><Plus size={14} /> Madde Ekle</button>
          <div className="text-sm text-ink-600">
            Toplam: <span className="font-semibold text-ink-900">{formatMoney(total)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link to="/offers" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
          <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>
            {editing ? 'Güncelle' : 'Teklifi Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}
