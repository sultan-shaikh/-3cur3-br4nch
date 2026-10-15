/* Cisco Secure Branch Architect - app core: state, API, inputs, sizing UI, scan, generate */
(function () {
'use strict';
const C = window.Core, $ = (id) => document.getElementById(id);
const App = window.App = { C, $, S: { pb: null, sites: [], last: null, cur: 'USD', fx: 1, logo: null, img: null } };
const S = App.S, esc = C.esc;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
Object.assign(App, { esc, sleep });

/* ---------- Access + API ---------- */
const KEY = 'csba_code';
const getCode = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const setCode = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} };
App.getCode = getCode; App.setCode = setCode;
App.showLock = (msg) => { $('lock').hidden = false; $('lockErr').hidden = !msg; $('lockErr').textContent = msg || ''; $('lockInput').focus(); };

async function api(payload) {
  let last;
  for (let i = 0; i < 3; i++) {
    let res;
    try { res = await fetch('/.netlify/functions/gemini-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-access-code': getCode() }, body: JSON.stringify(payload) }); }
    catch { last = new Error('Network error'); await sleep(1200 * (i + 1)); continue; }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    if (res.status === 401) { setCode(''); App.showLock('Access code rejected'); throw new Error('Access code required'); }
    if (res.ok) return j;
    const msg = (j && j.error && (j.error.message || j.error)) || `HTTP ${res.status}`;
    last = new Error(`[HTTP ${res.status}] ${msg}`);
    if ([429, 502, 503, 504].includes(res.status) && !(res.status === 504 && i >= 1)) { await sleep(1500 * (i + 1)); continue; }
    throw last;
  }
  throw last || new Error('Request failed');
}
async function generate(prompt, { image, json = true, max = 4096, temp = 0.2 } = {}) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.b64 } });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: temp, maxOutputTokens: max, thinkingConfig: { thinkingBudget: 0 } } };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  const r = await api({ endpoint: 'generate', model: $('modelSelector').value, body });
  const c = r.candidates && r.candidates[0];
  if (!c) throw new Error(r.promptFeedback ? 'Blocked by safety filter' : 'Empty AI response');
  if (c.finishReason === 'MAX_TOKENS') throw new Error('AI response was cut off; try a smaller request');
  if (c.finishReason === 'SAFETY') throw new Error('Blocked by safety filter');
  return (c.content.parts || []).map((p) => p.text || '').join('');
}
function extractJSON(t) {
  t = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch {}
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('AI returned invalid JSON');
}
const safeHtml = (md) => window.DOMPurify.sanitize(window.marked.parse(String(md == null ? '' : md), { breaks: true }));
const money = (v, dp = 0) => v == null || !isFinite(v) ? '—' : new Intl.NumberFormat(S.cur === 'USD' ? 'en-US' : 'en-GB', { style: 'currency', currency: S.cur, maximumFractionDigits: dp, minimumFractionDigits: dp }).format(v * S.fx);
Object.assign(App, { api, generate, extractJSON, safeHtml, money });
const setErr = (m) => { $('error').hidden = !m; $('error').textContent = m || ''; };
const setStatus = (m) => { $('status').textContent = m || ''; };
Object.assign(App, { setErr, setStatus });

/* ---------- Models ---------- */
App.loadModels = async function () {
  const sel = $('modelSelector');
  try {
    const r = await api({ endpoint: 'models' });
    const ms = (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-(flash|pro)(-lite)?$/.test(n)).sort().reverse();
    sel.innerHTML = ''; (ms.length ? ms : ['gemini-2.5-flash']).forEach((n) => sel.add(new Option(n, n)));
    const pref = [...sel.options].find((o) => o.value === 'gemini-2.5-flash'); if (pref) sel.value = pref.value;
    sel.disabled = false; $('modelCount').textContent = `${sel.options.length} model(s) available. gemini-2.5-flash is recommended for speed.`;
  } catch (e) { sel.innerHTML = ''; sel.add(new Option('gemini-2.5-flash', 'gemini-2.5-flash')); sel.disabled = false; $('modelCount').textContent = 'Model scan failed; using default. ' + e.message; }
};

