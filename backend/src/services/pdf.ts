// PDF üretimi - Can Bozyiğit · neutral grayscale
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content, ContentStack } from 'pdfmake/interfaces';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateformat3 } from '../utils/dates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, '../../fonts');

const fonts = {
  Roboto: {
    normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(FONT_DIR, 'Roboto-Bold.ttf'),
    italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONT_DIR, 'Roboto-BoldItalic.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

const BRAND = 'Can Bozyiğit';

const C = {
  ink: '#0f172a',
  text: '#1f2937',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  rule: '#cbd5e1',
  soft: '#f8fafc',
  zebra: '#f1f5f9',
};

const trMoney = (n: number, currency = '₺') =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ' + currency;

const stripHtml = (s: string | null | undefined) => {
  if (!s) return '';
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div|li)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ----- shared building blocks -----

const headerBlock = (rightLabel: string): Content => ({
  margin: [50, 28, 50, 0],
  columns: [
    { text: BRAND, fontSize: 14, bold: true, color: C.ink },
    { text: rightLabel, alignment: 'right', fontSize: 10, color: C.muted, margin: [0, 4, 0, 0] },
  ],
});

const footerBlock = (currentPage: number, pageCount: number): Content => ({
  margin: [50, 0, 50, 24],
  columns: [
    {
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: C.line }] },
        {
          columns: [
            { text: BRAND, fontSize: 8, color: C.faint, margin: [0, 8, 0, 0] },
            { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8, color: C.faint, margin: [0, 8, 0, 0] },
          ],
        },
      ],
    },
  ],
});

// thin divider
const rule = (): Content => ({
  margin: [0, 8, 0, 12],
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: C.line }],
});

// section heading with eyebrow style label
const sectionHeading = (label: string): Content => ({
  text: label.toUpperCase(),
  bold: true,
  fontSize: 9,
  color: C.muted,
  characterSpacing: 1.5,
  margin: [0, 12, 0, 6],
});

