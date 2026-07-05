-- 010_drive.sql
-- Serbest "Drive" modülü: iç içe klasörler, dosyalar ve etiketler.
-- Yeni tablolar; IF NOT EXISTS ile idempotent, canlıda güvenli.

CREATE TABLE IF NOT EXISTS drive_folders (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id INT(11) DEFAULT NULL,               -- NULL = kök seviye
  name VARCHAR(255) NOT NULL,
  created_by INT(11) DEFAULT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (parent_id),
  INDEX (created_by),
  CONSTRAINT fk_drive_folder_parent FOREIGN KEY (parent_id) REFERENCES drive_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_drive_folder_user   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS drive_files (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folder_id INT(11) DEFAULT NULL,               -- NULL = kök seviye
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,            -- diskteki rastgele dosya adı
  mime VARCHAR(150) DEFAULT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  checksum CHAR(64) DEFAULT NULL,               -- sha256
  uploaded_by INT(11) DEFAULT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (folder_id),
  INDEX (uploaded_by),
  CONSTRAINT fk_drive_file_folder FOREIGN KEY (folder_id) REFERENCES drive_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_drive_file_user   FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS drive_tags (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'slate',
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_drive_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS drive_file_tags (
  file_id INT(11) NOT NULL,
  tag_id INT(11) NOT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id, tag_id),
  INDEX idx_drive_file_tag_tag (tag_id),
  CONSTRAINT fk_dft_file FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_dft_tag  FOREIGN KEY (tag_id)  REFERENCES drive_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
