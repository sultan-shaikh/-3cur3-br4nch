/* Customer-ready proposal: PPTX (pptxgenjs, self-hosted) + printable PDF view */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = App.esc, money = App.money;
const hex = (v, d) => (/^#?[0-9a-f]{6}$/i.test(v) ? v.replace('#', '').toUpperCase() : d);
const sstat = (m) => { $('ppStatus').classList.remove('hidden'); $('ppStatusText').textContent = m; };
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, n = 400) => String(v == null ? '' : v).slice(0, n);

App.bindProposal = function () {
  $('ppPrimary').addEventListener('input', () => { $('ppPrimaryL').textContent = $('ppPrimary').value.toUpperCase(); });
  $('ppAccent').addEventListener('input', () => { $('ppAccentL').textContent = $('ppAccent').value.toUpperCase(); });
  $('ppLogo').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) { S.logo = null; return; } const r = new FileReader(); r.onload = () => { S.logo = String(r.result); }; r.readAsDataURL(f); });
  $('ppBtn').addEventListener('click', App.generateProposal);
  $('ppPrint').addEventListener('click', () => { document.body.classList.add('print-proposal'); document.body.classList.remove('print-report'); window.print(); });
};

function groupSummary(d) {
  const G = {}; d.agg.lines.forEach((l) => { const g = G[l.group] || (G[l.group] = { hw: 0, y1: 0, y3: 0, y5: 0, qty: 0 }); if (l.kind === 'capex') { g.hw += l.unit * l.qty; g.qty += l.qty; } else { [1, 3, 5].forEach((t) => { g['y' + t] += (C.termPrice(l, t, d.derive).price || 0) * l.qty; }); } });
  const order = ['WAN', 'Security', 'LAN', 'WiFi', 'Camera', 'IoT', 'Secure Access'], lab = { WAN: 'WAN / SD-WAN (MX)', Security: 'MX security licences', LAN: 'LAN switching (MS)', WiFi: 'WiFi (MR)', Camera: 'Cameras (MV)', IoT: 'IoT sensors (MT)', 'Secure Access': 'Secure Access (SSE)' };
  return order.filter((k) => G[k]).map((k) => ({ name: lab[k], ...G[k] }));
}

