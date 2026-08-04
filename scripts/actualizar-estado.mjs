// Reporta el status.json de ESTE repo a la plataforma Cuadra.
//
// Sustituye al viejo protocolo de "el dashboard lee status.json desde GitHub":
// desde el 2026-08-04 la fuente de verdad es la tabla `proyectos` en Convex, y
// este script es el puente. El archivo status.json se conserva como espejo
// legible en git, pero ya no es lo que se lee.
//
//   node scripts/actualizar-estado.mjs
//   node scripts/actualizar-estado.mjs --simular   # muestra lo que enviaría
//
// Necesita dos variables (en .env.local del repo, o en el entorno):
//   CUADRA_URL     https://<deployment>.convex.site
//   CUADRA_TOKEN   el TOKEN_ESTADO de la plataforma
//
// Este script es genérico: cópialo tal cual a cualquier repo del negocio.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SIMULAR = process.argv.includes("--simular");
const RAIZ = process.cwd();

function leerEnvLocal() {
  const ruta = resolve(RAIZ, ".env.local");
  if (!existsSync(ruta)) return {};
  return Object.fromEntries(
    readFileSync(ruta, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const env = { ...leerEnvLocal(), ...process.env };
const URL_BASE = env.CUADRA_URL;
const TOKEN = env.CUADRA_TOKEN;

if (!URL_BASE || !TOKEN) {
  console.error(
    "Faltan CUADRA_URL y/o CUADRA_TOKEN.\n" +
      "Agrégalas al .env.local de este repo:\n" +
      "  CUADRA_URL=https://<deployment>.convex.site\n" +
      "  CUADRA_TOKEN=<TOKEN_ESTADO de la plataforma>"
  );
  process.exit(1);
}

const rutaStatus = resolve(RAIZ, "status.json");
if (!existsSync(rutaStatus)) {
  console.error(`No hay status.json en ${RAIZ}`);
  process.exit(1);
}

let status;
try {
  status = JSON.parse(readFileSync(rutaStatus, "utf8"));
} catch (e) {
  console.error(`status.json no es JSON válido: ${e.message}`);
  process.exit(1);
}

// El slug identifica al proyecto en la plataforma. Se toma del campo "proyecto"
// salvo que el status.json traiga un "slug" explícito.
const cuerpo = { ...status, slug: status.slug ?? status.proyecto };

if (!cuerpo.slug) {
  console.error('status.json necesita un campo "proyecto" (o "slug").');
  process.exit(1);
}

if (SIMULAR) {
  console.log(`SIMULACIÓN → POST ${URL_BASE}/estado`);
  console.log(JSON.stringify(cuerpo, null, 2));
  process.exit(0);
}

const res = await fetch(`${URL_BASE.replace(/\/$/, "")}/estado`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify(cuerpo),
});

const texto = await res.text();
let datos;
try {
  datos = JSON.parse(texto);
} catch {
  datos = { raw: texto };
}

if (!res.ok) {
  console.error(`✗ La plataforma respondió ${res.status}`);
  console.error(JSON.stringify(datos, null, 2));
  process.exit(1);
}

console.log(
  `✓ ${cuerpo.slug} reportado a la plataforma${datos.creado ? " (dado de alta)" : ""}`
);
