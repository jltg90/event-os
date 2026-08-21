
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

function openLibrary(){
  // If a library layout editor is open, close it cleanly before navigating
  if(typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId){
    if(window._libAutoSaveInterval){ clearInterval(window._libAutoSaveInterval); window._libAutoSaveInterval=null; }
    _libEditingLayoutId=null;
    // Restore pg-library to its normal structure
    var pgLib=document.getElementById('pg-library');
    if(pgLib){
      pgLib.innerHTML=
        '<div style="max-width:1200px;margin:0 auto;padding:32px 24px;width:100%">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
        +'<div><h1 class="editorial-title" id="lib-page-title" style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700">Layouts</h1>'
        +'<p id="lib-page-sub" style="display:none"></p></div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap" id="lib-add-btns"></div>'
        +'</div>'
        +'<div style="display:none" id="lib-tabs"></div>'
        +'<div id="lib-content"></div>'
        +'</div>';
    }
  }
  showPage('library');
}

function updateLibraryLabels(){
  var el=document.getElementById('lib-menu-label'); if(el) el.textContent=t('lib_title');
  var titles={vendors:LANG==='es'?'Proveedores':'Vendors', tasks:LANG==='es'?'Tareas':'Tasks', layouts:LANG==='es'?'Layouts':'Layouts', moodboards:'Moodboards'};
  libSetPageTitle(titles[_libTab]||t('lib_title'));
  var ps=document.getElementById('lib-page-sub');   if(ps) ps.style.display='none';
}

