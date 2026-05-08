import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, ScrollText, Briefcase, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { formatDate } from '../lib/format';

interface Stats {
  counts: { clientCount: number; offerCount: number; agreementCount: number; projectCount: number };
  thisMonth: number;
  lastMonth: number;
  ratio: number | null;
  byType: { id: number; title: string; cnt: number }[];
  overdue: { id: number; offer_id: number; offer_title: string; final_date: string }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>('/dashboard/stats').then((r) => setStats(r.data));
  }, []);

  if (!stats) return <Loading />;

  const cards = [
    { label: 'Müşteri', value: stats.counts.clientCount, icon: Building2, link: '/clients' },
    { label: 'Teklif', value: stats.counts.offerCount, icon: FileText, link: '/offers' },
    { label: 'Sözleşme', value: stats.counts.agreementCount, icon: ScrollText, link: '/agreements' },
    { label: 'Proje', value: stats.counts.projectCount, icon: Briefcase, link: '/projects' },
  ];

  const ratioGrowth = stats.ratio === null ? null : stats.ratio >= 0;

  return (
    <div>
      <PageHeader title="Anasayfa" crumbs={[{ label: 'Anasayfa' }]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {cards.map((c) => (
          <Link to={c.link} key={c.label} className="card card-body hover:shadow transition-shadow">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm text-ink-500 truncate">{c.label}</div>
                <div className="text-2xl sm:text-3xl font-semibold mt-1">{c.value}</div>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 grid place-items-center rounded-full bg-ink-100 text-ink-700 shrink-0">
                <c.icon size={20} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card card-body lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Aylık Teklif Performansı</div>
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            <div>
              <div className="text-xs text-ink-500">Bu Ay</div>
              <div className="text-2xl sm:text-3xl font-semibold">{stats.thisMonth} <span className="text-sm sm:text-base font-normal text-ink-500">teklif</span></div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Geçen Ay</div>
              <div className="text-xl sm:text-2xl text-ink-700">{stats.lastMonth} <span className="text-sm text-ink-500">teklif</span></div>
            </div>
            <div className="ml-auto">
              {ratioGrowth === null ? (
                <div className="badge badge-neutral text-sm">— Karşılaştırma yok</div>
              ) : (
                <div className={`badge ${ratioGrowth ? 'badge-success' : 'badge-danger'} text-sm`}>
                  {ratioGrowth ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="ml-1">%{Math.round(Math.abs(stats.ratio ?? 0))}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card card-body">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" /> Tarihi Geçen Teklifler
          </div>
          {stats.overdue.length === 0 ? (
            <div className="text-sm text-ink-500">Tarihi geçmiş teklif yok</div>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-auto">
              {stats.overdue.map((o) => (
                <li key={o.id} className="text-sm flex items-center justify-between">
                  <Link to={`/offers/${o.id}/edit`} className="hover:underline truncate">
                    #{o.offer_id} {o.offer_title}
                  </Link>
                  <span className="text-xs text-ink-500 shrink-0 ml-2">{formatDate(o.final_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card card-body">
        <div className="text-sm font-semibold mb-3">Teklif Kaynakları</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {stats.byType.map((t) => (
            <div key={t.id} className="text-center border border-ink-200 rounded-lg p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-semibold">{t.cnt}</div>
              <div className="text-xs text-ink-500 mt-1 break-words">{t.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
