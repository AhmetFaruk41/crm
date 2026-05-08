import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { HttpError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOfferPdf, generateAgreementPdf } from '../services/pdf.js';

export const pdfRouter = Router();

pdfRouter.get('/offer/:offerId', asyncHandler(async (req, res) => {
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ? ORDER BY id DESC LIMIT 1', [req.params.offerId]);
  if (!offer) throw new HttpError(404, 'Teklif bulunamadı');
  const matters = await query<any>('SELECT * FROM offers_matters WHERE offer_id = ? ORDER BY ordering, id', [offer.offer_id]);
  const client = offer.client_id ? await queryOne<any>('SELECT * FROM clients WHERE id = ?', [offer.client_id]) : null;
  const author = offer.user_id
    ? await queryOne<any>('SELECT fullname, phone, email FROM users WHERE id = ?', [offer.user_id])
    : { fullname: req.user?.fullname ?? 'Sistem', phone: '', email: '' };

  const buf = await generateOfferPdf({ offer, client, matters, author: author ?? { fullname: 'Sistem', phone: '', email: '' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="teklif-${offer.offer_id}.pdf"`);
  res.send(buf);
}));

pdfRouter.get('/agreement/:offerId', asyncHandler(async (req, res) => {
  const agreement = await queryOne<any>('SELECT * FROM agreements WHERE offer_id = ?', [req.params.offerId]);
  if (!agreement) throw new HttpError(404, 'Sözleşme bulunamadı');
  const offer = await queryOne<any>('SELECT * FROM offers WHERE offer_id = ?', [req.params.offerId]);
  const matters = await query<any>('SELECT * FROM agreements_matters WHERE offer_id = ? ORDER BY ordering, id', [req.params.offerId]);
  const client = agreement.client_id ? await queryOne<any>('SELECT * FROM clients WHERE id = ?', [agreement.client_id]) : null;

  const buf = await generateAgreementPdf({ offer, client, agreement, matters });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="sozlesme-${agreement.offer_id}.pdf"`);
  res.send(buf);
}));
