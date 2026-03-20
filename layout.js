// -- IndexedDB helpers for floorplan image --
function _fpDB(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open('EventOS_FP',1);
    req.onupgradeneeded=function(e){e.target.result.createObjectStore('images');};
    req.onsuccess=function(e){resolve(e.target.result);};
    req.onerror=function(e){reject(e);};
  });
}
function _fpSave(key,dataUrl){
  return _fpDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction('images','readwrite');
      tx.objectStore('images').put(dataUrl,key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e);};
    });
  });
}
function _fpLoad(key){
  return _fpDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction('images','readonly');
      var req=tx.objectStore('images').get(key);
      req.onsuccess=function(){resolve(req.result||null);};
      req.onerror=function(e){reject(e);};
    });
  });
}
function _fpDelete(key){
  return _fpDB().then(function(db){
    return new Promise(function(resolve){
      var tx=db.transaction('images','readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(){resolve();};
    });
  });
}


var _layoutMigrationPending = {};

function isLibraryLayoutEditing(){
  return typeof _libEditingLayoutId!=='undefined' && !!_libEditingLayoutId;
}

function isEventLayoutViewOnly(p){
  return !!(p && p.id && p.id!=='__library__' && p.id!=='__lib_layout__' && !isLibraryLayoutEditing());
}

function _layoutDimLabel(item, ppm){
  var w = ((item.w||0) / ppm).toFixed(2);
  var h = ((item.h||0) / ppm).toFixed(2);
  var isRound = item.shape==='round-table'||item.radius==='50%'||(typeof LSHAPES_M!=='undefined'&&LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  if(isRound && Math.abs((item.w||0) - (item.h||0)) < 2) return 'D ' + w + 'm';
  return w + 'm x ' + h + 'm';
}

function getLayoutSummary(items, meta, floorplan){
  items = items || [];
  meta = meta || {};
  var ppm = (floorplan && floorplan.pxPerMeter) || meta.pxPerMeter || (meta.floorplan && meta.floorplan.pxPerMeter) || getPPM();
  var groups = {};
  items.forEach(function(item){
    var shapeDef = (typeof LSHAPES_M!=='undefined' && LSHAPES_M) ? LSHAPES_M[item.shape] : null;
    var typeLabel = shapeDef && shapeDef.label ? shapeDef.label : String(item.shape || 'Element').replace(/-/g,' ');
    var dimensions = _layoutDimLabel(item, ppm);
    var key = [typeLabel, dimensions].join('||');
    if(!groups[key]) groups[key] = { type:typeLabel, dimensions:dimensions, qty:0, labels:[] };
    groups[key].qty++;
    if(item.label && groups[key].labels.indexOf(item.label) < 0) groups[key].labels.push(item.label);
  });
  return {
    tables: items.filter(function(i){ return i.shape && i.shape.includes('table'); }).length,
    guests: meta.guests || '',
    location: meta.location || '',
    notes: meta.notes || '',
    elements: Object.values(groups).sort(function(a,b){
      if(a.type===b.type) return a.dimensions.localeCompare(b.dimensions);
      return a.type.localeCompare(b.type);
    })
  };
}

function _svgDataUri(svg){
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function buildLayoutSnapshotGraphic(opts){
  opts = opts || {};
  var items = opts.items || [];
  var floorplan = opts.floorplan || null;
  if(typeof LSHAPES_M==='undefined' || !LSHAPES_M) LSHAPES_M = getLSHAPES();
  var PPM = (floorplan && floorplan.pxPerMeter) || getPPM();
  var CHAIR_SZ = Math.max(8, Math.round(CHAIR_SIZE_M * PPM));
  var CHAIR_GAP = Math.max(2, Math.round(0.05 * PPM));
  var PAD = CHAIR_SZ + CHAIR_GAP + 4;
  var minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;

  items.forEach(function(item){
    var hasCh = item.chairs > 0;
    var px = hasCh ? PAD : 0;
    minX = Math.min(minX, item.x - px);
    minY = Math.min(minY, item.y - px);
    maxX = Math.max(maxX, item.x + item.w + px);
    maxY = Math.max(maxY, item.y + item.h + px);
  });

  if(floorplan && floorplan.img && floorplan.img!=='__idb__' && floorplan.img!=='__stored__'){
    var fpW = Math.round((floorplan.w||0) * (floorplan.scale||1));
    var fpH = Math.round((floorplan.h||0) * (floorplan.scale||1));
    minX = Math.min(minX, floorplan.x||0);
    minY = Math.min(minY, floorplan.y||0);
    maxX = Math.max(maxX, (floorplan.x||0) + fpW);
    maxY = Math.max(maxY, (floorplan.y||0) + fpH);
  }

  if(!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)){
    minX = 0; minY = 0; maxX = 900; maxY = 650;
  }

  var MARGIN = 80;
  var rawW = Math.max(320, maxX - minX + MARGIN*2);
  var rawH = Math.max(220, maxY - minY + MARGIN*2);
  var MAX_W = opts.maxWidth || 1400;
  var scale = rawW > MAX_W ? MAX_W / rawW : 1;
  var svgW = Math.round(rawW * scale);
  var svgH = Math.round(rawH * scale);
  var ox = (-minX + MARGIN) * scale;
  var oy = (-minY + MARGIN) * scale;

  function sc(v){ return Math.round(v * scale); }
  function sx(v){ return Math.round(v * scale + ox); }
  function sy(v){ return Math.round(v * scale + oy); }

  var svgItems = '';
  if(floorplan && floorplan.img && floorplan.img!=='__idb__' && floorplan.img!=='__stored__'){
    var fpScale = floorplan.scale || 1;
    var fpX = sx(floorplan.x || 0);
    var fpY = sy(floorplan.y || 0);
    var fpW2 = sc((floorplan.w || 0) * fpScale);
    var fpH2 = sc((floorplan.h || 0) * fpScale);
    var fpRot = floorplan.rotation || 0;
    svgItems += '<g transform="translate('+fpX+','+fpY+') rotate('+fpRot+','+(fpW2/2)+','+(fpH2/2)+')" opacity="'+(floorplan.opacity==null?0.35:floorplan.opacity)+'"><image href="'+floorplan.img+'" x="0" y="0" width="'+fpW2+'" height="'+fpH2+'" preserveAspectRatio="none"/></g>\n';
  }

  items.forEach(function(item){
    var isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
    var rot = item.rotation || 0;
    var iw = sc(item.w);
    var ih = sc(item.h);
    var ix = sx(item.x);
    var iy = sy(item.y);
    var inner = '';

    if(item.chairs){
      var n = item.chairs;
      var cs = Math.max(4, Math.round(CHAIR_SZ * scale));
      var gap = Math.max(1, Math.round(CHAIR_GAP * scale));
      var cType = item.chairType || 'default';
      var ct = CHAIR_TYPES[cType] || CHAIR_TYPES['default'];
      var cfill = ct ? ct.fill : '#e8e4d8';
      var cstroke = ct ? (ct.stroke || 'none') : 'none';
      var positions = [];
      var w = sc(item.w), h = sc(item.h);

      if(isRound){
        for(var i=0;i<n;i++){
          var angle=(i/n)*2*Math.PI - Math.PI/2;
          positions.push({
            x: w/2 + (w/2 + cs/2 + gap)*Math.cos(angle),
            y: h/2 + (h/2 + cs/2 + gap)*Math.sin(angle)
          });
        }
      } else if(item.shape==='rect-table'){
        var longSide=4, shortSide=Math.max(1,Math.round((n-longSide*2)/2));
        var top=longSide, bot=longSide, left=shortSide, right=shortSide;
        for(var j=0;j<top;j++) positions.push({x:(j+1)*w/(top+1), y:-(cs/2+gap)});
        for(var k=0;k<bot;k++) positions.push({x:(k+1)*w/(bot+1), y:h+cs/2+gap});
        for(var l=0;l<left;l++) positions.push({x:-(cs/2+gap), y:(l+1)*h/(left+1)});
        for(var m=0;m<right;m++) positions.push({x:w+cs/2+gap, y:(m+1)*h/(right+1)});
      } else {
        var chairSlot = cs + 5;
        var longCap = Math.max(1,Math.floor(w/chairSlot));
        var top2=0,bot2=0,left2=0,right2=0;
        if(n<=2*longCap){ top2=Math.ceil(n/2); bot2=Math.floor(n/2); }
        else {
          top2=longCap; bot2=longCap;
          var rem=n-top2-bot2;
          left2=Math.ceil(rem/2); right2=Math.floor(rem/2);
        }
        for(var n1=0;n1<top2;n1++) positions.push({x:(n1+1)*w/(top2+1), y:-(cs/2+gap)});
        for(var n2=0;n2<bot2;n2++) positions.push({x:(n2+1)*w/(bot2+1), y:h+cs/2+gap});
        for(var n3=0;n3<left2;n3++) positions.push({x:-(cs/2+gap), y:(n3+1)*h/(left2+1)});
        for(var n4=0;n4<right2;n4++) positions.push({x:w+cs/2+gap, y:(n4+1)*h/(right2+1)});
      }

      var chairIsRound = !cType.startsWith('plegable') && !cType.startsWith('basket');
      positions.forEach(function(pos){
        if(chairIsRound){
          inner += '<ellipse cx="'+Math.round(pos.x)+'" cy="'+Math.round(pos.y)+'" rx="'+Math.round(cs/2)+'" ry="'+Math.round(cs/2)+'" fill="'+cfill+'" stroke="'+cstroke+'" stroke-width="0.8"/>';
        } else {
          inner += '<rect x="'+Math.round(pos.x - cs/2)+'" y="'+Math.round(pos.y - cs/2)+'" width="'+cs+'" height="'+cs+'" rx="2" fill="'+cfill+'" stroke="'+cstroke+'" stroke-width="0.8"/>';
        }
      });
    }

    var rx;
    if(isRound){ rx = Math.min(iw,ih)/2; }
    else {
      var shapeDef = LSHAPES_M[item.shape];
      if(shapeDef && shapeDef.radius && shapeDef.radius==='0px'){ rx=0; }
      else if(item.radius && item.radius==='0px'){ rx=0; }
      else if(item.radius && item.radius!=='50%'){
        var rNum = parseFloat(item.radius);
        rx = isNaN(rNum) ? 3 : rNum;
      } else { rx = 3; }
    }

    inner += '<rect x="0" y="0" width="'+iw+'" height="'+ih+'" rx="'+rx+'" fill="'+(item.bg||'#ffffff')+'" stroke="'+(item.bdClr||'#ccc')+'" stroke-width="1"/>';
    if(item.centerpiece && item.centerpiece!=='none'){
      var ct2 = CENTERPIECE_TYPES[item.centerpiece];
      if(ct2 && ct2.color){
        var cpSz = Math.round(Math.min(iw,ih)*0.55);
        inner += '<ellipse cx="'+(iw/2)+'" cy="'+(ih/2)+'" rx="'+(cpSz/2)+'" ry="'+(cpSz/2)+'" fill="'+ct2.color+'" opacity="0.55"/>';
      }
    }

    var wM = item.w / PPM;
    var fs = Math.max(6, Math.min(13, Math.round(wM * 8 * scale)));
    inner += '<text x="'+(iw/2)+'" y="'+(ih/2+fs*0.35)+'" text-anchor="middle" font-family="Jost,Segoe UI,Arial,sans-serif" font-size="'+fs+'" fill="'+(item.bdClr||'#444')+'" font-weight="400">'+esc(item.label||'')+'</text>';
    svgItems += '<g transform="translate('+ix+','+iy+') rotate('+rot+','+(iw/2)+','+(ih/2)+')">'+inner+'</g>\n';
  });

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'"><rect width="'+svgW+'" height="'+svgH+'" fill="#ffffff"/>'+svgItems+'</svg>';
  return { svg: svg, svgW: svgW, svgH: svgH, image: _svgDataUri(svg) };
}

function createLayoutExportPayload(entry, floorplanOverride){
  if(!entry) return null;
  var floorplan = floorplanOverride===undefined ? entry.floorplan : floorplanOverride;
  var graphic = buildLayoutSnapshotGraphic({ items: entry.items || [], floorplan: floorplan, maxWidth: 1400 });
  var exportedAt = new Date().toISOString();
  return {
    layoutId: entry.id,
    layoutName: entry.name || (LANG==='es'?'Plano sin nombre':'Untitled layout'),
    image: graphic.image,
    exportedAt: exportedAt,
    libraryVersion: entry.updatedAt || entry.date || exportedAt,
    summary: getLayoutSummary(entry.items || [], entry, floorplan)
  };
}

function openLayoutImagePreview(src, title){
  if(!src) return;
  openMo('<div class="mo-title">'+esc(title || (LANG==='es'?'Vista previa del plano':'Layout preview'))+'</div><div style="max-height:72vh;overflow:auto;border:1px solid var(--border);border-radius:12px;background:#fff;padding:12px"><img src="'+src+'" alt="'+esc(title || 'Layout')+'" style="display:block;width:100%;height:auto;border-radius:8px"></div><div class="mo-foot"><button class="btn btn-primary" onclick="closeMo()">'+t('close')+'</button></div>');
}

function openLayoutLibraryPicker(){
  if(typeof openLibrary==='function'){
    _libTab='layouts';
    openLibrary();
  }
}

function openEventLayoutInLibrary(){
  var p = proj();
  var exp = p && p.layoutExport;
  if(!exp || !exp.layoutId) return;
  _libTab='layouts';
  if(typeof openLibrary==='function') openLibrary();
  setTimeout(function(){
    if(typeof libOpenLayoutEditor==='function') libOpenLayoutEditor(exp.layoutId);
  }, 120);
}

function refreshEventLayoutFromLibrary(){
  var p = proj();
  var exp = p && p.layoutExport;
  if(!exp || !exp.layoutId || typeof libApplyLayoutExportToEvent!=='function') return;
  libApplyLayoutExportToEvent(exp.layoutId, p.id, {toastSuccess:true});
}

function renderEventLayoutViewer(p){
  var el=document.getElementById('tab-layout');
  if(!el) return;
  var exp = p.layoutExport || null;
  var missingSource = false;
  if(exp && exp.layoutId && typeof getLib==='function'){
    missingSource = !getLib().layouts.some(function(entry){ return entry.id===exp.layoutId; });
  }
  var summary = exp && exp.summary ? exp.summary : null;
  var exportedAt = exp && exp.exportedAt ? new Date(exp.exportedAt) : null;
  var dateLabel = exportedAt && !isNaN(exportedAt) ? exportedAt.toLocaleDateString(LANG==='es'?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'}) : '';

  if(window.innerWidth <= 768){
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  } else {
    var tnavH = (document.querySelector('.tnav')||{}).offsetHeight || 62;
    var pnavH = (document.querySelector('.pnav')||{}).offsetHeight || 58;
    el.style.height = 'calc(100vh - ' + (tnavH + pnavH) + 'px)';
    el.style.overflow = 'auto';
  }

  if(!exp){
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:28px"><div style="max-width:560px;width:100%;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:34px;text-align:center;box-shadow:var(--sh-sm)"><div style="width:76px;height:76px;border-radius:50%;background:var(--gold-l);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;color:var(--gold-h)"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div style="font-family:Cormorant Garamond,serif;font-size:30px;font-weight:700;margin-bottom:10px">'+(LANG==="es"?"No hay layout exportado":"No exported layout yet")+'</div><div style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:24px">'+(LANG==="es"?"Los layouts ahora se crean y editan en la Biblioteca. Crea uno o importa uno a este evento para verlo aqui.":"Layouts are now created and edited in the Library. Create one or import one into this event to view it here.")+'</div><div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="openLayoutLibraryPicker()">'+(LANG==="es"?"Importa tu layout":"Import your layout")+'</button><button class="btn btn-ghost" onclick="openLibrary();setTimeout(function(){ if(typeof libOpenLayoutWizard===\"function\") libOpenLayoutWizard(); },80)">'+(LANG==="es"?"Crear primer layout":"Create First Layout")+'</button></div></div></div>';
    return;
  }

  var summaryRows = summary && summary.elements && summary.elements.length
    ? summary.elements.map(function(row){
        var labels = row.labels && row.labels.length ? row.labels.slice(0,3).join(', ') : '?';
        return '<tr><td style="padding:10px 12px;font-weight:600">'+esc(row.type)+'</td><td style="padding:10px 12px;color:var(--muted)">'+esc(row.dimensions)+'</td><td style="padding:10px 12px;text-align:center">'+row.qty+'</td><td style="padding:10px 12px;color:var(--muted)">'+esc(labels)+'</td></tr>';
      }).join('')
    : '<tr><td colspan="4" style="padding:14px 12px;color:var(--muted);text-align:center">'+(LANG==='es'?'No hay elementos en este layout':'No elements in this layout')+'</td></tr>';
  el.innerHTML = '<div style="max-width:1180px;margin:0 auto;padding:24px;width:100%"><div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-bottom:20px"><div style="flex:1;min-width:260px"><div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:700;margin-bottom:6px">'+esc(exp.layoutName || (LANG==='es'?'Layout exportado':'Exported layout'))+'</div><div style="font-size:13px;color:var(--muted);line-height:1.6">'+(LANG==='es'?'Vista de solo lectura del layout exportado desde la Biblioteca.':'Read-only view of the layout exported from the Library.')+(dateLabel?(' '+(LANG==='es'?'Exportado el ':'Exported on ')+dateLabel+'.'):'')+'</div>'+(missingSource?'<div style="margin-top:12px;padding:10px 12px;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.08);border-radius:10px;font-size:12px;color:var(--danger)">'+(LANG==='es'?'El layout fuente ya no existe en la Biblioteca. Puedes ver esta exportacion, pero no actualizarla.':'The source layout no longer exists in the Library. You can still view this export, but you cannot refresh it.')+'</div>':'')+'</div><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn btn-ghost" onclick="openLayoutLibraryPicker()">'+(LANG==='es'?'Biblioteca':'Library')+'</button>'+(missingSource?'':'<button class="btn btn-ghost" onclick="openEventLayoutInLibrary()">'+(LANG==='es'?'Editar en Biblioteca':'Edit in Library')+'</button>')+(missingSource?'':'<button class="btn btn-primary" onclick="refreshEventLayoutFromLibrary()">'+(LANG==='es'?'Actualizar desde Biblioteca':'Refresh from Library')+'</button>')+'</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px"><div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">'+(LANG==='es'?'Mesas':'Tables')+'</div><div style="font-size:24px;font-weight:700">'+((summary&&summary.tables)||0)+'</div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">'+(LANG==='es'?'Invitados':'Guests')+'</div><div style="font-size:24px;font-weight:700">'+((summary&&summary.guests)||'-')+'</div></div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--sh-sm);margin-bottom:18px">'+(exp.image?'<img src="'+exp.image+'" alt="'+esc(exp.layoutName||'Layout')+'" style="display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--border);background:#fff">':'<div style="padding:44px;text-align:center;color:var(--muted)">'+(LANG==='es'?'No se pudo generar la imagen del layout':'Could not generate the layout image')+'</div>')+'</div><div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--sh-sm)"><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:700;margin-bottom:12px">'+(LANG==='es'?'Resumen de Elementos':'Element Summary')+'</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)"><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(LANG==='es'?'Elemento':'Element')+'</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(LANG==='es'?'Dimensiones':'Dimensions')+'</th><th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(LANG==='es'?'Cantidad':'Qty')+'</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(LANG==='es'?'Etiquetas':'Labels')+'</th></tr></thead><tbody>'+summaryRows+'</tbody></table></div></div></div>';
}

function ensureEventLayoutExport(p){
  if(!isEventLayoutViewOnly(p)) return Promise.resolve(p ? p.layoutExport || null : null);
  if(p.layoutExport) return Promise.resolve(p.layoutExport);
  if(!p.layoutItems || !p.layoutItems.length || typeof migrateLegacyEventLayoutToLibrary!=='function'){
    return Promise.resolve(null);
  }
  if(_layoutMigrationPending[p.id]) return _layoutMigrationPending[p.id];
  _layoutMigrationPending[p.id] = migrateLegacyEventLayoutToLibrary(p).then(function(exp){
    delete _layoutMigrationPending[p.id];
    if(typeof CID!=='undefined' && CID===p.id && typeof CTAB!=='undefined' && CTAB==='layout') renderLayout();
    return exp || null;
  }).catch(function(err){
    delete _layoutMigrationPending[p.id];
    console.error('layout migration failed', err);
    toast(LANG==='es'?'No se pudo migrar el layout del evento':'Could not migrate the event layout','e');
    return null;
  });
  return _layoutMigrationPending[p.id];
}

function getLayoutProj(){
  if(typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId){
    var lib=getLib();
    var entry=lib.layouts.find(function(e){return e.id===_libEditingLayoutId;});
    if(entry){
      if(!entry._proxy){
        entry._proxy={id:'__lib_entry__',name:entry.name,layoutItems:entry.items,floorplan:entry.floorplan||{img:null},vendors:[],tasks:[],guests:[],customShapes:{}};
      } else {
        entry._proxy.layoutItems=entry.items;
        entry._proxy.floorplan=entry.floorplan||{img:null};
      }
      return entry._proxy;
    }
  }
  return proj();
}
function saveLayoutData(){
  if(typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId){
    var lib=getLib();
    var entry=lib.layouts.find(function(e){return e.id===_libEditingLayoutId;});
    if(entry){
      entry.items=JSON.parse(JSON.stringify(LState.items));
      var fpCopy=JSON.parse(JSON.stringify(LState.floorplan));
      if(fpCopy.img && fpCopy.img!=='__idb__'){
        var fpKey=fpCopy._idb||('libfp_'+_libEditingLayoutId+'_'+Date.now());
        if(typeof _fpSave==='function') _fpSave(fpKey,fpCopy.img).catch(function(){});
        if(!fpCopy.thumb) fpCopy.thumb=fpCopy.img;
        fpCopy.img='__idb__';
      }
      entry.floorplan=fpCopy;
      entry.updatedAt=new Date().toISOString();
      saveLib(lib);
      return;
    }
  }
  var p=proj();
  if(p){ p.layoutItems=LState.items; saveProj(p); }
}

var LState={
  items:[],sel:[],addMode:null,zoom:1,
  pan:{x:0,y:0},panning:false,panStart:{x:0,y:0},
  dragging:false,dragStart:{x:0,y:0},snapGrid:20,useSnap:false,
  canvasW:8000,canvasH:6000,
  floorplan:{img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0},
  scaleMode:false,scalePoints:[],scalePt1El:null,scalePt2El:null,
  measureMode:false
};
var LDragOffset={};
var _layoutQuoteCollapsed=false;

function renderLayout(){
  var _savedScroll={x:0,y:0};
  var _outerBefore=document.getElementById('lcanvas-outer');
  if(_outerBefore){_savedScroll.x=_outerBefore.scrollLeft;_savedScroll.y=_outerBefore.scrollTop;}
  const p=proj();
  if(!p){
    var _noProj=document.getElementById('tab-layout');
    if(_noProj) _noProj.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px"><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:700;color:var(--muted)">'+(LANG==='es'?'Selecciona un proyecto primero':'Select a project first')+'</div></div>';
    return;
  }
  if(isEventLayoutViewOnly(p)){
    if(!p.layoutExport && p.layoutItems && p.layoutItems.length){
      ensureEventLayoutExport(p);
      var migratingEl=document.getElementById('tab-layout');
      if(migratingEl){
        migratingEl.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px;padding:24px;text-align:center"><div style="width:56px;height:56px;border-radius:50%;border:4px solid var(--border);border-top-color:var(--gold-h);animation:spin 1s linear infinite"></div><div style="font-family:Cormorant Garamond,serif;font-size:28px;font-weight:700">'+(LANG==='es'?'Migrando layout del evento':'Migrating event layout')+'</div><div style="max-width:420px;color:var(--muted);font-size:14px;line-height:1.6">'+(LANG==='es'?'Estamos moviendo este layout a la Biblioteca y generando su vista de solo lectura para el evento.':'We are moving this layout into the Library and generating its read-only event view.')+'</div></div>';
      }
      return;
    }
    renderEventLayoutViewer(p);
    return;
  }
  LState.items=p.layoutItems||[];
  ensureLayoutQuoteState(p);
  syncLayoutStyles(p);
  if(LHistorySaving&&LHistory.length===0) lHistorySave();
  LSHAPES=getLSHAPES();
  var defaultFloorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0};
  var _hasFPInMemory=LState.floorplan&&LState.floorplan.img&&LState.floorplan.img!=='__idb__';

  if(p.floorplan&&p.floorplan.img==='__idb__'&&p.floorplan._idb){
    if(_hasFPInMemory&&LState.floorplan._idb===p.floorplan._idb){
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:LState.floorplan.img,_idb:p.floorplan._idb});
    } else {
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:p.floorplan.thumb||null});
      _fpLoad(p.floorplan._idb).then(function(data){
        if(data){LState.floorplan.img=data;LState.floorplan._idb=p.floorplan._idb;renderLayoutCanvas();}
      }).catch(function(){});
    }
  } else if(p.floorplan&&p.floorplan.img&&p.floorplan.img!=='__idb__'){
    LState.floorplan=Object.assign(defaultFloorplan,p.floorplan);
  } else if(p.floorplan){
    LState.floorplan=Object.assign(defaultFloorplan,p.floorplan);
  } else {
    LState.floorplan=Object.assign(defaultFloorplan,{pxPerMeter:(p.floorplan&&p.floorplan.pxPerMeter)||null});
  }
  if(typeof _measureLines==='undefined')window._measureLines=[];
  if(typeof _measurePoints==='undefined')window._measurePoints=[];
  const el=document.getElementById('tab-layout');
  if(!el) return;
  if(el.classList.contains('hidden')) return;
  if(window.innerWidth <= 768){
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  } else {
    var tnavH = (document.querySelector('.tnav')||{}).offsetHeight || 62;
    var pnavH = (document.querySelector('.pnav')||{}).offsetHeight || 58;
    el.style.height = 'calc(100vh - ' + (tnavH + pnavH) + 'px)';
    el.style.overflow = 'hidden';
  }
  var _isEmptyEventLayout = (!LState.items.length && !LState.floorplan.img && !(typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId));
  if(_isEmptyEventLayout){
    el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:60vh;padding:24px"><div style="max-width:520px;width:100%;text-align:center;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 28px;box-shadow:0 18px 44px rgba(0,0,0,.08)"><div style="width:76px;height:76px;border-radius:50%;background:var(--gold-l);display:flex;align-items:center;justify-content:center;margin:0 auto 22px"><svg width="34" height="34" fill="none" stroke="var(--gold-h)" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div style="font-family:Cormorant Garamond,serif;font-size:30px;font-weight:700;margin-bottom:10px">'+(LANG==='es'?'Crea tu primer layout':'Create your first layout')+'</div><div style="color:var(--muted);font-size:14px;line-height:1.6;max-width:420px;margin:0 auto 24px">'+(LANG==='es'?'Empieza desde cero o importa un layout guardado de tu biblioteca para este evento.':'Start from scratch or import a saved library layout into this event.')+'</div><div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap"><button class="btn btn-primary" style="padding:14px 26px;font-size:14px;font-weight:700" onclick="libOpenLayoutWizard()">+ '+(LANG==='es'?'Crear primer layout':'Create First Layout')+'</button><button class="btn btn-ghost" style="padding:14px 22px;font-size:14px;font-weight:700" onclick="libQuickLoadLayout()">'+(LANG==='es'?'Importa tu layout':'Import your layout')+'</button></div></div></div>';
    return;
  }
  el.innerHTML=`
  <div class="layout-shell">
    <!-- SIDEBAR -->
    <div class="layout-sidebar">
      <div class="layout-sb-section" style="padding:14px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary btn-sm" onclick="libOpenLayoutWizard()" style="padding:8px 12px;font-size:13px">+ ${LANG==='es'?'Crear layout':'Create layout'}</button>
        <div style="position:relative">
          <button id="add-element-trigger" class="btn btn-ghost btn-sm" onclick="toggleAddElementMenu()" style="width:100%;padding:8px 12px;font-size:13px;text-align:left">+ ${LANG==='es'?'Agregar elemento':'Add element'}</button>
          <div id="add-element-menu" style="display:none;position:absolute;left:0;top:100%;width:calc(100% - 2px);background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px;box-shadow:0 12px 24px rgba(0,0,0,0.12);z-index:50">
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('table')">${LANG==='es'?'Mesa':'Table'}</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('event-element')">${LANG==='es'?'Elemento de evento':'Event element'}</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('floorplan')">${LState.floorplan.img?(LANG==='es'?'Reemplazar plano':'Replace floorplan'):(LANG==='es'?'Plano de piso':'Floorplan image')}</button>
          </div>
          <input id="layout-floorplan-input" type="file" accept="image/*" style="display:none" onchange="handleFloorplanUpload(event)">
        </div>
      </div>
    </div>
    <!-- MAIN -->
    <!-- MAIN -->
    <div class="layout-main">
      <!-- Toolbar -->
      <div class="layout-toolbar">
        <div class="zoom-bar">
          <button class="zoom-btn" onclick="lZoom(-0.1)">-</button>
          <span style="font-size:12px;font-weight:600;min-width:45px;text-align:center">${Math.round(LState.zoom*100)}%</span>
          <button class="zoom-btn" onclick="lZoom(0.1)">+</button>
        </div>
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <button title="Zoom to fit" onclick="lZoom(0,'fit')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6"/></svg></button>
        <button title="Zoom to selected" onclick="lZoom(0,'sel')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="18" cy="18" r="3" fill="currentColor" stroke="none"/></svg></button>
        <button title="${LState.measureMode?'Exit measure (Esc)':'Measure distances'}" onclick="toggleMeasureMode()" style="width:28px;height:28px;border:1px solid ${LState.measureMode?'var(--gold)':'var(--border)'};background:${LState.measureMode?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${LState.measureMode?'var(--gold-h)':'var(--muted)'};transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='${LState.measureMode?'var(--gold-l)':'transparent'}';this.style.color='${LState.measureMode?'var(--gold-h)':'var(--muted)'}';this.style.borderColor='${LState.measureMode?'var(--gold)':'var(--border)'}'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v4M9 7v3M12 7v4M15 7v3M18 7v4"/></svg></button>
        ${_measureLines.length>0?`<button title="Clear measurements" onclick="clearMeasurements()" style="width:28px;height:28px;border:1px solid rgba(239,68,68,.4);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--danger);font-size:10px;font-weight:700;transition:var(--tr)" onmouseover="this.style.background='rgba(239,68,68,.1)'" onmouseout="this.style.background='transparent'">CLR</button>`:''}
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <span style="font-size:12px;color:var(--muted)">
          ${LState.items.length} ${t('items_count')} |
          ${LState.items.filter(i=>i.shape.includes('table')).length} ${t('tables_lbl')} |
          ${LState.items.reduce((s,i)=>s+(i.chairs||0),0)} ${t('chairs_lbl')}

          ${LState.addMode?`<strong style="color:var(--gold-h)"> | Click canvas to place ${LState.addMode.replace('-',' ')}</strong>`:''}
        </span>
        <div style="flex:1"></div>
        ${(()=>{const q=getLayoutQuoteSummary(LState.items, ensureLayoutQuoteState(p));return (q.total>0||q.extraRows.length)?`<div id="layout-quote-total-pill" style="background:var(--gold-l);border:1px solid rgba(201,168,76,.3);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;color:var(--gold-h);cursor:pointer" onclick="showLayoutBudget()" title="${t('layout_quote_open')}">${t('layout_quote_title')}: ${formatCost(q.total)}</div>`:'';})()}
        <button onclick="LState.useSnap=!LState.useSnap;renderLayoutUI()" title="Toggle snap to grid"
          style="height:28px;padding:0 10px;border:1px solid ${LState.useSnap?'var(--gold)':'var(--border)'};background:${LState.useSnap?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:${LState.useSnap?'var(--gold-h)':'var(--muted)'};transition:var(--tr);white-space:nowrap"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="if(!LState.useSnap)this.style.borderColor='var(--border)'">
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1 3.5h10M1 6h10M1 8.5h10M3.5 1v10M6 1v10M8.5 1v10"/></svg>${LState.useSnap?'Snap ON':'Snap OFF'}</span>
        </button>
        ${LState.floorplan.img?`
        <div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">${LANG==='es'?'Plano':'Floorplan'}</span>
          ${LState.scaleMode?`
          <span style="font-size:11px;color:var(--muted)">${LANG==='es'?'Marca A y B en el plano':'Pick A and B on the floorplan'}</span>
          <input id="scale-dist" type="number" step="0.1" min="0.1" placeholder="m" style="width:72px;height:28px;border:1px solid var(--border);border-radius:5px;background:var(--bg2);color:var(--text);font-size:12px;text-align:center;padding:0 6px" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" onclick="applyScaleCalibration()">${LANG==='es'?'Aplicar':'Apply'}</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelScaleMode()">${LANG==='es'?'Cancelar':'Cancel'}</button>
          `:`
          <button class="btn btn-ghost btn-sm" onclick="triggerFloorplanUpload()">${LANG==='es'?'Cambiar imagen':'Change image'}</button>
          <button class="btn btn-ghost btn-sm" onclick="startScaleMode()">${LANG==='es'?'Escalar':'Scale'}</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleFloorplanLock()">${LState.floorplan.locked?(LANG==='es'?'Desbloquear':'Unlock'):(LANG==='es'?'Bloquear':'Lock')}</button>
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);font-weight:600" onclick="event.stopPropagation()">
            <span>${t('opacity_lbl')||'Opacity'}</span>
            <input id="floorplan-opacity-range" type="range" min="0" max="100" step="1" value="${Math.round((LState.floorplan.opacity==null?0.4:LState.floorplan.opacity)*100)}" style="width:88px" oninput="setFloorplanOpacity(this.value,true)" onchange="setFloorplanOpacity(this.value,true)">
            <input id="floorplan-opacity-num" type="number" min="0" max="100" step="1" value="${Math.round((LState.floorplan.opacity==null?0.4:LState.floorplan.opacity)*100)}" style="width:52px;height:28px;border:1px solid var(--border);border-radius:5px;background:var(--bg2);color:var(--text);font-size:12px;text-align:center;padding:0 6px" oninput="setFloorplanOpacity(this.value,false)" onkeydown="if(event.key==='Enter')this.blur();event.stopPropagation();" onclick="event.stopPropagation()">
          </label>
          <button class="btn btn-ghost btn-sm" onclick="removeFloorplan()" style="color:var(--danger)">${LANG==='es'?'Quitar':'Remove'}</button>
          `}
        </div>`:''}
        <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;opacity:1;gap:5px">
          <span style="font-size:10px;color:var(--muted);margin-right:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Aa</span>
          <button title="Decrease font size" onclick="changeFontSize(-1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">-</button>
          <span style="font-size:11px;color:var(--muted);min-width:44px;text-align:center"><input id="toolbar-font-size" type="number" min="5" max="99" style="width:44px;font-size:12px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px;background:var(--bg);color:var(--text)" placeholder="--" oninput="setFontSizeDirect(+this.value)" onkeydown="if(event.key==='Enter')this.blur();event.stopPropagation();" onclick="event.stopPropagation()"></span>
          <button title="Increase font size" onclick="changeFontSize(1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">+</button>
        </div>
        <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:3px 6px;opacity:1">
          <span style="font-size:10px;color:var(--muted);margin-right:3px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${t('align')}</span>
          <button title="Align Left" onclick="alignSelected('left')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 6h16M4 12h10M4 18h13"/><line x1="2" y1="4" x2="2" y2="20" stroke-width="2.5"/></svg></button>
          <button title="Center Horizontally" onclick="alignSelected('cx')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 6h8M5 12h14M7 18h10"/><line x1="12" y1="2" x2="12" y2="22" stroke-width="2.5" stroke-dasharray="2 2"/></svg></button>
          <button title="Align Right" onclick="alignSelected('right')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 6h16M10 12h10M7 18h13"/><line x1="22" y1="4" x2="22" y2="20" stroke-width="2.5"/></svg></button>
          <div style="width:1px;height:18px;background:var(--border);margin:0 2px"></div>
          <button title="Align Top" onclick="alignSelected('top')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 8v12M12 4v16M18 10v10"/><line x1="4" y1="2" x2="20" y2="2" stroke-width="2.5"/></svg></button>
          <button title="Center Vertically" onclick="alignSelected('cy')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 7v10M12 4v16M18 9v6"/><line x1="4" y1="12" x2="20" y2="12" stroke-width="2.5" stroke-dasharray="2 2"/></svg></button>
          <button title="Align Bottom" onclick="alignSelected('bottom')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 4v12M12 8v12M18 4v12"/><line x1="4" y1="22" x2="20" y2="22" stroke-width="2.5"/></svg></button>
          <div style="width:1px;height:18px;background:var(--border);margin:0 2px"></div>
          <button title="Distribute Horizontally" onclick="alignSelected('dist-h')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="8" width="5" height="8" rx="1"/><rect x="18" y="5" width="5" height="14" rx="1"/><line x1="3.5" y1="3" x2="3.5" y2="21" stroke-dasharray="2 2" stroke-width="1.2"/><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2 2" stroke-width="1.2"/><line x1="20.5" y1="3" x2="20.5" y2="21" stroke-dasharray="2 2" stroke-width="1.2"/></svg></button>
          <button title="Distribute Vertically" onclick="alignSelected('dist-v')" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="1" width="12" height="5" rx="1"/><rect x="8" y="9.5" width="8" height="5" rx="1"/><rect x="5" y="18" width="14" height="5" rx="1"/><line x1="3" y1="3.5" x2="21" y2="3.5" stroke-dasharray="2 2" stroke-width="1.2"/><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2" stroke-width="1.2"/><line x1="3" y1="20.5" x2="21" y2="20.5" stroke-dasharray="2 2" stroke-width="1.2"/></svg></button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;opacity:1">
          <button title="Rotate counterclockwise" onclick="doRotate(-getRotateStep())" style="width:32px;height:32px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 10H4V5"/><path d="M20 11a8 8 0 1 0-2.34 5.66L20 14"/></svg></button>
          <input id="rotate-step" type="number" value="90" min="1" step="1" style="width:54px;height:30px;border:1px solid var(--border);border-radius:5px;background:var(--bg2);color:var(--text);font-size:12px;text-align:center;padding:0 4px" title="Degrees per rotation step" onclick="event.stopPropagation()">
          <button title="Rotate clockwise" onclick="doRotate(getRotateStep())" style="width:32px;height:32px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 10h5V5"/><path d="M4 11a8 8 0 1 1 2.34 5.66L4 14"/></svg></button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="exportLayoutFull()">${t('export')}</button>
      </div>
      ${renderLayoutQuoteWorkspace(p)}
      <!-- Canvas -->
      <div class="layout-canvas-outer" id="lcanvas-outer"
        onmousedown="lCanvasDown(event)"
        onmouseleave="lCanvasLeave(event)"
        style="position:relative;cursor:${LState.scaleMode||LState.measureMode?'crosshair':_fpDragging?'grabbing':'default'}">
        <div class="layout-canvas" id="lcanvas"
          style="width:${LState.canvasW}px;height:${LState.canvasH}px;transform:scale(${LState.zoom});transform-origin:0 0;background:#fff;position:relative">
          ${LState.floorplan.img?`<img id="fp-img" src="${LState.floorplan.img}"
            style="position:absolute;left:${LState.floorplan.x}px;top:${LState.floorplan.y}px;
              width:${Math.round(LState.floorplan.w*LState.floorplan.scale)}px;
              height:${Math.round(LState.floorplan.h*LState.floorplan.scale)}px;
              opacity:${LState.floorplan.opacity};user-select:none;z-index:0;transform-origin:center center;
              transform:rotate(${LState.floorplan.rotation||0}deg);
              pointer-events:none;cursor:${LState.floorplan.locked?'default':'grab'}" draggable="false">`:''}
          ${LState.scaleMode&&LState.scalePoints.length>0?LState.scalePoints.map((pt,i)=>`
            <div style="position:absolute;left:${pt.x-10}px;top:${pt.y-10}px;width:20px;height:20px;border-radius:50%;
              background:${i===0?'#f59e0b':'#10b981'};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:100;pointer-events:none;
              display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">${i===0?'A':'B'}</div>
          `).join(''):''}
          ${LState.scaleMode&&LState.scalePoints.length===2?`
            <svg style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:99" overflow="visible">
              <line x1="${LState.scalePoints[0].x}" y1="${LState.scalePoints[0].y}"
                    x2="${LState.scalePoints[1].x}" y2="${LState.scalePoints[1].y}"
                    stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 3"/>
              <text x="${(LState.scalePoints[0].x+LState.scalePoints[1].x)/2}"
                    y="${(LState.scalePoints[0].y+LState.scalePoints[1].y)/2-8}"
                    fill="#f59e0b" font-size="12" font-weight="600" text-anchor="middle"
                    style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${Math.round(Math.hypot(LState.scalePoints[1].x-LState.scalePoints[0].x,LState.scalePoints[1].y-LState.scalePoints[0].y))}px</text>
            </svg>`:''}
          <div style="position:relative;z-index:1">
            ${LState.items.map(item=>renderLItem(item)).join('')}
            ${LState.items.length===0&&(typeof _libEditingLayoutId==="undefined"||!_libEditingLayoutId)?`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto">
              <div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:700;color:var(--muted);margin-bottom:16px">${t("create_general_layout")||"Start your layout"}</div>
              <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
                <button class="btn btn-primary" style="padding:14px 28px;font-size:14px;font-weight:700" onclick="libOpenLayoutWizard()">+ ${t("create_general_layout")||"Create General Layout"}</button>
                <button class="btn btn-ghost" style="padding:14px 22px;font-size:14px;font-weight:700" onclick="libQuickLoadLayout()">${LANG==="es"?"Importa tu layout":"Import your layout"}</button>
              </div>
              <div style="font-size:12px;color:var(--light);margin-top:10px">${LANG==="es"?"O arrastra elementos desde el panel izquierdo":"Or drag elements from the left panel"}</div>
            </div>`:''}
          </div>
          <!-- Measure overlay -->
          <svg id="measure-overlay" style="position:absolute;left:0;top:0;width:${LState.canvasW}px;height:${LState.canvasH}px;pointer-events:none;z-index:200;overflow:visible">
            ${_measureLines.map((ln,i)=>`
              <line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="0"/>
              <circle cx="${ln.x1}" cy="${ln.y1}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
              <circle cx="${ln.x2}" cy="${ln.y2}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
              <rect x="${(ln.x1+ln.x2)/2-28}" y="${(ln.y1+ln.y2)/2-22}" width="56" height="18" rx="4" fill="rgba(30,30,50,.82)"/>
              <text x="${(ln.x1+ln.x2)/2}" y="${(ln.y1+ln.y2)/2-9}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" font-family="monospace">${ln.calibrated&&ln.m>0?ln.m.toFixed(2)+'m':(ln.px/getPPM()).toFixed(2)+'m'}</text>
            `).join('')}
            ${_measurePoints.length===1?`
              <circle cx="${_measurePoints[0].x}" cy="${_measurePoints[0].y}" r="6" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
              <line id="measure-preview" x1="${_measurePoints[0].x}" y1="${_measurePoints[0].y}" x2="${_measurePoints[0].x}" y2="${_measurePoints[0].y}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 3"/>
              <text id="measure-preview-label" x="${_measurePoints[0].x}" y="${_measurePoints[0].y-10}" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</text>
            `:''}
          </svg>
        </div>
      </div>
      <div style="padding:5px 16px;background:var(--card);border-top:1px solid var(--border);font-size:10.5px;color:var(--muted);display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span>${t('scroll_zoom')}</span>
        <span>${t('space_pan')}</span>
        <span>${t('drag_select')}</span>
        <span>${t('shift_drag_add')}</span>
        <span>${t('ctrl_drag_remove')}</span>
        <span>${t('shift_click_add')}</span>
        <span>${t('ctrl_click_desel')}</span>
        <span>${t('copy_paste')}</span>
        <span>${t('del_remove')}</span>
        ${LState.sel.length?`<span style="color:var(--gold-h);font-weight:600">${LState.sel.length} ${LANG==='es'?'seleccionados':'selected'}</span>`:''}
      </div>
    </div>
  </div>`;
  attachLItemEvents();
  const co=document.getElementById('lcanvas-outer');
  if(co){
    co.removeEventListener('wheel',lWheel);
    co.addEventListener('wheel',lWheel,{passive:false});
    initLayoutTouchHandlers();
    if(_savedScroll.x||_savedScroll.y){
      co.scrollLeft=_savedScroll.x;
      co.scrollTop=_savedScroll.y;
    }
  }
}

function renderLayoutUI(){
  renderLayout();
}

function ensureLayoutQuoteState(p){
  if(!p) return [];
  if(!p.layoutQuoteExtras) p.layoutQuoteExtras=[];
  return p.layoutQuoteExtras;
}

function getLayoutQuoteGroupKey(item){
  return [item.shape||'', item.chairType||'default', item.centerpiece||'none'].join('||');
}

function getLayoutShapeLabel(shape){
  if(typeof LSHAPES_M==='undefined' || !LSHAPES_M) LSHAPES_M=getLSHAPES();
  return LSHAPES_M[shape] && LSHAPES_M[shape].label ? LSHAPES_M[shape].label : String(shape||'Element').replace(/-/g,' ');
}

function getLayoutQuoteSummary(items, extras){
  items = items || [];
  extras = extras || [];
  if(typeof LSHAPES_M==='undefined' || !LSHAPES_M) LSHAPES_M=getLSHAPES();

  var groups={};
  items.forEach(function(item){
    var key=getLayoutQuoteGroupKey(item);
    var chairType=item.chairType||'default';
    var chairDef=CHAIR_TYPES[chairType] || CHAIR_TYPES.default || {label:chairType,costPerChair:0};
    var cpKey=item.centerpiece||'none';
    var cpDef=CENTERPIECE_TYPES[cpKey] || {label:cpKey,cost:0};
    var shapeDef=LSHAPES_M[item.shape] || null;
    if(!groups[key]){
      groups[key]={
        key:key,
        shape:item.shape,
        label:getLayoutShapeLabel(item.shape),
        chairType:chairType,
        chairStyle:chairType!=='default' ? (chairDef.label||chairType) : (LANG==='es'?'Predeterminada':'Default'),
        centerpieceKey:cpKey,
        centerpiece:cpKey!=='none' ? (cpDef.label||cpKey) : (LANG==='es'?'Ninguno':'None'),
        chairsPerUnit:Number(item.chairs||0),
        unitElementPrice:Number(item.cost||0),
        qty:0,
        isTable:!!(item.shape && (item.shape.indexOf('table')>=0 || (shapeDef && shapeDef._isCustomTable)))
      };
    }
    groups[key].qty++;
  });

  var autoRows=Object.keys(groups).map(function(key){
    var row=groups[key];
    var chairDef=CHAIR_TYPES[row.chairType] || CHAIR_TYPES.default || {costPerChair:0,label:row.chairType};
    var cpDef=CENTERPIECE_TYPES[row.centerpieceKey] || {cost:0,label:row.centerpieceKey};
    row.unitChairPriceTotal = Number(row.chairsPerUnit||0) * Number(chairDef.costPerChair||0);
    row.unitCenterpiecePrice = row.centerpieceKey!=='none' ? Number(cpDef.cost||0) : 0;
    row.unitTotal = Number(row.unitElementPrice||0) + row.unitChairPriceTotal + row.unitCenterpiecePrice;
    row.rowTotal = row.unitTotal * Number(row.qty||0);
    return row;
  }).sort(function(a,b){
    if(a.label===b.label){
      if(a.chairStyle===b.chairStyle) return a.centerpiece.localeCompare(b.centerpiece);
      return a.chairStyle.localeCompare(b.chairStyle);
    }
    return a.label.localeCompare(b.label);
  });

  var extraRows=extras.map(function(extra, index){
    var qty=Math.max(0, parseInt(extra.quantity,10) || 0);
    var unitPrice=Number(extra.unitPrice||0);
    return {
      id: extra.id || ('lqe_'+index),
      name: String(extra.name||'').trim(),
      category: String(extra.category||'').trim(),
      quantity: qty,
      unitPrice: unitPrice,
      notes: String(extra.notes||''),
      rowTotal: qty * unitPrice
    };
  });

  var autoTotal=autoRows.reduce(function(sum,row){ return sum + row.rowTotal; },0);
  var extrasTotal=extraRows.reduce(function(sum,row){ return sum + row.rowTotal; },0);
  var totalSeats=items.reduce(function(sum,item){ return sum + Number(item.chairs||0); },0);
  var extraQtyTotal=extraRows.reduce(function(sum,row){ return sum + row.quantity; },0);

  return {
    autoRows:autoRows,
    extraRows:extraRows,
    autoTotal:autoTotal,
    extrasTotal:extrasTotal,
    total:autoTotal + extrasTotal,
    totalSeats:totalSeats,
    layoutItemCount:items.length,
    extraQtyTotal:extraQtyTotal,
    totalElements:items.length + extraQtyTotal
  };
}

function renderLayoutQuoteWorkspace(p){
  if(!p) return '';
  var extras=ensureLayoutQuoteState(p);
  var quote=getLayoutQuoteSummary(LState.items, extras);
  var isES=LANG==='es';
  var hiddenBody=_layoutQuoteCollapsed ? 'display:none;' : '';
  var empty = !quote.autoRows.length && !quote.extraRows.length;
  return `
    <div id="layout-quote-workspace" style="margin:0 12px 12px;background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">${t('layout_quote_title')}</div>
          <div style="font-size:12px;color:var(--muted)">${t('layout_quote_sub')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="toggleLayoutQuoteWorkspace()">${_layoutQuoteCollapsed?t('layout_quote_show'):t('layout_quote_hide')}</button>
          <button class="btn btn-primary btn-sm" onclick="lQuoteAddExtra()">${t('layout_quote_add_custom')}</button>
        </div>
      </div>
      <div style="${hiddenBody}">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)">
          <div style="background:var(--bg2);border-radius:10px;padding:12px 14px">
            <div style="font-size:20px;font-weight:700;color:var(--gold-h)">${quote.totalElements}</div>
            <div style="font-size:11px;color:var(--muted)">${isES?'Elementos cotizados':'Quoted elements'}</div>
          </div>
          <div style="background:var(--bg2);border-radius:10px;padding:12px 14px">
            <div style="font-size:20px;font-weight:700">${quote.totalSeats}</div>
            <div style="font-size:11px;color:var(--muted)">${isES?'Asientos totales':'Total seats'}</div>
          </div>
          <div style="background:var(--gold-l);border-radius:10px;padding:12px 14px">
            <div style="font-size:20px;font-weight:700;color:var(--gold-h)">${formatCost(quote.total)}</div>
            <div style="font-size:11px;color:var(--muted)">${t('layout_quote_title')}</div>
          </div>
        </div>
        ${empty
          ? `<div style="padding:28px 18px;text-align:center">
              <div style="font-size:15px;font-weight:700;margin-bottom:6px">${t('layout_quote_empty')}</div>
              <div style="font-size:12px;color:var(--muted)">${t('layout_quote_empty_sub')}</div>
            </div>`
          : `
            ${renderLayoutQuoteAutoTable(quote)}
            ${renderLayoutQuoteExtrasTable(quote)}
          `}
      </div>
    </div>`;
}

function renderLayoutQuoteAutoTable(quote){
  if(!quote.autoRows.length) return '';
  var rows=quote.autoRows.map(function(row){
    var chairOpts=Object.keys(CHAIR_TYPES).map(function(key){
      return '<option value="'+key+'"'+(row.chairType===key?' selected':'')+'>'+esc(CHAIR_TYPES[key].label)+'</option>';
    }).join('');
    var cpOpts=Object.keys(CENTERPIECE_TYPES).map(function(key){
      return '<option value="'+key+'"'+(row.centerpieceKey===key?' selected':'')+'>'+esc(CENTERPIECE_TYPES[key].label)+'</option>';
    }).join('');
    return '<tr style="border-bottom:1px solid var(--bg2)">'+
      '<td style="padding:9px 10px;font-size:12px;font-weight:600">'+esc(row.label)+'</td>'+
      '<td style="padding:9px 10px;text-align:center;font-size:12px">'+row.qty+'</td>'+
      '<td style="padding:6px 8px">'+(row.isTable?'<select class="input" style="font-size:11px;padding:5px 6px" onchange="lQuoteUpdateGroupChairType(\''+row.key+'\',this.value)">'+chairOpts+'</select>':'<span style="font-size:11px;color:var(--muted)">-</span>')+'</td>'+
      '<td style="padding:6px 8px">'+(row.isTable?'<select class="input" style="font-size:11px;padding:5px 6px" onchange="lQuoteUpdateGroupCenterpiece(\''+row.key+'\',this.value)">'+cpOpts+'</select>':'<span style="font-size:11px;color:var(--muted)">-</span>')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;font-size:12px">'+(row.chairsPerUnit||'-')+'</td>'+
      '<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.unitElementPrice+'" style="font-size:11px;padding:5px 6px;min-width:90px" onchange="lQuoteUpdateGroupCost(\''+row.key+'\',this.value)"></td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px">'+formatCost(row.unitChairPriceTotal)+'</td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px">'+formatCost(row.unitCenterpiecePrice)+'</td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:600">'+formatCost(row.unitTotal)+'</td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
    '</tr>';
  }).join('');
  return '<div style="padding:16px 16px 0">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap">'+
      '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">'+t('layout_quote_auto')+'</div>'+
      '<div style="font-size:12px;color:var(--muted)">'+formatCost(quote.autoTotal)+'</div>'+
    '</div>'+
    '<div style="overflow:auto;border:1px solid var(--border);border-radius:10px">'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff">'+
        '<thead><tr style="background:var(--bg2)">'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_item')+'</th>'+
          '<th style="padding:8px 10px;text-align:center">'+t('layout_quote_quantity')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('chair_style')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('centerpiece')+'</th>'+
          '<th style="padding:8px 10px;text-align:center">'+t('layout_quote_seats_unit')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_base')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_chair_cost')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_centerpiece_cost')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_unit_total')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_row_total')+'</th>'+
        '</tr></thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table>'+
    '</div>'+
  '</div>';
}

function renderLayoutQuoteExtrasTable(quote){
  var rows=quote.extraRows.map(function(row){
    return '<tr style="border-bottom:1px solid var(--bg2)">'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.name)+'" style="font-size:11px;padding:5px 6px;min-width:160px" onchange="lQuoteUpdateExtraField(\''+row.id+'\',\'name\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.category)+'" style="font-size:11px;padding:5px 6px;min-width:120px" onchange="lQuoteUpdateExtraField(\''+row.id+'\',\'category\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" type="number" min="0" step="1" value="'+row.quantity+'" style="font-size:11px;padding:5px 6px;min-width:70px" onchange="lQuoteUpdateExtraField(\''+row.id+'\',\'quantity\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.unitPrice+'" style="font-size:11px;padding:5px 6px;min-width:90px" onchange="lQuoteUpdateExtraField(\''+row.id+'\',\'unitPrice\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.notes)+'" style="font-size:11px;padding:5px 6px;min-width:180px" onchange="lQuoteUpdateExtraField(\''+row.id+'\',\'notes\',this.value)"></td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
      '<td style="padding:6px 8px;text-align:center"><button class="btn btn-danger btn-sm btn-icon" onclick="lQuoteDeleteExtra(\''+row.id+'\')" title="'+t('delete')+'"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td>'+
    '</tr>';
  }).join('');
  return '<div style="padding:16px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap">'+
      '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">'+t('layout_quote_custom')+'</div>'+
      '<div style="font-size:12px;color:var(--muted)">'+formatCost(quote.extrasTotal)+'</div>'+
    '</div>'+
    '<div style="overflow:auto;border:1px solid var(--border);border-radius:10px">'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff">'+
        '<thead><tr style="background:var(--bg2)">'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_item')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_custom_category')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_quantity')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_unit_price')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_notes')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_row_total')+'</th>'+
          '<th style="padding:8px 10px;text-align:center">'+t('layout_quote_actions')+'</th>'+
        '</tr></thead>'+
        '<tbody>'+(rows || '<tr><td colspan="7" style="padding:14px 12px;text-align:center;color:var(--muted);font-size:12px">'+t('layout_quote_empty_sub')+'</td></tr>')+'</tbody>'+
      '</table>'+
    '</div>'+
  '</div>';
}

function toggleLayoutQuoteWorkspace(){
  _layoutQuoteCollapsed=!_layoutQuoteCollapsed;
  renderLayoutUI();
}

function lQuoteUpdateGroupCost(key, value){
  var p=proj();
  if(!p) return;
  var cost=Math.max(0, Number(value||0));
  p.layoutItems=(p.layoutItems||[]).map(function(item){
    if(getLayoutQuoteGroupKey(item)===key) item.cost=cost;
    return item;
  });
  saveProj(p);
  LState.items=p.layoutItems;
  renderLayoutUI();
}

function lQuoteUpdateGroupChairType(key, chairType){
  var p=proj();
  if(!p) return;
  p.layoutItems=(p.layoutItems||[]).map(function(item){
    if(getLayoutQuoteGroupKey(item)===key) item.chairType=chairType||'default';
    return item;
  });
  saveProj(p);
  LState.items=p.layoutItems;
  renderLayoutUI();
}

function lQuoteUpdateGroupCenterpiece(key, centerpiece){
  var p=proj();
  if(!p) return;
  p.layoutItems=(p.layoutItems||[]).map(function(item){
    if(getLayoutQuoteGroupKey(item)===key) item.centerpiece=centerpiece||'none';
    return item;
  });
  saveProj(p);
  LState.items=p.layoutItems;
  renderLayoutUI();
}

function lQuoteAddExtra(){
  var p=proj();
  if(!p) return;
  ensureLayoutQuoteState(p).push({
    id:'lqe'+Date.now()+Math.random().toString(36).slice(2,6),
    name:'',
    category:'',
    quantity:1,
    unitPrice:0,
    notes:''
  });
  saveProj(p);
  _layoutQuoteCollapsed=false;
  renderLayoutUI();
}

function lQuoteUpdateExtraField(id, field, value){
  var p=proj();
  if(!p) return;
  var extras=ensureLayoutQuoteState(p);
  var extra=extras.find(function(entry){ return entry.id===id; });
  if(!extra) return;
  if(field==='quantity') extra[field]=Math.max(0, parseInt(value,10) || 0);
  else if(field==='unitPrice') extra[field]=Math.max(0, Number(value||0));
  else extra[field]=String(value||'');
  saveProj(p);
  renderLayoutUI();
}

function lQuoteDeleteExtra(id){
  var p=proj();
  if(!p) return;
  p.layoutQuoteExtras=ensureLayoutQuoteState(p).filter(function(entry){ return entry.id!==id; });
  saveProj(p);
  renderLayoutUI();
}
 
function getChairPx(item){
  var minSide = Math.min(item.w, item.h);
  return Math.max(8, Math.round(minSide * 0.22));
}
function getChairGap(item){
  var minSide = Math.min(item.w, item.h);
  return Math.max(1, Math.round(minSide * 0.04));
}
function getChairPad(item){
  if(!item.chairs) return 0;
  return getChairPx(item) + getChairGap(item);
}
 
function renderLItem(item){
  const isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  const chairsHTML = renderChairs(item);
  const pad = getChairPad(item);
  const cornerRadius = isRound ? '50%' : '0px';
  const textClr = item.bdClr;
  const wM = item.w / getPPM();
  const autoFontSize = Math.max(7, Math.min(14, Math.round(wM * 8)));
  const fontSize = item.fontSize || autoFontSize;
  const seatsSize = Math.max(6, Math.min(11, Math.round(wM * 6)));
  const cpHTML = renderCenterpiece(item);
  return `<div class="litem ${LState.sel.includes(item.id)?'sel':''}"
    id="li_${item.id}"
    data-id="${item.id}"
    style="left:${item.x}px;top:${item.y}px;width:${item.w+pad*2}px;height:${item.h+pad*2}px;padding:${pad}px;transform:rotate(${item.rotation||0}deg);transform-origin:center center"
    ondblclick="openLItemModal('${item.id}')">
    <div style="position:relative;width:100%;height:100%">
      ${chairsHTML}
      <div style="position:absolute;inset:0;border-radius:${cornerRadius};background:${item.bg};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10)">
        ${cpHTML}
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:2;pointer-events:none">
          <div class="litem-label" style="color:${textClr};font-size:${fontSize}px;font-weight:300;letter-spacing:0.03em;font-family:'Jost',sans-serif;text-align:center;line-height:1.2">${item.label}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderCenterpiece(item){
  if(!item.centerpiece || item.centerpiece==='none') return '';
  const ct = CENTERPIECE_TYPES[item.centerpiece];
  if(!ct || !ct.color) return '';
  const minDim = Math.min(item.w, item.h);
  const cpSz = Math.round(minDim * 0.55);
  const col = ct.color;
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:${cpSz}px;height:${cpSz}px;border-radius:50%;
    background:${col};opacity:0.55;
    pointer-events:none;z-index:1;flex-shrink:0"></div>`;
}


