
function fixMojibake(str){
  if(typeof str !== 'string') return str;
  var fixed = str;
  try{
    if(/[ÃÂâð]/.test(fixed)){
      var decoded = decodeURIComponent(escape(fixed));
      if(decoded && decoded !== fixed) fixed = decoded;
    }
  }catch(e){}
  var replacements = {
    'Ã¡':'á','Ã©':'é','Ã­':'í','Ã³':'ó','Ãº':'ú',
    'Ã':'Á','Ã‰':'É','Ã':'Í','Ã“':'Ó','Ãš':'Ú',
    'Ã±':'ñ','Ã‘':'Ñ','Ã¼':'ü','Ãœ':'Ü',
    'Â¿':'¿','Â¡':'¡',
    'â‚¬':'€','Â£':'£','Â¥':'¥',
    'â†‘':'↑','â†“':'↓',
    'âœ“':'✓','âš ':'⚠',
    'ðŸ“‹':'📋','ðŸšª':'🚪','ðŸ’±':'💱','ðŸ’¾':'💾','ðŸ“':'📐','ðŸ“„':'📄','ðŸ—ºï¸':'🗺️',
    'SesiÃ³n':'Sesión','SÃ­':'Sí','EstÃ¡s':'Estás','EstadÃ­sticas':'Estadísticas',
    'MÃ¡s':'Más','DiseÃ±o':'Diseño','PlanificaciÃ³n':'Planificación','dÃ­as':'días',
    'VariaciÃ³n':'Variación','UbicaciÃ³n':'Ubicación','CuadrÃ­cula':'Cuadrícula',
    'AnalÃ­tica':'Analítica','AÃ±o':'Año','PrÃ³ximos':'Próximos','mÃ¡s':'más',
    'aquÃ­':'aquí','PerÃ­odo':'Período','CategorÃ­as':'Categorías','LÃ­nea':'Línea',
    'PresentaciÃ³n':'Presentación'
  };
  Object.keys(replacements).forEach(function(key){
    fixed = fixed.split(key).join(replacements[key]);
  });
  return fixed;
}
function t(key){ return fixMojibake((TRANSLATIONS[LANG]||TRANSLATIONS.en)[key] || TRANSLATIONS.en[key] || key); }
// Pluralization helper: tp('n_guests', 5) → "5 guests" (uses "singular | plural" format)
function tp(key, n){
  var raw = t(key);
  var parts = raw.split('|');
  var form = (n === 1 && parts.length > 1) ? parts[0].trim() : (parts[1] || parts[0]).trim();
  return form.replace(/\{n\}/g, String(n));
}
function repairMojibakeInDOM(root){
  try{
    var scope = root || document.body;
    if(!scope || typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') return;
    var textFilter = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) ? NodeFilter.SHOW_TEXT : 4;
    var walker = document.createTreeWalker(scope, textFilter, null);
    var node;
    while((node = walker.nextNode())){
      if(!node.nodeValue || !/[ÃÂâð]/.test(node.nodeValue)) continue;
      var repaired = fixMojibake(node.nodeValue);
      if(repaired !== node.nodeValue) node.nodeValue = repaired;
    }
    var elements = scope.querySelectorAll ? scope.querySelectorAll('[title],[placeholder],input[value],textarea,option') : [];
    elements.forEach(function(el){
      if(el.title && /[ÃÂâð]/.test(el.title)) el.title = fixMojibake(el.title);
      if(el.placeholder && /[ÃÂâð]/.test(el.placeholder)) el.placeholder = fixMojibake(el.placeholder);
      if(el.tagName === 'OPTION' && el.textContent && /[ÃÂâð]/.test(el.textContent)) el.textContent = fixMojibake(el.textContent);
      if((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.readOnly && typeof el.value === 'string' && /[ÃÂâð]/.test(el.value)){
        el.value = fixMojibake(el.value);
      }
    });
  }catch(e){}
}
var _mojibakeObserver = null;
var _mojibakeCleanStreak = 0;
// Tras esta racha de mutaciones sin encontrar nada corrupto, el observer se apaga.
// Los literales del codigo fuente ya estan limpios; esto solo queda como red de
// seguridad para datos antiguos guardados con la codificacion rota, y no tiene por
// que seguir recorriendo el DOM durante toda la sesion.
var _MOJIBAKE_MAX_CLEAN_STREAK = 400;

function startMojibakeObserver(){
  try{
    if(_mojibakeObserver || typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') return;
    repairMojibakeInDOM(document.body);
    _mojibakeObserver = new MutationObserver(function(mutations){
      try{
        var touched = false;
        mutations.forEach(function(mutation){
          mutation.addedNodes && mutation.addedNodes.forEach(function(node){
            if(node.nodeType === 3){
              if(node.nodeValue && /[ÃÂâð]/.test(node.nodeValue)){
                node.nodeValue = fixMojibake(node.nodeValue);
                touched = true;
              }
              return;
            }
            if(node.nodeType !== 1) return;
            // Un unico test sobre textContent evita montar un TreeWalker sobre cada
            // subarbol insertado.  En vistas grandes (un plano con 200 mesas) esto
            // era el coste real del parche.
            var txt = node.textContent;
            if(txt && /[ÃÂâð]/.test(txt)){
              repairMojibakeInDOM(node);
              touched = true;
            }
          });
          if(mutation.type === 'characterData' && mutation.target && mutation.target.nodeValue && /[ÃÂâð]/.test(mutation.target.nodeValue)){
            mutation.target.nodeValue = fixMojibake(mutation.target.nodeValue);
            touched = true;
          }
        });
        if(touched){
          _mojibakeCleanStreak = 0;
        } else if(++_mojibakeCleanStreak >= _MOJIBAKE_MAX_CLEAN_STREAK){
          _mojibakeObserver.disconnect();
          _mojibakeObserver = null;
        }
      }catch(e){}
    });
    _mojibakeObserver.observe(document.body, { childList:true, subtree:true, characterData:true });
  }catch(e){}
}

function getLangPrefKey(userId){
  return 'eventos_lang_' + (userId || 'local');
}

function saveLangPref(){
  try{
    localStorage.setItem(getLangPrefKey(DB.cur), LANG);
  }catch(e){ console.warn('EventOS: saveLangPref failed', e); }
}

function loadLangPref(){
  try{
    var saved = localStorage.getItem(getLangPrefKey(DB.cur));
    if(saved === 'en' || saved === 'es') LANG = saved;
  }catch(e){ console.warn('EventOS: loadLangPref failed', e); }
}


function toggleLang(){
  LANG = LANG==='en' ? 'es' : 'en';
  saveLangPref();
  const btn = document.getElementById('lang-label');
  if(btn) btn.textContent = LANG==='es' ? 'EN' : 'ES';
  refreshDefaultData();
  applyTranslations();
  toast(LANG==='es'?'Idioma cambiado a Español':'Language changed to English','s');
}

function refreshDefaultData(){
  const p = proj ? proj() : null;
  if(!p) return;
  let changed = false;
  const freshVendors = defaultVendors();
  p.vendors = p.vendors.map(v => {
    if(/^dv\d$/.test(v.id)){
      const fresh = freshVendors.find(f => f.id === v.id);
      if(fresh) return Object.assign({}, fresh, { budget: v.budget, hired: v.hired, payments: v.payments, notes: v.notes });
    }
    return v;
  });
  const freshTasks = defaultTasks();
  p.tasks = p.tasks.map(tk => {
    if(/^t\d{1,2}$/.test(tk.id)){
      const fresh = freshTasks.find(f => f.id === tk.id);
      if(fresh) return Object.assign({}, fresh, { done: tk.done, dueDate: tk.dueDate });
    }
    return tk;
  });
  saveProj(p);
}

function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.dataset.i18n;
    const tr = t(key);
    if(el.children.length===0){
      el.textContent = tr;
    } else {
      const nodes = Array.from(el.childNodes);
      const last = nodes.filter(n=>n.nodeType===3).pop();
      if(last) last.textContent = tr;
      else el.insertAdjacentText('beforeend', tr);
    }
  });
  const page = document.querySelector('.pg:not(.hidden)');
  if(page){
    const pid = page.id;
    if(pid==='pg-dashboard') renderAppDash();
    else if(pid==='pg-events') renderEvents();
    else if(pid==='pg-analytics'){ renderAnalytics(); updateAnalyticsLabels(); }
    else if(pid==='pg-library'){
      renderLibrary();
      if(typeof _libEditingLayoutId!=='undefined'&&_libEditingLayoutId&&typeof renderLayout==='function'){
        renderLayout();
        setTimeout(function(){ lZoom(0,'fit'); },120);
      }
    }
    else if(pid==='pg-project'){
      renderPNav();
      const tabs = ['dashboard','budget','timeline','guests','layout','moodboard'];
      tabs.forEach(tab=>{
        const el = document.getElementById('tab-'+tab);
        if(el && !el.classList.contains('hidden')){
          ({dashboard:renderDash,budget:renderBudget,timeline:renderTimeline,guests:renderGuests,layout:renderLayout,moodboard:renderMoodboard})[tab]?.();
        }
      });
    }
  }
  updateEvSortLabel();
  updateAnalyticsLabels();
  updateEvFilterLabels();
  updateLibraryLabels();
  if(typeof _libUpdateSectionLabels==='function') _libUpdateSectionLabels();
  const tabMap = {dashboard:'tab_dashboard',budget:'tab_budget',timeline:'tab_timeline',guests:'tab_guests',layout:'tab_layout',moodboard:'tab_moodboard'};
  document.querySelectorAll('.ptab[data-tab]').forEach(btn=>{
    const key = tabMap[btn.dataset.tab];
    if(key){
      const nodes = Array.from(btn.childNodes);
      const textNode = nodes.find(n=>n.nodeType===3 && n.textContent.trim());
      if(textNode) textNode.textContent = t(key);
    }
  });
  const backBtn = document.querySelector('[data-i18n="back_to_events"]');
  if(backBtn) backBtn.textContent = t('back_to_events');
  document.querySelectorAll('.umenu-item').forEach(el=>{
    if(el.dataset.i18n) el.textContent = t(el.dataset.i18n);
  });
  // El atributo lang del documento estaba fijo en "en" aunque el idioma por defecto
  // de la app es español: los lectores de pantalla leian el español con fonetica
  // inglesa.  Se sincroniza con LANG en cada aplicacion de traducciones.
  if(document.documentElement) document.documentElement.lang = LANG;
  const lb = document.getElementById('lang-btn');
  if(lb) lb.title = LANG==='en' ? 'Cambiar a Español' : 'Switch to English';
  const mlb = document.getElementById('mob-lang-label');
  if(mlb) mlb.textContent = LANG==='es' ? 'English / Inglés' : 'Español / Spanish';
  const ll = document.getElementById('lang-label');
  if(ll) ll.textContent = LANG==='es' ? 'EN' : 'ES';
  var tl_ = document.getElementById('tour-label');
  if(tl_) tl_.textContent = LANG==='es' ? 'Guía' : 'Highlights';
  // Shell del rediseno: migas, contador de eventos, evento activo, buscador.
  if(typeof rdUpdateShell === "function") rdUpdateShell();
  if(typeof setSyncStatus === "function" && _lastSyncAt) setSyncStatus("ok");
  repairMojibakeInDOM(document.body);
}


var DB  = { cur: null, projects: {} };
// Perfil del usuario firmado, tal y como lo devuelve Clerk + auth:ensureIdentity.
// Sustituye al antiguo WIX_USER; se rellena en initApp().
// (WIX_USER retirado en la migracion a Clerk: usar USER_PROFILE)

// ── Centralized State ──────────────────────────────────────────────────────
// AppState wraps existing globals into a single observable object.
// Modules can subscribe to specific keys via AppState.on(key, callback).
// Existing code continues to use the globals directly — AppState bridges them.
var AppState = {
  _listeners: {},
  on: function(key, fn){ if(!this._listeners[key]) this._listeners[key]=[]; this._listeners[key].push(fn); },
  off: function(key, fn){ if(!this._listeners[key]) return; this._listeners[key]=this._listeners[key].filter(function(f){return f!==fn;}); },
  emit: function(key, val){ (this._listeners[key]||[]).forEach(function(fn){ try{fn(val);}catch(e){console.warn('AppState listener error',key,e);} }); },
  // Convenience getters/setters that also emit
  get currentUserId(){ return DB.cur; },
  set currentUserId(v){ DB.cur=v; this.emit('currentUserId',v); },
  get currentProjectId(){ return typeof CID !== 'undefined' ? CID : null; },
  set currentProjectId(v){ CID=v; this.emit('currentProjectId',v); },
  get currentTab(){ return typeof CTAB !== 'undefined' ? CTAB : 'dashboard'; },
  set currentTab(v){ CTAB=v; this.emit('currentTab',v); },
  get lang(){ return LANG; },
  set lang(v){ LANG=v; this.emit('lang',v); },
};
window.AppState = AppState;

// ── Module Registry ────────────────────────────────────────────────────────
// Provides a namespace for modules to register public APIs.
// Usage: EventOS.register('budget', { renderBudget, calcBudgetStats });
// Access: EventOS.budget.renderBudget();
// Existing global functions remain — this is additive, not a rewrite.
window.EventOS = window.EventOS || {};
EventOS.register = function(name, api){
  EventOS[name] = Object.assign(EventOS[name] || {}, api);
};

var EVENTOS_CONFIG = window.EVENTOS_CONFIG || {};
var AI_PROXY_URL = EVENTOS_CONFIG.aiProxyUrl || '';
var EVENTOS_DATA = window.EVENTOS_DATA || null;
var _saveTimer = null;
var _saveInFlight = false;
var _pendingSaves = {};  // id -> project: projects waiting on the debounce timer or queued behind an in-flight save
var _lastSyncTime = null;
var _syncCycleCount = 0;    // tracks manualSync cycles for periodic reconciliation

var _fileUrlCache = {};
var _fileUrlCacheKeys = []; // LRU order tracking
var _FILE_URL_CACHE_MAX = 300;
function _fileUrlCacheSet(id, url){
  if(_fileUrlCache[id]){
    // Move existing entry to end of LRU queue
    var idx = _fileUrlCacheKeys.indexOf(id);
    if(idx > -1) _fileUrlCacheKeys.splice(idx, 1);
  }
  _fileUrlCacheKeys.push(id);
  // Evict oldest entries when exceeding max
  while(_fileUrlCacheKeys.length > _FILE_URL_CACHE_MAX){
    var old = _fileUrlCacheKeys.shift();
    delete _fileUrlCache[old];
  }
  _fileUrlCache[id] = url;
}
var _loadedProjects = {}; // { userId: Set<projectId> } — tracks which projects have full data loaded

// Los archivos subidos antes de que existiera la tabla file_ownership no tienen dueno
// registrado.  El backend ya no los sirve por defecto (antes "sin registro" = permitido,
// lo que dejaba leer y borrar archivos ajenos), asi que hay que reclamarlos: el servidor
// solo concede la propiedad si el id aparece en los documentos del propio usuario.
var _claimedLegacyFiles = false;
async function _claimLegacyFileOwnership(ids){
  if(_claimedLegacyFiles || !ids || !ids.length) return;
  if(!EVENTOS_DATA || !EVENTOS_DATA.claimFileOwnership) return;
  _claimedLegacyFiles = true;   // un intento por sesion: es una migracion, no un bucle
  try{
    var n = await EVENTOS_DATA.claimFileOwnership(ids);
    if(n) console.info('EventOS: reclamados', n, 'archivo(s) heredados');
  }catch(e){ console.warn('EventOS: claimFileOwnership failed', e); }
}

// Pide las URLs y, si alguna vuelve null porque el archivo no tiene dueno registrado,
// reclama la propiedad y reintenta una sola vez.
async function _getFileUrlsWithClaim(ids){
  var urls = await EVENTOS_DATA.getFileUrls(ids);
  var missing = [];
  ids.forEach(function(id, i){ if(!urls[i]) missing.push(id); });
  if(missing.length && !_claimedLegacyFiles){
    await _claimLegacyFileOwnership(missing);
    urls = await EVENTOS_DATA.getFileUrls(ids);
  }
  return urls;
}

function hasRequiredConfig(){
  // El proxy de IA ya NO es requisito: es una funcion opcional y su ausencia
  // impedia arrancar la app entera.  Lo imprescindible es la URL de Convex.
  return !!(EVENTOS_DATA && EVENTOS_DATA.isConfigured && EVENTOS_DATA.isConfigured());
}

function getConfigErrorMessage(){
  if(EVENTOS_DATA && EVENTOS_DATA.getConfigErrorMessage) return EVENTOS_DATA.getConfigErrorMessage();
  return 'Missing app configuration. Check app-config.js and reload.';
}

// Strip a project down to metadata fields for localStorage caching.
// Keeps tasks (needed for renderAppDash), drops vendors/guests/layouts/moodboard.
function _projectToMetaStub(p){
  if(!p) return p;
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    date: p.date,
    location: p.location,
    type: p.type,
    status: p.status,
    budget: p.budget,
    description: p.description,
    tasks: p.tasks,
    share: p.share,
    _seeded: p._seeded,
    _metaOnly: true
  };
}

// Presupuesto de espacio para los proyectos que se cachean COMPLETOS.
// Antes el cache guardaba solo stubs de metadata, asi que sin conexion la lista de
// eventos se veia pero abrir cualquiera fallaba con "err_network": el modo offline
// existia en la UI pero no en los datos.  Ahora se guardan enteros el proyecto
// abierto y los ultimos usados, hasta agotar el presupuesto.
var _CACHE_FULL_BUDGET_BYTES = 3 * 1024 * 1024;
var _CACHE_MAX_FULL_PROJECTS = 5;
var _recentProjectIds = [];   // ids abiertos recientemente, mas reciente primero

