/* Cisco Secure Branch Architect - pure logic (no DOM). Price book is the only source of prices. */
(function (root) {
'use strict';

/* ---------- Editable configuration ---------- */
const CONFIG = {
  usersPerAp: 30,
  portsPerSwitch: 24,
  serviceTiers: { none: 0, foundation: 0.02, enhanced: 0.05, premium: 0.08 },
  mxRules: [ // max WAN Mbps (aggregate of site bandwidth) -> MX model; first match wins
    { upTo: 200, model: 'MX67' }, { upTo: 500, model: 'MX85' }, { upTo: 1000, model: 'MX95' },
    { upTo: 2000, model: 'MX105' }, { upTo: 5000, model: 'MX250' }, { upTo: 1e9, model: 'MX450' },
  ],
  mxDcModels: ['MX250', 'MX450'],
  haLicDouble: true,
  derive: { y3: 0.30, y5: 0.50 }, // discounts vs N x 1Y, only when derive toggle is on
};

/* Licence families: how to recognise a licence SKU for a given device family. */
const CATALOGUE = {
  mx:  { hw: /^MX\d/i,  lic: /^LIC-MX/i,  editions: { ent: /(^|-)ENT(-|$)/i, adv: /(^|-)(ADV|SEC)(-|$)/i, sdw: /SDW|SDWAN/i } },
  ms:  { hw: /^MS\d/i,  lic: /^LIC-MS/i,  editions: { ent: /(^|-)(ENT|LAN)(-|$)/i, adv: /(^|-)ADV(-|$)/i } },
  cat: { hw: /^C9\d|^CW9\d/i, lic: /^LIC-C9|^LIC-MR-CW|^LIC-CW/i, editions: { ent: /(^|-)(ENT|E)(-|$)/i, adv: /(^|-)(ADV|A)(-|$)/i } },
  mr:  { hw: /^MR\d|^CW9\d/i, lic: /^LIC-MR|^LIC-ENT|^LIC-CW/i, editions: { ent: /ENT/i, adv: /ADV/i } },
  mv:  { hw: /^MV\d/i,  lic: /^LIC-MV/i,  editions: {} },
  mt:  { hw: /^MT\d/i,  lic: /^LIC-MT/i,  editions: {} },
};

/* ---------- Utilities ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = Number(v); return isFinite(n) ? n : d; };

function parseBwMbps(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const m = String(v).replace(/,/g, '').match(/([\d.]+)\s*(g|gb|gbps|m|mb|mbps|k|kbps)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]); const u = (m[2] || 'm').toLowerCase();
  return u.startsWith('g') ? n * 1000 : u.startsWith('k') ? n / 1000 : n;
}

/* ---------- CSV ---------- */
function decodeBuffer(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch { return new TextDecoder('windows-1252').decode(u8); }
}

function parseCsvRows(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

function parsePrice(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s || /^(n\/?a|-|tbc|poa)$/i.test(s)) return null;
  s = s.replace(/[^\d.,\-]/g, '');
  if (/,\d{2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : null;
}

function mapHeader(h) {
  const k = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^(sku|partnumber|partno|part|productcode|item)$/.test(k)) return 'sku';
  if (/^(description|desc|name|productdescription)$/.test(k)) return 'desc';
  if (/^(hardwareprice|hwprice|capex|listprice|price)$/.test(k)) return 'hw';
  if (/^(price1y|1y|1yr|price1yr|oneyear|term1y|y1)$/.test(k)) return 'y1';
  if (/^(price3y|3y|3yr|price3yr|threeyear|term3y|y3)$/.test(k)) return 'y3';
  if (/^(price5y|5y|5yr|price5yr|fiveyear|term5y|y5)$/.test(k)) return 'y5';
  return null;
}

const TERM_RE = /[-_ ]?\(?(1|2|3|4|5|7|10)[-_ ]?(Y|YR|YRS|YEAR|YEARS)\)?$/i;
function splitTerm(sku) {
  const m = String(sku).match(TERM_RE);
  if (!m) return { key: String(sku).trim(), term: null };
  return { key: String(sku).slice(0, m.index).trim(), term: Number(m[1]) };
}

function classifySingle(sku, desc) {
  const d = `${sku} ${desc}`;
  if (/^LIC-|^CON-|licen[cs]e|subscription|support|enterprise agreement|\bterm\b/i.test(d)) return 'sub';
  return 'hw';
}

function parsePriceBook(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('Price book is empty');
  const map = rows[0].map(mapHeader);
  if (!map.includes('sku')) throw new Error('Price book needs a SKU column');
  const byKey = new Map(), bySku = new Map(); const warnings = [];
  for (let r = 1; r < rows.length; r++) {
    const rec = {}; rows[r].forEach((v, i) => { if (map[i]) rec[map[i]] = v; });
    const sku = (rec.sku || '').trim(); if (!sku) continue;
    const desc = (rec.desc || '').trim();
    const hw = parsePrice(rec.hw), y1 = parsePrice(rec.y1), y3 = parsePrice(rec.y3), y5 = parsePrice(rec.y5);
    const { key, term } = splitTerm(sku);
    let e = byKey.get(key);
    if (!e) { e = { key, skus: {}, desc, hw: null, terms: {}, kind: 'hw' }; byKey.set(key, e); }
    if (!e.desc && desc) e.desc = desc;
    bySku.set(sku.toUpperCase(), e);
    const termPrices = { 1: y1, 3: y3, 5: y5 };
    if (term && [1, 3, 5].includes(term)) {
      // term-coded row: price in the matching term column, else the first populated term price
      const p = termPrices[term] != null ? termPrices[term] : (y1 ?? y3 ?? y5 ?? hw);
      if (p != null) { e.terms[term] = p; e.skus[term] = sku; }
      e.kind = 'sub';
    } else {
      if (hw != null && e.hw == null) e.hw = hw;
      [1, 3, 5].forEach((t) => { if (termPrices[t] != null) { e.terms[t] = termPrices[t]; e.skus[t] = sku; } });
      if (Object.keys(termPrices).some((t) => termPrices[t] != null) && hw == null) e.kind = 'sub';
      else if (classifySingle(sku, desc) === 'sub') e.kind = 'sub';
      else e.kind = 'hw';
      if (!e.skus[1] && !e.skus[3] && !e.skus[5]) e.skus.base = sku;
    }
  }
  const list = [...byKey.values()];
  const summary = { total: list.length, hardware: list.filter((x) => x.kind === 'hw' && x.hw != null).length, licences: list.filter((x) => x.kind === 'sub').length };
  return { list, byKey, bySku, summary, warnings };
}

/* ---------- Lookup (exact / token-boundary only, no fuzzy) ---------- */
function lookupExact(pb, sku) {
  if (!sku) return null;
  const s = String(sku).trim().toUpperCase();
  return pb.bySku.get(s) || pb.byKey.get(splitTerm(s).key) || [...pb.byKey.values()].find((e) => e.key.toUpperCase() === splitTerm(s).key.toUpperCase()) || null;
}

const tok = (s) => String(s).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const ACCESSORY = /\b(LIC|CON|SUPPORT|BRACKET|MOUNT|POWER|CABLE|ADAPTER|SFP|STACK|KIT|COVER)\b|^(LIC|CON|MA|ACC)-/i;

function findHardware(pb, model) {
  const m = String(model || '').trim().toUpperCase(); if (!m) return null;
  const mt = tok(m); let best = null, bestScore = -1;
  for (const e of pb.byKey.values()) {
    if (e.kind !== 'hw' || e.hw == null) continue;
    const hay = tok(`${e.key} ${e.desc}`);
    const skuT = tok(e.key);
    const hit = mt.every((t) => hay.includes(t));
    if (!hit) continue;
    let score = 1;
    if (skuT.includes(m) || e.key.toUpperCase().includes(m)) score += 5;
    if (skuT[0] === mt[0] || skuT.slice(0, 2).join('-') === mt.slice(0, 2).join('-')) score += 3;
    if (ACCESSORY.test(e.key) || ACCESSORY.test(e.desc.slice(0, 40))) score -= 6;
    // exact-ish: model tokens are all of the SKU tokens (modulo HW/region suffix)
    if (skuT.length <= mt.length + 2) score += 2;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best && bestScore > 0 ? best : null;
}

function findLicence(pb, family, model, edition, opts = {}) {
  const fam = CATALOGUE[family]; if (!fam) return null;
  const mt = tok(model || '');
  let cands = [...pb.byKey.values()].filter((e) => e.kind === 'sub' && fam.lic.test(e.key));
  if (mt.length) {
    const f = cands.filter((e) => { const h = tok(`${e.key} ${e.desc}`); return mt.every((t) => h.includes(t)); });
    // Camera, sensor and AP licences are usually per-family, not per-model; MX/MS licences must match the model.
    cands = f.length || !['mv', 'mt', 'mr'].includes(family) ? f : cands;
  }
  if (!cands.length) return null;
  const ed = edition && fam.editions[String(edition).toLowerCase()];
  if (ed) { const f = cands.filter((e) => ed.test(e.key) || ed.test(e.desc)); if (f.length) cands = f; }
  if (opts.ports) { const f = cands.filter((e) => new RegExp(`(^|[^0-9])${opts.ports}([^0-9]|$)`).test(e.key)); if (f.length) cands = f; }
  cands.sort((a, b) => (Object.keys(b.terms).length - Object.keys(a.terms).length) || (a.key.length - b.key.length));
  return cands[0];
}

/* ---------- Sizing ---------- */
function mxModelFor(totalMbps, isDc) {
  if (isDc) { const r = CONFIG.mxRules.find((x) => totalMbps <= x.upTo && CONFIG.mxDcModels.includes(x.model)); return (r || { model: CONFIG.mxDcModels[CONFIG.mxDcModels.length - 1] }).model; }
  return (CONFIG.mxRules.find((x) => totalMbps <= x.upTo) || CONFIG.mxRules[CONFIG.mxRules.length - 1]).model;
}

function autoCounts(site) {
  const users = num(site.users), wired = num(site.wiredPorts);
  const isDc = /dc|data ?cent/i.test(site.type || ''), isCloud = /cloud/i.test(site.type || '');
  const aps = isCloud ? 0 : site.aps != null && site.aps !== '' ? num(site.aps) : isDc ? 0 : Math.ceil(users / CONFIG.usersPerAp);
  const switches = isCloud ? 0 : site.switches != null && site.switches !== '' ? num(site.switches) : wired > 0 ? Math.ceil(wired / CONFIG.portsPerSwitch) : (isDc ? 0 : users > 0 ? 1 : 0);
  return { aps, switches };
}

/* ---------- BoM ---------- */
function mkLine(group, site, kind, e, qty, desc, note) {
  return { group, site, kind, sku: e.skus[1] || e.skus[3] || e.skus[5] || e.skus.base || e.key, key: e.key, desc: desc || e.desc, qty, unit: e.hw, terms: e.terms, skuByTerm: e.skus, verified: true, note: note || '' };
}
const gap = (group, site, requirement, qty) => ({ group, site, kind: 'gap', verified: false, requirement, qty });

function buildInfraLines(pb, sites, opts = {}) {
  const lines = [];
  for (const s of sites) {
    const ha = !!s.ha, isDc = /dc|data ?cent/i.test(s.type || ''), isCloud = /cloud/i.test(s.type || '');
    const { aps, switches } = autoCounts(s);
    const name = s.name || 'Site';
    if (isCloud) continue;
    const bw = num(s.bwMbps) || parseBwMbps(s.bw);
    const mxModel = s.mxModel || mxModelFor(bw, isDc);
    const hwQty = ha ? 2 : 1, licQty = ha && CONFIG.haLicDouble ? 2 : 1;
    const mxHw = findHardware(pb, mxModel);
    if (mxHw) lines.push(mkLine('WAN', name, 'capex', mxHw, hwQty, `${mxHw.desc || mxModel} - ${name}${ha ? ' (HA pair)' : ''}`));
    else lines.push(gap('WAN', name, `${mxModel} hardware`, hwQty));
    const mxLic = findLicence(pb, 'mx', mxModel, s.mxEdition || opts.mxEdition || 'adv');
    if (mxLic) lines.push(mkLine('Security', name, 'opex', mxLic, licQty, `${mxLic.desc || mxLic.key} - ${name}`));
    else lines.push(gap('Security', name, `${mxModel} licence`, licQty));
    if (aps > 0) {
      const apModel = s.apModel || opts.apModel || 'MR36';
      const hw = findHardware(pb, apModel), lic = findLicence(pb, 'mr', '', opts.apEdition || 'ent');
      hw ? lines.push(mkLine('WiFi', name, 'capex', hw, aps, `${hw.desc || apModel} - ${name}`)) : lines.push(gap('WiFi', name, `${apModel} access point`, aps));
      lic ? lines.push(mkLine('WiFi', name, 'opex', lic, aps, `${lic.desc || lic.key} - ${name}`)) : lines.push(gap('WiFi', name, 'AP licence', aps));
    }
    if (switches > 0) {
      const swModel = s.swModel || opts.swModel || 'MS130-24P';
      const hw = findHardware(pb, swModel), lic = findLicence(pb, 'ms', swModel, opts.swEdition || 'ent');
      hw ? lines.push(mkLine('LAN', name, 'capex', hw, switches, `${hw.desc || swModel} - ${name}`)) : lines.push(gap('LAN', name, `${swModel} switch`, switches));
      lic ? lines.push(mkLine('LAN', name, 'opex', lic, switches, `${lic.desc || lic.key} - ${name}`)) : lines.push(gap('LAN', name, `${swModel} licence`, switches));
    }
    const cams = num(s.cameras);
    if (cams > 0) {
      const m = s.camModel || opts.camModel || 'MV12W';
      const hw = findHardware(pb, m), lic = findLicence(pb, 'mv', m);
      hw ? lines.push(mkLine('Camera', name, 'capex', hw, cams, `${hw.desc || m} - ${name}`)) : lines.push(gap('Camera', name, `${m} camera`, cams));
      lic ? lines.push(mkLine('Camera', name, 'opex', lic, cams, `${lic.desc || lic.key} - ${name}`)) : lines.push(gap('Camera', name, `${m} licence`, cams));
    }
    const sens = num(s.sensors);
    if (sens > 0) {
      const m = s.sensorModel || opts.sensorModel || 'MT10';
      const hw = findHardware(pb, m), lic = findLicence(pb, 'mt', m);
      hw ? lines.push(mkLine('IoT', name, 'capex', hw, sens, `${hw.desc || m} - ${name}`)) : lines.push(gap('IoT', name, `${m} sensor`, sens));
      lic ? lines.push(mkLine('IoT', name, 'opex', lic, sens, `${lic.desc || lic.key} - ${name}`)) : lines.push(gap('IoT', name, `${m} licence`, sens));
    }
  }
  return lines;
}

/* Candidate rows for the AI to choose service SKUs from (relevance filter, never truncation). */
function serviceCandidates(pb, pattern, users) {
  const re = pattern || /secure.?access|secure.?connect|umbrella|duo|thousandeyes|spaces|SECURE|SSE|ZTNA|DNS/i;
  let c = [...pb.byKey.values()].filter((e) => e.kind === 'sub' && (re.test(e.key) || re.test(e.desc)));
  const withUser = c.filter((e) => /\buser|seat|per user/i.test(e.desc));
  if (users && withUser.length >= 3) c = withUser;
  return c.map((e) => ({ sku: e.key, desc: e.desc.slice(0, 160), terms: Object.keys(e.terms).join('/') }));
}

function aggregateLines(lines) {
  const out = new Map(); const gaps = [];
  for (const l of lines) {
    if (!l.verified) { gaps.push(l); continue; }
    const k = `${l.group}|${l.kind}|${l.key}|${l.desc}`;
    if (out.has(k)) out.get(k).qty += l.qty; else out.set(k, { ...l });
  }
  return { lines: [...out.values()], gaps };
}

function termPrice(line, term, derive) {
  const t = line.terms || {};
  if (t[term] != null) return { price: t[term], derived: false };
  if (derive && t[1] != null) {
    if (term === 3) return { price: t[1] * 3 * (1 - CONFIG.derive.y3), derived: true };
    if (term === 5) return { price: t[1] * 5 * (1 - CONFIG.derive.y5), derived: true };
  }
  return { price: null, derived: false };
}

function computeTotals(lines, opts = {}) {
  const derive = !!opts.derive, svc = CONFIG.serviceTiers[opts.serviceTier || 'none'] || 0;
  let capex = 0; const opex = { 1: 0, 3: 0, 5: 0 }; const missing = { 1: 0, 3: 0, 5: 0 };
  for (const l of lines) {
    if (l.kind === 'capex') capex += (l.unit || 0) * l.qty;
    else if (l.kind === 'opex') for (const t of [1, 3, 5]) { const p = termPrice(l, t, derive).price; if (p == null) missing[t]++; else opex[t] += p * l.qty; }
  }
  const wanAnnual = num(opts.wanAnnual);
  const serviceAnnual = opex[1] * svc;
  const tco = {};
  for (const t of [1, 3, 5]) tco[t] = capex + opex[t] + (serviceAnnual + wanAnnual) * t;
  const savings = { 3: tco[1] * 3 - tco[3], 5: tco[1] * 5 - tco[5] };
  return { capex, opex, missing, serviceAnnual, wanAnnual, tco, savings };
}

function bomToCsv(lines, derive) {
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = [['Group', 'Site', 'Type', 'SKU', 'Description', 'Qty', 'Unit HW', '1Y Total', '3Y Total', '5Y Total'].map(q).join(',')];
  for (const l of lines) {
    const p = (t) => { const r = termPrice(l, t, derive).price; return r == null ? '' : (r * l.qty).toFixed(2); };
    rows.push([l.group, l.site, l.kind, l.sku, l.desc, l.qty, l.kind === 'capex' ? l.unit : '', l.kind === 'opex' ? p(1) : '', l.kind === 'opex' ? p(3) : '', l.kind === 'opex' ? p(5) : ''].map(q).join(','));
  }
  return rows.join('\r\n');
}

const api = { CONFIG, CATALOGUE, esc, num, parseBwMbps, decodeBuffer, parseCsvRows, parsePrice, mapHeader, splitTerm, classifySingle, parsePriceBook, lookupExact, findHardware, findLicence, autoCounts, mxModelFor, buildInfraLines, serviceCandidates, aggregateLines, termPrice, computeTotals, bomToCsv };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
