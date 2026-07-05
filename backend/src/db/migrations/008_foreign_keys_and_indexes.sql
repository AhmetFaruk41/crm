-- 008_foreign_keys_and_indexes.sql
-- Amaç: Eksik index'leri ve veritabanı seviyesinde referans bütünlüğünü (FK) ekle.
--
-- !!! ÖNEMLİ — CANLI VERİTABANINDA ÇALIŞTIRMADAN ÖNCE OKU !!!
--   1) Bu migration bir kez çalıştırılmalıdır (idempotent DEĞİL; tekrar
--      çalıştırılırsa "Duplicate key/constraint" hatası verir).
--   2) Önce MUTLAKA yedek al.
--   3) FK ekleme adımları, işaret ettiği üst kayıt bulunmayan (öksüz) satır
--      varsa HATA verir. Aşağıdaki "ÖKSÜZ KONTROL" sorgularını önce çalıştırıp
--      0 satır döndüğünü doğrula. SET NULL olan nullable kolonlardaki öksüzler
--      bu migration tarafından otomatik NULL'lanır; NOT NULL varlık
--      referanslarındaki öksüzler elle temizlenmelidir.

-- ---------------------------------------------------------------------------
-- 1) EKSİK INDEX'LER (güvenli)
-- ---------------------------------------------------------------------------
ALTER TABLE leads                ADD INDEX idx_leads_user (user_id);
ALTER TABLE lead_activities      ADD INDEX idx_lead_act_user (user_id);
ALTER TABLE offers               ADD INDEX idx_offers_user (user_id);
ALTER TABLE offers               ADD INDEX idx_offers_main (main_offer_id);
ALTER TABLE agreements           ADD INDEX idx_agreements_client (client_id);
ALTER TABLE agreements_matters   ADD INDEX idx_agr_matters_offer_matter (offer_matter_id);
ALTER TABLE projects             ADD INDEX idx_projects_client (client_id);
ALTER TABLE projects             ADD INDEX idx_projects_personel (personel_id);
ALTER TABLE finance_transactions ADD INDEX idx_finance_user (user_id);

-- ---------------------------------------------------------------------------
-- 2) NULLABLE OPSİYONEL REFERANSLAR — önce öksüzleri NULL'la, sonra SET NULL FK
--    (bu adımlar öksüz olsa bile güvenli çalışır)
-- ---------------------------------------------------------------------------
UPDATE leads   SET converted_client_id = NULL WHERE converted_client_id IS NOT NULL AND converted_client_id NOT IN (SELECT id FROM clients);
UPDATE leads   SET converted_offer_id  = NULL WHERE converted_offer_id  IS NOT NULL AND converted_offer_id  NOT IN (SELECT id FROM offers);
UPDATE leads   SET user_id             = NULL WHERE user_id             IS NOT NULL AND user_id             NOT IN (SELECT id FROM users);
UPDATE lead_activities      SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
UPDATE offers               SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
UPDATE offers               SET lead_id = NULL WHERE lead_id IS NOT NULL AND lead_id NOT IN (SELECT id FROM leads);
UPDATE finance_transactions SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
UPDATE project_activities   SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
UPDATE project_tasks        SET personel_id = NULL WHERE personel_id IS NOT NULL AND personel_id NOT IN (SELECT id FROM personel);

ALTER TABLE leads
  ADD CONSTRAINT fk_leads_conv_client FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_leads_conv_offer  FOREIGN KEY (converted_offer_id)  REFERENCES offers(id)  ON DELETE SET NULL,
  ADD CONSTRAINT fk_leads_user        FOREIGN KEY (user_id)             REFERENCES users(id)   ON DELETE SET NULL;
ALTER TABLE lead_activities
  ADD CONSTRAINT fk_lead_act_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE offers
  ADD CONSTRAINT fk_offers_user       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_offers_lead       FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE finance_transactions
  ADD CONSTRAINT fk_finance_user      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_activities
  ADD CONSTRAINT fk_proj_act_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_tasks
  ADD CONSTRAINT fk_proj_tasks_personel FOREIGN KEY (personel_id) REFERENCES personel(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3) SAHİPLİ DETAY SATIRLARI — üst kayıt silinince birlikte silinir (CASCADE)
