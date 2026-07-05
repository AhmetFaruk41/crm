const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export function formatDate(input?: string | null): string {
  if (!input) return '';
  const normalized = input.includes(' ') ? input.replace(' ', 'T') : input;
  const d = new Date(normalized.includes('T') ? normalized : normalized + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(input?: string | null): string {
  if (!input) return '';
  const normalized = input.includes(' ') ? input.replace(' ', 'T') : input;
  const d = new Date(normalized.includes('T') ? normalized : normalized + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()} ${time}`;
}

export function formatMoney(n: number | null | undefined, currency = '₺'): string {
  if (n == null) return '-';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n)) + ' ' + currency;
}

export function formatSize(bytes: number | null | undefined): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function truncate(s: string | null | undefined, len = 80): string {
  if (!s) return '';
  const clean = String(s).replace(/<[^>]*>/g, '');
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

export function todayISO(): string {
  return localISO(new Date());
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISO(d);
}

function localISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
