/* Sentinel Architect - results dashboard, charts, what-ifs, narrative */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = C.esc, hint = App.hint, money = App.money, moneyK = App.moneyK, gb = App.gb, fmt = App.fmt;
const GC = ['#0078d4', '#6d28d9', '#0f7b45', '#c2410c', '#0891b2', '#b45309', '#be185d'];
const NAVY = '#0b1f33', GREY = '#64748b';
const X = (s) => esc(s);

/* ---------- SVG charts ---------- */
function barsH(items, o) { // items: {label, value, lo, hi, color, text}
  o = o || {}; const W = 640, rowH = 34, left = 170, right = 90, H = items.length * rowH + 14, max = o.max || Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.hi || 0))), sc = (W - left - right) / max;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + X(o.aria || 'bar chart') + '">' + items.map((it, i) => { const y = 7 + i * rowH, w = Math.max(1, it.value * sc);
    return '<text x="' + (left - 10) + '" y="' + (y + 18) + '" text-anchor="end" font-size="13" fill="' + NAVY + '">' + X(it.label) + '</text><rect x="' + left + '" y="' + (y + 4) + '" width="' + w + '" height="20" rx="4" fill="' + it.color + '"/>' +
      (it.hi ? '<line x1="' + (left + it.lo * sc) + '" x2="' + (left + it.hi * sc) + '" y1="' + (y + 14) + '" y2="' + (y + 14) + '" stroke="' + NAVY + '" stroke-width="1.5" opacity=".55"/><line x1="' + (left + it.lo * sc) + '" x2="' + (left + it.lo * sc) + '" y1="' + (y + 9) + '" y2="' + (y + 19) + '" stroke="' + NAVY + '" opacity=".55"/><line x1="' + (left + it.hi * sc) + '" x2="' + (left + it.hi * sc) + '" y1="' + (y + 9) + '" y2="' + (y + 19) + '" stroke="' + NAVY + '" opacity=".55"/>' : '') +
      '<text x="' + (left + Math.max(w, (it.hi || 0) * sc) + 8) + '" y="' + (y + 19) + '" font-size="12.5" font-weight="700" fill="' + NAVY + '">' + X(it.text) + '</text>'; }).join('') + '</svg>';
}
function hist(r) {
  const W = 640, H = 230, L = 20, R = 20, T = 20, B = 52, h = r.mc.hist, n = h.length, mx = Math.max(1, ...h), bw = (W - L - R) / n, lo = r.mc.histLo + r.soar.cost, hi = r.mc.histHi + r.soar.cost, x = (v) => L + ((v - lo) / ((hi - lo) || 1)) * (W - L - R);
  const mk = (v, label, col, dy) => '<line x1="' + x(v) + '" x2="' + x(v) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + col + '" stroke-width="2" stroke-dasharray="4 3"/><text x="' + x(v) + '" y="' + (H - B + 16 + dy) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + col + '">' + label + '</text><text x="' + x(v) + '" y="' + (H - B + 30 + dy) + '" text-anchor="middle" font-size="12" fill="' + col + '">' + moneyK(v) + '</text>';
  const p10 = r.mc.cost.p10 + r.soar.cost, p50 = r.mc.cost.p50 + r.soar.cost, p90 = r.mc.cost.p90 + r.soar.cost;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Range of likely monthly cost">' + h.map((c, i) => '<rect x="' + (L + i * bw + 1) + '" y="' + (H - B - (c / mx) * (H - B - T)) + '" width="' + (bw - 2) + '" height="' + ((c / mx) * (H - B - T)) + '" rx="2" fill="' + ((L + i * bw + bw / 2 >= x(p10) && L + i * bw + bw / 2 <= x(p90)) ? '#0078d4' : '#b8d9f3') + '"/>').join('') +
    '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#cbd5e1"/>' + mk(p10, 'Low (P10)', GREY, 0) + mk(p50, 'Middle (P50)', NAVY, 0) + mk(p90, 'High (P90)', '#b42318', 0) + '</svg>';
}
function tierChart(r) {
  const t = r.tierTable.filter((x) => x.monthly < Math.max(1, r.tierTable[0].monthly) * 3 || x.id === r.rec.id), W = 640, H = 240, L = 10, B = 44, T = 26, mx = Math.max(1, ...t.map((x) => x.monthly)), bw = (W - L * 2) / t.length;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Monthly cost by pricing option">' + t.map((x, i) => { const h = (x.monthly / mx) * (H - B - T), isRec = x.id === r.rec.id, cx = L + i * bw + bw / 2;
    return '<rect x="' + (cx - bw * 0.35) + '" y="' + (H - B - h) + '" width="' + (bw * 0.7) + '" height="' + h + '" rx="4" fill="' + (isRec ? '#0f7b45' : '#9cc7ec') + '"/><text x="' + cx + '" y="' + (H - B - h - 6) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + (isRec ? '#0f7b45' : NAVY) + '">' + moneyK(x.monthly) + '</text><text x="' + cx + '" y="' + (H - B + 16) + '" text-anchor="middle" font-size="11.5" fill="' + NAVY + '">' + (x.id === 'payg' ? 'Pay-as-' : x.tierGb + ' GB') + '</text><text x="' + cx + '" y="' + (H - B + 30) + '" text-anchor="middle" font-size="11.5" fill="' + GREY + '">' + (x.id === 'payg' ? 'you-go' : 'per day') + '</text>'; }).join('') + '</svg>';
}
function coverChart(cv) { return barsH(cv.byTactic.map((t) => ({ label: t.tactic, value: t.covered || 0.0001, color: t.covered === t.total ? '#0f7b45' : t.covered ? '#0078d4' : '#cbd5e1', text: t.covered + ' of ' + t.total })), { aria: 'Detection coverage by ATT&CK tactic', max: Math.max(1, ...cv.byTactic.map((t) => t.total)) }); }
function groupItems(r) {
  const gs = C.GROUPS.map((g, i) => ({ label: g, i, v: 0, lo: 0, hi: 0 })); r.perSource.forEach((x) => { if (x.on) { gs[x.g].v += x.exp; gs[x.g].lo += x.lo; gs[x.g].hi += x.hi; } });
  return gs.filter((g) => g.v > 0).sort((a, b) => b.v - a.v).map((g) => ({ label: g.label, value: g.v, lo: g.lo, hi: g.hi, color: GC[g.i % GC.length], text: gb(g.v) + ' GB' }));
}
App.charts = { barsH, hist, tierChart, coverChart, groupItems };

