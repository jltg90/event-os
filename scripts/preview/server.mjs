// Servidor de vista previa para verificar el rediseño sin tocar el repo.
// Sirve los archivos reales de c:\dev\event-os y expone /__preview, que es
// index.html con Clerk y Convex sustituidos por dobles de prueba con datos
// semilla.  Así se puede renderizar la app entera en Chrome headless.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function buildPreview(query) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const stub = fs.readFileSync(path.join(HERE, 'stub.js'), 'utf8');

  // 1. Fuera el cargador de Clerk (haría peticiones de red que aquí no existen).
  const clerkStart = html.indexOf('window.__clerkReady = (function(){');
  const clerkEnd = html.indexOf('})();', clerkStart);
  if (clerkStart === -1 || clerkEnd === -1) throw new Error('no se encontró el bloque de Clerk');
  // window.Clerk lo define stub.js, que se inyecta más abajo: por eso se resuelve
  // en un microtask y no de inmediato.
  // Se sondea window.Clerk en vez de resolver en un solo setTimeout: con un
  // único tick había una carrera y a veces resolvía con undefined.
  html = html.slice(0, clerkStart) +
    'window.__clerkReady = new Promise(function(r){ (function w(){ ' +
    'if (window.Clerk) return r(window.Clerk); setTimeout(w, 10); })(); });' +
    html.slice(clerkEnd + 5);

  // 2. Las fuentes de Google se dejan: sin ellas las métricas tipográficas cambian
  //    y no se puede juzgar el diseño de verdad.

  // 3. El doble de EVENTOS_DATA se inyecta tras app-data.js y antes de core.js,
  //    porque core.js hace `var EVENTOS_DATA = window.EVENTOS_DATA` al cargarse.
  const marker = '<script src="lang.js';
  const i = html.indexOf(marker);
  if (i === -1) throw new Error('no se encontró la etiqueta de lang.js');
  html = html.slice(0, i) +
    '<script>window.__PREVIEW_QUERY=' + JSON.stringify(query) + ';</script>\n<script>\n' + stub + '\n</script>\n' +
    html.slice(i);
  return html;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/__preview') {
      const body = buildPreview(Object.fromEntries(url.searchParams));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(body);
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(path.resolve(ROOT))) { res.writeHead(403); return res.end('forbidden'); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(e && e.stack || e));
  }
}).listen(PORT, () => console.log('preview http://localhost:' + PORT + '/__preview'));
