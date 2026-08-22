
var _libTab = 'vendors';
var _mbOpenFolderId = null;
var _libOpenVendorGroupId = null;
var _libOpenTaskGroupId = null;
var _libVendorWizTargetGroupId = null;
var _libPlanWizTargetGroupId = null;

function getLib(){
  var all = uproj();
  if(!all['__library__']){
    // Only create a blank library in memory — do NOT save it yet.
    // Saving here risks overwriting real data before Convex has loaded.
    all['__library__'] = {
      id:'__library__', name:'__library__',
      vendors:[], tasks:[], layouts:[],
      tables:{}, elements:{}, chairs:{}, centerpieces:{},
      moodboards:[]
    };
  }
  var lib = all['__library__'];
  if(!lib.vendors)     lib.vendors=[];
  if(!lib.globalTasks) lib.globalTasks=[];
  if(!lib.tasks)       lib.tasks=[];
  if(!lib.layouts)     lib.layouts=[];
  if(!lib.tables)      lib.tables={};
  if(!lib.elements)    lib.elements={};
  if(!lib.chairs)      lib.chairs={};
  if(!lib.centerpieces)lib.centerpieces={};
  if(!lib.moodboards)  lib.moodboards=[];
  if(typeof lib.defaultVendorsInitialized!=='boolean') lib.defaultVendorsInitialized=false;
  if(typeof lib.defaultTasksInitialized!=='boolean') lib.defaultTasksInitialized=false;
  var changed = false;
  if(typeof defaultVendors==='function' && !lib.defaultVendorsInitialized){
    defaultVendors().forEach(function(v){
      var entryId = 'lv_def_'+v.id;
      var existing = lib.vendors.find(function(entry){ return entry.id===entryId; });
      if(existing){
        if(!Array.isArray(existing.vendors) || !existing.vendors.length){
          existing.vendors = [JSON.parse(JSON.stringify(v))];
          changed = true;
        }
      } else {
        lib.vendors.push({id:entryId, name:v.name, date:formatDMY(today()), vendors:[JSON.parse(JSON.stringify(v))]});
        changed = true;
      }
    });
    lib.defaultVendorsInitialized = true;
    changed = true;
  }
  if(typeof defaultTasks==='function' && !lib.defaultTasksInitialized){
    defaultTasks().forEach(function(tk){
      var taskId = 'gt_def_'+tk.id;
      var existing = (lib.globalTasks||[]).find(function(task){ return task.id===taskId; });
      if(existing){
        existing.title = tk.title;
        existing.desc = tk.desc||'';
        existing.assignee = tk.assignee||'';
        existing.color = tk.color||'#7c3aed';
      } else {
        lib.globalTasks.push({id:taskId, title:tk.title, desc:tk.desc||'', durationDays:7, dueDate:'', assignee:tk.assignee||'', color:tk.color||'#7c3aed', done:false});
        changed = true;
      }
    });
    lib.defaultTasksInitialized = true;
    changed = true;
  }
  if(changed) saveLib(lib);
  return lib;
}
function saveLib(lib){
  var libToSave = JSON.parse(JSON.stringify(lib));
  libToSave.layouts.forEach(function(entry){
    if(entry.floorplan && entry.floorplan.img && entry.floorplan.img!=='__stored__' && entry.floorplan.img!=='__idb__' && entry.floorplan.img.length>200){
      var _libFpKey=entry.floorplan._idb||('libfp_'+Math.random().toString(36).slice(2,10)+'_'+Date.now());
      if(typeof _fpSave==='function'){
        _fpSave(_libFpKey, entry.floorplan.img).catch(function(){});
      }
      entry.floorplan.thumb=entry.floorplan.thumb||entry.floorplan.img; entry.floorplan.img='__idb__';
      entry.floorplan._idb=_libFpKey;
    }
  });
  saveProj(libToSave);
  // Clean up orphaned IndexedDB floorplan entries
  _cleanOrphanedFloorplans(libToSave);
}

function _cleanOrphanedFloorplans(lib){
  if(typeof _fpDB !== 'function') return;
  var activeKeys = {};
  (lib.layouts || []).forEach(function(entry){
    if(entry.floorplan && entry.floorplan._idb) activeKeys[entry.floorplan._idb] = true;
  });
  _fpDB().then(function(db){
    var tx = db.transaction('images', 'readonly');
    var store = tx.objectStore('images');
    var req = store.getAllKeys ? store.getAllKeys() : null;
    if(!req) return;
    req.onsuccess = function(){
      var allKeys = req.result || [];
      var orphans = allKeys.filter(function(k){ return typeof k === 'string' && k.indexOf('libfp_') === 0 && !activeKeys[k]; });
      if(!orphans.length) return;
      var delTx = db.transaction('images', 'readwrite');
      var delStore = delTx.objectStore('images');
      orphans.forEach(function(k){ delStore.delete(k); });
      console.log('EventOS: cleaned', orphans.length, 'orphaned floorplan(s) from IndexedDB');
    };
  }).catch(function(){});
}

function loadFloorplanImg(layoutId, callback){
  if(typeof _fpLoad==='function'){
    _fpLoad('libfp_'+layoutId).then(function(data){
      if(data && callback) callback(data);
      else{
        var all = uproj();
        var fpKey = '__fp_'+layoutId+'__';
        if(all[fpKey] && all[fpKey]._fpImg){ callback(all[fpKey]._fpImg); }
        else if(callback) callback(null);
      }
    }).catch(function(){ if(callback) callback(null); });
    return;
  }
  var all = uproj();
  var fpKey = '__fp_'+layoutId+'__';
  if(all[fpKey] && all[fpKey]._fpImg){
    callback(all[fpKey]._fpImg);
    return;
  }
  if(!(typeof EVENTOS_DATA!=='undefined' && EVENTOS_DATA && typeof DB!=='undefined' && DB.cur)){
    callback(null);
    return;
  }
  EVENTOS_DATA.getProjectsByWixUserId()
    .then(function(projects){
      if(projects && typeof DB!=='undefined'){
        DB.projects[DB.cur] = projects;
      }
      if(projects && projects[fpKey] && projects[fpKey]._fpImg){
        callback(projects[fpKey]._fpImg);
      } else {
        callback(null);
      }
    })
    .catch(function(){ callback(null); });
}

// Estructura base de la pagina de biblioteca (espejo de #pg-library en index.html).
// Se reinyecta cuando el editor de planos ocupa toda la pagina y luego se cierra.
function _libPageShellHTML(){
  return '<div class="page-shell">'
    +'<div class="rd-page-head">'
      +'<div>'
        +'<div class="rd-eyebrow" data-i18n="lib_eyebrow">'+esc(t('lib_eyebrow'))+'</div>'
        +'<h1 class="rd-h1" id="lib-page-title">'+esc(t('lib_title'))+'</h1>'
        +'<p class="rd-sub" id="lib-page-sub" style="display:none"></p>'
      +'</div>'
      +'<div class="rd-actions" id="lib-add-btns"></div>'
    +'</div>'
    +'<div style="display:none" id="lib-tabs"></div>'
    +'<div id="lib-content"></div>'
  +'</div>';
}

function openLibrary(){
  // If a library layout editor is open, close it cleanly before navigating
  if(typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId){
    if(window._libAutoSaveInterval){ clearInterval(window._libAutoSaveInterval); window._libAutoSaveInterval=null; }
    _libEditingLayoutId=null;
    // Restore pg-library to its normal structure
    var pgLib=document.getElementById('pg-library');
    if(pgLib) pgLib.innerHTML=_libPageShellHTML();
  }
  showPage('library');
}

function updateLibraryLabels(){
  var el=document.getElementById('lib-menu-label'); if(el) el.textContent=t('lib_title');
  var isES=LANG==='es';
  var subs={
    index:       t('lib_sub'),
    vendors:     isES?'Grupos de proveedores con contacto, servicios y tarifas listos para reutilizar.':'Vendor groups with contact, services and rates ready to reuse.',
    tasks:       isES?'Plantillas de cronograma con fases, responsables y duraciones.':'Timeline templates with phases, owners and durations.',
    layouts:     isES?'Distribuciones de salón guardadas con mesas, sillas y elementos.':'Saved floor plans with tables, chairs and elements.',
    tables:      isES?'Tipos de mesa guardados para reutilizar en cualquier plano.':'Saved table types to reuse in any floor plan.',
    elements:    isES?'Elementos de plano guardados para reutilizar en cualquier evento.':'Saved plan elements to reuse in any event.',
    chairs:      isES?'Estilos de silla guardados para reutilizar en cualquier plano.':'Saved chair styles to reuse in any floor plan.',
    centerpieces:isES?'Centros de mesa guardados para reutilizar en cualquier plano.':'Saved centerpieces to reuse in any floor plan.',
    moodboards:  isES?'Direcciones visuales y paletas para presentar a tus clientes.':'Visual directions and palettes to present to your clients.'
  };
  var titles={
    index:t('lib_title'), vendors:t('lib_vendors'), tasks:t('lib_tasks'), layouts:libLayoutsLabel(),
    tables:t('lib_tables'), elements:t('lib_elements'), chairs:t('lib_chairs'),
    centerpieces:t('lib_centerpieces'), moodboards:t('lib_moodboards')
  };
  libSetPageTitle(titles[_libTab]||t('lib_title'));
  var ps=document.getElementById('lib-page-sub');
  if(ps){
    var sub=subs[_libTab]||t('lib_sub');
    ps.textContent=sub;
    ps.style.display=sub?'':'none';
  }
}

function libSetPageTitle(title){
  var pt=document.getElementById('lib-page-title');
  if(!pt) return;
  pt.textContent=title;
  pt.classList.add('rd-h1');
}


// Convert an external URL to a base64 data URI so it can be embedded in SVG data URIs
// (browsers block external resource loading from SVGs rendered via <img> or data: URIs).
function _urlToDataUri(url){
  return fetch(url)
    .then(function(res){ return res.blob(); })
    .then(function(blob){
      return new Promise(function(resolve){
        var reader = new FileReader();
        reader.onloadend = function(){ resolve(reader.result); };
        reader.onerror = function(){ resolve(null); };
        reader.readAsDataURL(blob);
      });
    })
    .catch(function(){ return null; });
}

function libResolveLayoutFloorplan(entry){
  return new Promise(function(resolve){
    if(!entry || !entry.floorplan){ resolve(null); return; }
    var fp = JSON.parse(JSON.stringify(entry.floorplan));
    // Already a usable data URI or inline image — use as-is
    if(fp.img && fp.img!=='__idb__' && fp.img!=='__stored__'){
      // If it's an external URL (not data:), convert to data URI for SVG embedding
      if(fp.img.indexOf('data:') !== 0 && fp.img.indexOf('http') === 0){
        _urlToDataUri(fp.img).then(function(dataUri){ fp.img = dataUri || fp.img; resolve(fp); });
      } else {
        resolve(fp);
      }
      return;
    }
    if(fp.img==='__stored__' && fp._storageId){
      // Try IndexedDB cache first (returns base64), then Convex URL → convert to data URI
      var _tryIdb = fp._idb ? _fpLoad(fp._idb).catch(function(){ return null; }) : Promise.resolve(null);
      _tryIdb.then(function(data){
        if(data){ fp.img = data; resolve(fp); return; }
        EVENTOS_DATA.getFileUrl(fp._storageId).then(function(url){
          if(!url){ fp.img = fp.thumb || null; resolve(fp); return; }
          _urlToDataUri(url).then(function(dataUri){ fp.img = dataUri || fp.thumb || null; resolve(fp); });
        }).catch(function(){ fp.img = fp.thumb || null; resolve(fp); });
      });
      return;
    }
    if(fp.img==='__idb__' && fp._idb && typeof _fpLoad==='function'){
      _fpLoad(fp._idb).then(function(data){ fp.img = data || fp.thumb || null; resolve(fp); }).catch(function(){ fp.img = fp.thumb || null; resolve(fp); });
      return;
    }
    if(entry.id){
      loadFloorplanImg(entry.id, function(img){ if(img) fp.img = img; else if(fp.thumb) fp.img = fp.thumb; resolve(fp); });
      return;
    }
    resolve(fp);
  });
}

function libBuildMigratedLayoutEntry(p){
  var isES=LANG==='es';
  return {
    id:'ll_mig_'+Date.now()+Math.random().toString(36).slice(2,7),
    name:(p.name||'Event')+' - '+(isES?'Migrado':'Migrated')+' '+formatDMY(today()),
    notes:isES?'Migrado automaticamente desde el evento':'Auto-migrated from event',
    location:p.location||'',
    guests:String(p.guests||''),
    date:formatDMY(today()),
    updatedAt:new Date().toISOString(),
    items:JSON.parse(JSON.stringify(p.layoutItems||[])),
    floorplan:p.floorplan?JSON.parse(JSON.stringify(p.floorplan)):null
  };
}

async function libCreateEventLayoutExport(entry){
  if(!entry || typeof createLayoutExportPayload!=='function') return null;
  var floorplan = await libResolveLayoutFloorplan(entry);
  return createLayoutExportPayload(entry, floorplan);
}

function libSyncEditingLayoutToLibrary(entryId){
  var lib=getLib();
  var entry=lib.layouts.find(function(e){ return e.id===entryId; });
  if(!entry) return null;
  var lp=typeof uproj==='function' ? uproj()['__lib_layout__'] : null;
  if(!_libEditingLayoutId || _libEditingLayoutId!==entryId || !lp) return entry;
  if(lp.layoutItems) entry.items=JSON.parse(JSON.stringify(lp.layoutItems));
  if(lp.floorplan){
    var syncFp=JSON.parse(JSON.stringify(lp.floorplan));
    if(syncFp.img && syncFp.img!=='__idb__'){
      if(!syncFp.thumb) syncFp.thumb=syncFp.img;
      syncFp.img='__idb__';
    }
    entry.floorplan=syncFp;
  }
  entry.updatedAt=new Date().toISOString();
  saveLib(lib);
  return entry;
}

async function libApplyLayoutExportToEvent(entryId, pid, opts){
  opts = opts || {};
  var isES=LANG==='es';
  var p = uproj()[pid];
  if(!p) return null;
  var lib = getLib();
  var entry = libSyncEditingLayoutToLibrary(entryId) || lib.layouts.find(function(e){ return e.id===entryId; });
  if(!entry){
    toast(t('lib_layout_not_found'),'e');
    return null;
  }
  var exp = await libCreateEventLayoutExport(entry);
  if(!exp){
    toast(t('lib_export_failed'),'e');
    return null;
  }

  // Multi-layout: append or update in eventLayouts
  var layouts = (typeof ensureEventLayouts==='function') ? ensureEventLayouts(p) : [];
  var existingIdx = layouts.findIndex(function(e){
    return e.layoutExport && e.layoutExport.layoutId === exp.layoutId;
  });
  if(existingIdx >= 0){
    // Refresh existing (same library source) — update in place and make it the active one,
    // so the active flag stays consistent with p.layoutExport set below (what's rendered).
    layouts.forEach(function(e){ e.active = false; });
    layouts[existingIdx].layoutExport = exp;
    layouts[existingIdx].active = true;
  } else {
    // New import — append and deactivate others
    layouts.forEach(function(e){ e.active = false; });
    layouts.push({
      id: 'el_' + Date.now() + Math.random().toString(36).slice(2,6),
      layoutExport: exp,
      addedAt: new Date().toISOString(),
      active: true
    });
  }

  p.layoutExport = exp;
  p.layoutItems = [];
  delete p.floorplan;
  saveProj(p);
  if(typeof CID!=='undefined' && CID===pid && typeof CTAB!=='undefined' && CTAB==='layout' && typeof renderLayout==='function') renderLayout();
  if(typeof renderEventLayoutsBtn==='function') renderEventLayoutsBtn();
  if(opts.toastSuccess) toast(t('lib_exported'),'s');
  return exp;
}

async function migrateLegacyEventLayoutToLibrary(p){
  if(!p) return null;
  if(p.layoutExport) return p.layoutExport;
  if(!p.layoutItems || !p.layoutItems.length) return null;
  var lib = getLib();
  var entry = libBuildMigratedLayoutEntry(p);
  entry.name = libUniqueLayoutName(entry.name);
  lib.layouts.push(entry);
  saveLib(lib);
  var exp = await libCreateEventLayoutExport(entry);
  if(exp){
    p.layoutExport = exp;
    p.layoutItems = [];
    delete p.floorplan;
    saveProj(p);
  }
  return exp;
}

function libNormalizeLayoutName(name){
  return String(name||'').trim().replace(/\s+/g,' ').toLowerCase();
}

function libHasLayoutNameConflict(name, excludeId){
  var norm = libNormalizeLayoutName(name);
  if(!norm) return false;
  return getLib().layouts.some(function(entry){
    return entry.id!==excludeId && libNormalizeLayoutName(entry.name)===norm;
  });
}

function libEnsureUniqueLayoutName(name, excludeId){
  if(!libHasLayoutNameConflict(name, excludeId)) return true;
  toast(t('lib_name_exists'),'e');
  return false;
}

function libUniqueLayoutName(baseName, excludeId){
  var clean = String(baseName||'').trim() || (t('lib_untitled'));
  if(!libHasLayoutNameConflict(clean, excludeId)) return clean;
  var n = 2;
  var candidate = clean + ' ('+n+')';
  while(libHasLayoutNameConflict(candidate, excludeId)){
    n++;
    candidate = clean + ' ('+n+')';
  }
  return candidate;
}

function libLayoutZoomExtents(){
  if(typeof lZoom==='function') lZoom(0,'fit');
}

// ── Iconos inline del rediseno (24x24, stroke currentColor) ──────────────
var LIB_ICONS = {
  vendors:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  tasks:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  mood:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="9" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  open:'<path d="M5 12h14M12 5l7 7-7 7"/>',
  send:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="14 7 19 12 14 17"/><line x1="19" y1="12" x2="9" y2="12"/>',
  cube:'<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'
};
function libIcon(key, size, sw){
  var p=LIB_ICONS[key]; if(!p) return '';
  var s=size||16;
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||1.9)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}

// Fila de pestanas de la biblioteca (pildoras .rd-filter con conteo).
function libTabsHTML(lib){
  var tabs=[
    {key:'index',        lbl:t('lib_title'),         cnt:null},
    {key:'vendors',      lbl:t('lib_vendors'),       cnt:lib.vendors.length},
    {key:'tasks',        lbl:t('lib_tasks'),         cnt:(lib.tasks||[]).length},
    {key:'layouts',      lbl:libLayoutsLabel(),      cnt:lib.layouts.length},
    {key:'moodboards',   lbl:t('lib_moodboards'),    cnt:(lib.moodboards||[]).length},
    {key:'tables',       lbl:t('lib_tables'),        cnt:Object.keys(lib.tables||{}).length},
    {key:'elements',     lbl:t('lib_elements'),      cnt:Object.keys(lib.elements||{}).length},
    {key:'chairs',       lbl:t('lib_chairs'),        cnt:Object.keys(lib.chairs||{}).length},
    {key:'centerpieces', lbl:t('lib_centerpieces'),  cnt:Object.keys(lib.centerpieces||{}).length}
  ];
  return '<div class="rd-filterbar lib-tabs">'+tabs.map(function(tb){
    return '<button type="button" class="rd-filter'+(_libTab===tb.key?' active':'')+'" onclick="setLibTab(\''+tb.key+'\')">'
      +esc(tb.lbl)+(tb.cnt===null?'':'<span class="cnt">'+tb.cnt+'</span>')+'</button>';
  }).join('')+'</div>';
}

// Portada de la biblioteca: cuatro tarjetas grandes con conteos.
function renderLibIndex(lib){
  var isES=LANG==='es';
  var vendorCount=0;
  lib.vendors.forEach(function(e){ vendorCount+=(e.vendors||[]).length; });
  var cards=[
    {key:'vendors', icon:'vendors', tone:'accent', title:t('lib_vendors'),
      desc:isES?'Fichas con contacto, categoría y tarifas de referencia listas para reutilizar.':'Cards with contact, category and reference rates ready to reuse.',
      count:vendorCount, unit:isES?'proveedores':'vendors'},
    {key:'tasks', icon:'tasks', tone:'success', title:t('lib_tasks'),
      desc:isES?'Plantillas de cronograma por tipo de evento, con fases y responsables.':'Timeline templates by event type, with phases and owners.',
      count:(lib.tasks||[]).length, unit:isES?'plantillas':'templates'},
    {key:'layouts', icon:'layout', tone:'info', title:libLayoutsLabel(),
      desc:isES?'Distribuciones de salón guardadas con mesas, sillas y elementos.':'Saved floor plans with tables, chairs and elements.',
      count:lib.layouts.length, unit:isES?'planos':'plans'},
    {key:'moodboards', icon:'mood', tone:'champagne', title:t('lib_moodboards'),
      desc:isES?'Direcciones visuales y paletas para presentar a tus clientes.':'Visual directions and palettes to present to your clients.',
      count:(lib.moodboards||[]).length, unit:isES?'tableros':'boards'}
  ];
  return '<div class="lib-index-grid">'+cards.map(function(c){
    var tn=rdTone(c.tone);
    return '<section class="rd-card pad-lg hover click lib-index-card" onclick="setLibTab(\''+c.key+'\')">'
      +'<div class="lib-index-ico" style="background:'+tn.bg+';color:'+tn.fg+'">'+libIcon(c.icon,18)+'</div>'
      +'<h2 class="rd-h3 lib-index-title">'+esc(c.title)+'</h2>'
      +'<p class="lib-index-desc">'+esc(c.desc)+'</p>'
      +'<div class="lib-index-foot">'
        +'<span class="lib-index-num rd-num">'+c.count+'</span>'
        +'<span class="lib-index-unit">'+esc(c.unit)+'</span>'
        +'<div class="rd-spacer"></div>'
        +'<span class="btn btn-sm">'+(isES?'Abrir':'Open')+'</span>'
      +'</div></section>';
  }).join('')+'</div>';
}

function renderLibrary(){
  updateLibraryLabels();
  var lib = getLib();
  var isES = LANG==='es';

  // Tab bar hidden — navigation is via sidebar only

  var addEl = document.getElementById('lib-add-btns');
  var addMap = {
    vendors:'lib_add_vendor', tasks:'lib_add_task', layouts:'lib_add_layout',
    tables:'lib_add_types', elements:'lib_add_types', chairs:'lib_add_types',
    centerpieces:'lib_add_types', moodboards:'lib_add_moodboard'
  };
  if(addEl){
    if(_libTab==='index'){
      addEl.innerHTML='';
    } else if(_libTab==='vendors'){
      if(_libOpenVendorGroupId){
        addEl.innerHTML =
          '<button class="btn" onclick="libBackToVendorGroups()">'
          +libIcon('back',13,2.2)+(t('lib_back'))+'</button>'
          +'<button class="btn btn-primary" onclick="libOpenVendorModalForGroup(\''+_libOpenVendorGroupId+'\')">'
          +libIcon('plus',14,2.4)+(t('lib_add_vendor'))+'</button>';
      } else {
        addEl.innerHTML =
          '<button class="btn" onclick="libImportCSV()">'+(isES?'Importar CSV':'Import CSV')+'</button>'
          +'<button class="btn btn-primary" onclick="libNewVendorGroupModal()">'
          +libIcon('plus',14,2.4)+(t('lib_new_group'))+'</button>';
      }
    } else if(_libTab==='tasks'){
      if(_libOpenTaskGroupId){
        addEl.innerHTML =
          '<button class="btn" onclick="libBackToTaskGroups()">'
          +libIcon('back',13,2.2)+(t('lib_back'))+'</button>'
          +'<button class="btn btn-primary" onclick="libOpenTaskModalForGroup(\''+_libOpenTaskGroupId+'\')">'
          +libIcon('plus',14,2.4)+(t('lib_add_task'))+'</button>';
      } else {
        addEl.innerHTML =
          '<button class="btn" onclick="libImportTasksCSV()">'+(isES?'Importar CSV':'Import CSV')+'</button>'
          +'<button class="btn btn-primary" onclick="libNewTaskGroupModal()">'
          +libIcon('plus',14,2.4)+(t('lib_new_group'))+'</button>';
      }
    } else if(_libTab==='layouts'){
      addEl.innerHTML = lib.layouts.length
        ? '<button class="btn btn-primary" onclick="libOpenLayoutWizard()">'
          +libIcon('plus',14,2.4)+(t('lib_new_layout'))+'</button>'
        : '';
    } else if(_libTab==='moodboards') {
      if(_mbOpenFolderId){
        addEl.innerHTML = '<button class="btn" onclick="libMbBackToFolders()">'
          +libIcon('back',13,2.2)+(t('lib_moodboards'))+'</button>'
          +'<button class="btn btn-primary" onclick="libMoodboardUploadImages(\''+_mbOpenFolderId+'\')">'
          +libIcon('upload',14,2)+(t('lib_upload_images'))+'</button>';
      } else {
        addEl.innerHTML = lib.moodboards.length
          ? '<button class="btn btn-primary" onclick="libCreateMoodboardFolder()">'
            +libIcon('plus',14,2.4)+(t('lib_new_moodboard'))+'</button>'
          : '';
      }
    } else {
      addEl.innerHTML =
        '<button class="btn btn-primary" onclick="libSaveModal(\''+_libTab+'\')">'
        +libIcon('plus',14,2.4)+t(addMap[_libTab]||'lib_save_to')+'</button>';
    }
  }

  var el = document.getElementById('lib-content');
  if(!el) return;

  var body='';
  switch(_libTab){
    case 'index':       body = renderLibIndex(lib); break;
    case 'vendors':     body = renderLibVendorSets(lib); break;
    case 'tasks':       body = renderLibTaskGroups(lib); break;
    case 'layouts':     body = renderLibLayouts(lib); break;
    case 'tables':      body = renderLibTypes(lib,'tables'); break;
    case 'elements':    body = renderLibTypes(lib,'elements'); break;
    case 'chairs':      body = renderLibTypes(lib,'chairs'); break;
    case 'centerpieces':body = renderLibTypes(lib,'centerpieces'); break;
    case 'moodboards':  body = renderLibMoodboards(lib); break;
    default:            body = renderLibVendorSets(lib); break;
  }
  el.innerHTML = libTabsHTML(lib) + body;
}

function setLibTab(key){ _libTab=key; _mbOpenFolderId=null; _libOpenVendorGroupId=null; _libOpenTaskGroupId=null; renderLibrary(); }

// ── Utilidades compartidas de la biblioteca ─────────────────────────────
// Rejillas de columnas: el MISMO valor debe usarse en .rd-thead y en .rd-row.
var LIB_GRID_VG   = '34px minmax(190px,1.7fr) 96px minmax(150px,1.3fr) 112px 158px';
var LIB_GRID_V    = '34px minmax(200px,1.6fr) minmax(160px,1.2fr) minmax(170px,1.3fr) 118px 190px';
var LIB_GRID_TG   = '34px minmax(190px,1.6fr) 84px minmax(180px,1.5fr) 112px 158px';
var LIB_GRID_T    = '34px minmax(200px,1.7fr) minmax(180px,1.5fr) 104px minmax(140px,1fr) 190px';
var LIB_GRID_GT   = '34px minmax(200px,1.7fr) minmax(180px,1.5fr) 104px minmax(140px,1fr) 190px';
var LIB_GRID_MB   = '34px minmax(200px,1.9fr) 104px 104px 118px 190px';

/** Color seguro para un atributo style: solo hex / rgb() / hsl(). */
function libColor(c, fallback){
  var s=String(c==null?'':c).trim();
  return /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/.test(s) ? s : (fallback||'var(--hairline)');
}

/** Boton de icono de fila (.rd-ibtn). `onclick` ya viene escapado por quien lo arma. */
function libIbtn(icon, onclick, title, danger){
  return '<button type="button" class="rd-ibtn'+(danger?' danger':'')+'" title="'+esc(title||'')+'" onclick="'+onclick+'">'
    +libIcon(icon,13,2)+'</button>';
}
/** Contenedor de acciones alineado a la derecha dentro de una .rd-row. */
function libActions(html){
  return '<div class="lib-actions">'+html+'</div>';
}
/** Casilla de seleccion de fila. */
function libCheck(cls, dataAttrs, onchange, id, title){
  return '<input type="checkbox" class="lib-chk'+(cls?' '+cls:'')+'"'
    +(id?' id="'+id+'"':'')+(dataAttrs||'')
    +(title?' title="'+esc(title)+'"':'')
    +' onchange="'+onchange+'">';
}
/** Buscador con lupa para la barra de herramientas de una .rd-table. */
function libSearchBox(placeholder, oninput, id){
  return '<div class="rd-search">'+libIcon('search',15,2)
    +'<input type="text"'+(id?' id="'+id+'"':'')+' placeholder="'+esc(placeholder)+'" oninput="'+oninput+'">'
    +'</div>';
}
/** Fila "sin resultados" con el ancho completo de la tabla. */
function libNoResults(){
  return '<div class="lib-noresults">'+(LANG==='es'?'Sin resultados':'No results')+'</div>';
}
/** Estado vacio grande y centrado. */
function libEmptyState(iconKey, title, sub, ctaHtml){
  return '<div class="rd-card pad-lg lib-empty">'
    +'<div class="lib-empty-ico">'+libIcon(iconKey,28,1.5)+'</div>'
    +'<h2 class="rd-h2 lib-empty-title">'+esc(title)+'</h2>'
    +'<p class="lib-empty-sub">'+esc(sub)+'</p>'
    +(ctaHtml?'<div class="lib-empty-actions">'+ctaHtml+'</div>':'')
    +'</div>';
}
/** Etiqueta y tono del estado de un proveedor (compartidos con el modulo de presupuesto). */
function libVendorStatus(v){
  var st=(v&&v.vendorStatus)||(v&&v.hired?'hired':'pending');
  var isES=LANG==='es';
  var label=(typeof vendorStatusLabel==='function')
    ? vendorStatusLabel(st)
    : ({pending:isES?'Pendiente':'Pending', hired:isES?'Contratado':'Hired',
        'in-progress':isES?'En Progreso':'In Progress', paid:isES?'Pagado':'Paid',
        cancelled:isES?'Cancelado':'Cancelled'}[st]||(isES?'Pendiente':'Pending'));
  var tone=(typeof vendorStatusTone==='function')
    ? vendorStatusTone(st)
    : ({pending:'neutral', hired:'success', 'in-progress':'warn', paid:'info', cancelled:'danger'}[st]||'neutral');
  return {status:st, label:label, tone:tone};
}
/** "Editado hace 3 dias" a partir de updatedAt (ISO) o de la fecha civil guardada. */
function libEditedLabel(entry){
  var isES=LANG==='es';
  var d=(entry&&entry.updatedAt)?startOfLocalDay(entry.updatedAt):null;
  if(d){
    var todayStart=new Date(); todayStart.setHours(0,0,0,0);
    var n=Math.round((todayStart-d)/86400000);
    if(n<=0)   return isES?'Editado hoy':'Edited today';
    if(n===1)  return isES?'Editado ayer':'Edited yesterday';
    if(n<7)    return isES?('Editado hace '+n+' días'):('Edited '+n+' days ago');
    if(n<30){ var w=Math.round(n/7);  return isES?('Editado hace '+w+' semana'+(w>1?'s':'')):('Edited '+w+' week'+(w>1?'s':'')+' ago'); }
    var m=Math.round(n/30);           return isES?('Editado hace '+m+' mes'+(m>1?'es':'')):('Edited '+m+' month'+(m>1?'s':'')+' ago');
  }
  if(entry&&entry.date) return (isES?'Editado ':'Edited ')+entry.date;
  return isES?'Sin fecha':'No date';
}

