/* Wiring + start-up */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S;
const seen = () => { try { return sessionStorage.getItem('csba_intro') === '1'; } catch { return true; } };
const markSeen = () => { try { sessionStorage.setItem('csba_intro', '1'); } catch {} };

function demo() {
  const mk = (o) => Object.assign(App.newSite(), o);
  S.sites = [
    mk({ type: 'HQ', country: 'UK', city: 'London', users: 450, wan: [{ type: 'MPLS', mbps: 500 }, { type: 'DIA', mbps: 1000 }], ha: true, camera: true, cameras: 16, iot: true, sensors: 8 }),
    mk({ type: 'DC', country: 'UK', city: 'Manchester', users: 0, wan: [{ type: 'MPLS', mbps: 1000 }, { type: 'DIA', mbps: 1000 }], ha: true, wifi: false, switching: false }),
    mk({ type: 'Branch', country: 'UK', city: 'Bristol', users: 60, wan: [{ type: 'DIA', mbps: 200 }, { type: 'Broadband', mbps: 80 }], camera: true, cameras: 6, iot: true, sensors: 4 }),
    mk({ type: 'Branch', country: 'UK', city: 'Leeds', users: 45, wan: [{ type: 'DIA', mbps: 200 }], camera: true, cameras: 4 }),
    mk({ type: 'Branch', country: 'UK', city: 'Cardiff', users: 30, wan: [{ type: 'Broadband', mbps: 100 }, { type: '5G/LTE', mbps: 50 }], iot: true, sensors: 3 }),
    mk({ type: 'Branch', country: 'UK', city: 'Glasgow', users: 80, wan: [{ type: 'DIA', mbps: 500 }], camera: true, cameras: 8, iot: true, sensors: 6 }),
  ];
  $('companyName').value = 'Acme Retail'; $('industry').value = 'Retail'; $('userCount').value = 800; $('designScope').value = 'Unified'; toggleScope();
  App.renderSites();
}
function toggleScope() { const s = $('designScope').value; $('sseInputs').classList.toggle('hidden', s === 'Meraki'); $('meInputs').classList.toggle('hidden', s === 'SSE'); }
async function unlock(code) {
  App.setCode(code);
  try { await App.api({ endpoint: 'models' }); } catch (e) { if (!/Access code/.test(e.message)) { $('lockErr').hidden = false; $('lockErr').textContent = e.message; } return; }
  $('lock').hidden = true; await App.loadModels(); if (!seen()) { $('introModal').hidden = false; markSeen(); }
}

function start() {
  App.renderAddons(); App.renderRules(); App.bindRules(); App.bindSites(); App.bindScan(); App.bindProposal();
  S.sites = [Object.assign(App.newSite(), { type: 'HQ', city: 'London', users: 120, wan: [{ type: 'DIA', mbps: 500 }], ha: true }), Object.assign(App.newSite(), { city: 'Bristol', users: 40 })];
  App.renderSites();
  $('priceCsv').addEventListener('change', (e) => { if (e.target.files[0]) App.onPriceBook(e.target.files[0]); });
  $('generateBtn').addEventListener('click', App.generateDesign);
  $('rescanBtn').addEventListener('click', App.loadModels);
  $('designScope').addEventListener('change', toggleScope);
  $('introBtn').addEventListener('click', () => { $('introModal').hidden = false; });
  $('introStart').addEventListener('click', () => { $('introModal').hidden = true; });
  $('introDemo').addEventListener('click', () => { demo(); $('introModal').hidden = true; });
  $('lockForm').addEventListener('submit', (e) => { e.preventDefault(); unlock($('lockInput').value.trim()); });
  $('lockBtn').addEventListener('click', () => { App.setCode(''); App.showLock(''); });
  const re = () => { if (S.last) App.rerenderReport(); };
  $('cur').addEventListener('change', re); $('fx').addEventListener('change', re);
  const rep = $('reportSection');
  rep.addEventListener('click', (e) => { const t = e.target.closest('[data-rep],[data-dia]'); if (!t) return; if (t.dataset.rep === 'csv') App.exportCsv(); else if (t.dataset.rep === 'print') App.printReport(); else if (t.dataset.dia) App.diagramAction(t.dataset.dia); });
  rep.addEventListener('input', (e) => { if (e.target.id === 'discC' || e.target.id === 'discO') App.updateTco(); });
  window.addEventListener('afterprint', () => { document.body.classList.remove('print-proposal'); document.body.classList.add('print-report'); });
  if (App.getCode()) unlock(App.getCode()); else App.showLock('');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
