// Abre la URL de PRODUCCION real en Chrome headless, captura y reporta errores.
// No hay dobles de prueba aquí: es el sitio publicado tal cual.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const CDP = Number(arg('cdp') || 9270);
const URL_ = arg('url') || 'https://topinfra-eventos.vercel.app/';
const W = Number(arg('w') || 1440), H = Number(arg('h') || 1000);
const NAME = arg('name') || 'live';

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
   '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(HERE, '.chrome-live-' + CDP),
   '--window-size=1500,1100', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let u; for (let i = 0; i < 90 && !u; i++) { try { u = (await fetch(`http://localhost:${CDP}/json/list`).then(r => r.json())).find(x => x.type === 'page')?.webSocketDebuggerUrl; } catch { } if (!u) await sleep(200); }
  ws = new globalThis.WebSocket(u); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const p = new Map(); const logs = []; const failed = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      logs.push(m.params.type + ': ' + (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      logs.push('excepcion: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').split('\n')[0]);
    if (m.method === 'Network.loadingFailed') failed.push(m.params.type + ' ' + (m.params.errorText || ''));
  };
  const send = (m, q) => new Promise(r => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: q || {} })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W <= 768 });
  await send('Page.navigate', { url: URL_ });
  await sleep(9000);

  const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result?.result?.value;
  const state = await ev(`JSON.stringify({
    titulo: document.title,
    pantalla: document.getElementById('pg-signin') && getComputedStyle(document.getElementById('pg-signin')).display !== 'none' ? 'acceso'
            : (document.getElementById('pg-app') && !document.getElementById('pg-app').classList.contains('hidden')) ? 'app'
            : 'cargando',
    tokenPaper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
    tokenAccent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    fuenteBody: getComputedStyle(document.body).fontFamily,
    cormorantCargada: !!Array.from(document.fonts).some(f=>/Cormorant/.test(f.family)),
    dmsansCargada: !!Array.from(document.fonts).some(f=>/DM Sans/.test(f.family)),
    clerkPresente: !!window.Clerk,
    hayRdCss: !!getComputedStyle(document.documentElement).getPropertyValue('--espresso').trim(),
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth
  })`);
  console.log('URL     :', URL_);
  console.log('ESTADO  :', state);
  console.log('errores/avisos de consola (' + logs.length + '):'); logs.slice(0, 10).forEach(l => console.log('   - ' + l));
  console.log('recursos fallidos (' + failed.length + '):'); failed.slice(0, 6).forEach(l => console.log('   - ' + l));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  if (shot.result?.data) {
    fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
    const f = path.join(HERE, 'shots', NAME + '.png');
    fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'));
    console.log('PNG     :', f);
  }
} finally { try { ws && ws.close(); } catch { } chrome.kill(); }
