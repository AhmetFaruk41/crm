import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CalendarClock, Columns3, ExternalLink, Flame, Globe, List, Mail, MapPin, MessageSquarePlus, Pencil, Phone, Plus, Search, Star, Trash2, UserRoundPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { Field, FieldRow } from '../components/Field';
import Loading from '../components/Loading';
import { confirm } from '../components/ConfirmDialog';
import { formatDate, formatDateTime, formatMoney, todayISO } from '../lib/format';
import type { LeadActivity, LeadOffer, LeadRow } from '../types';

export const LEAD_STAGES = [
  { value: 'new', label: 'Yeni Aday' },
  { value: 'contacted', label: 'İlk Temas' },
  { value: 'meeting', label: 'İhtiyaç Görüşmesi' },
  { value: 'proposal_preparing', label: 'Teklif Hazırlanıyor' },
  { value: 'offer_sent', label: 'Teklif Gönderildi' },
  { value: 'follow_up', label: 'Takip Bekleniyor' },
  { value: 'won', label: 'Kazanıldı' },
  { value: 'lost', label: 'Kaybedildi' },
];

const TEMPERATURES = [
  { value: 'hot', label: 'Sıcak', cls: 'badge-danger' },
  { value: 'warm', label: 'Ilık', cls: 'badge-warning' },
  { value: 'cold', label: 'Soğuk', cls: 'badge-neutral' },
];

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Telefon Görüşmesi' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-Posta' },
  { value: 'meeting', label: 'Toplantı' },
  { value: 'form_sent', label: 'Bilgi Formu Gönderildi' },
  { value: 'note', label: 'Not' },
];

const SOURCES = ['Referans', 'Instagram', 'Google', 'Web Formu', 'Mevcut Müşteri', 'Soğuk İletişim', 'Diğer'];
const SERVICES = ['Web Sitesi', 'E-Ticaret', 'Özel Yazılım', 'Mobil Uygulama', 'SEO', 'Bakım / Destek', 'Hosting / Domain'];
const OPPORTUNITY_LABELS: Record<string, string> = {
  needs_ssl: 'SSL / Güvenli Site',
  needs_website: 'Yeni Web Sitesi',
  needs_modern_site: 'Site Yenileme',
  needs_corporate_email: 'Kurumsal E-Posta',
  appointment: 'Randevu Sistemi',
  patient_mgmt: 'Hasta Yönetimi',
  before_after_portal: 'Önce / Sonra Portalı',
  membership: 'Üyelik Sistemi',
  membership_app: 'Üyelik Uygulaması',
  online_order: 'Online Sipariş',
  order_tracking: 'Sipariş Takibi',
  reservation: 'Rezervasyon',
  loyalty_app: 'Sadakat Uygulaması',
  menu_qr: 'QR Menü',
  erp_lite: 'Temel ERP',
};

interface ImportedLeadDetails {
  importInfo: string;
  sector: string;
  search: string;
  location: string;
  address: string;
  rating: string;
  reviewCount: string;
  score: string;
  website: string;
  https: string;
  reachable: string;
  rawEmails: string;
  opportunities: string[];
  mapsUrl: string;
}

function parseImportedNotes(notes?: string | null): ImportedLeadDetails | null {
  if (!notes?.startsWith('CSV içe aktarma:')) return null;
  const lines = notes.split('\n');
  const getValue = (prefix: string) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
  const sectorLine = getValue('Sektör: ');
  const ratingLine = getValue('Google puanı: ');
  const websiteLine = getValue('Web sitesi: ');
  const [sector = '', search = ''] = sectorLine.split(' | Arama: ');
  const [ratingPart = '', score = ''] = ratingLine.split(' | Lead skoru: ');
  const ratingMatch = ratingPart.match(/^(.+?) \((.+?) yorum\)$/);
  const [website = '', https = '', reachable = ''] = websiteLine.split(' | ').map((part) => part.replace(/^(HTTPS|Erişilebilir): /, ''));
  const opportunities = getValue('Fırsatlar: ').split(',').map((value) => value.trim()).filter(Boolean);
  return {
    importInfo: lines[0].replace('CSV içe aktarma: ', ''),
    sector,
    search,
    location: getValue('Konum: '),
    address: getValue('Adres: '),
    rating: ratingMatch?.[1] ?? ratingPart,
    reviewCount: ratingMatch?.[2] ?? '',
    score,
    website,
    https,
    reachable,
    rawEmails: getValue('Bulunan e-postalar (ham veri): '),
    opportunities,
    mapsUrl: getValue('Google Maps: '),
  };
}

