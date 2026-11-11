/* Sentinel Architect - pure estimation core (no DOM). window.SCore / module.exports.
   Every number is computed here from inputs, the volume profiles and the rate card. The AI never prices or sizes. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SCore = factory(); })(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const DAYS = 30.4, MB = 1024;
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Rate card (PLACEHOLDER defaults, GBP). Replace with current Microsoft / CSP rates via CSV. ---------- */
const TIERS = [100, 200, 300, 400, 500, 1000, 2000, 5000];
const TIER_DISC = [0.30, 0.35, 0.38, 0.40, 0.42, 0.47, 0.50, 0.53];
const PAYG = 3.30;
function defaultRates() {
  const r = [
    { id: 'ANALYTICS_PAYG_GB', desc: 'Analytics logs, pay-as-you-go (Sentinel + Log Analytics ingestion)', unit: 'GB', price: PAYG },
    ...TIERS.map((t, i) => ({ id: 'TIER_' + t, desc: `Commitment tier ${t} GB/day (price per day)`, unit: 'tier-day', price: +(t * PAYG * (1 - TIER_DISC[i])).toFixed(2) })),
    { id: 'BASIC_GB', desc: 'Basic logs ingestion', unit: 'GB', price: 0.45 },
    { id: 'AUX_GB', desc: 'Auxiliary logs ingestion', unit: 'GB', price: 0.10 },
    { id: 'LAKE_INGEST_GB', desc: 'Sentinel data lake ingestion', unit: 'GB', price: 0.04 },
    { id: 'LAKE_STORE_GB_MONTH', desc: 'Sentinel data lake storage', unit: 'GB-month', price: 0.02 },
    { id: 'RETENTION_GB_MONTH', desc: 'Analytics retention beyond the included period', unit: 'GB-month', price: 0.08 },
    { id: 'LOGICAPP_ACTION', desc: 'Logic Apps (SOAR playbook) action execution', unit: 'action', price: 0.00002 },
    { id: 'MS_RESALE_UPLIFT', desc: 'Resale uplift on Microsoft consumption (0.08 = +8%) [PLACEHOLDER]', unit: 'ratio', price: 0.08 },
    { id: 'CAP_OVERAGE_UPLIFT', desc: 'Uplift on overage above a cap when billed (0.10 = +10%) [PLACEHOLDER]', unit: 'ratio', price: 0.10 },
    { id: 'PKG_FOUNDATION_MONTH', desc: 'Package: Foundation, 24x7 monthly fee [PLACEHOLDER]', unit: 'month', price: 4500 },
    { id: 'PKG_ADVANCED_MONTH', desc: 'Package: Advanced, 24x7 monthly fee [PLACEHOLDER]', unit: 'month', price: 9500 },
    { id: 'PKG_PREMIUM_MONTH', desc: 'Package: Premium, 24x7 monthly fee [PLACEHOLDER]', unit: 'month', price: 16000 },
    { id: 'PKG_FOUNDATION_SRC', desc: 'Foundation: log sources included', unit: 'sources', price: 8 },
    { id: 'PKG_ADVANCED_SRC', desc: 'Advanced: log sources included', unit: 'sources', price: 15 },
    { id: 'PKG_PREMIUM_SRC', desc: 'Premium: log sources included', unit: 'sources', price: 25 },
    { id: 'PKG_FOUNDATION_GB', desc: 'Foundation: monitored GB/day included', unit: 'GB/day', price: 50 },
    { id: 'PKG_ADVANCED_GB', desc: 'Advanced: monitored GB/day included', unit: 'GB/day', price: 100 },
    { id: 'PKG_PREMIUM_GB', desc: 'Premium: monitored GB/day included', unit: 'GB/day', price: 200 },
    { id: 'PKG_FOUNDATION_PB', desc: 'Foundation: automation playbooks included', unit: 'playbooks', price: 2 },
    { id: 'PKG_ADVANCED_PB', desc: 'Advanced: automation playbooks included', unit: 'playbooks', price: 6 },
    { id: 'PKG_PREMIUM_PB', desc: 'Premium: automation playbooks included', unit: 'playbooks', price: 12 },
    { id: 'COV_MULT_8X5', desc: 'Service price multiplier for business-hours cover (24x7 = 1)', unit: 'ratio', price: 0.55 },
    { id: 'COV_MULT_12X5', desc: 'Service price multiplier for extended-hours cover (24x7 = 1)', unit: 'ratio', price: 0.75 },
    { id: 'PERGB_SVC_MONTH', desc: 'Per-GB model: monthly fee per monitored GB/day (Foundation basis) [PLACEHOLDER]', unit: 'GB/day-month', price: 15 },
    { id: 'PERSRC_SVC_MONTH', desc: 'Per-source model: monthly fee per log source (Foundation basis) [PLACEHOLDER]', unit: 'source-month', price: 200 },
    { id: 'SVC_MIN_MONTH', desc: 'Per-GB / per-source models: minimum monthly fee (Foundation basis)', unit: 'month', price: 3000 },
    { id: 'MIX_SRC_MONTH', desc: 'Mixed model: monthly fee per extra source above the package (Foundation basis)', unit: 'source-month', price: 150 },
    { id: 'MIX_GB_MONTH', desc: 'Mixed model: monthly fee per extra GB/day above the package (Foundation basis)', unit: 'GB/day-month', price: 10 },
    { id: 'ONB_BASE', desc: 'One-off onboarding: base fee [PLACEHOLDER]', unit: 'one-off', price: 6000 },
    { id: 'ONB_PER_SOURCE', desc: 'One-off onboarding: per log source connected and tuned', unit: 'one-off', price: 750 },
    { id: 'PLAYBOOK_BUILD', desc: 'One-off: each automation playbook above those included', unit: 'one-off', price: 900 },
    { id: 'TERM_DISC_1Y', desc: 'Service fee discount for a 1-year term (0.05 = 5%)', unit: 'ratio', price: 0 },
    { id: 'TERM_DISC_3Y', desc: 'Service fee discount for a 3-year term', unit: 'ratio', price: 0.05 },
    { id: 'TERM_DISC_5Y', desc: 'Service fee discount for a 5-year term', unit: 'ratio', price: 0.08 }
  ];
  return r;
}
const rateMap = (rates) => { const m = {}; defaultRates().forEach((x) => { m[x.id] = num(x.price); }); (rates || []).forEach((x) => { m[x.id] = num(x.price); }); return m; };
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false; text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}
function ratesFromCsv(text, base) {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('Rate card is empty');
  const h = rows[0].map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')), iId = h.findIndex((x) => x === 'item' || x === 'id' || x === 'sku'), iP = h.findIndex((x) => /^price/.test(x));
  if (iId < 0 || iP < 0) throw new Error('Rate card needs "Item" and "Price_GBP" columns');
  const out = (base || defaultRates()).map((x) => Object.assign({}, x)), seen = [], unknown = [];
  rows.slice(1).forEach((r) => { const id = String(r[iId] || '').trim().toUpperCase(), p = num(r[iP]); const t = out.find((x) => x.id === id); if (t && p >= 0 && isFinite(p)) { t.price = p; seen.push(id); } else if (id) unknown.push(id); });
  if (!seen.length) throw new Error('No recognised items. Use the template (Item column must match).');
  return { rates: out, updated: seen.length, unknown };
}
const ratesToCsv = (rates) => 'Item,Description,Unit,Price_GBP\n' + rates.map((r) => [r.id, '"' + r.desc.replace(/"/g, '""') + '"', r.unit, r.price].join(',')).join('\n') + '\n';

/* ---------- Industry verticals: typical estate shape + log intensity (our assumptions) ---------- */
const VERTICALS = {
  financial: { label: 'Financial services', icon: '🏦', desc: 'Banks, insurers, asset managers', logMult: 1.35, inc: 1.4, ret: 12, retWhy: 'Regulated firms commonly keep security logs 12 months or more; confirm the exact period with their compliance team.', ep: 1.1, win: 6, lin: 3, dcs: 1.2, fw: 1.5, proxy: 0.9, saas: 35, azSubs: 6, azRes: 0.3, aws: 1.5, gcp: 0.3, ot: 0, srcMult: { win_sec_dc: 1.3, firewall: 1.2, saas_audit: 1.3, entra_signin: 1.15 }, off: ['dns', 'aws_vpcflow', 'ot_ids'] },
  healthcare: { label: 'Healthcare', icon: '🏥', desc: 'Hospitals, trusts, care providers', logMult: 1.1, inc: 1.2, ret: 12, retWhy: 'Patient-data environments typically retain logs a year or more; confirm the customer\'s policy.', ep: 1.4, win: 5, lin: 2, dcs: 1.0, fw: 1.2, proxy: 0.7, saas: 20, azSubs: 3, azRes: 0.2, aws: 0.5, gcp: 0.1, ot: 0.3, srcMult: { o365_audit: 1.2, saas_audit: 1.2, win_sec_servers: 1.1 }, off: ['dns', 'aws_vpcflow', 'ot_ids'] },
  retail: { label: 'Retail & hospitality', icon: '🛍️', desc: 'Stores, e-commerce, hotels', logMult: 0.95, inc: 1.0, ret: 12, retWhy: 'Card-payment environments commonly need at least 12 months of log history, with 3 months immediately available.', ep: 0.5, win: 3, lin: 3, dcs: 0.8, fw: 3.0, proxy: 0.5, saas: 30, azSubs: 3, azRes: 0.25, aws: 1.5, gcp: 0.3, ot: 0, srcMult: { firewall: 1.3 }, off: ['dns', 'aws_vpcflow', 'ot_ids'] },
  public: { label: 'Public sector', icon: '🏛️', desc: 'Central and local government, education', logMult: 1.15, inc: 1.2, ret: 12, retWhy: 'Public bodies usually follow a retention policy of 12 months or more; confirm the exact period.', ep: 1.0, win: 6, lin: 3, dcs: 1.5, fw: 1.5, proxy: 0.9, saas: 20, azSubs: 4, azRes: 0.2, aws: 0.5, gcp: 0.1, ot: 0.05, srcMult: { win_sec_dc: 1.2 }, off: ['dns', 'aws_vpcflow', 'ot_ids'] },
  manufacturing: { label: 'Manufacturing & industrial', icon: '🏭', desc: 'Plants, supply chain, engineering', logMult: 1.0, inc: 1.1, ret: 6, retWhy: 'Often 6 to 12 months for IT logs; OT networks may have their own requirements.', ep: 0.7, win: 8, lin: 4, dcs: 1.3, fw: 2.5, proxy: 0.6, saas: 15, azSubs: 3, azRes: 0.2, aws: 0.8, gcp: 0.1, ot: 1.2, srcMult: { ot_ids: 1.5, firewall: 1.2 }, off: ['dns', 'aws_vpcflow'] },
  technology: { label: 'Technology & SaaS', icon: '💻', desc: 'Software, cloud-native companies', logMult: 1.3, inc: 1.3, ret: 12, retWhy: 'Customer contracts and security certifications often require 12 months of audit logs.', ep: 1.1, win: 2, lin: 10, dcs: 0.5, fw: 0.8, proxy: 0.4, saas: 60, azSubs: 8, azRes: 0.5, aws: 4, gcp: 1.5, ot: 0, srcMult: { azure_diag: 1.3, aws_cloudtrail: 1.4, saas_audit: 1.5, linux_syslog: 1.4 }, off: ['dns', 'aws_vpcflow', 'ot_ids', 'proxy'] },
  energy: { label: 'Energy & utilities', icon: '⚡', desc: 'Generation, grid, water, oil and gas', logMult: 1.2, inc: 1.3, ret: 12, retWhy: 'Critical-infrastructure operators commonly retain security logs 12 months or more.', ep: 0.8, win: 7, lin: 4, dcs: 1.3, fw: 2.0, proxy: 0.7, saas: 15, azSubs: 3, azRes: 0.2, aws: 0.5, gcp: 0.1, ot: 1.5, srcMult: { ot_ids: 1.5, win_sec_servers: 1.1 }, off: ['dns', 'aws_vpcflow'] },
  professional: { label: 'Professional services', icon: '💼', desc: 'Legal, consulting, media, education', logMult: 0.85, inc: 0.9, ret: 6, retWhy: 'Typically 6 to 12 months, driven by client contracts.', ep: 1.1, win: 3, lin: 2, dcs: 0.6, fw: 1.0, proxy: 0.6, saas: 40, azSubs: 3, azRes: 0.15, aws: 0.8, gcp: 0.2, ot: 0, srcMult: { saas_audit: 1.2 }, off: ['dns', 'aws_vpcflow', 'ot_ids'] }
};

/* ---------- Log source catalogue. mb = MB per unit per day { lo, exp, hi } (our estimates; calibrate with real data). ---------- */
const TACT = ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];
const GROUPS = ['Identity & email', 'Endpoint', 'Servers', 'Network', 'Cloud', 'SaaS & apps', 'OT / IoT'];
const SOURCES = [
  { id: 'entra_signin', g: 0, name: 'Microsoft Entra ID sign-in logs', driver: 'seats', unit: 'user', mb: [3, 6, 12], e5: true, tier: 'analytics', tac: ['Initial Access', 'Credential Access'],
    why: 'Every sign-in (interactive and non-interactive). The foundation for account-takeover detection: impossible travel, password spray, risky sign-ins.', note: 'Eligible for the Microsoft 365 E5 free-ingestion benefit.' },
  { id: 'entra_audit', g: 0, name: 'Entra ID audit & provisioning logs', driver: 'seats', unit: 'user', mb: [0.3, 0.6, 1.2], e5: true, tier: 'analytics', tac: ['Persistence', 'Privilege Escalation'],
    why: 'Changes to users, groups, roles and apps. Catches privilege escalation and persistence.', note: 'Eligible for the Microsoft 365 E5 free-ingestion benefit.' },
  { id: 'o365_audit', g: 0, name: 'Office 365 audit (Exchange, SharePoint, Teams)', driver: 'seats', unit: 'user', mb: [2, 4, 8], free: true, tier: 'analytics', tac: ['Collection', 'Exfiltration', 'Persistence'],
    why: 'Mailbox rules, file sharing and Teams activity. Key for business-email-compromise and data-leak detection.', note: 'Free data source in Sentinel: ingested without ingestion charge (verify against Microsoft\'s current list).' },
  { id: 'entra_risk', g: 0, name: 'Entra ID Protection & Defender XDR alerts/incidents', driver: 'seats', unit: 'user', mb: [0.02, 0.05, 0.1], free: true, tier: 'analytics', tac: ['Initial Access', 'Execution'],
    why: 'Microsoft\'s own alerts and incidents flow in at no ingestion charge. This is the quickest way to get value from an existing Microsoft security stack.', note: 'Free data source (verify against Microsoft\'s current list).' },
  { id: 'email_events', g: 0, name: 'Defender for Office 365 email events', driver: 'seats', unit: 'user', mb: [1.5, 4, 10], e5: true, filterable: true, tier: 'analytics', tac: ['Initial Access', 'Collection'],
    why: 'Email delivery, attachments and URL clicks. Supports phishing investigation and automated clean-up.', note: 'Advanced hunting tables: E5 benefit may apply.' },
  { id: 'cloud_apps', g: 0, name: 'Defender for Cloud Apps activity', driver: 'seats', unit: 'user', mb: [1, 3, 8], e5: true, filterable: true, tier: 'analytics', tac: ['Collection', 'Exfiltration'],
    why: 'Cloud and SaaS app activity seen by Defender: shadow IT, mass download, unusual sharing.', note: 'Advanced hunting tables: E5 benefit may apply.' },
  { id: 'mde_hunting', g: 1, name: 'Defender for Endpoint advanced hunting (device events)', driver: 'endpoints', unit: 'endpoint', mb: [5, 10, 25], e5: true, filterable: true, tier: 'analytics', tac: ['Execution', 'Persistence', 'Defense Evasion', 'Lateral Movement'],
    why: 'Process, file, network and registry events from endpoints. High value for hunting and investigation, and usually the largest volume you can tune.', note: 'Choose which tables to stream. Streaming all device tables can be many times the estimate.' },
  { id: 'third_party_edr', g: 1, name: 'Third-party EDR / antivirus telemetry', driver: 'endpoints', unit: 'endpoint', mb: [3, 10, 30], filterable: true, tier: 'analytics', tac: ['Execution', 'Defense Evasion'], off: true,
    why: 'Only needed if the customer does not use Defender for Endpoint. Via a partner connector or CEF.', note: 'Off by default. Turn on if the customer runs CrowdStrike, SentinelOne, etc.' },
  { id: 'win_sec_servers', g: 2, name: 'Windows server security events', driver: 'winServers', unit: 'server', mb: [150, 350, 800], s2: true, filterable: true, tier: 'analytics', tac: ['Credential Access', 'Lateral Movement', 'Persistence'],
    why: 'Logons, privilege use and process creation on servers. Volume depends on the event set ("Common" vs "All").', note: 'Defender for Servers Plan 2 includes a daily free allowance per server (pooled) for some of these tables.' },
  { id: 'win_sec_dc', g: 2, name: 'Domain controller security events', driver: 'dcs', unit: 'domain controller', mb: [800, 2000, 4000], s2: true, filterable: true, tier: 'analytics', tac: ['Credential Access', 'Lateral Movement', 'Privilege Escalation'],
    why: 'Authentication traffic for the whole domain. Essential for Kerberoasting, DCSync and pass-the-hash detection, and much heavier than a normal server.', note: 'Included in the Defender for Servers P2 allowance if covered.' },
  { id: 'linux_syslog', g: 2, name: 'Linux servers (Syslog / auditd)', driver: 'linuxServers', unit: 'server', mb: [50, 150, 400], filterable: true, tier: 'analytics', tac: ['Execution', 'Persistence', 'Privilege Escalation'],
    why: 'SSH logins, sudo, process execution. Often tuned down to auth and key audit events.', note: 'Not covered by the Defender for Servers P2 allowance.' },
  { id: 'firewall', g: 3, name: 'Firewall logs (CEF / syslog)', driver: 'firewalls', unit: 'firewall', mb: [300, 1000, 3000], filterable: true, basicOk: true, tier: 'analytics', tac: ['Command and Control', 'Exfiltration', 'Discovery', 'Lateral Movement'],
    why: 'Allowed and denied traffic and threat events at the perimeter. Valuable but high volume; often split so threat logs stay in Analytics and traffic logs go to a cheaper tier.', note: 'Typical saving: send "allowed traffic" to Basic or the data lake.' },
  { id: 'proxy', g: 3, name: 'Web proxy / secure web gateway logs', driver: 'proxyUsers', unit: 'proxied user', mb: [10, 25, 60], filterable: true, basicOk: true, tier: 'analytics', tac: ['Command and Control', 'Exfiltration'],
    why: 'Web destinations per user. Good for malware callback and data-exfiltration hunting.', note: 'Consider Basic or the data lake for full URL logs.' },
  { id: 'vpn_ztna', g: 3, name: 'VPN / remote access / ZTNA logs', driver: 'seats', unit: 'user', mb: [1, 3, 8], tier: 'analytics', tac: ['Initial Access', 'Lateral Movement'],
    why: 'Remote access sessions. Pairs with identity logs to spot stolen credentials used from unusual places.', note: '' },
  { id: 'dns', g: 3, name: 'DNS logs', driver: 'seats', unit: 'user', mb: [5, 15, 40], basicOk: true, filterable: true, tier: 'basic', tac: ['Command and Control', 'Exfiltration'], off: true,
    why: 'Every name lookup. Very high volume, so it is usually off or on a cheap tier, used for hunting and investigations.', note: 'Off by default.' },
  { id: 'azure_activity', g: 4, name: 'Azure Activity (control-plane)', driver: 'azureSubs', unit: 'subscription', mb: [50, 150, 400], free: true, tier: 'analytics', tac: ['Persistence', 'Privilege Escalation', 'Impact'],
    why: 'Who created, changed or deleted Azure resources. A free source, so there is little reason not to include it.', note: 'Free data source (verify against Microsoft\'s current list).' },
  { id: 'azure_diag', g: 4, name: 'Azure resource diagnostics (Key Vault, SQL, Storage, NSG…)', driver: 'azureResources', unit: 'resource', mb: [5, 15, 50], filterable: true, basicOk: true, tier: 'analytics', tac: ['Credential Access', 'Collection', 'Exfiltration'],
    why: 'Data-plane logs from Azure services. Volume depends heavily on which resources you enable.', note: 'Start with Key Vault, SQL and Storage; add the rest later.' },
  { id: 'aws_cloudtrail', g: 4, name: 'AWS CloudTrail (management events)', driver: 'awsAccounts', unit: 'account', mb: [100, 500, 2000], filterable: true, tier: 'analytics', tac: ['Persistence', 'Privilege Escalation', 'Impact'],
    why: 'API activity in AWS. Data events can multiply volume, so start with management events.', note: '' },
  { id: 'aws_vpcflow', g: 4, name: 'AWS VPC flow logs', driver: 'awsAccounts', unit: 'account', mb: [1000, 5000, 20000], basicOk: true, tier: 'lake', tac: ['Discovery', 'Lateral Movement', 'Exfiltration'], off: true,
    why: 'Network flows in AWS. Very high volume: best on the data lake or Auxiliary tier.', note: 'Off by default.' },
  { id: 'gcp_audit', g: 4, name: 'Google Cloud audit logs', driver: 'gcpProjects', unit: 'project', mb: [50, 200, 800], tier: 'analytics', tac: ['Persistence', 'Privilege Escalation'],
    why: 'Admin activity in Google Cloud projects.', note: '' },
  { id: 'saas_audit', g: 5, name: 'SaaS application audit logs (Okta, Salesforce, ServiceNow…)', driver: 'saasApps', unit: 'app', mb: [50, 200, 800], filterable: true, tier: 'analytics', tac: ['Initial Access', 'Collection', 'Exfiltration'],
    why: 'Sign-ins and admin activity in business apps. Volume per app varies a lot (identity providers are the biggest).', note: 'Count only apps that hold sensitive data or control access.' },
  { id: 'ot_ids', g: 6, name: 'OT / IoT network monitoring (Defender for IoT or similar)', driver: 'otSites', unit: 'OT site', mb: [200, 800, 2000], tier: 'analytics', tac: ['Discovery', 'Impact', 'Lateral Movement'], off: true,
    why: 'Alerts and asset data from industrial networks.', note: 'On by default for manufacturing and energy.' }
];
const SRC = {}; SOURCES.forEach((s) => { SRC[s.id] = s; });
const TIER_LABEL = { analytics: 'Analytics', basic: 'Basic', aux: 'Auxiliary', lake: 'Data lake', off: 'Not collected' };

/* ---------- Detection use cases (for ATT&CK coverage) ---------- */
const USECASES = [
  ['Impossible travel / atypical sign-in', 'Initial Access', ['entra_signin']], ['Password spray and brute force', 'Credential Access', ['entra_signin']],
  ['Phishing delivery and click tracking', 'Initial Access', ['email_events']], ['Malicious mailbox rules / BEC', 'Collection', ['o365_audit']],
  ['Risky sign-in from Identity Protection', 'Initial Access', ['entra_risk']], ['Privileged role assignment changes', 'Privilege Escalation', ['entra_audit']],
  ['New persistent app consent / service principal', 'Persistence', ['entra_audit']], ['Malware and suspicious process execution', 'Execution', ['mde_hunting']],
  ['Defence evasion (tamper, log clearing)', 'Defense Evasion', ['mde_hunting']], ['Lateral movement via remote services', 'Lateral Movement', ['mde_hunting']],
  ['Kerberoasting / DCSync / pass-the-hash', 'Credential Access', ['win_sec_dc']], ['New admin logon on servers', 'Privilege Escalation', ['win_sec_servers']],
  ['Scheduled task / service persistence', 'Persistence', ['win_sec_servers']], ['Linux SSH and sudo anomalies', 'Privilege Escalation', ['linux_syslog']],
  ['Malware callback / C2 beaconing', 'Command and Control', ['firewall']], ['Data exfiltration to unusual destinations', 'Exfiltration', ['firewall']],
  ['Port scan and internal discovery', 'Discovery', ['firewall']], ['Suspicious web destinations per user', 'Command and Control', ['proxy']],
  ['VPN login from stolen credentials', 'Initial Access', ['vpn_ztna']], ['DNS tunnelling and DGA domains', 'Exfiltration', ['dns']],
  ['Azure resource tampering and deletion', 'Impact', ['azure_activity']], ['Key Vault / storage data access anomalies', 'Collection', ['azure_diag']],
  ['AWS IAM changes and root usage', 'Privilege Escalation', ['aws_cloudtrail']], ['GCP IAM and service account abuse', 'Privilege Escalation', ['gcp_audit']],
  ['Mass download / external sharing in SaaS', 'Exfiltration', ['cloud_apps', 'saas_audit'], 'any'], ['SaaS admin and API abuse', 'Persistence', ['saas_audit']],
  ['OT protocol and device anomalies', 'Impact', ['ot_ids']], ['Ransomware encryption behaviour', 'Impact', ['mde_hunting']]
].map((u, i) => ({ id: 'uc' + i, name: u[0], tactic: u[1], src: u[2], any: u[3] === 'any' }));

/* ---------- SOAR playbook library (Logic Apps) ---------- */
const PLAYBOOKS = [
  { id: 'pb_enrich', name: 'Enrich incident (IP, URL, file reputation, user context)', share: 0.9, actions: 8, deflect: 0.10, on: true, why: 'Adds context before an analyst looks, so triage is faster.' },
  { id: 'pb_notify', name: 'Notify SOC channel and raise an ITSM ticket', share: 1.0, actions: 6, deflect: 0.05, on: true, why: 'Every incident reaches the right people and the ticketing system automatically.' },
  { id: 'pb_close', name: 'Auto-close known false positives and informational noise', share: 0.25, actions: 4, deflect: 0.18, on: true, why: 'Removes repetitive low-value work from analysts.' },
  { id: 'pb_phish', name: 'Phishing triage and purge (Microsoft 365)', share: 0.12, actions: 14, deflect: 0.06, on: true, why: 'Detonates and removes reported phishing from all mailboxes.' },
  { id: 'pb_user', name: 'Compromised user: revoke sessions, force password reset', share: 0.05, actions: 10, deflect: 0.03, on: true, why: 'Contains account takeover in minutes instead of hours.' },
  { id: 'pb_isolate', name: 'Isolate endpoint via Defender for Endpoint', share: 0.04, actions: 8, deflect: 0.02, on: true, why: 'Stops malware spreading while an analyst investigates.' },
  { id: 'pb_ioc', name: 'Block malicious IP / URL (Defender indicators, firewall)', share: 0.06, actions: 7, deflect: 0.03, on: true, why: 'Pushes confirmed indicators to controls automatically.' },
  { id: 'pb_travel', name: 'Verify risky sign-in with the user (Teams prompt)', share: 0.03, actions: 12, deflect: 0.03, on: false, why: 'Asks the user "was this you?" before escalating.' },
  { id: 'pb_stale', name: 'Disable risky or stale service principals / guest accounts', share: 0.01, actions: 9, deflect: 0.01, on: false, why: 'Closes common persistence paths.' },
  { id: 'pb_cve', name: 'Vulnerability / CVE enrichment and owner notification', share: 0.02, actions: 9, deflect: 0.01, on: false, why: 'Links alerts to known exposures.' }
];

/* ---------- BT service assumptions (internal; placeholders) ---------- */
const COVERAGE = { '8x5': { label: 'Business hours (8x5)', floor: 0.25 }, '12x5': { label: 'Extended (12x5)', floor: 0.5 }, '24x7': { label: '24x7 follow-the-sun', floor: 1.0 } };
const SVC_TIERS = {
  foundation: { label: 'Foundation: monitor & notify', mins: 10, hunt: 0, eng: 0.5, desc: 'We watch Sentinel, triage alerts and notify your team with a clear recommendation.' },
  advanced: { label: 'Advanced: detect, investigate & respond', mins: 25, hunt: 1, eng: 2, desc: 'We investigate incidents end to end and contain threats using the approved playbooks.' },
  premium: { label: 'Premium: + threat hunting & engineering', mins: 35, hunt: 4, eng: 4, desc: 'Everything in Advanced, plus proactive hunting, custom detection engineering and regular reviews.' }
};
function defaultSvc() { return { fteCost: 52000, overhead: 0.25, productive: 1500, margin: 0.35, dayRate: 650, onbBase: 10, onbPerSource: 1.5, cspMargin: 0.08 }; }

/* ---------- Typical estate for a vertical and company size ---------- */
function typicalDrivers(vk, seats) {
  const v = VERTICALS[vk] || VERTICALS.financial, s = Math.max(0, Math.round(num(seats)));
  const per = (x, d) => (s / d) * x;
  return {
    seats: s, endpoints: Math.round(s * v.ep), winServers: Math.max(2, Math.round(per(v.win, 100))), dcs: Math.max(2, Math.round(per(v.dcs, 1000) + 1)),
    linuxServers: Math.round(per(v.lin, 100)), firewalls: Math.max(2, Math.round(per(v.fw, 1000))), proxyUsers: Math.round(s * v.proxy),
    saasApps: Math.round(v.saas * clamp(Math.sqrt(s / 1000), 0.5, 3)), azureSubs: Math.max(1, Math.round(v.azSubs * clamp(Math.sqrt(s / 1000), 0.5, 3))), azureResources: Math.round(s * v.azRes),
    awsAccounts: Math.round(v.aws * clamp(Math.sqrt(s / 1000), 0.5, 4)), gcpProjects: Math.round(v.gcp * clamp(Math.sqrt(s / 1000), 0.5, 4)), otSites: v.ot > 0.05 ? Math.max(1, Math.round(v.ot * clamp(s / 1000, 0.3, 4))) : 0
  };
}
function defaultState(vk, seats) {
  vk = VERTICALS[vk] ? vk : 'financial'; const v = VERTICALS[vk], d = typicalDrivers(vk, seats || 1000);
  const sources = {}; SOURCES.forEach((s) => { const off = (s.off || (v.off || []).includes(s.id)) && !(s.id === 'ot_ids' && v.ot >= 0.3); sources[s.id] = { on: !off, tier: s.tier, override: null }; });
  const soar = {}; PLAYBOOKS.forEach((p) => { soar[p.id] = p.on; });
  return { company: '', vertical: vk, cur: 'GBP', fx: 1, drivers: d, m365: 'E5', licensed: d.seats, p2Servers: d.winServers + d.dcs, sources, soar,
    levers: { filterPct: 0, retention: v.ret, growth: 15, spike: 1.5, rho: 0.5, spread: 1, scenario: 'exp' }, soc: { coverage: '24x7', tier: 'advanced' },
    rates: defaultRates(), rateSource: 'default', svc: defaultSvc(), commercial: 'split',
    baseline: { mode: 'greenfield', siem: 'splunk', unit: 'gbday', value: 0, evBytes: 500, factor: 1 },
    deal: { term: 3, tier: 'auto', risk: 'trueup', capGb: null, overMode: 'billed', pricing: 'mixed' } };
}

/* ---------- Volumes ---------- */
function baselineGb(b) { if (!b || b.mode !== 'migration') return 0; const v = num(b.value); if (v <= 0) return 0; return (b.unit === 'eps' ? v * (num(b.evBytes) || 500) * 86400 / 1e9 : v) * (num(b.factor) || 1); }
function volumesFor(state, mode, q) { // mode: 'lo' | 'exp' | 'hi' | 'sample'; q = function(i)->quantile for sample
  const v = VERTICALS[state.vertical] || VERTICALS.financial, f = clamp(num(state.levers.filterPct) / 100, 0, 0.6), items = [], target = baselineGb(state.baseline);
  SOURCES.forEach((s) => {
    const st = state.sources[s.id] || { on: false, tier: s.tier, override: null }, units = num(state.drivers[s.driver]);
    const mult = v.logMult * ((v.srcMult || {})[s.id] || 1) / MB, a = s.mb[0] * units * mult, b = s.mb[1] * units * mult, c = s.mb[2] * units * mult;
    let lo = a, ex = b, hi = c, fixed = false;
    if (st.override != null && st.override !== '' && num(st.override) >= 0 && b > 0) { const k = num(st.override) / b; lo = a * k; ex = num(st.override); hi = c * k; fixed = true; } else if (st.override != null && st.override !== '' && b === 0) { lo = ex = hi = num(st.override); fixed = true; }
    items.push({ s, st, lo, ex, hi, fixed, on: st.on && st.tier !== 'none' && st.tier !== 'off' });
  });
  let k = 1; // migration baseline: sources you have not set yourself rebalance to the customer's existing total
  if (target > 0) { let fx = 0, fl = 0; items.forEach((it) => { if (!it.on) return; if (it.fixed) fx += it.ex; else fl += it.ex; }); if (fl > 0) k = Math.max(0, target - fx) / fl; }
  const sp0 = (num(state.levers.spread) || 1) * (target > 0 ? 0.5 : 1), out = [];
  items.forEach((it, i) => {
    let { lo, ex, hi } = it; if (!it.fixed) { lo *= k; ex *= k; hi *= k; }
    const sp = sp0; lo = ex - (ex - lo) * sp; hi = ex + (hi - ex) * sp; if (lo < 0) lo = 0;
    let raw = mode === 'lo' ? lo : mode === 'hi' ? hi : mode === 'sample' ? tri(lo, clamp(3 * ex - lo - hi, lo, hi), hi, q(i)) : ex;
    if (!it.st.on || it.st.tier === 'off') raw = 0;
    const filtered = it.s.filterable && it.st.tier === 'analytics' ? raw * (1 - f) : raw;
    out.push({ id: it.s.id, raw, filtered, tier: it.st.tier });
  });
  return out;
}
function tri(lo, m, hi, q) { if (hi <= lo) return m; m = clamp(m, lo, hi); const fc = (m - lo) / (hi - lo); return q < fc ? lo + Math.sqrt(q * (hi - lo) * (m - lo)) : hi - Math.sqrt((1 - q) * (hi - lo) * (hi - m)); }
function allowances(state, vols) { // pooled benefit deductions on analytics-tier volume
  let e5Vol = 0, s2Vol = 0; vols.forEach((x) => { const s = SRC[x.id]; if (x.tier !== 'analytics') return; if (s.e5) e5Vol += x.filtered; if (s.s2) s2Vol += x.filtered; });
  const e5Pool = state.m365 === 'E5' ? num(state.licensed) * 5 / MB : 0, s2Pool = num(state.p2Servers) * 0.5;
  return { e5: Math.min(e5Pool, e5Vol), s2: Math.min(s2Pool, s2Vol), e5Pool, s2Pool };
}
function summarise(state, vols) {
  const t = { analyticsGross: 0, free: 0, basic: 0, aux: 0, lake: 0, total: 0, filteredSaving: 0 };
  vols.forEach((x) => { const s = SRC[x.id]; t.total += x.raw; if (x.tier === 'analytics') { t.analyticsGross += x.filtered; t.filteredSaving += x.raw - x.filtered; if (s.free) t.free += x.filtered; } else if (x.tier === 'basic') t.basic += x.filtered; else if (x.tier === 'aux') t.aux += x.filtered; else if (x.tier === 'lake') t.lake += x.filtered; });
  const al = allowances(state, vols); t.allow = al; t.analyticsBillable = Math.max(0, t.analyticsGross - t.free - al.e5 - al.s2); return t;
}

/* ---------- Pricing ---------- */
function tierOptions(R) { return [{ id: 'payg', gb: 0, day: null, eff: R.ANALYTICS_PAYG_GB, label: 'Pay-as-you-go' }].concat(TIERS.map((g) => ({ id: 't' + g, gb: g, day: R['TIER_' + g], eff: R['TIER_' + g] / g, label: g + ' GB/day' }))); }
const dailyAnalytics = (G, t) => (t.id === 'payg' ? G * t.eff : t.day + Math.max(0, G - t.gb) * t.eff);
function monthly(sum, tier, R, ret) {
  const a = DAYS * dailyAnalytics(sum.analyticsBillable, tier), b = DAYS * sum.basic * R.BASIC_GB, x = DAYS * sum.aux * R.AUX_GB, l = DAYS * sum.lake * R.LAKE_INGEST_GB;
  const rt = sum.analyticsBillable * DAYS * Math.max(0, ret - 3) * R.RETENTION_GB_MONTH, ls = sum.lake * DAYS * ret * R.LAKE_STORE_GB_MONTH;
  return { analytics: a, basic: b, aux: x, lake: l + ls, retention: rt, total: a + b + x + l + ls + rt };
}
function bestTier(sum, R, ret) { const opts = tierOptions(R); let best = opts[0], bc = Infinity; opts.forEach((t) => { const c = monthly(sum, t, R, ret).total; if (c < bc - 1e-9) { bc = c; best = t; } }); return best; }

/* ---------- Monte Carlo (seeded, so a scenario always gives the same range) ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]; };
function simulate(state, R, N) {
  N = N || 1500; const rnd = rng(12345), rho = clamp(num(state.levers.rho), 0, 1), opts = tierOptions(R), ret = num(state.levers.retention);
  const samples = [];
  for (let k = 0; k < N; k++) { const qc = rnd(), qs = SOURCES.map(() => rnd()); const vols = volumesFor(state, 'sample', (i) => clamp(rho * qc + (1 - rho) * qs[i], 0.001, 0.999)); samples.push(summarise(state, vols)); }
  const meanCost = opts.map((t) => samples.reduce((a, s) => a + monthly(s, t, R, ret).total, 0) / N);
  let bi = 0; meanCost.forEach((c, i) => { if (c < meanCost[bi] - 1e-9) bi = i; });
  const rec = opts[bi], costs = samples.map((s) => monthly(s, rec, R, ret).total), gbs = samples.map((s) => s.analyticsBillable), tot = samples.map((s) => s.total);
  const lo = Math.min(...costs), hi = Math.max(...costs), bins = 24, hist = new Array(bins).fill(0); costs.forEach((c) => { hist[Math.min(bins - 1, Math.floor((c - lo) / ((hi - lo) || 1) * bins))]++; });
  return { rec, N, cost: { p10: pct(costs, 0.1), p50: pct(costs, 0.5), p90: pct(costs, 0.9), min: lo, max: hi }, gb: { p10: pct(gbs, 0.1), p50: pct(gbs, 0.5), p90: pct(gbs, 0.9) }, tot: { p10: pct(tot, 0.1), p50: pct(tot, 0.5), p90: pct(tot, 0.9) }, hist, histLo: lo, histHi: hi, samples, tierMean: opts.map((t, i) => ({ id: t.id, label: t.label, mean: meanCost[i] })) };
}

/* ---------- SOAR + SOC ---------- */
function soar(state, R, seatsInc) {
  const v = VERTICALS[state.vertical] || VERTICALS.financial, inc = (num(state.drivers.seats) / 1000) * 3 * v.inc, rows = [];
  PLAYBOOKS.forEach((p) => { const on = !!state.soar[p.id], runs = on ? inc * DAYS * p.share : 0; rows.push({ id: p.id, name: p.name, why: p.why, on, runs, actions: p.actions, cost: runs * p.actions * R.LOGICAPP_ACTION, deflect: on ? p.deflect : 0 }); });
  const runs = rows.reduce((a, r) => a + r.runs, 0), cost = rows.reduce((a, r) => a + r.cost, 0), deflect = clamp(rows.reduce((a, r) => a + r.deflect, 0), 0, 0.6);
  return { incPerDay: inc, incLo: inc * 0.6, incHi: inc * 1.8, rows, runs, cost, deflect };
}
function soc(state, so, sourcesOn) {
  const S = state.svc, cov = COVERAGE[state.soc.coverage] || COVERAGE['24x7'], tier = SVC_TIERS[state.soc.tier] || SVC_TIERS.advanced;
  const hours = so.incPerDay * tier.mins * (1 - so.deflect) / 60, fteWork = hours * 365 / S.productive, fte = Math.max(fteWork, cov.floor);
  const people = fte * S.fteCost / 12 * (1 + S.overhead), eng = tier.eng * S.dayRate, hunt = tier.hunt * S.dayRate, sub = people + eng + hunt, fee = sub * (1 + S.margin);
  const onbDays = S.onbBase + S.onbPerSource * sourcesOn, onb = onbDays * S.dayRate * (1 + S.margin);
  return { cov, tier, hoursDay: hours, fteWork, fte, people, eng, hunt, sub, fee, onbDays, onb, minsEff: tier.mins * (1 - so.deflect) };
}

/* ---------- Coverage, optimisation ---------- */
function coverage(state) {
  const on = (id) => !!(state.sources[id] && state.sources[id].on && state.sources[id].tier !== 'off'), rows = USECASES.map((u) => Object.assign({}, u, { covered: u.any ? u.src.some(on) : u.src.every(on) }));
  const byTactic = TACT.map((t) => { const l = rows.filter((r) => r.tactic === t), c = l.filter((r) => r.covered).length; return { tactic: t, total: l.length, covered: c }; }).filter((x) => x.total);
  const gaps = rows.filter((r) => !r.covered).map((r) => ({ name: r.name, tactic: r.tactic, need: r.src.map((id) => SRC[id].name) }));
  return { rows, byTactic, covered: rows.filter((r) => r.covered).length, total: rows.length, gaps };
}
function optimise(state, R, base) {
  const ret = num(state.levers.retention), out = [], tier0 = bestTier(base.sum, R, ret), c0 = monthly(base.sum, tier0, R, ret).total;
  const exp = base.exp;
  exp.forEach((x) => { const s = SRC[x.id], st = state.sources[x.id]; if (!st || !st.on || st.tier !== 'analytics' || s.free || x.filtered <= 0) return;
    if (s.basicOk && x.filtered > 0.03 * base.sum.analyticsGross) { const alt = JSON.parse(JSON.stringify(state)); alt.sources[x.id].tier = s.id.indexOf('vpc') >= 0 ? 'lake' : 'basic'; const sm = summarise(alt, volumesFor(alt, 'exp')), c1 = monthly(sm, bestTier(sm, R, ret), R, ret).total;
      if (c0 - c1 > 0) out.push({ id: x.id, action: 'tier', to: alt.sources[x.id].tier, saving: c0 - c1, text: `Send ${s.name} to ${TIER_LABEL[alt.sources[x.id].tier]} instead of Analytics`, why: 'High-volume, lower-value logs are rarely used in real-time detections. They stay searchable for investigations at a fraction of the price.' }); }
    if (s.filterable && x.filtered > 0.05 * base.sum.analyticsGross) { const alt = JSON.parse(JSON.stringify(state)); alt.levers.filterPct = 0; const only = JSON.parse(JSON.stringify(alt)); Object.keys(only.sources).forEach((k) => { if (k !== x.id) only.sources[k].on = only.sources[k].on; });
      const vols = volumesFor(alt, 'exp').map((y) => (y.id === x.id ? Object.assign({}, y, { filtered: y.raw * 0.7 }) : y)), sm = summarise(alt, vols), c1 = monthly(sm, bestTier(sm, R, ret), R, ret).total;
      if (c0 - c1 > 0) out.push({ id: x.id, action: 'filter', saving: c0 - c1, text: `Filter ${s.name} at the source (drop about 30% of low-value events)`, why: 'Data collection rules can remove noisy events before they are billed, without losing detection coverage.' }); } });
  return out.sort((a, b) => b.saving - a.saving).slice(0, 6);
}

/* ---------- Calibrate from a Log Analytics usage export (Usage table: DataType, Quantity in MB) ---------- */
const TABLE_MAP = [[/^SigninLogs$|^AADNonInteractiveUserSignInLogs$|^AADServicePrincipalSignInLogs$|^AADManagedIdentitySignInLogs$/i, 'entra_signin'], [/^AuditLogs$|^AADProvisioningLogs$/i, 'entra_audit'], [/^OfficeActivity$/i, 'o365_audit'], [/^SecurityAlert$|^SecurityIncident$|^AADUserRiskEvents$|^AADRiskyUsers$/i, 'entra_risk'], [/^EmailEvents$|^EmailAttachmentInfo$|^EmailUrlInfo$|^EmailPostDeliveryEvents$|^UrlClickEvents$/i, 'email_events'], [/^CloudAppEvents$/i, 'cloud_apps'], [/^Device[A-Za-z]*$/i, 'mde_hunting'], [/^SecurityEvent$|^WindowsEvent$/i, 'win_sec_servers'], [/^Syslog$/i, 'linux_syslog'], [/^CommonSecurityLog$/i, 'firewall'], [/^DnsEvents$|^DNSQueryLogs$/i, 'dns'], [/^AzureActivity$/i, 'azure_activity'], [/^AzureDiagnostics$|^AZ[A-Za-z]+$|^StorageBlobLogs$/i, 'azure_diag'], [/^AWSCloudTrail$/i, 'aws_cloudtrail'], [/^AWSVPCFlow$/i, 'aws_vpcflow'], [/^GCPAuditLogs$/i, 'gcp_audit'], [/^OTAlert|^IoT/i, 'ot_ids'], [/^Okta|^SalesforceEvent|^ServiceNow|^CommonSecurityLog_SaaS/i, 'saas_audit']];
function calibrateFromUsage(state, text, days) {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('The usage file is empty');
  const h = rows[0].map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')), iT = h.findIndex((x) => x === 'datatype' || x === 'table' || x === 'tablename'), iQ = h.findIndex((x) => /^quantity|^mb$|^sizemb|^volume/.test(x)), iD = h.findIndex((x) => x === 'timegenerated' || x === 'date' || x === 'timestamp');
  if (iT < 0 || iQ < 0) throw new Error('Expected columns DataType and Quantity (MB) from the Usage table');
  const mb = {}, dates = new Set(); let unmapped = 0, mapped = 0;
  rows.slice(1).forEach((r) => { const t = String(r[iT] || '').trim(), q = num(r[iQ]); if (iD >= 0 && r[iD]) dates.add(String(r[iD]).slice(0, 10)); const m = TABLE_MAP.find((x) => x[0].test(t)); if (m) { mb[m[1]] = (mb[m[1]] || 0) + q; mapped += q; } else unmapped += q; });
  const span = num(days) || Math.max(1, dates.size) || 30, ids = Object.keys(mb); if (!ids.length) throw new Error('No known Sentinel tables found in the file');
  const v = VERTICALS[state.vertical] || VERTICALS.financial; ids.forEach((id) => { const gb = mb[id] / MB / span; state.sources[id] = Object.assign(state.sources[id] || { tier: SRC[id].tier }, { on: true, override: +gb.toFixed(3), measured: true }); });
  return { sources: ids.length, days: span, totalGb: (mapped + unmapped) / MB / span, mappedGb: mapped / MB / span, unmappedGb: unmapped / MB / span };
}


/* ---------- Commercial quote: consumption (resold) + managed service + onboarding ---------- */
const SVC_MODELS = { package: 'Fixed package', pergb: 'Per GB monitored', persource: 'Per log source', mixed: 'Package + usage' };
function svcModels(R, state, sum, srcOn) {
  const t = (state.soc.tier || 'advanced').toUpperCase(), cov = state.soc.coverage, base = R['PKG_' + t + '_MONTH'] || 0, ratio = base / (R.PKG_FOUNDATION_MONTH || 1);
  const cm = cov === '8x5' ? R.COV_MULT_8X5 : cov === '12x5' ? R.COV_MULT_12X5 : 1, m = ratio * cm, gb = sum.analyticsGross + sum.basic + sum.aux + sum.lake;
  const inc = { src: R['PKG_' + t + '_SRC'] || 0, gb: R['PKG_' + t + '_GB'] || 0, pb: R['PKG_' + t + '_PB'] || 0 }, over = { src: Math.max(0, srcOn - inc.src), gb: Math.max(0, gb - inc.gb) }, min = R.SVC_MIN_MONTH * m;
  const pkg = base * cm;
  return { package: pkg, pergb: Math.max(min, gb * R.PERGB_SVC_MONTH * m), persource: Math.max(min, srcOn * R.PERSRC_SVC_MONTH * m), mixed: pkg + over.src * R.MIX_SRC_MONTH * m + over.gb * R.MIX_GB_MONTH * m, inc, over, gb, srcOn, fits: over.src === 0 && over.gb === 0 };
}
function buildQuote(state, R, sum, mc, so, sc, srcOn, ret) {
  const d = state.deal, up = R.MS_RESALE_UPLIFT, opts = tierOptions(R), term = [1, 3, 5].includes(+d.term) ? +d.term : 3, g = num(state.levers.growth) / 100;
  const tier = d.tier === 'auto' ? mc.rec : (opts.find((o) => o.id === d.tier) || mc.rec), capGb = d.risk === 'cap' ? (num(d.capGb) > 0 ? num(d.capGb) : Math.ceil(mc.gb.p90 / 10) * 10) : null;
  const cons = (s, tr) => { const m = monthly(s, tr, R, ret); let an = m.analytics, absorbed = 0;
    if (capGb && s.analyticsBillable > capGb) { const capAn = DAYS * dailyAnalytics(capGb, tr), ex = DAYS * (s.analyticsBillable - capGb) * tr.eff; if (d.overMode === 'billed') an = capAn + ex * (1 + R.CAP_OVERAGE_UPLIFT); else { absorbed = Math.max(0, an - capAn); an = capAn; } }
    return { bill: m.total - m.analytics + an, absorbed }; };
  const exp = cons(sum, tier), msExp = (exp.bill + so.cost) * (1 + up), costs = mc.samples.map((s) => (cons(s, tier).bill + so.cost) * (1 + up)), abs = mc.samples.map((s) => cons(s, tier).absorbed);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), tdisc = term === 5 ? R.TERM_DISC_5Y : term === 3 ? R.TERM_DISC_3Y : R.TERM_DISC_1Y;
  const models = svcModels(R, state, sum, srcOn), pbOn = so.rows.filter((x) => x.on).length, svcPre = models[d.pricing] != null ? models[d.pricing] : models.mixed, svcFee = svcPre * (1 - tdisc);
  const onb = R.ONB_BASE + R.ONB_PER_SOURCE * srcOn + R.PLAYBOOK_BUILD * Math.max(0, pbOn - models.inc.pb);
  const years = []; for (let y = 1; y <= term; y++) { const k = Math.pow(1 + g, y - 1), s2 = Object.assign({}, sum, { analyticsBillable: sum.analyticsBillable * k, analyticsGross: sum.analyticsGross * k, basic: sum.basic * k, aux: sum.aux * k, lake: sum.lake * k, total: sum.total * k });
    const t2 = d.tier === 'auto' ? bestTier(s2, R, ret) : tier, ms = (monthly(s2, t2, R, ret).total + so.cost * k) * (1 + up), sv = (svcModels(R, state, s2, srcOn)[d.pricing] || 0) * (1 - tdisc);
    years.push({ year: y, gb: s2.analyticsBillable, tier: t2.label, msMonth: ms, svcMonth: sv, ms: ms * 12, svc: sv * 12, onb: y === 1 ? onb : 0, total: ms * 12 + sv * 12 + (y === 1 ? onb : 0) }); }
  const tcv = years.reduce((a, y) => a + y.total, 0), pct2 = (a, p) => pct(a, p);
  const ratio = (R['PKG_' + (state.soc.tier || 'advanced').toUpperCase() + '_MONTH'] || 0);
  return { term, tdisc, tier, capGb, risk: d.risk, overMode: d.overMode, pricing: d.pricing,
    ms: { exp: msExp, p10: pct2(costs, 0.1), p90: pct2(costs, 0.9), annualVar: { p10: 12 * (pct2(costs, 0.1) - msExp), p90: 12 * (pct2(costs, 0.9) - msExp) }, uplift: up, raw: exp.bill + so.cost },
    svc: { fee: svcFee, pre: svcPre, models, pbOn, label: SVC_MODELS[d.pricing] || SVC_MODELS.mixed },
    onb, monthly: msExp + svcFee, y1: years[0].total, tcv, years, btExposure: { mean: mean(abs), p90: pct2(abs, 0.9) }, margin: svcFee > 0 ? 1 - sc.sub / svcFee : 0, baseline: baselineGb(state.baseline), rated: ratio > 0 };
}

/* ---------- Full computation ---------- */
function compute(state) {
  const R = rateMap(state.rates), ret = num(state.levers.retention), exp = volumesFor(state, 'exp'), lo = volumesFor(state, 'lo'), hi = volumesFor(state, 'hi');
  const sum = summarise(state, exp), sumLo = summarise(state, lo), sumHi = summarise(state, hi), mc = simulate(state, R), rec = mc.rec;
  const opts = tierOptions(R), tierTable = opts.map((t) => ({ id: t.id, label: t.label, monthly: monthly(sum, t, R, ret).total, tierGb: t.gb, day: t.day, eff: t.eff }));
  const cost = monthly(sum, rec, R, ret), so = soar(state, R), sourcesOn = SOURCES.filter((s) => state.sources[s.id].on && state.sources[s.id].tier !== 'off').length, sc = soc(state, so, sourcesOn);
  const quote = buildQuote(state, R, sum, mc, so, sc, sourcesOn, ret), msMonthly = quote.ms.exp, cspMonthly = msMonthly;
  // spike view under the recommended commitment
  const spikeAt = (k) => { const s2 = Object.assign({}, sum, { analyticsBillable: sum.analyticsBillable * k, basic: sum.basic * k, aux: sum.aux * k, lake: sum.lake * k }); return monthly(s2, rec, R, ret).total + so.cost; };
  const spike = { x1: spikeAt(1), x13: spikeAt(1.3), xs: spikeAt(num(state.levers.spike) || 1.5), x2: spikeAt(2), payg2: monthly(Object.assign({}, sum, { analyticsBillable: sum.analyticsBillable * 2 }), opts[0], R, ret).total + so.cost };
  // 3 year projection
  const g = num(state.levers.growth) / 100, years = [1, 2, 3].map((y) => { const k = Math.pow(1 + g, y - 1), s2 = Object.assign({}, sum, { analyticsBillable: sum.analyticsBillable * k, basic: sum.basic * k, aux: sum.aux * k, lake: sum.lake * k, total: sum.total * k }), t = bestTier(s2, R, ret), c = monthly(s2, t, R, ret).total + so.cost * k;
    return { year: y, gb: s2.analyticsBillable, tier: t.label, ms: c * 12, svc: sc.fee * 12 + (y === 1 ? sc.onb : 0) }; });
  let e5Tot = 0, s2Tot = 0, anBill = 0; exp.forEach((x) => { const s = SRC[x.id]; if (x.tier === 'analytics') { if (s.e5) e5Tot += x.filtered; if (s.s2) s2Tot += x.filtered; } });
  const bill = {}; exp.forEach((x) => { const s = SRC[x.id]; if (x.tier === 'analytics') { let b = x.filtered; if (s.free) b = 0; else { if (s.e5 && e5Tot > 0) b -= sum.allow.e5 * x.filtered / e5Tot; if (s.s2 && s2Tot > 0) b -= sum.allow.s2 * x.filtered / s2Tot; } bill[x.id] = Math.max(0, b); anBill += bill[x.id]; } else bill[x.id] = x.filtered; });
  const perSource = SOURCES.map((s, i) => { const st = state.sources[s.id], e = exp[i], l = lo[i], h = hi[i], b = bill[s.id] || 0; let month = 0;
    if (st.on && st.tier !== 'off') { if (st.tier === 'analytics') month = anBill > 0 ? (cost.analytics + cost.retention) * b / anBill : 0; else if (st.tier === 'basic') month = b * DAYS * R.BASIC_GB; else if (st.tier === 'aux') month = b * DAYS * R.AUX_GB; else if (st.tier === 'lake') month = b * DAYS * (R.LAKE_INGEST_GB + ret * R.LAKE_STORE_GB_MONTH); }
    return { id: s.id, name: s.name, g: s.g, on: st.on && st.tier !== 'off', tier: st.tier, units: num(state.drivers[s.driver]), unit: s.unit, lo: l.raw, exp: e.raw, hi: h.raw, billable: b, month, free: !!s.free, e5: !!s.e5, s2: !!s.s2, measured: !!st.measured }; });
  const cov = coverage(state), opt = optimise(state, R, { sum, exp });
  const avoided = Math.max(0, DAYS * (sum.free + sum.allow.e5 + sum.allow.s2) * opts[0].eff);
  return { R, quote, sum, sumLo, sumHi, mc, rec, tierTable, cost, soar: so, soc: Object.assign({}, sc, { costFee: sc.fee, fee: quote.svc.fee, onb: quote.onb }), msMonthly, cspMonthly, spike, years, perSource, cov, opt, avoided, ret, rateSource: state.rateSource };
}
function sourcesCsv(state, r) {
  const L = [['Group', 'Source', 'Included', 'Destination', 'Units', 'Unit', 'GB/day low', 'GB/day expected', 'GB/day high'].join(',')];
  r.perSource.forEach((x) => L.push([GROUPS[x.g], '"' + x.name + '"', x.on ? 'Yes' : 'No', TIER_LABEL[x.tier], x.units, x.unit, x.lo.toFixed(2), x.exp.toFixed(2), x.hi.toFixed(2)].join(',')));
  return L.join('\n') + '\n';
}
return { DAYS, TIERS, TACT, GROUPS, SOURCES, SRC, VERTICALS, USECASES, PLAYBOOKS, COVERAGE, SVC_TIERS, TIER_LABEL, num, esc, clamp, defaultRates, rateMap, ratesFromCsv, ratesToCsv, parseCsv, typicalDrivers, defaultState, volumesFor, summarise, tierOptions, monthly, bestTier, simulate, soar, soc, coverage, optimise, compute, sourcesCsv, dailyAnalytics, calibrateFromUsage, buildQuote, svcModels, SVC_MODELS, baselineGb };
});