function _touchRecentProject(pid){
  if(!pid || pid === '__lib_layout__') return;
  var i = _recentProjectIds.indexOf(pid);
  if(i > -1) _recentProjectIds.splice(i, 1);
  _recentProjectIds.unshift(pid);
  if(_recentProjectIds.length > 20) _recentProjectIds.length = 20;
}

// cacheDB serializa proyectos completos, asi que puede costar varios MB.  saveProj()
// la llama en CADA edicion; sin este throttle el tipeo en un proyecto grande se nota.
var _cacheTimer = null;
function cacheDB(){
  if(_cacheTimer) return;
  _cacheTimer = setTimeout(function(){ _cacheTimer = null; _cacheDBNow(); }, 1500);
}
function cacheDBNow(){
  if(_cacheTimer){ clearTimeout(_cacheTimer); _cacheTimer = null; }
  _cacheDBNow();
}
function _cacheDBNow(){
  if(!DB.cur) return;
  var projects = DB.projects[DB.cur] || {};
  var key = 'eventos_cache_'+DB.cur;

  // Orden de prioridad para guardar completo: biblioteca, proyecto abierto, recientes.
  var priority = ['__library__'];
  if(CID) priority.push(CID);
  _recentProjectIds.forEach(function(pid){ if(priority.indexOf(pid) === -1) priority.push(pid); });

  function build(maxFull, budget){
    var toCache = {};
    var used = 0, fullCount = 0;
    priority.forEach(function(pid){
      var p = projects[pid];
      if(!p || p._metaOnly) return;
      if(fullCount >= maxFull) return;
      // Copia sin banderas transitorias: si _pendingSave viajara al cache, al
      // restaurarlo la app creeria que hay cambios sin guardar y bloquearia para
      // siempre la sincronizacion desde el servidor.
      var copy;
      var s;
      try{
        copy = JSON.parse(JSON.stringify(p));
        delete copy._pendingSave; delete copy._migrating; delete copy._fromCache;
        s = JSON.stringify(copy);
      }catch(e){ return; }
      if(used + s.length > budget) return;
      used += s.length;
      fullCount++;
      toCache[pid] = copy;
    });
    Object.keys(projects).forEach(function(pid){
      if(toCache[pid]) return;
      toCache[pid] = _projectToMetaStub(projects[pid]);
    });
    return toCache;
  }

  // Degradacion progresiva ante QuotaExceededError: menos proyectos completos,
  // y en el peor caso solo stubs (el comportamiento anterior).
  var plans = [
    [_CACHE_MAX_FULL_PROJECTS, _CACHE_FULL_BUDGET_BYTES],
    [2, Math.floor(_CACHE_FULL_BUDGET_BYTES / 2)],
    [1, Math.floor(_CACHE_FULL_BUDGET_BYTES / 4)],
    [0, 0]
  ];
  for(var i = 0; i < plans.length; i++){
    try{
      localStorage.setItem(key, JSON.stringify(build(plans[i][0], plans[i][1])));
      return;
    }catch(e){
      if(i === plans.length - 1) console.warn('EventOS: saveCache failed', e);
    }
  }
}

function loadCache(userId){
  try{
    var s = localStorage.getItem('eventos_cache_'+userId);
    if(!s) return false;
    var parsed = JSON.parse(s);
    // Marca lo que viene del cache: la carga de fondo debe poder pisarlo con la
    // version del servidor, cosa que no ocurriria si pareciera un proyecto ya
    // completo y fresco en memoria.
    Object.keys(parsed).forEach(function(pid){
      if(parsed[pid] && !parsed[pid]._metaOnly) parsed[pid]._fromCache = true;
    });
    DB.projects[userId] = parsed;
    return true;
  }catch(e){ console.warn('EventOS: loadCache failed', e); }
  return false;
}

// Resolve Convex storage IDs to URLs for display in a single project
async function resolveStorageUrls(p){
  if(!p || typeof p !== 'object') return;
  var ids = [];
  // Moodboard images
  var mb = p.moodboard;
  if(mb && typeof mb === 'object'){
    var allImgs = (mb.uncategorized || []).concat(
      (mb.folders || []).reduce(function(acc, f){ return acc.concat(f.images || []); }, [])
    );
    allImgs.forEach(function(img){
      if(img.storageId && !_fileUrlCache[img.storageId]) ids.push(img.storageId);
    });
  }
  // Payment receipts
  (p.vendors || []).forEach(function(v){
    (v.payments || []).forEach(function(pay){
      if(pay.receiptStorageId && !_fileUrlCache[pay.receiptStorageId]) ids.push(pay.receiptStorageId);
    });
  });
  // Floorplan
  if(p.floorplan && p.floorplan._storageId && !_fileUrlCache[p.floorplan._storageId]){
    ids.push(p.floorplan._storageId);
  }
  if(!ids.length) return;
  // Deduplicate
  var unique = []; var seen = {};
  ids.forEach(function(id){ if(!seen[id]){ seen[id]=true; unique.push(id); } });
  try{
    var urls = await _getFileUrlsWithClaim(unique);
    unique.forEach(function(id, i){ if(urls[i]) _fileUrlCacheSet(id, urls[i]); });
  }catch(e){ console.error('resolveStorageUrls:', e); return; }
  // Populate src fields from cache
  if(mb && typeof mb === 'object'){
    var populate = function(img){
      if(img.storageId && _fileUrlCache[img.storageId]) img.src = _fileUrlCache[img.storageId];
    };
    (mb.uncategorized || []).forEach(populate);
    (mb.folders || []).forEach(function(f){ (f.images || []).forEach(populate); });
  }
  (p.vendors || []).forEach(function(v){
    (v.payments || []).forEach(function(pay){
      if(pay.receiptStorageId && _fileUrlCache[pay.receiptStorageId]) pay.receipt = _fileUrlCache[pay.receiptStorageId];
    });
  });
  if(p.floorplan && p.floorplan._storageId && _fileUrlCache[p.floorplan._storageId]){
    if(p.floorplan.img === '__stored__') p.floorplan.img = _fileUrlCache[p.floorplan._storageId];
  }
}

// Resolve URLs for all projects belonging to a user
async function resolveAllProjectUrls(userId){
  var projects = DB.projects[userId];
  if(!projects) return;
  var allIds = [];
  Object.keys(projects).forEach(function(pid){
    var p = projects[pid];
    if(!p || typeof p !== 'object') return;
    var mb = p.moodboard;
    if(mb && typeof mb === 'object'){
      (mb.uncategorized || []).concat(
        (mb.folders || []).reduce(function(acc, f){ return acc.concat(f.images || []); }, [])
      ).forEach(function(img){
        if(img.storageId && !_fileUrlCache[img.storageId]) allIds.push(img.storageId);
      });
    }
    (p.vendors || []).forEach(function(v){
      (v.payments || []).forEach(function(pay){
        if(pay.receiptStorageId && !_fileUrlCache[pay.receiptStorageId]) allIds.push(pay.receiptStorageId);
      });
    });
    if(p.floorplan && p.floorplan._storageId && !_fileUrlCache[p.floorplan._storageId]) allIds.push(p.floorplan._storageId);
  });
  if(!allIds.length) return;
  var unique = []; var seen = {};
  allIds.forEach(function(id){ if(!seen[id]){ seen[id]=true; unique.push(id); } });
  try{
    var urls = await _getFileUrlsWithClaim(unique);
    unique.forEach(function(id, i){ if(urls[i]) _fileUrlCacheSet(id, urls[i]); });
  }catch(e){ console.error('resolveAllProjectUrls:', e); return; }
  // Populate all projects
  Object.keys(projects).forEach(function(pid){
    var p = projects[pid];
    if(!p || typeof p !== 'object') return;
    var mb = p.moodboard;
    if(mb && typeof mb === 'object'){
      var populate = function(img){
        if(img.storageId && _fileUrlCache[img.storageId]) img.src = _fileUrlCache[img.storageId];
      };
      (mb.uncategorized || []).forEach(populate);
      (mb.folders || []).forEach(function(f){ (f.images || []).forEach(populate); });
    }
    (p.vendors || []).forEach(function(v){
      (v.payments || []).forEach(function(pay){
        if(pay.receiptStorageId && _fileUrlCache[pay.receiptStorageId]) pay.receipt = _fileUrlCache[pay.receiptStorageId];
      });
    });
    if(p.floorplan && p.floorplan._storageId && _fileUrlCache[p.floorplan._storageId]){
      if(p.floorplan.img === '__stored__') p.floorplan.img = _fileUrlCache[p.floorplan._storageId];
    }
  });
}

// Lazy migration: upload base64 images to Convex file storage in the background
async function migrateBase64Images(p){
  // El guard _migrating existia pero NUNCA se asignaba, asi que dos pasadas
  // concurrentes podian subir la misma imagen dos veces.
  if(!p || typeof p !== 'object' || p._migrating) return;
  p._migrating = true;
  try{
    return await _migrateBase64ImagesInner(p);
  } finally {
    delete p._migrating;
  }
}

async function _migrateBase64ImagesInner(p){
  var dirty = false;
  var isBase64 = EVENTOS_DATA.isBase64Image;

  // Migrate moodboard images
  var mb = p.moodboard;
  if(mb && typeof mb === 'object'){
    var migrateImg = async function(img){
      if(img.storageId || !isBase64(img.src)) return;
      try{
        var storageId = await EVENTOS_DATA.uploadBase64(img.src);
        var url = await EVENTOS_DATA.getFileUrl(storageId);
        img.storageId = storageId;
        if(url){ img.src = url; _fileUrlCacheSet(storageId, url); }
        dirty = true;
      }catch(e){ console.error('Migration error (moodboard):', e); }
    };
    var allImgs = (mb.uncategorized || []).concat(
      (mb.folders || []).reduce(function(acc, f){ return acc.concat(f.images || []); }, [])
    );
    // Process in batches of 3 for parallel upload without overwhelming the server
    for(var i = 0; i < allImgs.length; i += 3){
      await Promise.all(allImgs.slice(i, i + 3).map(migrateImg));
    }
  }

  // Migrate payment receipts
  for(var vi = 0; vi < (p.vendors || []).length; vi++){
    var v = p.vendors[vi];
    for(var pi = 0; pi < (v.payments || []).length; pi++){
      var pay = v.payments[pi];
      if(pay.receiptStorageId || !isBase64(pay.receipt)) continue;
      try{
        var sid = await EVENTOS_DATA.uploadBase64(pay.receipt);
        var rurl = await EVENTOS_DATA.getFileUrl(sid);
        pay.receiptStorageId = sid;
        if(rurl){ pay.receipt = rurl; _fileUrlCacheSet(sid, rurl); }
        dirty = true;
      }catch(e){ console.error('Migration error (receipt):', e); }
    }
  }

  // Migrate floorplan thumb (if large base64 is stored inline)
  if(p.floorplan && !p.floorplan._storageId && p.floorplan.img && p.floorplan.img !== '__idb__' && isBase64(p.floorplan.img)){
    try{
      var fpBlob = EVENTOS_DATA.base64ToBlob(p.floorplan.img);
      var fpSid = await EVENTOS_DATA.uploadFile(fpBlob);
      var fpUrl = await EVENTOS_DATA.getFileUrl(fpSid);
      p.floorplan._storageId = fpSid;
      if(fpUrl){ p.floorplan.img = fpUrl; _fileUrlCacheSet(fpSid, fpUrl); }
      dirty = true;
    }catch(e){ console.error('Migration error (floorplan):', e); }
  }

  if(dirty){
    saveProj(p);
    console.log('EventOS: migrated base64 images to file storage for project', p.id);
  }
}

// ─── Data migration framework ──────────────────────────────────────────────
// Each entry: { fromVersion, toVersion, migrate(project) }
// Migrations run sequentially on project load when _dataVersion < CURRENT.
var _DATA_MIGRATIONS = [
  // Example for future migrations:
  // { fromVersion: 1, toVersion: 2, migrate: function(p){ p.newField = p.newField || []; } }
];

function runDataMigrations(p){
  if(!p || typeof p !== 'object') return;
  var currentVersion = p._dataVersion || 0;
  var applied = false;
  for(var i = 0; i < _DATA_MIGRATIONS.length; i++){
    var m = _DATA_MIGRATIONS[i];
    if(currentVersion >= m.fromVersion && currentVersion < m.toVersion){
      try{
        m.migrate(p);
        p._dataVersion = m.toVersion;
        applied = true;
        console.log('EventOS: migrated project', p.id, 'from v'+m.fromVersion+' to v'+m.toVersion);
      }catch(e){
        console.error('EventOS: migration failed for project', p.id, 'v'+m.fromVersion+'→v'+m.toVersion, e);
        break;
      }
    }
  }
  if(applied) saveProj(p);
}

// Run lazy migration for all projects in the background
function migrateAllProjectImages(userId){
  var projects = DB.projects[userId];
  if(!projects) return;
  var pids = Object.keys(projects).filter(function(pid){ return pid !== '__library__'; });
  var idx = 0;
  function next(){
    if(idx >= pids.length) return;
    var p = projects[pids[idx]];
    idx++;
    if(p) migrateBase64Images(p).then(next).catch(function(){ next(); });
    else next();
  }
  // Start migration after a short delay to not block initial render
  setTimeout(next, 3000);
}

async function loadProjectsFromCloud(userId){
  setSyncStatus('syncing');

  var hadCache = loadCache(userId);
  if(hadCache) renderEvents();

  try{
    // Phase 1: fast metadata load — renders the events list quickly
    var controller = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function(){ controller.abort(); }, 12000) : null;
    var metaProjects = await EVENTOS_DATA.getProjectMetaByWixUserId({
      signal: controller ? controller.signal : undefined
    });
    if(timeoutId) clearTimeout(timeoutId);
    if(metaProjects && Object.keys(metaProjects).length > 0){
      if(!DB.projects[userId]) DB.projects[userId] = {};
      // Merge: keep any fully-loaded project already in memory (from cache), fill the rest with stubs
      Object.keys(metaProjects).forEach(function(pid){
        var existing = DB.projects[userId][pid];
        if(!existing || existing._metaOnly){
          DB.projects[userId][pid] = metaProjects[pid];
        }
      });
    } else if(!hadCache){
      if(!DB.projects[userId]) DB.projects[userId] = {};
    }
    renderEvents();
    _lastSyncTime = Date.now();
    setSyncStatus('ok');

    // Phase 2: load full project data in the background
    _loadFullProjectsBackground(userId);

  } catch(e){
    console.error('loadProjectsFromCloud:', e);
    if(e && e.name==='AbortError'){
      console.warn('EventOS: cloud fetch timed out — using cached data');
      if(!hadCache){
        if(DB.cur==='dev_user_local') return true;
        showLoadingError('Connection timed out. Check your connection and reload.');
        return false;
      }
      setSyncStatus('offline');
      return true;
    }
    if(!hadCache){
      if(DB.cur==='dev_user_local') return true;
      showLoadingError('Could not load your projects. Check your connection and reload.');
      return false;
    }
    setSyncStatus('offline');
  }
  return true;
}

async function _loadFullProjectsBackground(userId){
  try{
    var projects = await EVENTOS_DATA.getProjectsByWixUserId();
    if(projects && Object.keys(projects).length > 0){
      // Merge rather than full-replace: preserve any events created locally while the
      // fetch was in-flight (e.g. user created a new event before background load finished).
      if(!DB.projects[userId]) DB.projects[userId] = {};
      Object.keys(projects).forEach(function(pid){
        var inMem = DB.projects[userId][pid];
        // Only overwrite if: no local copy exists, or the local copy is still a meta stub.
        // Always overwrite __library__ with the server version so library data (layouts,
        // vendor groups, task templates) syncs across devices.  The library is cached in full
        // by cacheDB(), so without this exception it would never pick up server changes.
        // Respect _pendingSave to avoid clobbering unsaved local edits.
        var forceSync = (pid === '__library__' && !(inMem && inMem._pendingSave));
        // _fromCache: copia restaurada de localStorage.  Es util offline pero puede
        // estar obsoleta, asi que la version del servidor manda (salvo que haya
        // ediciones locales sin guardar).
        var staleCache = !!(inMem && inMem._fromCache && !inMem._pendingSave);
        if(!inMem || inMem._metaOnly || staleCache || forceSync) DB.projects[userId][pid] = projects[pid];
      });
      if(DB.projects[userId]['__library__']) DB.projects[userId]['__library__']._seeded = true;
      if(!_loadedProjects[userId]) _loadedProjects[userId] = new Set();
      Object.keys(projects).forEach(function(pid){ _loadedProjects[userId].add(pid); });

      // Reconcile: remove local projects that no longer exist on the server
      // (deleted on another device). Skip internal pseudo-projects and unsaved edits.
      var serverIds = projects;
      Object.keys(DB.projects[userId]).forEach(function(pid){
        if(pid === '__lib_layout__') return;
        if(serverIds[pid]) return; // still on server
        var local = DB.projects[userId][pid];
        if(local && local._pendingSave) return; // don't delete unsaved work
        delete DB.projects[userId][pid];
      });

      cacheDB();

      // The library needs its extras (layouts) immediately so getLib().layouts is populated
      var lib = DB.projects[userId] && DB.projects[userId]['__library__'];
      if(lib && lib._hasExtras && !lib._extrasLoaded){
        await _mergeProjectExtras('__library__', lib);
        cacheDB();
      }
    }
    resolveAllProjectUrls(userId).then(function(){
      cacheDB();
      migrateAllProjectImages(userId);
    }).catch(function(e){ console.error('resolveAllProjectUrls:', e); });
  }catch(e){ console.error('_loadFullProjectsBackground:', e); }
}

