import bcrypt from 'bcryptjs';
import { execute, queryOne, pool } from './pool.js';

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const fullname = process.env.ADMIN_FULLNAME ?? 'Admin';

  // Zayıf, tahmin edilebilir bir varsayılan şifre (eski: admin123) artık yok.
  // Şifre açıkça ADMIN_PASSWORD ile verilmeli ve en az 8 karakter olmalı.
  if (password.length < 8) {
    console.error('[seed] ADMIN_PASSWORD ortam değişkeni gerekli (en az 8 karakter).');
    console.error('[seed] Örnek: ADMIN_PASSWORD=cok-guclu-bir-sifre npm run seed:admin');
    await pool.end();
    process.exit(1);
  }

  const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) {
    console.log(`[seed] kullanıcı '${username}' zaten mevcut, atlanıyor`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    await execute(
      'INSERT INTO users (fullname, username, password, level, phone, email) VALUES (?, ?, ?, 1, ?, ?)',
      [fullname, username, hash, '', '']
    );
    // Şifre loglanmaz.
    console.log(`[seed] yönetici oluşturuldu: ${username}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
