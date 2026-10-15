(function () {
'use strict';
const C = window.Core, $ = (id) => document.getElementById(id);
const S = { pb: null, sites: [], lastBom: null, cur: 'USD', fx: 1 };
const KEY = 'csba_code';
const getCode = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const setCode = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Access + API ---------- */
function showLock(msg) { $('lock').hidden = false; $('lockErr').hidden = !msg; $('lockErr').textContent = msg || ''; $('lockInput').focus(); }
async function api(payload) {
  let last;
  for (let i = 0; i < 3; i++) {
    let res;
    try { res = await fetch('/.netlify/functions/gemini-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-access-code': getCode() }, body: JSON.stringify(payload) }); }
    catch (e) { last = new Error('Network error'); await sleep(1200 * (i + 1)); continue; }
    const txt = await res.text(); let j; try { j = JSON.parse(txt); } catch { j = null; }
    if (res.status === 401) { setCode(''); showLock('Access code rejected'); throw new Error('Access code required'); }
    if (res.ok) return j;
    const msg = (j && (j.error && (j.error.message || j.error))) || `HTTP ${res.status}`;
    last = new Error(`[HTTP ${res.status}] ${msg}`);
    if ([429, 502, 503, 504].includes(res.status) && !(res.status === 504 && i >= 1)) { await sleep(1500 * (i + 1)); continue; }
    throw last;
  }
  throw last || new Error('Request failed');
}
async function generate(prompt, { image, json = true, max = 4096, system } = {}) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.b64 } });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, maxOutputTokens: max, thinkingConfig: { thinkingBudget: 0 } } };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const r = await api({ endpoint: 'generate', model: $('model').value, body });
  const c = r.candidates && r.candidates[0];
  if (!c) throw new Error(r.promptFeedback ? 'Blocked by safety filter' : 'Empty AI response');
  if (c.finishReason === 'MAX_TOKENS') throw new Error('AI response was cut off; try fewer sites or a smaller request');
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
const safeHtml = (md) => window.DOMPurify.sanitize(window.marked.parse(String(md || ''), { breaks: true }));

/* ---------- Models ---------- */
async function loadModels() {
  const sel = $('model');
  try {
    const r = await api({ endpoint: 'models' });
    const ms = (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''))
      .filter((n) => /^gemini-[\d.]+-(flash|pro)(-lite)?$/.test(n)).sort().reverse();
    sel.innerHTML = '';
    (ms.length ? ms : ['gemini-2.5-flash']).forEach((n) => sel.add(new Option(n, n)));
    const pref = [...sel.options].find((o) => o.value === 'gemini-2.5-flash'); if (pref) sel.value = pref.value;
  } catch (e) { sel.innerHTML = ''; sel.add(new Option('gemini-2.5-flash', 'gemini-2.5-flash')); }
}
async function unlock(code) {
  setCode(code);
  try { await api({ endpoint: 'models' }); $('lock').hidden = true; await loadModels(); }
  catch (e) { if (!/Access code/.test(e.message)) { $('lockErr').hidden = false; $('lockErr').textContent = e.message; } }
}

/* ---------- Price book ---------- */
$('pbFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    S.pb = C.parsePriceBook(C.decodeBuffer(await f.arrayBuffer()));
    const s = S.pb.summary;
    $('pbStatus').textContent = `Loaded ${s.total} products (${s.hardware} hardware, ${s.licences} licences/subscriptions).`;
    $('pbStatus').className = 'muted';
  } catch (err) { S.pb = null; $('pbStatus').textContent = err.message; $('pbStatus').className = 'err'; }
});