// Fetch the companion extras document and merge guests/layoutItems/savedLayouts/layouts into p in-place.
async function _mergeProjectExtras(projectId, p){
  try{
    var extras = await EVENTOS_DATA.getProjectExtras(projectId);
    if(extras){
      p.guests       = extras.guests       || [];
      p.layoutItems  = extras.layoutItems  || [];
      p.savedLayouts = extras.savedLayouts || [];
      if(extras.layouts) p.layouts = extras.layouts;
      if(extras.vendors) p.vendors = extras.vendors;
      if(extras.moodboard) p.moodboard = extras.moodboard;
      if(extras.eventLayouts) p.eventLayouts = extras.eventLayouts;
    }
    p._extrasLoaded = true;
    // If a previous extras save failed, the retry flag was persisted to localStorage.
    // Restore it so the next save re-attempts the companion (extras) write.
    try{ if(localStorage.getItem('eventos_extras_pending_'+String(projectId))) p._extrasPending = true; }catch(e){}
  }catch(e){ console.error('EventOS: _mergeProjectExtras:', e); }
}

/**
 * Garantiza que TODOS los proyectos del usuario esten completos en memoria.
 *
 * Analytics y el dashboard suman invitados, proveedores y tareas leyendo los
 * proyectos en memoria.  Los stubs (_metaOnly) y los proyectos grandes (_hasExtras
 * sin extras cargados) tienen esos arrays vacios, asi que los KPIs salian en CERO
 * justo para los eventos mas grandes.  Devuelve true si cargo algo (hay que
 * re-renderizar).
 */
var _ensureExtrasInFlight = null;
async function _ensureAllProjectsComplete(){
  if(_ensureExtrasInFlight) return _ensureExtrasInFlight;
  _ensureExtrasInFlight = (async function(){
    try{
      var projects = DB.projects[DB.cur];
      if(!projects) return false;
      var ids = Object.keys(projects).filter(function(pid){
        if(pid === '__lib_layout__') return false;
        var p = projects[pid];
        if(!p) return false;
        return p._metaOnly || (p._hasExtras && !p._extrasLoaded);
      });
      if(!ids.length) return false;
      setSyncStatus('syncing');
      for(var i = 0; i < ids.length; i++){
        var pid = ids[i];
        var p = projects[pid];
        if(!p) continue;
        if(p._metaOnly){
          await loadProjectById(pid);
          p = DB.projects[DB.cur] && DB.projects[DB.cur][pid];
        }
        if(p && p._hasExtras && !p._extrasLoaded){
          await _mergeProjectExtras(pid, p);
        }
      }
      cacheDB();
      setSyncStatus('ok');
      return true;
    }catch(e){
      console.error('EventOS: _ensureAllProjectsComplete:', e);
      setSyncStatus('ok');
      return false;
    }finally{
      _ensureExtrasInFlight = null;
    }
  })();
  return _ensureExtrasInFlight;
}

async function loadProjectById(projectId){
  if(!DB.cur || !projectId) return null;
  try{
    var data = await EVENTOS_DATA.getProjectById(projectId);
    if(data){
      if(data._hasExtras) await _mergeProjectExtras(projectId, data);
      if(!DB.projects[DB.cur]) DB.projects[DB.cur] = {};
      DB.projects[DB.cur][projectId] = data;
      if(!_loadedProjects[DB.cur]) _loadedProjects[DB.cur] = new Set();
      _loadedProjects[DB.cur].add(projectId);
      resolveStorageUrls(data).catch(function(){});
      cacheDB();
    }
    return data;
  }catch(e){ console.error('loadProjectById:', e); return null; }
}

function showLoadingError(msg){
  var el = document.getElementById('pg-loading-error');
  if(el){ el.textContent = msg; el.style.display = 'block'; }
}

var _lastSaveToastTime = 0;
var _baseTitleCache = null;
function _markTitleUnsaved(){ if(!_baseTitleCache) _baseTitleCache=document.title.replace(/^● /,''); if(document.title.indexOf('● ')!==0) document.title='● '+_baseTitleCache; }
function _clearTitleUnsaved(){ if(_baseTitleCache){ document.title=_baseTitleCache; } }
async function saveProj(p){
  if(!p || typeof p !== 'object' || !p.id) return;
  _markTitleUnsaved();
  // Never write a metadata stub to Convex — it would overwrite full project data with empty fields
  if(p._metaOnly){
    console.warn('EventOS: skipped saveProj for meta-only stub', p.id, '— full data not yet loaded');
    return;
  }
  // Guard against saving when user is not authenticated (e.g. session expired mid-edit)
  if(!DB.cur){
    console.warn('EventOS: skipped saveProj — no authenticated user (DB.cur is null)');
    return;
  }
  if(!DB.projects[DB.cur]) DB.projects[DB.cur] = {};
  DB.projects[DB.cur][p.id] = p;
  cacheDB();
  // Internal pseudo-projects live in memory/localStorage only — never persist to Convex
  if(p.id === '__lib_layout__') return;

  p._pendingSave = true; // Mark as having unsaved local edits
  setSyncStatus('saving');
  // Debounce per-project: keyed by id so saving several different projects in quick
  // succession (e.g. bulk edit) doesn't collapse to only the last one reaching Convex.
  _pendingSaves[p.id] = p;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_drainSaves, 1500);
}

// Kick off the next queued save if nothing is currently in flight.  Each _executeSave
// calls back into _drainSaves() when it finishes, so the whole queue drains sequentially.
function _drainSaves(){
  clearTimeout(_saveTimer);
  _saveTimer = null;
  if(_saveInFlight) return; // the in-flight save will re-drain when it finishes
  var ids = Object.keys(_pendingSaves);
  if(!ids.length) return;
  var id = ids[0];
  var p = _pendingSaves[id];
  delete _pendingSaves[id];
  _executeSave(p);
}

// Core save logic — extracted so flushSave() and the debounce timer share the same path
async function _executeSave(p){
  // Queue if another save is already in flight (re-drained when it completes)
  if(_saveInFlight){ _pendingSaves[p.id] = p; return; }
  _saveInFlight = true;
  var maxRetries = 3;
  for(var attempt = 1; attempt <= maxRetries; attempt++){
    try{
      await EVENTOS_DATA.upsertProject(p);
      _lastSyncTime = Date.now();
      delete p._pendingSave;
      _clearPersistedPending(p.id);
      // Clear the optimistic-lock version after a successful save.  The server's
      // updatedAt just changed but we don't know the new value, so delete it to
      // avoid sending a stale version on the next save.  manualSync will re-stamp
      // it from the server on the next poll, restoring conflict detection.
      delete p._expectedVersion;
      if(typeof clearLayoutDirty === 'function') clearLayoutDirty();
      setSyncStatus('ok');
      _clearTitleUnsaved();
      var now=Date.now(); if(now-_lastSaveToastTime>5000){_lastSaveToastTime=now;if(typeof toast==='function')toast(t('saved'),'s');}
      _saveInFlight = false;
      _drainSaves(); // process any other queued projects
      return;
    }catch(e){
      if(e && e.message && e.message.indexOf('__oversize__') !== -1){
        console.error('EventOS: project', p.id, 'is too large to save even after splitting extras');
        toast(t('err_oversize'), 'e');
        delete p._pendingSave;
        setSyncStatus('error');
        // Reset to 'ok' after 8s — data is safe in localStorage, the error status
        // shouldn't stay stuck permanently.  The next edit will retry the save.
        setTimeout(function(){ setSyncStatus('ok'); }, 8000);
        _saveInFlight = false;
        _drainSaves();
        return;
      }
      if(e && e.message && e.message.indexOf('__conflict__') !== -1){
        // NO reintentar borrando _expectedVersion: eso saltaba el bloqueo optimista del
        // servidor y sobrescribia en silencio los cambios del otro dispositivo.  El
        // conflicto es una decision del usuario, no algo que se resuelva reintentando.
        console.warn('EventOS: save conflict for project', p.id, '— asking the user');
        // _pendingSave se conserva a proposito: los cambios locales siguen sin guardar
        // hasta que el usuario elija.  Eso evita que la reconciliacion los borre.
        setSyncStatus('error');
        _saveInFlight = false;
        _showConflictModal(p);
        _drainSaves();
        return;
      }
      console.error('saveProj attempt', attempt + '/' + maxRetries + ':', e);
      if(attempt < maxRetries){
        await new Promise(function(r){ setTimeout(r, Math.pow(2, attempt) * 1000); });
      } else {
        delete p._pendingSave;
        setSyncStatus('offline');
        toast(t('err_save_failed'), 'e');
        // Auto-recover status after 10s so the button doesn't stay stuck on error
        setTimeout(function(){ if(navigator.onLine) setSyncStatus('ok'); }, 10000);
      }
    }
  }
  _saveInFlight = false;
  _drainSaves();
}

// Immediately flush any debounced saves — call before navigation, tab switches,
// page unload, or visibility changes to prevent data loss.  Cancels the debounce
// and starts draining the pending queue right away.
function flushSave(){
  clearTimeout(_saveTimer);
  _saveTimer = null;
  _drainSaves();
}

// ── Red de seguridad para el cierre de pagina ──────────────────────────────
// Un fetch normal se cancela cuando el navegador descarga la pagina, asi que
// llamar a flushSave() en beforeunload NO garantizaba nada.  Ahora hay dos capas:
//   1. `keepalive: true` para cuerpos pequenos (<60 KB), que el navegador termina
//      de enviar aunque la pagina muera.
//   2. Una copia en localStorage de todo lo pendiente, que se reintenta al volver
//      a abrir la app.  Esta capa cubre los proyectos grandes, donde keepalive no
//      aplica por el limite de tamano.
function _pendingKey(userId){ return 'eventos_pending_' + (userId || 'local'); }

var _PENDING_MAX_BYTES = 3 * 1024 * 1024;

function _persistPendingSaves(){
  try{
    if(!DB.cur) return;
    var ids = Object.keys(_pendingSaves);
    if(!ids.length) return;
    var bag = {};
    var total = 0;
    for(var i = 0; i < ids.length; i++){
      var p = _pendingSaves[ids[i]];
      if(!p || p._metaOnly || p.id === '__lib_layout__') continue;
      var s = JSON.stringify(p);
      if(total + s.length > _PENDING_MAX_BYTES){
        console.warn('EventOS: pending-save backup truncated at', ids[i]);
        break;
      }
      total += s.length;
      bag[ids[i]] = p;
    }
    if(Object.keys(bag).length) localStorage.setItem(_pendingKey(DB.cur), JSON.stringify(bag));
  }catch(e){ console.warn('EventOS: could not persist pending saves', e); }
}

function _clearPersistedPending(projectId){
  try{
    if(!DB.cur) return;
    var raw = localStorage.getItem(_pendingKey(DB.cur));
    if(!raw) return;
    var bag = JSON.parse(raw);
    if(!bag || !(projectId in bag)) return;
    delete bag[projectId];
    if(Object.keys(bag).length) localStorage.setItem(_pendingKey(DB.cur), JSON.stringify(bag));
    else localStorage.removeItem(_pendingKey(DB.cur));
  }catch(e){}
}

// Reintenta los guardados que quedaron a medias en una sesion anterior.
async function _recoverPendingSaves(userId){
  var bag = null;
  try{
    var raw = localStorage.getItem(_pendingKey(userId));
    if(!raw) return;
    bag = JSON.parse(raw);
  }catch(e){ return; }
  if(!bag) return;
  var ids = Object.keys(bag);
  if(!ids.length){ try{ localStorage.removeItem(_pendingKey(userId)); }catch(e){} return; }
  console.info('EventOS: recovering', ids.length, 'unsaved project(s) from the previous session');
  if(!DB.projects[userId]) DB.projects[userId] = {};
  ids.forEach(function(pid){
    var p = bag[pid];
    if(!p || !p.id) return;
    // La copia local gana sobre lo que haya en el servidor: son ediciones que el
    // usuario hizo y que nunca llegaron a guardarse.
    delete p._expectedVersion;
    DB.projects[userId][p.id] = p;
    saveProj(p);
  });
  flushSave();
}

// Guardado de emergencia: se dispara en pagehide / visibilitychange(hidden).
function _flushOnUnload(){
  cacheDBNow();          // el throttle no debe comerse la ultima escritura
  _persistPendingSaves();
  var ids = Object.keys(_pendingSaves);
  for(var i = 0; i < ids.length; i++){
    var p = _pendingSaves[ids[i]];
    if(!p || p._metaOnly || p.id === '__lib_layout__') continue;
    try{
      // Sin await: la pagina se esta yendo.  keepalive hace el trabajo cuando cabe.
      EVENTOS_DATA.upsertProject(p, { keepalive: true }).then(function(){}, function(){});
    }catch(e){}
  }
  flushSave();
}

// Show a locked modal when a save conflict is detected (account open on another device).
// The user MUST pick an option — clicking outside or pressing Escape won't dismiss it.
function _showConflictModal(conflictedProject){
  if(typeof openMo !== 'function') return;
  openMo(
    '<div class="mo-title">' + esc(t('conflict_title')) + '</div>'
    + '<div style="font-size:14px;color:var(--text);margin-bottom:16px;line-height:1.5">'
    + esc(t('conflict_message'))
    + '</div>'
    + '<div class="mo-foot">'
    + '<button class="btn btn-ghost" id="_conflict-dismiss-btn">' + esc(t('conflict_discard')) + '</button>'
    + '<button class="btn btn-primary" id="_conflict-overwrite-btn">' + esc(t('conflict_overwrite')) + '</button>'
    + '</div>'
  );
  // Lock the modal so only the explicit buttons can close it
  if(typeof _moLocked !== 'undefined') _moLocked = true;

  // "Descartar mis cambios": trae la version del servidor y tira la copia local.
  // Antes este boton solo cerraba el modal y dejaba el proyecto marcado como limpio
  // sin haberlo guardado — es decir, perdia los cambios en silencio.
  var dismissBtn = document.getElementById('_conflict-dismiss-btn');
  if(dismissBtn) dismissBtn.onclick = async function(){
    dismissBtn.disabled = true;
    var btnB = document.getElementById('_conflict-overwrite-btn');
    if(btnB) btnB.disabled = true;
    dismissBtn.textContent = LANG==='es' ? 'Recargando...' : 'Reloading...';
    var pid = (conflictedProject && conflictedProject.id) || CID;
    if(typeof _moLocked !== 'undefined') _moLocked = false;
    closeMo();
    if(pid){
      delete _pendingSaves[pid];
      var fresh = await loadProjectById(pid);
      if(fresh){
        toast(t('conflict_discarded'), 's');
        if(CID === pid && typeof renderPNav === 'function'){
          // Se re-pinta la pestana activa directamente en vez de con switchTab(),
          // que ademas dispara el aviso de "cambios sin guardar" del editor de planos
          // y abriria otro modal encima de este.
          renderPNav();
          var renderers = {
            dashboard: typeof renderDash==='function'?renderDash:null,
            budget: typeof renderBudget==='function'?renderBudget:null,
            timeline: typeof renderTimeline==='function'?renderTimeline:null,
            guests: typeof renderGuests==='function'?renderGuests:null,
            layout: typeof renderLayout==='function'?renderLayout:null,
            moodboard: typeof renderMoodboard==='function'?renderMoodboard:null
          };
          if(typeof clearLayoutDirty === 'function') clearLayoutDirty();
          var fn = renderers[CTAB];
          if(fn) fn();
        }
        else renderEvents();
      } else {
        toast(t('err_network'), 'e');
      }
    }
    setSyncStatus('ok');
  };

  // "Sobrescribir con mis cambios".  El boton anterior era "cerrar las otras
  // sesiones", que dependia de la tabla `sessions` propia; con Clerk las sesiones
  // ya no son nuestras, asi que la accion util es simplemente ganar el conflicto.
  var btn = document.getElementById('_conflict-overwrite-btn');
  if(btn) btn.onclick = function(){
    btn.disabled = true;
    if(dismissBtn) dismissBtn.disabled = true;
    // El usuario eligio explicitamente sobrescribir: solo aqui es legitimo quitar
    // el bloqueo optimista.
    var p = conflictedProject || proj();
    if(p) delete p._expectedVersion;
    if(typeof _moLocked !== 'undefined') _moLocked = false;
    closeMo();
    if(p) saveProj(p);
  };
}

function saveDB(){
  var p = proj();
  if(p) saveProj(p);
  else cacheDB();
}

async function delProj(id){
  // Clear any queued save for this project to avoid orphaned writes
  delete _pendingSaves[id];
  if(DB.projects[DB.cur]) delete DB.projects[DB.cur][id];
  var i = _recentProjectIds.indexOf(id);
  if(i > -1) _recentProjectIds.splice(i, 1);
  // Escritura inmediata (sin throttle): si el usuario recarga justo despues, el
  // proyecto borrado no debe reaparecer desde el cache.
  cacheDBNow();
  // Tambien hay que limpiar la copia de recuperacion y la bandera de extras.
  _clearPersistedPending(id);
  try{ localStorage.removeItem('eventos_extras_pending_'+String(id)); }catch(e){}
  try{
    await EVENTOS_DATA.deleteProject(id);
  }catch(e){ console.error('delProj:', e); }
}

