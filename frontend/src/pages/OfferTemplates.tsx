import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, FilePlus2, Trash, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { useList } from '../hooks/useList';
import { Field } from '../components/Field';
import { formatDate, formatMoney, truncate } from '../lib/format';
import type { Job, OfferTemplateMatter, OfferTemplateRow } from '../types';

function emptyMatter(): OfferTemplateMatter {
  return { matter_title: '', matter_description: '', matter_extra: '', matter_unit: 1, matter_old_price: 0, matter_price: 0 };
}

export function OfferTemplatesList() {
  const { data: rows, loading, error, reload } = useList<OfferTemplateRow[]>('/offer-templates');

  async function del(id: number) {
    if (!await confirm({ message: 'Bu şablonu silmek istediğinize emin misiniz?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/offer-templates/${id}`);
    toast.success('Şablon silindi');
    reload();
  }

  async function duplicate(id: number) {
    if (!await confirm({ message: 'Bu şablon kopyalansın mı?', confirmLabel: 'Kopyala' })) return;
    await api.post(`/offer-templates/${id}/duplicate`);
    toast.success('Şablon kopyalandı');
    reload();
  }

  const cols: Column<OfferTemplateRow>[] = [
    { key: 'id', header: '#', width: '60px', sortValue: (r) => r.id },
    { key: 'title', header: 'Şablon', sortValue: (r) => r.title, render: (r) => (
      <div className="md:max-w-md">
        <div className="font-medium md:truncate flex items-center gap-2">
          {r.title}
          {!r.isActive && <span className="badge-neutral text-[10px]">Pasif</span>}
        </div>
        <div className="text-xs text-ink-500">{truncate(r.description, 100)}</div>
      </div>
    ) },
    { key: 'offerTypeTitle', header: 'Tip', render: (r) => (
      r.offerTypeTitle ? <span className="badge-neutral">{r.offerTypeTitle}</span> : <span className="text-ink-400 text-xs">Genel</span>
    ) },
    { key: 'matterCount', header: 'Madde', sortValue: (r) => r.matterCount, render: (r) => (
      <span className="text-ink-700">{r.matterCount} madde</span>
    ) },
    { key: 'totalPrice', header: 'Toplam', sortValue: (r) => r.totalPrice, render: (r) => formatMoney(r.totalPrice) },
    { key: 'defaultValidityDays', header: 'Geçerlilik', sortValue: (r) => r.defaultValidityDays, render: (r) => `${r.defaultValidityDays} gün` },
    { key: 'createDate', header: 'Oluşturma', sortValue: (r) => r.createDate, render: (r) => formatDate(r.createDate) },
    { key: '_actions', header: '', width: '200px', render: (r) => (
      <div className="flex gap-1 flex-wrap">
        <Link to={`/offers/new?template=${r.id}`} className="btn-ghost p-2" title="Bu Şablonla Teklif Oluştur"><FilePlus2 size={14} /></Link>
        <Link to={`/offer-templates/${r.id}/edit`} className="btn-ghost p-2" title="Düzenle"><Pencil size={14} /></Link>
        <button onClick={() => duplicate(r.id)} className="btn-ghost p-2" title="Kopyala"><Copy size={14} /></button>
        <button onClick={() => del(r.id)} className="btn-ghost p-2 text-red-600" title="Sil"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  if (loading) return <Loading />;
  if (error || !rows) return <ErrorState onRetry={reload} />;
  return (
    <div>
      <PageHeader
        title="Teklif Şablonları"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Teklif Şablonları' }]}
        actions={<Link to="/offer-templates/new" className="btn-primary"><Plus size={16} /> Yeni Şablon</Link>}
      />
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.title} ${r.description ?? ''} ${r.offerTypeTitle ?? ''}`}
        empty="Henüz şablon yok. Sık kullandığınız teklifler için şablon oluşturun."
      />
    </div>
  );
}

export function OfferTemplateForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [data, setData] = useState({
    title: '',
    description: '',
    offer_type: 0,
    default_offer_title: '',
    default_offer_text: '',
    default_validity_days: 15,
    is_active: 1,
  });
  const [matters, setMatters] = useState<OfferTemplateMatter[]>([emptyMatter()]);

  useEffect(() => {
    (async () => {
      const jr = await api.get<Job[]>('/jobs');
      setJobs(jr.data);
      if (editing) {
        const r = await api.get(`/offer-templates/${id}`);
        const t = r.data.template;
        setData({
          title: t.title ?? '',
          description: t.description ?? '',
          offer_type: t.offer_type ?? 0,
          default_offer_title: t.default_offer_title ?? '',
          default_offer_text: t.default_offer_text ?? '',
          default_validity_days: t.default_validity_days ?? 15,
          is_active: t.is_active ?? 1,
        });
        setMatters(r.data.matters.length ? r.data.matters : [emptyMatter()]);
      }
      setLoading(false);
    })();
  }, [id, editing]);

  const total = useMemo(
    () => matters.reduce((s, m) => s + Number(m.matter_price || 0) * Number(m.matter_unit || 1), 0),
    [matters]
  );

  function setMatter(i: number, patch: Partial<OfferTemplateMatter>) {
    setMatters((arr) => arr.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMatter() {
    setMatters((arr) => [...arr, emptyMatter()]);
  }
  function delMatter(i: number) {
    setMatters((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }
  function moveMatter(i: number, dir: -1 | 1) {
    setMatters((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!data.title.trim()) {
      toast.error('Şablon başlığı zorunlu');
      return;
    }
    if (matters.some((m) => !m.matter_title)) {
      toast.error('Tüm maddelerin başlığı zorunlu');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...data,
        offer_type: data.offer_type ? data.offer_type : null,
        matters,
      };
      if (editing) {
        await api.put(`/offer-templates/${id}`, payload);
        toast.success('Şablon güncellendi');
      } else {
        await api.post('/offer-templates', payload);
        toast.success('Şablon oluşturuldu');
      }
      nav('/offer-templates');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={editing ? 'Şablon Düzenle' : 'Yeni Şablon'}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Teklif Şablonları', to: '/offer-templates' }, { label: editing ? 'Düzenle' : 'Yeni' }]}
      />
      <form onSubmit={submit} className="space-y-4 max-w-5xl">
        <div className="card">
          <div className="card-body space-y-4">
            <Field label="Şablon Başlığı (sadece dahili kullanım)">
              <input
                className="input"
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="Örn: Sunucu Hizmeti, Kurumsal Web Sitesi"
                required
              />
            </Field>
            <Field label="Açıklama (dahili - listede gösterilir)">
              <textarea
                rows={2}
                className="input"
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Bu şablonun ne için kullanıldığına dair kısa açıklama"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Teklif Tipi (varsayılan)">
                <select
                  className="input"
                  value={data.offer_type}
                  onChange={(e) => setData({ ...data, offer_type: Number(e.target.value) })}
                >
                  <option value={0}>Seçilmemiş (Genel)</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </Field>
              <Field label="Geçerlilik Süresi (gün)">
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={data.default_validity_days}
                  onChange={(e) => setData({ ...data, default_validity_days: Number(e.target.value) })}
                />
              </Field>
              <Field label="Durum">
                <select
                  className="input"
                  value={data.is_active}
                  onChange={(e) => setData({ ...data, is_active: Number(e.target.value) })}
                >
                  <option value={1}>Aktif</option>
                  <option value={0}>Pasif</option>
                </select>
              </Field>
            </div>

            <Field label="Varsayılan Teklif Başlığı (PDF'te gösterilir)">
              <input
                className="input"
                value={data.default_offer_title}
                onChange={(e) => setData({ ...data, default_offer_title: e.target.value })}
                placeholder="Örn: Sunucu / Hosting Hizmeti Teklifi"
              />
            </Field>
            <Field label="Varsayılan İş Açıklaması">
              <textarea
                rows={3}
                className="input"
                value={data.default_offer_text}
                onChange={(e) => setData({ ...data, default_offer_text: e.target.value })}
                placeholder="Teklifin başında yer alacak genel açıklama"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink-900">Şablon Maddeleri</h3>
            <span className="text-xs text-ink-500">{matters.length} madde</span>
          </div>
          {matters.map((m, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">Madde #{i + 1}</h4>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveMatter(i, -1)}
                        className="btn-ghost p-1.5"
                        title="Yukarı taşı"
                        disabled={i === 0}
                      >
                        <GripVertical size={14} className="rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMatter(i, 1)}
                        className="btn-ghost p-1.5"
                        title="Aşağı taşı"
                        disabled={i === matters.length - 1}
                      >
                        <GripVertical size={14} className="-rotate-90" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => delMatter(i)}
                    className="btn-ghost text-red-600 p-1.5"
                    disabled={matters.length <= 1}
                  >
                    <Trash size={14} /> Sil
                  </button>
                </div>
                <div className="space-y-3">
                  <Field label="Başlık">
                    <input
                      className="input"
                      value={m.matter_title}
                      onChange={(e) => setMatter(i, { matter_title: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Açıklama">
                    <textarea
                      rows={3}
                      className="input"
                      value={m.matter_description}
                      onChange={(e) => setMatter(i, { matter_description: e.target.value })}
                    />
                  </Field>
                  <Field label="Ekstra (PDF'te ek sayfa)">
                    <textarea
                      rows={2}
                      className="input"
                      value={m.matter_extra ?? ''}
                      onChange={(e) => setMatter(i, { matter_extra: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Adet">
                      <input
                        type="number"
                        min={1}
                        className="input"
                        value={m.matter_unit}
                        onChange={(e) => setMatter(i, { matter_unit: Number(e.target.value) })}
                        required
                      />
                    </Field>
                    <Field label="İlk Fiyat (üzeri çizilir, 0 ise gizli)">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="input"
                        value={m.matter_old_price ?? 0}
                        onChange={(e) => setMatter(i, { matter_old_price: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Fiyat">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="input"
                        value={m.matter_price}
                        onChange={(e) => setMatter(i, { matter_price: Number(e.target.value) })}
                        required
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button type="button" onClick={addMatter} className="btn-secondary w-full sm:w-auto">
            <Plus size={14} /> Madde Ekle
          </button>
          <div className="text-sm text-ink-600">
            Şablon Toplam: <span className="font-semibold text-ink-900">{formatMoney(total)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link to="/offer-templates" className="btn-secondary order-2 sm:order-1 justify-center">İptal</Link>
          <button type="submit" className="btn-primary order-1 sm:order-2" disabled={busy}>
            {editing ? 'Güncelle' : 'Şablonu Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}