/* ---------- Sites table ---------- */
const TYPES = ['Branch', 'Data Centre', 'HQ', 'Cloud'];
function renderSites() {
  const tb = $('sites').tBodies[0]; tb.innerHTML = '';
  S.sites.forEach((s, i) => {
    const tr = tb.insertRow();
    const inp = (k, t = 'text') => { const el = document.createElement('input'); el.type = t; if (t === 'number') el.min = 0; el.value = s[k] == null ? '' : s[k]; el.dataset.i = i; el.dataset.k = k; return el; };
    tr.insertCell().appendChild(inp('name'));
    const sel = document.createElement('select'); TYPES.forEach((t) => sel.add(new Option(t, t))); sel.value = TYPES.includes(s.type) ? s.type : 'Branch'; sel.dataset.i = i; sel.dataset.k = 'type'; tr.insertCell().appendChild(sel);
    ['users', 'bwMbps', 'wiredPorts', 'cameras', 'sensors'].forEach((k) => tr.insertCell().appendChild(inp(k, 'number')));
    const ha = document.createElement('input'); ha.type = 'checkbox'; ha.checked = !!s.ha; ha.dataset.i = i; ha.dataset.k = 'ha'; tr.insertCell().appendChild(ha);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'btn'; del.textContent = '✕'; del.dataset.del = i; tr.insertCell().appendChild(del);
  });
}
$('sites').addEventListener('input', (e) => {
  const t = e.target; if (t.dataset.k == null) return; const s = S.sites[+t.dataset.i];
  s[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? 0 : Number(t.value)) : t.value;
});
$('sites').addEventListener('click', (e) => { const d = e.target.dataset.del; if (d != null) { S.sites.splice(+d, 1); renderSites(); } });
$('addSite').addEventListener('click', () => { S.sites.push({ name: `Site ${S.sites.length + 1}`, type: 'Branch', users: 0, bwMbps: 100, wiredPorts: 0, cameras: 0, sensors: 0, ha: false }); renderSites(); });

/* ---------- Diagram scan ---------- */
$('scanFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  if (f.size > 4 * 1024 * 1024) { setErr('Image over 4MB. Use a smaller screenshot.'); return; }
  setErr(''); $('status').textContent = 'Scanning diagram…';
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
    const txt = await generate(
      'Read this network diagram. Return JSON: {"sites":[{"name":string,"type":"Branch"|"Data Centre"|"HQ"|"Cloud","users":number,"bwMbps":number,"wiredPorts":number,"cameras":number,"sensors":number,"ha":boolean}],"confidence":"high"|"medium"|"low","notes":string}. Use 0 where not shown. Do not invent sites.',
      { image: { mime: f.type || 'image/png', b64 }, max: 4096 });
    const j = extractJSON(txt);
    S.sites = (j.sites || []).map((s) => ({ name: String(s.name || 'Site').slice(0, 60), type: TYPES.includes(s.type) ? s.type : 'Branch', users: C.num(s.users), bwMbps: C.num(s.bwMbps), wiredPorts: C.num(s.wiredPorts), cameras: C.num(s.cameras), sensors: C.num(s.sensors), ha: !!s.ha }));
    renderSites();
    $('scanNote').hidden = false; $('scanNote').textContent = `Review the extracted sites before generating (AI confidence: ${j.confidence || 'unknown'}). ${j.notes ? String(j.notes).slice(0, 300) : ''}`;
  } catch (err) { setErr(err.message); }
  $('status').textContent = '';
});

const setErr = (m) => { $('error').hidden = !m; $('error').textContent = m || ''; };

/* ---------- Money ---------- */
const money = (v) => v == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: S.cur, maximumFractionDigits: 0 }).format(v * S.fx);

/* ---------- Generate ---------- */
async function pickServices(pb, users) {
  const cands = C.serviceCandidates(pb, null, users).slice(0, 150);
  if (!cands.length) return { picks: [], note: 'No Secure Access / Secure Connect lines found in the price book.' };
  const txt = await generate(
    `Choose Cisco Secure Access / Secure Connect subscription SKUs for ${users} users (SSE: secure web gateway, ZTNA, DNS security, CASB/DLP as relevant). Choose ONLY from this list, copying SKU values exactly. Prefer one core package; add add-ons only if clearly useful. Return JSON {"skus":[{"sku":string,"reason":string}]}.\n${JSON.stringify(cands)}`, { max: 2048 });
  const out = [], seen = new Set(), rejected = [];
  for (const p of extractJSON(txt).skus || []) {
    const e = C.lookupExact(pb, p.sku);
    if (!e || e.kind !== 'sub' || seen.has(e.key)) { if (!e) rejected.push(String(p.sku)); continue; }
    seen.add(e.key); out.push({ e, reason: String(p.reason || '').slice(0, 200) });
  }
  return { picks: out, rejected };
}

