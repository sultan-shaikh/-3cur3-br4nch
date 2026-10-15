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
const root = path.join(__dirname, '../public'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/.netlify/functions/gemini-proxy')) { let b = ''; req.on('data', (d) => b += d); req.on('end', async () => { const r = await handler({ httpMethod: req.method, headers: req.headers, body: b }); res.writeHead(r.statusCode, r.headers); res.end(r.body); }); return; }
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8788);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto('http://localhost:8788/'); await pg.screenshot({ path: '/tmp/s0_lock.png' });
  await pg.fill('#lockInput', 'sesame'); await pg.click('#lockForm button'); await pg.waitForSelector('#introModal:not([hidden])'); await pg.screenshot({ path: '/tmp/s1_intro.png' });
  await pg.click('#introDemo'); await pg.setInputFiles('#priceCsv', path.join(__dirname, 'sample_price_book.csv')); await pg.waitForSelector('#priceStatus.ok');
  await pg.click('#previewBtn'); await pg.check('input[name=tier][value="0.02"]');
  await pg.screenshot({ path: '/tmp/s2_input.png', fullPage: true });
  await pg.click('#generateBtn'); await pg.waitForSelector('#dstage svg', { timeout: 60000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: '/tmp/s3_report.png', fullPage: true });
  await pg.locator('#dwrap').screenshot({ path: '/tmp/s4_diagram.png' });
  await pg.click('#ppBtn'); await pg.waitForSelector('#ppPrint:not(.hidden)', { timeout: 60000 });
  await br.close(); srv.close();
})();
