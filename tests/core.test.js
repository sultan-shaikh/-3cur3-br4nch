const C = require('../public/assets/js/core.js'); let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
const st = C.defaultState('financial', 1000); const r = C.compute(st);
console.log('drivers', JSON.stringify(st.drivers));
console.log('GB/day exp', r.sum.total.toFixed(1), 'billable', r.sum.analyticsBillable.toFixed(1), 'free', r.sum.free.toFixed(2), 'e5', r.sum.allow.e5.toFixed(2), 's2', r.sum.allow.s2.toFixed(2));
console.log('rec', r.rec.label, 'ms/month', r.msMonthly.toFixed(0), 'P10-P90', r.mc.cost.p10.toFixed(0), r.mc.cost.p50.toFixed(0), r.mc.cost.p90.toFixed(0));
console.log('tiers', r.tierTable.map((t) => t.label + ':' + t.monthly.toFixed(0)).join(' | '));
console.log('soar', r.soar.incPerDay.toFixed(1), 'inc/day', r.soar.runs.toFixed(0), 'runs/mo £', r.soar.cost.toFixed(2), 'deflect', r.soar.deflect);
console.log('soc fte', r.soc.fte.toFixed(2), 'work', r.soc.fteWork.toFixed(2), 'fee', r.soc.fee.toFixed(0), 'onb', r.soc.onb.toFixed(0));
console.log('coverage', r.cov.covered + '/' + r.cov.total, 'opt', r.opt.map((o) => o.text.slice(0, 40) + ' £' + o.saving.toFixed(0)).join(' | '));
console.log('years', r.years.map((y) => y.tier + ' £' + y.ms.toFixed(0)).join(' | '));
ok(r.sum.total > 10 && r.sum.total < 400, 'plausible total GB/day for 1000 seats');
ok(r.mc.cost.p10 <= r.mc.cost.p50 && r.mc.cost.p50 <= r.mc.cost.p90, 'percentiles ordered');
ok(r.sum.analyticsBillable <= r.sum.analyticsGross, 'billable <= gross');
ok(r.sum.free > 0 && r.sum.allow.e5 > 0 && r.sum.allow.s2 > 0, 'free sources and allowances applied');
const noE5 = JSON.parse(JSON.stringify(st)); noE5.m365 = 'E3'; ok(C.compute(noE5).sum.analyticsBillable > r.sum.analyticsBillable, 'E5 benefit reduces billable volume');
const r2 = C.compute(JSON.parse(JSON.stringify(st))); ok(r2.mc.cost.p50 === r.mc.cost.p50, 'simulation is deterministic');
const big = C.defaultState('financial', 10000), rb = C.compute(big); ok(rb.sum.total > r.sum.total * 5, 'scales with seats'); console.log('10k seats', rb.sum.total.toFixed(0), 'GB/day', rb.rec.label, rb.msMonthly.toFixed(0));
const tiny = C.defaultState('retail', 50), rt = C.compute(tiny); ok(rt.msMonthly >= 0 && isFinite(rt.msMonthly), 'small estate computes'); console.log('50 seats', rt.sum.total.toFixed(1), rt.rec.label, rt.msMonthly.toFixed(0));
const f = JSON.parse(JSON.stringify(st)); f.levers.filterPct = 30; ok(C.compute(f).sum.analyticsBillable < r.sum.analyticsBillable, 'filter lever reduces volume');
const z = JSON.parse(JSON.stringify(st)); Object.keys(z.sources).forEach((k) => { z.sources[k].on = false; }); const rz = C.compute(z); ok(rz.msMonthly === 0 || isFinite(rz.msMonthly), 'all sources off is safe'); ok(rz.cov.covered === 0, 'coverage 0 when nothing on');
const csv = C.ratesToCsv(st.rates), back = C.ratesFromCsv(csv); ok(back.updated === st.rates.length, 'rate card CSV round-trips');
try { C.ratesFromCsv('a,b\n1,2'); ok(false, 'bad csv rejected'); } catch (e) { ok(true, 'bad rate card rejected'); }
const m = C.defaultState('manufacturing', 2000); ok(m.sources.ot_ids.on, 'OT source on for manufacturing'); ok(!C.defaultState('retail', 500).sources.ot_ids.on, 'OT off for retail');
for (const k of Object.keys(C.VERTICALS)) { const x = C.compute(C.defaultState(k, 2500)); ok(isFinite(x.msMonthly) && x.msMonthly > 0, 'vertical ' + k + ': ' + x.sum.total.toFixed(0) + ' GB/day, ' + x.rec.label + ', £' + x.msMonthly.toFixed(0)); }
process.exit(bad ? 1 : 0);
