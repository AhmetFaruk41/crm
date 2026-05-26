import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CircleDollarSign, Eye, FileDown, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable, { type Column } from '../components/DataTable';
import { confirm } from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import { Field } from '../components/Field';
import { addDaysISO, formatDate, formatDateTime, formatMoney, todayISO } from '../lib/format';
import type { Job, Personel, ProjectRow } from '../types';

const STATUS = [
  { value: 0, label: 'Planlama', cls: 'badge-neutral' },
  { value: 1, label: 'Başlamadı', cls: 'badge-neutral' },
  { value: 2, label: 'Devam Ediyor', cls: 'badge-success' },
  { value: 3, label: 'Müşteri Bekleniyor', cls: 'badge-warning' },
  { value: 4, label: 'Revizyonda', cls: 'badge-warning' },
  { value: 5, label: 'Askıda', cls: 'badge-neutral' },
  { value: 6, label: 'Tamamlandı', cls: 'badge-success' },
  { value: 7, label: 'İptal Edildi', cls: 'badge-danger' },
];

const PRIORITY = [
  { value: 0, label: 'Düşük', cls: 'badge-neutral' },
  { value: 1, label: 'Normal', cls: 'badge-neutral' },
  { value: 2, label: 'Yüksek', cls: 'badge-warning' },
  { value: 3, label: 'Acil', cls: 'badge-danger' },
];

const STAGE_STATUS = [
  { value: 0, label: 'Bekliyor' },
  { value: 1, label: 'Devam Ediyor' },
  { value: 2, label: 'Tamamlandı' },
];

const TASK_STATUS = [
  { value: 0, label: 'Yapılacak' },
  { value: 1, label: 'Devam Ediyor' },
  { value: 2, label: 'Kontrol Bekliyor' },
  { value: 3, label: 'Tamamlandı' },
  { value: 4, label: 'İptal' },
];

function statusInfo(status: number) {
  return STATUS.find((s) => s.value === status) ?? STATUS[0];
}

function priorityInfo(priority: number) {
  return PRIORITY.find((p) => p.value === priority) ?? PRIORITY[1];
}

function isOverdue(project: Pick<ProjectRow, 'status' | 'projectEndDate'>) {
  return ![6, 7].includes(project.status) && project.projectEndDate < todayISO();
}

function deadlineLabel(project: Pick<ProjectRow, 'status' | 'projectEndDate'>) {
  if (project.status === 6) return <span className="badge-success">Tamamlandı</span>;
  if (project.status === 7) return <span className="badge-neutral">İptal</span>;
  const days = Math.ceil((new Date(project.projectEndDate + 'T00:00:00').getTime() - new Date(todayISO() + 'T00:00:00').getTime()) / 86400000);
  if (days < 0) return <span className="badge-danger">{Math.abs(days)} gün gecikti</span>;
  if (days === 0) return <span className="badge-warning">Bugün teslim</span>;
  return <span className="text-xs text-ink-600">{days} gün kaldı</span>;
}