async function manualSync(){
  if(!DB.cur) return;
  setSyncStatus('syncing');
  try{
    var since = _lastSyncTime || (Date.now() - 300000);

    // Step 1: ask Convex which project IDs changed since our last sync.
    // Uses the by_wix_user_updated index — reads 0 documents when nothing changed.
    var changedIds = await EVENTOS_DATA.getChangedProjectIds(since);

    if(!changedIds || !changedIds.length){
      _lastSyncTime = Date.now();
      setSyncStatus('ok');
      return;
    }

    // Step 2: fetch only the changed projects individually
    var anyFetched = false;
    for(var i = 0; i < changedIds.length; i++){
      var id = changedIds[i];
      try{
        var data = await EVENTOS_DATA.getProjectById(id);
        if(data){
          // Skip overwriting projects with unsaved local edits
          var prev_ = DB.projects[DB.cur] && DB.projects[DB.cur][id];
          if(prev_ && prev_._pendingSave){
            console.log('EventOS: skipping sync overwrite for', id, '(has pending local edits)');
            continue;
          }
          if(data._hasExtras){
            // This project changed remotely and has no pending local edits (projects with
            // unsaved edits were skipped above).  Fetch fresh extras so remote changes to
            // guests / layout items (planos) / vendors / moodboard actually sync to this
            // device — keeping the old in-memory copy would silently hide them.
            await _mergeProjectExtras(id, data);
          }
          if(!DB.projects[DB.cur]) DB.projects[DB.cur] = {};
          DB.projects[DB.cur][id] = data;
          if(!_loadedProjects[DB.cur]) _loadedProjects[DB.cur] = new Set();
          _loadedProjects[DB.cur].add(id);
          if(id === '__library__') data._seeded = true;
          resolveStorageUrls(data).catch(function(){});
          anyFetched = true;
        }
      }catch(e){ console.error('manualSync: failed to fetch project', id, e); }
    }

    if(anyFetched){
      cacheDB();
      renderEvents();
      // If the library was updated from another device, re-render the library page
      if(changedIds.indexOf('__library__') !== -1 && _currentPage === 'library' && typeof renderLibrary === 'function'){
        renderLibrary();
      }
      // If the currently open project was updated externally, re-render and notify the user
      if(CID && changedIds.indexOf(CID) !== -1){
        toast(t('sync_remote_update'), 's');
        renderPNav();
        var tabRenders = {
          dashboard: typeof renderDash==='function'?renderDash:null,
          budget: typeof renderBudget==='function'?renderBudget:null,
          timeline: typeof renderTimeline==='function'?renderTimeline:null,
          guests: typeof renderGuests==='function'?renderGuests:null,
          layout: typeof renderLayout==='function'?renderLayout:null,
          moodboard: typeof renderMoodboard==='function'?renderMoodboard:null
        };
        var fn = tabRenders[CTAB];
        if(fn) fn();
      }
    }

    _lastSyncTime = Date.now();
    setSyncStatus('ok');

    // Every 3rd sync cycle, do a full reconciliation to detect projects
    // deleted on another device. getChangedProjectIds(0) returns ALL project IDs.
    _syncCycleCount = (_syncCycleCount || 0) + 1;
    if(_syncCycleCount % 3 === 0){
      try{
        var allServerIds = await EVENTOS_DATA.getChangedProjectIds(0);
        if(allServerIds && DB.projects[DB.cur]){
          var serverSet = {};
          allServerIds.forEach(function(sid){ serverSet[sid] = true; });
          var removedAny = false;
          Object.keys(DB.projects[DB.cur]).forEach(function(pid){
            if(pid === '__lib_layout__') return;
            if(serverSet[pid]) return;
            var local = DB.projects[DB.cur][pid];
            if(local && local._pendingSave) return;
            delete DB.projects[DB.cur][pid];
            removedAny = true;
          });
          if(removedAny){
            cacheDB();
            renderEvents();
            // If the currently-open project was deleted on another device, go back to events list
            if(CID && !DB.projects[DB.cur][CID]){
              CID = null;
              showPage('events');
              toast(t('sync_project_deleted'), 'e');
            }
          }
        }
      }catch(e){ console.warn('manualSync reconciliation:', e); }
    }

    // Check if a newer version of the app has been deployed
    _checkForNewVersion();
  }catch(e){
    console.error('manualSync:', e);
    setSyncStatus('offline');
  }
}

var _versionBannerShown = false;
function _checkForNewVersion(){
  if(_versionBannerShown) return;
  var myVersion = (window.EVENTOS_CONFIG && window.EVENTOS_CONFIG.buildVersion) || '';
  if(!myVersion) return;
  fetch('app-config.js?_t=' + Date.now()).then(function(r){ return r.text(); }).then(function(txt){
    var m = txt.match(/buildVersion\s*:\s*['"]([^'"]+)['"]/);
    if(m && m[1] && m[1] !== myVersion){
      _versionBannerShown = true;
      toast(LANG==='es'?'Hay una nueva versión de EventOS. Recarga la página.':'A new version of EventOS is available. Please refresh your browser.', 'e');
    }
  }).catch(function(){});
}

var _syncPollTimer = null;
function startSyncPoll(){
  if(_syncPollTimer) clearInterval(_syncPollTimer);
  _syncPollTimer = setInterval(function(){
    // Skip polling when the tab is hidden — no point syncing what the user can't see
    if(typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if(DB.cur) manualSync();
  }, 300000); // 5 minutes
}

// Borra todo el estado ligado al usuario actual.  Se usa al cambiar de cuenta y al
// cerrar sesion: cualquier resto (proyectos en memoria, cola de guardado, URLs de
// archivos cacheadas) pertenece a la cuenta anterior y no debe cruzarse con la nueva.
function _resetUserState(){
  if(_syncPollTimer){ clearInterval(_syncPollTimer); _syncPollTimer = null; }
  if(_cacheTimer){ clearTimeout(_cacheTimer); _cacheTimer = null; }
  clearTimeout(_saveTimer); _saveTimer = null;
  _pendingSaves = {};
  _saveInFlight = false;
  _recentProjectIds = [];
  DB.projects = {};
  DB.cur = null;
  _loadedProjects = {};
  _fileUrlCache = {};
  _fileUrlCacheKeys = [];
  _claimedLegacyFiles = false;   // la reclamacion de archivos es por usuario
  _lastSyncTime = null;
  _syncCycleCount = 0;
  _appInitialized = false;
  CID = null;
  CTAB = 'dashboard';
  _clearTitleUnsaved();
}

// ─── Arranque con Clerk ──────────────────────────────────────────────────────
//
// Antes: la app vivia embebida en una pagina de Wix que le mandaba la identidad
// por postMessage (`WIX_USER`), y este archivo tenia una lista de origenes de
// confianza para filtrar ese mensaje.
//
// Ahora EventOS es una pagina propia: no hay ventana padre ni apreton de manos.
// Clerk resuelve la sesion en el navegador, y el "tenant" (la llave con la que
// se particionan los datos) lo devuelve el servidor en auth:ensureIdentity —
// asi un cliente que venia de Wix sigue viendo sus mismos proyectos.

function _isLocalHost(){
  try{
    return location.protocol === 'file:' ||
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }catch(e){ return false; }
}

var USER_PROFILE = null;   // { tenantId, subject, email, name, linkedLegacy }

function _showSignIn(message){
  var load = document.getElementById('pg-loading');
  var app  = document.getElementById('pg-app');
  var signin = document.getElementById('pg-signin');
  if(load) load.style.display = 'none';
  if(app) app.classList.add('hidden');
  if(signin) signin.style.display = 'flex';
  var err = document.getElementById('signin-error');
  if(err){
    if(message){ err.textContent = message; err.style.display = 'block'; }
    else err.style.display = 'none';
  }
  var sub = document.getElementById('signin-sub');
  if(sub) sub.textContent = LANG === 'en' ? 'Event planning' : 'Planeación de eventos';
}

function _mountClerkSignIn(clerk){
  var host = document.getElementById('clerk-signin');
  if(!host || !clerk || !clerk.mountSignIn) return;
  host.innerHTML = '';
  try{ clerk.mountSignIn(host); }
  catch(e){ console.error('EventOS: no se pudo montar el login de Clerk', e); }

  // Red de seguridad: si Clerk no logra pintar el formulario aquí dentro, mete un
  // iframe a su Account Portal — que responde con X-Frame-Options y el navegador
  // muestra "no se puede abrir esta página".  Lo detectamos y ofrecemos abrirlo
  // como navegación normal, que sí funciona.
  setTimeout(function(){
    var framed = host.querySelector('iframe');
    if(!framed) return;
    var src = framed.getAttribute('src') || '';
    if(src.indexOf('accounts.dev') === -1 && src.indexOf('/sign-in') === -1) return;
    console.warn('EventOS: Clerk embebió su Account Portal (' + src + '). ' +
      'Se sustituye por una redirección de primer nivel.');
    host.innerHTML = '';
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'padding:12px 28px;font-size:14px';
    btn.textContent = LANG === 'en' ? 'Sign in' : 'Iniciar sesión';
    btn.onclick = function(){
      if(clerk.redirectToSignIn) clerk.redirectToSignIn();
      else window.location.href = src;
    };
    host.appendChild(btn);
  }, 1500);
}

// Punto de entrada real de la aplicacion.
(function bootstrap(){
  function start(){
    var pending = window.__clerkReady;
    if(!pending){
      _showSignIn('Falta configurar Clerk. Revisa clerkPublishableKey en app-config.js.');
      return;
    }
    pending.then(function(clerk){
      // Reaccionar a login / logout sin recargar la pagina.
      if(clerk.addListener){
        clerk.addListener(function(){
          var signedIn = !!(clerk.session && clerk.user);
          if(signedIn && !_appInitialized){ initApp(); }
          else if(!signedIn && _appInitialized){
            _resetUserState();
            USER_PROFILE = null;
            _showSignIn();
            _mountClerkSignIn(clerk);
          }
        });
      }
      if(clerk.session && clerk.user){ initApp(); }
      else { _showSignIn(); _mountClerkSignIn(clerk); }
    }).catch(function(e){
      console.error('EventOS: Clerk no cargo', e);
      _showSignIn(
        (e && e.message ? e.message : 'No se pudo cargar el sistema de acceso.') +
        ' / Could not load sign-in.'
      );
    });
  }
  if(document.readyState !== 'loading') start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });
})();

var _appInitialized = false;
async function initApp(){
  if(_appInitialized) return;
  _appInitialized = true;

  var pgApp = document.getElementById('pg-app');
  var pgLoad = document.getElementById('pg-loading');
  var pgSignin = document.getElementById('pg-signin');
  if(pgSignin) pgSignin.style.display = 'none';
  if(pgApp) pgApp.classList.add('hidden');
  if(pgLoad) pgLoad.style.display = 'flex';
  var errEl = document.getElementById('pg-loading-error');
  if(errEl) errEl.style.display = 'none';

  if(!hasRequiredConfig()){
    showLoadingError(getConfigErrorMessage());
    return;
  }
  startMojibakeObserver();

  // Resolver identidad -> tenant.  Es la unica llamada que DEBE pasar antes de
  // tocar cualquier dato: DB.cur sale de aqui.
  var profile = null;
  var attempts = 3;
  var lastErr = null;
  while(attempts > 0 && !profile){
    try{
      profile = await EVENTOS_DATA.ensureIdentity();
    }catch(e){
      lastErr = e;
      attempts--;
      console.warn('EventOS: ensureIdentity failed (' + (3 - attempts) + '/3):', e && e.message ? e.message : e);
      // Un rechazo de identidad no se arregla reintentando.
      if(e && e.message && e.message.indexOf('Unauthorized') !== -1) attempts = 0;
      if(attempts > 0) await new Promise(function(r){ setTimeout(r, 1200); });
    }
  }
  if(!profile){
    console.error('EventOS: no se pudo resolver la identidad:', lastErr);
    _appInitialized = false;
    _showSignIn(
      LANG === 'en'
        ? 'We could not verify your account. Please sign in again.'
        : 'No pudimos verificar tu cuenta. Vuelve a iniciar sesión.'
    );
    var clerk = window.Clerk;
    if(clerk) _mountClerkSignIn(clerk);
    return;
  }

  USER_PROFILE = profile;
  DB.cur = profile.tenantId;
  if(profile.linkedLegacy){
    console.info('EventOS: cuenta enlazada con los datos heredados del tenant', profile.tenantId);
  }

  var ok = await loadProjectsFromCloud(DB.cur);
  // Reintenta lo que quedo sin guardar si la sesion anterior murio a media escritura.
  try{ await _recoverPendingSaves(DB.cur); }catch(e){ console.warn('EventOS: _recoverPendingSaves', e); }
  if(ok !== false) enterApp();
}

var CID = null;
var CTAB = 'dashboard';

async function doLogout(){
  // Guardar antes de tirar el estado: sin esto, cualquier edicion dentro de la
  // ventana de debounce (1.5 s) se perderia al cerrar sesion.
  try{ flushSave(); }catch(e){ console.warn('EventOS: flush on logout failed', e); }
  closeMenu();
  _resetUserState();
  USER_PROFILE = null;
  var appEl = document.getElementById('pg-app');
  if(appEl) appEl.classList.add('hidden');
  toast(t('signed_out'));
  // Clerk cierra la sesion y dispara su listener, que nos lleva a la pantalla de
  // acceso.  Ya no hay token propio que revocar ni ventana padre a la que avisar.
  try{
    if(EVENTOS_DATA && EVENTOS_DATA.signOut) await EVENTOS_DATA.signOut();
  }catch(e){ console.warn('EventOS: signOut failed', e); }
  _showSignIn();
  if(window.Clerk) _mountClerkSignIn(window.Clerk);
}

function enterApp(){
  if(typeof loadSettings==='function') loadSettings();
  loadLangPref();
  loadEvPrefs();
  applyTranslations();
  var loadingEl = document.getElementById('pg-loading');
  var appEl = document.getElementById('pg-app');
  var signinEl = document.getElementById('pg-signin');
  if(signinEl) signinEl.style.display = 'none';
  if(loadingEl) loadingEl.style.display = 'none';
  if(appEl) appEl.classList.remove('hidden');
  setTimeout(updateAIFabVisibility, 200);
  var clerkUser = (window.Clerk && window.Clerk.user) || null;
  var name    = (clerkUser && (clerkUser.fullName || clerkUser.firstName)) ||
                (USER_PROFILE && (USER_PROFILE.name || USER_PROFILE.email)) || DB.cur;
  var email   = (clerkUser && clerkUser.primaryEmailAddress && clerkUser.primaryEmailAddress.emailAddress) ||
                (USER_PROFILE && USER_PROFILE.email) || '';
  var initial = (name && name.length) ? name[0].toUpperCase() : '?';
  var uav = document.getElementById('uav');
  var uname = document.getElementById('uname');
  var uemail = document.getElementById('uemail');
  var mobUav = document.getElementById('mob-uav');
  var mobUname = document.getElementById('mob-uname');
  var mobUemail = document.getElementById('mob-uemail');
  if(uav) uav.textContent = initial;
  if(uname) uname.textContent = name;
  if(uemail) uemail.textContent = email;
  // Bloque de cuenta del sidebar (rediseno 2026-08)
  var sbName = document.getElementById('sb-user-name');
  var sbMeta = document.getElementById('sb-user-meta');
  if(sbName) sbName.textContent = name;
  if(sbMeta) sbMeta.textContent = email;
  if(mobUav) mobUav.textContent = initial;
  if(mobUname) mobUname.textContent = name;
  if(mobUemail) mobUemail.textContent = email;
  // Restore last view or default to events
  var _restored = false;
  try{
    var lsKey = 'eventos_lastview_'+(DB.cur||'local');
    var raw = localStorage.getItem(lsKey);
    if(raw){
      var lastView = JSON.parse(raw);
      if(lastView && lastView.page){
        var projects = DB.projects[DB.cur];
        if(lastView.page === 'project' && lastView.projectId && projects && projects[lastView.projectId]){
          openProject(lastView.projectId);
          if(lastView.tab && lastView.tab !== 'dashboard'){
            setTimeout(function(){ switchTab(lastView.tab); }, 200);
          }
          _restored = true;
        } else if(lastView.page === 'library'){
          showPage('library');
          _restored = true;
        } else if(lastView.page === 'analytics'){
          showPage('analytics');
          _restored = true;
        } else if(lastView.page === 'events'){
          showPage('events');
          _restored = true;
        }
      }
    }
  }catch(e){ console.warn('EventOS: restore last view failed', e); }
  if(!_restored) showPage('events');
  setSyncStatus('ok');
  startSyncPoll();
  _maybeShowWelcomeTour();
}

