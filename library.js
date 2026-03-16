
var _libTab = 'vendors';

function getLib(){
  var all = uproj();
  if(!all['__library__']){
    all['__library__'] = {
      id:'__library__', name:'__library__',
      vendors:[], tasks:[], layouts:[],
      tables:{}, elements:{}, chairs:{}, centerpieces:{},
      moodboards:[]
    };
  }
  var lib = all['__library__'];
  if(!lib.vendors)     lib.vendors=[];
  // Seed default vendors if library is empty
  if(lib.vendors.length===0 && typeof defaultVendors==='function'){
    var dvs = defaultVendors();
    dvs.forEach(function(v){
      lib.vendors.push({id:'lv_def_'+v.id, name:v.name, date:new Date().toLocaleDateString(), vendors:[JSON.parse(JSON.stringify(v))]});
    });
    saveLib(lib);
  }
  // Seed default tasks if library tasks are empty
  if(!lib.globalTasks) lib.globalTasks=[];
  if(lib.globalTasks.length===0 && typeof defaultTasks==='function'){
    var dts = defaultTasks();
    dts.forEach(function(tk){
      lib.globalTasks.push({id:'gt_def_'+tk.id, title:tk.title, desc:tk.desc||'', dueDate:'', assignee:tk.assignee||'', color:tk.color||'#7c3aed', done:false});
    });
    saveLib(lib);
  }
  if(!lib.tasks)       lib.tasks=[];
  if(!lib.layouts)     lib.layouts=[];
  if(!lib.tables)      lib.tables={};
  if(!lib.elements)    lib.elements={};
  if(!lib.chairs)      lib.chairs={};
  if(!lib.centerpieces)lib.centerpieces={};
  if(!lib.moodboards)  lib.moodboards=[];
  return lib;
}
function saveLib(lib){ saveProj(lib); }

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
        +'<div><h1 id="lib-page-title" style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700">Layouts</h1>'
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
  var titles={vendors:LANG==='es'?'Proveedores':'Vendors', tasks:LANG==='es'?'Tareas':'Tasks', layouts:LANG==='es'?'Planos':'Layouts', moodboards:'Moodboards'};
  var pt=document.getElementById('lib-page-title'); if(pt) pt.textContent=titles[_libTab]||t('lib_title');
  var ps=document.getElementById('lib-page-sub');   if(ps) ps.style.display='none';
}

function renderLibrary(){
  updateLibraryLabels();
  var lib = getLib();

  var tabs = [
    {key:'vendors',    icon:'🏢', lbl:t('lib_vendors'),     cnt: lib.vendors.length},
    {key:'tasks',      icon:'📅', lbl:t('lib_tasks'),       cnt: lib.tasks.length},
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
      addEl.innerHTML =
        '<button class="btn btn-ghost btn-sm" onclick="libImportCSV()" style="display:flex;align-items:center;gap:5px;font-size:11px">'
        +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        +(LANG==='es'?'Importar CSV':'Import CSV')+'</button>'
        +'<button class="btn btn-ghost btn-sm" onclick="libDownloadVendorTemplate()" style="display:flex;align-items:center;gap:5px;font-size:11px">'
        +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        +(LANG==='es'?'Descargar Plantilla':'Download Template')+'</button>'
        +'<button class="btn btn-primary" onclick="libAddGlobalVendor()">'
        +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
        +(LANG==='es'?'Agregar Proveedor':'Add Vendor')+'</button>';
    } else if(_libTab==='tasks'){
      addEl.innerHTML =
        '<button class="btn btn-ghost btn-sm" onclick="libImportTasksCSV()" style="display:flex;align-items:center;gap:5px;font-size:11px">'
        +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        +(LANG==='es'?'Importar CSV':'Import CSV')+'</button>'
        +'<button class="btn btn-ghost btn-sm" onclick="libDownloadTaskTemplate()" style="display:flex;align-items:center;gap:5px;font-size:11px">'
        +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        +(LANG==='es'?'Descargar Plantilla':'Download Template')+'</button>'
        +'<button class="btn btn-primary" onclick="libAddGlobalTask()">'
        +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
        +(LANG==='es'?'Agregar Tarea':'Add Task')+'</button>';
    } else if(_libTab==='layouts'){
      addEl.innerHTML = lib.layouts.length
        ? '<button class="btn btn-primary" onclick="libOpenLayoutWizard()">'
          +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
          +(LANG==='es'?'Nuevo Plano':'New Layout')+'</button>'
        : '';
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
    case 'vendors':     el.innerHTML = renderLibVendors(lib); break;
    case 'tasks':       el.innerHTML = renderLibGlobalTasks(lib); break;
    case 'layouts':     el.innerHTML = renderLibLayouts(lib); break;
    case 'tables':      el.innerHTML = renderLibTypes(lib,'tables'); break;
    case 'elements':    el.innerHTML = renderLibTypes(lib,'elements'); break;
    case 'chairs':      el.innerHTML = renderLibTypes(lib,'chairs'); break;
    case 'centerpieces':el.innerHTML = renderLibTypes(lib,'centerpieces'); break;
    case 'moodboards':  el.innerHTML = renderLibMoodboards(lib); break;
  }
}

function setLibTab(key){ _libTab=key; renderLibrary(); }

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
    +'<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>'
    +'</div></div>';
}