--    ÖKSÜZ KONTROL (0 satır dönmeli):
--      SELECT COUNT(*) FROM offers_matters      WHERE offer_id       NOT IN (SELECT id FROM offers);
--      SELECT COUNT(*) FROM agreements_matters  WHERE offer_id       NOT IN (SELECT id FROM offers);
--      SELECT COUNT(*) FROM lead_activities     WHERE lead_id        NOT IN (SELECT id FROM leads);
--      SELECT COUNT(*) FROM lead_tag_assignments WHERE lead_id       NOT IN (SELECT id FROM leads);
--      SELECT COUNT(*) FROM lead_tag_assignments WHERE tag_id        NOT IN (SELECT id FROM lead_tags);
--      SELECT COUNT(*) FROM offer_template_matters WHERE template_id NOT IN (SELECT id FROM offer_templates);
--      SELECT COUNT(*) FROM project_activities  WHERE project_id     NOT IN (SELECT id FROM projects);
--      SELECT COUNT(*) FROM project_stages      WHERE project_id     NOT IN (SELECT id FROM projects);
--      SELECT COUNT(*) FROM project_tasks       WHERE project_id     NOT IN (SELECT id FROM projects);
--      SELECT COUNT(*) FROM project_tasks       WHERE stage_id       NOT IN (SELECT id FROM project_stages);
--      SELECT COUNT(*) FROM project_payment_plans WHERE project_id   NOT IN (SELECT id FROM projects);
-- ---------------------------------------------------------------------------
ALTER TABLE offers_matters
  ADD CONSTRAINT fk_offers_matters_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE agreements_matters
  ADD CONSTRAINT fk_agr_matters_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE lead_activities
  ADD CONSTRAINT fk_lead_act_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE lead_tag_assignments
  ADD CONSTRAINT fk_lta_lead FOREIGN KEY (lead_id) REFERENCES leads(id)     ON DELETE CASCADE,
  ADD CONSTRAINT fk_lta_tag  FOREIGN KEY (tag_id)  REFERENCES lead_tags(id) ON DELETE CASCADE;
ALTER TABLE offer_template_matters
  ADD CONSTRAINT fk_otm_template FOREIGN KEY (template_id) REFERENCES offer_templates(id) ON DELETE CASCADE;
ALTER TABLE project_activities
  ADD CONSTRAINT fk_proj_act_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_stages
  ADD CONSTRAINT fk_proj_stages_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_tasks
  ADD CONSTRAINT fk_proj_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_proj_tasks_stage   FOREIGN KEY (stage_id)   REFERENCES project_stages(id) ON DELETE CASCADE;
ALTER TABLE project_payment_plans
  ADD CONSTRAINT fk_ppp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 4) VARLIK REFERANSLARI — üst kayıt hâlâ çocuklara sahipse silme ENGELLENİR
--    (RESTRICT: sessiz veri kaybı yerine uygulama katmanına hata döner)
--    ÖKSÜZ KONTROL (0 satır dönmeli):
--      SELECT COUNT(*) FROM offers      WHERE client_id   NOT IN (SELECT id FROM clients);
--      SELECT COUNT(*) FROM agreements  WHERE client_id   NOT IN (SELECT id FROM clients);
--      SELECT COUNT(*) FROM agreements  WHERE offer_id    NOT IN (SELECT id FROM offers);
--      SELECT COUNT(*) FROM projects    WHERE client_id   NOT IN (SELECT id FROM clients);
--      SELECT COUNT(*) FROM projects    WHERE offer_id    NOT IN (SELECT id FROM offers);
--      SELECT COUNT(*) FROM projects    WHERE personel_id NOT IN (SELECT id FROM personel);
-- ---------------------------------------------------------------------------
ALTER TABLE offers
  ADD CONSTRAINT fk_offers_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE agreements
  ADD CONSTRAINT fk_agreements_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_agreements_offer  FOREIGN KEY (offer_id)  REFERENCES offers(id)  ON DELETE RESTRICT;
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_client   FOREIGN KEY (client_id)   REFERENCES clients(id)  ON DELETE RESTRICT,
  ADD CONSTRAINT fk_projects_offer    FOREIGN KEY (offer_id)    REFERENCES offers(id)   ON DELETE RESTRICT,
  ADD CONSTRAINT fk_projects_personel FOREIGN KEY (personel_id) REFERENCES personel(id) ON DELETE RESTRICT;
