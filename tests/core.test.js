const C = require('../public/assets/js/core.js'); const fs = require('fs'); const assert = require('assert');
const pb = C.parsePriceBook(fs.readFileSync(__dirname + '/sample_price_book.csv', 'utf8'));
console.log(pb.summary);
assert(pb.byKey.get('LIC-MX67-SEC').terms[1] === 300 && pb.byKey.get('LIC-MX67-SEC').terms[5] === 1100, 'term merge');
assert.strictEqual(C.findHardware(pb, 'MX67').key, 'MX67-HW');
assert.strictEqual(C.findHardware(pb, 'MX6'), null, 'no fuzzy');
assert.strictEqual(C.findHardware(pb, 'MX999'), null);
assert.strictEqual(C.findHardware(pb, 'MR36').key, 'MR36-HW', 'not bracket');
assert.strictEqual(C.findLicence(pb, 'mx', 'MX85', 'adv').key, 'LIC-MX85-SEC');
assert.strictEqual(C.findLicence(pb, 'mr', '', 'ent').key, 'LIC-ENT');
assert.strictEqual(C.mxModelFor(150, 'Branch'), 'MX67'); assert.strictEqual(C.mxModelFor(800, 'Branch'), 'MX95'); assert.strictEqual(C.mxModelFor(1500, 'DC'), 'MX250'); assert.strictEqual(C.mxModelFor(9000, 'HQ'), 'MX450');
const sites = [
 { type: 'Branch', city: 'Leeds', country: 'UK', users: 61, wan: [{ type: 'DIA', mbps: 200 }, { type: 'Broadband', mbps: 100 }], wifi: true, switching: true, camera: true, cameras: 4, iot: true, sensors: 2 },
 { type: 'DC', city: 'London', country: 'UK', users: 0, wan: [{ type: 'MPLS', mbps: 1000 }], ha: true },
 { type: 'Branch', city: 'Remote', country: 'UK', users: 5, wan: [{ type: 'DIA', mbps: 100 }], mxOverride: 'MX999' },
];
const z = C.sizeSite(sites[0]); assert.strictEqual(z.mx, 'MX85'); assert.strictEqual(z.aps, 3); assert.strictEqual(z.switches, 2); // 31+3+4=38 ports
const lines = C.buildInfraLines(pb, sites);
const { lines: agg, gaps } = C.aggregateLines(lines);
console.log(agg.map(l => `${l.group} ${l.kind} ${l.sku} x${l.qty}`).join('\n'));
console.log('GAPS', gaps.map(g => g.requirement + ' x' + g.qty));
assert(gaps.some(g => /MX999/.test(g.requirement)), 'gap flagged');
assert.strictEqual(agg.find(l => l.key === 'LIC-MX250-SEC').qty, 2, 'HA licence doubled');
assert.strictEqual(agg.find(l => l.group === 'Camera' && l.kind === 'capex').qty, 4);
const t = C.computeTotals(agg, { servicePct: 0.04, wanAnnual: 1000, derive: true, discCapex: 10, discOpex: 5 });
console.log(t);
assert(t.capex > 0 && t.opex[3] > 0 && t.saving[1] > 0 && Math.abs(t.serviceAnnual - t.opex[1] * 0.04) < 1e-6);
const t0 = C.computeTotals(agg, { derive: false });
assert(t0.missing[5] > 0, 'underived missing flagged');
const cands = C.serviceCandidates(pb); assert(cands.some(c => /SA-ESS/.test(c.sku)));
console.log(C.bomToCsv(agg, false).split('\n').slice(0,3).join('\n'));
console.log('ALL PASS');
