# noname CRM

Teklif / sözleşme / proje yönetim paneli — React + Node.js + MySQL.

## Çalıştırma

### 1) Veritabanı (tek seferlik)

> `backend/src/db/schema.sql` ve `backend/src/db/seed.sql` yalnızca boş/yeni
> kurulum içindir. Mevcut veya canlı bir veritabanında `schema.sql` çalıştırmak
> tabloları sileceği için veri kaybına neden olur.

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS noname_crm DEFAULT CHARSET=utf8mb4;"
mysql -u root -p noname_crm < backend/src/db/schema.sql
mysql -u root -p noname_crm < backend/src/db/seed.sql
```

> Mevcut bir kurulumda sadece teklif şablonları tablolarını eklemek için
> `schema.sql` dosyasındaki `offer_templates` ve `offer_template_matters`
> CREATE bloklarını çalıştırın, ardından `seed.sql` içinden örnek şablon
> INSERT'lerini elle koşturabilirsiniz.

Mevcut bir kurulumda proje takibi Faz 1 alanlarını eklemek için önce
yinelenen proje kontrolü dahil migration dosyasını inceleyip uygulayın:

```bash
mysql -u root -p noname_crm < backend/src/db/migrations/001_project_tracking_phase1.sql
mysql -u root -p noname_crm < backend/src/db/migrations/002_project_workflow_and_payment_plans.sql
mysql -u root -p noname_crm < backend/src/db/migrations/003_finance_transactions.sql
mysql -u root -p noname_crm < backend/src/db/migrations/004_sales_leads_pipeline.sql
mysql -u root -p noname_crm < backend/src/db/migrations/007_blog_posts.sql
mysql -u root -p noname_crm < backend/src/db/migrations/008_foreign_keys_and_indexes.sql
mysql -u root -p noname_crm < backend/src/db/migrations/009_money_decimal.sql
mysql -u root -p noname_crm < backend/src/db/migrations/010_drive.sql
```

> `008` foreign key ve eksik index ekler; canlıda çalıştırmadan önce dosya
> başındaki öksüz-kayıt kontrol sorgularını koştur. `009` para alanlarını
> FLOAT'tan DECIMAL'e çevirir.

Canlı veritabanı migration ve aday içe aktarma güvenlik adımları:
[`docs/production-data-safety.md`](docs/production-data-safety.md).

Blog modülünün CAWELT sitesiyle entegrasyonu (API, webhook, env, nginx):
[`docs/blog-integration.md`](docs/blog-integration.md).

Geliştirme yol haritası ve tamamlanan adımlar:
[`docs/projects-roadmap.md`](docs/projects-roadmap.md).

### 2) Backend

```bash
cd backend
npm install
# .env içindeki DB_PASS'ı kendi MySQL şifrenle güncelle
ADMIN_PASSWORD=cok-guclu-bir-sifre npm run seed:admin   # 'admin' yöneticisini oluşturur
npm run dev          # http://localhost:4000
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Modüller

- **Anasayfa** – istatistikler, satış fırsatları, takip hatırlatmaları, geciken teklifler
- **Potansiyel Müşteriler** – satış hunisi, aday müşteri, görüşme geçmişi, takip tarihi ve teklife dönüştürme
- **Teklifler** – CRUD + durum + revize + PDF, şablondan oluşturma
- **Teklif Şablonları** – sık kullanılan teklifler için hazır şablonlar (sunucu, web, e-ticaret, mobil, dijital pazarlama, grafik, video); tekliften şablon oluşturma desteği
- **Sözleşmeler** – tekliften sözleşme oluştur, madde seç, PDF
- **Projeler** – sözleşmeden proje başlat, durum yönetimi
- **Ödemeler** – proje bazlı ödeme takibi
- **Gelir / Gider** – otomatik tahsilat gelirleri, ek gelir ve giderler, dönem özeti
- **Müşteriler** – CRUD + logo upload
- **Personel** – proje atanan kişiler
- **Kullanıcılar** – panel kullanıcıları, yetki düzeyi
- **Domainler** – domain takibi, abonelik fiyatlandırma, ödeme durumu
- **Blog** – CAWELT sitesinin blogunu besleyen yazılar (Markdown editör, taslak/yayın, SEO meta + SSS); kaydedince site webhook ile anında tazelenir ([`docs/blog-integration.md`](docs/blog-integration.md))
