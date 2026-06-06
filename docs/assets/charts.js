/* SunTally — ECharts rendering layer (depends on echarts global) */
const SLCharts = (() => {
  const C = { gold:'#ffb020', grid:'#3b82f6', green:'#22c55e', red:'#ef4444', teal:'#2dd4bf', violet:'#a78bfa', mut:'#8b97ab' };
  const fUSD = (n, d = 0) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fK = n => Math.round(n).toLocaleString('en-US') + ' kWh';
  const G = (r, g, b) => `rgb(${r},${g},${b})`;
  function grad(rgb, a1 = .4, a2 = .02) {
    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: rgb.replace('rgb(', 'rgba(').replace(')', `,${a1})`) },
      { offset: 1, color: rgb.replace('rgb(', 'rgba(').replace(')', `,${a2})`) },
    ]);
  }
  const axL = { lineStyle: { color: '#2a3445' } };
  const baseGrid = { left: 60, right: 22, top: 30, bottom: 42 };
  const TT = { trigger: 'axis', backgroundColor: 'rgba(13,20,34,.97)', borderColor: '#2a3445', borderWidth: 1,
    textStyle: { color: '#e8edf6', fontSize: 12 }, axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,.04)' } } };
  const LEG = () => ({ textStyle: { color: '#8b97ab', fontSize: 11 }, top: 2, right: 6, itemWidth: 12, itemHeight: 8, icon: 'roundRect' });
  function catAxis(cats) {
    return { type: 'category', data: cats, boundaryGap: true, axisLine: axL, axisTick: { show: false },
      axisLabel: { color: '#8b97ab', fontSize: 10, hideOverlap: true, interval: cats.length > 30 ? Math.floor(cats.length / 16) : 'auto' } };
  }
  function valAxis(name, fmt) {
    return { type: 'value', name, nameTextStyle: { color: '#5b6678', fontSize: 10, align: 'left' },
      axisLabel: { color: '#8b97ab', fontSize: 11, formatter: fmt }, splitLine: { lineStyle: { color: '#161e2c' } } };
  }
  function dz(use) {
    return use ? [{ type: 'inside', throttle: 50 }, { type: 'slider', height: 14, bottom: 6, borderColor: '#2a3445',
      fillerColor: 'rgba(59,130,246,.12)', handleStyle: { color: '#3b82f6' },
      dataBackground: { lineStyle: { color: '#2a3445' }, areaStyle: { color: '#141c2b' } },
      textStyle: { color: '#5b6678', fontSize: 9 } }] : [];
  }
  const tipRow = (color, name, val) =>
    `<div style="display:flex;justify-content:space-between;gap:18px"><span>${color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:6px"></span>` : ''}${name}</span><b>${val}</b></div>`;

  const charts = {};
  function get(id) {
    if (!charts[id]) charts[id] = echarts.init(document.getElementById(id), null, { renderer: 'canvas' });
    return charts[id];
  }
  let modalChart = null;
  function expand(id) {
    const src = charts[id]; if (!src) return;
    const el = document.getElementById('expandChart'); if (!el) return;
    if (!modalChart) modalChart = echarts.init(el, null, { renderer: 'canvas' });
    modalChart.setOption(src.getOption(), true);
    setTimeout(() => modalChart && modalChart.resize(), 40);
  }
  function collapse() { if (modalChart) modalChart.clear(); }
  function resizeAll() { Object.values(charts).forEach(c => c.resize()); if (modalChart) modalChart.resize(); }

  /* ---------------- Estimate ---------------- */
  function renderEstimate(res) {
    const rows = res.rows, cats = rows.map(r => 'Yr ' + r.year), use = cats.length > 16;
    const gridB = use ? Object.assign({}, baseGrid, { bottom: 58 }) : baseGrid;
    const pb = res.summary.payback;

    // Hero: cumulative net cashflow (payback)
    const mp = pb ? { symbol: 'pin', symbolSize: 38, itemStyle: { color: 'rgba(34,197,94,.9)' },
      label: { color: '#fff', fontSize: 9, formatter: 'payback' },
      data: [{ coord: [Math.round(pb) - 1 < 0 ? 0 : Math.min(Math.round(pb) - 1, rows.length - 1), Math.round(rows[Math.min(Math.max(Math.round(pb) - 1, 0), rows.length - 1)].cumulative)] }] } : { data: [] };
    get('e_cum').setOption({
      grid: gridB, tooltip: Object.assign({}, TT, { valueFormatter: v => fUSD(v, 0) }), dataZoom: dz(use),
      xAxis: catAxis(cats), yAxis: valAxis('$', v => '$' + (v / 1000).toFixed(0) + 'k'),
      series: [{ name: 'Cumulative net', type: 'line', smooth: .3, symbol: 'none',
        data: rows.map(r => Math.round(r.cumulative)), itemStyle: { color: C.gold }, lineStyle: { width: 2.5, color: C.gold },
        areaStyle: { color: grad(G(255,176,32), .32, .01) },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: '#5b6678', type: 'dashed' },
          data: [{ yAxis: 0, label: { formatter: 'break-even', color: '#5b6678', fontSize: 10, position: 'insideEndTop' } }] },
        markPoint: mp }],
    }, true);

    // Annual savings vs loan payment
    get('e_sav').setOption({
      grid: gridB, legend: LEG(), tooltip: Object.assign({}, TT, { valueFormatter: v => fUSD(v, 0) }), dataZoom: dz(use),
      xAxis: catAxis(cats), yAxis: valAxis('$'),
      series: [
        { name: 'Gross savings', type: 'bar', data: rows.map(r => Math.round(r.grossSavings)), itemStyle: { color: 'rgba(34,197,94,.8)', borderRadius: [2,2,0,0] } },
        { name: 'Loan payment', type: 'bar', data: rows.map(r => -Math.round(r.loanPayment)), itemStyle: { color: 'rgba(239,68,68,.7)', borderRadius: [0,0,2,2] } },
      ],
    }, true);

    // With vs without (cumulative cost)
    let ca = res.summary.down, cw = 0; const A = [], W = [];
    rows.forEach(r => { ca += r.billWith + r.loanPayment; cw += r.billWithout; A.push(Math.round(ca)); W.push(Math.round(cw)); });
    get('e_vs').setOption({
      grid: gridB, legend: LEG(), dataZoom: dz(use), xAxis: catAxis(cats), yAxis: valAxis('$', v => '$' + (v/1000).toFixed(0) + 'k'),
      tooltip: Object.assign({}, TT, { formatter: p => { const i = p[0].dataIndex, gap = W[i] - A[i];
        return `<div style="font-weight:600;margin-bottom:4px">${cats[i]}</div>` +
          tipRow(C.red, 'Without solar', fUSD(W[i])) + tipRow(C.gold, 'With solar', fUSD(A[i])) +
          `<div style="border-top:1px solid #2a3445;margin:5px 0 3px"></div>` +
          tipRow('', gap >= 0 ? 'Ahead' : 'Behind', `<span style="color:${gap>=0?C.green:C.red}">${fUSD(gap)}</span>`); } }),
      series: [
        { name: 'Without solar', type: 'line', smooth: .3, symbol: 'none', data: W, itemStyle: { color: C.red }, lineStyle: { color: C.red, width: 2 }, areaStyle: { color: grad(G(239,68,68), .12, .01) } },
        { name: 'With solar', type: 'line', smooth: .3, symbol: 'none', data: A, itemStyle: { color: C.gold }, lineStyle: { color: C.gold, width: 2 }, areaStyle: { color: grad(G(255,176,32), .16, .01) } },
      ],
    }, true);

    // Bill composition over time (gen vs delivery)
    get('e_bill').setOption({
      grid: gridB, legend: LEG(), dataZoom: dz(use), xAxis: catAxis(cats), yAxis: valAxis('$'),
      tooltip: Object.assign({}, TT, { valueFormatter: v => fUSD(v, 0) }),
      series: [
        { name: 'Generation', type: 'bar', stack: 'b', data: rows.map(r => Math.round(r.genCost)), itemStyle: { color: 'rgba(255,176,32,.85)' } },
        { name: 'Delivery / fixed', type: 'bar', stack: 'b', data: rows.map(r => Math.round(r.delivery)), itemStyle: { color: 'rgba(96,165,250,.7)', borderRadius: [3,3,0,0] } },
      ],
    }, true);
    resizeAll();
  }

  /* ---------------- Track ---------------- */
  function renderTrack(res) {
    const rows = res.rows, cats = rows.map(r => fmtMonth(r.month)), use = cats.length > 14;
    const gridB = use ? Object.assign({}, baseGrid, { bottom: 60 }) : baseGrid;

    get('t_cum').setOption({
      grid: gridB, tooltip: Object.assign({}, TT, { valueFormatter: v => fUSD(v, 0) }), dataZoom: dz(use),
      xAxis: catAxis(cats), yAxis: valAxis('$', v => '$' + (v/1000).toFixed(0) + 'k'),
      series: [{ name: 'Cumulative net', type: 'line', smooth: .3, symbol: 'none', data: rows.map(r => Math.round(r.cumulative)),
        itemStyle: { color: C.gold }, lineStyle: { width: 2.5, color: C.gold }, areaStyle: { color: grad(G(255,176,32), .32, .01) },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: '#5b6678', type: 'dashed' },
          data: [{ yAxis: 0, label: { formatter: 'break-even', color: '#5b6678', fontSize: 10, position: 'insideEndTop' } }] } }],
    }, true);

    get('t_sav').setOption({
      grid: gridB, dataZoom: dz(use), xAxis: catAxis(cats), yAxis: valAxis('$'),
      tooltip: Object.assign({}, TT, { formatter: p => { const i = p[0].dataIndex, r = rows[i];
        return `<div style="font-weight:600;margin-bottom:4px">${cats[i]}</div>` +
          tipRow(C.red, 'Without panels', fUSD(r.hypo)) + tipRow(C.teal, 'Actual all-in', fUSD(r.actual)) +
          tipRow('', 'Savings', `<span style="color:${r.savings>=0?C.green:C.red}">${fUSD(r.savings)}</span>`); } }),
      series: [{ name: 'Net savings', type: 'bar', data: rows.map(r => ({ value: Math.round(r.savings), itemStyle: { color: r.savings >= 0 ? C.green : C.red, borderRadius: [2,2,0,0] } })) }],
    }, true);

    get('t_energy').setOption({
      grid: gridB, legend: LEG(), dataZoom: dz(use), xAxis: catAxis(cats),
      tooltip: Object.assign({}, TT, { valueFormatter: v => typeof v === 'number' ? (v <= 1.5 ? (v*100).toFixed(0)+'%' : Math.round(v).toLocaleString()+' kWh') : v }),
      yAxis: [valAxis('kWh'), Object.assign(valAxis('covered', v => (v*100).toFixed(0)+'%'), { max: 1.05, min: 0, position: 'right', splitLine: { show: false } })],
      series: [
        { name: 'Produced', type: 'bar', data: rows.map(r => Math.round(r.produced)), itemStyle: { color: grad(G(255,176,32), .95, .55), borderRadius: [3,3,0,0] } },
        { name: 'Total usage', type: 'bar', data: rows.map(r => Math.round(r.usage)), itemStyle: { color: 'rgba(96,165,250,.55)', borderRadius: [3,3,0,0] } },
        { name: '% covered', type: 'line', yAxisIndex: 1, smooth: .3, symbol: 'none', data: rows.map(r => +r.pctCovered.toFixed(3)), itemStyle: { color: C.green }, lineStyle: { color: C.green, width: 2 } },
      ],
    }, true);

    get('t_bill').setOption({
      grid: gridB, legend: LEG(), dataZoom: dz(use), xAxis: catAxis(cats), yAxis: valAxis('$'),
      tooltip: Object.assign({}, TT, { valueFormatter: v => fUSD(v, 2) }),
      series: [
        { name: 'Generation', type: 'bar', stack: 'b', data: rows.map(r => +r.genCost.toFixed(2)), itemStyle: { color: 'rgba(255,176,32,.85)' } },
        { name: 'Delivery / admin', type: 'bar', stack: 'b', data: rows.map(r => +r.delivery.toFixed(2)), itemStyle: { color: 'rgba(96,165,250,.7)', borderRadius: [3,3,0,0] } },
      ],
    }, true);

    get('t_rate').setOption({
      grid: gridB, dataZoom: dz(use), xAxis: catAxis(cats), yAxis: valAxis('$/kWh', v => '$' + v.toFixed(2)),
      tooltip: Object.assign({}, TT, { valueFormatter: v => '$' + (+v).toFixed(3) + '/kWh used' }),
      series: [{ name: 'Cost per kWh used', type: 'line', smooth: .3, symbol: 'none', data: rows.map(r => +r.effRate.toFixed(3)),
        itemStyle: { color: C.gold }, lineStyle: { color: C.gold, width: 2 }, areaStyle: { color: grad(G(255,176,32), .2, .01) },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: '#5b6678', type: 'dashed' },
          data: [{ yAxis: res.summary.blendedRate, label: { formatter: 'avg $' + res.summary.blendedRate.toFixed(3), color: '#5b6678', fontSize: 10 } }] } }],
    }, true);

    get('t_share').setOption({
      grid: gridB, dataZoom: dz(use), xAxis: catAxis(cats), yAxis: Object.assign(valAxis('', v => (v*100).toFixed(0)+'%'), { max: 1, min: 0 }),
      tooltip: Object.assign({}, TT, { valueFormatter: v => (v*100).toFixed(0) + '%' }),
      series: [{ name: 'Delivery share', type: 'line', smooth: .3, symbol: 'none', data: rows.map(r => +r.deliveryShare.toFixed(3)),
        itemStyle: { color: C.grid }, lineStyle: { color: C.grid, width: 2 }, areaStyle: { color: grad(G(59,130,246), .25, .01) },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: '#5b6678', type: 'dashed' },
          data: [{ yAxis: res.summary.deliveryShare, label: { formatter: 'avg ' + (res.summary.deliveryShare*100).toFixed(0) + '%', color: '#5b6678', fontSize: 10 } }] } }],
    }, true);
    resizeAll();
  }

  function fmtMonth(m) {
    // accepts "YYYY-MM" or "YYYY-MM-DD"
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mm = String(m).match(/^(\d{4})-(\d{2})/);
    return mm ? MON[+mm[2] - 1] + " '" + mm[1].slice(2) : String(m);
  }

  return { renderEstimate, renderTrack, resizeAll, expand, collapse, fUSD, fK, C, fmtMonth };
})();
window.addEventListener('resize', () => SLCharts.resizeAll());
