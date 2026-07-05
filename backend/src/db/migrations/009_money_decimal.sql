-- 009_money_decimal.sql
-- Amaç: Para alanlarını FLOAT'tan DECIMAL'e çevir. FLOAT ikili kayan nokta
-- olduğu için para tutarlarında kuruş kayması/yuvarlama hatası yapar; finans
-- ve teklif tablolarının geri kalanı zaten DECIMAL(12,2) kullanıyor.
--
-- Bir kez çalıştır. Önce yedek al. Mevcut değerler DECIMAL'e otomatik dönüşür.

ALTER TABLE offers_matters
  MODIFY matter_old_price DECIMAL(12,2) DEFAULT NULL,
  MODIFY matter_price     DECIMAL(12,2) NOT NULL;

ALTER TABLE offer_template_matters
  MODIFY matter_old_price DECIMAL(12,2) DEFAULT NULL,
  MODIFY matter_price     DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE domain_pricing
  MODIFY monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  MODIFY full_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  MODIFY kdv           DECIMAL(5,2)  NOT NULL DEFAULT 20;
