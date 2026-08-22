// Ejecuta una secuencia de comprobaciones funcionales dentro de la app real y
// reporta PASA/FALLA por cada una.  Uso: node probe.mjs [--cdp=9241]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const CDP = Number(flag('cdp', 9241));
const PORT = process.env.PORT || 8123;

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(HERE, '.chrome-probe-' + CDP),
  '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws;
try {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const l = await fetch('http://localhost:' + CDP + '/json/list').then(r => r.json());
      wsUrl = l.find(x => x.type === 'page')?.webSocketDebuggerUrl;
    } catch { }
    if (!wsUrl) await sleep(200);
  }
  ws = new globalThis.WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return { err: r.result.exceptionDetails.exception?.description || 'excepción' };
    return { val: r.result?.result?.value };
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://localhost:${PORT}/__preview?lang=es` });
  for (let i = 0; i < 100; i++) {
    const r = await evalJs("!!document.getElementById('pg-app') && !document.getElementById('pg-app').classList.contains('hidden')");
    if (r.val) break;
    await sleep(200);
  }
  await sleep(1200);

  const checks = [
    ['la app arranca en la lista de eventos',
      "document.querySelector('.pg:not(.hidden)').id", 'pg-events'],
    ['el sidebar muestra el contador de eventos',
      "document.getElementById('snav-events-count').textContent", '4'],
    ['la miga de pan dice Eventos',
      "document.getElementById('crumb-root').textContent", 'Eventos'],
    ['el buscador de la barra superior filtra la lista',
      "(function(){ topbarSearch('Vertiz'); return new Promise(function(r){ setTimeout(function(){ r(document.querySelectorAll('#evgrid .evc, #evgrid .rd-row, #evgrid article').length); },600); }); })()", 1],
    ['limpiar el buscador restaura los 4 eventos',
      "(function(){ topbarSearch(''); return new Promise(function(r){ setTimeout(function(){ r(document.querySelectorAll('#evgrid .evc, #evgrid .rd-row, #evgrid article').length); },600); }); })()", 4],
    ['toggleSidebar colapsa el sidebar',
      "(function(){ toggleSidebar(); return document.getElementById('app-sidebar').classList.contains('collapsed'); })()", true],
    ['toggleSidebar lo vuelve a abrir',
      "(function(){ toggleSidebar(); return document.getElementById('app-sidebar').classList.contains('collapsed'); })()", false],
    // Encadena la promesa a propósito: así esta comprobación falla si alguien
    // vuelve a envolver openProject sin devolver su resultado (bug de misc.js).
    ['openProject devuelve su promesa y actualiza la miga de pan',
      "(function(){ return openProject('p1').then(function(){ return document.getElementById('crumb-cur').textContent; }); })()", 'Boda Ramírez & Ortiz'],
    ['la cabecera del proyecto pinta la cuenta regresiva',
      "/85/.test(document.getElementById('pnav-days').textContent)", true],
    ['la cabecera del proyecto pinta el anillo de avance',
      "document.getElementById('pnav-ring').querySelectorAll('svg circle').length", 2],
    ['la pildora de tipo usa el tono correcto',
      "document.getElementById('pnav-type').className", 'rd-pill up t-accent'],
    ['el sidebar registra el evento activo',
      "document.getElementById('sb-active-name').textContent", 'Boda Ramírez & Ortiz'],
    ['cambiar de pestaña funciona',
      "(function(){ switchTab('budget'); return new Promise(function(r){ setTimeout(function(){ r(CTAB + '|' + document.querySelector('.ptab.active').dataset.tab); },700); }); })()", 'budget|budget'],
    ['volver a Eventos limpia la miga del proyecto',
      "(function(){ showPage('events'); return document.getElementById('crumb-project').style.display; })()", 'none'],
    ['cambiar a inglés traduce el sidebar',
      "(function(){ toggleLang(); return new Promise(function(r){ setTimeout(function(){ r(document.querySelector('#snav-events span').textContent + '|' + document.getElementById('crumb-root').textContent); },700); }); })()", 'Events|Events'],
    ['y vuelve a español',
      "(function(){ toggleLang(); return new Promise(function(r){ setTimeout(function(){ r(document.querySelector('#snav-events span').textContent); },700); }); })()", 'Eventos'],
    ['no hay desbordamiento horizontal',
      "document.documentElement.scrollWidth <= document.documentElement.clientWidth", true],
  ];

  let pass = 0, fail = 0;
  for (const [name, expr, expected] of checks) {
    const r = await evalJs(expr);
    const got = r.err ? 'ERROR: ' + r.err.split('\n')[0] : r.val;
    const ok = !r.err && got === expected;
    if (ok) { pass++; console.log('  PASA  ' + name); }
    else { fail++; console.log('  FALLA ' + name + '\n          esperado: ' + JSON.stringify(expected) + '\n          obtenido: ' + JSON.stringify(got)); }
  }
  const errs = await evalJs('JSON.stringify((window.__ERRORS||[]).slice(0,15))');
  const list = JSON.parse(errs.val || '[]');
  console.log('\nRESULTADO: ' + pass + ' pasan, ' + fail + ' fallan');
  console.log('errores de consola (' + list.length + '):');
  list.forEach(e => console.log('  - ' + e));
  process.exitCode = fail ? 1 : 0;
} finally {
  try { ws && ws.close(); } catch { }
  chrome.kill();
}
