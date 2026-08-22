// Pasada final: recorre todas las vistas en es/en/oscuro/movil, captura cada una
// y reporta errores de consola y desbordamiento horizontal en una sola tabla.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const CDP = Number(flag('cdp', 9250));
const only = flag('only', '');
const PORT = process.env.PORT || 8123;

const VIEWS = [
  ['eventos',    { page: 'events' }],
  ['panel',      { page: 'dashboard' }],
  ['analiticas', { page: 'analytics' }],
  ['biblioteca', { page: 'library' }],
  ['pr-panel',   { page: 'project', tab: 'dashboard' }],
  ['pr-presup',  { page: 'project', tab: 'budget' }],
  ['pr-crono',   { page: 'project', tab: 'timeline' }],
  ['pr-invit',   { page: 'project', tab: 'guests' }],
  ['pr-plano',   { page: 'project', tab: 'layout' }],
  ['pr-mood',    { page: 'project', tab: 'moodboard' }],
];
const MODES = [
  ['es',   'lang=es',            1440, 1700],
  ['en',   'lang=en',            1440, 1700],
  ['dark', 'lang=es&theme=dark', 1440, 1700],
  ['mob',  'lang=es',             390, 1700],
];

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
   '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(HERE, '.chrome-sweep-' + CDP),
   '--window-size=1500,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws;
const rows = [];
try {
  let wsUrl;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { wsUrl = (await fetch(`http://localhost:${CDP}/json/list`).then(r => r.json())).find(x => x.type === 'page')?.webSocketDebuggerUrl; } catch { }
    if (!wsUrl) await sleep(200);
  }
  ws = new globalThis.WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (m, p) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await send('Page.enable'); await send('Runtime.enable');

  for (const [mode, query, W, H] of MODES) {
    if (only && only !== mode) continue;
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W <= 768 });
    for (const [name, nav] of VIEWS) {
      const drv = `
        (function(){ window.__READY=false;
          var n=0, iv=setInterval(function(){ n++;
            var a=document.getElementById('pg-app');
            if(a && !a.classList.contains('hidden')){ clearInterval(iv);
              setTimeout(function(){ try{
                ${nav.page === 'project' ? "openProject('p1');" : `showPage('${nav.page}');`}
                ${nav.tab ? `setTimeout(function(){ try{ switchTab('${nav.tab}'); }catch(e){ window.__ERRORS.push('switchTab: '+e); } window.__READY=true; },1100);` : 'window.__READY=true;'}
              }catch(e){ window.__ERRORS.push('drv: '+e); window.__READY=true; } },500);
            } else if(n>140){ clearInterval(iv); window.__ERRORS.push('nunca arranco'); window.__READY=true; } },100);
        })();`;
      await send('Page.navigate', { url: `http://localhost:${PORT}/__preview?${query}` });
      await send('Runtime.evaluate', { expression: 'new Promise(r=>setTimeout(r,300))', awaitPromise: true });
      await send('Runtime.evaluate', { expression: drv });
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        const r = await send('Runtime.evaluate', { expression: 'window.__READY===true', returnByValue: true });
        if (r.result?.result?.value) break;
        await sleep(250);
      }
      await sleep(2200);
      const m = await send('Runtime.evaluate', {
        expression: `JSON.stringify({e:(window.__ERRORS||[]).slice(0,4), sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, pg:(document.querySelector('.pg:not(.hidden)')||{}).id||null, tab:(typeof CTAB!=='undefined'?CTAB:null), txt:(document.querySelector('.app-content')||document.body).innerText.length})`,
        returnByValue: true
      });
      const d = JSON.parse(m.result?.result?.value || '{}');
      const overflow = d.sw > d.cw;
      const ok = (d.e || []).length === 0 && !overflow && d.txt > 200;
      rows.push({ mode, name, ok, errs: (d.e || []).length, overflow, pg: d.pg, tab: d.tab, txt: d.txt, first: (d.e || [])[0] || '' });
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      if (shot.result?.data) {
        const fs = await import('node:fs');
        fs.mkdirSync(path.join(HERE, 'sweep'), { recursive: true });
        fs.writeFileSync(path.join(HERE, 'sweep', `${mode}-${name}.png`), Buffer.from(shot.result.data, 'base64'));
      }
    }
  }
} finally { try { ws && ws.close(); } catch { } chrome.kill(); }

const bad = rows.filter(r => !r.ok);
console.log('vista'.padEnd(13) + 'modo'.padEnd(7) + 'err  desbord  texto');
for (const r of rows) {
  console.log((r.name).padEnd(13) + r.mode.padEnd(7) +
    String(r.errs).padEnd(5) + (r.overflow ? 'SI     ' : 'no     ') + String(r.txt).padEnd(7) +
    (r.ok ? '' : '  <-- ' + (r.first || (r.overflow ? 'desbordamiento' : 'sin contenido'))));
}
console.log('\n' + rows.length + ' vistas | ' + (rows.length - bad.length) + ' OK | ' + bad.length + ' con problemas');
process.exitCode = bad.length ? 1 : 0;
