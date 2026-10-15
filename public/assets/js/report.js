/* Report rendering, TCO recalculation, exports */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = App.esc, money = App.money;
const GROUP_ORDER = ['WAN', 'Security', 'LAN', 'WiFi', 'Camera', 'IoT', 'Secure Access'];
const GROUP_LABEL = { WAN: 'WAN / SD-WAN (MX)', Security: 'Security licences (MX)', LAN: 'LAN switching (MS)', WiFi: 'WiFi (MR)', Camera: 'Cameras (MV)', IoT: 'IoT sensors (MT)', 'Secure Access': 'Secure Access / Secure Connect (SSE)' };
S.disc = { c: 0, o: 0 };

function bomHtml(lines, derive) {
  const capex = lines.filter((l) => l.kind === 'capex'), opex = lines.filter((l) => l.kind === 'opex');
  const grouped = (arr, row, cols) => GROUP_ORDER.map((g) => { const L = arr.filter((l) => l.group === g); return L.length ? `<tr class="grp"><td colspan="${cols}">${esc(GROUP_LABEL[g])}</td></tr>` + L.map(row).join('') : ''; }).join('');
  const note = (l) => l.note ? `<div class="tiny muted">${esc(l.note)}</div>` : '';
  let h = '';
  if (capex.length) {
    const tot = capex.reduce((a, l) => a + l.unit * l.qty, 0);
    h += `<h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--s700);margin:0 0 8px">Hardware (CapEx - one time)</h4>
    <div class="tablewrap"><table class="bom" id="bomCapex"><thead><tr><th>SKU</th><th>Description</th><th class="c">Qty</th><th class="r">Unit price</th><th class="r">Total</th></tr></thead><tbody>
    ${grouped(capex, (l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.desc)}</td><td class="c">${l.qty}</td><td class="r">${money(l.unit)}</td><td class="r">${money(l.unit * l.qty)}</td></tr>`, 5)}
    </tbody><tfoot><tr><td colspan="4" class="r">Total product CapEx:</td><td class="r">${money(tot)}</td></tr></tfoot></table></div>`;
  }
  if (opex.length) {
    const cell = (l, t) => { const r = C.termPrice(l, t, derive); return `<td class="r">${r.price == null ? '<span class="muted">n/a</span>' : money(r.price * l.qty) + (r.derived ? '*' : '')}</td>`; };
    const sum = (t) => opex.reduce((a, l) => a + (C.termPrice(l, t, derive).price || 0) * l.qty, 0);
    h += `<h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--s700);margin:22px 0 8px">Subscriptions (OpEx - contract term totals, from price book)</h4>
    <div class="tablewrap"><table class="bom" id="bomOpex"><thead><tr><th>SKU</th><th>Description</th><th class="c">Qty</th><th class="r">1Y total</th><th class="r">3Y total</th><th class="r">5Y total</th></tr></thead><tbody>
    ${grouped(opex, (l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.desc)}${note(l)}</td><td class="c">${l.qty}</td>${cell(l, 1)}${cell(l, 3)}${cell(l, 5)}</tr>`, 6)}
    </tbody><tfoot><tr><td colspan="3" class="r">Total product OpEx:</td><td class="r">${money(sum(1))}</td><td class="r">${money(sum(3))}</td><td class="r">${money(sum(5))}</td></tr></tfoot></table></div>
    <p class="tiny muted" style="margin:4px 0 0">Each term total is read directly from the price book — not multiplied up from the 1Y price${derive ? ', except values marked * which are estimates derived from the 1Y price' : ''}. “n/a” means the price book has no price for that term.</p>`;
  }
  return h || '<p class="muted">No priced lines.</p>';
}

function sec(cls, title, bodyHtml, extra) { return bodyHtml ? `<section class="sec ${cls}"><h3><span>${title}</span></h3>${extra || ''}<div class="prose">${bodyHtml}</div></section>` : ''; }