/* ---------- derived numbers for the chosen view ---------- */
function totals(r) {
  const q = r.quote, k = 1 + q.ms.uplift, ms = q.ms.exp, svc = q.svc.fee;
  return { ms, svc, all: ms + svc, msY: ms * 12, svcY: svc * 12 + q.onb, resell: true, k, y1: q.y1, tcv: q.tcv };
}
App.totals = totals;
function ruleSummary(r) {
  const st = S.st, v = C.VERTICALS[st.vertical], t = totals(r), L = [];
  L.push('**' + (st.company || 'The customer') + '** (' + v.label.toLowerCase() + ', ' + fmt(st.drivers.seats) + ' people) is expected to send about **' + gb(r.sum.total) + ' GB of security logs a day** to Microsoft Sentinel, most likely between ' + gb(r.mc.tot.p10) + ' and ' + gb(r.mc.tot.p90) + ' GB.');
  L.push('After free Microsoft data' + (r.sum.allow.e5 + r.sum.allow.s2 > 0 ? ' and licence allowances' : '') + ', about **' + gb(r.sum.analyticsBillable) + ' GB/day** is billed at the full Analytics rate. ' + (r.quote.tier.id === 'payg' ? 'Pay-as-you-go is priced here.' : 'A **' + r.quote.tier.label + '** commitment is priced here.'));
  L.push('Sentinel is expected to cost about **' + money(r.msMonthly) + ' a month**, most likely between ' + moneyK(r.quote.ms.p10) + ' and ' + moneyK(r.quote.ms.p90) + ', plus a managed service of **' + money(r.quote.svc.fee) + ' a month**.');
  if (r.opt.length) L.push('Quick wins could save about **' + money(r.opt.reduce((a, o) => a + o.saving, 0) * 0.6) + ' a month** (for example ' + r.opt[0].text.charAt(0).toLowerCase() + r.opt[0].text.slice(1) + ').');
  L.push('Detection coverage: **' + r.cov.covered + ' of ' + r.cov.total + '** common attack techniques are covered by the selected sources' + (r.cov.gaps.length ? '; the gaps are listed below.' : '.'));
  return L.join('\n\n');
}
App.ruleSummary = ruleSummary;