async function onGenerate() {
  setErr('');
  if (!S.pb) return setErr('Load a price book first.');
  if (!S.sites.length) return setErr('Add at least one site.');
  $('go').disabled = true; $('status').textContent = 'Building…';
  try {
    S.cur = $('cur').value; S.fx = C.num($('fx').value, 1) || 1;
    const customer = $('customer').value.trim() || 'Customer';
    const derive = $('derive').checked, tier = $('svc').value, saUsers = C.num($('saUsers').value);
    const infra = C.buildInfraLines(S.pb, S.sites);
    let svcNote = '', svcPicks = [];
    const tasks = [];
    if ($('incSA').checked && saUsers > 0) tasks.push(pickServices(S.pb, saUsers).then((r) => { svcPicks = r.picks; if (r.note) svcNote = r.note; if (r.rejected && r.rejected.length) svcNote = `AI proposed SKUs not in the price book and they were excluded: ${r.rejected.join(', ')}`; }));
    const summary = S.sites.map((s) => ({ name: s.name, type: s.type, users: s.users, bwMbps: s.bwMbps, ha: !!s.ha, aps: C.autoCounts(s).aps, switches: C.autoCounts(s).switches, cameras: s.cameras, sensors: s.sensors }));
    let narrative = null, narrErr = '';
    tasks.push(generate(
      `Write a concise solution design for ${customer} using Cisco Meraki (MX SD-WAN/security, MS/Catalyst LAN, MR WiFi, MV cameras, MT sensors)${$('incSA').checked ? ' and Cisco Secure Access / Secure Connect (SSE)' : ''}. Sites: ${JSON.stringify(summary)}. Remote users: ${saUsers}. Do NOT mention any prices, SKUs or costs. Return JSON {"executive_summary":string,"lan":string,"wan":string,"security":string,"wifi":string,"camera":string,"iot":string,"risks":string}. Each value is short markdown (max 120 words). Use "" for pillars with no equipment.`,
      { max: 4096 }).then((t) => { narrative = extractJSON(t); }).catch((e) => { narrErr = e.message; }));
    await Promise.allSettled(tasks);

    const lines = infra.slice();
    for (const p of svcPicks) lines.push({ group: 'Secure Access', site: 'All users', kind: 'opex', sku: p.e.skus[1] || p.e.skus[3] || p.e.skus[5] || p.e.key, key: p.e.key, desc: p.e.desc, qty: saUsers, terms: p.e.terms, skuByTerm: p.e.skus, verified: true, note: p.reason });
    const agg = C.aggregateLines(lines);
    const totals = C.computeTotals(agg.lines, { derive, serviceTier: tier, wanAnnual: C.num($('wanAnnual').value) });
    S.lastBom = { agg, totals, derive };
    S.lastRender = { customer, agg, totals, derive, tier, narrative, narrErr, svcNote, saUsers, sa: $('incSA').checked };
    await render(S.lastRender);
  } catch (err) { setErr(err.message); }
  $('go').disabled = false; $('status').textContent = '';
}
$('go').addEventListener('click', onGenerate);

