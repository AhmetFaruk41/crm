import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { personnelRouter } from './routes/personnel.js';
import { jobsRouter } from './routes/jobs.js';
import { clientsRouter } from './routes/clients.js';
import { offersRouter } from './routes/offers.js';
import { offerTemplatesRouter } from './routes/offerTemplates.js';
import { agreementsRouter } from './routes/agreements.js';
import { projectsRouter, billingsRouter } from './routes/projects.js';
import { domainsRouter } from './routes/domains.js';
import { dashboardRouter } from './routes/dashboard.js';
import { pdfRouter } from './routes/pdf.js';
import { financeRouter } from './routes/finance.js';
import { leadsRouter } from './routes/leads.js';
import { blogAdminRouter, publicBlogRouter } from './routes/blog.js';

const app = express();
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static for client logos
app.use('/uploads', express.static(path.resolve('uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);

// Public blog API — CAWELT sitesi sunucu-sunucuya bundan okur (yetki yok,
// yalnızca yayınlanan yazılar). Auth duvarından ÖNCE mount edilir.
app.use('/api/public/blog', publicBlogRouter);

// All other routes require auth
app.get('/api/resources/web-sitesi-proje-bilgi-formu', requireAuth, (_req, res) => {
  res.download(
    path.resolve('assets/forms/web-sitesi-proje-bilgi-formu.docx'),
    'Web Sitesi Proje Bilgi Formu.docx'
  );
});
app.use('/api/users', requireAuth, requireAdmin, usersRouter);
app.use('/api/personnel', requireAuth, personnelRouter);
app.use('/api/jobs', requireAuth, jobsRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/offers', requireAuth, offersRouter);
app.use('/api/offer-templates', requireAuth, offerTemplatesRouter);
app.use('/api/agreements', requireAuth, agreementsRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/billings', requireAuth, billingsRouter);
app.use('/api/domains', requireAuth, domainsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/finance', requireAuth, financeRouter);
app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/blog', requireAuth, blogAdminRouter);
app.use('/api/pdf', requireAuth, pdfRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});