function renderChairs(item){
  if(!item.chairs) return '';
  const n=item.chairs; const w=item.w; const h=item.h;
  const cs=getChairPx(item);
  const gap=getChairGap(item);
  let html='<div class="litem-chairs">';
  const positions=[];
  const isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  const isSquare = item.shape==='square-table';
  
  if(isRound){
    for(let i=0;i<n;i++){
      const angle=(i/n)*2*Math.PI - Math.PI/2;
      positions.push({x:w/2+(w/2+cs/2+gap)*Math.cos(angle), y:h/2+(h/2+cs/2+gap)*Math.sin(angle)});
    }
  } else if(item.shape==='rect-table'){
    const sideN=2;
    const topN=Math.ceil((n-sideN*2)/2), botN=Math.floor((n-sideN*2)/2);
    for(let i=0;i<topN;i++)   positions.push({x:(i+1)*w/(topN+1),  y:-(cs/2+gap)});
    for(let i=0;i<botN;i++)   positions.push({x:(i+1)*w/(botN+1),  y:h+cs/2+gap});
    for(let i=0;i<sideN;i++)  positions.push({x:-(cs/2+gap),       y:(i+1)*h/(sideN+1)});
    for(let i=0;i<sideN;i++)  positions.push({x:w+cs/2+gap,        y:(i+1)*h/(sideN+1)});
  } else {
    const chairSlot=cs+5;
    const longCap=Math.max(1,Math.floor(w/chairSlot));
    let top=0,bot=0,left=0,right=0;
    if(n<=2*longCap){ top=Math.ceil(n/2); bot=Math.floor(n/2); }
    else { top=longCap; bot=longCap; const rem=n-top-bot; left=Math.ceil(rem/2); right=Math.floor(rem/2); }
    for(let i=0;i<top;i++)   positions.push({x:(i+1)*w/(top+1),   y:-(cs/2+gap)});
    for(let i=0;i<bot;i++)   positions.push({x:(i+1)*w/(bot+1),   y:h+cs/2+gap});
    for(let i=0;i<left;i++)  positions.push({x:-(cs/2+gap),       y:(i+1)*h/(left+1)});
    for(let i=0;i<right;i++) positions.push({x:w+cs/2+gap,        y:(i+1)*h/(right+1)});
  }
  
  const cType = item.chairType || 'default';
  const ct = CHAIR_TYPES[cType] || CHAIR_TYPES['default'];
  const fill = ct ? ct.fill : '#f5f4f0';
  positions.forEach(pos=>{
    html+=`<div class="chair-dot" style="width:${cs}px;height:${cs}px;left:${pos.x-cs/2}px;top:${pos.y-cs/2}px;background:${fill};border:none;border-radius:50%"></div>`;
  });
  html+='</div>';
  return html;
}


