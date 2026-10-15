const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
process.env.GEMINI_API_KEY = 'k'; process.env.ACCESS_CODE = 'sesame';
const handler = require('../netlify/functions/gemini-proxy.js').handler;
const realFetch = global.fetch;
global.fetch = async (url, opts) => { // mock Gemini upstream only
  if (String(url).includes('generativelanguage')) {
    if (/\/models\?/.test(url)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
    const prompt = JSON.parse(opts.body).contents[0].parts[0].text;
    let out;
    if (/Choose Cisco Secure Access/.test(prompt)) out = { skus: [{ sku: 'SA-ESS-USER-1YR', reason: 'core' }, { sku: 'SA-FAKE-999', reason: 'hallucinated' }] };
    else out = { executive_summary: 'Exec **summary** <img src=x onerror=alert(1)>', lan: 'lan text', wan: 'wan', security: 'sec', wifi: 'wifi', camera: 'cam', iot: 'iot', risks: 'r' };
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(out) }] } }] }), { status: 200 });
  }
  return realFetch(url, opts);
};
const root = path.join(__dirname, '../public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/.netlify/functions/gemini-proxy')) {
    let b = ''; req.on('data', (d) => b += d); req.on('end', async () => {
      const r = await handler({ httpMethod: req.method, headers: req.headers, body: b });
      res.writeHead(r.statusCode, r.headers); res.end(r.body);
    }); return;
  }
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8788);
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const pg = await br.newPage(); const errs = []; let dialog = false;
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await pg.goto('http://localhost:8788/');
  await pg.fill('#lockInput', 'wrong'); await pg.click('#lockForm button'); await pg.waitForSelector('#lockErr:not([hidden])');
  console.log('bad code rejected:', await pg.textContent('#lockErr'));
  await pg.fill('#lockInput', 'sesame'); await pg.click('#lockForm button'); await pg.waitForSelector('#lock', { state: 'hidden' });
  await pg.setInputFiles('#pbFile', path.join(__dirname, 'sample_price_book.csv'));
  await pg.fill('#saUsers', '150'); await pg.selectOption('#svc', 'foundation');
  await pg.click('#go'); await pg.waitForSelector('#report .kpis', { timeout: 60000 });
  const txt = await pg.textContent('#report');
  console.log('has MX85 hw:', /MX85-HW/.test(txt), '| SA line:', /SA-ESS-USER/.test(txt), '| fake excluded note:', /SA-FAKE-999/.test(txt), '| gap block:', /no matching SKU/.test(txt));
  await pg.waitForSelector('#stage svg', { timeout: 20000 });
  await pg.waitForTimeout(1500); await pg.locator('#dia').scrollIntoViewIfNeeded(); await pg.waitForTimeout(500); const before = await pg.getAttribute('#stage', 'style');
  const box = await pg.locator('#dia').boundingBox();
  await pg.mouse.move(box.x + 100, box.y + 100); await pg.mouse.down(); await pg.mouse.move(box.x + 220, box.y + 160, { steps: 5 }); await pg.mouse.up();
  const after = await pg.getAttribute('#stage', 'style');
  console.log('pan changed:', before !== after, after);
  console.log('xss img present:', await pg.locator('#report img[src="x"]').count(), '| dialog fired:', dialog);
  await pg.selectOption('#cur', 'GBP'); await pg.fill('#fx', '0.8'); await pg.dispatchEvent('#fx', 'change');
  await pg.waitForTimeout(2500); console.log('GBP shown:', /£/.test(await pg.textContent('#report .kpis')));
  pg.on('console', m => console.log('console:', m.text())); const [dlp] = await Promise.all([pg.waitForEvent('download', {timeout: 8000}).catch(e => { console.log('no download; csv btn count', 0); return null; }), pg.evaluate(() => document.getElementById('csv').click())]); if (!dlp) { console.log('lastBom?', await pg.evaluate(() => typeof document.getElementById('csv').onclick)); await br.close(); srv.close(); return; } console.log('csv download:', dlp.suggestedFilename());
  console.log('page errors:', errs);
  await br.close(); srv.close();
})().catch((e) => { console.error('E2E FAIL', e); process.exit(1); });