App.generateProposal = async function () {
  const d = S.last; if (!d) { alert('Run step 4 “Generate design & BoM” first.'); return; }
  const btn = $('ppBtn'); btn.disabled = true; $('ppPrint').classList.add('hidden');
  try {
    sstat('Step 1/3 — AI mapping the design to business value…');
    const PP = { dark: '0F172A', primary: hex($('ppPrimary').value, '005073'), accent: hex($('ppAccent').value, '049FD9'), light: 'F8FAFC', white: 'FFFFFF', muted: '64748B', green: '16A34A', amber: 'D97706', teal: '0D9488', violet: '7C3AED', s2: '1E293B', sB: '334155', sC: '94A3B8', sD: 'E2E8F0' };
    const inc = { prob: $('ck_prob').checked, cases: $('ck_cases').checked, arch: $('ck_arch').checked, bom: $('ck_bom').checked, roi: $('ck_roi').checked, comp: $('ck_comp').checked, road: $('ck_road').checked };
    const company = d.company, industry = d.industry, by = $('ppBy').value.trim() || 'Solutions Architect', msp = $('ppMsp').value.trim() || 'Managed Secure Branch', tone = $('ppTone').value, ctx = $('ppCtx').value.trim();
    const t = d.tco || C.computeTotals(d.agg.lines, { derive: d.derive, servicePct: d.servicePct, wanAnnual: d.wanAnnual });
    const sites = d.sitesSnap, hubs = sites.filter((s) => C.isHub(s.type)).length;
    const pillars = [d.meraki ? 'Meraki LAN, WAN/SD-WAN, security, WiFi' : '', d.meraki && d.sizing.some((z) => z.cameras) ? 'Meraki MV cameras' : '', d.meraki && d.sizing.some((z) => z.sensors) ? 'Meraki MT IoT sensors' : '', d.sse ? `Cisco ${d.sseCfg.platform} (SSE)` : ''].filter(Boolean);
    const toneTxt = tone === 'Executive' ? 'Focus on business outcomes, risk reduction, operational simplicity, and measurable ROI.' : 'Focus on architecture, resilience, specific product capabilities, and operational detail.';
    const prompt = `You are a senior solutions architect at "${msp}", a managed service provider. Write a customer-ready proposal for ${company}, a ${industry} organisation, for a fully managed offering built on Cisco: ${pillars.join('; ')}.
TONE: ${toneTxt}
DISCOVERY NOTES: ${ctx || 'Infer typical challenges for this industry.'}
DESIGN: ${sites.length} sites (${hubs} hubs), ${d.sse ? d.users + ' remote users' : 'no SSE'}, HA at ${sites.filter((s) => s.ha).length} site(s). Service: ${d.svcLabels.tier} / ${d.svcLabels.role}.
Rules: do not invent prices, customer facts, or quantified savings presented as fact; ROI metrics must be framed as typical/indicative outcomes. Do not name competitor products. Keep text concise.
Return ONLY JSON: {"problemStatement":{"headline":string,"challenges":[{"title":string,"desc":string}]},"useCases":[{"title":string,"problem":string,"solution":string,"module":string}],"executiveSummary":string,"roi":{"headline":string,"points":[{"metric":string,"value":string,"detail":string}],"paybackPeriod":string},"competitive":{"summary":string,"comparisons":[{"category":string,"us":string,"others":string}]},"roadmap":{"phases":[{"phase":string,"name":string,"duration":string,"activities":[string],"milestone":string}]},"whyUs":[string],"nextSteps":[string]}
Limits: 4 challenges, 6 use cases, 4 ROI points, 5 comparisons, 3 phases (5 activities max), 3-4 whyUs, 4 nextSteps.`;
    const content = App.extractJSON(await App.generate(prompt, { max: 8000, temp: 0.4 }));
    const cp = content.problemStatement || {}, cr = content.roi || {}, cc = content.competitive || {}, cro = content.roadmap || {};

    sstat('Step 2/3 — Rendering diagram and assembling slides…');
    const png = inc.arch ? await App.diagramPng() : null;
    const pres = new window.PptxGenJS(); pres.layout = 'LAYOUT_16x9'; pres.author = by; pres.title = `Managed Secure Branch Proposal - ${company}`;
    const TODAY = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const agenda = [];
    if (inc.prob) agenda.push(['Problem statement', 'Your current challenges']); if (inc.cases) agenda.push(['Key use cases', 'Addressing specific scenarios']); agenda.push(['Solution overview', `Managed Cisco by ${msp}`]);
    if (inc.arch) agenda.push(['Architecture design', 'Topology & integration']); if (inc.bom) agenda.push(['Investment summary', 'Hardware, licensing & services']); if (inc.roi) agenda.push(['Business case & ROI', 'Value & payback']);
    if (inc.comp) agenda.push(['Why us', `${msp} advantage`]); if (inc.road) agenda.push(['Implementation roadmap', 'Phased delivery plan']);
    const TOTAL = agenda.length + 2; let num = 1;
    const F = 'Calibri';
    const header = (s, title, sub) => { s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: PP.dark } }); s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.05, fill: { color: PP.accent } }); s.addText(title, { x: 0.35, y: 0.14, w: 9.3, h: 0.45, fontSize: 22, bold: true, color: PP.white, fontFace: F, margin: 0 }); s.addText(str(sub, 160), { x: 0.35, y: 0.6, w: 9.3, h: 0.35, fontSize: 11, color: PP.sC, fontFace: F, margin: 0 }); };
    const footer = (s) => { num++; s.addText(`${company}  |  Confidential`, { x: 0.35, y: 5.3, w: 6, h: 0.25, fontSize: 8, color: PP.muted, fontFace: F, margin: 0 }); s.addText(`${num} / ${TOTAL}`, { x: 8.6, y: 5.3, w: 1.05, h: 0.25, fontSize: 8, color: PP.muted, fontFace: F, align: 'right', margin: 0 }); };
    const card = (s, x, y, w, h, band) => { s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: PP.white }, line: { color: PP.sD, pt: 1 }, shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 135, opacity: 0.08 } }); if (band) s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.07, fill: { color: band } }); };
    const newSlide = (title, sub) => { const s = pres.addSlide(); s.background = { color: PP.light }; header(s, title, sub); return s; };
    const cols = [PP.accent, PP.primary, PP.teal, PP.violet, PP.green, PP.amber];

    { // title
      const s = pres.addSlide(); s.background = { color: PP.dark }; num++;
      s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 3.8, h: 5.625, fill: { color: PP.primary } });
      s.addText(msp.toUpperCase(), { x: 0.3, y: 0.3, w: 3.2, h: 0.6, fontSize: 11, bold: true, color: PP.white, fontFace: F, margin: 0 });
      if (S.logo) s.addImage({ data: S.logo, x: 0.4, y: 1.1, w: 3.0, h: 1.2, sizing: { type: 'contain', w: 3.0, h: 1.2 } });
      else { s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.1, w: 3.0, h: 1.2, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: PP.white, pt: 1, dashType: 'dash' } }); s.addText(`[${company} logo]`, { x: 0.4, y: 1.1, w: 3.0, h: 1.2, fontSize: 13, color: PP.white, fontFace: F, align: 'center', valign: 'middle', margin: 0 }); }
      s.addText('Managed Secure Branch', { x: 4.1, y: 1.0, w: 5.6, h: 0.8, fontSize: 36, bold: true, color: PP.accent, fontFace: F, margin: 0 });
      s.addText('Architecture Proposal', { x: 4.1, y: 1.8, w: 5.6, h: 0.65, fontSize: 26, color: PP.white, fontFace: F, margin: 0 });
      s.addText(`Prepared for: ${company}`, { x: 4.1, y: 2.65, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: PP.sC, fontFace: F, margin: 0 });
      s.addText(`Industry: ${industry}`, { x: 4.1, y: 3.1, w: 5.6, h: 0.3, fontSize: 12, color: PP.sC, fontFace: F, margin: 0 });
      s.addText(`Prepared by: ${by}`, { x: 4.1, y: 3.45, w: 5.6, h: 0.3, fontSize: 12, color: PP.sC, fontFace: F, margin: 0 });
      s.addText(`Date: ${TODAY}`, { x: 4.1, y: 3.8, w: 5.6, h: 0.3, fontSize: 12, color: PP.sC, fontFace: F, margin: 0 });
      s.addText('CONFIDENTIAL', { x: 4.1, y: 4.8, w: 5.6, h: 0.3, fontSize: 9, color: PP.muted, fontFace: F, charSpacing: 4, margin: 0 });
    }
    { // agenda
      const s = newSlide('Agenda', 'What we will cover today'); footer(s);
      agenda.forEach((it, i) => { const bx = i % 2 ? 5.2 : 0.35, by2 = 1.4 + Math.floor(i / 2) * 0.95; card(s, bx, by2, 4.55, 0.78); s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by2, w: 0.05, h: 0.78, fill: { color: PP.accent } }); s.addText('0' + (i + 1), { x: bx + 0.12, y: by2 + 0.05, w: 0.45, h: 0.35, fontSize: 18, bold: true, color: PP.accent, fontFace: F, margin: 0 }); s.addText(it[0], { x: bx + 0.6, y: by2 + 0.07, w: 3.8, h: 0.3, fontSize: 13, bold: true, color: PP.s2, fontFace: F, margin: 0 }); s.addText(it[1], { x: bx + 0.6, y: by2 + 0.4, w: 3.8, h: 0.26, fontSize: 10, color: PP.muted, fontFace: F, margin: 0 }); });
    }
    if (inc.prob) {
      const s = newSlide('Problem statement', cp.headline); footer(s);
      arr(cp.challenges).slice(0, 4).forEach((ch, i) => { const cx = i % 2 ? 5.2 : 0.3, cy = 1.35 + Math.floor(i / 2) * 1.9; card(s, cx, cy, 4.6, 1.65); s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 4.6, h: 0.32, fill: { color: cols[i] } }); s.addText(str(ch.title, 80), { x: cx + 0.12, y: cy + 0.04, w: 4.3, h: 0.24, fontSize: 11, bold: true, color: PP.white, fontFace: F, margin: 0 }); s.addText(str(ch.desc, 300), { x: cx + 0.12, y: cy + 0.4, w: 4.3, h: 1.15, fontSize: 10, color: PP.s2, fontFace: F, margin: 0, valign: 'top' }); });
    }
    if (inc.cases) {
      const s = newSlide('Key use cases', `Addressing specific scenarios for ${company}`); footer(s);
      arr(content.useCases).slice(0, 6).forEach((u, i) => { const cx = 0.25 + (i % 3) * 3.2, cy = 1.3 + Math.floor(i / 3) * 2.0; card(s, cx, cy, 3.0, 1.8, cols[i]); s.addText(str(u.title, 60), { x: cx + 0.1, y: cy + 0.15, w: 2.8, h: 0.3, fontSize: 11, bold: true, color: PP.s2, fontFace: F, margin: 0 }); s.addText('Problem: ' + str(u.problem, 120), { x: cx + 0.1, y: cy + 0.5, w: 2.8, h: 0.5, fontSize: 9, color: PP.muted, fontFace: F, margin: 0, italic: true, valign: 'top' }); s.addText('✓ ' + str(u.solution, 120), { x: cx + 0.1, y: cy + 1.02, w: 2.8, h: 0.5, fontSize: 9, color: cols[i], fontFace: F, bold: true, margin: 0, valign: 'top' }); s.addText(str(u.module, 60), { x: cx + 0.1, y: cy + 1.6, w: 2.8, h: 0.18, fontSize: 7.5, color: PP.sC, fontFace: F, margin: 0, italic: true }); });
    }
    { // solution
      const s = newSlide('Solution overview', `Managed Cisco delivered by ${msp}`); footer(s);
      const left = ['Meraki MX SD-WAN & advanced security', 'Meraki MS / Catalyst switching', 'Meraki MR WiFi', 'Meraki MV smart cameras', 'Meraki MT IoT sensors', 'Single cloud dashboard']; const right = ['Secure web gateway (SWG)', 'Zero trust network access (ZTNA)', 'Cloud firewall & DNS-layer security', 'CASB & data loss prevention', 'Remote browser isolation', 'Per-user policy, anywhere'];
      const hasM = d.meraki, hasS = d.sse; const w = hasM && hasS ? 4.55 : 9.4;
      if (hasM) { s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.3, w, h: 3.55, fill: { color: PP.dark } }); s.addText('CISCO MERAKI\n(LAN · WAN · WIFI · CAMERA · IOT)', { x: 0.4, y: 1.38, w: w - 0.2, h: 0.55, fontSize: 12, bold: true, color: PP.accent, fontFace: F, margin: 0 }); left.forEach((it, i) => s.addText('▸  ' + it, { x: 0.45, y: 2.05 + i * 0.44, w: w - 0.3, h: 0.36, fontSize: 10, color: PP.white, fontFace: F, margin: 0 })); }
      if (hasS) { const x = hasM ? 5.15 : 0.3; s.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w, h: 3.55, fill: { color: PP.sB } }); s.addText(`CISCO ${d.sseCfg.platform.toUpperCase()}\n(SSE)`, { x: x + 0.1, y: 1.38, w: w - 0.2, h: 0.55, fontSize: 12, bold: true, color: PP.accent, fontFace: F, margin: 0 }); right.forEach((it, i) => s.addText('▸  ' + it, { x: x + 0.15, y: 2.05 + i * 0.44, w: w - 0.3, h: 0.36, fontSize: 10, color: PP.white, fontFace: F, margin: 0 })); }
      s.addText(str(content.executiveSummary, 420), { x: 0.3, y: 4.9, w: 9.4, h: 0.4, fontSize: 9, color: PP.s2, fontFace: F, italic: true, margin: 0, valign: 'top' });
    }
    if (inc.arch) {
      const s = newSlide('Architecture design', `${sites.length} site(s)${d.sse ? `, ${Number(d.users).toLocaleString('en-GB')} remote users` : ''}`); footer(s);
      if (png) { const bw = 9.4, bh = 3.85, r = png.w / png.h; let w = bw, h = bw / r; if (h > bh) { h = bh; w = bh * r; } s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.3, w: 9.4, h: 3.85, fill: { color: PP.white }, line: { color: PP.sD, pt: 1 } }); s.addImage({ data: png.data, x: 0.3 + (bw - w) / 2, y: 1.3 + (bh - h) / 2, w, h }); }
      else s.addText('Topology diagram is included in the PDF version of this proposal.', { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 13, color: PP.muted, italic: true, fontFace: F });
    }
    if (inc.bom) {
      const s = newSlide('Investment summary', 'Hardware, licensing & managed services'); footer(s);
      [['Total CapEx', t.capex, PP.primary, 0], ['1-year TCO', t.tco[1], PP.teal, 1], ['3-year TCO', t.tco[3], PP.accent, 1], ['5-year TCO', t.tco[5], PP.violet, 1]].forEach(([l, v, c], i) => { const cx = 0.3 + i * 2.38; s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.3, w: 2.1, h: 0.9, fill: { color: c } }); s.addText(l.toUpperCase(), { x: cx + 0.1, y: 1.35, w: 1.9, h: 0.24, fontSize: 8, bold: true, color: PP.white, fontFace: F, charSpacing: 1, margin: 0 }); s.addText(money(v), { x: cx + 0.1, y: 1.6, w: 1.9, h: 0.5, fontSize: 17, bold: true, color: PP.white, fontFace: F, margin: 0 }); });
      const G = groupSummary(d); const H = (x, a) => ({ text: x, options: { bold: true, fill: { color: PP.dark }, color: PP.white, fontSize: 9, fontFace: F, align: a || 'left' } });
      const cell = (x, a, b) => ({ text: x, options: { fontSize: 9, fontFace: F, color: PP.s2, align: a || 'left', bold: !!b } });
      const rows = [[H('Component'), H('Hardware qty', 'right'), H('Hardware', 'right'), H('Licences 1Y', 'right'), H('Licences 3Y', 'right'), H('Licences 5Y', 'right')], ...G.map((g) => [cell(g.name), cell(g.qty ? String(g.qty) : '–', 'right'), cell(g.hw ? money(g.hw) : '–', 'right'), cell(g.y1 ? money(g.y1) : '–', 'right'), cell(g.y3 ? money(g.y3) : '–', 'right'), cell(g.y5 ? money(g.y5) : '–', 'right')]),
        [cell('Total', 'left', 1), cell('', 'right'), cell(money(t.capex), 'right', 1), cell(money(t.opex[1]), 'right', 1), cell(money(t.opex[3]), 'right', 1), cell(money(t.opex[5]), 'right', 1)]];
      s.addTable(rows, { x: 0.3, y: 2.45, w: 9.4, colW: [3.0, 1.1, 1.3, 1.3, 1.35, 1.35], border: { pt: 0.5, color: PP.sD } });
      const extra = [d.servicePct > 0 ? `Managed service wrap: ${money(t.serviceAnnual)} per year (${(d.servicePct * 100).toFixed(0)}% of 1Y licence OpEx)` : '', (t.discCapex > 0 || t.discOpex > 0) ? `TCO includes ${(t.discCapex * 100).toFixed(1)}% hardware and ${(t.discOpex * 100).toFixed(1)}% licence discount` : '', d.agg.gaps.length ? `${d.agg.gaps.length} requirement(s) not in the price book are excluded and need manual pricing` : ''].filter(Boolean).join('   ·   ');
      if (extra) s.addText(extra, { x: 0.3, y: 5.0, w: 9.4, h: 0.28, fontSize: 8.5, color: PP.muted, italic: true, fontFace: F, margin: 0 });
    }
    if (inc.roi) {
      const s = newSlide('Business case & ROI', cr.headline || 'Value from day one'); footer(s);
      s.addShape(pres.shapes.RECTANGLE, { x: 7.4, y: 1.3, w: 2.25, h: 0.8, fill: { color: PP.green } }); s.addText('PAYBACK PERIOD (INDICATIVE)', { x: 7.45, y: 1.33, w: 2.15, h: 0.28, fontSize: 7, bold: true, color: PP.white, fontFace: F, align: 'center', margin: 0 }); s.addText(str(cr.paybackPeriod, 24) || 'TBC', { x: 7.45, y: 1.6, w: 2.15, h: 0.42, fontSize: 15, bold: true, color: PP.white, fontFace: F, align: 'center', margin: 0 });
      arr(cr.points).slice(0, 4).forEach((p, i) => { const cx = i % 2 ? 3.95 : 0.3, cy = 1.3 + Math.floor(i / 2) * 1.8; card(s, cx, cy, 3.45, 1.6); s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 0.05, h: 1.6, fill: { color: PP.green } }); s.addText(str(p.metric, 60), { x: cx + 0.18, y: cy + 0.1, w: 3.15, h: 0.28, fontSize: 10, bold: true, color: PP.s2, fontFace: F, margin: 0 }); s.addText(str(p.value, 30), { x: cx + 0.18, y: cy + 0.42, w: 3.15, h: 0.5, fontSize: 22, bold: true, color: PP.green, fontFace: F, margin: 0 }); s.addText(str(p.detail, 140), { x: cx + 0.18, y: cy + 0.98, w: 3.15, h: 0.55, fontSize: 9, color: PP.muted, fontFace: F, margin: 0, valign: 'top' }); });
      s.addChart(pres.charts.BAR, [{ name: 'TCO', labels: ['CapEx', '1Y TCO', '3Y TCO', '5Y TCO'], values: [t.capex, t.tco[1], t.tco[3], t.tco[5]].map((v) => Math.round(v * S.fx)) }], { x: 7.4, y: 2.2, w: 2.3, h: 2.95, barDir: 'col', chartColors: [PP.primary, PP.teal, PP.accent, PP.violet], catAxisLabelColor: PP.muted, valAxisLabelColor: PP.muted, valGridLine: { color: PP.sD, size: 0.5 }, showLegend: false, showValue: false, fontSize: 8, showTitle: false });
      s.addText('Outcome metrics are indicative and based on typical deployments, not a commitment.', { x: 0.3, y: 5.0, w: 6.9, h: 0.25, fontSize: 8, italic: true, color: PP.muted, fontFace: F, margin: 0 });
    }
    if (inc.comp) {
      const s = newSlide('Why us', cc.summary || 'A unified, managed approach'); footer(s);
      [[0.3, 3.3, PP.sD], [3.7, 2.95, PP.dark], [6.75, 2.95, PP.sB]].forEach(([x, w, c]) => s.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w, h: 0.38, fill: { color: c } }));
      s.addText('CAPABILITY', { x: 0.4, y: 1.35, w: 3.1, h: 0.28, fontSize: 9, bold: true, color: PP.muted, fontFace: F, margin: 0 }); s.addText(`✓  ${msp.toUpperCase()} + CISCO`, { x: 3.75, y: 1.35, w: 2.85, h: 0.28, fontSize: 9, bold: true, color: PP.accent, fontFace: F, margin: 0 }); s.addText('OTHER APPROACHES', { x: 6.8, y: 1.35, w: 2.85, h: 0.28, fontSize: 9, bold: true, color: PP.sC, fontFace: F, margin: 0 });
      arr(cc.comparisons).slice(0, 5).forEach((row, i) => { const ry = 1.68 + i * 0.64, fill = i % 2 ? PP.light : PP.white; [[0.3, 3.3], [3.7, 2.95], [6.75, 2.95]].forEach(([x, w]) => s.addShape(pres.shapes.RECTANGLE, { x, y: ry, w, h: 0.6, fill: { color: fill }, line: { color: PP.sD, pt: 0.5 } })); s.addText(str(row.category, 60), { x: 0.4, y: ry + 0.07, w: 3.1, h: 0.46, fontSize: 10, bold: true, color: PP.s2, fontFace: F, margin: 0 }); s.addText(str(row.us || row.prisma, 110), { x: 3.78, y: ry + 0.07, w: 2.77, h: 0.46, fontSize: 9, color: PP.green, fontFace: F, margin: 0 }); s.addText(str(row.others, 110), { x: 6.83, y: ry + 0.07, w: 2.77, h: 0.46, fontSize: 9, color: PP.muted, italic: true, fontFace: F, margin: 0 }); });
      s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 4.95, w: 9.4, h: 0.34, fill: { color: PP.primary } }); s.addText('★  ' + arr(content.whyUs).slice(0, 4).map((x) => str(x, 60)).join('   ·   '), { x: 0.4, y: 4.98, w: 9.2, h: 0.28, fontSize: 9, bold: true, color: PP.white, fontFace: F, margin: 0 });
    }
    if (inc.road) {
      const s = newSlide('Implementation roadmap', 'Phased delivery — from foundation to optimisation'); footer(s);
      arr(cro.phases).slice(0, 3).forEach((ph, i) => { const cx = 0.3 + i * 3.2; card(s, cx, 1.3, 2.95, 3.85); s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.3, w: 2.95, h: 0.55, fill: { color: [PP.primary, PP.accent, PP.teal][i] } }); s.addText(str(ph.phase, 20) + ' · ' + str(ph.name, 40), { x: cx + 0.1, y: 1.34, w: 2.75, h: 0.26, fontSize: 11, bold: true, color: PP.white, fontFace: F, margin: 0 }); s.addText(str(ph.duration, 40), { x: cx + 0.1, y: 1.6, w: 2.75, h: 0.2, fontSize: 9, italic: true, color: PP.white, fontFace: F, margin: 0 }); arr(ph.activities).slice(0, 5).forEach((a, ai) => s.addText('▸  ' + str(a, 90), { x: cx + 0.1, y: 1.98 + ai * 0.5, w: 2.75, h: 0.44, fontSize: 9.5, color: PP.s2, fontFace: F, margin: 0, valign: 'top' })); s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 4.8, w: 2.95, h: 0.35, fill: { color: [PP.primary, PP.accent, PP.teal][i], transparency: 82 } }); s.addText('Milestone: ' + str(ph.milestone, 80), { x: cx + 0.08, y: 4.83, w: 2.79, h: 0.28, fontSize: 8.5, bold: true, color: PP.s2, fontFace: F, margin: 0 }); });
    }
    { const s = pres.addSlide(); s.background = { color: PP.dark }; num++;
      s.addText('Next steps', { x: 0.6, y: 0.6, w: 8.8, h: 0.7, fontSize: 32, bold: true, color: PP.accent, fontFace: F, margin: 0 });
      arr(content.nextSteps).slice(0, 4).forEach((n, i) => { s.addText(String(i + 1), { x: 0.6, y: 1.7 + i * 0.75, w: 0.5, h: 0.5, fontSize: 24, bold: true, color: PP.accent, fontFace: F, margin: 0 }); s.addText(str(n, 160), { x: 1.2, y: 1.7 + i * 0.75, w: 8.2, h: 0.6, fontSize: 14, color: PP.white, fontFace: F, margin: 0, valign: 'middle' }); });
      s.addText(`${by}  |  ${msp}`, { x: 0.6, y: 5.0, w: 8.8, h: 0.3, fontSize: 10, color: PP.sC, fontFace: F, margin: 0 }); }

    sstat('Step 3/3 — Saving PPTX and building the PDF view…');
    await pres.writeFile({ fileName: `${company.replace(/[^\w\- ]+/g, '').trim() || 'Customer'} - Managed Secure Branch Proposal.pptx` });
    buildPdfView(d, t, content, { company, industry, by, msp, TODAY, primary: '#' + PP.primary, accent: '#' + PP.accent, png });
    $('ppPrint').classList.remove('hidden'); sstat('Done — PPTX downloaded. Use “Print / save formal PDF” for the PDF version.');
  } catch (e) { sstat('Failed: ' + e.message); }
  btn.disabled = false;
};