function libEmpty(){
  return libEmptyState('cube', t('lib_empty'), t('lib_empty_sub'), '');
}

function libCard(title, subtitle, badge, loadBtn, delKey, delType){
  return '<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:16px 18px;background:#fff;border:1.5px solid var(--border);border-radius:var(--r-lg);margin-bottom:10px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:14px;font-weight:700;margin-bottom:4px">'+esc(title)+'</div>'
    +(subtitle?'<div style="font-size:12px;color:var(--muted)">'+subtitle+'</div>':'')
    +(badge?'<div style="margin-top:6px">'+badge+'</div>':'')
    +'</div>'
    +'<div style="display:flex;gap:6px;flex-shrink:0;align-items:center;margin-left:12px">'
    +(loadBtn||'')
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\''+delType+'\',\''+delKey+'\')">'
    +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></div>';
}
function openLayoutLibraryAndCreate(){
  _libTab = 'layouts';
  openLibrary();
  setTimeout(function(){
    if(typeof setLibTab === "function") setLibTab('layouts');
    if(typeof libOpenLayoutWizard === "function") libOpenLayoutWizard();
  }, 80);
}
window.openLayoutLibraryAndCreate = openLayoutLibraryAndCreate;

function renderLibVendorSets(lib){
  var isES=LANG==='es';
  if(_libOpenVendorGroupId){
    var entry=lib.vendors.find(function(e){return e.id===_libOpenVendorGroupId;});
    if(!entry){ _libOpenVendorGroupId=null; } else { return renderLibVendorGroupDetail(lib,entry,isES); }
  }
  if(!lib.vendors.length){
    return libEmptyState('vendors', t('lib_no_vendor_groups'), t('lib_no_vendor_groups_sub'),
      '<button class="btn btn-primary" onclick="libNewVendorGroupModal()">'
      +libIcon('plus',14,2.4)+esc(t('lib_new_vendor_group'))+'</button>');
  }
  var rows=lib.vendors.map(function(e){ return libVendorGroupRow(e,isES); }).join('');
  return '<div class="rd-table" id="lib-vendor-group-table-wrap">'
    +'<div class="rd-table-tools">'
      +libSearchBox(t('lib_search_groups'),'libSearchVendorGroups(this.value)','lib-vg-search')
      +'<button id="lib-vg-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libLoadSelectedVendorGroups()">'+esc(t('lib_load'))+'</button>'
      +'<button id="lib-vg-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none" onclick="libDeleteSelectedVendorGroups()">'+esc(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:900px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_VG+'">'
        +'<span>'+libCheck('','','libToggleAllVendorGroups(this.checked)','lib-vg-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(t('lib_name_col'))+'</span>'
        +'<span style="text-align:center">'+esc(t('lib_vendors_col'))+'</span>'
        +'<span>'+esc(t('lib_categories_col'))+'</span>'
        +'<span>'+esc(t('lib_date_col'))+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-vg-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function libVendorGroupRow(entry,isES){
  var name=entry.name||t('lib_untitled');
  var list=entry.vendors||[];
  var vCount=list.length;
  var cats={};
  list.forEach(function(v){ if(v.category) cats[v.category]=true; });
  var catNames=Object.keys(cats);
  var catCell=catNames.length
    ? '<div class="lib-pillcell">'+catNames.slice(0,2).map(function(c){ return rdPill(c,'neutral',{sm:true}); }).join('')
      +(catNames.length>2?'<span class="rd-cell-sub">+'+(catNames.length-2)+'</span>':'')+'</div>'
    : '<span class="rd-cell rd-light">—</span>';
  return '<div class="rd-row" style="grid-template-columns:'+LIB_GRID_VG+'">'
    +'<span>'+libCheck('lib-vg-sel',' data-id="'+esc(entry.id)+'"','libUpdateVendorGroupBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'
      +'<span class="rd-avatar">'+esc(rdInitials(entry.name))+'</span>'
      +'<button type="button" class="lib-namebtn" onclick="libOpenVendorGroup(\''+entry.id+'\')">'
        +'<span class="rd-cell-main">'+esc(entry.name)+'</span>'
        +'<span class="rd-cell-sub">'+vCount+' '+esc(isES?'proveedor(es)':'vendor(s)')+'</span>'
      +'</button>'
    +'</div>'
    +'<span class="rd-cell rd-num" style="text-align:center">'+vCount+'</span>'
    +catCell
    +'<span class="rd-cell">'+esc(entry.date||'—')+'</span>'
    +libActions(
      '<button class="btn btn-sm" onclick="libLoadVendors(\''+entry.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit','libRenameVendorGroup(\''+entry.id+'\')',isES?'Editar nombre':'Edit name')
      +libIbtn('trash','libDelete(\'vendors\',\''+entry.id+'\')',isES?'Eliminar':'Delete',true)
    )
    +'</div>';
}
function renderLibVendorGroupDetail(lib,entry,isES){
  var vendors=entry.vendors||[];
  var header='<div class="rd-tab-head lib-detail-head">'
    +'<div class="lib-detail-title">'
      +'<button type="button" class="rd-ibtn" title="'+esc(t('lib_back'))+'" onclick="libBackToVendorGroups()">'+libIcon('back',13,2.2)+'</button>'
      +'<h2 class="rd-h3">'+esc(entry.name)+'</h2>'
      +libIbtn('edit','libRenameVendorGroup(\''+entry.id+'\')',t('lib_rename'))
    +'</div>'
    +'<div class="rd-actions"><span class="rd-hint">'+vendors.length+' '+esc(isES?'proveedor(es)':'vendor(s)')+'</span></div>'
    +'</div>';
  if(!vendors.length){
    return header+libEmptyState('vendors',
      isES?'Organiza todos tus proveedores en un solo lugar.':'Organize all your vendors in one place.',
      isES?'Crea un plan de proveedores para este grupo. El asistente sugiere los proveedores que necesitas según los servicios que requieras.':'Create a vendor plan for this group. The wizard suggests the vendors you need based on the services you require.',
      '<button class="btn btn-primary" onclick="libOpenVendorSetupWizardForGroup(\''+entry.id+'\')">'
      +libIcon('plus',14,2.4)+esc(isES?'Crear plan de proveedores':'Create vendor plan')+'</button>'
      +'<button class="btn" onclick="libOpenVendorModalForGroup(\''+entry.id+'\')">'
      +libIcon('plus',14,2.2)+esc(t('lib_add_vendor'))+'</button>');
  }
  var rows=vendors.map(function(v){ return libVendorRow({entryId:entry.id,v:v},isES); }).join('');
  return header
    +'<div class="rd-table" id="lib-vendor-table-wrap">'
    +'<div class="rd-table-tools">'
      +libSearchBox(isES?'Buscar proveedores...':'Search vendors...','libFilterVendors(this.value)')
      +'<button id="lib-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libBulkLoadToEvent()">'+esc(t('lib_load'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:980px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_V+'">'
        +'<span>'+libCheck('','','libToggleAllVendors(this.checked)','lib-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(isES?'Proveedor':'Vendor')+'</span>'
        +'<span>'+esc(isES?'Contacto':'Contact')+'</span>'
        +'<span>'+esc(isES?'Servicios':'Services')+'</span>'
        +'<span>'+esc(isES?'Estado':'Status')+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-vendor-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function libOpenVendorGroup(id){ _libOpenVendorGroupId=id; renderLibrary(); }
function libBackToVendorGroups(){ _libOpenVendorGroupId=null; renderLibrary(); }
function libUpdateVendorGroupBulkBtn(){
  var n=document.querySelectorAll('.lib-vg-sel:checked').length;
  var total=document.querySelectorAll('.lib-vg-sel').length;
  var btn=document.getElementById('lib-vg-bulk-del-btn');
  if(btn) btn.style.display=n>0?'':'none';
  var loadBtn=document.getElementById('lib-vg-bulk-load-btn');
  if(loadBtn) loadBtn.style.display=n>0?'':'none';
  var all=document.getElementById('lib-vg-chk-all');
  if(all) all.checked=(n>0&&n===total);
}
function libToggleAllVendorGroups(checked){
  document.querySelectorAll('.lib-vg-sel').forEach(function(c){c.checked=checked;});
  libUpdateVendorGroupBulkBtn();
}
function libLoadSelectedVendorGroups(){
  var lib=getLib();
  var ids=Array.from(document.querySelectorAll('.lib-vg-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  var vendors=[];
  ids.forEach(function(id){
    var entry=lib.vendors.find(function(e){return e.id===id;});
    if(entry)(entry.vendors||[]).forEach(function(v){vendors.push(v);});
  });
  if(!vendors.length) return toast(t('lib_groups_empty'),'e');
  libOpenEventPickerModal(vendors);
}
function libDeleteSelectedVendorGroups(){
  var ids=Array.from(document.querySelectorAll('.lib-vg-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar grupos':'Delete groups',
    message:isES?'¿Eliminar '+ids.length+' grupo(s) seleccionado(s)?':'Delete '+ids.length+' selected group(s)?',
    onConfirm:function(){
      var lib=getLib();
      lib.vendors=lib.vendors.filter(function(e){return ids.indexOf(e.id)===-1;});
      saveLib(lib); renderLibrary();
      toast(isES?'Grupos eliminados':'Groups deleted');
    }
  });
}
function libSearchVendorGroups(q){
  var lib=getLib(); var isES=LANG==='es'; var s=q.trim().toLowerCase();
  var filtered=s===''?lib.vendors:lib.vendors.filter(function(entry){
    if(entry.name.toLowerCase().includes(s)) return true;
    return (entry.vendors||[]).some(function(v){ return [v.name,v.services,v.contact,v.category].some(function(f){return f&&f.toLowerCase().includes(s);}); });
  });
  var el=document.getElementById('lib-vg-rows');
  if(el) el.innerHTML=filtered.length?filtered.map(function(e){ return libVendorGroupRow(e,isES); }).join(''):libNoResults();
  libUpdateVendorGroupBulkBtn();
}
function libNewVendorGroupModal(){
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Nuevo Grupo de Proveedores':'New Vendor Group')+'</div>'
    +'<div class="ig" style="margin-bottom:14px"><label>'+(isES?'Nombre del grupo *':'Group name *')+'</label>'
    +'<input class="input" id="lib-new-vg-name" placeholder="'+(isES?'Ej: Proveedores de Boda':'e.g. Wedding Vendors')+'"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveNewVendorGroup()">'+(isES?'Crear':'Create')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-new-vg-name'); if(el) el.focus(); },80);
}
function libSaveNewVendorGroup(){
  var name=(document.getElementById('lib-new-vg-name')||{}).value||'';
  var isES=LANG==='es';
  if(!name.trim()) return toast(t('lib_enter_name'),'e');
  var lib=getLib(); var id='lvg'+Date.now();
  lib.vendors.push({id:id,name:name.trim(),date:formatDMY(today()),vendors:[]});
  saveLib(lib); closeMo(); _libOpenVendorGroupId=id; renderLibrary();
  toast(isES?'Grupo creado':'Group created','s');
}
function libRenameVendorGroup(entryId){
  var lib=getLib(); var entry=lib.vendors.find(function(e){return e.id===entryId;}); if(!entry) return;
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Renombrar Grupo':'Rename Group')+'</div>'
    +'<div class="ig" style="margin-bottom:14px"><label>'+(t('lib_name_col'))+'</label>'
    +'<input class="input" id="lib-ren-vg-name" value="'+esc(entry.name)+'"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveVendorGroupName(\''+entryId+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-ren-vg-name'); if(el){el.focus();el.select();} },80);
}
function libSaveVendorGroupName(entryId){
  var name=(document.getElementById('lib-ren-vg-name')||{}).value||'';
  var isES=LANG==='es';
  if(!name.trim()) return toast(isES?'El nombre no puede estar vacío':'Name cannot be empty','e');
  var lib=getLib(); var entry=lib.vendors.find(function(e){return e.id===entryId;}); if(!entry) return;
  entry.name=name.trim(); saveLib(lib); closeMo(); renderLibrary();
  toast(isES?'Grupo renombrado':'Group renamed','s');
}
function libOpenVendorModalForGroup(entryId, vid){
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;}); if(!entry) return;
  var v=vid?(entry.vendors||[]).find(function(x){return x.id===vid;}):null;
  var isES=LANG==='es';
  var titleRow=v
    ?'<div class="mo-title">'+(isES?'Editar Proveedor':'Edit Vendor')+'</div>'
    :'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
      +'<div class="mo-title" style="margin:0">'+(isES?'Agregar Proveedor':'Add Vendor')+'</div>'
      +'</div>';
  openMo(titleRow
    +'<div class="form-grid">'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Nombre *':'Name *')+'</label><input class="input" id="lvm-name" value="'+esc((v&&v.name)||'')+'" placeholder="'+(isES?'Nombre del proveedor':'Vendor name')+'"></div>'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Servicios':'Services')+'</label><input class="input" id="lvm-svc" value="'+esc((v&&v.services)||'')+'" placeholder="'+(isES?'Describe los servicios...':'Describe services...')+'"></div>'
    +'<div class="ig"><label>'+(isES?'Email de Contacto':'Contact Email')+'</label><input class="input" id="lvm-email" type="email" value="'+esc((v&&v.contact)||'')+'" placeholder="vendor@email.com"></div>'
    +'<div class="ig"><label>'+(isES?'Teléfono':'Phone')+'</label><input class="input" id="lvm-phone" value="'+esc((v&&v.phone)||'')+'" placeholder="555-0000"></div>'
    +'<div class="ig"><label>'+(isES?'Presupuesto':'Budget')+'</label><input class="input" id="lvm-budget" type="number" value="'+((v&&v.budget)||'')+'" placeholder="0"></div>'
    +'<div class="ig"><label>'+(isES?'Estado':'Status')+'</label><select class="select" id="lvm-hired"><option value="0"'+(!v||!v.hired?' selected':'')+'>'+(isES?'Comparación':'Comparison')+'</option><option value="1"'+((v&&v.hired)?' selected':'')+'>'+(isES?'Contratado':'Hired')+'</option></select></div>'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Notas':'Notes')+'</label><textarea class="textarea" id="lvm-notes" rows="2">'+esc((v&&v.notes)||'')+'</textarea></div>'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveVendorModalToGroup(\''+entryId+'\',\''+(vid||'')+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lvm-name'); if(el) el.focus(); },80);
}
function libSaveVendorModalToGroup(entryId, vid){
  var name=(document.getElementById('lvm-name')||{}).value||'';
  var isES=LANG==='es';
  if(!name.trim()) return toast(isES?'El nombre es requerido':'Name is required','e');
  var lib=getLib(); var entry=lib.vendors.find(function(e){return e.id===entryId;}); if(!entry) return;
  var hiredVal=(document.getElementById('lvm-hired')||{}).value==='1';
  var data={name:name.trim(),services:(document.getElementById('lvm-svc')||{}).value||'',
    contact:(document.getElementById('lvm-email')||{}).value||'',
    phone:(document.getElementById('lvm-phone')||{}).value||'',
    budget:+((document.getElementById('lvm-budget')||{}).value)||0,
    hired:hiredVal,vendorStatus:hiredVal?'hired':'pending',
    notes:(document.getElementById('lvm-notes')||{}).value||''};
  if(vid){
    var v=(entry.vendors||[]).find(function(x){return x.id===vid;});
    if(v) Object.assign(v,data);
  } else {
    data.id='lv'+Date.now(); data.payments=[];
    entry.vendors.push(data);
  }
  saveLib(lib); closeMo(); renderLibrary();
  toast(isES?(vid?'Proveedor actualizado':'Proveedor agregado'):(vid?'Vendor updated':'Vendor added'),'s');
}
function libOpenVendorSetupWizardForGroup(entryId){
  _libVendorWizTargetGroupId = entryId;
  openVendorSetupWizard();
}

function libVendorRow(item, isES){
  var v=item.v;
  var st=libVendorStatus(v);
  var open='libOpenVendorModalForGroup(\''+item.entryId+'\',\''+v.id+'\')';
  return '<div class="rd-row click" style="grid-template-columns:'+LIB_GRID_V+'" onclick="'+open+'">'
    +'<span onclick="event.stopPropagation()">'+libCheck('lib-v-sel',' data-entry="'+esc(item.entryId)+'" data-vid="'+esc(v.id)+'"','libUpdateBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'
      +'<span class="rd-avatar">'+esc(rdInitials(v.name))+'</span>'
      +'<div style="min-width:0">'
        +'<div class="rd-cell-main">'+esc(v.name)+'</div>'
        +(v.category?'<div class="rd-cell-sub">'+esc(v.category)+'</div>':'')
      +'</div>'
    +'</div>'
    +'<span class="rd-cell">'+esc(v.contact||v.phone||'—')+'</span>'
    +'<span class="rd-cell">'+esc(v.services||'—')+'</span>'
    +'<span>'+rdPill(st.label,st.tone,{sm:true,dot:true})+'</span>'
    +'<div onclick="event.stopPropagation()">'+libActions(
      '<button class="btn btn-sm" onclick="libLoadVendorToEvent(\''+item.entryId+'\',\''+v.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit',open,isES?'Editar':'Edit')
      +libIbtn('copy','libDuplicateSingleVendor(\''+item.entryId+'\',\''+v.id+'\')',isES?'Duplicar':'Duplicate')
      +libIbtn('trash','libDeleteSingleVendor(\''+item.entryId+'\',\''+v.id+'\')',isES?'Eliminar':'Delete',true)
    )+'</div>'
    +'</div>';
}
function renderLibVendors(lib){
  var isES=LANG==='es';
  var allV=[];
  lib.vendors.forEach(function(entry){
    (entry.vendors||[]).forEach(function(v){ allV.push({entryId:entry.id, v:v}); });
  });
  if(!allV.length) return libEmpty();
  var rows=allV.map(function(item){ return libVendorRow(item,isES); }).join('');
  return '<div class="rd-table" id="lib-vendor-table-wrap">'
    +'<div class="rd-table-tools">'
      +libSearchBox(isES?'Buscar proveedores...':'Search vendors...','libFilterVendors(this.value)')
      +'<button id="lib-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libBulkLoadToEvent()">'+esc(t('lib_load'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:980px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_V+'">'
        +'<span>'+libCheck('','','libToggleAllVendors(this.checked)','lib-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(isES?'Proveedor':'Vendor')+'</span>'
        +'<span>'+esc(isES?'Contacto':'Contact')+'</span>'
        +'<span>'+esc(isES?'Servicios':'Services')+'</span>'
        +'<span>'+esc(isES?'Estado':'Status')+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-vendor-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function libUpdateBulkBtn(){
  var checked=document.querySelectorAll('.lib-v-sel:checked').length;
  var btn=document.getElementById('lib-bulk-load-btn');
  if(btn) btn.style.display=checked>0?'':'none';
  var all=document.getElementById('lib-chk-all');
  if(all) all.checked=(checked>0 && checked===document.querySelectorAll('.lib-v-sel').length);
}
function libToggleAllVendors(checked){
  document.querySelectorAll('.lib-v-sel').forEach(function(c){c.checked=checked;});
  libUpdateBulkBtn();
}
function libFilterVendors(q){
  var lib=getLib(); var isES=LANG==='es';
  var allV=[];
  if(_libOpenVendorGroupId){
    var entry=lib.vendors.find(function(e){return e.id===_libOpenVendorGroupId;});
    if(entry)(entry.vendors||[]).forEach(function(v){allV.push({entryId:entry.id,v:v});});
  } else {
    lib.vendors.forEach(function(entry){(entry.vendors||[]).forEach(function(v){allV.push({entryId:entry.id,v:v});});});
  }
  var s=q.trim().toLowerCase();
  var filtered=s===''?allV:allV.filter(function(item){
    var v=item.v;
    return [v.name,v.category,v.subcategory,v.services,v.contact,v.notes].some(function(f){return f&&f.toLowerCase().includes(s);});
  });
  var rows=filtered.length?filtered.map(function(item){ return libVendorRow(item,isES); }).join(''):libNoResults();
  var tb=document.getElementById('lib-vendor-rows'); if(tb) tb.innerHTML=rows;
  libUpdateBulkBtn();
}
function libDeleteSingleVendor(entryId, vid){
  openConfirmModal({
    title:LANG==='es'?'Eliminar proveedor':'Delete vendor',
    message:LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm:function(){
      var lib=getLib();
      var entry=lib.vendors.find(function(e){return e.id===entryId;});
      if(!entry) return;
      entry.vendors=entry.vendors.filter(function(v){return v.id!==vid;});
      if(!entry.vendors.length) lib.vendors=lib.vendors.filter(function(e){return e.id!==entryId;});
      saveLib(lib); renderLibrary();
      toast(LANG==='es'?'Proveedor eliminado':'Vendor deleted');
    }
  });
}
function libDuplicateSingleVendor(entryId, vid){
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var v=entry.vendors.find(function(item){return item.id===vid;});
  if(!v) return;
  var copy=JSON.parse(JSON.stringify(v));
  copy.id='lv'+Date.now()+Math.random().toString(36).slice(2,6);
  copy.name=(v.name||'Vendor')+' (Copy)';
  copy.payments=(copy.payments||[]).map(function(pay, idx){
    pay.id='lp'+Date.now()+idx;
    return pay;
  });
  entry.vendors.push(copy);
  saveLib(lib); renderLibrary();
  toast(LANG==='es'?'Proveedor duplicado':'Vendor duplicated','s');
}
function libLoadVendorToEvent(entryId, vid){
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var lv=entry.vendors.find(function(v){return v.id===vid;});
  if(!lv) return;
  libOpenEventPickerModal([lv]);
}
function libBulkLoadToEvent(){
  var lib=getLib();
  var checked=document.querySelectorAll('.lib-v-sel:checked');
  var vendors=[];
  checked.forEach(function(chk){
    var entryId=chk.dataset.entry; var vid=chk.dataset.vid;
    var entry=lib.vendors.find(function(e){return e.id===entryId;});
    if(!entry) return;
    var lv=entry.vendors.find(function(v){return v.id===vid;});
    if(lv) vendors.push(lv);
  });
  if(!vendors.length) return;
  libOpenEventPickerModal(vendors);
}
var _libPendingVendors = [];
function libOpenEventPickerModal(vendors){
  var isES=LANG==='es';
  _libPendingVendors = vendors;
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
  if(!allProjects.length) return toast(isES?'No hay eventos creados':'No events created yet','e');
  var vendorNames=vendors.map(function(v){return esc(v.name);}).join(', ');
  var eventRows=allProjects.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="checkbox" class="ev-pick-chk" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div style="min-width:0">'
      +'<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:1px">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div>'
      +'</div></label>';
  }).join('');
  openMo('<div class="mo-title">'+(isES?'Seleccionar Evento(s)':'Select Event(s)')+'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:12px">'+(isES?'Agregar: ':'Adding: ')+'<strong>'+vendorNames+'</strong></p>'
    +'<div style="position:relative;margin-bottom:10px">'
    +'<svg width="14" height="14" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar evento...':'Search event...')+'" oninput="libFilterEventPicker(this.value)" style="padding-left:32px">'
    +'</div>'
    +'<div id="ev-pick-list" style="max-height:50vh;overflow-y:auto">'+eventRows+'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libDoAddVendorsToEvents()">'+(isES?'Agregar a Eventos Seleccionados':'Add to Selected Events')+'</button>'
    +'</div>');
}
function libFilterEventPicker(q){
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
  var isES=LANG==='es'; var s=q.trim().toLowerCase();
  var filtered=s===''?allProjects:allProjects.filter(function(p){return [p.name,p.clientName,p.date].some(function(f){return f&&f.toLowerCase().includes(s);});});
  var html=filtered.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="checkbox" class="ev-pick-chk" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  var el=document.getElementById('ev-pick-list'); if(el) el.innerHTML=html;
}
function libDoAddVendorsToEvents(){
  var isES=LANG==='es';
  var vendors=_libPendingVendors||[];
  if(!vendors.length) return;
  var selectedEventIds=Array.from(document.querySelectorAll('.ev-pick-chk:checked')).map(function(c){return c.value;});
  if(!selectedEventIds.length) return toast(isES?'Selecciona al menos un evento':'Select at least one event','e');
  var all=uproj(); var totalAdded=0;
  selectedEventIds.forEach(function(pid){
    var p=all[pid]; if(!p) return;
    if(!p.vendors) p.vendors=[];
    vendors.forEach(function(lv){
      var exists=p.vendors.some(function(v){return v.name.toLowerCase()===lv.name.toLowerCase();});
      if(!exists){
        var nv=JSON.parse(JSON.stringify(lv));
        nv.id='v'+Date.now()+Math.random().toString(36).slice(2,6);
        nv.payments=nv.payments||[];
        p.vendors.push(nv);
        saveProj(p);
        totalAdded++;
      }
    });
  });
  _libPendingVendors=[];
  closeMo();
  toast((isES?totalAdded+' proveedor(es) agregado(s) a '+selectedEventIds.length+' evento(s)':totalAdded+' vendor(s) added to '+selectedEventIds.length+' event(s)'),'s');
  if(typeof renderBudget==='function' && typeof CTAB!=='undefined' && CTAB==='budget') renderBudget();
}
function libEditGlobalVendor(entryId, vid){
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var v=entry.vendors.find(function(v){return v.id===vid;});
  if(!v) return;
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Editar Proveedor':'Edit Vendor')+'</div>'
    +'<div class="form-grid">'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Nombre *':'Name *')+'</label><input class="input" id="elv-name" value="'+esc(v.name||'')+'" placeholder="'+(isES?'Nombre del proveedor':'Vendor name')+'"></div>'
    
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Servicios':'Services')+'</label><input class="input" id="elv-svc" value="'+esc(v.services||'')+'" placeholder="'+(isES?'Describe los servicios...':'Describe services...')+'"></div>'
    +'<div class="ig"><label>'+(isES?'Email de Contacto':'Contact Email')+'</label><input class="input" id="elv-email" type="email" value="'+esc(v.contact||'')+'" placeholder="vendor@email.com"></div>'
    +'<div class="ig"><label>'+(isES?'Teléfono':'Phone')+'</label><input class="input" id="elv-phone" value="'+esc(v.phone||'')+'" placeholder="555-0000"></div>'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Notas':'Notes')+'</label><textarea class="textarea" id="elv-notes" rows="2">'+esc(v.notes||'')+'</textarea></div>'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveEditGlobalVendor(\''+entryId+'\',\''+vid+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
}
function libSaveEditGlobalVendor(entryId, vid){
  var name=(document.getElementById('elv-name')||{}).value||'';
  if(!name) return toast(LANG==='es'?'El nombre es requerido':'Name is required','e');
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var v=entry.vendors.find(function(v){return v.id===vid;});
  if(!v) return;
  v.name=(document.getElementById('elv-name')||{}).value||v.name;
  
  v.services=(document.getElementById('elv-svc')||{}).value||'';
  v.contact=(document.getElementById('elv-email')||{}).value||'';
  v.phone=(document.getElementById('elv-phone')||{}).value||'';
  v.notes=(document.getElementById('elv-notes')||{}).value||'';
  entry.name=v.name;
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Proveedor actualizado':'Vendor updated','s');
}
function libAddGlobalVendor(){
  var isES=LANG==='es';
  openMo('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
    +'<div class="mo-title" style="margin:0">'+(isES?'Agregar Proveedor':'Add Vendor')+'</div>'
    +'</div>'
    +'<div class="form-grid">'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Nombre *':'Name *')+'</label><input class="input" id="glv-name" placeholder="'+( isES?'Nombre del proveedor':'Vendor name')+'"></div>'
    +'<div class="ig" style="grid-column:1/-1"><label>'+(isES?'Servicios':'Services')+'</label><input class="input" id="glv-svc" placeholder="'+(isES?'Describe los servicios...':'Describe services...')+'"></div>'
    +'<div class="ig"><label>'+(isES?'Email de Contacto':'Contact Email')+'</label><input class="input" id="glv-email" type="email" placeholder="vendor@email.com"></div>'
    +'<div class="ig"><label>'+(isES?'Teléfono':'Phone')+'</label><input class="input" id="glv-phone" placeholder="555-0000"></div>'
    +'<div class="ig"><label>'+(isES?'Notas':'Notes')+'</label><input class="input" id="glv-notes"></div>'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveGlobalVendor()">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
}
function libSaveGlobalVendor(){
  var name=(document.getElementById('glv-name')||{}).value||'';
  if(!name) return toast(LANG==='es'?'El nombre es requerido':'Name is required','e');
  var v={id:'glv'+Date.now(),name:name,category:'',subcategory:'',services:(document.getElementById('glv-svc')||{}).value||'',contact:(document.getElementById('glv-email')||{}).value||'',phone:(document.getElementById('glv-phone')||{}).value||'',notes:(document.getElementById('glv-notes')||{}).value||'',hired:false,vendorStatus:'pending',budget:0,payments:[]};
  var lib=getLib();
  lib.vendors.push({id:'lv'+Date.now(),name:v.name,date:formatDMY(today()),vendors:[v]});
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Proveedor guardado':'Vendor saved','s');
}
function libDownloadVendorTemplate(){
  var csv='Vendor Name,Services,Contact Email,Phone,Budget,Status,Notes\n'
    +'"ABC Catering","Catering, Food & Beverage","contact@abccatering.com","555-1234","5000","pending","Full service catering"\n'
    +'"City AV","AV / Lighting / Production","info@cityav.com","555-5678","3500","hired",""\n'
    +'"Studio Lens","Photography","hello@studiolens.com","","2000","","Wedding and event photography"\n';
  var blob=new Blob([csv],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='vendor_template.csv'; a.click();
}
function libImportCSV(){
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Importar Proveedores CSV':'Import Vendors CSV')+'</div>'
    +'<p style="font-size:13px;color:var(--muted);margin-bottom:14px">'+(isES?'Sube un archivo CSV o Excel con los proveedores. Usa la plantilla descargable para el formato correcto.':'Upload a CSV or Excel file with vendors. Use the downloadable template for the correct format.')+'</p>'
    +'<div class="upload-area" onclick="document.getElementById(\'csv-file-input\').click()" style="margin-bottom:14px">'
    +'<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 8px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
    +'<p style="font-size:13px">'+(isES?'Haz clic para seleccionar archivo CSV/Excel':'Click to select CSV/Excel file')+'</p>'
    +'<p id="csv-file-name" style="font-size:11px;color:var(--gold-h);margin-top:4px"></p>'
    +'</div>'
    +'<input type="file" id="csv-file-input" accept=".csv,.xlsx,.xls" class="hidden" onchange="libPreviewCSV(this)">'
    +'<div id="csv-preview"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" id="csv-import-btn" style="display:none" onclick="libDoImportCSV()">'+(isES?'Importar':'Import')+'</button>'
    +'</div>');
}
var _csvParsed=[];
function libPreviewCSV(input){
  var file=input.files[0]; if(!file) return;
  var isES=LANG==='es';
  document.getElementById('csv-file-name').textContent=file.name;
  var ext=file.name.split('.').pop().toLowerCase();
  if(ext==='csv'){
    var reader=new FileReader();
    reader.onload=function(e){
      _csvParsed=parseCsvToVendors(e.target.result);
      showCsvPreview(_csvParsed);
    };
    reader.readAsText(file);
  } else if(ext==='xlsx'||ext==='xls'){
    var reader=new FileReader();
    reader.onload=async function(e){
      try{
        if(typeof XLSX === 'undefined' && typeof ensureXLSX === 'function') await ensureXLSX();
        var wb=XLSX.read(e.target.result,{type:'binary'});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var csv=XLSX.utils.sheet_to_csv(ws);
        _csvParsed=parseCsvToVendors(csv);
        showCsvPreview(_csvParsed);
      }catch(err){
        document.getElementById('csv-preview').innerHTML='<p style="color:var(--danger);font-size:12px">'+(isES?'Error al leer el archivo':'Error reading file')+'</p>';
      }
    };
    reader.readAsBinaryString(file);
  }
}
/**
 * Tokenizador CSV conforme a RFC 4180.
 *
 * El parser anterior hacia split('\n') y luego una regex por linea, asi que:
 *  - un campo entrecomillado con salto de linea partia la fila en dos;
 *  - las comillas escapadas ("") quedaban a medias;
 *  - con CRLF colaba un \r al final de cada ultimo campo.
 * Devuelve un array de filas, cada una array de celdas.
 */
function parseCsvRows(text){
  var rows=[], row=[], field='', inQuotes=false;
  // Quita el BOM que Excel pone al inicio de los CSV que exporta.
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(inQuotes){
      if(ch === '"'){
        if(text[i+1] === '"'){ field+='"'; i++; }   // comilla escapada
        else inQuotes=false;
      } else field+=ch;
      continue;
    }
    if(ch === '"'){ inQuotes=true; continue; }
    if(ch === ','){ row.push(field); field=''; continue; }
    if(ch === '\r'){ if(text[i+1] === '\n') i++; rows.push(row.concat(field)); row=[]; field=''; continue; }
    if(ch === '\n'){ rows.push(row.concat(field)); row=[]; field=''; continue; }
    field+=ch;
  }
  if(field !== '' || row.length) rows.push(row.concat(field));
  // Descarta filas totalmente vacias (linea final, separadores sueltos).
  return rows.filter(function(r){ return r.some(function(c){ return String(c).trim() !== ''; }); });
}

function parseCsvToVendors(csvText){
  var rows=parseCsvRows(String(csvText||''));
  if(rows.length<2) return [];
  var headers=rows[0].map(function(h){return String(h||'').trim().toLowerCase();});
  var validStatuses=['pending','hired','in-progress','paid','cancelled'];
  var results=[];
  for(var i=1;i<rows.length;i++){
    var cols=rows[i].map(function(c){return String(c==null?'':c).trim();});
    var obj={};
    headers.forEach(function(h,idx){obj[h]=cols[idx]||'';});
    // Accept both old 'name' header and new 'vendor name' header
    var name=obj['vendor name']||obj['name']||obj['nombre']||'';
    if(!name) continue;
    var rawStatus=(obj['status']||obj['estado']||'').toLowerCase().trim();
    var vendorStatus=validStatuses.indexOf(rawStatus)>-1?rawStatus:'pending';
    results.push({
      id:'csv'+Date.now()+i,
      name:name,
      category:obj['category']||obj['categoría']||obj['categoria']||'',
      subcategory:obj['subcategory']||obj['subcategoría']||obj['subcategoria']||'',
      services:obj['services']||obj['servicios']||'',
      contact:obj['contact email']||obj['email']||obj['contacto']||'',
      phone:obj['phone']||obj['teléfono']||obj['telefono']||'',
      budget:Number(obj['budget']||obj['presupuesto']||0)||0,
      vendorStatus:vendorStatus,
      hired:vendorStatus==='hired'||vendorStatus==='in-progress'||vendorStatus==='paid',
      notes:obj['notes']||obj['notas']||'',
      payments:[]
    });
  }
  return results;
}
function showCsvPreview(vendors){
  var isES=LANG==='es';
  var box=document.getElementById('csv-preview');
  if(!box) return;
  if(!vendors.length){
    box.innerHTML='<p class="lib-csv-err">'+esc(isES?'No se encontraron proveedores válidos':'No valid vendors found')+'</p>';
    return;
  }
  var grid='34px minmax(140px,1.4fr) minmax(140px,1.4fr)';
  var rows=vendors.slice(0,5).map(function(v){
    return '<div class="rd-row lib-csv-row" style="grid-template-columns:'+grid+'">'
      +'<span class="rd-avatar round">'+esc(rdInitials(v.name))+'</span>'
      +'<span class="rd-cell-main">'+esc(v.name)+'</span>'
      +'<span class="rd-cell">'+esc(v.services||v.contact||'—')+'</span>'
      +'</div>';
  }).join('');
  box.innerHTML=
    '<div class="rd-label lib-csv-head">'+esc(isES?'Vista previa':'Preview')+' · '+vendors.length+' '+esc(isES?'proveedores':'vendors')+'</div>'
    +'<div class="rd-table lib-csv-table">'
      +'<div class="rd-thead" style="grid-template-columns:'+grid+'">'
        +'<span></span><span>'+esc(t('lib_name_col'))+'</span><span>'+esc(isES?'Servicios':'Services')+'</span>'
      +'</div>'
      +'<div class="lib-csv-scroll">'+rows+'</div>'
    +'</div>';
  var btn=document.getElementById('csv-import-btn');
  if(btn) btn.style.display='';
}
function libDoImportCSV(){
  if(!_csvParsed.length) return;
  var lib=getLib();
  var added=0;
  _csvParsed.forEach(function(v){
    var exists=lib.vendors.some(function(e){return e.vendors&&e.vendors.some(function(lv){return lv.name.toLowerCase()===v.name.toLowerCase();});});
    if(!exists){
      lib.vendors.push({id:'lv'+Date.now()+added,name:v.name,date:formatDMY(today()),vendors:[JSON.parse(JSON.stringify(v))]});
      added++;
    }
  });
  saveLib(lib); closeMo(); renderLibrary();
  toast((LANG==='es'?added+' proveedores importados':added+' vendors imported'),'s');
}

function renderLibTasks(lib){
  if(!lib.tasks.length) return libEmpty();
  return lib.tasks.map(function(entry){
    var sub = entry.tasks.length+' '+(LANG==='es'?'tarea(s)':'task(s)')+' · '+entry.date;
    var done = entry.tasks.filter(function(tk){return tk.done;}).length;
    var badge = '<span class="badge b-purple">'+done+'/'+entry.tasks.length+' '+(LANG==='es'?'completadas':'done')+'</span>';
    var loadBtn = proj()?'<button class="btn btn-primary btn-sm" onclick="libLoadTasks(\''+entry.id+'\')">'+(LANG==='es'?'CARGAR':'LOAD')+'</button>':'';
    return libCard(entry.name, sub, badge, loadBtn, entry.id, 'tasks');
  }).join('');
}
function libTaskRow(tk, isES){
  var clr=tk.color||'#7c3aed';
  return '<div class="rd-row" style="grid-template-columns:'+LIB_GRID_T+'">'
    +'<span>'+libCheck('lib-gt-sel',' data-tid="'+esc(tk.id)+'"','libUpdateTaskBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'
      +'<span class="lib-dot" style="background:'+libColor(clr,'#7c3aed')+'"></span>'
      +'<span class="rd-cell-main">'+esc(tk.title)+'</span>'
    +'</div>'
    +'<span class="rd-cell">'+esc(tk.desc||'—')+'</span>'
    +'<span class="rd-cell rd-num">'+(tk.durationDays?tk.durationDays+(isES?' días':' days'):'—')+'</span>'
    +'<span class="rd-cell">'+esc(tk.assignee||'—')+'</span>'
    +libActions(
      '<button class="btn btn-sm" onclick="libLoadTaskToEvent(\''+tk.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit','libEditGlobalTask(\''+tk.id+'\')',isES?'Editar':'Edit')
      +libIbtn('copy','libDuplicateGlobalTask(\''+tk.id+'\')',isES?'Duplicar':'Duplicate')
      +libIbtn('trash','libDeleteGlobalTask(\''+tk.id+'\')',isES?'Eliminar':'Delete',true)
    )
    +'</div>';
}
function renderLibGlobalTasks(lib){
  if(!lib.globalTasks) lib.globalTasks=[];
  var isES=LANG==='es';
  var tasks=lib.globalTasks;
  if(!tasks.length) return libEmpty();
  var rows=tasks.map(function(tk){ return libTaskRow(tk,isES); }).join('');
  return '<div class="rd-table">'
    +'<div class="rd-table-tools">'
      +libSearchBox(isES?'Buscar tareas...':'Search tasks...','libFilterTasks(this.value)')
      +'<button id="lib-task-bulk-btn" class="btn btn-sm" style="display:none" onclick="libBulkLoadTasksToEvent()">'
        +esc(isES?'Cargar seleccionadas a evento':'Load selected into event')+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:980px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_T+'">'
        +'<span>'+libCheck('','','libToggleAllTasks(this.checked)','lib-task-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(isES?'Tarea':'Task')+'</span>'
        +'<span>'+esc(isES?'Descripción':'Description')+'</span>'
        +'<span>'+esc(isES?'Duración':'Duration')+'</span>'
        +'<span>'+esc(isES?'Asignado a':'Assignee')+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-task-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function renderLibTaskGroups(lib){
  if(!lib.tasks) lib.tasks=[];
  var isES=LANG==='es';
  if(_libOpenTaskGroupId){
    var entry=lib.tasks.find(function(e){return e.id===_libOpenTaskGroupId;});
    if(!entry){ _libOpenTaskGroupId=null; } else { return renderLibTaskGroupDetail(lib,entry,isES); }
  }
  var groups=lib.tasks;
  if(!groups.length){
    return libEmptyState('tasks',
      isES?'No hay grupos de tareas guardados':'No task groups saved yet',
      isES?'Crea un nuevo grupo para organizar tus tareas reutilizables.':'Create a new group to organize your reusable tasks.',
      '<button class="btn btn-primary" onclick="libNewTaskGroupModal()">'
      +libIcon('plus',14,2.4)+esc(isES?'Nuevo grupo de tareas':'New task group')+'</button>');
  }
  var rows=groups.map(function(e){ return libTaskGroupRow(e,isES); }).join('');
  return '<div class="rd-table">'
    +'<div class="rd-table-tools">'
      +libSearchBox(isES?'Buscar grupos o tareas...':'Search groups or tasks...','libSearchTaskGroups(this.value)','lib-tg-search')
      +'<button id="lib-tg-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libLoadSelectedTaskGroups()">'+esc(t('lib_load'))+'</button>'
      +'<button id="lib-tg-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none" onclick="libDeleteSelectedTaskGroups()">'+esc(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:900px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_TG+'">'
        +'<span>'+libCheck('','','libToggleAllTaskGroups(this.checked)','lib-tg-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(t('lib_name_col'))+'</span>'
        +'<span style="text-align:center">'+esc(isES?'Tareas':'Tasks')+'</span>'
        +'<span>'+esc(isES?'Vista previa':'Preview')+'</span>'
        +'<span>'+esc(t('lib_date_col'))+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-tg-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function libTaskGroupRow(entry,isES){
  var name=entry.name||t('lib_untitled');
  var list=entry.tasks||[];
  var taskCount=list.length;
  var done=list.filter(function(tk){return tk.done;}).length;
  var preview=list.slice(0,3).map(function(tk){return esc(tk.title||'');}).join(', ')+(taskCount>3?' +'+(taskCount-3):'');
  return '<div class="rd-row" style="grid-template-columns:'+LIB_GRID_TG+'">'
    +'<span>'+libCheck('lib-tg-sel',' data-id="'+esc(entry.id)+'"','libUpdateTaskGroupBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'
      +'<span class="rd-avatar">'+esc(rdInitials(entry.name))+'</span>'
      +'<button type="button" class="lib-namebtn" onclick="libOpenTaskGroup(\''+entry.id+'\')">'
        +'<span class="rd-cell-main">'+esc(entry.name)+'</span>'
        +'<span class="rd-cell-sub">'+done+'/'+taskCount+' '+esc(isES?'completadas':'done')+'</span>'
      +'</button>'
    +'</div>'
    +'<span class="rd-cell rd-num" style="text-align:center">'+taskCount+'</span>'
    +'<span class="rd-cell">'+(preview||'—')+'</span>'
    +'<span class="rd-cell">'+esc(entry.date||'—')+'</span>'
    +libActions(
      '<button class="btn btn-sm" onclick="libLoadTasks(\''+entry.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit','libRenameTaskGroup(\''+entry.id+'\')',isES?'Editar nombre':'Edit name')
      +libIbtn('trash','libDelete(\'tasks\',\''+entry.id+'\')',isES?'Eliminar':'Delete',true)
    )
    +'</div>';
}
function renderLibTaskGroupDetail(lib,entry,isES){
  var tasks=entry.tasks||[];
  var header='<div class="rd-tab-head lib-detail-head">'
    +'<div class="lib-detail-title">'
      +'<button type="button" class="rd-ibtn" title="'+esc(t('lib_back'))+'" onclick="libBackToTaskGroups()">'+libIcon('back',13,2.2)+'</button>'
      +'<h2 class="rd-h3">'+esc(entry.name)+'</h2>'
      +libIbtn('edit','libRenameTaskGroup(\''+entry.id+'\')',t('lib_rename'))
    +'</div>'
    +'<div class="rd-actions"><span class="rd-hint">'+tasks.length+' '+esc(isES?'tarea(s)':'task(s)')+'</span></div>'
    +'</div>';
  if(!tasks.length){
    return header+libEmptyState('tasks',
      isES?'Comienza con un plan maestro listo para trabajar.':'Start with a master plan that is ready to work from.',
      isES?'Crea una plantilla completa de planificación para este grupo. Después podrás editar cada tarea, responsable y duración como quieras.':'Create a full planning template for this group. After that, you can edit every task, assignee and duration however you like.',
      '<button class="btn btn-primary" onclick="libOpenTemplatePlanWizardForGroup(\''+entry.id+'\')">'
      +libIcon('plus',14,2.4)+esc(isES?'Crear plan de plantilla':'Create template plan')+'</button>'
      +'<button class="btn" onclick="libOpenTaskModalForGroup(\''+entry.id+'\')">'
      +libIcon('plus',14,2.2)+esc(t('lib_add_task'))+'</button>');
  }
  var rows=tasks.map(function(tk){ return libGroupTaskRow(entry.id,tk,isES); }).join('');
  return header
    +'<div class="rd-table" id="lib-task-table-wrap">'
    +'<div class="rd-table-tools">'
      +libSearchBox(isES?'Buscar tareas...':'Search tasks...','libFilterGroupTasks(\''+entry.id+'\',this.value)')
      +'<button id="lib-gtg-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libBulkLoadGroupTasksToEvent(\''+entry.id+'\')">'+esc(t('lib_load'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:980px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_GT+'">'
        +'<span>'+libCheck('','','libToggleAllGroupTasks(this.checked)','lib-gtg-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(isES?'Tarea':'Task')+'</span>'
        +'<span>'+esc(isES?'Descripción':'Description')+'</span>'
        +'<span>'+esc(isES?'Duración':'Duration')+'</span>'
        +'<span>'+esc(isES?'Asignado a':'Assignee')+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-gtg-task-rows">'+rows+'</div>'
    +'</div></div></div>';
}
function libGroupTaskRow(entryId,tk,isES){
  var clr=tk.color||'#7c3aed';
  var open='libOpenTaskModalForGroup(\''+entryId+'\',\''+tk.id+'\')';
  return '<div class="rd-row click" style="grid-template-columns:'+LIB_GRID_GT+'" onclick="'+open+'">'
    +'<span onclick="event.stopPropagation()">'+libCheck('lib-gtg-sel',' data-entry="'+esc(entryId)+'" data-tid="'+esc(tk.id)+'"','libUpdateGroupTaskBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'
      +'<span class="lib-dot" style="background:'+libColor(clr,'#7c3aed')+'"></span>'
      +'<span class="rd-cell-main">'+esc(tk.title)+'</span>'
    +'</div>'
    +'<span class="rd-cell">'+esc(tk.desc||'—')+'</span>'
    +'<span class="rd-cell rd-num">'+(tk.durationDays?tk.durationDays+(isES?' días':' days'):'—')+'</span>'
    +'<span class="rd-cell">'+esc(tk.assignee||'—')+'</span>'
    +'<div onclick="event.stopPropagation()">'+libActions(
      '<button class="btn btn-sm" onclick="libLoadGroupTaskToEvent(\''+entryId+'\',\''+tk.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit',open,isES?'Editar':'Edit')
      +libIbtn('trash','libDeleteGroupTask(\''+entryId+'\',\''+tk.id+'\')',isES?'Eliminar':'Delete',true)
    )+'</div>'
    +'</div>';
}
function libOpenTaskGroup(id){ _libOpenTaskGroupId=id; renderLibrary(); }
function libBackToTaskGroups(){ _libOpenTaskGroupId=null; renderLibrary(); }
function libUpdateTaskGroupBulkBtn(){
  var n=document.querySelectorAll('.lib-tg-sel:checked').length;
  var total=document.querySelectorAll('.lib-tg-sel').length;
  var btn=document.getElementById('lib-tg-bulk-del-btn');
  if(btn) btn.style.display=n>0?'':'none';
  var loadBtn=document.getElementById('lib-tg-bulk-load-btn');
  if(loadBtn) loadBtn.style.display=n>0?'':'none';
  var all=document.getElementById('lib-tg-chk-all');
  if(all) all.checked=(n>0&&n===total);
}
function libToggleAllTaskGroups(checked){
  document.querySelectorAll('.lib-tg-sel').forEach(function(c){c.checked=checked;});
  libUpdateTaskGroupBulkBtn();
}
function libLoadSelectedTaskGroups(){
  var lib=getLib();
  var ids=Array.from(document.querySelectorAll('.lib-tg-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  var tasks=[];
  ids.forEach(function(id){
    var entry=(lib.tasks||[]).find(function(e){return e.id===id;});
    if(entry)(entry.tasks||[]).forEach(function(tk){tasks.push(tk);});
  });
  if(!tasks.length) return toast(t('lib_groups_empty'),'e');
  libOpenTaskEventPickerModal(tasks);
}
function libUpdateGroupTaskBulkBtn(){
  var n=document.querySelectorAll('.lib-gtg-sel:checked').length;
  var btn=document.getElementById('lib-gtg-bulk-load-btn');
  if(btn) btn.style.display=n>0?'':'none';
  var all=document.getElementById('lib-gtg-chk-all');
  if(all) all.checked=(n>0&&n===document.querySelectorAll('.lib-gtg-sel').length);
}
function libToggleAllGroupTasks(checked){
  document.querySelectorAll('.lib-gtg-sel').forEach(function(c){c.checked=checked;});
  libUpdateGroupTaskBulkBtn();
}
function libDeleteSelectedTaskGroups(){
  var ids=Array.from(document.querySelectorAll('.lib-tg-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar grupos':'Delete groups',
    message:isES?'¿Eliminar '+ids.length+' grupo(s) seleccionado(s)?':'Delete '+ids.length+' selected group(s)?',
    onConfirm:function(){
      var lib=getLib();
      lib.tasks=lib.tasks.filter(function(e){return ids.indexOf(e.id)===-1;});
      saveLib(lib); renderLibrary();
      toast(isES?'Grupos eliminados':'Groups deleted');
    }
  });
}
function libSearchTaskGroups(q){
  var lib=getLib(); var isES=LANG==='es'; var s=q.trim().toLowerCase();
  var filtered=s===''?lib.tasks:lib.tasks.filter(function(entry){
    if(entry.name.toLowerCase().includes(s)) return true;
    return (entry.tasks||[]).some(function(tk){ return [tk.title,tk.desc,tk.assignee].some(function(f){return f&&f.toLowerCase().includes(s);}); });
  });
  var el=document.getElementById('lib-tg-rows');
  if(el) el.innerHTML=filtered.length?filtered.map(function(e){ return libTaskGroupRow(e,isES); }).join(''):libNoResults();
  libUpdateTaskGroupBulkBtn();
}
function libNewTaskGroupModal(){
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Nuevo Grupo de Tareas':'New Task Group')+'</div>'
    +'<div class="ig" style="margin-bottom:14px"><label>'+(isES?'Nombre del grupo *':'Group name *')+'</label>'
    +'<input class="input" id="lib-new-tg-name" placeholder="'+(isES?'Ej: Tareas de Boda':'e.g. Wedding Tasks')+'"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveNewTaskGroup()">'+(isES?'Crear':'Create')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-new-tg-name'); if(el) el.focus(); },80);
}
function libSaveNewTaskGroup(){
  var name=(document.getElementById('lib-new-tg-name')||{}).value||'';
  var isES=LANG==='es';
  if(!name.trim()) return toast(t('lib_enter_name'),'e');
  var lib=getLib(); var id='ltg'+Date.now();
  lib.tasks.push({id:id,name:name.trim(),date:formatDMY(today()),tasks:[]});
  saveLib(lib); closeMo(); _libOpenTaskGroupId=id; renderLibrary();
  toast(isES?'Grupo creado':'Group created','s');
}
function libRenameTaskGroup(entryId){
  var lib=getLib(); var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Renombrar Grupo':'Rename Group')+'</div>'
    +'<div class="ig" style="margin-bottom:14px"><label>'+(t('lib_name_col'))+'</label>'
    +'<input class="input" id="lib-ren-tg-name" value="'+esc(entry.name)+'"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveTaskGroupName(\''+entryId+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-ren-tg-name'); if(el){el.focus();el.select();} },80);
}
function libSaveTaskGroupName(entryId){
  var name=(document.getElementById('lib-ren-tg-name')||{}).value||'';
  var isES=LANG==='es';
  if(!name.trim()) return toast(isES?'El nombre no puede estar vacío':'Name cannot be empty','e');
  var lib=getLib(); var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  entry.name=name.trim(); saveLib(lib); closeMo(); renderLibrary();
  toast(isES?'Grupo renombrado':'Group renamed','s');
}
function libFilterGroupTasks(entryId,q){
  var lib=getLib(); var isES=LANG==='es';
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var s=q.trim().toLowerCase();
  var filtered=s===''?(entry.tasks||[]):(entry.tasks||[]).filter(function(tk){
    return [tk.title,tk.desc,tk.assignee].some(function(f){return f&&f.toLowerCase().includes(s);});
  });
  var tb=document.getElementById('lib-gtg-task-rows');
  if(tb) tb.innerHTML=filtered.length?filtered.map(function(tk){ return libGroupTaskRow(entryId,tk,isES); }).join(''):libNoResults();
  libUpdateGroupTaskBulkBtn();
}
function libLoadGroupTaskToEvent(entryId,tid){
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var tk=(entry.tasks||[]).find(function(t){return t.id===tid;}); if(!tk) return;
  libOpenTaskEventPickerModal([tk]);
}
function libBulkLoadGroupTasksToEvent(entryId){
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var tasks=[];
  document.querySelectorAll('.lib-gtg-sel:checked').forEach(function(chk){
    var tk=(entry.tasks||[]).find(function(t){return t.id===chk.dataset.tid;});
    if(tk) tasks.push(tk);
  });
  if(!tasks.length) return;
  libOpenTaskEventPickerModal(tasks);
}
function libEditGroupTask(entryId,tid){
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var tk=(entry.tasks||[]).find(function(t){return t.id===tid;}); if(!tk) return;
  var isES=LANG==='es';
  var colors=['#7c3aed','#a67c3d','#10b981','#f59e0b','#ec4899','#ef4444'];
  openMo('<div class="mo-title">'+(isES?'Editar Tarea':'Edit Task')+'</div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Título *':'Title *')+'</label><input class="input" id="egt-title" value="'+esc(tk.title||'')+'"></div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Descripción':'Description')+'</label><textarea class="textarea" id="egt-desc" rows="2">'+esc(tk.desc||'')+'</textarea></div>'
    +'<div class="form-grid" style="margin-bottom:12px">'
    +'<div class="ig"><label>'+(isES?'Duración (días)':'Duration (days)')+'</label><input class="input" id="egt-dur" type="number" min="1" value="'+(tk.durationDays||7)+'"></div>'
    +'<div class="ig"><label>'+(isES?'Asignado a':'Assignee')+'</label><input class="input" id="egt-who" value="'+esc(tk.assignee||'')+'"></div>'
    +'</div>'
    +'<div class="ig" style="margin-bottom:8px"><label>'+(isES?'Color':'Color')+'</label></div>'
    +'<div style="display:flex;gap:10px;margin-bottom:16px">'
    +colors.map(function(cl){ return '<div onclick="libPickTaskColor(this,\''+cl+'\')" data-color="'+cl+'" style="width:28px;height:28px;border-radius:50%;background:'+cl+';cursor:pointer;border:3px solid '+(tk.color===cl?'#000':'transparent')+';transition:all .15s"></div>'; }).join('')
    +'</div>'
    +'<input type="hidden" id="glt-color" value="'+(tk.color||'#7c3aed')+'">'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveEditGroupTask(\''+entryId+'\',\''+tid+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
}
function libSaveEditGroupTask(entryId,tid){
  var title=(document.getElementById('egt-title')||{}).value||'';
  var isES=LANG==='es';
  if(!title.trim()) return toast(isES?'El título es requerido':'Title is required','e');
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var tk=(entry.tasks||[]).find(function(t){return t.id===tid;}); if(!tk) return;
  tk.title=title.trim();
  tk.desc=(document.getElementById('egt-desc')||{}).value||'';
  tk.durationDays=parseInt((document.getElementById('egt-dur')||{}).value)||tk.durationDays||7;
  tk.assignee=(document.getElementById('egt-who')||{}).value||'';
  tk.color=(document.getElementById('glt-color')||{}).value||tk.color;
  saveLib(lib); closeMo(); renderLibrary();
  toast(isES?'Tarea actualizada':'Task updated','s');
}
function libDeleteGroupTask(entryId,tid){
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar tarea':'Delete task',
    message:isES?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm:function(){
      var lib=getLib();
      var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
      entry.tasks=(entry.tasks||[]).filter(function(t){return t.id!==tid;});
      saveLib(lib); renderLibrary();
      toast(isES?'Tarea eliminada':'Task deleted');
    }
  });
}
function libOpenTaskModalForGroup(entryId, tid){
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var tk=tid?(entry.tasks||[]).find(function(x){return x.id===tid;}):null;
  var isES=LANG==='es';
  var colors=['#7c3aed','#a67c3d','#10b981','#f59e0b','#ec4899','#ef4444'];
  openMo('<div class="mo-title">'+(tk?(isES?'Editar Tarea':'Edit Task'):(isES?'Agregar Tarea':'Add Task'))+'</div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Título *':'Title *')+'</label><input class="input" id="ltm-title" value="'+esc((tk&&tk.title)||'')+'" placeholder="'+(isES?'Título de la tarea':'Task title')+'"></div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Descripción':'Description')+'</label><textarea class="textarea" id="ltm-desc" rows="2">'+esc((tk&&tk.desc)||'')+'</textarea></div>'
    +'<div class="form-grid" style="margin-bottom:12px">'
    +'<div class="ig"><label>'+(isES?'Duración (días)':'Duration (days)')+'</label><input class="input" id="ltm-dur" type="number" min="1" value="'+((tk&&tk.durationDays)||7)+'"></div>'
    +'<div class="ig"><label>'+(isES?'Asignado a':'Assignee')+'</label><input class="input" id="ltm-who" value="'+esc((tk&&tk.assignee)||'')+'" placeholder="'+(isES?'Coordinador':'Coordinator')+'"></div>'
    +'</div>'
    +'<div class="form-grid" style="margin-bottom:12px">'
    +'<div class="ig"><label>'+(isES?'Fase':'Phase')+'</label><input class="input" id="ltm-phase" value="'+esc((tk&&tk.phase)||'')+'" placeholder="Strategy & Budget"></div>'
    +'<div class="ig"><label>'+(isES?'Ventana de planificación':'Planning window')+'</label><input class="input" id="ltm-window" value="'+esc((tk&&tk.planningWindow)||'')+'" placeholder="'+(isES?'6 meses antes':'6 months before')+'"></div>'
    +'</div>'
    +'<div class="ig" style="margin-bottom:4px"><label>'+(isES?'Color':'Color')+'</label></div>'
    +'<div style="display:flex;gap:10px;margin-bottom:16px">'
    +colors.map(function(cl){ return '<div onclick="libPickTaskColor(this,\''+cl+'\')" data-color="'+cl+'" style="width:28px;height:28px;border-radius:50%;background:'+cl+';cursor:pointer;border:3px solid '+((tk&&tk.color||colors[0])===cl?'#000':'transparent')+';transition:all .15s"></div>'; }).join('')
    +'</div>'
    +'<input type="hidden" id="glt-color" value="'+((tk&&tk.color)||colors[0])+'">'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveTaskModalToGroup(\''+entryId+'\',\''+(tid||'')+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('ltm-title'); if(el) el.focus(); },80);
}
function libSaveTaskModalToGroup(entryId, tid){
  var title=(document.getElementById('ltm-title')||{}).value||'';
  var isES=LANG==='es';
  if(!title.trim()) return toast(isES?'El título es requerido':'Title is required','e');
  var lib=getLib(); var entry=lib.tasks.find(function(e){return e.id===entryId;}); if(!entry) return;
  var data={title:title.trim(),
    desc:(document.getElementById('ltm-desc')||{}).value||'',
    durationDays:parseInt((document.getElementById('ltm-dur')||{}).value)||7,
    assignee:(document.getElementById('ltm-who')||{}).value||'',
    phase:(document.getElementById('ltm-phase')||{}).value||'',
    planningWindow:(document.getElementById('ltm-window')||{}).value||'',
    color:(document.getElementById('glt-color')||{}).value||'#7c3aed',
    dueDate:'',startDate:'',done:false,status:'not-started'};
  if(tid){
    var tk=(entry.tasks||[]).find(function(t){return t.id===tid;});
    if(tk) Object.assign(tk,data);
  } else {
    data.id='gt'+Date.now();
    entry.tasks.push(data);
  }
  saveLib(lib); closeMo(); renderLibrary();
  toast(isES?(tid?'Tarea actualizada':'Tarea agregada'):(tid?'Task updated':'Task added'),'s');
}
function libOpenTemplatePlanWizardForGroup(entryId){
  _libPlanWizTargetGroupId = entryId;
  if(typeof openTemplatePlanWizardForLib === 'function') openTemplatePlanWizardForLib();
}
function libFilterTasks(q){
  var lib=getLib(); var isES=LANG==='es';
  var tasks=lib.globalTasks||[];
  var s=q.trim().toLowerCase();
  var filtered=s===''?tasks:tasks.filter(function(tk){return [tk.title,tk.desc,tk.assignee].some(function(f){return f&&f.toLowerCase().includes(s);});});
  var rows=filtered.length?filtered.map(function(tk){ return libTaskRow(tk,isES); }).join(''):libNoResults();
  var tb=document.getElementById('lib-task-rows'); if(tb) tb.innerHTML=rows;
  libUpdateTaskBulkBtn();
}
function libUpdateTaskBulkBtn(){
  var checked=document.querySelectorAll('.lib-gt-sel:checked').length;
  var btn=document.getElementById('lib-task-bulk-btn');
  if(btn) btn.style.display=checked>0?'':'none';
  var all=document.getElementById('lib-task-chk-all');
  if(all) all.checked=(checked>0&&checked===document.querySelectorAll('.lib-gt-sel').length);
}
function libToggleAllTasks(checked){
  document.querySelectorAll('.lib-gt-sel').forEach(function(c){c.checked=checked;});
  libUpdateTaskBulkBtn();
}
function libAddGlobalTask(){
  var isES=LANG==='es';
  var colors=['#7c3aed','#a67c3d','#10b981','#f59e0b','#ec4899','#ef4444'];
  openMo('<div class="mo-title">'+(isES?'Agregar Tarea':'Add Task')+'</div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Título *':'Title *')+'</label><input class="input" id="glt-title" placeholder="'+(isES?'Título de la tarea':'Task title')+'"></div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Descripción':'Description')+'</label><textarea class="textarea" id="glt-desc" rows="2" placeholder="'+(isES?'Describe la tarea...':'Describe the task...')+'"></textarea></div>'
    +'<div class="form-grid" style="margin-bottom:12px">'
    +'<div class="ig"><label>'+(isES?'Duración (días)':'Duration (days)')+'</label><input class="input" id="glt-dur" type="number" min="1" value="7" placeholder="7"></div>'
    +'<div class="ig"><label>'+(isES?'Asignado a':'Assignee')+'</label><input class="input" id="glt-who" placeholder="'+(isES?'Coordinador':'Event Coordinator')+'"></div>'
    +'</div>'
    +'<div class="ig" style="margin-bottom:8px"><label>'+(isES?'Color':'Color')+'</label></div>'
    +'<div style="display:flex;gap:10px;margin-bottom:16px">'
    +colors.map(function(cl){ return '<div onclick="libPickTaskColor(this,\''+cl+'\')" data-color="'+cl+'" style="width:28px;height:28px;border-radius:50%;background:'+cl+';cursor:pointer;border:3px solid '+(cl===colors[0]?'#000':'transparent')+';transition:all .15s"></div>'; }).join('')
    +'</div>'
    +'<input type="hidden" id="glt-color" value="'+colors[0]+'">'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveGlobalTask()">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
}
function libPickTaskColor(el,c){
  document.querySelectorAll('#mo-body [data-color]').forEach(function(d){d.style.borderColor='transparent';});
  el.style.borderColor='#000';
  document.getElementById('glt-color').value=c;
}
function libSaveGlobalTask(){
  var title=(document.getElementById('glt-title')||{}).value||'';
  if(!title) return toast(LANG==='es'?'El título es requerido':'Title is required','e');
  var lib=getLib();
  if(!lib.globalTasks) lib.globalTasks=[];
  lib.globalTasks.push({id:'gt'+Date.now(),title:title,desc:(document.getElementById('glt-desc')||{}).value||'',durationDays:parseInt((document.getElementById('glt-dur')||{}).value)||7,dueDate:'',assignee:(document.getElementById('glt-who')||{}).value||'',color:(document.getElementById('glt-color')||{}).value||'#7c3aed',done:false});
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Tarea guardada':'Task saved','s');
}
function libEditGlobalTask(tid){
  var lib=getLib(); var tk=(lib.globalTasks||[]).find(function(t){return t.id===tid;}); if(!tk) return;
  var isES=LANG==='es';
  var colors=['#7c3aed','#a67c3d','#10b981','#f59e0b','#ec4899','#ef4444'];
  openMo('<div class="mo-title">'+(isES?'Editar Tarea':'Edit Task')+'</div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Título *':'Title *')+'</label><input class="input" id="glt-title" value="'+esc(tk.title||'')+'" placeholder="'+(isES?'Título de la tarea':'Task title')+'"></div>'
    +'<div class="ig" style="margin-bottom:12px"><label>'+(isES?'Descripción':'Description')+'</label><textarea class="textarea" id="glt-desc" rows="2">'+esc(tk.desc||'')+'</textarea></div>'
    +'<div class="form-grid" style="margin-bottom:12px">'
    +'<div class="ig"><label>'+(isES?'Duración (días)':'Duration (days)')+'</label><input class="input" id="glt-dur" type="number" min="1" value="'+(tk.durationDays||7)+'" placeholder="7"></div>'
    +'<div class="ig"><label>'+(isES?'Asignado a':'Assignee')+'</label><input class="input" id="glt-who" value="'+esc(tk.assignee||'')+'"></div>'
    +'</div>'
    +'<div class="ig" style="margin-bottom:8px"><label>'+(isES?'Color':'Color')+'</label></div>'
    +'<div style="display:flex;gap:10px;margin-bottom:16px">'
    +colors.map(function(cl){ return '<div onclick="libPickTaskColor(this,\''+cl+'\')" data-color="'+cl+'" style="width:28px;height:28px;border-radius:50%;background:'+cl+';cursor:pointer;border:3px solid '+(tk.color===cl?'#000':'transparent')+';transition:all .15s"></div>'; }).join('')
    +'</div>'
    +'<input type="hidden" id="glt-color" value="'+(tk.color||'#7c3aed')+'">'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libSaveEditGlobalTask(\''+tid+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
}
function libSaveEditGlobalTask(tid){
  var title=(document.getElementById('glt-title')||{}).value||'';
  if(!title) return toast(LANG==='es'?'El título es requerido':'Title is required','e');
  var lib=getLib(); var tk=(lib.globalTasks||[]).find(function(t){return t.id===tid;}); if(!tk) return;
  tk.title=title;
  tk.desc=(document.getElementById('glt-desc')||{}).value||'';
  tk.durationDays=parseInt((document.getElementById('glt-dur')||{}).value)||tk.durationDays||7;
  tk.dueDate='';
  tk.assignee=(document.getElementById('glt-who')||{}).value||'';
  tk.color=(document.getElementById('glt-color')||{}).value||tk.color;
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Tarea actualizada':'Task updated','s');
}
function libDeleteGlobalTask(tid){
  openConfirmModal({
    title:LANG==='es'?'Eliminar tarea':'Delete task',
    message:LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm:function(){
      var lib=getLib();
      lib.globalTasks=(lib.globalTasks||[]).filter(function(t){return t.id!==tid;});
      saveLib(lib); renderLibrary();
      toast(LANG==='es'?'Tarea eliminada':'Task deleted');
    }
  });
}
function libDuplicateGlobalTask(tid){
  var lib=getLib();
  if(!lib.globalTasks) lib.globalTasks=[];
  var tk=(lib.globalTasks||[]).find(function(item){return item.id===tid;});
  if(!tk) return;
  var copy=JSON.parse(JSON.stringify(tk));
  copy.id='gt'+Date.now()+Math.random().toString(36).slice(2,6);
  copy.title=(tk.title||'Task')+' (Copy)';
  lib.globalTasks.push(copy);
  saveLib(lib); renderLibrary();
  toast(LANG==='es'?'Tarea duplicada':'Task duplicated','s');
}
function libLoadTaskToEvent(tid){
  var lib=getLib();
  var tk=(lib.globalTasks||[]).find(function(t){return t.id===tid;});
  if(!tk) return;
  libOpenTaskEventPickerModal([tk]);
}
function libAddTasksToCurrentProject(tasks){
  var p = proj(); if(!p) return 0;
  if(!p.tasks) p.tasks = [];
  var existingTitles = (p.tasks||[]).map(function(t){ return String(t.title||'').toLowerCase(); });
  var added = 0;
  (tasks||[]).forEach(function(tk){
    var title = String((tk&&tk.title)||'').toLowerCase();
    if(!title || existingTitles.indexOf(title)!==-1) return;
    var nt = JSON.parse(JSON.stringify(tk));
    nt.id='t'+Date.now()+Math.random().toString(36).slice(2,6);
    nt.done=false;
    var days=tk.durationDays||7;
    var start=new Date(); start.setHours(0,0,0,0);
    var end=new Date(start); end.setDate(end.getDate()+days-1);
    nt.startDate=start.toISOString().split('T')[0];
    nt.dueDate=end.toISOString().split('T')[0];
    p.tasks.push(nt);
    existingTitles.push(title);
    added++;
  });
  saveProj(p);
  return added;
}
function libBulkLoadTasksToEvent(){
  var lib=getLib();
  var checked=document.querySelectorAll('.lib-gt-sel:checked');
  var tasks=[];
  checked.forEach(function(chk){
    var tk=(lib.globalTasks||[]).find(function(t){return t.id===chk.dataset.tid;});
    if(tk) tasks.push(tk);
  });
  if(!tasks.length) return;
  libOpenTaskEventPickerModal(tasks);
}
var _libPendingTasks=[];
function libOpenTaskEventPickerModal(tasks){
  var isES=LANG==='es';
  _libPendingTasks=tasks;
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
  if(!allProjects.length) return toast(isES?'No hay eventos creados':'No events created yet','e');
  var taskNames=tasks.map(function(tk){return esc(tk.title);}).join(', ');
  var eventRows=allProjects.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="checkbox" class="ev-pick-task-chk" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  openMo('<div class="mo-title">'+(isES?'Seleccionar Evento(s)':'Select Event(s)')+'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:12px">'+(isES?'Agregar: ':'Adding: ')+'<strong>'+taskNames+'</strong></p>'
    +'<div style="position:relative;margin-bottom:10px">'
    +'<svg width="14" height="14" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar evento...':'Search event...')+'" oninput="libFilterTaskEventPicker(this.value)" style="padding-left:32px">'
    +'</div>'
    +'<div id="ev-pick-task-list" style="max-height:50vh;overflow-y:auto">'+eventRows+'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libDoAddTasksToEvents()">'+(isES?'Agregar a Eventos Seleccionados':'Add to Selected Events')+'</button>'
    +'</div>');
}
function libFilterTaskEventPicker(q){
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
  var isES=LANG==='es'; var s=q.trim().toLowerCase();
  var filtered=s===''?allProjects:allProjects.filter(function(p){return [p.name,p.clientName].some(function(f){return f&&f.toLowerCase().includes(s);});});
  var html=filtered.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="checkbox" class="ev-pick-task-chk" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  var el=document.getElementById('ev-pick-task-list'); if(el) el.innerHTML=html;
}
function libDoAddTasksToEvents(){
  var isES=LANG==='es';
  var tasks=_libPendingTasks||[]; if(!tasks.length) return;
  var selectedEventIds=Array.from(document.querySelectorAll('.ev-pick-task-chk:checked')).map(function(c){return c.value;});
  if(!selectedEventIds.length) return toast(isES?'Selecciona al menos un evento':'Select at least one event','e');
  var all=uproj(); var totalAdded=0;
  selectedEventIds.forEach(function(pid){
    var p=all[pid]; if(!p) return;
    if(!p.tasks) p.tasks=[];
    tasks.forEach(function(tk){
      var exists=p.tasks.some(function(t){return t.title.toLowerCase()===tk.title.toLowerCase();});
      if(!exists){
        var nt=JSON.parse(JSON.stringify(tk));
        nt.id='t'+Date.now()+Math.random().toString(36).slice(2,6);
        nt.done=false;
        var days=tk.durationDays||7;
        var start=new Date(); start.setHours(0,0,0,0);
        var end=new Date(start); end.setDate(end.getDate()+days-1);
        nt.startDate=start.toISOString().split('T')[0];
        nt.dueDate=end.toISOString().split('T')[0];
        p.tasks.push(nt);
        saveProj(p);
        totalAdded++;
      }
    });
  });
  _libPendingTasks=[];
  closeMo();
  toast((isES?totalAdded+' tarea(s) agregada(s) a '+selectedEventIds.length+' evento(s)':totalAdded+' task(s) added to '+selectedEventIds.length+' event(s)'),'s');
  if(typeof renderTimeline==='function' && typeof CTAB!=='undefined' && CTAB==='timeline') renderTimeline();
}
function libDownloadTaskTemplate(){
  var csv='Title,Description,Due Date,Assignee,Color\n'
    +'"Initial Client Meeting","Review vision and event requirements","2024-03-01","Event Coordinator","#7c3aed"\n'
    +'"Venue Selection","Research and visit venue options","2024-03-15","Venue Manager","#a67c3d"\n';
  var blob=new Blob([csv],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='task_template.csv'; a.click();
}
function libImportTasksCSV(){
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Importar Tareas CSV':'Import Tasks CSV')+'</div>'
    +'<p style="font-size:13px;color:var(--muted);margin-bottom:14px">'+(isES?'Sube un archivo CSV con las tareas. Usa la plantilla para el formato correcto.':'Upload a CSV file with tasks. Use the template for the correct format.')+'</p>'
    +'<div class="upload-area" onclick="document.getElementById(\'csv-task-input\').click()" style="margin-bottom:14px">'
    +'<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 8px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
    +'<p style="font-size:13px">'+(isES?'Haz clic para seleccionar archivo CSV':'Click to select CSV file')+'</p>'
    +'<p id="csv-task-file-name" style="font-size:11px;color:var(--gold-h);margin-top:4px"></p>'
    +'</div>'
    +'<input type="file" id="csv-task-input" accept=".csv" class="hidden" onchange="libPreviewTasksCSV(this)">'
    +'<div id="csv-task-preview"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" id="csv-task-import-btn" style="display:none" onclick="libDoImportTasksCSV()">'+(isES?'Importar':'Import')+'</button>'
    +'</div>');
}
var _csvTasksParsed=[];
function libPreviewTasksCSV(input){
  var file=input.files[0]; if(!file) return;
  var isES=LANG==='es';
  document.getElementById('csv-task-file-name').textContent=file.name;
  var reader=new FileReader();
  reader.onload=function(e){
    var lines=e.target.result.trim().split('\n');
    if(lines.length<2){ document.getElementById('csv-task-preview').innerHTML='<p style="color:var(--danger);font-size:12px">'+(isES?'Archivo vacío':'Empty file')+'</p>'; return; }
    var headers=lines[0].split(',').map(function(h){return h.replace(/"/g,'').trim().toLowerCase();});
    _csvTasksParsed=[];
    for(var i=1;i<lines.length;i++){
      var cols=lines[i].split(',').map(function(c){return c.replace(/^"|"$/g,'').trim();});
      var obj={}; headers.forEach(function(h,idx){obj[h]=cols[idx]||'';});
      var title=obj['title']||obj['título']||obj['titulo']||'';
      if(!title) continue;
      _csvTasksParsed.push({id:'gt'+Date.now()+i,title:title,desc:obj['description']||obj['descripción']||obj['descripcion']||'',dueDate:obj['due date']||obj['fecha límite']||obj['fecha limite']||'',assignee:obj['assignee']||obj['asignado a']||'',color:obj['color']||'#7c3aed',done:false});
    }
    if(!_csvTasksParsed.length){ document.getElementById('csv-task-preview').innerHTML='<p style="color:var(--danger);font-size:12px">'+(isES?'No se encontraron tareas válidas':'No valid tasks found')+'</p>'; return; }
    var rows=_csvTasksParsed.slice(0,5).map(function(tk){ return '<tr><td style="padding:6px 8px;font-size:12px;font-weight:600">'+esc(tk.title)+'</td><td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(tk.dueDate||'—')+'</td><td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(tk.assignee||'—')+'</td></tr>'; }).join('');
    document.getElementById('csv-task-preview').innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:6px">'+(isES?'Vista previa':'Preview')+' ('+_csvTasksParsed.length+' '+(isES?'tareas':'tasks')+'):</div><div style="overflow-x:auto;max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:6px"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)"><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(isES?'Título':'Title')+'</th><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(t('lib_date_col'))+'</th><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(isES?'Asignado a':'Assignee')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    document.getElementById('csv-task-import-btn').style.display='';
  };
  reader.readAsText(file);
}
function libDoImportTasksCSV(){
  if(!_csvTasksParsed.length) return;
  var lib=getLib(); if(!lib.globalTasks) lib.globalTasks=[];
  var added=0;
  _csvTasksParsed.forEach(function(tk){
    var exists=lib.globalTasks.some(function(t){return t.title.toLowerCase()===tk.title.toLowerCase();});
    if(!exists){ lib.globalTasks.push(JSON.parse(JSON.stringify(tk))); added++; }
  });
  saveLib(lib); closeMo(); renderLibrary();
  toast((LANG==='es'?added+' tareas importadas':added+' tasks imported'),'s');
}

// ── Planos: miniatura dibujada con los elementos reales del plano ────────
/** Numeros del plano: mesas, sillas, elementos y superficie (si hay escala). */
/** Etiqueta del modulo de planos: en ES la clave lib_layouts dice "Layouts". */
function libLayoutsLabel(){ return LANG==='es' ? 'Planos' : t('lib_layouts'); }
function libLayoutStats(entry){
  var items=(entry&&entry.items)||[];
  var tables=items.filter(function(i){ return i.shape&&String(i.shape).includes('table'); }).length;
  var seats=items.reduce(function(s,i){ return s+(+i.chairs||0); },0);
  var ppm=(entry&&entry.pxPerMeter)||(entry&&entry.floorplan&&entry.floorplan.pxPerMeter)||0;
  var dims='0';
  if(items.length){
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    items.forEach(function(i){
      var x=+i.x||0, y=+i.y||0, w=+i.w||0, h=+i.h||0;
      if(x<minX)minX=x; if(y<minY)minY=y;
      if(x+w>maxX)maxX=x+w; if(y+h>maxY)maxY=y+h;
    });
    if(ppm>0) dims=Math.round((maxX-minX)/ppm)+' × '+Math.round((maxY-minY)/ppm)+' m';
    else dims=items.length+'';
  }
  return {tables:tables, seats:seats, items:items.length, dims:dims, scaled:ppm>0,
    guests:(entry&&entry.guests)||seats||0};
}

/** Etiqueta de tipo del plano, deducida de sus elementos reales. */
function libLayoutTypeLabel(entry){
  var isES=LANG==='es';
  if(entry&&entry.location) return String(entry.location);
  var items=(entry&&entry.items)||[];
  if(!items.length) return isES?'Vacío':'Empty';
  var round=0, rect=0;
  items.forEach(function(i){
    var sh=String(i.shape||'');
    if(sh.includes('table')){ if(sh.includes('round')||i.radius==='50%') round++; else rect++; }
  });
  if(round&&round>=rect) return isES?'Banquete':'Banquet';
  if(rect) return isES?'Imperial':'Imperial';
  return isES?'Espacio abierto':'Open space';
}
/** Tono estable a partir del texto de la etiqueta. */
function libTypeTone(label){
  var keys=['accent','info','success','warn','purple','champagne'];
  var s=String(label||''), h=0;
  for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return s?keys[h%keys.length]:'neutral';
}

/**
 * Miniatura SVG del plano con sus elementos reales (posicion, forma y tamano
 * escalados a la caja).  Si el plano esta vacio devuelve la caja sin contenido.
 */
function libLayoutThumb(entry){
  var items=(entry&&entry.items)||[];
  if(!items.length) return '';
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  items.forEach(function(i){
    var x=+i.x||0, y=+i.y||0, w=+i.w||0, h=+i.h||0;
    if(x<minX)minX=x; if(y<minY)minY=y;
    if(x+w>maxX)maxX=x+w; if(y+h>maxY)maxY=y+h;
  });
  var bw=Math.max(1,maxX-minX), bh=Math.max(1,maxY-minY);
  var pad=Math.max(bw,bh)*0.04;
  var shapes=items.map(function(i){
    var x=(+i.x||0), y=(+i.y||0), w=Math.max(1,+i.w||0), h=Math.max(1,+i.h||0);
    var sh=String(i.shape||'');
    var isRound=sh.includes('round')||i.radius==='50%';
    var fill=libColor(i.bg,'#C4BBAD');
    var stroke=libColor(i.bdClr,'rgba(22,19,15,.22)');
    var rot=+i.rotation||0;
    var tr=rot?' transform="rotate('+rot+' '+(x+w/2).toFixed(1)+' '+(y+h/2).toFixed(1)+')"':'';
    if(isRound){
      return '<ellipse cx="'+(x+w/2).toFixed(1)+'" cy="'+(y+h/2).toFixed(1)+'" rx="'+(w/2).toFixed(1)+'" ry="'+(h/2).toFixed(1)
        +'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(Math.max(bw,bh)*0.004).toFixed(2)+'"'+tr+'/>';
    }
    return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)
      +'" rx="'+(Math.min(w,h)*0.08).toFixed(1)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(Math.max(bw,bh)*0.004).toFixed(2)+'"'+tr+'/>';
  }).join('');
  return '<svg class="lib-thumb-svg" viewBox="'+(minX-pad).toFixed(1)+' '+(minY-pad).toFixed(1)+' '
    +(bw+pad*2).toFixed(1)+' '+(bh+pad*2).toFixed(1)+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
    +shapes+'</svg>';
}

// Se conserva el nombre historico: ahora devuelve la misma tarjeta que la rejilla.
function libLayoutRow(entry, isES){
  return libLayoutCard(entry, isES);
}
var _expandedLibLayoutIds=[];
function toggleLibLayoutExpand(lid){
  var idx=_expandedLibLayoutIds.indexOf(lid);
  if(idx>-1) _expandedLibLayoutIds.splice(idx,1); else _expandedLibLayoutIds.push(lid);
  var card=document.querySelector('.llmc[data-lid="'+lid+'"]');
  if(card) card.classList.toggle('emc-open',_expandedLibLayoutIds.indexOf(lid)>-1);
}
function libLayoutCard(entry, isES){
  var st=libLayoutStats(entry);
  var typeLbl=libLayoutTypeLabel(entry);
  var thumb=libLayoutThumb(entry);
  var spaceLbl=st.scaled?(isES?'Espacio':'Space'):(isES?'Elementos':'Elements');
  return '<article class="rd-card clip hover lib-plan" data-lid="'+esc(entry.id)+'">'
    +'<div class="lib-thumb rd-grid-bg">'
      +(thumb||'<span class="lib-thumb-empty">'+esc(isES?'Plano vacío':'Empty plan')+'</span>')
      +'<label class="lib-thumb-chk" onclick="event.stopPropagation()">'
        +libCheck('lib-ly-sel',' data-lid="'+esc(entry.id)+'"','libUpdateLayoutBulkBtn()')
      +'</label>'
      +rdPill(typeLbl,libTypeTone(typeLbl),{up:true,cls:'lib-thumb-tag'})
    +'</div>'
    +'<div class="lib-plan-body">'
      +'<h3 class="lib-plan-name">'+esc(entry.name)+'</h3>'
      +'<div class="lib-plan-stats">'
        +'<div><div class="lib-plan-num rd-num">'+st.tables+'</div><div class="rd-mini">'+esc(isES?'Mesas':'Tables')+'</div></div>'
        +'<div><div class="lib-plan-num rd-num">'+st.seats+'</div><div class="rd-mini">'+esc(isES?'Sillas':'Chairs')+'</div></div>'
        +'<div><div class="lib-plan-num rd-num">'+esc(st.dims)+'</div><div class="rd-mini">'+esc(spaceLbl)+'</div></div>'
      +'</div>'
      +'<div class="lib-plan-foot">'
        +'<span>'+esc(libEditedLabel(entry))+'</span>'
        +'<span class="lib-dotsep"></span>'
        +'<span class="rd-ellipsis">'+esc(entry.notes||entry.location||(isES?'Sin descripción':'No description'))+'</span>'
      +'</div>'
      +'<div class="lib-plan-actions">'
        +'<button class="btn btn-primary btn-sm lib-plan-open" onclick="libOpenLayoutEditor(\''+entry.id+'\')">'+esc(isES?'Abrir':'Open')+'</button>'
        +'<button class="btn btn-sm" onclick="libDuplicateLayout(\''+entry.id+'\')">'+esc(isES?'Duplicar':'Duplicate')+'</button>'
        +libIbtn('send','libLoadLayoutToEvent(\''+entry.id+'\')',t('lib_load'))
        +libIbtn('trash','libDelete(\'layouts\',\''+entry.id+'\')',isES?'Eliminar':'Delete',true)
      +'</div>'
    +'</div></article>';
}
/** Tile punteado "Nuevo plano" que abre el asistente. */
function libNewPlanTile(){
  var isES=LANG==='es';
  return '<button type="button" class="rd-dash lib-plan-new" onclick="libOpenLayoutWizard()">'
    +'<span class="rd-dash-ico">'+libIcon('plus',18,2.2)+'</span>'
    +'<span class="lib-plan-new-t">'+esc(t('lib_new_layout'))+'</span>'
    +'<span class="lib-plan-new-s">'+esc(isES?'Desde plantilla o en blanco':'From a template or blank')+'</span>'
    +'</button>';
}

function renderLibLayouts(lib){
  var isES=LANG==='es';
  if(!lib.layouts.length){
    return libEmptyState('layout',
      isES?'Crea tu primer plano':'Create your first floor plan',
      isES?'Diseña planos reutilizables con mesas, pista de baile, escenario y más. Cárgalos en cualquier evento.':'Design reusable plans with tables, dance floor, stage and more. Load them into any event.',
      '<button class="btn btn-primary" onclick="libOpenLayoutWizard()">'
      +libIcon('plus',14,2.4)+esc(isES?'Crear primer plano':'Create first plan')+'</button>');
  }
  var cards=lib.layouts.map(function(entry){ return libLayoutCard(entry,isES); }).join('');
  return '<div class="rd-toolrow lib-plan-tools">'
      +libSearchBox(isES?'Buscar planos...':'Search plans...','libFilterLayouts(this.value)')
      +'<label class="lib-selall">'+libCheck('','','libToggleAllLayouts(this.checked)','lib-layout-chk-all')
        +'<span>'+esc(isES?'Seleccionar visibles':'Select visible')+'</span></label>'
      +'<button id="lib-layout-bulk-btn" class="btn btn-sm" style="display:none" onclick="libBulkLoadLayoutsToEvent()">'+esc(t('lib_load'))+'</button>'
      +'<button id="lib-layout-bulk-del" class="btn btn-danger btn-sm" style="display:none" onclick="libBulkDeleteLayouts()">'+esc(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div id="lib-layout-rows" class="lib-plan-grid">'+libNewPlanTile()+cards+'</div>'
    +renderMobileStickyActionBar('<button class="btn btn-primary" onclick="libOpenLayoutWizard()">'+esc(t('lib_new_layout'))+'</button>');
}
function libFilterLayouts(q){
  var lib=getLib(); var isES=LANG==='es';
  var s=q.trim().toLowerCase();
  var filtered=s===''?lib.layouts:lib.layouts.filter(function(e){
    var tables=String(e.items?e.items.filter(function(i){return i.shape&&i.shape.includes('table');}).length:'');
    return [e.name,e.location,e.notes,e.guests,tables].some(function(f){return f&&String(f).toLowerCase().includes(s);});
  });
  var body=filtered.length?filtered.map(function(e){ return libLayoutCard(e,isES); }).join(''):libNoResults();
  var tb=document.getElementById('lib-layout-rows'); if(tb) tb.innerHTML=libNewPlanTile()+body;
  libUpdateLayoutBulkBtn();
}
function libUpdateLayoutBulkBtn(){
  var checked=document.querySelectorAll('.lib-ly-sel:checked').length;
  var btn=document.getElementById('lib-layout-bulk-btn');
  if(btn) btn.style.display=checked>0?'':'none';
  var delBtn=document.getElementById('lib-layout-bulk-del');
  if(delBtn) delBtn.style.display=checked>0?'':'none';
  var all=document.getElementById('lib-layout-chk-all');
  if(all) all.checked=(checked>0&&checked===document.querySelectorAll('.lib-ly-sel').length);
}
function libToggleAllLayouts(checked){
  document.querySelectorAll('.lib-ly-sel').forEach(function(c){c.checked=checked;});
  libUpdateLayoutBulkBtn();
}
var _libPendingLayoutId=null;
function libLoadLayoutToEvent(entryId){
  _libPendingLayoutId=entryId;
  libOpenLayoutEventPicker();
}
function libBulkLoadLayoutsToEvent(){
  var checked=document.querySelectorAll('.lib-ly-sel:checked');
  if(!checked.length) return;
  _libPendingLayoutId=checked[0].dataset.lid;
  libOpenLayoutEventPicker();
}
function libOpenLayoutEventPicker(entryId){
  if(entryId) _libPendingLayoutId=entryId;
  var isES=LANG==='es';
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.id!=='__lib_layout__'&&p.name&&p.status!=='__internal__';});
  if(!allProjects.length) return toast(isES?'No hay eventos creados':'No events created yet','e');
  var eventRows=allProjects.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="radio" name="ly-ev-pick" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  openMo('<div class="mo-title">'+(isES?'Seleccionar Evento':'Select Event')+'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:12px">'+(isES?'Esto exportara una vista de solo lectura al evento seleccionado.':'This will export a read-only snapshot into the selected event.')+'</p>'
    +'<div style="position:relative;margin-bottom:10px">'
    +'<svg width="14" height="14" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar evento...':'Search event...')+'" oninput="libFilterLayoutEventPicker(this.value)" style="padding-left:32px">'
    +'</div>'
    +'<div id="ly-ev-pick-list" style="max-height:50vh;overflow-y:auto">'+eventRows+'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libDoLoadLayoutToEvent()">'+(t('lib_load'))+'</button>'
    +'</div>');
}
function libFilterLayoutEventPicker(q){
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.id!=='__lib_layout__'&&p.name&&p.status!=='__internal__';});
  var s=q.trim().toLowerCase();
  var filtered=s===''?allProjects:allProjects.filter(function(p){return [p.name,p.clientName].some(function(f){return f&&f.toLowerCase().includes(s);});});
  var html=filtered.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="radio" name="ly-ev-pick" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  var el=document.getElementById('ly-ev-pick-list'); if(el) el.innerHTML=html;
}
async function libDoLoadLayoutToEvent(){
  var isES=LANG==='es';
  var sel=document.querySelector('input[name="ly-ev-pick"]:checked');
  if(!sel) return toast(isES?'Selecciona un evento':'Select an event','e');
  var pid=sel.value;
  var p=uproj()[pid];
  if(!p) return;
  // If the project is still a lightweight meta stub, load full data first
  // so that saveProj doesn't skip the save and openProject doesn't overwrite our changes.
  if(p._metaOnly && typeof loadProjectById==='function'){
    var loaded = await loadProjectById(pid);
    if(!loaded){ toast(isES?'No se pudo cargar el evento':'Could not load event data','e'); return; }
    p = loaded;
  }
  if(!p.layoutExport && p.layoutItems && p.layoutItems.length){
    await migrateLegacyEventLayoutToLibrary(p);
  }
  var exp = await libApplyLayoutExportToEvent(_libPendingLayoutId, pid, {toastSuccess:false});
  if(!exp) return;
  closeMo();
  toast(t('lib_exported'),'s');
  _libPendingLayoutId=null;
  if(typeof openProject==='function'){
    openProject(pid);
    setTimeout(function(){
      if(typeof switchTab==='function') switchTab('layout');
    }, 120);
  }
}
window.libOpenLayoutEventPicker = libOpenLayoutEventPicker;
window.libFilterLayoutEventPicker = libFilterLayoutEventPicker;
window.libDoLoadLayoutToEvent = libDoLoadLayoutToEvent;
function libEditLayout(entryId){
  libOpenLayoutEditor(entryId);
}
function libRenameEditingLayout(entryId){
  var input=document.getElementById('lib-layout-editor-name');
  if(!input) return;
  var name=(input.value||'').trim();
  if(!name){
    toast(LANG==='es'?'El nombre es requerido':'Name is required','e');
    input.focus();
    return;
  }
  if(!libEnsureUniqueLayoutName(name, entryId)) return;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry) return;
  entry.name=name;
  entry.updatedAt=new Date().toISOString();
  saveLib(lib);
  input.value=name;
  toast(LANG==='es'?'Plano actualizado':'Layout updated','s');
}
window.libRenameEditingLayout = libRenameEditingLayout;
// NOTA: hoy ningun modal genera los inputs ely-*.  Si alguna vez se invoca sin ese
// markup, la version anterior escribia '' en location/guests/notes y BORRABA esos
// datos.  Ahora aborta en vez de destruir, y solo toca los campos que existen.
function libSaveEditLayout(entryId){
  var nameEl=document.getElementById('ely-name');
  if(!nameEl){
    console.warn('EventOS: libSaveEditLayout llamado sin el formulario ely-* en el DOM');
    return toast(LANG==='es'?'Formulario no disponible':'Form not available','e');
  }
  var name=(nameEl.value||'').trim();
  if(!name) return toast(LANG==='es'?'El nombre es requerido':'Name is required','e');
  if(!libEnsureUniqueLayoutName(name, entryId)) return;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;}); if(!entry) return;
  entry.name=name;
  var setIf=function(id, key){ var el=document.getElementById(id); if(el) entry[key]=el.value||''; };
  setIf('ely-location','location');
  setIf('ely-guests','guests');
  setIf('ely-notes','notes');
  entry.updatedAt=new Date().toISOString();
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Plano actualizado':'Layout updated','s');
}

function renderLibTypes(lib, type){
  var isES=LANG==='es';
  var data = lib[type]||{};
  var keys = Object.keys(data);
  var typeLabel = {tables:t('lib_tables'),elements:t('lib_elements'),chairs:t('lib_chairs'),centerpieces:t('lib_centerpieces')}[type]||type;
  if(!keys.length && !(lib[type+'_packs'] && lib[type+'_packs'].length)){
    return libEmptyState('cube', t('lib_empty'), t('lib_empty_sub'), '');
  }
  if(lib[type+'_packs'] && lib[type+'_packs'].length){
    return '<div class="lib-pack-grid">'+lib[type+'_packs'].map(function(pack){
      var cnt=Object.keys(pack.data||{}).length;
      return '<section class="rd-card pad lib-pack">'
        +'<div class="rd-card-title"><h2>'+esc(pack.name)+'</h2>'
          +rdPill(cnt+' '+typeLabel,'neutral',{sm:true})+'</div>'
        +'<div class="lib-pack-foot">'
          +'<span class="rd-hint">'+esc(pack.date||'—')+'</span>'
          +'<div class="rd-spacer"></div>'
          +(proj()?'<button class="btn btn-sm" onclick="libLoadTypesPack(\''+type+'\',\''+pack.id+'\')">'+esc(t('lib_load_btn'))+'</button>':'')
          +libIbtn('trash','libDelete(\''+type+'_pack\',\''+pack.id+'\')',isES?'Eliminar':'Delete',true)
        +'</div></section>';
    }).join('')+'</div>';
  }
  return '<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+esc(typeLabel)+' <span class="rd-hint">('+keys.length+')</span></h2>'
      +(proj()?'<button class="btn btn-sm" onclick="libLoadTypes(\''+type+'\')">'+esc(t('lib_load_btn'))+'</button>':'')+'</div>'
    +'<div class="lib-chiprow">'
    +keys.map(function(k){
      var item=data[k]||{}; var lbl=item.label||k;
      return '<span class="lib-chip">'
        +(item.color?'<i style="background:'+libColor(item.color)+'"></i>':'')
        +esc(lbl)+'</span>';
    }).join('')
    +'</div></section>';
}

function libFilterMoodboards(q){
  var lib=getLib(); var isES=LANG==='es';
  var s=q.trim().toLowerCase();
  var filtered=s===''?lib.moodboards:lib.moodboards.filter(function(e){return e.name.toLowerCase().includes(s);});
  var el=document.getElementById('lib-mb-rows'); if(!el) return;
  el.innerHTML=filtered.length?filtered.map(function(e){ return _libMbRow(e,isES); }).join(''):libNoResults();
  libUpdateMoodboardBulkBtn();
}

function libMbBackToFolders(){ _mbOpenFolderId=null; renderLibrary(); }

// Count how many currently-loaded events reference this library layout (by layoutId).
function _libCountLayoutRefs(entryId){
  var all=(typeof uproj==='function')?uproj():{}; var n=0;
  Object.keys(all).forEach(function(pid){
    if(pid==='__library__'||pid==='__lib_layout__') return;
    var p=all[pid]; if(!p) return;
    var hit=(p.layoutExport && p.layoutExport.layoutId===entryId) ||
      (Array.isArray(p.eventLayouts) && p.eventLayouts.some(function(e){return e.layoutExport&&e.layoutExport.layoutId===entryId;}));
    if(hit) n++;
  });
  return n;
}
// Before a library layout is deleted, freeze a self-contained snapshot (image + summary)
// into every event that uses it, so those events keep showing their layout — no data loss.
function _libDetachLayoutFromEvents(entryId){
  var lib=getLib();
  var entry=(lib.layouts||[]).find(function(e){return e.id===entryId;});
  if(!entry || typeof createLayoutExportPayload!=='function') return 0;
  var frozen=null; // regenerate once; reuse the same snapshot for all references
  function snap(){ if(!frozen) frozen=createLayoutExportPayload(entry); return frozen; }
  var all=(typeof uproj==='function')?uproj():{}; var affected=0;
  Object.keys(all).forEach(function(pid){
    if(pid==='__library__'||pid==='__lib_layout__') return;
    var p=all[pid]; if(!p) return;
    var touched=false;
    (p.eventLayouts||[]).forEach(function(elEntry){
      if(elEntry.layoutExport && elEntry.layoutExport.layoutId===entryId){
        var s=snap(); if(s){ elEntry.layoutExport=Object.assign({},s,{_detached:true}); touched=true; }
      }
    });
    if(p.layoutExport && p.layoutExport.layoutId===entryId){
      var s2=snap(); if(s2){ p.layoutExport=Object.assign({},s2,{_detached:true}); touched=true; }
    }
    if(touched){ affected++; if(typeof saveProj==='function') saveProj(p); }
  });
  return affected;
}
function libDelete(type, id){
  if(type==='layouts'){
    var refs=_libCountLayoutRefs(id);
    var msg = LANG==='es'
      ? (refs>0 ? ('Este layout se usa en '+refs+' evento'+(refs>1?'s':'')+'. Se guardará una copia independiente (imagen y resumen) en cada uno para no perder nada, y luego se quitará de la biblioteca.') : 'Esta acción no se puede deshacer.')
      : (refs>0 ? ('This layout is used by '+refs+' event'+(refs>1?'s':'')+'. A self-contained copy (image and summary) will be saved into each so nothing is lost, then it will be removed from the library.') : 'This action cannot be undone.');
    openConfirmModal({
      title:t('lib_delete_confirm'),
      message:msg,
      onConfirm:function(){
        if(refs>0) _libDetachLayoutFromEvents(id);
        var lib=getLib();
        lib.layouts = lib.layouts.filter(function(e){return e.id!==id;});
        saveLib(lib); renderLibrary();
        toast(LANG==='es'?'Eliminado de biblioteca':'Removed from library');
      }
    });
    return;
  }
  openConfirmModal({
    title:t('lib_delete_confirm'),
    message:LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm:function(){
      var lib = getLib();
      if(type==='vendors')     lib.vendors     = lib.vendors.filter(function(e){return e.id!==id;});
      else if(type==='tasks')  lib.tasks       = lib.tasks.filter(function(e){return e.id!==id;});
      else if(type==='moodboards')lib.moodboards = lib.moodboards.filter(function(e){return e.id!==id;});
      else if(type.endsWith('_pack')){
        var baseType = type.replace('_pack','');
        if(lib[baseType+'_packs']) lib[baseType+'_packs'] = lib[baseType+'_packs'].filter(function(e){return e.id!==id;});
      }
      saveLib(lib); renderLibrary();
      toast(LANG==='es'?'Eliminado de biblioteca':'Removed from library');
    }
  });
}

function libSaveModal(type){
  var p = proj();
  switch(type){
    case 'vendors':    libSaveVendorsModal(p); break;
    case 'tasks':      libSaveTasksModal(p); break;
    case 'layouts':    libSaveLayoutModal(p); break;
    case 'tables':     libSaveTypesModal('tables'); break;
    case 'elements':   libSaveTypesModal('elements'); break;
    case 'chairs':     libSaveTypesModal('chairs'); break;
    case 'centerpieces':libSaveTypesModal('centerpieces'); break;
    case 'moodboards': libSaveMoodboardModal(p); break;
  }
}

function libNamePrompt(icon, title, bodyHtml, onSave){
  openMo('<div class="mo-title">'+icon+' '+title+'</div>'
    +bodyHtml
    +'<div class="form-grid" style="margin-top:14px">'
    +'<div class="ig" style="grid-column:1/-1"><label>'+t('lib_save_name')+'</label>'
    +'<input class="input" id="lib-entry-name" placeholder="'+title+'..."></div>'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="'+onSave+'">'+t('lib_save_btn')+'</button>'
    +'</div>');
}

function libSaveVendorsModal(p){
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var vendors = p.vendors||[];
  if(!vendors.length) return toast(LANG==='es'?'No hay proveedores':'No vendors','e');
  var checkboxes = vendors.map(function(v){
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:6px">'
      +'<input type="checkbox" class="lib-v-chk" value="'+v.id+'" checked style="accent-color:var(--gold-h)">'
      +'<span style="font-size:13px;font-weight:600">'+esc(v.name)+'</span>'
      +'<span class="s-sm">'+esc(v.category)+'</span>'
      +(v.hired?'<span class="badge b-green" style="margin-left:auto">'+(LANG==='es'?'Contratado':'Hired')+'</span>':'')
      +'</label>';
  }).join('');
  libNamePrompt('🏢', t('lib_add_vendor'),
    '<div style="max-height:40vh;overflow-y:auto;margin-top:10px">'+checkboxes+'</div>',
    'libSaveVendorsDo()'
  );
}
function libSaveVendorsDo(){
  var name = (document.getElementById('lib-entry-name')||{}).value||'';
  if(!name) return toast(t('lib_save_name'),'e');
  var p = proj(); if(!p) return;
  var ids = Array.from(document.querySelectorAll('.lib-v-chk:checked')).map(function(c){return c.value;});
  if(!ids.length) return toast(LANG==='es'?'Selecciona al menos uno':'Select at least one','e');
  var vendorsToSave = (p.vendors||[]).filter(function(v){return ids.includes(v.id);}).map(function(v){
    var copy=JSON.parse(JSON.stringify(v));
    delete copy.hired; delete copy.vendorStatus; copy.payments=[];
    return copy;
  });
  var lib = getLib();
  lib.vendors.push({id:'lv'+Date.now(), name:name, date:formatDMY(today()), vendors: vendorsToSave});
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

function libSaveTasksModal(p){
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var tasks = p.tasks||[];
  if(!tasks.length) return toast(LANG==='es'?'No hay tareas':'No tasks','e');
  var checkboxes = tasks.map(function(tk){
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:6px">'
      +'<input type="checkbox" class="lib-t-chk" value="'+tk.id+'" checked style="accent-color:var(--gold-h)">'
      +'<span style="font-size:13px;font-weight:600">'+esc(tk.title)+'</span>'
      +(tk.done?'<span class="badge b-green" style="margin-left:auto">✓</span>':'')
      +'</label>';
  }).join('');
  libNamePrompt('📅', t('lib_add_task'),
    '<div style="max-height:40vh;overflow-y:auto;margin-top:10px">'+checkboxes+'</div>',
    'libSaveTasksDo()'
  );
}
function libSaveTasksDo(){
  var name = (document.getElementById('lib-entry-name')||{}).value||'';
  if(!name) return toast(t('lib_save_name'),'e');
  var p = proj(); if(!p) return;
  var ids = Array.from(document.querySelectorAll('.lib-t-chk:checked')).map(function(c){return c.value;});
  if(!ids.length) return toast(LANG==='es'?'Selecciona al menos uno':'Select at least one','e');
  var tasksToSave = (p.tasks||[]).filter(function(tk){return ids.includes(tk.id);});
  var lib = getLib();
  lib.tasks.push({id:'lt'+Date.now(), name:name, date:formatDMY(today()), tasks: JSON.parse(JSON.stringify(tasksToSave))});
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

function libSaveLayoutModal(p){
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var items = p.layoutItems||[];
  if(!items.length) return toast(LANG==='es'?'El plano está vacío':'Layout is empty','e');
  var info = items.length+' '+(LANG==='es'?'elementos':'elements')
    +', '+items.filter(function(i){return i.shape.includes('table');}).length+' '+(LANG==='es'?'mesas':'tables')
    +', '+items.reduce(function(s,i){return s+(i.chairs||0);},0)+' '+(LANG==='es'?'asientos':'seats');
  var floorOpt = LState.floorplan&&(LState.floorplan.img||LState.floorplan.thumb||LState.floorplan._idb)
    ? '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px">'
      +'<input type="checkbox" id="lib-inc-floor" checked style="accent-color:var(--gold-h)">'
      +(LANG==='es'?'Incluir imagen de plano de piso':'Include floorplan image')+'</label>'
    : '';
  libNamePrompt('📐', t('lib_add_layout'),
    '<div style="font-size:12px;color:var(--muted);margin-top:8px;padding:8px;background:var(--bg2);border-radius:6px">'+info+'</div>'
    +'<div class="form-grid" style="margin-top:10px">'
    +'<div class="ig"><label>'+(LANG==='es'?'Ubicación (opcional)':'Location (optional)')+'</label><input class="input" id="lib-layout-location"></div>'
    +'<div class="ig"><label>'+(LANG==='es'?'# Invitados (opcional)':'# Guests (optional)')+'</label><input class="input" id="lib-layout-guests" type="number" min="0"></div>'
    +'</div>'
    +'<div class="ig" style="margin-top:10px"><label>'+(LANG==='es'?'Descripción (opcional)':'Description (optional)')+'</label>'
    +'<input class="input" id="lib-layout-notes"></div>'
    +floorOpt,
    'libSaveLayoutDo()'
  );
}
function libSaveLayoutDo(){
  var name = ((document.getElementById('lib-entry-name')||{}).value||'').trim();
  if(!name) return toast(t('lib_save_name'),'e');
  if(!libEnsureUniqueLayoutName(name)) return;
  var p = proj(); if(!p) return;
  var notes = (document.getElementById('lib-layout-notes')||{}).value||'';
  var location = (document.getElementById('lib-layout-location')||{}).value||'';
  var guests = (document.getElementById('lib-layout-guests')||{}).value||'';
  var incFloor = document.getElementById('lib-inc-floor');
  var floorplan = (incFloor&&incFloor.checked) ? JSON.parse(JSON.stringify(LState.floorplan)) : null;
  var lib = getLib();
  lib.layouts.push({
    id:'ll'+Date.now()+Math.random().toString(36).slice(2,7), name:name, notes:notes, location:location, guests:guests,
    date:formatDMY(today()),
    updatedAt:new Date().toISOString(),
    items: JSON.parse(JSON.stringify(p.layoutItems||[])),
    floorplan: floorplan
  });
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}
function libRecoverFromEvents(){
  var isES=LANG==='es';
  var all=uproj();
  var lib=getLib();
  var recovered=0;
  Object.keys(all).forEach(function(key){
    if(key==='__library__'||key==='__lib_layout__') return;
    var p=all[key];
    if(!p||!p.layoutItems||!p.layoutItems.length) return;
    var name=libUniqueLayoutName((p.name||key)+' - '+(isES?'Recuperado':'Recovered'));
    lib.layouts.push({
      id:'ll_rec_'+Date.now()+'_'+recovered,
      name:name,
      notes:isES?'Recuperado automáticamente desde el evento':'Auto-recovered from event',
      location:p.location||'',
      guests:p.guests||'',
      date:formatDMY(today()),
      items:JSON.parse(JSON.stringify(p.layoutItems)),
      floorplan:p.floorplan?JSON.parse(JSON.stringify(p.floorplan)):null
    });
    recovered++;
  });
  if(recovered===0){
    toast(isES?'No se encontraron layouts en tus eventos':'No layouts found in your events','e');
    return;
  }
  saveLib(lib);
  renderLibrary();
  toast((isES?'Layouts recuperados: ':'Layouts recovered: ')+recovered,'s');
}
window.libRecoverFromEvents = libRecoverFromEvents;
function libSaveTypesModal(type){
  var srcData = type==='tables'?LSHAPES_M
    :type==='elements'?LSHAPES_M
    :type==='chairs'?CHAIR_TYPES
    :type==='centerpieces'?CENTERPIECE_TYPES:{};
  var builtinTables = ['round-table','rect-table','square-table'];
  var builtinEls = ['chair','stage','bar','dj','plant','dance-floor','gift-table','buffet','cocktail-table'];
  var keys = Object.keys(srcData).filter(function(k){
    if(type==='tables') return !builtinTables.includes(k);
    if(type==='elements') return !builtinEls.includes(k);
    return true;
  });
  if(!keys.length) return toast(LANG==='es'?'No hay tipos personalizados guardados':'No custom types saved yet','e');
  var typeLabel = {tables:t('lib_tables'),elements:t('lib_elements'),chairs:t('lib_chairs'),centerpieces:t('lib_centerpieces')}[type];
  var checkboxes = keys.map(function(k){
    var item = srcData[k];
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:6px">'
      +'<input type="checkbox" class="lib-tp-chk" value="'+k+'" checked style="accent-color:var(--gold-h)">'
      +(item.color?'<span style="width:12px;height:12px;border-radius:3px;background:'+item.color+';flex-shrink:0"></span>':'')
      +'<span style="font-size:13px;font-weight:600">'+esc(item.label||k)+'</span>'
      +'</label>';
  }).join('');
  libNamePrompt('🗂️', t('lib_add_types')+' · '+typeLabel,
    '<div style="max-height:40vh;overflow-y:auto;margin-top:10px">'+checkboxes+'</div>',
    'libSaveTypesDo("'+type+'")'
  );
}
function libSaveTypesDo(type){
  var name = (document.getElementById('lib-entry-name')||{}).value||'';
  if(!name) return toast(t('lib_save_name'),'e');
  var keys = Array.from(document.querySelectorAll('.lib-tp-chk:checked')).map(function(c){return c.value;});
  if(!keys.length) return toast(LANG==='es'?'Selecciona al menos uno':'Select at least one','e');
  var srcData = type==='tables'||type==='elements'?LSHAPES_M:type==='chairs'?CHAIR_TYPES:CENTERPIECE_TYPES;
  var dataToSave = {};
  keys.forEach(function(k){ if(srcData[k]) dataToSave[k]=JSON.parse(JSON.stringify(srcData[k])); });
  var lib = getLib();
  if(!lib[type+'_packs']) lib[type+'_packs']=[];
  lib[type+'_packs'].push({id:'ltp'+Date.now(), name:name, date:formatDMY(today()), data:dataToSave});
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

function libSaveMoodboardModal(p){
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var mb = getMB(p);
  var folders = mb.folders||[];
  var uncatCnt = (mb.uncategorized||[]).length;
  if(!folders.length && !uncatCnt) return toast(LANG==='es'?'Moodboard vacío':'Moodboard is empty','e');
  var options = '';
  if(uncatCnt){
    options += '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:6px">'
      +'<input type="checkbox" class="lib-mb-chk" value="__uncat__" checked style="accent-color:var(--gold-h)">'
      +'<span style="font-size:13px;font-weight:600">'+(LANG==='es'?'Sin categoría':'Uncategorized')+'</span>'
      +'<span style="font-size:11px;color:var(--muted);margin-left:4px">'+uncatCnt+' '+(LANG==='es'?'imgs':'imgs')+'</span>'
      +'</label>';
  }
  folders.forEach(function(f){
    options += '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:6px">'
      +'<input type="checkbox" class="lib-mb-chk" value="'+f.id+'" checked style="accent-color:var(--gold-h)">'
      +'<span style="font-size:13px;font-weight:600">'+esc(f.name)+'</span>'
      +'<span style="font-size:11px;color:var(--muted);margin-left:4px">'+f.images.length+' '+(LANG==='es'?'imgs':'imgs')+'</span>'
      +'</label>';
  });
  libNamePrompt('🎨', t('lib_add_moodboard'),
    '<div style="max-height:35vh;overflow-y:auto;margin-top:10px">'+options+'</div>',
    'libSaveMoodboardDo()'
  );
}
function libSaveMoodboardDo(){
  var name = (document.getElementById('lib-entry-name')||{}).value||'';
  if(!name) return toast(t('lib_save_name'),'e');
  var p = proj(); if(!p) return;
  var mb = getMB(p);
  var ids = Array.from(document.querySelectorAll('.lib-mb-chk:checked')).map(function(c){return c.value;});
  if(!ids.length) return toast(LANG==='es'?'Selecciona al menos uno':'Select at least one','e');
  var savedFolders = [];
  var savedUncat = [];
  if(ids.includes('__uncat__')) savedUncat = JSON.parse(JSON.stringify(mb.uncategorized||[]));
  (mb.folders||[]).forEach(function(f){ if(ids.includes(f.id)) savedFolders.push(JSON.parse(JSON.stringify(f))); });
  var lib = getLib();
  lib.moodboards.push({
    id:'lm'+Date.now(), name:name,
    date:formatDMY(today()),
    folders: savedFolders,
    uncategorized: savedUncat
  });
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

// ── Moodboard Folder Management ───────────────────────────────────────────

function libCreateMoodboardFolder(){
  var isES=LANG==='es';
  openMo('<div class="mo-title">🎨 '+(t('lib_new_moodboard'))+'</div>'
    +'<div class="form-grid" style="margin-top:14px">'
    +'<label class="s-lbl">'+(isES?'Nombre de la carpeta':'Folder name')+'</label>'
    +'<input id="lib-mb-folder-name" class="input" placeholder="'+(isES?'Ej: Boda Rosa':'e.g. Pink Wedding')+'" style="width:100%">'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libCreateMoodboardFolderDo()">'+(isES?'Crear':'Create')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-mb-folder-name'); if(el) el.focus(); },80);
}

function libCreateMoodboardFolderDo(){
  var isES=LANG==='es';
  var name=(document.getElementById('lib-mb-folder-name')||{}).value||'';
  if(!name.trim()) return toast(isES?'Escribe un nombre':'Enter a name','e');
  var lib=getLib();
  lib.moodboards.push({id:'lm'+Date.now(), name:name.trim(), date:formatDMY(today()), images:[]});
  saveLib(lib);
  closeMo();
  toast(isES?'Carpeta creada':'Folder created','s');
  renderLibrary();
}

function libEditMoodboardFolder(id){
  var isES=LANG==='es';
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry) return;
  openMo('<div class="mo-title">✏️ '+(isES?'Renombrar Carpeta':'Rename Folder')+'</div>'
    +'<div class="form-grid" style="margin-top:14px">'
    +'<label class="s-lbl">'+(isES?'Nuevo nombre':'New name')+'</label>'
    +'<input id="lib-mb-rename-input" class="input" value="'+esc(entry.name)+'" style="width:100%">'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libEditMoodboardFolderDo(\''+id+'\')">'+(isES?'Guardar':'Save')+'</button>'
    +'</div>');
  setTimeout(function(){ var el=document.getElementById('lib-mb-rename-input'); if(el){el.focus();el.select();} },80);
}

function libEditMoodboardFolderDo(id){
  var isES=LANG==='es';
  var name=(document.getElementById('lib-mb-rename-input')||{}).value||'';
  if(!name.trim()) return toast(isES?'Escribe un nombre':'Enter a name','e');
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry) return;
  entry.name=name.trim();
  saveLib(lib);
  closeMo();
  renderLibrary();
}

function libDuplicateMoodboardFolder(id){
  var isES=LANG==='es';
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry) return;
  var copy=JSON.parse(JSON.stringify(entry));
  copy.id='lm'+Date.now();
  copy.name=entry.name+(isES?' (Copia)':' (Copy)');
  copy.date=formatDMY(today());
  lib.moodboards.push(copy);
  saveLib(lib);
  renderLibrary();
  // Immediately prompt to rename the duplicate
  libEditMoodboardFolder(copy.id);
}

function libOpenMoodboardFolder(id){
  _mbOpenFolderId=id;
  renderLibrary();
}

var _mbPendingFiles = [];

function libMoodboardUploadImages(id){
  var isES=LANG==='es';
  _mbPendingFiles=[];
  var inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=function(){
    var files=Array.from(inp.files); if(!files.length) return;
    var loaded=0;
    var previews=[];
    files.forEach(function(file,fi){
      var reader=new FileReader();
      reader.onload=function(ev){
        previews[fi]=ev.target.result;
        loaded++;
        if(loaded===files.length){
          _mbPendingFiles=previews;
          // Show confirm modal with previews
          var thumbs=previews.map(function(src){
            return '<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;background:#f0f0f0">'
              +'<img src="'+src+'" alt="'+esc(LANG==='es'?'Imagen':'Image')+'" style="width:100%;height:100%;object-fit:cover;display:block"></div>';
          }).join('');
          openMo('<div class="mo-title">'
            +'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
            +(isES?'Subir '+previews.length+' imagen(es)':'Upload '+previews.length+' image(s)')+'</div>'
            +'<div style="max-height:55vh;overflow-y:auto">'
            +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;padding:4px 2px">'+thumbs+'</div>'
            +'</div>'
            +'<div class="mo-foot">'
            +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
            +'<button class="btn btn-primary" onclick="libMoodboardUploadConfirm(\''+id+'\')">'
            +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>'
            +(isES?'OK, Subir':'OK, Upload')+'</button>'
            +'</div>');
        }
      };
      reader.readAsDataURL(file);
    });
  };
  inp.click();
}

function libMoodboardUploadConfirm(id){
  if(!_mbPendingFiles.length) return;
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry) return;
  if(!entry.images) entry.images=[];
  _mbPendingFiles.forEach(function(src){ entry.images.push(src); });
  _mbPendingFiles=[];
  saveLib(lib);
  closeMo();
  renderLibrary();
  toast(LANG==='es'?'Imágenes subidas':'Images uploaded','s');
}

function libMoodboardDeleteImage(id, idx){
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry||!entry.images) return;
  entry.images.splice(idx,1);
  saveLib(lib);
  renderLibrary();
}

function _libMbRow(entry, isES){
  var images = entry.images || [];
  var imgCnt = images.length;
  var folderCount = (entry.folders||[]).length + ((entry.uncategorized||[]).length ? 1 : 0) + (images.length ? 1 : 0);
  var thumb = images.length
    ? '<img class="lib-mb-thumb" src="'+esc(images[0])+'" alt="" loading="lazy">'
    : '<span class="rd-avatar">'+esc(rdInitials(entry.name))+'</span>';
  return '<div class="rd-row" style="grid-template-columns:'+LIB_GRID_MB+'">'
    +'<span>'+libCheck('lib-mb-sel',' data-id="'+esc(entry.id)+'"','libUpdateMoodboardBulkBtn()')+'</span>'
    +'<div class="lib-namecell">'+thumb
      +'<button type="button" class="lib-namebtn" onclick="libOpenMoodboardFolder(\''+entry.id+'\')">'
        +'<span class="rd-cell-main">'+esc(entry.name)+'</span>'
        +'<span class="rd-cell-sub">'+(imgCnt?esc(isES?'Listo':'Ready'):esc(isES?'Vacío':'Empty'))+'</span>'
      +'</button>'
    +'</div>'
    +'<span class="rd-cell rd-num" style="text-align:center">'+imgCnt+'</span>'
    +'<span class="rd-cell rd-num" style="text-align:center">'+folderCount+'</span>'
    +'<span class="rd-cell">'+esc(entry.date||'—')+'</span>'
    +libActions(
      '<button class="btn btn-sm" onclick="libLoadMoodboard(\''+entry.id+'\')">'+esc(t('lib_load'))+'</button>'
      +libIbtn('edit','libEditMoodboardFolder(\''+entry.id+'\')',isES?'Editar':'Edit')
      +libIbtn('copy','libDuplicateMoodboardFolder(\''+entry.id+'\')',isES?'Duplicar':'Duplicate')
      +libIbtn('trash','libDelete(\'moodboards\',\''+entry.id+'\')',isES?'Eliminar':'Delete',true)
    )
    +'</div>';
}
var _expandedLibMbIds=[];
function toggleLibMbExpand(mid){
  var idx=_expandedLibMbIds.indexOf(mid);
  if(idx>-1) _expandedLibMbIds.splice(idx,1); else _expandedLibMbIds.push(mid);
  var card=document.querySelector('.lmmc[data-mid="'+mid+'"]');
  if(card) card.classList.toggle('emc-open',_expandedLibMbIds.indexOf(mid)>-1);
}
function libMoodboardCard(entry, isES){
  var images = entry.images || [];
  var imgCnt = images.length;
  var folderCount = (entry.folders||[]).length + ((entry.uncategorized||[]).length ? 1 : 0) + (images.length ? 1 : 0);
  var isOpen=_expandedLibMbIds.indexOf(entry.id)>-1;
  return `<article class="emc lmmc${isOpen?' emc-open':''}" data-mid="${entry.id}">
    <div class="emc-summary" onclick="toggleLibMbExpand('${entry.id}')">
      <label onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0">
        <input type="checkbox" class="lib-mb-sel" data-id="${entry.id}" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateMoodboardBulkBtn()">
      </label>
      <div class="emc-info">
        <div class="emc-name">${esc(entry.name)}</div>
        <div class="emc-row">
          <span class="emc-date">${imgCnt} ${isES?'imágenes':'images'} · ${folderCount} ${isES?'carpetas':'folders'}</span>
        </div>
      </div>
      <svg class="emc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="emc-detail">
      <div class="emc-meta">
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Imágenes':'Images'}</span><span class="emc-meta-val">${imgCnt}</span></div>
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Carpetas':'Folders'}</span><span class="emc-meta-val">${folderCount}</span></div>
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Fecha':'Date'}</span><span class="emc-meta-val">${esc(entry.date||'—')}</span></div>
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Estado':'Status'}</span><span class="emc-meta-val">${imgCnt?(isES?'Listo':'Ready'):(isES?'Vacío':'Empty')}</span></div>
      </div>
      <div class="emc-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" onclick="libOpenMoodboardFolder('${entry.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg> ${isES?'Abrir':'Open'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libLoadMoodboard('${entry.id}')">${isES?'Cargar':'Load'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libEditMoodboardFolder('${entry.id}')">${isES?'Editar':'Edit'}</button>
        <button class="btn btn-danger btn-sm" onclick="libDelete('moodboards','${entry.id}')">${isES?'Eliminar':'Delete'}</button>
      </div>
    </div>
  </article>`;
}

function libUpdateMoodboardBulkBtn(){
  var n=document.querySelectorAll('.lib-mb-sel:checked').length;
  var total=document.querySelectorAll('.lib-mb-sel').length;
  var loadBtn=document.getElementById('lib-mb-bulk-load-btn');
  if(loadBtn) loadBtn.style.display=n>0?'':'none';
  var delBtn=document.getElementById('lib-mb-bulk-del-btn');
  if(delBtn) delBtn.style.display=n>0?'':'none';
  var all=document.getElementById('lib-mb-chk-all');
  if(all) all.checked=(n>0&&n===total);
}
function libToggleAllMoodboards(checked){
  document.querySelectorAll('.lib-mb-sel').forEach(function(c){c.checked=checked;});
  libUpdateMoodboardBulkBtn();
}
function libLoadSelectedMoodboards(){
  var lib=getLib();
  var ids=Array.from(document.querySelectorAll('.lib-mb-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var entries=[];
  ids.forEach(function(id){
    var entry=(lib.moodboards||[]).find(function(e){return e.id===id;});
    if(entry) entries.push(entry);
  });
  if(!entries.length) return;
  var added=libMergeMoodboardsToCurrentProject(entries);
  toast((LANG==='es'?added+' imagen(es) importadas de '+entries.length+' moodboard(s)':added+' image(s) imported from '+entries.length+' moodboard(s)'),'s');
  if(typeof renderMoodboard==='function' && typeof CTAB!=='undefined' && CTAB==='moodboard') renderMoodboard();
}
function libDeleteSelectedMoodboards(){
  var ids=Array.from(document.querySelectorAll('.lib-mb-sel:checked')).map(function(c){return c.dataset.id;});
  if(!ids.length) return;
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar moodboards':'Delete moodboards',
    message:isES?'¿Eliminar '+ids.length+' moodboard(s) seleccionado(s)?':'Delete '+ids.length+' selected moodboard(s)?',
    onConfirm:function(){
      var lib=getLib();
      lib.moodboards=lib.moodboards.filter(function(e){return ids.indexOf(e.id)===-1;});
      saveLib(lib); renderLibrary();
      toast(isES?'Moodboards eliminados':'Moodboards deleted');
    }
  });
}
function renderLibMoodboards(lib){
  var isES=LANG==='es';
  if(_mbOpenFolderId){
    var entry=lib.moodboards.find(function(e){return e.id===_mbOpenFolderId;});
    if(!entry){ _mbOpenFolderId=null; return renderLibMoodboards(lib); }
    var images=entry.images||[];
    var breadcrumb='<div class="rd-tab-head lib-detail-head">'
      +'<div class="lib-detail-title">'
        +'<button type="button" class="rd-ibtn" title="'+esc(t('lib_back'))+'" onclick="libMbBackToFolders()">'+libIcon('back',13,2.2)+'</button>'
        +'<h2 class="rd-h3">'+esc(entry.name)+'</h2>'
      +'</div>'
      +'<div class="rd-actions"><span class="rd-hint">'+images.length+' '+esc(isES?'imagen(es)':'image(s)')+'</span></div>'
      +'</div>';
    if(!images.length){
      return breadcrumb+libEmptyState('upload',
        isES?'Sin imágenes aún':'No images yet',
        isES?'Usa el botón "Subir imágenes" para agregar fotos a este moodboard.':'Use the "Upload images" button to add photos to this moodboard.',
        '<button class="btn btn-primary" onclick="libMoodboardUploadImages(\''+entry.id+'\')">'
        +libIcon('upload',14,2)+esc(t('lib_upload_images'))+'</button>');
    }
    return breadcrumb
      +'<div class="mb-gallery">'
      +images.map(function(src,i){
        var spanClass = typeof mbSpanClass === 'function' ? mbSpanClass(i, images.length) : '';
        return '<div class="mb-card mb-bento-item '+spanClass+'" onclick="libMbLightbox(\''+_mbOpenFolderId+'\','+i+')">'
          +'<div class="media-zoom" style="position:relative;overflow:hidden;cursor:zoom-in;flex:1;min-height:0">'
          +'<img src="'+esc(src)+'" class="media-zoom-img" alt="'+esc(isES?'Imagen ampliada':'Zoomed image')+'" style="width:100%;height:100%;object-fit:cover;display:block" draggable="false">'
          +'<div class="media-zoom-overlay"></div>'
          +'<div class="mb-meta"><div class="mb-meta-title">'+esc(entry.name)+'</div><div class="mb-meta-sub">Moodboard</div></div>'
          +'</div>'
          +'<div class="mb-card-actions" style="opacity:1">'
          +'<button class="icon-btn icon-btn-danger" onclick="event.stopPropagation();libMoodboardDeleteImage(\''+_mbOpenFolderId+'\','+i+')" title="'+esc(isES?'Eliminar':'Delete')+'">'
          +'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
          +'</div></div>';
      }).join('')
      +'</div>'
      +renderMobileStickyActionBar('<button class="btn btn-primary" onclick="libMoodboardUploadImages(\''+_mbOpenFolderId+'\')">'+esc(t('lib_upload_images'))+'</button>');
  }

  if(!lib.moodboards.length){
    return libEmptyState('mood',
      isES?'Crea tu primer moodboard':'Create your first moodboard',
      isES?'Organiza imágenes de inspiración en moodboards reutilizables para tus eventos.':'Organize inspiration images in reusable moodboards for your events.',
      '<button class="btn btn-primary" onclick="libCreateMoodboardFolder()">'
      +libIcon('plus',14,2.4)+esc(isES?'Crear primer moodboard':'Create first moodboard')+'</button>');
  }
  var rows=lib.moodboards.map(function(e){ return _libMbRow(e,isES); }).join('');
  return '<div class="rd-table">'
    +'<div class="rd-table-tools">'
      +libSearchBox(t('lib_search_groups'),'libFilterMoodboards(this.value)')
      +'<button id="lib-mb-bulk-load-btn" class="btn btn-sm" style="display:none" onclick="libLoadSelectedMoodboards()">'+esc(t('lib_load'))+'</button>'
      +'<button id="lib-mb-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none" onclick="libDeleteSelectedMoodboards()">'+esc(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div class="rd-table-scroll"><div style="min-width:900px">'
      +'<div class="rd-thead" style="grid-template-columns:'+LIB_GRID_MB+'">'
        +'<span>'+libCheck('','','libToggleAllMoodboards(this.checked)','lib-mb-chk-all',isES?'Seleccionar todos':'Select all')+'</span>'
        +'<span>'+esc(t('lib_name_col'))+'</span>'
        +'<span style="text-align:center">'+esc(isES?'Imágenes':'Images')+'</span>'
        +'<span style="text-align:center">'+esc(isES?'Carpetas':'Folders')+'</span>'
        +'<span>'+esc(t('lib_date_col'))+'</span>'
        +'<span></span>'
      +'</div>'
      +'<div id="lib-mb-rows">'+rows+'</div>'
    +'</div></div></div>'
    +renderMobileStickyActionBar('<button class="btn btn-primary" onclick="libCreateMoodboardFolder()">'+esc(t('lib_new_moodboard'))+'</button>');
}

var _mbLightboxId = null;
var _mbLightboxIdx = 0;

function libMbLightbox(id, idx){
  var lib=getLib();
  var entry=lib.moodboards.find(function(e){return e.id===id;});
  if(!entry||!entry.images||!entry.images.length) return;
  _mbLightboxId=id; _mbLightboxIdx=idx;
  var items = entry.images.map(function(src, imageIdx){
    return { src: src, name: entry.name+' '+(imageIdx+1) };
  });
  openLightbox(items[idx].src, items[idx].name, items, idx);
}

function libMbLightboxNav(dir){
  if(typeof lightboxGo === 'function') lightboxGo(_lightboxIndex + dir);
}

function libMbLightboxClose(){
  if(typeof closeLightbox === 'function') closeLightbox({ target: document.getElementById('lightbox') });
}

function libLoadVendors(entryId){
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  if(!entry.vendors.length) return toast(LANG==='es'?'Este grupo está vacío':'This group is empty','e');
  libOpenEventPickerModal(entry.vendors);
}
function libAddVendorsToCurrentProject(vendors){
  var p = proj(); if(!p) return 0;
  if(!p.vendors) p.vendors = [];
  var existingNames = (p.vendors||[]).map(function(v){ return String(v.name||'').toLowerCase(); });
  var added = 0;
  (vendors||[]).forEach(function(v){
    var name = String((v&&v.name)||'').toLowerCase();
    if(!name || existingNames.indexOf(name)!==-1) return;
    var nv = JSON.parse(JSON.stringify(v));
    nv.id = 'v'+Date.now()+Math.random().toString(36).slice(2,6);
    nv.payments = [];
    p.vendors.push(nv);
    existingNames.push(name);
    added++;
  });
  saveProj(p);
  return added;
}
function _doLibLoadVendors(entryId){
  var lib = getLib();
  var entry = lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var added = libAddVendorsToCurrentProject(entry.vendors);
  toast(t('lib_loaded')+' ('+added+' '+(LANG==='es'?'agregados':'added')+')','s');
  if(CTAB==='budget') renderBudget();
}

function libLoadTasks(entryId){
  var lib=getLib();
  var entry=lib.tasks.find(function(e){return e.id===entryId;});
  if(!entry) return;
  if(!entry.tasks.length) return toast(LANG==='es'?'Este grupo está vacío':'This group is empty','e');
  libOpenTaskEventPickerModal(entry.tasks);
}
function _doLibLoadTasks(entryId){
  var lib = getLib();
  var entry = lib.tasks.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var p = proj(); if(!p) return;
  entry.tasks.forEach(function(tk){
    var nt = JSON.parse(JSON.stringify(tk));
    nt.id = 't'+Date.now()+Math.random().toString(36).slice(2,6);
    nt.done = false; nt.dueDate = '';
    p.tasks.push(nt);
  });
  saveProj(p);
  toast(t('lib_loaded'),'s');
  if(CTAB==='timeline') renderTimeline();
}

function libLoadLayout(entryId){
  var lib = getLib();
  var entry = lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry) return;
  openMo('<div class="mo-title">'+t('lib_load_from')+': '+esc(entry.name)+'</div>'
    +'<p class="s-hint">'
    +(LANG==='es'
      ? 'Esto reemplazará el plano actual del proyecto. El plano existente se perderá.'
      : 'This will replace the current project layout. The existing layout will be lost.')
    +'</p>'
    +(entry.floorplan&&(entry.floorplan.img||entry.floorplan.thumb||entry.floorplan._idb)
      ? '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px">'
        +'<input type="checkbox" id="lib-load-floor" checked style="accent-color:var(--gold-h)">'
        +(LANG==='es'?'Incluir imagen de plano de piso':'Include floorplan image')
        +'</label>'
      : '')
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_doLibLoadLayout(\''+entryId+'\')">'+t('lib_load_btn')+'</button>'
    +'</div>');
}
function _doLibLoadLayout(entryId){
  var p = proj(); if(!p) return;
  // Load into the event through the current multi-layout model so it becomes a proper
  // read-only export entry (eventLayouts) — the old raw-item copy below made renderLayout
  // treat the event as un-migrated and spawned duplicate 'll_mig_' library entries.
  if(typeof libApplyLayoutExportToEvent==='function'){
    libApplyLayoutExportToEvent(entryId, p.id, {toastSuccess:true});
    return;
  }
  // Legacy fallback (only if the modern path is unavailable)
  var lib = getLib();
  var entry = lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry) return;
  p.layoutItems = JSON.parse(JSON.stringify(entry.items||[]));
  if(typeof lHistoryReset==='function') lHistoryReset();
  var incFloor = document.getElementById('lib-load-floor');
  if(entry.floorplan && (!incFloor || incFloor.checked)){
    p.floorplan = JSON.parse(JSON.stringify(entry.floorplan));
  } else {
    delete p.floorplan;
    LState.floorplan = {img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0};
  }
  saveProj(p);
  toast(t('lib_loaded'),'s');
  if(CTAB==='layout'){
    renderLayout();
    setTimeout(function(){ if(typeof lZoom==='function') lZoom(0,'fit'); },160);
  }
}
function libLoadTypes(type){
  var lib = getLib();
  var packs = lib[type+'_packs']||[];
  if(!packs.length){ toast(LANG==='es'?'No hay packs guardados':'No packs saved','e'); return; }
  if(packs.length===1){ _doLibLoadTypesPack(type, packs[0].id); return; }
  openMo('<div class="mo-title">'+t('lib_load_from')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">'
    +packs.map(function(pk){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px">'
        +'<div><div style="font-weight:600;font-size:13px">'+esc(pk.name)+'</div>'
        +'<div class="s-sm">'+Object.keys(pk.data).length+' '+(LANG==='es'?'tipos':'types')+' · '+pk.date+'</div></div>'
        +'<button class="btn btn-primary btn-sm" onclick="closeMo();_doLibLoadTypesPack(\''+type+'\',\''+pk.id+'\')">'+t('lib_load_btn')+'</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button></div>');
}
function libLoadTypesPack(type, packId){ _doLibLoadTypesPack(type, packId); }
function _doLibLoadTypesPack(type, packId){
  var lib = getLib();
  var packs = lib[type+'_packs']||[];
  var pack = packs.find(function(pk){return pk.id===packId;});
  if(!pack) return;
  var p = proj();
  Object.entries(pack.data).forEach(function(kv){
    var k=kv[0], v=kv[1];
    if(type==='chairs')       CHAIR_TYPES[k] = v;
    else if(type==='centerpieces') CENTERPIECE_TYPES[k] = v;
    else LSHAPES_M[k] = v;
  });
  if(p){
    if(type==='chairs')       { p.chairTypes=CHAIR_TYPES; }
    else if(type==='centerpieces'){ p.centerpieceTypes=CENTERPIECE_TYPES; }
    else                      { p.customShapes=LSHAPES_M; }
    saveProj(p);
  }
  toast(t('lib_loaded'),'s');
  if(CTAB==='layout') renderLayout();
}

function libLoadMoodboard(entryId){
  var lib = getLib();
  var entry = lib.moodboards.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var totalImgs = (entry.images||[]).length
    + (entry.uncategorized||[]).length
    + (entry.folders||[]).reduce(function(s,f){return s+f.images.length;},0);
  var folderCount = (entry.folders||[]).length + ((entry.images||[]).length ? 1 : 0) + ((entry.uncategorized||[]).length ? 1 : 0);
  openMo('<div class="mo-title">'+t('lib_load_from')+': '+esc(entry.name)+'</div>'
    +'<p class="s-hint">'
    +(LANG==='es'
      ? totalImgs+' imagen(es) y '+folderCount+' carpeta(s) serán añadidas al moodboard actual.'
      : totalImgs+' image(s) and '+folderCount+' folder(s) will be merged into the current moodboard.')
    +'</p>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_doLibLoadMoodboard(\''+entryId+'\')">'+t('lib_load_btn')+'</button>'
    +'</div>');
}
function libMergeMoodboardsToCurrentProject(entries){
  var p = proj(); if(!p) return 0;
  var mb = getMB(p);
  var added = 0;
  (entries||[]).forEach(function(entry){
    if(!entry) return;
    var legacyImages = JSON.parse(JSON.stringify(entry.images||[]));
    if(legacyImages.length){
      mb.folders.push({
        id:'f'+Date.now()+Math.random().toString(36).slice(2,6),
        name:(entry.name||'Moodboard'),
        color:'#6b7280',
        images: legacyImages.map(function(src, idx){
          return typeof src === 'string'
            ? { id:'mi'+Date.now()+idx, src:src, name:(entry.name||'Moodboard')+' '+(idx+1), mimeType:'image/*' }
            : src;
        })
      });
      added += legacyImages.length;
    }
    var loose = JSON.parse(JSON.stringify(entry.uncategorized||[]));
    if(loose.length){
      mb.folders.push({
        id:'f'+Date.now()+Math.random().toString(36).slice(2,6),
        name:(entry.name||'Moodboard')+' Images',
        color:'#6b7280',
        images: loose
      });
      added += loose.length;
    }
    (entry.folders||[]).forEach(function(f){
      var newF = JSON.parse(JSON.stringify(f));
      newF.id = 'f'+Date.now()+Math.random().toString(36).slice(2,6);
      mb.folders.push(newF);
      added += (newF.images||[]).length;
    });
  });
  p.moodboard = mb;
  saveProj(p);
  return added;
}
function _doLibLoadMoodboard(entryId){
  var lib = getLib();
  var entry = lib.moodboards.find(function(e){return e.id===entryId;});
  if(!entry) return;
  libMergeMoodboardsToCurrentProject([entry]);
  toast(t('lib_loaded'),'s');
  if(CTAB==='moodboard') renderMoodboard();
}

function libQuickSaveVendors(){ if(!proj()) return; libSaveVendorsModal(proj()); }
function libQuickSaveTasks(){   if(!proj()) return; libSaveTasksModal(proj()); }

function libQuickSaveMoodboard(){if(!proj()) return; libSaveMoodboardModal(proj()); }
function libQuickLoadMoodboards(){
  var lib=getLib(); if(!lib.moodboards.length) return toast(LANG==='es'?'No hay moodboards guardados en la biblioteca':'No moodboards saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_moodboards')+'</div>'
    +'<div class="s-hint" style="margin-bottom:12px">'+(LANG==='es'?'Selecciona uno o varios moodboards para importarlos al evento actual.':'Select one or more moodboards to import into the current event.')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'
    +(lib.moodboards||[]).map(function(entry){
      var totalImgs = (entry.images||[]).length + (entry.uncategorized||[]).length + (entry.folders||[]).reduce(function(s,f){ return s + ((f.images||[]).length); }, 0);
      var folderCount = (entry.folders||[]).length + ((entry.images||[]).length ? 1 : 0) + ((entry.uncategorized||[]).length ? 1 : 0);
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer">'
        +'<input type="checkbox" class="lib-quick-mb-sel" data-id="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);margin-top:2px;flex-shrink:0">'
        +'<div style="min-width:0">'
        +'<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(entry.name)+'</div>'
        +'<div class="s-sm">'+totalImgs+' '+(LANG==='es'?'imagen(es)':'image(s)')+' · '+folderCount+' '+(LANG==='es'?'carpeta(s)':'folder(s)')+'</div>'
        +'</div>'
        +'</label>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button><button class="btn btn-primary" onclick="libQuickImportSelectedMoodboards()">'+(LANG==='es'?'Importar seleccionados':'Import selected')+'</button></div>');
}
function libQuickImportSelectedMoodboards(){
  var lib = getLib();
  var selected = Array.from(document.querySelectorAll('.lib-quick-mb-sel:checked'));
  if(!selected.length) return toast(LANG==='es'?'Selecciona al menos un moodboard':'Select at least one moodboard','e');
  var entries = [];
  selected.forEach(function(chk){
    var entry = (lib.moodboards||[]).find(function(item){ return item.id===chk.dataset.id; });
    if(entry) entries.push(entry);
  });
  var added = libMergeMoodboardsToCurrentProject(entries);
  closeMo();
  toast((LANG==='es' ? added+' imagen(es) importadas' : added+' image(s) imported'),'s');
  if(typeof renderMoodboard==='function' && typeof CTAB!=='undefined' && CTAB==='moodboard') renderMoodboard();
}
function libQuickLoadVendors(){
  var lib=getLib(); if(!lib.vendors.length) return toast(LANG==='es'?'No hay grupos de proveedores guardados en la biblioteca':'No vendor groups saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var isES=LANG==='es';
  var rows=(lib.vendors||[]).map(function(e){
    var vCount=(e.vendors||[]).length;
    return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer">'
      +'<input type="checkbox" class="lib-quick-vendor-sel" data-entry-id="'+e.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);margin-top:2px;flex-shrink:0">'
      +'<div style="min-width:0">'
      +'<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(e.name)+'</div>'
      +'<div class="s-sm">'+vCount+' '+(isES?'proveedor(es)':'vendor(s)')+' · '+esc(e.date||'')+'</div>'
      +'</div></label>';
  }).join('');
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_vendors')+'</div>'
    +'<div class="s-hint" style="margin-bottom:12px">'+(isES?'Selecciona uno o varios grupos para agregarlos al evento actual. Los duplicados se omitirán.':'Select one or more groups to add to the current event. Duplicates will be skipped.')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'+rows+'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button><button class="btn btn-primary" onclick="libQuickImportSelectedVendors()">'+(isES?'Importar seleccionados':'Import selected')+'</button></div>');
}
function libQuickImportSelectedVendors(){
  var lib=getLib();
  var selected=Array.from(document.querySelectorAll('.lib-quick-vendor-sel:checked'));
  if(!selected.length) return toast(LANG==='es'?'Selecciona al menos un grupo':'Select at least one group','e');
  var vendors=[];
  selected.forEach(function(chk){
    var entry=lib.vendors.find(function(e){return e.id===chk.dataset.entryId;});
    if(entry) (entry.vendors||[]).forEach(function(v){vendors.push(v);});
  });
  var added=libAddVendorsToCurrentProject(vendors);
  closeMo();
  toast((LANG==='es'?added+' proveedor(es) agregados':added+' vendor(s) added'),'s');
  if(typeof renderBudget==='function' && typeof CTAB!=='undefined' && CTAB==='budget') renderBudget();
}
function libQuickLoadTasks(){
  var lib=getLib(); if(!(lib.tasks||[]).length) return toast(LANG==='es'?'No hay grupos de tareas guardados en la biblioteca':'No task groups saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  var isES=LANG==='es';
  var rows=(lib.tasks||[]).map(function(e){
    var tCount=(e.tasks||[]).length;
    return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer">'
      +'<input type="checkbox" class="lib-quick-task-sel" data-entry-id="'+e.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);margin-top:2px;flex-shrink:0">'
      +'<div style="min-width:0">'
      +'<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(e.name)+'</div>'
      +'<div class="s-sm">'+tCount+' '+(isES?'tarea(s)':'task(s)')+' · '+esc(e.date||'')+'</div>'
      +'</div></label>';
  }).join('');
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_tasks')+'</div>'
    +'<div class="s-hint" style="margin-bottom:12px">'+(isES?'Selecciona uno o varios grupos para importarlos al evento actual. Las fechas se borrarán para que puedas ajustarlas. Los duplicados se omitirán.':'Select one or more groups to import into the current event. Dates will be cleared so you can set them for the new project. Duplicates will be skipped.')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'+rows+'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button><button class="btn btn-primary" onclick="libQuickImportSelectedTasks()">'+(isES?'Importar seleccionados':'Import selected')+'</button></div>');
}
function libQuickImportSelectedTasks(){
  var lib=getLib();
  var selected=Array.from(document.querySelectorAll('.lib-quick-task-sel:checked'));
  if(!selected.length) return toast(LANG==='es'?'Selecciona al menos un grupo':'Select at least one group','e');
  var tasks=[];
  selected.forEach(function(chk){
    var entry=(lib.tasks||[]).find(function(e){return e.id===chk.dataset.entryId;});
    if(entry) (entry.tasks||[]).forEach(function(tk){tasks.push(tk);});
  });
  var added=libAddTasksToCurrentProject(tasks);
  closeMo();
  toast((LANG==='es'?added+' tarea(s) importadas':added+' task(s) imported'),'s');
  if(typeof renderTimeline==='function' && typeof CTAB!=='undefined' && CTAB==='timeline') renderTimeline();
}
function libQuickLoadLayout(){
  var lib=getLib(); if(!lib.layouts.length) return toast(LANG==='es'?'No hay planos guardados en la biblioteca':'No layouts saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  if(lib.layouts.length===1){ libLoadLayout(lib.layouts[0].id); return; }
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_layouts')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'
    +lib.layouts.map(function(e){
      var seats=e.items.reduce(function(s,i){return s+(i.chairs||0);},0);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px">'
        +'<div><div style="font-weight:600;font-size:13px">'+esc(e.name)+'</div>'
        +'<div class="s-sm">'+e.items.length+' elem · '+seats+' '+(LANG==='es'?'asientos':'seats')+' · '+e.date+'</div></div>'
        +"<button class=\"btn btn-primary btn-sm\" onclick=\"closeMo();libLoadLayout('"+e.id+"')\">"+t('lib_load_btn')+'</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button></div>');
}

window.openLibrary = openLibrary;
window.setLibTab = setLibTab;
window.libDelete = libDelete;
window.libSaveModal = libSaveModal;
window.libSaveVendorsDo = libSaveVendorsDo;
window.libSaveTasksDo = libSaveTasksDo;
window.libSaveLayoutDo = libSaveLayoutDo;
window.libSaveTypesDo = libSaveTypesDo;
window.libSaveMoodboardDo = libSaveMoodboardDo;
window.libCreateMoodboardFolder = libCreateMoodboardFolder;
window.libCreateMoodboardFolderDo = libCreateMoodboardFolderDo;
window.libEditMoodboardFolder = libEditMoodboardFolder;
window.libEditMoodboardFolderDo = libEditMoodboardFolderDo;
window.libDuplicateMoodboardFolder = libDuplicateMoodboardFolder;
window.libOpenMoodboardFolder = libOpenMoodboardFolder;
window.libMoodboardUploadImages = libMoodboardUploadImages;
window.libMoodboardDeleteImage = libMoodboardDeleteImage;
window.libFilterMoodboards = libFilterMoodboards;
window.libMbLightbox = libMbLightbox;
window.libMbLightboxNav = libMbLightboxNav;
window.libMbLightboxClose = libMbLightboxClose;
window.libMbBackToFolders = libMbBackToFolders;
window.libMoodboardUploadConfirm = libMoodboardUploadConfirm;
window.libLoadMoodboard = libLoadMoodboard;
window.libQuickLoadMoodboards = libQuickLoadMoodboards;
window.libQuickImportSelectedMoodboards = libQuickImportSelectedMoodboards;
window.libLoadVendors = libLoadVendors;
window.libLoadTasks = libLoadTasks;
window.libLoadLayout = libLoadLayout;

// ── Library Layout Wizard ─────────────────────────────────────────────────
var _libLayoutWiz = {};
var _libEditingLayoutId = null;

// Dance floor size lookup tables (meters)
var _dfSquareTable = [
  {guests:80,  w:4.88, h:3.66},
  {guests:100, w:4.88, h:4.88},
  {guests:150, w:6.1,  h:4.88},
  {guests:200, w:6.1,  h:6.1},
  {guests:250, w:7.32, h:6.1},
  {guests:300, w:7.32, h:7.32},
  {guests:350, w:8.54, h:7.32},
  {guests:400, w:8.54, h:8.54},
  {guests:450, w:9.76, h:8.54},
  {guests:500, w:9.76, h:9.76},
  {guests:550, w:12.2, h:8.54},
  {guests:600, w:10.98,h:9.76},
  {guests:650, w:10.98,h:10.98},
  {guests:700, w:14.64,h:8.54},
  {guests:750, w:12.2, h:10.98},
  {guests:800, w:14.64,h:9.76},
  {guests:850, w:12.2, h:12.2},
  {guests:900, w:14.64,h:10.98},
  {guests:950, w:13.42,h:12.2},
  {guests:1000,w:14.64,h:12.2},
  {guests:1800,w:19.52,h:17.08},
];
var _dfRoundTable = [
  {guests:50,  d:3.5},
  {guests:150, d:5.2},
  {guests:200, d:6.9},
  {guests:300, d:7.7},
  {guests:350, d:8.6},
  {guests:400, d:9.5},
  {guests:450, d:10.4},
  {guests:500, d:11.2},
  {guests:650, d:12},
];

function _dfSuggestSquare(guests){
  var g=parseInt(guests)||0;
  var found=_dfSquareTable[0];
  for(var i=0;i<_dfSquareTable.length;i++){if(_dfSquareTable[i].guests>=g){found=_dfSquareTable[i];break;}}
  return found;
}
function _dfSuggestRound(guests){
  var g=parseInt(guests)||0;
  if(g<=0) return {d:0};
  var found=_dfRoundTable[_dfRoundTable.length-1];
  for(var i=0;i<_dfRoundTable.length;i++){if(_dfRoundTable[i].guests>=g){found=_dfRoundTable[i];break;}}
  return found;
}

function libOpenLayoutWizard(){
  _libLayoutWiz={step:0,guests:100,dfShape:'square',dfW:4.88,dfH:4.88,dfD:3.5,bar:true,barW:0,barH:0.4,platform:true,platW:3.66,platH:2.44,dj:true,djW:3.66,djH:1.22,stage:true,stageW:3.66,stageH:2.44,tables:{},floorplan:null,wizScalePts:[],wizZoom:1};
  var sq=_dfSuggestSquare(100);
  _libLayoutWiz.dfW=sq.w; _libLayoutWiz.dfH=sq.h;
  _libLayoutWiz.barW=Math.min(sq.w,sq.h);
  var rd=_dfSuggestRound(100);
  _libLayoutWiz.dfD=rd.d;
  _libRenderLayoutWizard();
}
window.libOpenLayoutWizard = libOpenLayoutWizard;

document.addEventListener('keydown', function(e){
  if(!_libLayoutWiz || e.key !== 'Enter' || e.shiftKey) return;
  var modal = document.getElementById('mo');
  if(!modal || !modal.classList.contains('open')) return;
  var active = document.activeElement;
  if(active){
    var tag = active.tagName;
    var type = (active.type || '').toLowerCase();
    if(tag === 'TEXTAREA' || tag === 'BUTTON' || type === 'file') return;
    if(_libLayoutWiz.step === 4 && active.id === 'lwiz-scale-dist'){
      e.preventDefault();
      _libWizApplyScale();
      return;
    }
  }
  e.preventDefault();
  if(_libLayoutWiz.step < 4){
    _libLayoutWizNext();
    return;
  }
  if(!_libLayoutWiz.floorplanLoading){
    _libLayoutWizGenerate();
  }
});

function _libRenderLayoutWizard(){
  var w=_libLayoutWiz; var isES=LANG==='es';
  var s=w.step;
  var steps=[
    isES?'Invitados':'Guests',
    isES?'Pista de Baile':'Dance Floor',
    isES?'Elementos':'Elements',
    isES?'Mesas':'Tables',
    isES?'Plano de Piso':'Floorplan',
  ];
  var prog='<div style="display:flex;align-items:center;gap:0;margin-bottom:28px">';
  steps.forEach(function(lbl,i){
    var done=i<s; var active=i===s;
    var bg=done?'var(--gold)':(active?'var(--gold-l)':'var(--bg2)');
    var bd=(done||active)?'var(--gold)':'var(--border)';
    var clr=done?'#fff':(active?'var(--gold-h)':'var(--muted)');
    var line=i>0?'<div style="flex:1;height:1px;background:'+(i<=s?'var(--gold)':'var(--border)')+'"></div>':'';
    prog+=line+'<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
      +'<div style="width:28px;height:28px;border-radius:50%;border:1.5px solid '+bd+';background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:'+clr+';z-index:1">'
      +(done?'✓':String(i+1))+'</div>'
      +'<div style="font-size:10px;margin-top:4px;color:'+(active?'var(--gold-h)':'var(--muted)')+';white-space:nowrap">'+lbl+'</div>'
      +'</div>';
  });
  prog+='</div>';

  var body='';
  if(s===0){
    body='<div style="text-align:center;padding:10px 0 20px">'
      +'<svg width="48" height="48" fill="none" stroke="var(--gold-h)" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 12px;display:block"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
      +'<div style="font-size:16px;font-weight:700;margin-bottom:6px">'+(isES?'¿Cuántos invitados?':'How many guests?')+'</div>'
      +'<div style="color:var(--muted);font-size:13px;margin-bottom:20px">'+(isES?'Usaremos esto para sugerir el tamaño de la pista de baile.':'We\'ll use this to suggest the dance floor size.')+'</div>'
      +'<input class="input" id="lwiz-guests" type="number" min="1" value="'+w.guests+'" style="max-width:160px;font-size:20px;text-align:center;padding:10px" oninput="_libLayoutWiz.guests=this.value">'
      +'</div>';
  } else if(s===1){
    var sqRec=_dfSuggestSquare(w.guests); var rdRec=_dfSuggestRound(w.guests);
    body='<div style="font-size:15px;font-weight:700;margin-bottom:16px">'+(isES?'Pista de Baile':'Dance Floor')+'</div>'
      +'<div style="display:flex;gap:12px;margin-bottom:20px">'
      +['square','round'].map(function(shape){
        var lbl=shape==='square'?(isES?'Cuadrada / Rectangular':'Square / Rectangular'):(isES?'Redonda':'Round');
        var active=w.dfShape===shape;
        return '<div onclick="_libLayoutWiz.dfShape=\''+shape+'\';_libRenderLayoutWizard()" style="flex:1;border:2px solid '+(active?'var(--gold)':'var(--border)')+';border-radius:var(--r-lg);padding:16px;text-align:center;cursor:pointer;background:'+(active?'var(--gold-l)':'var(--card)')+';">'
          +(shape==='square'?'<svg width="40" height="40" viewBox="0 0 40 40" style="margin:0 auto 8px;display:block"><rect x="4" y="4" width="32" height="32" fill="var(--gold-l)" stroke="var(--gold-h)" stroke-width="2"/></svg>'
            :'<svg width="40" height="40" viewBox="0 0 40 40" style="margin:0 auto 8px;display:block"><circle cx="20" cy="20" r="16" fill="var(--gold-l)" stroke="var(--gold-h)" stroke-width="2"/></svg>')
          +'<div style="font-weight:600;font-size:13px">'+lbl+'</div>'
          +'</div>';
      }).join('')
      +'</div>';
    if(w.dfShape==='square'){
      body+='<div style="background:var(--bg2);border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:12px;color:var(--muted)">'
        +'💡 '+(isES?'Tamaño sugerido para '+w.guests+' invitados: ':'Suggested size for '+w.guests+' guests: ')
        +'<strong>'+sqRec.w+'m × '+sqRec.h+'m</strong>'
        +'</div>'
        +'<div class="form-grid">'
        +'<div class="ig"><label>'+(isES?'Ancho (m)':'Width (m)')+'</label><input class="input" id="lwiz-df-w" type="number" step="0.1" value="'+w.dfW+'" oninput="_libLayoutWiz.dfW=parseFloat(this.value)||'+sqRec.w+';_libLayoutWiz.barW=Math.min(parseFloat(this.value)||'+sqRec.w+',_libLayoutWiz.dfH)"></div>'
        +'<div class="ig"><label>'+(isES?'Alto (m)':'Height (m)')+'</label><input class="input" id="lwiz-df-h" type="number" step="0.1" value="'+w.dfH+'" oninput="_libLayoutWiz.dfH=parseFloat(this.value)||'+sqRec.h+'"></div>'
        +'</div>';
    } else {
      body+='<div style="background:var(--bg2);border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:12px;color:var(--muted)">'
        +'💡 '+(isES?'Diámetro sugerido para '+w.guests+' invitados: ':'Suggested diameter for '+w.guests+' guests: ')
        +'<strong>'+rdRec.d+'m</strong>'
        +'</div>'
        +'<div class="ig"><label>'+(isES?'Diámetro (m)':'Diameter (m)')+'</label><input class="input" id="lwiz-df-d" type="number" step="0.1" value="'+w.dfD+'" oninput="_libLayoutWiz.dfD=parseFloat(this.value)||'+rdRec.d+'"></div>';
    }
  } else if(s===2){
    function elemRow(key, labelEN, labelES, enabled, defW, defH, wId, hId){
      return '<div style="border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px">'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(enabled?'12px':'0')+'">'
        +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">'
        +'<input type="checkbox" '+(enabled?'checked':'')+' style="width:16px;height:16px;accent-color:var(--gold-h)" onchange="_libLayoutWiz.'+key+'=this.checked;_libRenderLayoutWizard()">'
        +'<span style="font-weight:600;font-size:13px">'+(isES?labelES:labelEN)+'</span>'
        +'</label></div>'
        +(enabled?'<div class="form-grid">'
          +'<div class="ig"><label>'+(isES?'Ancho (m)':'Width (m)')+'</label><input class="input" id="'+wId+'" type="number" step="0.1" value="'+defW+'" oninput="_libLayoutWiz.'+key+'W=parseFloat(this.value)||'+defW+'"></div>'
          +'<div class="ig"><label>'+(isES?'Alto (m)':'Height (m)')+'</label><input class="input" id="'+hId+'" type="number" step="0.1" value="'+defH+'" oninput="_libLayoutWiz.'+key+'H=parseFloat(this.value)||'+defH+'"></div>'
          +'</div>':'')
        +'</div>';
    }
    body='<div style="font-size:15px;font-weight:700;margin-bottom:16px">'+(isES?'Elementos Adicionales':'Additional Elements')+'</div>'
      +elemRow('bar',    'Shot Bar',        'Barra de Shots',   w.bar,     w.barW,   w.barH,   'lwiz-bar-w',  'lwiz-bar-h')
      +elemRow('platform','Dinner Platform','Plataforma Cena',  w.platform,w.platW,  w.platH,  'lwiz-plat-w', 'lwiz-plat-h')
      +elemRow('dj',     'DJ Booth',        'Cabina de DJ',     w.dj,      w.djW,    w.djH,    'lwiz-dj-w',   'lwiz-dj-h')
      +elemRow('stage',  'Stage',           'Escenario',        w.stage,   w.stageW, w.stageH, 'lwiz-stage-w','lwiz-stage-h');
  } else if(s===3){
    if(!w.tables||Array.isArray(w.tables)) w.tables={};

    // Catalogue: matches layout editor's Add Table modal format
    var catalogue=[
      // Round — ordered by seating capacity
      {key:'round-1.2', cat:'round',label:'4 seats',dim:'1.2m',wM:1.2,hM:1.2,chairs:4,cols:5},
      {key:'round-1.5', cat:'round',label:'6 seats',dim:'1.5m',wM:1.5,hM:1.5,chairs:6,cols:5},
      {key:'round-1.8', cat:'round',label:'8 seats',dim:'1.8m',wM:1.8,hM:1.8,chairs:8,cols:4},
      {key:'round-2.0', cat:'round',label:'10 seats',dim:'2.0m',wM:2.0,hM:2.0,chairs:10,cols:4},
      // Rectangular — ordered by seating capacity
      {key:'rect-2.44x1.20',cat:'rect',label:'8 seats',dim:'2.44 x 1.20m',wM:2.44,hM:1.20,chairs:8,cols:4,chairSides:{top:4,bottom:4,left:0,right:0}},
      {key:'rect-4.88x1.80-12',cat:'rect',label:'12 seats',dim:'4.88 x 1.80m',wM:4.88,hM:1.80,chairs:12,cols:3,chairSides:{top:6,bottom:6,left:0,right:0}},
      {key:'rect-4.88x1.80-16',cat:'rect',label:'16 seats',dim:'4.88 x 1.80m',wM:4.88,hM:1.80,chairs:16,cols:3,chairSides:{top:6,bottom:6,left:2,right:2}},
      // Special — S-shaped tables
      {key:'s-table-14',cat:'s-table',label:'14 seats',dim:'4.0 x 1.5m',wM:4.0,hM:1.5,chairs:14,cols:2},
      {key:'s-table-16',cat:'s-table',label:'16 seats',dim:'4.5 x 1.5m',wM:4.5,hM:1.5,chairs:16,cols:2},
    ];

    // SVG table drawing — matches layout editor's Add Table modal style
    function drawTableSVGv2(item, selected){
      if(item.cat==='s-table') return _drawWizSTableSVG(item, selected);
      var SCALE=44;
      var CS=0.32*SCALE; var CG=0.06*SCALE;
      var tableFill=selected?'#e8dcc8':'#f0ece0';
      var chairFill=selected?'#9a7b5a':'#b08968';
      var tw=item.wM*SCALE; var th=item.hM*SCALE;
      var padX=CS+CG+2; var padY=CS+CG+2;
      var svgW=tw+padX*2; var svgH=th+padY*2;
      var tx=padX; var ty=padY;
      var chairs=''; var n=item.chairs;
      if(item.cat==='round'){
        var r=tw/2; var cx=tx+r; var cy=ty+r;
        for(var ci=0;ci<n;ci++){
          var ang=2*Math.PI*ci/n-Math.PI/2;
          var dist=r+CG+CS/2;
          var ccx=cx+dist*Math.cos(ang); var ccy=cy+dist*Math.sin(ang);
          chairs+='<circle cx="'+ccx.toFixed(1)+'" cy="'+ccy.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        chairs+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+tableFill+'"/>';
      } else {
        var _cs=item.chairSides||{top:Math.ceil(n/2),bottom:Math.floor(n/2),left:0,right:0};
        var _t=_cs.top||0, _b=_cs.bottom||0, _l=_cs.left||0, _r=_cs.right||0;
        for(var ci=0;ci<_t;ci++){
          var cx2=tx+(ci+0.5)*(tw/_t); var cy2=ty-CG-CS/2;
          chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        for(var ci=0;ci<_b;ci++){
          var cx2=tx+(ci+0.5)*(tw/_b); var cy2=ty+th+CG+CS/2;
          chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        for(var ci=0;ci<_l;ci++){
          var cy3=ty+(ci+0.5)*(th/_l);
          chairs+='<circle cx="'+(tx-CG-CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        for(var ci=0;ci<_r;ci++){
          var cy3=ty+(ci+0.5)*(th/_r);
          chairs+='<circle cx="'+(tx+tw+CG+CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        chairs+='<rect x="'+tx.toFixed(1)+'" y="'+ty.toFixed(1)+'" width="'+tw.toFixed(1)+'" height="'+th.toFixed(1)+'" rx="2" fill="'+tableFill+'"/>';
      }
      return '<svg viewBox="0 0 '+svgW.toFixed(0)+' '+svgH.toFixed(0)+'" width="'+svgW.toFixed(0)+'" height="'+svgH.toFixed(0)+'" style="display:block;overflow:visible">'+chairs+'</svg>';
    }

    function _drawWizSTableSVG(item, selected){
      var tableFill=selected?'#e8dcc8':'#f0ece0';
      var chairFill=selected?'#9a7b5a':'#b08968';
      var n=item.chairs; var half=Math.floor(n/2);
      var W=160; var H=72; var pad=16; var cr=6.5;
      var svgW=W+pad*2; var svgH=H+pad*2;
      var ox=pad; var oy=pad;
      var amp=14; var bh=H/2; var bandW=16;
      function topEdge(t){ return oy+bh-amp*Math.sin(t*Math.PI)-bandW+(bandW*0.35)*Math.sin(t*Math.PI); }
      function botEdge(t){ return oy+bh+amp*Math.sin(t*Math.PI)+bandW-(bandW*0.35)*Math.sin(t*Math.PI); }
      var pts=40; var topPath=''; var botPath='';
      for(var i=0;i<=pts;i++){var t=i/pts;var x=ox+t*W;topPath+=(i===0?'M':'L')+x.toFixed(1)+','+topEdge(t).toFixed(1);}
      for(var i=pts;i>=0;i--){var t=i/pts;var x=ox+t*W;botPath+='L'+x.toFixed(1)+','+botEdge(t).toFixed(1);}
      var path='<path d="'+topPath+botPath+'Z" fill="'+tableFill+'"/>';
      var chairs=''; var is16=n>=16;
      for(var ci=0;ci<half;ci++){
        var t=is16?(ci+0.5)/half:(ci+1)/(half+1);
        chairs+='<circle cx="'+(ox+t*W).toFixed(1)+'" cy="'+(topEdge(t)-cr-3).toFixed(1)+'" r="'+cr+'" fill="'+chairFill+'"/>';
      }
      for(var ci=0;ci<half;ci++){
        var t=is16?(ci+0.5)/half:(ci+1)/(half+1);
        chairs+='<circle cx="'+(ox+t*W).toFixed(1)+'" cy="'+(botEdge(t)+cr+3).toFixed(1)+'" r="'+cr+'" fill="'+chairFill+'"/>';
      }
      return '<svg viewBox="0 0 '+svgW+' '+svgH+'" width="'+svgW+'" height="'+svgH+'" style="display:block;overflow:visible">'+chairs+path+'</svg>';
    }

    var totalTables=0; var totalChairs=0;
    Object.keys(w.tables).forEach(function(k){
      var entry=w.tables[k]; if(!entry||!entry.n) return;
      var cat=catalogue.find(function(c){return c.key===k;});
      if(cat){totalTables+=entry.n; totalChairs+=entry.n*cat.chairs;}
    });

    function renderCatSection(catKey, titleEN, titleES){
      var items=catalogue.filter(function(c){return c.cat===catKey;});
      return '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">'+(isES?titleES:titleEN)+'</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
        +items.map(function(item){
          var sel=w.tables[item.key]&&w.tables[item.key].n>0;
          var cnt=(w.tables[item.key]||{}).n||0;
          return '<div onclick="_libWizToggleTable(\''+item.key+'\')" style="cursor:pointer;padding:8px 6px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s;min-width:72px;position:relative">'
            +drawTableSVGv2(item,sel)
            +'<div style="margin-top:5px;font-size:12px;font-weight:600;color:var(--text);line-height:1.2">'+item.label+'</div>'
            +'<div style="font-size:10px;color:var(--muted);margin-top:1px">'+(item.dim||'')+'</div>'
            +(sel
              ?'<div onclick="event.stopPropagation()" style="margin-top:5px"><input type="number" min="1" value="'+cnt+'" onchange="_libLayoutWiz.tables[\''+item.key+'\']||(_libLayoutWiz.tables[\''+item.key+'\']={chairs:'+item.chairs+',cols:'+item.cols+',chairType:\'default\',cp:\'none\'});_libLayoutWiz.tables[\''+item.key+'\'].n=parseInt(this.value)||1;_libRenderLayoutWizard()" oninput="_libLayoutWiz.tables[\''+item.key+'\']||(_libLayoutWiz.tables[\''+item.key+'\']={chairs:'+item.chairs+',cols:'+item.cols+',chairType:\'default\',cp:\'none\'});_libLayoutWiz.tables[\''+item.key+'\'].n=parseInt(this.value)||1" style="width:48px;text-align:center;padding:3px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:700;background:var(--bg)"><div style="font-size:9px;color:var(--muted);margin-top:1px">'+(isES?'cantidad':'qty')+'</div></div>'
              :'')
            +'</div>';
        }).join('')
        +'</div>';
    }

    body='<div style="font-size:15px;font-weight:700;margin-bottom:4px">'+(isES?'Mesas':'Tables')+'</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:10px">'+(isES?'Haz clic en una mesa para seleccionarla.':'Click a table to select it.')+'</div>'
      +renderCatSection('round', 'Round Tables',        'Mesas Redondas')
      +renderCatSection('rect',  'Rectangular Tables',  'Mesas Rectangulares')
      +renderCatSection('s-table','Special Tables',     'Mesas Especiales')
      +'<div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;display:flex;gap:24px;font-size:13px;margin-top:14px;flex-wrap:wrap">'
      +'<span><strong>'+totalTables+'</strong> '+(isES?'mesas':'tables')+'</span>'
      +'<span><strong>'+totalChairs+'</strong> '+(isES?'sillas':'chairs')+'</span>'
      +'</div>';
  }

  if(s===4){
    var wfp=_libLayoutWiz.floorplan;
    var pts=_libLayoutWiz.wizScalePts||[];
    if(_libLayoutWiz.floorplanLoading){
      body='<div style="text-align:center;padding:40px 0">'
        +'<div style="display:inline-block;width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--gold-h);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px"></div>'
        +'<div style="font-size:14px;color:var(--muted)">'+(isES?'Cargando imagen...':'Loading image...')+'</div>'
        +'</div>'
        +'<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    } else if(!wfp||!wfp.img){
      body='<div style="text-align:center;padding:10px 0 20px">'
        +'<div style="font-size:15px;font-weight:700;margin-bottom:6px">'+(isES?'Sube el plano de piso del venue':'Upload the venue floorplan')+'</div>'
        +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px">'+(isES?'Opcional — puedes omitir este paso y generar el layout.':'Optional — you can skip this step and generate the layout.')+'</div>'
        +'<label style="display:inline-flex;flex-direction:column;align-items:center;gap:12px;cursor:pointer;border:2px dashed var(--border);border-radius:var(--r-lg);padding:40px 60px;background:var(--bg2)" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
        +'<svg width="40" height="40" fill="none" stroke="var(--muted)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'
        +'<span style="font-size:13px;color:var(--muted)">'+(isES?'Haz clic para subir imagen':'Click to upload image')+'</span>'
        +'<input type="file" accept="image/*" style="display:none" onchange="_libWizFloorplanUpload(this)">'
        +'</label>'
        +'</div>';
    } else {
      var PREV_MAX=460;
      var imgW=wfp.w||1; var imgH=wfp.h||1;
      var zoom=_libLayoutWiz.wizZoom||1;
      var fitScale=Math.min(PREV_MAX/imgW, PREV_MAX/imgH, 1)*zoom;
      var dispW=Math.round(imgW*fitScale); var dispH=Math.round(imgH*fitScale);
      var svgOverlay='';
      if(pts.length>=1){
        var p0x=Math.round(pts[0].rx*dispW), p0y=Math.round(pts[0].ry*dispH);
        svgOverlay+='<circle cx="'+p0x+'" cy="'+p0y+'" r="7" fill="var(--gold)" stroke="#fff" stroke-width="2"/>'
          +'<text x="'+(p0x+10)+'" y="'+(p0y-8)+'" fill="var(--gold-h)" font-size="12" font-weight="700" font-family="monospace">A</text>';
      }
      if(pts.length>=2){
        var p0x2=Math.round(pts[0].rx*dispW), p0y2=Math.round(pts[0].ry*dispH);
        var p1x=Math.round(pts[1].rx*dispW), p1y=Math.round(pts[1].ry*dispH);
        svgOverlay+='<line x1="'+p0x2+'" y1="'+p0y2+'" x2="'+p1x+'" y2="'+p1y+'" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 3"/>'
          +'<circle cx="'+p1x+'" cy="'+p1y+'" r="7" fill="var(--gold)" stroke="#fff" stroke-width="2"/>'
          +'<text x="'+(p1x+10)+'" y="'+(p1y-8)+'" fill="var(--gold-h)" font-size="12" font-weight="700" font-family="monospace">B</text>';
      }
      var hint=pts.length===0
        ?(isES?'Haz clic en 2 puntos de tu imagen y especifica la dimensión en metros.':'Click 2 points in your image and specify the dimension in meters.')
        :pts.length===1
        ?(isES?'Ahora haz clic en el punto B.':'Now click point B.')
        :(isES?'Ingresa la distancia real entre A y B y presiona Aplicar.':'Enter the real-world distance between A and B, then click Apply.');
      var distRow=pts.length>=2
        ?'<div style="display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap">'
          +'<span style="font-size:13px;font-weight:600">'+(isES?'Distancia A→B en metros:':'Distance A→B in meters:')+'</span>'
          +'<input type="number" id="lwiz-scale-dist" step="0.1" min="0.1" placeholder="ej. 5.0" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">'
          +'<button class="btn btn-primary btn-sm" onclick="_libWizApplyScale()">'+(isES?'Aplicar':'Apply')+'</button>'
          +(wfp.pxPerMeter?'<span style="font-size:12px;color:#16a34a;font-weight:600">✓ '+(isES?'Calibrado':'Calibrated')+': '+wfp.pxPerMeter.toFixed(1)+' px/m</span>':'')
          +'</div>'
        :'';
      var zoomBar='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
        +'<span style="font-size:12px;color:var(--muted);font-weight:600">'+(isES?'Zoom:':'Zoom:')+'</span>'
        +'<button class="btn btn-ghost btn-sm" style="padding:2px 10px;font-size:16px;line-height:1" onclick="_libWizZoom(-0.25)"  >−</button>'
        +'<span style="font-size:12px;min-width:36px;text-align:center">'+Math.round(zoom*100)+'%</span>'
        +'<button class="btn btn-ghost btn-sm" style="padding:2px 10px;font-size:16px;line-height:1" onclick="_libWizZoom(0.25)">+</button>'
        +'<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="_libLayoutWiz.wizZoom=1;_libLayoutWiz.wizScalePts=[];_libRenderLayoutWizard()">'+(isES?'Restablecer':'Reset')+'</button>'
        +'</div>';
      var resetBtn='<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'
        +(pts.length>0?'<button class="btn btn-ghost btn-sm" onclick="_libLayoutWiz.wizScalePts=[];_libRenderLayoutWizard()">'+(isES?'Reiniciar puntos':'Reset points')+'</button>':'')
        +'<button class="btn btn-ghost btn-sm" onclick="_libLayoutWiz.floorplan=null;_libLayoutWiz.wizScalePts=[];_libLayoutWiz.wizZoom=1;_libRenderLayoutWizard()">'+(isES?'Cambiar imagen':'Change image')+'</button>'
        +'</div>';
      var baseW=Math.round(imgW*Math.min(PREV_MAX/imgW,PREV_MAX/imgH,1));
      var baseH=Math.round(imgH*Math.min(PREV_MAX/imgW,PREV_MAX/imgH,1));
      var viewW=Math.min(baseW,PREV_MAX); var viewH=Math.min(baseH,PREV_MAX);
      body='<div style="font-size:15px;font-weight:700;margin-bottom:4px">'+(isES?'Escala':'Scale')+'</div>'
        +'<div style="font-size:13px;color:var(--muted);margin-bottom:10px">'+hint+'</div>'
        +zoomBar
        +'<div id="lwiz-fp-preview" onclick="_libWizPickPoint(event,this)" onwheel="_libWizWheelZoom(event)" style="position:relative;width:'+viewW+'px;height:'+viewH+'px;overflow:auto;cursor:crosshair;border:1px solid var(--border);border-radius:6px;user-select:none">'
        +'<div style="position:relative;width:'+dispW+'px;height:'+dispH+'px">'
        +'<img src="'+wfp.img+'" alt="'+esc(LANG==='es'?'Plano del venue':'Venue floorplan')+'" style="display:block;width:'+dispW+'px;height:'+dispH+'px;pointer-events:none" draggable="false">'
        +'<svg style="position:absolute;top:0;left:0;pointer-events:none" width="'+dispW+'" height="'+dispH+'">'+svgOverlay+'</svg>'
        +'</div>'
        +'</div>'
        +distRow
        +resetBtn;
    }
  }

  var stickyFooter='';
  if(s===3){
    var tt2=0; var tc2=0;
    Object.keys(w.tables||{}).forEach(function(k){var e=w.tables[k];if(e&&e.n){tt2+=e.n;var allCats=[{key:'round-1.2',chairs:4},{key:'round-1.5',chairs:6},{key:'round-1.8',chairs:8},{key:'round-2.0',chairs:10},{key:'rect-2.44x1.20',chairs:8},{key:'rect-4.88x1.80-12',chairs:12},{key:'rect-4.88x1.80-16',chairs:16},{key:'s-table-14',chairs:14},{key:'s-table-16',chairs:16}];var cat=allCats.find(function(c){return c.key===k;});if(cat)tc2+=e.n*cat.chairs;}});
    stickyFooter='<div style="border-top:1px solid var(--border);padding:10px 0 0;margin-top:8px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      +'<span style="font-size:13px">⬛ <strong>'+tt2+'</strong> '+(isES?'mesas':'tables')+'</span>'
      +'<span style="font-size:13px">🪑 <strong>'+tc2+'</strong> '+(isES?'sillas':'chairs')+'</span>'
      +'</div>';
  }
  openMo(prog
    +'<div id="lwiz-scroll" style="overflow-y:auto;max-height:55vh">'+body+'</div>'
    +stickyFooter
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +(s>0?'<button class="btn btn-ghost" onclick="_libLayoutWiz.step--;_libRenderLayoutWizard()">← '+(isES?'Atrás':'Back')+'</button>':'')
    +(s<4?'<button class="btn btn-primary" onclick="_libLayoutWizNext()">'+(isES?'Siguiente':'Next')+' →</button>'
          :((_libLayoutWiz.floorplan&&_libLayoutWiz.floorplan.img&&!_libLayoutWiz.floorplan.pxPerMeter&&!_libLayoutWiz.floorplanLoading)
            ?'<button class="btn btn-ghost" onclick="_libLayoutWiz.floorplan.pxPerMeter=null;_libLayoutWizGenerate()">'+(isES?'Generar sin escalar':'Don\'t scale and generate layout')+'</button>'
            :'')
          +'<button class="btn btn-primary" onclick="_libLayoutWizGenerate()" '+((_libLayoutWiz.floorplanLoading)?'disabled style="opacity:.5;cursor:not-allowed"':'')+'>'+(isES?'Generar Plano':'Generate Layout')+'</button>')
    +'</div>');
}
window._libRenderLayoutWizard = _libRenderLayoutWizard;

function _libWizToggleTable(key){
  // Save scroll position of the inner scrollable div before re-rendering
  var _scrollEl=document.getElementById('lwiz-scroll');
  var _moScrollY=_scrollEl?_scrollEl.scrollTop:0;
  if(!_libLayoutWiz.tables) _libLayoutWiz.tables={};
  var catalogue=[
    {key:'round-1.2',chairs:4,cols:5},{key:'round-1.5',chairs:6,cols:5},{key:'round-1.8',chairs:8,cols:4},{key:'round-2.0',chairs:10,cols:4},
    {key:'rect-2.44x1.20',chairs:8,cols:4,chairSides:{top:4,bottom:4,left:0,right:0}},{key:'rect-4.88x1.80-12',chairs:12,cols:3,chairSides:{top:6,bottom:6,left:0,right:0}},{key:'rect-4.88x1.80-16',chairs:16,cols:3,chairSides:{top:6,bottom:6,left:2,right:2}},
    {key:'s-table-14',chairs:14,cols:2},{key:'s-table-16',chairs:16,cols:2},
  ];
  var cat=catalogue.find(function(c){return c.key===key;});
  if(_libLayoutWiz.tables[key]&&_libLayoutWiz.tables[key].n>0){
    delete _libLayoutWiz.tables[key];
  } else {
    _libLayoutWiz.tables[key]={n:1,chairs:cat?cat.chairs:8,cols:cat?cat.cols:4,chairType:'default',cp:'none'};
  }
  _libRenderLayoutWizard();
  // Restore scroll position after re-render
  requestAnimationFrame(function(){
    var el=document.getElementById('lwiz-scroll');
    if(el) el.scrollTop=_moScrollY;
  });
}
window._libWizToggleTable = _libWizToggleTable;

function _libWizFloorplanUpload(input){
  var file=input.files&&input.files[0]; if(!file) return;
  _libLayoutWiz.floorplanLoading=true;
  _libRenderLayoutWizard();
  var reader=new FileReader();
  reader.onload=function(ev){
    var origData=ev.target.result;
    var img=new Image();
    img.onload=function(){
      var MAX_PX=1200;
      var cw=img.naturalWidth, ch=img.naturalHeight;
      var finalData=origData;
      if(cw>MAX_PX||ch>MAX_PX){
        var r=Math.min(MAX_PX/cw, MAX_PX/ch);
        cw=Math.round(cw*r); ch=Math.round(ch*r);
        var cvs=document.createElement('canvas');
        cvs.width=cw; cvs.height=ch;
        cvs.getContext('2d').drawImage(img,0,0,cw,ch);
        finalData=cvs.toDataURL('image/jpeg',0.6);
      }
      _libLayoutWiz.floorplan={img:finalData,w:cw,h:ch,scale:1,opacity:0.4,x:0,y:0,pxPerMeter:null};
      _libLayoutWiz.wizScalePts=[];
      _libLayoutWiz.floorplanLoading=false;
      _libRenderLayoutWizard();
    };
    img.onerror=function(){
      _libLayoutWiz.floorplanLoading=false;
      _libRenderLayoutWizard();
      // alert() nativo: dentro de un iframe sin allow-modals no se muestra nada y
      // el usuario se queda sin saber que fallo.  toast() siempre es visible.
      toast(LANG==='es'?'Error al cargar la imagen.':'Error loading image.','e');
    };
    img.src=origData;
  };
  reader.readAsDataURL(file);
}
window._libWizFloorplanUpload = _libWizFloorplanUpload;

function _libWizPickPoint(e, el){
  var pts=_libLayoutWiz.wizScalePts;
  if(pts.length>=2) return;
  var rx=(e.clientX-el.getBoundingClientRect().left+el.scrollLeft)/(el.scrollWidth||1);
  var ry=(e.clientY-el.getBoundingClientRect().top+el.scrollTop)/(el.scrollHeight||1);
  pts.push({rx:rx,ry:ry});
  _libLayoutWiz.wizScalePts=pts;
  var prevSL=el.scrollLeft, prevST=el.scrollTop;
  _libRenderLayoutWizard();
  requestAnimationFrame(function(){
    var el2=document.getElementById('lwiz-fp-preview');
    if(el2){el2.scrollLeft=prevSL;el2.scrollTop=prevST;}
  });
}
window._libWizPickPoint = _libWizPickPoint;

function _libWizApplyScale(){
  var pts=_libLayoutWiz.wizScalePts;
  if(pts.length<2) return;
  var distEl=document.getElementById('lwiz-scale-dist');
  var meters=distEl?parseFloat(distEl.value):0;
  if(!meters||meters<=0) return toast(LANG==='es'?'Ingresa una distancia válida en metros.':'Enter a valid distance in meters.','e');
  var wfp=_libLayoutWiz.floorplan;
  var PREV_MAX=460;
  var zoom=_libLayoutWiz.wizZoom||1;
  var fitScale=Math.min(PREV_MAX/wfp.w,PREV_MAX/wfp.h,1)*zoom;
  var imgW=wfp.w||1, imgH=wfp.h||1;
  var dispW=Math.round(imgW*fitScale), dispH=Math.round(imgH*fitScale);
  var p0x=pts[0].rx*dispW, p0y=pts[0].ry*dispH;
  var p1x=pts[1].rx*dispW, p1y=pts[1].ry*dispH;
  var pxDist=Math.hypot(p1x-p0x,p1y-p0y);
  if(pxDist<5) return toast(LANG==='es'?'Los puntos están muy cerca, elige puntos más separados.':'Points are too close, pick points further apart.','e');
  var naturalPxDist=pxDist/fitScale;
  var fpPPM=naturalPxDist/meters;
  var targetPPM=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:40;
  var ratio=targetPPM/fpPPM;
  wfp.scale=(wfp.scale||1)*ratio;
  wfp.pxPerMeter=targetPPM;
  _libLayoutWiz.wizScalePts=[];
  _libRenderLayoutWizard();
}
window._libWizApplyScale = _libWizApplyScale;

function _libWizZoom(delta){
  var el=document.getElementById('lwiz-fp-preview');
  var cx=0.5, cy=0.5;
  if(el&&el.scrollWidth>0){
    cx=(el.scrollLeft+el.clientWidth/2)/(el.scrollWidth||1);
    cy=(el.scrollTop+el.clientHeight/2)/(el.scrollHeight||1);
  }
  var z=(_libLayoutWiz.wizZoom||1)+delta;
  if(z<0.25) z=0.25;
  if(z>5) z=5;
  _libLayoutWiz.wizZoom=z;
  _libLayoutWiz._scrollCenter={cx:cx, cy:cy};
  _libRenderLayoutWizard();
  requestAnimationFrame(function(){
    var el2=document.getElementById('lwiz-fp-preview');
    if(el2&&_libLayoutWiz._scrollCenter){
      var sc=_libLayoutWiz._scrollCenter;
      el2.scrollLeft=Math.round(sc.cx*el2.scrollWidth-el2.clientWidth/2);
      el2.scrollTop=Math.round(sc.cy*el2.scrollHeight-el2.clientHeight/2);
    }
  });
}
window._libWizZoom = _libWizZoom;

function _libWizWheelZoom(e){
  e.preventDefault();
  e.stopPropagation();
  var el=document.getElementById('lwiz-fp-preview');
  if(!el) return;
  var delta=e.deltaY<0?0.15:-0.15;
  var oldZ=_libLayoutWiz.wizZoom||1;
  var newZ=Math.max(0.25,Math.min(5,oldZ+delta));
  if(newZ===oldZ) return;
  // Cursor position relative to content (in content-space px)
  var rect=el.getBoundingClientRect();
  var cursorX=e.clientX-rect.left+el.scrollLeft;
  var cursorY=e.clientY-rect.top+el.scrollTop;
  // Ratio of cursor within the content
  var rx=cursorX/(el.scrollWidth||1);
  var ry=cursorY/(el.scrollHeight||1);
  // Cursor offset from viewport top-left (stays fixed)
  var vpOffX=e.clientX-rect.left;
  var vpOffY=e.clientY-rect.top;
  _libLayoutWiz.wizZoom=newZ;
  _libLayoutWiz._scrollCenter=null;
  _libRenderLayoutWizard();
  requestAnimationFrame(function(){
    var el2=document.getElementById('lwiz-fp-preview');
    if(!el2) return;
    // New cursor position in new content-space
    var newCursorX=rx*el2.scrollWidth;
    var newCursorY=ry*el2.scrollHeight;
    el2.scrollLeft=Math.round(newCursorX-vpOffX);
    el2.scrollTop=Math.round(newCursorY-vpOffY);
  });
}
window._libWizWheelZoom = _libWizWheelZoom;

function _libLayoutWizNext(){
  var w=_libLayoutWiz;
  if(w.step===0){
    w.guests=parseInt(document.getElementById('lwiz-guests')?.value)||100;
    var sq=_dfSuggestSquare(w.guests); var rd=_dfSuggestRound(w.guests);
    w.dfW=sq.w; w.dfH=sq.h; w.dfD=rd.d; w.barW=Math.min(sq.w,sq.h);
  }
  if(w.step===2 && !Object.keys(w.tables).length){
    w.tables['round-1.8']={n:Math.ceil(w.guests/8), chairs:8, cols:4, chairType:'default', cp:'none'};
  }
  w.step++;
  _libRenderLayoutWizard();
}
window._libLayoutWizNext = _libLayoutWizNext;

function _libLayoutWizGenerate(){
  var w=_libLayoutWiz;
  var isES=LANG==='es';
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:40;
  var SHAPES=typeof getLSHAPES!=='undefined'?getLSHAPES():(typeof LSHAPES!=='undefined'?LSHAPES:{});
  var items=[];
  var idGen=function(){return 'li'+Date.now()+Math.random().toString(36).slice(2,6);};
  var spacing=Math.round(1.2*ppm);       // structural gaps (margins, block separators)
  var tableSpacing=Math.round(0.25*ppm); // gap between table edges
  var originX=spacing*2, originY=spacing*2;
  var tableCount=0;
  var maxTableW=0;
  var curY=originY;

  // Table catalogue key -> shape/size info
  var catalogueMap={
    'round-1.2':{shape:'round-table',wM:1.2,hM:1.2,round:true},'round-1.5':{shape:'round-table',wM:1.5,hM:1.5,round:true},'round-1.8':{shape:'round-table',wM:1.8,hM:1.8,round:true},'round-2.0':{shape:'round-table',wM:2.0,hM:2.0,round:true},
    'rect-2.44x1.20':{shape:'rect-table',wM:2.44,hM:1.20,round:false,chairSides:{top:4,bottom:4,left:0,right:0}},'rect-4.88x1.80-12':{shape:'rect-table',wM:4.88,hM:1.80,round:false,chairSides:{top:6,bottom:6,left:0,right:0}},'rect-4.88x1.80-16':{shape:'rect-table',wM:4.88,hM:1.80,round:false,chairSides:{top:6,bottom:6,left:2,right:2}},
    's-table-14':{shape:'s-table',wM:4.0,hM:1.5,round:false},'s-table-16':{shape:'s-table',wM:4.5,hM:1.5,round:false},
  };
  var tables=Array.isArray(w.tables)?{}:w.tables;
  Object.keys(tables).forEach(function(key){
    var tg=tables[key]; if(!tg||!tg.n) return;
    var cm=catalogueMap[key]||{shape:'round-table',wM:1.5,hM:1.5,round:true};
    var tw=Math.round(cm.wM*ppm); var th=Math.round(cm.hM*ppm);
    var defBg=cm.round?'#f0ece0':'#f0ece0'; var defBd='#a67c3d';
    var defShape=SHAPES&&SHAPES[cm.shape]?SHAPES[cm.shape]:{w:tw,h:th,bg:defBg,bdClr:defBd};
    var pad=tg.chairs?Math.round(CHAIR_SIZE_M*ppm)+Math.round(0.05*ppm):0;
    var cellW=tw+pad*2+tableSpacing; var cellH=th+pad*2+tableSpacing;
    var cols=tg.cols||5; var row=0; var col=0;
    for(var i=0;i<tg.n;i++){
      var tx=originX+col*cellW+pad; var ty=curY+row*cellH+pad;
      items.push({id:idGen(),shape:cm.shape,x:tx,y:ty,w:tw,h:th,bg:defShape.bg||defBg,bdClr:defShape.bdClr||defBd,radius:cm.round?'50%':'0px',label:String(tableCount+1),chairs:tg.chairs,chairSides:cm.chairSides||null,chairType:tg.chairType||'default',centerpiece:tg.cp||'none',cost:0,rotation:0,_typeKey:key});
      tableCount++;col++;
      if(col>=cols){col=0;row++;}
    }
    var gridH=(row+(col>0?1:0))*cellH;
    var gridW=Math.min(tg.n,cols)*cellW;
    if(gridW>maxTableW) maxTableW=gridW;
    curY+=gridH+spacing;
  });

  // ── Center elements: DJ Booth → Stage → Shot Bar → Dance Floor → Dinner Platform ──
  var dfW,dfH;
  if(w.dfShape==='round'){
    dfW=Math.round((w.dfD||4)*ppm); dfH=dfW;
  } else {
    dfW=Math.round((w.dfH||7)*ppm); dfH=Math.round((w.dfW||7)*ppm);
  }
  var barW=w.bar?Math.round((w.barW||7)*ppm):0;  var barH=w.bar?Math.round((w.barH||0.4)*ppm):0;
  var platW=w.platform?Math.round((w.platW||3.66)*ppm):0; var platH=w.platform?Math.round((w.platH||2.44)*ppm):0;
  var djEW=w.dj?Math.round((w.djW||3.66)*ppm):0; var djEH=w.dj?Math.round((w.djH||1.22)*ppm):0;
  var sgW=w.stage?Math.round((w.stageW||3.66)*ppm):0; var sgH=w.stage?Math.round((w.stageH||2.44)*ppm):0;

  // Center column height
  var centerElH=0;
  if(w.dj) centerElH+=djEH+spacing;
  if(w.stage) centerElH+=sgH+spacing;
  if(w.bar) centerElH+=barH+spacing;
  centerElH+=dfH+spacing;
  if(w.platform) centerElH+=platH+spacing;
  var centerColW=dfW;

  // Split tables: distribute each table type half-left, half-right (interleaved)
  var tableItems=items.splice(0,items.length);
  var leftTables=[];
  var rightTables=[];
  // Group tables by their shape+size so each type is split evenly across sides
  var _typeGroups={};
  tableItems.forEach(function(t){
    var typeKey=t.shape+'_'+t.w+'_'+t.h;
    if(!_typeGroups[typeKey]) _typeGroups[typeKey]=[];
    _typeGroups[typeKey].push(t);
  });
  Object.keys(_typeGroups).forEach(function(tk){
    var group=_typeGroups[tk];
    var half=Math.ceil(group.length/2);
    for(var gi=0;gi<group.length;gi++){
      if(gi<half) leftTables.push(group[gi]);
      else rightTables.push(group[gi]);
    }
  });

  // Compute table block dimensions
  var leftCellW=0,leftCellH=0;
  leftTables.forEach(function(t){var cw=t.w+(t.chairs?Math.round(0.4*ppm)*2+tableSpacing:0)+tableSpacing;var ch=t.h+(t.chairs?Math.round(0.4*ppm)*2+tableSpacing:0)+tableSpacing;if(cw>leftCellW)leftCellW=cw;if(ch>leftCellH)leftCellH=ch;});
  var rightCellW=0,rightCellH=0;
  rightTables.forEach(function(t){var cw=t.w+(t.chairs?Math.round(0.4*ppm)*2+tableSpacing:0)+tableSpacing;var ch=t.h+(t.chairs?Math.round(0.4*ppm)*2+tableSpacing:0)+tableSpacing;if(cw>rightCellW)rightCellW=cw;if(ch>rightCellH)rightCellH=ch;});
  if(!leftCellW)leftCellW=spacing*3;if(!leftCellH)leftCellH=spacing*3;
  if(!rightCellW)rightCellW=spacing*3;if(!rightCellH)rightCellH=spacing*3;

  var leftCols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(leftTables.length))));
  var rightCols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(rightTables.length))));
  var leftRows=Math.ceil(leftTables.length/Math.max(1,leftCols));
  var rightRows=Math.ceil(rightTables.length/Math.max(1,rightCols));
  var leftBlockW=leftCols*leftCellW;
  var rightBlockW=rightCols*rightCellW;

  // Layout positioning
  var totalW=leftBlockW+spacing+centerColW+spacing+rightBlockW;
  var canvasW=8000;
  var layoutOX=Math.round(Math.max(spacing*3,(canvasW-totalW)/2));
  var centralX=layoutOX+leftBlockW+spacing;
  var dfCenterX=centralX+centerColW/2;

  // Dance floor Y = after DJ + Stage + Bar
  var topElH=0;
  if(w.dj) topElH+=djEH+spacing;
  if(w.stage) topElH+=sgH+spacing;
  if(w.bar) topElH+=barH+spacing;
  var dfY=originY+topElH;
  var tableStartY=dfY;

  // Place center elements top-down
  var cy=originY;
  function ctrX(elemW){ return Math.round(dfCenterX-elemW/2); }

  var dfShapeRef=typeof LSHAPES!=='undefined'&&LSHAPES['dance-floor']?LSHAPES['dance-floor']:{bg:'#e8e0f0',bdClr:'#7c3aed'};
  var barShapeRef=typeof LSHAPES!=='undefined'&&LSHAPES['bar']?LSHAPES['bar']:{bg:'#fef3c7',bdClr:'#f59e0b'};
  var stShapeRef=typeof LSHAPES!=='undefined'&&LSHAPES['stage']?LSHAPES['stage']:{bg:'#dbeafe',bdClr:'#3b82f6'};
  var djShapeRef=typeof LSHAPES!=='undefined'&&LSHAPES['dj-booth']?LSHAPES['dj-booth']:{bg:'#f3e8ff',bdClr:'#9333ea'};

  if(w.dj){
    items.push({id:idGen(),shape:'dj-booth',x:ctrX(djEW),y:Math.round(cy),w:djEW,h:djEH,bg:djShapeRef.bg,bdClr:djShapeRef.bdClr,radius:'0px',label:'DJ Booth',chairs:0,cost:0,rotation:0});
    cy+=djEH+spacing;
  }
  if(w.stage){
    items.push({id:idGen(),shape:'stage',x:ctrX(sgW),y:Math.round(cy),w:sgW,h:sgH,bg:stShapeRef.bg,bdClr:stShapeRef.bdClr,radius:'0px',label:isES?'Escenario':'Stage',chairs:0,cost:0,rotation:0});
    cy+=sgH+spacing;
  }
  if(w.bar){
    items.push({id:idGen(),shape:'bar',x:ctrX(barW),y:Math.round(cy),w:barW,h:barH,bg:barShapeRef.bg,bdClr:barShapeRef.bdClr,radius:'0px',label:isES?'Barra de Shots':'Shot Bar',chairs:0,cost:0,rotation:0});
    cy+=barH+spacing;
  }
  items.push({id:idGen(),shape:'dance-floor',x:ctrX(dfW),y:Math.round(cy),w:dfW,h:dfH,bg:dfShapeRef.bg,bdClr:dfShapeRef.bdClr,radius:w.dfShape==='round'?'50%':'0px',label:isES?'Pista de Baile':'Dance Floor',chairs:0,cost:0,rotation:0});
  cy+=dfH+spacing;
  if(w.platform){
    items.push({id:idGen(),shape:'stage',x:ctrX(platW),y:Math.round(cy),w:platW,h:platH,bg:stShapeRef.bg,bdClr:stShapeRef.bdClr,radius:'0px',label:isES?'Plataforma de Cena':'Dinner Platform',chairs:0,cost:0,rotation:0});
  }

  // Place LEFT tables — aligned from dance floor Y downward
  var leftStartX=centralX-spacing-leftBlockW;
  for(var lr=0;lr<leftRows;lr++){
    for(var lc=0;lc<leftCols;lc++){
      var li=lr*leftCols+lc; if(li>=leftTables.length) break;
      var lt=leftTables[li];
      lt.x=Math.round(leftStartX+lc*leftCellW+(leftCellW-lt.w)/2);
      lt.y=Math.round(tableStartY+lr*leftCellH+(leftCellH-lt.h)/2);
      items.push(lt);
    }
  }
  // Place RIGHT tables
  var rightStartX=centralX+centerColW+spacing;
  for(var rr=0;rr<rightRows;rr++){
    for(var rc=0;rc<rightCols;rc++){
      var rii=rr*rightCols+rc; if(rii>=rightTables.length) break;
      var rt=rightTables[rii];
      rt.x=Math.round(rightStartX+rc*rightCellW+(rightCellW-rt.w)/2);
      rt.y=Math.round(tableStartY+rr*rightCellH+(rightCellH-rt.h)/2);
      items.push(rt);
    }
  }

  // Save to library
  var lib=getLib();
  var name=libUniqueLayoutName(isES?'Plano '+formatDMY(today()):'Layout '+formatDMY(today()));
  var guests=w.guests||'';
  var tables=tableCount;
  var entryId='ll'+Date.now()+Math.random().toString(36).slice(2,7);
  lib.layouts.push({
    id:entryId, name:name, notes:'', location:'', guests:String(guests),
    date:formatDMY(today()),
    updatedAt:new Date().toISOString(), // so events detect same-day edits and re-sync
    items:JSON.parse(JSON.stringify(items)),
    floorplan:_libLayoutWiz.floorplan?JSON.parse(JSON.stringify(_libLayoutWiz.floorplan)):null,
    pxPerMeter:(_libLayoutWiz.floorplan&&_libLayoutWiz.floorplan.pxPerMeter)||null
  });
  saveLib(lib);


  closeMo();
  toast(isES?'Plano creado. Ábrelo con el botón Editar.':'Layout created. Open it with the Edit button.','s');
  // Redirect to library layouts tab and open the editor
  _libTab='layouts';
  renderLibrary();
  setTimeout(function(){ libOpenLayoutEditor(entryId, null, true); },200);
}
window._libLayoutWizGenerate = _libLayoutWizGenerate;

function libOpenLayoutEditor(entryId, _unused, isNew){
  _libEditingLayoutId=entryId;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry){ toast(LANG==='es'?'Plano no encontrado':'Layout not found','e'); return; }
  var isES=LANG==='es';
  var isPhone=typeof isPhoneViewport==='function' && isPhoneViewport();

  // Use the library entry itself as a pseudo-project by storing items in it directly.
  // We create/reuse a hidden __lib_layout__ project slot so renderLayout() works.
  var all=uproj();
  if(!all['__lib_layout__']){
    all['__lib_layout__']={
      id:'__lib_layout__',name:'__lib_layout__',
      status:'__internal__',
      vendors:[],tasks:[],guests:[],
      layoutItems:[],floorplan:{img:null},
      tables:{},elements:{},chairs:{},centerpieces:{}
    };
  }
  var lp=all['__lib_layout__'];
  lp.layoutItems=JSON.parse(JSON.stringify(entry.items||[]));
  if(entry.chairTypes) lp.chairTypes=JSON.parse(JSON.stringify(entry.chairTypes));
  if(entry.centerpieceTypes) lp.centerpieceTypes=JSON.parse(JSON.stringify(entry.centerpieceTypes));
  lp.floorplan=entry.floorplan?JSON.parse(JSON.stringify(entry.floorplan)):{img:null,pxPerMeter:null};
  if(entry.pxPerMeter && (!lp.floorplan.pxPerMeter)) lp.floorplan.pxPerMeter=entry.pxPerMeter;
  if(lp.floorplan && lp.floorplan.img==='__idb__' && lp.floorplan._idb){
    lp.floorplan.img=lp.floorplan.thumb||null;
    if(typeof _fpLoad==='function'){
      _fpLoad(lp.floorplan._idb).then(function(data){
        if(data){ lp.floorplan.img=data; saveProj(lp); if(typeof renderLayout==='function') renderLayout(); }
      }).catch(function(){});
    }
  }

  // Switch CID to pseudo-project
  var _prevCID=typeof CID!=='undefined'?CID:null;
  CID='__lib_layout__';

  // If floorplan image was stripped for storage, rehydrate it before opening editor
  if(lp.floorplan && lp.floorplan.img==='__stored__'){
    lp.floorplan.img=lp.floorplan.thumb||null;
    // pxPerMeter is already on lp.floorplan — saveProj synchronously so renderLayout reads it
    saveProj(lp);
    loadFloorplanImg(entryId, function(img){
      lp.floorplan.img=img||lp.floorplan.thumb||null;
      saveProj(lp);
      if(typeof renderLayout==='function') renderLayout();
    });
  } else {
    saveProj(lp);
  }

  // Show full-page layout editor (re-use pg-library page area, hide its normal content)
  var pgLib=document.getElementById('pg-library');
  if(!pgLib) return;

  // Hide normal library UI, inject full-height layout shell
  var editorTopBarStyle=isPhone
    ? 'display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:12px 12px 10px;background:var(--card);border-bottom:1px solid var(--border);flex-shrink:0'
    : 'display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--card);border-bottom:1px solid var(--border);flex-shrink:0';
  var editorMainRowStyle=isPhone
    ? 'display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:0;width:100%'
    : 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;flex:1';
  var editorNameStyle=isPhone
    ? 'width:100%;min-width:0;font-weight:700;font-size:15px;padding:10px 12px'
    : 'max-width:320px;font-weight:700;font-size:15px;padding:7px 10px';
  var editorLoadBtnStyle=isPhone ? 'width:100%;justify-content:center' : '';
  pgLib.innerHTML=
    '<div style="display:flex;flex-direction:column;height:100vh">'
    +'<div style="'+editorTopBarStyle+'">'
    +'<button class="btn btn-ghost btn-sm" onclick="libCloseLayoutEditor(\''+entryId+'\',\''+(_prevCID||'')+'\')">← '+(isES?'Volver a Planos':'Back to Layouts')+'</button>'
    +'<div style="'+editorMainRowStyle+'">'
    +'<input id="lib-layout-editor-name" class="input" value="'+esc(entry.name)+'" style="'+editorNameStyle+'" onblur="libRenameEditingLayout(\''+entryId+'\')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">'
    +'<button class="btn btn-primary btn-sm" style="'+editorLoadBtnStyle+'" onclick="libOpenLayoutEventPicker(\''+entryId+'\')">'+(isES?'CARGAR A EVENTO':'LOAD TO EVENT')+'</button>'
    +'</div>'
    +'<span style="font-size:12px;color:var(--muted)">'+(isES?'Los cambios se guardan automáticamente':'Changes are saved automatically')+'</span>'
    +'</div>'
    +'<div id="lib-layout-canvas" style="flex:1;overflow:hidden"></div>'
    +'</div>';

  // Auto-save: poll for changes every 2 seconds — only saves current layout's items and floorplan metadata
  function libLayoutSnapshot(lpState){
    if(!lpState) return '';
    return JSON.stringify({
      items: lpState.layoutItems||[],
      chairTypes: lpState.chairTypes||[],
      centerpieceTypes: lpState.centerpieceTypes||[],
      floorplan: lpState.floorplan||null
    });
  }
  window._libAutoSaveSnapshot=libLayoutSnapshot(lp);
  if(window._libAutoSaveInterval) clearInterval(window._libAutoSaveInterval);
  window._libAutoSaveInterval=setInterval(function(){
    if(!_libEditingLayoutId) return;
    var lib2=getLib();
    var entry2=lib2.layouts.find(function(e){return e.id===entryId;});
    var lp2=typeof uproj==='function'?uproj()['__lib_layout__']:null;
    var nextSnapshot=libLayoutSnapshot(lp2);
    if(!entry2 || !lp2 || nextSnapshot===window._libAutoSaveSnapshot) return;
    window._libAutoSaveSnapshot=nextSnapshot;
    if(entry2){
      if(lp2.layoutItems) entry2.items=JSON.parse(JSON.stringify(lp2.layoutItems));
      if(lp2.chairTypes) entry2.chairTypes=JSON.parse(JSON.stringify(lp2.chairTypes));
      if(lp2.centerpieceTypes) entry2.centerpieceTypes=JSON.parse(JSON.stringify(lp2.centerpieceTypes));
      if(lp2.floorplan){
        var _asFp=JSON.parse(JSON.stringify(lp2.floorplan));
        if(_asFp.img&&_asFp.img!=='__idb__') _asFp.img='__idb__';
        entry2.floorplan=_asFp;
      }
      entry2.updatedAt=new Date().toISOString();
      saveLib(lib2);
    }
  },2000);

  CTAB='layout';
  if(typeof renderLayout==='function') renderLayout();
  setTimeout(function(){ if(typeof lZoom==='function') lZoom(0,'fit'); },160);
  if(isNew) setTimeout(function(){ if(typeof startLayoutTour==='function') startLayoutTour(); },600);
}
window.libOpenLayoutEditor = libOpenLayoutEditor;

function libCloseLayoutEditor(entryId, prevCID){
  if(window._libAutoSaveInterval){ clearInterval(window._libAutoSaveInterval); window._libAutoSaveInterval=null; }
  window._libAutoSaveSnapshot=null;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;});
  var lp=typeof uproj==='function'?uproj()['__lib_layout__']:null;
  if(entry && lp){
    entry.items=JSON.parse(JSON.stringify(lp.layoutItems||[]));
    if(lp.chairTypes) entry.chairTypes=JSON.parse(JSON.stringify(lp.chairTypes));
    if(lp.centerpieceTypes) entry.centerpieceTypes=JSON.parse(JSON.stringify(lp.centerpieceTypes));
    if(lp.floorplan){
      var closeFp=JSON.parse(JSON.stringify(lp.floorplan));
      if(closeFp.img&&closeFp.img!=='__idb__') closeFp.img='__idb__';
      entry.floorplan=closeFp;
    }
    entry.updatedAt=new Date().toISOString();
    saveLib(lib);
  }
  _libEditingLayoutId=null;
  // Remove the pseudo-project from memory so it never bleeds into real event rendering
  if(typeof uproj==='function' && typeof DB!=='undefined' && DB.cur && DB.projects[DB.cur]){
    delete DB.projects[DB.cur]['__lib_layout__'];
    if(typeof cacheDB==='function') cacheDB();
  }
  // Restore CID
  CID = (prevCID && prevCID!=='null' && prevCID!=='undefined') ? prevCID : null;
  _libTab='layouts';
  // Rebuild the library page HTML from scratch since we replaced pg-library's innerHTML
  var pgLib=document.getElementById('pg-library');
  if(pgLib){
    pgLib.innerHTML=_libPageShellHTML();
  }
  showPage('library');
  renderLibrary();
}
window.libCloseLayoutEditor = libCloseLayoutEditor;

// Called by showPage() when the user navigates away from the library page without
// clicking "Back to Layouts". Cleans up state without triggering a page switch.
function libCancelLayoutEditor(){
  if(!_libEditingLayoutId) return;
  if(window._libAutoSaveInterval){ clearInterval(window._libAutoSaveInterval); window._libAutoSaveInterval=null; }
  window._libAutoSaveSnapshot=null;
  // Final save of layout items to the library entry
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===_libEditingLayoutId;});
  var lp=typeof uproj==='function'?uproj()['__lib_layout__']:null;
  if(entry && lp){
    entry.items=JSON.parse(JSON.stringify(lp.layoutItems||[]));
    if(lp.chairTypes) entry.chairTypes=JSON.parse(JSON.stringify(lp.chairTypes));
    if(lp.centerpieceTypes) entry.centerpieceTypes=JSON.parse(JSON.stringify(lp.centerpieceTypes));
    entry.updatedAt=new Date().toISOString();
    saveLib(lib);
  }
  _libEditingLayoutId=null;
  // Remove pseudo-project from memory
  if(typeof DB!=='undefined' && DB.cur && DB.projects[DB.cur]){
    delete DB.projects[DB.cur]['__lib_layout__'];
    if(typeof cacheDB==='function') cacheDB();
  }
  // Restore pg-library to its normal state so it looks correct if navigated back to
  var pgLib=document.getElementById('pg-library');
  if(pgLib){
    pgLib.innerHTML=_libPageShellHTML();
  }
}
window.libCancelLayoutEditor = libCancelLayoutEditor;

// No global hook needed — auto-save is triggered directly by libOpenLayoutEditor

window.libFilterVendors = libFilterVendors;
window.libVendorRow = libVendorRow;
window.libUpdateBulkBtn = libUpdateBulkBtn;
window.libToggleAllVendors = libToggleAllVendors;
window.libLoadVendorToEvent = libLoadVendorToEvent;
window.libBulkLoadToEvent = libBulkLoadToEvent;
window.libOpenEventPickerModal = libOpenEventPickerModal;
window.libFilterEventPicker = libFilterEventPicker;
window.libDoAddVendorsToEvents = libDoAddVendorsToEvents;
window.libDeleteSingleVendor = libDeleteSingleVendor;
window.libDuplicateSingleVendor = libDuplicateSingleVendor;
window.libLoadSingleVendor = function(){};
window.libAddGlobalVendor = libAddGlobalVendor;
window.libSaveGlobalVendor = libSaveGlobalVendor;
window.libDownloadVendorTemplate = libDownloadVendorTemplate;
window.libImportCSV = libImportCSV;
window.libPreviewCSV = libPreviewCSV;
window.libDoImportCSV = libDoImportCSV;
window.libEditGlobalVendor = libEditGlobalVendor;
window.libSaveEditGlobalVendor = libSaveEditGlobalVendor;
window.renderLibGlobalTasks = renderLibGlobalTasks;
window.libFilterTasks = libFilterTasks;
window.libUpdateTaskBulkBtn = libUpdateTaskBulkBtn;
window.libToggleAllTasks = libToggleAllTasks;
window.libAddGlobalTask = libAddGlobalTask;
window.libPickTaskColor = libPickTaskColor;
window.libSaveGlobalTask = libSaveGlobalTask;
window.libEditGlobalTask = libEditGlobalTask;
window.libSaveEditGlobalTask = libSaveEditGlobalTask;
window.libDeleteGlobalTask = libDeleteGlobalTask;
window.libDuplicateGlobalTask = libDuplicateGlobalTask;
window.libLoadTaskToEvent = libLoadTaskToEvent;
window.libBulkLoadTasksToEvent = libBulkLoadTasksToEvent;
window.libOpenTaskEventPickerModal = libOpenTaskEventPickerModal;
window.libFilterTaskEventPicker = libFilterTaskEventPicker;
window.libDoAddTasksToEvents = libDoAddTasksToEvents;
window.libDownloadTaskTemplate = libDownloadTaskTemplate;
window.libImportTasksCSV = libImportTasksCSV;
window.libPreviewTasksCSV = libPreviewTasksCSV;
window.libDoImportTasksCSV = libDoImportTasksCSV;
window.libLayoutRow = libLayoutRow;
window.libFilterLayouts = libFilterLayouts;
window.libUpdateLayoutBulkBtn = libUpdateLayoutBulkBtn;
window.libToggleAllLayouts = libToggleAllLayouts;
window.libLoadLayoutToEvent = libLoadLayoutToEvent;
window.libBulkLoadLayoutsToEvent = libBulkLoadLayoutsToEvent;
window.libEditLayout = libEditLayout;
window.libSaveEditLayout = libSaveEditLayout;
window.libLoadLayout = libLoadLayout;
window._dfSuggestSquare = _dfSuggestSquare;
window._dfSuggestRound = _dfSuggestRound;
window._libRenderLayoutWizard = _libRenderLayoutWizard;
window._libLayoutWizNext = _libLayoutWizNext;
window._libLayoutWizGenerate = _libLayoutWizGenerate;
window.libOpenLayoutEditor = libOpenLayoutEditor;
function libDuplicateLayout(entryId){
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry) return toast(LANG==='es'?'Layout no encontrado':'Layout not found','e');
  var isES=LANG==='es';
  var baseName=entry.name;
  var copyNum=1;
  var newName=libUniqueLayoutName(baseName+' ('+(isES?'copia':'copy')+')');
  var newEntry=JSON.parse(JSON.stringify(entry));
  newEntry.updatedAt=new Date().toISOString();
  newEntry.id='ll'+Date.now()+Math.random().toString(36).slice(2,7);
  newEntry.name=newName;
  newEntry.date=formatDMY(today());
  if(newEntry.floorplan&&newEntry.floorplan._idb&&typeof _fpLoad==='function'){
    _fpLoad(newEntry.floorplan._idb).then(function(data){
      if(data){
        var newKey='libfp_'+newEntry.id+'_'+Date.now();
        _fpSave(newKey,data).then(function(){
          newEntry.floorplan._idb=newKey;
          lib.layouts.push(newEntry);
          saveLib(lib);
          renderLibrary();
          toast(isES?'Layout duplicado':'Layout duplicated','s');
        });
      } else {
        lib.layouts.push(newEntry);
        saveLib(lib);
        renderLibrary();
        toast(isES?'Layout duplicado (sin plano)':'Layout duplicated (without floorplan)','s');
      }
    });
  } else {
    lib.layouts.push(newEntry);
    saveLib(lib);
    renderLibrary();
    toast(isES?'Layout duplicado':'Layout duplicated','s');
  }
}
window.libDuplicateLayout = libDuplicateLayout;

function libBulkDeleteLayouts(){
  var checks=document.querySelectorAll('.lib-ly-sel:checked');
  if(!checks.length) return toast(LANG==='es'?'Selecciona layouts para eliminar':'Select layouts to delete','e');
  var ids=Array.from(checks).map(function(c){return c.dataset.lid;});
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar layouts':'Delete layouts',
    message:isES?'¿Eliminar '+ids.length+' layouts seleccionados?':'Delete '+ids.length+' selected layouts?',
    onConfirm:function(){
      var lib=getLib();
      ids.forEach(function(id){
        var entry=lib.layouts.find(function(e){return e.id===id;});
        if(entry&&entry.floorplan&&entry.floorplan._idb&&typeof _fpDelete==='function'){
          _fpDelete(entry.floorplan._idb).catch(function(){});
        }
      });
      lib.layouts=lib.layouts.filter(function(e){return ids.indexOf(e.id)<0;});
      saveLib(lib); renderLibrary();
      toast(isES?ids.length+' layouts eliminados':ids.length+' layouts deleted','s');
    }
  });
}
window.libBulkDeleteLayouts = libBulkDeleteLayouts;

window.libCloseLayoutEditor = libCloseLayoutEditor;
window.updateLibraryLabels = updateLibraryLabels;
window.renderLibrary = renderLibrary;
// placeholder to prevent old duplicate

