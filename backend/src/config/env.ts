import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_USER: process.env.DB_USER ?? 'root',
  DB_PASS: process.env.DB_PASS ?? '',
  DB_NAME: process.env.DB_NAME ?? 'noname_crm',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret',
  COOKIE_NAME: process.env.COOKIE_NAME ?? 'noname_token',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
};