function lAddBtn(shape,label,icon,bg,clr){
  const isRound=shape==='round-table'||(LSHAPES_M[shape]&&LSHAPES_M[shape].radius==='50%');
  return `<button class="add-btn ${LState.addMode===shape?'active-add':''}" id="ladd_${shape}" onclick="setAddMode('${shape}')">
    <div style="width:18px;height:18px;border-radius:${isRound?'50%':'2px'};background:${bg};flex-shrink:0"></div>
    ${label}
  </button>`;
}
function setAddMode(shape){
  LState.addMode=LState.addMode===shape?null:shape;
  document.getElementById('lcanvas-outer').style.cursor=LState.addMode?'crosshair':'default';
  renderLayout();
}

function toggleAddElementMenu(){
  var menu=document.getElementById('add-element-menu');
  if(!menu) return;
  menu.style.display = menu.style.display==='block' ? 'none' : 'block';
}

function closeAddElementMenu(){
  var menu=document.getElementById('add-element-menu');
  if(menu) menu.style.display='none';
}

function selectAddElement(kind){
  closeAddElementMenu();
  if(kind==='table'){
    openAddTableModal();
    return;
  }
  if(kind==='event-element'){
    openAddEventElementModal();
    return;
  }
  if(kind==='floorplan'){
    triggerFloorplanUpload();
    return;
  }
}

function triggerFloorplanUpload(){
  var input=document.getElementById('layout-floorplan-input');
  if(input) input.click();
}

