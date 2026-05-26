-- Otomatik proje tahsilatlarina ek manuel gelir ve gider kayitlari.
CREATE TABLE IF NOT EXISTS finance_transactions (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_type VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATE NOT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  reference VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  user_id INT(11) DEFAULT NULL,
  create_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (transaction_type),
  INDEX (transaction_date),
  INDEX (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
