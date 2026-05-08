# noname CRM

Teklif / sözleşme / proje yönetim paneli — React + Node.js + MySQL.

## Çalıştırma

### 1) Veritabanı (tek seferlik)

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS noname_crm DEFAULT CHARSET=utf8mb4;"
mysql -u root -p noname_crm < backend/src/db/schema.sql
mysql -u root -p noname_crm < backend/src/db/seed.sql
```

> Mevcut bir kurulumda sadece teklif şablonları tablolarını eklemek için
> `schema.sql` dosyasındaki `offer_templates` ve `offer_template_matters`
> CREATE bloklarını çalıştırın, ardından `seed.sql` içinden örnek şablon
> INSERT'lerini elle koşturabilirsiniz.

### 2) Backend

```bash
cd backend
npm install
# .env içindeki DB_PASS'ı kendi MySQL şifrenle güncelle
npm run seed:admin   # admin / admin123 kullanıcısını oluşturur
npm run dev          # http://localhost:4000
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Modüller

- **Anasayfa** – istatistikler, geciken teklifler
- **Teklifler** – CRUD + durum + revize + PDF, şablondan oluşturma
- **Teklif Şablonları** – sık kullanılan teklifler için hazır şablonlar (sunucu, web, e-ticaret, mobil, dijital pazarlama, grafik, video); tekliften şablon oluşturma desteği
- **Sözleşmeler** – tekliften sözleşme oluştur, madde seç, PDF
- **Projeler** – sözleşmeden proje başlat, durum yönetimi
- **Ödemeler** – proje bazlı ödeme takibi
- **Müşteriler** – CRUD + logo upload
- **Personel** – proje atanan kişiler
- **Kullanıcılar** – panel kullanıcıları, yetki düzeyi
- **Domainler** – domain takibi, abonelik fiyatlandırma, ödeme durumu