// 2-column compact key-value strip
const kvGrid = (pairs: { k: string; v: string }[]): Content => {
  const rows: any[][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    rows.push([
      { text: a.k, color: C.muted, fontSize: 9, border: [false, false, false, true], margin: [0, 6, 8, 6], borderColor: [, , , C.line] },
      { text: a.v || '-', fontSize: 10, color: C.ink, border: [false, false, false, true], margin: [0, 6, 16, 6], borderColor: [, , , C.line] },
      ...(b
        ? [
            { text: b.k, color: C.muted, fontSize: 9, border: [false, false, false, true], margin: [0, 6, 8, 6], borderColor: [, , , C.line] },
            { text: b.v || '-', fontSize: 10, color: C.ink, border: [false, false, false, true], margin: [0, 6, 0, 6], borderColor: [, , , C.line] },
          ]
        : [
            { text: '', border: [false, false, false, true], borderColor: [, , , C.line] },
            { text: '', border: [false, false, false, true], borderColor: [, , , C.line] },
          ]),
    ]);
  }
  return {
    table: {
      widths: ['auto', '*', 'auto', '*'],
      body: rows,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  };
};

// signature line — label above line, compact
const signLine = (label: string, width = 220): Content => ({
  margin: [0, 0, 0, 14],
  stack: [
    { text: label, fontSize: 9, color: C.muted, margin: [0, 0, 0, 18] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
  ],
});

// signature row — three lines side by side
const signRow = (): Content => ({
  margin: [0, 24, 0, 0],
  columns: [
    {
      width: '*',
      stack: [
        { text: 'Onay Tarihi', fontSize: 9, color: C.muted, margin: [0, 0, 0, 22] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 130, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
    },
    {
      width: '*',
      stack: [
        { text: 'Onaylayan', fontSize: 9, color: C.muted, margin: [0, 0, 0, 22] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
    },
    {
      width: '*',
      stack: [
        { text: 'Kaşe / İmza', fontSize: 9, color: C.muted, margin: [0, 0, 0, 22] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
    },
  ],
});

// vertical stack of sign blocks (label above line) — for narrow column
const signStack = (lineWidth = 200): Content => ({
  stack: [
    {
      stack: [
        { text: 'Onay Tarihi', fontSize: 9, color: C.muted, margin: [0, 0, 0, 14] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      stack: [
        { text: 'Onaylayan', fontSize: 9, color: C.muted, margin: [0, 0, 0, 14] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      stack: [
        { text: 'Kaşe / İmza', fontSize: 9, color: C.muted, margin: [0, 0, 0, 14] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
      ],
    },
  ],
});

// ----- OFFER -----

interface OfferPdfInput {
  offer: any;
  client: any | null;
  matters: any[];
  author: { fullname: string; phone?: string; email?: string };
}

export async function generateOfferPdf(input: OfferPdfInput): Promise<Buffer> {
  const { offer, client, matters, author } = input;
  const subtotal = matters.reduce((s, m) => s + Number(m.matter_price) * Number(m.matter_unit || 1), 0);
  const kdvPct = 20;
  const kdv = (subtotal * kdvPct) / 100;
  const total = subtotal + kdv;

  const itemsBody: any[][] = [
    [
      { text: 'NO', style: 'th', alignment: 'center' },
      { text: 'HİZMET', style: 'th' },
      { text: 'ADET', style: 'th', alignment: 'center' },
      { text: 'ÜCRET', style: 'th', alignment: 'right' },
    ],
    ...matters.map((m, i) => [
      { text: String(i + 1), alignment: 'center', color: C.muted, margin: [0, 5, 0, 5] },
      {
        stack: [
          { text: m.matter_title, bold: true, color: C.ink, fontSize: 10 },
          ...(m.matter_description
            ? [{ text: stripHtml(m.matter_description), color: C.muted, fontSize: 9, margin: [0, 2, 0, 0] as [number, number, number, number] }]
            : []),
        ],
        margin: [0, 5, 0, 5],
      },
      { text: String(m.matter_unit ?? 1), alignment: 'center', margin: [0, 5, 0, 5] },
      {
        stack: [
          ...(m.matter_old_price && Number(m.matter_old_price) > 0
            ? [{ text: trMoney(Number(m.matter_old_price)), decoration: 'lineThrough' as const, color: C.faint, fontSize: 9 }]
            : []),
          { text: trMoney(Number(m.matter_price) * Number(m.matter_unit || 1)), bold: true, color: C.ink, fontSize: 10 },
        ],
        alignment: 'right',
        margin: [0, 5, 0, 5],
      },
    ]),
    // total summary rows integrated into the items table
    [
      { text: '', border: [false, true, false, false], borderColor: [, C.line, ,], fillColor: undefined as any },
      { text: 'Ara Toplam', alignment: 'right', color: C.muted, fontSize: 10, border: [false, true, false, false], borderColor: [, C.line, ,], margin: [0, 8, 0, 4], fillColor: undefined as any },
      { text: '', border: [false, true, false, false], borderColor: [, C.line, ,], fillColor: undefined as any },
      { text: trMoney(subtotal), alignment: 'right', fontSize: 10, color: C.ink, border: [false, true, false, false], borderColor: [, C.line, ,], margin: [0, 8, 0, 4], fillColor: undefined as any },
    ],
    [
      { text: '', border: [false, false, false, false], fillColor: undefined as any },
      { text: `KDV (%${kdvPct})`, alignment: 'right', color: C.muted, fontSize: 10, border: [false, false, false, false], margin: [0, 2, 0, 4], fillColor: undefined as any },
      { text: '', border: [false, false, false, false], fillColor: undefined as any },
      { text: trMoney(kdv), alignment: 'right', fontSize: 10, color: C.ink, border: [false, false, false, false], margin: [0, 2, 0, 4], fillColor: undefined as any },
    ],
    [
      { text: '', border: [false, true, false, false], borderColor: [, C.rule, ,], fillColor: undefined as any },
      { text: 'Genel Toplam', alignment: 'right', bold: true, color: C.ink, fontSize: 11, border: [false, true, false, false], borderColor: [, C.rule, ,], margin: [0, 8, 0, 4], fillColor: undefined as any },
      { text: '', border: [false, true, false, false], borderColor: [, C.rule, ,], fillColor: undefined as any },
      { text: trMoney(total), alignment: 'right', bold: true, color: C.ink, fontSize: 12, border: [false, true, false, false], borderColor: [, C.rule, ,], margin: [0, 8, 0, 4], fillColor: undefined as any },
    ],
  ];

  const conditionsAndSignature: ContentStack = {
    unbreakable: true,
    margin: [0, 18, 0, 0],
    stack: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'KOŞULLAR', bold: true, fontSize: 9, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 8] },
              {
                ul: [
                  { text: ['Fiyat teklifi ', { text: dateformat3(offer.final_date), bold: true, color: C.ink }, ' tarihine kadar geçerlidir.'], color: C.muted },
                  { text: 'Teklif formu tarafınızdan onaylandıktan sonra geçerlilik kazanır.', color: C.muted },
                  { text: 'Ödeme planı ve teslimat takvimi karşılıklı mutabakat ile belirlenecektir.', color: C.muted },
                ],
                fontSize: 10,
              },
            ],
          },
          { width: 24, text: '' },
          {
            width: 220,
            stack: [
              { text: 'ONAY', bold: true, fontSize: 9, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 14] },
              signStack(220),
            ],
          },
        ],
      },
    ],
  };

  const annexPages: Content[] = matters
    .map((m, i) => {
      const extra = stripHtml(m.matter_extra);
      if (!extra) return null;
      return {
        unbreakable: true,
        margin: [0, 26, 0, 0],
        stack: [
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: C.line }],
            margin: [0, 0, 0, 18],
          },
          { text: `EK ${i + 1}`, fontSize: 9, color: C.muted, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 4] },
          { text: m.matter_title, fontSize: 14, bold: true, color: C.ink, margin: [0, 0, 0, 10] },
          { text: extra, fontSize: 10, color: C.text, lineHeight: 1.4 },
        ],
      };
    })
    .filter((c): c is Content => c !== null);

  const docDef: TDocumentDefinitions = {
    info: { title: `Teklif #${offer.offer_id}`, author: BRAND },
    pageSize: 'A4',
    pageMargins: [50, 70, 50, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text, lineHeight: 1.25 },
    header: () => headerBlock(`Teklif No · #${offer.offer_id}`),
    footer: (cp, pc) => footerBlock(cp, pc),
    content: [
      // ---- Cover-style top
      { text: 'TEKLİF FORMU', fontSize: 9, bold: true, color: C.muted, characterSpacing: 2 },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 28, y2: 0, lineWidth: 2, lineColor: C.ink }],
        margin: [0, 6, 0, 14],
      },
      { text: offer.offer_title, fontSize: 22, bold: true, color: C.ink },
      ...(offer.offer_text ? [{ text: stripHtml(offer.offer_text), color: C.muted, fontSize: 10.5, margin: [0, 6, 0, 0] as [number, number, number, number] }] : []),

      // info strip
      sectionHeading('Bilgiler'),
      kvGrid([
        { k: 'Teklif No', v: '#' + offer.offer_id },
        { k: 'Teklif Tarihi', v: dateformat3(offer.offer_date) },
        { k: 'Firma', v: client?.title ?? '-' },
        { k: 'Geçerlilik', v: dateformat3(offer.final_date) },
        { k: 'İşin Adı', v: offer.offer_title },
        { k: 'Müşteri Temsilcisi', v: author.fullname },
        ...(client?.fullname ? [{ k: 'Yetkili', v: client.fullname }] : []),
        { k: 'İletişim', v: author.phone || author.email || '-' },
      ]),

      sectionHeading('Hizmet ve Ücret Detayları'),
      {
        table: {
          headerRows: 1,
          widths: [28, '*', 40, 90],
          body: itemsBody,
        },
        layout: {
          fillColor: (rowIndex, node) => {
            const totalsStart = node.table.body.length - 3;
            if (rowIndex >= totalsStart) return null;
            if (rowIndex === 0) return C.soft;
            return rowIndex % 2 === 0 ? C.zebra : null;
          },
          hLineWidth: (i, node) => {
            const totalsStart = node.table.body.length - 3;
            if (i === 0) return 0.5;
            if (i === 1) return 0.5;
            if (i === totalsStart) return 0;
            if (i === node.table.body.length) return 0;
            return 0.25;
          },
          hLineColor: () => C.line,
          vLineWidth: () => 0,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      },

      conditionsAndSignature,

      ...annexPages,
    ],
    styles: {
      th: { bold: true, color: C.ink, fontSize: 9, characterSpacing: 1, margin: [0, 10, 0, 10] },
    },
  };

  const doc = printer.createPdfKitDocument(docDef);
  return await streamToBuffer(doc);
}

