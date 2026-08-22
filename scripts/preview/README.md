# Banco de pruebas visual (Chrome headless)

Sirve la app real de `c:\dev\event-os` con Clerk y Convex sustituidos por dobles
con datos semilla, la abre en Chrome headless, navega a la vista que le pidas,
captura un PNG y te lista los errores de consola.

**El servidor ya está corriendo** en `http://localhost:8123`. No lo arranques otra vez.
Lee los archivos del repo en cada petición, así que ve tus cambios sin reiniciar.
También inyecta todos los `scratchpad/css-*.css` (menos root/dark-root/shell,
que ya están fusionados en styles.css), así que tu CSS de módulo se ve en vivo.

## Uso

```bash
cd "C:/Users/jltg_/AppData/Local/Temp/claude/c--dev-event-os/f39b0509-3832-4dfb-8b62-45ef3b6bd8be/scratchpad/harness"
node shot.mjs <nombre-salida> "<query>" --page=<pagina> [--tab=<pestana>] [--cdp=<puerto>] [--w=1440] [--h=1600]
```

**IMPORTANTE — `--cdp`**: usa SIEMPRE el puerto que se te asignó en tu tarea.
Varios agentes capturando a la vez con el mismo puerto se pisan.

- `--page=` : `events` · `dashboard` (panel general) · `analytics` · `library` · `project`
- `--tab=`  : con `--page=project`: `dashboard` · `budget` · `timeline` · `guests` · `layout` · `moodboard`
- `--pid=`  : proyecto a abrir (`p1` por defecto: el más completo; `p2`, `p3`, `p4` con menos datos)
- query    : `lang=es` o `lang=en`; `theme=dark`; `empty=1` (sin proyectos → estados vacíos)
- `--w/--h`: tamaño de ventana. Móvil: `--w=390 --h=1400`. Tablet: `--w=900`.

El PNG queda en `harness/shots/<nombre>.png`. **Ábrelo con la herramienta Read para
mirarlo de verdad** — es la única forma de comprobar que el diseño quedó bien.

## Ejemplos

```bash
node shot.mjs mi-vista "lang=es" --page=project --tab=budget --cdp=9231
node shot.mjs mi-vista-en "lang=en" --page=project --tab=budget --cdp=9231
node shot.mjs mi-vista-dark "lang=es&theme=dark" --page=project --tab=budget --cdp=9231
node shot.mjs mi-vista-mob "lang=es" --page=project --tab=budget --cdp=9231 --w=390 --h=1500
node shot.mjs mi-vista-vacia "lang=es&empty=1" --page=events --cdp=9231
```

## Cómo leer la salida

- `READY: true` → la app arrancó y llegó a tu vista.
- `STATE: {...}` → página y pestaña activas, idioma y, muy importante,
  `scrollW` vs `clientW`: **si `scrollW > clientW` hay desbordamiento horizontal**, un bug.
- `ERRORS(n)` → errores de consola, excepciones y rechazos de promesa. **Debe ser 0.**

## Datos semilla

`p1` "Boda Ramírez & Ortiz" (social, confirmado, 85 días): 6 proveedores con pagos
parciales, 6 tareas (2 hechas, 1 vencida), 8 invitados con RSVP variado, 5 elementos
de plano. `p2` corporativo en progreso, `p3` comunitario por confirmar, `p4` educativo
vacío. `__library__` con 3 proveedores y 2 tareas. Todo en `harness/stub.js`.
