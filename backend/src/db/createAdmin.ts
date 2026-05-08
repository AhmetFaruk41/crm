import bcrypt from 'bcryptjs';
import { execute, queryOne, pool } from './pool.js';

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const fullname = process.env.ADMIN_FULLNAME ?? 'Admin';

  const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) {
    console.log(`[seed] kullanıcı '${username}' zaten mevcut, atlanıyor`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    await execute(
      'INSERT INTO users (fullname, username, password, level, phone, email) VALUES (?, ?, ?, 1, ?, ?)',
      [fullname, username, hash, '', '']
    );
    console.log(`[seed] yönetici oluşturuldu: ${username} / ${password}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