// ----- AGREEMENT -----

interface AgreementPdfInput {
  offer: any;
  client: any | null;
  agreement: any;
  matters: any[];
}

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<Buffer> {
  const { offer, client, agreement, matters } = input;
  const subtotal = matters.reduce((s, m) => s + Number(m.matter_price) * Number(m.matter_unit || 1), 0);
  const kdvPct = Number(agreement.kdv ?? 20);
  const kdv = (subtotal * kdvPct) / 100;
  const total = subtotal + kdv;

  const itemsBody: any[][] = [
    [
      { text: 'NO', style: 'th', alignment: 'center' },
      { text: 'HİZMET', style: 'th' },
      { text: 'ADET', style: 'th', alignment: 'center' },
      { text: 'ÜCRET', style: 'th', alignment: 'right' },
    ],
    ...matters.map((m, i) => [
      { text: String(i + 1), alignment: 'center', color: C.muted, margin: [0, 6, 0, 6] },
      {
        stack: [
          { text: m.matter_title, bold: true, color: C.ink, fontSize: 10 },
          ...(m.matter_description
            ? [{ text: stripHtml(m.matter_description), color: C.muted, fontSize: 9, margin: [0, 2, 0, 0] as [number, number, number, number] }]
            : []),
        ],
        margin: [0, 6, 0, 6],
      },
      { text: String(m.matter_unit ?? 1), alignment: 'center', margin: [0, 6, 0, 6] },
      { text: trMoney(Number(m.matter_price) * Number(m.matter_unit || 1)), alignment: 'right', bold: true, color: C.ink, fontSize: 10, margin: [0, 6, 0, 6] },
    ]),
  ];

  const totalsBlock: Content = {
    margin: [0, 12, 0, 0],
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        table: {
          widths: ['auto', 110],
          body: [
            [
              { text: 'Ara Toplam', color: C.muted, fontSize: 10, border: [false, false, false, false], margin: [0, 4, 16, 4] },
              { text: trMoney(subtotal), alignment: 'right', fontSize: 10, color: C.ink, border: [false, false, false, false], margin: [0, 4, 0, 4] },
            ],
            [
              { text: `KDV (%${kdvPct})`, color: C.muted, fontSize: 10, border: [false, false, false, false], margin: [0, 4, 16, 4] },
              { text: trMoney(kdv), alignment: 'right', fontSize: 10, color: C.ink, border: [false, false, false, false], margin: [0, 4, 0, 4] },
            ],
            [
              { text: 'Genel Toplam', color: C.ink, bold: true, fontSize: 11, border: [false, true, false, false], borderColor: [, C.rule, ,], margin: [0, 8, 16, 4] },
              { text: trMoney(total), alignment: 'right', bold: true, color: C.ink, fontSize: 12, border: [false, true, false, false], borderColor: [, C.rule, ,], margin: [0, 8, 0, 4] },
            ],
          ],
        },
        layout: {
          hLineWidth: (i) => (i === 2 ? 0.5 : 0),
          vLineWidth: () => 0,
          hLineColor: () => C.rule,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      },
    ],
  };

  // numbered articles
  const article = (no: number, title: string, body: Content): Content => ({
    unbreakable: true,
    margin: [0, 0, 0, 14],
    stack: [
      {
        columns: [
          { width: 28, text: String(no).padStart(2, '0'), bold: true, color: C.muted, fontSize: 11 },
          { width: '*', text: title.toUpperCase(), bold: true, color: C.ink, fontSize: 11, characterSpacing: 0.5 },
        ],
        margin: [0, 0, 0, 8],
      },
      { columns: [{ width: 28, text: '' }, { width: '*', stack: [body] }] },
    ],
  });

  const partyBlock = (label: string, name: string, sub?: string): Content => ({
    stack: [
      { text: label, fontSize: 9, color: C.muted, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 4] },
      { text: name, fontSize: 13, bold: true, color: C.ink },
      ...(sub ? [{ text: sub, fontSize: 10, color: C.muted, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
    ],
  });

  const docDef: TDocumentDefinitions = {
    info: { title: `Sözleşme #${agreement.offer_id}`, author: BRAND },
    pageSize: 'A4',
    pageMargins: [50, 70, 50, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text, lineHeight: 1.35 },
    header: () => headerBlock(`Sözleşme No · #${agreement.offer_id}`),
    footer: (cp, pc) => footerBlock(cp, pc),
    content: [
      // ---- Top
      { text: 'HİZMET SÖZLEŞMESİ', fontSize: 9, bold: true, color: C.muted, characterSpacing: 2 },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 28, y2: 0, lineWidth: 2, lineColor: C.ink }],
        margin: [0, 6, 0, 14],
      },
      { text: agreement.agreement_title, fontSize: 22, bold: true, color: C.ink },
      ...(offer?.offer_text
        ? [{ text: stripHtml(offer.offer_text), color: C.muted, fontSize: 10.5, margin: [0, 6, 0, 0] as [number, number, number, number] }]
        : []),

      // parties summary
      sectionHeading('Taraflar'),
      {
        columns: [
          { width: '*', stack: [partyBlock('YÜKLENİCİ', BRAND)] },
          { width: 1, canvas: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: 50, lineWidth: 0.5, lineColor: C.line }] },
          { width: '*', stack: [partyBlock('MÜŞTERİ', client?.title ?? '-', client?.fullname ?? undefined)], margin: [16, 0, 0, 0] },
        ],
      },

      sectionHeading('Sözleşme Bilgileri'),
      kvGrid([
        { k: 'Sözleşme No', v: '#' + agreement.offer_id },
        { k: 'İmza Tarihi', v: dateformat3(agreement.start_date) },
        { k: 'Başlangıç', v: dateformat3(agreement.start_date) },
        { k: 'Bitiş', v: dateformat3(agreement.end_date) },
        ...(client?.address ? [{ k: 'Adres', v: client.address }] : []),
        { k: 'Vergi Dairesi', v: client?.vk_name ?? '-' },
        { k: 'Vergi/TC No', v: client?.vk_number ?? '-' },
        { k: 'İletişim', v: client?.phone ?? client?.email ?? '-' },
      ]),

      sectionHeading('Maddeler'),

      article(1, 'Tarafların Tanımı', {
        text: [
          'İş bu sözleşme ',
          { text: dateformat3(agreement.start_date), bold: true, color: C.ink },
          ' tarihinde, hizmeti üretip teslim eden ',
          { text: BRAND, bold: true, color: C.ink },
          ' (bundan sonra ',
          { text: 'YÜKLENİCİ', bold: true },
          ' olarak anılacaktır) ile, hizmeti satın alan ',
          { text: (client?.title ?? '-') as string, bold: true, color: C.ink },
          ' (bundan sonra ',
          { text: 'MÜŞTERİ', bold: true },
          ' olarak anılacaktır) arasında imzalanmıştır.',
        ],
        color: C.text,
      }),

      article(2, 'Sözleşmenin Konusu', {
        text:
          'Bu sözleşmenin konusu, MÜŞTERİ tarafından YÜKLENİCİDEN talep edilen ve aşağıda detayları belirtilen hizmetlerin, sözleşmede yazılı süre ve şartlar dahilinde verilmesidir. Tarafların hak ve yükümlülükleri bu sözleşme ile düzenlenmiştir.',
      }),

      article(3, 'Hizmet Detayları ve Ücret', {
        stack: [
          { text: 'Aşağıdaki tabloda yer alan hizmetler bu sözleşmenin ayrılmaz parçasıdır.', margin: [0, 0, 0, 10] },
          {
            table: {
              headerRows: 1,
              widths: [25, '*', 40, 90],
              body: itemsBody,
            },
            layout: {
              fillColor: (rowIndex) => (rowIndex === 0 ? C.soft : rowIndex % 2 === 0 ? C.zebra : null),
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length || i === 1 ? 0.5 : 0.25),
              vLineWidth: () => 0,
              hLineColor: () => C.line,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 0,
              paddingBottom: () => 0,
            },
          },
          totalsBlock,
        ],
      }),

      article(4, 'Süre', {
        text: [
          'Sözleşme ',
          { text: dateformat3(agreement.start_date), bold: true, color: C.ink },
          ' tarihinde başlar ve ',
          { text: dateformat3(agreement.end_date), bold: true, color: C.ink },
          ' tarihinde sona erer. Tarafların yazılı mutabakatı ile süre uzatılabilir.',
        ],
      }),

      article(5, 'Ödeme Şartları', {
        ul: [
          'Ödemeler, taraflar arasında belirlenen plan doğrultusunda banka havalesi/EFT yoluyla yapılır.',
          'Yapılan kısmi ödemeler için makbuz/fatura YÜKLENİCİ tarafından düzenlenir.',
          'Ödeme yapılmaması durumunda YÜKLENİCİ hizmeti askıya alma hakkını saklı tutar.',
        ],
      }),

      article(6, 'Tarafların Yükümlülükleri', {
        stack: [
          { text: ['• ', { text: 'YÜKLENİCİ', bold: true }, ' işin gerektirdiği özen, dikkat ve mesleki yetkinlikle hizmeti yerine getirir; teslim süresine uymakla yükümlüdür.'], margin: [0, 0, 0, 4] },
          { text: ['• ', { text: 'MÜŞTERİ', bold: true }, ' hizmetin sağlanması için gereken bilgi, içerik, görsel ve onayları zamanında YÜKLENİCİYE ulaştırmakla yükümlüdür.'] },
        ],
      }),

      article(7, 'Gizlilik', {
        text:
          'Taraflar, iş bu sözleşmenin ifası sırasında öğrendikleri her türlü ticari, mali, teknik ve mesleki bilgiyi sözleşme süresince ve sözleşme sona erdikten sonra da süresiz olarak gizli tutmayı, üçüncü kişilerle paylaşmamayı kabul ve taahhüt eder.',
      }),

      article(8, 'Fesih ve Uyuşmazlık', {
        text:
          'Taraflardan birinin sözleşme yükümlülüklerine aykırı davranması ve yapılan yazılı bildirime rağmen 7 (yedi) gün içinde aykırılığı gidermemesi halinde diğer taraf sözleşmeyi tek taraflı feshedebilir. Sözleşmeden doğan uyuşmazlıklarda Türkiye Cumhuriyeti yasaları uygulanır ve İstanbul Mahkemeleri yetkilidir.',
      }),

      // signatures
      {
        unbreakable: true,
        margin: [0, 18, 0, 0],
        stack: [
          sectionHeading('İmzalar'),
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'YÜKLENİCİ', fontSize: 9, color: C.muted, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 6] },
                  { text: BRAND, fontSize: 11, bold: true, color: C.ink, margin: [0, 0, 0, 28] },
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
                  { text: 'Kaşe / İmza', fontSize: 9, color: C.muted, margin: [0, 4, 0, 0] },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'MÜŞTERİ', fontSize: 9, color: C.muted, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 6] },
                  { text: client?.title ?? '-', fontSize: 11, bold: true, color: C.ink },
                  { text: client?.fullname ? `Yetkili: ${client.fullname}` : '', fontSize: 10, color: C.muted, margin: [0, 2, 0, 16] },
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: C.rule }] },
                  { text: 'Kaşe / İmza', fontSize: 9, color: C.muted, margin: [0, 4, 0, 0] },
                ],
                margin: [16, 0, 0, 0],
              },
            ],
          },
        ],
      },
    ],
  };

  const doc = printer.createPdfKitDocument(docDef);
  return await streamToBuffer(doc);
}

// ----- util -----

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    (stream as any).end?.();
  });
}
