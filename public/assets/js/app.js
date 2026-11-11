/* Sentinel Architect - app core: state, API, helpers, live estimate */
(function () {
'use strict';
const C = window.SCore, $ = (id) => document.getElementById(id);
const App = window.App = { C, $, S: { st: null, mode: 'internal', view: 'all', step: 1, res: null, ai: null, touched: false, aiOk: true, usage: null } };
const S = App.S, esc = C.esc;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Access + API (same gate as the other tools) ---------- */
const KEY = 'sa_code';
const getCode = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const setCode = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
App.getCode = getCode; App.setCode = setCode;
App.showLock = (msg) => { $('lock').hidden = false; $('lockErr').hidden = !msg; $('lockErr').textContent = msg || ''; $('lockInput').focus(); };
async function api(payload) {
  let last;
  for (let i = 0; i < 3; i++) {
    let res;
    try { res = await fetch('/.netlify/functions/gemini-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-access-code': getCode() }, body: JSON.stringify(payload) }); }
    catch (e) { last = new Error('Network error'); await sleep(1200 * (i + 1)); continue; }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { /* ignore */ }
    if (res.status === 401) { setCode(''); App.showLock('Access code rejected'); throw new Error('Access code required'); }
    if (res.ok) return j;
    const msg = (j && j.error && (j.error.message || j.error)) || 'HTTP ' + res.status; last = new Error('[HTTP ' + res.status + '] ' + msg);
    if ([429, 502, 503, 504].includes(res.status) && !(res.status === 504 && i >= 1)) { await sleep(1500 * (i + 1)); continue; }
    throw last;
  }
  throw last || new Error('Request failed');
}
async function generate(prompt, o) {
  o = o || {}; const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: o.temp == null ? 0.3 : o.temp, maxOutputTokens: o.max || 4096, thinkingConfig: { thinkingBudget: 0 } } };
  body.generationConfig.responseMimeType = 'application/json';
  const r = await api({ endpoint: 'generate', model: $('modelSelector').value, body }), c = r.candidates && r.candidates[0];
  if (!c) throw new Error('Empty AI response'); if (c.finishReason === 'MAX_TOKENS') throw new Error('AI response was cut off; try again'); if (c.finishReason === 'SAFETY') throw new Error('Blocked by safety filter');
  return (c.content.parts || []).map((p) => p.text || '').join('');
}
function extractJSON(t) {
  t = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); try { return JSON.parse(t); } catch (e) { /* fall through */ }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']')); if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); throw new Error('AI returned invalid JSON');
}
App.loadModels = async function () {
  const sel = $('modelSelector');
  try {
    const r = await api({ endpoint: 'models' }), ms = (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-(flash|pro)(-lite)?$/.test(n));
    sel.innerHTML = ''; (ms.length ? ms : ['gemini-2.5-flash']).forEach((n) => sel.add(new Option(n, n))); const pref = [...sel.options].find((o) => o.value === 'gemini-2.5-flash'); if (pref) sel.value = pref.value; sel.disabled = false; S.aiOk = true;
  } catch (e) { sel.innerHTML = ''; sel.add(new Option('gemini-2.5-flash', 'gemini-2.5-flash')); sel.disabled = false; }
};
const safeHtml = (md) => window.DOMPurify.sanitize(window.marked.parse(String(md == null ? '' : md), { breaks: true }));
const fx = () => (S.st && S.st.cur === 'USD' ? C.num(S.st.fx) || 1.27 : 1);
const money = (v, dp) => { if (v == null || !isFinite(v)) return '–'; const cur = S.st && S.st.cur === 'USD' ? 'USD' : 'GBP'; return new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'en-GB', { style: 'currency', currency: cur, maximumFractionDigits: dp || 0, minimumFractionDigits: dp || 0 }).format(v * fx()); };
const moneyK = (v) => { if (!isFinite(v)) return '–'; const x = v * fx(), sym = S.st.cur === 'USD' ? '$' : '£'; return x >= 1e6 ? sym + (x / 1e6).toFixed(2) + 'M' : x >= 10000 ? sym + Math.round(x / 1000) + 'k' : x >= 1000 ? sym + (x / 1000).toFixed(1) + 'k' : sym + Math.round(x); };
const gb = (v) => (v >= 100 ? Math.round(v).toLocaleString('en-GB') : v >= 10 ? v.toFixed(1) : v.toFixed(2));
const fmt = (v, d) => (isFinite(v) ? Number(v).toLocaleString('en-GB', { maximumFractionDigits: d == null ? 0 : d }) : '–');
const setErr = (m) => { $('error').hidden = !m; $('error').textContent = m || ''; };
const hint = (t) => '<button class="hint" type="button" data-hint aria-label="What does this mean?">i</button><span class="hinttext" hidden>' + esc(t) + '</span>';
const bdg = (k) => ({ ai: '<span class="pill ai" title="Written by AI from the computed numbers">✨ AI-written</span>', rl: '<span class="pill rl" title="Calculated by the tool from your inputs and the rate card">⚙ Calculated</span>', mx: '<span class="pill mx" title="Microsoft publishes this figure">Microsoft figure</span>' }[k] || '');
Object.assign(App, { api, generate, extractJSON, safeHtml, money, moneyK, gb, fmt, setErr, hint, bdg, esc, sleep });

