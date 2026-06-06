/* SunTally — local-first data store
 *
 * The "database product": utility-bill rows live in your browser (localStorage),
 * never on a server. Import from CSV/XLSX, edit, export to JSON/CSV. Nothing leaves
 * the page. Depends on PapaParse (Papa) and SheetJS (XLSX) globals, loaded in app.html.
 */
const SLStore = (() => {
  const KEY = 'suntally.bills.v1';

  // Canonical schema + accepted header aliases (case/space/underscore-insensitive).
  const FIELDS = [
    { key: 'month',            aliases: ['month','date','bill month','billing month','period','statement date'] },
    { key: 'produced',         aliases: ['produced','produced kwh','total kwh produced','solar produced','generation kwh','solar kwh'] },
    { key: 'delivered',        aliases: ['delivered','delivered kwh','total delivered','dlvd','from grid','grid import','imported kwh'] },
    { key: 'sentback',         aliases: ['sentback','sent back','total kwh sent back','rcvd','received','exported','exported kwh','to grid'] },
    { key: 'billed',           aliases: ['billed','billed kwh','generation billed','net kwh','billed usage','net billed'] },
    { key: 'generationCharge', aliases: ['generationcharge','generation charge','generation cost','supply charge','energy charge','generation'] },
    { key: 'deliveryCharge',   aliases: ['deliverycharge','delivery charge','delivery','delivery fees','delivery/admin','transmission','distribution'] },
    { key: 'panelPayment',     aliases: ['panelpayment','panel payment','loan payment','solar payment','lease payment','financing'] },
  ];
  const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');

  function buildHeaderMap(headers) {
    const map = {};
    headers.forEach(h => {
      const n = norm(h);
      for (const f of FIELDS) if (f.aliases.includes(n)) { map[h] = f.key; break; }
    });
    return map;
  }

  function normalizeMonth(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 7);
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);     // 2024-03 / 2024/3/15
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);            // 3/15/2024
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(+m[1]).padStart(2, '0')}`; }
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 7);
    return s;
  }

  const numify = v => {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : 0;
  };

  function normalizeRows(records, headerMap) {
    return records.map(rec => {
      const row = { month: '', produced: 0, delivered: 0, sentback: 0, billed: 0, generationCharge: 0, deliveryCharge: 0, panelPayment: 0 };
      for (const h in rec) {
        const key = headerMap[h];
        if (!key) continue;
        row[key] = key === 'month' ? normalizeMonth(rec[h]) : numify(rec[h]);
      }
      return row;
    }).filter(r => r.month);
  }

  function parseCSV(text) {
    const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
    const headers = res.meta.fields || [];
    return { rows: normalizeRows(res.data, buildHeaderMap(headers)), headers, mapped: buildHeaderMap(headers) };
  }

  function parseXLSX(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headers = json.length ? Object.keys(json[0]) : [];
    return { rows: normalizeRows(json, buildHeaderMap(headers)), headers, mapped: buildHeaderMap(headers) };
  }

  function validate(rows) {
    const warnings = [];
    rows.forEach((r, i) => {
      if (!/^\d{4}-\d{2}$/.test(r.month)) warnings.push(`Row ${i + 1}: couldn't parse month "${r.month}"`);
      if (r.produced === 0 && r.delivered === 0) warnings.push(`Row ${i + 1}: no production or delivery — check columns mapped correctly`);
    });
    return warnings;
  }

  // persistence
  const save = rows => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  // export
  function toCSV(rows) {
    const cols = FIELDS.map(f => f.key);
    const head = ['month','produced_kwh','delivered_kwh','sent_back_kwh','billed_kwh','generation_charge','delivery_charge','panel_payment'];
    const lines = [head.join(',')];
    rows.forEach(r => lines.push(cols.map(c => r[c]).join(',')));
    return lines.join('\n');
  }
  const TEMPLATE = toCSV([
    { month: '2024-01', produced: 256, delivered: 1009, sentback: 116, billed: 893, generationCharge: 46.26, deliveryCharge: 68.09, panelPayment: 0 },
    { month: '2024-02', produced: 480, delivered: 690, sentback: 240, billed: 450, generationCharge: 22.40, deliveryCharge: 64.47, panelPayment: 0 },
  ]);

  // Deterministic synthetic sample (NOT real — for the live demo).
  function sample() {
    const rows = [];
    let y = 2022, m = 1;
    // seasonal production (summer high) and usage (summer + winter high) shapes
    const prodShape = [0.45,0.6,0.85,1.05,1.15,1.2,1.15,1.05,0.95,0.75,0.5,0.4];
    const useShape  = [1.2,1.05,0.85,0.8,0.85,1.1,1.35,1.3,1.0,0.8,0.95,1.25];
    for (let k = 0; k < 36; k++) {
      const i = m - 1;
      const produced = Math.round(820 * prodShape[i]);
      const usage = Math.round(1150 * useShape[i]);
      const sentback = Math.round(produced * 0.45);
      const selfUsed = produced - sentback;
      const delivered = Math.max(0, usage - selfUsed);
      const billed = Math.max(0, delivered - sentback);
      const genRate = 0.075, delivPerKwh = 0.045, fixed = 14;
      const generationCharge = +(billed * genRate).toFixed(2);
      const deliveryCharge = +(delivered * delivPerKwh + fixed).toFixed(2);
      const panelPayment = k < 30 ? 95 : 0;   // loan paid off after 30 months
      rows.push({ month: `${y}-${String(m).padStart(2,'0')}`, produced, delivered, sentback, billed, generationCharge, deliveryCharge, panelPayment });
      m++; if (m > 12) { m = 1; y++; }
    }
    return rows;
  }

  return { FIELDS, parseCSV, parseXLSX, validate, save, load, clear, toCSV, TEMPLATE, sample, normalizeMonth };
})();
