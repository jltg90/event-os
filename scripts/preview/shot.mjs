// Captura una pantalla de la app en Chrome headless y reporta los errores de
// consola.  Uso:  node shot.mjs <nombre> [query] [--tab=budget] [--w=1440] [--h=1400]
// Ejemplo:  node shot.mjs eventos "lang=es" --w=1440
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const name = args[0] || 'shot';
const query = (args[1] && !args[1].startsWith('--')) ? args[1] : '';
const flag = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const W = Number(flag('w', 1440)), H = Number(flag('h', 1500));
const page = flag('page', '');       // events | dashboard | analytics | library | project
const tab = flag('tab', '');         // dashboard | budget | timeline | guests | layout | moodboard
const pid = flag('pid', 'p1');
const wait = Number(flag('wait', 2600));
const PORT = process.env.PORT || 8123;
// Puerto de depuración propio por agente: varios Chrome a la vez chocarían en 9222.
const CDP = Number(flag('cdp', process.env.CDP_PORT || 9222));

// El "driver" corre dentro de la página: navega a la vista pedida y luego marca
// window.__READY para que sepamos que ya se puede capturar.
const driver = `
(function(){
  var done = function(){ window.__READY = true; };
  var tries = 0;
  var iv = setInterval(function(){
    tries++;
    var app = document.getElementById('pg-app');
    if(app && !app.classList.contains('hidden')){
      clearInterval(iv);
      setTimeout(function(){
        try{
          ${page === 'project'
            ? `openProject(${JSON.stringify(pid)});`
            : page ? `showPage(${JSON.stringify(page)});` : ''}
          ${tab ? `setTimeout(function(){ try{ switchTab(${JSON.stringify(tab)}); }catch(e){ window.__ERRORS.push('switchTab: '+e.stack); } done(); }, 900);` : 'done();'}
        }catch(e){ window.__ERRORS.push('driver: '+(e.stack||e)); done(); }
      }, 400);
    } else if(tries > 120){ clearInterval(iv); window.__ERRORS.push('driver: la app nunca salió del loader'); done(); }
  }, 100);
})();
`;

const url = `http://localhost:${PORT}/__preview?${query}${query ? '&' : ''}_drv=1`;
const png = path.join(OUT, name + '.png');
const userDir = path.join(HERE, '.chrome-profile-' + CDP);

// Se usa el protocolo de depuración para poder inyectar el driver y leer errores.
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + CDP + '', '--user-data-dir=' + userDir,
  '--window-size=' + W + ',' + H, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch('http://localhost:'+CDP+'/json/list').then(r => r.json());
      const t = list.find(x => x.type === 'page');
      if (t && t.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch { }
    await sleep(200);
  }
  throw new Error('no se pudo conectar a Chrome (CDP)');
}

let ws;
try {
  const wsUrl = await cdp();
  const { WebSocket } = await import('node:worker_threads').then(() => globalThis);
  ws = new (globalThis.WebSocket)(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  // La ventana de Chrome no baja de ~512 px de ancho, así que --window-size no
  // sirve para probar móvil de verdad.  Con setDeviceMetricsOverride el viewport
  // es exactamente el pedido (390 px es un iPhone real).
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: W <= 768
  });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: driver });
  await send('Page.navigate', { url });

  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 45000) {
    const r = await send('Runtime.evaluate', { expression: 'window.__READY === true', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === true) { ready = true; break; }
    await sleep(250);
  }
  await sleep(wait);

  const errs = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((window.__ERRORS||[]).slice(0,25))', returnByValue: true
  });
  const metrics = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      page: (document.querySelector('.pg:not(.hidden)')||{}).id || null,
      tab: (typeof CTAB!=='undefined'? CTAB : null),
      lang: (typeof LANG!=='undefined'? LANG : null),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      bodyH: document.body.scrollHeight
    })`, returnByValue: true
  });

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  if (shot.result && shot.result.data) fs.writeFileSync(png, Buffer.from(shot.result.data, 'base64'));

  console.log('READY:', ready);
  console.log('STATE:', metrics.result?.result?.value);
  const list = JSON.parse(errs.result?.result?.value || '[]');
  console.log('ERRORS(' + list.length + '):');
  list.forEach(e => console.log('  - ' + e));
  console.log('PNG:', png, fs.existsSync(png) ? '(' + Math.round(fs.statSync(png).size / 1024) + ' KB)' : '(NO SE ESCRIBIÓ)');
} finally {
  try { ws && ws.close(); } catch { }
  try { await fetch('http://localhost:'+CDP+'/json/close').catch(() => { }); } catch { }
  chrome.kill();
}
