# Canli Veri Guvenligi ve Yayin Sirasi

Bu dokuman, mevcut musteri, teklif, sozlesme, proje ve finans verileri
korunarak yeni modullerin canli ortama alinmasi icin uygulanacak sirayi tutar.

## Kritik Kural

- Canli veya veri bulunan bir veritabaninda `backend/src/db/schema.sql`
  calistirilmaz. Bu dosyada `DROP TABLE` ifadeleri vardir ve mevcut veriyi
  siler.
- Canli ortamda `backend/src/db/seed.sql` calistirilmaz.
- Yalniz `backend/src/db/migrations/` altindaki migration dosyalari, sirayla
  ve yedek alindiktan sonra uygulanir.

## Yayin Oncesi Yedek

Asagidaki komuttaki baglanti ve dosya yolu canli ortam bilgilerine gore
degistirilmelidir:

```bash
mysqldump --single-transaction --routines --triggers -h DB_HOST -u DB_USER -p DB_NAME > crm-before-release-YYYYMMDD.sql
```

Yedek dosyasi olustuktan ve boyutunun sifirdan buyuk oldugu
dogrulandiktan sonra migration asamasina gecilir.

## Migration Sirasi

Ilk olarak ayni teklife bagli birden fazla proje olup olmadigi kontrol edilir:

```sql
SELECT offer_id, COUNT(*) AS project_count
FROM projects
GROUP BY offer_id
HAVING COUNT(*) > 1;
```

Sonuc bos degilse `001_project_tracking_phase1.sql` uygulanmaz; yinelenen
projeler is karariyla incelenmeden benzersiz indeks eklenemez.

Sonuc bossa, daha once uygulanmamis migration'lar asagidaki sirayla uygulanir:

```bash
mysql -h DB_HOST -u DB_USER -p DB_NAME < backend/src/db/migrations/001_project_tracking_phase1.sql
mysql -h DB_HOST -u DB_USER -p DB_NAME < backend/src/db/migrations/002_project_workflow_and_payment_plans.sql
mysql -h DB_HOST -u DB_USER -p DB_NAME < backend/src/db/migrations/003_finance_transactions.sql
mysql -h DB_HOST -u DB_USER -p DB_NAME < backend/src/db/migrations/004_sales_leads_pipeline.sql
```

Bu migration'lar mevcut musteri, teklif, sozlesme ve proje satirlarini
silmez. `001` mevcut eski proje durumlarini yeni durum modeline tasir.

## Aday Musteri CSV Aktarimi

`leads_with_email.csv` aktarimi canli veritabanina dogrudan tablo temizleme
veya mevcut satir guncelleme komutu ile yapilmaz.

Aktarim kurallari:

- Var olan `clients`, `offers` ve `leads` satirlari silinmez veya ezilmez.
- Ayni `firma adi + telefon` kombinasyonu sistemde veya CSV icinde bulunuyorsa
  yeni satir atlanir.
- Teknik takip e-posta adresleri (`sentry`, `wixpress` vb.) iletisim
  e-postasi olarak kaydedilmez.
- Iceri aktarma kaynagi sabit tutulur: `Google Maps E-Posta Listesi`.
- Aktarimdan once ve sonra kaynak bazli kayit sayilari raporlanir.

Aktarimdan once kontrol:

```sql
SELECT COUNT(*) FROM leads;
SELECT source, COUNT(*) FROM leads GROUP BY source;
```

Aktarimdan sonra kontrol:

```sql
SELECT source, COUNT(*) AS records,
       SUM(temperature = 'hot') AS hot,
       SUM(temperature = 'warm') AS warm,
       SUM(temperature = 'cold') AS cold
FROM leads
GROUP BY source;
```

## Yayindan Sonra Kontrol

- Uygulama girisi ve `/api/dashboard/stats` calisir durumda olmali.
- Mevcut musteriler, teklifler, sozlesmeler ve projeler listelerinde kayip
  olmadigi ornek kayitlarla kontrol edilmelidir.
- Potansiyel musteri Kanban ekrani acilmali; yeni aday olusturma ve asama
  degistirme islemi test edilmelidir.
- Gelir/gider ve proje detay ekranlari hata vermeden yuklenmelidir.
