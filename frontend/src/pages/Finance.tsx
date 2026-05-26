import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { confirm } from '../components/ConfirmDialog';
import { formatDate, formatMoney, todayISO } from '../lib/format';

interface FinanceTransaction {
  row_id: string;
  manual_id: number | null;
  transaction_type: 'income' | 'expense';
  category: string;
  title: string;
  amount: number;
  transaction_date: string;
  payment_method: string | null;
  reference: string | null;
  contact_name: string | null;
  notes: string | null;
  offer_id: number | null;
  source: 'manual' | 'project_payment';
  user_name: string | null;
}

interface FinanceData {
  summary: {
    income: number;
    expense: number;
    net: number;
    autoIncome: number;
    manualIncome: number;
    count: number;
  };
  categories: { category: string; transaction_type: 'income' | 'expense'; amount: number; count: number }[];
  transactions: FinanceTransaction[];
}

const INCOME_CATEGORIES = ['Ek Hizmet', 'Danışmanlık', 'Bakım / Destek', 'Domain / Hosting', 'Diğer Gelir'];
const EXPENSE_CATEGORIES = ['Yazılım / Lisans', 'Hosting / Sunucu', 'Reklam', 'Personel', 'Ofis', 'Vergi', 'Ekipman', 'Diğer Gider'];

function currentMonthStart() {
  return `${todayISO().slice(0, 7)}-01`;
}

function emptyEntry(type: 'income' | 'expense' = 'expense') {
  return {
    transaction_type: type,
    category: '',
    title: '',
    amount: 0,
    transaction_date: todayISO(),
    payment_method: '',
    reference: '',
    notes: '',
  };
}

