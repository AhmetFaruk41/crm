import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProd = NODE_ENV === 'production';

// Geliştirmede kolaylık için fallback'ler var; production'da zorunlu ve
// güvenli değerler beklenir. Eksik/zayıfsa uygulama BAŞLAMADAN hata verir
// (fail-fast) — böylece 'dev-secret' gibi tahmin edilebilir bir gizle
// canlıya çıkmak imkânsız olur.
const problems: string[] = [];

function required(name: string, value: string | undefined, opts: { minLength?: number } = {}): string {
  if (!value || !value.trim()) {
    if (isProd) problems.push(`${name} tanımlı değil`);
    return '';
  }
  if (opts.minLength && value.length < opts.minLength) {
    if (isProd) problems.push(`${name} en az ${opts.minLength} karakter olmalı`);
  }
  return value;
}

const JWT_SECRET = required('JWT_SECRET', process.env.JWT_SECRET, { minLength: 32 }) || 'dev-secret-only-for-local';
const DB_PASS = required('DB_PASS', process.env.DB_PASS);

if (isProd && problems.length) {
  console.error('[backend] Ortam değişkeni doğrulaması başarısız:\n  - ' + problems.join('\n  - '));
  console.error('[backend] .env dosyanı .env.example örneğine göre doldur ve tekrar başlat.');
  process.exit(1);
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_USER: process.env.DB_USER ?? 'root',
  DB_PASS,
  DB_NAME: process.env.DB_NAME ?? 'noname_crm',
  JWT_SECRET,
  COOKIE_NAME: process.env.COOKIE_NAME ?? 'noname_token',
  NODE_ENV,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  // CAWELT sitesine içerik tazeleme webhook'u (boşsa devre dışı).
  SITE_REVALIDATE_URL: process.env.SITE_REVALIDATE_URL ?? '',
  SITE_REVALIDATE_SECRET: process.env.SITE_REVALIDATE_SECRET ?? '',
  // Yüklenen görseller için mutlak URL üretiminde kullanılan CRM public origin'i
  // (örn. https://crm.cawelt.com). Boşsa istek başlığından türetilir.
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? '',
};