App.renderReport = async function (d) {
  const r = $('reportSection'), t0 = C.computeTotals(d.agg.lines, { derive: d.derive, servicePct: d.servicePct, wanAnnual: d.wanAnnual });
  const n = d.narr || {}, md = App.safeHtml, today = d.ts.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const flags = [];
  if (d.agg.gaps.length) flags.push(`<div class="flag"><b>⚠ ${d.agg.gaps.length} requirement(s) have no matching SKU (or no price) in the uploaded price book and were excluded from totals.</b><ul>${d.agg.gaps.map((g) => `<li>${esc(g.site)} — ${esc(g.requirement)} × ${g.qty}</li>`).join('')}</ul>A solution architect should add the SKU(s) to the price book, adjust the sizing rules, or adjust the BoM manually.</div>`);
  if (d.svcNote) flags.push(`<div class="flag">⚠ ${esc(d.svcNote)}</div>`);
  if (d.narrErr) flags.push(`<div class="flag">Design narrative unavailable (${esc(d.narrErr)}). The sizing and BoM below are unaffected.</div>`);
  if (d.derive) flags.push(`<div class="flag">Some 3Y / 5Y values may be estimates (marked *) derived from the 1Y price. They are not price-book values.</div>`);
  const missing = [3, 5].filter((t) => !d.derive && t0.missing[t] > 0).map((t) => `${t}Y (${t0.missing[t]} line${t0.missing[t] > 1 ? 's' : ''})`);
  if (missing.length) flags.push(`<div class="flag">The price book has no price for some subscription lines at ${missing.join(' and ')}. Those lines show “n/a” and are not in that term's total.</div>`);

  const equip = d.meraki ? `<div class="tablewrap"><table class="bom"><thead><tr><th>Site</th><th>Type</th><th class="r">WAN</th><th>MX</th><th class="c">APs</th><th class="c">Switches</th><th class="c">Cameras</th><th class="c">Sensors</th><th class="c">HA</th></tr></thead><tbody>${d.sizing.map((z) => `<tr><td>${esc(z.site)}</td><td>${esc(z.type)}</td><td class="r">${esc(z.wan.join(' + '))}</td><td>${esc(z.mx)}</td><td class="c">${z.aps}</td><td class="c">${z.switches}</td><td class="c">${z.cameras}</td><td class="c">${z.sensors}</td><td class="c">${z.ha ? 'Y' : '–'}</td></tr>`).join('')}</tbody></table></div>` : '';
  const kpis = `<div class="kpis"><div class="kpi"><b>${d.meraki ? d.sizing.length : 0}</b><span>Meraki sites</span></div><div class="kpi"><b>${d.sse ? Number(d.users).toLocaleString('en-GB') : 0}</b><span>Secure Access users</span></div><div class="kpi"><b id="kCapex">${money(t0.capex)}</b><span>Hardware CapEx</span></div><div class="kpi"><b id="kOpex">${money(t0.opex[1])}</b><span>Licences (1Y)</span></div></div>`;
  const lbls = d.svcLabels, anyCommit = d.servicePct > 0 || d.wanAnnual > 0;
  const svcRows = `${lbls.tierPct > 0 ? `<tr><td>Service tier</td><td>${esc(lbls.tier)}</td><td class="c">${(lbls.tierPct * 100).toFixed(0)}% of 1Y OpEx</td><td class="r">${money(t0.opex[1] * lbls.tierPct)}</td></tr>` : ''}${lbls.rolePct > 0 ? `<tr><td>In-life support</td><td>${esc(lbls.role)}</td><td class="c">${(lbls.rolePct * 100).toFixed(0)}% of 1Y OpEx</td><td class="r">${money(t0.opex[1] * lbls.rolePct)}</td></tr>` : ''}${d.wanAnnual > 0 ? `<tr><td>Managed connectivity</td><td>Circuits (annual, as entered)</td><td class="c">fixed</td><td class="r">${money(d.wanAnnual)}</td></tr>` : ''}`;
  const svcSec = anyCommit ? `<section class="sec svcs"><h3><span>Managed services wrap</span></h3><div class="tablewrap"><table class="bom"><thead><tr><th>Component</th><th>Selection</th><th class="c">Basis</th><th class="r">Annual cost</th></tr></thead><tbody>${svcRows}</tbody><tfoot><tr><td colspan="3" class="r">Total service OpEx (annual):</td><td class="r">${money(t0.serviceAnnual + t0.wanAnnual)}</td></tr></tfoot></table></div></section>` : '';
  const sseBadges = d.sse ? `<p class="small" style="margin:0 0 10px"><b>Platform:</b> ${esc(d.sseCfg.platform)} · <b>Package:</b> ${esc(d.sseCfg.edition)} · <b>Modules:</b> ${esc(d.sseCfg.mods.join(', ') || 'core SSE')}</p>` : '';

  r.classList.remove('hidden'); r.hidden = false;
  r.innerHTML = `
  <div class="printcover" style="display:none"><div style="font-size:44px;font-weight:800;color:var(--s900);margin-bottom:10px">Secure Branch Architecture Design</div><div style="font-size:24px;color:var(--blue-d);margin-bottom:40px">Prepared for: ${esc(d.company)}</div><div class="muted">Generated by Cisco Secure Branch Architect · ${esc(today)}</div></div>
  <div class="rhead"><div><h1>Technical Architecture Report</h1><p>Prepared for: <b>${esc(d.company)}</b> · ${esc(today)}</p></div>
    <div class="row wrap noprint"><button class="btn" data-rep="csv" type="button">⬇ Export BoM (CSV)</button><button class="btn blue" data-rep="print" type="button">🖨 Print report (PDF)</button></div></div>
  <div class="rbody">
    <section><h3 class="t">Executive summary</h3>${kpis}<div class="prose" style="margin-top:12px">${n.executive_summary ? md(n.executive_summary) : ''}</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${flags.join('')}</div></section>
    <section><div class="row between wrap" style="border-bottom:1px solid var(--s200);padding-bottom:8px;margin-bottom:12px"><h3 style="font-size:18px">Architecture topology</h3>
      <div class="row wrap noprint"><button class="dbtn" data-dia="in" type="button">＋ Zoom in</button><button class="dbtn" data-dia="out" type="button">－ Zoom out</button><button class="dbtn" data-dia="fit" type="button">↺ Fit</button><button class="dbtn" data-dia="code" type="button">{ } Code</button><button class="dbtn" data-dia="svg" type="button">↓ SVG</button><button class="dbtn" data-dia="png" type="button">↓ PNG</button></div></div>
      <div class="dwrap" id="dwrap"><div class="dstage" id="dstage"></div></div>
      <div class="legend noprint"><b style="color:var(--s600)">Legend:</b>
        ${d.sse ? '<span class="lg"><span class="ld" style="background:#049fd9"></span>Secure Access (SSE)</span><span class="lg"><span class="ld" style="background:#3b82f6"></span>Remote users</span>' : ''}
        <span class="lg"><span class="ld" style="background:#e2e8f0;border:2px solid #334155"></span>DC / HQ hub</span><span class="lg"><span class="ld" style="background:#fff;border:2px solid #334155;border-radius:3px"></span>Branch</span>
        <span class="lg"><span class="ll" style="border-color:#064e3b"></span>MPLS</span><span class="lg"><span class="ll" style="border-color:#2563eb"></span>Internet / DIA</span><span class="lg"><span class="ll" style="border-color:#dc2626"></span>Broadband</span><span class="lg"><span class="ll" style="border-color:#dc2626;border-top-style:dashed"></span>5G / LTE</span>
        <span class="lg"><span class="ll" style="border-color:#94a3b8;border-top-style:dashed"></span>HA heartbeat</span><span class="lg"><span class="ll" style="border-color:#7c3aed;border-top-style:dashed"></span>AutoVPN overlay</span>${d.sse ? '<span class="lg"><span class="ll" style="border-color:#049fd9;border-top-style:dashed"></span>IPsec to SSE</span>' : ''}</div>
      <pre class="rawcode" id="rawCode"></pre></section>
    ${d.meraki ? `<section><h3 class="t">Site equipment summary</h3>${equip}</section>` : ''}
    ${d.meraki ? sec('wan', 'Section 1: WAN / SD-WAN &amp; security', md([n.wan, n.security].filter(Boolean).join('\n\n'))) : ''}
    ${d.meraki ? sec('lan', 'Section 2: Campus LAN &amp; WiFi', md([n.lan, n.wifi].filter(Boolean).join('\n\n'))) : ''}
    ${d.meraki ? sec('iot', 'Section 3: Camera &amp; IoT', md([n.camera, n.iot].filter(Boolean).join('\n\n'))) : ''}
    ${d.sse ? sec('sse', `Section ${d.meraki ? 4 : 1}: Secure Access (SSE) design`, md(n.sse || ''), sseBadges) : ''}
    ${sec('risk', 'Risks &amp; assumptions', md(n.risks || ''))}
    ${svcSec}
    <section class="pb"><h3 class="t">Bill of materials (BoM)</h3>${bomHtml(d.agg.lines, d.derive)}
      <div class="tco" style="margin-top:22px"><h4>Total cost of ownership (TCO) summary</h4>
        <div class="cols"><div><span class="lbl">Product OpEx (1Y term)</span><span class="val" id="sProd"></span></div><div><span class="lbl">Annual service OpEx</span><span class="val" id="sServ"></span></div><div style="grid-column:span 2;text-align:right"><span class="lbl">1-year grand total</span><span class="val big" id="sGrand"></span></div></div>
        <div class="disc"><p>⚡ TCO discount override <span style="color:#94a3b8;font-weight:400;text-transform:none">(applied to 1Y / 3Y / 5Y totals only — unit prices unchanged)</span></p>
          <div class="grid g2" style="gap:12px"><label class="dbox">🖥 Hardware (CapEx) discount <input type="number" id="discC" min="0" max="100" step="0.5" value="${S.disc.c}" style="margin-left:auto"> %</label><label class="dbox">📄 Licence (OpEx) discount <input type="number" id="discO" min="0" max="100" step="0.5" value="${S.disc.o}" style="margin-left:auto"> %</label></div></div>
        <div class="cols t"><div><span class="lbl">1-year TCO (CapEx + OpEx + service)</span><span class="val" id="t1"></span><span class="sv" id="v1"></span></div><div><span class="lbl">3-year TCO</span><span class="val" id="t3"></span><span class="sv" id="v3"></span></div><div><span class="lbl">5-year TCO</span><span class="val" id="t5"></span><span class="sv" id="v5"></span></div></div>
      </div></section>
  </div>`;
  App.updateTco();
  App.bindDiagram();
    await App.drawDiagram(App.buildMermaid(d.sitesSnap, { sse: d.sse, users: d.users, platform: d.sseCfg.platform }));
  if (d.sse && !d.meraki) $('dwrap').closest('section').insertAdjacentHTML('beforeend', '<p class="tiny muted">Secure Access only: the diagram shows the SSE cloud and remote users.</p>');
  if (!d.fromRerender) r.scrollIntoView({ behavior: 'smooth' });
};