/* -- Add Table Modal -- */
var _addTableSelection={};
function _addTableDrawSVG(item, selected){
  var SCALE=44;
  var CS=0.38*SCALE; var CG=0.06*SCALE;
  var tw=item.wM*SCALE; var th=item.hM*SCALE;
  var padX=CS+CG+2; var padY=CS+CG+2;
  var svgW=tw+padX*2; var svgH=th+padY*2+14;
  var tx=padX; var ty=padY;
  var tableFill=selected?'#93b8d8':'#aac9e8';
  var chairFill='#e07a52';
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
    var sideN=2;
    var topN=Math.ceil((n-sideN*2)/2); var botN=Math.floor((n-sideN*2)/2);
    for(var ci=0;ci<topN;ci++){
      var cx2=tx+(ci+0.5)*(tw/topN); var cy2=ty-CG-CS/2;
      chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    for(var ci=0;ci<botN;ci++){
      var cx2=tx+(ci+0.5)*(tw/botN); var cy2=ty+th+CG+CS/2;
      chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    for(var ci=0;ci<sideN;ci++){
      var cy3=ty+(ci+0.5)*(th/sideN);
      chairs+='<circle cx="'+(tx-CG-CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
      chairs+='<circle cx="'+(tx+tw+CG+CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    chairs+='<rect x="'+tx.toFixed(1)+'" y="'+ty.toFixed(1)+'" width="'+tw.toFixed(1)+'" height="'+th.toFixed(1)+'" fill="'+tableFill+'"/>';
  }
  return '<svg viewBox="0 0 '+svgW.toFixed(0)+' '+svgH.toFixed(0)+'" width="'+svgW.toFixed(0)+'" height="'+svgH.toFixed(0)+'" style="display:block;overflow:visible">'+chairs+'<text x="'+(svgW/2).toFixed(1)+'" y="'+(svgH-1).toFixed(1)+'" text-anchor="middle" font-size="8.5" fill="#888" font-family="Jost,sans-serif">'+item.label+'</text></svg>';
}

function _addTableCatalogue(){
  return [
    {key:'round-0.8',cat:'round',label:'0.8m',wM:0.8,hM:0.8,chairs:4},
    {key:'round-1.0',cat:'round',label:'1.0m',wM:1.0,hM:1.0,chairs:6},
    {key:'round-1.2',cat:'round',label:'1.2m',wM:1.2,hM:1.2,chairs:8},
    {key:'round-1.4',cat:'round',label:'1.4m',wM:1.4,hM:1.4,chairs:10},
    {key:'round-1.5',cat:'round',label:'1.5m',wM:1.5,hM:1.5,chairs:10},
    {key:'round-1.6',cat:'round',label:'1.6m',wM:1.6,hM:1.6,chairs:12},
    {key:'round-1.7',cat:'round',label:'1.7m',wM:1.7,hM:1.7,chairs:12},
    {key:'round-1.8',cat:'round',label:'1.8m',wM:1.8,hM:1.8,chairs:14},
    {key:'round-1.9',cat:'round',label:'1.9m',wM:1.9,hM:1.9,chairs:14},
    {key:'round-2.0',cat:'round',label:'2.0m',wM:2.0,hM:2.0,chairs:16},
    {key:'rect-2x1.2',cat:'rect',label:'2ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:2.0,hM:1.2,chairs:10},
    {key:'rect-2.4x1.2',cat:'rect',label:'2.4ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:2.4,hM:1.2,chairs:12},
    {key:'rect-2.6x1.2',cat:'rect',label:'2.6ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:2.6,hM:1.2,chairs:12},
    {key:'rect-2.8x1.2',cat:'rect',label:'2.8ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:2.8,hM:1.2,chairs:14},
    {key:'rect-3x1.2',cat:'rect',label:'3ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:3.0,hM:1.2,chairs:14},
    {key:'rect-3.2x1.2',cat:'rect',label:'3.2ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:3.2,hM:1.2,chairs:16},
    {key:'rect-3.4x1.2',cat:'rect',label:'3.4ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:3.4,hM:1.2,chairs:16},
    {key:'rect-3.6x1.2',cat:'rect',label:'3.6ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:3.6,hM:1.2,chairs:18},
    {key:'rect-3.8x1.2',cat:'rect',label:'3.8ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:3.8,hM:1.2,chairs:18},
    {key:'rect-4x1.2',cat:'rect',label:'4ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â1.2m',wM:4.0,hM:1.2,chairs:20},
  ];
}

function _addTableToggle(key){
  var scrollEl=document.getElementById('add-table-scroll');
  var scrollY=scrollEl?scrollEl.scrollTop:0;
  var catalogue=_addTableCatalogue();
  var cat=catalogue.find(function(c){return c.key===key;});
  if(_addTableSelection[key]){
    delete _addTableSelection[key];
  } else {
    _addTableSelection[key]={n:1,chairs:cat?cat.chairs:8};
  }
  _renderAddTableModalBody();
  requestAnimationFrame(function(){var el=document.getElementById('add-table-scroll');if(el)el.scrollTop=scrollY;});
}

function _renderAddTableModalBody(){
  var isES=LANG==='es';
  var catalogue=_addTableCatalogue();
  var totalT=0; var totalC=0;
  Object.keys(_addTableSelection).forEach(function(k){
    var e=_addTableSelection[k]; if(!e||!e.n) return;
    var cat=catalogue.find(function(c){return c.key===k;});
    if(cat){totalT+=e.n; totalC+=e.n*cat.chairs;}
  });
  function catSection(catKey,titleEN,titleES){
    var items=catalogue.filter(function(c){return c.cat===catKey;});
    return '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">'+(isES?titleES:titleEN)+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
      +items.map(function(item){
        var sel=_addTableSelection[item.key]&&_addTableSelection[item.key].n>0;
        var cnt=(_addTableSelection[item.key]||{}).n||0;
        return '<div onclick="_addTableToggle(\''+item.key+'\')" style="cursor:pointer;padding:8px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s;position:relative">'
          +_addTableDrawSVG(item,sel)
          +'<div style="margin-top:4px;font-size:10px;color:var(--muted)">'+(isES?'Sillas:':'Chairs:')+' '+item.chairs+'</div>'
          +(sel
            ?'<div onclick="event.stopPropagation()" style="margin-top:4px"><input type="number" min="1" value="'+cnt+'" onchange="_addTableSelection[\''+item.key+'\'].n=parseInt(this.value)||1;_renderAddTableModalBody()" oninput="_addTableSelection[\''+item.key+'\'].n=parseInt(this.value)||1" style="width:52px;text-align:center;padding:3px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:700"><div style="font-size:9px;color:var(--muted);margin-top:1px">'+(isES?'cantidad':'qty')+'</div></div>'
            :'<div style="font-size:10px;color:var(--light);margin-top:4px">'+(isES?'clic':'click')+'</div>')
          +'</div>';
      }).join('')
      +'</div>';
  }
  var body='<div style="font-size:12px;color:var(--muted);margin-bottom:10px">'+(isES?'Haz clic en una mesa para seleccionarla, luego ingresa la cantidad.':'Click a table to select it, then enter quantity.')+'</div>'
    +catSection('round','Round Tables','Mesas Redondas')
    +catSection('rect','Rectangular Tables','Mesas Rectangulares')
    +'<div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;display:flex;gap:24px;font-size:13px;margin-top:12px;flex-wrap:wrap">'
    +'<span>? <strong>'+totalT+'</strong> '+(isES?'mesas':'tables')+'</span>'
    +'<span>?? <strong>'+totalC+'</strong> '+(isES?'sillas':'chairs')+'</span>'
    +'</div>';
  var el=document.getElementById('add-table-scroll');
  if(el) el.innerHTML=body;
}

function openAddTableModal(){
  var isES=LANG==='es';
  _addTableSelection={};
  openMo('<div class="mo-title">'+(isES?'Agregar Mesas':'Add Tables')+'</div>'
    +'<div id="add-table-scroll" style="overflow-y:auto;max-height:55vh"></div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="doAddTablesToLayout()">+ '+(isES?'Agregar al Layout':'Add to Layout')+'</button>'
    +'</div>');
  _renderAddTableModalBody();
}

function _getVisibleCanvasCenter(){
  var outer=document.getElementById('lcanvas-outer');
  if(!outer) return {x:400,y:400};
  var cx=(outer.scrollLeft+outer.clientWidth/2)/LState.zoom;
  var cy=(outer.scrollTop+outer.clientHeight/2)/LState.zoom;
  return {x:Math.round(cx),y:Math.round(cy)};
}

function _getCenteredFloorplanPlacement(w,h,scale){
  var center=_getVisibleCanvasCenter();
  var scaledW=Math.round(w*(scale||1));
  var scaledH=Math.round(h*(scale||1));
  return {
    x:Math.round(center.x-scaledW/2),
    y:Math.round(center.y-scaledH/2)
  };
}


function doAddTablesToLayout(){
  var isES=LANG==='es';
  var catalogue=_addTableCatalogue();
  var catalogueMap={};
  catalogue.forEach(function(c){catalogueMap[c.key]=c;});
  var keys=Object.keys(_addTableSelection);
  if(!keys.length) return toast(isES?'Selecciona al menos una mesa':'Select at least one table','e');
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:(typeof getPPM==='function'?getPPM():40);
  var SHAPES=typeof getLSHAPES!=='undefined'?getLSHAPES():{};
  var shapeMap={
    'rect':'rect-table','dend':'rect-table','oval':'rect-table','round':'round-table'
  };
  var spacing=Math.round(1.2*ppm);
  var p=proj();
  var existingTableCount=LState.items.filter(function(i){return ['round-table','rect-table','square-table'].includes(i.shape)||(LSHAPES_M[i.shape]&&LSHAPES_M[i.shape]._isCustomTable);}).length;
  var tableNum=existingTableCount;
  var newItems=[];
  // Place new tables centered on the visible part of the canvas
  var vc=_getVisibleCanvasCenter();
  var totalCells=0;
  keys.forEach(function(key){var sel=_addTableSelection[key];if(sel&&sel.n)totalCells+=sel.n;});
  var gridCols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(totalCells))));
  var gridRows=Math.ceil(totalCells/gridCols);
  var maxCellW=0; var maxCellH=0;
  keys.forEach(function(key){
    var sel=_addTableSelection[key];if(!sel||!sel.n)return;
    var cat=catalogueMap[key];if(!cat)return;
    var tw2=Math.round(cat.wM*ppm);var th2=Math.round(cat.hM*ppm);
    var pad2=cat.chairs?Math.round(0.4*ppm)+Math.round(0.05*ppm):0;
    var cw2=tw2+pad2*2+spacing;var ch2=th2+pad2*2+spacing;
    if(cw2>maxCellW)maxCellW=cw2;if(ch2>maxCellH)maxCellH=ch2;
  });
  var startX=Math.round(vc.x-gridCols*maxCellW/2);
  var startY=Math.round(vc.y-gridRows*maxCellH/2);
  var curX=startX; var curY=startY; var rowMaxH=0;
  keys.forEach(function(key){
    var sel=_addTableSelection[key]; if(!sel||!sel.n) return;
    var cat=catalogueMap[key]; if(!cat) return;
    var shape=shapeMap[cat.cat]||'round-table';
    var tw=Math.round(cat.wM*ppm); var th=Math.round(cat.hM*ppm);
    var defShape=SHAPES[shape]||{bg:'#f0ece0',bdClr:'#c9a84c'};
    var pad=sel.chairs||cat.chairs?Math.round(0.4*ppm)+Math.round(0.05*ppm):0;
    var cellW=tw+pad*2+spacing; var cellH=th+pad*2+spacing;
    for(var i=0;i<sel.n;i++){
      tableNum++;
      if(curX+cellW>4000){curX=startX;curY+=rowMaxH;rowMaxH=0;}
      newItems.push({
        id:'li'+Date.now()+Math.random().toString(36).slice(2,6),
        shape:shape, x:Math.round(curX+pad), y:Math.round(curY+pad),
        w:tw, h:th, bg:defShape.bg||'#f0ece0', bdClr:defShape.bdClr||'#c9a84c',
        radius:cat.cat==='round'?'50%':'0px',
        label:String(tableNum), chairs:cat.chairs,
        chairType:'default', centerpiece:'none', cost:0, rotation:0,
        _typeKey:key
      });
      curX+=cellW;
      if(cellH>rowMaxH) rowMaxH=cellH;
    }
  });
  if(!newItems.length) return toast(isES?'Selecciona al menos una mesa':'Select at least one table','e');
  newItems.forEach(function(ni){LState.items.push(ni);});
  p.layoutItems=LState.items; saveProj(p);
  LState.sel=newItems.map(function(ni){return ni.id;});
  lHistorySave();
  closeMo();
  renderLayout();
  toast(newItems.length+(isES?' mesa(s) agregada(s)':' table(s) added'),'s');
}

/* -- Add Event Element Modal -- */
function openAddEventElementModal(){
  var isES=LANG==='es';
  var elements=[
    {key:'dance-floor', icon:'??', labelEN:'Dance Floor',       labelES:'Pista de Baile',      shape:'dance-floor'},
    {key:'bar',         icon:'??', labelEN:'Shot Bar',           labelES:'Barra de Shots',      shape:'bar'},
    {key:'stage',       icon:'??', labelEN:'Stage',              labelES:'Escenario',           shape:'stage'},
    {key:'dj-booth',    icon:'??', labelEN:'DJ Booth',           labelES:'Cabina de DJ',        shape:'dj-booth'},
    {key:'platform',    icon:'???', labelEN:'Dinner Platform',    labelES:'Plataforma de Cena',  shape:'stage'},
    {key:'gift-table',  icon:'??', labelEN:'Gift Table',         labelES:'Mesa de Regalos',     shape:'gift-table'},
    {key:'photo-booth', icon:'??', labelEN:'Photo Booth',        labelES:'Photo Booth',         shape:'photo-booth'},
    {key:'custom',      icon:'??', labelEN:'Custom Element',     labelES:'Elemento Personalizado', shape:'custom'},
  ];
  var html='<div class="mo-title">'+(isES?'Agregar Elemento':'Add Event Element')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto">'
    +elements.map(function(el){
      if(el.key==='custom'){
        return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;background:var(--card)">'
          +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
          +'<span style="font-size:20px">'+el.icon+'</span>'
          +'<span style="font-weight:600;font-size:14px">'+(isES?el.labelES:el.labelEN)+'</span></div>'
          +'<div class="form-grid" style="gap:8px">'
          +'<div class="ig"><label>'+(isES?'Nombre':'Name')+'</label><input class="input" id="custom-elem-name" placeholder="'+(isES?'Nombre del elemento':'Element name')+'" value=""></div>'
          +'<div class="ig"><label>'+(isES?'Forma':'Shape')+'</label><select class="input" id="custom-elem-shape"><option value="rect">'+(isES?'Rectangular':'Rectangular')+'</option><option value="round">'+(isES?'Redondo':'Round')+'</option></select></div>'
          +'<div class="ig"><label>'+(isES?'Ancho (m)':'Width (m)')+'</label><input class="input" id="custom-elem-w" type="number" step="0.1" min="0.5" value="2.0"></div>'
          +'<div class="ig"><label>'+(isES?'Alto (m)':'Height (m)')+'</label><input class="input" id="custom-elem-h" type="number" step="0.1" min="0.5" value="2.0"></div>'
          +'</div>'
          +'<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="doAddCustomElement()">+ '+(isES?'Agregar':'Add')+'</button>'
          +'</div>';
      }
      return '<button class="btn btn-ghost" style="width:100%;justify-content:flex-start;padding:12px 14px;font-size:14px;gap:10px;border:1.5px solid var(--border);border-radius:10px" onclick="doAddEventElement(\''+el.key+'\')">'
        +'<span style="font-size:20px">'+el.icon+'</span> '+(isES?el.labelES:el.labelEN)
        +'</button>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cerrar':'Close')+'</button></div>';
  openMo(html);
}

function doAddEventElement(key){
  var isES=LANG==='es';
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:(typeof getPPM==='function'?getPPM():40);
  var SHAPES=typeof getLSHAPES!=='undefined'?getLSHAPES():{};
  var labelMap={
    'dance-floor':{en:'Dance Floor',es:'Pista de Baile',shape:'dance-floor'},
    'bar':{en:'Shot Bar',es:'Barra de Shots',shape:'bar'},
    'stage':{en:'Stage',es:'Escenario',shape:'stage'},
    'dj-booth':{en:'DJ Booth',es:'Cabina de DJ',shape:'dj-booth'},
    'platform':{en:'Dinner Platform',es:'Plataforma de Cena',shape:'stage'},
    'gift-table':{en:'Gift Table',es:'Mesa de Regalos',shape:'gift-table'},
    'photo-booth':{en:'Photo Booth',es:'Photo Booth',shape:'photo-booth'},
  };
  var info=labelMap[key]; if(!info) return;
  var def=SHAPES[info.shape]||{w:Math.round(3*ppm),h:Math.round(2*ppm),bg:'#ddd0f0',bdClr:'#5a3d8a'};
  var label=isES?info.es:info.en;
  // Place in the center of the visible canvas area
  var vc=_getVisibleCanvasCenter();
  var placeX=Math.round(vc.x-def.w/2);
  var placeY=Math.round(vc.y-def.h/2);
  var newItem={
    id:'li'+Date.now()+Math.random().toString(36).slice(2,6),
    shape:info.shape, x:placeX, y:placeY,
    w:def.w, h:def.h, bg:def.bg, bdClr:def.bdClr,
    radius:def.radius||'0px', label:label,
    chairs:0, chairType:'default', centerpiece:'none', cost:0, rotation:0
  };
  var p=proj();
  LState.items.push(newItem);
  p.layoutItems=LState.items; saveProj(p);
  LState.sel=[newItem.id];
  lHistorySave();
  closeMo();
  renderLayout();
  toast(label+(isES?' agregado':' added'),'s');
}

function doAddCustomElement(){
  var isES=LANG==='es';
  var name=document.getElementById('custom-elem-name').value.trim();
  if(!name) return toast(isES?'Ingresa un nombre':'Enter a name','e');
  var shapeType=document.getElementById('custom-elem-shape').value;
  var wM=parseFloat(document.getElementById('custom-elem-w').value)||2;
  var hM=parseFloat(document.getElementById('custom-elem-h').value)||2;
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:(typeof getPPM==='function'?getPPM():40);
  var tw=Math.round(wM*ppm); var th=Math.round(hM*ppm);
  var vc=_getVisibleCanvasCenter();
  var placeX=Math.round(vc.x-tw/2);
  var placeY=Math.round(vc.y-th/2);
  var newItem={
    id:'li'+Date.now()+Math.random().toString(36).slice(2,6),
    shape:'custom-elem', x:placeX, y:placeY,
    w:tw, h:th, bg:'#e0e0e0', bdClr:'#888888',
    radius:shapeType==='round'?'50%':'0px', label:name,
    chairs:0, chairType:'default', centerpiece:'none', cost:0, rotation:0
  };
  var p=proj();
  LState.items.push(newItem);
  p.layoutItems=LState.items; saveProj(p);
  LState.sel=[newItem.id];
  lHistorySave();
  closeMo();
  renderLayout();
  toast(name+(isES?' agregado':' added'),'s');
}

function attachLItemEvents(){
  // Reset pointerEvents in case a previous drag left it stuck
  var cv=document.getElementById('lcanvas');
  if(cv) cv.style.pointerEvents='';
  // Reset any stale drag state
  _lDragItem=null;_panning=false;_marquee=false;_fpDragging=false;
  document.querySelectorAll('.litem').forEach(el=>{
    el.addEventListener('mousedown',lItemDown,{passive:false});
  });
  window.removeEventListener('mousemove',lCanvasMove);
  window.removeEventListener('mouseup',lCanvasUp);
  window.addEventListener('mousemove',lCanvasMove);
  window.addEventListener('mouseup',lCanvasUp);
}

let _lDragItem=null,_lDragOffX=0,_lDragOffY=0,_lDidDrag=false;
let _lDragStartAnchorX=0,_lDragStartAnchorY=0,_lDragAxisLock=null;
let _lDragOffsets={};
let _panning=false,_panStart={x:0,y:0},_panOrigin={x:0,y:0};
let _spaceDown=false;
let _marquee=false,_marqueeStart={x:0,y:0};
let _fpDragging=false,_fpDragOffX=0,_fpDragOffY=0;
let _measuring=false,_measurePoints=[],_measureLines=[];
let _measurePreviewMouse=null;
if(!window.LClipboard)window.LClipboard=[];

function getConstrainedMeasurePoint(startPt, endPt, constrainAxis){
  if(!constrainAxis||!startPt||!endPt) return endPt;
  const dx=Math.abs(endPt.x-startPt.x);
  const dy=Math.abs(endPt.y-startPt.y);
  return dx>=dy
    ? {x:endPt.x,y:startPt.y}
    : {x:startPt.x,y:endPt.y};
}

function updateMeasurePreview(rawPoint, constrainAxis){
  if(!LState.measureMode||_measurePoints.length!==1||!rawPoint) return;
  const pt=_measurePoints[0];
  const nextPt=getConstrainedMeasurePoint(pt,rawPoint,constrainAxis);
  let ov=document.getElementById('measure-overlay');
  if(!ov) return;
  const previewLine=ov.querySelector('#measure-preview');
  if(previewLine){
    previewLine.setAttribute('x2',nextPt.x);
    previewLine.setAttribute('y2',nextPt.y);
  }
  const previewLabel=ov.querySelector('#measure-preview-label');
  if(previewLabel){
    previewLabel.setAttribute('x',(pt.x+nextPt.x)/2);
    previewLabel.setAttribute('y',(pt.y+nextPt.y)/2-10);
    const _ppm=getFloorplanPPM()||getPPM();
    const _rd=Math.hypot(nextPt.x-pt.x,nextPt.y-pt.y)/_ppm;
    previewLabel.textContent=_rd.toFixed(2)+'m';
  }
}

var LHistory=[], LHistoryPos=-1, LHistorySaving=true;
function lHistorySave(){
  if(!LHistorySaving)return;
  var snapshot=JSON.stringify(LState.items);
  if(LHistoryPos<LHistory.length-1) LHistory=LHistory.slice(0,LHistoryPos+1);
  if(LHistory.length>0&&LHistory[LHistoryPos]===snapshot)return;
  LHistory.push(snapshot);
  if(LHistory.length>200){ LHistory.shift(); LHistoryPos--; }
  LHistoryPos=LHistory.length-1;
}
function lUndo(){
  if(LHistoryPos<=0){toast(LANG==='es'?'Nada que deshacer':'Nothing to undo','e');return;}
  LHistoryPos--;
  LHistorySaving=false;
  LState.items=JSON.parse(LHistory[LHistoryPos]);
  LState.sel=[];
  var _savedFP=LState.floorplan;
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.floorplan=_savedFP;
  renderLayoutCanvas();LHistorySaving=true;toast(LANG==='es'?'Deshacer':'Undo','s');
}
function lRedo(){
  if(LHistoryPos>=LHistory.length-1){toast(LANG==='es'?'Nada que rehacer':'Nothing to redo','e');return;}
  LHistoryPos++;
  LHistorySaving=false;
  LState.items=JSON.parse(LHistory[LHistoryPos]);
  LState.sel=[];
  var _savedFP=LState.floorplan;
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.floorplan=_savedFP;
  renderLayoutCanvas();LHistorySaving=true;toast(LANG==='es'?'Rehacer':'Redo','s');
}
function getLayoutInstanceKey(item){
  if(!item) return '';
  if(item._instanceKey) return 'inst:'+item._instanceKey;
  if(item._typeKey) return 'type:'+item._typeKey;
  return ['sig', item.shape||'', item.w||0, item.h||0].join('|');
}
function isSameLayoutInstance(a,b){
  return !!(a&&b) && getLayoutInstanceKey(a)===getLayoutInstanceKey(b);
}
function detachLayoutItemInstance(item){
  if(!item) return;
  item._instanceKey='inst-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
}
function makeLayoutDuplicate(id,mode){
  var src=LState.items.find(function(i){return i.id===id;});
  if(!src)return;
  window.LClipboard=[JSON.parse(JSON.stringify(src))];
  lPaste(mode==='instance'?'instance':'copy');
}
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  var moOpen=document.getElementById('mo')&&document.getElementById('mo').classList.contains('open');

  if(e.code==='Space'&&!moOpen){
    _spaceDown=true;
    var co=document.getElementById('lcanvas-outer');
    if(co)co.style.cursor='grab';
    return;
  }
  if(e.code==='Escape'){
    if(moOpen){closeMo();return;}
    if(typeof LState!=='undefined'){
      if(LState.measureMode){LState.measureMode=false;_measurePoints=[];_measurePreviewMouse=null;renderLayout();return;}
      if(LState.scaleMode){cancelScaleMode();return;}
      if(LState.addMode){LState.addMode=null;renderLayout();return;}
      LState.sel=[];updateSelUI();
    }
    return;
  }
  if(e.key==='Shift'&&_measurePreviewMouse){
    updateMeasurePreview(_measurePreviewMouse,true);
  }
  if(typeof CTAB==='undefined'||CTAB!=='layout'||moOpen)return;

  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.code==='KeyZ'){
    e.preventDefault();lUndo();return;
  }
  if(((e.ctrlKey||e.metaKey)&&e.code==='KeyY')||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='KeyZ')){
    e.preventDefault();lRedo();return;
  }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyA'){
    e.preventDefault();selectAll();return;
  }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyC'&&LState.sel.length){
    e.preventDefault();
    window.LClipboard=LState.items.filter(i=>LState.sel.includes(i.id)).map(i=>JSON.parse(JSON.stringify(i)));
    toast(window.LClipboard.length+' item'+(window.LClipboard.length>1?'s':'')+' copied','s');
    return;
  }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyV'&&window.LClipboard&&window.LClipboard.length){
    e.preventDefault();lPaste();return;
  }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyD'&&LState.sel.length){
    e.preventDefault();
    window.LClipboard=LState.items.filter(i=>LState.sel.includes(i.id)).map(i=>JSON.parse(JSON.stringify(i)));
    lPaste('instance');return;
  }
  if((e.code==='Delete'||e.code==='Backspace')&&LState.sel.length){
    e.preventDefault();delSelected();return;
  }
});

document.addEventListener('keyup',e=>{
  if(e.code==='Space'){
    _spaceDown=false;
    const co=document.getElementById('lcanvas-outer');
    if(co)co.style.cursor=LState.addMode?'crosshair':'default';
  }
  if(e.key==='Shift'&&_measurePreviewMouse){
    updateMeasurePreview(_measurePreviewMouse,false);
  }
});
function lPaste(mode){
  if(!window.LClipboard||!window.LClipboard.length)return;
  const newIds=[];
  const offset=20;
  window.LClipboard.forEach(src=>{
    const isTable=['round-table','rect-table','square-table'].includes(src.shape)||(LSHAPES_M[src.shape]&&LSHAPES_M[src.shape]._isCustomTable);
    let newLabel=src.label;
    if(isTable){
      const nums=LState.items.map(i=>parseInt(i.label,10)).filter(n=>!isNaN(n));
      newLabel=String(nums.length?Math.max(...nums)+1:1);
    } else {
      const base=src.label.replace(/\s*\(copy\s*\d*\)\s*$/,'').trim();
      const c=LState.items.filter(i=>i.shape===src.shape&&i.label.startsWith(base)).length;
      newLabel=c?base+' (copy '+c+')':base+' (copy)';
    }
    const newItem=Object.assign({},src,{id:'li'+Date.now()+Math.random().toString(36).slice(2,6),x:src.x+offset,y:src.y+offset,label:newLabel});
    if(mode!=='instance') detachLayoutItemInstance(newItem);
    LState.items.push(newItem);
    newIds.push(newItem.id);
  });
  window.LClipboard=window.LClipboard.map(i=>({...i,x:i.x+offset,y:i.y+offset}));
  const p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.sel=newIds;
  lHistorySave();
  renderLayout();
}

function lItemDown(e){
  if(e.button!==0)return;
  const id=e.currentTarget&&e.currentTarget.dataset?e.currentTarget.dataset.id:null;
  if(!id)return;
  const canvas=document.getElementById('lcanvas');
  const cr=canvas.getBoundingClientRect();
  const mouseX=(e.clientX-cr.left)/LState.zoom;
  const mouseY=(e.clientY-cr.top)/LState.zoom;
  if(!e.shiftKey&&!e.ctrlKey&&!e.metaKey){
    if(!LState.sel.includes(id)) LState.sel=[id];
  } else if(e.shiftKey){
    if(!LState.sel.includes(id)) LState.sel.push(id);
  }
  updateSelUI();
  _lDragItem=id;
  const anchor=LState.items.find(i=>i.id===id);
  if(!anchor)return;
  _lDragStartAnchorX=anchor.x;
  _lDragStartAnchorY=anchor.y;
  _lDragAxisLock=null;
  _lDragOffX=mouseX-anchor.x;
  _lDragOffY=mouseY-anchor.y;
  _lDragOffsets={};
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    if(it)_lDragOffsets[sid]={dx:it.x-anchor.x,dy:it.y-anchor.y};
  });
  _lDidDrag=false;
  document.getElementById('lcanvas').style.pointerEvents='none';
  e.stopPropagation();
  e.preventDefault();
}

function lCanvasDown(e){
  if(LState.measureMode&&e.button===0){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    const rawPoint={
      x:(e.clientX-cr.left)/LState.zoom,
      y:(e.clientY-cr.top)/LState.zoom
    };
    if(_measurePoints.length===0){
      _measurePoints=[rawPoint];
      _measurePreviewMouse=rawPoint;
    } else {
      const pt1=_measurePoints[_measurePoints.length-1];
      const nextPt=getConstrainedMeasurePoint(pt1,rawPoint,e.shiftKey);
      const x=nextPt.x;
      const y=nextPt.y;
      const pxDist=Math.hypot(x-pt1.x,y-pt1.y);
      const fpPPM=getFloorplanPPM();
      const usePPM=fpPPM>0?fpPPM:getPPM();
      const realDist=pxDist/usePPM;
      _measureLines.push({x1:pt1.x,y1:pt1.y,x2:x,y2:y,px:Math.round(pxDist),m:realDist,calibrated:true});
      _measurePoints=[{x,y}];
      _measurePreviewMouse={x,y};
    }
    renderMeasureOverlay();
    e.stopPropagation();e.preventDefault();return;
  }
  if(LState.scaleMode&&e.button===0){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    const x=(e.clientX-cr.left)/LState.zoom;
    const y=(e.clientY-cr.top)/LState.zoom;
    LState.scalePoints.push({x,y});
    if(LState.scalePoints.length>=2) renderLayoutUI();
    else renderLayoutUI();
    e.stopPropagation();e.preventDefault();return;
  }
  if(LState.floorplan.img&&!LState.floorplan.locked&&e.button===0){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    const cx=(e.clientX-cr.left)/LState.zoom;
    const cy=(e.clientY-cr.top)/LState.zoom;
    const fp=LState.floorplan;
    const fpW=fp.w*fp.scale, fpH=fp.h*fp.scale;
    if(cx>=fp.x&&cx<=fp.x+fpW&&cy>=fp.y&&cy<=fp.y+fpH){
      const itemEls=document.elementsFromPoint(e.clientX,e.clientY);
      const onItem=itemEls.some(el=>el.classList&&el.classList.contains('litem'));
      if(!onItem){
        _fpDragging=true;
        _fpDragOffX=cx-fp.x;
        _fpDragOffY=cy-fp.y;
        e.stopPropagation();e.preventDefault();return;
      }
    }
  }
  if(e.button===1||_spaceDown){
    e.preventDefault();
    _panning=true;_panStart={x:e.clientX,y:e.clientY};
    const outer=document.getElementById('lcanvas-outer');
    _panOrigin={x:outer.scrollLeft,y:outer.scrollTop};
    outer.style.cursor='grabbing';
    return;
  }
  if(e.button!==0)return;

  if(LState.addMode){
    const canvas=document.getElementById('lcanvas');
    const cr=canvas.getBoundingClientRect();
    const rawX=(e.clientX-cr.left)/LState.zoom;
    const rawY=(e.clientY-cr.top)/LState.zoom;
    LSHAPES=getLSHAPES();
    const def=LSHAPES[LState.addMode]||LSHAPES['round-table'];
    const snap=n=>LState.useSnap?Math.round(n/LState.snapGrid)*LState.snapGrid:Math.round(n);
    const chairs=def.chairs||0;
    const _tempMinSide=Math.min(def.w,def.h);
    const _tempChairPx=Math.max(8,Math.round(_tempMinSide*0.22));
    const _tempGapPx=Math.max(1,Math.round(_tempMinSide*0.04));
    const pad=chairs?_tempChairPx+_tempGapPx:0;
    const p=proj();
    const isTable=['round-table','rect-table','square-table'].includes(LState.addMode)||!!(LSHAPES_M[LState.addMode]&&LSHAPES_M[LState.addMode]._isCustomTable);
    const tableCount=LState.items.filter(i=>['round-table','rect-table','square-table'].includes(i.shape)||(LSHAPES_M[i.shape]&&LSHAPES_M[i.shape]._isCustomTable)).length+1;
    const newLabel=isTable?String(tableCount):def.label;
    const nonTableShapes=['dance-floor','bar','stage','dj-booth','gift-table','photo-booth'];
    const isNonTable=nonTableShapes.includes(LState.addMode)||!!(LSHAPES_M[LState.addMode]&&LSHAPES_M[LState.addMode]._isCustomElem);
    let placeX=snap(rawX-def.w/2-pad);
    if(isNonTable){
      const df=LState.items.find(i=>i.shape==='dance-floor');
      if(df){
        placeX=snap(df.x+df.w/2-def.w/2);
      }
    }
    const newItem={
      id:'li'+Date.now(),shape:LState.addMode,
      x:placeX,y:snap(rawY-def.h/2-pad),
      w:def.w,h:def.h,bg:def.bg,bdClr:def.bdClr,
      radius:def.radius,label:newLabel,chairs,
      chairType:'default',centerpiece:'none',cost:0,rotation:0,
    };
    LState.items.push(newItem);p.layoutItems=LState.items;saveProj(p);
    LState.sel=[newItem.id];LState.addMode=null;
    lHistorySave();
    renderLayout();
    return;
  }

  if(!e.target.closest('.litem')){
    if(!e.shiftKey&&!e.ctrlKey&&!e.metaKey) LState.sel=[];
    const outer=document.getElementById('lcanvas-outer');
    const outerRect=outer.getBoundingClientRect();
    const canvas=document.getElementById('lcanvas');
    const cr=canvas.getBoundingClientRect();
    _marquee=true;
    _marqueeStart={
      x:(e.clientX-cr.left)/LState.zoom,
      y:(e.clientY-cr.top)/LState.zoom
    };
    let mq=document.getElementById('lmarquee');
    if(!mq){
      mq=document.createElement('div');mq.id='lmarquee';
      mq.style.cssText='position:absolute;border:1.5px dashed var(--gold);background:rgba(201,168,76,.08);pointer-events:none;z-index:100;display:none';
      canvas.appendChild(mq);
    }
    mq.style.display='none';
    updateSelUI();
  }
}

function lCanvasLeave(e){
  var cv=document.getElementById('lcanvas');
  if(cv&&cv.style.pointerEvents==='none') cv.style.pointerEvents='';
}

function lCanvasMove(e){
  if(_panning){
    const outer=document.getElementById('lcanvas-outer');
    outer.scrollLeft=_panOrigin.x-(e.clientX-_panStart.x);
    outer.scrollTop=_panOrigin.y-(e.clientY-_panStart.y);
    return;
  }
  if(_fpDragging){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    const cx=(e.clientX-cr.left)/LState.zoom;
    const cy=(e.clientY-cr.top)/LState.zoom;
    LState.floorplan.x=Math.round(cx-_fpDragOffX);
    LState.floorplan.y=Math.round(cy-_fpDragOffY);
    const fpImg=document.getElementById('fp-img');
    if(fpImg){fpImg.style.left=LState.floorplan.x+'px';fpImg.style.top=LState.floorplan.y+'px';}
    return;
  }
  if(LState.measureMode&&_measurePoints.length===1){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    _measurePreviewMouse={
      x:(e.clientX-cr.left)/LState.zoom,
      y:(e.clientY-cr.top)/LState.zoom
    };
    updateMeasurePreview(_measurePreviewMouse,e.shiftKey);
  }

  if(_marquee){
    const canvas=document.getElementById('lcanvas');
    const cr=canvas.getBoundingClientRect();
    const cx=(e.clientX-cr.left)/LState.zoom;
    const cy=(e.clientY-cr.top)/LState.zoom;
    const rx=Math.min(cx,_marqueeStart.x);
    const ry=Math.min(cy,_marqueeStart.y);
    const rw=Math.abs(cx-_marqueeStart.x);
    const rh=Math.abs(cy-_marqueeStart.y);
    const mq=document.getElementById('lmarquee');
    if(mq){
      mq.style.display='block';
      mq.style.left=rx+'px';mq.style.top=ry+'px';
      mq.style.width=rw+'px';mq.style.height=rh+'px';
    }
    var _mqHits=LState.items.filter(item=>{
      const pad=(item.chairs||0)?30:0;
      const ix=item.x-pad,iy=item.y-pad;
      const iw=item.w+pad*2,ih=item.h+pad*2;
      return ix<rx+rw&&ix+iw>rx&&iy<ry+rh&&iy+ih>ry;
    }).map(i=>i.id);
    if(e.ctrlKey||e.metaKey){
      LState.sel=LState.sel.filter(id=>_mqHits.indexOf(id)<0);
    } else if(e.shiftKey){
      _mqHits.forEach(id=>{ if(LState.sel.indexOf(id)<0) LState.sel.push(id); });
    } else {
      LState.sel=_mqHits;
    }
    updateSelUI();
    return;
  }

  if(_lDragItem===null)return;
  const canvas=document.getElementById('lcanvas');
  const cr=canvas.getBoundingClientRect();
  const snap=n=>LState.useSnap?Math.round(n/LState.snapGrid)*LState.snapGrid:Math.round(n);
  let anchorX=snap((e.clientX-cr.left)/LState.zoom-_lDragOffX);
  let anchorY=snap((e.clientY-cr.top)/LState.zoom-_lDragOffY);
  const anchor=LState.items.find(i=>i.id===_lDragItem);
  if(!anchor)return;

  if(e.shiftKey){
    if(!_lDragAxisLock){
      const dx=anchorX-_lDragStartAnchorX;
      const dy=anchorY-_lDragStartAnchorY;
      _lDragAxisLock=Math.abs(dx)>=Math.abs(dy)?'x':'y';
    }
    if(_lDragAxisLock==='x') anchorY=_lDragStartAnchorY;
    else anchorX=_lDragStartAnchorX;
  } else {
    _lDragAxisLock=null;
  }

  const oldAx=anchor.x,oldAy=anchor.y;
  anchor.x=anchorX;anchor.y=anchorY;
  const ddx=anchor.x-oldAx,ddy=anchor.y-oldAy;
  if(ddx===0&&ddy===0&&!_lDidDrag)return;
  _lDidDrag=true;

  LState.sel.forEach(sid=>{
    if(sid===_lDragItem)return;
    const it=LState.items.find(i=>i.id===sid);
    if(it){it.x+=ddx;it.y+=ddy;}
  });

  document.querySelectorAll('.litem').forEach(el=>{
    const id=el.getAttribute('data-id');
    const it=LState.items.find(i=>i.id===id);
    if(it){el.style.left=it.x+'px';el.style.top=it.y+'px';}
  });
}
function lCanvasUp(e){
  var cv=document.getElementById('lcanvas');
  if(cv&&cv.style.pointerEvents==='none') cv.style.pointerEvents='';
  if(_panning){
    _panning=false;
    const co=document.getElementById('lcanvas-outer');
    if(co)co.style.cursor=_spaceDown?'grab':'default';
    return;
  }
  if(_fpDragging){
    _fpDragging=false;
    saveFloorplan();
    renderLayoutUI();
    return;
  }
  if(_marquee){
    _marquee=false;
    const mq=document.getElementById('lmarquee');
    if(mq)mq.style.display='none';
    updateSelUI();
    return;
  }
  if(_lDragItem!==null){
    if(_lDidDrag){
      saveLayoutData();
      lHistorySave();
    }
    _lDragItem=null;_lDragOffsets={};_lDragAxisLock=null;
    if(_lDidDrag)updateSelUI();
  }
}

function updateSelUI(){
  document.querySelectorAll('.litem').forEach(el=>{
    el.classList.toggle('sel',LState.sel.includes(el.dataset.id));
  });
  const panel=document.getElementById('lsb-props');
  if(panel){panel.style.display=LState.sel.length===1?'block':'none';}
  if(LState.sel.length===1){renderLPropsPanel();}
  document.querySelectorAll('.litem-list-row').forEach(row=>{
    const id=row.dataset.id;
    if(id)row.classList.toggle('sel-row',LState.sel.includes(id));
  });
  const delBtn=document.querySelector('[onclick="delSelected()"]');
  if(delBtn){
    delBtn.textContent=`Delete Selected (${LState.sel.length})`;
    delBtn.style.display=LState.sel.length?'':'none';
  }
  updateFontSizeUI();
}

function lSelectOnly(e,id){
  if(!e.shiftKey)LState.sel=[id];
  else{
    if(LState.sel.includes(id))LState.sel=LState.sel.filter(s=>s!==id);
    else LState.sel.push(id);
  }
  updateSelUI();
}
function selectAll(){LState.sel=LState.items.map(i=>i.id);updateSelUI();}
function delLItem(id){
  LState.items=LState.items.filter(i=>i.id!==id);LState.sel=LState.sel.filter(s=>s!==id);
  const p=proj();p.layoutItems=LState.items;saveProj(p);renderLayout();
}
function delSelected(){
  if(!LState.sel.length)return;
  LState.items=LState.items.filter(i=>!LState.sel.includes(i.id));LState.sel=[];
  const p=proj();p.layoutItems=LState.items;saveProj(p);renderLayout();
  lHistorySave();toast('Deleted','s');
}
function clearLayoutConfirm(){
  if(!confirm('Clear all layout items?'))return;
  LState.items=[];LState.sel=[];
  const p=proj();p.layoutItems=[];saveProj(p);renderLayout();
}

function openChairEditor(){
  var rows=Object.entries(CHAIR_TYPES).map(([k,v])=>{
    var imgSrc = CHAIR_IMAGES[k] || '';
    var thumb = imgSrc
      ? '<img src="'+imgSrc+'" onclick="window.SCI[this.dataset.ci]()" data-ci="'+k+'" class="chair-zoom" style="width:44px;height:44px;object-fit:contain;border-radius:6px;border:1px solid #e0d4b0;background:#faf8f2;cursor:pointer;display:block" title="Click to enlarge">'
      : '<div style="width:44px;height:44px;border-radius:6px;background:'+(v.fill.startsWith('rgba')?'#e8e8e8':v.fill)+';border:1px solid #ddd"></div>';
    return '<div style="display:grid;grid-template-columns:50px 1fr 36px 80px;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">'+
      '<div>'+thumb+'</div>'+
      '<input class="input" style="font-size:11px;padding:4px 8px" id="ch-label-'+k+'" value="'+v.label+'" placeholder="Name">'+
      '<input class="input" type="color" style="width:34px;height:28px;padding:2px" id="ch-fill-'+k+'" value="'+(v.fill.startsWith('rgba')?'#e8e8e8':v.fill)+'" title="Fill color">'+
      '<input class="input" type="number" style="font-size:11px;padding:4px 6px" id="ch-cost-'+k+'" value="'+(v.costPerChair||0)+'" placeholder="0">'+
      '</div>';
  }).join('');
  openMo('<div class="mo-title">'+t('edit_chairs')+'</div>'+
    '<div style="display:grid;grid-template-columns:50px 1fr 36px 80px;gap:8px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:4px">'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+t('col_photo')+'</span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+t('col_name')+'</span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+t('col_color')+'</span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+t('col_price')+' ($)</span>'+
    '</div>'+
    '<div style="max-height:60vh;overflow-y:auto">'+rows+
    '<div style="padding:10px 0;border-top:1px solid var(--border);margin-top:8px">'+
      '<div style="font-weight:700;font-size:11px;color:var(--gold-h);margin-bottom:8px">'+t('add_new_chair')+'</div>'+
      '<div style="display:flex;gap:6px">'+
        '<input class="input" id="ch-new-label" placeholder="Name" style="flex:2;font-size:11px">'+
        '<input class="input" type="color" id="ch-new-fill" value="#e8d8c8" style="width:34px;height:34px;padding:2px;flex-shrink:0">'+
        '<input class="input" type="number" id="ch-new-cost" placeholder="$/silla" value="0" style="width:64px;font-size:11px">'+
        '<button class="btn btn-ghost btn-sm" onclick="addNewChairType()" style="white-space:nowrap">'+t('add')+'</button>'+
      '</div>'+
    '</div>'+
    '</div>'+
    '<div class="mo-foot">'+
      '<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'+
      '<button class="btn btn-primary" onclick="saveChairEditor()">'+t('save')+'</button>'+
    '</div>');
}

function addNewChairType(){
  var lbl=(document.getElementById('ch-new-label')||{value:''}).value.trim();
  if(!lbl)return toast('Enter a name','e');
  var fill=(document.getElementById('ch-new-fill')||{value:'#e8d8c8'}).value;
  var cost=+(document.getElementById('ch-new-cost')||{value:0}).value||0;
  var key='custom-'+Date.now();
  CHAIR_TYPES[key]={label:lbl,fill:fill,stroke:fill,costPerChair:cost};
  var p=proj();if(!p.chairTypes)p.chairTypes={};
  p.chairTypes[key]=CHAIR_TYPES[key];saveProj(p);
  closeMo();openChairEditor();toast('Chair style added','s');
}

function saveChairEditor(){
  Object.keys(CHAIR_TYPES).forEach(k=>{
    var lbl=document.getElementById('ch-label-'+k);
    var fill=document.getElementById('ch-fill-'+k);
    var cost=document.getElementById('ch-cost-'+k);
    if(lbl) CHAIR_TYPES[k].label=lbl.value||CHAIR_TYPES[k].label;
    if(fill) CHAIR_TYPES[k].fill=fill.value;
    if(cost) CHAIR_TYPES[k].costPerChair=+cost.value||0;
  });
  var p=proj();p.chairTypes=JSON.parse(JSON.stringify(CHAIR_TYPES));saveProj(p);
  closeMo();renderLayout();toast('Chair styles saved','s');
}

function openCenterpieceEditor(){
  var rows=Object.entries(CENTERPIECE_TYPES).filter(([k])=>k!=='none').map(([k,v])=>`
    <div style="display:grid;grid-template-columns:1fr 36px 80px;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
      <input class="input" style="font-size:11px;padding:4px 8px" id="cp-label-${k}" value="${v.label}" placeholder="Name">
      <input class="input" type="color" style="width:34px;height:28px;padding:2px" id="cp-color-${k}" value="${v.color||'#ff8080'}" title="Color">
      <input class="input" type="number" style="font-size:11px;padding:4px 6px" id="cp-cost-${k}" value="${v.cost||0}" placeholder="0">
    </div>`).join('');
  openMo(`<div class="mo-title">${t('edit_centerpieces')}</div>
    <div style="display:grid;grid-template-columns:1fr 36px 80px;gap:6px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:4px">
      <span class="s-lbl">${t('col_name')}</span>
      <span class="s-lbl">${t('col_color')}</span>
      <span class="s-lbl">${t('col_price')} ($)</span>
    </div>
    <div style="max-height:60vh;overflow-y:auto">${rows}
    <div style="padding:10px 0;border-top:1px solid var(--border);margin-top:8px">
      <div style="font-weight:700;font-size:11px;color:var(--gold-h);margin-bottom:8px">${t('add_new_centerpiece')}</div>
      <div style="display:flex;gap:6px">
        <input class="input" id="cp-new-label" placeholder="Name" style="flex:2;font-size:11px">
        <input class="input" type="color" id="cp-new-color" value="#e05080" style="width:34px;height:34px;padding:2px;flex-shrink:0">
        <input class="input" type="number" id="cp-new-cost" placeholder="$/pc" value="0" style="width:64px;font-size:11px">
        <button class="btn btn-ghost btn-sm" onclick="addNewCenterpieceType()" style="white-space:nowrap">${t('add')}</button>
      </div>
    </div>
    </div>
    <div class="mo-foot">
      <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveCenterpieceEditor()">${t('save')}</button>
    </div>`);
}

function addNewCenterpieceType(){
  var lbl=(document.getElementById('cp-new-label')||{value:''}).value.trim();
  if(!lbl)return toast('Enter a name','e');
  var color=(document.getElementById('cp-new-color')||{value:'#e05080'}).value;
  var cost=+(document.getElementById('cp-new-cost')||{value:0}).value||0;
  var key='custom-'+Date.now();
  CENTERPIECE_TYPES[key]={label:lbl,color:color,cost:cost};
  var p=proj();if(!p.centerpieceTypes)p.centerpieceTypes={};
  p.centerpieceTypes[key]=CENTERPIECE_TYPES[key];saveProj(p);
  closeMo();openCenterpieceEditor();toast('Centerpiece added','s');
}

function saveCenterpieceEditor(){
  Object.keys(CENTERPIECE_TYPES).filter(k=>k!=='none').forEach(k=>{
    var lbl=document.getElementById('cp-label-'+k);
    var col=document.getElementById('cp-color-'+k);
    var cost=document.getElementById('cp-cost-'+k);
    if(lbl) CENTERPIECE_TYPES[k].label=lbl.value||CENTERPIECE_TYPES[k].label;
    if(col) CENTERPIECE_TYPES[k].color=col.value;
    if(cost) CENTERPIECE_TYPES[k].cost=+cost.value||0;
  });
  var p=proj();p.centerpieceTypes=JSON.parse(JSON.stringify(CENTERPIECE_TYPES));saveProj(p);
  closeMo();renderLayout();toast('Centerpieces saved','s');
}

function toggleSbSection(id){
  var el=document.getElementById(id);
  var arrow=document.getElementById(id+'-arrow');
  if(!el)return;
  var isHidden=el.style.display==='none'||el.style.display==='';
  el.style.display=isHidden?'block':'none';
  if(arrow) arrow.textContent=isHidden?'?':'?';
}


function openTableTypesEditor(){
  var tableKeys=Object.keys(LSHAPES_M).filter(k=>['round-table','rect-table','square-table'].includes(k)||LSHAPES_M[k]._isCustomTable);
  var rows=tableKeys.map(k=>{var s=LSHAPES_M[k];
    var isRound=s.radius&&s.radius!=='0px'&&s.radius!=='0';
    var isSquare=!isRound&&Math.abs((s.wm||1)-(s.hm||1))<0.01&&!['rect-table'].includes(k);
    var shapeVal=isRound?'round':(isSquare?'square':'rect');
    return `
    <div style="display:grid;grid-template-columns:110px 80px 65px 65px 50px 80px 34px;gap:5px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <input class="input" style="font-size:11px;padding:4px 8px" id="tt-${k}-label" value="${s.label}" placeholder="Name">
      <select class="input" style="font-size:11px;padding:3px 4px" id="tt-${k}-shape">
        <option value="round" ${shapeVal==='round'?'selected':''}>${t('shape_round')}</option>
        <option value="rect" ${shapeVal==='rect'?'selected':''}>${t('shape_rect')}</option>
        <option value="square" ${shapeVal==='square'?'selected':''}>${t('shape_square')}</option>
      </select>
      <input class="input" type="number" step="0.1" style="font-size:11px;padding:4px 6px" id="tt-${k}-w" value="${s.wm}">
      <input class="input" type="number" step="0.1" style="font-size:11px;padding:4px 6px" id="tt-${k}-h" value="${s.hm}">
      <input class="input" type="number" style="font-size:11px;padding:4px 6px" id="tt-${k}-chairs" value="${s.chairs}">
      <input class="input" type="number" step="0.01" style="font-size:11px;padding:4px 6px" id="tt-${k}-price" value="${s.price||0}" placeholder="0">
      <input class="input" type="color" id="tt-${k}-bg" value="${s.bg}" style="width:34px;height:34px;padding:2px" title="Fill color">
    </div>`;}).join('');
  openMo(`<div class="mo-title">${t('edit_table_types')}</div>
    <div style="display:grid;grid-template-columns:110px 80px 65px 65px 50px 80px 34px;gap:5px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:4px">
      <span class="s-lbl">${t('col_name')}</span>
      <span class="s-lbl">${t('col_shape')}</span>
      <span class="s-lbl">W (m)</span>
      <span class="s-lbl">H (m)</span>
      <span class="s-lbl">${t('col_chairs')}</span>
      <span class="s-lbl">${t('col_price')}</span>
      <span class="s-lbl">${t('col_color')}</span>
    </div>
    <div style="max-height:55vh;overflow-y:auto">${rows}</div>
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:8px">
      <div style="font-weight:700;font-size:11px;color:var(--gold-h);margin-bottom:8px">${t('add_custom_table')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:6px;align-items:end">
        <div class="ig"><label>${t('col_name')}</label><input class="input" style="font-size:11px" id="tt-new-label" placeholder="${t('col_name')}"></div>
        <div class="ig"><label>${t('col_shape')}</label><select class="input" style="font-size:11px;padding:3px 4px" id="tt-new-shape"><option value="round">${t('shape_round')}</option><option value="rect">${t('shape_rect')}</option><option value="square">${t('shape_square')}</option></select></div>
        <div class="ig"><label>W (m)</label><input class="input" type="number" step="0.1" style="font-size:11px" id="tt-new-w" value="1.5"></div>
        <div class="ig"><label>H (m)</label><input class="input" type="number" step="0.1" style="font-size:11px" id="tt-new-h" value="1.5"></div>
        <div class="ig"><label>${t('col_chairs')}</label><input class="input" type="number" style="font-size:11px" id="tt-new-chairs" value="8"></div>
        <div style="display:flex;gap:4px;align-items:flex-end;padding-bottom:1px">
          <input class="input" type="color" id="tt-new-bg" value="#e8d5c4" style="width:34px;height:34px;padding:2px" title="Fill color">
          <button class="btn btn-ghost btn-sm" onclick="addCustomTable()">Add</button>
        </div>
      </div>
    </div>
    <div class="mo-foot">
      <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveTableTypes()">${t('save')}</button>
    </div>`);
}

function addCustomTable(){
  var lbl=(document.getElementById('tt-new-label')||{value:''}).value.trim();
  if(!lbl)return toast('Enter a name','e');
  var shEl=document.getElementById('tt-new-shape');
  var sh=shEl?shEl.value:'rect';
  var wm=+document.getElementById('tt-new-w').value||1.5;
  var hm=+document.getElementById('tt-new-h').value||1.5;
  if(sh==='square') hm=wm;
  var key='custom-table-'+Date.now();
  LSHAPES_M[key]={label:lbl,wm:wm,hm:hm,bg:document.getElementById('tt-new-bg').value||'#e8d5c4',bdClr:'#8a5e3c',radius:sh==='round'?'50%':'0px',chairs:+document.getElementById('tt-new-chairs').value||8,_isCustomTable:true};
  LSHAPES=getLSHAPES();
  var p=proj();if(!p.customShapes)p.customShapes={};p.customShapes[key]=LSHAPES_M[key];saveProj(p);
  closeMo();openTableTypesEditor();toast(LANG==='es'?'Tipo de mesa agregado':'Table type added','s');
}

function saveTableTypes(){
  var tableKeys=Object.keys(LSHAPES_M).filter(k=>['round-table','rect-table','square-table'].includes(k)||LSHAPES_M[k]._isCustomTable);
  tableKeys.forEach(k=>{
    var lbl=document.getElementById('tt-'+k+'-label');
    var wEl=document.getElementById('tt-'+k+'-w');
    var hEl=document.getElementById('tt-'+k+'-h');
    var cEl=document.getElementById('tt-'+k+'-chairs');
    var bgEl=document.getElementById('tt-'+k+'-bg');
    var prEl=document.getElementById('tt-'+k+'-price');
    var shEl=document.getElementById('tt-'+k+'-shape');
    if(lbl&&LSHAPES_M[k]){
      LSHAPES_M[k].label=lbl.value||LSHAPES_M[k].label;
      if(wEl) LSHAPES_M[k].wm=+wEl.value||LSHAPES_M[k].wm;
      if(hEl) LSHAPES_M[k].hm=+hEl.value||LSHAPES_M[k].hm;
      if(cEl) LSHAPES_M[k].chairs=+cEl.value||0;
      if(bgEl) LSHAPES_M[k].bg=bgEl.value||LSHAPES_M[k].bg;
      if(prEl) LSHAPES_M[k].price=+prEl.value||0;
      if(shEl){
        var sh=shEl.value;
        LSHAPES_M[k].radius = sh==='round' ? '50%' : '0px';
        if(sh==='square' && wEl) LSHAPES_M[k].hm=LSHAPES_M[k].wm;
      }
    }
  });
  LState.items.forEach(function(it){
    var sh=LSHAPES_M[it.shape];
    if(sh){ it.radius=sh.radius||'0px'; }
  });
  LSHAPES=getLSHAPES();
  var p=proj();p.layoutItems=LState.items;
  var cs={};Object.keys(LSHAPES_M).forEach(k=>{if(LSHAPES_M[k]._isCustomTable||LSHAPES_M[k]._isCustomElem)cs[k]=LSHAPES_M[k];});
  p.customShapes=cs;saveProj(p);
  closeMo();renderLayout();toast(LANG==='es'?'Tipos de mesa actualizados':'Table types updated','s');
}

function openElementTypesEditor(){
  var elemKeys=Object.keys(LSHAPES_M).filter(k=>!['round-table','rect-table','square-table'].includes(k)&&!LSHAPES_M[k]._isCustomTable);
  var rows=elemKeys.filter(k=>LSHAPES_M[k]).map(k=>{var s=LSHAPES_M[k];return `
    <div style="display:grid;grid-template-columns:1fr 80px 80px 60px 40px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <input class="input" style="font-size:11px;padding:4px 8px" id="et-${k}-label" value="${s.label}" placeholder="Name">
      <input class="input" type="number" step="0.1" style="font-size:11px;padding:4px 6px" id="et-${k}-w" value="${s.wm}">
      <input class="input" type="number" step="0.1" style="font-size:11px;padding:4px 6px" id="et-${k}-h" value="${s.hm}">
      <input class="input" type="number" step="0.01" style="font-size:11px;padding:4px 6px" id="et-${k}-price" value="${s.price||0}" placeholder="0">
      <input class="input" type="color" id="et-${k}-bg" value="${s.bg}" style="width:34px;height:34px;padding:2px" title="Fill color">
    </div>`;}).join('');
  openMo(`<div class="mo-title">${t('edit_event_elements')}</div>
    <div style="display:grid;grid-template-columns:1fr 80px 80px 60px 40px;gap:6px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:4px">
      <span class="s-lbl">${t('col_name')}</span>
      <span class="s-lbl">W (m)</span>
      <span class="s-lbl">H (m)</span>
      <span class="s-lbl">${t('col_price')}</span>
      <span class="s-lbl">${t('col_color')}</span>
    </div>
    <div style="max-height:55vh;overflow-y:auto">${rows}</div>
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:8px">
      <div style="font-weight:700;font-size:11px;color:var(--gold-h);margin-bottom:8px">${t('add_custom_element')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:end">
        <div class="ig"><label>${t('col_name')}</label><input class="input" style="font-size:11px" id="et-new-label" placeholder="${t('col_name')}"></div>
        <div class="ig"><label>W (m)</label><input class="input" type="number" step="0.1" style="font-size:11px" id="et-new-w" value="2.0"></div>
        <div class="ig"><label>H (m)</label><input class="input" type="number" step="0.1" style="font-size:11px" id="et-new-h" value="1.0"></div>
        <div style="display:flex;gap:4px;align-items:flex-end;padding-bottom:1px">
          <input class="input" type="color" id="et-new-bg" value="#d0e8d0" style="width:34px;height:34px;padding:2px" title="Fill color">
          <button class="btn btn-ghost btn-sm" onclick="addCustomElement()">Add</button>
        </div>
      </div>
    </div>
    <div class="mo-foot">
      <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveElementTypes()">${t('save')}</button>
    </div>`);
}

function addCustomElement(){
  var lbl=(document.getElementById('et-new-label')||{value:''}).value.trim();
  if(!lbl)return toast('Enter a name','e');
  var key='custom-elem-'+Date.now();
  LSHAPES_M[key]={label:lbl,wm:+document.getElementById('et-new-w').value||2.0,hm:+document.getElementById('et-new-h').value||1.0,bg:document.getElementById('et-new-bg').value||'#d0e8d0',bdClr:'#4a7a4a',radius:'0px',chairs:0,_isCustomElem:true};
  LSHAPES=getLSHAPES();
  var p=proj();if(!p.customShapes)p.customShapes={};p.customShapes[key]=LSHAPES_M[key];saveProj(p);
  closeMo();openElementTypesEditor();toast(LANG==='es'?'Elemento agregado':'Element added','s');
  renderLayoutUI();
}

function saveElementTypes(){
  var elemKeys=Object.keys(LSHAPES_M).filter(k=>!['round-table','rect-table','square-table'].includes(k)&&!LSHAPES_M[k]._isCustomTable);
  elemKeys.filter(k=>LSHAPES_M[k]).forEach(k=>{
    var lbl=document.getElementById('et-'+k+'-label');
    if(lbl&&LSHAPES_M[k]){
      LSHAPES_M[k].label=lbl.value||LSHAPES_M[k].label;
      var wEl=document.getElementById('et-'+k+'-w');
      var hEl=document.getElementById('et-'+k+'-h');
      var bgEl=document.getElementById('et-'+k+'-bg');
      var prEl=document.getElementById('et-'+k+'-price');
      if(wEl) LSHAPES_M[k].wm=+wEl.value||LSHAPES_M[k].wm;
      if(hEl) LSHAPES_M[k].hm=+hEl.value||LSHAPES_M[k].hm;
      if(bgEl) LSHAPES_M[k].bg=bgEl.value||LSHAPES_M[k].bg;
      if(prEl) LSHAPES_M[k].price=+prEl.value||0;
    }
  });
  LSHAPES=getLSHAPES();
  var p2=proj();var cs2=p2.customShapes||{};
  Object.keys(LSHAPES_M).forEach(k=>{if(LSHAPES_M[k]._isCustomElem||LSHAPES_M[k]._isCustomTable)cs2[k]=LSHAPES_M[k];});
  p2.customShapes=cs2;saveProj(p2);
  closeMo();renderLayout();toast(LANG==='es'?'Elementos actualizados':'Event elements updated','s');
}

function openGeneralLayoutModal(){
  var chairOpts=Object.entries(CHAIR_TYPES).map(([k,v])=>`<option value="${k}">${v.label}${v.costPerChair>0?' ($'+v.costPerChair+'/silla)':''}</option>`).join('');
  var cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  openMo(`<div class="mo-title">? Create General Layout</div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Configure your venue layout. Default: 30 round tables (6ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â5), dance floor, shot bar, dinner platform and DJ booth in center.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">? Round Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-round-n" value="30" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-round-chairs" value="10" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-round-cols" value="6" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-round-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-round-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">? Rect Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-rect-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-rect-chairs" value="12" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-rect-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-rect-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-rect-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">? Square Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-sq-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-sq-chairs" value="8" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-sq-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-sq-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-sq-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
  </div>
  <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">
    <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">?? Center Elements</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      <div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Dance Floor (m)</label>
        <input class="input" type="number" step="0.1" id="gl-df-w" value="7.32" style="margin-bottom:4px" placeholder="Width">
        <input class="input" type="number" step="0.1" id="gl-df-h" value="7.32" placeholder="Height">
      </div>
      <div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Shot Bar (m)</label>
        <input class="input" type="number" step="0.1" id="gl-bar-w" value="7.32" style="margin-bottom:4px" placeholder="Length">
        <input class="input" type="number" step="0.1" id="gl-bar-h" value="0.4" placeholder="Width">
      </div>
      <div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Dinner Platform (m)</label>
        <input class="input" type="number" step="0.1" id="gl-stage-w" value="3.66" style="margin-bottom:4px" placeholder="Length">
        <input class="input" type="number" step="0.1" id="gl-stage-h" value="2.44" placeholder="Width">
      </div>
      <div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">DJ Booth (m)</label>
        <input class="input" type="number" step="0.1" id="gl-dj-w" value="3.66" style="margin-bottom:4px" placeholder="Length">
        <input class="input" type="number" step="0.1" id="gl-dj-h" value="1.22" placeholder="Width">
      </div>
    </div>
  </div>
  <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px;font-size:11px;color:var(--muted);margin-bottom:16px">
    ?? This will replace your current layout. Tables are arranged in a grid; center elements are placed in the middle.
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="generateGeneralLayout()">? Generate Layout</button>
  </div>`);
}

function generateGeneralLayout(){
  var ppm=getPPM();
  LSHAPES=getLSHAPES();
  var items=[];
  var _idN=0;
  var idGen=function(){_idN++;return 'li'+(Date.now()+_idN)+Math.random().toString(36).slice(2,5);};
  var sp=Math.round(1.0*ppm);

  var gn=function(eid){return +(document.getElementById(eid)||{value:0}).value||0;};
  var gs=function(eid){return (document.getElementById(eid)||{value:''}).value||'';};

  var roundN=gn('gl-round-n'),   roundChairs=gn('gl-round-chairs')||10;
  var roundCtype=gs('gl-round-ctype')||'default', roundCp=gs('gl-round-cp')||'none';
  var rectN=gn('gl-rect-n'),     rectChairs=gn('gl-rect-chairs')||12;
  var rectCtype=gs('gl-rect-ctype')||'default',  rectCp=gs('gl-rect-cp')||'none';
  var sqN=gn('gl-sq-n'),         sqChairs=gn('gl-sq-chairs')||8;
  var sqCtype=gs('gl-sq-ctype')||'default',      sqCp=gs('gl-sq-cp')||'none';

  var dfW=Math.round((gn('gl-df-h')||7.32)*ppm),  dfH=Math.round((gn('gl-df-w')||7.32)*ppm);
  var barW=Math.round((gn('gl-bar-w')||7.32)*ppm), barH=Math.round((gn('gl-bar-h')||0.4)*ppm);
  var stW=Math.round((gn('gl-stage-w')||3.66)*ppm),   stH=Math.round((gn('gl-stage-h')||2.44)*ppm);
  var djW=Math.round((gn('gl-dj-w')||3.66)*ppm),      djH=Math.round((gn('gl-dj-h')||1.22)*ppm);

  var rDef=LSHAPES['round-table'];
  var rcDef=LSHAPES['rect-table'];
  var sqDef=LSHAPES['square-table'];

  function makeCell(def, chairs){
    var _ms=Math.min(def.w,def.h);
    var _cp=Math.max(8,Math.round(_ms*0.22));
    var _cg=Math.max(1,Math.round(_ms*0.04));
    var pad=chairs?_cp+_cg:0;
    return {w:def.w+pad*2+sp, h:def.h+pad*2+sp, pad:pad, def:def};
  }
  var rCell=makeCell(rDef,roundChairs);
  var rcCell=makeCell(rcDef,rectChairs);
  var sqCell=makeCell(sqDef,sqChairs);

  // Distribute each table type evenly ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â half of each type on each side
  var leftQ=[], rightQ=[];
  function _splitType(n, maker){
    var lCount=Math.ceil(n/2);
    for(var i=0;i<lCount;i++) leftQ.push(maker());
    for(var i=0;i<n-lCount;i++) rightQ.push(maker());
  }
  _splitType(roundN, function(){ return {shape:'round-table',  cell:rCell,  chairs:roundChairs, ctype:roundCtype, cp:roundCp,  radius:'50%'}; });
  _splitType(rectN,  function(){ return {shape:'rect-table',   cell:rcCell, chairs:rectChairs,  ctype:rectCtype,  cp:rectCp,   radius:'0px'}; });
  _splitType(sqN,    function(){ return {shape:'square-table', cell:sqCell, chairs:sqChairs,    ctype:sqCtype,    cp:sqCp,     radius:'0px'}; });
  var total=leftQ.length+rightQ.length;

  // Cell dimensions per side
  var leftCellW=0,leftCellH=0,rightCellW=0,rightCellH=0;
  leftQ.forEach(function(t){ if(t.cell.w>leftCellW) leftCellW=t.cell.w; if(t.cell.h>leftCellH) leftCellH=t.cell.h; });
  rightQ.forEach(function(t){ if(t.cell.w>rightCellW) rightCellW=t.cell.w; if(t.cell.h>rightCellH) rightCellH=t.cell.h; });
  if(!leftCellW) leftCellW=rCell.w; if(!leftCellH) leftCellH=rCell.h;
  if(!rightCellW) rightCellW=rCell.w; if(!rightCellH) rightCellH=rCell.h;

  // Table grid columns
  var leftCols=Math.max(1,Math.min(6,Math.round(Math.sqrt(leftQ.length))));
  var rightCols=Math.max(1,Math.min(6,Math.round(Math.sqrt(rightQ.length))));
  var leftRows=Math.ceil(leftQ.length/Math.max(1,leftCols));
  var rightRows=Math.ceil(rightQ.length/Math.max(1,rightCols));
  var leftBlockW=leftCols*leftCellW;
  var rightBlockW=rightCols*rightCellW;
  var leftBlockH=leftRows*leftCellH;
  var rightBlockH=rightRows*rightCellH;
  var tableBlockH=Math.max(leftBlockH,rightBlockH);

  // Central column: width = dance floor width + padding
  var centerW=dfW;

  // Central column height: dj + stage + bar + dance floor + dinner platform
  var centralColH=djH+sp+stH+sp+barH+sp+dfH+sp+stH+sp;

  var totalLayoutW=leftBlockW+sp+centerW+sp+rightBlockW;
  var tableH=Math.max(tableBlockH,centralColH);
  var ox=Math.round(Math.max(sp*3,(LState.canvasW-totalLayoutW)/2));
  var oy=Math.round(Math.max(sp*3,(LState.canvasH-tableH)/2));
  var centralX=ox+leftBlockW+sp;
  var centralStartY=oy+Math.max(0,Math.round((tableH-centralColH)/2));
  var tableStartY=oy+Math.max(0,Math.round((tableH-tableBlockH)/2));

// The dance floor center X is the reference for centering all elements
  var dfCenterX=centralX+centerW/2;

  // Tables start at the same Y as the dance floor, not above it
  var dfY=centralStartY+djH+sp+stH+sp+barH+sp;
  tableStartY=Math.max(tableStartY, dfY);

  // Place LEFT tables
  var tCount=0;
  var leftStartX=centralX-sp-leftBlockW;
  for(var row=0;row<leftRows;row++){
    for(var col=0;col<leftCols;col++){
      var idx=row*leftCols+col; if(idx>=leftQ.length) break;
      var t=leftQ[idx];
      var tx=leftStartX+col*leftCellW+t.cell.pad;
      var ty=tableStartY+row*leftCellH+t.cell.pad;
      tCount++;
      items.push({id:idGen(),shape:t.shape,x:Math.round(tx),y:Math.round(ty),w:t.cell.def.w,h:t.cell.def.h,bg:t.cell.def.bg,bdClr:t.cell.def.bdClr,radius:t.radius,label:String(tCount),chairs:t.chairs,chairType:t.ctype,centerpiece:t.cp,cost:0,rotation:0});
    }
  }

  // Place RIGHT tables ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â columns reversed so layout mirrors the left side
  var rightStartX=centralX+centerW+sp;
  for(var row=0;row<rightRows;row++){
    for(var col=0;col<rightCols;col++){
      var idx=row*rightCols+col; if(idx>=rightQ.length) break;
      var t=rightQ[idx];
      var tx=rightStartX+(rightCols-1-col)*rightCellW+t.cell.pad;
      var ty=tableStartY+row*rightCellH+t.cell.pad;
      tCount++;
      items.push({id:idGen(),shape:t.shape,x:Math.round(tx),y:Math.round(ty),w:t.cell.def.w,h:t.cell.def.h,bg:t.cell.def.bg,bdClr:t.cell.def.bdClr,radius:t.radius,label:String(tCount),chairs:t.chairs,chairType:t.ctype,centerpiece:t.cp,cost:0,rotation:0});
    }
  }

  // Shot Bar
  items.push({id:idGen(),shape:'bar',       x:ctrX(barW),y:Math.round(cy),w:barW,h:barH,bg:barShape.bg,bdClr:barShape.bdClr,radius:'0px',label:LANG==='es'?'Barra de Shots':'Shot Bar',        chairs:0,cost:0,rotation:0}); cy+=barH+sp;
  // Dance Floor
  items.push({id:idGen(),shape:'dance-floor',x:ctrX(dfW),y:Math.round(cy),w:dfW, h:dfH, bg:dfShape.bg, bdClr:dfShape.bdClr, radius:'0px',label:LANG==='es'?'Pista de Baile':'Dance Floor',        chairs:0,cost:0,rotation:0}); cy+=dfH+sp;
  // Dinner Platform (below dance floor)
  items.push({id:idGen(),shape:'stage',     x:ctrX(stW), y:Math.round(cy),w:stW, h:stH, bg:stShape.bg, bdClr:stShape.bdClr, radius:'0px',label:LANG==='es'?'Plataforma de Cena':'Dinner Platform',chairs:0,cost:0,rotation:0});

  LState.items=items;
  var p=proj(); p.layoutItems=items; saveProj(p);
  closeMo();
  lHistorySave();
  renderLayout();
  setTimeout(function(){lZoom(0,'fit');},120);
  toast('Layout generated: '+total+' tables','s');
}

function toggleMeasureMode(){
  LState.measureMode=!LState.measureMode;
  if(!LState.measureMode){ _measurePoints=[]; _measurePreviewMouse=null; }
  renderLayout();
  if(LState.measureMode) toast('Click point A, then point B to measure. Hold Shift for horizontal/vertical lock. Continue clicking to chain. Esc to exit.','s');
}

function clearMeasurements(){
  _measureLines=[];
  _measurePoints=[];
  _measurePreviewMouse=null;
  renderLayout();
  toast('Measurements cleared','s');
}
function toggleFloorplanLock(){
  LState.floorplan.locked=!LState.floorplan.locked;
  saveFloorplan();
  renderLayout();
  toast(LState.floorplan.locked?'?? Floorplan locked':'?? Floorplan unlocked','s');
}


function setFloorplanOpacity(value, fromRange){
  if(!LState.floorplan||!LState.floorplan.img) return;
  var parsed=Number(value);
  if(!isFinite(parsed)) return;
  parsed=Math.max(0,Math.min(100,Math.round(parsed)));
  LState.floorplan.opacity=parsed/100;
  var range=document.getElementById('floorplan-opacity-range');
  var num=document.getElementById('floorplan-opacity-num');
  if(range && (!fromRange || range.value!==String(parsed))) range.value=String(parsed);
  if(num && (fromRange || num.value!==String(parsed))) num.value=String(parsed);
  saveFloorplan();
  renderLayoutCanvas();
}

function renderMeasureOverlay(){
  var ov=document.getElementById('measure-overlay');
  if(!ov){renderLayout();return;}
  var lines=_measureLines.map(function(ln){
    var label=ln.calibrated&&ln.m>0?ln.m.toFixed(2)+'m':ln.px+'px';
    var mx=(ln.x1+ln.x2)/2,my=(ln.y1+ln.y2)/2;
    return '<line x1="'+ln.x1+'" y1="'+ln.y1+'" x2="'+ln.x2+'" y2="'+ln.y2+'" stroke="#3b82f6" stroke-width="2"/>'+
      '<circle cx="'+ln.x1+'" cy="'+ln.y1+'" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>'+
      '<circle cx="'+ln.x2+'" cy="'+ln.y2+'" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>'+
      '<rect x="'+(mx-28)+'" y="'+(my-22)+'" width="56" height="18" rx="4" fill="rgba(30,30,50,.82)"/>'+
      '<text x="'+mx+'" y="'+(my-9)+'" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" font-family="monospace">'+label+'</text>';
  }).join('');
  var preview=_measurePoints.length===1?
    '<circle cx="'+_measurePoints[0].x+'" cy="'+_measurePoints[0].y+'" r="6" fill="#f59e0b" stroke="#fff" stroke-width="2"/>'+
    '<line id="measure-preview" x1="'+_measurePoints[0].x+'" y1="'+_measurePoints[0].y+'" x2="'+_measurePoints[0].x+'" y2="'+_measurePoints[0].y+'" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 3"/>'+
    '<text id="measure-preview-label" x="'+_measurePoints[0].x+'" y="'+(+_measurePoints[0].y-10)+'" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</text>':
    '';
  ov.innerHTML=lines+preview;
}

function renderLayoutCanvas(){
  const el=document.getElementById('lcanvas');
  if(!el)return renderLayout();
  var fpImg=document.getElementById('fp-img');
  if(LState.floorplan.img){
    if(!fpImg){renderLayout();return;}
    fpImg.style.left=LState.floorplan.x+'px';
    fpImg.style.top=LState.floorplan.y+'px';
    fpImg.style.width=Math.round(LState.floorplan.w*LState.floorplan.scale)+'px';
    fpImg.style.height=Math.round(LState.floorplan.h*LState.floorplan.scale)+'px';
    fpImg.style.opacity=LState.floorplan.opacity;
    fpImg.style.transform='rotate('+(LState.floorplan.rotation||0)+'deg)';
    fpImg.src=LState.floorplan.img;
  }
  var itemsDiv=el.querySelector('[style*="position:relative;z-index:1"]');
  if(itemsDiv){ itemsDiv.innerHTML=LState.items.map(function(item){return renderLItem(item);}).join(''); attachLItemEvents(); }
  else renderLayout();
}

function handleFloorplanUpload(e){
  var file=e.target.files[0];
  if(!file)return;
  toast(LANG==='es'?'Cargando planoÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦':'Loading floorplanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦');
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
      var _fpKey='fp_'+Math.random().toString(36).slice(2,10)+'_'+Date.now();
      _fpSave(_fpKey, finalData).then(function(){
        var targetW=LState.canvasW*0.8;
        var fpScale=1;
        if(cw>targetW) fpScale=targetW/cw;
        var placement=_getCenteredFloorplanPlacement(cw,ch,fpScale);
        LState.floorplan={
          img:finalData,
          thumb:finalData,
          opacity:0.4,
          scale:fpScale,
          x:placement.x,y:placement.y,
          w:cw,h:ch,
          _idb:_fpKey
        };
        var p=proj();
        p.floorplan={opacity:0.4,scale:LState.floorplan.scale,x:LState.floorplan.x,y:LState.floorplan.y,w:cw,h:ch,locked:false,rotation:0,pxPerMeter:null,img:'__idb__',_idb:_fpKey,thumb:finalData};
        saveProj(p);
        renderLayout();
      }).catch(function(err){
        console.error('IndexedDB save error:',err);
        var targetW=LState.canvasW*0.8;
        var fpScale=1;
        if(cw>targetW) fpScale=targetW/cw;
        var placement=_getCenteredFloorplanPlacement(cw,ch,fpScale);
        LState.floorplan={img:finalData,thumb:finalData,opacity:0.4,scale:fpScale,x:placement.x,y:placement.y,w:cw,h:ch};
        saveFloorplan();
        renderLayout();
        toast(LANG==='es'?'Plano cargado (sin cach? persistente)':'Floorplan loaded (no persistent cache)','s');
      });
    };
    img.src=origData;
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

function handleFloorplanDrop(e){
  var file=e.dataTransfer&&e.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/'))return toast('Please drop an image file','e');
  var fakeEvt={target:{files:[file],value:''},preventDefault:function(){}};
  handleFloorplanUpload(fakeEvt);
}

function removeFloorplan(){
  if(!confirm(LANG==='es'?'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Quitar el plano?':'Remove the floorplan image?'))return;
  var idbKey=LState.floorplan._idb;
  LState.floorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0};
  LState.scaleMode=false;LState.scalePoints=[];
  var p=proj();delete p.floorplan;saveProj(p);
  if(idbKey) _fpDelete(idbKey).catch(function(){});
  renderLayout();
  toast(LANG==='es'?'Plano eliminado':'Floorplan removed','s');
}

