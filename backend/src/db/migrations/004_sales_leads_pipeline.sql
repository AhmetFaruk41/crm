-- Yeni musteri kazanimi: potansiyel musteri, takip gecmisi ve teklif baglantisi.
CREATE TABLE IF NOT EXISTS leads (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  service_interest VARCHAR(255) DEFAULT NULL,
  source VARCHAR(100) DEFAULT NULL,
  estimated_value DECIMAL(12,2) DEFAULT NULL,
  stage VARCHAR(40) NOT NULL DEFAULT 'new',
  temperature VARCHAR(20) NOT NULL DEFAULT 'warm',
  next_follow_up_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  lost_reason VARCHAR(255) DEFAULT NULL,
  converted_client_id INT(11) DEFAULT NULL,
  converted_offer_id INT(11) DEFAULT NULL,
  user_id INT(11) DEFAULT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (stage),
  INDEX (temperature),
  INDEX (next_follow_up_date),
  INDEX (converted_client_id),
  INDEX (converted_offer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_activities (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id INT(11) NOT NULL,
  activity_type VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  activity_date DATETIME NOT NULL,
  next_action_date DATE DEFAULT NULL,
  user_id INT(11) DEFAULT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (lead_id),
  INDEX (activity_date),
  INDEX (next_action_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE offers
  ADD COLUMN lead_id INT(11) DEFAULT NULL AFTER client_id,
  ADD INDEX lead_id (lead_id);
