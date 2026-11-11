const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../public'); const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/.netlify/functions/gemini-proxy')) { let b = ''; q.on('data', (d) => b += d); q.on('end', () => { const j = JSON.parse(b || '{}'); r.setHeader('content-type', 'application/json'); if (q.headers['x-access-code'] !== 'ok') { r.statusCode = 401; return r.end('{"error":"no"}'); } if (j.endpoint === 'models') return r.end(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] })); const p = JSON.stringify(j.body); const out = /summary/i.test(p) ? { summary: 'Mock **summary** for the customer.' } : { vertical: 'retail', seats: 2500 }; r.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(out) }] } }] })); }); return; }
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); r.end(d); });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port; const br = await chromium.launch(); const pg = await (await br.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } })).newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push('PE ' + e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push('CE ' + m.text()));
  await pg.goto(url); await pg.fill('#lockInput', 'ok'); await pg.click('#lockForm button'); await pg.waitForSelector('#intro:not([hidden])'); await pg.click('#introDemo'); console.log('demo ready:', await pg.evaluate(() => window.App.ready()));
  await pg.screenshot({ path: '/tmp/s1.png' });
  await pg.click('[data-set="baseline.mode=migration"]'); await pg.selectOption('[data-siem]', 'qradar'); await pg.fill('[data-path="baseline.value"]', '3000'); await pg.waitForTimeout(250); console.log('baseline:', await pg.textContent('#blCalc')); await pg.screenshot({ path: '/tmp/s1.png', fullPage: true });
  for (let i = 2; i <= 5; i++) { await pg.click('#stepper [data-step="' + i + '"]'); await pg.waitForTimeout(300); if (i === 4) { await pg.click('[data-set="deal.risk=cap"]'); await pg.click('[data-set="deal.term=5"]'); await pg.click('[data-set="deal.pricing=persource"]'); await pg.waitForTimeout(200); } await pg.screenshot({ path: '/tmp/s' + i + '.png', fullPage: true }); }
  console.log('quote card:', (await pg.textContent('.quote')).replace(/\s+/g, ' ').slice(0, 420));
  await pg.evaluate(() => { const d = document.createElement('div'); d.id = 'quoteDoc'; document.body.appendChild(d); d.innerHTML = window.App.buildQuoteHtml(); document.body.classList.add('pq'); });
  await pg.emulateMedia({ media: 'print' }); await pg.pdf({ path: '/tmp/quote.pdf', format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } }); await pg.emulateMedia({ media: 'screen' }); await pg.evaluate(() => document.body.classList.remove('pq'));
  console.log('live:', await pg.textContent('#lvGb'), await pg.textContent('#lvCost'), await pg.textContent('#lvTier'));
  console.log('svgs on results:', await pg.locator('#p5 svg').count());
  await pg.click('#btnMode'); console.log('int visible in customer mode:', await pg.locator('.int:visible').count());
  await pg.click('#btnMode');
  const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click('#expDeck')]); console.log('deck:', d.suggestedFilename());
  await pg.waitForTimeout(500); console.log('ERRORS:', errs.length ? errs : 'none'); await br.close(); srv.close();
});
