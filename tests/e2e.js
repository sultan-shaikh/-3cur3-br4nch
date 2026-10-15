const http = require('http'), fs = require('fs'), path = require('path');
const G = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(G + '/playwright'); const sharp = require(G + '/sharp');
process.env.GEMINI_API_KEY = 'k'; process.env.ACCESS_CODE = 'sesame';
const handler = require('../netlify/functions/gemini-proxy.js').handler;
const realFetch = global.fetch; const calls = [];
global.fetch = async (url, opts) => {
  if (!String(url).includes('generativelanguage')) return realFetch(url, opts);
  if (/\/models\?/.test(url)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
  const prompt = JSON.parse(opts.body).contents[0].parts[0].text; let out; calls.push(prompt.slice(0, 40));
  if (/reading a network topology diagram/.test(prompt)) out = { sites: [{ type: 'HQ', country: 'UK', city: 'Leeds', users: 100, wan: [{ type: 'MPLS', mbps: 300 }], ha: true, switching: true, wifi: true, cameras: 4, sensors: 0 }, { type: 'Branch', country: 'UK', city: 'York', users: 20, wan: [{ type: 'Broadband', mbps: 80 }], ha: false, switching: true, wifi: true, cameras: 0, sensors: 2 }], remoteUsers: 321, confidence: 'medium', notes: 'ok' };
  else if (/Choose Cisco/.test(prompt)) out = { skus: [{ sku: 'SA-ADV-USER-1YR', unit: 'user', reason: 'core package' }, { sku: 'SA-FAKE-999', unit: 'user', reason: 'hallucinated' }] };
  else if (/customer-ready proposal/.test(prompt)) out = { problemStatement: { headline: 'Legacy WAN is slow', challenges: [{ title: 'MPLS cost', desc: 'x' }, { title: 'Wi-Fi', desc: 'y' }] }, useCases: [{ title: 'Store WiFi', problem: 'p', solution: 's', module: 'MR' }], executiveSummary: 'Exec <script>alert(1)</script>', roi: { headline: 'ROI', points: [{ metric: 'm', value: '10%', detail: 'd' }], paybackPeriod: '18 months' }, competitive: { summary: 's', comparisons: [{ category: 'c', us: 'u', others: 'o' }] }, roadmap: { phases: [{ phase: 'P1', name: 'n', duration: '4w', activities: ['a'], milestone: 'm' }] }, whyUs: ['w1'], nextSteps: ['n1'] };
  else out = { executive_summary: 'Exec **summary** <img src=x onerror=alert(1)>', wan: 'wan text', security: 'sec', lan: 'lan', wifi: 'wifi', camera: 'cam', iot: 'iot', sse: 'sse text', risks: 'risk text' };
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(out) }] } }] }), { status: 200 });
};
const CSP = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
const root = path.join(__dirname, '../public'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/.netlify/functions/gemini-proxy')) { let b = ''; req.on('data', (d) => b += d); req.on('end', async () => { const r = await handler({ httpMethod: req.method, headers: req.headers, body: b }); res.writeHead(r.statusCode, r.headers); res.end(r.body); }); return; }
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP }); res.end(fs.readFileSync(f));
}).listen(8788);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const png = '/tmp/diagram.png'; await sharp({ create: { width: 600, height: 300, channels: 3, background: '#ffffff' } }).png().toFile(png);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } }); const pg = await ctx.newPage();
  const errs = []; let dialog = false; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('response', (r) => { if (r.status() === 404) console.log('404:', r.url()); }); pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); pg.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await pg.goto('http://localhost:8788/');
  await pg.fill('#lockInput', 'wrong'); await pg.click('#lockForm button'); await pg.waitForSelector('#lockErr:not([hidden])'); ok(true, 'bad code rejected');
  await pg.fill('#lockInput', 'sesame'); await pg.click('#lockForm button'); await pg.waitForSelector('#introModal:not([hidden])'); ok(true, 'intro shown after unlock');
  await pg.click('#introDemo'); ok((await pg.locator('#siteTable tbody tr').count()) === 6, 'demo loads 6 sites');
  await pg.setInputFiles('#priceCsv', path.join(__dirname, 'sample_price_book.csv')); await pg.waitForSelector('#priceStatus.ok');
  await pg.click('#previewBtn'); const prev = await pg.textContent('#previewBody'); ok(/MX250/.test(prev) && /✔/.test(prev), 'preview resolves MX against price book');
  await pg.check('input[name=tier][value="0.02"]'); await pg.check('input[name=role][value="0.03"]');
  await pg.click('#generateBtn'); await pg.waitForSelector('#reportSection .kpis', { timeout: 60000 });
  const rep = await pg.textContent('#reportSection');
  ok(/MX250-HW/.test(rep) && /MR36-HW/.test(rep) && /MV12W-HW/.test(rep) && /MT10-HW/.test(rep) && /MS130-24P-HW/.test(rep), 'BoM has MX/MR/MV/MT/MS hardware');
  ok(/SA-ADV-USER/.test(rep) && /not in the price book/i.test(rep) && /SA-FAKE-999/.test(rep), 'SSE line priced and hallucinated SKU flagged');
  ok(/Managed services wrap/.test(rep) && /5% of 1Y OpEx|2% of 1Y OpEx/.test(rep), 'service wrap shown');
  ok(!/no matching SKU/.test(rep), 'no unexpected gaps for demo');
  await pg.waitForSelector('#dstage svg', { timeout: 30000 });
  const nodes = await pg.locator('#dstage svg .node').count(); ok(nodes >= 15, 'diagram rendered with ' + nodes + ' nodes');
  const colored = await pg.locator('#dstage svg path[style*="stroke"]').count(); ok(colored > 5, 'edges styled');
  await pg.locator('#dwrap').scrollIntoViewIfNeeded(); await pg.waitForTimeout(800);
  const before = await pg.getAttribute('#dstage', 'style'); const box = await pg.locator('#dwrap').boundingBox();
  await pg.mouse.move(box.x + 200, box.y + 200); await pg.mouse.down(); await pg.mouse.move(box.x + 300, box.y + 260, { steps: 5 }); await pg.mouse.up();
  ok(before !== (await pg.getAttribute('#dstage', 'style')), 'diagram pans'); await pg.click('[data-dia=in]'); await pg.click('[data-dia=fit]');
  const t1a = await pg.textContent('#t1'); await pg.fill('#discC', '10'); await pg.fill('#discO', '5'); const t1b = await pg.textContent('#t1'); ok(t1a !== t1b && /saves/.test(await pg.textContent('#v1')), 'discount override updates TCO');
  ok(!/<img[^>]*onerror/i.test(await pg.innerHTML('#reportSection')) && !dialog, 'XSS stripped');
  const png2 = await pg.evaluate(async () => { const r = await window.App.diagramPng(); return r ? r.data.slice(0, 22) + '|' + r.w : null; }); ok(png2 && png2.startsWith('data:image/png'), 'diagram exports to PNG (' + png2 + ')');
  await pg.selectOption('#cur', 'GBP'); await pg.fill('#fx', '0.8'); await pg.dispatchEvent('#fx', 'change'); await pg.waitForSelector('#kCapex'); await pg.waitForTimeout(1500); ok(/£/.test(await pg.textContent('#kCapex')), 'currency switch re-renders');
  const csvP = pg.waitForEvent('download'); await pg.evaluate(() => document.querySelector('[data-rep=csv]').click()); ok((await csvP).suggestedFilename() === 'bom.csv', 'csv export');
  // proposal
  await pg.fill('#ppBy', 'Sul'); await pg.fill('#ppCtx', 'retiring MPLS');
  const dlP = pg.waitForEvent('download', { timeout: 60000 }); await pg.click('#ppBtn'); const dl = await dlP; const pp = '/tmp/proposal.pptx'; await dl.saveAs(pp);
  ok(dl.suggestedFilename().endsWith('.pptx') && fs.statSync(pp).size > 30000, 'PPTX downloaded (' + fs.statSync(pp).size + ' bytes)');
  await pg.waitForSelector('#ppPrint:not(.hidden)', { timeout: 20000 }); const pdfv = await pg.innerHTML('#pdfProposalView'); ok(/Executive summary/.test(pdfv) && /<img[^>]*Topology/.test(pdfv) && !/<script/i.test(pdfv), 'PDF view built, diagram embedded, script escaped');
  // scan
  await pg.setInputFiles('#diagramInput', png); await pg.click('#scanBtn'); await pg.waitForFunction(() => document.querySelectorAll('#siteTable tbody tr').length === 2, null, { timeout: 30000 });
  ok(+(await pg.inputValue('#userCount')) === 321 && /review/i.test(await pg.textContent('#scanSummary')), 'scan fills sites + remote users, asks for review');
  // csv import
  fs.writeFileSync('/tmp/sites.csv', 'Type,Country,City,Users,WAN1_Type,WAN1_Mbps,WAN2_Type,WAN2_Mbps,HA,Switching,WiFi,Cameras,Sensors\nBranch,UK,Hull,30,DIA,100,Broadband,50,N,Y,Y,2,0\nDC,UK,Slough,0,MPLS,1000,,,Y,N,N,0,0\n');
  await pg.setInputFiles('#siteCsv', '/tmp/sites.csv'); await pg.waitForFunction(() => document.querySelectorAll('#siteTable tbody tr').length === 2); ok(true, 'bulk CSV import');
  // scope SSE only hides sites
  await pg.selectOption('#designScope', 'SSE'); ok(!(await pg.isVisible('#meInputs')), 'SSE-only scope hides Meraki pillar');
  await pg.click('#generateBtn'); await pg.waitForFunction(() => /Section 1: Secure Access/.test(document.getElementById('reportSection').textContent), null, { timeout: 30000 }); ok(true, 'SSE-only report renders');
  // meraki-only with gap
  await pg.selectOption('#designScope', 'Meraki'); await pg.evaluate(() => { window.Core.CONFIG.rules[0].model = 'MX999'; }); await pg.click('#generateBtn'); await pg.waitForFunction(() => /no matching SKU/.test(document.getElementById('reportSection').textContent), null, { timeout: 30000 }); ok(true, 'missing MX model flagged, not invented');
  const real = errs.filter((e) => !/status of (404|401)/.test(e)); ok(real.length === 0, 'no page errors / CSP violations ' + JSON.stringify(real)); ok(calls.length >= 5, 'AI calls: ' + calls.length);
  await br.close(); srv.close();
})().catch((e) => { console.error('E2E FAIL', e); process.exit(1); });
