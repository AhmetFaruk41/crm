-- noname-crm seed
-- admin user: ADMIN_PASSWORD ortam değişkeniyle `npm run seed:admin` üzerinden oluşturulur (bcrypt hash script'te üretilir)
INSERT INTO jobs (title) VALUES
  ('Web Tasarım'),
  ('Grafik Tasarım'),
  ('Video/Prodüksiyon'),
  ('Dijital Pazarlama'),
  ('Mobil Uygulama');

INSERT INTO domain_pricing (title, monthly_price, full_price, kdv) VALUES
  ('Standart', 5, 50, 20),
  ('Pro', 10, 100, 20),
  ('Premium', 20, 200, 20);

INSERT INTO personel (fullname, email, phone) VALUES
  ('Demo Personel', 'demo@noname.local', '');

-- Offer Templates: Sunucu Hizmeti
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Sunucu Hizmeti (Hosting)', 'Yıllık sunucu / hosting hizmeti standart şablonu. Hızlıca müşteriye sunulabilir.', NULL, 'Sunucu / Hosting Hizmeti Teklifi', 'İşletmenizin web sitesi için yıllık barındırma (hosting) hizmeti teklifimizdir. Kesintisiz çalışma, günlük yedekleme ve 7/24 izleme dahildir.', 15, 1);
SET @t1 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t1, 0, 'Yıllık Hosting Paketi', '50 GB SSD disk alanı, sınırsız bant genişliği, cPanel yönetim paneli, ücretsiz SSL sertifikası, 10 adet e-posta hesabı.', 'Hizmet süresi 12 ay olup, dönem sonunda yenileme bedeli güncel fiyat üzerinden ayrıca tahsil edilir.', 1, 2400),
  (@t1, 1, 'Domain (.com) Kayıt / Yenileme', '1 yıl boyunca .com uzantılı alan adı kaydı veya yenilemesi.', NULL, 1, 350),
  (@t1, 2, 'Günlük Otomatik Yedekleme', 'Tüm site dosyalarının ve veritabanının her gün otomatik yedeklenmesi, son 30 günlük yedek geri yükleme imkanı.', NULL, 1, 600),
  (@t1, 3, 'SSL Sertifikası (Let''s Encrypt)', 'Ücretsiz SSL sertifikası kurulumu, otomatik yenileme.', NULL, 1, 0),
  (@t1, 4, 'Teknik Destek (Mesai Saatleri)', 'Hafta içi 09:00-18:00 saatleri arasında telefon ve e-posta üzerinden teknik destek.', 'Mesai dışı destek talepleri için ek ücretlendirme yapılabilir.', 1, 0);

-- Offer Templates: Web Tasarım
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Kurumsal Web Sitesi', 'Standart kurumsal web sitesi şablonu. Sayfa sayısı ve fiyat müşteriye göre ayarlanır.', NULL, 'Kurumsal Web Sitesi Tasarımı Teklifi', 'Firmanızın kurumsal kimliğine uygun, mobil uyumlu, SEO dostu kurumsal web sitesi tasarım ve yazılım hizmeti teklifimizdir.', 15, 1);
SET @t2 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t2, 0, 'Tasarım & UI/UX', 'Firmanıza özel anasayfa, kurumsal sayfa, hizmetler, referanslar, blog ve iletişim sayfaları için modern tasarım. 2 revize hakkı dahildir.', 'Tasarım onayından sonra yapılacak büyük değişiklikler ek ücrete tabidir.', 1, 12000),
  (@t2, 1, 'Yazılım & Yönetim Paneli', 'Sayfaların, içeriklerin ve menülerin yönetilebileceği özel admin panel. Çoklu dil altyapısı opsiyoneldir.', NULL, 1, 18000),
  (@t2, 2, 'Mobil Uyum (Responsive)', 'Telefon, tablet ve masaüstü cihazlarda eksiksiz görüntüleme.', NULL, 1, 0),
  (@t2, 3, 'SEO Temel Ayarları', 'Meta etiketleri, sitemap.xml, robots.txt, Google Search Console & Analytics entegrasyonu.', NULL, 1, 2500),
  (@t2, 4, 'Eğitim & Teslim', 'Yönetim paneli kullanım eğitimi ve dokümantasyonu, canlıya alma süreçleri dahildir.', NULL, 1, 0),
  (@t2, 5, '1 Yıl Bakım & Destek', 'Teslimden sonra 1 yıl boyunca güvenlik güncellemeleri ve teknik destek.', 'Yeni özellik geliştirmeleri bu kapsamda değildir.', 1, 0);

