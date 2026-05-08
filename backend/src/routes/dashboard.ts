import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', asyncHandler(async (_req, res) => {
  const counts = await queryOne<any>(`
    SELECT
      (SELECT COUNT(*) FROM clients) AS clientCount,
      (SELECT COUNT(*) FROM offers) AS offerCount,
      (SELECT COUNT(*) FROM agreements) AS agreementCount,
      (SELECT COUNT(*) FROM projects) AS projectCount
  `);

  const thisMonth = await queryOne<any>(`
    SELECT COUNT(*) AS c FROM offers
    WHERE create_date >= DATE_FORMAT(NOW() ,'%Y-%m-01')
      AND create_date < DATE_FORMAT(NOW() + INTERVAL 1 MONTH ,'%Y-%m-01')
  `);
  const lastMonth = await queryOne<any>(`
    SELECT COUNT(*) AS c FROM offers
    WHERE create_date >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH ,'%Y-%m-01')
      AND create_date < DATE_FORMAT(NOW() ,'%Y-%m-01')
  `);

  const tm = Number(thisMonth?.c) || 0;
  const lm = Number(lastMonth?.c) || 0;
  let ratio: number | null = null;
  if (lm > 0) {
    ratio = ((tm - lm) / lm) * 100;
  } else if (tm > 0) {
    ratio = null; // sonsuz büyüme – frontend "—" gösterecek
  } else {
    ratio = 0;
  }

  const byTypeRaw = await query<any>(`
    SELECT j.id, j.title, COALESCE(COUNT(o.id), 0) AS cnt
    FROM jobs j
    LEFT JOIN offers o ON o.offer_type = j.id
    GROUP BY j.id, j.title
    ORDER BY j.id
  `);
  const byType = byTypeRaw.map((r) => ({ id: r.id, title: r.title, cnt: Number(r.cnt) }));

  const overdue = await query(`
    SELECT id, offer_id, offer_title, final_date
    FROM offers
    WHERE final_date < CURDATE() AND offer_status = 0
    ORDER BY final_date DESC
    LIMIT 20
  `);

  const countsNum = {
    clientCount: Number(counts?.clientCount ?? 0),
    offerCount: Number(counts?.offerCount ?? 0),
    agreementCount: Number(counts?.agreementCount ?? 0),
    projectCount: Number(counts?.projectCount ?? 0),
  };

  res.json({
    counts: countsNum,
    thisMonth: tm,
    lastMonth: lm,
    ratio,
    byType,
    overdue,
  });
}));