App.bomHtml = bomHtml;
App.updateTco = function () {
  const d = S.last; if (!d || !$('t1')) return;
  const c = Math.min(100, Math.max(0, C.num($('discC').value))), o = Math.min(100, Math.max(0, C.num($('discO').value))); S.disc = { c, o };
  const t = C.computeTotals(d.agg.lines, { derive: d.derive, servicePct: d.servicePct, wanAnnual: d.wanAnnual, discCapex: c, discOpex: o });
  $('sProd').textContent = money(t.opex[1]); $('sServ').textContent = money(t.serviceAnnual + t.wanAnnual); $('sGrand').textContent = money(t.opex[1] * (1 - o / 100) + t.serviceAnnual + t.wanAnnual);
  [1, 3, 5].forEach((y) => { $('t' + y).textContent = money(t.tco[y]); const sv = $('v' + y); const parts = []; if (t.saving[y] > 0) parts.push(`discount saves ${money(t.saving[y])}`); if (y > 1 && t.termSaving[y] > 0) parts.push(`${money(t.termSaving[y])} less than ${y} x 1Y renewals`); sv.textContent = parts.join(' · '); });
  d.tco = t;
};
App.rerenderReport = async function () { if (!S.last) return; S.cur = $('cur').value; S.fx = C.num($('fx').value, 1) || 1; S.last.fromRerender = true; await App.renderReport(S.last); };
App.printReport = function () { document.body.classList.add('print-report'); document.body.classList.remove('print-proposal'); window.print(); };
App.exportCsv = function () { if (S.last) App.dl(new Blob([C.bomToCsv(S.last.agg.lines, S.last.derive)], { type: 'text/csv' }), 'bom.csv'); };
})();