-- Offer Templates: E-Ticaret
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('E-Ticaret Sitesi', 'Standart e-ticaret altyapısı şablonu (sepet, ödeme, kargo entegrasyonları).', NULL, 'E-Ticaret Sitesi Teklifi', 'Online satış kanalınızı kurmak için ihtiyaç duyacağınız tüm modülleri içeren e-ticaret sitesi teklifimizdir.', 15, 1);
SET @t3 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t3, 0, 'E-Ticaret Tasarımı', 'Anasayfa, kategori, ürün detay, sepet, ödeme ve hesabım sayfaları. Kurumsal kimliğinize uygun özel tasarım.', NULL, 1, 18000),
  (@t3, 1, 'Yönetim Paneli', 'Ürün, kategori, sipariş, müşteri, kupon ve kampanya yönetimi.', NULL, 1, 24000),
  (@t3, 2, 'Sanal POS Entegrasyonu', 'iyzico / PayTR / banka sanal pos entegrasyonu (1 adet).', 'Ek pos entegrasyonu başına 2.500 TL eklenir.', 1, 4000),
  (@t3, 3, 'Kargo Entegrasyonu', 'Yurtiçi / MNG / Aras Kargo API entegrasyonu (1 adet).', NULL, 1, 3000),
  (@t3, 4, 'E-Fatura / E-Arşiv Entegrasyonu', 'Sipariş üzerinden otomatik e-arşiv fatura kesimi.', NULL, 1, 5000),
  (@t3, 5, 'SEO & Pazarlama', 'Meta yapısı, sitemap, Google Merchant feed, Analytics & Search Console.', NULL, 1, 3500);

-- Offer Templates: Dijital Pazarlama
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Dijital Pazarlama (Aylık)', 'Aylık sosyal medya yönetimi + reklam kampanyaları şablonu.', NULL, 'Dijital Pazarlama Hizmeti Teklifi', 'Markanızın dijital görünürlüğünü artırmak için aylık sosyal medya yönetimi ve reklam kampanyası hizmeti teklifimizdir.', 15, 1);
SET @t4 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t4, 0, 'Sosyal Medya Yönetimi (Aylık)', 'Instagram, Facebook ve LinkedIn için aylık 12 özgün post + 8 story tasarımı, içerik takvimi, hashtag stratejisi.', 'Reklam bütçesi dahil değildir, ayrıca müşteri tarafından karşılanır.', 1, 8500),
  (@t4, 1, 'Google Ads Yönetimi', 'Arama, görüntülü reklam ağı ve YouTube kampanya kurulumu, optimizasyon, haftalık rapor.', NULL, 1, 4500),
  (@t4, 2, 'Meta Ads Yönetimi', 'Facebook & Instagram reklam kampanyalarının kurulumu, A/B test, optimizasyon.', NULL, 1, 4500),
  (@t4, 3, 'Aylık Performans Raporu', 'Her ay sonunda detaylı analitik rapor ve strateji önerileri.', NULL, 1, 0);