function riskText(q) {
  if (q.risk === 'cap') return 'Budget cap: the Microsoft cost is held at a ceiling for up to ' + fmt(q.capGb) + ' GB/day billable data. ' + (q.overMode === 'billed' ? 'Data above the cap is billed at an agreed overage rate.' : 'Data above the cap is absorbed by us.');
  return 'Pay for actual usage, with a true-up review at each anniversary. Based on our simulation the Microsoft cost is likely to vary by about ' + money(Math.abs(q.ms.annualVar.p10)) + ' below to ' + money(q.ms.annualVar.p90) + ' above this estimate over a year.';
}
App.riskText = riskText;
const SIEMN = { splunk: 'Splunk', qradar: 'QRadar', xsiam: 'XSIAM', arcsight: 'ArcSight', logrhythm: 'LogRhythm', elastic: 'Elastic', sumo: 'Sumo Logic', secops: 'Google SecOps', other: 'SIEM' };
App.basisText = function (r) { const q = r.quote, st = S.st; return q.baseline > 0 ? 'Based on the customer\'s current ' + (SIEMN[st.baseline.siem] || 'SIEM') + ' volume (about ' + gb(q.baseline) + ' GB/day), measured data' : 'Based on a typical estate for this industry and size'; };
function quoteCard(r) {
  const q = r.quote, st = S.st, cust = S.mode === 'customer', srcN = r.perSource.filter((x) => x.on).length, basis = App.basisText(r);
  return '<div class="card2 quote" style="margin-bottom:14px"><div class="row between"><h4 style="margin:0">Budgetary quote ' + App.bdg('rl') + '</h4><span class="pill ' + (st.rateSource === 'default' ? 'rl' : 'ok') + '">' + (st.rateSource === 'default' && !cust ? 'placeholder prices' : q.term + '-year term') + '</span></div>' +
    '<div class="tw"><table class="qt"><tbody>' +
    '<tr><td><b>Microsoft Sentinel consumption</b><div class="small muted">' + (q.tier.id === 'payg' ? 'Pay-as-you-go' : q.tier.label + ' commitment') + ' · ' + gb(r.sum.analyticsBillable) + ' GB/day billable · resold by us</div></td><td class="n"><b>' + money(q.ms.exp) + '</b><div class="small muted">likely ' + moneyK(q.ms.p10) + ' to ' + moneyK(q.ms.p90) + '</div></td></tr>' +
    '<tr><td><b>Managed service</b> <span class="small muted">(' + esc(q.svc.label) + ')</span><div class="small muted">' + esc(r.soc.tier.label.split(':')[0]) + ' · ' + esc(r.soc.cov.label) + ' · ' + srcN + ' log sources · ' + q.svc.pbOn + ' playbooks' + (q.tdisc ? ' · ' + Math.round(q.tdisc * 100) + '% term discount' : '') + '</div></td><td class="n"><b>' + money(q.svc.fee) + '</b></td></tr>' +
    '<tr class="tot"><td><b>Total per month</b></td><td class="n"><b>' + money(q.monthly) + '</b></td></tr>' +
    '<tr><td>One-off onboarding<div class="small muted">connect and tune ' + srcN + ' sources, build ' + q.svc.pbOn + ' playbooks</div></td><td class="n">' + money(q.onb) + '</td></tr>' +
    '<tr><td>Year 1 total</td><td class="n">' + money(q.y1) + '</td></tr>' +
    '<tr><td><b>' + q.term + '-year contract value</b><div class="small muted">with ' + st.levers.growth + '% yearly data growth</div></td><td class="n"><b>' + money(q.tcv) + '</b></td></tr></tbody></table></div>' +
    '<p class="small" style="margin:8px 0 2px"><b>If volumes differ:</b> ' + esc(riskText(q)) + '</p><p class="small muted" style="margin:0">' + esc(basis) + '. Budgetary figure, excluding VAT, subject to confirmation of log volumes.</p></div>';
}
/* ---------- render ---------- */
App.renderResults = function () {
  const st = S.st, r = S.res;
  $('p5').innerHTML = '<div class="watermark">INDICATIVE</div><div class="row between" style="margin-bottom:10px"><div><h2>' + esc(st.company ? 'Estimate for ' + st.company : 'Your estimate') + '</h2><p class="lead" style="margin:0">A likely range, not a single number. Move the sliders to see how choices change the bill.</p></div>' +
    '<div class="row noprint"><div class="seg" id="viewSeg">' + [['ms', 'Microsoft Sentinel'], ['svc', 'Managed service'], ['all', 'Combined']].map((o) => '<button type="button" data-view="' + o[0] + '" class="' + (S.view === o[0] ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div></div>' +
    '<div class="row noprint" style="margin:6px 0 14px"><button class="btn blue" type="button" data-exp="deck" id="expDeck">⬇ Customer deck (PPTX)</button><button class="btn dark" type="button" data-exp="quote">⬇ Budgetary quote (PDF)</button><button class="btn" type="button" data-exp="print">🖨 Print this page</button><button class="btn" type="button" data-exp="csv">⬇ Data (CSV)</button><span id="expMsg" class="small muted"></span></div>' +
    '<div id="rflag"></div><div id="rkpis"></div>' +
    '<div class="whatif noprint" id="rwhat"><h4 style="margin-bottom:4px">Try what-ifs with the customer ' + hint('Everything on this page updates instantly. Moving a slider changes the assumptions behind the numbers, so you can show how choices such as filtering noisy logs or keeping data longer change the bill.') + '</h4>' +
    [['levers.filterPct', 'Filter noisy logs at the source', 0, 50, 1, '%'], ['levers.growth', 'Data growth per year', 0, 50, 1, '%'], ['levers.retention', 'Keep logs for', 3, 84, 3, ' months'], ['levers.spike', 'Stress test: volume spike', 1.1, 3, 0.1, '×']].map((s) => '<div class="sl"><label for="sl-' + s[0] + '">' + s[1] + '</label><input id="sl-' + s[0] + '" type="range" min="' + s[2] + '" max="' + s[3] + '" step="' + s[4] + '" data-sl="' + s[0] + '" data-unit="' + s[5] + '" value="' + App.getPath(st, s[0]) + '"><b id="slv-' + s[0].replace('.', '_') + '"></b></div>').join('') + '</div>' +
    '<div id="rbody"></div>';
  bindResults(); App.updateResults();
};
let bound = false;
function bindResults() {
  $('p5').querySelectorAll('[data-sl]').forEach((el) => el.addEventListener('input', () => { App.setPath(S.st, el.dataset.sl, +el.value); App.refresh(); }));
}
App.updateResults = function () {
  const r = S.res, st = S.st, b = $('rbody'); if (!b || S.step !== 5) return; const t = totals(r), cust = S.mode === 'customer';
  document.querySelectorAll('[data-sl]').forEach((el) => { const v = App.getPath(st, el.dataset.sl); const l = $('slv-' + el.dataset.sl.replace('.', '_')); if (l) l.textContent = (el.dataset.unit === '×' ? (+v).toFixed(1) : v) + el.dataset.unit; if (+el.value !== +v) el.value = v; });
  document.querySelectorAll('#viewSeg button').forEach((x) => x.classList.toggle('on', x.dataset.view === S.view));
  $('rflag').innerHTML = '<div class="callout ' + (st.rateSource === 'default' && !cust ? 'warn' : '') + '" style="margin-bottom:14px">' + (st.rateSource === 'default' && !cust ? '<b>Placeholder rates in use.</b> Import your price book in step 4 before sending a quote. ' : '') + '<b>Indicative estimate.</b> Log volumes are industry estimates' + (S.usage ? ' (partly measured from the customer\'s real usage)' : '') + '; Microsoft prices and free-ingestion rules change. Calibrate with real data to firm this up.</div>';
  let k;
  if (S.view === 'ms') k = [['Data per day', gb(r.sum.total) + ' GB', 'likely ' + gb(r.mc.tot.p10) + ' to ' + gb(r.mc.tot.p90)], ['Sentinel per month', money(t.ms), 'likely ' + moneyK(r.quote.ms.p10) + ' to ' + moneyK(r.quote.ms.p90), 1], ['Commitment', r.quote.tier.id === 'payg' ? 'Pay-as-you-go' : r.quote.tier.label, 'billable ' + gb(r.sum.analyticsBillable) + ' GB/day'], ['Per year', money(t.msY), 'before growth']];
  else if (S.view === 'svc') k = [['Managed service per month', money(t.svc), r.soc.cov.label], ['One-off onboarding', money(r.quote.onb), r.quote.svc.pbOn + ' playbooks, ' + r.perSource.filter((x) => x.on).length + ' sources'], ['Incidents per day', r.soar.incPerDay.toFixed(1), 'typical for this size'], ['Automation saves', Math.round(r.soar.deflect * 100) + '%', 'of analyst effort']];
  else k = [['Total per month', money(t.all), 'Sentinel + managed service', 1], ['Year 1 total', money(t.y1), 'includes onboarding'], [r.quote.term + '-year contract value', money(t.tcv), 'with ' + st.levers.growth + '% yearly growth'], ['Service per month', money(t.svc), r.quote.svc.label]];
  const rows = r.perSource.filter((x) => x.on).sort((a, c) => c.month - a.month);
  const yrRows = r.quote.years.map((y) => '<tr><td>Year ' + y.year + '</td><td class="n">' + gb(y.gb) + ' GB</td><td>' + esc(y.tier) + '</td>' + (S.view !== 'svc' ? '<td class="n">' + money(y.ms) + '</td>' : '') + (S.view !== 'ms' ? '<td class="n">' + money(y.svc + y.onb) + '</td>' : '') + (S.view === 'all' ? '<td class="n bold">' + money(y.total) + '</td>' : '') + '</tr>');
  const yTot = r.quote.years.reduce((a, y) => ({ ms: a.ms + y.ms, svc: a.svc + y.svc + y.onb }), { ms: 0, svc: 0 });
  const sp = r.spike, ai = S.ai;
  b.innerHTML = quoteCard(r) + '<div class="kpis">' + k.map((x) => '<div class="kpi' + (x[3] ? ' hi' : '') + '"><span>' + x[0] + '</span><b>' + x[1] + '</b><small>' + x[2] + '</small></div>').join('') + '</div>' +
    '<div class="card2" style="margin-bottom:14px"><h4>Summary ' + (ai ? App.bdg('ai') : App.bdg('rl')) + '</h4><div class="prose" id="sumText">' + App.safeHtml(ai && ai.summary ? ai.summary : ruleSummary(r)) + '</div><div class="row noprint" style="margin-top:6px"><button id="aiSum" class="btn sm" type="button">✨ ' + (ai ? 'Rewrite' : 'Write a customer-friendly summary') + '</button><span id="aiMsg2" class="small muted"></span></div></div>' +
    (S.view !== 'svc' ? '<div class="grid g2" style="margin-bottom:14px"><div class="card2"><h4>Where the data comes from ' + App.bdg('rl') + '</h4><p class="small muted">Expected GB per day by area. The line shows the low-to-high range we simulate.</p>' + barsH(groupItems(r), { aria: 'Data volume by area' }) + '<p class="small muted" style="margin-top:6px">Free from Microsoft: <b>' + gb(r.sum.free) + '</b> GB/day · covered by licence allowances: <b>' + gb(r.sum.allow.e5 + r.sum.allow.s2) + '</b> GB/day' + (r.avoided > 0 ? ' · worth about <b>' + money(r.avoided) + '</b> a month at pay-as-you-go prices' : '') + '</p></div>' +
      '<div class="card2"><h4>What you may actually pay ' + App.bdg('rl') + '</h4><p class="small muted">We ran ' + fmt(r.mc.N) + ' simulations of the customer\'s data volumes. Most outcomes fall in the dark blue range.</p>' + hist(r) + '<p class="small muted" style="margin-top:6px">Monthly Sentinel cost: low <b>' + moneyK(r.quote.ms.p10) + '</b> · expected <b>' + moneyK(r.quote.ms.exp) + '</b> · high <b>' + moneyK(r.quote.ms.p90) + '</b></p></div></div>' +
      '<div class="grid g2" style="margin-bottom:14px"><div class="card2"><h4>Choosing a commitment ' + hint('A commitment tier is a daily amount of data you agree to pay for at a discount. If you send less than the tier you still pay for the tier; if you send more, the extra is billed at that tier\'s per-GB rate. The tool picks the option with the lowest expected cost across all simulations.') + '</h4><p class="small muted">Monthly cost at the expected volume under each option. Recommended is green.</p>' + tierChart(r) + '</div>' +
      '<div class="card2"><h4>What if volume spikes? ' + hint('An incident or a noisy misconfiguration can multiply log volume for a while. This shows the monthly bill under the recommended commitment if volume were higher.') + '</h4><table><tbody><tr><td>Expected</td><td class="n bold">' + money(sp.x1 * t.k) + '</td></tr><tr><td>30% more data</td><td class="n">' + money(sp.x13 * t.k) + '</td></tr><tr><td>' + (+st.levers.spike).toFixed(1) + '× data (your slider)</td><td class="n">' + money(sp.xs * t.k) + '</td></tr><tr><td>2× data</td><td class="n">' + money(sp.x2 * t.k) + '</td></tr><tr><td class="muted">2× data on pay-as-you-go</td><td class="n muted">' + money(sp.payg2 * t.k) + '</td></tr></tbody></table><p class="small muted" style="margin-top:8px">With a commitment, extra data is charged at a lower per-GB rate than pay-as-you-go, so a spike hurts less.</p></div></div>' : '') +
    (S.view !== 'svc' && r.opt.length ? '<div class="card2" style="margin-bottom:14px"><h4>Ways to lower the bill ' + App.bdg('rl') + '</h4>' + r.opt.map((o, i) => '<div class="opt"><div style="flex:1"><b>' + esc(o.text) + '</b><div class="small muted">' + esc(o.why) + '</div></div><div class="sv">≈ ' + money(o.saving * t.k) + '/mo</div><button class="btn sm noprint" type="button" data-apply="' + i + '">Apply</button></div>').join('') + '</div>' : '') +
    '<div class="grid g2" style="margin-bottom:14px"><div class="card2"><h4>Security coverage ' + hint('We map the selected log sources to 28 common detections, grouped by MITRE ATT&CK tactic (the standard way to describe how attackers operate). More green means more attack stages are covered. This is a guide to which logs you need, not a measure of rule quality.') + '</h4>' + coverChart(r.cov) + '<p class="small muted">' + r.cov.covered + ' of ' + r.cov.total + ' detections have the logs they need.</p></div>' +
    '<div class="card2"><h4>Gaps to talk about</h4>' + (r.cov.gaps.length ? '<ul style="margin:0;padding-left:18px">' + r.cov.gaps.slice(0, 8).map((g) => '<li class="small"><b>' + esc(g.name) + '</b> <span class="muted">(' + esc(g.tactic) + ') needs ' + esc(g.need.join(' or ')) + '</span></li>').join('') + '</ul>' : '<p class="ok bold">No gaps in the common detections.</p>') + '</div></div>' +
    (S.view !== 'ms' || true ? '<div class="card2" style="margin-bottom:14px"><h4>Automation and managed service ' + App.bdg('rl') + '</h4><div class="grid g3"><div><b>' + fmt(r.soar.runs) + '</b> playbook runs a month<div class="small muted">' + r.soar.rows.filter((x) => x.on).length + ' playbooks enabled, costing about ' + money(r.soar.cost, 2) + ' a month to run</div></div><div><b>' + r.soar.incPerDay.toFixed(1) + '</b> incidents a day<div class="small muted">Automation removes about ' + Math.round(r.soar.deflect * 100) + '% of analyst effort</div></div><div><b>' + esc(r.soc.cov.label) + '</b><div class="small muted">' + esc(r.soc.tier.desc) + '</div></div></div>' +
      (cust ? '' : '<div class="int small muted" style="margin-top:10px;border-top:1px solid var(--s100);padding-top:8px">Internal: workload ' + r.soc.fteWork.toFixed(2) + ' FTE, charged at ' + r.soc.fte.toFixed(2) + ' FTE (minimum cover for ' + esc(r.soc.cov.label) + '), people ' + money(r.soc.people) + '/mo, engineering ' + money(r.soc.eng) + ', hunting ' + money(r.soc.hunt) + ', service margin on this price ' + Math.round(r.quote.margin * 100) + '%, resale uplift on Microsoft ' + Math.round(r.quote.ms.uplift * 100) + '%' + (r.quote.overMode === 'absorbed' && r.quote.capGb ? ', BT exposure above the cap: average ' + money(r.quote.btExposure.mean) + '/mo, bad month ' + money(r.quote.btExposure.p90) + '/mo' : '') + '.</div>') + '</div>' : '') +
    '<div class="card2" style="margin-bottom:14px"><h4>Contract view (' + r.quote.term + ' years) ' + hint('Volumes grow by the yearly growth rate you set. The commitment is re-chosen each year. Year 1 service includes the one-off onboarding.') + '</h4><div class="tw"><table><thead><tr><th>Year</th><th class="n">Billable data</th><th>Commitment</th>' + (S.view !== 'svc' ? '<th class="n">Sentinel</th>' : '') + (S.view !== 'ms' ? '<th class="n">Managed service</th>' : '') + (S.view === 'all' ? '<th class="n">Total</th>' : '') + '</tr></thead><tbody>' + yrRows.join('') + '<tr><td class="bold">' + r.quote.term + '-year total</td><td></td><td></td>' + (S.view !== 'svc' ? '<td class="n bold">' + money(yTot.ms) + '</td>' : '') + (S.view !== 'ms' ? '<td class="n bold">' + money(yTot.svc) + '</td>' : '') + (S.view === 'all' ? '<td class="n bold">' + money(yTot.ms + yTot.svc) + '</td>' : '') + '</tr></tbody></table></div></div>' +
    (S.view !== 'svc' ? '<details class="card2"><summary style="cursor:pointer;font-weight:700">Detail by log source</summary><div class="tw" style="margin-top:8px"><table><thead><tr><th>Source</th><th>Sent to</th><th class="n">GB/day (low)</th><th class="n">GB/day (expected)</th><th class="n">GB/day (high)</th><th class="n">≈ £/month</th></tr></thead><tbody>' + rows.map((x) => '<tr><td>' + esc(x.name) + (x.measured ? ' <span class="pill free">measured</span>' : '') + '</td><td>' + C.TIER_LABEL[x.tier] + '</td><td class="n">' + gb(x.lo) + '</td><td class="n">' + gb(x.exp) + '</td><td class="n">' + gb(x.hi) + '</td><td class="n">' + (x.free ? 'Free' : money(x.month)) + '</td></tr>').join('') + '</tbody></table></div></details>' : '') +
    '<p class="tiny muted" style="margin-top:12px">' + (S.view === 'svc' ? '' : 'Pricing shown in ' + (st.cur === 'USD' ? 'US dollars (converted at ' + st.fx + ')' : 'pounds sterling') + '. ') + 'Estimates use our industry volume profiles, Microsoft\'s published allowances and the rate card loaded in the tool. They are not a quote.</p>';
  const ap = $('aiSum'); if (ap) ap.onclick = aiSummary;
};
async function aiSummary() {
  const r = S.res, st = S.st, t = totals(r), b = $('aiSum'), m = $('aiMsg2'); b.disabled = true; m.textContent = 'Writing…';
  try {
    const facts = { company: st.company || 'the customer', industry: C.VERTICALS[st.vertical].label, seats: st.drivers.seats, gbPerDay: +r.sum.total.toFixed(1), gbRange: [+r.mc.tot.p10.toFixed(1), +r.mc.tot.p90.toFixed(1)], billableGb: +r.sum.analyticsBillable.toFixed(1), freeGb: +(r.sum.free + r.sum.allow.e5 + r.sum.allow.s2).toFixed(1), recommended: r.quote.tier.label, sentinelPerMonth: Math.round(r.msMonthly), range: [Math.round(r.quote.ms.p10), Math.round(r.quote.ms.p90)], servicePerMonth: Math.round(t.svc), coverage: r.cov.covered + '/' + r.cov.total, topSavings: r.opt.slice(0, 3).map((o) => o.text), currency: st.cur };
    const prompt = 'You are a security solutions architect writing for a customer meeting. Write a short, plain-English summary of this Microsoft Sentinel estimate. Use ONLY the facts below; do not invent figures, prices, regulations or product claims. Mention that the figures are indicative and depend on real log volumes. No jargon without explaining it. Max 170 words, use short paragraphs and at most 4 bullets.\nFACTS: ' + JSON.stringify(facts) + '\nReturn ONLY JSON: {"summary": string in markdown}';
    const j = App.extractJSON(await App.generate(prompt, { max: 1200, temp: 0.3 })); if (!j.summary) throw new Error('No text returned'); S.ai = { summary: String(j.summary).slice(0, 2500) }; App.updateResults();
  } catch (e) { m.textContent = 'Could not write it: ' + e.message; b.disabled = false; }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t || S.step !== 5) return;
  if (t.dataset.view) { S.view = t.dataset.view; App.updateResults(); }
  else if (t.dataset.apply != null) { const o = S.res.opt[+t.dataset.apply]; if (!o) return; if (o.action === 'tier') S.st.sources[o.id].tier = o.to; else S.st.levers.filterPct = Math.max(S.st.levers.filterPct, 30); App.recompute(); }
  else if (t.dataset.exp === 'quote') App.printQuote();
  else if (t.dataset.exp === 'print') window.print();
  else if (t.dataset.exp === 'csv') { const r = S.res, tt = totals(r); const csv = C.sourcesCsv(S.st, r) + '\nSummary\nMetric,Value\nCustomer,"' + (S.st.company || '').replace(/"/g, '""') + '"\nIndustry,' + C.VERTICALS[S.st.vertical].label + '\nExpected GB/day,' + r.sum.total.toFixed(1) + '\nBillable analytics GB/day,' + r.sum.analyticsBillable.toFixed(1) + '\nCommitment,' + r.quote.tier.label + '\nSentinel per month (expected),' + Math.round(tt.ms) + '\nSentinel per month P10,' + Math.round(r.quote.ms.p10) + '\nSentinel per month P90,' + Math.round(r.quote.ms.p90) + '\nManaged service per month,' + Math.round(tt.svc) + '\nOne-off onboarding,' + Math.round(r.quote.onb) + '\nContract term (years),' + r.quote.term + '\nContract value,' + Math.round(tt.tcv) + '\nCurrency,' + S.st.cur + '\nRates,' + (S.st.rateSource === 'default' ? 'placeholder' : 'customer rate card') + '\n'; App.dl(new Blob([csv], { type: 'text/csv' }), 'sentinel_estimate.csv'); }
  else if (t.dataset.exp === 'deck') App.exportDeck();
});
})();
