import { env } from '../config/env.js';

/**
 * CAWELT sitesine "blog içeriği değişti, tazele" sinyali gönderir.
 * Yangın-ve-unut: ana isteği bloklamaz, hata olursa sadece loglar.
 * `slug` verilirse site o yazının sayfasını da hedefli tazeler.
 */
export function triggerSiteRevalidate(slug?: string): void {
  if (!env.SITE_REVALIDATE_URL || !env.SITE_REVALIDATE_SECRET) return;

  void fetch(env.SITE_REVALIDATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': env.SITE_REVALIDATE_SECRET,
    },
    body: JSON.stringify({ slug: slug ?? null }),
  }).catch((err) => {
    console.error('[blog] site revalidate webhook başarısız:', err?.message ?? err);
  });
}
