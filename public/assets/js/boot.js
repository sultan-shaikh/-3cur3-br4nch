/* Sentinel Architect - start-up */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S;
const seen = () => { try { return sessionStorage.getItem('sa_intro') === '1'; } catch (e) { return true; } };
const mark = () => { try { sessionStorage.setItem('sa_intro', '1'); } catch (e) { /* ignore */ } };
function demo() { App.newScenario('financial', 3500, true); S.st.m365 = 'E5'; S.st.company = 'Acme Bank'; S.st.soc = { coverage: '24x7', tier: 'advanced' }; App.recompute(); App.goStep(1); }
async function unlock(code) {
  App.setCode(code);
  try { await App.api({ endpoint: 'models' }); } catch (e) { if (!/Access code/.test(e.message)) { $('lockErr').hidden = false; $('lockErr').textContent = e.message; } return; }
  $('lock').hidden = true; App.loadModels(); if (!seen()) { $('intro').hidden = false; mark(); }
}
function start() {
  App.newScenario('financial', 1000, false); App.bindSteps(); App.recompute(); App.goStep(1); App.setMode('internal');
  $('lockForm').addEventListener('submit', (e) => { e.preventDefault(); unlock($('lockInput').value.trim()); });
  $('lockBtn').addEventListener('click', () => { App.setCode(''); App.showLock(''); });
  $('introBtn').addEventListener('click', () => { $('intro').hidden = false; }); $('introStart').addEventListener('click', () => { $('intro').hidden = true; }); $('introDemo').addEventListener('click', () => { demo(); $('intro').hidden = true; });
  $('btnMode').addEventListener('click', () => App.setMode(S.mode === 'customer' ? 'internal' : 'customer'));
  $('btnSave').addEventListener('click', () => App.dl(new Blob([JSON.stringify({ app: 'sentinel-architect', v: 1, st: S.st, view: S.view, usage: S.usage }, null, 1)], { type: 'application/json' }), (S.st.company || 'scenario').replace(/[^A-Za-z0-9]+/g, '_') + '_sentinel.json'));
  $('fileLoad').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const j = JSON.parse(await f.text()); if (j.app !== 'sentinel-architect' || !j.st || !j.st.drivers || !C.VERTICALS[j.st.vertical]) throw new Error('Not a Sentinel Architect scenario'); const base = C.defaultState(j.st.vertical, j.st.drivers.seats); S.st = Object.assign(base, j.st, { levers: Object.assign(base.levers, j.st.levers), sources: Object.assign(base.sources, j.st.sources), svc: Object.assign(base.svc, j.st.svc), soc: Object.assign(base.soc, j.st.soc), rates: Array.isArray(j.st.rates) && j.st.rates.length ? base.rates.map((x) => Object.assign({}, x, { price: (j.st.rates.find((y) => y.id === x.id) || x).price })) : base.rates }); S.view = j.view || 'ms'; S.usage = j.usage || null; S.touched = true; S.st.chosen = { vertical: true, seats: true }; App.setErr(''); App.recompute(); App.goStep(1); } catch (err) { App.setErr('Could not open that file: ' + err.message); } });
  window.addEventListener('resize', () => document.documentElement.style.setProperty('--navh', document.querySelector('.nav').offsetHeight + 'px'));
  if (App.getCode()) unlock(App.getCode()); else App.showLock('');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
