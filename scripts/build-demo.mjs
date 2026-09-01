// Genera un DEMO estático y autónomo de EventOS, para enseñarlo en una junta.
//
// El repo ya tenía el demo hecho, pero solo vivía en memoria del servidor de
// vista previa (scripts/preview/server.mjs): armaba el HTML al vuelo y no
// escribía nada. Este script hace la misma sustitución y la deja en disco.
//
// Lo que sale en `demo/` es un sitio COMPLETO y aislado: index.html con los
// dobles de Clerk y de la capa de datos incrustados, más los .js y .css que
// necesita. No lleva credenciales, no habla con Convex y no puede llegar a los
// expedientes de nadie — el peligro de servir el demo desde el mismo sitio que
// la app real es que alguien navegue de uno al otro, y aquí la app real
// sencillamente no está.
//
//   node scripts/build-demo.mjs            # escribe ./demo
//   node scripts/build-demo.mjs --salida x # a otra carpeta

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const i = process.argv.indexOf("--salida");
const SALIDA = path.resolve(RAIZ, i > -1 ? process.argv[i + 1] : "demo");

/** Todo lo que index.html carga con ruta relativa. */
const ACTIVOS = [
  "styles.css",
  "app-config.js",
  "app-data.js",
  "lang.js",
  "core.js",
  "events.js",
  "budget-timeline-guests.js",
  "layout.js",
  "misc.js",
  "analytics.js",
  "library.js",
  "chair-images.js",
];

/**
 * El letrero. Va fijo y por encima de todo: en una junta, con el proyector
 * prendido, nadie debe poder confundir esto con el sistema de un cliente.
 * `pointer-events:none` para que no tape ningún control de la app.
 */
const LETRERO = `
<style>
  #demo-aviso {
    position: fixed; inset: auto 0 0 0; z-index: 2147483647;
    display: flex; justify-content: center; pointer-events: none;
    padding: 0 0 14px;
    font-family: "DM Sans", system-ui, sans-serif;
  }
  #demo-aviso span {
    background: #0e2a33; color: #f2f6f6;
    border: 1px solid rgba(242,246,246,.28);
    border-radius: 999px; padding: 7px 16px;
    font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
    box-shadow: 0 8px 30px -12px rgba(0,0,0,.7);
  }
  #demo-aviso b { color: #b9945a; font-weight: 500; }
  @media print { #demo-aviso { display: none; } }
</style>
<div id="demo-aviso" role="status"><span><b>Demostración</b> · datos ficticios</span></div>
`;

function construir() {
  let html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const doble = fs.readFileSync(path.join(AQUI, "preview", "stub.js"), "utf8");

  // 1. Fuera el cargador de Clerk: haría peticiones de red que en el demo no
  //    existen, y dejaría la app esperando una sesión que nadie va a abrir.
  const ini = html.indexOf("window.__clerkReady = (function(){");
  const fin = html.indexOf("})();", ini);
  if (ini === -1 || fin === -1) {
    throw new Error(
      "No se encontró el bloque de Clerk en index.html. Si cambió su forma, hay " +
        "que actualizar este script Y scripts/preview/server.mjs, que hace lo mismo."
    );
  }
  // Se SONDEA window.Clerk en vez de resolver en un solo tick: el doble lo
  // define más abajo y con un único setTimeout había una carrera que a veces
  // resolvía con undefined.
  html =
    html.slice(0, ini) +
    "window.__clerkReady = new Promise(function(r){ (function w(){ " +
    "if (window.Clerk) return r(window.Clerk); setTimeout(w, 10); })(); });" +
    html.slice(fin + 5);

  // 2. El doble de datos entra ANTES de lang.js, porque core.js hace
  //    `var EVENTOS_DATA = window.EVENTOS_DATA` en cuanto se carga.
  const marca = '<script src="lang.js';
  const j = html.indexOf(marca);
  if (j === -1) throw new Error("No se encontró la etiqueta de lang.js en index.html");
  html =
    html.slice(0, j) +
    "<script>window.__PREVIEW_QUERY={};</script>\n<script>\n" +
    doble +
    "\n</script>\n" +
    html.slice(j);

  // 3. Fuera de los buscadores: es una demostración, no contenido del negocio,
  //    y no debe competir con el sitio real en resultados.
  html = html.replace(
    /<head>/i,
    '<head>\n  <meta name="robots" content="noindex, nofollow">'
  );

  // 4. El letrero, al final del body para que quede encima de todo.
  html = html.replace(/<\/body>/i, LETRERO + "</body>");
  return html;
}

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, "index.html"), construir());

let copiados = 0;
for (const a of ACTIVOS) {
  const origen = path.join(RAIZ, a);
  if (!fs.existsSync(origen)) continue;
  fs.copyFileSync(origen, path.join(SALIDA, a));
  copiados++;
}

console.log(`Demo escrito en ${SALIDA}`);
console.log(`  index.html + ${copiados} archivo(s) de ${ACTIVOS.length}`);
console.log("  sin Clerk, sin Convex, sin credenciales: no puede llegar a datos reales.");
