-- Faz 1 proje takibi migration'i.
-- Uygulamadan once ilk sorgunun sonucunun bos oldugunu dogrulayin.
-- Sonuc varsa ayni teklif icin birden fazla proje vardir ve tekillestirme
-- karari verilmeden UNIQUE indeks eklenmemelidir.
SELECT offer_id, COUNT(*) AS project_count
FROM projects
GROUP BY offer_id
HAVING COUNT(*) > 1;

ALTER TABLE agreements
  MODIFY COLUMN price DECIMAL(12,2) DEFAULT NULL;

ALTER TABLE agreements_matters
  MODIFY COLUMN matter_price DECIMAL(12,2) NOT NULL;

ALTER TABLE projects
  ADD COLUMN description TEXT DEFAULT NULL AFTER title,
  ADD COLUMN priority INT(11) NOT NULL DEFAULT 1 AFTER description,
  ADD COLUMN progress INT(11) NOT NULL DEFAULT 0 AFTER priority,
  MODIFY COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_date,
  ADD COLUMN completed_at DATETIME DEFAULT NULL AFTER updated_at;

-- Eski modelde status=1 "Proje Tamamlandi" anlamina geliyordu.
UPDATE projects SET status = 6, progress = 100, completed_at = updated_at WHERE status = 1;

ALTER TABLE projects
  ADD UNIQUE KEY unique_project_offer (offer_id);

ALTER TABLE projects_billings
  MODIFY COLUMN pay DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_activities (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT(11) NOT NULL,
  user_id INT(11) DEFAULT NULL,
  action VARCHAR(60) NOT NULL,
  description VARCHAR(500) NOT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (project_id),
  INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
