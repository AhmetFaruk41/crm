-- 011_drop_blog.sql
-- Blog modülü kaldırıldı. Daha önce 007_blog_posts.sql çalıştırılmış (production
-- gibi) bir veritabanında kalan tabloyu temizler. Yeni kurulumlarda blog_posts
-- zaten yoktur, IF EXISTS ile güvenli.
--
-- DİKKAT: Bu tablo blog yazılarını içerir; silmeden önce içerik başka yere
-- taşındıysa yedek alın.

DROP TABLE IF EXISTS blog_posts;
