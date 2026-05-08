import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { confirm } from '../components/ConfirmDialog';
import { formatDate, formatMoney } from '../lib/format';
import type { ProjectRow } from '../types';

export function BillingsList() {
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    api.get<ProjectRow[]>('/projects').then((r) => setRows(r.data));
  }, []);

  if (!rows) return <Loading />;
  return (
    <div>
      <PageHeader title="Proje Ödemeleri" crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Ödemeler' }]} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((p) => (
          <Link key={p.id} to={`/billings/${p.offerID}`} className="card card-body hover:shadow">
            <div className="text-xs text-ink-500">#{p.offerID}</div>
            <div className="font-semibold mt-1 truncate">{p.title}</div>
            <div className="text-sm text-ink-600 truncate">{p.clientTitle ?? '-'}</div>
            <div className="mt-3 text-lg font-semibold">{formatMoney(p.price)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BillingsDetail() {
  const { offerId } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [pay, setPay] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get(`/billings/by-offer-id/${offerId}`);
    setData(r.data);
  }
  useEffect(() => { load(); }, [offerId]);

  const totals = useMemo(() => {
    if (!data) return null;
    const price = Number(data.project.price) || 0;
    const kdvPct = Number(data.project.kdv) || 20;
    const kdv = (price * kdvPct) / 100;
    const total = price + kdv;
    const paid = (data.billings as any[]).reduce((s, b) => s + Number(b.pay), 0);
    const remaining = total - paid;
    const percent = total > 0 ? (paid / total) * 100 : 0;
    return { price, kdv, total, paid, remaining, percent };
  }, [data]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!pay || pay <= 0) return;
    if (totals && pay > totals.remaining) {
      toast.error('Kalan tutardan fazla olamaz');
      return;
    }
    setBusy(true);
    try {
      await api.post('/billings', { offer_id: offerId, pay });
      toast.success('Ödeme eklendi');
      setPay(0);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function delBilling(id: number) {
    if (!await confirm({ message: 'Ödeme silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/billings/${id}`);
    toast.success('Silindi');
    load();
  }

  if (!data || !totals) return <Loading />;

  const auto = (pct: number) => () => setPay(Math.round((totals.remaining * pct) / 100));

  return (
    <div>
      <PageHeader
        title="Proje Ödemeleri"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler', to: '/projects' }, { label: 'Ödemeler' }]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl">
        <div className="card card-body lg:col-span-2 space-y-4">
          <div>
            <div className="text-xs text-ink-500">Proje</div>
            <div className="font-semibold text-lg">{data.project.title}</div>
            <div className="text-sm text-ink-600">#{data.project.offer_id} · {data.client?.title ?? '-'} · {data.personel?.fullname ?? '-'}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KV label="Ana Tutar" value={formatMoney(totals.price)} />
            <KV label="KDV" value={formatMoney(totals.kdv)} />
            <KV label="Toplam" value={formatMoney(totals.total)} />
            <KV label="Kalan" value={formatMoney(totals.remaining)} />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
              <span>Ödenen: {formatMoney(totals.paid)}</span>
              <span>%{totals.percent.toFixed(1)}</span>
            </div>
            <div className="h-3 bg-ink-100 rounded overflow-hidden">
              <div className="h-full bg-ink-700" style={{ width: `${Math.min(100, totals.percent)}%` }} />
            </div>
          </div>

          {data.billings.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Önceki Ödemeler</h4>
              <div className="border border-ink-200 rounded overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-ink-50 text-left">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Tutar</th>
                      <th className="px-3 py-2">% Toplamın</th>
                      <th className="px-3 py-2">Tarih</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.billings.map((b: any, i: number) => (
                      <tr key={b.id} className="border-t border-ink-100">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{formatMoney(b.pay)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">%{((Number(b.pay) / totals.total) * 100).toFixed(1)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(b.create_date)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => delBilling(b.id)} className="btn-ghost text-red-600 p-1.5"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {totals.remaining > 0 ? (
          <form onSubmit={add} className="card card-body space-y-4 self-start">
            <h4 className="font-semibold">Yeni Ödeme</h4>
            <div className="grid grid-cols-3 gap-2">
              {[40, 50, 60].map((pct) => (
                <button key={pct} type="button" onClick={auto(pct)} className="btn-secondary text-xs">%{pct}</button>
              ))}
            </div>
            <Field label="Tutar (₺)">
              <input type="number" min={1} max={totals.remaining} className="input" value={pay} onChange={(e) => setPay(Number(e.target.value))} required />
            </Field>
            <button type="submit" className="btn-primary w-full" disabled={busy}>Ödemeyi Kaydet</button>
          </form>
        ) : (
          <div className="card card-body bg-emerald-50 border-emerald-200 text-emerald-800 text-sm">
            <strong>Tüm ödemeler tamamlandı.</strong>
          </div>
        )}
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
