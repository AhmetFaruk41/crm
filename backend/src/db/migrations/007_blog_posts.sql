-- Blog modülü — CAWELT sitesine içerik besleyen yazılar.
-- Yazılar CRM panelinden Markdown ile yazılır; kaydederken sunucu tarafında
-- yapısal bloklara (body_json) dönüştürülür ve siteye bu hâliyle servis edilir.
--
-- Uygulamak için:
--   mysql -u root -p noname_crm < backend/src/db/migrations/007_blog_posts.sql

CREATE TABLE IF NOT EXISTS blog_posts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug          VARCHAR(191) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   VARCHAR(320) NOT NULL DEFAULT '',
  category      VARCHAR(80)  NOT NULL DEFAULT 'Genel',
  tags          JSON         NULL,           -- string[]  örn. ["seo","next.js"]
  author        VARCHAR(120) NOT NULL DEFAULT '',
  cover         VARCHAR(255) NULL,
  body_markdown LONGTEXT     NOT NULL,        -- yazarın düzenlediği kaynak
  body_json     JSON         NULL,            -- türetilmiş bloklar (siteye gider)
  faq           JSON         NULL,            -- {q,a}[]
  status        ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at  DATE         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_blog_slug (slug),
  KEY idx_blog_status_pub (status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
