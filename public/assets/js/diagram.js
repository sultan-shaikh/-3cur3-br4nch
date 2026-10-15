/* Topology diagram: deterministic Mermaid built from the site table, with pan / zoom / export */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$;
const lbl = (s) => String(s == null ? '' : s).replace(/["\[\]{}()<>#&;|`\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 42);
const COL = { MPLS: '#064e3b', DIA: '#2563eb', Broadband: '#dc2626', LTE: '#dc2626', HA: '#94a3b8', OVERLAY: '#7c3aed', SSE: '#049fd9', MGMT: '#cbd5e1' };

App.buildMermaid = function (sites, o) {
  const edges = [], cls = {}; // edges: {line, color, w, dash}
  const useCls = (c, id) => { (cls[c] = cls[c] || []).push(id); };
  const emit = (line, color, w, dash) => edges.push({ line, color, w: w || 2, dash });
  const L = ['flowchart TB'];
  L.push('classDef sse fill:#049fd9,stroke:#005073,color:#fff', 'classDef cloud fill:#e6f6fc,stroke:#049fd9,color:#0b1b2e', 'classDef hub fill:#e2e8f0,stroke:#334155,stroke-width:2px,color:#0f172a',
    'classDef br fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a', 'classDef lan fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e', 'classDef wifi fill:#dbeafe,stroke:#2563eb,color:#1e3a8a',
    'classDef cam fill:#ccfbf1,stroke:#0d9488,color:#134e4a', 'classDef iot fill:#ecfccb,stroke:#65a30d,color:#365314', 'classDef users fill:#3b82f6,stroke:#1d4ed8,color:#fff', 'classDef net fill:#f1f5f9,stroke:#64748b,color:#334155');
  const real = sites.filter((s) => !C.isCloudSite(s.type));
  const used = { MPLS: real.some((s) => s.wan.some((l) => l.type === 'MPLS')), INET: real.some((s) => s.wan.some((l) => l.type !== 'MPLS')) };

  // cloud layer
  L.push('subgraph CL["☁ Cloud layer"]', '  DASH["Meraki Dashboard<br/>cloud management"]');
  useCls('cloud', 'DASH');
  if (o.sse) { L.push(`  SSE["Cisco ${lbl(o.platform || 'Secure Access')}<br/>SSE cloud"]`); useCls('sse', 'SSE'); }
  L.push('end');
  if (o.sse && o.users > 0) { L.push(`USERS["👤 ${Number(o.users).toLocaleString('en-GB')} remote users"]`); useCls('users', 'USERS'); emit('USERS -->|"Secure client / ZTNA"| SSE', COL.SSE, 3); }
  // transport
  if (used.INET) { L.push('INET(("Internet / DIA"))'); useCls('net', 'INET'); }
  if (used.MPLS) { L.push('MPLSN(("MPLS"))'); useCls('net', 'MPLSN'); }
  if (used.INET) emit('DASH -.- INET', COL.MGMT, 1, true);

  const hubs = [], branches = [];
  real.forEach((s, i) => { (C.isHub(s.type) ? hubs : branches).push([s, i]); });
  const siteBlock = (s, i) => {
    const z = C.sizeSite(s), nm = lbl(C.siteName(s)) || 'Site ' + (i + 1), a = `M${i}a`, b = `M${i}b`;
    L.push(`  subgraph S${i}["${nm} - ${s.type}${s.users ? ' - ' + Number(s.users).toLocaleString('en-GB') + ' users' : ''}"]`);
    L.push(`    ${a}["${lbl(z.mx) || 'MX'}${s.ha ? '<br/>HA pair' : ''}"]`); useCls(C.isHub(s.type) ? 'hub' : 'br', a);
    if (s.ha) { L.push(`    ${b}["${lbl(z.mx) || 'MX'}<br/>(standby)"]`); useCls(C.isHub(s.type) ? 'hub' : 'br', b); }
    const compact = real.length > 4; let feed = a;
    if (compact) {
      const parts = [z.switches ? `${z.switches} x MS switch` : '', z.aps ? `${z.aps} x MR AP` : '', z.cameras ? `${z.cameras} x MV camera` : '', z.sensors ? `${z.sensors} x MT sensor` : ''].filter(Boolean);
      if (parts.length) { L.push(`    D${i}["${parts.join('<br/>')}"]`); useCls(z.switches ? 'lan' : z.aps ? 'wifi' : z.cameras ? 'cam' : 'iot', `D${i}`); feed = null; }
    } else {
      feed = z.switches ? `W${i}` : a;
      if (z.switches) { L.push(`    W${i}["${z.switches} x MS switch"]`); useCls('lan', `W${i}`); }
      if (z.aps) { L.push(`    A${i}["${z.aps} x MR AP"]`); useCls('wifi', `A${i}`); }
      if (z.cameras) { L.push(`    V${i}["${z.cameras} x MV camera"]`); useCls('cam', `V${i}`); }
      if (z.sensors) { L.push(`    T${i}["${z.sensors} x MT sensor"]`); useCls('iot', `T${i}`); }
    }
    L.push('  end');
    if (s.ha) emit(`${a} <-.->|"Heartbeat"| ${b}`, COL.HA, 2, true);
    if (compact) { if (feed === null) emit(`${a} --- D${i}`, '#0284c7', 2); }
    else { if (z.switches) emit(`${a} --- W${i}`, '#0284c7', 2); [['A', z.aps], ['V', z.cameras], ['T', z.sensors]].forEach(([p, n]) => { if (n) emit(`${feed} --- ${p}${i}`, '#64748b', 1.5); }); }
    s.wan.forEach((l) => {
      const mpls = l.type === 'MPLS', tgt = mpls ? 'MPLSN' : 'INET', lte = l.type === '5G/LTE';
      emit(`${a} ---|"${l.type === 'DIA' ? 'DIA' : l.type} ${l.mbps}Mbps"| ${tgt}`, mpls ? COL.MPLS : l.type === 'DIA' ? COL.DIA : COL.Broadband, mpls ? 4 : 3, lte);
    });
  };
  if (hubs.length) { L.push('subgraph HUBS["🏢 Hub layer - DC and HQ"]'); hubs.forEach(([s, i]) => siteBlock(s, i)); L.push('end'); }
  if (branches.length) { L.push('subgraph BRS["📍 Branch layer"]'); branches.forEach(([s, i]) => siteBlock(s, i)); L.push('end'); }

  // overlay + SSE tunnels
  const hubA = hubs.length ? `M${hubs[0][1]}a` : null;
  if (hubA) branches.forEach(([s, i]) => emit(`M${i}a -.->|"AutoVPN"| ${hubA}`, COL.OVERLAY, 2, true));
  if (hubs.length > 1) emit(`${hubA} -.->|"AutoVPN"| M${hubs[1][1]}a`, COL.OVERLAY, 2, true);
  if (o.sse) {
    if (real.length <= 10) real.forEach((s, i) => emit(`M${i}a -.->|"IPsec to SSE"| SSE`, COL.SSE, 2, true));
    else emit('INET ---|"IPsec tunnels from all MX"| SSE', COL.SSE, 3);
  }
  edges.forEach((e) => L.push(e.line));
  edges.forEach((e, k) => L.push(`linkStyle ${k} stroke:${e.color},stroke-width:${e.w}px${e.dash ? ',stroke-dasharray:5 4' : ''},fill:none`));
  Object.keys(cls).forEach((c) => { if (cls[c].length) L.push(`class ${cls[c].join(',')} ${c}`); });
  return L.join('\n');
};

/* ---------- render ---------- */
const P = { x: 0, y: 0, k: 1, drag: null, svgW: 0, svgH: 0 };
function apply() { const s = $('dstage'); if (s) s.style.transform = `translate(${P.x}px,${P.y}px) scale(${P.k})`; }
function fit() {
  const w = $('dwrap'); if (!w || !P.svgW) return;
  const pad = 48, k = Math.max(0.55, Math.min(1, w.clientWidth / (P.svgW + pad), w.clientHeight / (P.svgH + pad)));
  P.k = k; P.x = Math.max(0, (w.clientWidth - (P.svgW + pad) * k) / 2); P.y = Math.max(0, (w.clientHeight - (P.svgH + pad) * k) / 2); apply();
}
App.drawDiagram = async function (src) {
  const stage = $('dstage'); $('rawCode').textContent = src;
  try {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme: 'base', themeVariables: { fontFamily: 'system-ui, Arial, sans-serif', fontSize: '14px', lineColor: '#64748b' }, flowchart: { useMaxWidth: false, htmlLabels: false, curve: 'basis', nodeSpacing: 40, rankSpacing: 60 } });
    const { svg } = await window.mermaid.render('mmd' + Date.now(), src);
    stage.innerHTML = window.DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    const el = stage.querySelector('svg'); const vb = (el.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    P.svgW = vb[2] || el.getBoundingClientRect().width; P.svgH = vb[3] || el.getBoundingClientRect().height;
    el.setAttribute('width', P.svgW); el.setAttribute('height', P.svgH);
  } catch (e) { stage.textContent = 'Diagram could not be rendered: ' + e.message; P.svgW = 0; }
  fit();
};
App.diagramSvg = () => { const s = $('dstage') && $('dstage').querySelector('svg'); if (!s) return null; const c = s.cloneNode(true); c.removeAttribute('style'); return c; };
App.diagramPng = function () {
  return new Promise((resolve) => {
    const c = App.diagramSvg(); if (!c || !P.svgW) return resolve(null);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const scale = Math.min(2, 3000 / P.svgW), W = Math.round(P.svgW * scale), H = Math.round(P.svgH * scale);
    c.setAttribute('width', W); c.setAttribute('height', H);
    const img = new Image();
    img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H); resolve({ data: cv.toDataURL('image/png'), w: W, h: H }); } catch { resolve(null); } };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
  });
};
function zoom(f, cx, cy) {
  const w = $('dwrap'); cx = cx == null ? w.clientWidth / 2 : cx; cy = cy == null ? w.clientHeight / 2 : cy;
  const k = Math.min(5, Math.max(0.1, P.k * f)), r = k / P.k; P.x = cx - (cx - P.x) * r; P.y = cy - (cy - P.y) * r; P.k = k; apply();
}
App.bindDiagram = function () {
  const w = $('dwrap'); if (!w) return;
  w.addEventListener('pointerdown', (e) => { P.drag = { x: e.clientX - P.x, y: e.clientY - P.y }; w.classList.add('panning'); try { w.setPointerCapture(e.pointerId); } catch {} });
  w.addEventListener('pointermove', (e) => { if (!P.drag) return; P.x = e.clientX - P.drag.x; P.y = e.clientY - P.drag.y; apply(); });
  const end = () => { P.drag = null; w.classList.remove('panning'); };
  w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
  w.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = w.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
};
App.diagramAction = function (a) {
  if (a === 'in') zoom(1.2); else if (a === 'out') zoom(0.8); else if (a === 'fit') fit();
  else if (a === 'code') { const p = $('rawCode'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; }
  else if (a === 'svg') { const c = App.diagramSvg(); if (!c) return; c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); App.dl(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }), 'architecture.svg'); }
  else if (a === 'png') App.diagramPng().then((r) => { if (!r) return; fetch(r.data).then((x) => x.blob()).then((b) => App.dl(b, 'architecture.png')); });
};
})();
