-- 012_finish_foreign_keys.sql
-- SADECE 008 KISMEN UYGULANMIŞ VERİTABANLARI İÇİN (ör. production).
-- 008'in CASCADE/RESTRICT bölümü, offer'a İŞ NUMARASIYLA bağlanan hatalı bir FK
-- yüzünden yarıda durmuştu. O 4 hatalı FK 008'den kaldırıldı (offers_matters,
-- agreements_matters, agreements→offers, projects→offers — offers.offer_id tekil
-- olmadığı için FK kurulamaz). Bu script, 008'in eklemeyi tamamlayamadığı DOĞRU
-- 13 FK'yı ekler. Hepsi PK'lara bağlanır ve 0 öksüz kayıt doğrulanmıştır.
--
-- YENİ/TAZE kurulumlarda ÇALIŞTIRMAYIN — schema.sql zaten bu FK'ları içerir ve
-- düzeltilmiş 008 de ekler; bu script yalnızca yarıda kalan DB'yi tamamlar.
-- Bir kez çalıştırılır; tekrar çalıştırılırsa "Duplicate foreign key" verir.

-- Sahipli detay satırları (üst PK silinince birlikte silinir)
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

-- Varlık referansları (üst kayıt hâlâ çocuklara sahipse silme ENGELLENİR)
ALTER TABLE offers
  ADD CONSTRAINT fk_offers_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE agreements
  ADD CONSTRAINT fk_agreements_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_client   FOREIGN KEY (client_id)   REFERENCES clients(id)  ON DELETE RESTRICT,
  ADD CONSTRAINT fk_projects_personel FOREIGN KEY (personel_id) REFERENCES personel(id) ON DELETE RESTRICT;
