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
      (SELECT COUNT(*) FROM projects) AS projectCount,
      (SELECT COUNT(*) FROM leads WHERE stage NOT IN ('won', 'lost')) AS leadCount
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

  const pipelineRaw = await query<any>(`
    SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(estimated_value), 0) AS total
    FROM leads
    GROUP BY stage
  `);
  const pipeline = pipelineRaw.map((r) => ({
    stage: r.stage,
    count: Number(r.cnt),
    total: Number(r.total),
  }));
  const followUps = await query(`
    SELECT id, company_name, contact_name, temperature, next_follow_up_date, stage
    FROM leads
    WHERE next_follow_up_date <= CURDATE() AND stage NOT IN ('won', 'lost')
    ORDER BY next_follow_up_date, temperature = 'hot' DESC, updated_at DESC
    LIMIT 20
  `);
  const leadSummaryRaw = await queryOne<any>(`
    SELECT
      SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) AS lost,
      SUM(CASE WHEN temperature = 'hot' AND stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS hot,
      SUM(CASE WHEN next_follow_up_date < CURDATE() AND stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS overdue,
      COALESCE(SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN estimated_value ELSE 0 END), 0) AS potential
    FROM leads
  `);

  const countsNum = {
    clientCount: Number(counts?.clientCount ?? 0),
    offerCount: Number(counts?.offerCount ?? 0),
    agreementCount: Number(counts?.agreementCount ?? 0),
    projectCount: Number(counts?.projectCount ?? 0),
    leadCount: Number(counts?.leadCount ?? 0),
  };

  res.json({
    counts: countsNum,
    thisMonth: tm,
    lastMonth: lm,
    ratio,
    byType,
    overdue,
    pipeline,
    followUps,
    leadSummary: {
      active: Number(leadSummaryRaw?.active ?? 0),
      won: Number(leadSummaryRaw?.won ?? 0),
      lost: Number(leadSummaryRaw?.lost ?? 0),
      hot: Number(leadSummaryRaw?.hot ?? 0),
      overdue: Number(leadSummaryRaw?.overdue ?? 0),
      potential: Number(leadSummaryRaw?.potential ?? 0),
    },
  });
}));