function libVendorRow(item, isES){
  var v=item.v;
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-v-sel" data-entry="'+item.entryId+'" data-vid="'+v.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px">'+esc(v.name)+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(v.contact||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v.services||'—')+'</td>'
    +'<td style="padding:11px 14px" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadVendorToEvent(\''+item.entryId+'\',\''+v.id+'\')">'+( isES?'Cargar a Evento':'Load into Event')+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libEditGlobalVendor(\''+item.entryId+'\',\''+v.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDeleteSingleVendor(\''+item.entryId+'\',\''+v.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>'
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
    +(isES?'Cargar Seleccionados a Evento':'Load Selected into Event')+'</button>'
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
  lib.vendors.forEach(function(entry){(entry.vendors||[]).forEach(function(v){allV.push({entryId:entry.id,v:v});});});
  var filtered=q.trim()===''?allV:allV.filter(function(item){
    var v=item.v; var s=q.toLowerCase();
    return [v.name,v.category,v.subcategory,v.services,v.contact,v.notes].some(function(f){return f&&f.toLowerCase().includes(s);});
  });
  var rows=filtered.map(function(item){ return libVendorRow(item,isES); }).join('');
  var tb=document.getElementById('lib-vendor-rows'); if(tb) tb.innerHTML=rows;
  libUpdateBulkBtn();
}
function libDeleteSingleVendor(entryId, vid){
  if(!confirm(LANG==='es'?'¿Eliminar este proveedor?':'Delete this vendor?')) return;
  var lib=getLib();
  var entry=lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  entry.vendors=entry.vendors.filter(function(v){return v.id!==vid;});
  if(!entry.vendors.length) lib.vendors=lib.vendors.filter(function(e){return e.id!==entryId;});
  saveLib(lib); renderLibrary();
  toast(LANG==='es'?'Proveedor eliminado':'Vendor deleted');
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
    +'<div class="ig"><label>'+(isES?'Categoría':'Category')+'</label><select class="select" id="glv-cat"><option>Venue & Rentals</option><option>Food & Beverage</option><option>Floral & Decor</option><option>Photography & Video</option><option>Entertainment & Music</option><option>Staffing</option><option>Transportation</option><option>Admin & Compliance</option><option>Other</option></select></div>'
    +'<div class="ig"><label>'+(isES?'Subcategoría':'Subcategory')+'</label><input class="input" id="glv-sub" placeholder="e.g. Florals"></div>'
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
  var v={id:'glv'+Date.now(),name:name,category:(document.getElementById('glv-cat')||{}).value||'',subcategory:(document.getElementById('glv-sub')||{}).value||'',services:(document.getElementById('glv-svc')||{}).value||'',contact:(document.getElementById('glv-email')||{}).value||'',phone:(document.getElementById('glv-phone')||{}).value||'',notes:(document.getElementById('glv-notes')||{}).value||'',hired:false,vendorStatus:'pending',budget:0,payments:[]};
  var lib=getLib();
  lib.vendors.push({id:'lv'+Date.now(),name:v.name,date:new Date().toLocaleDateString(),vendors:[v]});
  saveLib(lib); closeMo(); renderLibrary();
  toast(LANG==='es'?'Proveedor guardado':'Vendor saved','s');
}
function libDownloadVendorTemplate(){
  var csv='Name,Category,Subcategory,Services,Contact Email,Phone,Notes\n'
    +'"Media & Content","Photography & Video","Photography","Photography, Videography","contact@example.com","555-0000","Sample vendor"\n';
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
    reader.onload=function(e){
      try{
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
function parseCsvToVendors(csvText){
  var lines=csvText.trim().split('\n');
  if(lines.length<2) return [];
  var headers=lines[0].split(',').map(function(h){return h.replace(/"/g,'').trim().toLowerCase();});
  var results=[];
  for(var i=1;i<lines.length;i++){
    var cols=lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,))/g)||lines[i].split(',');
    cols=cols.map(function(c){return (c||'').replace(/^"|"$/g,'').trim();});
    var obj={};
    headers.forEach(function(h,idx){obj[h]=cols[idx]||'';});
    var name=obj['name']||obj['nombre']||'';
    if(!name) continue;
    results.push({
      id:'csv'+Date.now()+i,
      name:name,
      category:obj['category']||obj['categoría']||obj['categoria']||'',
      subcategory:obj['subcategory']||obj['subcategoría']||obj['subcategoria']||'',
      services:obj['services']||obj['servicios']||'',
      contact:obj['contact email']||obj['email']||obj['contacto']||'',
      phone:obj['phone']||obj['teléfono']||obj['telefono']||'',
      notes:obj['notes']||obj['notas']||'',
      hired:false, vendorStatus:'pending', budget:0, payments:[]
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
      +'<td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(v.category)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:var(--muted)">'+esc(v.contact||'—')+'</td></tr>';
  }).join('');
  document.getElementById('csv-preview').innerHTML=
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">'+(isES?'Vista previa':'Preview')+' ('+vendors.length+' '+(isES?'proveedores':'vendors')+'):</div>'
    +'<div style="overflow-x:auto;max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">'
    +'<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted)">'+(isES?'Nombre':'Name')+'</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted)">'+(isES?'Categoría':'Category')+'</th>'
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
      lib.vendors.push({id:'lv'+Date.now()+added,name:v.name,date:new Date().toLocaleDateString(),vendors:[JSON.parse(JSON.stringify(v))]});
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
    var loadBtn = proj()?'<button class="btn btn-primary btn-sm" onclick="libLoadTasks(\''+entry.id+'\')">'+t('lib_load_btn')+'</button>':'';
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
    +'<td style="padding:11px 14px" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadTaskToEvent(\''+tk.id+'\')">'+( isES?'Cargar a Evento':'Load into Event')+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libEditGlobalTask(\''+tk.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDeleteGlobalTask(\''+tk.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>'
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
  var colors=['#7c3aed','#c9a84c','#10b981','#f59e0b','#ec4899','#ef4444'];
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
  var colors=['#7c3aed','#c9a84c','#10b981','#f59e0b','#ec4899','#ef4444'];
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
  if(!confirm(LANG==='es'?'¿Eliminar esta tarea?':'Delete this task?')) return;
  var lib=getLib();
  lib.globalTasks=(lib.globalTasks||[]).filter(function(t){return t.id!==tid;});
  saveLib(lib); renderLibrary();
  toast(LANG==='es'?'Tarea eliminada':'Task deleted');
}
function libLoadTaskToEvent(tid){
  var lib=getLib();
  var tk=(lib.globalTasks||[]).find(function(t){return t.id===tid;});
  if(!tk) return;
  libOpenTaskEventPickerModal([tk]);
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
    +'"Venue Selection","Research and visit venue options","2024-03-15","Venue Manager","#c9a84c"\n';
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
    document.getElementById('csv-task-preview').innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:6px">'+(isES?'Vista previa':'Preview')+' ('+_csvTasksParsed.length+' '+(isES?'tareas':'tasks')+'):</div><div style="overflow-x:auto;max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:6px"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)"><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(isES?'Título':'Title')+'</th><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(isES?'Fecha':'Date')+'</th><th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left">'+(isES?'Asignado a':'Assignee')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
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
  var tables=entry.items.filter(function(i){return i.shape&&i.shape.includes('table');}).length;
  var seats=entry.items.reduce(function(s,i){return s+(i.chairs||0);},0);
  return '<tr onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
    +'<td style="padding:11px 12px;width:36px" onclick="event.stopPropagation()">'
    +'<input type="checkbox" class="lib-ly-sel" data-lid="'+entry.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libUpdateLayoutBulkBtn()">'
    +'</td>'
    +'<td style="padding:11px 14px;font-weight:600;font-size:13px;vertical-align:middle">'+esc(entry.name)+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted)">'+esc(entry.location||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+(entry.guests||seats||'—')+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);text-align:center">'+tables+'</td>'
    +'<td style="padding:11px 14px;font-size:12px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(entry.notes||'—')+'</td>'
    +'<td style="padding:11px 14px" onclick="event.stopPropagation()">'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +'<button class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="libLoadLayoutToEvent(\''+entry.id+'\')">'+( isES?'Cargar a Evento':'Load into Event')+'</button>'
    +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Editar':'Edit')+'" onclick="libOpenLayoutEditor(\''+entry.id+'\')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>'
    +'<button class="btn btn-danger btn-sm btn-icon" onclick="libDelete(\'layouts\',\''+entry.id+'\')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>'
    +'</div></td>'
    +'</tr>';
}
function renderLibLayouts(lib){
  if(!lib.layouts.length){
    var isES=LANG==='es';
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center">'
      +'<div style="width:80px;height:80px;border-radius:50%;background:var(--gold-l);display:flex;align-items:center;justify-content:center;margin-bottom:24px">'
      +'<svg width="36" height="36" fill="none" stroke="var(--gold-h)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>'
      +'<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:26px;font-weight:700;margin-bottom:10px">'+(isES?'Crea tu primer plano':'Create your first layout')+'</h2>'
      +'<p style="color:var(--muted);font-size:14px;max-width:400px;margin-bottom:32px">'+(isES?'Diseña planos reutilizables con mesas, pista de baile, escenario y más. Cárgalos en cualquier evento.':'Design reusable layouts with tables, dance floor, stage and more. Load them into any event.')+'</p>'
      +'<button class="btn btn-primary" style="padding:14px 32px;font-size:15px" onclick="libOpenLayoutWizard()">'
      +'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:8px"><path d="M12 5v14M5 12h14"/></svg>'
      +(isES?'Crear Primer Plano':'Create First Layout')+'</button>'
      +'</div>';
  }
  var isES=LANG==='es';
  var rows=lib.layouts.map(function(entry){ return libLayoutRow(entry,isES); }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="position:relative;flex:1;display:flex;align-items:center">'
    +'<svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar planos...':'Search layouts...')+'" oninput="libFilterLayouts(this.value)" style="padding-left:36px;width:100%">'
    +'</div>'
    +'<button id="lib-layout-bulk-btn" class="btn btn-primary btn-sm" style="display:none;white-space:nowrap" onclick="libBulkLoadLayoutsToEvent()">'
    +(isES?'Cargar Seleccionados a Evento':'Load Selected into Event')+'</button>'
    +'</div>'
    +'<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg2);border-bottom:1px solid var(--border)">'
    +'<th style="padding:9px 12px;width:36px"><input type="checkbox" id="lib-layout-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="libToggleAllLayouts(this.checked)"></th>'
    +'<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">'+(isES?'Nombre':'Name')+'</th>'
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
  var rows=filtered.map(function(e){ return libLayoutRow(e,isES); }).join('');
  var tb=document.getElementById('lib-layout-rows'); if(tb) tb.innerHTML=rows;
}
function libUpdateLayoutBulkBtn(){
  var checked=document.querySelectorAll('.lib-ly-sel:checked').length;
  var btn=document.getElementById('lib-layout-bulk-btn');
  if(btn) btn.style.display=checked>0?'':'none';
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
function libOpenLayoutEventPicker(){
  var isES=LANG==='es';
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
  if(!allProjects.length) return toast(isES?'No hay eventos creados':'No events created yet','e');
  var eventRows=allProjects.map(function(p){
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;transition:.15s" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<input type="radio" name="ly-ev-pick" value="'+p.id+'" style="width:15px;height:15px;accent-color:var(--gold-h);flex-shrink:0">'
      +'<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(p.clientName||'')+(p.date?' · '+p.date:'')+'</div></div></label>';
  }).join('');
  openMo('<div class="mo-title">'+(isES?'Seleccionar Evento':'Select Event')+'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:12px">'+(isES?'Este plano reemplazará el plano actual del evento.':'This layout will replace the current layout of the selected event.')+'</p>'
    +'<div style="position:relative;margin-bottom:10px">'
    +'<svg width="14" height="14" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +'<input class="input" placeholder="'+(isES?'Buscar evento...':'Search event...')+'" oninput="libFilterLayoutEventPicker(this.value)" style="padding-left:32px">'
    +'</div>'
    +'<div id="ly-ev-pick-list" style="max-height:50vh;overflow-y:auto">'+eventRows+'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="libDoLoadLayoutToEvent()">'+(isES?'Cargar a Evento':'Load into Event')+'</button>'
    +'</div>');
}
function libFilterLayoutEventPicker(q){
  var allProjects=Object.values(uproj()).filter(function(p){return p&&p.id&&p.id!=='__library__'&&p.name;});
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
function libDoLoadLayoutToEvent(){
  var isES=LANG==='es';
  var sel=document.querySelector('input[name="ly-ev-pick"]:checked');
  if(!sel) return toast(isES?'Selecciona un evento':'Select an event','e');
  var pid=sel.value;
  var all=uproj(); var p=all[pid]; if(!p) return;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===_libPendingLayoutId;});
  if(!entry) return;
  // If the event already has a layout with items, save it to library first
  if(p.layoutItems&&p.layoutItems.length>0){
    var autoName=(p.name||'Event')+' — '+(isES?'Plano guardado automáticamente':'Auto-saved layout')+' '+new Date().toLocaleDateString();
    var tables=p.layoutItems.filter(function(i){return i.shape&&i.shape.includes('table');}).length;
    var seats=p.layoutItems.reduce(function(s,i){return s+(i.chairs||0);},0);
    lib.layouts.push({id:'ll_auto_'+Date.now(),name:autoName,notes:isES?'Guardado automáticamente al reemplazar':'Auto-saved before replace',location:'',guests:'',date:new Date().toLocaleDateString(),items:JSON.parse(JSON.stringify(p.layoutItems)),floorplan:p.floorplan?JSON.parse(JSON.stringify(p.floorplan)):null});
    saveLib(lib);
    toast(isES?'Plano anterior guardado en biblioteca':'Previous layout saved to library','s');
  }
  p.layoutItems=JSON.parse(JSON.stringify(entry.items));
  if(entry.floorplan&&entry.floorplan.img) p.floorplan=JSON.parse(JSON.stringify(entry.floorplan));
  else if(!entry.floorplan) p.floorplan={img:null};
  saveProj(p);
  closeMo();
  // If currently viewing this event's layout tab, refresh it
  if(typeof CID!=='undefined'&&CID===pid&&typeof CTAB!=='undefined'&&CTAB==='layout'&&typeof renderLayout==='function') renderLayout();
  toast(isES?'Plano cargado en el evento':'Layout loaded into event','s');
  _libPendingLayoutId=null;
}
window.libOpenLayoutEventPicker = libOpenLayoutEventPicker;
window.libFilterLayoutEventPicker = libFilterLayoutEventPicker;
window.libDoLoadLayoutToEvent = libDoLoadLayoutToEvent;
function libEditLayout(entryId){
  libOpenLayoutEditor(entryId);
}
function libSaveEditLayout(entryId){
  var name=(document.getElementById('ely-name')||{}).value||'';
  if(!name) return toast(LANG==='es'?'El nombre es requerido':'Name is required','e');
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;}); if(!entry) return;
  entry.name=name;
  entry.location=(document.getElementById('ely-location')||{}).value||'';
  entry.guests=(document.getElementById('ely-guests')||{}).value||'';
  entry.notes=(document.getElementById('ely-notes')||{}).value||'';
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

function renderLibMoodboards(lib){
  if(!lib.moodboards.length) return libEmpty();
  return lib.moodboards.map(function(entry){
    var imgCnt = entry.folders
      ? entry.folders.reduce(function(s,f){return s+f.images.length;},0) + (entry.uncategorized||[]).length
      : (entry.images||[]).length;
    var sub = (entry.isFolder ? (LANG==='es'?'Carpeta':'Folder')+' · ' : '')
      + imgCnt+' '+(LANG==='es'?'imagen(es)':'image(s)')
      +' · '+entry.date;
    var loadBtn = proj()
      ? '<button class="btn btn-primary btn-sm" onclick="libLoadMoodboard(\''+entry.id+'\')">'+t('lib_load_btn')+'</button>'
      : '';
    return libCard(entry.name, sub, '', loadBtn, entry.id, 'moodboards');
  }).join('');
}

function libDelete(type, id){
  if(!confirm(t('lib_delete_confirm'))) return;
  var lib = getLib();
  if(type==='vendors')     lib.vendors     = lib.vendors.filter(function(e){return e.id!==id;});
  else if(type==='tasks')  lib.tasks       = lib.tasks.filter(function(e){return e.id!==id;});
  else if(type==='layouts')lib.layouts     = lib.layouts.filter(function(e){return e.id!==id;});
  else if(type==='moodboards')lib.moodboards = lib.moodboards.filter(function(e){return e.id!==id;});
  else if(type.endsWith('_pack')){
    var baseType = type.replace('_pack','');
    if(lib[baseType+'_packs']) lib[baseType+'_packs'] = lib[baseType+'_packs'].filter(function(e){return e.id!==id;});
  }
  saveLib(lib);
  renderLibrary();
  toast(LANG==='es'?'Eliminado de biblioteca':'Removed from library');
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
  var vendorsToSave = (p.vendors||[]).filter(function(v){return ids.includes(v.id);});
  var lib = getLib();
  lib.vendors.push({id:'lv'+Date.now(), name:name, date:new Date().toLocaleDateString(), vendors: JSON.parse(JSON.stringify(vendorsToSave))});
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
  lib.tasks.push({id:'lt'+Date.now(), name:name, date:new Date().toLocaleDateString(), tasks: JSON.parse(JSON.stringify(tasksToSave))});
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
  var floorOpt = LState.floorplan&&LState.floorplan.img
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
  var name = (document.getElementById('lib-entry-name')||{}).value||'';
  if(!name) return toast(t('lib_save_name'),'e');
  var p = proj(); if(!p) return;
  var notes = (document.getElementById('lib-layout-notes')||{}).value||'';
  var location = (document.getElementById('lib-layout-location')||{}).value||'';
  var guests = (document.getElementById('lib-layout-guests')||{}).value||'';
  var incFloor = document.getElementById('lib-inc-floor');
  var floorplan = (incFloor&&incFloor.checked) ? JSON.parse(JSON.stringify(LState.floorplan)) : null;
  var lib = getLib();
  lib.layouts.push({
    id:'ll'+Date.now(), name:name, notes:notes, location:location, guests:guests,
    date:new Date().toLocaleDateString(),
    items: JSON.parse(JSON.stringify(p.layoutItems||[])),
    floorplan: floorplan
  });
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

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
  lib[type+'_packs'].push({id:'ltp'+Date.now(), name:name, date:new Date().toLocaleDateString(), data:dataToSave});
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
    date:new Date().toLocaleDateString(),
    folders: savedFolders,
    uncategorized: savedUncat
  });
  saveLib(lib);
  closeMo();
  toast(t('lib_saved'),'s');
  if(document.getElementById('pg-library')&&!document.getElementById('pg-library').classList.contains('hidden')) renderLibrary();
}

function libLoadVendors(entryId){
  var lib = getLib();
  var entry = lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var p = proj(); if(!p) return;
  openMo('<div class="mo-title">'+t('lib_load_from')+': '+esc(entry.name)+'</div>'
    +'<p class="s-hint">'
    +(LANG==='es'
      ? 'Se agregarán '+entry.vendors.length+' proveedor(es) al proyecto actual. Los duplicados se omitirán.'
      : entry.vendors.length+' vendor(s) will be added to the current project. Duplicates will be skipped.')
    +'</p>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_doLibLoadVendors(\''+entryId+'\')">'+t('lib_load_btn')+'</button>'
    +'</div>');
}
function _doLibLoadVendors(entryId){
  var lib = getLib();
  var entry = lib.vendors.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var p = proj(); if(!p) return;
  var existingNames = (p.vendors||[]).map(function(v){return v.name.toLowerCase();});
  var added = 0;
  entry.vendors.forEach(function(v){
    if(!existingNames.includes(v.name.toLowerCase())){
      var nv = JSON.parse(JSON.stringify(v));
      nv.id = 'v'+Date.now()+Math.random().toString(36).slice(2,6);
      nv.payments = [];
      p.vendors.push(nv);
      added++;
    }
  });
  saveProj(p);
  toast(t('lib_loaded')+' ('+added+' '+(LANG==='es'?'agregados':'added')+')','s');
  if(CTAB==='budget') renderBudget();
}

function libLoadTasks(entryId){
  var lib = getLib();
  var entry = lib.tasks.find(function(e){return e.id===entryId;});
  if(!entry) return;
  openMo('<div class="mo-title">'+t('lib_load_from')+': '+esc(entry.name)+'</div>'
    +'<p class="s-hint">'
    +(LANG==='es'
      ? 'Se agregarán '+entry.tasks.length+' tarea(s). Las fechas serán borradas para que puedas ajustarlas al nuevo proyecto.'
      : entry.tasks.length+' task(s) will be added. Dates will be cleared so you can set them for the new project.')
    +'</p>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_doLibLoadTasks(\''+entryId+'\')">'+t('lib_load_btn')+'</button>'
    +'</div>');
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
    +(entry.floorplan&&entry.floorplan.img
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
  var lib = getLib();
  var entry = lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var p = proj(); if(!p) return;
  p.layoutItems = JSON.parse(JSON.stringify(entry.items));
  var incFloor = document.getElementById('lib-load-floor');
  if(entry.floorplan && (!incFloor || incFloor.checked)){
    LState.floorplan = JSON.parse(JSON.stringify(entry.floorplan));
  }
  saveProj(p);
  toast(t('lib_loaded'),'s');
  if(CTAB==='layout') renderLayout();
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
  var totalImgs = (entry.uncategorized||[]).length
    + (entry.folders||[]).reduce(function(s,f){return s+f.images.length;},0);
  openMo('<div class="mo-title">'+t('lib_load_from')+': '+esc(entry.name)+'</div>'
    +'<p class="s-hint">'
    +(LANG==='es'
      ? totalImgs+' imagen(es) y '+(entry.folders||[]).length+' carpeta(s) serán añadidas al moodboard actual.'
      : totalImgs+' image(s) and '+(entry.folders||[]).length+' folder(s) will be merged into the current moodboard.')
    +'</p>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_doLibLoadMoodboard(\''+entryId+'\')">'+t('lib_load_btn')+'</button>'
    +'</div>');
}
function _doLibLoadMoodboard(entryId){
  var lib = getLib();
  var entry = lib.moodboards.find(function(e){return e.id===entryId;});
  if(!entry) return;
  var p = proj(); if(!p) return;
  var mb = getMB(p);
  (entry.uncategorized||[]).forEach(function(img){ mb.uncategorized.push(JSON.parse(JSON.stringify(img))); });
  (entry.folders||[]).forEach(function(f){
    var newF = JSON.parse(JSON.stringify(f));
    newF.id = 'f'+Date.now()+Math.random().toString(36).slice(2,6);
    mb.folders.push(newF);
  });
  p.moodboard = mb;
  saveProj(p);
  toast(t('lib_loaded'),'s');
  if(CTAB==='moodboard') renderMoodboard();
}

function libQuickSaveVendors(){ if(!proj()) return; libSaveVendorsModal(proj()); }
function libQuickSaveTasks(){   if(!proj()) return; libSaveTasksModal(proj()); }
function libQuickSaveLayout(){  if(!proj()) return; libSaveLayoutModal(proj()); }
function libQuickSaveMoodboard(){if(!proj()) return; libSaveMoodboardModal(proj()); }
function libQuickLoadVendors(){
  var lib=getLib(); if(!lib.vendors.length) return toast(LANG==='es'?'No hay proveedores guardados en la biblioteca':'No vendors saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  if(lib.vendors.length===1){ libLoadVendors(lib.vendors[0].id); return; }
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_vendors')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'
    +lib.vendors.map(function(e){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px">'
        +'<div><div style="font-weight:600;font-size:13px">'+esc(e.name)+'</div>'
        +'<div class="s-sm">'+e.vendors.length+' '+(LANG==='es'?'proveedor(es)':'vendor(s)')+' · '+e.date+'</div></div>'
        +"<button class=\"btn btn-primary btn-sm\" onclick=\"closeMo();libLoadVendors('"+e.id+"')\">"+t('lib_load_btn')+'</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button></div>');
}
function libQuickLoadTasks(){
  var lib=getLib(); if(!lib.tasks.length) return toast(LANG==='es'?'No hay tareas guardadas en la biblioteca':'No tasks saved in library','e');
  if(!proj()) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  if(lib.tasks.length===1){ libLoadTasks(lib.tasks[0].id); return; }
  openMo('<div class="mo-title">'+t('lib_load_from')+' — '+t('lib_tasks')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-height:55vh;overflow-y:auto">'
    +lib.tasks.map(function(e){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px">'
        +'<div><div style="font-weight:600;font-size:13px">'+esc(e.name)+'</div>'
        +'<div class="s-sm">'+e.tasks.length+' '+(LANG==='es'?'tarea(s)':'task(s)')+' · '+e.date+'</div></div>'
        +"<button class=\"btn btn-primary btn-sm\" onclick=\"closeMo();libLoadTasks('"+e.id+"')\">"+t('lib_load_btn')+'</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button></div>');
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
  _libLayoutWiz={step:0,guests:100,dfShape:'square',dfW:4.88,dfH:4.88,dfD:3.5,bar:true,barW:0,barH:0.4,platform:true,platW:3.66,platH:2.44,dj:true,djW:3.66,djH:1.22,stage:true,stageW:3.66,stageH:2.44,tables:{}};
  var sq=_dfSuggestSquare(100);
  _libLayoutWiz.dfW=sq.w; _libLayoutWiz.dfH=sq.h;
  _libLayoutWiz.barW=sq.w;
  var rd=_dfSuggestRound(100);
  _libLayoutWiz.dfD=rd.d;
  _libRenderLayoutWizard();
}
window.libOpenLayoutWizard = libOpenLayoutWizard;

function _libRenderLayoutWizard(){
  var w=_libLayoutWiz; var isES=LANG==='es';
  var s=w.step;
  var steps=[
    isES?'Invitados':'Guests',
    isES?'Pista de Baile':'Dance Floor',
    isES?'Elementos':'Elements',
    isES?'Mesas':'Tables',
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
        +'<div class="ig"><label>'+(isES?'Ancho (m)':'Width (m)')+'</label><input class="input" id="lwiz-df-w" type="number" step="0.1" value="'+w.dfW+'" oninput="_libLayoutWiz.dfW=parseFloat(this.value)||'+sqRec.w+';_libLayoutWiz.barW=parseFloat(this.value)||'+sqRec.w+'"></div>'
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

    // Full catalogue: 10 rectangular, 10 d-end, 10 oval, 10 round
    var catalogue=[
      // Rectangular (sharp corners)
      {key:'rect-2x1.2',   cat:'rect',  label:'2×1.2m',   wM:2.0, hM:1.2, chairs:6,  cols:4},
      {key:'rect-2.4x1.2', cat:'rect',  label:'2.4×1.2m', wM:2.4, hM:1.2, chairs:8,  cols:4},
      {key:'rect-2.6x1.2', cat:'rect',  label:'2.6×1.2m', wM:2.6, hM:1.2, chairs:8,  cols:4},
      {key:'rect-2.8x1.2', cat:'rect',  label:'2.8×1.2m', wM:2.8, hM:1.2, chairs:10, cols:4},
      {key:'rect-3x1.2',   cat:'rect',  label:'3×1.2m',   wM:3.0, hM:1.2, chairs:10, cols:3},
      {key:'rect-3.2x1.2', cat:'rect',  label:'3.2×1.2m', wM:3.2, hM:1.2, chairs:12, cols:3},
      {key:'rect-3.4x1.2', cat:'rect',  label:'3.4×1.2m', wM:3.4, hM:1.2, chairs:12, cols:3},
      {key:'rect-3.6x1.2', cat:'rect',  label:'3.6×1.2m', wM:3.6, hM:1.2, chairs:14, cols:3},
      {key:'rect-3.8x1.2', cat:'rect',  label:'3.8×1.2m', wM:3.8, hM:1.2, chairs:14, cols:3},
      {key:'rect-4x1.2',   cat:'rect',  label:'4×1.2m',   wM:4.0, hM:1.2, chairs:16, cols:3},
      // D-end (rounded ends, rectangular middle) — rendered as rect with rounded ends
      {key:'dend-2x1.2',   cat:'dend',  label:'2×1.2m',   wM:2.0, hM:1.2, chairs:6,  cols:4},
      {key:'dend-2.4x1.2', cat:'dend',  label:'2.4×1.2m', wM:2.4, hM:1.2, chairs:8,  cols:4},
      {key:'dend-2.6x1.2', cat:'dend',  label:'2.6×1.2m', wM:2.6, hM:1.2, chairs:8,  cols:4},
      {key:'dend-2.8x1.2', cat:'dend',  label:'2.8×1.2m', wM:2.8, hM:1.2, chairs:10, cols:4},
      {key:'dend-3x1.2',   cat:'dend',  label:'3×1.2m',   wM:3.0, hM:1.2, chairs:10, cols:3},
      {key:'dend-3.2x1.2', cat:'dend',  label:'3.2×1.2m', wM:3.2, hM:1.2, chairs:12, cols:3},
      {key:'dend-3.4x1.2', cat:'dend',  label:'3.4×1.2m', wM:3.4, hM:1.2, chairs:12, cols:3},
      {key:'dend-3.6x1.2', cat:'dend',  label:'3.6×1.2m', wM:3.6, hM:1.2, chairs:14, cols:3},
      {key:'dend-3.8x1.2', cat:'dend',  label:'3.8×1.2m', wM:3.8, hM:1.2, chairs:14, cols:3},
      {key:'dend-4x1.2',   cat:'dend',  label:'4×1.2m',   wM:4.0, hM:1.2, chairs:16, cols:3},
      // Oval
      {key:'oval-2x1.2',   cat:'oval',  label:'2×1.2m',   wM:2.0, hM:1.2, chairs:6,  cols:4},
      {key:'oval-2.4x1.2', cat:'oval',  label:'2.4×1.2m', wM:2.4, hM:1.2, chairs:8,  cols:4},
      {key:'oval-2.6x1.2', cat:'oval',  label:'2.6×1.2m', wM:2.6, hM:1.2, chairs:8,  cols:4},
      {key:'oval-2.8x1.2', cat:'oval',  label:'2.8×1.2m', wM:2.8, hM:1.2, chairs:10, cols:4},
      {key:'oval-3x1.2',   cat:'oval',  label:'3×1.2m',   wM:3.0, hM:1.2, chairs:10, cols:3},
      {key:'oval-3.2x1.2', cat:'oval',  label:'3.2×1.2m', wM:3.2, hM:1.2, chairs:12, cols:3},
      {key:'oval-3.4x1.2', cat:'oval',  label:'3.4×1.2m', wM:3.4, hM:1.2, chairs:12, cols:3},
      {key:'oval-3.6x1.2', cat:'oval',  label:'3.6×1.2m', wM:3.6, hM:1.2, chairs:14, cols:3},
      {key:'oval-3.8x1.2', cat:'oval',  label:'3.8×1.2m', wM:3.8, hM:1.2, chairs:14, cols:3},
      {key:'oval-4x1.2',   cat:'oval',  label:'4×1.2m',   wM:4.0, hM:1.2, chairs:16, cols:3},
      // Round
      {key:'round-0.8',    cat:'round', label:'0.8m',      wM:0.8, hM:0.8, chairs:4,  cols:6},
      {key:'round-1.0',    cat:'round', label:'1.0m',      wM:1.0, hM:1.0, chairs:6,  cols:5},
      {key:'round-1.2',    cat:'round', label:'1.2m',      wM:1.2, hM:1.2, chairs:8,  cols:5},
      {key:'round-1.4',    cat:'round', label:'1.4m',      wM:1.4, hM:1.4, chairs:10, cols:5},
      {key:'round-1.5',    cat:'round', label:'1.5m',      wM:1.5, hM:1.5, chairs:10, cols:5},
      {key:'round-1.6',    cat:'round', label:'1.6m',      wM:1.6, hM:1.6, chairs:12, cols:4},
      {key:'round-1.7',    cat:'round', label:'1.7m',      wM:1.7, hM:1.7, chairs:12, cols:4},
      {key:'round-1.8',    cat:'round', label:'1.8m',      wM:1.8, hM:1.8, chairs:14, cols:4},
      {key:'round-1.9',    cat:'round', label:'1.9m',      wM:1.9, hM:1.9, chairs:14, cols:4},
      {key:'round-2.0',    cat:'round', label:'2.0m',      wM:2.0, hM:2.0, chairs:16, cols:4},
    ];

    // SVG table drawing with correct proportions
    // Chair is ~0.45m wide × 0.45m deep; table height 1.2m for rect types
    // Scale: 1m = 50px for display
    function drawTableSVGv2(item, selected){
      var SCALE=44;
      var CS=0.38*SCALE; // chair diameter
      var CG=0.06*SCALE; // gap chair-to-table
      var tw=item.wM*SCALE; var th=item.hM*SCALE;
      var padX=CS+CG+2; var padY=CS+CG+2;
      var svgW=tw+padX*2; var svgH=th+padY*2+14;
      var tx=padX; var ty=padY;
      // Colors matching the reference image: warm tan table, muted blue-grey chairs
      var tableFill=selected?'#d4a843':'#c8962e';
      var chairFill='#b0c4d4';
      var chairs='';
      var n=item.chairs;

      if(item.cat==='round'){
        var r=tw/2; var cx=tx+r; var cy=ty+r;
        for(var ci=0;ci<n;ci++){
          var ang=2*Math.PI*ci/n-Math.PI/2;
          var dist=r+CG+CS/2;
          var ccx=cx+dist*Math.cos(ang); var ccy=cy+dist*Math.sin(ang);
          // Round chairs as circles
          chairs+='<circle cx="'+ccx.toFixed(1)+'" cy="'+ccy.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        chairs+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+tableFill+'"/>';
      } else {
        var topN=Math.ceil(n/2); var botN=Math.floor(n/2);
        // Rectangular chairs as circles on top and bottom
        for(var ci=0;ci<topN;ci++){
          var cx2=tx+(ci+0.5)*(tw/topN); var cy2=ty-CG-CS/2;
          chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        for(var ci=0;ci<botN;ci++){
          var cx2=tx+(ci+0.5)*(tw/botN); var cy2=ty+th+CG+CS/2;
          chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
        }
        // Table body — no stroke, no rounded corners for rect/dend, ellipse for oval
        if(item.cat==='oval'){
          chairs+='<ellipse cx="'+(tx+tw/2).toFixed(1)+'" cy="'+(ty+th/2).toFixed(1)+'" rx="'+(tw/2).toFixed(1)+'" ry="'+(th/2).toFixed(1)+'" fill="'+tableFill+'"/>';
        } else if(item.cat==='dend'){
          // D-end: pill shape rendered as single path — no visible seams
          var r2=(th/2).toFixed(1);
          chairs+='<path d="M'+(tx+parseFloat(r2)).toFixed(1)+' '+ty.toFixed(1)+' L'+(tx+tw-parseFloat(r2)).toFixed(1)+' '+ty.toFixed(1)+' A'+r2+' '+r2+' 0 0 1 '+(tx+tw-parseFloat(r2)).toFixed(1)+' '+(ty+th).toFixed(1)+' L'+(tx+parseFloat(r2)).toFixed(1)+' '+(ty+th).toFixed(1)+' A'+r2+' '+r2+' 0 0 1 '+(tx+parseFloat(r2)).toFixed(1)+' '+ty.toFixed(1)+' Z" fill="'+tableFill+'"/>';
        } else {
          // Sharp rectangle — no rx
          chairs+='<rect x="'+tx.toFixed(1)+'" y="'+ty.toFixed(1)+'" width="'+tw.toFixed(1)+'" height="'+th.toFixed(1)+'" fill="'+tableFill+'"/>';
        }
      }
      return '<svg viewBox="0 0 '+svgW.toFixed(0)+' '+svgH.toFixed(0)+'" width="'+svgW.toFixed(0)+'" height="'+svgH.toFixed(0)+'" style="display:block;overflow:visible">'
        +chairs
        +'<text x="'+(svgW/2).toFixed(1)+'" y="'+(svgH-1).toFixed(1)+'" text-anchor="middle" font-size="8.5" fill="#888" font-family="Jost,sans-serif">'+item.label+'</text>'
        +'</svg>';
    }

    var totalTables=0; var totalChairs=0;
    Object.keys(w.tables).forEach(function(k){
      var entry=w.tables[k]; if(!entry||!entry.n) return;
      var cat=catalogue.find(function(c){return c.key===k;});
      if(cat){totalTables+=entry.n; totalChairs+=entry.n*cat.chairs;}
    });

    function renderCatSection(catKey, titleEN, titleES){
      var items=catalogue.filter(function(c){return c.cat===catKey;});
      return '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">'+(isES?titleES:titleEN)+'</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
        +items.map(function(item){
          var sel=w.tables[item.key]&&w.tables[item.key].n>0;
          var cnt=(w.tables[item.key]||{}).n||0;
          return '<div onclick="event.preventDefault();var _sc=document.querySelector(\'.mo-body,.mo-inner,#mo-body,[id*=modal]\');var _sy=_sc?_sc.scrollTop:0;_libWizToggleTable(\''+item.key+'\');requestAnimationFrame(function(){var _sc2=document.querySelector(\'.mo-body,.mo-inner,#mo-body,[id*=modal]\');if(_sc2)_sc2.scrollTop=_sy;});" style="cursor:pointer;padding:8px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s;position:relative">'
            +drawTableSVGv2(item,sel)
            +'<div style="margin-top:4px;font-size:10px;color:var(--muted)">'+(isES?'Sillas:':'Chairs:')+' '+item.chairs+'</div>'
            +(sel
              ?'<div onclick="event.stopPropagation()" style="margin-top:4px"><input type="number" min="1" value="'+cnt+'" onchange="_libLayoutWiz.tables[\''+item.key+'\']||(_libLayoutWiz.tables[\''+item.key+'\']={chairs:'+item.chairs+',cols:'+item.cols+',chairType:\'default\',cp:\'none\'});_libLayoutWiz.tables[\''+item.key+'\'].n=parseInt(this.value)||1;_libRenderLayoutWizard()" oninput="_libLayoutWiz.tables[\''+item.key+'\']||(_libLayoutWiz.tables[\''+item.key+'\']={chairs:'+item.chairs+',cols:'+item.cols+',chairType:\'default\',cp:\'none\'});_libLayoutWiz.tables[\''+item.key+'\'].n=parseInt(this.value)||1" style="width:52px;text-align:center;padding:3px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:700"><div style="font-size:9px;color:var(--muted);margin-top:1px">'+(isES?'cantidad':'qty')+'</div></div>'
              :'<div style="font-size:10px;color:var(--light);margin-top:4px">'+(isES?'clic':'click')+'</div>')
            +'</div>';
        }).join('')
        +'</div>';
    }

    body='<div style="font-size:15px;font-weight:700;margin-bottom:4px">'+(isES?'Mesas':'Tables')+'</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:10px">'+(isES?'Haz clic en una mesa para seleccionarla.':'Click a table to select it, then enter quantity.')+'</div>'
      +renderCatSection('rect',  'Rectangular Tables',  'Mesas Rectangulares')
      +renderCatSection('dend',  'D-End Tables',        'Mesas D-End')
      +renderCatSection('oval',  'Oval Tables',         'Mesas Ovaladas')
      +renderCatSection('round', 'Round Tables',        'Mesas Redondas')
      +'<div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;display:flex;gap:24px;font-size:13px;margin-top:12px;flex-wrap:wrap">'
      +'<span>⬛ <strong>'+totalTables+'</strong> '+(isES?'mesas':'tables')+'</span>'
      +'<span>🪑 <strong>'+totalChairs+'</strong> '+(isES?'sillas':'chairs')+'</span>'
      +'</div>';
  }

  var stickyFooter='';
  if(s===3){
    var tt2=0; var tc2=0;
    Object.keys(w.tables||{}).forEach(function(k){var e=w.tables[k];if(e&&e.n){tt2+=e.n;var allCats=[{key:'rect-2x1.2',chairs:6},{key:'rect-2.4x1.2',chairs:8},{key:'rect-2.6x1.2',chairs:8},{key:'rect-2.8x1.2',chairs:10},{key:'rect-3x1.2',chairs:10},{key:'rect-3.2x1.2',chairs:12},{key:'rect-3.4x1.2',chairs:12},{key:'rect-3.6x1.2',chairs:14},{key:'rect-3.8x1.2',chairs:14},{key:'rect-4x1.2',chairs:16},{key:'dend-2x1.2',chairs:6},{key:'dend-2.4x1.2',chairs:8},{key:'dend-2.6x1.2',chairs:8},{key:'dend-2.8x1.2',chairs:10},{key:'dend-3x1.2',chairs:10},{key:'dend-3.2x1.2',chairs:12},{key:'dend-3.4x1.2',chairs:12},{key:'dend-3.6x1.2',chairs:14},{key:'dend-3.8x1.2',chairs:14},{key:'dend-4x1.2',chairs:16},{key:'oval-2x1.2',chairs:6},{key:'oval-2.4x1.2',chairs:8},{key:'oval-2.6x1.2',chairs:8},{key:'oval-2.8x1.2',chairs:10},{key:'oval-3x1.2',chairs:10},{key:'oval-3.2x1.2',chairs:12},{key:'oval-3.4x1.2',chairs:12},{key:'oval-3.6x1.2',chairs:14},{key:'oval-3.8x1.2',chairs:14},{key:'oval-4x1.2',chairs:16},{key:'round-0.8',chairs:4},{key:'round-1.0',chairs:6},{key:'round-1.2',chairs:8},{key:'round-1.4',chairs:10},{key:'round-1.5',chairs:10},{key:'round-1.6',chairs:12},{key:'round-1.7',chairs:12},{key:'round-1.8',chairs:14},{key:'round-1.9',chairs:14},{key:'round-2.0',chairs:16}];var cat=allCats.find(function(c){return c.key===k;});if(cat)tc2+=e.n*cat.chairs;}});
    stickyFooter='<div style="border-top:1px solid var(--border);padding:10px 0 0;margin-top:8px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      +'<span style="font-size:13px">⬛ <strong>'+tt2+'</strong> '+(isES?'mesas':'tables')+'</span>'
      +'<span style="font-size:13px">🪑 <strong>'+tc2+'</strong> '+(isES?'sillas':'chairs')+'</span>'
      +'</div>';
  }
  openMo(prog
    +'<div style="overflow-y:auto;max-height:55vh">'+body+'</div>'
    +stickyFooter
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +(s>0?'<button class="btn btn-ghost" onclick="_libLayoutWiz.step--;_libRenderLayoutWizard()">← '+(isES?'Atrás':'Back')+'</button>':'')
    +(s<3?'<button class="btn btn-primary" onclick="_libLayoutWizNext()">'+(isES?'Siguiente':'Next')+' →</button>'
          :'<button class="btn btn-primary" onclick="_libLayoutWizGenerate()">⚡ '+(isES?'Generar Plano':'Generate Layout')+'</button>')
    +'</div>');
}
window._libRenderLayoutWizard = _libRenderLayoutWizard;

function _libWizToggleTable(key){
  // Save modal scroll position before re-rendering
  var _moScrollEl=document.getElementById('mo-body')||document.querySelector('.mo-scroll')||document.querySelector('[style*="overflow-y:auto"]');
  var _moScrollY=_moScrollEl?_moScrollEl.scrollTop:0;
  if(!_libLayoutWiz.tables) _libLayoutWiz.tables={};
  var catalogue=[
    {key:'rect-2x1.2',chairs:6,cols:4},{key:'rect-2.4x1.2',chairs:8,cols:4},{key:'rect-2.6x1.2',chairs:8,cols:4},{key:'rect-2.8x1.2',chairs:10,cols:4},{key:'rect-3x1.2',chairs:10,cols:3},{key:'rect-3.2x1.2',chairs:12,cols:3},{key:'rect-3.4x1.2',chairs:12,cols:3},{key:'rect-3.6x1.2',chairs:14,cols:3},{key:'rect-3.8x1.2',chairs:14,cols:3},{key:'rect-4x1.2',chairs:16,cols:3},
    {key:'dend-2x1.2',chairs:6,cols:4},{key:'dend-2.4x1.2',chairs:8,cols:4},{key:'dend-2.6x1.2',chairs:8,cols:4},{key:'dend-2.8x1.2',chairs:10,cols:4},{key:'dend-3x1.2',chairs:10,cols:3},{key:'dend-3.2x1.2',chairs:12,cols:3},{key:'dend-3.4x1.2',chairs:12,cols:3},{key:'dend-3.6x1.2',chairs:14,cols:3},{key:'dend-3.8x1.2',chairs:14,cols:3},{key:'dend-4x1.2',chairs:16,cols:3},
    {key:'oval-2x1.2',chairs:6,cols:4},{key:'oval-2.4x1.2',chairs:8,cols:4},{key:'oval-2.6x1.2',chairs:8,cols:4},{key:'oval-2.8x1.2',chairs:10,cols:4},{key:'oval-3x1.2',chairs:10,cols:3},{key:'oval-3.2x1.2',chairs:12,cols:3},{key:'oval-3.4x1.2',chairs:12,cols:3},{key:'oval-3.6x1.2',chairs:14,cols:3},{key:'oval-3.8x1.2',chairs:14,cols:3},{key:'oval-4x1.2',chairs:16,cols:3},
    {key:'round-0.8',chairs:4,cols:6},{key:'round-1.0',chairs:6,cols:5},{key:'round-1.2',chairs:8,cols:5},{key:'round-1.4',chairs:10,cols:5},{key:'round-1.5',chairs:10,cols:5},{key:'round-1.6',chairs:12,cols:4},{key:'round-1.7',chairs:12,cols:4},{key:'round-1.8',chairs:14,cols:4},{key:'round-1.9',chairs:14,cols:4},{key:'round-2.0',chairs:16,cols:4},
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
    var el=document.getElementById('mo-body')||document.querySelector('.mo-scroll')||document.querySelector('[style*="overflow-y:auto"]');
    if(el) el.scrollTop=_moScrollY;
  });
}
window._libWizToggleTable = _libWizToggleTable;

function _libLayoutWizNext(){
  var w=_libLayoutWiz;
  if(w.step===0){
    w.guests=parseInt(document.getElementById('lwiz-guests')?.value)||100;
    var sq=_dfSuggestSquare(w.guests); var rd=_dfSuggestRound(w.guests);
    w.dfW=sq.w; w.dfH=sq.h; w.dfD=rd.d; w.barW=sq.w;
  }
  w.step++;
  _libRenderLayoutWizard();
}
window._libLayoutWizNext = _libLayoutWizNext;

function _libLayoutWizGenerate(){
  var w=_libLayoutWiz;
  var isES=LANG==='es';
  var ppm=typeof getPPM!=='undefined'?getPPM():40;
  var SHAPES=typeof getLSHAPES!=='undefined'?getLSHAPES():(typeof LSHAPES!=='undefined'?LSHAPES:{});
  var items=[];
  var idGen=function(){return 'li'+Date.now()+Math.random().toString(36).slice(2,6);};
  var spacing=Math.round(1.2*ppm);
  var originX=spacing*2, originY=spacing*2;
  var tableCount=0;
  var maxTableW=0;
  var curY=originY;

  // Table catalogue key -> shape/size info
  var catalogueMap={
    'rect-2x1.2':{shape:'rect-table',wM:2.0,hM:1.2,round:false},'rect-2.4x1.2':{shape:'rect-table',wM:2.4,hM:1.2,round:false},'rect-2.6x1.2':{shape:'rect-table',wM:2.6,hM:1.2,round:false},'rect-2.8x1.2':{shape:'rect-table',wM:2.8,hM:1.2,round:false},'rect-3x1.2':{shape:'rect-table',wM:3.0,hM:1.2,round:false},'rect-3.2x1.2':{shape:'rect-table',wM:3.2,hM:1.2,round:false},'rect-3.4x1.2':{shape:'rect-table',wM:3.4,hM:1.2,round:false},'rect-3.6x1.2':{shape:'rect-table',wM:3.6,hM:1.2,round:false},'rect-3.8x1.2':{shape:'rect-table',wM:3.8,hM:1.2,round:false},'rect-4x1.2':{shape:'rect-table',wM:4.0,hM:1.2,round:false},
    'dend-2x1.2':{shape:'rect-table',wM:2.0,hM:1.2,round:false},'dend-2.4x1.2':{shape:'rect-table',wM:2.4,hM:1.2,round:false},'dend-2.6x1.2':{shape:'rect-table',wM:2.6,hM:1.2,round:false},'dend-2.8x1.2':{shape:'rect-table',wM:2.8,hM:1.2,round:false},'dend-3x1.2':{shape:'rect-table',wM:3.0,hM:1.2,round:false},'dend-3.2x1.2':{shape:'rect-table',wM:3.2,hM:1.2,round:false},'dend-3.4x1.2':{shape:'rect-table',wM:3.4,hM:1.2,round:false},'dend-3.6x1.2':{shape:'rect-table',wM:3.6,hM:1.2,round:false},'dend-3.8x1.2':{shape:'rect-table',wM:3.8,hM:1.2,round:false},'dend-4x1.2':{shape:'rect-table',wM:4.0,hM:1.2,round:false},
    'oval-2x1.2':{shape:'rect-table',wM:2.0,hM:1.2,round:false},'oval-2.4x1.2':{shape:'rect-table',wM:2.4,hM:1.2,round:false},'oval-2.6x1.2':{shape:'rect-table',wM:2.6,hM:1.2,round:false},'oval-2.8x1.2':{shape:'rect-table',wM:2.8,hM:1.2,round:false},'oval-3x1.2':{shape:'rect-table',wM:3.0,hM:1.2,round:false},'oval-3.2x1.2':{shape:'rect-table',wM:3.2,hM:1.2,round:false},'oval-3.4x1.2':{shape:'rect-table',wM:3.4,hM:1.2,round:false},'oval-3.6x1.2':{shape:'rect-table',wM:3.6,hM:1.2,round:false},'oval-3.8x1.2':{shape:'rect-table',wM:3.8,hM:1.2,round:false},'oval-4x1.2':{shape:'rect-table',wM:4.0,hM:1.2,round:false},
    'round-0.8':{shape:'round-table',wM:0.8,hM:0.8,round:true},'round-1.0':{shape:'round-table',wM:1.0,hM:1.0,round:true},'round-1.2':{shape:'round-table',wM:1.2,hM:1.2,round:true},'round-1.4':{shape:'round-table',wM:1.4,hM:1.4,round:true},'round-1.5':{shape:'round-table',wM:1.5,hM:1.5,round:true},'round-1.6':{shape:'round-table',wM:1.6,hM:1.6,round:true},'round-1.7':{shape:'round-table',wM:1.7,hM:1.7,round:true},'round-1.8':{shape:'round-table',wM:1.8,hM:1.8,round:true},'round-1.9':{shape:'round-table',wM:1.9,hM:1.9,round:true},'round-2.0':{shape:'round-table',wM:2.0,hM:2.0,round:true},
  };
  var tables=Array.isArray(w.tables)?{}:w.tables;
  Object.keys(tables).forEach(function(key){
    var tg=tables[key]; if(!tg||!tg.n) return;
    var cm=catalogueMap[key]||{shape:'round-table',wM:1.5,hM:1.5,round:true};
    var tw=Math.round(cm.wM*ppm); var th=Math.round(cm.hM*ppm);
    var defBg=cm.round?'#f0ece0':'#f0ece0'; var defBd='#c9a84c';
    var defShape=SHAPES&&SHAPES[cm.shape]?SHAPES[cm.shape]:{w:tw,h:th,bg:defBg,bdClr:defBd};
    var pad=tg.chairs?Math.round(0.5*ppm)+Math.round(0.05*ppm):0;
    var cellW=tw+pad*2+spacing; var cellH=th+pad*2+spacing;
    var cols=tg.cols||5; var row=0; var col=0;
    for(var i=0;i<tg.n;i++){
      var tx=originX+col*cellW+pad; var ty=curY+row*cellH+pad;
      items.push({id:idGen(),shape:cm.shape,x:tx,y:ty,w:tw,h:th,bg:defShape.bg||defBg,bdClr:defShape.bdClr||defBd,radius:cm.round?'50%':'0px',label:String(tableCount+1),chairs:tg.chairs,chairType:tg.chairType||'default',centerpiece:tg.cp||'none',cost:0,rotation:0});
      tableCount++;col++;
      if(col>=cols){col=0;row++;}
    }
    var gridH=(row+(col>0?1:0))*cellH;
    var gridW=Math.min(tg.n,cols)*cellW;
    if(gridW>maxTableW) maxTableW=gridW;
    curY+=gridH+spacing;
  });

  var elX=originX+maxTableW+spacing*2; var elY=originY;

  // Dance floor
  var dfW,dfH;
  if(w.dfShape==='round'){
    dfW=Math.round((w.dfD||4)*ppm); dfH=dfW;
    items.push({id:idGen(),shape:'dance-floor',x:elX,y:elY,w:dfW,h:dfH,bg:'#e8e0f0',bdClr:'#7c3aed',radius:'50%',label:isES?'Pista de Baile':'Dance Floor',chairs:0,cost:0,rotation:0});
  } else {
    dfW=Math.round((w.dfW||7)*ppm); dfH=Math.round((w.dfH||7)*ppm);
    var dfShape=typeof LSHAPES!=='undefined'&&LSHAPES['dance-floor']?LSHAPES['dance-floor']:{bg:'#e8e0f0',bdClr:'#7c3aed'};
    items.push({id:idGen(),shape:'dance-floor',x:elX,y:elY,w:dfW,h:dfH,bg:dfShape.bg,bdClr:dfShape.bdClr,radius:'0px',label:isES?'Pista de Baile':'Dance Floor',chairs:0,cost:0,rotation:0});
  }
  elY+=dfH+spacing;

  if(w.bar){
    var barW=Math.round((w.barW||dfW/ppm)*ppm); var barH=Math.round((w.barH||0.4)*ppm);
    var barShape=typeof LSHAPES!=='undefined'&&LSHAPES['bar']?LSHAPES['bar']:{bg:'#fef3c7',bdClr:'#f59e0b'};
    items.push({id:idGen(),shape:'bar',x:elX,y:elY,w:barW,h:barH,bg:barShape.bg,bdClr:barShape.bdClr,radius:'0px',label:isES?'Barra de Shots':'Shot Bar',chairs:0,cost:0,rotation:0});
    elY+=barH+spacing;
  }
  if(w.platform){
    var platW=Math.round((w.platW||3.66)*ppm); var platH=Math.round((w.platH||2.44)*ppm);
    var stShape=typeof LSHAPES!=='undefined'&&LSHAPES['stage']?LSHAPES['stage']:{bg:'#dbeafe',bdClr:'#3b82f6'};
    items.push({id:idGen(),shape:'stage',x:elX,y:elY,w:platW,h:platH,bg:stShape.bg,bdClr:stShape.bdClr,radius:'0px',label:isES?'Plataforma de Cena':'Dinner Platform',chairs:0,cost:0,rotation:0});
    elY+=platH+spacing;
  }
  if(w.dj){
    var djW=Math.round((w.djW||3.66)*ppm); var djH=Math.round((w.djH||1.22)*ppm);
    var djShape=typeof LSHAPES!=='undefined'&&LSHAPES['dj']?LSHAPES['dj']:{bg:'#f3e8ff',bdClr:'#9333ea'};
    items.push({id:idGen(),shape:'dj',x:elX,y:elY,w:djW,h:djH,bg:djShape.bg,bdClr:djShape.bdClr,radius:'0px',label:'DJ Booth',chairs:0,cost:0,rotation:0});
    elY+=djH+spacing;
  }
  if(w.stage){
    var sgW=Math.round((w.stageW||3.66)*ppm); var sgH=Math.round((w.stageH||2.44)*ppm);
    var sgShape=typeof LSHAPES!=='undefined'&&LSHAPES['stage']?LSHAPES['stage']:{bg:'#dbeafe',bdClr:'#3b82f6'};
    items.push({id:idGen(),shape:'stage',x:elX,y:elY,w:sgW,h:sgH,bg:sgShape.bg,bdClr:sgShape.bdClr,radius:'0px',label:isES?'Escenario':'Stage',chairs:0,cost:0,rotation:0});
  }

  // Save to library
  var lib=getLib();
  var name=isES?'Plano '+new Date().toLocaleDateString():'Layout '+new Date().toLocaleDateString();
  var guests=w.guests||'';
  var tables=tableCount;
  var entryId='ll'+Date.now();
  lib.layouts.push({
    id:entryId, name:name, notes:'', location:'', guests:String(guests),
    date:new Date().toLocaleDateString(),
    items:JSON.parse(JSON.stringify(items)),
    floorplan:null
  });
  saveLib(lib);
  closeMo();
  toast(isES?'Plano creado. Ábrelo con el botón Editar.':'Layout created. Open it with the Edit button.','s');
  // Redirect to library layouts tab and open the editor
  _libTab='layouts';
  renderLibrary();
  setTimeout(function(){ libOpenLayoutEditor(entryId); },200);
}
window._libLayoutWizGenerate = _libLayoutWizGenerate;

function libOpenLayoutEditor(entryId){
  _libEditingLayoutId=entryId;
  var lib=getLib();
  var entry=lib.layouts.find(function(e){return e.id===entryId;});
  if(!entry){ toast(LANG==='es'?'Plano no encontrado':'Layout not found','e'); return; }
  var isES=LANG==='es';

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
  lp.layoutItems=JSON.parse(JSON.stringify(entry.items));
  lp.floorplan=entry.floorplan?JSON.parse(JSON.stringify(entry.floorplan)):{img:null};
  saveProj(lp);

  // Switch CID to pseudo-project
  var _prevCID=typeof CID!=='undefined'?CID:null;
  CID='__lib_layout__';

  // Show full-page layout editor (re-use pg-library page area, hide its normal content)
  var pgLib=document.getElementById('pg-library');
  if(!pgLib) return;

  // Hide normal library UI, inject full-height layout shell
  pgLib.innerHTML=
    '<div style="display:flex;flex-direction:column;height:calc(100vh - 62px)">'
    +'<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--card);border-bottom:1px solid var(--border);flex-shrink:0">'
    +'<button class="btn btn-ghost btn-sm" onclick="libCloseLayoutEditor(\''+entryId+'\',\''+(_prevCID||'')+'\')">← '+(isES?'Volver a Planos':'Back to Layouts')+'</button>'
    +'<span style="font-weight:700;font-size:15px">'+esc(entry.name)+'</span>'
    +'<span style="font-size:12px;color:var(--muted)">'+(isES?'Los cambios se guardan automáticamente':'Changes are saved automatically')+'</span>'
    +'</div>'
    +'<div id="tab-layout" style="flex:1;overflow:hidden"></div>'
    +'</div>';

  // Auto-save: poll for changes every 2 seconds instead of hooking saveProj
  if(window._libAutoSaveInterval) clearInterval(window._libAutoSaveInterval);
  window._libAutoSaveInterval=setInterval(function(){
    if(!_libEditingLayoutId) return;
    var lib2=getLib();
    var entry2=lib2.layouts.find(function(e){return e.id===entryId;});
    if(entry2){
      var lp2=typeof uproj==='function'?uproj()['__lib_layout__']:null;
      if(lp2&&lp2.layoutItems) entry2.items=JSON.parse(JSON.stringify(lp2.layoutItems));
      saveLib(lib2);
    }
  },2000);

  if(typeof renderLayout==='function') renderLayout();
}
window.libOpenLayoutEditor = libOpenLayoutEditor;

function libCloseLayoutEditor(entryId, prevCID){
  if(window._libAutoSaveInterval){ clearInterval(window._libAutoSaveInterval); window._libAutoSaveInterval=null; }
  _libEditingLayoutId=null;
  // Restore CID
  CID = (prevCID && prevCID!=='null' && prevCID!=='undefined') ? prevCID : null;
  _libTab='layouts';
  // Rebuild the library page HTML from scratch since we replaced pg-library's innerHTML
  var pgLib=document.getElementById('pg-library');
  if(pgLib){
    pgLib.innerHTML=
      '<div style="max-width:1200px;margin:0 auto;padding:32px 24px;width:100%">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
      +'<div><h1 id="lib-page-title" style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700">Layouts</h1>'
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
window.libLoadSingleVendor = libLoadSingleVendor;
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
window.libCloseLayoutEditor = libCloseLayoutEditor;
window.updateLibraryLabels = updateLibraryLabels;
window.renderLibrary = renderLibrary;
// placeholder to prevent old duplicate

