const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export function dateformat3(input?: string | Date | null): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input.includes('T') ? input : input + 'T00:00:00') : input;
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()}`;
}

export function permalink(s: string): string {
  if (!s) return '';
  const repl: Record<string, string> = {
    'Ç':'c','Ş':'s','Ğ':'g','Ü':'u','İ':'i','Ö':'o',
    'ç':'c','ş':'s','ğ':'g','ü':'u','ö':'o','ı':'i',
    '+':'plus','#':'sharp',
  };
  let out = s;
  for (const k of Object.keys(repl)) out = out.replaceAll(k, repl[k]);
  out = out.toLowerCase().replace(/[?!:;&=.]/g, '');
  out = out.replace(/[^a-z0-9\-_.+]+/gi, ' ').trim().replace(/\s+/g, '-');
  return out;
}