function saveFloorplan(){
  var p=proj();
  var fpCopy=JSON.parse(JSON.stringify(LState.floorplan));
  if(fpCopy._idb){
    if(!fpCopy.thumb && fpCopy.img && fpCopy.img!=='__idb__') fpCopy.thumb=fpCopy.img;
    fpCopy.img='__idb__';
  }
  p.floorplan=fpCopy;
  saveProj(p);
}
function startScaleMode(){
  if(!LState.floorplan.img)return toast('Upload a floorplan first','e');
  LState.scaleMode=true;
  LState.scalePoints=[];
  renderLayout();
  toast('Click two points on the floorplan along a known distance','s');
}

function cancelScaleMode(){
  LState.scaleMode=false;
  LState.scalePoints=[];
  renderLayout();
}

function applyScaleCalibration(){
  if(LState.scalePoints.length<2)return;
  var distEl=document.getElementById('scale-dist');
  var realMeters=distEl?+distEl.value:0;
  if(!realMeters||realMeters<=0)return toast('Enter a valid real-world distance','e');
  var pt1=LState.scalePoints[0],pt2=LState.scalePoints[1];
  var pxDist=Math.hypot(pt2.x-pt1.x,pt2.y-pt1.y);
  if(pxDist<5)return toast('Points are too close together','e');
  var fpPPM=pxDist/realMeters;
  var ratio=DEFAULT_PPM/fpPPM;
  var midX=(pt1.x+pt2.x)/2;
  var midY=(pt1.y+pt2.y)/2;
  var oldScale=LState.floorplan.scale;
  LState.floorplan.scale=oldScale*ratio;
  LState.floorplan.x=Math.round(midX-(midX-LState.floorplan.x)*ratio);
  LState.floorplan.y=Math.round(midY-(midY-LState.floorplan.y)*ratio);
  LState.floorplan.pxPerMeter=DEFAULT_PPM;
  LState.scaleMode=false;
  LState.scalePoints=[];
  saveFloorplan();
  renderLayout();
  toast('Floorplan scaled to match layout ('+DEFAULT_PPM+' px/m)','s');
}