/* ---------- Render ---------- */
const GROUPS = ['WAN', 'Security', 'LAN', 'WiFi', 'Camera', 'IoT', 'Secure Access'];
function bomTable(lines, kind, derive) {
  const L = lines.filter((l) => l.kind === kind); if (!L.length) return '';
  const head = kind === 'capex' ? '<th>SKU</th><th>Description</th><th>Qty</th><th class="num">Unit</th><th class="num">Total</th>' : '<th>SKU</th><th>Description</th><th>Qty</th><th class="num">1Y</th><th class="num">3Y</th><th class="num">5Y</th>';
  let rows = '';
  for (const g of GROUPS) for (const l of L.filter((x) => x.group === g)) {
    if (kind === 'capex') rows += `<tr><td>${C.esc(l.sku)}</td><td>${C.esc(l.desc)}</td><td>${l.qty}</td><td class="num">${money(l.unit)}</td><td class="num">${money(l.unit * l.qty)}</td></tr>`;
    else rows += `<tr><td>${C.esc(l.sku)}</td><td>${C.esc(l.desc)}</td><td>${l.qty}</td>` + [1, 3, 5].map((t) => { const r = C.termPrice(l, t, derive); return `<td class="num">${r.price == null ? 'n/a' : money(r.price * l.qty) + (r.derived ? '*' : '')}</td>`; }).join('') + '</tr>';
  }
  return `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function render(d) {
  const { agg, totals: t } = d; const r = $('report'); r.hidden = false;
  let h = `<div class="card"><h2>${C.esc(d.customer)} — Secure Branch design</h2>`;
  if (d.narr || d.narrative) h += `<div class="prose">${safeHtml(d.narrative.executive_summary)}</div>`;
  else if (d.narrErr) h += `<p class="warn">Narrative unavailable: ${C.esc(d.narrErr)}. The BoM below is unaffected.</p>`;
  if (agg.gaps.length) h += `<div class="flag"><b>${agg.gaps.length} requirement(s) have no matching SKU in the price book and are excluded from totals.</b><ul>${agg.gaps.map((g) => `<li>${C.esc(g.site)} — ${C.esc(g.requirement)} × ${g.qty}</li>`).join('')}</ul>Add the SKUs to the price book or adjust manually.</div>`;
  if (d.svcNote) h += `<div class="flag">${C.esc(d.svcNote)}</div>`;
  if (d.sa && d.saUsers > 0 && !agg.lines.some((l) => l.group === 'Secure Access')) h += `<div class="flag">No Secure Access lines were priced.</div>`;
  h += `<div class="kpis"><div class="kpi"><b>${money(t.capex)}</b><span>Hardware CapEx</span></div><div class="kpi"><b>${money(t.opex[1])}</b><span>Licences 1Y</span></div><div class="kpi"><b>${money(t.opex[3])}</b><span>Licences 3Y</span></div><div class="kpi"><b>${money(t.opex[5])}</b><span>Licences 5Y</span></div></div></div>`;
  h += `<div class="card"><h2>Architecture</h2><div class="tools"><button class="btn" data-z="in" type="button">＋</button><button class="btn" data-z="out" type="button">－</button><button class="btn" data-z="reset" type="button">Reset</button><button class="btn" data-z="svg" type="button">Download SVG</button></div><div class="diagram" id="dia"><div class="stage" id="stage"></div></div><p class="muted">Drag to pan. Use ＋/－ to zoom.</p></div>`;
  if (d.narrative) {
    const names = { wan: 'WAN / SD-WAN', security: 'Security', lan: 'LAN', wifi: 'WiFi', camera: 'Cameras', iot: 'IoT', risks: 'Risks & assumptions' };
    h += '<div class="card"><h2>Design by pillar</h2>' + Object.keys(names).filter((k) => d.narrative[k]).map((k) => `<h3>${names[k]}</h3><div class="prose">${safeHtml(d.narrative[k])}</div>`).join('') + '</div>';
  }
  h += `<div class="card"><h2>Bill of materials</h2><h3>Hardware (one-time)</h3>${bomTable(agg.lines, 'capex', d.derive)}<p><b>Total hardware: ${money(t.capex)}</b></p><h3>Subscriptions (contract term totals)</h3>${bomTable(agg.lines, 'opex', d.derive)}<p><b>Total licences:</b> 1Y ${money(t.opex[1])} · 3Y ${money(t.opex[3])} · 5Y ${money(t.opex[5])}</p>${d.derive ? '<p class="warn">* Estimated: derived from the 1Y price using the configured discount. Not a price-book value.</p>' : ''}`;
  h += `<h3>Total cost of ownership</h3><div class="tablewrap"><table><thead><tr><th>Term</th><th class="num">Hardware</th><th class="num">Licences</th><th class="num">Service + WAN</th><th class="num">TCO</th><th class="num">Saving vs 1Y renewals</th></tr></thead><tbody>` +
    [1, 3, 5].map((y) => `<tr><td>${y}Y</td><td class="num">${money(t.capex)}</td><td class="num">${money(t.opex[y])}</td><td class="num">${money((t.serviceAnnual + t.wanAnnual) * y)}</td><td class="num"><b>${money(t.tco[y])}</b></td><td class="num">${y === 1 ? '—' : money(t.savings[y])}</td></tr>`).join('') + `</tbody></table></div>`;
  h += `<p><button id="csv" class="btn" type="button">Export BoM (CSV)</button> <button id="print" class="btn" type="button">Print / PDF</button></p></div>`;
  r.innerHTML = h;
  $('csv').onclick = exportCsv; $('print').onclick = () => window.print();
  await drawDiagram(d);
  r.scrollIntoView({ behavior: 'smooth' });
}

/* ---------- Diagram (deterministic, built from the sites) ---------- */
const id = (s, i) => 'N' + i;
const lbl = (s) => String(s).replace(/["\[\]{}()<>#&;|`\\]/g, ' ').slice(0, 40);
async function drawDiagram(d) {
  let src = 'flowchart TB\n  DASH["Meraki Dashboard (cloud)"]\n'; let n = 0;
  if (d.sa) src += '  SA["Cisco Secure Access (SSE)"]\n  USR["Remote users"] --> SA\n';
  src += '  INET(("Internet"))\n';
  S.sites.forEach((s, i) => {
    if (/cloud/i.test(s.type)) { src += `  C${i}["${lbl(s.name)}"]\n  INET --- C${i}\n`; return; }
    const c = C.autoCounts(s);
    src += `  subgraph G${i}["${lbl(s.name)} - ${lbl(s.type)}"]\n    M${i}["MX${s.ha ? ' HA pair' : ''}"]\n`;
    if (c.switches) src += `    W${i}["${c.switches} x MS switch"]\n    M${i} --- W${i}\n`;
    if (c.aps) src += `    A${i}["${c.aps} x MR AP"]\n    ${c.switches ? 'W' : 'M'}${i} --- A${i}\n`;
    if (s.cameras) src += `    V${i}["${s.cameras} x MV camera"]\n    ${c.switches ? 'W' : 'M'}${i} --- V${i}\n`;
    if (s.sensors) src += `    T${i}["${s.sensors} x MT sensor"]\n    ${c.switches ? 'W' : 'M'}${i} --- T${i}\n`;
    src += `  end\n  M${i} ---|"${lbl(s.bwMbps)} Mbps"| INET\n  M${i} -.-> DASH\n`;
  });
  if (d.sa) src += '  INET --- SA\n';
  const stage = $('stage');
  try {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { useMaxWidth: false } });
    const { svg } = await window.mermaid.render('mmd' + Date.now(), src);
    stage.innerHTML = window.DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['foreignObject'] });
  } catch (e) { stage.textContent = 'Diagram could not be rendered.'; }
  initPan();
}
const P = { x: 0, y: 0, k: 1, drag: null };
function applyT() { $('stage').style.transform = `translate(${P.x}px,${P.y}px) scale(${P.k})`; }
function initPan() {
  P.x = 0; P.y = 0; P.k = 1; applyT();
  const dia = $('dia');
  dia.addEventListener('pointerdown', (e) => { P.drag = { x: e.clientX - P.x, y: e.clientY - P.y }; dia.classList.add('drag'); dia.setPointerCapture(e.pointerId); });
  dia.addEventListener('pointermove', (e) => { if (!P.drag) return; P.x = e.clientX - P.drag.x; P.y = e.clientY - P.drag.y; applyT(); });
  const end = () => { P.drag = null; dia.classList.remove('drag'); };
  dia.addEventListener('pointerup', end); dia.addEventListener('pointercancel', end);
}
document.addEventListener('click', (e) => {
  const z = e.target.dataset && e.target.dataset.z; if (!z) return;
  if (z === 'in') P.k = Math.min(4, P.k * 1.25); else if (z === 'out') P.k = Math.max(0.2, P.k / 1.25); else if (z === 'reset') { P.x = 0; P.y = 0; P.k = 1; }
  else if (z === 'svg') { const svg = $('stage').querySelector('svg'); if (!svg) return; const c = svg.cloneNode(true); const b = new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }); dl(b, 'architecture.svg'); return; }
  applyT();
});
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function exportCsv() { if (S.lastBom) dl(new Blob([C.bomToCsv(S.lastBom.agg.lines, S.lastBom.derive)], { type: 'text/csv' }), 'bom.csv'); }

/* ---------- Init ---------- */
$('lockForm').addEventListener('submit', (e) => { e.preventDefault(); unlock($('lockInput').value.trim()); });
$('lockBtn').addEventListener('click', () => { setCode(''); showLock(''); });
$('fx').addEventListener('change', () => { if (S.lastRender) { S.cur = $('cur').value; S.fx = C.num($('fx').value, 1) || 1; render(S.lastRender); } });
$('cur').addEventListener('change', () => $('fx').dispatchEvent(new Event('change')));
if (getCode()) unlock(getCode()); else showLock('');
S.sites = [{ name: 'HQ', type: 'HQ', users: 120, bwMbps: 500, wiredPorts: 48, cameras: 8, sensors: 4, ha: true }, { name: 'Branch 1', type: 'Branch', users: 30, bwMbps: 100, wiredPorts: 12, cameras: 2, sensors: 2, ha: false }];
renderSites();
})();
