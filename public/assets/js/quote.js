/* Sentinel Architect - branded budgetary quote (print to PDF) and branding settings */
(function () {
'use strict';
const App = window.App, C = App.C, S = App.S, esc = C.esc, money = App.money, gb = App.gb, fmt = App.fmt;
const KEY = 'sa_brand', DEF = { name: '', accent: '#0b5cad', logo: '', preparedBy: '', contact: '', validDays: 30, extra: '' };
function load() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S.brand)); } catch (e) { /* ignore */ } }
S.brand = load();
App.brandHtml = function () {
  const b = S.brand;
  return '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;margin-bottom:8px">Quote branding (saved in this browser)</summary><div class="envg">' +
    '<label class="f">Your company name<input type="text" data-brand="name" value="' + esc(b.name) + '" placeholder="Shown on the quote"></label>' +
    '<label class="f">Prepared by<input type="text" data-brand="preparedBy" value="' + esc(b.preparedBy) + '" placeholder="Name and role"></label>' +
    '<label class="f">Contact (email / phone)<input type="text" data-brand="contact" value="' + esc(b.contact) + '"></label>' +
    '<label class="f">Brand colour<input type="color" data-brand="accent" value="' + esc(b.accent) + '"></label>' +
    '<label class="f">Quote valid for (days)<input type="number" min="1" data-brand="validDays" value="' + esc(b.validDays) + '"></label>' +
    '<label class="f">Logo (PNG or JPG, under 300 KB)<input type="file" id="brandLogo" accept="image/png,image/jpeg"><small>' + (b.logo ? 'Logo loaded' : 'No logo') + '</small></label>' +
    '<label class="f" style="grid-column:1/-1">Extra terms to append (optional)<textarea data-brand="extra" placeholder="e.g. standard terms reference, payment terms">' + esc(b.extra) + '</textarea></label></div></details>';
};
document.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.brand; if (!k) return; S.brand[k] = k === 'validDays' ? Math.max(1, C.num(e.target.value) || 30) : e.target.value; save(); });
document.addEventListener('change', (e) => { if (e.target.id !== 'brandLogo') return; const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 300 * 1024) { App.setErr('Logo must be under 300 KB.'); return; } const rd = new FileReader(); rd.onload = () => { S.brand.logo = String(rd.result); save(); App.setErr(''); if (S.step === 4) App.renderStep(4); }; rd.readAsDataURL(f); });