function quickCreate(){
  var typeEl=document.getElementById('qc-type');
  var nEl=document.getElementById('qc-n');
  var chairsEl=document.getElementById('qc-chairs');
  var colsEl=document.getElementById('qc-cols');
  var spacingEl=document.getElementById('qc-spacing');
  if(!typeEl||!nEl||!chairsEl)return toast('Quick Create controls not found','e');
  var shape=typeEl.value;
  var n=Math.max(1,Math.min(100,+nEl.value||8));
  var chairs=Math.max(0,Math.min(30,+chairsEl.value||8));
  var cols=Math.max(1,Math.min(20,colsEl?+colsEl.value||4:4));
  var spacingM=Math.max(0.1,spacingEl?+spacingEl.value||1.5:1.5);
  var spacing=Math.round(spacingM*getPPM());
  LSHAPES=getLSHAPES();
  var def=LSHAPES[shape];
  if(!def)return toast('Unknown table type','e');
  var _qcMinSide=Math.min(def.w,def.h);
  var _qcChairPx=Math.max(8,Math.round(_qcMinSide*0.22));
  var _qcGapPx=Math.max(1,Math.round(_qcMinSide*0.04));
  var pad=chairs?_qcChairPx+_qcGapPx:0;
  var cellW=def.w+pad*2+spacing;
  var cellH=def.h+pad*2+spacing;
  var startX=120,startY=120;
  if(LState.items.length){
    var maxY=Math.max.apply(null,LState.items.map(function(i){return i.y+(i.h||80)+(i.chairs?60:0);}));
    startY=maxY+80;
  }
  var newItems=[];
  for(var i=0;i<n;i++){
    var col=i%cols;
    var row=Math.floor(i/cols);
    var tableNum=LState.items.length+newItems.length+1;
    newItems.push({
      id:'li'+Date.now()+Math.round(Math.random()*999999),
      shape:shape,label:'Table '+tableNum,
      x:startX+col*cellW,y:startY+row*cellH,
      w:def.w,h:def.h,bg:def.bg,bdClr:def.bdClr,
      chairs:chairs,chairType:'default',centerpiece:'none',cost:0
    });
  }
  LState.items=LState.items.concat(newItems);
  LState.sel=newItems.map(function(i){return i.id;});
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();renderLayout();
  toast('Created '+n+' '+shape.replace(/-/g,' ')+(n>1?'s':''),'s');
}

