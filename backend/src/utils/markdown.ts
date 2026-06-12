/**
 * Markdown → blog blokları dönüştürücü (bağımlılıksız).
 *
 * CAWELT sitesinin `Prose` renderer'ının beklediği blok modeline çevirir.
 * Satır içi biçimlendirme (**kalın**, *italik*, `kod`, [metin](url)) ham metin
 * olarak bırakılır; site tarafı parseInline ile işler. Burada yalnızca
 * blok-seviyesi yapı çözülür.
 *
 * Desteklenen söz dizimi:
 *   ## Başlık            → h2
 *   ### Alt başlık       → h3
 *   - madde / * madde    → ul
 *   1. madde             → ol
 *   > alıntı             → quote   (içinde "— Kaynak" satırı cite olur)
 *   :::callout ... :::   → callout
 *   ```lang ... ```      → code
 *   düz paragraf         → p       (ilk paragraf → lead)
 */

export type BlogBlock =
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'callout'; text: string }
  | { type: 'code'; lang?: string; code: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const UL = /^[-*]\s+(.*)$/;
const OL = /^\d+\.\s+(.*)$/;

export function markdownToBlocks(markdown: string): BlogBlock[] {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: BlogBlock[] = [];
  let i = 0;
  let leadAssigned = false;

  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!leadAssigned) {
      leadAssigned = true;
      blocks.push({ type: 'lead', text: trimmed });
    } else {
      blocks.push({ type: 'p', text: trimmed });
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Boş satır
    if (!line) {
      i++;
      continue;
    }

    // Kod bloğu  ```lang
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || undefined;
      const code: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        code.push(lines[i]);
        i++;
      }
      i++; // kapanış ```
      blocks.push({ type: 'code', lang, code: code.join('\n') });
      continue;
    }

    // Callout  :::callout ... :::
    if (line.startsWith(':::')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        body.push(lines[i]);
        i++;
      }
      i++; // kapanış :::
      blocks.push({ type: 'callout', text: body.join(' ').trim() });
      continue;
    }

    // Başlık
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      blocks.push({ type: level >= 3 ? 'h3' : 'h2', text });
      i++;
      continue;
    }

    // Alıntı  > ...
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      let cite: string | undefined;
      const textLines: string[] = [];
      for (const ql of quoteLines) {
        if (/^(—|--)\s*/.test(ql)) {
          cite = ql.replace(/^(—|--)\s*/, '').trim();
        } else if (ql.trim()) {
          textLines.push(ql.trim());
        }
      }
      blocks.push({ type: 'quote', text: textLines.join(' '), ...(cite ? { cite } : {}) });
      continue;
    }

    // Sırasız liste
    if (UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL.test(lines[i].trim())) {
        items.push(lines[i].trim().match(UL)![1].trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Sıralı liste
    if (OL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL.test(lines[i].trim())) {
        items.push(lines[i].trim().match(OL)![1].trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraf — boş satıra ya da özel bir bloğa kadar topla
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (
        !l ||
        l.startsWith('```') ||
        l.startsWith(':::') ||
        l.startsWith('>') ||
        HEADING.test(l) ||
        UL.test(l) ||
        OL.test(l)
      ) {
        break;
      }
      para.push(l);
      i++;
    }
    pushParagraph(para.join(' '));
  }

  return blocks;
}