function buildPdfView(d, t, c, o) {
  const v = $('pdfProposalView'); v.style.setProperty('--pp', o.primary);
  const cp = c.problemStatement || {}, cr = c.roi || {}, cc = c.competitive || {}, ro = (c.roadmap || {}).phases || [];
  const li = (a) => `<ul>${arr(a).map((x) => `<li>${esc(str(x, 200))}</li>`).join('')}</ul>`;
  v.innerHTML = `<div style="text-align:center;padding:40px 0 60px;border-bottom:4px solid ${o.primary};margin-bottom:36px">${S.logo ? `<img src="${esc(S.logo)}" alt="" style="height:90px;object-fit:contain;margin-bottom:24px">` : ''}<h1 style="font-size:40px;margin:0 0 14px">Managed Secure Branch Proposal</h1><p style="font-size:22px;color:${o.primary};margin:0 0 40px">Prepared for: <b>${esc(o.company)}</b></p><div style="display:flex;justify-content:space-between;text-align:left;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:16px"><div><b style="color:#334155">Delivered by</b><br>${esc(o.msp)}<br>${esc(o.by)}</div><div style="text-align:right"><b style="color:#334155">Date</b><br>${esc(o.TODAY)}</div></div></div>
  <h2>Executive summary</h2><p>${esc(str(c.executiveSummary, 700))}</p>
  <h2 style="margin-top:28px">Problem statement</h2><p>${esc(str(cp.headline, 400))}</p>${arr(cp.challenges).slice(0, 4).map((x) => `<div class="pc"><b>${esc(str(x.title, 80))}</b><br>${esc(str(x.desc, 300))}</div>`).join('')}
  <h2 style="margin-top:28px">Key use cases</h2>${arr(c.useCases).slice(0, 6).map((x) => `<div class="pc"><b>${esc(str(x.title, 80))}</b> <span style="color:#64748b">(${esc(str(x.module, 60))})</span><br><i>Problem:</i> ${esc(str(x.problem, 200))}<br><i>Solution:</i> ${esc(str(x.solution, 200))}</div>`).join('')}
  <h2 class="pb" style="margin-top:28px">Architecture</h2><div id="pdfDia" style="text-align:center">${o.png ? `<img src="${o.png.data}" alt="Topology diagram" style="max-width:100%">` : '<p class="muted">Diagram unavailable.</p>'}</div>
  <h2 class="pb" style="margin-top:28px">Investment summary</h2>${App.bomHtml(d.agg.lines, d.derive)}
  <div class="pc" style="margin-top:14px"><b>Total cost of ownership:</b> 1Y ${money(t.tco[1])} · 3Y ${money(t.tco[3])} · 5Y ${money(t.tco[5])}${t.discCapex > 0 || t.discOpex > 0 ? ` (after ${(t.discCapex * 100).toFixed(1)}% hardware / ${(t.discOpex * 100).toFixed(1)}% licence discount)` : ''}${d.servicePct > 0 ? `<br>Managed service wrap: ${money(t.serviceAnnual)} per year included in TCO.` : ''}</div>
  <h2 style="margin-top:28px">Business case &amp; ROI</h2><p>${esc(str(cr.headline, 200))} <i>Payback (indicative): ${esc(str(cr.paybackPeriod, 40))}</i></p>${arr(cr.points).slice(0, 4).map((x) => `<div class="pc"><b>${esc(str(x.metric, 80))}:</b> ${esc(str(x.value, 40))}<br>${esc(str(x.detail, 200))}</div>`).join('')}<p style="font-size:11px;color:#64748b">Outcome metrics are indicative and based on typical deployments, not a commitment.</p>
  <h2 style="margin-top:28px">Why us</h2><p>${esc(str(cc.summary, 300))}</p>${arr(cc.comparisons).slice(0, 5).map((x) => `<div class="pc"><b>${esc(str(x.category, 80))}</b><br>✓ ${esc(str(x.us || x.prisma, 200))}<br><span style="color:#64748b">Others: ${esc(str(x.others, 200))}</span></div>`).join('')}${li(c.whyUs)}
  <h2 style="margin-top:28px">Implementation roadmap</h2>${ro.slice(0, 3).map((p) => `<div class="pc"><b>${esc(str(p.phase, 30))} · ${esc(str(p.name, 60))}</b> <span style="color:#64748b">(${esc(str(p.duration, 40))})</span>${li(p.activities)}<i>Milestone: ${esc(str(p.milestone, 120))}</i></div>`).join('')}
  <h2 style="margin-top:28px">Next steps</h2>${li(c.nextSteps)}`;
}
})();