function updateFontSizeUI(){
  var inp = document.getElementById('toolbar-font-size');
  if(!inp) return;
  if(LState.sel.length === 1){
    var it = LState.items.find(function(i){ return i.id === LState.sel[0]; });
    if(it){
      var autoSize = Math.max(7, Math.min(14, Math.round((it.w / getPPM()) * 8)));
      inp.value = it.fontSize || autoSize;
      inp.disabled = false;
      inp.style.opacity = '1';
    }
  } else {
    inp.value = '';
    inp.placeholder = LState.sel.length > 1 ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·' : 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â';
    inp.disabled = LState.sel.length === 0;
    inp.style.opacity = LState.sel.length === 0 ? '0.4' : '1';
  }
}

function changeFontSize(delta){
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    if(!it)return;
    if(delta===0){
      delete it.fontSize;
    } else {
      const wM=it.w/getPPM();
      const autoSize=Math.max(7,Math.min(14,Math.round(wM*8)));
      const current=it.fontSize||autoSize;
      it.fontSize=Math.max(5,Math.min(99,current+delta));
    }
  });
  const p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    const el=document.getElementById('li_'+sid);
    if(el&&it){
      const newEl=document.createElement('div');
      newEl.innerHTML=renderLItem(it);
      const ni=newEl.firstChild;
      el.replaceWith(ni);
      ni.addEventListener('mousedown',lItemDown,{passive:false});
    }
  });
  updateSelUI();
  updateFontSizeUI();
}

function setFontSizeDirect(size){
  if(!size||isNaN(size)||size<5)return;
  size=Math.max(5,Math.min(99,Math.round(size)));
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    if(!it)return;
    it.fontSize=size;
  });
  const p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    const el=document.getElementById('li_'+sid);
    if(el&&it){
      const newEl=document.createElement('div');
      newEl.innerHTML=renderLItem(it);
      const ni=newEl.firstChild;
      el.replaceWith(ni);
      ni.addEventListener('mousedown',lItemDown,{passive:false});
    }
  });
  updateSelUI();
  updateFontSizeUI();
}
function getRotateStep(){
  var step=Number(document.getElementById('rotate-step')?.value);
  if(!step||isNaN(step))step=90;
  return step;
}
function doRotate(deg){
  rotateSelected(deg);
}
function rotateSelected(deg){
  if(!LState.sel.length)return toast('Select items to rotate','e');
  if(!deg||isNaN(deg))return toast('Enter a valid angle','e');
  var selItems=LState.items.filter(function(i){return LState.sel.indexOf(i.id)>=0;});
  if(selItems.length===1){
    var item=selItems[0];
    item.rotation=((item.rotation||0)+deg+360)%360;
  } else {
    var minX=Math.min.apply(null,selItems.map(function(i){return i.x;}));
    var minY=Math.min.apply(null,selItems.map(function(i){return i.y;}));
    var maxX=Math.max.apply(null,selItems.map(function(i){return i.x+i.w;}));
    var maxY=Math.max.apply(null,selItems.map(function(i){return i.y+i.h;}));
    var cx=(minX+maxX)/2;
    var cy=(minY+maxY)/2;
    var rad=deg*Math.PI/180;
    var cos=Math.cos(rad);
    var sin=Math.sin(rad);
    selItems.forEach(function(item){
      var icx=item.x+item.w/2;
      var icy=item.y+item.h/2;
      var dx=icx-cx;
      var dy=icy-cy;
      var nx=cx+(dx*cos-dy*sin);
      var ny=cy+(dx*sin+dy*cos);
      item.x=Math.round(nx-item.w/2);
      item.y=Math.round(ny-item.h/2);
      item.rotation=((item.rotation||0)+deg+360)%360;
    });
  }
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  renderLayout();
  toast('Rotated '+deg+'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°','s');
}

function alignSelected(mode){
  if(LState.sel.length<2)return toast('Select 2+ items to align','e');
  var selItems=LState.items.filter(function(i){return LState.sel.indexOf(i.id)>=0;});
  var minX=Math.min.apply(null,selItems.map(function(i){return i.x;}));
  var minY=Math.min.apply(null,selItems.map(function(i){return i.y;}));
  var maxRight=Math.max.apply(null,selItems.map(function(i){return i.x+i.w;}));
  var maxBottom=Math.max.apply(null,selItems.map(function(i){return i.y+i.h;}));
  if(mode==='dist-h'){
    selItems.sort(function(a,b){return a.x-b.x;});
    var totalW=selItems.reduce(function(s,i){return s+i.w;},0);
    var gap=selItems.length>1?(maxRight-minX-totalW)/(selItems.length-1):0;
    var cur=minX;selItems.forEach(function(it){it.x=Math.round(cur);cur+=it.w+gap;});
  } else if(mode==='dist-v'){
    selItems.sort(function(a,b){return a.y-b.y;});
    var totalH=selItems.reduce(function(s,i){return s+i.h;},0);
    var gapV=selItems.length>1?(maxBottom-minY-totalH)/(selItems.length-1):0;
    var curV=minY;selItems.forEach(function(it){it.y=Math.round(curV);curV+=it.h+gapV;});
  } else {
    selItems.forEach(function(item){
      if(mode==='left') item.x=minX;
      else if(mode==='right') item.x=maxRight-item.w;
      else if(mode==='top') item.y=minY;
      else if(mode==='bottom') item.y=maxBottom-item.h;
      else if(mode==='cx') item.x=Math.round((minX+maxRight)/2-item.w/2);
      else if(mode==='cy') item.y=Math.round((minY+maxBottom)/2-item.h/2);
    });
  }
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  renderLayout();toast('Aligned','s');
}

function renderLPropsPanel(){
  const id=LState.sel[0];if(!id)return;
  const item=LState.items.find(i=>i.id===id);if(!item)return;
  const panel=document.getElementById('lsb-props-inner');if(!panel)return;
  const isTable=item.chairs>0;
  const cType=item.chairType||'default';
  const cpType=item.centerpiece||'none';

  const chairOpts=Object.entries(CHAIR_TYPES).map(([k,v])=>
    `<option value="${k}" ${cType===k?'selected':''}>${v.label}</option>`).join('');
  const selectedChairImg = CHAIR_IMAGES[cType] || null;
  const cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>
    `<option value="${k}" ${cpType===k?'selected':''}>${v.label}</option>`).join('');

  panel.innerHTML=`
    <div class="lsb-prop"><label>${t('label')}</label>
      <input class="input" value="${esc(item.label)}" oninput="lPropChange('${id}','label',this.value)">
    </div>
    <div class="form-grid" style="gap:6px">
      <div class="lsb-prop"><label>${t('width')} (m)</label>
        <input class="input" type="number" value="${(item.w/getPPM()).toFixed(2)}" step="0.05" oninput="lPropChange('${id}','w',Math.round((+this.value||0.5)*getPPM()))">
      </div>
      <div class="lsb-prop"><label>${t('height')} (m)</label>
        <input class="input" type="number" value="${(item.h/getPPM()).toFixed(2)}" step="0.05" oninput="lPropChange('${id}','h',Math.round((+this.value||0.5)*getPPM()))">
      </div>
    </div>
    <div class="lsb-prop"><label>${t('seats')}</label>
      <input class="input" type="number" value="${item.chairs||0}" min="0" max="30" oninput="lPropChange('${id}','chairs',+this.value)">
    </div>
    <div class="form-grid" style="gap:6px">
      <div class="lsb-prop"><label>${t('fill')}</label>
        <input class="input" type="color" value="${item.bg}" style="height:36px;padding:2px" oninput="lPropChange('${id}','bg',this.value)">
      </div>
      <div class="lsb-prop"><label>${t('label_color')}</label>
        <input class="input" type="color" value="${item.bdClr}" style="height:36px;padding:2px" oninput="lPropChange('${id}','bdClr',this.value)">
      </div>
    </div>
    ${isTable?(
      '<div class="lsb-prop"><label>'+t('chair_style')+'</label>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
      (selectedChairImg ? '<img src="'+selectedChairImg+'" onclick="window.SCI[this.dataset.ci]&&window.SCI[this.dataset.ci]()" data-ci="'+cType+'" class="chair-zoom" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e0d4b0;background:#faf8f2;cursor:pointer;flex-shrink:0" title="Click to enlarge">' : '')+
      '<select class="input" style="font-size:11px;flex:1" onchange="lPropChange(\''+id+'\',\'chairType\',this.value);renderLPropsPanel()">'+chairOpts+'</select>'+
      '</div></div>'+
      '<div class="lsb-prop"><label>'+t('centerpiece')+'</label>'+
      '<select class="input" style="font-size:11px" onchange="lPropChange(\''+id+'\',\'centerpiece\',this.value)">'+cpOpts+'</select></div>'
    ):''}
    <div class="lsb-prop"><label>${t('cost')}</label><input class="input" type="number" value="${item.cost||0}" min="0" step="0.01" oninput="lPropChange('${id}','cost',+this.value||0)"></div>
    <button class="btn btn-danger btn-sm w-full" style="margin-top:6px" onclick="delLItem('${id}')">${t('delete')}</button>
  `;
}

function lPropChange(id, key, val){
  const item=LState.items.find(i=>i.id===id);if(!item)return;

  const perElementOnly=['label','x','y','rotation'];

  if(perElementOnly.includes(key)){
    item[key]=val;
  } else {
    LState.items.forEach(it=>{ if(isSameLayoutInstance(it,item)) it[key]=val; });
    LState.sel.forEach(selId=>{
      const selItem=LState.items.find(i=>i.id===selId);
      if(selItem && !isSameLayoutInstance(selItem,item)) selItem[key]=val;
    });
  }

  const p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  const toUpdate=new Set();
  if(perElementOnly.includes(key)){
    toUpdate.add(id);
  } else {
    LState.items.forEach(it=>{ if(isSameLayoutInstance(it,item)) toUpdate.add(it.id); });
    LState.sel.forEach(selId=>toUpdate.add(selId));
  }
  toUpdate.forEach(uid=>{
    const it=LState.items.find(i=>i.id===uid); if(!it) return;
    const el=document.getElementById('li_'+uid);
    if(el){
      const newEl=document.createElement('div');
      newEl.innerHTML=renderLItem(it);
      const ni=newEl.firstChild;
      el.replaceWith(ni);
      ni.addEventListener('mousedown',lItemDown,{passive:false});
    }
  });
}

function openLItemModal(id){
  const item=LState.items.find(i=>i.id===id);if(!item)return;
  const isTable=['round-table','rect-table','square-table'].includes(item.shape)||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape]._isCustomTable);
  const hasChairs=item.chairs>0;
  const chairOpts=Object.entries(CHAIR_TYPES).map(([k,v])=>
    `<option value="${k}" ${(item.chairType||'default')===k?'selected':''}>${v.label}</option>`).join('');
  const cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>
    `<option value="${k}" ${(item.centerpiece||'none')===k?'selected':''}>${v.label}</option>`).join('');


  const _es = LANG==='es';
  openMo(`<div class="mo-title">${_es?'Editar':'Edit'}: ${esc(item.label)}</div>
  <div class="form-grid">
    <div class="ig" style="grid-column:1/-1"><label>${_es?'Etiqueta':'Label'}</label>
      <input class="input" id="li-lbl" value="${esc(item.label)}">
    </div>
    <div class="ig"><label>${_es?'Ancho (m)':'Width (m)'}</label>
      <input class="input" id="li-w" type="number" step="0.05" value="${(item.w/getPPM()).toFixed(2)}">
    </div>
    <div class="ig"><label>${_es?'Alto (m)':'Height (m)'}</label>
      <input class="input" id="li-h" type="number" step="0.05" value="${(item.h/getPPM()).toFixed(2)}">
    </div>
    <div class="ig"><label>${_es?'Sillas / Asientos':'Chairs / Seats'}</label>
      <input class="input" id="li-chairs" type="number" value="${item.chairs||0}" min="0" max="30">
    </div>
    ${isTable?`<div class="ig" style="grid-column:1/-1"><label>${_es?'Tipo de Mesa':'Table Type'}</label>
      <input type="hidden" id="li-new-typekey" value="">
      <input type="hidden" id="li-new-shape" value="">
      <input type="hidden" id="li-new-w" value="">
      <input type="hidden" id="li-new-h" value="">
      <input type="hidden" id="li-new-chairs" value="">
      <input type="hidden" id="li-new-radius" value="">
      <div style="display:flex;align-items:center;gap:10px">
        <span id="li-type-label" style="font-size:13px;color:var(--text)">${item._typeKey?item._typeKey.replace(/-/g,' ').replace(/(\d)/,' $1'):(item.shape==='round-table'?(item.w/getPPM()).toFixed(1)+'m '+ (_es?'Redonda':'Round'):(item.w/getPPM()).toFixed(1)+'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â'+(item.h/getPPM()).toFixed(1)+'m '+(_es?'Rectangular':'Rect'))}</span>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openChangeTableTypePicker('${id}')" style="white-space:nowrap">?? ${_es?'Cambiar Tipo':'Change Type'}</button>
      </div>
    </div>`:''}
    <div class="ig"><label>${_es?'Color de Relleno':'Fill Color'}</label>
      <input class="input" id="li-bg" type="color" value="${item.bg}" style="height:38px;padding:2px">
    </div>
    <div class="ig"><label>${_es?'Color de Etiqueta':'Label Color'}</label>
      <input class="input" id="li-bdc" type="color" value="${item.bdClr}" style="height:38px;padding:2px">
    </div>
  ${hasChairs?`
  <div class="ig" style="grid-column:1/-1">
    <label style="font-size:10.5px;font-weight:700;color:var(--light);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:8px">${_es?'Estilo de Silla':'Chair Style'}</label>
    <select class="input" id="li-ctype" style="font-size:12px">${chairOpts}</select>
  </div>
  <div class="ig" style="grid-column:1/-1">
    <label style="font-size:10.5px;font-weight:700;color:var(--light);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:8px">${_es?'Centro de Mesa':'Centerpiece'}</label>
    <select class="input" id="li-cp" style="font-size:12px">${cpOpts}</select>
  </div>`:''}
  <div style="font-size:10.5px;color:var(--muted);margin-bottom:8px;padding:8px;background:rgba(201,168,76,.06);border-radius:6px;border:1px solid rgba(201,168,76,.15)">
    ?? ${_es?`Las <strong>instancias</strong> comparten cambios. Las <strong>copias</strong> quedan separadas.`:`<strong>Instances</strong> share changes. <strong>Copies</strong> stay independent.`}
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-ghost" onclick="closeMo();makeLayoutDuplicate('${id}','copy')">${_es?'Copia':'Copy'}</button>
    <button class="btn btn-ghost" onclick="closeMo();makeLayoutDuplicate('${id}','instance')">${_es?'Instancia':'Instance'}</button>
    <button class="btn btn-danger" onclick="closeMo();delLItem('${id}')">${t('delete')||(_es?'Eliminar':'Delete')}</button>
    <button class="btn btn-primary" onclick="saveLItem('${id}')">${t('save')}</button>
  </div>`);
  // If a type change was pending, populate the hidden fields
  if(window._pendingTypeChange){
    var ptc=window._pendingTypeChange;
    var _ntk=document.getElementById('li-new-typekey');if(_ntk)_ntk.value=ptc.typeKey;
    var _ns=document.getElementById('li-new-shape');if(_ns)_ns.value=ptc.shape;
    var _nw=document.getElementById('li-new-w');if(_nw)_nw.value=ptc.w;
    var _nh=document.getElementById('li-new-h');if(_nh)_nh.value=ptc.h;
    var _nc=document.getElementById('li-new-chairs');if(_nc)_nc.value=ptc.chairs;
    var _nr=document.getElementById('li-new-radius');if(_nr)_nr.value=ptc.radius;
    var _tl=document.getElementById('li-type-label');if(_tl)_tl.textContent=ptc.label;
    var _wInp=document.getElementById('li-w');if(_wInp)_wInp.value=(ptc.w/getPPM()).toFixed(2);
    var _hInp=document.getElementById('li-h');if(_hInp)_hInp.value=(ptc.h/getPPM()).toFixed(2);
    var _chInp=document.getElementById('li-chairs');if(_chInp)_chInp.value=ptc.chairs;
    window._pendingTypeChange=null;
  }
}