export default function Finance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [filters, setFilters] = useState({ from: currentMonthStart(), to: todayISO(), type: '', category: '' });
  const [entry, setEntry] = useState(emptyEntry());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(nextFilters = filters) {
    const params = new URLSearchParams();
    if (nextFilters.from) params.set('from', nextFilters.from);
    if (nextFilters.to) params.set('to', nextFilters.to);
    if (nextFilters.type) params.set('type', nextFilters.type);
    if (nextFilters.category) params.set('category', nextFilters.category);
    const response = await api.get<FinanceData>(`/finance?${params.toString()}`);
    setData(response.data);
  }

  useEffect(() => { load(); }, []);

  async function applyFilters(e?: FormEvent) {
    e?.preventDefault();
    await load();
  }

  async function setPeriod(period: 'month' | 'year' | 'all') {
    const now = todayISO();
    const next = period === 'month'
      ? { ...filters, from: `${now.slice(0, 7)}-01`, to: now }
      : period === 'year'
        ? { ...filters, from: `${now.slice(0, 4)}-01-01`, to: now }
        : { ...filters, from: '', to: '' };
    setFilters(next);
    await load(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/finance/${editingId}`, entry);
        toast.success('Finans hareketi güncellendi');
      } else {
        await api.post('/finance', entry);
        toast.success(entry.transaction_type === 'income' ? 'Gelir eklendi' : 'Gider eklendi');
      }
      setEditingId(null);
      setEntry(emptyEntry(entry.transaction_type));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function edit(transaction: FinanceTransaction) {
    if (!transaction.manual_id) return;
    setEditingId(transaction.manual_id);
    setEntry({
      transaction_type: transaction.transaction_type,
      category: transaction.category,
      title: transaction.title,
      amount: Number(transaction.amount),
      transaction_date: String(transaction.transaction_date).slice(0, 10),
      payment_method: transaction.payment_method ?? '',
      reference: transaction.reference ?? '',
      notes: transaction.notes ?? '',
    });
  }

  async function remove(id: number) {
    if (!await confirm({ message: 'Finans hareketi silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/finance/${id}`);
    toast.success('Finans hareketi silindi');
    if (editingId === id) {
      setEditingId(null);
      setEntry(emptyEntry());
    }
    await load();
  }

  const categoryOptions = entry.transaction_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const categorized = useMemo(() => ({
    incomes: data?.categories.filter((item) => item.transaction_type === 'income') ?? [],
    expenses: data?.categories.filter((item) => item.transaction_type === 'expense') ?? [],
  }), [data]);

  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Gelir / Gider Takibi"
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Gelir / Gider' }]}
      />

      <form onSubmit={applyFilters} className="card card-body mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" className="btn-secondary" onClick={() => setPeriod('month')}>Bu Ay</button>
          <button type="button" className="btn-secondary" onClick={() => setPeriod('year')}>Bu Yıl</button>
          <button type="button" className="btn-secondary" onClick={() => setPeriod('all')}>Tüm Zamanlar</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Başlangıç">
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </Field>
          <Field label="Bitiş">
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </Field>
          <Field label="Tür">
            <select className="input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">Tüm hareketler</option>
              <option value="income">Gelir</option>
              <option value="expense">Gider</option>
            </select>
          </Field>
          <Field label="Kategori">
            <input className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="Tüm kategoriler" />
          </Field>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Filtrele</button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <FinanceSummary title="Toplam Gelir" value={data.summary.income} variant="income" />
        <FinanceSummary title="Toplam Gider" value={data.summary.expense} variant="expense" />
        <FinanceSummary title="Net Durum" value={data.summary.net} variant={data.summary.net >= 0 ? 'income' : 'expense'} />
        <div className="card card-body">
          <div className="text-xs text-ink-500">Gelir Kaynakları</div>
          <div className="text-sm mt-2">Proje ödemeleri: <strong>{formatMoney(data.summary.autoIncome)}</strong></div>
          <div className="text-sm mt-1">Ek gelirler: <strong>{formatMoney(data.summary.manualIncome)}</strong></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="card card-body">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Hareket Dökümü</h3>
                <p className="text-xs text-ink-500 mt-1">Proje ödemeleri otomatik gelir olarak dahil edilir.</p>
              </div>
              <span className="text-xs text-ink-500">{data.summary.count} kayıt</span>
            </div>
            {data.transactions.length === 0 ? <div className="text-sm text-ink-500 py-6">Seçili dönemde hareket bulunamadı.</div> : (
              <div className="border border-ink-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="bg-ink-50 text-left">
                      <th className="px-3 py-2">Tarih</th>
                      <th className="px-3 py-2">Tür</th>
                      <th className="px-3 py-2">Kategori / Başlık</th>
                      <th className="px-3 py-2">Ödeme Yöntemi</th>
                      <th className="px-3 py-2 text-right">Tutar</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((transaction) => (
                      <tr key={transaction.row_id} className="border-t border-ink-100">
                        <td className="px-3 py-3 whitespace-nowrap">{formatDate(transaction.transaction_date)}</td>
                        <td className="px-3 py-3">
                          <span className={transaction.transaction_type === 'income' ? 'badge-success' : 'badge-danger'}>
                            {transaction.transaction_type === 'income' ? 'Gelir' : 'Gider'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{transaction.title}</div>
                          <div className="text-xs text-ink-500">
                            {transaction.category}
                            {transaction.contact_name ? ` · ${transaction.contact_name}` : ''}
                            {transaction.source === 'project_payment' ? ' · Otomatik' : ''}
                          </div>
                          {transaction.notes && <div className="text-xs text-ink-500 mt-1">{transaction.notes}</div>}
                        </td>
                        <td className="px-3 py-3 text-ink-600">{transaction.payment_method ?? '-'}</td>
                        <td className={`px-3 py-3 text-right font-semibold whitespace-nowrap ${transaction.transaction_type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {transaction.transaction_type === 'income' ? '+' : '-'} {formatMoney(transaction.amount)}
                        </td>
                        <td className="px-3 py-3">
                          {transaction.manual_id ? (
                            <div className="flex justify-end gap-1">
                              <button className="btn-ghost p-1.5" type="button" onClick={() => edit(transaction)} title="Düzenle"><Pencil size={14} /></button>
                              <button className="btn-ghost p-1.5 text-red-600" type="button" onClick={() => remove(transaction.manual_id!)} title="Sil"><Trash2 size={14} /></button>
                            </div>
                          ) : transaction.offer_id ? (
                            <Link className="text-xs underline whitespace-nowrap" to={`/billings/${transaction.offer_id}`}>Projeye git</Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategoryBreakdown title="Gelir Dağılımı" rows={categorized.incomes} type="income" />
            <CategoryBreakdown title="Gider Dağılımı" rows={categorized.expenses} type="expense" />
          </div>
        </div>

        <form onSubmit={submit} className="card card-body space-y-4 self-start">
          <div>
            <h3 className="font-semibold">{editingId ? 'Hareketi Düzenle' : 'Yeni Hareket Ekle'}</h3>
            <p className="text-xs text-ink-500 mt-1">Proje dışı gelirleri ve tüm giderleri buradan kaydedin.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEntry({ ...entry, transaction_type: 'income', category: '' })} className={entry.transaction_type === 'income' ? 'btn-primary' : 'btn-secondary'}>
              <ArrowUpCircle size={15} /> Gelir
            </button>
            <button type="button" onClick={() => setEntry({ ...entry, transaction_type: 'expense', category: '' })} className={entry.transaction_type === 'expense' ? 'btn-primary' : 'btn-secondary'}>
              <ArrowDownCircle size={15} /> Gider
            </button>
          </div>
          <Field label="Kategori">
            <input list="finance-categories" className="input" value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value })} placeholder="Kategori seçin veya yazın" required />
            <datalist id="finance-categories">
              {categoryOptions.map((category) => <option key={category} value={category} />)}
            </datalist>
          </Field>
          <Field label="Başlık / Açıklama">
            <input className="input" value={entry.title} onChange={(e) => setEntry({ ...entry, title: e.target.value })} placeholder="Ör. Adobe yıllık lisans" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tutar (₺)">
              <input type="number" step="0.01" min={0.01} className="input" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: Number(e.target.value) })} required />
            </Field>
            <Field label="İşlem Tarihi">
              <input type="date" className="input" value={entry.transaction_date} onChange={(e) => setEntry({ ...entry, transaction_date: e.target.value })} required />
            </Field>
          </div>
          <Field label="Ödeme Yöntemi">
            <select className="input" value={entry.payment_method} onChange={(e) => setEntry({ ...entry, payment_method: e.target.value })}>
              <option value="">Seçilmedi</option>
              <option>Banka Transferi</option>
              <option>Kredi Kartı</option>
              <option>Nakit</option>
              <option>Online Ödeme</option>
              <option>Diğer</option>
            </select>
          </Field>
          <Field label="Belge / Referans">
            <input className="input" value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} placeholder="Fatura no, açıklama vb." />
          </Field>
          <Field label="Not">
            <textarea className="input min-h-20" value={entry.notes} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" type="submit" disabled={busy}>{editingId ? 'Güncelle' : 'Kaydet'}</button>
            {editingId && <button className="btn-secondary" type="button" onClick={() => { setEditingId(null); setEntry(emptyEntry()); }}>Vazgeç</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

function FinanceSummary({ title, value, variant }: { title: string; value: number; variant: 'income' | 'expense' }) {
  return (
    <div className={`card card-body ${variant === 'income' ? 'border-emerald-200' : 'border-red-200'}`}>
      <div className="text-xs text-ink-500">{title}</div>
      <div className={`text-xl sm:text-2xl font-semibold mt-1 ${variant === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
        {formatMoney(value)}
      </div>
    </div>
  );
}

function CategoryBreakdown({ title, rows, type }: { title: string; rows: FinanceData['categories']; type: 'income' | 'expense' }) {
  return (
    <div className="card card-body">
      <div className="font-semibold text-sm mb-3">{title}</div>
      {rows.length === 0 ? <div className="text-sm text-ink-500">Kayıt yok.</div> : rows.map((row) => (
        <div key={row.category} className="py-2 border-b border-ink-100 last:border-0 flex justify-between gap-2 text-sm">
          <div>
            <div>{row.category}</div>
            <div className="text-xs text-ink-500">{row.count} hareket</div>
          </div>
          <strong className={type === 'income' ? 'text-emerald-700' : 'text-red-700'}>{formatMoney(row.amount)}</strong>
        </div>
      ))}
    </div>
  );
}
