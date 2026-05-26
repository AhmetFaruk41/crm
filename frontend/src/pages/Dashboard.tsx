import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, ScrollText, Briefcase, TrendingUp, TrendingDown, AlertCircle, FileDown, UserRoundSearch, Flame, CalendarClock } from 'lucide-react';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { formatDate, formatMoney, todayISO } from '../lib/format';

interface Stats {
  counts: { clientCount: number; offerCount: number; agreementCount: number; projectCount: number; leadCount: number };
  thisMonth: number;
  lastMonth: number;
  ratio: number | null;
  byType: { id: number; title: string; cnt: number }[];
  overdue: { id: number; offer_id: number; offer_title: string; final_date: string }[];
  pipeline: { stage: string; count: number; total: number }[];
  followUps: { id: number; company_name: string; contact_name: string | null; temperature: string; next_follow_up_date: string; stage: string }[];
  leadSummary: { active: number; won: number; lost: number; hot: number; overdue: number; potential: number };
}

const PIPELINE_LABELS: Record<string, string> = {
  new: 'Yeni Aday',
  contacted: 'İlk Temas',
  meeting: 'Görüşme',
  proposal_preparing: 'Teklif Hazırlanıyor',
  offer_sent: 'Teklif Gönderildi',
  follow_up: 'Takip',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>('/dashboard/stats').then((r) => setStats(r.data));
  }, []);

  if (!stats) return <Loading />;

  const cards = [
    { label: 'Aktif Aday', value: stats.counts.leadCount, icon: UserRoundSearch, link: '/leads' },
    { label: 'Müşteri', value: stats.counts.clientCount, icon: Building2, link: '/clients' },
    { label: 'Teklif', value: stats.counts.offerCount, icon: FileText, link: '/offers' },
    { label: 'Sözleşme', value: stats.counts.agreementCount, icon: ScrollText, link: '/agreements' },
    { label: 'Proje', value: stats.counts.projectCount, icon: Briefcase, link: '/projects' },
  ];

  const ratioGrowth = stats.ratio === null ? null : stats.ratio >= 0;

  return (
    <div>
      <PageHeader title="Anasayfa" crumbs={[{ label: 'Anasayfa' }]} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Yeni Müşteri Kazanımı</div>
            <Link to="/leads" className="text-sm text-ink-600 hover:underline">Satış hunisini aç</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="border border-ink-100 rounded-lg p-3">
              <div className="text-xs text-ink-500">Açık Potansiyel</div>
              <div className="font-semibold mt-1">{formatMoney(stats.leadSummary.potential)}</div>
            </div>
            <div className="border border-ink-100 rounded-lg p-3">
              <div className="text-xs text-ink-500 flex items-center gap-1"><Flame size={13} /> Sıcak Aday</div>
              <div className="text-xl font-semibold mt-1">{stats.leadSummary.hot}</div>
            </div>
            <div className="border border-ink-100 rounded-lg p-3">
              <div className="text-xs text-ink-500">Kazanılan</div>
              <div className="text-xl font-semibold text-green-700 mt-1">{stats.leadSummary.won}</div>
            </div>
            <div className="border border-ink-100 rounded-lg p-3">
              <div className="text-xs text-ink-500">Kaybedilen</div>
              <div className="text-xl font-semibold text-red-700 mt-1">{stats.leadSummary.lost}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(PIPELINE_LABELS).map(([stage, label]) => {
              const item = stats.pipeline.find((entry) => entry.stage === stage);
              return <div key={stage} className="bg-ink-50 rounded-lg px-3 py-2">
                <div className="text-xs text-ink-500">{label}</div>
                <div className="font-medium">{item?.count ?? 0} <span className="text-xs text-ink-500">{formatMoney(item?.total ?? 0)}</span></div>
              </div>
            })}
          </div>
        </div>

        <div className="card card-body">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarClock size={16} className="text-amber-600" /> Bugün ve Geciken Takipler
          </div>
          {stats.followUps.length === 0 ? (
            <div className="text-sm text-ink-500">Bekleyen takip bulunmuyor.</div>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-auto">
              {stats.followUps.map((lead) => (
                <li key={lead.id} className="text-sm border-b border-ink-100 pb-2 last:border-0">
                  <Link to={`/leads/${lead.id}`} className="font-medium hover:underline">{lead.company_name}</Link>
                  <div className={`text-xs mt-1 ${lead.next_follow_up_date < todayISO() ? 'text-red-600' : 'text-ink-500'}`}>
                    {formatDate(lead.next_follow_up_date)} {lead.temperature === 'hot' ? '- Sıcak aday' : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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

      <div className="card card-body mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Hazır Müşteri Formları</div>
            <div className="text-sm text-ink-500 mt-1">
              Yeni web sitesi isteyen müşterilere göndermek için hazır bilgi formu.
            </div>
          </div>
          <a
            href="/api/resources/web-sitesi-proje-bilgi-formu"
            className="btn-secondary shrink-0"
            download="Web Sitesi Proje Bilgi Formu.docx"
          >
            <FileDown size={16} /> Web Sitesi Proje Bilgi Formu
          </a>
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