/* ---------- Price book ---------- */
App.onPriceBook = async function (file) {
  try {
    S.pb = C.parsePriceBook(C.decodeBuffer(await file.arrayBuffer()));
    const s = S.pb.summary;
    $('priceStatus').textContent = `✔ Loaded ${s.total} products (${s.hardware} hardware, ${s.licences} licences/subscriptions).`;
    $('priceStatus').className = 'small bold ok'; $('generateBtn').disabled = false;
  } catch (err) { S.pb = null; $('priceStatus').textContent = '✖ ' + err.message; $('priceStatus').className = 'small bold err'; $('generateBtn').disabled = true; }
};

/* ---------- Sites ---------- */
const SITE_TYPES = ['Branch', 'HQ', 'DC'];
const WAN_TYPES = ['MPLS', 'DIA', 'Broadband', '5G/LTE'];
const newSite = () => ({ type: 'Branch', country: 'UK', city: '', users: 30, wan: [{ type: 'DIA', mbps: 100 }], ha: false, wifi: true, switching: true, camera: false, cameras: 0, iot: false, sensors: 0 });
App.newSite = newSite;
function normType(t) { t = String(t || ''); return /data ?cent|^dc\b/i.test(t) ? 'DC' : /hq|head|hub|campus/i.test(t) ? 'HQ' : 'Branch'; }
function normWan(t) { t = String(t || ''); return /mpls|vpls|private/i.test(t) ? 'MPLS' : /lte|5g|4g|cell/i.test(t) ? '5G/LTE' : /broadband|dsl|cable|fibre ?to|fttp|fttc|adsl/i.test(t) ? 'Broadband' : 'DIA'; }
App.normSite = function (r) {
  const wan = (Array.isArray(r.wan) ? r.wan : []).map((l) => ({ type: normWan(l.type), mbps: C.num(l.mbps) })).filter((l) => l.mbps > 0);
  if (!wan.length && (r.bwMbps || r.bw)) wan.push({ type: 'DIA', mbps: C.num(r.bwMbps) || C.parseBwMbps(r.bw) });
  const cams = C.num(r.cameras), sens = C.num(r.sensors);
  return { type: normType(r.type), country: String(r.country || '').slice(0, 40), city: String(r.city || r.name || '').slice(0, 60), users: C.num(r.users), wan: wan.length ? wan : [{ type: 'DIA', mbps: 100 }], ha: r.ha === true || /^(y|yes|true|1)$/i.test(String(r.ha)),
    switching: r.switching == null ? true : bool(r.switching), wifi: r.wifi == null ? true : bool(r.wifi), camera: bool(r.camera) || cams > 0, cameras: cams, iot: bool(r.iot) || sens > 0, sensors: sens };
};
function bool(v) { return v === true || /^(y|yes|true|1|x)$/i.test(String(v)); }

