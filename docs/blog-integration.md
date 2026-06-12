# Blog Entegrasyonu — CRM → CAWELT sitesi

CRM paneli, CAWELT sitesinin (`Sirket-site`, Next.js) blogunu besleyen **headless
CMS** olarak çalışır. Yazılar panelden Markdown ile yazılır; site içeriği
sunucu-sunucuya CRM'in public API'sinden çeker ve bir yazı kaydedildiğinde
webhook ile **anında** tazelenir.

## Mimari

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  CRM (Express :4000)     │         │  Site (Next.js :3000)    │
│                          │         │                          │
│  Panel ── JWT CRUD ──►   │         │   /blog, /blog/[slug]    │
│  blog_posts (MySQL)      │         │   sitemap.xml, rss.xml   │
│                          │         │                          │
│  GET /api/public/blog ◄──┼─ fetch ─┤  lib/blog.ts (force-cache│
│   (yetkisiz, yayınlanan) │ localhost│   + tag "blog")         │
│                          │         │                          │
│  kaydet/sil ──webhook───►┼─────────┤  POST /api/revalidate    │
│  (x-webhook-secret)      │  secret │  → revalidateTag/Path    │
└─────────────────────────┘         └──────────────────────────┘
        crm.alanadi.com                     www.alanadi.com
        (nginx → :4000)                     (nginx → :3000)
```

İki uygulama **aynı sunucuda** ayrı portlarda çalışır. Birbirleriyle
`127.0.0.1` (localhost) üzerinden konuşur — bu trafik internete çıkmaz, hızlıdır
ve public blog API'sini dışarı açmaya gerek kalmaz. Öndeki nginx, iki alan adını
ilgili porta yönlendirir.

## Kurulum

### 1) Veritabanı migration'ı

```bash
mysql -u root -p noname_crm < backend/src/db/migrations/007_blog_posts.sql
```

> Canlı veritabanında çalıştırmadan önce `docs/production-data-safety.md`
> adımlarını uygula. Bu migration yalnızca yeni `blog_posts` tablosunu ekler,
> mevcut tabloları **etkilemez**.

### 2) CRM backend `.env`

```ini
# Aynı sunucuda Next.js localhost'ta ise dahili adresi kullan
SITE_REVALIDATE_URL=http://127.0.0.1:3000/api/revalidate
SITE_REVALIDATE_SECRET=uzun-rastgele-ortak-bir-sir
```

Boş bırakılırsa webhook devre dışı kalır (panel yine çalışır, site bir sonraki
derlemede/ziyarette güncellenir).

### 3) Site `.env.local`

```ini
CRM_API_URL=http://127.0.0.1:4000/api/public/blog
REVALIDATE_SECRET=uzun-rastgele-ortak-bir-sir   # CRM'deki ile AYNI olmalı
```

`CRM_API_URL` tanımlı değilse site, kod içindeki yerel örnek yazılarla çalışır
(geliştirme/geçiş için güvenli fallback).

### 4) nginx (örnek)

```nginx
server {                      # CRM paneli
  server_name crm.alanadi.com;
  location / { proxy_pass http://127.0.0.1:4000; }
}
server {                      # Site
  server_name www.alanadi.com alanadi.com;
  location / { proxy_pass http://127.0.0.1:3000; }
}
```

## API uçları

### Public (yetki yok — yalnızca yayınlanan yazılar)

| Metot | Yol                              | Açıklama                          |
| ----- | -------------------------------- | --------------------------------- |
| GET   | `/api/public/blog/posts`         | Liste (gövdesiz özet)             |
| GET   | `/api/public/blog/posts/:slug`   | Tek yazı (gövde blokları + FAQ)   |

### Admin (JWT cookie — CRM paneli)

| Metot  | Yol                     | Açıklama                          |
| ------ | ----------------------- | --------------------------------- |
| GET    | `/api/blog/posts`       | Tümü (taslaklar dahil)            |
| GET    | `/api/blog/posts/:id`   | Düzenleme için tam kayıt          |
| POST   | `/api/blog/posts`       | Oluştur → site'a webhook          |
| PUT    | `/api/blog/posts/:id`   | Güncelle → site'a webhook         |
| DELETE | `/api/blog/posts/:id`   | Sil → site'a webhook              |

## İçerik: Markdown

Yazar panelde Markdown yazar; backend kaydederken bunu sitenin beklediği
yapısal bloklara (`body_json`) çevirir (`src/utils/markdown.ts`). Site bu
blokları doğrudan render eder — sitede ayrıca markdown ayrıştırma yoktur.

Desteklenen söz dizimi:

| Yazım                       | Sonuç                                  |
| --------------------------- | -------------------------------------- |
| İlk paragraf                | `lead` (giriş, vurgulu stil)           |
| `## Başlık` / `### Başlık`  | `h2` / `h3` (içindekiler `h2`'den)     |
| `- madde` / `* madde`       | sırasız liste                          |
| `1. madde`                  | sıralı liste                           |
| `> alıntı` + `> — Kaynak`   | alıntı (+ kaynak)                      |
| `:::callout … :::`          | vurgu kutusu                           |
| ` ```lang … ``` `           | kod bloğu                              |
| `**kalın**` `*italik*` `[m](url)` `` `kod` `` | satır içi (sitede işlenir) |

İç linkler (`/iletisim`, `/blog/...`) SEO için önemlidir; `[metin](/yol)` yazımı
sitede otomatik `next/link`'e dönüşür.

## Güncelleme nasıl anında oluyor?

1. Panelde yazı kaydedilir → backend `body_json` üretir, DB'ye yazar.
2. Backend, site'ın `/api/revalidate` ucuna `x-webhook-secret` ve `slug` ile
   POST atar (yangın-ve-unut, paneli yavaşlatmaz).
3. Site `revalidateTag("blog", "max")` + ilgili `revalidatePath` çağırır.
   Bir sonraki ziyarette içerik **stale-while-revalidate** ile tazelenir
   (Next.js 16'da blog için önerilen davranış).

Yeni bir yazı yayınlandığında, site derlemesi gerekmeden, ilk ziyarette
`/blog/<slug>` sayfası talep anında üretilir (`dynamicParams`).

## Durum / fallback davranışı

- CRM erişilemezse → site yerel örnek içerikle çalışmaya devam eder, çökmez.
- `status = draft` → sitede görünmez, public API döndürmez.
- `status = published` + tarih boş → bugünün tarihi atanır.
