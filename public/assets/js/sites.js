/* Cisco Secure Branch Architect - sites table: compact rows, expandable detail, filters, bulk edit */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = C.esc;
const TCLS = { HQ: 'hq', DC: 'dc', Branch: 'br' }, SITE_TYPES = ['Branch', 'HQ', 'DC'], WAN_TYPES = ['MPLS', 'DIA', 'Broadband', '5G/LTE'];
S.open = new Set(); S.sel = new Set(); S.filter = 'all'; S.q = '';

const num = (n) => Number(n || 0).toLocaleString('en-GB');
const autoOf = (s) => C.sizeSite({ ...s, mxOverride: '', apModel: '', swModel: '', camModel: '', sensorModel: '', lanRes: '' });
const bad = (m) => (S.pb && m && !C.findHardware(S.pb, m) ? ' <span class="err" title="Not in the uploaded price book">✖</span>' : '');
const hubsOf = () => S.sites.filter((h) => !C.isCloudSite(h.type) && C.isHub(h.type));
function modelOpts(kind, cur, autoLabel) {
  return `<option value="">${esc(autoLabel)}</option>` + C.MODELS[kind].map((g) => `<optgroup label="${esc(g.group)}">${g.ids.map((m) => `<option${m === cur ? ' selected' : ''}>${esc(m)}</option>`).join('')}</optgroup>`).join('');
}
const RES_OPTS = (cur, autoLbl) => [['', autoLbl], ['none', 'None'], ['stack', 'N+1 stack'], ['pair', 'Redundant pair']].map(([v, l]) => `<option value="${v}"${(cur || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
const hubOpts = (cur, autoLbl) => `<option value="">${esc(autoLbl)}</option>` + hubsOf().map((h) => `<option value="${esc(h.id)}"${cur === h.id ? ' selected' : ''}>${esc(C.siteName(h))} (${esc(h.type)})</option>`).join('');

/* ----- derived cells ----- */
function designHtml(s) {
  if (C.isCloudSite(s.type)) return '<span class="muted">–</span>';
  const z = C.sizeSite(s), p = [];
  p.push(`<b>${s.ha ? 2 : 1}×${esc(z.mx || '?')}</b>${bad(z.mx)}`);
  if (z.switches) p.push(`${z.switches}×${esc(z.swModel)}${bad(z.swModel)}${z.res !== 'none' ? `<i>${z.res === 'pair' ? ' pair' : ' N+1'}</i>` : ''}${z.coreQty ? ` + ${z.coreQty}×${esc(z.coreModel)}${bad(z.coreModel)}` : ''}`);
  if (z.aps) p.push(`${z.aps}×${esc(z.apModel)}${bad(z.apModel)}`);
  if (z.cameras) p.push(`${z.cameras}×${esc(z.camModel)}${bad(z.camModel)}`);
  if (z.sensors) p.push(`${z.sensors}×${esc(z.sensorModel)}${bad(z.sensorModel)}`);
  return p.join(' <span class="dsep">·</span> ');
}
const statHtml = (s) => { const n = C.siteNotes(s); return n.length ? `<span class="warnb" title="${esc(n.join('\n'))}">⚠ ${n.length}</span>` : '<span class="okb">✔</span>'; };
function wanHtml(s) {
  const bw = C.siteBw(s), z = C.isCloudSite(s.type) ? null : C.sizeSite(s);
  return `${s.wan.map((l) => `${esc(l.type)} ${num(l.mbps)}`).join(' + ')} <span class="muted">= ${num(bw)} Mbps</span>${z && C.isHub(s.type) && z.effBw > z.bw ? `<br><span class="hubtag">hub load ${num(z.effBw)} Mbps · ${z.branches} branches</span>` : ''}${!C.isHub(s.type) && s._hubName ? `<br><span class="hubtag">→ ${esc(s._hubName)}</span>` : ''}`;
}
const chip = (k, label, on, n) => `<label class="chip${on ? ' on' : ''}"><input type="checkbox" data-k="${k}"${on ? ' checked' : ''}>${label}${on && n ? ` <b>${n}</b>` : ''}</label>`;
const chipsHtml = (s) => chip('switching', 'LAN', s.switching) + chip('wifi', 'WiFi', s.wifi) + chip('camera', 'Cam', s.camera, s.cameras) + chip('iot', 'IoT', s.iot, s.sensors);

function drawerHtml(s) {
  if (C.isCloudSite(s.type)) return '<div class="muted">Cloud site: no on-premise equipment.</div>';
  const a = autoOf(s), f = (lbl, kind, key, auto) => `<label class="df"><span>${lbl}</span><select data-k="${key}">${modelOpts(kind, s[key] || '', 'Auto · ' + auto)}</select></label>`;
  const hub = C.isHub(s.type)
    ? `<div class="hubinfo">Serves <b>${a.branches}</b> branch(es) · aggregate load <b>${num(a.aggBw)}</b> Mbps${a.effBw > a.bw ? ` → MX sized for <b>${num(a.effBw)}</b> Mbps` : ''}</div>`
    : `<label class="df"><span>Homed to hub</span><select data-k="homeTo">${hubOpts(s.homeTo, 'Auto' + (s.homeTo ? '' : s._hubName ? ' · ' + s._hubName : ''))}</select></label>`;
  return `<div class="drawer">
    <div class="dsec"><h5>WAN links</h5>${s.wan.map((l, j) => `<div class="wanrow"><select data-k="wantype" data-l="${j}">${WAN_TYPES.map((t) => `<option${t === l.type ? ' selected' : ''}>${t}</option>`).join('')}</select><input type="number" min="0" data-k="wanmbps" data-l="${j}" value="${esc(l.mbps)}"><span class="tiny muted">Mbps</span>${s.wan.length > 1 ? `<button class="x" type="button" data-act="rmwan" data-l="${j}" title="Remove link">✕</button>` : ''}</div>`).join('')}<button class="linkbtn" type="button" data-act="addwan">+ Add link</button></div>
    <div class="dsec"><h5>Quantities</h5>${s.camera ? `<label class="df"><span>Cameras</span><input type="number" min="0" data-k="cameras" value="${esc(s.cameras)}"></label>` : ''}${s.iot ? `<label class="df"><span>IoT sensors</span><input type="number" min="0" data-k="sensors" value="${esc(s.sensors)}"></label>` : ''}${!s.camera && !s.iot ? '<span class="tiny muted">Tick Cam / IoT on the row to set counts.</span>' : ''}</div>
    <div class="dsec dwide"><h5>Equipment <span class="tiny muted" style="text-transform:none;font-weight:400">(Auto = chosen by the sizing rules; pick a model to override)</span></h5><div class="dgrid">${f('Firewall (MX)', 'mx', 'mxOverride', a.mx)}${s.switching ? f('Switch', 'sw', 'swModel', a.swModel) : ''}${s.wifi ? f('Access point', 'ap', 'apModel', a.apModel) : ''}${s.camera ? f('Camera', 'cam', 'camModel', a.camModel) : ''}${s.iot ? f('Sensor', 'sensor', 'sensorModel', a.sensorModel) : ''}</div></div>
    ${s.switching ? `<div class="dsec"><h5>LAN design</h5><label class="df"><span>Resilience</span><select data-k="lanRes">${RES_OPTS(s.lanRes, 'Auto · ' + C.RES_LABEL[a.res])}</select></label><label class="df"><span>Wired ports</span><input type="number" min="0" data-k="wiredPorts" value="${s.wiredPorts ? esc(s.wiredPorts) : ''}" placeholder="auto · ${a.ports}"></label></div>` : ''}
    <div class="dsec">${hub}</div></div>`;
}

const attention = (s) => !C.isCloudSite(s.type) && C.siteNotes(s).length > 0;
const matches = (s) => (S.filter === 'all' || (S.filter === 'attention' ? attention(s) : s.type === S.filter)) && (!S.q || (`${s.city} ${s.country}`).toLowerCase().includes(S.q));

function rowHtml(s, i, vis) {
  const open = S.open.has(s.id);
  return `<tr class="srow${vis ? '' : ' hid'}${open ? ' isopen' : ''}" data-i="${i}">
    <td class="selc"><input type="checkbox" data-sel="1"${S.sel.has(s.id) ? ' checked' : ''} aria-label="Select site"><button class="xbtn tgl" type="button" data-act="toggle" aria-expanded="${open}" title="${open ? 'Hide' : 'Show'} WAN, equipment and LAN details">${open ? '▾' : '▸'} Edit</button></td>
    <td><select data-k="type" class="typesel ${TCLS[s.type] || 'br'}">${SITE_TYPES.map((t) => `<option${t === s.type ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input data-k="country" value="${esc(s.country)}" class="w80"></td>
    <td><input data-k="city" value="${esc(s.city)}" class="w120"></td>
    <td><input data-k="users" type="number" min="0" class="w64" value="${esc(s.users)}"></td>
    <td class="wansum">${wanHtml(s)}</td>
    <td class="center"><input type="checkbox" data-k="ha"${s.ha ? ' checked' : ''} title="High-availability MX pair"></td>
    <td class="chips2">${chipsHtml(s)}</td>
    <td class="sum">${designHtml(s)}</td>
    <td class="stat center">${statHtml(s)}</td>
    <td class="acts"><button class="x" type="button" data-act="del" title="Remove site">✕</button></td></tr>`
    + (open ? `<tr class="sdet${vis ? '' : ' hid'}" data-i="${i}"><td colspan="11">${drawerHtml(s)}</td></tr>` : '');
}

/* ----- summary, filters, bulk bar ----- */
function renderSummary() {
  const live = S.sites, n = (t) => live.filter((s) => s.type === t).length, att = live.filter(attention).length, users = live.reduce((a, s) => a + C.num(s.users), 0);
  const pill = (f, label, c) => `<button type="button" class="fpill${S.filter === f ? ' on' : ''}" data-f="${f}">${label} <b>${c}</b></button>`;
  $('siteSummary').innerHTML = `<div class="sumline"><span><b>${live.length}</b> sites</span><span><b>${num(users)}</b> site users</span><span><b>${hubsOf().length}</b> hubs</span>${att ? `<span class="warnb">⚠ ${att} need attention</span>` : live.length ? '<span class="okb">✔ no warnings</span>' : ''}</div>
    <div class="fbar">${pill('all', 'All', live.length)}${pill('DC', 'DC', n('DC'))}${pill('HQ', 'HQ', n('HQ'))}${pill('Branch', 'Branch', n('Branch'))}${att ? pill('attention', '⚠ Attention', att) : ''}<input id="siteSearch" type="search" placeholder="Search city or country" value="${esc(S.q)}"></div>`;
  const si = $('siteSearch'); si.addEventListener('input', () => { S.q = si.value.trim().toLowerCase(); App.renderSites(true); });
}
const BULK = [['swModel', 'Switch model', 'sw'], ['apModel', 'AP model', 'ap'], ['camModel', 'Camera model', 'cam'], ['sensorModel', 'Sensor model', 'sensor'], ['mxOverride', 'MX model', 'mx'], ['lanRes', 'LAN resilience', 'res'], ['homeTo', 'Homed to hub', 'hub'], ['type', 'Site type', 'type'], ['ha', 'HA pair', 'ha']];
function bulkValues() {
  const f = BULK.find((b) => b[0] === $('bulkField').value) || BULK[0], k = f[2];
  $('bulkValue').innerHTML = k === 'res' ? RES_OPTS('', 'Auto') : k === 'hub' ? hubOpts('', 'Auto') : k === 'type' ? SITE_TYPES.map((t) => `<option>${t}</option>`).join('') : k === 'ha' ? '<option value="yes">Yes</option><option value="no">No</option>' : modelOpts(k, '', 'Auto (by rules)');
}
function renderBulk() {
  const bar = $('bulkBar'), n = S.sel.size; bar.hidden = !n; $('bulkCount').textContent = `${n} selected`;
  const all = $('selAll'); const vis = S.sites.filter(matches); all.checked = vis.length > 0 && vis.every((s) => S.sel.has(s.id)); all.indeterminate = !all.checked && vis.some((s) => S.sel.has(s.id));
}
App.renderSites = function (keepFocus) {
  C.annotate(S.sites);
  const ids = new Set(S.sites.map((s) => s.id)); [...S.sel].forEach((id) => { if (!ids.has(id)) S.sel.delete(id); });
  $('siteTable').tBodies[0].innerHTML = S.sites.map((s, i) => rowHtml(s, i, matches(s))).join('') || '<tr><td colspan="11" class="center muted" style="padding:22px">No sites yet. Add a site, import a CSV, or scan a diagram.</td></tr>';
  if (!keepFocus) renderSummary();
  renderBulk(); bulkValues();
};
App.siteWarn = function () {};

/* light refresh after an edit: update derived cells, leave inputs alone */
function refresh(trEl, forceOwn) {
  C.annotate(S.sites);
  [...$('siteTable').tBodies[0].rows].forEach((row) => {
    const s = S.sites[+row.dataset.i]; if (!s) return;
    if (row.classList.contains('srow')) {
      row.querySelector('.sum').innerHTML = designHtml(s); row.querySelector('.stat').innerHTML = statHtml(s); row.querySelector('.wansum').innerHTML = wanHtml(s);
      const ch = row.querySelector('.chips2'); if (!ch.contains(document.activeElement)) ch.innerHTML = chipsHtml(s);
    } else if (row.classList.contains('sdet')) {
      const td = row.firstElementChild; if (!td.contains(document.activeElement) || (forceOwn && row === trEl)) td.innerHTML = drawerHtml(s);
    }
  });
  renderSummaryInline();
}
function renderSummaryInline() { const f = document.activeElement && document.activeElement.id === 'siteSearch'; if (!f) renderSummary(); }

App.siteEvent = function (e) {
  const t = e.target, tr = t.closest('tr'); if (!tr || !tr.dataset.i) return; const s = S.sites[+tr.dataset.i]; if (!s) return;
  const act = t.closest('[data-act]') ? t.closest('[data-act]').dataset.act : '';
  if (e.type === 'click') {
    if (act === 'del') { S.sites.splice(+tr.dataset.i, 1); S.sel.delete(s.id); App.renderSites(); }
    else if (act === 'toggle') { S.open.has(s.id) ? S.open.delete(s.id) : S.open.add(s.id); App.renderSites(); }
    else if (act === 'addwan') { s.wan.push({ type: 'DIA', mbps: 100 }); App.renderSites(); }
    else if (act === 'rmwan') { s.wan.splice(+t.dataset.l, 1); App.renderSites(); }
    return;
  }
  if (t.dataset.sel) { if (e.type === 'change') { t.checked ? S.sel.add(s.id) : S.sel.delete(s.id); renderBulk(); } return; }
  const k = t.dataset.k; if (!k) return;
  if (k === 'wantype') s.wan[+t.dataset.l].type = t.value;
  else if (k === 'wanmbps') s.wan[+t.dataset.l].mbps = C.num(t.value);
  else if (t.type === 'checkbox') {
    s[k] = t.checked;
    if (e.type === 'change') {
      if (t.checked && (k === 'camera' || k === 'iot')) { const f = k === 'camera' ? 'cameras' : 'sensors'; if (!s[f]) s[f] = C.suggestCounts(s)[f]; }
      if (['camera', 'iot', 'switching', 'wifi'].includes(k)) { App.renderSites(); return; }
    }
  } else if (t.type === 'number') s[k] = C.num(t.value);
  else s[k] = t.value;
  if (k === 'type') { t.className = 'typesel ' + (TCLS[t.value] || 'br'); }
  const structural = e.type === 'change' && ['type', 'homeTo'].includes(k);
  if (structural) { App.renderSites(); return; }
  refresh(tr, e.type === 'change' && ['wiredPorts', 'lanRes'].includes(k));
};

App.bindSiteTools = function () {
  const tb = $('siteTable').tBodies[0];
  ['input', 'change', 'click'].forEach((ev) => tb.addEventListener(ev, App.siteEvent));
  $('selAll').addEventListener('change', (e) => { S.sites.filter(matches).forEach((s) => (e.target.checked ? S.sel.add(s.id) : S.sel.delete(s.id))); App.renderSites(); });
  $('siteSummary').addEventListener('click', (e) => { const b = e.target.closest('.fpill'); if (!b) return; S.filter = b.dataset.f; App.renderSites(); });
  $('bulkField').innerHTML = BULK.map((b) => `<option value="${b[0]}">${b[1]}</option>`).join(''); $('bulkField').addEventListener('change', bulkValues);
  $('bulkApply').addEventListener('click', () => {
    const key = $('bulkField').value, v = $('bulkValue').value; let n = 0;
    S.sites.filter((s) => S.sel.has(s.id)).forEach((s) => { if (key === 'ha') s.ha = v === 'yes'; else if (key === 'homeTo' && C.isHub(s.type)) return; else s[key] = v; n++; });
    $('bulkNote').textContent = `Updated ${n} site(s).`; App.renderSites();
  });
  $('bulkDel').addEventListener('click', () => { S.sites = S.sites.filter((s) => !S.sel.has(s.id)); S.sel.clear(); App.renderSites(); });
  $('bulkClear').addEventListener('click', () => { S.sel.clear(); App.renderSites(); });
};
})();