App.renderSites = function () {
  const tb = $('siteTable').tBodies[0];
  tb.innerHTML = S.sites.map((s, i) => `<tr data-i="${i}">
    <td><select data-k="type">${SITE_TYPES.map((t) => `<option${t === s.type ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input data-k="country" value="${esc(s.country)}" style="width:90px"></td>
    <td><input data-k="city" value="${esc(s.city)}" style="width:110px"></td>
    <td><input data-k="users" type="number" min="0" class="num-in" value="${esc(s.users)}"></td>
    <td><div class="feat">
      <label><input type="checkbox" data-k="switching"${s.switching ? ' checked' : ''}> LAN switching</label>
      <label><input type="checkbox" data-k="wifi"${s.wifi ? ' checked' : ''}> WiFi</label>
      <label><input type="checkbox" data-k="camera"${s.camera ? ' checked' : ''}> Cameras ${s.camera ? `<input type="number" min="0" data-k="cameras" value="${esc(s.cameras)}">` : ''}</label>
      <label><input type="checkbox" data-k="iot"${s.iot ? ' checked' : ''}> IoT sensors ${s.iot ? `<input type="number" min="0" data-k="sensors" value="${esc(s.sensors)}">` : ''}</label></div></td>
    <td>${s.wan.map((l, j) => `<div class="wanrow"><select data-k="wantype" data-l="${j}">${WAN_TYPES.map((t) => `<option${t === l.type ? ' selected' : ''}>${t}</option>`).join('')}</select><input type="number" min="0" data-k="wanmbps" data-l="${j}" value="${esc(l.mbps)}"><span class="tiny muted">Mbps</span>${s.wan.length > 1 ? `<button class="x" type="button" data-act="rmwan" data-l="${j}" title="Remove link">✕</button>` : ''}</div>`).join('')}<button class="linkbtn" type="button" data-act="addwan">+ link</button></td>
    <td class="center"><input type="checkbox" data-k="ha"${s.ha ? ' checked' : ''}></td>
    <td><button class="x" type="button" data-act="del" title="Remove site">✕</button></td></tr>`).join('');
};
function siteEvent(e) {
  const t = e.target, tr = t.closest('tr'); if (!tr) return; const s = S.sites[+tr.dataset.i]; if (!s) return;
  const act = t.dataset.act;
  if (e.type === 'click') {
    if (act === 'del') { S.sites.splice(+tr.dataset.i, 1); App.renderSites(); }
    else if (act === 'addwan') { s.wan.push({ type: 'DIA', mbps: 100 }); App.renderSites(); }
    else if (act === 'rmwan') { s.wan.splice(+t.dataset.l, 1); App.renderSites(); }
    return;
  }
  const k = t.dataset.k; if (!k) return;
  if (k === 'wantype') s.wan[+t.dataset.l].type = t.value;
  else if (k === 'wanmbps') s.wan[+t.dataset.l].mbps = C.num(t.value);
  else if (t.type === 'checkbox') { s[k] = t.checked; if (e.type === 'change' && (k === 'camera' || k === 'iot')) { if (t.checked && !s[k === 'camera' ? 'cameras' : 'sensors']) s[k === 'camera' ? 'cameras' : 'sensors'] = 2; App.renderSites(); } }
  else if (t.type === 'number') s[k] = C.num(t.value);
  else s[k] = t.value;
}
App.bindSites = function () {
  ['input', 'change', 'click'].forEach((ev) => $('siteTable').tBodies[0].addEventListener(ev, siteEvent));
  $('addSite').addEventListener('click', () => { S.sites.push(newSite()); App.renderSites(); });
  $('tplBtn').addEventListener('click', () => dl(new Blob(['Type,Country,City,Users,WAN1_Type,WAN1_Mbps,WAN2_Type,WAN2_Mbps,HA,Switching,WiFi,Cameras,Sensors\r\nHQ,UK,London,400,MPLS,500,DIA,1000,Y,Y,Y,12,6\r\nBranch,UK,Bristol,60,DIA,200,Broadband,80,N,Y,Y,4,2\r\n'], { type: 'text/csv' }), 'sites_template.csv'));
  $('siteCsv').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const rows = C.parseCsvRows(C.decodeBuffer(await f.arrayBuffer())); const h = rows[0].map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const col = (...n) => h.findIndex((x) => n.includes(x));
      const ix = { type: col('type', 'sitetype'), country: col('country'), city: col('city', 'site', 'name'), users: col('users', 'headcount'), ha: col('ha'), sw: col('switching', 'lan'), wifi: col('wifi'), cam: col('cameras', 'camera'), sen: col('sensors', 'iot') };
      const out = [];
      for (const r of rows.slice(1)) {
        const g = (i) => (i >= 0 ? (r[i] || '').trim() : ''); const wan = [];
        for (let n = 1; n <= 4; n++) { const a = col(`wan${n}type`), b = col(`wan${n}mbps`, `wan${n}bw`, `wan${n}bandwidth`); if (b >= 0 && C.num(r[b]) > 0) wan.push({ type: g(a), mbps: C.num(r[b]) }); }
        out.push(App.normSite({ type: g(ix.type), country: g(ix.country), city: g(ix.city), users: g(ix.users), ha: g(ix.ha), switching: ix.sw >= 0 ? g(ix.sw) : null, wifi: ix.wifi >= 0 ? g(ix.wifi) : null, cameras: g(ix.cam), sensors: g(ix.sen), wan }));
      }
      if (!out.length) throw new Error('No site rows found');
      S.sites = out; App.renderSites(); $('importNote').hidden = false; $('importNote').className = 'small ok'; $('importNote').textContent = `Imported ${out.length} site(s).`;
    } catch (err) { $('importNote').hidden = false; $('importNote').className = 'small err'; $('importNote').textContent = 'Import failed: ' + err.message; }
  });
};
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
App.dl = dl;

/* ---------- Add-ons ---------- */
const ADDONS = [['SWG', 'Secure Web Gateway'], ['ZTNA', 'Zero Trust Network Access'], ['CASB', 'CASB / SaaS control'], ['DLP', 'Data Loss Prevention'], ['FWaaS', 'Cloud Firewall (FWaaS/IPS)'], ['RBI', 'Remote Browser Isolation'], ['SANDBOX', 'Cloud sandbox'], ['DNS', 'DNS-layer security'], ['DEM', 'ThousandEyes digital experience']];
App.renderAddons = function () { $('addonGrid').innerHTML = ADDONS.map(([v, l], i) => `<label class="addon"><input type="checkbox" value="${v}" data-name="${esc(l)}"${i < 4 ? ' checked' : ''}> ${l}</label>`).join(''); };
App.activeAddons = () => [...document.querySelectorAll('#addonGrid input:checked')].map((c) => c.dataset.name);

/* ---------- Sizing rules UI ---------- */
App.renderRules = function (reset) {
  const cfg = C.CONFIG;
  if (reset) { cfg.rules = JSON.parse(JSON.stringify(C.DEFAULT_RULES)); Object.assign(cfg.defaults, JSON.parse(JSON.stringify(C.DEFAULT_DEFAULTS))); cfg.usersPerAp = 30; cfg.portsPerSwitch = 24; cfg.wiredShare = 0.5; cfg.haLicDouble = true; }
  $('rulesBody').innerHTML = cfg.rules.map((r, i) => `<tr data-i="${i}"><td><select data-k="scope"><option value="branch"${r.scope === 'branch' ? ' selected' : ''}>Branch</option><option value="hub"${r.scope === 'hub' ? ' selected' : ''}>Hub (DC / HQ)</option><option value="any"${r.scope === 'any' ? ' selected' : ''}>Any</option></select></td>
    <td><input type="number" data-k="upTo" value="${r.upTo >= 1e9 ? '' : esc(r.upTo)}" placeholder="no limit" style="width:120px"></td><td><input data-k="model" value="${esc(r.model)}" style="width:140px"></td><td><button class="x" type="button" data-act="rdel">✕</button></td></tr>`).join('');
  $('cfgUsersPerAp').value = cfg.usersPerAp; $('cfgPortsPerSwitch').value = cfg.portsPerSwitch; $('cfgWired').value = cfg.wiredShare; $('cfgHaLic').value = cfg.haLicDouble ? '1' : '0';
  const d = cfg.defaults; $('dfAp').value = d.ap; $('dfSw').value = d.sw; $('dfCam').value = d.cam; $('dfSensor').value = d.sensor; $('dfMxEd').value = d.mxEd; $('dfApEd').value = d.apEd; $('dfSwEd').value = d.swEd;
};
App.bindRules = function () {
  const cfg = C.CONFIG;
  const rb = $('rulesBody');
  rb.addEventListener('input', (e) => { const tr = e.target.closest('tr'), r = cfg.rules[+tr.dataset.i], k = e.target.dataset.k; if (!r || !k) return; r[k] = k === 'upTo' ? (e.target.value === '' ? 1e9 : C.num(e.target.value)) : e.target.value; });
  rb.addEventListener('click', (e) => { if (e.target.dataset.act === 'rdel') { cfg.rules.splice(+e.target.closest('tr').dataset.i, 1); App.renderRules(); } });
  $('ruleAdd').addEventListener('click', () => { cfg.rules.push({ scope: 'branch', upTo: 1e9, model: '' }); App.renderRules(); });
  $('rulesReset').addEventListener('click', () => App.renderRules(true));
  const bind = (id, fn) => $(id).addEventListener('input', () => fn($(id).value));
  bind('cfgUsersPerAp', (v) => { cfg.usersPerAp = Math.max(1, C.num(v, 30)); }); bind('cfgPortsPerSwitch', (v) => { cfg.portsPerSwitch = Math.max(1, C.num(v, 24)); });
  bind('cfgWired', (v) => { cfg.wiredShare = Math.min(1, Math.max(0, C.num(v, 0.5))); }); $('cfgHaLic').addEventListener('change', () => { cfg.haLicDouble = $('cfgHaLic').value === '1'; });
  [['dfAp', 'ap'], ['dfSw', 'sw'], ['dfCam', 'cam'], ['dfSensor', 'sensor'], ['dfMxEd', 'mxEd'], ['dfApEd', 'apEd'], ['dfSwEd', 'swEd']].forEach(([id, k]) => { $(id).addEventListener('input', () => { cfg.defaults[k] = $(id).value.trim(); }); $(id).addEventListener('change', () => { cfg.defaults[k] = $(id).value.trim(); }); });
  $('previewBtn').addEventListener('click', preview);
};
function preview() {
  const tb = $('previewBody'); if (!S.sites.length) { tb.innerHTML = '<tr><td colspan="10" class="center muted" style="padding:12px">No sites yet.</td></tr>'; return; }
  const chk = (m) => !S.pb ? '' : C.findHardware(S.pb, m) ? ' <span class="ok" title="Found in price book">✔</span>' : ' <span class="err" title="Not in price book">✖</span>';
  tb.innerHTML = S.sites.map((s, i) => { const z = C.sizeSite(s); return `<tr><td>${i + 1}</td><td>${esc(C.siteName(s))}</td><td>${esc(s.type)}</td><td>${z.bw} Mbps</td><td><b>${esc(z.mx || '—')}</b>${z.mx ? chk(z.mx) : ''}</td><td>${z.aps}</td><td>${z.switches}</td><td>${z.cameras}</td><td>${z.sensors}</td><td>${s.ha ? 'Y' : '–'}</td></tr>`; }).join('');
}
App.preview = preview;

/* ---------- Diagram scan ---------- */
async function downscale(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read image')); i.src = url; });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { mime: 'image/jpeg', b64: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
  } finally { URL.revokeObjectURL(url); }
}
App.bindScan = function () {
  $('diagramInput').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return; S.img = f;
    const box = $('imagePreviewBox'); $('imagePreview').src = URL.createObjectURL(f); box.style.display = 'flex'; $('clearImg').classList.remove('hidden');
  });
  $('clearImg').addEventListener('click', () => { S.img = null; $('diagramInput').value = ''; $('imagePreviewBox').style.display = 'none'; $('clearImg').classList.add('hidden'); });
  $('scanBtn').addEventListener('click', scan);
};
async function scan() {
  if (!S.img) return setErr('Choose a diagram image first.');
  setErr(''); const prog = $('scanProgress'); prog.classList.add('on'); $('scanSummary').hidden = true;
  const dots = [1, 2, 3, 4, 5, 6].map((n) => $('sp' + n)); dots.forEach((d) => (d.className = 'dot'));
  let i = 0; dots[0].className = 'dot active'; const tm = setInterval(() => { if (i < 4) { dots[i].className = 'dot done'; i++; dots[i].className = 'dot active'; } }, 1500);
  $('scanBtn').disabled = true;
  try {
    const image = await downscale(S.img);
    const txt = await generate(`You are reading a network topology diagram for a Cisco Meraki + Secure Access design. Return ONLY JSON:
{"sites":[{"type":"Branch"|"HQ"|"DC","country":string,"city":string,"users":number,"wan":[{"type":"MPLS"|"DIA"|"Broadband"|"5G/LTE","mbps":number}],"ha":boolean,"switching":boolean,"wifi":boolean,"cameras":number,"sensors":number}],"remoteUsers":number,"confidence":"high"|"medium"|"low","notes":string}
Rules: use 0 / false where the diagram does not show something; do not invent sites; convert Gbps to Mbps; "ha" is true only if a resilient pair is drawn; cameras and sensors are counts of CCTV cameras and IoT/environmental sensors if shown.`, { image, max: 6000 });
    const j = extractJSON(txt);
    const sites = (j.sites || []).map(App.normSite); if (!sites.length) throw new Error('No sites were found in that image.');
    S.sites = sites; App.renderSites(); if (C.num(j.remoteUsers) > 0) $('userCount').value = C.num(j.remoteUsers);
    clearInterval(tm); dots.forEach((d) => (d.className = 'dot done'));
    const s = $('scanSummary'); s.hidden = false; s.textContent = `Extracted ${sites.length} site(s). AI confidence: ${j.confidence || 'unknown'}. ⚠ Please review every row below before generating.${j.notes ? ' Notes: ' + String(j.notes).slice(0, 240) : ''}`;
    $('meInputs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { clearInterval(tm); dots.forEach((d) => (d.className = 'dot')); setErr(err.message); }
  $('scanBtn').disabled = false;
}

/* ---------- Generate ---------- */
const scopeOf = () => $('designScope').value;
App.scopeOf = scopeOf;
App.servicePct = () => C.num(document.querySelector('input[name=tier]:checked').value) + C.num(document.querySelector('input[name=role]:checked').value);
App.serviceLabels = () => ({ tier: document.querySelector('input[name=tier]:checked').parentElement.querySelector('b').textContent, role: document.querySelector('input[name=role]:checked').parentElement.querySelector('b').textContent, tierPct: C.num(document.querySelector('input[name=tier]:checked').value), rolePct: C.num(document.querySelector('input[name=role]:checked').value) });

async function pickSse(users) {
  const platform = $('ssePlatform').value, edition = $('sseEdition').value, mods = App.activeAddons();
  const re = platform === 'Secure Connect' ? /secure.?connect/i : /secure.?access|umbrella|duo|zero.?trust|ztna|\bsse\b|\bswg\b|casb|dlp|isolation|sandbox|dns/i;
  let cands = C.serviceCandidates(S.pb, re, users);
  if (!cands.length) cands = C.serviceCandidates(S.pb, null, users);
  if (!cands.length) return { picks: [], note: `No ${platform} lines were found in the price book, so no SSE subscriptions were priced.` };
  let ranked = false;
  if (cands.length > 150) {
    const kw = [edition, ...mods].join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const score = (c) => { const h = (c.sku + ' ' + c.desc).toLowerCase(); return kw.reduce((a, w) => a + (h.includes(w) ? 1 : 0), 0); };
    cands = cands.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 150); ranked = true;
  }
  const txt = await generate(`Choose Cisco ${platform} subscription SKUs for ${users} users. Edition/package: ${edition}. Required capabilities: ${mods.join(', ') || 'core SSE'}.
Choose ONLY from this price-book list, copying "sku" values exactly. Prefer one core package covering the required capabilities; add add-ons only where a required capability is not covered. For each choice say whether it is priced per "user" or is a "flat" (per tenant / per site / other) item. Return JSON {"skus":[{"sku":string,"unit":"user"|"flat","reason":string}]}.
${JSON.stringify(cands)}`, { max: 2500 });
  const picks = [], seen = new Set(), rejected = [];
  for (const p of extractJSON(txt).skus || []) {
    const e = C.lookupExact(S.pb, p.sku);
    if (!e || e.kind !== 'sub') { rejected.push(String(p.sku).slice(0, 60)); continue; } if (seen.has(e.key)) continue; seen.add(e.key);
    picks.push({ e, unit: p.unit === 'flat' ? 'flat' : 'user', reason: String(p.reason || '').slice(0, 220) });
  }
  const notes = []; if (rejected.length) notes.push(`AI proposed SKUs that are not in the price book; excluded: ${rejected.join(', ')}.`);
  if (ranked) notes.push('Price book has many SSE lines; the 150 most relevant to the chosen package were offered to the AI.');
  if (!picks.length) notes.push('No valid SSE SKUs were selected, so no Secure Access subscriptions are priced.');
  return { picks, note: notes.join(' ') };
}

async function narrative(ctx) {
  const lines = [];
  lines.push(`Customer: ${ctx.company} (${ctx.industry}). Scope: ${ctx.scopeLabel}.`);
  if (ctx.meraki) lines.push(`Meraki sites: ${JSON.stringify(ctx.sizing)}`);
  if (ctx.sse) lines.push(`Secure Access: platform ${ctx.platform}, package ${ctx.edition}, ${ctx.users} users, region ${ctx.region}, modules ${ctx.mods.join(', ') || 'core'}.`);
  const keys = [ctx.meraki ? '"wan","security","lan","wifi","camera","iot"' : '', ctx.sse ? '"sse"' : ''].filter(Boolean).join(',');
  const txt = await generate(`You are a senior solutions architect writing a first-cut design for a managed service built on Cisco Meraki (MX SD-WAN & advanced security, MS/Catalyst switching, MR WiFi, MV smart cameras, MT sensors, Meraki Dashboard${ctx.sse ? ', Cisco Secure Access / Secure Connect SSE' : ''}).
${lines.join('\n')}
Rules: do NOT mention prices, SKUs or costs. Do not claim features that are not standard for the named Cisco products. Refer to the sizing above, do not change it. Be specific to the sites given.
Return ONLY JSON with these string keys: "executive_summary", ${keys}, "risks". Each value is short markdown (max 130 words); use "" for any pillar that has no equipment in the sizing.`, { max: 6000, temp: 0.3 });
  return extractJSON(txt);
}

App.generateDesign = async function () {
  setErr('');
  const scope = scopeOf(), meraki = scope !== 'SSE', sse = scope !== 'Meraki', users = C.num($('userCount').value);
  if (!S.pb) return setErr('Load a price book first.');
  if (meraki && !S.sites.length) return setErr('Add at least one site.');
  if (sse && users <= 0 && scope === 'SSE') return setErr('Enter the number of remote users.');
  if (meraki && S.sites.some((s) => !(C.siteBw(s) > 0) && !C.isCloudSite(s.type))) return setErr('Every site needs at least one WAN link with bandwidth.');
  const btn = $('generateBtn'); btn.disabled = true; setStatus('Building design…');
  try {
    S.cur = $('cur').value; S.fx = C.num($('fx').value, 1) || 1;
    const company = $('companyName').value.trim() || 'Customer';
    const infra = meraki ? C.buildInfraLines(S.pb, S.sites) : [];
    const sizing = meraki ? S.sites.map((s) => { const z = C.sizeSite(s); return { site: C.siteName(s), type: s.type, users: s.users, wan: s.wan.map((l) => `${l.type} ${l.mbps}Mbps`), ha: !!s.ha, mx: z.mx, aps: z.aps, switches: z.switches, cameras: z.cameras, sensors: z.sensors }; }) : [];
    let svc = { picks: [], note: '' }, narr = null, narrErr = '';
    const jobs = [];
    if (sse && users > 0) jobs.push(pickSse(users).then((r) => { svc = r; }).catch((e) => { svc = { picks: [], note: 'Secure Access SKU selection failed: ' + e.message }; }));
    jobs.push(narrative({ company, industry: $('industry').value, scopeLabel: $('designScope').selectedOptions[0].text, meraki, sse, sizing, platform: $('ssePlatform').value, edition: $('sseEdition').value, users, region: $('region').value, mods: App.activeAddons() }).then((r) => { narr = r; }).catch((e) => { narrErr = e.message; }));
    await Promise.all(jobs);
    const lines = infra.slice();
    for (const p of svc.picks) lines.push({ group: 'Secure Access', site: 'All users', kind: 'opex', sku: p.e.skus[1] || p.e.skus[3] || p.e.skus[5] || p.e.key, key: p.e.key, desc: p.e.desc, qty: p.unit === 'flat' ? 1 : users, terms: p.e.terms, skuByTerm: p.e.skus, verified: true, note: p.reason });
    const agg = C.aggregateLines(lines);
    S.last = { company, scope, meraki, sse, users, agg, narr, narrErr, svcNote: svc.note, derive: $('derive').checked, sizing, sitesSnap: JSON.parse(JSON.stringify(S.sites)), sseCfg: { platform: $('ssePlatform').value, edition: $('sseEdition').value, mods: App.activeAddons(), region: $('region').value }, industry: $('industry').value.trim() || 'Enterprise', svcLabels: App.serviceLabels(), servicePct: App.servicePct(), wanAnnual: C.num($('wanAnnual').value), ts: new Date() };
    await App.renderReport(S.last);
  } catch (err) { setErr(err.message); }
  btn.disabled = !S.pb; setStatus('');
};
})();
