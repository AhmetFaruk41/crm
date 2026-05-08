const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export function formatDate(input?: string | null): string {
  if (!input) return '';
  const d = new Date(input.includes('T') ? input : input + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatMoney(n: number | null | undefined, currency = '₺'): string {
  if (n == null) return '-';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(Number(n))) + ' ' + currency;
}

export function truncate(s: string | null | undefined, len = 80): string {
  if (!s) return '';
  const clean = String(s).replace(/<[^>]*>/g, '');
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
