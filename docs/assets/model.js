/* SunTally — financial model
 *
 * Two engines:
 *   projectEstimate(i)  — forward-looking 25-year ROI projection from a quote + assumptions
 *   computeTrack(rows, a) — backward-looking actuals from imported utility bills
 *
 * All money in nominal dollars. No data leaves the page; this is pure math.
 */

const SL = (() => {

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

  // Level annual payment for an amortizing loan.
  function annualLoanPayment(principal, apr, years) {
    if (principal <= 0 || years <= 0) return 0;
    const r = apr / 12, n = years * 12;
    const monthly = r === 0 ? principal / n : principal * r / (1 - Math.pow(1 + r, -n));
    return monthly * 12;
  }

  /* ---------------- Estimate (projection) ---------------- */
  // inputs: grossCost, incentives, finance('cash'|'loan'), loanApr, loanTermYears, downPct,
  //   systemKw, productionFactor, annualProduction(optional override), annualUsageKwh,
  //   genRate, deliveryPerKwh, fixedMonthly, exportRate, selfConsumption(0-1),
  //   utilityInflation(0-1/yr), degradation(0-1/yr), years
  function projectEstimate(i) {
    const netCost = Math.max(0, num(i.grossCost) - num(i.incentives));
    const years = clamp(Math.round(num(i.years, 25)), 1, 40);
    const annualProduction = num(i.annualProduction) > 0
      ? num(i.annualProduction)
      : num(i.systemKw) * num(i.productionFactor, 1300);
    const usage = num(i.annualUsageKwh);
    const sc = clamp(num(i.selfConsumption, 0.55), 0, 1);
    const infl = num(i.utilityInflation, 0.03);
    const deg = num(i.degradation, 0.005);

    const isLoan = i.finance === 'loan';
    const down = isLoan ? netCost * clamp(num(i.downPct, 0), 0, 1) : netCost;
    const financed = isLoan ? netCost - down : 0;
    const pmt = isLoan ? annualLoanPayment(financed, num(i.loanApr, 0.07), num(i.loanTermYears, 15)) : 0;
    const term = num(i.loanTermYears, 15);

    const rows = [];
    let cum = -down;                 // cash outlay at install
    let payback = null;
    let totalProd = 0, totalSavings = 0, totalLoan = 0;

    for (let y = 1; y <= years; y++) {
      const f = Math.pow(1 + infl, y - 1);
      const prod = annualProduction * Math.pow(1 - deg, y - 1);
      const self = Math.min(prod * sc, usage);
      const exported = Math.max(prod - self, 0);
      const imported = Math.max(usage - self, 0);

      const rate = num(i.genRate, 0.12) * f;
      const del = num(i.deliveryPerKwh, 0.05) * f;
      const fixedY = num(i.fixedMonthly, 25) * 12 * f;
      const expR = num(i.exportRate, 0.05) * f;

      const billWithout = usage * (rate + del) + fixedY;
      let billWith = imported * (rate + del) + fixedY - exported * expR;
      const grossSavings = billWithout - billWith;
      const loanY = (isLoan && y <= term) ? pmt : 0;
      const net = grossSavings - loanY;

      const prevCum = cum;
      cum += net;
      if (payback === null && prevCum < 0 && cum >= 0) {
        payback = (y - 1) + (-prevCum) / (cum - prevCum); // linear interpolation
      }
      totalProd += prod; totalSavings += grossSavings; totalLoan += loanY;

      rows.push({
        year: y, production: prod, selfUsed: self, exported, imported,
        billWithout, billWith, grossSavings, loanPayment: loanY, net,
        cumulative: cum, genCost: imported * rate, delivery: imported * del + fixedY,
        effRate: usage > 0 ? billWith / usage : 0,
      });
    }

    const lifetimeNet = cum;
    const roiPct = netCost > 0 ? lifetimeNet / netCost : 0;
    return {
      mode: 'estimate', rows,
      summary: {
        netCost, grossCost: num(i.grossCost), incentives: num(i.incentives),
        annualProduction, years, payback, lifetimeNet, roiPct,
        totalProd, totalSavings, totalLoan, down, financed,
        annualPayment: pmt, term,
        avgYr1Savings: rows[0] ? rows[0].grossSavings : 0,
        deliveryShareYr1: rows[0] ? rows[0].delivery / (rows[0].delivery + rows[0].genCost || 1) : 0,
      },
    };
  }

  /* ---------------- Track (actuals from bills) ---------------- */
  // rows: [{month, produced, delivered, sentback, billed, generationCharge, deliveryCharge, panelPayment}]
  // assumptions: { noPanelRate ($/kWh, all-in counterfactual), fixedMonthly($) }
  function computeTrack(rawRows, a = {}) {
    const rows = (rawRows || []).filter(r => r && r.month)
      .map(r => ({
        month: r.month,
        produced: num(r.produced), delivered: num(r.delivered), sentback: num(r.sentback),
        billed: num(r.billed), generationCharge: num(r.generationCharge),
        deliveryCharge: num(r.deliveryCharge), panelPayment: num(r.panelPayment),
      }))
      .sort((x, y) => x.month < y.month ? -1 : x.month > y.month ? 1 : 0);

    // Default counterfactual rate: the *marginal* retail rate you face = total energy
    // charges per net-billed kWh. (Using charges/total-usage would understate it, since
    // solar shrinks the billed kWh while fixed fees stay — making the blended rate look
    // artificially low. The marginal rate is what you'd actually pay per kWh without solar.)
    let sumBilled = 0, sumUsage = 0, sumCharges = 0;
    rows.forEach(r => {
      sumBilled += r.billed;
      sumUsage += r.produced - r.sentback + r.delivered;
      sumCharges += r.generationCharge + r.deliveryCharge;
    });
    const marginal = sumBilled > 0 ? sumCharges / sumBilled
      : (sumUsage > 0 ? sumCharges / sumUsage : 0.15);
    const noPanelRate = num(a.noPanelRate) > 0 ? num(a.noPanelRate) : +(marginal).toFixed(4);
    const fixedMonthly = num(a.fixedMonthly, 0);

    let cum = 0;
    const out = rows.map(r => {
      const usage = r.produced - r.sentback + r.delivered;
      const invoice = r.generationCharge + r.deliveryCharge;
      const actual = invoice + r.panelPayment;
      const hypo = usage * noPanelRate + fixedMonthly;   // what you'd have paid w/o solar
      const savings = hypo - actual;
      cum += savings;
      return {
        month: r.month, produced: r.produced, delivered: r.delivered, sentback: r.sentback,
        billed: r.billed, usage,
        genCost: r.generationCharge, delivery: r.deliveryCharge, panelPayment: r.panelPayment,
        invoice, actual, hypo, savings, cumulative: cum,
        pctCovered: usage > 0 ? r.produced / usage : 0,
        effRate: usage > 0 ? invoice / usage : 0,
        deliveryShare: (r.deliveryCharge + r.generationCharge) > 0
          ? r.deliveryCharge / (r.deliveryCharge + r.generationCharge) : 0,
      };
    });

    const S = k => out.reduce((s, r) => s + (r[k] || 0), 0);
    const summary = {
      n: out.length,
      first: out[0] ? out[0].month : null, last: out[out.length - 1] ? out[out.length - 1].month : null,
      produced: S('produced'), usage: S('usage'), sentback: S('sentback'),
      invoice: S('invoice'), panelPayment: S('panelPayment'), genCost: S('genCost'), delivery: S('delivery'),
      totalPaid: S('actual'), hypo: S('hypo'), cumSavings: out.length ? out[out.length - 1].cumulative : 0,
      pctCovered: S('usage') > 0 ? S('produced') / S('usage') : 0,
      selfConsumed: S('usage') > 0 ? (S('produced') - S('sentback')) / S('usage') : 0,
      blendedRate: S('usage') > 0 ? S('invoice') / S('usage') : 0,
      deliveryShare: (S('delivery') + S('genCost')) > 0 ? S('delivery') / (S('delivery') + S('genCost')) : 0,
      avgBill: out.length ? S('invoice') / out.length : 0,
      noPanelRate,
    };
    return { mode: 'track', rows: out, summary };
  }

  return { projectEstimate, computeTrack, annualLoanPayment, _num: num };
})();

if (typeof module !== 'undefined') module.exports = SL;
