/* Sentinel Architect - guided steps 1 to 4 */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = C.esc, hint = App.hint, money = App.money, gb = App.gb, fmt = App.fmt;

const ENV = [
  ['People & identity', [
    ['seats', 'Employees / seats', 'Number of people who sign in with a work account. This is the main driver for identity, email and SaaS logs.', 'people'],
    ['licensed', 'Microsoft 365 licensed users', 'Users with a Microsoft 365 licence. If they hold E5, Microsoft includes a small daily amount of free Sentinel ingestion per user (5 MB per user per day for eligible Microsoft data).', 'users', 'licensed']]],
  ['Endpoints & servers', [
    ['endpoints', 'Managed endpoints', 'Laptops, desktops and mobile devices running endpoint protection. Endpoint telemetry is often the largest single source.', 'devices'],
    ['winServers', 'Windows servers', 'Member servers (not domain controllers). Their security events are a major volume driver.', 'servers'],
    ['dcs', 'Domain controllers', 'Active Directory servers. Each produces far more authentication events than a normal server.', 'servers'],
    ['linuxServers', 'Linux servers', 'Servers sending syslog or audit logs.', 'servers'],
    ['p2Servers', 'Servers covered by Defender for Servers Plan 2', 'If the customer has Defender for Servers Plan 2, Microsoft includes 500 MB per server per day (pooled) of free ingestion for some server security tables.', 'servers', 'p2Servers']]],
  ['Network', [
    ['firewalls', 'Firewalls sending logs', 'Perimeter and internal firewalls. Volume per firewall varies a lot with traffic; this is an average.', 'firewalls'],
    ['proxyUsers', 'Users behind a web proxy / SWG', 'People whose web traffic is logged by a proxy or secure web gateway.', 'users']]],
  ['Cloud & applications', [
    ['azureSubs', 'Azure subscriptions', 'Each subscription produces free control-plane (Activity) logs.', 'subscriptions'],
    ['azureResources', 'Azure resources sending diagnostics', 'VMs, databases, key vaults, storage accounts and so on whose data-plane logs you want.', 'resources'],
    ['awsAccounts', 'AWS accounts', 'Accounts sending CloudTrail (and optionally flow logs).', 'accounts'],
    ['gcpProjects', 'Google Cloud projects', 'Projects sending audit logs.', 'projects'],
    ['saasApps', 'Business apps with audit logs', 'Okta, Salesforce, ServiceNow, Workday and similar. Count only the apps that hold sensitive data or control access.', 'apps']]],
  ['Operational technology', [
    ['otSites', 'OT / industrial sites', 'Plants, substations or sites with industrial control networks you want monitored.', 'sites']]]
];

