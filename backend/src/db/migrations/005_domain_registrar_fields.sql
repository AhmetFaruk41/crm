-- Domainler icin ek kayit alanlari: bitis tarihi, saglayici (registrar),
-- saglayici hesabi, otomatik yenileme bayragi ve serbest not alani.

ALTER TABLE domains
  ADD COLUMN expires_at DATE DEFAULT NULL AFTER create_date,
  ADD COLUMN registrar VARCHAR(100) DEFAULT NULL AFTER subscription,
  ADD COLUMN registrar_account VARCHAR(255) DEFAULT NULL AFTER registrar,
  ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 AFTER registrar_account,
  ADD COLUMN notes TEXT DEFAULT NULL AFTER auto_renew;