function libSetPageTitle(title){
  var pt=document.getElementById('lib-page-title');
  if(!pt) return;
  pt.textContent=title;
  pt.classList.remove('editorial-title');
  void pt.offsetWidth;
  pt.classList.add('editorial-title');
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

function renderLibrary(){
  updateLibraryLabels();
  var lib = getLib();
  var vendorCount = lib.vendors.length;
  var taskCount = (lib.tasks||[]).length;

  var tabs = [
    {key:'vendors',    icon:'🏢', lbl:t('lib_vendors'),     cnt: vendorCount},
    {key:'tasks',      icon:'📅', lbl:t('lib_tasks'),       cnt: taskCount},
    {key:'layouts',    icon:'📐', lbl:t('lib_layouts'),     cnt: lib.layouts.length},
    {key:'tables',     icon:'⬡',  lbl:t('lib_tables'),      cnt: Object.keys(lib.tables).length},
    {key:'elements',   icon:'🪴', lbl:t('lib_elements'),    cnt: Object.keys(lib.elements).length},
    {key:'chairs',     icon:'🪑', lbl:t('lib_chairs'),      cnt: Object.keys(lib.chairs).length},
    {key:'centerpieces',icon:'💐',lbl:t('lib_centerpieces'),cnt: Object.keys(lib.centerpieces).length},
    {key:'moodboards', icon:'🎨', lbl:t('lib_moodboards'),  cnt: lib.moodboards.length},
  ];

  // Tab bar hidden — navigation is via sidebar only

  var addEl = document.getElementById('lib-add-btns');
  var addMap = {
    vendors:'lib_add_vendor', tasks:'lib_add_task', layouts:'lib_add_layout',
    tables:'lib_add_types', elements:'lib_add_types', chairs:'lib_add_types',
    centerpieces:'lib_add_types', moodboards:'lib_add_moodboard'
  };
  if(addEl){
    if(_libTab==='vendors'){
      if(_libOpenVendorGroupId){
        addEl.innerHTML =
          '<button class="btn btn-ghost" style="gap:5px" onclick="libBackToVendorGroups()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>'
          +(t('lib_back'))+'</button>'
          +' <button class="btn btn-primary btn-create-gradient" onclick="libOpenVendorModalForGroup(\''+_libOpenVendorGroupId+'\')">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(t('lib_add_vendor'))+'</button>';
      } else {
        addEl.innerHTML =
          '<button class="btn btn-primary btn-create-gradient" onclick="libNewVendorGroupModal()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(t('lib_new_group'))+'</button>';
      }
    } else if(_libTab==='tasks'){
      if(_libOpenTaskGroupId){
        addEl.innerHTML =
          '<button class="btn btn-ghost" style="gap:5px" onclick="libBackToTaskGroups()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>'
          +(t('lib_back'))+'</button>'
          +' <button class="btn btn-primary btn-create-gradient" onclick="libOpenTaskModalForGroup(\''+_libOpenTaskGroupId+'\')">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(t('lib_add_task'))+'</button>';
      } else {
        addEl.innerHTML =
          '<button class="btn btn-primary btn-create-gradient" onclick="libNewTaskGroupModal()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(t('lib_new_group'))+'</button>';
      }
    } else if(_libTab==='layouts'){
      addEl.innerHTML = lib.layouts.length
        ? '<button class="btn btn-primary btn-create-gradient" onclick="libOpenLayoutWizard()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(t('lib_new_layout'))+'</button>'
        : '';
    } else if(_libTab==='moodboards') {
      if(_mbOpenFolderId){
        addEl.innerHTML = '<button class="btn btn-primary" onclick="libMoodboardUploadImages(\''+_mbOpenFolderId+'\')">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
          +(t('lib_upload_images'))+'</button>';
      } else {
        addEl.innerHTML = lib.moodboards.length
          ? '<button class="btn btn-primary btn-create-gradient" onclick="libCreateMoodboardFolder()">'
            +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
            +(t('lib_new_moodboard'))+'</button>'
          : '';
      }
    } else {
      addEl.innerHTML =
        '<button class="btn btn-primary" onclick="libSaveModal(\''+_libTab+'\')">'
        +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
        +t(addMap[_libTab]||'lib_save_to')+'</button>';
    }
  }

  var el = document.getElementById('lib-content');
  if(!el) return;

  switch(_libTab){
    case 'vendors':     el.innerHTML = renderLibVendorSets(lib); break;
    case 'tasks':       el.innerHTML = renderLibTaskGroups(lib); break;
    case 'layouts':     el.innerHTML = renderLibLayouts(lib); break;
    case 'tables':      el.innerHTML = renderLibTypes(lib,'tables'); break;
    case 'elements':    el.innerHTML = renderLibTypes(lib,'elements'); break;
    case 'chairs':      el.innerHTML = renderLibTypes(lib,'chairs'); break;
    case 'centerpieces':el.innerHTML = renderLibTypes(lib,'centerpieces'); break;
    case 'moodboards':  el.innerHTML = renderLibMoodboards(lib); break;
  }
}

function setLibTab(key){ _libTab=key; _mbOpenFolderId=null; _libOpenVendorGroupId=null; _libOpenTaskGroupId=null; renderLibrary(); }

function libEmpty(){
  return '<div style="text-align:center;padding:60px 20px;color:var(--muted)">'
    +'<div style="font-size:48px;margin-bottom:12px">📚</div>'
    +'<div style="font-size:15px;font-weight:600;margin-bottom:6px">'+t('lib_empty')+'</div>'
    +'<div style="font-size:13px">'+t('lib_empty_sub')+'</div></div>';
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
    return '<div class="card" style="text-align:center;padding:52px 24px">'
      +'<svg width="48" height="48" fill="none" stroke="var(--muted)" stroke-width="1.2" viewBox="0 0 24 24" style="margin:0 auto 14px;display:block"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
      +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">'+(t('lib_no_vendor_groups'))+'</div>'
      +'<div style="font-size:13px;color:var(--muted);max-width:380px;margin:0 auto 20px">'+(t('lib_no_vendor_groups_sub'))+'</div>'
      +'<button class="btn btn-primary btn-create-gradient" onclick="libNewVendorGroupModal()">'
      +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(' '+t('lib_new_vendor_group'))+'</button></div>';
  }
  var rows=lib.vendors.map(function(e){ return libVendorGroupRow(e,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" id="lib-vg-search" placeholder="'+(t('lib_search_groups'))+'" oninput="libSearchVendorGroups(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-vg-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libLoadSelectedVendorGroups()">'
    +(t('lib_load'))+'</button>'
    +'<button id="lib-vg-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none;white-space:nowrap" onclick="libDeleteSelectedVendorGroups()">'
    +(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div id="lib-vendor-group-table-wrap">'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-vg-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllVendorGroups(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_name_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_vendors_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_categories_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_date_col'))+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-vg-rows">'+rows+'</tbody>'
    +'</table></div></div>';
}
function libVendorGroupRow(entry,isES){
  var vCount=(entry.vendors||[]).length;
  var cats={};
  (entry.vendors||[]).forEach(function(v){ if(v.category) cats[v.category]=true; });
  var catNames=Object.keys(cats);
  var catText=catNames.length?esc(catNames.slice(0,2).join(', '))+(catNames.length>2?' +'+(catNames.length-2):''):'—';
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-vg-sel" data-id="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateVendorGroupBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle"><a href="javascript:void(0)" onclick="event.stopPropagation();libOpenVendorGroup(\''+entry.id+'\')" style="color:inherit;text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--gold)\'" onmouseout="this.style.color=\'inherit\'">'+esc(entry.name)+'</a></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+vCount+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+catText+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(entry.date||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadVendors(\''+entry.id+'\')">'+(t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar nombre':'Edit name')+'" onclick="libRenameVendorGroup(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\'vendors\',\''+entry.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
function renderLibVendorGroupDetail(lib,entry,isES){
  var vendors=entry.vendors||[];
  var header='<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:15px;font-weight:700;color:var(--text)">'+esc(entry.name)+'</div>'
    +'<button class="btn btn-ghost btn-sm btn-icon" onclick="libRenameVendorGroup(\''+entry.id+'\')" title="'+(t('lib_rename'))+'">'
    +'<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<div style="font-size:12px;color:var(--muted);margin-left:auto">'+vendors.length+' '+(isES?'proveedor(es)':'vendor(s)')+'</div>'
    +'</div>';
  if(!vendors.length){
    return header
      +'<section class="ev-empty fade-in">'
      +'<div class="ev-empty-shell"><div class="ev-empty-aurora" aria-hidden="true"></div>'
      +'<div class="ev-empty-grid"><div class="ev-empty-copy">'
      +'<div class="ev-empty-badge">'+(isES?'Configuración de proveedores':'Vendor setup')+'</div>'
      +'<h2 class="ev-empty-title">'+(isES?'Organiza todos tus proveedores en un solo lugar.':'Organize all your vendors in one place.')+'</h2>'
      +'<p class="ev-empty-subtitle">'+(isES?'Crea un plan de proveedores para este grupo. El asistente sugiere los proveedores que necesitas según los servicios que requieras.':'Create a vendor plan for this group. The wizard suggests the vendors you need based on the services you require.')+'</p>'
      +'<div class="ev-empty-actions">'
      +'<button class="btn btn-primary btn-create-gradient ev-empty-cta" onclick="libOpenVendorSetupWizardForGroup(\''+entry.id+'\')">'
      +'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Crear Plan de Proveedores':'Create Vendor Plan')+'</button>'
      +'<button class="btn btn-ghost ev-empty-cta" onclick="libOpenVendorModalForGroup(\''+entry.id+'\')">'
      +'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Agregar Proveedor':'Add Vendor')+'</button>'
      +'</div></div></div></div></section>';
  }
  var rows=vendors.map(function(v){ return libVendorRow({entryId:entry.id,v:v},isES); }).join('');
  return header
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar proveedores...':'Search vendors...')+'" oninput="libFilterVendors(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadToEvent()">'
    +(t('lib_load'))+'</button>'
    +'</div>'
    +'<div id="lib-vendor-table-wrap">'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllVendors(this.checked)" title="'+(isES?'Seleccionar todos':'Select all')+'"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Proveedor':'Vendor')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Contacto':'Contact')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Servicios':'Services')+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-vendor-rows">'+rows+'</tbody>'
    +'</table></div></div>';
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
  if(el) el.innerHTML=filtered.length?filtered.map(function(e){ return libVendorGroupRow(e,isES); }).join('')
    :'<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted);font-size:13px">'+(isES?'Sin resultados':'No results')+'</td></tr>';
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
  return '<tr onclick="libOpenVendorModalForGroup(\''+item.entryId+'\',\''+v.id+'\')" style="cursor:pointer" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-v-sel" data-entry="'+item.entryId+'" data-vid="'+v.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;min-width:180px">'+esc(v.name)+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);min-width:220px;white-space:nowrap">'+esc(v.contact||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);min-width:260px;white-space:nowrap">'+esc(v.services||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadVendorToEvent(\''+item.entryId+'\',\''+v.id+'\')">'+( t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libOpenVendorModalForGroup(\''+item.entryId+'\',\''+v.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Duplicar':'Duplicate')+'" onclick="libDuplicateSingleVendor(\''+item.entryId+'\',\''+v.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDeleteSingleVendor(\''+item.entryId+'\',\''+v.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
function renderLibVendors(lib){
  var isES=LANG==='es';
  var allV=[];
  lib.vendors.forEach(function(entry){
    (entry.vendors||[]).forEach(function(v){ allV.push({entryId:entry.id, v:v}); });
  });
  if(!allV.length) return libEmpty();
  var rows=allV.map(function(item){ return libVendorRow(item,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar proveedores...':'Search vendors...')+'" oninput="libFilterVendors(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadToEvent()">'
    +(t('lib_load'))+'</button>'
    +'</div>'
    +'<div id="lib-vendor-table-wrap">'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllVendors(this.checked)" title="'+(isES?'Seleccionar todos':'Select all')+'"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Proveedor':'Vendor')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Contacto':'Contact')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Servicios':'Services')+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-vendor-rows">'+rows+'</tbody>'
    +'</table></div></div>';
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
  var rows=filtered.map(function(item){ return libVendorRow(item,isES); }).join('');
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
  if(!vendors.length){
    document.getElementById('csv-preview').innerHTML='<p style="color:var(--danger);font-size:12px">'+(isES?'No se encontraron proveedores válidos':'No valid vendors found')+'</p>';
    return;
  }
  var rows=vendors.slice(0,5).map(function(v){
    return '<tr><td style="padding:6px 8px;font-size:12px;font-weight:600">'+esc(v.name)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(v.services||'—')+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(v.contact||'—')+'</td></tr>';
  }).join('');
  document.getElementById('csv-preview').innerHTML=
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">'+(isES?'Vista previa':'Preview')+' ('+vendors.length+' '+(isES?'proveedores':'vendors')+'):</div>'
    +'<div style="overflow-x:auto;max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">'
    +'<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted)">'+(t('lib_name_col'))+'</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted)">'+(isES?'Servicios':'Services')+'</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted)">'+(isES?'Contacto':'Contact')+'</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
  document.getElementById('csv-import-btn').style.display='';
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
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-gt-sel" data-tid="'+tk.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateTaskBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle">'
    +'<div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:'+clr+';flex-shrink:0"></div>'+esc(tk.title)+'</div></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(tk.desc||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+(tk.durationDays?tk.durationDays+(isES?' días':' days'):'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(tk.assignee||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadTaskToEvent(\''+tk.id+'\')">'+( t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libEditGlobalTask(\''+tk.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Duplicar':'Duplicate')+'" onclick="libDuplicateGlobalTask(\''+tk.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDeleteGlobalTask(\''+tk.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
function renderLibGlobalTasks(lib){
  if(!lib.globalTasks) lib.globalTasks=[];
  var isES=LANG==='es';
  var tasks=lib.globalTasks;
  if(!tasks.length) return libEmpty();
  var rows=tasks.map(function(tk){ return libTaskRow(tk,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar tareas...':'Search tasks...')+'" oninput="libFilterTasks(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-task-bulk-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadTasksToEvent()">'
    +(isES?'Cargar Seleccionadas a Evento':'Load Selected into Event')+'</button>'
    +'</div>'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-task-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllTasks(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Tarea':'Task')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Descripción':'Description')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Duración':'Duration')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Asignado a':'Assignee')+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-task-rows">'+rows+'</tbody>'
    +'</table></div>';
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
    return '<div class="card" style="text-align:center;padding:52px 24px">'
      +'<svg width="48" height="48" fill="none" stroke="var(--muted)" stroke-width="1.2" viewBox="0 0 24 24" style="margin:0 auto 14px;display:block"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">'+(isES?'No hay grupos de tareas guardados':'No task groups saved yet')+'</div>'
      +'<div style="font-size:13px;color:var(--muted);max-width:380px;margin:0 auto 20px">'+(isES?'Crea un nuevo grupo para organizar tus tareas reutilizables.':'Create a new group to organize your reusable tasks.')+'</div>'
      +'<button class="btn btn-primary btn-create-gradient" onclick="libNewTaskGroupModal()">'
      +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?' Nuevo Grupo de Tareas':' New Task Group')+'</button></div>';
  }
  var rows=groups.map(function(e){ return libTaskGroupRow(e,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" id="lib-tg-search" placeholder="'+(isES?'Buscar grupos o tareas...':'Search groups or tasks...')+'" oninput="libSearchTaskGroups(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-tg-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libLoadSelectedTaskGroups()">'
    +(t('lib_load'))+'</button>'
    +'<button id="lib-tg-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none;white-space:nowrap" onclick="libDeleteSelectedTaskGroups()">'
    +(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-tg-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllTaskGroups(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_name_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Tareas':'Tasks')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Vista previa':'Preview')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_date_col'))+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-tg-rows">'+rows+'</tbody>'
    +'</table></div></div>';
}
function libTaskGroupRow(entry,isES){
  var taskCount=(entry.tasks||[]).length;
  var preview=(entry.tasks||[]).slice(0,3).map(function(tk){return esc(tk.title||'');}).join(', ')+(taskCount>3?' +'+(taskCount-3):'');
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-tg-sel" data-id="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateTaskGroupBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle"><a href="javascript:void(0)" onclick="event.stopPropagation();libOpenTaskGroup(\''+entry.id+'\')" style="color:inherit;text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--gold)\'" onmouseout="this.style.color=\'inherit\'">'+esc(entry.name)+'</a></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+taskCount+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(preview||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(entry.date||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadTasks(\''+entry.id+'\')">'+(t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar nombre':'Edit name')+'" onclick="libRenameTaskGroup(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\'tasks\',\''+entry.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
function renderLibTaskGroupDetail(lib,entry,isES){
  var tasks=entry.tasks||[];
  var header='<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:15px;font-weight:700;color:var(--text)">'+esc(entry.name)+'</div>'
    +'<button class="btn btn-ghost btn-sm btn-icon" onclick="libRenameTaskGroup(\''+entry.id+'\')" title="'+(t('lib_rename'))+'">'
    +'<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<div style="font-size:12px;color:var(--muted);margin-left:auto">'+tasks.length+' '+(isES?'tarea(s)':'task(s)')+'</div>'
    +'</div>';
  if(!tasks.length){
    return header
      +'<section class="ev-empty fade-in">'
      +'<div class="ev-empty-shell"><div class="ev-empty-aurora" aria-hidden="true"></div>'
      +'<div class="ev-empty-grid"><div class="ev-empty-copy">'
      +'<div class="ev-empty-badge">'+(isES?'Cronograma inicial':'Timeline starter')+'</div>'
      +'<h2 class="ev-empty-title">'+(isES?'Comienza con un plan maestro listo para trabajar.':'Start with a master plan that is ready to work from.')+'</h2>'
      +'<p class="ev-empty-subtitle">'+(isES?'Crea una plantilla completa de planificación para este grupo. Después podrás editar cada tarea, responsable y duración como quieras.':'Create a full planning template for this group. After that, you can edit every task, assignee, and duration however you like.')+'</p>'
      +'<div class="ev-empty-actions">'
      +'<button class="btn btn-primary btn-create-gradient ev-empty-cta" onclick="libOpenTemplatePlanWizardForGroup(\''+entry.id+'\')">'
      +'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Crear Plan de Plantilla':'Create Template Plan')+'</button>'
      +'<button class="btn btn-ghost ev-empty-cta" onclick="libOpenTaskModalForGroup(\''+entry.id+'\')">'
      +'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Agregar Tarea':'Add Task')+'</button>'
      +'</div></div></div></div></section>';
  }
  var rows=tasks.map(function(tk){ return libGroupTaskRow(entry.id,tk,isES); }).join('');
  return header
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar tareas...':'Search tasks...')+'" oninput="libFilterGroupTasks(\''+entry.id+'\',this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-gtg-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadGroupTasksToEvent(\''+entry.id+'\')">'
    +(t('lib_load'))+'</button>'
    +'</div>'
    +'<div id="lib-task-table-wrap">'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-gtg-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllGroupTasks(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Tarea':'Task')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Descripción':'Description')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Duración':'Duration')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Asignado a':'Assignee')+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-gtg-task-rows">'+rows+'</tbody>'
    +'</table></div></div>';
}
function libGroupTaskRow(entryId,tk,isES){
  var clr=tk.color||'#7c3aed';
  return '<tr onclick="libOpenTaskModalForGroup(\''+entryId+'\',\''+tk.id+'\')" style="cursor:pointer" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-gtg-sel" data-entry="'+entryId+'" data-tid="'+tk.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateGroupTaskBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle;min-width:180px">'
    +'<div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:'+clr+';flex-shrink:0"></div>'+esc(tk.title)+'</div></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);min-width:280px;white-space:nowrap">'+esc(tk.desc||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+(tk.durationDays?tk.durationDays+(isES?' días':' days'):'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);min-width:180px;white-space:nowrap">'+esc(tk.assignee||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadGroupTaskToEvent(\''+entryId+'\',\''+tk.id+'\')">'+( t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libOpenTaskModalForGroup(\''+entryId+'\',\''+tk.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDeleteGroupTask(\''+entryId+'\',\''+tk.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
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
  if(el) el.innerHTML=filtered.length?filtered.map(function(e){ return libTaskGroupRow(e,isES); }).join('')
    :'<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted);font-size:13px">'+(isES?'Sin resultados':'No results')+'</td></tr>';
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
  var filtered=s===''?entry.tasks:(entry.tasks||[]).filter(function(tk){
    return [tk.title,tk.desc,tk.assignee].some(function(f){return f&&f.toLowerCase().includes(s);});
  });
  var tb=document.getElementById('lib-gtg-task-rows');
  if(tb) tb.innerHTML=filtered.map(function(tk){ return libGroupTaskRow(entryId,tk,isES); }).join('');
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
  var rows=filtered.map(function(tk){ return libTaskRow(tk,isES); }).join('');
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

function libLayoutRow(entry, isES){
  var tables=(entry.items||[]).filter(function(i){return i.shape&&i.shape.includes('table');}).length;
  var seats=(entry.items||[]).reduce(function(s,i){return s+(i.chairs||0);},0);
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-ly-sel" data-lid="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateLayoutBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle"><a href="javascript:void(0)" onclick="event.stopPropagation();libOpenLayoutEditor(\''+entry.id+'\')" style="color:inherit;text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--gold)\'" onmouseout="this.style.color=\'inherit\'">'+esc(entry.name)+'</a></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(entry.location||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+(entry.guests||seats||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+tables+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(entry.notes||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadLayoutToEvent(\''+entry.id+'\')">'+( t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libOpenLayoutEditor(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Duplicar':'Duplicate')+'" onclick="libDuplicateLayout(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\'layouts\',\''+entry.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
var _expandedLibLayoutIds=[];
function toggleLibLayoutExpand(lid){
  var idx=_expandedLibLayoutIds.indexOf(lid);
  if(idx>-1) _expandedLibLayoutIds.splice(idx,1); else _expandedLibLayoutIds.push(lid);
  var card=document.querySelector('.llmc[data-lid="'+lid+'"]');
  if(card) card.classList.toggle('emc-open',_expandedLibLayoutIds.indexOf(lid)>-1);
}
function libLayoutCard(entry, isES){
  var tables=(entry.items||[]).filter(function(i){return i.shape&&i.shape.includes('table');}).length;
  var seats=(entry.items||[]).reduce(function(s,i){return s+(i.chairs||0);},0);
  var isOpen=_expandedLibLayoutIds.indexOf(entry.id)>-1;
  return `<article class="emc llmc${isOpen?' emc-open':''}" data-lid="${entry.id}">
    <div class="emc-summary" onclick="toggleLibLayoutExpand('${entry.id}')">
      <label onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0">
        <input type="checkbox" class="lib-ly-sel" data-lid="${entry.id}" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateLayoutBulkBtn()">
      </label>
      <div class="emc-info">
        <div class="emc-name">${esc(entry.name)}</div>
        <div class="emc-row">
          <span class="emc-date">${tables} ${isES?'mesas':'tables'} · ${seats} ${isES?'sillas':'seats'}</span>
          ${entry.location?'<span class="emc-days">'+esc(entry.location)+'</span>':''}
        </div>
      </div>
      <svg class="emc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="emc-detail">
      <div class="emc-meta">
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Invitados':'Guests'}</span><span class="emc-meta-val">${entry.guests||seats||'—'}</span></div>
        <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Mesas':'Tables'}</span><span class="emc-meta-val">${tables||'—'}</span></div>
        ${entry.location?'<div class="emc-meta-item"><span class="emc-meta-lbl">'+(isES?'Ubicación':'Location')+'</span><span class="emc-meta-val">'+esc(entry.location)+'</span></div>':''}
        ${entry.notes?'<div class="emc-meta-item emc-meta-full"><span class="emc-meta-lbl">'+(isES?'Notas':'Notes')+'</span><span class="emc-meta-val">'+esc(entry.notes)+'</span></div>':''}
      </div>
      <div class="emc-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" onclick="libOpenLayoutEditor('${entry.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg> ${isES?'Abrir':'Open'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libLoadLayoutToEvent('${entry.id}')">${isES?'Cargar':'Load'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libDuplicateLayout('${entry.id}')">${isES?'Duplicar':'Duplicate'}</button>
        <button class="btn btn-danger btn-sm" onclick="libDelete('layouts','${entry.id}')">${isES?'Eliminar':'Delete'}</button>
      </div>
    </div>
  </article>`;
}
function renderLibLayouts(lib){
  if(!lib.layouts.length){
    var isES=LANG==='es';
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center">'
      +'<div style="width:80px;height:80px;border-radius:50%;background:var(--gold-l);display:flex;align-items:center;justify-content:center;margin-bottom:24px">'
      +'<svg width="36" height="36" fill="none" stroke="var(--gold-h)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>'
      +'<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:26px;font-weight:700;margin-bottom:10px">'+(isES?'Crea tu primer layout':'Create your first layout')+'</h2>'
      +'<p style="color:var(--muted);font-size:14px;max-width:400px;margin-bottom:32px">'+(isES?'Diseña layouts reutilizables con mesas, pista de baile, escenario y más. Cárgalos en cualquier evento.':'Design reusable layouts with tables, dance floor, stage and more. Load them into any event.')+'</p>'
      +'<button class="btn btn-primary btn-create-gradient" style="padding:14px 32px;font-size:15px" onclick="libOpenLayoutWizard()">'
      +'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:8px"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Crear primer layout':'Create First Layout')+'</button>'
      
      +'</div>';
  }
  var isES=LANG==='es';
  if(isPhoneViewport()){
    var cards=lib.layouts.map(function(entry){ return libLayoutCard(entry,isES); }).join('');
    return '<div class="mobile-section-toolbar">'
      +'<div style="display:grid;gap:10px">'
      +'<input class="input" placeholder="'+(isES?'Buscar planos...':'Search layouts...')+'" oninput="libFilterLayouts(this.value)">'
      +'<div class="mobile-inline-actions">'
      +'<label class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:8px">'
      +'<input type="checkbox" id="lib-layout-chk-all" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllLayouts(this.checked)">'
      +'<span>'+(isES?'Seleccionar visibles':'Select visible')+'</span></label>'
      +'<button id="lib-layout-bulk-btn" class="btn btn-primary btn-sm" style="display:none" onclick="libBulkLoadLayoutsToEvent()">'+(isES?'Cargar':'Load')+'</button>'
      +'<button id="lib-layout-bulk-del" class="btn btn-danger btn-sm" style="display:none" onclick="libBulkDeleteLayouts()">'+(isES?'Eliminar':'Delete')+'</button>'
      +'</div></div>'
      +'</div>'
      +'<div id="lib-layout-rows" class="mobile-card-list">'+cards+'</div>'
      +renderMobileStickyActionBar('<button class="btn btn-primary btn-create-gradient" onclick="libOpenLayoutWizard()">'+(isES?'Nuevo Layout':'New Layout')+'</button>');
  }
  var rows=lib.layouts.map(function(entry){ return libLayoutRow(entry,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar planos...':'Search layouts...')+'" oninput="libFilterLayouts(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-layout-bulk-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadLayoutsToEvent()">'
    +(t('lib_load'))+'</button>'
    +'<button id="lib-layout-bulk-del" class="btn btn-danger btn-sm" style="display:none;white-space:nowrap;margin-left:6px" onclick="libBulkDeleteLayouts()">'
    +(isES?'Eliminar Seleccionados':'Delete Selected')+'</button>'
    +'</div>'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-layout-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllLayouts(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_name_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Ubicación':'Location')+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Invitados':'Guests')+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Mesas':'Tables')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Descripción':'Description')+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-layout-rows">'+rows+'</tbody>'
    +'</table></div>';
}
function libFilterLayouts(q){
  var lib=getLib(); var isES=LANG==='es';
  var s=q.trim().toLowerCase();
  var filtered=s===''?lib.layouts:lib.layouts.filter(function(e){
    var tables=String(e.items?e.items.filter(function(i){return i.shape&&i.shape.includes('table');}).length:'');
    return [e.name,e.location,e.notes,e.guests,tables].some(function(f){return f&&String(f).toLowerCase().includes(s);});
  });
  var rows=isPhoneViewport()
    ? (filtered.length?filtered.map(function(e){ return libLayoutCard(e,isES); }).join(''):'<div class="mobile-record-card" style="text-align:center;color:var(--muted)">'+(isES?'Sin resultados':'No results')+'</div>')
    : filtered.map(function(e){ return libLayoutRow(e,isES); }).join('');
  var tb=document.getElementById('lib-layout-rows'); if(tb) tb.innerHTML=rows;
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
  var data = lib[type]||{};
  var keys = Object.keys(data);
  if(!keys.length) return libEmpty();
  var typeLabel = {tables:t('lib_tables'),elements:t('lib_elements'),chairs:t('lib_chairs'),centerpieces:t('lib_centerpieces')}[type]||type;
  var loadBtn_all = proj()
    ? '<button class="btn btn-primary btn-sm" onclick="libLoadTypes(\''+type+'\')">'+t('lib_load_btn')+'</button>'
    : '';
  return lib[type+'_packs'] && lib[type+'_packs'].length
    ? lib[type+'_packs'].map(function(pack){
        var sub = Object.keys(pack.data).length+' '+typeLabel+' · '+pack.date;
        var loadBtn = proj()
          ? '<button class="btn btn-primary btn-sm" onclick="libLoadTypesPack(\''+type+'\',\''+pack.id+'\')">'+t('lib_load_btn')+'</button>'
          : '';
        return libCard(pack.name, sub, '', loadBtn, pack.id, type+'_pack');
      }).join('')
    : '<div style="padding:16px 18px;background:#fff;border:1.5px solid var(--border);border-radius:var(--r-lg)">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +'<div style="font-weight:700;font-size:14px">'+typeLabel+' <span style="font-weight:400;color:var(--muted);font-size:12px">('+keys.length+')</span></div>'
      +loadBtn_all+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
      +keys.map(function(k){
        var item=data[k]; var lbl=item.label||k;
        return '<span class="badge b-gray" style="display:inline-flex;align-items:center;gap:4px">'
          +(item.color?'<span style="width:10px;height:10px;border-radius:2px;background:'+item.color+';display:inline-block"></span>':'')
          +esc(lbl)+'</span>';
      }).join('')+'</div></div>';
}

function libFilterMoodboards(q){
  var lib=getLib(); var isES=LANG==='es';
  var s=q.trim().toLowerCase();
  var filtered=s===''?lib.moodboards:lib.moodboards.filter(function(e){return e.name.toLowerCase().includes(s);});
  var el=document.getElementById('lib-mb-rows'); if(!el) return;
  el.innerHTML=isPhoneViewport()
    ? (filtered.length?filtered.map(function(e){ return libMoodboardCard(e,isES); }).join(''):'<div class="mobile-record-card" style="text-align:center;color:var(--muted)">'+(isES?'Sin resultados':'No results')+'</div>')
    : (filtered.length?filtered.map(function(e){ return _libMbRow(e,isES); }).join('')
      :'<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted);font-size:13px">'+(isES?'Sin resultados':'No results')+'</td></tr>');
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
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-mb-sel" data-id="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateMoodboardBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle"><a href="javascript:void(0)" onclick="event.stopPropagation();libOpenMoodboardFolder(\''+entry.id+'\')" style="color:inherit;text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--gold)\'" onmouseout="this.style.color=\'inherit\'">'+esc(entry.name)+'</a></td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+imgCnt+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+folderCount+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(entry.date||'—')+'</td>'
    +'<td style="padding:11px 14px;text-align:right" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadMoodboard(\''+entry.id+'\')">'+(t('lib_load'))+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libEditMoodboardFolder(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Duplicar':'Duplicate')+'" onclick="libDuplicateMoodboardFolder(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\'moodboards\',\''+entry.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
    +'</div></td>'
    +'</tr>';
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
    var breadcrumb='<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">'
      +'<button class="btn btn-ghost btn-sm" style="display:flex;align-items:center;gap:5px;padding:5px 10px" onclick="libMbBackToFolders()">'
      +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>'
      +(isES?'Moodboards':'Moodboards')+'</button>'
      +'<svg width="12" height="12" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'
      +'<span style="font-size:13px;font-weight:700">'+esc(entry.name)+'</span>'
      +'<span style="font-size:11px;color:var(--muted);margin-left:4px">'+images.length+' '+(isES?'imagen(es)':'image(s)')+'</span>'
      +'</div>';
    if(!images.length){
      return breadcrumb
        +'<div style="text-align:center;padding:60px 20px;color:var(--muted)">'
        +'<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="margin-bottom:14px;display:block;margin-left:auto;margin-right:auto"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        +'<div style="font-size:15px;font-weight:600;margin-bottom:6px">'+(isES?'Sin imágenes aún':'No images yet')+'</div>'
        +'<div style="font-size:13px;margin-bottom:24px">'+(isES?'Usa el botón "Subir Imágenes" para agregar fotos.':'Use the "Upload Images" button to add photos.')+'</div>'
        +'</div>';
    }
    return breadcrumb
      +'<div class="mb-gallery">'
      +images.map(function(src,i){
        var spanClass = typeof mbSpanClass === 'function' ? mbSpanClass(i, images.length) : '';
        return '<div class="mb-card mb-bento-item '+spanClass+'" onclick="libMbLightbox(\''+_mbOpenFolderId+'\','+i+')">'
          +'<div class="media-zoom" style="position:relative;overflow:hidden;cursor:zoom-in;flex:1;min-height:0">'
          +'<img src="'+src+'" class="media-zoom-img" alt="'+esc(LANG==='es'?'Imagen ampliada':'Zoomed image')+'" style="width:100%;height:100%;object-fit:cover;display:block" draggable="false">'
          +'<div class="media-zoom-overlay"></div>'
          +'<div class="mb-meta"><div class="mb-meta-title">'+esc(entry.name)+'</div><div class="mb-meta-sub">'+(isES?'Moodboard':'Moodboard')+'</div></div>'
          +'</div>'
          +'<div class="mb-card-actions" style="opacity:1">'
          +'<button class="icon-btn icon-btn-danger" onclick="event.stopPropagation();libMoodboardDeleteImage(\''+_mbOpenFolderId+'\','+i+')" title="'+(isES?'Eliminar':'Delete')+'">'
          +'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
          +'</div></div>';
      }).join('')
      +'</div>'
      +renderMobileStickyActionBar('<button class="btn btn-primary" onclick="libMoodboardUploadImages(\''+_mbOpenFolderId+'\')">'+(isES?'Subir imágenes':'Upload images')+'</button>');
  }

  if(!lib.moodboards.length){
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center">'
      +'<div style="width:80px;height:80px;border-radius:50%;background:var(--gold-l);display:flex;align-items:center;justify-content:center;margin-bottom:24px">'
      +'<svg width="36" height="36" fill="none" stroke="var(--gold-h)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg></div>'
      +'<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:26px;font-weight:700;margin-bottom:10px">'+(isES?'Crea tu primer moodboard':'Create your first moodboard')+'</h2>'
      +'<p style="color:var(--muted);font-size:14px;max-width:400px;margin-bottom:32px">'+(isES?'Organiza imágenes de inspiración en moodboards reutilizables para tus eventos.':'Organize inspiration images in reusable moodboards for your events.')+'</p>'
      +'<button class="btn btn-primary btn-create-gradient" style="padding:14px 32px;font-size:15px" onclick="libCreateMoodboardFolder()">'
      +'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:8px"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Crear primer moodboard':'Create First Moodboard')+'</button>'
      +'</div>';
  }
  if(isPhoneViewport()){
    var cards=lib.moodboards.map(function(e){ return libMoodboardCard(e,isES); }).join('');
    return '<div class="mobile-section-toolbar">'
      +'<div style="display:grid;gap:10px">'
      +'<input class="input" placeholder="'+(t('lib_search_groups'))+'" oninput="libFilterMoodboards(this.value)">'
      +'<div class="mobile-inline-actions">'
      +'<label class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:8px">'
      +'<input type="checkbox" id="lib-mb-chk-all" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllMoodboards(this.checked)">'
      +'<span>'+(isES?'Seleccionar visibles':'Select visible')+'</span></label>'
      +'<button id="lib-mb-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none" onclick="libLoadSelectedMoodboards()">'+(isES?'Cargar':'Load')+'</button>'
      +'<button id="lib-mb-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none" onclick="libDeleteSelectedMoodboards()">'+(isES?'Eliminar':'Delete')+'</button>'
      +'</div></div>'
      +'</div>'
      +'<div id="lib-mb-rows" class="mobile-card-list">'+cards+'</div>'
      +renderMobileStickyActionBar('<button class="btn btn-primary btn-create-gradient" onclick="libCreateMoodboardFolder()">'+(t('lib_new_moodboard'))+'</button>');
  }
  var rows=lib.moodboards.map(function(e){ return _libMbRow(e,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(t('lib_search_groups'))+'" oninput="libFilterMoodboards(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-mb-bulk-load-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libLoadSelectedMoodboards()">'
    +(t('lib_load'))+'</button>'
    +'<button id="lib-mb-bulk-del-btn" class="btn btn-danger btn-sm" style="display:none;white-space:nowrap" onclick="libDeleteSelectedMoodboards()">'
    +(t('lib_delete_sel'))+'</button>'
    +'</div>'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-mb-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllMoodboards(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_name_col'))+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Imágenes':'Images')+'</th>'
    +'<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Carpetas':'Folders')+'</th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(t('lib_date_col'))+'</th>'
    +'<th style="padding:9px 14px"></th>'
    +'</tr></thead>'
    +'<tbody id="lib-mb-rows">'+rows+'</tbody>'
    +'</table></div>';
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
    pgLib.innerHTML=
      '<div style="max-width:1200px;margin:0 auto;padding:32px 24px;width:100%">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
        +'<div><h1 class="editorial-title" id="lib-page-title" style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700">Layouts</h1>'
      +'<p id="lib-page-sub" style="display:none"></p></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap" id="lib-add-btns"></div>'
      +'</div>'
      +'<div style="display:none" id="lib-tabs"></div>'
      +'<div id="lib-content"></div>'
      +'</div>';
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
    pgLib.innerHTML=
      '<div style="max-width:1200px;margin:0 auto;padding:32px 24px;width:100%">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
        +'<div><h1 class="editorial-title" id="lib-page-title" style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700">Layouts</h1>'
      +'<p id="lib-page-sub" style="display:none"></p></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap" id="lib-add-btns"></div>'
      +'</div>'
      +'<div style="display:none" id="lib-tabs"></div>'
      +'<div id="lib-content"></div>'
      +'</div>';
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