/* ---------- state ---------- */
App.newScenario = function (vk, seats, started) { S.st = C.defaultState(vk || 'financial', seats || 1000); S.st.chosen = { vertical: !!started, seats: !!started }; if (!started) S.st.m365 = 'none'; S.touched = false; S.ai = null; S.usage = null; };
App.ready = () => !!(S.st && S.st.chosen && S.st.chosen.vertical && S.st.chosen.seats && C.num(S.st.drivers.seats) >= 10);
App.dl = function (blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((x, k) => x[k], o); t[last] = v; };
App.getPath = getPath; App.setPath = setPath;

/* ---------- recompute + live bar ---------- */
let timer = 0;
App.recompute = function () { try { S.res = C.compute(S.st); } catch (e) { setErr('Calculation error: ' + e.message); return; } App.updateLive(); if (App.onRecompute) App.onRecompute(); };
App.refresh = function () { clearTimeout(timer); timer = setTimeout(App.recompute, 90); };
App.updateLive = function () {
  const r = S.res, st = S.st; if (!r) return; const sv = r.soc;
  if (!App.ready()) { ['lvGb', 'lvCost', 'lvTier', 'lvSvc'].forEach((i) => { $(i).textContent = '–'; $(i + 'R').textContent = ''; }); $('lvGbR').textContent = 'choose an industry and size to start'; $('lvFlag').textContent = 'Not started'; $('lvFlag').className = 'flagpill'; return; }
  $('lvGb').textContent = gb(r.sum.total) + ' GB/day'; $('lvGbR').textContent = 'likely ' + gb(r.mc.tot.p10) + ' to ' + gb(r.mc.tot.p90);
  $('lvCost').textContent = money(r.msMonthly); $('lvCostR').textContent = 'likely ' + moneyK(r.quote.ms.p10) + ' to ' + moneyK(r.quote.ms.p90);
  const qt = r.quote.tier; $('lvTier').textContent = qt.id === 'payg' ? 'Pay-as-you-go' : qt.label; $('lvTierR').textContent = qt.id === 'payg' ? 'no commitment' : 'billable ' + gb(r.sum.analyticsBillable) + ' GB/day';
  $('lvSvc').textContent = money(sv.fee); $('lvSvcR').textContent = (sv.cov.label || '') + ' · ' + sv.tier.label.split(':')[0] + ' · ' + r.quote.svc.label;
  const fl = $('lvFlag'); const real = st.rateSource === 'csv'; fl.textContent = real ? 'Indicative · your rate card' : 'Indicative · placeholder rates'; fl.className = 'flagpill' + (real ? ' good' : '');
};
App.setMode = function (m) {
  S.mode = m; document.body.classList.toggle('cust', m === 'customer'); $('btnMode').textContent = m === 'customer' ? '👁 Customer view' : '🔧 Internal view'; $('btnMode').classList.toggle('on', m === 'customer'); $('modeBanner').hidden = m !== 'customer';
  document.querySelectorAll('.int').forEach((e) => { e.hidden = m === 'customer'; });
  const nh = document.querySelector('.nav').offsetHeight; document.documentElement.style.setProperty('--navh', nh + 'px');
  if (S.step === 5 && App.renderResults) App.renderResults(); if ([3, 4].includes(S.step)) App.renderStep(S.step);
};
})();