-- Offer Templates: Grafik Tasarım
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Kurumsal Kimlik Tasarımı', 'Logo + kartvizit + antetli kağıt + zarf paketi.', NULL, 'Kurumsal Kimlik Tasarımı Teklifi', 'Markanız için kurumsal kimlik tasarım paketi teklifimizdir. Tüm dosyalar açık kaynak (AI/PSD) olarak teslim edilir.', 15, 1);
SET @t5 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t5, 0, 'Logo Tasarımı', '3 farklı konsept sunum, seçilen konsept üzerinde 2 revize hakkı.', NULL, 1, 6000),
  (@t5, 1, 'Kartvizit Tasarımı', 'Çift yüzlü kartvizit tasarımı, baskıya hazır PDF.', NULL, 1, 1500),
  (@t5, 2, 'Antetli Kağıt & Zarf', 'A4 antetli kağıt ve standart zarf tasarımı.', NULL, 1, 1500),
  (@t5, 3, 'Kurumsal Kimlik Kılavuzu', 'Logo kullanım kuralları, renk paleti, tipografi rehberi (PDF).', NULL, 1, 2500);

-- Offer Templates: Mobil Uygulama
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Mobil Uygulama (iOS + Android)', 'React Native ile çapraz platform mobil uygulama şablonu.', NULL, 'Mobil Uygulama Geliştirme Teklifi', 'iOS ve Android platformlarında çalışacak çapraz platform mobil uygulama geliştirme hizmeti teklifimizdir.', 30, 1);
SET @t6 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t6, 0, 'UI/UX Tasarım', 'Wireframe, akış diyagramları, yüksek kaliteli arayüz tasarımları (Figma).', '2 revize hakkı dahildir.', 1, 25000),
  (@t6, 1, 'iOS & Android Geliştirme', 'React Native ile çapraz platform uygulama geliştirme. Push notification, in-app login, profil yönetimi modülleri.', NULL, 1, 75000),
  (@t6, 2, 'Backend API & Admin Panel', 'Uygulamanın çalışması için gerekli REST API ve yönetim paneli.', NULL, 1, 35000),
  (@t6, 3, 'Mağaza Yayınlama', 'App Store ve Google Play yayınlama süreçleri (geliştirici hesabı müşteri tarafından sağlanır).', NULL, 1, 5000),
  (@t6, 4, '3 Ay Bakım & Destek', 'Teslimden sonra 3 ay boyunca hata düzeltme ve teknik destek.', NULL, 1, 0);

-- Offer Templates: Video / Prodüksiyon
INSERT INTO offer_templates (title, description, offer_type, default_offer_title, default_offer_text, default_validity_days, is_active) VALUES
  ('Tanıtım Videosu', 'Tek günlük çekim + post-prodüksiyon paketi.', NULL, 'Kurumsal Tanıtım Videosu Teklifi', 'Firmanızın tanıtımı için 60-90 saniyelik kurumsal video prodüksiyon teklifimizdir.', 15, 1);
SET @t7 = LAST_INSERT_ID();
INSERT INTO offer_template_matters (template_id, ordering, matter_title, matter_description, matter_extra, matter_unit, matter_price) VALUES
  (@t7, 0, 'Senaryo & Storyboard', 'Konsept geliştirme, senaryo yazımı, çekim planı (storyboard).', '1 revize hakkı dahildir.', 1, 4000),
  (@t7, 1, 'Çekim Günü (1 Gün)', '4K kamera, ışık ekipmanı, 2 kişilik çekim ekibi, drone (opsiyonel).', 'Şehir dışı çekimlerde konaklama ve ulaşım masrafları ayrıca faturalanır.', 1, 12000),
  (@t7, 2, 'Post-Prodüksiyon', 'Kurgu, renk düzenleme, ses tasarımı, müzik, alt yazı, motion grafik.', NULL, 1, 8000),
  (@t7, 3, 'Seslendirme', 'Profesyonel seslendirme sanatçısı (Türkçe).', 'İngilizce veya başka dilde seslendirme +%50 ücret.', 1, 2500);
