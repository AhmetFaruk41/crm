-- Potansiyel musteri etiketleri.
CREATE TABLE IF NOT EXISTS lead_tags (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'slate',
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lead_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_tag_assignments (
  lead_id INT(11) NOT NULL,
  tag_id INT(11) NOT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lead_id, tag_id),
  INDEX idx_lead_tag_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
