'use strict';
const crypto = require('crypto');

const API = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_BODY = 5.5 * 1024 * 1024;
const MODEL_RE = /^gemini-[a-z0-9.\-]+$/;
const GEN_KEYS = ['temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType', 'thinkingConfig'];

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  const key = process.env.GEMINI_API_KEY, code = process.env.ACCESS_CODE;
  if (!key || !code) return reply(500, { error: 'Server not configured (GEMINI_API_KEY / ACCESS_CODE missing)' });

  const given = (event.headers && (event.headers['x-access-code'] || event.headers['X-Access-Code'])) || '';
  if (!crypto.timingSafeEqual(sha(given), sha(code))) return reply(401, { error: 'Invalid access code' });

  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (raw.length > MAX_BODY) return reply(413, { error: 'Request too large' });
  let p; try { p = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON' }); }

  const timeout = Math.max(5000, Math.min(Number(process.env.UPSTREAM_TIMEOUT_MS) || 25000, 60000));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    let res;
    if (p.endpoint === 'models') {
      res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: ac.signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return reply(res.status, { error: (j.error && j.error.message) || 'Upstream error' });
      const models = (j.models || [])
        .filter((m) => /^models\/gemini-/.test(m.name || ''))
        .map((m) => ({ name: m.name, displayName: m.displayName, supportedGenerationMethods: m.supportedGenerationMethods }));
      return reply(200, { models });
    }
    if (p.endpoint === 'generate') {
      if (!MODEL_RE.test(String(p.model || ''))) return reply(400, { error: 'Invalid model' });
      const b = p.body || {};
      const out = {};
      if (Array.isArray(b.contents)) out.contents = b.contents;
      else return reply(400, { error: 'contents required' });
      if (b.systemInstruction) out.systemInstruction = b.systemInstruction;
      if (b.generationConfig && typeof b.generationConfig === 'object') {
        const g = {};
        for (const k of GEN_KEYS) if (k in b.generationConfig) g[k] = b.generationConfig[k];
        if (g.maxOutputTokens != null) g.maxOutputTokens = Math.min(Math.max(1, Number(g.maxOutputTokens) || 1), 8192);
        out.generationConfig = g;
      }
      res = await fetch(`${API}/models/${p.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(out),
        signal: ac.signal,
      });
      const text = await res.text();
      return { statusCode: res.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: text };
    }
    return reply(400, { error: 'Unknown endpoint' });
  } catch (e) {
    if (e && e.name === 'AbortError') return reply(504, { error: 'Upstream timeout' });
    return reply(502, { error: 'Upstream failure' });
  } finally { clearTimeout(timer); }
};