const SIEMS = { splunk: ['Splunk', 'gbday', 'Daily ingest licence (GB/day), or the 30-day average from the Licensing / Usage report.'], qradar: ['IBM QRadar', 'eps', 'Average events per second from Admin > System and License Management (or the EPS licence).'], xsiam: ['Palo Alto Cortex XSIAM', 'gbday', 'Daily ingestion in GB/day from the tenant usage dashboard.'], arcsight: ['ArcSight', 'eps', 'Average events per second from the Logger / ESM health dashboard.'], logrhythm: ['LogRhythm', 'eps', 'Average messages per second (MPS); treat as events per second.'], elastic: ['Elastic Security', 'gbday', 'Daily ingest volume from Stack Monitoring or the licence view.'], sumo: ['Sumo Logic', 'gbday', 'Daily ingest from Account > Data Management.'], secops: ['Google SecOps (Chronicle)', 'gbday', 'Daily ingestion from the ingestion metrics dashboard.'], other: ['Other SIEM / log platform', 'gbday', 'Use the average daily volume the customer sends to it.'] };
/* ---------- navigation ---------- */
App.goStep = function (n) { if (n > 1 && !App.ready()) { App.setErr('Choose an industry and enter the number of employees first.'); n = 1; } else if (n > 1) App.setErr(''); S.step = n; document.querySelectorAll('#stepper button').forEach((b) => { const k = +b.dataset.step; b.classList.toggle('on', k === n); b.classList.toggle('done', k < n); }); App.renderStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
App.renderStep = function (n) {
  for (let i = 1; i <= 5; i++) $('p' + i).hidden = i !== n;
  if (n === 5) { App.recompute(); App.renderResults(); return; }
  $('p' + n).innerHTML = [null, step1, step2, step3, step4][n](); document.querySelectorAll('#p' + n + ' .int').forEach((e) => { e.hidden = S.mode === 'customer'; });
  if (n === 3) cells3(); if (n === 4) cells4();
};
const nav = (n) => '<div class="nav2"><button class="btn" type="button" data-go="' + (n - 1) + '"' + (n === 1 ? ' style="visibility:hidden"' : '') + '>← Back</button><button class="btn dark" type="button" data-go="' + (n + 1) + '">' + (n === 4 ? 'See results →' : 'Next →') + '</button></div>';

function baselineHtml(st) {
  const b = st.baseline; if (b.mode !== 'migration') return '<p class="small muted" style="margin:0">We will estimate log volumes from the customer\'s estate in the next steps.</p>';
  const m = SIEMS[b.siem] || SIEMS.other;
  return '<div class="grid g2"><label class="f">Current SIEM<select data-path="baseline.siem" data-siem>' + Object.keys(SIEMS).map((k) => '<option value="' + k + '"' + (b.siem === k ? ' selected' : '') + '>' + SIEMS[k][0] + '</option>').join('') + '</select></label>' +
    '<label class="f">Measured as<select data-path="baseline.unit">' + [['gbday', 'GB per day'], ['eps', 'Events per second (EPS)']].map((o) => '<option value="' + o[0] + '"' + (b.unit === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
    '<label class="f">Current daily volume (' + (b.unit === 'eps' ? 'events per second' : 'GB per day') + ')<input type="number" min="0" step="any" data-path="baseline.value" data-num value="' + (C.num(b.value) || '') + '"><small id="blHelp">' + esc(m[2]) + '</small></label>' +
    (b.unit === 'eps' ? '<label class="f">Average event size (bytes) ' + hint('Used to turn events per second into gigabytes per day. 500 bytes is a common average; firewall logs run larger, authentication logs smaller.') + '<input type="number" min="50" step="10" data-path="baseline.evBytes" data-num value="' + b.evBytes + '"></label>' : '') +
    '<label class="f int">Conversion factor to Sentinel ' + hint('Sentinel bills on what it ingests, which can differ from the old SIEM (different parsing, enrichment, filtering). 1.0 means the same volume. Raise it if the old SIEM filtered heavily; lower it if it enriched events.') + '<input type="number" min="0.1" step="0.05" data-path="baseline.factor" data-num value="' + b.factor + '"></label></div>' +
    '<p class="small" style="margin:8px 0 0"><b id="blCalc">' + (C.baselineGb(b) > 0 ? '≈ ' + gb(C.baselineGb(b)) + ' GB/day into Sentinel' : 'Enter the current volume') + '</b> <span class="muted">· Take this as it is, or set known sources in step 3 and the rest will rebalance to the same total. Range narrows because this is measured data.</span></p>';
}
/* ---------- step 1: customer ---------- */
function step1() {
  const st = S.st, V = C.VERTICALS;
  return '<h2>Tell us about the customer</h2><p class="lead">Start with the basics. We load a typical estate for their industry and size, which you can refine together in the next steps.</p>' +
    '<div class="grid g2"><label class="f">Customer name<input type="text" data-path="company" placeholder="e.g. Acme Bank" value="' + esc(st.company) + '"></label>' +
    '<label class="f">Employees / seats ' + hint('Roughly how many people work at the customer. Every estimate scales from this number; you can fine-tune individual items in step 2.') + '<input type="number" min="10" step="10" data-path="drivers.seats" data-num data-seats placeholder="e.g. 2500" value="' + (st.chosen && st.chosen.seats ? st.drivers.seats : '') + '"></label></div>' +
    '<div class="sec"><h3>Industry ' + hint('Different industries produce different amounts of security logs and keep them for different periods. Picking one loads typical figures; nothing is locked in.') + '</h3><div class="vcards" style="margin-top:8px">' +
    Object.keys(V).map((k) => '<button type="button" class="vc' + (st.vertical === k && st.chosen && st.chosen.vertical ? ' on' : '') + '" data-vert="' + k + '"><span class="ic">' + V[k].icon + '</span><b>' + V[k].label + '</b><span>' + V[k].desc + '</span></button>').join('') + '</div></div>' +
    '<div class="sec"><h3>Starting point ' + hint('Greenfield means the customer has no SIEM yet, so we estimate from their estate. If they are moving from another SIEM, their current daily volume is the best starting figure we can get in a workshop. You can take it as it is or refine it source by source in step 3.') + '</h3><div class="seg" id="blSeg" style="margin:8px 0"><button type="button" data-set="baseline.mode=greenfield" class="' + (st.baseline.mode === 'migration' ? '' : 'on') + '">Greenfield: no SIEM today</button><button type="button" data-set="baseline.mode=migration" class="' + (st.baseline.mode === 'migration' ? 'on' : '') + '">Migrating from another SIEM</button></div>' + baselineHtml(st) + '</div>' +
    '<div class="sec"><h3>Microsoft 365 licensing ' + hint('Microsoft 365 E5 includes free Sentinel ingestion of eligible Microsoft logs: 5 MB per licensed user per day, pooled across the tenant. It can reduce the bill noticeably, so it is worth asking about.') + '</h3><div class="grid g2" style="margin-top:8px">' +
    '<label class="f">Licence level<select data-path="m365">' + [['E5', 'Microsoft 365 E5 (or E5 Security)'], ['E3', 'Microsoft 365 E3 / Business Premium'], ['none', 'Other / not sure']].map((o) => '<option value="' + o[0] + '"' + (st.m365 === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
    '<label class="f">Licensed users<input type="number" min="0" data-path="licensed" data-num value="' + st.licensed + '"></label></div></div>' +
    '<div class="sec"><h3>✨ Or describe it in your own words <span class="pill ai">optional · AI</span></h3><p class="lead" style="margin-bottom:8px">Paste a sentence from your discovery notes and we will fill in the estate. You can correct anything afterwards.</p>' +
    '<textarea id="aiText" placeholder="e.g. UK insurer, about 3,500 staff, two data centres, Microsoft 365 E5, Azure and some AWS, Okta and Salesforce, Palo Alto firewalls"></textarea><div class="row" style="margin-top:8px"><button id="aiFill" class="btn" type="button">✨ Fill from description</button><span id="aiMsg" class="small muted"></span></div></div>' +
    '<div class="sec int"><h3>Currency</h3><div class="row"><div class="seg" id="curSeg"><button type="button" data-cur="GBP" class="' + (st.cur === 'GBP' ? 'on' : '') + '">£ GBP</button><button type="button" data-cur="USD" class="' + (st.cur === 'USD' ? 'on' : '') + '">$ USD</button></div><label class="small muted ' + (st.cur === 'USD' ? '' : 'hidden') + '" id="fxBox">1 GBP = <input type="number" step="0.01" min="0.1" style="width:80px;display:inline" data-path="fx" data-num value="' + st.fx + '"> USD</label></div></div>' + nav(1);
}
function applyVertical(k) {
  const keep = { company: S.st.company, seats: S.st.drivers.seats, cur: S.st.cur, fx: S.st.fx, rates: S.st.rates, rateSource: S.st.rateSource, svc: S.st.svc, commercial: S.st.commercial, m365: S.st.m365, baseline: S.st.baseline, deal: S.st.deal, soc: S.st.soc, chosen: S.st.chosen };
  const n = C.defaultState(k, keep.seats); Object.assign(n, { company: keep.company, cur: keep.cur, fx: keep.fx, rates: keep.rates, rateSource: keep.rateSource, svc: keep.svc, commercial: keep.commercial, m365: keep.m365, baseline: keep.baseline || n.baseline, deal: keep.deal || n.deal, soc: keep.soc || n.soc, chosen: Object.assign({}, keep.chosen || {}, { vertical: true }) }); S.st = n; S.touched = false; S.usage = null;
}
function reseat(seats) { const d = C.typicalDrivers(S.st.vertical, seats); S.st.drivers = d; S.st.licensed = d.seats; S.st.p2Servers = d.winServers + d.dcs; const v = C.VERTICALS[S.st.vertical]; if (v.ot < 0.3) { /* keep OT off for non-OT */ } }

/* ---------- step 2: environment ---------- */
function step2() {
  const st = S.st, v = C.VERTICALS[st.vertical];
  return '<h2>Describe the environment</h2><p class="lead">These numbers are our typical figures for a <b>' + esc(v.label.toLowerCase()) + '</b> organisation with ' + fmt(st.drivers.seats) + ' people. Replace any of them with what the customer tells you. Everything else updates as you type.</p>' +
    '<div class="row" style="margin-bottom:12px"><button id="resetTypical" class="btn sm" type="button">↺ Reset to typical for this industry and size</button><span class="small muted" id="touchedMsg">' + (S.touched ? 'You have changed some values.' : 'Showing typical values.') + '</span></div>' +
    ENV.map((g) => '<div class="sec"><h3>' + g[0] + '</h3><div class="envg" style="margin-top:8px">' + g[1].map((f) => { const path = f[4] || 'drivers.' + f[0]; return '<label class="f">' + f[1] + hint(f[2]) + '<input type="number" min="0" step="' + (f[0] === 'otSites' ? 1 : 1) + '" data-path="' + path + '" data-num data-drv value="' + C.num(App.getPath(st, path)) + '"><small>' + f[3] + '</small></label>'; }).join('') + '</div></div>').join('') + nav(2);
}

/* ---------- step 3: log sources ---------- */
const TIER_OPTS = [['analytics', 'Analytics'], ['basic', 'Basic'], ['aux', 'Auxiliary'], ['lake', 'Data lake'], ['off', 'Not collected']];
function step3() {
  const st = S.st;
  let rows = '';
  C.GROUPS.forEach((gname, gi) => {
    const list = C.SOURCES.filter((s) => s.g === gi); if (!list.length) return;
    rows += '<tr class="grp"><td colspan="7">' + gname + '</td></tr>';
    list.forEach((s) => { const x = st.sources[s.id];
      rows += '<tr id="r-' + s.id + '" class="' + (x.on ? '' : 'off') + '"><td class="keep"><label class="tog"><input type="checkbox" data-src="' + s.id + '"' + (x.on ? ' checked' : '') + ' aria-label="Include ' + esc(s.name) + '"><span></span></label></td>' +
        '<td class="keep"><b>' + esc(s.name) + '</b>' + hint(s.why + (s.note ? ' ' + s.note : '')) + ' <span id="bd-' + s.id + '"></span></td>' +
        '<td class="n" id="un-' + s.id + '"></td><td class="n"><input type="number" min="0" step="0.1" data-ovr="' + s.id + '" id="ov-' + s.id + '" title="Type a known GB/day to override the estimate"><div class="tiny muted" id="rg-' + s.id + '"></div></td>' +
        '<td><select data-tier="' + s.id + '">' + TIER_OPTS.filter((o) => o[0] === 'analytics' || o[0] === 'off' || s.basicOk || o[0] === 'lake' || o[0] === 'aux' || o[0] === 'basic').map((o) => '<option value="' + o[0] + '"' + (x.tier === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></td>' +
        '<td class="n" id="mo-' + s.id + '"></td></tr>'; });
  });
  return '<h2>Choose the log sources</h2><p class="lead">Sentinel is billed by how much data you send it. Switch sources on or off, and choose where each one goes: the destination changes the price a lot. Hover the <b>i</b> icons for plain-English explanations.</p>' +
    '<details class="callout" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">What do the destinations mean? And what is free?</summary><div style="margin-top:8px" class="small">' +
    '<p><b>Analytics</b>: full-price, real-time. Use for anything that must raise an alert quickly (identity, endpoint, key security logs). Includes 90 days of searchable history.</p>' +
    '<p><b>Basic</b>: much cheaper, with limited querying and short retention. Good for high-volume logs you only search when investigating.</p>' +
    '<p><b>Auxiliary</b>: cheapest ingestion, long retention, slower queries. For very verbose logs kept for compliance or forensics.</p>' +
    '<p><b>Data lake</b>: low-cost long-term storage you can still query and analyse, ideal for flow logs and history.</p>' +
    '<p><b>Free from Microsoft</b> (verify current terms): Azure Activity, Office 365 audit logs, and Microsoft security alerts are free to ingest. Microsoft 365 E5 includes 5 MB per user per day of free ingestion for eligible data, and Defender for Servers Plan 2 includes 500 MB per server per day. We apply these automatically.</p>' +
    '<p class="muted">Which tables can use Basic or Auxiliary depends on the table; the tool is a planning aid, not a configuration check.</p></div></details>' +
    '<div class="card2" style="margin-bottom:14px"><div class="row between"><div><h4>Have real numbers? Make the estimate firmer ' + hint('Run this query in the customer\'s Log Analytics workspace, export the result as CSV and upload it. We replace our estimates with their measured volumes and narrow the likely range. In Log Analytics: Usage | where TimeGenerated > ago(30d) | where IsBillable == true | summarize Quantity=sum(Quantity) by DataType, Day=bin(TimeGenerated,1d)') + '</h4><p class="small muted" style="margin:0" id="usageMsg">' + (S.usage ? 'Measured volumes applied from ' + S.usage.days + ' days of usage (' + S.usage.sources + ' sources).' : 'Optional: upload a Log Analytics usage export (CSV).') + '</p></div><div><label class="btn sm" for="usageFile" style="cursor:pointer">⬆ Upload usage CSV</label><input id="usageFile" type="file" accept=".csv,text/csv" hidden></div></div></div>' +
    '<div class="tw"><table><thead><tr><th>Include</th><th>Source</th><th class="n">Based on</th><th class="n">GB/day expected</th><th>Send to</th><th class="n">≈ £/month</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td></td><td class="bold">Total</td><td></td><td class="n bold" id="t3gb"></td><td id="t3note" class="small muted"></td><td class="n bold" id="t3mo"></td></tr></tfoot></table></div>' +
    '<p class="tiny muted" style="margin-top:8px">The table shows the most likely volume. Underneath each number is the low to high range we use for the simulation. "≈ £/month" is each source\'s share of the bill after free ingestion and allowances.</p>' + nav(3);
}
function cells3() {
  const r = S.res || (App.recompute(), S.res); if (!r) return; const st = S.st;
  r.perSource.forEach((x) => { const s = C.SRC[x.id], row = $('r-' + x.id); if (!row) return;
    row.className = x.on ? '' : 'off'; $('un-' + x.id).textContent = fmt(x.units) + ' ' + x.unit + (x.units === 1 ? '' : 's'); const ov = $('ov-' + x.id);
    if (document.activeElement !== ov) { const o = st.sources[x.id].override; ov.value = o != null && o !== '' ? o : (x.exp ? +x.exp.toFixed(x.exp < 1 ? 3 : 1) : 0); }
    ov.style.background = st.sources[x.id].override != null ? '#fff8e1' : ''; $('rg-' + x.id).textContent = x.on ? gb(x.lo) + ' to ' + gb(x.hi) : '';
    $('mo-' + x.id).textContent = !x.on ? '–' : x.free ? 'Free' : money(x.month);
    $('bd-' + x.id).innerHTML = (x.measured ? '<span class="pill ok" style="background:var(--okb)">measured</span> ' : '') + (x.free ? '<span class="pill free">free</span>' : x.e5 && st.m365 === 'E5' ? '<span class="pill al">E5 allowance</span>' : x.s2 && st.p2Servers > 0 ? '<span class="pill al">Servers P2 allowance</span>' : ''); });
  $('t3gb').textContent = gb(r.sum.total) + ' GB/day'; $('t3mo').textContent = money(r.cost.total); $('t3note').textContent = 'Billable analytics: ' + gb(r.sum.analyticsBillable) + ' GB/day after ' + gb(r.sum.free + r.sum.allow.e5 + r.sum.allow.s2) + ' GB/day free';
}

/* ---------- step 4: automation & service ---------- */
function seg(path, opts, cur, num) { return '<div class="seg">' + opts.map((o) => '<button type="button" data-set="' + path + '=' + o[0] + '"' + (num ? ' data-n="1"' : '') + ' class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div>'; }
function commercialsHtml(st) {
  const d = st.deal, r = S.res, tiers = C.tierOptions(C.rateMap(st.rates));
  const models = [['package', 'Fixed package', 'One monthly fee for a defined scope. Simple to budget; usage above the included amounts is flagged.'], ['pergb', 'Per GB monitored', 'Scales with the volume of data we monitor. Fair for fast-growing estates.'], ['persource', 'Per log source', 'Scales with the number of systems we onboard and monitor.'], ['mixed', 'Package + usage', 'A base package plus a charge for extra sources or data beyond what is included.']];
  return '<div class="sec"><h3>Commercial options ' + hint('Choose how the customer wants to buy. Everything below can be changed live in the meeting and the quote updates.') + '</h3>' +
    '<div class="cgrid"><div><div class="small bold">Contract length ' + hint('Longer terms attract a discount on the managed service fee. Microsoft consumption is not discounted for term.') + '</div>' + seg('deal.term', [[1, '1 year'], [3, '3 years'], [5, '5 years']], d.term, true) + '</div>' +
    '<div><div class="small bold">Microsoft consumption ' + hint('Pay-as-you-go bills actual usage at the standard rate. A commitment tier is a daily amount agreed in advance at a lower rate per GB. Best fit picks the cheapest option for the expected volume.') + '</div><select data-path="deal.tier"><option value="auto"' + (d.tier === 'auto' ? ' selected' : '') + '>Best fit (recommended)</option>' + tiers.map((t) => '<option value="' + t.id + '"' + (d.tier === t.id ? ' selected' : '') + '>' + t.label + '</option>').join('') + '</select></div>' +
    '<div><div class="small bold">If volumes differ from the estimate ' + hint('True-up: the customer pays for what is actually used and we reconcile at each anniversary, resetting the commitment if needed. Cap: the Microsoft cost is held at a ceiling up to a stated volume; anything above it is either billed at an agreed overage rate or absorbed.') + '</div>' + seg('deal.risk', [['trueup', 'Pay actual + annual true-up'], ['cap', 'Budget cap']], d.risk) + '</div></div>' +
    (d.risk === 'cap' ? '<div class="cgrid" style="margin-top:10px"><label class="f">Cap at (billable GB/day) ' + hint('Leave empty to use our suggestion (high-end of the likely range).') + '<input type="number" min="0" step="10" data-path="deal.capGb" data-num value="' + (C.num(d.capGb) || '') + '" placeholder="' + (r ? r.quote.capGb : '') + '"></label><div><div class="small bold">Above the cap</div>' + seg('deal.overMode', [['billed', 'Bill overage at agreed rate'], ['absorbed', 'We absorb it']], d.overMode) + '</div></div>' : '') +
    '<div class="small bold" style="margin:14px 0 6px">How should the managed service be priced? ' + hint('The same service, priced four ways. Show the customer the one that fits how they like to buy.') + '</div><div class="tcards">' +
    models.map((m) => '<button type="button" class="tcard' + (d.pricing === m[0] ? ' on' : '') + '" data-set="deal.pricing=' + m[0] + '"><b>' + m[1] + '</b><span>' + m[2] + '</span><strong id="sv-' + m[0] + '" style="display:block;margin-top:6px;font-size:15px"></strong></button>').join('') + '</div><p class="small muted" id="svcFit" style="margin-top:8px"></p>' +
    '<p class="small int" id="marginNote" style="margin-top:6px"></p></div>';
}
function step4() {
  const st = S.st, v = C.VERTICALS[st.vertical], T = C.SVC_TIERS, cov = C.COVERAGE;
  const rateRows = st.rates.map((x) => '<tr><td><code class="tiny">' + x.id + '</code></td><td class="small">' + esc(x.desc) + '</td><td class="tiny muted">' + x.unit + '</td><td class="n"><input type="number" step="any" min="0" data-rate="' + x.id + '" value="' + x.price + '"></td></tr>').join('');
  const svcIn = [['fteCost', 'Loaded analyst cost (£ per FTE per year)'], ['overhead', 'Tooling & overhead (fraction)'], ['productive', 'Productive hours per FTE per year'], ['margin', 'Target service margin (fraction)'], ['dayRate', 'Day rate for engineering & hunting (£)']];
  return '<h2>Service and commercials</h2><p class="lead">What is automated, how it is monitored, and how the customer wants to buy it.</p>' +
    '<div class="sec" style="border-top:0;margin-top:0"><h3>Automation (SOAR) ' + hint('SOAR means security orchestration, automation and response. In Sentinel these are playbooks (built on Azure Logic Apps) that act on incidents automatically, for example disabling a compromised account. They cost very little to run; the real saving is analyst time.') + '</h3><p class="lead" style="margin-bottom:8px">Switch on the playbooks the customer wants. Run counts are estimated from the number of people and industry.</p>' +
    '<div class="tw"><table><thead><tr><th>On</th><th>Playbook</th><th class="n">Runs / month</th><th class="n">Actions / run</th><th class="n">≈ £/month</th></tr></thead><tbody>' +
    C.PLAYBOOKS.map((p) => '<tr><td><label class="tog"><input type="checkbox" data-pb="' + p.id + '"' + (st.soar[p.id] ? ' checked' : '') + ' aria-label="Enable ' + esc(p.name) + '"><span></span></label></td><td><b>' + esc(p.name) + '</b>' + hint(p.why) + '</td><td class="n" id="pr-' + p.id + '"></td><td class="n">' + p.actions + '</td><td class="n" id="pc-' + p.id + '"></td></tr>').join('') +
    '</tbody><tfoot><tr><td></td><td class="bold">Total</td><td class="n bold" id="pbRuns"></td><td></td><td class="n bold" id="pbCost"></td></tr></tfoot></table></div></div>' +
    '<div class="sec"><h3>Managed service ' + hint('How much of the day-to-day security monitoring BT would do for the customer. More automation means analysts spend less time per incident, which keeps the service price down.') + '</h3>' +
    '<div style="margin:8px 0"><div class="small bold" style="margin-bottom:6px">Hours of cover</div><div class="seg" id="covSeg">' + Object.keys(cov).map((k) => '<button type="button" data-cov="' + k + '" class="' + (st.soc.coverage === k ? 'on' : '') + '">' + cov[k].label + '</button>').join('') + '</div></div>' +
    '<div class="tcards">' + Object.keys(T).map((k) => '<button type="button" class="tcard' + (st.soc.tier === k ? ' on' : '') + '" data-svc="' + k + '"><b>' + T[k].label + '</b><span>' + T[k].desc + '</span></button>').join('') + '</div>' +
    '<p class="small muted" style="margin-top:8px" id="svcNote"></p>' +
    '</div>' + commercialsHtml(st) +
    '<div class="sec"><h3>Retention and planning</h3><div class="envg" style="margin-top:8px">' +
    '<label class="f">Keep security logs for (months)' + hint(v.retWhy + ' Analytics includes about 90 days; longer retention is charged per GB per month.') + '<select data-path="levers.retention" data-num>' + [3, 6, 12, 18, 24, 36, 60, 84].map((m) => '<option value="' + m + '"' + (+st.levers.retention === m ? ' selected' : '') + '>' + m + ' months</option>').join('') + '</select></label>' +
    '<label class="f">Expected data growth per year (%)' + hint('Log volumes usually grow as the customer adds users, cloud workloads and sources. 10 to 25 percent a year is common.') + '<input type="number" min="0" max="100" data-path="levers.growth" data-num value="' + st.levers.growth + '"></label>' +
    '<label class="f">How certain are the volume estimates?' + hint('Wider means the simulation allows for bigger swings either side of our estimate. Choose "Measured" once you have loaded real usage data.') + '<select data-path="levers.spread" data-num>' + [[1.5, 'Early estimate (wide range)'], [1, 'Typical'], [0.5, 'Well understood (narrow range)'], [0.3, 'Measured from real usage']].map((o) => '<option value="' + o[0] + '"' + (+st.levers.spread === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label></div></div>' +
    '<div class="sec int"><h3>🔧 Price book <span class="pill mx">internal</span></h3><p class="lead" style="margin-bottom:8px">Hidden in Customer view. Microsoft rates, service packages, onboarding and term discounts all live in one price book. Values tagged PLACEHOLDER are not real prices: download the template, fill it in, and import it.</p>' +
    '<div class="row" style="margin-bottom:8px"><button id="rateTpl" class="btn sm" type="button">⬇ Price book template (CSV)</button><label class="btn sm" for="rateFile" style="cursor:pointer">⬆ Import price book</label><input id="rateFile" type="file" accept=".csv,text/csv" hidden><span id="rateMsg" class="small ' + (st.rateSource === 'default' ? 'err' : 'ok') + '">' + (st.rateSource === 'default' ? 'Using placeholder rates.' : 'Using your rates.') + '</span></div>' +
    '<details><summary style="cursor:pointer;font-weight:700;margin-bottom:8px">View / edit price book (GBP)</summary><div class="tw"><table><thead><tr><th>Item</th><th>Description</th><th>Unit</th><th class="n">Price (£)</th></tr></thead><tbody>' + rateRows + '</tbody></table></div></details>' +
    '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;margin-bottom:8px">Cost-to-serve model (used only for the internal margin check)</summary><div class="envg">' + svcIn.map((x) => '<label class="f">' + x[1] + '<input type="number" step="any" min="0" data-path="svc.' + x[0] + '" data-num value="' + st.svc[x[0]] + '"></label>').join('') + '</div></details>' + App.brandHtml() + '</div>' + nav(4);
}
function cells4() {
  const r = S.res || (App.recompute(), S.res); if (!r) return;
  r.soar.rows.forEach((x) => { const a = $('pr-' + x.id), b = $('pc-' + x.id); if (a) { a.textContent = x.on ? fmt(x.runs) : '–'; b.textContent = x.on ? money(x.cost, 2) : '–'; } });
  $('pbRuns').textContent = fmt(r.soar.runs); $('pbCost').textContent = money(r.soar.cost, 2);
  const q = r.quote; ['package', 'pergb', 'persource', 'mixed'].forEach((k) => { const e = $('sv-' + k); if (e) e.textContent = money(q.svc.models[k] * (1 - q.tdisc)) + ' / month'; });
  const m = q.svc.models, fit = $('svcFit'); if (fit) fit.textContent = 'This customer: ' + m.srcOn + ' log sources and about ' + gb(m.gb) + ' GB/day monitored. The selected package includes ' + m.inc.src + ' sources and ' + m.inc.gb + ' GB/day' + (m.fits ? ', so everything fits.' : ', so ' + (m.over.src ? m.over.src + ' extra source' + (m.over.src === 1 ? '' : 's') : '') + (m.over.src && m.over.gb > 0 ? ' and ' : '') + (m.over.gb > 0 ? gb(m.over.gb) + ' extra GB/day' : '') + ' fall outside it. A fixed package alone would understate the scope; use Package + usage or per-GB.') + (q.tdisc ? ' Term discount of ' + Math.round(q.tdisc * 100) + '% applied.' : '');
  const mn = $('marginNote'); if (mn) mn.textContent = 'Internal: estimated cost to serve ' + money(r.soc.sub) + ' / month against a service price of ' + money(q.svc.fee) + ' / month, a margin of ' + Math.round(q.margin * 100) + '%.' + (q.margin < 0.2 ? ' ⚠ Below target margin: check the price book.' : '');
  const sv = r.soc; $('svcNote').textContent = 'About ' + r.soar.incPerDay.toFixed(1) + ' incidents a day. Automation removes about ' + Math.round(r.soar.deflect * 100) + '% of analyst effort, leaving roughly ' + sv.minsEff.toFixed(0) + ' minutes of analyst time per incident.';
}

/* ---------- events ---------- */
function onInput(e) {
  const t = e.target, st = S.st;
  if (t.dataset.path) { let v = t.type === 'number' || t.dataset.num != null ? C.num(t.value) : t.value; if (t.dataset.path === 'levers.retention' || t.dataset.path === 'levers.spread') v = +t.value;
    App.setPath(st, t.dataset.path, v);
    if (t.dataset.seats != null) { st.chosen = st.chosen || {}; st.chosen.seats = v >= 10; }
    if (t.dataset.seats != null && !S.touched) { reseat(v); } else if (t.dataset.seats != null) { st.licensed = Math.min(st.licensed, v) || v; }
    if (t.dataset.drv != null) { S.touched = true; const m = $('touchedMsg'); if (m) m.textContent = 'You have changed some values.'; }
    if (t.dataset.path === 'fx') { st.fx = v || 1.27; }
    if (t.dataset.path.startsWith('baseline.')) { const c = $('blCalc'); if (c) c.textContent = C.baselineGb(st.baseline) > 0 ? '≈ ' + gb(C.baselineGb(st.baseline)) + ' GB/day into Sentinel' : 'Enter the current volume'; }
    App.refresh(); return; }
  if (t.dataset.rate) { const it = st.rates.find((x) => x.id === t.dataset.rate); if (it) it.price = Math.max(0, C.num(t.value)); st.rateSource = st.rateSource === 'default' ? 'manual' : st.rateSource; App.refresh(); return; }
  if (t.dataset.ovr) { const x = st.sources[t.dataset.ovr]; x.override = t.value === '' ? null : Math.max(0, C.num(t.value)); App.refresh(); return; }
}
function onChange(e) {
  const t = e.target, st = S.st;
  if (t.dataset.src) { st.sources[t.dataset.src].on = t.checked; App.recompute(); return; }
  if (t.dataset.tier) { st.sources[t.dataset.tier].tier = t.value; if (t.value === 'off') st.sources[t.dataset.tier].on = false; else st.sources[t.dataset.tier].on = true; const c = document.querySelector('[data-src="' + t.dataset.tier + '"]'); if (c) c.checked = st.sources[t.dataset.tier].on; App.recompute(); return; }
  if (t.dataset.pb) { st.soar[t.dataset.pb] = t.checked; App.recompute(); return; }
  if (t.dataset.path === 'm365') { st.m365 = t.value; App.recompute(); return; }
  if (t.dataset.siem != null) { const m = SIEMS[t.value] || SIEMS.other; st.baseline.siem = t.value; st.baseline.unit = m[1]; App.recompute(); App.renderStep(1); return; }
  if (t.dataset.path === 'baseline.unit') { st.baseline.unit = t.value; App.recompute(); App.renderStep(1); return; }
  if (t.dataset.path && t.tagName === 'SELECT') { App.setPath(st, t.dataset.path, t.dataset.num != null ? +t.value : t.value); App.recompute(); return; }
  if (t.id === 'usageFile') { const f = t.files[0]; t.value = ''; if (f) f.text().then((txt) => { try { const u = C.calibrateFromUsage(st, txt); S.usage = u; if (u.sources >= 5) st.levers.spread = 0.3; else st.levers.spread = Math.min(st.levers.spread, 0.6); App.setErr(''); App.recompute(); App.renderStep(3); } catch (err) { App.setErr('Usage file: ' + err.message); } }); return; }
  if (t.id === 'rateFile') { const f = t.files[0]; t.value = ''; if (f) f.text().then((txt) => { try { const r = C.ratesFromCsv(txt, st.rates); st.rates = r.rates; st.rateSource = 'csv'; App.setErr(''); App.recompute(); App.renderStep(4); const m = $('rateMsg'); if (m) { m.textContent = 'Loaded ' + r.updated + ' rates' + (r.unknown.length ? ' (' + r.unknown.length + ' unrecognised items ignored)' : '') + '.'; m.className = 'small ok'; } } catch (err) { App.setErr('Rate card: ' + err.message); } }); }
}
async function onClick(e) {
  const t = e.target.closest('button, [data-go]'); if (!t) return; const st = S.st;
  if (t.dataset.hint != null) { const n = t.nextElementSibling; if (n) n.hidden = !n.hidden; return; }
  if (t.dataset.go) { App.goStep(+t.dataset.go); return; }
  if (t.dataset.vert) { applyVertical(t.dataset.vert); App.recompute(); App.renderStep(1); return; }
  if (t.dataset.cur) { st.cur = t.dataset.cur; if (st.cur === 'USD' && !(st.fx > 0)) st.fx = 1.27; App.renderStep(1); App.recompute(); return; }
  if (t.dataset.set) { const [path, val] = t.dataset.set.split('='); App.setPath(st, path, t.dataset.n ? +val : val); App.recompute(); App.renderStep(S.step); return; }
  if (t.dataset.cov) { st.soc.coverage = t.dataset.cov; document.querySelectorAll('#covSeg button').forEach((b) => b.classList.toggle('on', b === t)); App.recompute(); return; }
  if (t.dataset.svc) { st.soc.tier = t.dataset.svc; document.querySelectorAll('.tcard').forEach((b) => b.classList.toggle('on', b === t)); App.recompute(); return; }
  if (t.dataset.com && false) { st.commercial = t.dataset.com; document.querySelectorAll('#comSeg button').forEach((b) => b.classList.toggle('on', b === t)); App.recompute(); return; }
  if (t.id === 'resetTypical') { const d = C.typicalDrivers(st.vertical, st.drivers.seats); st.drivers = d; st.licensed = d.seats; st.p2Servers = d.winServers + d.dcs; S.touched = false; App.recompute(); App.renderStep(2); return; }
  if (t.id === 'rateTpl') { App.dl(new Blob([C.ratesToCsv(st.rates)], { type: 'text/csv' }), 'sentinel_price_book.csv'); return; }
  if (t.id === 'aiFill') await aiFill();
}
async function aiFill() {
  const txt = ($('aiText').value || '').trim(), msg = $('aiMsg'); if (txt.length < 10) { msg.textContent = 'Please type a short description first.'; return; }
  msg.textContent = 'Reading…'; $('aiFill').disabled = true;
  try {
    const keys = Object.keys(C.VERTICALS).join(', ');
    const prompt = 'You extract facts about a customer\'s IT estate for a Microsoft Sentinel sizing tool. Use only what the text states; omit anything not stated or clearly implied. Do not invent numbers.\nTEXT: """' + txt.slice(0, 2000) + '"""\nReturn ONLY JSON: {"company":string,"vertical":one of [' + keys + '] or "","seats":number,"m365":"E5"|"E3"|"none"|"","endpoints":number,"winServers":number,"dcs":number,"linuxServers":number,"firewalls":number,"saasApps":number,"azureSubs":number,"azureResources":number,"awsAccounts":number,"gcpProjects":number,"otSites":number}. Use 0 for unknown numbers.';
    const j = App.extractJSON(await App.generate(prompt, { max: 1200, temp: 0.1 })), st = S.st;
    if (C.VERTICALS[j.vertical]) applyVertical(j.vertical); S.st.chosen = S.st.chosen || {}; if (j.company) S.st.company = String(j.company).slice(0, 80); const seats = Math.round(C.clamp(C.num(j.seats), 0, 1000000));
    if (seats >= 10) { S.st.chosen.seats = true; S.st.drivers = C.typicalDrivers(S.st.vertical, seats); S.st.licensed = seats; S.st.p2Servers = S.st.drivers.winServers + S.st.drivers.dcs; }
    let n = 0; ['endpoints', 'winServers', 'dcs', 'linuxServers', 'firewalls', 'saasApps', 'azureSubs', 'azureResources', 'awsAccounts', 'gcpProjects', 'otSites'].forEach((k) => { const v = Math.round(C.clamp(C.num(j[k]), 0, 1000000)); if (v > 0) { S.st.drivers[k] = v; n++; } });
    if (['E5', 'E3', 'none'].includes(j.m365)) S.st.m365 = j.m365; if (n) S.touched = true; S.st.p2Servers = Math.min(S.st.p2Servers, S.st.drivers.winServers + S.st.drivers.dcs);
    App.recompute(); App.renderStep(1); const m2 = $('aiMsg'); if (m2) m2.innerHTML = '✔ Filled in. Review the values in step 2. <span class="pill ai">✨ AI-read</span>';
  } catch (err) { msg.textContent = 'Could not read that: ' + err.message; } finally { const b = $('aiFill'); if (b) b.disabled = false; }
}
App.bindSteps = function () {
  const w = document.querySelector('.wrap'); w.addEventListener('input', onInput); w.addEventListener('change', onChange); w.addEventListener('click', onClick);
  $('stepper').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) App.goStep(+b.dataset.step); });
  App.onRecompute = () => { if (S.step === 3) cells3(); else if (S.step === 4) cells4(); else if (S.step === 5 && App.updateResults) App.updateResults(); };
};
})();