function openChangeTableTypePicker(itemId){
  var isES=LANG==='es';
  var catalogue=_addTableCatalogue();
  var item=LState.items.find(function(i){return i.id===itemId;});
  var currentKey=item?item._typeKey:'';
  function catSection(catKey,titleEN,titleES){
    var items=catalogue.filter(function(c){return c.cat===catKey;});
    return '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">'+(isES?titleES:titleEN)+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
      +items.map(function(it){
        var sel=it.key===currentKey;
        return '<div onclick="selectNewTableType(\''+itemId+'\',\''+it.key+'\')" style="cursor:pointer;padding:8px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s">'
          +_addTableDrawSVG(it,sel)
          +'<div style="margin-top:4px;font-size:10px;color:var(--muted)">'+(isES?'Sillas:':'Chairs:')+' '+it.chairs+'</div>'
          +'</div>';
      }).join('')
      +'</div>';
  }
  openMo('<div class="mo-title">'+(isES?'Seleccionar Tipo de Mesa':'Select Table Type')+'</div>'
    +'<div style="overflow-y:auto;max-height:55vh">'
    +catSection('round','Round Tables','Mesas Redondas')
    +catSection('rect','Rectangular Tables','Mesas Rectangulares')
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo();openLItemModal(\''+itemId+'\')">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'</div>');
}

function selectNewTableType(itemId,typeKey){
  var catalogue=_addTableCatalogue();
  var cat=catalogue.find(function(c){return c.key===typeKey;});
  if(!cat) return;
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:(typeof getPPM==='function'?getPPM():40);
  var shape=cat.cat==='round'?'round-table':'rect-table';
  var tw=Math.round(cat.wM*ppm);
  var th=Math.round(cat.hM*ppm);
  var radius=cat.cat==='round'?'50%':'0px';
  // Store in a temporary global so the edit modal can read it
  window._pendingTypeChange={typeKey:typeKey,shape:shape,w:tw,h:th,chairs:cat.chairs,radius:radius,label:cat.label};
  closeMo();
  // Re-open the edit modal ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â the hidden inputs will be populated
  setTimeout(function(){
    openLItemModal(itemId);
  },100);
}

function saveLItem(id){
  const item=LState.items.find(i=>i.id===id);if(!item)return;
  const newLabel=gv('li-lbl');
  const wM=parseFloat(gv('li-w'));
  const hM=parseFloat(gv('li-h'));
  const newW=wM>0?Math.round(wM*getPPM()):item.w;
  const newH=hM>0?Math.round(hM*getPPM()):item.h;
  const newChairs=+gv('li-chairs');
  const newBg=gv('li-bg');
  const newBdClr=gv('li-bdc');
  const ctEl=document.getElementById('li-ctype');
  const cpEl=document.getElementById('li-cp');
  const _ntkEl=document.getElementById('li-new-typekey');
  const _nsEl=document.getElementById('li-new-shape');
  const _nrEl=document.getElementById('li-new-radius');
  let newShape=item.shape;
  let newRadius=item.radius||'0px';
  let newTypeKey=item._typeKey||null;
  if(_ntkEl&&_ntkEl.value){
    newTypeKey=_ntkEl.value;
    newShape=_nsEl?_nsEl.value:item.shape;
    newRadius=_nrEl?_nrEl.value:item.radius;
  }
  const newCtype=ctEl?ctEl.value:(item.chairType||'default');
  const newCp=cpEl?cpEl.value:(item.centerpiece||'none');

  const origTypeKey=item._typeKey||null;
  const origInstanceKey=getLayoutInstanceKey(item);
  function _matchesType(i){
    if(origTypeKey && !item._instanceKey) return i._typeKey===origTypeKey && !i._instanceKey;
    return getLayoutInstanceKey(i)===origInstanceKey;
  }
  const sameType=LState.items.filter(_matchesType);
  sameType.forEach(it=>{
    it.w=newW; it.h=newH;
    it.bg=newBg; it.bdClr=newBdClr;
    it.chairs=newChairs;
    it.chairType=newCtype;
    it.centerpiece=newCp;
    it.radius=newRadius;
    it.shape=newShape;
    if(newTypeKey) it._typeKey=newTypeKey;
  });

  LState.sel.forEach(selId=>{
    const selItem=LState.items.find(i=>i.id===selId);
    if(selItem && !_matchesType(selItem)){
      selItem.w=newW; selItem.h=newH;
      selItem.bg=newBg; selItem.bdClr=newBdClr;
      selItem.chairs=newChairs;
      selItem.chairType=newCtype;
      selItem.centerpiece=newCp;
    }
  });
  item.label=newLabel;

  const p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  closeMo();renderLayout();
  const selExtra=LState.sel.filter(sid=>{const si=LState.items.find(i=>i.id===sid);return si&&!_matchesType(si);}).length;
  const totalUpdated=sameType.length+selExtra;
  toast('Applied to '+totalUpdated+' item'+(totalUpdated!==1?'s':''),'s');
}



var _lt={pinching:false,lastDist:0,lastTap:0,tapId:null,dragId:null,offX:0,offY:0};
function _ltDist(t){ return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY); }
function initLayoutTouchHandlers(){
  var co=document.getElementById('lcanvas-outer');
  var cv=document.getElementById('lcanvas');
  if(!co||!cv||co._ltBound) return;
  co._ltBound=true;
  co.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      _lt.pinching=true; _lt.lastDist=_ltDist(e.touches); e.preventDefault(); return;
    }
    _lt.pinching=false;
    var touch=e.touches[0];
    var item=touch.target.closest('.litem');
    if(item){
      var id=item.dataset.id;
      var now=Date.now();
      if(now-_lt.lastTap<350&&_lt.tapId===id){ openLItemModal(id); _lt.lastTap=0; _lt.tapId=null; e.preventDefault(); return; }
      _lt.lastTap=now; _lt.tapId=id;
      var cr=cv.getBoundingClientRect();
      var mx=(touch.clientX-cr.left)/LState.zoom, my=(touch.clientY-cr.top)/LState.zoom;
      var it=LState.items.find(i=>i.id===id);
      if(it){ _lt.dragId=id; _lt.offX=mx-it.x; _lt.offY=my-it.y; if(!LState.sel.includes(id)){LState.sel=[id];updateSelUI();} }
      e.preventDefault();
    } else { _lt.dragId=null; }
  },{passive:false});
  co.addEventListener('touchmove',function(e){
    if(_lt.pinching&&e.touches.length===2){
      var nd=_ltDist(e.touches), ratio=nd/(_lt.lastDist||nd);
      if(Math.abs(ratio-1)>0.005){ lZoom((ratio>1?1:-1)*0.05); }
      _lt.lastDist=nd; e.preventDefault(); return;
    }
    if(!_lt.pinching&&_lt.dragId&&e.touches.length===1){
      var t2=e.touches[0], cr2=cv.getBoundingClientRect();
      var mx2=(t2.clientX-cr2.left)/LState.zoom, my2=(t2.clientY-cr2.top)/LState.zoom;
      var it2=LState.items.find(i=>i.id===_lt.dragId);
      if(it2){ it2.x=Math.round(mx2-_lt.offX); it2.y=Math.round(my2-_lt.offY); var el=document.getElementById('li_'+it2.id); if(el){el.style.left=it2.x+'px';el.style.top=it2.y+'px';} }
      e.preventDefault();
    }
  },{passive:false});
  co.addEventListener('touchend',function(){
    if(_lt.dragId){ var p=proj();p.layoutItems=LState.items;saveProj(p);lHistorySave(); _lt.dragId=null; }
    _lt.pinching=false;
  });
}

function lZoom(delta,mode,cx,cy){
  const outer=document.getElementById('lcanvas-outer');
  const oldZoom=LState.zoom;
  if(mode==='fit'||mode==='sel'){
    const fp=LState.floorplan;
    const hasFp=fp&&fp.img;
    const targetItems = (mode==='sel'&&LState.sel&&LState.sel.length)
      ? LState.items.filter(i=>LState.sel.includes(i.id))
      : LState.items;
    if(!targetItems.length&&!hasFp){LState.zoom=0.6;}
    else{
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      targetItems.forEach(item=>{
        const pad=(item.chairs||0)?30:0;
        minX=Math.min(minX,item.x-pad);minY=Math.min(minY,item.y-pad);
        maxX=Math.max(maxX,item.x+item.w+pad);maxY=Math.max(maxY,item.y+item.h+pad);
      });
      if(mode==='fit'&&hasFp){
        const fpW=Math.round(fp.w*fp.scale), fpH=Math.round(fp.h*fp.scale);
        minX=Math.min(minX,fp.x);minY=Math.min(minY,fp.y);
        maxX=Math.max(maxX,fp.x+fpW);maxY=Math.max(maxY,fp.y+fpH);
      }
      const margin=60;
      const bw=maxX-minX+margin*2,bh=maxY-minY+margin*2;
      if(outer){
        const vw=outer.clientWidth||800,vh=outer.clientHeight||600;
        LState.zoom=Math.min(3,Math.max(0.1,Math.min(vw/bw,vh/bh)));
        LState.zoom=Math.round(LState.zoom*10)/10;
        setTimeout(()=>{
          if(outer){
            outer.scrollLeft=(minX-margin)*LState.zoom;
            outer.scrollTop=(minY-margin)*LState.zoom;
          }
        },20);
      }
    }
  } else {
    LState.zoom=Math.max(0.1,Math.min(3,LState.zoom+delta));
    // Zoom toward cursor point if provided
    if(cx!=null&&outer){
      const newZoom=LState.zoom;
      outer.scrollLeft=cx*newZoom-(cx*oldZoom-outer.scrollLeft);
      outer.scrollTop=cy*newZoom-(cy*oldZoom-outer.scrollTop);
    }
  }
  const canvas=document.getElementById('lcanvas');
  if(canvas)canvas.style.transform=`scale(${LState.zoom})`;
  const zd=document.querySelector('.zoom-bar span');
  if(zd)zd.textContent=Math.round(LState.zoom*100)+'%';
}

function lWheel(e){
  e.preventDefault();
  const outer=document.getElementById('lcanvas-outer');
  const canvas=document.getElementById('lcanvas');
  const outerRect=outer?outer.getBoundingClientRect():null;
  let cx=0,cy=0;
  if(outerRect&&canvas){
    cx=(e.clientX-outerRect.left+outer.scrollLeft)/LState.zoom;
    cy=(e.clientY-outerRect.top+outer.scrollTop)/LState.zoom;
  }
  const step=(e.ctrlKey||e.metaKey)?0.14:0.08;
  const delta=e.deltaY>0?-step:step;
  lZoom(delta,null,cx,cy);
}

function showLayoutBudget(){
  renderLayoutBudgetModal();
}
function renderLayoutBudgetModal(){
  var p=proj();
  var items=LState.items || [];
  var quote=getLayoutQuoteSummary(items, ensureLayoutQuoteState(p));
  openMo(
    '<div class="mo-title">'+esc(t('layout_quote_title'))+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin:-4px 0 12px">'+esc(t('layout_quote_sub'))+'</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px">'+
      '<div style="background:var(--gold-l);border-radius:10px;padding:12px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700;color:var(--gold-h)">'+formatCost(quote.total)+'</div>'+
        '<div class="s-sm">'+esc(t('layout_quote_title'))+'</div>'+
      '</div>'+
      '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700">'+quote.totalElements+'</div>'+
        '<div class="s-sm">'+esc(t('elements'))+'</div>'+
      '</div>'+
      '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700">'+quote.totalSeats+'</div>'+
        '<div class="s-sm">'+esc(t('layout_total_seats'))+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="max-height:55vh;overflow:auto;margin:0 -2px">'+
      renderLayoutQuoteAutoTable(quote)+
      renderLayoutQuoteExtrasTable(quote)+
    '</div>'+
    '<p style="font-size:11px;color:var(--muted);margin:12px 0 0">'+esc(t('layout_quote_sub'))+'</p>'+
    '<div class="mo-foot">'+
      '<button class="btn btn-ghost" onclick="closeMo()">'+esc(t('close'))+'</button>'+
      '<button class="btn btn-primary" onclick="exportLayoutFull()">'+esc(t('export'))+'</button>'+
    '</div>'
  );
}
function lBudgetRefreshTotal(){
  renderLayoutBudgetModal();
}
function lBudgetGrpCost(el){
  if(!el) return;
  lQuoteUpdateGroupCost(el.dataset.bkey, el.value);
  renderLayoutBudgetModal();
}
function lBudgetGrpChairType(el){
  if(!el) return;
  lQuoteUpdateGroupChairType(el.dataset.bkey, el.value);
  renderLayoutBudgetModal();
}
function lBudgetGrpCp(el){
  if(!el) return;
  lQuoteUpdateGroupCenterpiece(el.dataset.bkey, el.value);
  renderLayoutBudgetModal();
}

function openStylesEditor(){
  const chairRows = Object.entries(CHAIR_TYPES).map(([k,v])=>{
    const imgSrc = CHAIR_IMAGES[k] || '';
    const imgCell = imgSrc
      ? '<img src="'+imgSrc+'" onclick="window.SCI[this.dataset.ci]&&window.SCI[this.dataset.ci]()" class="chair-thumb chair-zoom" data-ci="'+k+'" title="Click to enlarge">'
      : '<span style="display:inline-block;width:36px;height:36px;border-radius:4px;background:'+(v.fill.startsWith('rgba')?'#e8e8e8':v.fill)+';border:1px solid #ddd"></span>';
    return `<tr>
      <td style="padding:6px 8px;white-space:nowrap">${imgCell}</td>
      <td style="padding:6px 8px"><input style="width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px" value="${v.label}" onchange="CHAIR_TYPES['${k}'].label=this.value;saveLayoutStyles()"></td>
      <td style="padding:6px 8px;text-align:center"><input type="color" value="${v.fill.startsWith('rgba')?'#e8e8e8':v.fill}" style="width:32px;height:28px;border:none;cursor:pointer;border-radius:4px" onchange="CHAIR_TYPES['${k}'].fill=this.value;saveLayoutStyles()"></td>
      <td style="padding:6px 8px;text-align:center"><input type="color" value="${v.stroke||'#bbbbbb'}" style="width:32px;height:28px;border:none;cursor:pointer;border-radius:4px" onchange="CHAIR_TYPES['${k}'].stroke=this.value;saveLayoutStyles()"></td>
      <td style="padding:6px 8px"><input type="number" min="0" step="0.01" value="${v.costPerChair||0}" style="width:70px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px" placeholder="0" onchange="CHAIR_TYPES['${k}'].costPerChair=+this.value||0;saveLayoutStyles()"></td>
    </tr>`;
  }).join('');

  const cpRows = Object.entries(CENTERPIECE_TYPES).filter(([k])=>k!=='none').map(([k,v])=>`
    <tr>
      <td style="padding:6px 8px"><input style="width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px" value="${v.label}" onchange="CENTERPIECE_TYPES['${k}'].label=this.value;saveLayoutStyles()"></td>
      <td style="padding:6px 8px;text-align:center"><input type="color" value="${v.color||'#888888'}" style="width:32px;height:28px;border:none;cursor:pointer;border-radius:4px" onchange="CENTERPIECE_TYPES['${k}'].color=this.value;saveLayoutStyles()"></td>
      <td style="padding:6px 8px"><input type="number" min="0" step="0.01" value="${v.cost||0}" style="width:70px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px" placeholder="0" onchange="CENTERPIECE_TYPES['${k}'].cost=+this.value||0;saveLayoutStyles()"></td>
    </tr>`).join('');

  openMo(`<div class="mo-title">?? Styles Editor</div>
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--light);margin-bottom:8px">Chair Styles</div>
  <div style="overflow-x:auto;margin-bottom:18px">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg2)">
        <th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase;width:44px">Photo</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;min-width:100px">${t('name')}</th>
        <th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase">Fill</th>
        <th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase">Border</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase">$/Chair</th>
      </tr></thead>
      <tbody>${chairRows}</tbody>
    </table>
  </div>
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--light);margin-bottom:8px">Centerpiece Types</div>
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg2)">
        <th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;min-width:120px">Name</th>
        <th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase">Color</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase">$/Piece</th>
      </tr></thead>
      <tbody>${cpRows}</tbody>
    </table>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Close</button>
    <button class="btn btn-primary" onclick="saveLayoutStyles();closeMo();renderLayout();toast('Styles saved','s')">Save & Apply</button>
  </div>`);
}




function exportLayoutFull(layoutName){
  const p=proj();
  const items=LState.items || [];
  const extras=ensureLayoutQuoteState(p);
  const quote=getLayoutQuoteSummary(items, extras);
  if(!quote.autoRows.length && !quote.extraRows.length) return toast(LANG==='es'?'No hay elementos para exportar':'No items to export','e');

  const isES = LANG==='es';
  const floorplan = (LState.floorplan && LState.floorplan.img) ? LState.floorplan : (p.floorplan || null);
  const graphic = items.length ? buildLayoutSnapshotGraphic({ items: items, floorplan: floorplan, maxWidth: 1200 }) : null;
  const name = layoutName || p.name || (isES ? 'Plano' : 'Layout');
  const exportedOn = new Date().toLocaleDateString(isES ? 'es-MX' : 'en-US', { year:'numeric', month:'short', day:'numeric' });

  function money(v){ return fmtMoney(Number(v||0)); }
  function text(v){ return esc(v==null ? '' : String(v)); }

  const autoRowsHtml = quote.autoRows.map(function(row){
    return `
      <tr>
        <td>${text(row.label)}</td>
        <td class="num">${text(row.qty)}</td>
        <td>${text(row.chairStyle || (isES ? 'Predeterminada' : 'Default'))}</td>
        <td>${text(row.centerpiece || (isES ? 'Ninguno' : 'None'))}</td>
        <td class="num">${text(row.chairsPerUnit)}</td>
        <td class="num">${money(row.unitElementPrice)}</td>
        <td class="num">${money(row.unitChairPriceTotal)}</td>
        <td class="num">${money(row.unitCenterpiecePrice)}</td>
        <td class="num strong">${money(row.unitTotal)}</td>
        <td class="num strong">${money(row.rowTotal)}</td>
      </tr>`;
  }).join('');

  const extraRowsHtml = quote.extraRows.map(function(row){
    return `
      <tr>
        <td>${text(row.name || (isES ? 'Elemento personalizado' : 'Custom item'))}</td>
        <td>${text(row.category)}</td>
        <td>${text(row.notes)}</td>
        <td class="num">${text(row.quantity)}</td>
        <td class="num">${money(row.unitPrice)}</td>
        <td class="num strong">${money(row.rowTotal)}</td>
      </tr>`;
  }).join('');

  const previewHtml = graphic ? `
    <section class="panel">
      <h2>${isES?'Vista del plano':'Layout preview'}</h2>
      <div class="preview-wrap">
        <img src="${graphic.image}" alt="${text(name)}" class="preview-img">
      </div>
    </section>` : '';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${text(name)} - ${text(t('layout_quote_title'))}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;padding:32px;font-family:Segoe UI,Arial,sans-serif;background:#f6f1e8;color:#241f17}
  .page{max-width:1180px;margin:0 auto}
  .hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:24px}
  .hero h1{margin:0 0 6px;font-size:32px;line-height:1.1}
  .sub{color:#6f665c;font-size:14px}
  .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:24px}
  .stat,.panel{background:#fff;border:1px solid #e7dccb;border-radius:16px;box-shadow:0 10px 30px rgba(36,31,23,.06)}
  .stat{padding:16px 18px}
  .stat .n{font-size:26px;font-weight:700;color:#8a6a1d}
  .stat .l{font-size:12px;color:#6f665c;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
  .panel{padding:18px 18px 16px;margin-bottom:18px}
  .panel h2{margin:0 0 14px;font-size:17px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:10px 8px;border-bottom:1px solid #eee6da;vertical-align:top}
  th{text-align:left;background:#faf7f2;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6f665c}
  td.num, th.num{text-align:right}
  .strong{font-weight:700;color:#8a6a1d}
  .total-row td{background:#fbf5e7;font-weight:700}
  .preview-wrap{border:1px solid #eee6da;border-radius:14px;background:#fff;padding:12px}
  .preview-img{display:block;width:100%;height:auto;border-radius:10px}
  .footer{display:flex;justify-content:flex-end;margin-top:24px}
  .print-btn{padding:12px 26px;background:#c9a84c;border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer}
  @media print{
    body{background:#fff;padding:0}
    .page{max-width:none}
    .footer{display:none}
    .panel,.stat{box-shadow:none}
  }
</style>
</head>
<body>
<div class="page">
  <section class="hero">
    <div>
      <h1>${text(name)}</h1>
      <div class="sub">${text(t('layout_quote_title'))} � ${text(exportedOn)}</div>
      <div class="sub">${text(t('layout_quote_sub'))}</div>
    </div>
  </section>

  <section class="stats">
    <div class="stat"><div class="n">${money(quote.total)}</div><div class="l">${text(t('layout_quote_title'))}</div></div>
    <div class="stat"><div class="n">${text(quote.totalElements)}</div><div class="l">${text(isES?'Elementos cotizados':'Quoted elements')}</div></div>
    <div class="stat"><div class="n">${text(quote.totalSeats)}</div><div class="l">${text(isES?'Asientos totales':'Total seats')}</div></div>
  </section>

  ${previewHtml}

  <section class="panel">
    <h2>${text(t('layout_quote_auto'))}</h2>
    <table>
      <thead>
        <tr>
          <th>${text(t('layout_quote_item'))}</th>
          <th class="num">${text(t('layout_quote_quantity'))}</th>
          <th>${text(t('chair_style'))}</th>
          <th>${text(t('centerpiece'))}</th>
          <th class="num">${text(t('layout_quote_seats_unit'))}</th>
          <th class="num">${text(t('layout_quote_base'))}</th>
          <th class="num">${text(t('layout_quote_chair_cost'))}</th>
          <th class="num">${text(t('layout_quote_centerpiece_cost'))}</th>
          <th class="num">${text(t('layout_quote_unit_total'))}</th>
          <th class="num">${text(t('layout_quote_row_total'))}</th>
        </tr>
      </thead>
      <tbody>
        ${autoRowsHtml || `<tr><td colspan="10">${text(t('layout_quote_empty_sub'))}</td></tr>`}
        <tr class="total-row"><td colspan="9">${text(isES?'Subtotal de layout':'Layout subtotal')}</td><td class="num">${money(quote.autoTotal)}</td></tr>
      </tbody>
    </table>
  </section>

  <section class="panel">
    <h2>${text(t('layout_quote_custom'))}</h2>
    <table>
      <thead>
        <tr>
          <th>${text(t('layout_quote_item'))}</th>
          <th>${text(t('layout_quote_custom_category'))}</th>
          <th>${text(t('layout_quote_notes'))}</th>
          <th class="num">${text(t('layout_quote_quantity'))}</th>
          <th class="num">${text(t('layout_quote_unit_price'))}</th>
          <th class="num">${text(t('layout_quote_row_total'))}</th>
        </tr>
      </thead>
      <tbody>
        ${extraRowsHtml || `<tr><td colspan="6">${text(t('layout_quote_empty_sub'))}</td></tr>`}
        <tr class="total-row"><td colspan="5">${text(isES?'Subtotal personalizado':'Custom subtotal')}</td><td class="num">${money(quote.extrasTotal)}</td></tr>
        <tr class="total-row"><td colspan="5">${text(isES?'Total general':'Grand total')}</td><td class="num">${money(quote.total)}</td></tr>
      </tbody>
    </table>
  </section>

  <div class="footer">
    <button class="print-btn" onclick="window.print()">${text(isES?'Imprimir / Guardar PDF':'Print / Save PDF')}</button>
  </div>
</div>
</body>
</html>`;

  const blob=new Blob([html],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Layout_${name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  toast(isES?'Exportaci�n descargada':'Export downloaded','s');
}

function exportLayoutPDF(){ exportLayoutFull(); }







    _lDragItem=null;_lDragOffsets={};_lDragAxisLock=null;




