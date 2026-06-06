/* SunTally — document extraction (privacy-first, in-browser)
 *
 * extractText(file, onProgress) — pull text from a PDF (pdf.js) or image (Tesseract OCR).
 *   Libraries are lazy-loaded from CDN only when this is first used, so the app stays light.
 *   Nothing is uploaded — parsing happens entirely in the browser.
 * extractFields(text) — best-effort heuristic: find candidate values for the Estimate form
 *   by binding each value to its own label, and return them with the surrounding snippet so
 *   the user can verify before applying.
 *
 * Honest about being best-effort. A future opt-in could send text to an LLM for higher
 * accuracy, but that needs a network call, so it's off by default to keep the privacy promise.
 */
const SLExtract = (() => {
  const PDF = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js';

  function loadScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src === src)) return res();
      const s = document.createElement('script'); s.src = src;
      s.onload = () => res(); s.onerror = () => rej(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  let pdfReady, tessReady;
  async function ensurePdf() {
    if (!pdfReady) pdfReady = loadScript(PDF).then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; });
    return pdfReady;
  }
  async function ensureTess() { if (!tessReady) tessReady = loadScript(TESS); return tessReady; }

  async function pdfToText(buf) {
    await ensurePdf();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const n = Math.min(pdf.numPages, 15);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      text += ' ' + c.items.map(it => it.str).join(' ');
    }
    return { text, pdf };
  }
  async function pdfOcr(pdf, onProgress) {
    await ensureTess();
    let text = '';
    const n = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const { data } = await window.Tesseract.recognize(cv, 'eng', { logger: onProgress });
      text += ' ' + data.text;
    }
    return text;
  }
  async function ocrImage(file, onProgress) {
    await ensureTess();
    const { data } = await window.Tesseract.recognize(file, 'eng', { logger: onProgress });
    return data.text;
  }

  async function extractText(file, onProgress) {
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (isPdf) {
      const buf = await file.arrayBuffer();
      const { text, pdf } = await pdfToText(buf);
      if (text.replace(/\s/g, '').length > 40) return { text, method: 'pdf-text' };
      onProgress && onProgress({ status: 'ocr' });
      return { text: await pdfOcr(pdf, onProgress), method: 'pdf-ocr' };
    }
    return { text: await ocrImage(file, onProgress), method: 'image-ocr' };
  }

  /* ---------------- heuristics ---------------- */
  const num = s => parseFloat(String(s).replace(/[$,\s]/g, ''));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Label-bound match: find a keyword, then the FIRST value within a short distance after it.
  // Binding the value to its own label avoids neighbouring fields poisoning each other.
  // `labels` are in priority order; `valSrc` is a regex string with capture group 1.
  function labeled(text, labels, valSrc, opts = {}) {
    const { min, max, transform, gap = 32 } = opts;
    for (const lab of labels) {
      const re = new RegExp(esc(lab) + '[^\\n]{0,' + gap + '}?' + valSrc, 'gi');
      let m;
      while ((m = re.exec(text))) {
        const v = transform ? transform(m) : num(m[1]);
        if (!isFinite(v)) continue;
        if (min != null && v < min) continue;
        if (max != null && v > max) continue;
        const snip = text.slice(m.index, Math.min(text.length, m.index + m[0].length + 6)).replace(/\s+/g, ' ').trim();
        return { value: v, snippet: snip };
      }
    }
    return null;
  }
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function toYM(s) {
    let m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + String(+m[1]).padStart(2, '0'); }
    m = String(s).match(/([A-Za-z]{3,9})\s+\d{1,2},?\s+(\d{4})/);
    if (m) { const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); if (mo >= 0) return m[2] + '-' + String(mo + 1).padStart(2, '0'); }
    m = String(s).match(/(\d{4})-(\d{2})/);
    if (m) return m[1] + '-' + m[2];
    return '';
  }

  // Parse a single utility bill into one monthly row (best-effort; user verifies/edits).
  function extractBillRow(raw) {
    const text = String(raw || '').replace(/[ ]/g, ' ').replace(/[ \t]+/g, ' ');
    // Month: prefer a billing-period end date, then statement date, then any date.
    let month = '';
    const rng = /(?:billing period|service (?:from|period|dates)|period|cycle)[^\n]{0,50}?(\d{1,2}\/\d{1,2}\/\d{2,4})\D{1,6}(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text);
    if (rng) month = toYM(rng[2]);
    if (!month) { const sd = /(?:statement|bill|invoice)\s*date[^\n]{0,20}?([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text); if (sd) month = toYM(sd[1]); }
    if (!month) { const any = /(\d{1,2}\/\d{1,2}\/\d{2,4})|([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/.exec(text); if (any) month = toYM(any[0]); }

    const kwh = labels => { const r = labeled(text, labels, '([\\d,]{1,6})(?:\\s*kwh)?', { min: 0, max: 200000 }); return r ? r.value : 0; };
    const usd = labels => { const r = labeled(text, labels, '\\$?\\s?([\\d,]{1,6}(?:\\.\\d{2})?)', { min: 1, max: 100000 }); return r ? r.value : 0; };

    const delivered = kwh(['kwh delivered', 'delivered', 'dlvd', 'energy delivered', 'delivered to you', 'electricity delivered', 'total kwh used']);
    const sentback = kwh(['kwh received', 'received', 'rcvd', 'energy received', 'delivered to grid', 'sent to grid', 'exported', 'kwh exported']);
    let billed = kwh(['billed usage', 'net usage', 'net kwh', 'billed kwh', 'total billed']);
    if (!billed && delivered) billed = Math.max(0, delivered - sentback);
    const generationCharge = usd(['generation charge', 'generation', 'supply charge', 'supply', 'energy charge']);
    const deliveryCharge = usd(['delivery charge', 'delivery', 'distribution charge', 'distribution']);

    return { month, produced: 0, delivered, sentback, billed, generationCharge, deliveryCharge, panelPayment: 0 };
  }
  // Unit-strong fallback: first plausible "<num> <unit>" anywhere.
  function unitFirst(text, valSrc, opts = {}) {
    const { min, max, transform } = opts;
    const re = new RegExp(valSrc, 'gi'); let m;
    while ((m = re.exec(text))) {
      const v = transform ? transform(m) : num(m[1]);
      if (!isFinite(v)) continue;
      if (min != null && v < min) continue;
      if (max != null && v > max) continue;
      const s = Math.max(0, m.index - 24);
      return { value: v, snippet: text.slice(s, Math.min(text.length, m.index + m[0].length + 6)).replace(/\s+/g, ' ').trim() };
    }
    return null;
  }

  function extractFields(raw) {
    const text = String(raw || '').replace(/[ ]/g, ' ').replace(/[ \t]+/g, ' ');
    const DP = { genRate: 4, deliveryPerKwh: 4, exportRate: 4, loanApr: 2, systemKw: 2, fixedMonthly: 2 };
    const out = [];
    const push = (key, r) => { if (r && r.value > 0) out.push({ key, value: +r.value.toFixed(DP[key] != null ? DP[key] : 0), snippet: r.snippet }); };

    // System size — kW
    push('systemKw',
      labeled(text, ['system size', 'system', 'array size', 'size', 'pv system'], '([\\d.]{1,5})\\s*kw', { min: 1, max: 60 })
      || unitFirst(text, '([\\d.]{1,5})\\s*kw(?:\\s*dc)?', { min: 1, max: 60 })
      || unitFirst(text, '([\\d,]{4,6})\\s*w(?:\\s*dc)?\\b', { min: 1000, max: 60000, transform: m => num(m[1]) / 1000 }));

    // Annual production
    push('annualProduction',
      labeled(text, ['estimated annual production', 'annual production', 'estimated production', 'year 1 production', 'first year production', 'annual output', 'production', 'will produce', 'produce'], '([\\d,]{4,6})\\s*kwh', { min: 1500, max: 60000, gap: 40 }));

    // Annual usage / consumption
    push('annualUsageKwh',
      labeled(text, ['current annual usage', 'annual usage', 'annual consumption', 'annual electricity use', 'electricity usage', 'usage'], '([\\d,]{4,6})\\s*kwh', { min: 3000, max: 60000 }));

    // Gross cost
    push('grossCost',
      labeled(text, ['gross system cost', 'gross cost', 'system cost', 'contract price', 'total system cost', 'total cost', 'purchase price', 'cash price', 'total price'], '\\$?\\s?([\\d,]{4,7}(?:\\.\\d{2})?)', { min: 4000, max: 250000 }));

    // Incentives — explicit tax-credit value, else 30%/26% of gross
    let inc = labeled(text, ['federal tax credit', 'tax credit', 'itc', 'federal itc', 'rebate', 'incentive'], '-?\\$?\\s?([\\d,]{3,7}(?:\\.\\d{2})?)', { min: 500, max: 100000 });
    if (!inc) { const pct = /\b(30|26)\s*%/.exec(text); const g = out.find(o => o.key === 'grossCost'); if (pct && g) inc = { value: Math.round(g.value * (+pct[1] / 100)), snippet: pct[0] + ' federal tax credit (computed)' }; }
    push('incentives', inc);

    // Loan APR — "APR: 6.49%" or reverse "7.99% APR"
    push('loanApr',
      labeled(text, ['apr', 'interest rate', 'annual percentage rate'], '([\\d.]{1,5})\\s*%', { min: 0.1, max: 18 })
      || (() => { const m = /([\d.]{1,5})\s*%\s*apr/i.exec(text); return m && +m[1] <= 18 ? { value: +m[1], snippet: m[0] } : null; })());

    // Loan term — years, else months
    push('loanTermYears',
      labeled(text, ['term', 'loan term', 'repayment', 'loan'], '([\\d]{1,2})\\s*(?:years|yrs|year|yr)', { min: 3, max: 30 })
      || labeled(text, ['term', 'loan term', 'repayment', 'loan'], '([\\d]{2,3})\\s*months?', { min: 3, max: 30, transform: m => num(m[1]) / 12 }));

    // Per-kWh rates (label-bound so generation/delivery don't collide)
    const rate = '\\$?\\s?(0?\\.\\d{2,4})\\s*(?:per\\s*kwh|/\\s*kwh|kwh)';
    push('genRate', labeled(text, ['generation charge', 'generation', 'supply charge', 'supply', 'energy charge'], rate, { min: 0.02, max: 0.6 }));
    push('deliveryPerKwh', labeled(text, ['delivery charge', 'delivery', 'distribution charge', 'distribution', 'transmission'], rate, { min: 0.01, max: 0.6 }));
    push('exportRate', labeled(text, ['net metering', 'export credit', 'export', 'buyback', 'nem credit', 'sell back', 'sellback'], rate, { min: 0.01, max: 0.6 }));

    // Fixed monthly charge
    push('fixedMonthly',
      labeled(text, ['customer service charge', 'customer charge', 'basic service charge', 'basic service', 'service charge', 'fixed charge', 'base charge', 'monthly charge', 'meter charge'], '\\$?\\s?(\\d{1,2}(?:\\.\\d{2})?)', { min: 3, max: 80 }));

    const seen = new Set();
    return out.filter(o => !seen.has(o.key) && seen.add(o.key));
  }

  return { extractText, extractFields, extractBillRow };
})();
if (typeof module !== 'undefined') module.exports = SLExtract;
