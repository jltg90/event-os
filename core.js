
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
    'PresentaciÃ³n':'Presentación','Sesión':'Sesión'
  };
  Object.keys(replacements).forEach(function(key){
    fixed = fixed.split(key).join(replacements[key]);
  });
  return fixed;
}
function t(key){ return fixMojibake((TRANSLATIONS[LANG]||TRANSLATIONS.en)[key] || TRANSLATIONS.en[key] || key); }
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
    var elements = scope.querySelectorAll ? scope.querySelectorAll('[title],[placeholder],input[value],textarea,option]') : [];
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
function startMojibakeObserver(){
  try{
    if(_mojibakeObserver || typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') return;
    repairMojibakeInDOM(document.body);
    _mojibakeObserver = new MutationObserver(function(mutations){
      try{
        mutations.forEach(function(mutation){
          mutation.addedNodes && mutation.addedNodes.forEach(function(node){
            if(node.nodeType === 3){
              if(node.nodeValue && /[ÃÂâð]/.test(node.nodeValue)) node.nodeValue = fixMojibake(node.nodeValue);
              return;
            }
            if(node.nodeType === 1) repairMojibakeInDOM(node);
          });
          if(mutation.type === 'characterData' && mutation.target && mutation.target.nodeValue && /[ÃÂâð]/.test(mutation.target.nodeValue)){
            mutation.target.nodeValue = fixMojibake(mutation.target.nodeValue);
          }
        });
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
  }catch(e){}
}

function loadLangPref(){
  try{
    var saved = localStorage.getItem(getLangPrefKey(DB.cur));
    if(saved === 'en' || saved === 'es') LANG = saved;
  }catch(e){}
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
  const lb = document.getElementById('lang-btn');
  if(lb) lb.title = LANG==='en' ? 'Cambiar a Español' : 'Switch to English';
  const mlb = document.getElementById('mob-lang-label');
  if(mlb) mlb.textContent = LANG==='es' ? 'English / Inglés' : 'Español / Spanish';
  const ll = document.getElementById('lang-label');
  if(ll) ll.textContent = LANG==='es' ? 'EN' : 'ES';
  repairMojibakeInDOM(document.body);
}


var DB  = { cur: null, projects: {} };
var WIX_USER = null;

var EVENTOS_CONFIG = window.EVENTOS_CONFIG || {};
var AI_PROXY_URL = EVENTOS_CONFIG.aiProxyUrl || '';
var EVENTOS_DATA = window.EVENTOS_DATA || null;
var _saveTimer = null;
var _lastSyncTime = null;

function hasRequiredConfig(){
  return !!(EVENTOS_DATA && EVENTOS_DATA.isConfigured && EVENTOS_DATA.isConfigured() && AI_PROXY_URL);
}

function getConfigErrorMessage(){
  if(EVENTOS_DATA && EVENTOS_DATA.getConfigErrorMessage) return EVENTOS_DATA.getConfigErrorMessage();
  return 'Missing app configuration. Check app-config.js and reload.';
}

function cacheDB(){
  try{ if(DB.cur) localStorage.setItem('eventos_cache_'+DB.cur, JSON.stringify(DB.projects[DB.cur]||{})); }catch(e){}
}
function loadCache(userId){
  try{
    var s = localStorage.getItem('eventos_cache_'+userId);
    if(s){ DB.projects[userId] = JSON.parse(s); return true; }
  }catch(e){}
  return false;
}

async function loadProjectsFromCloud(userId){
  setSyncStatus('syncing');

  var hadCache = loadCache(userId);
  if(hadCache) renderEvents();

  try{
    var controller = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function(){ controller.abort(); }, 12000) : null;
    var projects = await EVENTOS_DATA.getProjectsByWixUserId(userId, {
      signal: controller ? controller.signal : undefined
    });
    if(timeoutId) clearTimeout(timeoutId);
    if(projects && Object.keys(projects).length > 0){
      DB.projects[userId] = projects;
      if(projects['__library__']) projects['__library__']._seeded = true;
      cacheDB();
    } else if(!hadCache){
      if(!DB.projects[userId]) DB.projects[userId] = {};
    }
    renderEvents();
    _lastSyncTime = Date.now();
    setSyncStatus('ok');
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

function showLoadingError(msg){
  var el = document.getElementById('pg-loading-error');
  if(el){ el.textContent = msg; el.style.display = 'block'; }
}

async function saveProj(p){
  if(!DB.projects[DB.cur]) DB.projects[DB.cur] = {};
  DB.projects[DB.cur][p.id] = p;
  cacheDB();

  setSyncStatus('saving');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async function(){
    try{
      await EVENTOS_DATA.upsertProject(DB.cur, p);
      _lastSyncTime = Date.now();
      setSyncStatus('ok');
    }catch(e){ console.error('saveProj:', e); setSyncStatus('offline'); }
  }, 1500);
}

function saveDB(){
  var p = proj();
  if(p) saveProj(p);
  else cacheDB();
}

async function delProj(id){
  if(DB.projects[DB.cur]) delete DB.projects[DB.cur][id];
  cacheDB();
  try{
    await EVENTOS_DATA.deleteProject(DB.cur, id);
  }catch(e){ console.error('delProj:', e); }
}

async function manualSync(){
  if(!DB.cur) return;
  setSyncStatus('syncing');
  try{
    var _mc = typeof AbortController!=='undefined' ? new AbortController() : null;
    var _mt = _mc ? setTimeout(function(){ _mc.abort(); }, 10000) : null;
    var projects = await EVENTOS_DATA.getProjectsByWixUserId(DB.cur, {
      signal: _mc ? _mc.signal : undefined
    });
    if(_mt) clearTimeout(_mt);
    if(projects && Object.keys(projects).length > 0){
      DB.projects[DB.cur] = projects;
      if(projects['__library__']) projects['__library__']._seeded = true;
      cacheDB();
    } else {
      DB.projects[DB.cur] = {};
      cacheDB();
    }
    renderEvents();
    _lastSyncTime = Date.now();
    setSyncStatus('ok');
  }catch(e){
    setSyncStatus('offline');
  }
}

var _syncPollTimer = null;
function startSyncPoll(){
  if(_syncPollTimer) clearInterval(_syncPollTimer);
  _syncPollTimer = setInterval(function(){
    if(DB.cur) manualSync();
  }, 60000);
}

window.addEventListener('message', function(event){
  if(window._shareMode) return;
  if(!event.data || event.data.type !== 'WIX_USER') return;
  var d = event.data;
  if(!d.userId) return;

  var newUserId = d.userId;

  if(_appInitialized && DB.cur !== newUserId){
    _appInitialized = false;
    DB.cur = null;
  }

  WIX_USER = { userId: newUserId, email: d.email||'', displayName: d.displayName||'', token: d.token||'' };
  DB.cur = newUserId;

  if(document.readyState !== 'loading') initApp();
  else window.addEventListener('DOMContentLoaded', initApp, { once: true });
});

window.parent.postMessage('EVENTOS_READY', '*');

setTimeout(function(){
  if(window._shareMode) return;

  if(!WIX_USER){
    console.warn('EventOS: no WIX_USER received after 3s — using dev fallback');
    WIX_USER = { userId: 'dev_user_local', email: 'dev@local.test', displayName: 'Dev User', token: '' };
    DB.cur = 'dev_user_local';
    if(document.readyState !== 'loading') initApp();
    else window.addEventListener('DOMContentLoaded', initApp, { once: true });
  }
  else if(!_appInitialized){
    if(document.readyState !== 'loading') initApp();
    else window.addEventListener('DOMContentLoaded', initApp, { once: true });
  }
}, 3000);

var _appInitialized = false;
async function initApp(){
  if(_appInitialized) return;
  _appInitialized = true;
  var pgApp = document.getElementById('pg-app');
  var pgLoad = document.getElementById('pg-loading');
  if(pgApp) pgApp.classList.add('hidden');
  if(pgLoad) pgLoad.style.display = 'flex';
  var errEl = document.getElementById('pg-loading-error');
  if(errEl) errEl.style.display = 'none';
  if(!hasRequiredConfig()){
    showLoadingError(getConfigErrorMessage());
    return;
  }
  startMojibakeObserver();
  var isDevMode = (DB.cur === 'dev_user_local');
  var ok = await loadProjectsFromCloud(DB.cur);
  if(ok !== false || isDevMode) enterApp();
}

var CID = null;
var CTAB = 'dashboard';

function doLogout(){
  if(_syncPollTimer){ clearInterval(_syncPollTimer); _syncPollTimer=null; }
  DB.cur = null;
  DB.projects = {};
  WIX_USER = null;
  _appInitialized = false;
  closeMenu();
  document.getElementById('pg-app').classList.add('hidden');
  document.getElementById('pg-loading').style.display = 'flex';
  window.parent.postMessage('EVENTOS_LOGOUT', '*');
  toast('Signed out');
}

function enterApp(){
  loadLangPref();
  loadEvPrefs();
  applyTranslations();
  var loadingEl = document.getElementById('pg-loading');
  var appEl = document.getElementById('pg-app');
  if(loadingEl) loadingEl.style.display = 'none';
  if(appEl) appEl.classList.remove('hidden');
  setTimeout(updateAIFabVisibility, 200);
  var name    = (WIX_USER && WIX_USER.displayName) ? WIX_USER.displayName : (WIX_USER && WIX_USER.email ? WIX_USER.email : DB.cur);
  var email   = (WIX_USER && WIX_USER.email) ? WIX_USER.email : DB.cur;
  var initial = name[0].toUpperCase();
  var uav = document.getElementById('uav');
  var uname = document.getElementById('uname');
  var uemail = document.getElementById('uemail');
  var mobUav = document.getElementById('mob-uav');
  var mobUname = document.getElementById('mob-uname');
  var mobUemail = document.getElementById('mob-uemail');
  if(uav) uav.textContent = initial;
  if(uname) uname.textContent = name;
  if(uemail) uemail.textContent = email;
  if(mobUav) mobUav.textContent = initial;
  if(mobUname) mobUname.textContent = name;
  if(mobUemail) mobUemail.textContent = email;
  showPage('events');
  setSyncStatus('ok');
  startSyncPoll();
}

function setSyncStatus(state){
  var dot      = document.getElementById('sync-dot');
  var label    = document.getElementById('sync-label');
  var btn      = document.getElementById('sync-btn');
  var dotMenu  = document.getElementById('sync-dot-menu');
  var labelMenu= document.getElementById('sync-label-menu');
  var cfg = {
    ok:      { color:'#4caf50', text:'Saved',      title:'All changes saved to cloud.' },
    syncing: { color:'#f59e0b', text:'Syncing…',   title:'Syncing with cloud…' },
    saving:  { color:'#3b82f6', text:'Saving…',    title:'Saving to cloud…' },
    offline: { color:'#ef4444', text:'Offline',    title:'Saved locally — will sync when reconnected.' },
    error:   { color:'#ef4444', text:'Save error', title:'Could not save — check connection.' },
  };
  var c = cfg[state] || cfg.ok;
  if(dot)      dot.style.background  = c.color;
  if(dotMenu)  dotMenu.style.background = c.color;
  if(label)    label.textContent     = c.text;
  if(labelMenu)labelMenu.textContent = c.text;
  if(btn){
    btn.title = c.title;
    btn.style.borderColor = (state==='offline'||state==='error') ? 'rgba(239,68,68,.4)' : 'var(--border)';
    btn.style.color       = (state==='offline'||state==='error') ? '#ef4444' : 'var(--muted)';
  }
}
function setSyncDot(state){ setSyncStatus(state); }

window.addEventListener('online',  function(){ if(DB.cur) manualSync(); });
window.addEventListener('offline', function(){ setSyncStatus('offline'); });

function toggleMenu(){ document.getElementById('umenu').classList.toggle('hidden'); }
function closeMenu(){ document.getElementById('umenu').classList.add('hidden'); }
document.addEventListener('click',e=>{ if(!e.target.closest('#upill')&&!e.target.closest('#umenu')) closeMenu(); });

function showPage(p){
  ['pg-dashboard','pg-events','pg-project','pg-analytics','pg-library'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.add('hidden');
  });
  const pg=document.getElementById('pg-'+p);if(pg)pg.classList.remove('hidden');
  const snb=document.getElementById('share-nav-btn');if(snb)snb.style.display='none';
  document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));
  const smap={dashboard:'snav-dashboard',events:'snav-events',analytics:'snav-analytics',library:'snav-library'};
  const sid=smap[p]||null; if(sid){const se=document.getElementById(sid);if(se)se.classList.add('active');}
  if(p==='dashboard') renderAppDash();
  else if(p==='events') renderEvents();
  else if(p==='project'){ renderPNav(); switchTab('dashboard'); }
  else if(p==='analytics') renderAnalytics();
  else if(p==='library') renderLibrary();
}
function openProject(id){ CID=id; showPage('project'); }

function renderPNav(){
  const p=proj();if(!p)return;
  document.getElementById('pnav-name').textContent=p.name;
  const tl={social:t('social_private')||'Social / Private',corporate:t('corporate')||'Corporate',community:t('community')||'Community',government:t('government')||'Government',education:t('education')||'Education'};
  document.getElementById('pnav-type').textContent=tl[p.type]||p.type;
}
function switchTab(tab){
  CTAB=tab;
  ['dashboard','budget','timeline','guests','layout','moodboard'].forEach(tabId=>{
    document.getElementById('tab-'+tabId).classList.toggle('hidden',tabId!==tab);
  });
  document.querySelectorAll('.ptab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  ({dashboard:renderDash,budget:renderBudget,timeline:renderTimeline,guests:renderGuests,layout:renderLayout,moodboard:renderMoodboard})[tab]?.();
  if(tab==='layout'){ setTimeout(function(){ lZoom(0,'fit'); },120); }
}

function uproj(){ return DB.projects[DB.cur]||{}; }
function proj(){ return uproj()[CID]||null; }

function createSampleProject(email){
  const p={
    id:'sample_'+Date.now(), name:'Summer Gala 2026', clientName:'Sample Client',
    description:'A stunning summer gala event', date:'2026-06-15', location:'The Grand Garden Hall',
    budget:25000, type:'social', status:'planning',
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
    {id:'t12',title:'Coordinación el Día del Evento',desc:'Coordinación y ejecución en sitio',assignee:'Coordinador de Evento',dueDate:d(90),done:false,color:'#c9a84c'},
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
    {id:'t12',title:'Day-of Coordination',desc:'On-site coordination and execution',assignee:'Event Coordinator',dueDate:d(90),done:false,color:'#c9a84c'},
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
  var changed = false;
  p.vendors = current.map(function(v){
    if(!(v && /^dv\d+$/.test(v.id||''))) return v;
    var def = defaults.find(function(d){ return d.id === v.id; });
    if(!def) return v;
    return Object.assign({}, def, {
      contact: v.contact || '',
      phone: v.phone || '',
      budget: v.budget || 0,
      payments: Array.isArray(v.payments) ? v.payments : [],
      hired: !!v.hired,
      vendorStatus: v.vendorStatus,
      notes: v.notes || ''
    });
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
    return Object.assign({}, def, {
      done: !!tk.done,
      dueDate: tk.dueDate || def.dueDate,
      startDate: tk.startDate || def.startDate || '',
      color: tk.color || def.color
    });
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
  }catch(e){}
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
  }catch(e){}
}

function setEvFilter(mode){
  _efAt=true; _efFr=null; _efTo=null;
  const fromEl=document.getElementById('ef-from'); const toEl=document.getElementById('ef-to');
  if(fromEl)fromEl.value=''; if(toEl)toEl.value='';
  const fdEl=document.getElementById('ef-from-display'); if(fdEl)fdEl.firstElementChild.textContent='DD/MM/YYYY';
  const tdEl=document.getElementById('ef-to-display'); if(tdEl)tdEl.firstElementChild.textContent='DD/MM/YYYY';
  const btn=document.getElementById('ef-alltime'); if(btn)btn.classList.add('active');
  saveEvPrefs(); renderEvents();
}

function setEvFilterDates(){
  const fromVal=(document.getElementById('ef-from')||{}).value;
  const toVal=(document.getElementById('ef-to')||{}).value;
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
  _evView=v;
  document.getElementById('ev-view-grid').classList.toggle('active',v==='grid');
  document.getElementById('ev-view-list').classList.toggle('active',v==='list');
  saveEvPrefs(); renderEvents();
}



