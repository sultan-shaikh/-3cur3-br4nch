const C = require('/home/claude/sentinel-architect/public/assets/js/core.js'); let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
const chk = (o, path) => { if (typeof o === 'number' && !isFinite(o)) fail('non-finite ' + path); else if (o && typeof o === 'object' && !Array.isArray(o)) { if (path.split('.').length < 7) for (const k in o) if (k !== 'samples') chk(o[k], path + '.' + k); } else if (Array.isArray(o) && o.length < 60) o.forEach((x, i) => chk(x, path + '[' + i + ']')); };
let n = 0;
for (const v of Object.keys(C.VERTICALS)) for (const seats of [50, 1000, 20000]) for (const risk of ['trueup', 'cap']) for (const om of ['billed', 'absorbed']) for (const pr of ['package', 'pergb', 'persource', 'mixed']) for (const term of [1, 3, 5]) for (const tier of ['auto', 'payg', 't100', 't5000']) {
  const st = C.defaultState(v, seats); st.deal = { term, tier, risk, capGb: risk === 'cap' && n % 2 ? 40 : null, overMode: om, pricing: pr }; st.soc.tier = ['foundation', 'advanced', 'premium'][n % 3]; st.soc.coverage = ['8x5', '12x5', '24x7'][n % 3];
  if (n % 4 === 0) st.baseline = { mode: 'migration', siem: 'qradar', unit: n % 8 ? 'eps' : 'gbday', value: [0, 500, 8000][n % 3], evBytes: 500, factor: 1 };
  if (n % 5 === 0) { st.sources.firewall = st.sources.firewall || {}; const k = Object.keys(st.sources)[3]; st.sources[k].override = 12; }
  let r; try { r = C.compute(st); } catch (e) { fail(v + ' ' + e.message); n++; continue; } chk(r.quote, 'quote'); chk(r.sum, 'sum');
  const q = r.quote; if (q.monthly < 0 || q.tcv <= 0 && seats >= 1000) fail('values ' + v + seats); if (q.ms.p10 > q.ms.p90 + 1e-6) fail('range ' + v); if (q.years.length !== term) fail('years');
  if (risk === 'trueup' && om === 'absorbed' && q.btExposure.mean !== 0) fail('exposure w/o cap'); n++; }
console.log('combos run:', n);
// migration invariants
const st = C.defaultState('retail', 2000); st.baseline = { mode: 'migration', siem: 'splunk', unit: 'gbday', value: 100, evBytes: 500, factor: 1 }; const r = C.compute(st); console.log('baseline total', r.sum.total.toFixed(2), '(expect 100)'); if (Math.abs(r.sum.total - 100) > 0.5) fail('baseline total');
// override with baseline: overridden fixed, rest rebalance
const k = Object.keys(st.sources).find((x) => st.sources[x].on); st.sources[k].override = 30; const r2 = C.compute(st); console.log('with override total', r2.sum.total.toFixed(2)); if (Math.abs(r2.sum.total - 100) > 0.5) fail('override rebalance');
// price book roundtrip: full template + public csv
const fs = require('fs'); for (const f of ['sentinel-price-book-template.csv', 'sentinel-rate-card-gbp.csv']) { const x = C.ratesFromCsv(fs.readFileSync('/mnt/user-data/outputs/' + f, 'utf8')); console.log(f, 'updated', x.updated, 'unknown', x.unknown.length); }
const full = C.ratesToCsv(C.defaultRates()); const rt = C.ratesFromCsv(full); if (rt.rates.length !== C.defaultRates().length) fail('rt'); 
// tier ids in price book missing -> NaN guard
const s3 = C.defaultState('retail', 500); s3.rates = s3.rates.filter((x) => !/^PKG_|TERM_|ONB_/.test(x.id)); try { const q3 = C.compute(s3).quote; console.log('missing price rows ->', isFinite(q3.monthly) ? 'finite' : 'NaN (!)'); if (!isFinite(q3.monthly)) fail('missing rows NaN'); } catch (e) { fail('missing rows throws ' + e.message); }
console.log(bad ? 'FAILURES ' + bad : 'AUDIT CLEAN');
