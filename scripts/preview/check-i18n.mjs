// Comprueba que toda clave de traducción usada existe en los DOS bloques de
// TRANSLATIONS de lang.js (en y es).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') + '/';
const lang = fs.readFileSync(ROOT + 'lang.js', 'utf8');

const i = lang.indexOf('\n  es:');
const enBlock = lang.slice(0, i), esBlock = lang.slice(i);
const keysIn = src => new Set([...src.matchAll(/^\s*['"]([a-zA-Z0-9_]+)['"]\s*:/gm)].map(m => m[1]));
const EN = keysIn(enBlock), ES = keysIn(esBlock);

const files = ['index.html', 'core.js', 'lang.js', 'events.js', 'misc.js', 'analytics.js',
               'library.js', 'budget-timeline-guests.js', 'layout.js'];
const used = new Map();
for (const f of files) {
  const src = fs.readFileSync(ROOT + f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(f);
  }
  if (f.endsWith('.html')) {
    for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(f);
    }
  }
}

const missEn = [], missEs = [];
for (const [k, where] of used) {
  if (!EN.has(k)) missEn.push(k + ' (' + [...where].join(',') + ')');
  if (!ES.has(k)) missEs.push(k + ' (' + [...where].join(',') + ')');
}
console.log('claves usadas:', used.size, '| en:', EN.size, '| es:', ES.size);
console.log('FALTAN en el bloque en:', missEn.length ? '\n  ' + missEn.join('\n  ') : 'ninguna');
console.log('FALTAN en el bloque es:', missEs.length ? '\n  ' + missEs.join('\n  ') : 'ninguna');
const onlyEn = [...EN].filter(k => !ES.has(k));
const onlyEs = [...ES].filter(k => !EN.has(k));
console.log('solo en en:', onlyEn.length ? onlyEn.join(', ') : 'ninguna');
console.log('solo en es:', onlyEs.length ? onlyEs.join(', ') : 'ninguna');