function stageLabel(value: string): string {
  return LEAD_STAGES.find((item) => item.value === value)?.label ?? value;
}

function stageBadge(value: string): string {
  if (value === 'won') return 'badge-success';
  if (value === 'lost') return 'badge-danger';
  if (value === 'offer_sent' || value === 'follow_up') return 'badge-warning';
  return 'badge-neutral';
}

function temperatureBadge(value: string): { label: string; cls: string } {
  return TEMPERATURES.find((item) => item.value === value) ?? TEMPERATURES[1];
}

function isOverdue(lead: LeadRow): boolean {
  return Boolean(
    lead.next_follow_up_date
    && lead.next_follow_up_date < todayISO()
    && !['won', 'lost'].includes(lead.stage)
  );
}

const KANBAN_CARD_LIMIT = 40;

function leadSector(lead: LeadRow): string {
  const detailSector = parseImportedNotes(lead.notes)?.sector;
  if (detailSector) return detailSector;
  const previewMatch = lead.notes_preview?.match(/Sektör: (.*?)(?: \| Arama:|$)/);
  return previewMatch?.[1] || lead.service_interest || 'Hizmet bilgisi yok';
}

function LeadKanbanCard({ lead, onStageChange }: { lead: LeadRow; onStageChange: (lead: LeadRow, stage: string) => void }) {
  const temp = temperatureBadge(lead.temperature);
  return (
    <article
      className="bg-white border border-ink-200 rounded-lg p-3 shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/lead-id', String(lead.id))}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/leads/${lead.id}`} className="font-medium text-sm hover:underline leading-snug">{lead.company_name}</Link>
        <span className={`${temp.cls} shrink-0`}>{temp.label}</span>
      </div>
      <div className="text-xs text-ink-500 mt-1">{leadSector(lead)}</div>
      <div className="space-y-1 mt-3 text-xs text-ink-600">
        {lead.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {lead.phone}</div>}
        {lead.email && <div className="flex items-center gap-1.5 min-w-0"><Mail size={12} className="shrink-0" /><span className="truncate">{lead.email}</span></div>}
        {lead.next_follow_up_date && (
          <div className={`flex items-center gap-1.5 ${isOverdue(lead) ? 'text-red-600 font-medium' : ''}`}>
            <CalendarClock size={12} /> {formatDate(lead.next_follow_up_date)}{isOverdue(lead) ? ' - gecikti' : ''}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-ink-100">
        {lead.estimated_value != null ? <div className="text-xs font-medium">{formatMoney(lead.estimated_value)}</div> : <div className="text-xs text-ink-400">Tutar yok</div>}
        <Link to={`/leads/${lead.id}`} className="text-xs text-ink-600 hover:underline">Detay</Link>
      </div>
      <select
        className="input py-1.5 text-xs mt-3"
        aria-label={`${lead.company_name} satış aşaması`}
        value={lead.stage}
        onChange={(event) => onStageChange(lead, event.target.value)}
        onClick={(event) => event.stopPropagation()}
      >
        {LEAD_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
      </select>
    </article>
  );
}

export function LeadsList() {
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [temperature, setTemperature] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [source, setSource] = useState('');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  async function load() {
    const r = await api.get<LeadRow[]>('/leads');
    setRows(r.data);
  }

  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!await confirm({ message: 'Potansiyel müşteri kaydı silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/leads/${id}`);
    toast.success('Kayıt silindi');
    load();
  }

  async function changeStage(lead: LeadRow, nextStage: string) {
    if (nextStage === lead.stage) return;
    let lostReason: string | undefined;
    if (nextStage === 'lost') {
      const reason = window.prompt('Bu fırsat neden kaybedildi?');
      if (!reason?.trim()) return;
      lostReason = reason.trim();
    }
    await api.put(`/leads/${lead.id}/stage`, { stage: nextStage, lost_reason: lostReason });
    setRows((current) => current?.map((row) => row.id === lead.id
      ? { ...row, stage: nextStage, lost_reason: nextStage === 'lost' ? lostReason ?? null : null }
      : row) ?? null);
    toast.success(`"${lead.company_name}" ${stageLabel(nextStage)} aşamasına taşındı`);
  }

  async function dropLead(event: DragEvent<HTMLDivElement>, targetStage: string) {
    event.preventDefault();
    setDragOverStage(null);
    const id = Number(event.dataTransfer.getData('text/lead-id'));
    const lead = rows?.find((row) => row.id === id);
    if (lead) await changeStage(lead, targetStage);
  }

  const sources = useMemo(() => Array.from(new Set((rows ?? []).map((row) => row.source).filter(Boolean) as string[])).sort(), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((lead) => {
    if (stage && lead.stage !== stage) return false;
    if (temperature && lead.temperature !== temperature) return false;
    if (source && lead.source !== source) return false;
    if (followUp === 'today' && lead.next_follow_up_date !== todayISO()) return false;
    if (followUp === 'overdue' && !isOverdue(lead)) return false;
    if (search.trim()) {
      const query = search.trim().toLocaleLowerCase('tr-TR');
      const haystack = `${lead.company_name} ${lead.contact_name ?? ''} ${lead.phone ?? ''} ${lead.email ?? ''} ${lead.service_interest ?? ''} ${lead.source ?? ''} ${lead.notes_preview ?? lead.notes ?? ''}`.toLocaleLowerCase('tr-TR');
      if (!haystack.includes(query)) return false;
    }
    return true;
  }), [rows, stage, temperature, source, followUp, search]);

  const summary = useMemo(() => ({
    open: (rows ?? []).filter((r) => !['won', 'lost'].includes(r.stage)).length,
    hot: (rows ?? []).filter((r) => r.temperature === 'hot' && !['won', 'lost'].includes(r.stage)).length,
    overdue: (rows ?? []).filter(isOverdue).length,
    potential: (rows ?? []).filter((r) => !['won', 'lost'].includes(r.stage)).reduce((sum, r) => sum + Number(r.estimated_value ?? 0), 0),
  }), [rows]);

  const stageSummary = useMemo(() => LEAD_STAGES.map((item) => {
    const stageRows = filtered.filter((row) => row.stage === item.value);
    return {
      ...item,
      rows: stageRows,
      total: stageRows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0), 0),
    };
  }), [filtered]);

  const cols: Column<LeadRow>[] = [
    { key: 'company_name', header: 'Aday / Firma', sortValue: (r) => r.company_name, render: (r) => (
      <div>
        <Link to={`/leads/${r.id}`} className="font-medium hover:underline">{r.company_name}</Link>
        <div className="text-xs text-ink-500">{r.contact_name || r.phone || r.email || '-'}</div>
      </div>
    ) },
    { key: 'stage', header: 'Aşama', sortValue: (r) => r.stage, render: (r) => (
      <select className="input py-1 text-xs min-w-40" value={r.stage} onChange={(event) => changeStage(r, event.target.value)}>
        {LEAD_STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    ) },
    { key: 'temperature', header: 'Sıcaklık', render: (r) => {
      const temperatureInfo = temperatureBadge(r.temperature);
      return <span className={`badge ${temperatureInfo.cls}`}>{temperatureInfo.label}</span>;
    } },
    { key: 'service_interest', header: 'İlgilendiği Hizmet', render: (r) => r.service_interest || '-' },
    { key: 'estimated_value', header: 'Potansiyel', sortValue: (r) => Number(r.estimated_value ?? 0), render: (r) => formatMoney(r.estimated_value) },
    { key: 'next_follow_up_date', header: 'Sonraki Takip', sortValue: (r) => r.next_follow_up_date ?? '9999', render: (r) => (
      r.next_follow_up_date
        ? <span className={isOverdue(r) ? 'text-red-600 font-medium' : ''}>{formatDate(r.next_follow_up_date)}{isOverdue(r) ? ' - gecikti' : ''}</span>
        : '-'
    ) },
    { key: 'source', header: 'Kaynak', render: (r) => r.source || '-' },
    { key: '_actions', header: '', width: '120px', render: (r) => (
      <div className="flex gap-1">
        <Link to={`/leads/${r.id}`} className="btn-ghost p-2" title="Detay"><ArrowRight size={14} /></Link>
        <Link to={`/leads/${r.id}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        {!r.converted_client_id && !r.converted_offer_id && (
          <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
        )}
      </div>
    ) },
  ];

  if (!rows) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Potansiyel Müşteriler"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Potansiyel Müşteriler' }]}
        actions={(
          <div className="flex gap-2 flex-wrap">
            <div className="inline-flex rounded-md border border-ink-200 bg-white p-1">
              <button type="button" onClick={() => setView('kanban')} className={`btn py-1.5 px-3 ${view === 'kanban' ? 'bg-ink-900 text-white' : 'text-ink-700'}`}><Columns3 size={15} /> Kanban</button>
              <button type="button" onClick={() => setView('list')} className={`btn py-1.5 px-3 ${view === 'list' ? 'bg-ink-900 text-white' : 'text-ink-700'}`}><List size={15} /> Liste</button>
            </div>
            <Link to="/leads/new" className="btn-primary"><Plus size={16} /> Yeni Aday</Link>
          </div>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card card-body"><div className="text-xs text-ink-500">Aktif Fırsat</div><div className="text-2xl font-semibold">{summary.open}</div></div>
        <div className="card card-body"><div className="text-xs text-ink-500 flex items-center gap-1"><Flame size={13} /> Sıcak Aday</div><div className="text-2xl font-semibold text-red-600">{summary.hot}</div></div>
        <div className="card card-body"><div className="text-xs text-ink-500">Geciken Takip</div><div className="text-2xl font-semibold text-amber-600">{summary.overdue}</div></div>
        <div className="card card-body"><div className="text-xs text-ink-500">Açık Potansiyel</div><div className="text-2xl font-semibold">{formatMoney(summary.potential)}</div></div>
      </div>

      <div className="card card-body mb-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <Field label="Ara" className="xl:flex-1">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Firma, e-posta, telefon, ilçe veya sektör ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </Field>
          <Field label="Satış Aşaması">
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Tümü</option>
              {LEAD_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Sıcaklık">
            <select className="input" value={temperature} onChange={(e) => setTemperature(e.target.value)}>
              <option value="">Tümü</option>
              {TEMPERATURES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Takip Durumu">
            <select className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)}>
              <option value="">Tümü</option>
              <option value="today">Bugün takip edilecek</option>
              <option value="overdue">Takibi geciken</option>
            </select>
          </Field>
          <Field label="Kaynak">
            <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Tümü</option>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-ink-100">
          <div className="text-sm text-ink-500"><span className="font-medium text-ink-800">{filtered.length}</span> aday görüntüleniyor</div>
          {(search || stage || temperature || followUp || source) && (
            <button type="button" className="text-sm text-ink-600 hover:underline" onClick={() => { setSearch(''); setStage(''); setTemperature(''); setFollowUp(''); setSource(''); }}>
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        <DataTable rows={filtered} columns={cols} rowKey={(r) => r.id} />
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex items-start gap-3 min-w-max">
            {stageSummary.map((column) => (
              <div
                key={column.value}
                className={`w-72 rounded-xl border transition-colors ${dragOverStage === column.value ? 'border-ink-500 bg-ink-100' : 'border-ink-200 bg-ink-50'}`}
                onDragOver={(event) => { event.preventDefault(); setDragOverStage(column.value); }}
                onDragLeave={() => setDragOverStage((current) => current === column.value ? null : current)}
                onDrop={(event) => dropLead(event, column.value)}
              >
                <div className="sticky top-0 bg-ink-50 rounded-t-xl px-3 py-3 border-b border-ink-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`badge ${stageBadge(column.value)}`}>{column.label}</span>
                    <span className="text-sm font-semibold">{column.rows.length}</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-2">{formatMoney(column.total)}</div>
                </div>
                <div className="p-2 space-y-2 min-h-32 max-h-[64vh] overflow-y-auto">
                  {column.rows.slice(0, KANBAN_CARD_LIMIT).map((lead) => (
                    <LeadKanbanCard key={lead.id} lead={lead} onStageChange={changeStage} />
                  ))}
                  {column.rows.length === 0 && <div className="text-sm text-center text-ink-400 py-8">Bu aşamada aday yok</div>}
                  {column.rows.length > KANBAN_CARD_LIMIT && (
                    <div className="text-xs text-center text-ink-500 bg-white border border-ink-200 rounded-lg p-3">
                      {column.rows.length - KANBAN_CARD_LIMIT} aday daha var. Arama veya filtre ile daraltın.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LeadFormData {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  service_interest: string;
  source: string;
  estimated_value: string;
  stage: string;
  temperature: string;
  next_follow_up_date: string;
  notes: string;
  lost_reason: string;
}

const emptyLead: LeadFormData = {
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  service_interest: '',
  source: '',
  estimated_value: '',
  stage: 'new',
  temperature: 'warm',
  next_follow_up_date: '',
  notes: '',
  lost_reason: '',
};

export function LeadForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<LeadFormData>(emptyLead);

  useEffect(() => {
    if (!editing) return;
    api.get<{ lead: LeadRow }>(`/leads/${id}`).then((r) => {
      const lead = r.data.lead;
      setData({
        company_name: lead.company_name,
        contact_name: lead.contact_name ?? '',
        phone: lead.phone ?? '',
        email: lead.email ?? '',
        service_interest: lead.service_interest ?? '',
        source: lead.source ?? '',
        estimated_value: lead.estimated_value == null ? '' : String(lead.estimated_value),
        stage: lead.stage,
        temperature: lead.temperature,
        next_follow_up_date: lead.next_follow_up_date ?? '',
        notes: lead.notes ?? '',
        lost_reason: lead.lost_reason ?? '',
      });
      setLoading(false);
    });
  }, [editing, id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (data.stage === 'lost' && !data.lost_reason.trim()) {
      toast.error('Kaybedilen aday için neden girin');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/leads/${id}`, data);
        toast.success('Aday müşteri güncellendi');
        nav(`/leads/${id}`);
      } else {
        const r = await api.post<{ id: number }>('/leads', data);
        toast.success('Aday müşteri oluşturuldu');
        nav(`/leads/${r.data.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  return (
    <div>
      <PageHeader
        title={editing ? 'Potansiyel Müşteriyi Düzenle' : 'Yeni Potansiyel Müşteri'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Potansiyel Müşteriler', to: '/leads' }, { label: editing ? 'Düzenle' : 'Yeni' }]}
      />
      <div className="card max-w-4xl">
        <form className="card-body space-y-4" onSubmit={submit}>
          <FieldRow>
            <Field label="Firma veya Kişi Adı"><input className="input" value={data.company_name} onChange={(e) => setData({ ...data, company_name: e.target.value })} required /></Field>
            <Field label="Yetkili Kişi"><input className="input" value={data.contact_name} onChange={(e) => setData({ ...data, contact_name: e.target.value })} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Telefon"><input className="input" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} /></Field>
            <Field label="E-Posta"><input type="email" className="input" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="İlgilendiği Hizmet">
              <input className="input" list="lead-services" value={data.service_interest} onChange={(e) => setData({ ...data, service_interest: e.target.value })} />
              <datalist id="lead-services">{SERVICES.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Müşteri Kaynağı">
              <input className="input" list="lead-sources" value={data.source} onChange={(e) => setData({ ...data, source: e.target.value })} />
              <datalist id="lead-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Tahmini Satış Değeri"><input type="number" min="0" step="0.01" className="input" value={data.estimated_value} onChange={(e) => setData({ ...data, estimated_value: e.target.value })} /></Field>
            <Field label="Sonraki Takip Tarihi"><input type="date" className="input" value={data.next_follow_up_date} onChange={(e) => setData({ ...data, next_follow_up_date: e.target.value })} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Satış Aşaması">
              <select className="input" value={data.stage} onChange={(e) => setData({ ...data, stage: e.target.value })}>
                {LEAD_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Sıcaklık">
              <select className="input" value={data.temperature} onChange={(e) => setData({ ...data, temperature: e.target.value })}>
                {TEMPERATURES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </FieldRow>
          {data.stage === 'lost' && (
            <Field label="Kaybedilme Nedeni"><input className="input" value={data.lost_reason} onChange={(e) => setData({ ...data, lost_reason: e.target.value })} required /></Field>
          )}
          <Field label="İlk Notlar"><textarea rows={4} className="input" value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} /></Field>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>{editing ? 'Güncelle' : 'Kaydet'}</button>
            <Link to={editing ? `/leads/${id}` : '/leads'} className="btn-secondary">İptal</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function localDateTimeInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<{ lead: LeadRow; activities: LeadActivity[]; offers: LeadOffer[] } | null>(null);
  const [activity, setActivity] = useState({ activity_type: 'call', description: '', activity_date: localDateTimeInput(), next_action_date: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<{ lead: LeadRow; activities: LeadActivity[]; offers: LeadOffer[] }>(`/leads/${id}`);
    setData(r.data);
  }

  useEffect(() => { load(); }, [id]);

  async function addActivity(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/leads/${id}/activities`, activity);
      toast.success('Takip kaydı eklendi');
      setActivity({ activity_type: 'call', description: '', activity_date: localDateTimeInput(), next_action_date: '' });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeActivity(activityId: number) {
    if (!await confirm({ message: 'Bu takip kaydı silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/leads/${id}/activities/${activityId}`);
    load();
  }

  async function prepareOffer() {
    const r = await api.post<{ client_id: number; lead_id: number }>(`/leads/${id}/convert-to-client`);
    toast.success('Müşteri kaydı hazırlandı');
    nav(`/offers/new?lead=${r.data.lead_id}&client=${r.data.client_id}`);
  }

  if (!data) return <Loading />;
  const { lead, activities, offers } = data;
  const temp = temperatureBadge(lead.temperature);
  const importedDetails = parseImportedNotes(lead.notes);

  return (
    <div>
      <PageHeader
        title={lead.company_name}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Potansiyel Müşteriler', to: '/leads' }, { label: lead.company_name }]}
        actions={(
          <div className="flex gap-2 flex-wrap">
            <Link to={`/leads/${id}/edit`} className="btn-secondary"><Pencil size={16} /> Düzenle</Link>
            <button type="button" onClick={prepareOffer} className="btn-primary"><UserRoundPlus size={16} /> Teklif Hazırla</button>
          </div>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card card-body lg:col-span-2 min-w-0 overflow-hidden">
          <div className="flex gap-2 mb-4">
            <span className={`badge ${stageBadge(lead.stage)}`}>{stageLabel(lead.stage)}</span>
            <span className={`badge ${temp.cls}`}>{temp.label}</span>
            {isOverdue(lead) && <span className="badge badge-danger">Takip gecikti</span>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><div className="text-ink-500">Yetkili</div><div>{lead.contact_name || '-'}</div></div>
            <div><div className="text-ink-500">Telefon / E-Posta</div><div>{lead.phone || '-'} {lead.email && ` / ${lead.email}`}</div></div>
            <div><div className="text-ink-500">İlgilenilen Hizmet</div><div>{lead.service_interest || '-'}</div></div>
            <div><div className="text-ink-500">Kaynak</div><div>{lead.source || '-'}</div></div>
            <div><div className="text-ink-500">Tahmini Değer</div><div className="font-medium">{formatMoney(lead.estimated_value)}</div></div>
            <div><div className="text-ink-500">Sonraki Takip</div><div>{formatDate(lead.next_follow_up_date) || '-'}</div></div>
          </div>
          {importedDetails ? (
            <div className="mt-5 pt-5 border-t border-ink-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="font-semibold text-sm">Firma Analizi</div>
                <div className="text-xs text-ink-500">Kaynak veri: {importedDetails.importInfo}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-ink-500">Sektör / Arama Kategorisi</div>
                  <div>{importedDetails.sector || '-'}{importedDetails.search && <span className="text-ink-500"> / {importedDetails.search}</span>}</div>
                </div>
                <div>
                  <div className="text-ink-500">Google Değerlendirmesi</div>
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-amber-500" />
                    <span>{importedDetails.rating || '-'}</span>
                    {importedDetails.reviewCount && <span className="text-ink-500">({importedDetails.reviewCount} yorum)</span>}
                    {importedDetails.score && <span className="badge-neutral ml-2">Skor: {importedDetails.score}</span>}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-ink-500">Adres</div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-ink-400" />
                    <span>{importedDetails.address || importedDetails.location || '-'}</span>
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">Web Sitesi</div>
                  {importedDetails.website && importedDetails.website !== 'Web sitesi bulunamadı' ? (
                    <a href={importedDetails.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-900 hover:underline break-all">
                      <Globe size={14} className="shrink-0" /> Siteyi Aç <ExternalLink size={12} />
                    </a>
                  ) : <div>Web sitesi bulunamadı</div>}
                  <div className="text-xs text-ink-500 mt-1">HTTPS: {importedDetails.https || '-'} · Erişilebilir: {importedDetails.reachable || '-'}</div>
                </div>
                <div>
                  <div className="text-ink-500">İletişim E-Postası</div>
                  <div className="break-all">{lead.email || 'Kullanılabilir iletişim e-postası tespit edilmedi.'}</div>
                </div>
              </div>
              {importedDetails.opportunities.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-ink-500 mb-2">Önerilebilecek Çözümler</div>
                  <div className="flex flex-wrap gap-2">
                    {importedDetails.opportunities.map((opportunity) => (
                      <span key={opportunity} className="badge-neutral">
                        {OPPORTUNITY_LABELS[opportunity] ?? opportunity.replaceAll('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {importedDetails.mapsUrl && (
                <a
                  href={importedDetails.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary mt-4"
                >
                  <MapPin size={15} /> Google Maps'te Görüntüle <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : lead.notes && (
            <div className="mt-4 pt-4 border-t border-ink-100 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{lead.notes}</div>
          )}
          {lead.lost_reason && <div className="mt-4 text-sm text-red-700">Kaybedilme nedeni: {lead.lost_reason}</div>}
        </div>
        <div className="card card-body min-w-0">
          <div className="font-semibold text-sm mb-3">Dönüşüm Durumu</div>
          {lead.converted_client_id ? <Link className="text-sm hover:underline" to={`/clients/${lead.converted_client_id}/edit`}>Müşteri kaydını aç</Link> : <div className="text-sm text-ink-500">Henüz müşteriye çevrilmedi.</div>}
          <div className="mt-4 pt-4 border-t border-ink-100">
            {offers.length ? offers.map((offer) => (
              <Link key={offer.id} to={`/offers/${offer.id}/edit`} className="block text-sm hover:underline mb-2">#{offer.offer_id} {offer.offer_title}</Link>
            )) : <div className="text-sm text-ink-500">Bağlı teklif bulunmuyor.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card card-body min-w-0">
          <div className="font-semibold mb-4 flex items-center gap-2"><MessageSquarePlus size={17} /> Yeni Takip Kaydı</div>
          <form className="space-y-3" onSubmit={addActivity}>
            <Field label="İşlem Türü">
              <select className="input" value={activity.activity_type} onChange={(e) => setActivity({ ...activity, activity_type: e.target.value })}>
                {ACTIVITY_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="İşlem Tarihi"><input type="datetime-local" className="input" value={activity.activity_date} onChange={(e) => setActivity({ ...activity, activity_date: e.target.value })} required /></Field>
            <Field label="Görüşme / Aksiyon Notu"><textarea className="input" rows={4} value={activity.description} onChange={(e) => setActivity({ ...activity, description: e.target.value })} required /></Field>
            <Field label="Sonraki Aksiyon Tarihi"><input type="date" className="input" value={activity.next_action_date} onChange={(e) => setActivity({ ...activity, next_action_date: e.target.value })} /></Field>
            <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>Kaydı Ekle</button>
          </form>
        </div>

        <div className="card card-body lg:col-span-2 min-w-0 overflow-hidden">
          <div className="font-semibold mb-4 flex items-center gap-2"><CalendarClock size={17} /> İletişim ve Takip Geçmişi</div>
          {activities.length === 0 ? <div className="text-sm text-ink-500">Henüz görüşme kaydı yok.</div> : (
            <div className="space-y-3">
              {activities.map((item) => (
                <div key={item.id} className="border border-ink-100 rounded-lg p-3 min-w-0">
                  <div className="flex justify-between gap-3">
                    <div className="text-sm font-medium">{ACTIVITY_TYPES.find((a) => a.value === item.activity_type)?.label ?? (item.activity_type === 'status' ? 'Durum Güncellemesi' : 'Teklif')}</div>
                    {!['status', 'offer'].includes(item.activity_type) && (
                      <button type="button" onClick={() => removeActivity(item.id)} className="text-ink-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-1">{formatDateTime(item.activity_date)}{item.user_name ? ` - ${item.user_name}` : ''}</div>
                  <div className="text-sm mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.description}</div>
                  {item.next_action_date && <div className="mt-2 text-xs text-amber-700">Sonraki aksiyon: {formatDate(item.next_action_date)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
