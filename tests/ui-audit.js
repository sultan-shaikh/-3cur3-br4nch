const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const root = '/home/claude/sentinel-architect/public'; const out = [];
const log = (...a) => { out.push(a.join(' ')); console.log(...a); };
const srv = http.createServer((q, r) => { if (q.url.includes('gemini-proxy')) { let b = ''; q.on('data', (d) => b += d); q.on('end', () => { r.setHeader('content-type', 'application/json'); const j = JSON.parse(b || '{}'); if (j.endpoint === 'models') return r.end(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] })); const p = JSON.stringify(j.body); const o = /summary/i.test(p) ? { summary: 'Mock summary.' } : { company: 'Mock Co', vertical: 'retail', seats: 2500, m365: 'E5', firewalls: 6 }; r.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(o) }] } }] })); }); return; } const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); r.end(d); }); }).listen(0, async () => {
  const br = await chromium.launch(), ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } }), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', (e) => errs.push('PE ' + e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push('CE ' + m.text())); pg.on('response', (r) => r.status() >= 400 && !r.url().includes('favicon') && errs.push('HTTP ' + r.status() + ' ' + r.url()));
  const step = async (n) => { await pg.click('#stepper [data-step="' + n + '"]'); await pg.waitForTimeout(250); };
  await pg.goto('http://localhost:' + srv.address().port); await pg.fill('#lockInput', 'x'); await pg.click('#lockForm button'); await pg.waitForSelector('#intro:not([hidden])'); await pg.click('#introStart');
  // AI quick-fill
  await pg.fill('#aiText', 'UK retailer about 2500 staff with E5 and six firewalls'); await pg.click('#aiFill'); await pg.waitForTimeout(600); log('aiFill ->', await pg.inputValue('[data-seats]'), 'ready', await pg.evaluate(() => App.ready()), 'model opts', await pg.locator('#modelSelector option').count());
  // every step, both modes, nothing NaN/undefined in text
  for (const mode of ['internal', 'customer']) { if (mode === 'customer') await pg.click('#btnMode'); for (let i = 1; i <= 5; i++) { await step(i); const t = await pg.locator('.wrap').innerText(); if (/NaN|undefined|Infinity|\[object/.test(t)) log('BAD TEXT step', i, mode, (t.match(/.{30}(NaN|undefined|Infinity|\[object).{20}/) || [''])[0]); } log(mode, 'steps ok; .int visible:', await pg.locator('.int:visible').count()); }
  await pg.click('#btnMode');
  // migration + usage CSV calibration
  await step(1); await pg.click('[data-set="baseline.mode=migration"]'); for (const s of ['splunk', 'xsiam', 'arcsight']) await pg.selectOption('[data-siem]', s); await pg.fill('[data-path="baseline.value"]', '250');
  await step(3); const csv = 'TimeGenerated,DataType,Quantity\n2026-10-01,SecurityEvent,52000\n2026-10-01,SigninLogs,8000\n2026-10-02,SecurityEvent,50000\n'; fs.writeFileSync('/tmp/usage.csv', csv); await pg.setInputFiles('#usageFile', '/tmp/usage.csv'); await pg.waitForTimeout(400);
  // price book import (full template)
  await step(4); await pg.setInputFiles('#rateFile', '/mnt/user-data/outputs/sentinel-price-book-template.csv'); await pg.waitForTimeout(400); log('rates msg:', await pg.textContent('#rateMsg'));
  // commercial permutations via clicks
  for (const sel of ['deal.term=1', 'deal.term=5', 'deal.risk=cap', 'deal.overMode=absorbed', 'deal.pricing=package', 'deal.pricing=pergb', 'deal.pricing=persource', 'deal.pricing=mixed', 'deal.risk=trueup']) { await pg.click('[data-set="' + sel + '"]'); } await pg.selectOption('[data-path="deal.tier"]', 't300'); await pg.click('[data-svc="premium"]'); await pg.click('[data-cov="8x5"]');
  // branding + logo
  await pg.evaluate(() => { document.querySelector('details:has([data-brand])').open = true; }); await pg.fill('[data-brand="name"]', 'Test MSP'); const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'); fs.writeFileSync('/tmp/logo.png', png); await pg.setInputFiles('#brandLogo', '/tmp/logo.png'); await pg.waitForTimeout(300);
  await step(5); const body = await pg.locator('#p5').innerText(); log('results NaN-free:', !/NaN|undefined|Infinity/.test(body), '| quote:', (await pg.locator('.quote .tot').innerText()).replace(/\s+/g, ' '));
  // sliders, apply, ai summary, views
  await pg.click('[data-view="ms"]'); await pg.click('[data-view="svc"]'); await pg.click('[data-view="all"]'); if (await pg.locator('[data-apply="0"]').count()) await pg.click('[data-apply="0"]'); await pg.click('#aiSum'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const el = document.querySelector('[data-sl="levers.filterPct"]'); el.value = 30; el.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(300);
  // USD + downloads
  await step(1); await pg.click('[data-cur="USD"]'); await step(5);
  for (const sel of ['#expDeck', '[data-exp="csv"]']) { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click(sel)]); log('download:', d.suggestedFilename()); }
  const doc = await pg.evaluate(() => App.buildQuoteHtml()); log('quote html: logo', /<img src="data:image/.test(doc), 'draft banner', /DRAFT/.test(doc), 'NaN', /NaN|undefined/.test(doc));
  // save + reload old-format scenario
  const [sv] = await Promise.all([pg.waitForEvent('download'), pg.click('#btnSave')]); const f = await sv.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8')); log('saved keys ok:', !!j.st.baseline, !!j.st.deal, !!j.st.chosen);
  delete j.st.baseline; delete j.st.deal; delete j.st.chosen; fs.writeFileSync('/tmp/old.json', JSON.stringify(j)); await pg.setInputFiles('#fileLoad', '/tmp/old.json'); await pg.waitForTimeout(500); log('old scenario loads, ready:', await pg.evaluate(() => App.ready()), 'deal:', await pg.evaluate(() => JSON.stringify(App.S.st.deal)));
  await pg.setInputFiles('#fileLoad', '/tmp/usage.csv'); await pg.waitForTimeout(300); log('bad file error shown:', await pg.locator('#error').isVisible());
  await pg.setViewportSize({ width: 390, height: 800 }); await step(5); log('mobile horizontal overflow:', await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2));
  log('ERRORS:', errs.length ? JSON.stringify(errs) : 'none'); await br.close(); srv.close(); });