function setSyncStatus(state){
  var dot      = document.getElementById('sync-dot');
  var label    = document.getElementById('sync-label');
  var btn      = document.getElementById('sync-btn');
  var dotMenu  = document.getElementById('sync-dot-menu');
  var labelMenu= document.getElementById('sync-label-menu');
  var meta     = document.getElementById('sync-meta');
  // El color y el fondo los pone el CSS via las clases is-busy / is-bad, para que
  // la pildora del sidebar siga la paleta del rediseno tambien en tema oscuro.
  var cfg = {
    ok:      { color:'#5FBF95', text:t('sync_ok'),      title:t('sync_hint_ok'),      cls:'' },
    syncing: { color:'#F2A93B', text:t('sync_syncing'), title:t('sync_hint_busy'),    cls:'is-busy' },
    saving:  { color:'#F2A93B', text:t('sync_saving'),  title:t('sync_hint_busy'),    cls:'is-busy' },
    offline: { color:'#F2703C', text:t('sync_offline'), title:t('sync_hint_offline'), cls:'is-bad' },
    error:   { color:'#F2703C', text:t('sync_error'),   title:t('sync_hint_error'),   cls:'is-bad' },
  };
  var c = cfg[state] || cfg.ok;
  if(dot)      dot.style.background  = c.color;
  if(dotMenu)  dotMenu.style.background = c.color;
  if(label)    label.textContent     = c.text;
  if(labelMenu)labelMenu.textContent = c.text;
  if(state==='ok') _lastSyncAt = Date.now();
  if(meta)     meta.textContent      = (state==='ok') ? _syncAgoLabel() : '';
  if(btn){
    btn.title = c.title;
    btn.classList.remove('is-busy','is-bad');
    if(c.cls) btn.classList.add(c.cls);
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}
// Marca de tiempo de la ultima sincronizacion correcta, para el "hace N min"
// del sidebar (el diseno lo muestra bajo el estado).
var _lastSyncAt = null;
function _syncAgoLabel(){
  if(!_lastSyncAt) return '';
  var mins = Math.floor((Date.now() - _lastSyncAt) / 60000);
  return mins < 1 ? t('just_now') : t('min_ago').replace('{n}', mins);
}
function setSyncDot(state){ setSyncStatus(state); }
// Refresca el "hace N min" sin cambiar de estado.
setInterval(function(){
  var meta = document.getElementById('sync-meta');
  var btn  = document.getElementById('sync-btn');
  if(meta && btn && !btn.classList.contains('is-busy') && !btn.classList.contains('is-bad')){
    meta.textContent = _syncAgoLabel();
  }
}, 60000);

window.addEventListener('online',  function(){ if(DB.cur) manualSync(); });
window.addEventListener('offline', function(){ setSyncStatus('offline'); });
window.addEventListener('beforeunload', function(e){
  var hadDirty = _saveInFlight || Object.keys(_pendingSaves).length > 0;
  _flushOnUnload();
  if(hadDirty){
    e.preventDefault();
    e.returnValue = '';
  }
});
// Flush saves when tab becomes hidden (user switches apps, minimizes, or Wix navigates).
// On mobile browsers especially, a hidden tab can be killed without further notice.
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden') _flushOnUnload();
});
// pagehide fires more reliably than beforeunload in iframes and on mobile Safari
window.addEventListener('pagehide', function(){ _flushOnUnload(); });

function toggleMenu(){ document.getElementById('umenu').classList.toggle('hidden'); }
function closeMenu(){ document.getElementById('umenu').classList.add('hidden'); }
document.addEventListener('click',e=>{ if(!e.target.closest('#upill')&&!e.target.closest('#umenu')) closeMenu(); });

function _saveLastView(){
  try{
    var view = { page: _currentPage || 'events' };
    if(_currentPage === 'project' && CID) { view.projectId = CID; view.tab = CTAB || 'dashboard'; }
    localStorage.setItem('eventos_lastview_'+(DB.cur||'local'), JSON.stringify(view));
  }catch(e){}
}
var _currentPage = 'events';
function showPage(p){
  // Flush any pending debounced save before navigating away from current page
  flushSave();
  _currentPage = p;
  // Fuera de un proyecto se usa la moneda por defecto del usuario.
  if(p !== 'project' && typeof applyProjectCurrency === 'function') applyProjectCurrency(null);
  _saveLastView();
  if(p !== 'project' && typeof closeProjectTabMenu === 'function') closeProjectTabMenu();
  // If the user navigates away from the library while the layout editor is open,
  // clean up its state so stale data doesn't bleed into other views.
  if(p !== 'library' && typeof libCancelLayoutEditor === 'function' && typeof _libEditingLayoutId !== 'undefined' && _libEditingLayoutId){
    libCancelLayoutEditor();
  }
  ['pg-dashboard','pg-events','pg-project','pg-analytics','pg-library'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.add('hidden');
  });
  const pg=document.getElementById('pg-'+p);if(pg)pg.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));
  // 'library' apuntaba a snav-library, un id que no existe en index.html: al entrar
  // a la Biblioteca no se marcaba ningun item del sidebar.  Los items reales de
  // biblioteca son snav-vendors / snav-tasks / snav-layouts / snav-moodboard y los
  // gestiona sidebarSwitchTab(); aqui solo quedan las paginas de nivel superior.
  const smap={dashboard:'snav-dashboard',events:'snav-events',analytics:'snav-analytics'};
  // La Biblioteca no tiene un item propio en el sidebar: se representa con la
  // pestana activa (proveedores / tareas / planos / moodboard).  El mapeo anterior
  // apuntaba a 'snav-library', un id inexistente, y no se marcaba nada.
  const libNav={vendors:'snav-vendors',tasks:'snav-tasks',layouts:'snav-layouts',moodboards:'snav-moodboard'};
  const sid = p==='library'
    ? (libNav[typeof _libTab!=='undefined' ? _libTab : 'vendors'] || 'snav-vendors')
    : (smap[p]||null);
  if(sid){const se=document.getElementById(sid);if(se)se.classList.add('active');}
  rdUpdateShell();
  if(p==='dashboard'){
    renderAppDash();
    // Las vistas agregadas necesitan los proyectos completos, no los stubs.
    _ensureAllProjectsComplete().then(function(changed){
      if(changed && _currentPage==='dashboard') renderAppDash();
    });
  }
  else if(p==='events') renderEvents();
  else if(p==='project'){ renderPNav(); switchTab('dashboard'); setTimeout(_updateTabIndicator, 50); }
  else if(p==='analytics'){
    renderAnalytics();
    _ensureAllProjectsComplete().then(function(changed){
      if(changed && _currentPage==='analytics') renderAnalytics();
    });
  }
  else if(p==='library') renderLibrary();
}
async function openProject(id){
  // Flush any pending save for the previously open project before switching
  flushSave();
  CID = id;
  _touchRecentProject(id);
  var p = DB.projects[DB.cur] && DB.projects[DB.cur][id];
  if(p && p._metaOnly){
    // Full data not yet loaded — fetch it before rendering the project page
    setSyncStatus('syncing');
    var loaded = await loadProjectById(id);
    setSyncStatus('ok');
    if(!loaded){
      toast(t('err_network'), 'e');
      CID = null;
      showPage('events');
      return;
    }
  } else if(p && p._hasExtras && !p._extrasLoaded){
    // Main data loaded but large arrays (guests, layout items) are in a companion document
    setSyncStatus('syncing');
    await _mergeProjectExtras(id, p);
    setSyncStatus('ok');
  }
  // Cada proyecto puede tener su propia moneda; sin esto se quedaba la del proyecto
  // anterior (o la de fabrica) sin importar lo que el usuario hubiera elegido.
  if(typeof applyProjectCurrency === 'function') applyProjectCurrency(proj());
  showPage('project');
}

function projectTabLabel(tab){
  var keyMap = {
    dashboard: 'tab_dashboard',
    budget: 'tab_budget',
    timeline: 'tab_timeline',
    guests: 'tab_guests',
    layout: 'tab_layout',
    moodboard: 'tab_moodboard'
  };
  return t(keyMap[tab] || 'tab_dashboard');
}

function syncProjectTabMenu(){
  var trigger = document.getElementById('pnav-menu-trigger');
  var label = document.getElementById('pnav-menu-label');
  var menu = document.getElementById('pnav-mobile-menu');
  if(label) label.textContent = projectTabLabel(CTAB);
  if(trigger){
    var shouldShow = typeof isPhoneViewport === 'function' && isPhoneViewport();
    trigger.classList.toggle('hidden', !shouldShow);
    trigger.setAttribute('aria-expanded', menu && !menu.classList.contains('hidden') ? 'true' : 'false');
  }
  document.querySelectorAll('.pnav-mobile-item[data-tab]').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.tab === CTAB);
  });
}

function closeProjectTabMenu(){
  var menu = document.getElementById('pnav-mobile-menu');
  var trigger = document.getElementById('pnav-menu-trigger');
  if(menu) menu.classList.add('hidden');
  if(trigger) trigger.setAttribute('aria-expanded', 'false');
}

