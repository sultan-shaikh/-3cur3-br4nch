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
assert.strictEqual(C.mxModelFor(150), 'MX67'); assert.strictEqual(C.mxModelFor(800), 'MX95'); assert.strictEqual(C.mxModelFor(1500, true), 'MX250');
const sites = [
 { name: 'Leeds', type: 'Branch', users: 61, bw: '300Mbps', wiredPorts: 30, cameras: 4, sensors: 2, ha: false },
 { name: 'DC1', type: 'Data Centre', users: 0, bw: '1Gbps', ha: true },
 { name: 'Remote', type: 'Branch', users: 5, bw: '100Mbps', mxModel: 'MX999' },
];
const lines = C.buildInfraLines(pb, sites);
const { lines: agg, gaps } = C.aggregateLines(lines);
console.log(agg.map(l => `${l.group} ${l.kind} ${l.sku} x${l.qty}`).join('\n'));
console.log('GAPS', gaps.map(g => g.requirement + ' x' + g.qty));
const ap = agg.find(l => l.group === 'WiFi' && l.kind === 'capex'); assert.strictEqual(ap.qty, 3);
const sw = agg.find(l => l.group === 'LAN' && l.kind === 'capex'); assert.strictEqual(sw.qty, 2);
assert(gaps.some(g => /MX999/.test(g.requirement)), 'gap flagged');
const mx1 = agg.find(l=>l.key==='LIC-MX250-SEC'); assert.strictEqual(mx1.qty, 2, 'HA licence doubled');
const t = C.computeTotals(agg, { serviceTier: 'foundation', wanAnnual: 1000, derive: true });
console.log(t);
assert(t.capex > 0 && t.opex[3] > 0);
assert.strictEqual(C.termPrice(pb.byKey.get('LIC-MX250-SEC').terms && { terms: pb.byKey.get('LIC-MX250-SEC').terms }, 3, false).price, null, 'no derive w/o toggle');
const cands = C.serviceCandidates(pb); assert(cands.some(c => /SA-ESS/.test(c.sku)));
console.log(C.bomToCsv(agg, false).split('\n').slice(0,3).join('\n'));
console.log('ALL PASS');
