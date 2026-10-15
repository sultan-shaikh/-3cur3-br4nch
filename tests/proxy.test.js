const assert = require('assert');
const h = require('../netlify/functions/gemini-proxy.js').handler;
const call = (m, hd, b) => h({ httpMethod: m, headers: hd || {}, body: JSON.stringify(b || {}) });
(async () => {
  delete process.env.GEMINI_API_KEY; delete process.env.ACCESS_CODE;
  assert.strictEqual((await call('POST', {}, {})).statusCode, 500, 'fails closed');
  process.env.GEMINI_API_KEY = 'k'; process.env.ACCESS_CODE = 'abc';
  assert.strictEqual((await call('GET')).statusCode, 405);
  assert.strictEqual((await call('POST', {}, { endpoint: 'models' })).statusCode, 401);
  assert.strictEqual((await call('POST', { 'x-access-code': 'abd' }, { endpoint: 'models' })).statusCode, 401);
  const ok = { 'x-access-code': 'abc' };
  assert.strictEqual((await call('POST', ok, { endpoint: 'generate', model: '../evil', body: { contents: [] } })).statusCode, 400);
  assert.strictEqual((await call('POST', ok, { endpoint: 'generate', model: 'gemini-2.5-flash', body: {} })).statusCode, 400);
  assert.strictEqual((await call('POST', ok, { endpoint: 'nope' })).statusCode, 400);
  let sent; global.fetch = async (u, o) => { sent = JSON.parse(o.body); return new Response('{"ok":1}', { status: 200 }); };
  await call('POST', ok, { endpoint: 'generate', model: 'gemini-2.5-flash', body: { contents: [{}], tools: [1], generationConfig: { maxOutputTokens: 99999, foo: 1 } } });
  assert(!sent.tools && sent.generationConfig.maxOutputTokens === 8192 && !('foo' in sent.generationConfig));
  console.log('PROXY PASS');
})();
