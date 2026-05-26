import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { confirm } from '../components/ConfirmDialog';
import { formatDate, formatDateTime, formatMoney, todayISO } from '../lib/format';
import type { ProjectRow } from '../types';

export function BillingsList() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);

  useEffect(() => {
    api.get<ProjectRow[]>('/projects').then((r) => setRows(r.data));
  }, []);

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader title="Proje Ödemeleri" crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Ödemeler' }]} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((project) => {
          const paid = Number(project.paid);
          const total = Number(project.total);
          const percent = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
          return (
            <Link key={project.id} to={`/billings/${project.offerID}`} className="card card-body hover:shadow">
              <div className="text-xs text-ink-500">#{project.offerID}</div>
              <div className="font-semibold mt-1 truncate">{project.title}</div>
              <div className="text-sm text-ink-600 truncate">{project.clientTitle ?? '-'}</div>
              <div className="mt-3 flex justify-between items-end gap-2">
                <div>
                  <div className="text-xs text-ink-500">Tahsil Edilen</div>
                  <div className="text-lg font-semibold">{formatMoney(paid)}</div>
                </div>
                <div className="text-xs text-ink-500">%{percent.toFixed(0)}</div>
              </div>
              <div className="h-2 rounded bg-ink-100 mt-2">
                <div className="h-2 rounded bg-ink-800" style={{ width: `${percent}%` }} />
              </div>
              <div className="text-xs text-ink-500 mt-2">Kalan: {formatMoney(total - paid)}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BillingsDetail() {
  const { offerId } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [pay, setPay] = useState<number>(0);
  const [paymentPlanId, setPaymentPlanId] = useState<number>(0);
  const [planDraft, setPlanDraft] = useState({ title: '', amount: 0, due_date: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await api.get(`/billings/by-offer-id/${offerId}`);
    setData(response.data);
  }
  useEffect(() => { load(); }, [offerId]);

  const totals = useMemo(() => {
    if (!data) return null;
    const price = Number(data.project.price) || 0;
    const kdvPct = data.project.kdv == null ? 20 : Number(data.project.kdv);
    const kdv = (price * kdvPct) / 100;
    const total = price + kdv;
    const paid = (data.billings as any[]).reduce((sum, billing) => sum + Number(billing.pay), 0);
    const remaining = total - paid;
    const percent = total > 0 ? (paid / total) * 100 : 0;
    const planned = (data.paymentPlans as any[]).reduce((sum, plan) => sum + Number(plan.amount), 0);
    return { price, kdv, total, paid, remaining, percent, planned, unplanned: Math.max(0, total - planned) };
  }, [data]);

  async function addPayment(e: FormEvent) {
    e.preventDefault();
    if (!pay || pay <= 0) return;
    if (totals && pay > totals.remaining) {
      toast.error('Kalan tutardan fazla olamaz');
      return;
    }
    setBusy(true);
    try {
      await api.post('/billings', { offer_id: offerId, pay, payment_plan_id: paymentPlanId || null });
      toast.success('Ödeme eklendi');
      setPay(0);
      setPaymentPlanId(0);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addPlan(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/billings/by-offer-id/${offerId}/plans`, planDraft);
      toast.success('Ödeme planı eklendi');
      setPlanDraft({ title: '', amount: 0, due_date: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteBilling(id: number) {
    if (!await confirm({ message: 'Ödeme silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/billings/${id}`);
    toast.success('Ödeme silindi');
    await load();
  }

  async function deletePlan(id: number) {
    if (!await confirm({ message: 'Ödeme planı silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/billings/plans/${id}`);
    toast.success('Ödeme planı silindi');
    await load();
  }

  if (!data || !totals) return <Loading />;

  const plans = data.paymentPlans as any[];
  const availablePlans = plans.filter((plan) => Number(plan.amount) > Number(plan.paid));
  const auto = (pct: number) => () => setPay(Math.round(totals.remaining * pct) / 100);

  return (
    <div>
      <PageHeader
        title="Ödeme Planı ve Geçmişi"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler', to: '/projects' }, { label: 'Ödemeler' }]}
        actions={<Link className="btn-secondary" to={`/projects/${offerId}`}><ArrowLeft size={14} /> Proje Detayı</Link>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl">
        <div className="lg:col-span-2 space-y-4">
          <div className="card card-body space-y-4">
            <div>
              <div className="text-xs text-ink-500">Proje</div>
              <div className="font-semibold text-lg">{data.project.title}</div>
              <div className="text-sm text-ink-600">#{data.project.offer_id} · {data.client?.title ?? '-'} · {data.personel?.fullname ?? '-'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KV label="Ana Tutar" value={formatMoney(totals.price)} />
              <KV label="KDV" value={formatMoney(totals.kdv)} />
              <KV label="Tahsil Edilen" value={formatMoney(totals.paid)} />
              <KV label="Kalan" value={formatMoney(totals.remaining)} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
                <span>Toplam: {formatMoney(totals.total)}</span>
                <span>%{totals.percent.toFixed(1)} tahsil edildi</span>
              </div>
              <div className="h-3 bg-ink-100 rounded overflow-hidden">
                <div className="h-full bg-ink-700" style={{ width: `${Math.min(100, totals.percent)}%` }} />
              </div>
            </div>
          </div>

          <div className="card card-body">
            <div className="flex justify-between items-center gap-3 mb-4">
              <div>
                <h3 className="font-semibold">Planlanan Ödemeler</h3>
                <p className="text-xs text-ink-500 mt-1">Taksit ve vadelerin gerçekleşme durumunu takip edin.</p>
              </div>
              <span className="text-xs text-ink-500">Planlanmamış: {formatMoney(totals.unplanned)}</span>
            </div>
            {plans.length === 0 ? <div className="text-sm text-ink-500">Henüz ödeme planı oluşturulmadı.</div> : (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const amount = Number(plan.amount);
                  const paid = Number(plan.paid);
                  const remaining = amount - paid;
                  const overdue = remaining > 0 && plan.due_date < todayISO();
                  const percent = amount > 0 ? Math.min(100, (paid / amount) * 100) : 0;
                  return (
                    <div key={plan.id} className={`border rounded-lg p-3 ${overdue ? 'border-red-200 bg-red-50' : 'border-ink-200'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{plan.title}</div>
                          <div className={`text-xs mt-1 ${overdue ? 'text-red-700' : 'text-ink-500'}`}>
                            Vade: {formatDate(plan.due_date)} · {remaining <= 0 ? 'Ödendi' : overdue ? 'Gecikmiş ödeme' : 'Bekliyor'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm">{formatMoney(amount)}</strong>
                          {paid === 0 && <button className="btn-ghost p-1.5 text-red-600" onClick={() => deletePlan(plan.id)} title="Planı sil"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="h-2 bg-ink-100 rounded"><div className="h-2 bg-ink-700 rounded" style={{ width: `${percent}%` }} /></div>
                        <div className="text-xs text-ink-500 mt-1">{formatMoney(paid)} ödendi · {formatMoney(Math.max(0, remaining))} kaldı</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card card-body">
            <h3 className="font-semibold mb-1">Tahsilat Geçmişi</h3>
            <p className="text-xs text-ink-500 mb-4">Daha önce kaydedilmiş gerçekleşen ödemeler.</p>
            {data.billings.length === 0 ? <div className="text-sm text-ink-500">Ödeme kaydı yok.</div> : (
              <div className="border border-ink-200 rounded overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-ink-50 text-left">
                      <th className="px-3 py-2">Tarih</th>
                      <th className="px-3 py-2">Bağlı Plan</th>
                      <th className="px-3 py-2">Tutar</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.billings.map((billing: any) => (
                      <tr key={billing.id} className="border-t border-ink-100">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(billing.create_date)}</td>
                        <td className="px-3 py-2">{billing.plan_title ?? 'Plansız ödeme'}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{formatMoney(billing.pay)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => deleteBilling(billing.id)} className="btn-ghost text-red-600 p-1.5"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {totals.remaining > 0 ? (
            <form onSubmit={addPayment} className="card card-body space-y-4">
              <h3 className="font-semibold">Yeni Tahsilat</h3>
              <div className="grid grid-cols-3 gap-2">
                {[40, 50, 60].map((percent) => (
                  <button key={percent} type="button" onClick={auto(percent)} className="btn-secondary text-xs">%{percent}</button>
                ))}
              </div>
              <Field label="Ödeme Planı">
                <select className="input" value={paymentPlanId} onChange={(e) => setPaymentPlanId(Number(e.target.value))}>
                  <option value={0}>Plansız ödeme</option>
                  {availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} · {formatMoney(Number(plan.amount) - Number(plan.paid))} kaldı</option>)}
                </select>
              </Field>
              <Field label="Tutar (₺)">
                <input type="number" step="0.01" min={0.01} max={totals.remaining} className="input" value={pay} onChange={(e) => setPay(Number(e.target.value))} required />
              </Field>
              <button type="submit" className="btn-primary w-full" disabled={busy}>Tahsilatı Kaydet</button>
            </form>
          ) : (
            <div className="card card-body bg-emerald-50 border-emerald-200 text-emerald-800 text-sm">
              <strong>Tüm ödemeler tamamlandı.</strong>
            </div>
          )}

          {totals.unplanned > 0 && (
            <form onSubmit={addPlan} className="card card-body space-y-3">
              <h3 className="font-semibold">Yeni Ödeme Planı</h3>
              <Field label="Başlık">
                <input className="input" value={planDraft.title} onChange={(e) => setPlanDraft({ ...planDraft, title: e.target.value })} placeholder="Ör. Teslim ödemesi" required />
              </Field>
              <Field label="Tutar (₺)">
                <input type="number" step="0.01" min={0.01} max={totals.unplanned} className="input" value={planDraft.amount} onChange={(e) => setPlanDraft({ ...planDraft, amount: Number(e.target.value) })} required />
              </Field>
              <Field label="Vade Tarihi">
                <input type="date" className="input" value={planDraft.due_date} onChange={(e) => setPlanDraft({ ...planDraft, due_date: e.target.value })} required />
              </Field>
              <button type="submit" className="btn-secondary w-full" disabled={busy}>Planı Ekle</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink-200 rounded p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