export function ProjectsList() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

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

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((row) => {
      if (statusFilter && row.status !== Number(statusFilter)) return false;
      if (priorityFilter && row.priority !== Number(priorityFilter)) return false;
      return !onlyOverdue || isOverdue(row);
    });
  }, [onlyOverdue, priorityFilter, rows, statusFilter]);

  const summary = useMemo(() => ({
    active: rows?.filter((r) => ![6, 7].includes(r.status)).length ?? 0,
    overdue: rows?.filter(isOverdue).length ?? 0,
    waiting: rows?.filter((r) => r.status === 3).length ?? 0,
    completed: rows?.filter((r) => r.status === 6).length ?? 0,
  }), [rows]);

  const cols: Column<ProjectRow>[] = [
    { key: 'offerID', header: 'No', sortValue: (r) => r.offerID, render: (r) => <Link className="hover:underline" to={`/projects/${r.offerID}`}>#{r.offerID}</Link> },
    { key: 'status', header: 'Durum', render: (r) => (
      <select className="input py-1 text-xs w-full md:w-44" value={r.status} onChange={(e) => setStatus(r.offerID, Number(e.target.value))}>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    ) },
    { key: 'priority', header: 'Öncelik', render: (r) => {
      const p = priorityInfo(r.priority);
      return <span className={p.cls}>{p.label}</span>;
    } },
    { key: 'title', header: 'Proje', sortValue: (r) => r.title, render: (r) => (
      <div>
        <Link to={`/projects/${r.offerID}`} className="font-medium hover:underline">{r.title}</Link>
        <div className="text-xs text-ink-500">{r.clientTitle ?? '-'}</div>
      </div>
    ) },
    { key: 'personelName', header: 'Sorumlu' },
    { key: 'progress', header: 'İlerleme', sortValue: (r) => r.progress, render: (r) => (
      <div className="min-w-24">
        <div className="text-xs mb-1">%{r.progress}</div>
        <div className="h-2 rounded bg-ink-100"><div className="h-2 rounded bg-ink-700" style={{ width: `${r.progress}%` }} /></div>
      </div>
    ) },
    { key: 'projectEndDate', header: 'Termin', sortValue: (r) => r.projectEndDate, render: (r) => (
      <div><div>{formatDate(r.projectEndDate)}</div>{deadlineLabel(r)}</div>
    ) },
    { key: 'paid', header: 'Ödeme', render: (r) => (
      <div className="whitespace-nowrap">
        <div>{formatMoney(r.paid)} / {formatMoney(r.total)}</div>
        <div className="text-xs text-ink-500">%{Number(r.total) > 0 ? Math.round((Number(r.paid) / Number(r.total)) * 100) : 0} tahsil</div>
      </div>
    ) },
    { key: '_actions', header: '', width: '205px', render: (r) => (
      <div className="flex gap-1 flex-wrap">
        <Link to={`/projects/${r.offerID}`} className="btn-ghost p-2" title="Detay"><Eye size={14} /></Link>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Summary label="Aktif Proje" value={summary.active} />
        <Summary label="Geciken" value={summary.overdue} danger={summary.overdue > 0} />
        <Summary label="Müşteri Bekleyen" value={summary.waiting} />
        <Summary label="Tamamlanan" value={summary.completed} />
      </div>
      <div className="card card-body mb-4 flex flex-col md:flex-row gap-3">
        <select className="input md:w-52" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm durumlar</option>
          {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input md:w-44" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">Tüm öncelikler</option>
          {PRIORITY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-700 px-2">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          Yalnız geciken projeler
        </label>
      </div>
      <DataTable rows={visibleRows} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.offerID} ${r.title} ${r.clientTitle ?? ''} ${r.personelName ?? ''}`} />
    </div>
  );
}

function Summary({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`card card-body ${danger ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${danger ? 'text-red-700' : ''}`}>{value}</div>
    </div>
  );
}

export function ProjectDetail() {
  const { offerId } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [personnel, setPersonnel] = useState<Personel[]>([]);
  const [busy, setBusy] = useState(false);
  const [stageDraft, setStageDraft] = useState({ title: '', description: '', start_date: '', end_date: '' });
  const [taskStageId, setTaskStageId] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', personel_id: 0, priority: 1, due_date: '' });

  async function load() {
    const [detail, people] = await Promise.all([
      api.get(`/projects/by-offer-id/${offerId}/detail`),
      api.get<Personel[]>('/personnel'),
    ]);
    setData(detail.data);
    setPersonnel(people.data);
  }

  useEffect(() => { load(); }, [offerId]);

  async function addStage(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/projects/by-offer-id/${offerId}/stages`, stageDraft);
      setStageDraft({ title: '', description: '', start_date: '', end_date: '' });
      toast.success('Aşama eklendi');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function updateStageStatus(stageId: number, status: number) {
    await api.put(`/projects/by-offer-id/${offerId}/stages/${stageId}/status`, { status });
    await load();
  }

  async function deleteStage(stageId: number) {
    if (!await confirm({ message: 'Aşama silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/projects/by-offer-id/${offerId}/stages/${stageId}`);
    toast.success('Aşama silindi');
    await load();
  }

  async function addTask(e: FormEvent, stageId: number) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/projects/by-offer-id/${offerId}/stages/${stageId}/tasks`, taskDraft);
      setTaskDraft({ title: '', description: '', personel_id: 0, priority: 1, due_date: '' });
      setTaskStageId(null);
      toast.success('Görev eklendi');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskStatus(taskId: number, status: number) {
    await api.put(`/projects/by-offer-id/${offerId}/tasks/${taskId}/status`, { status });
    await load();
  }

  async function deleteTask(taskId: number) {
    if (!await confirm({ message: 'Görev silinsin mi?', danger: true, confirmLabel: 'Sil' })) return;
    await api.delete(`/projects/by-offer-id/${offerId}/tasks/${taskId}`);
    toast.success('Görev silindi');
    await load();
  }

  if (!data) return <Loading />;
  const project = data.project;
  const status = statusInfo(project.status);
  const priority = priorityInfo(project.priority);
  const remaining = Number(project.total) - Number(project.paid);

  return (
    <div>
      <PageHeader
        title={project.title}
        crumbs={[{ label: 'Anasayfa', to: '/' }, { label: 'Projeler', to: '/projects' }, { label: 'Detay' }]}
        actions={
          <div className="flex gap-2">
            <Link to={`/billings/${offerId}`} className="btn-secondary"><CircleDollarSign size={14} /> Ödemeler</Link>
            <Link to={`/projects/${offerId}/edit`} className="btn-primary"><Pencil size={14} /> Düzenle</Link>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card card-body">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={status.cls}>{status.label}</span>
              <span className={priority.cls}>{priority.label} öncelik</span>
              {isOverdue({ status: project.status, projectEndDate: project.end_date }) && <span className="badge-danger"><AlertCircle size={12} className="mr-1" /> Gecikmiş</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <DetailValue label="Müşteri" value={project.client_title ?? '-'} />
              <DetailValue label="Sorumlu" value={project.personel_name ?? '-'} />
              <DetailValue label="Proje Tipi" value={project.type_title ?? '-'} />
              <DetailValue label="No" value={`#${project.offer_id}`} />
              <DetailValue label="Başlangıç" value={formatDate(project.start_date)} />
              <DetailValue label="Termin" value={formatDate(project.end_date)} />
              <DetailValue label="Son Güncelleme" value={formatDateTime(project.updated_at)} />
              <DetailValue label="Termin Durumu" value={deadlineLabel({ status: project.status, projectEndDate: project.end_date })} />
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm mb-2"><span>İlerleme</span><strong>%{project.progress}</strong></div>
              <div className="h-3 rounded bg-ink-100"><div className="h-3 rounded bg-ink-800" style={{ width: `${project.progress}%` }} /></div>
            </div>
            {project.description && <div className="mt-5 text-sm whitespace-pre-wrap border-t border-ink-100 pt-4">{project.description}</div>}
          </div>
          <div className="card card-body">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold">Proje Adımları</h3>
                <p className="text-xs text-ink-500 mt-1">Tamamlanan ve devam eden işler sıralı olarak izlenir.</p>
              </div>
              <span className="text-xs text-ink-500">{data.stages.length} aşama</span>
            </div>
            <form onSubmit={addStage} className="border border-ink-200 rounded-lg p-3 mb-4 space-y-3">
              <div className="text-sm font-medium">Yeni Aşama</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input className="input" value={stageDraft.title} onChange={(e) => setStageDraft({ ...stageDraft, title: e.target.value })} placeholder="Ör. Tasarım" required />
                <input type="date" className="input" value={stageDraft.start_date} onChange={(e) => setStageDraft({ ...stageDraft, start_date: e.target.value })} />
                <input type="date" className="input" value={stageDraft.end_date} onChange={(e) => setStageDraft({ ...stageDraft, end_date: e.target.value })} />
              </div>
              <input className="input" value={stageDraft.description} onChange={(e) => setStageDraft({ ...stageDraft, description: e.target.value })} placeholder="Aşama açıklaması (isteğe bağlı)" />
              <button className="btn-secondary" type="submit" disabled={busy}>Aşama Ekle</button>
            </form>
            {data.stages.length === 0 ? (
              <div className="text-sm text-ink-500 py-4">Henüz aşama eklenmedi. İlk çalışma adımını yukarıdan oluşturun.</div>
            ) : (
              <div className="space-y-4">
                {data.stages.map((stage: any, index: number) => {
                  const tasks = data.tasks.filter((task: any) => task.stage_id === stage.id);
                  return (
                    <div key={stage.id} className="border border-ink-200 rounded-lg p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <div className="h-7 w-7 shrink-0 rounded-full bg-ink-900 text-white text-xs grid place-items-center">{index + 1}</div>
                          <div>
                            <div className="font-semibold">{stage.title}</div>
                            {stage.description && <div className="text-sm text-ink-600 mt-1">{stage.description}</div>}
                            <div className="text-xs text-ink-500 mt-1">
                              {stage.start_date || stage.end_date ? `${formatDate(stage.start_date) || '-'} - ${formatDate(stage.end_date) || '-'}` : 'Tarih belirlenmedi'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <select className="input py-1 text-xs w-40" value={stage.status} onChange={(e) => updateStageStatus(stage.id, Number(e.target.value))}>
                            {STAGE_STATUS.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}
                          </select>
                          <button type="button" className="btn-ghost p-2 text-red-600" onClick={() => deleteStage(stage.id)} title="Aşamayı sil"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-4 ml-0 md:ml-10 space-y-2">
                        {tasks.map((task: any) => {
                          const overdue = task.due_date && ![3, 4].includes(Number(task.status)) && task.due_date < todayISO();
                          return (
                            <div key={task.id} className="rounded border border-ink-100 bg-ink-50 px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{task.title}</div>
                                <div className="text-xs text-ink-500 flex flex-wrap gap-2 mt-1">
                                  <span>{task.personel_name ?? 'Atanmamış'}</span>
                                  {task.due_date && <span className={overdue ? 'text-red-600' : ''}>{overdue ? 'Gecikti: ' : 'Termin: '}{formatDate(task.due_date)}</span>}
                                  <span>{priorityInfo(Number(task.priority)).label} öncelik</span>
                                </div>
                              </div>
                              <select className="input py-1 text-xs md:w-44" value={task.status} onChange={(e) => updateTaskStatus(task.id, Number(e.target.value))}>
                                {TASK_STATUS.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}
                              </select>
                              <button type="button" className="btn-ghost p-2 text-red-600" onClick={() => deleteTask(task.id)} title="Görevi sil"><Trash2 size={14} /></button>
                            </div>
                          );
                        })}
                        {taskStageId === stage.id ? (
                          <form onSubmit={(e) => addTask(e, stage.id)} className="rounded border border-ink-200 bg-white p-3 space-y-2">
                            <input className="input" value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="Görev başlığı" required />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <select className="input" value={taskDraft.personel_id} onChange={(e) => setTaskDraft({ ...taskDraft, personel_id: Number(e.target.value) })}>
                                <option value={0}>Sorumlu seçilmedi</option>
                                {personnel.map((person) => <option key={person.id} value={person.id}>{person.fullname}</option>)}
                              </select>
                              <select className="input" value={taskDraft.priority} onChange={(e) => setTaskDraft({ ...taskDraft, priority: Number(e.target.value) })}>
                                {PRIORITY.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}
                              </select>
                              <input type="date" className="input" value={taskDraft.due_date} onChange={(e) => setTaskDraft({ ...taskDraft, due_date: e.target.value })} />
                            </div>
                            <input className="input" value={taskDraft.description} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} placeholder="Görev açıklaması (isteğe bağlı)" />
                            <div className="flex gap-2">
                              <button type="submit" className="btn-primary" disabled={busy}>Görevi Kaydet</button>
                              <button type="button" className="btn-secondary" onClick={() => setTaskStageId(null)}>Vazgeç</button>
                            </div>
                          </form>
                        ) : (
                          <button type="button" className="btn-ghost text-xs" onClick={() => setTaskStageId(stage.id)}>+ Görev Ekle</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card card-body">
            <h3 className="font-semibold mb-1">Kronolojik Geçmiş</h3>
            <p className="text-xs text-ink-500 mb-4">Proje, adım, görev ve ödeme üzerinde daha önce yapılan işlemler.</p>
            {data.activities.length === 0 ? <div className="text-sm text-ink-500">Kayıtlı aktivite yok.</div> : (
              <div className="space-y-3">
                {data.activities.map((activity: any) => (
                  <div key={activity.id} className="border-l-2 border-ink-200 pl-3 text-sm">
                    <div>{activity.description}</div>
                    <div className="text-xs text-ink-500 mt-1">{activity.user_name ?? 'Sistem'} · {formatDateTime(activity.create_date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card card-body space-y-3">
            <h3 className="font-semibold">Finans Özeti</h3>
            <DetailValue label="Proje Bedeli" value={formatMoney(project.price)} />
            <DetailValue label={`KDV (%${project.kdv})`} value={formatMoney(Number(project.total) - Number(project.price))} />
            <DetailValue label="Toplam" value={formatMoney(project.total)} />
            <DetailValue label="Tahsil Edilen" value={formatMoney(project.paid)} />
            <DetailValue label="Kalan" value={formatMoney(remaining)} />
          </div>
          <div className="card card-body">
            <h3 className="font-semibold mb-3">Son Ödemeler</h3>
            {data.billings.length === 0 ? <div className="text-sm text-ink-500">Ödeme kaydı yok.</div> : data.billings.slice(0, 5).map((billing: any) => (
              <div key={billing.id} className="py-2 border-b border-ink-100 last:border-0 flex justify-between text-sm">
                <span>{formatDate(billing.create_date)}</span>
                <strong>{formatMoney(billing.pay)}</strong>
              </div>
            ))}
            <Link to={`/billings/${offerId}`} className="btn-secondary w-full mt-3">Ödeme Planı ve Geçmişi</Link>
          </div>
          <div className="card card-body">
            <h3 className="font-semibold mb-3">Ödeme Planı</h3>
            {data.paymentPlans.length === 0 ? <div className="text-sm text-ink-500">Planlı ödeme yok.</div> : data.paymentPlans.slice(0, 4).map((plan: any) => {
              const paid = Number(plan.paid);
              const remainingPlan = Number(plan.amount) - paid;
              const overdue = remainingPlan > 0 && plan.due_date < todayISO();
              return (
                <div key={plan.id} className="py-2 border-b border-ink-100 last:border-0 text-sm">
                  <div className="flex justify-between gap-2"><span>{plan.title}</span><strong>{formatMoney(plan.amount)}</strong></div>
                  <div className={`text-xs mt-1 ${overdue ? 'text-red-600' : 'text-ink-500'}`}>{formatDate(plan.due_date)} · {remainingPlan <= 0 ? 'Ödendi' : overdue ? 'Gecikti' : `${formatMoney(paid)} ödendi`}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

export function ProjectForm() {
  const { offerId: paramOfferId } = useParams();
  const [searchParams] = useSearchParams();
  const offerId = paramOfferId ?? searchParams.get('offer');
  const editing = Boolean(paramOfferId);
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [personnel, setPersonnel] = useState<Personel[]>([]);
  const [data, setData] = useState({
    title: '', description: '', personel_id: 0, start_date: todayISO(), end_date: addDaysISO(30), kdv: 20, priority: 1, progress: 0,
  });

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
          description: r.data.project.description ?? '',
          personel_id: r.data.project.personel_id,
          start_date: String(r.data.project.start_date).slice(0, 10),
          end_date: String(r.data.project.end_date).slice(0, 10),
          kdv: Number(r.data.project.kdv),
          priority: Number(r.data.project.priority),
          progress: Number(r.data.project.progress),
        });
      } else {
        setData((current) => ({ ...current, title: r.data.agreement?.agreement_title ?? r.data.offer?.offer_title ?? '' }));
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
            <Field label="Proje Numarası"><input className="input" value={offer.offer_id} disabled /></Field>
            <Field label="Sözleşme Tutarı"><input className="input" value={formatMoney(agreement?.price ?? project?.price ?? 0)} disabled /></Field>
          </div>
          <Field label="Proje Başlığı">
            <input className="input" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} required />
          </Field>
          <Field label="Açıklama">
            <textarea className="input min-h-24" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="Kapsam, teslim beklentileri veya takip notu" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Sorumlu Personel">
              <select className="input" value={data.personel_id} onChange={(e) => setData({ ...data, personel_id: Number(e.target.value) })} required>
                <option value={0} disabled>Seçiniz</option>
                {personnel.map((p) => <option key={p.id} value={p.id}>{p.fullname}</option>)}
              </select>
            </Field>
            <Field label="Öncelik">
              <select className="input" value={data.priority} onChange={(e) => setData({ ...data, priority: Number(e.target.value) })}>
                {PRIORITY.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
              </select>
            </Field>
            <Field label="İlerleme (%)">
              <input type="number" min={0} max={100} className="input" value={data.progress} onChange={(e) => setData({ ...data, progress: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="KDV (%)">
              <input type="number" min={0} max={100} className="input" value={data.kdv} onChange={(e) => setData({ ...data, kdv: Number(e.target.value) })} />
            </Field>
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