const NOTE = 'This is a budgetary estimate for planning purposes only and is not an offer capable of acceptance.';
App.buildQuoteHtml = function () {
  const r = S.res || (App.recompute(), S.res), q = r.quote, st = S.st, b = S.brand, v = C.VERTICALS[st.vertical], today = new Date(), fmtD = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const valid = new Date(today.getTime() + (b.validDays || 30) * 864e5), srcN = r.perSource.filter((x) => x.on).length;
  if (!st.quoteRef) st.quoteRef = 'SQ-' + today.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const draft = st.rateSource === 'default', cur = st.cur === 'USD' ? 'US dollars' : 'pounds sterling', accent = /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : DEF.accent;
  const pbs = r.soar.rows.filter((x) => x.on).map((x) => '<li>' + esc(x.name) + '</li>').join('');
  const yrs = q.years.map((y) => '<tr><td>Year ' + y.year + '</td><td class="n">' + gb(y.gb) + ' GB/day</td><td>' + esc(y.tier) + '</td><td class="n">' + money(y.ms) + '</td><td class="n">' + money(y.svc + y.onb) + '</td><td class="n"><b>' + money(y.total) + '</b></td></tr>').join('');
  const css = '#quoteDoc{--a:' + accent + ';font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:11px;line-height:1.45}#quoteDoc h1{font-size:22px;margin:0}#quoteDoc h2{font-size:13px;margin:16px 0 6px;color:var(--a);border-bottom:2px solid var(--a);padding-bottom:3px}#quoteDoc table{width:100%;border-collapse:collapse}#quoteDoc td,#quoteDoc th{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}#quoteDoc th{background:#f3f4f6;font-size:10px;text-transform:uppercase;letter-spacing:.04em}#quoteDoc .n{text-align:right;white-space:nowrap}#quoteDoc .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid var(--a);padding-bottom:10px}#quoteDoc .hd img{max-height:46px;max-width:180px}#quoteDoc .m{color:#6b7280;font-size:10px}#quoteDoc .tot td{background:#eef4fb;font-size:13px;font-weight:700}#quoteDoc .draft{border:2px solid #b91c1c;color:#b91c1c;font-weight:700;padding:6px 10px;margin:10px 0;text-align:center}#quoteDoc .pb{page-break-before:always}#quoteDoc ul{margin:4px 0 4px 18px;padding:0}#quoteDoc .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}#quoteDoc .box{border:1px solid #d1d5db;padding:8px 10px;border-radius:4px}';
  return '<style>' + css + '</style>' +
    '<div class="hd"><div>' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '<b style="font-size:18px;color:var(--a)">' + esc(b.name || 'Your company') + '</b>') + '</div><div style="text-align:right"><h1>Budgetary Quote</h1><div class="m">Microsoft Sentinel managed service<br>Ref ' + esc(st.quoteRef) + ' · ' + fmtD(today) + ' · valid until ' + fmtD(valid) + '</div></div></div>' +
    (draft ? '<div class="draft">DRAFT: prices are placeholders. Import the price book before issuing this quote.</div>' : '') +
    '<div class="g2" style="margin-top:12px"><div class="box"><div class="m">Prepared for</div><b style="font-size:14px">' + esc(st.company || 'Customer') + '</b><div>' + esc(v.label) + ' · ' + fmt(st.drivers.seats) + ' people</div></div><div class="box"><div class="m">Prepared by</div><b>' + esc(b.preparedBy || b.name || '') + '</b><div>' + esc(b.contact || '') + '</div></div></div>' +
    '<h2>Summary</h2><table><tbody><tr><td><b>Microsoft Sentinel consumption</b><div class="m">' + (q.tier.id === 'payg' ? 'Pay-as-you-go' : esc(q.tier.label) + ' commitment') + ' · about ' + gb(r.sum.analyticsBillable) + ' GB/day billable · supplied by us</div></td><td class="n"><b>' + money(q.ms.exp) + '</b> / month<div class="m">likely ' + money(q.ms.p10) + ' to ' + money(q.ms.p90) + '</div></td></tr>' +
    '<tr><td><b>Managed service</b> (' + esc(q.svc.label) + ')<div class="m">' + esc(r.soc.tier.label.split(':')[0]) + ' · ' + esc(r.soc.cov.label) + ' · ' + srcN + ' log sources · ' + q.svc.pbOn + ' automation playbooks' + (q.tdisc ? ' · ' + Math.round(q.tdisc * 100) + '% ' + q.term + '-year term discount' : '') + '</div></td><td class="n"><b>' + money(q.svc.fee) + '</b> / month</td></tr>' +
    '<tr class="tot"><td>Total per month</td><td class="n">' + money(q.monthly) + '</td></tr>' +
    '<tr><td>One-off onboarding<div class="m">Connect and tune ' + srcN + ' log sources and build ' + q.svc.pbOn + ' playbooks</div></td><td class="n">' + money(q.onb) + '</td></tr>' +
    '<tr><td>Year 1 total (including onboarding)</td><td class="n">' + money(q.y1) + '</td></tr><tr><td><b>' + q.term + '-year contract value</b><div class="m">Assumes ' + st.levers.growth + '% data growth per year</div></td><td class="n"><b>' + money(q.tcv) + '</b></td></tr></tbody></table>' +
    '<h2>How volume changes are handled</h2><p style="margin:0">' + esc(App.riskText(q)) + '</p>' +
    '<h2>What is included</h2><div class="g2"><div><b>Managed service</b><div class="m" style="margin-bottom:4px">' + esc(r.soc.tier.desc) + '</div><ul><li>Hours of cover: ' + esc(r.soc.cov.label) + '</li><li>Up to ' + q.svc.models.inc.src + ' log sources and ' + q.svc.models.inc.gb + ' GB/day in the base package</li></ul></div><div><b>Automation playbooks (' + q.svc.pbOn + ')</b><ul>' + (pbs || '<li>None selected</li>') + '</ul></div></div>' +
    '<div class="pb"></div><h2>Contract view</h2><table><thead><tr><th>Year</th><th class="n">Billable data</th><th>Commitment</th><th class="n">Sentinel</th><th class="n">Managed service</th><th class="n">Total</th></tr></thead><tbody>' + yrs + '<tr class="tot"><td colspan="5">' + q.term + '-year total</td><td class="n">' + money(q.tcv) + '</td></tr></tbody></table>' +
    '<h2>Basis of this estimate</h2><ul><li>' + esc(App.basisText(r)) + ': about ' + gb(r.sum.total) + ' GB of logs a day, most likely between ' + gb(r.mc.tot.p10) + ' and ' + gb(r.mc.tot.p90) + '.</li><li>Free Microsoft data and licence allowances of about ' + gb(r.sum.free + r.sum.allow.e5 + r.sum.allow.s2) + ' GB/day are deducted from billable volume.</li><li>Log retention of ' + st.levers.retention + ' months.</li></ul>' +
    '<h2>Important information</h2><ul><li><b>' + NOTE + '</b></li><li>All prices are in ' + cur + ' and exclude VAT.</li><li>Figures depend on actual log volumes, which are estimated and will be confirmed during onboarding. Microsoft Sentinel prices, allowances and free-ingestion rules are set by Microsoft and may change; the price at the time of purchase applies.</li><li>Included: Microsoft Sentinel and Log Analytics ingestion and retention, and Azure Logic Apps playbook execution as shown. Not included: Microsoft 365, Defender or other licences, third-party tooling, and Azure charges outside Sentinel.</li><li>Onboarding assumes ' + srcN + ' log sources with standard connectors; custom or unsupported sources are quoted separately.</li><li>This quote is valid until ' + fmtD(valid) + ' and is subject to technical validation, credit approval and agreement of contract terms.</li>' + (b.extra ? '<li>' + esc(b.extra) + '</li>' : '') + '</ul>' +
    '<div class="m" style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:6px">' + esc(b.name || '') + ' · ' + esc(st.quoteRef) + ' · Budgetary quote</div>';
};
App.printQuote = function () {
  let d = document.getElementById('quoteDoc'); if (!d) { d = document.createElement('div'); d.id = 'quoteDoc'; document.body.appendChild(d); }
  d.innerHTML = App.buildQuoteHtml(); document.body.classList.add('pq');
  const done = () => { document.body.classList.remove('pq'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print();
};
})();
