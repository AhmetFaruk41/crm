# Proje Takibi Gelistirme Yol Haritasi

Bu belge `Projeler` modulunun operasyonel proje takibi icin gelistirilme planini
ve tamamlanma kriterlerini tutar. Isler veri butunlugu once, gunluk kullanim
sonra, raporlama en son gelecek sekilde siralanmistir.

## Faz 0 - Mevcut Riskleri Kapatma

- [x] Proje durum modelini genislet: Planlama, Baslamadi, Devam Ediyor,
  Musteri Bekleniyor, Revizyonda, Askida, Tamamlandi, Iptal Edildi.
- [x] Proje olusturma, durum degistirme ve silme sirasinda sozlesme durumunu
  transaction icinde senkron tut.
- [x] Ayni tekliften birden fazla proje olusmasini `UNIQUE (offer_id)` ile
  engelle.
- [x] Odeme eklerken proje satirini kilitleyerek eszamanli fazla tahsilat
  riskini engelle.
- [x] Proje/odeme para kolonlarini `DECIMAL(12,2)` yap ve sifir KDV'yi gecerli
  deger olarak isle.
- [x] API tarafinda durum, oncelik, ilerleme, tarih, KDV ve personel
  dogrulamalarini ekle.

Kabul kriterleri:

- Bir teklif icin sadece bir proje saklanabilir.
- Basarisiz proje islemi sozlesme durumunu yarim guncellenmis birakmaz.
- Iki eszamanli odeme toplam borcun ustune cikamaz.
- `%0` KDV ve kuruslu tutarlar dogru hesaplanir.

## Faz 1 - Temel Takip Ekrani

- [x] `projects` kaydina `priority`, `progress`, `description`, `updated_at`
  ve `completed_at` alanlarini ekle.
- [x] Proje detay API'sini odeme ozeti ve aktivite akisi ile beraber sun.
- [x] Durum degisikligi, proje guncellemesi ve odeme islemlerini aktivite
  gecmisine yaz.
- [x] `/projects/:offerId` detay sayfasini ekle.
- [x] Listeye durum etiketi, oncelik, ilerleme cubugu, termin/gecikme ve
  odeme ozeti ekle.
- [x] Liste icin durum, oncelik ve geciken proje filtrelerini ekle.

Kabul kriterleri:

- Kullanici listeden projenin ilerleme, termin ve tahsilat sagligini gorebilir.
- Detay ekraninda proje ozeti, finans durumu ve son islemler tek yerde gorunur.
- Formdan aciklama, oncelik ve ilerleme kaydedilebilir.

## Faz 2 - Asama ve Gorev Yonetimi

- [x] `project_stages` tablosunu ve CRUD API'lerini ekle.
- [ ] Proje tipine gore varsayilan asama sablonlari tanimla.
- [x] `project_tasks` tablosunu ve CRUD API'lerini ekle.
- [x] Gorev icin sorumlu, oncelik, termin, durum ve tamamlanma zamani tut.
- [x] Detay ekranina asama/gorev paneli ve hizli durum guncelleme ekle.
- [x] Proje ilerlemesini tamamlanan gorevlerden otomatik hesaplama secenegiyle
  destekle.
- [ ] Geciken gorev ve asama kurallarini tanimla.

Kabul kriterleri:

- Projenin hangi asamada oldugu ve siradaki isin kimde oldugu gorunur.
- Geciken gorevler proje sagligi hesaplamasina yansir.

## Faz 3 - Notlar, Dosyalar ve Teslim

- [ ] `project_notes` tablosunu ekle; ic not, musteri gorusmesi, revizyon ve
  teslim notu turlerini destekle.
- [ ] `project_files` tablosunu ve guvenli dosya yukleme/indirme akislarini ekle.
- [ ] Dosyalara kategori, yukleyen kullanici, tarih ve aciklama ekle.
- [ ] Teslim ve musteri onayi kayitlarini gorunur hale getir.
- [ ] Aktivite akisini not ve dosya olaylariyla genislet.

Kabul kriterleri:

- Proje ile ilgili gorusme ve teslim belgeleri kronolojik olarak bulunabilir.
- Dosya ve not degisikliklerinin sahibi ve zamani kaybolmaz.

## Faz 4 - Odeme Plani ve Raporlama

- [x] `project_payment_plans` ile taksit/vade takibini ekle.
- [x] Gecikmis odeme durumunu otomatik hesapla.
- [ ] Dashboard'a aktif/geciken/musteri bekleyen/odeme bekleyen proje kartlari
  ekle.
- [ ] Yaklasan teslimler, geciken gorevler ve son aktiviteler panellerini ekle.
- [ ] Personel bazli aktif proje ve gorev yuku raporu ekle.

Kabul kriterleri:

- Yonetici teslim, tahsilat ve is yuku risklerini dashboard'dan izleyebilir.

## Finans Modulu - Gelir / Gider Takibi

- [x] Proje tahsilatlarini otomatik gelir olarak finans ekranina dahil et.
- [x] Ek gelir ve giderlerin kategori, tarih, odeme yontemi, referans ve notla
  manuel kaydini destekle.
- [x] Donem/tur/kategori filtreleri ile toplam gelir, gider ve net durum
  ozetlerini ekle.
- [x] Kategori bazli gelir ve gider dagilimini goster.
- [x] Manuel finans hareketlerini duzenleme ve silme destegi ekle.

Kabul kriterleri:

- Projeye kaydedilen odeme, ek giris yapilmadan gelir toplaminda gorunur.
- Manuel gelir/gider kayitlari detayli hareket dokumunde filtrelenebilir.
- Otomatik proje tahsilatlari finans ekranindan yanlislikla duzenlenemez.

## Veri Gecisi Notlari

- Temiz kurulumlar `backend/src/db/schema.sql` ile yeni alanlari alir.
- Mevcut veritabani icin
  `backend/src/db/migrations/001_project_tracking_phase1.sql` sirali olarak
  uygulanir.
- Asama/gorev ve planli odeme gelistirmeleri icin ardindan
  `backend/src/db/migrations/002_project_workflow_and_payment_plans.sql`
  uygulanir.
- Gelir/gider modulu icin ardindan
  `backend/src/db/migrations/003_finance_transactions.sql` uygulanir.
- Migration once yinelenen `offer_id` kaydi bulunmadigini kontrol eder.
  Yinelenen kayit varsa bunlar is karariyla temizlenmeden benzersiz indeks
  eklenmemelidir.
- Eski `status = 1` proje kayitlari onceki anlamiyla "tamamlandi" oldugu icin
  yeni modelde `status = 6` olarak tasinir.