function toggleProjectTabMenu(event){
  if(event) event.stopPropagation();
  if(typeof isPhoneViewport === 'function' && !isPhoneViewport()) return;
  var menu = document.getElementById('pnav-mobile-menu');
  var trigger = document.getElementById('pnav-menu-trigger');
  if(!menu || !trigger) return;
  var willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function renderPNav(){
  const p=proj();if(!p)return;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val||''; };
  set('pnav-name', p.name);

  // Tipo y estado como pildoras tonales (rediseno 2026-08)
  const typeEl=document.getElementById('pnav-type');
  if(typeEl){
    typeEl.className='rd-pill up t-'+evTypeTone(p.type);
    typeEl.textContent=evTypeLabel(p.type);
    typeEl.style.display=p.type?'':'none';
  }
  const stEl=document.getElementById('pnav-status');
  if(stEl){
    stEl.className='rd-pill t-'+evStatusTone(p.status);
    stEl.style.display=p.status?'':'none';
    set('pnav-status-label', statusLabel(p.status));
  }

  set('pnav-client', p.clientName);
  set('pnav-date', p.date?fmtDate(p.date):t('no_date'));
  set('pnav-location', p.location);
  // Los separadores solo aparecen entre dos datos que existan.
  const d1=document.getElementById('pnav-dot-1'), d2=document.getElementById('pnav-dot-2');
  if(d1) d1.style.display=(p.clientName&&(p.date||p.location))?'':'none';
  if(d2) d2.style.display=(p.date&&p.location)?'':'none';

  // Cuenta regresiva: fecha civil, con parseLocalDate detras (nunca new Date(fecha)).
  const days=rdDaysUntil(p.date);
  const dEl=document.getElementById('pnav-days');
  if(dEl){ dEl.textContent=days.label; dEl.classList.toggle('is-past', !!days.past); }

  const ring=document.getElementById('pnav-ring');
  if(ring) ring.innerHTML=rdRing(evProgress(p));

  syncProjectTabMenu();
  rdUpdateShell();
}
function switchTab(tab){
  // Flush any pending debounced save before switching sections
  flushSave();
  // Warn about unsaved layout changes when leaving layout tab
  if(CTAB === 'layout' && tab !== 'layout' && typeof isLayoutDirty === 'function' && isLayoutDirty()){
    openConfirmModal({
      title: LANG==='es'?'Cambios sin guardar':'Unsaved changes',
      message: LANG==='es'?'Tienes cambios en el diseño. ¿Salir sin guardar?':'You have unsaved layout changes. Leave without saving?',
      confirmLabel: LANG==='es'?'Salir':'Leave',
      danger: false,
      onConfirm: function(){ if(typeof clearLayoutDirty==='function') clearLayoutDirty(); switchTab(tab); }
    });
    return;
  }
  // Clean up layout listeners when leaving the layout tab
  if(CTAB === 'layout' && tab !== 'layout' && typeof layoutCleanup === 'function') layoutCleanup();
  // Clear any pending search/filter timers from previous tab
  if(typeof clearSearchTimers === 'function') clearSearchTimers();
  CTAB=tab;
  _saveLastView();
  ['dashboard','budget','timeline','guests','layout','moodboard'].forEach(tabId=>{
    document.getElementById('tab-'+tabId).classList.toggle('hidden',tabId!==tab);
  });
  document.querySelectorAll('.ptab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  _updateTabIndicator();
  syncProjectTabMenu();
  // Scroll to top so section header is visible below the sticky pnav
  var pgEl=document.getElementById('pg-project');
  if(pgEl) pgEl.scrollTop=0;
  window.scrollTo(0,0);
  ({dashboard:renderDash,budget:renderBudget,timeline:renderTimeline,guests:renderGuests,layout:renderLayout,moodboard:renderMoodboard})[tab]?.();
  if(tab==='layout'){ setTimeout(function(){ lZoom(0,'fit'); },120); }
}

// ── Animated Tab Indicator ──
function _updateTabIndicator(){
  var container = document.getElementById('ptabs');
  var indicator = document.getElementById('ptabs-indicator');
  var activeTab = container && container.querySelector('.ptab.active');
  if(!container || !indicator || !activeTab) return;
  var cRect = container.getBoundingClientRect();
  var tRect = activeTab.getBoundingClientRect();
  indicator.style.left = (tRect.left - cRect.left) + 'px';
  indicator.style.width = tRect.width + 'px';
  // El color lo decide el CSS (.ptabs-indicator / html.dark .ptabs-indicator).
  // Fijarlo aqui a '#242424' lo dejaba negro tambien en tema oscuro.
}

// Hover background animation for tabs
(function(){
  var ptabs = document.getElementById('ptabs');
  var hoverBg = document.getElementById('ptabs-hover-bg');
  if(!ptabs || !hoverBg) return;
  ptabs.addEventListener('mouseover', function(e){
    var tab = e.target.closest('.ptab');
    if(!tab) { hoverBg.style.opacity = '0'; return; }
    var cRect = ptabs.getBoundingClientRect();
    var tRect = tab.getBoundingClientRect();
    hoverBg.style.left = (tRect.left - cRect.left) + 'px';
    hoverBg.style.width = tRect.width + 'px';
    hoverBg.style.opacity = '1';
  });
  ptabs.addEventListener('mouseleave', function(){
    hoverBg.style.opacity = '0';
  });
  // Initialize indicator position on first render
  setTimeout(_updateTabIndicator, 100);
})();

// Update indicator position on resize
document.addEventListener('click', function(e){
  if(!e.target.closest('#pnav-menu-trigger') && !e.target.closest('#pnav-mobile-menu')) closeProjectTabMenu();
});
var _resizeRaf=null;
window.addEventListener('resize', function(){
  if(_resizeRaf) return;
  _resizeRaf=requestAnimationFrame(function(){
    _resizeRaf=null;
    if(typeof isPhoneViewport === 'function' && !isPhoneViewport()) closeProjectTabMenu();
    syncProjectTabMenu();
    _updateTabIndicator();
  });
});

function uproj(){ return DB.projects[DB.cur]||{}; }
function proj(){ return uproj()[CID]||null; }

function createSampleProject(email){
  const p={
    id:'sample_'+Date.now(), name:'Summer Gala 2026', clientName:'Sample Client',
    description:'A stunning summer gala event', date:'2026-06-15', location:'The Grand Garden Hall',
    // 'planning' no es un estado valido: los mapas de estado usan 'to-be-confirmed',
    // 'confirmed', 'in-progress', 'completed' y 'cancelled'.  Con 'planning' el
    // proyecto salia sin etiqueta ni color en analytics.
    budget:25000, type:'social', status:'to-be-confirmed',
    vendors:defaultVendors(), vendorsInitialized:true,
    tasks:defaultTasks(), guests:sampleGuests(), layoutItems:[], layoutQuoteExtras:[], layoutExport:null,
    moodboard:{ folders:[], uncategorized:[] },
    models3d:[],
  };
  if(!DB.projects[email])DB.projects[email]={};
  DB.projects[email][p.id]=p;
}

function defaultVendors(){
  const isES = (typeof LANG !== 'undefined' && LANG === 'es');
  const cats = isES ? [
    {name:'Medios y Contenido',          category:'Servicios de Fotografía',  subcategory:'Fotografía',
     services:'Fotografía, Video, Transmisión en Vivo / Grabación, Creador de Contenido para Redes Sociales'},
    {name:'Personal y Atención a Invitados', category:'Otros Servicios',      subcategory:'Otros',
     services:'Planner / Coordinador, Personal del Evento / Brand Ambassadors, Seguridad, Valet / Transporte / Shuttles, Limpieza / Manejo de Residuos, Médico / Primeros Auxilios'},
    {name:'Logística',                   category:'Servicios de Transporte',  subcategory:'Transporte',
     services:'Transporte / Flete, Mano de Obra de Instalación, Almacenamiento / Bodegas, Bloqueo de Hoteles / Hospedaje'},
    {name:'Administración y Permisos',   category:'Otros Servicios',          subcategory:'Otros',
     services:'Permisos / Licencias, Seguro (COI), Alimentación de Proveedores, Contingencias / Varios'},
    {name:'Venue y Rentas',              category:'Servicios de Venue',       subcategory:'Venue',
     services:'Venue / Locación, Renta de Mantelería y Vajilla, Carpas / Estructuras, Renta de Baños Portátiles'},
    {name:'Decoración Floral',           category:'Servicios Florales',       subcategory:'Flores',
     services:'Arreglos Florales y Vegetación, Globos, Renta de Plantas / Árboles'},
    {name:'Decoración Arquitectónica',   category:'Servicios de Decoración',  subcategory:'Decoración',
     services:'Pista de Baile, Plataforma para Cena, Cabina de DJ, Señalética / Gráficos / Branding, Backdrops, Decoración Especial'},
    {name:'Producción y Técnica',        category:'Otros Servicios',          subcategory:'Otros',
     services:'Iluminación, Audio, Video / LED / Proyección, Tarimas / Truss / Rigging, Energía / Electricidad / Generadores, Efectos Especiales, Internet / Wi-Fi'},
    {name:'Alimentos y Bebidas',         category:'Servicios de Catering',    subcategory:'Catering',
     services:'Catering (Comida), Servicio de Bar, Postres / Pastel, Estación de Café / Bebidas'},
    {name:'Entretenimiento y Programa',  category:'Servicios Musicales',      subcategory:'Música',
     services:'DJ / Banda / Música en Vivo, MC / Animador, Artistas Especiales, Honorarios de Conferencistas'},
  ] : [
    {name:'Media & Content',         category:'Photography Services',  subcategory:'Photography',
     services:'Photography, Videography, Live Streaming / Recording, Social Media Content Creator'},
    {name:'Staffing & Guest Services',category:'Other Services',        subcategory:'Other',
     services:'Planner / Coordinator, Event Staff / Brand Ambassadors, Security, Valet / Transportation / Shuttles, Cleaning / Janitorial / Waste Management, On-Site Medic / First Aid'},
    {name:'Logistics',               category:'Transportation Services',subcategory:'Transportation',
     services:'Trucking / Freight, Install & Dismantle Labor, Storage / Warehousing, Hotel Blocks / Accommodation'},
    {name:'Admin & Compliance',      category:'Other Services',         subcategory:'Other',
     services:'Permits / Licenses, Insurance (COI), Vendor Meals / Crew Catering, Contingency / Misc.'},
    {name:'Venue & Rentals',         category:'Venue Services',         subcategory:'Venue',
     services:'Venue / Location, Linen & Tableware Rentals, Tent / Structure Rentals, Restroom Trailer Rentals'},
    {name:'Floral Decoration',       category:'Flowers Services',       subcategory:'Flowers',
     services:'Floral & Greenery, Balloons, Plants / Trees Rentals'},
    {name:'Architectural Decoration',category:'Decoration Services',    subcategory:'Decoration',
     services:'Dancefloor, Dinner Platform, DJ Booth, Signage / Graphics / Branding, Backdrops, Specialty Decor'},
    {name:'Production & Technical',  category:'Other Services',         subcategory:'Other',
     services:'Lighting, Audio, Video / LED / Projection, Staging / Truss / Rigging, Power / Electrical & Generators, Special Effects, Internet / Wi-Fi Provider'},
    {name:'Food & Beverage',         category:'Catering Services',      subcategory:'Catering',
     services:'Catering (Food), Bar Service, Desserts / Cake, Coffee / Beverage Station'},
    {name:'Entertainment & Program', category:'Music Services',         subcategory:'Music',
     services:'DJ / Band / Live Music, MC / Host, Specialty Performers, Speaker / Talent Fees'},
  ];
  return cats.map((c,i)=>({
    id:'dv'+i, name:c.name, category:c.category, subcategory:c.subcategory,
    services:c.services, contact:'', phone:'', budget:0, payments:[], hired:false, notes:''
  }));
}
function sampleGuests(){
  return [
    {id:'sg1',name:'Jane Smith',email:'jane.smith@email.com',phone:'555-0101',category:'Family',rsvp:'confirmed',table:'1',plusOne:false,meal:'Chicken',dietary:'',notes:"Bride's sister"},
    {id:'sg2',name:'Michael Johnson',email:'m.johnson@email.com',phone:'555-0102',category:'Friends',rsvp:'confirmed',table:'1',plusOne:true,meal:'Beef',dietary:'Gluten-free',notes:''},
    {id:'sg3',name:'Sarah Davis',email:'sarah.d@email.com',phone:'555-0103',category:'VIP',rsvp:'pending',table:'2',plusOne:false,meal:'Vegetarian',dietary:'',notes:'CEO of Sponsor Co.'},
    {id:'sg4',name:'Robert Wilson',email:'r.wilson@email.com',phone:'555-0104',category:'Work',rsvp:'confirmed',table:'2',plusOne:true,meal:'Fish',dietary:'Nut allergy',notes:''},
    {id:'sg5',name:'Emily Brown',email:'emily.b@email.com',phone:'555-0105',category:'Family',rsvp:'declined',table:'',plusOne:false,meal:'',dietary:'',notes:'Cannot attend'},
    {id:'sg6',name:'David Martinez',email:'d.martinez@email.com',phone:'555-0106',category:'Friends',rsvp:'pending',table:'3',plusOne:false,meal:'Beef',dietary:'',notes:''},
    {id:'sg7',name:'Lisa Anderson',email:'lisa.a@email.com',phone:'555-0107',category:'Work',rsvp:'confirmed',table:'3',plusOne:true,meal:'Chicken',dietary:'',notes:''},
    {id:'sg8',name:'James Taylor',email:'j.taylor@email.com',phone:'555-0108',category:'VIP',rsvp:'confirmed',table:'4',plusOne:false,meal:'Beef',dietary:'',notes:'City Mayor'},
    {id:'sg9',name:'Amanda White',email:'a.white@email.com',phone:'555-0109',category:'Family',rsvp:'confirmed',table:'4',plusOne:true,meal:'Fish',dietary:'',notes:''},
    {id:'sg10',name:'Christopher Lee',email:'c.lee@email.com',phone:'555-0110',category:'Friends',rsvp:'confirmed',table:'5',plusOne:false,meal:'Chicken',dietary:'Vegetarian',notes:''},
    {id:'sg11',name:'Patricia Garcia',email:'p.garcia@email.com',phone:'555-0111',category:'Work',rsvp:'pending',table:'5',plusOne:false,meal:'',dietary:'',notes:'Awaiting confirmation'},
    {id:'sg12',name:'Thomas Harris',email:'t.harris@email.com',phone:'555-0112',category:'VIP',rsvp:'confirmed',table:'6',plusOne:true,meal:'Beef',dietary:'',notes:'Board member'},
  ];
}
function defaultTasks(){
  const b=new Date(); function d(n){const dt=new Date(b);dt.setDate(dt.getDate()+n);return dt.toISOString().split('T')[0];}
  const isES = (typeof LANG !== 'undefined' && LANG === 'es');
  return isES ? [
    {id:'t1',title:'Reunión Inicial con Cliente',desc:'Revisar visión y requerimientos del evento',assignee:'Coordinador de Evento',dueDate:d(-30),done:true,color:'#7c3aed'},
    {id:'t2',title:'Confirmar Presupuesto y Alcance',desc:'Finalizar asignaciones de presupuesto',assignee:'Coordinador de Evento',dueDate:d(-20),done:true,color:'#7c3aed'},
    {id:'t3',title:'Investigación y Visitas de Venue',desc:'Investigar venues y solicitar disponibilidad',assignee:'Gestor de Proveedores',dueDate:d(-10),done:false,color:'#10b981'},
    {id:'t4',title:'Cotizaciones de Catering',desc:'Solicitar cotizaciones a proveedores de catering',assignee:'Gestor de Proveedores',dueDate:d(5),done:false,color:'#10b981'},
    {id:'t5',title:'Enviar Save-the-Dates',desc:'Diseñar y enviar tarjetas de aviso',assignee:'Coordinador de Evento',dueDate:d(10),done:false,color:'#f59e0b'},
    {id:'t6',title:'Contratar Fotógrafo',desc:'Revisar portafolios y reservar fotógrafo',assignee:'Gestor de Proveedores',dueDate:d(14),done:false,color:'#10b981'},
    {id:'t7',title:'Reunión de Diseño Floral',desc:'Finalizar arreglos florales',assignee:'Director Creativo',dueDate:d(20),done:false,color:'#ec4899'},
    {id:'t8',title:'Finalización de Lista de Invitados',desc:'Recopilar todos los datos de invitados',assignee:'Coordinador de Evento',dueDate:d(30),done:false,color:'#f59e0b'},
    {id:'t9',title:'Enviar Invitaciones',desc:'Enviar invitaciones con fecha límite de RSVP',assignee:'Coordinador de Evento',dueDate:d(35),done:false,color:'#f59e0b'},
    {id:'t10',title:'Contrato y Depósito del Venue',desc:'Finalizar contrato del venue',assignee:'Gestor de Proveedores',dueDate:d(45),done:false,color:'#10b981'},
    {id:'t11',title:'Conteo Final de Invitados',desc:'Confirmar número de personas con proveedores',assignee:'Coordinador de Evento',dueDate:d(70),done:false,color:'#f59e0b'},
    {id:'t12',title:'Coordinación el Día del Evento',desc:'Coordinación y ejecución en sitio',assignee:'Coordinador de Evento',dueDate:d(90),done:false,color:'#a67c3d'},
  ] : [
    {id:'t1',title:'Initial Client Meeting',desc:'Review event vision and requirements',assignee:'Event Coordinator',dueDate:d(-30),done:true,color:'#7c3aed'},
    {id:'t2',title:'Confirm Budget & Scope',desc:'Finalize budget allocations',assignee:'Event Coordinator',dueDate:d(-20),done:true,color:'#7c3aed'},
    {id:'t3',title:'Venue Research & Tours',desc:'Research venues and request availability',assignee:'Vendor Manager',dueDate:d(-10),done:false,color:'#10b981'},
    {id:'t4',title:'Catering Vendor Quotes',desc:'Request quotes from catering vendors',assignee:'Vendor Manager',dueDate:d(5),done:false,color:'#10b981'},
    {id:'t5',title:'Send Save-the-Dates',desc:'Design and send save-the-date cards',assignee:'Event Coordinator',dueDate:d(10),done:false,color:'#f59e0b'},
    {id:'t6',title:'Hire Photographer',desc:'Review portfolios and book photographer',assignee:'Vendor Manager',dueDate:d(14),done:false,color:'#10b981'},
    {id:'t7',title:'Floral Design Meeting',desc:'Finalize floral arrangements',assignee:'Creative Director',dueDate:d(20),done:false,color:'#ec4899'},
    {id:'t8',title:'Guest List Finalization',desc:'Collect all guest details',assignee:'Event Coordinator',dueDate:d(30),done:false,color:'#f59e0b'},
    {id:'t9',title:'Send Invitations',desc:'Mail invitations with RSVP deadline',assignee:'Event Coordinator',dueDate:d(35),done:false,color:'#f59e0b'},
    {id:'t10',title:'Venue Contract & Deposit',desc:'Finalize venue contract',assignee:'Vendor Manager',dueDate:d(45),done:false,color:'#10b981'},
    {id:'t11',title:'Final Guest Count',desc:'Confirm headcount with vendors',assignee:'Event Coordinator',dueDate:d(70),done:false,color:'#f59e0b'},
    {id:'t12',title:'Day-of Coordination',desc:'On-site coordination and execution',assignee:'Event Coordinator',dueDate:d(90),done:false,color:'#a67c3d'},
  ];
}

function ensureDefaultVendors(p){
  if(!p) return false;
  var defaults = defaultVendors();
  var current = Array.isArray(p.vendors) ? p.vendors : [];
  if(!Array.isArray(p.vendors) || !p.vendorsInitialized){
    p.vendors = defaults.concat(current.filter(function(v){ return !(v && /^dv\d+$/.test(v.id||'')); }));
    p.vendorsInitialized = true;
    return true;
  }
  // `changed` se devolvia siempre false aunque p.vendors SI se reasignaba, asi que
  // renderBudget() nunca persistia la normalizacion.  Ahora se marca de verdad.
  var changed = false;
  p.vendors = current.map(function(v){
    if(!(v && /^dv\d+$/.test(v.id||''))) return v;
    var def = defaults.find(function(d){ return d.id === v.id; });
    if(!def) return v;
    var merged = Object.assign({}, def, {
      contact: v.contact || '',
      phone: v.phone || '',
      budget: v.budget || 0,
      payments: Array.isArray(v.payments) ? v.payments : [],
      hired: !!v.hired,
      vendorStatus: v.vendorStatus,
      notes: v.notes || ''
    });
    if(!changed && (merged.name !== v.name || merged.category !== v.category ||
       merged.subcategory !== v.subcategory || merged.services !== v.services)){
      changed = true;
    }
    return merged;
  });
  return changed;
}

function ensureDefaultTasks(p){
  if(!p) return false;
  var defaults = defaultTasks();
  var current = Array.isArray(p.tasks) ? p.tasks : [];
  if(!Array.isArray(p.tasks) || !p.tasksInitialized){
    p.tasks = defaults.concat(current.filter(function(tk){ return !(tk && /^t\d{1,2}$/.test(tk.id||'')); }));
    p.tasksInitialized = true;
    return true;
  }
  var changed = false;
  p.tasks = current.map(function(tk){
    if(!(tk && /^t\d{1,2}$/.test(tk.id||''))) return tk;
    var def = defaults.find(function(d){ return d.id === tk.id; });
    if(!def) return tk;
    var merged = Object.assign({}, def, {
      done: !!tk.done,
      dueDate: tk.dueDate || def.dueDate,
      startDate: tk.startDate || def.startDate || '',
      color: tk.color || def.color
    });
    // Mismo bug que en ensureDefaultVendors: se reasignaba p.tasks pero se
    // devolvia false, asi que la normalizacion no se guardaba.
    if(!changed && (merged.title !== tk.title || merged.desc !== tk.desc)) changed = true;
    return merged;
  });
  return changed;
}

var _evSort='date', _evSortDir=1, _evView='grid';
var _efAt=true, _efFr=null, _efTo=null;

function loadEvPrefs(){
  try{
    var s=localStorage.getItem('eventos_evprefs_'+(DB.cur||'local'));
    if(s){
      var p=JSON.parse(s);
      if(p.sort) _evSort=p.sort;
      if(p.sortDir) _evSortDir=p.sortDir;
      if(p.view) _evView=p.view;
      _efAt = p.filterAllTime!==false;
      _efFr = p.filterFrom?new Date(p.filterFrom):null;
      _efTo   = p.filterTo  ?new Date(p.filterTo)  :null;
      if(p.analyticsAllTime!==undefined) _aAt=p.analyticsAllTime;
      if(p.analyticsFrom) _aFr=new Date(p.analyticsFrom);
      if(p.analyticsTo)   _aTo  =new Date(p.analyticsTo);
    }
  }catch(e){ console.warn('EventOS: loadEvPrefs failed', e); }
}

function saveEvPrefs(){
  try{
    var p={sort:_evSort,sortDir:_evSortDir,view:_evView,
      filterAllTime:_efAt,
      filterFrom:_efFr?_efFr.toISOString():null,
      filterTo:_efTo?_efTo.toISOString():null,
      analyticsAllTime:_aAt,
      analyticsFrom:_aFr?_aFr.toISOString():null,
      analyticsTo:_aTo?_aTo.toISOString():null};
    localStorage.setItem('eventos_evprefs_'+(DB.cur||'local'),JSON.stringify(p));
  }catch(e){ console.warn('EventOS: saveEvPrefs failed', e); }
}

function setEvFilter(mode){
  _efAt=true; _efFr=null; _efTo=null;
  const fromEl=document.getElementById('ef-from'); const toEl=document.getElementById('ef-to');
  if(fromEl)fromEl.value=''; if(toEl)toEl.value='';
  const btn=document.getElementById('ef-alltime'); if(btn)btn.classList.add('active');
  saveEvPrefs(); renderEvents();
}

function setEvFilterDates(){
  const fromVal=parseUserDate((document.getElementById('ef-from')||{}).value);
  const toVal=parseUserDate((document.getElementById('ef-to')||{}).value);
  _efAt=false;
  _efFr=fromVal?new Date(fromVal+'T00:00:00'):null;
  _efTo  =toVal  ?new Date(toVal+'T23:59:59')  :null;
  const btn=document.getElementById('ef-alltime'); if(btn)btn.classList.remove('active');
  saveEvPrefs(); renderEvents();
}

function updateEvFilterLabels(){
  const btn=document.getElementById('ef-alltime'); if(btn)btn.textContent=t('filter_all_dates');
}
function toggleEvSortMenu(){
  var m=document.getElementById('ev-sort-menu');
  if(!m)return;
  m.style.display=(m.style.display==='none'||m.style.display==='')?'block':'none';
}
function closeEvSortMenu(){ var m=document.getElementById('ev-sort-menu');if(m)m.style.display='none'; }
function updateEvSortLabel(){
  var sortKeys={date:'sort_date',name:'sort_name',type:'sort_type',location:'sort_location',budget:'sort_budget',created:'sort_created'};
  var lbl=document.getElementById('ev-sort-label');
  var prefix=LANG==='es'?'Ordenar: ':'Sort: ';
  if(lbl) lbl.textContent=prefix+t(sortKeys[_evSort]||'sort_date');
  Object.entries(sortKeys).forEach(function([k,tk]){
    var b=document.getElementById('evsort-'+k);
    if(b){ b.textContent=t(tk); b.classList.toggle('active',k===_evSort); }
  });
}
function setEvSort(s){
  if(_evSort===s){ _evSortDir*=-1; }
  else{ _evSort=s; _evSortDir=1; }
  closeEvSortMenu();
  var dirBtn=document.getElementById('ev-sort-dir');
  if(dirBtn) dirBtn.textContent=_evSortDir===1?'↑':'↓';
  updateEvSortLabel();
  saveEvPrefs(); renderEvents();
}
function toggleEvSortDir(){ _evSortDir*=-1; const b=document.getElementById('ev-sort-dir');if(b)b.textContent=_evSortDir===1?'↑':'↓'; saveEvPrefs(); renderEvents(); }
function setEvView(v){
  if(typeof isPhoneViewport === 'function' && isPhoneViewport()) v='grid';
  _evView=v;
  document.getElementById('ev-view-grid').classList.toggle('active',v==='grid');
  document.getElementById('ev-view-list').classList.toggle('active',v==='list');
  saveEvPrefs(); renderEvents();
}

// Register core module public API
EventOS.register('core', {
  proj: function(){ return proj(); },
  uproj: function(){ return uproj(); },
  saveProj: saveProj,
  flushSave: flushSave,
  switchTab: switchTab,
  openProject: typeof openProject === 'function' ? openProject : undefined,
  t: t,
  tp: tp,
  esc: typeof esc === 'function' ? esc : undefined,
});

// ═══════════════════════════════════════════════════════════════
// ONBOARDING WIZARD — first-time setup (creates first event)
// ═══════════════════════════════════════════════════════════════
var _ob = null; // onboarding state

function _showOnboardingWizard(){
  _ob = { step:0, type:'', name:'', clientName:(USER_PROFILE&&(USER_PROFILE.name||USER_PROFILE.email))||'', date:'', location:'', budget:'', goals:[], otherLabel:'' };
  _renderOnboarding();
}

function _renderOnboarding(){
  var s = _ob.step;
  var isES = LANG === 'es';
  var stepLabels = isES ? ['Detalles','Fecha y lugar','Herramientas'] : ['Details','Date & venue','Tools'];

  // Progress indicator
  var prog = '<div style="display:flex;align-items:flex-start;gap:0;margin-bottom:28px;">';
  for(var i=0;i<stepLabels.length;i++){
    var done=i<s, active=i===s;
    var circBg=done?'var(--gold)':active?'var(--gold-l)':'var(--bg)';
    var circBd=(done||active)?'var(--gold)':'var(--border)';
    var circClr=done?'#fff':active?'var(--gold-h)':'var(--light)';
    var txtClr=active?'var(--gold-h)':done?'var(--text)':'var(--light)';
    var inner=done?'<svg width="11" height="11" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':String(i+1);
    var lineClr=i<=s?'var(--gold)':'var(--border)';
    var line=i>0?'<div style="position:absolute;right:50%;top:13px;width:100%;height:1px;background:'+lineClr+'"></div>':'';
    prog+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;">'
      +line
      +'<div style="width:26px;height:26px;border-radius:50%;border:1.5px solid '+circBd+';background:'+circBg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:'+circClr+';position:relative;z-index:1;">'+inner+'</div>'
      +'<div style="font-size:10px;margin-top:5px;color:'+txtClr+';font-weight:'+(active?'600':'400')+';white-space:nowrap;letter-spacing:.3px;">'+stepLabels[i]+'</div>'
      +'</div>';
  }
  prog+='</div>';

  var body = '';
  if(s===0) body = _obStep0(isES);
  else if(s===1) body = _obStep1(isES);
  else body = _obStep2(isES);

  var backBtn = s>0
    ? '<button class="btn btn-ghost" onclick="_obBack()">'+(isES?'← Atrás':'← Back')+'</button>'
    : '<button class="btn btn-ghost" onclick="_obSkip()">'+(isES?'Explorar primero':'Explore first')+'</button>';

  var nextLbl = s===2 ? (isES?'Crear mi evento':'Create my event') : (isES?'Siguiente':'Next →');

  openMo(
    '<div style="width:100%;max-width:560px;">'
    +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:26px;font-weight:400;color:var(--text);margin-bottom:3px;letter-spacing:-.01em;">'
      +(isES?'Planifica tu evento perfecto':'Plan your perfect event')
    +'</div>'
    +'<div style="font-size:12px;color:var(--light);margin-bottom:24px;letter-spacing:.3px;">'
      +(isES?'Paso '+(s+1)+' de 3 — Configura tu primer evento':'Step '+(s+1)+' of 3 — Set up your first event')
    +'</div>'
    +prog+body
    +'<div class="mo-foot" style="margin-top:28px;">'
      +backBtn
      +'<button class="btn btn-primary" onclick="_obNext()">'+nextLbl+'</button>'
    +'</div>'
    +'</div>'
  );
}

function _obStep0(isES){
  // Event type cards
  var cards = '';
  for(var i=0;i<_WIZ_TYPES.length;i++){
    var et=_WIZ_TYPES[i], sel=_ob.type===et.value;
    var lbl=isES?et.label_es:et.label_en, desc=isES?et.desc_es:et.desc_en;
    var isOther=et.isOther;
    var unselBd=isOther?'#94a3b8':'var(--border)', selBd=isOther?'#475569':'var(--gold)';
    var selBg=isOther?'#f1f5f9':'var(--gold-l)';
    var icoBgSel=isOther?'#475569':'var(--gold)', icoBgUn=isOther?'#cbd5e1':'var(--border)';
    cards+='<div onclick="_obPickType(\''+et.value+'\')" style="display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:var(--r);border:1.5px solid '+(sel?selBd:unselBd)+';background:'+(sel?selBg:'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<div style="width:36px;height:36px;border-radius:9px;background:'+(sel?icoBgSel:icoBgUn)+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +'<svg width="17" height="17" fill="none" stroke="'+(sel?'#fff':'var(--muted)')+'" stroke-width="1.8" viewBox="0 0 24 24">'+et.icon+'</svg></div>'
      +'<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:1px;">'+lbl+'</div><div style="font-size:12px;color:var(--muted);">'+desc+'</div></div>'
      +(sel?'<svg width="16" height="16" fill="none" stroke="'+(isOther?'#475569':'var(--gold)')+'" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div>';
  }
  var otherInput = _ob.type==='other'
    ? '<div class="ig" style="margin-top:4px;margin-bottom:4px;">'
      +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+(isES?'¿Cómo llamarías a este tipo?':'What would you call this event type?')+'</label>'
      +'<input class="input" id="ob-other-label" placeholder="'+(isES?'Ej. Festival, Retiro...':'E.g. Festival, Retreat...')+'" value="'+esc(_ob.otherLabel||'')+'" oninput="if(_ob)_ob.otherLabel=this.value">'
      +'</div>'
    : '';

  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Qué tipo de evento estás organizando?':'What type of event are you planning?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Selecciona la categoría que mejor describe tu evento.':'Select the category that best describes your event.')+'</div>'
    +cards+otherInput
    +'<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">'+(isES?'Detalles del evento':'Event details')+'</div>'
    +_obField('ob-name',isES?'Nombre del evento *':'Event name *',isES?'Ej. Boda de María y Carlos':'E.g. Summer Gala 2026',_ob.name,'text')
    +_obField('ob-client',isES?'Cliente / Organización *':'Client / Organization *',isES?'Nombre del cliente':'Client name',_ob.clientName,'text')
    +'</div></div>';
}

function _obStep1(isES){
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Cuándo y dónde?':'When and where?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px;">'+(isES?'Define cuándo y dónde se llevará a cabo tu evento.':'Set when and where your event will take place.')+'</div>'
    +'<div class="ig" style="margin-bottom:14px;">'
    +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+(isES?'Fecha del evento *':'Event date *')+'</label>'
    +'<div class="date-field">'
    +'<input class="input date-field-input" type="text" id="ob-date" value="'+(_ob.date?formatDMY(_ob.date):'')+'" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker(\'ob-date\')" onfocus="openCalendarPicker(\'ob-date\')">'
    +'<button type="button" class="date-field-btn" onclick="openCalendarPicker(\'ob-date\')" aria-label="'+(isES?'Fecha del evento':'Event date')+'">'
    +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
    +'</button></div></div>'
    +_obField('ob-location',isES?'Sede / Lugar':'Venue / Location',isES?'Nombre o dirección del lugar':'Venue name or address',_ob.location,'text')
    +_obField('ob-budget',isES?'Presupuesto total ('+CURRENCY.symbol+')':'Total budget ('+CURRENCY.symbol+')','0',_ob.budget,'number')
    +'</div>';
}

function _obStep2(isES){
  var items = '';
  for(var i=0;i<_WIZ_GOALS.length;i++){
    var g=_WIZ_GOALS[i], sel=_ob.goals.indexOf(g.id)>-1;
    var lbl=isES?g.es:g.en;
    items+='<div onclick="_obToggleGoal(\''+g.id+'\')" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--r);border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<svg width="16" height="16" fill="none" stroke="'+(sel?'var(--gold-h)':'var(--muted)')+'" stroke-width="1.8" viewBox="0 0 24 24">'+g.icon+'</svg>'
      +'<span style="font-size:13px;font-weight:'+(sel?'600':'400')+';color:var(--text);flex:1;">'+lbl+'</span>'
      +'<div style="width:18px;height:18px;border-radius:4px;border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold)':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +(sel?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div></div>';
  }
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Qué quieres organizar?':'What will you manage?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Selecciona todo lo que aplique. Puedes ajustarlo después.':'Select everything that applies. You can adjust later.')+'</div>'
    +items+'</div>';
}

function _obField(id, label, placeholder, value, type){
  var val = value ? esc(String(value)) : '';
  return '<div class="ig" style="margin-bottom:14px;">'
    +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+label+'</label>'
    +'<input class="input" id="'+id+'" type="'+(type||'text')+'" placeholder="'+placeholder+'" value="'+val+'">'
    +'</div>';
}

function _obPickType(val){ if(_ob){ _ob.type=val; _renderOnboarding(); } }
function _obToggleGoal(id){
  if(!_ob) return;
  var i=_ob.goals.indexOf(id);
  if(i>-1) _ob.goals.splice(i,1); else _ob.goals.push(id);
  _renderOnboarding();
}

function _obFlush(){
  if(!_ob) return;
  var fields=[['ob-name','name'],['ob-client','clientName'],['ob-date','date'],['ob-location','location'],['ob-budget','budget'],['ob-other-label','otherLabel']];
  for(var i=0;i<fields.length;i++){
    var el=document.getElementById(fields[i][0]);
    if(el) _ob[fields[i][1]]=el.value;
  }
}

function _obNext(){
  if(!_ob) return;
  _obFlush();
  var s=_ob.step, isES=LANG==='es';
  if(s===0){
    if(!_ob.type){ toast(isES?'Selecciona un tipo de evento':'Select an event type','e'); return; }
    if(!(_ob.name||'').trim()){ toast(isES?'El nombre es requerido':'Event name is required','e'); return; }
    if(!(_ob.clientName||'').trim()){ toast(isES?'El cliente es requerido':'Client name is required','e'); return; }
  }
  if(s===1){
    if(!_ob.date){ toast(isES?'La fecha es requerida':'Event date is required','e'); return; }
    if(_ob.budget && +_ob.budget<0){ toast(isES?'El presupuesto no puede ser negativo':'Budget cannot be negative','e'); return; }
  }
  if(s===2){ _obFinish(); return; }
  _ob.step++;
  _renderOnboarding();
}

function _obBack(){
  if(!_ob) return;
  _obFlush();
  if(_ob.step>0){ _ob.step--; _renderOnboarding(); }
}

function _obSkip(){
  closeMo();
  _ob=null;
  try{ localStorage.setItem('eventos_welcome_tour_'+DB.cur,'done'); }catch(e){}
}

function _obFinish(){
  _obFlush();
  var isES=LANG==='es';
  var name=(_ob.name||'').trim();
  var client=(_ob.clientName||'').trim();
  var date=parseUserDate(_ob.date);
  if(!name||!client||!date){ toast(isES?'Nombre, cliente y fecha son requeridos':'Name, client and date required','e'); return; }
  var np={
    id:'p'+Date.now(),
    vendors:[], vendorsInitialized:true,
    tasks:[], tasksInitialized:true, guests:[], layoutItems:[], layoutQuoteExtras:[], layoutExport:null, savedLayouts:[],
    moodboard:{folders:[],uncategorized:[]},
    name:name, clientName:client, description:'',
    type:_ob.type==='other'?('other:'+((_ob.otherLabel||'').trim()||'Other')):_ob.type,
    date:date, location:_ob.location,
    budget:+_ob.budget||0, status:'to-be-confirmed',
    wizardGoals:_ob.goals
  };
  saveProj(np);
  closeMo();
  _ob=null;
  try{ localStorage.setItem('eventos_welcome_tour_'+DB.cur,'done'); }catch(e){}
  toast(isES?'¡Evento creado! Bienvenido a EventOS':'Event created! Welcome to EventOS','s');
  setTimeout(function(){ openProject(np.id); },80);
}

// ═══════════════════════════════════════════════════════════════
// WELCOME TOUR — guided tour (accessible from sidebar button)
// ═══════════════════════════════════════════════════════════════
var _wtIndex=0;
var _wtSteps=[
  {
    target:null, pos:'center',
    title:function(){return LANG==='es'?'¡Bienvenido a EventOS!':'Welcome to EventOS!';},
    body:function(){return LANG==='es'
      ?'EventOS te ayuda a planificar cada detalle de tus eventos: presupuesto, proveedores, cronograma, invitados, diseño de espacios y más.<br><br>Te mostraremos las secciones principales para que empieces rápido.'
      :'EventOS helps you plan every detail of your events: budget, vendors, timeline, guests, floor plan design and more.<br><br>Let\'s walk you through the main sections so you can get started quickly.';}
  },
  {
    target:'snav-events', fallback:'mob-menu-btn',
    title:function(){return LANG==='es'?'Mis Eventos':'My Events';},
    body:function(){return LANG==='es'
      ?'Aquí verás todos tus eventos. Puedes crear nuevos, duplicar existentes, filtrar por fecha y gestionar tu portafolio completo.'
      :'Here you\'ll see all your events. Create new ones, duplicate existing, filter by date, and manage your full portfolio.';}
  },
  {
    target:'snav-analytics', fallback:null,
    title:function(){return LANG==='es'?'Analíticas':'Analytics';},
    body:function(){return LANG==='es'
      ?'Visualiza estadísticas de todos tus eventos: presupuestos, invitados, proveedores y tendencias en un solo dashboard.'
      :'See statistics across all your events: budgets, guests, vendors and trends in a single dashboard.';}
  },
  {
    target:'snav-vendors', fallback:null,
    title:function(){return LANG==='es'?'Biblioteca de Proveedores':'Vendor Library';},
    body:function(){return LANG==='es'
      ?'Guarda proveedores que usas frecuentemente en tu biblioteca. Impórtalos a cualquier evento con un clic.'
      :'Save vendors you use frequently in your library. Import them into any event with one click.';}
  },
  {
    target:'snav-layouts', fallback:null,
    title:function(){return LANG==='es'?'Diseños de Espacios':'Floor Plan Layouts';},
    body:function(){return LANG==='es'
      ?'Crea diseños de mesas, escenarios y espacios. Guarda layouts en tu biblioteca para reutilizarlos.'
      :'Create table layouts, stages and floor plans. Save layouts to your library for reuse.';}
  },
  {
    target:'upill', fallback:null,
    title:function(){return LANG==='es'?'Tu Cuenta y Configuración':'Your Account & Settings';},
    body:function(){return LANG==='es'
      ?'Accede a configuración, idioma, moneda y sincronización desde tu avatar. Aquí también puedes cerrar sesión.'
      :'Access settings, language, currency and sync from your avatar. You can also sign out here.';}
  },
  {
    target:null, pos:'center',
    title:function(){return LANG==='es'?'Respalda tu Trabajo':'Back Up Your Work';},
    body:function(){return LANG==='es'
      ?'<strong>Importante:</strong> Después de trabajar en tus eventos, ve a <strong>Configuración → Exportar Respaldo</strong> para descargar una copia de seguridad de todos tus proyectos. Esto te protege ante cualquier pérdida de datos.<br><br>¡Listo! Ya puedes empezar a crear tu primer evento.'
      :'<strong>Important:</strong> After working on your events, go to <strong>Settings → Export Backup</strong> to download a backup of all your projects. This protects you from any data loss.<br><br>You\'re all set! Start by creating your first event.';}
  }
];
function startWelcomeTour(){
  _wtIndex=0;
  _renderWelcomeTourStep();
}
function _wtGetEl(step){
  if(!step.target) return null;
  var el=document.getElementById(step.target);
  if(!el && step.fallback) el=document.getElementById(step.fallback);
  if(el && el.offsetParent===null && step.fallback) el=document.getElementById(step.fallback);
  return el||null;
}
function _renderWelcomeTourStep(){
  var existing=document.getElementById('wtour-overlay');
  if(existing) existing.remove();
  if(_wtIndex>=_wtSteps.length){ _wtEnd(); return; }
  var step=_wtSteps[_wtIndex];
  var targetEl=_wtGetEl(step);
  var isCenter=!targetEl||step.pos==='center';
  var isES=LANG==='es';
  var total=_wtSteps.length;
  var dots='';
  for(var i=0;i<total;i++){
    dots+='<span style="width:'+(i===_wtIndex?'18':'7')+'px;height:7px;border-radius:4px;background:'+(i===_wtIndex?'var(--gold,#a67c3d)':'rgba(166,124,61,.3)')+';display:inline-block;transition:width .25s,background .25s"></span>';
  }
  var spotRect=null;
  if(targetEl){
    var r=targetEl.getBoundingClientRect();
    var pad=8;
    spotRect={x:r.left-pad,y:r.top-pad,w:r.width+pad*2,h:r.height+pad*2};
  }
  var cardStyle='';
  if(isCenter){
    cardStyle='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100002;';
  } else {
    var br=targetEl.getBoundingClientRect();
    var vw=window.innerWidth;
    var cardW=Math.min(320,vw-24);
    var left=br.right+12;
    if(left+cardW>vw) left=Math.max(12,br.left-cardW-12);
    left=Math.max(12,Math.min(left,vw-cardW-12));
    var top=br.top;
    if(top+280>window.innerHeight) top=Math.max(8,window.innerHeight-280);
    cardStyle='position:fixed;top:'+top+'px;left:'+left+'px;z-index:100002;';
  }
  var svgMask='';
  if(spotRect){
    var rx=Math.min(10,spotRect.h/2);
    svgMask='<svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100001" xmlns="http://www.w3.org/2000/svg"><defs><mask id="wtourmask"><rect width="100%" height="100%" fill="white"/><rect x="'+spotRect.x+'" y="'+spotRect.y+'" width="'+spotRect.w+'" height="'+spotRect.h+'" rx="'+rx+'" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(10,8,5,0.62)" mask="url(#wtourmask)"/></svg>';
  } else {
    svgMask='<div style="position:fixed;inset:0;background:rgba(10,8,5,0.55);z-index:100001;pointer-events:none"></div>';
  }
  var prevBtn=_wtIndex>0
    ?'<button onclick="_wtPrev()" style="border:1px solid var(--border,#e7dccb);background:transparent;color:var(--text,#241f17);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">'+(isES?'Atrás':'Back')+'</button>'
    :'';
  var nextLabel=_wtIndex===total-1?(isES?'¡Empezar!':'Let\'s go!'):(isES?'Siguiente':'Next');
  var skipBtn=_wtIndex===0?'<button onclick="_wtEnd()" style="border:none;background:transparent;color:var(--muted,#9a8a6a);font-size:11px;cursor:pointer;padding:4px 0;text-decoration:underline">'+(isES?'Omitir tour':'Skip tour')+'</button>':'';
  var html='<div id="wtour-overlay" style="position:fixed;inset:0;z-index:100000;pointer-events:none">'
    +svgMask
    +'<div style="'+cardStyle+'pointer-events:auto;width:'+Math.min(320,window.innerWidth-24)+'px;background:var(--card,#fff);border:1px solid var(--border,#e7dccb);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.22);padding:22px 22px 18px;font-family:\'DM Sans\',sans-serif;box-sizing:border-box">'
    +  '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">'
    +    '<div style="font-size:15px;font-weight:700;color:var(--text,#241f17);line-height:1.3">'+step.title()+'</div>'
    +    '<button onclick="_wtEnd()" style="border:none;background:transparent;cursor:pointer;color:var(--muted,#9a8a6a);font-size:20px;line-height:1;padding:0;flex-shrink:0;margin-top:-2px" title="'+(isES?'Cerrar':'Close')+'">×</button>'
    +  '</div>'
    +  '<div style="font-size:13px;color:var(--muted,#6f665c);line-height:1.65;margin-bottom:18px">'+step.body()+'</div>'
    +  '<div style="display:flex;align-items:center;gap:8px">'
    +    '<div style="display:flex;gap:4px;align-items:center;flex:1;min-width:0;overflow:hidden">'+dots+'</div>'
    +    '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">'
    +      prevBtn
    +      '<button onclick="_wtNext()" style="border:none;background:var(--gold,#a67c3d);color:#fff;border-radius:8px;padding:6px 18px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">'+nextLabel+'</button>'
    +    '</div>'
    +  '</div>'
    +  skipBtn
    +'</div>'
    +'</div>';
  var wrap=document.createElement('div');
  wrap.innerHTML=html;
  document.body.appendChild(wrap.firstChild);
}
function _wtNext(){
  _wtIndex++;
  if(_wtIndex>=_wtSteps.length){ _wtEnd(); return; }
  _renderWelcomeTourStep();
}
function _wtPrev(){
  if(_wtIndex>0){ _wtIndex--; _renderWelcomeTourStep(); }
}
function _wtEnd(){
  var el=document.getElementById('wtour-overlay');
  if(el) el.remove();
  try{ localStorage.setItem('eventos_welcome_tour_'+DB.cur,'done'); }catch(e){}
}
function _maybeShowWelcomeTour(){
  try{
    var key='eventos_welcome_tour_'+DB.cur;
    if(localStorage.getItem(key)==='done') return;
  }catch(e){ return; }
  setTimeout(_showOnboardingWizard, 800);
}

// ═══════════════════════════════════════════════════════════════════════════
// REDISEÑO 2026-08 — helpers compartidos (paleta "Arcilla").
// Los usan events.js, analytics.js, library.js, budget-timeline-guests.js,
// layout.js y misc.js.  Fuente: Claude Design "EventOS Rediseño.dc.html".
// ═══════════════════════════════════════════════════════════════════════════

// Tonos: fondo + texto.  Son los mismos pares que usa el diseño y coinciden con
// las clases .t-* de styles.css (usa las clases cuando puedas; estos valores son
// para SVG y estilos inline donde no llega una clase).
var RD_TONES = {
  success:   { bg:'#DFF5F1', fg:'#0E7F76' },
  warn:      { bg:'#FDF0D8', fg:'#A2700B' },
  danger:    { bg:'#FDE7E0', fg:'#C23C15' },
  accent:    { bg:'#FDE7E0', fg:'#C23C15' },
  info:      { bg:'#E4EDFC', fg:'#2A63C4' },
  purple:    { bg:'#EEE8FD', fg:'#6341C9' },
  champagne: { bg:'#F7EFDF', fg:'#7A5C2A' },
  neutral:   { bg:'#F1EBE1', fg:'#6E655B' }
};
// Paleta de series para gráficas (viva, en el orden del diseño).
var RD_SERIES = ['#E4572E','#3B7DD8','#17A398','#7C5CE0','#F2A93B','#F2870F','#C89B6A','#C4BBAD'];

function rdTone(key){ return RD_TONES[key] || RD_TONES.neutral; }

/** Píldora de estado. `label` ya debe venir traducido; se escapa aquí. */
function rdPill(label, tone, opts){
  opts = opts || {};
  var cls = 'rd-pill t-' + (RD_TONES[tone] ? tone : 'neutral');
  if(opts.up) cls += ' up';
  if(opts.sm) cls += ' sm';
  if(opts.click) cls += ' click';
  if(opts.cls) cls += ' ' + opts.cls;
  return '<span class="' + cls + '"' + (opts.attrs ? ' ' + opts.attrs : '') + '>' +
    (opts.dot ? '<i></i>' : '') + esc(label) + '</span>';
}

// El estado guardado usa 'planning' en proyectos viejos y 'to-be-confirmed' en los nuevos.
function evStatusTone(s){
  switch(s){
    case 'confirmed':   return 'success';
    case 'in-progress': return 'warn';
    case 'completed':   return 'info';
    case 'cancelled':   return 'danger';
    default:            return 'neutral';   // to-be-confirmed / planning / vacío
  }
}
function evTypeTone(ty){
  switch(ty){
    case 'social':     return 'accent';
    case 'corporate':  return 'info';
    case 'community':  return 'success';
    case 'government': return 'warn';
    case 'education':  return 'purple';
    default:           return 'neutral';
  }
}
function evTypeCover(ty){
  switch(ty){
    case 'social':     return 'linear-gradient(135deg,#F2703C,#C23C15)';
    case 'corporate':  return 'linear-gradient(135deg,#4C8DEB,#2A63C4)';
    case 'community':  return 'linear-gradient(135deg,#1FB8AA,#0E7F76)';
    case 'government': return 'linear-gradient(135deg,#F2C05A,#A2700B)';
    case 'education':  return 'linear-gradient(135deg,#8B6CF0,#6341C9)';
    default:           return 'linear-gradient(135deg,#C4BBAD,#8C8072)';
  }
}
function evTypeLabel(ty){
  var k = { social:'type_social', corporate:'type_corporate', community:'type_community',
            government:'type_government', education:'type_education' }[ty];
  return k ? t(k) : (ty || '');
}

/** Iniciales para avatares: "Boda Ramírez & Ortiz" -> "BR". */
function rdInitials(name){
  var parts = String(name || '').trim().split(/\s+/).filter(function(w){ return /[\p{L}\p{N}]/u.test(w); });
  if(!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
}

/**
 * Días hasta una fecha civil 'YYYY-MM-DD'.  Usa startOfLocalDay (lang.js): con
 * new Date(fecha) la medianoche UTC cae en el día anterior en México.
 * Devuelve { n, label, past, valid }.
 */
function rdDaysUntil(ymd){
  var d = startOfLocalDay(ymd);
  if(!d) return { n:null, label:t('no_date'), past:false, valid:false };
  var today = new Date(); today.setHours(0,0,0,0);
  var n = Math.round((d - today) / 86400000);
  var label;
  if(n === 0)      label = t('today_label');
  else if(n === 1) label = t('tomorrow_label');
  else if(n > 0)   label = t('days_left').replace('{n}', n);
  else             label = t('days_ago').replace('{n}', Math.abs(n));
  return { n:n, label:label, past:n < 0, valid:true };
}

/** Anillo de progreso SVG con el porcentaje al centro. */
function rdRing(pct, o){
  o = o || {};
  var size = o.size || 76, sw = o.stroke || 7, color = o.color || '#E4572E';
  var r = size * 0.42, c = size / 2, circ = 2 * Math.PI * r;
  pct = Math.max(0, Math.min(100, Math.round(pct || 0)));
  var dash = pct / 100 * circ;
  return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex-shrink:0">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--sand)" stroke-width="' + sw + '"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"' +
        ' stroke-dasharray="' + dash.toFixed(2) + ' ' + (circ - dash).toFixed(2) + '"' +
        ' transform="rotate(-90 ' + c + ' ' + c + ')" style="transition:stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)"/>' +
    '</svg>' +
    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">' +
      '<div style="font-size:' + (o.labelSize || 15) + 'px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1">' + pct + '%</div>' +
      (o.sub === null ? '' : '<div class="rd-mini" style="font-size:9px;margin-top:2px">' + esc(o.sub || t('tasks_plan')) + '</div>') +
    '</div></div>';
}

/**
 * Dona SVG con total al centro.  `data` = [[color, valor, etiqueta], …].
 * Con total 0 dibuja solo la pista (sin dividir entre cero).
 */
function rdDonut(data, o){
  o = o || {};
  var size = o.size || 118, sw = o.stroke || 15;
  var r = size * 0.38, c = size / 2, circ = 2 * Math.PI * r;
  var total = (data || []).reduce(function(s, d){ return s + (Number(d[1]) || 0); }, 0);
  var segs = '', rot = -90;
  if(total > 0){
    var gap = data.filter(function(d){ return Number(d[1]) > 0; }).length > 1 ? Math.min(circ * 0.035, 5) : 0;
    data.forEach(function(d){
      var v = Number(d[1]) || 0;
      if(v <= 0) return;
      var pct = v / total, arc = Math.max(0.6, pct * circ - gap);
      segs += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + d[0] + '" stroke-width="' + sw + '" stroke-linecap="round"' +
        ' stroke-dasharray="' + arc.toFixed(2) + ' ' + (circ - arc).toFixed(2) + '" stroke-dashoffset="' + (circ * 0.25).toFixed(2) + '"' +
        ' transform="rotate(' + rot.toFixed(2) + ' ' + c + ' ' + c + ')" style="transition:stroke-dasharray .6s"/>';
      rot += pct * 360;
    });
  }
  var center = (o.center === undefined) ? String(total) : o.center;
  return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex-shrink:0">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--sand)" stroke-width="' + sw + '"/>' + segs +
    '</svg>' +
    (center === null ? '' :
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">' +
        '<div style="font-size:' + Math.round(size * 0.23) + 'px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1;color:var(--ink)">' + esc(center) + '</div>' +
        '<div class="rd-mini" style="font-size:10px;margin-top:3px">' + esc(o.centerSub === undefined ? 'total' : o.centerSub) + '</div>' +
      '</div>') +
    '</div>';
}

/** Tarjeta de métrica. `value`/`sub`/`label` ya traducidos; se escapan aquí. */
function rdMetric(o){
  o = o || {};
  var html = '<div class="rd-metric' + (o.center ? ' center' : '') + (o.cls ? ' ' + o.cls : '') + '"' + (o.attrs ? ' ' + o.attrs : '') + '>';
  if(o.icon){
    html += '<div class="rd-metric-top"><span class="rd-label">' + esc(o.label || '') + '</span>' +
      '<span class="rd-metric-ico" style="background:' + (o.iconBg || 'var(--accent-l)') + ';color:' + (o.iconFg || 'var(--accent-deep)') + '">' + o.icon + '</span></div>';
  } else if(!o.center){
    html += '<div class="rd-label" style="margin-bottom:12px">' + esc(o.label || '') + '</div>';
  }
  html += '<div class="rd-metric-val' + (o.valClass ? ' ' + o.valClass : '') + '"' + (o.color ? ' style="color:' + o.color + '"' : '') + '>' + esc(o.value == null ? '' : o.value) + '</div>';
  if(o.center) html += '<div class="rd-label">' + esc(o.label || '') + '</div>';
  if(o.sub) html += '<div class="rd-metric-sub">' + esc(o.sub) + '</div>';
  if(o.bar){
    html += '<div class="rd-bar thin" style="margin-top:13px"><i style="width:' + Math.max(0, Math.min(100, o.bar.pct || 0)) + '%' +
      (o.bar.color ? ';background:' + o.bar.color : '') + '"></i></div>';
  }
  return html + '</div>';
}

/** % del plan completado (tareas hechas / tareas totales). */
function evProgress(p){
  var tasks = (p && p.tasks) || [];
  if(!tasks.length) return 0;
  return Math.round(tasks.filter(function(tk){ return tk && tk.done; }).length / tasks.length * 100);
}

/**
 * Resumen numérico de un proyecto, en un solo sitio para que todas las vistas
 * cuenten lo mismo.  OJO: si el proyecto tiene `_hasExtras` sin `_extrasLoaded`,
 * guests/vendors están vacíos en memoria (ver CLAUDE.md) — quien agregue varios
 * proyectos debe llamar antes a _ensureAllProjectsComplete().
 */
function rdEventSummary(p){
  p = p || {};
  var vendors = p.vendors || [], guests = p.guests || [], tasks = p.tasks || [];
  var budget = Number(p.budget) || 0;
  var allocated = vendors.reduce(function(s, v){ return s + (Number(v && v.budget) || 0); }, 0);
  var paid = vendors.reduce(function(s, v){
    return s + ((v && v.payments) || []).reduce(function(a, pay){ return a + (Number(pay && pay.amount) || 0); }, 0);
  }, 0);
  var hired = vendors.filter(function(v){ return v && v.hired; }).length;
  // El modelo real usa rsvp 'confirmed' | 'pending' | 'declined' y plusOne booleano
  // (un acompañante como mucho).  Los conteos incluyen al acompañante, igual que
  // renderGuests() en budget-timeline-guests.js.
  var confirmed = 0, pending = 0, declined = 0, seats = 0, plusOnes = 0;
  guests.forEach(function(g){
    if(!g) return;
    var n = 1 + (g.plusOne ? 1 : 0);
    if(g.plusOne) plusOnes++;
    seats += n;
    if(g.rsvp === 'confirmed') confirmed += n;
    else if(g.rsvp === 'declined') declined += n;
    else pending += n;
  });
  var tasksDone = tasks.filter(function(tk){ return tk && tk.done; }).length;
  var overdue = tasks.filter(function(tk){ return isTaskOverdue(tk); }).length;
  return {
    budget: budget, allocated: allocated, paid: paid,
    balance: budget - paid, unallocated: budget - allocated,
    vendorsTotal: vendors.length, hired: hired,
    guestsTotal: guests.length, seats: seats, plusOnes: plusOnes,
    confirmed: confirmed, pending: pending, declined: declined,
    tasksTotal: tasks.length, tasksDone: tasksDone,
    tasksPct: tasks.length ? Math.round(tasksDone / tasks.length * 100) : 0,
    overdue: overdue
  };
}

// ─── Buscador de la barra superior ────────────────────────────────────────
// Escribir en él lleva a la lista de eventos y reutiliza el filtro que ya existe
// (filterEvents en events.js), en vez de inventar un segundo motor de búsqueda.
function topbarSearch(q){
  if(_currentPage !== 'events') showPage('events');
  var box = document.getElementById('event-search');
  if(box) box.value = q;
  if(typeof filterEvents === 'function') filterEvents(q);
}
function focusGlobalSearch(){
  var el = document.getElementById('topbar-search-input');
  if(el){ el.focus(); el.select(); }
}
function reopenActiveProject(){
  var id = _recentProjectIds && _recentProjectIds[0];
  if(id && uproj()[id]) openProject(id);
  else showPage('events');
}
document.addEventListener('keydown', function(e){
  if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
    e.preventDefault();
    focusGlobalSearch();
  }
});

// ─── Estado del shell (migas, contadores, evento activo) ──────────────────
function rdUpdateShell(){
  var page = _currentPage || 'events';
  var rootKey = { dashboard:'overview', analytics:'nav_analytics', library:'lib_root', project:'nav_events', events:'nav_events' }[page] || 'nav_events';
  var rootEl = document.getElementById('crumb-root');
  if(rootEl) rootEl.textContent = t(rootKey === 'overview' ? 'overview' : rootKey);
  var wrap = document.getElementById('crumb-project');
  var cur = document.getElementById('crumb-cur');
  var p = (page === 'project') ? proj() : null;
  if(wrap) wrap.style.display = p ? 'flex' : 'none';
  if(cur && p) cur.textContent = p.name || '';

  // Contador de eventos del sidebar
  var cnt = document.getElementById('snav-events-count');
  if(cnt){
    var n = Object.values(uproj()).filter(function(x){
      return x && x.id && x.id !== '__library__' && x.id !== '__lib_layout__' && x.status && x.status !== '__internal__';
    }).length;
    cnt.textContent = n ? String(n) : '';
  }

  // Evento activo (el último abierto), como en el diseño
  var aw = document.getElementById('sb-active-wrap');
  if(aw){
    var aid = (_recentProjectIds && _recentProjectIds[0]) || null;
    var ap = aid ? uproj()[aid] : null;
    if(ap){
      aw.style.display = '';
      var ini = document.getElementById('sb-active-ini');
      var nm  = document.getElementById('sb-active-name');
      var dt  = document.getElementById('sb-active-date');
      if(ini) ini.textContent = rdInitials(ap.name);
      if(nm)  nm.textContent = ap.name || '';
      if(dt)  dt.textContent = ap.date ? fmtDate(ap.date) : t('no_date');
    } else {
      aw.style.display = 'none';
    }
  }

  var sl = document.getElementById('sb-search-label');
  if(sl) sl.textContent = LANG === 'es' ? 'Buscar' : 'Search';
  var ti = document.getElementById('topbar-search-input');
  if(ti) ti.placeholder = t('topbar_search_ph');
  var fm = document.getElementById('feedback-menu-label');
  if(fm) fm.textContent = LANG === 'es' ? 'Enviar comentarios' : 'Send feedback';
}
