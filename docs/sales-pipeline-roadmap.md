# Yeni Musteri Kazanimi ve Satis Takibi Task Listesi

Bu plan, teklif oncesi musteri kazanimi surecinin takip edilmesini ve sicak
adaylarin unutulmadan teklife donusturulmesini hedefler.

## Faz 1 - Potansiyel Musteri Kaydi ve Satis Hunisi

- [x] `leads` tablosunu ekle: iletisim, hizmet ilgisi, kaynak, tahmini deger,
  satis asamasi, sicaklik ve sonraki takip tarihi.
- [x] Potansiyel musteri CRUD API'lerini ekle.
- [x] Liste ekranina asama, sicaklik ve takip durumu filtrelerini ekle.
- [x] Acik firsat, sicak aday, geciken takip ve potansiyel tutar ozetlerini
  liste ekraninda goster.

Kabul kriterleri:

- Teklif hazirlanmamis her aday tek yerde aranabilir ve filtrelenebilir.
- Geciken takipler listede belirgin olarak gorunur.

## Faz 2 - Iletisim ve Aksiyon Gecmisi

- [x] `lead_activities` tablosunu ekle.
- [x] Telefon, WhatsApp, e-posta, toplanti, form gonderimi ve not kaydi
  eklenmesini destekle.
- [x] Her aktiviteden sonraki aksiyon tarihini aday takip tarihine yansit.
- [x] Otomatik teklif/durum hareketlerinin silinemeyen gecmis olarak
  saklanmasini sagla.

Kabul kriterleri:

- Aday detayinda yapilan islemler kronolojik okunabilir.
- Bir sonraki geri donus tarihi gorusme kaydi sirasinda planlanabilir.

## Faz 3 - Teklif Akisina Donusum

- [x] Aday kaydindan tek aksiyonla musteri kaydi olustur veya mevcut donusumu
  yeniden kullan.
- [x] `offers.lead_id` baglantisini ekleyerek teklifin kaynak adayini sakla.
- [x] Aday detayindan bagli teklifleri erisilebilir hale getir.
- [x] Teklif iletildi, onaylandi veya reddedildi durumlarini satis hunisine
  otomatik yansit.
- [x] Revize edilen teklifin lead baglantisini koru.

Kabul kriterleri:

- Adaydan teklife gecerken musteri bilgileri tekrar yazilmaz.
- Kazanilan ve kaybedilen teklifler aday raporlarinda dogru asamada gorunur.

## Faz 4 - Gunluk Takip Dashboard'u

- [x] Dashboard'a aktif aday, sicak aday, kazanilan/kaybedilen ve acik
  potansiyel ozetlerini ekle.
- [x] Bugun aranacak ve takibi gecikmis adaylari anasayfada goster.
- [x] Satis hunisini asama ve tahmini tutar bazinda goster.

Kabul kriterleri:

- Anasayfa, bugun kiminle iletisime gecilmesi gerektigini soyler.
- Satis potansiyeli teklif olusturulmadan once de gorulebilir.

## Sonraki Gelistirmeler

- [ ] Lead kaynaklarinin kazanma orani ve gelir etkisi raporu.
- [ ] Kaybedilme nedenleri dagilimi raporu.
- [ ] Takip tarihleri icin bildirim veya e-posta hatirlatmasi.
- [ ] Web sitesindeki bilgi formundan otomatik aday kaydi alma.
- [ ] WhatsApp/e-posta iletisim baglantilari ve sablon mesajlar.

## Veri Gecisi

Mevcut veritabaninda asagidaki migration, onceki migration'lardan sonra
uygulanir:

```bash
mysql -u root -p noname_crm < backend/src/db/migrations/004_sales_leads_pipeline.sql
```
