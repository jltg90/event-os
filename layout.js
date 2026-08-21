// -- Layout dirty tracking --
var _layoutDirty = false;
function markLayoutDirty(){ _layoutDirty = true; }
function clearLayoutDirty(){ _layoutDirty = false; }
function isLayoutDirty(){ return _layoutDirty; }

// -- Layout listener cleanup registry --
var _layoutListeners = [];
function _lListen(target, event, handler, opts){
  target.addEventListener(event, handler, opts);
  _layoutListeners.push({target:target, event:event, handler:handler, opts:opts});
}
function layoutCleanup(){
  window.removeEventListener('mousemove', lCanvasMove);
  window.removeEventListener('mouseup', lCanvasUp);
  _layoutListeners.forEach(function(l){
    try{ l.target.removeEventListener(l.event, l.handler, l.opts); }catch(e){}
  });
  _layoutListeners = [];
  // Reset rAF throttle state to prevent stale flags blocking next layout session
  if(typeof _lMoveRafPending !== 'undefined') _lMoveRafPending = false;
  if(typeof _lMoveCachedRect !== 'undefined') _lMoveCachedRect = null;
}

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
var _layoutRefreshPending = {};

function isLibraryLayoutEditing(){
  return typeof _libEditingLayoutId!=='undefined' && !!_libEditingLayoutId;
}

function isEventLayoutViewOnly(p){
  return !!(p && p.id && p.id!=='__library__' && p.id!=='__lib_layout__' && !isLibraryLayoutEditing());
}

// ─── Multi-layout support ───────────────────────────────────────────────────
function ensureEventLayouts(p){
  if(!p) return [];
  if(!p.eventLayouts){
    p.eventLayouts = [];
    if(p.layoutExport){
      p.eventLayouts.push({
        id: 'el_' + Date.now(),
        layoutExport: p.layoutExport,
        addedAt: p.layoutExport.exportedAt || new Date().toISOString(),
        active: true
      });
    }
  }
  return p.eventLayouts;
}

function getActiveEventLayout(p){
  var layouts = ensureEventLayouts(p);
  var active = layouts.find(function(e){ return e.active; });
  return active || layouts[0] || null;
}

function switchEventLayout(elId){
  var p = proj(); if(!p) return;
  var layouts = ensureEventLayouts(p);
  var entry = layouts.find(function(e){ return e.id === elId; });
  if(!entry) return;
  layouts.forEach(function(e){ e.active = false; });
  entry.active = true;
  p.layoutExport = entry.layoutExport;
  saveProj(p);
  var panelWasOpen = _eventLayoutsPanelOpen;
  if(_eventLayoutsPanelOpen) closeEventLayoutsPanel();
  if(typeof CTAB!=='undefined' && CTAB==='layout') renderLayout();
  // Re-open panel after re-render so active badge updates immediately
  if(panelWasOpen) setTimeout(function(){ openEventLayoutsPanel(); }, 0);
}

function removeEventLayout(elId){
  var p = proj(); if(!p) return;
  var isES = LANG==='es';
  var layouts = ensureEventLayouts(p);
  var idx = layouts.findIndex(function(e){ return e.id === elId; });
  if(idx < 0) return;
  var wasActive = layouts[idx].active;
  var name = (layouts[idx].layoutExport && layouts[idx].layoutExport.layoutName) || '';
  layouts.splice(idx, 1);
  if(wasActive){
    if(layouts.length > 0){
      layouts[0].active = true;
      p.layoutExport = layouts[0].layoutExport;
    } else {
      p.layoutExport = null;
    }
  }
  saveProj(p);
  toast((isES ? 'Layout removido: ' : 'Layout removed: ') + name, 's');
  closeEventLayoutsPanel();
  if(typeof CTAB!=='undefined' && CTAB==='layout') renderLayout();
  // Re-open panel after re-render if there are still layouts to show
  if(layouts.length) setTimeout(function(){ openEventLayoutsPanel(); }, 0);
}

function renderEventLayoutsBtn(){
  // Layouts button is now rendered inline in renderEventLayoutViewer — no-op
}

var _eventLayoutsPanelOpen = false;
function openEventLayoutsPanel(){
  // Check actual DOM — renderLayout() may have destroyed the panel without calling close
  var existingPanel = document.getElementById('event-layouts-panel');
  if(_eventLayoutsPanelOpen && existingPanel){ closeEventLayoutsPanel(); return; }
  if(!existingPanel) _eventLayoutsPanelOpen = false;
  _eventLayoutsPanelOpen = true;
  var p = proj(); if(!p) return;
  var isES = LANG==='es';
  var layouts = ensureEventLayouts(p);
  var rows = layouts.map(function(entry){
    var exp = entry.layoutExport || {};
    var isActive = !!entry.active;
    var date = exp.exportedAt ? new Date(exp.exportedAt).toLocaleDateString(isES?'es-MX':'en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
    var tables = exp.summary && exp.summary.tables ? exp.summary.tables : 0;
    var guests = exp.summary && exp.summary.guests ? exp.summary.guests : '-';
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid '+(isActive?'var(--gold)':'var(--border)')+';background:'+(isActive?'var(--gold-l)':'var(--card)')+';cursor:pointer;transition:.15s" onclick="switchEventLayout(\''+entry.id+'\')">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(exp.layoutName || 'Layout')+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+tables+' '+(isES?'mesas':'tables')+' · '+guests+' '+(isES?'inv.':'guests')+(date ? ' · '+date : '')+'</div>'
      +'</div>'
      +(isActive ? '<span style="font-size:10px;font-weight:700;color:var(--gold-h);text-transform:uppercase;letter-spacing:.05em;flex-shrink:0">'+(isES?'Activo':'Active')+'</span>' : '')
      +'<button class="btn btn-ghost btn-sm btn-icon" title="'+(isES?'Eliminar':'Remove')+'" onclick="event.stopPropagation();removeEventLayout(\''+entry.id+'\')" style="flex-shrink:0;color:var(--danger)"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>'
      +'</div>';
  }).join('');

  var emptyMsg = !layouts.length
    ? '<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px">'+(isES?'No hay layouts cargados en este evento.':'No layouts loaded into this event.')+'</div>'
    : '';

  var panel = document.createElement('div');
  panel.id = 'event-layouts-panel';
  panel.style.cssText = 'position:absolute;top:100%;right:0;z-index:900;width:340px;max-height:70vh;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.15);padding:14px;margin-top:4px';
  panel.innerHTML = '<div style="font-family:Cormorant Garamond,serif;font-size:20px;font-weight:700;margin-bottom:12px">'+(isES?'Layouts del Evento':'Event Layouts')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">'+rows+emptyMsg+'</div>'
    +'<button class="btn btn-primary" style="width:100%" onclick="closeEventLayoutsPanel();openLayoutLibraryPicker()">'
    +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:6px"><path d="M12 5v14M5 12h14"/></svg>'
    +(isES?'Cargar otro layout':'Load another layout')+'</button>';

  var anchor = document.getElementById('ev-layouts-wrap');
  if(!anchor) return;
  // Remove existing
  var old = document.getElementById('event-layouts-panel');
  if(old) old.remove();
  anchor.appendChild(panel);

  // Close on outside click
  setTimeout(function(){
    document.addEventListener('click', _closeLayoutsPanelOutside, true);
  }, 0);
}

function _closeLayoutsPanelOutside(e){
  var panel = document.getElementById('event-layouts-panel');
  var btn = document.getElementById('ev-layouts-btn');
  if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)){
    closeEventLayoutsPanel();
  }
}

function closeEventLayoutsPanel(){
  _eventLayoutsPanelOpen = false;
  var el = document.getElementById('event-layouts-panel');
  if(el) el.remove();
  document.removeEventListener('click', _closeLayoutsPanelOutside, true);
}

window.switchEventLayout = switchEventLayout;
window.removeEventLayout = removeEventLayout;
window.openEventLayoutsPanel = openEventLayoutsPanel;
window.closeEventLayoutsPanel = closeEventLayoutsPanel;
window.renderEventLayoutsBtn = renderEventLayoutsBtn;

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
  var CHAIR_GAP = 0;
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
    var isSTable = item.shape==='s-table';
    var rot = item.rotation || 0;
    var iw = sc(item.w);
    var ih = sc(item.h);
    var ix = sx(item.x);
    var iy = sy(item.y);
    var inner = '';

    // ── Chairs ── same distribution logic as renderChairs() in editor
    if(item.chairs){
      var n = item.chairs;
      var cs = Math.max(4, Math.round(CHAIR_SZ * scale));
      var gap = Math.round(CHAIR_GAP * scale);
      var cType = item.chairType || 'default';
      var ct = CHAIR_TYPES[cType] || CHAIR_TYPES['default'];
      var cfill = ct ? ct.fill : '#e8e4d8';
      var positions = [];
      var w = sc(item.w), h = sc(item.h);

      if(isSTable){
        var half = Math.floor(n/2);
        var is16 = n >= 16;
        var sAmp=h*0.19, sBh=h/2, sBandW=h*0.22;
        function _sSvgTop(t){ return sBh - sAmp*Math.sin(t*Math.PI) - sBandW + (sBandW*0.35)*Math.sin(t*Math.PI); }
        function _sSvgBot(t){ return sBh + sAmp*Math.sin(t*Math.PI) + sBandW - (sBandW*0.35)*Math.sin(t*Math.PI); }
        for(var ci=0;ci<half;ci++){
          var tc=(is16?(ci+0.5)/half:(ci+1)/(half+1));
          positions.push({x:tc*w, y:_sSvgTop(tc)-(cs/2+gap)});
        }
        for(var ci2=0;ci2<half;ci2++){
          var tc2=(is16?(ci2+0.5)/half:(ci2+1)/(half+1));
          positions.push({x:tc2*w, y:_sSvgBot(tc2)+(cs/2+gap)});
        }
      } else if(isRound){
        for(var i=0;i<n;i++){
          var angle=(i/n)*2*Math.PI - Math.PI/2;
          positions.push({x:w/2+(w/2+cs/2+gap)*Math.cos(angle), y:h/2+(h/2+cs/2+gap)*Math.sin(angle)});
        }
      } else if(item.shape==='rect-table'){
        var _sides=item.chairSides||_defaultRectChairSides(n);
        var _topN=_sides.top||0, _botN=_sides.bottom||0, _leftN=_sides.left||0, _rightN=_sides.right||0;
        var _sgTop=_getRectSideGapPx(item,'top',item.w,_topN)*scale;
        var _sgBot=_getRectSideGapPx(item,'bottom',item.w,_botN)*scale;
        var _sgLeft=_getRectSideGapPx(item,'left',item.h,_leftN)*scale;
        var _sgRight=_getRectSideGapPx(item,'right',item.h,_rightN)*scale;
        if(_topN){var _tw=_topN*cs+(_topN-1)*_sgTop;var _sx=(w-_tw)/2+cs/2;for(var j=0;j<_topN;j++) positions.push({x:_sx+j*(cs+_sgTop), y:-(cs/2+gap)});}
        if(_botN){var _bw=_botN*cs+(_botN-1)*_sgBot;var _sbx=(w-_bw)/2+cs/2;for(var k=0;k<_botN;k++) positions.push({x:_sbx+k*(cs+_sgBot), y:h+cs/2+gap});}
        if(_leftN){var _lh=_leftN*cs+(_leftN-1)*_sgLeft;var _sly=(h-_lh)/2+cs/2;for(var l=0;l<_leftN;l++) positions.push({x:-(cs/2+gap), y:_sly+l*(cs+_sgLeft)});}
        if(_rightN){var _rh=_rightN*cs+(_rightN-1)*_sgRight;var _sry=(h-_rh)/2+cs/2;for(var m=0;m<_rightN;m++) positions.push({x:w+cs/2+gap, y:_sry+m*(cs+_sgRight)});}
      } else {
        var chairSlot=cs+5;
        var longCap=Math.max(1,Math.floor(w/chairSlot));
        var top2=0,bot2=0,left2=0,right2=0;
        if(n<=2*longCap){ top2=Math.ceil(n/2); bot2=Math.floor(n/2); }
        else { top2=longCap; bot2=longCap; var rem=n-top2-bot2; left2=Math.ceil(rem/2); right2=Math.floor(rem/2); }
        for(var n1=0;n1<top2;n1++) positions.push({x:(n1+1)*w/(top2+1), y:-(cs/2+gap)});
        for(var n2=0;n2<bot2;n2++) positions.push({x:(n2+1)*w/(bot2+1), y:h+cs/2+gap});
        for(var n3=0;n3<left2;n3++) positions.push({x:-(cs/2+gap), y:(n3+1)*h/(left2+1)});
        for(var n4=0;n4<right2;n4++) positions.push({x:w+cs/2+gap, y:(n4+1)*h/(right2+1)});
      }
      // All chairs render as circles, no stroke — matches editor's border-radius:50%; border:none
      positions.forEach(function(pos){
        inner += '<ellipse cx="'+Math.round(pos.x)+'" cy="'+Math.round(pos.y)+'" rx="'+Math.round(cs/2)+'" ry="'+Math.round(cs/2)+'" fill="'+cfill+'" stroke="none"/>';
      });
    }

    // ── Dotted outline ──
    var _isOlTable=['round-table','rect-table','square-table'].includes(item.shape)||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape]._isCustomTable);
    var _olOff=item.outlineOffset!=null?item.outlineOffset:1.30;
    if(_olOff>0 && !isSTable && _isOlTable){
      var _olPx=Math.round(_olOff*PPM*scale);
      if(isRound){
        var _olRx=(iw/2)+_olPx, _olRy=(ih/2)+_olPx;
        inner += '<ellipse cx="'+(iw/2)+'" cy="'+(ih/2)+'" rx="'+_olRx+'" ry="'+_olRy+'" fill="none" stroke="'+(item.bdClr||'#999')+'" stroke-width="1" stroke-dasharray="4 3" opacity="0.45"/>';
      } else {
        inner += '<rect x="'+(-_olPx)+'" y="'+(-_olPx)+'" width="'+(iw+_olPx*2)+'" height="'+(ih+_olPx*2)+'" rx="0" fill="none" stroke="'+(item.bdClr||'#999')+'" stroke-width="1" stroke-dasharray="4 3" opacity="0.45"/>';
      }
    }

    // ── Table body ──
    if(isSTable){
      // Sinusoidal s-table path — matches _renderSTableBody() in editor
      var sW=iw, sH=ih;
      var sAmp2=sH*0.19, sBh2=sH/2, sBandW2=sH*0.22;
      var pts=40, topPath='', botPath='';
      for(var pi=0;pi<=pts;pi++){
        var pt=pi/pts, px2=pt*sW;
        var ty=sBh2-sAmp2*Math.sin(pt*Math.PI)-sBandW2+(sBandW2*0.35)*Math.sin(pt*Math.PI);
        topPath+=(pi===0?'M':'L')+px2.toFixed(1)+','+ty.toFixed(1);
      }
      for(var pi2=pts;pi2>=0;pi2--){
        var pt2=pi2/pts, px3=pt2*sW;
        var by=sBh2+sAmp2*Math.sin(pt2*Math.PI)+sBandW2-(sBandW2*0.35)*Math.sin(pt2*Math.PI);
        botPath+='L'+px3.toFixed(1)+','+by.toFixed(1);
      }
      inner += '<path d="'+topPath+botPath+'Z" fill="'+(item.bg||'#ffffff')+'" stroke="none" filter="url(#lsds)"/>';
    } else {
      var rx;
      if(isRound){ rx=Math.min(iw,ih)/2; }
      else {
        var shapeDef=LSHAPES_M[item.shape];
        if(shapeDef&&shapeDef.radius&&shapeDef.radius==='0px'){ rx=0; }
        else if(item.radius&&item.radius==='0px'){ rx=0; }
        else if(item.radius&&item.radius!=='50%'){ var rNum=parseFloat(item.radius); rx=isNaN(rNum)?3:rNum; }
        else { rx=3; }
      }
      // No colored stroke — matches editor (box-shadow only); drop-shadow filter approximates it
      inner += '<rect x="0" y="0" width="'+iw+'" height="'+ih+'" rx="'+rx+'" fill="'+(item.bg||'#ffffff')+'" stroke="none" filter="url(#lsds)"/>';
    }

    // ── Centerpiece ──
    if(item.centerpiece && item.centerpiece!=='none'){
      var ct2=CENTERPIECE_TYPES[item.centerpiece];
      if(ct2&&ct2.color){
        var cpSz=Math.round(Math.min(iw,ih)*0.55);
        inner += '<ellipse cx="'+(iw/2)+'" cy="'+(ih/2)+'" rx="'+(cpSz/2)+'" ry="'+(cpSz/2)+'" fill="'+ct2.color+'" opacity="0.55"/>';
      }
    }

    // ── Label — font-size range and weight match renderLItem() ──
    var wM = item.w / PPM;
    var fs = Math.max(7, Math.min(14, Math.round(wM * 8 * scale)));
    inner += '<text x="'+(iw/2)+'" y="'+(ih/2+fs*0.35)+'" text-anchor="middle" font-family="Jost,Segoe UI,Arial,sans-serif" font-size="'+fs+'" fill="'+(item.bdClr||'#444')+'" font-weight="300">'+esc(item.label||'')+'</text>';
    svgItems += '<g transform="translate('+ix+','+iy+') rotate('+rot+','+(iw/2)+','+(ih/2)+')">'+inner+'</g>\n';
  });

  var defs = '<defs><filter id="lsds" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.10"/></filter></defs>';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'"><rect width="'+svgW+'" height="'+svgH+'" fill="#ffffff"/>'+defs+svgItems+'</svg>';
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

// Returns the correct layout container element:
// - When the library layout editor is open, it renders into #lib-layout-canvas
// - Otherwise it renders into the project tab #tab-layout
function _layoutEl(){
  return document.getElementById(
    (typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId)
      ? 'lib-layout-canvas'
      : 'tab-layout'
  );
}

var _lvZoom = 1;
function _lvZoomSet(z, mx, my){
  var newZ = Math.max(0.5, Math.min(4, z));
  if(newZ === _lvZoom) return;
  var vp  = document.getElementById('lv-viewport');
  var img = document.getElementById('lv-img');
  var lbl = document.getElementById('lv-zoom-lbl');
  // Anchor: content coordinate currently under the cursor (or viewport centre)
  var anchorX, anchorY;
  if(vp){
    var ax = (mx != null) ? mx : vp.clientWidth  / 2;
    var ay = (my != null) ? my : vp.clientHeight / 2;
    anchorX = (vp.scrollLeft + ax) / _lvZoom;
    anchorY = (vp.scrollTop  + ay) / _lvZoom;
  }
  _lvZoom = newZ;
  if(img) img.style.width = Math.round(newZ * 100) + '%';
  if(lbl) lbl.textContent = Math.round(newZ * 100) + '%';
  // Restore the same content point under the cursor
  if(vp){
    vp.scrollLeft = anchorX * newZ - ax;
    vp.scrollTop  = anchorY * newZ - ay;
  }
}
function _lvZoomIn(){ _lvZoomSet(_lvZoom + 0.25); }
function _lvZoomOut(){ _lvZoomSet(_lvZoom - 0.25); }
function renderEventLayoutViewer(p){
  var el=_layoutEl();
  if(!el) return;
  var exp = p.layoutExport || null;
  var missingSource = false;
  if(exp && exp.layoutId && typeof getLib==='function'){
    missingSource = !getLib().layouts.some(function(entry){ return entry.id===exp.layoutId; });
  }
  var summary = exp && exp.summary ? exp.summary : null;
  var exportedAt = exp && exp.exportedAt ? new Date(exp.exportedAt) : null;
  var dateLabel = exportedAt && !isNaN(exportedAt) ? exportedAt.toLocaleDateString(LANG==='es'?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'}) : '';

  var layouts = ensureEventLayouts(p);

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
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:28px"><div style="max-width:560px;width:100%;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:34px;text-align:center;box-shadow:var(--sh-sm)"><div style="width:76px;height:76px;border-radius:50%;background:var(--gold-l);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;color:var(--gold-h)"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div style="font-family:Cormorant Garamond,serif;font-size:30px;font-weight:700;margin-bottom:10px">'+(LANG==="es"?"No hay layout exportado":"No exported layout yet")+'</div><div style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:24px">'+(LANG==="es"?"Los layouts ahora se crean y editan en la Biblioteca. Crea uno o importa uno a este evento para verlo aqui.":"Layouts are now created and edited in the Library. Create one or import one into this event to view it here.")+'</div><div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="openLayoutLibraryPicker()">'+(LANG==="es"?"Importa tu layout":"Import your layout")+'</button><button class="btn btn-ghost" onclick="openLayoutLibraryAndCreate()">'+(LANG==="es"?"Crear primer layout":"Create First Layout")+'</button></div></div></div>';
    return;
  }

  var summaryRows = summary && summary.elements && summary.elements.length
    ? summary.elements.map(function(row){
        var labels = row.labels && row.labels.length ? row.labels.join(', ') : '?';
        return '<tr><td style="padding:10px 12px;font-weight:600">'+esc(row.type)+'</td><td style="padding:10px 12px;color:var(--muted)">'+esc(row.dimensions)+'</td><td style="padding:10px 12px;text-align:center">'+row.qty+'</td><td style="padding:10px 12px;color:var(--muted)">'+esc(labels)+'</td></tr>';
      }).join('')
    : '<tr><td colspan="4" style="padding:14px 12px;color:var(--muted);text-align:center">'+(LANG==='es'?'No hay elementos en este layout':'No elements in this layout')+'</td></tr>';
  _lvZoom = 1;
  var isES = LANG==='es';
  var imgSection = exp.image
    ? '<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-bottom:10px">'
        +'<button class="btn btn-ghost btn-sm" onclick="_lvZoomOut()" title="'+(isES?'Alejar':'Zoom out')+'" style="padding:3px 10px;font-size:17px;line-height:1">−</button>'
        +'<span id="lv-zoom-lbl" style="font-size:11px;font-weight:700;color:var(--light);min-width:40px;text-align:center;letter-spacing:.04em">100%</span>'
        +'<button class="btn btn-ghost btn-sm" onclick="_lvZoomIn()" title="'+(isES?'Acercar':'Zoom in')+'" style="padding:3px 10px;font-size:17px;line-height:1">+</button>'
        +'<button class="btn btn-ghost btn-sm" onclick="_lvZoomSet(1)" style="font-size:11px;padding:3px 9px">'+(isES?'Ajustar':'Fit')+'</button>'
      +'</div>'
      +'<div id="lv-viewport" style="overflow:auto;max-height:72vh;border-radius:14px;border:1px solid var(--border);background:#fff;cursor:zoom-in">'
        +'<img id="lv-img" src="'+exp.image+'" alt="'+esc(exp.layoutName||'Layout')+'" style="display:block;width:100%;height:auto;border-radius:14px">'
      +'</div>'
    : '<div style="padding:44px;text-align:center;color:var(--muted)">'+(isES?'No se pudo generar la imagen del layout':'Could not generate the layout image')+'</div>';

  el.innerHTML = '<div style="max-width:1180px;margin:0 auto;padding:24px;width:100%"><div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-bottom:20px"><div style="flex:1;min-width:260px"><div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:700;margin-bottom:6px">'+esc(exp.layoutName || (isES?'Layout exportado':'Exported layout'))+'</div><div style="font-size:13px;color:var(--muted);line-height:1.6">'+(isES?'Vista de solo lectura del layout exportado desde la Biblioteca.':'Read-only view of the layout exported from the Library.')+(dateLabel?(' '+(isES?'Exportado el ':'Exported on ')+dateLabel+'.'):'')+'</div>'+(missingSource?'<div style="margin-top:12px;padding:10px 12px;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.08);border-radius:10px;font-size:12px;color:var(--danger)">'+(isES?'El layout fuente ya no existe en la Biblioteca. Puedes ver esta exportacion, pero no actualizarla.':'The source layout no longer exists in the Library. You can still view this export, but you cannot refresh it.')+'</div>':'')+'</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+(missingSource?'':'<button class="btn btn-ghost" onclick="openEventLayoutInLibrary()">'+(isES?'Editar en Biblioteca':'Edit in Library')+'</button>')+'<button class="btn btn-ghost" onclick="exportEventLayoutSnapshot()" style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>'+(isES?'Exportar PDF':'Export PDF')+'</button>'+'<div id="ev-layouts-wrap" style="position:relative"><button id="ev-layouts-btn" class="btn btn-ghost" onclick="openEventLayoutsPanel()" style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'+(isES?'Layouts':'Layouts')+' ('+layouts.length+')</button></div></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px"><div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">'+(isES?'Mesas':'Tables')+'</div><div style="font-size:24px;font-weight:700">'+((summary&&summary.tables)||0)+'</div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">'+(isES?'Invitados':'Guests')+'</div><div style="font-size:24px;font-weight:700">'+((summary&&summary.guests)||'-')+'</div></div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--sh-sm);margin-bottom:18px">'+imgSection+'</div><div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--sh-sm)"><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:700;margin-bottom:12px">'+(isES?'Resumen de Elementos':'Element Summary')+'</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)"><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(isES?'Elemento':'Element')+'</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(isES?'Dimensiones':'Dimensions')+'</th><th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(isES?'Cantidad':'Qty')+'</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted)">'+(isES?'Etiquetas':'Labels')+'</th></tr></thead><tbody>'+summaryRows+'</tbody></table></div></div>'+renderEventLayoutQuoteSection(p)+'</div>';

  var lv = document.getElementById('lv-viewport');
  if(lv){
    lv.addEventListener('wheel', function(e){
      e.preventDefault();
      var rect = lv.getBoundingClientRect();
      _lvZoomSet(_lvZoom + (e.deltaY < 0 ? 0.25 : -0.25), e.clientX - rect.left, e.clientY - rect.top);
    }, {passive:false});
    // Right-click drag to pan
    var _lvPan = null;
    lv.addEventListener('mousedown', function(e){
      if(e.button !== 2) return;
      _lvPan = {x: e.clientX, y: e.clientY, sl: lv.scrollLeft, st: lv.scrollTop};
      lv.style.cursor = 'grabbing';
      e.preventDefault();
    });
    lv.addEventListener('mousemove', function(e){
      if(!_lvPan) return;
      lv.scrollLeft = _lvPan.sl - (e.clientX - _lvPan.x);
      lv.scrollTop  = _lvPan.st - (e.clientY - _lvPan.y);
    });
    var _lvPanEnd = function(){ _lvPan = null; lv.style.cursor = 'zoom-in'; };
    lv.addEventListener('mouseup',    _lvPanEnd);
    lv.addEventListener('mouseleave', _lvPanEnd);
    lv.addEventListener('contextmenu', function(e){ if(_lvPan !== null || e.button === 2) e.preventDefault(); });
  }
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

function ensureEventLayoutFresh(p){
  if(!isEventLayoutViewOnly(p) || !p) return Promise.resolve(p ? p.layoutExport || null : null);
  if(!p.layoutExport || !p.layoutExport.layoutId) return ensureEventLayoutExport(p);
  if(typeof getLib!=='function' || typeof libApplyLayoutExportToEvent!=='function') return Promise.resolve(p.layoutExport);
  var libEntry = getLib().layouts.find(function(entry){ return entry.id===p.layoutExport.layoutId; });
  if(!libEntry) return Promise.resolve(p.layoutExport);
  var sourceVersion = libEntry.updatedAt || libEntry.date || '';
  // Skip refresh only if version matches AND the snapshot image is present.
  // The image is stripped before saving to Convex (to reduce size) and must be regenerated on load.
  if((p.layoutExport.libraryVersion || '') === sourceVersion && p.layoutExport.image) return Promise.resolve(p.layoutExport);
  if(_layoutRefreshPending[p.id]) return _layoutRefreshPending[p.id];
  _layoutRefreshPending[p.id] = libApplyLayoutExportToEvent(libEntry.id, p.id, {toastSuccess:false}).then(function(exp){
    delete _layoutRefreshPending[p.id];
    if(typeof CID!=='undefined' && CID===p.id && typeof CTAB!=='undefined' && CTAB==='layout') renderLayout();
    return exp || p.layoutExport || null;
  }).catch(function(err){
    delete _layoutRefreshPending[p.id];
    console.error('layout refresh failed', err);
    return p.layoutExport || null;
  });
  return _layoutRefreshPending[p.id];
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
      if(fpCopy._storageId){
        fpCopy.img='__stored__';
        delete fpCopy.thumb;
      } else if(fpCopy.img && fpCopy.img!=='__idb__' && fpCopy.img!=='__stored__'){
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
  dragging:false,dragStart:{x:0,y:0},snapGrid:20,useSnap:true,
  canvasW:8000,canvasH:6000,
  floorplan:{img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0},
  scaleMode:false,scalePoints:[],scalePt1El:null,scalePt2El:null,
  measureMode:false
};
var LDragOffset={};
var _canvasPad=2000;
var _layoutQuoteCollapsed=true;
var _layoutMobilePane='items';

function openLayoutImportModal(){
  var lib=getLib();
  var isES=LANG==='es';
  if(!lib.layouts.length){
    toast(isES?'No hay planos guardados en la biblioteca todavía':'No layouts saved in the library yet','e');
    return;
  }
  openMo('<div class="mo-title">'+(isES?'Importar Layout':'Import Layout')+'</div>'
    +'<p class="s-hint">'+(isES
      ?'Selecciona un plano para cargarlo en este evento. Esto reemplazará el diseño actual.'
      :'Select a layout to load into this event. This will replace the current layout.')+'</p>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px;max-height:55vh;overflow-y:auto">'
    +lib.layouts.map(function(e){
      var tables=e.items.filter(function(i){return i.shape&&i.shape.includes('table');}).length;
      var seats=e.items.reduce(function(s,i){return s+(i.chairs||0);},0);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;gap:10px">'
        +'<div style="min-width:0">'
          +'<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(e.name)+'</div>'
          +'<div class="s-sm">'+tables+' '+(isES?'mesas':'tables')+' · '+seats+' '+(isES?'asientos':'seats')+(e.date?' · '+esc(e.date):'')+'</div>'
        +'</div>'
        +'<button class="btn btn-primary btn-sm" style="flex-shrink:0" onclick="closeMo();_doLibLoadLayout(\''+e.id+'\')">'+t('lib_load_btn')+'</button>'
      +'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button></div>');
}
function renderLayout(){
  var _savedScroll={x:0,y:0};
  var _outerBefore=document.getElementById('lcanvas-outer');
  if(!_outerBefore) _layoutQuoteCollapsed=true;
  if(_outerBefore){_savedScroll.x=_outerBefore.scrollLeft;_savedScroll.y=_outerBefore.scrollTop;}
  const p=proj();
  if(!p){
    var _noProj=_layoutEl();
    if(_noProj) _noProj.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px"><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:700;color:var(--muted)">'+(LANG==='es'?'Selecciona un proyecto primero':'Select a project first')+'</div></div>';
    return;
  }
  if(isEventLayoutViewOnly(p)){
    // Sync p.layoutExport from the active eventLayouts entry (after reload, active may differ)
    if(p.eventLayouts && p.eventLayouts.length){
      var _activeEl = p.eventLayouts.find(function(e){ return e.active; }) || p.eventLayouts[0];
      if(_activeEl && _activeEl.layoutExport) p.layoutExport = _activeEl.layoutExport;
    }
    var needsMigration = !p.layoutExport && p.layoutItems && p.layoutItems.length;
    var needsRefresh = false;
    if(p.layoutExport && p.layoutExport.layoutId && typeof getLib==='function'){
      var currentLibEntry = getLib().layouts.find(function(entry){ return entry.id===p.layoutExport.layoutId; });
      var currentSourceVersion = currentLibEntry ? (currentLibEntry.updatedAt || currentLibEntry.date || '') : '';
      needsRefresh = !!(_layoutRefreshPending[p.id] || (currentLibEntry && ((p.layoutExport.libraryVersion || '') !== currentSourceVersion || !p.layoutExport.image)));
    }
    if(needsMigration || needsRefresh){
      ensureEventLayoutFresh(p);
      var migratingEl=_layoutEl();
      if(migratingEl){
        var syncTitle = needsRefresh
          ? (LANG==='es'?'Actualizando layout del evento':'Updating event layout')
          : (LANG==='es'?'Migrando layout del evento':'Migrating event layout');
        var syncBody = needsRefresh
          ? (LANG==='es'?'Estamos sincronizando este evento con la ultima version guardada en la Biblioteca.':'We are syncing this event with the latest version saved in the Library.')
          : (LANG==='es'?'Estamos moviendo este layout a la Biblioteca y generando su vista de solo lectura para el evento.':'We are moving this layout into the Library and generating its read-only event view.');
        migratingEl.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px;padding:24px;text-align:center"><div style="width:56px;height:56px;border-radius:50%;border:4px solid var(--border);border-top-color:var(--gold-h);animation:spin 1s linear infinite"></div><div style="font-family:Cormorant Garamond,serif;font-size:28px;font-weight:700">'+syncTitle+'</div><div style="max-width:420px;color:var(--muted);font-size:14px;line-height:1.6">'+syncBody+'</div></div>';
      }
      return;
    }
    renderEventLayoutViewer(p);
    return;
  }
  LState.items=p.layoutItems||[];
  ensureLayoutQuoteState(p);
  syncLayoutStyles(p);
  // Reset undo history when the project context changes (different event or library layout)
  if(p.id !== _LHistoryContextId){
    lHistoryReset();
    _LHistoryContextId = p.id;
  }
  if(LHistorySaving&&LHistory.length===0) lHistorySave();
  LSHAPES=getLSHAPES();
  var defaultFloorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0};
  var _hasFPInMemory=LState.floorplan&&LState.floorplan.img&&LState.floorplan.img!=='__idb__'&&LState.floorplan.img!=='__stored__';

  if(p.floorplan&&p.floorplan.img==='__stored__'&&p.floorplan._storageId){
    // Convex file storage: try IndexedDB cache first, then resolve from Convex
    if(_hasFPInMemory&&LState.floorplan._storageId===p.floorplan._storageId){
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:LState.floorplan.img,_storageId:p.floorplan._storageId});
    } else {
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:null});
      var _fpIdbKey=p.floorplan._idb;
      var _fpSid=p.floorplan._storageId;
      (function loadFP(){
        if(_fpIdbKey){
          _fpLoad(_fpIdbKey).then(function(data){
            if(data){LState.floorplan.img=data;renderLayoutCanvas();}
            else return EVENTOS_DATA.getFileUrl(_fpSid).then(function(url){if(url){LState.floorplan.img=url;renderLayoutCanvas();}});
          }).catch(function(){
            EVENTOS_DATA.getFileUrl(_fpSid).then(function(url){if(url){LState.floorplan.img=url;renderLayoutCanvas();}}).catch(function(){});
          });
        } else {
          EVENTOS_DATA.getFileUrl(_fpSid).then(function(url){if(url){LState.floorplan.img=url;renderLayoutCanvas();}}).catch(function(){});
        }
      })();
    }
  } else if(p.floorplan&&p.floorplan.img==='__idb__'&&p.floorplan._idb){
    if(_hasFPInMemory&&LState.floorplan._idb===p.floorplan._idb){
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:LState.floorplan.img,_idb:p.floorplan._idb});
    } else {
      LState.floorplan=Object.assign(defaultFloorplan,p.floorplan,{img:p.floorplan.thumb||null});
      _fpLoad(p.floorplan._idb).then(function(data){
        if(data){LState.floorplan.img=data;LState.floorplan._idb=p.floorplan._idb;renderLayoutCanvas();}
      }).catch(function(){});
    }
  } else if(p.floorplan&&p.floorplan.img&&p.floorplan.img!=='__idb__'&&p.floorplan.img!=='__stored__'){
    LState.floorplan=Object.assign(defaultFloorplan,p.floorplan);
  } else if(p.floorplan){
    LState.floorplan=Object.assign(defaultFloorplan,p.floorplan);
  } else {
    LState.floorplan=Object.assign(defaultFloorplan,{pxPerMeter:(p.floorplan&&p.floorplan.pxPerMeter)||null});
  }
  if(typeof _measureLines==='undefined')window._measureLines=[];
  if(typeof _measurePoints==='undefined')window._measurePoints=[];
  const el=_layoutEl();
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
    el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:60vh;padding:24px"><div style="max-width:520px;width:100%;text-align:center;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 28px;box-shadow:0 18px 44px rgba(0,0,0,.08)"><div style="width:76px;height:76px;border-radius:50%;background:var(--gold-l);display:flex;align-items:center;justify-content:center;margin:0 auto 22px"><svg width="34" height="34" fill="none" stroke="var(--gold-h)" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div style="font-family:Cormorant Garamond,serif;font-size:30px;font-weight:700;margin-bottom:10px">'+(LANG==='es'?'Crea tu primer layout':'Create your first layout')+'</div><div style="color:var(--muted);font-size:14px;line-height:1.6;max-width:420px;margin:0 auto 24px">'+(LANG==='es'?'Empieza desde cero o importa un layout guardado de tu biblioteca para este evento.':'Start from scratch or import a saved library layout into this event.')+'</div><div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap"><button class="btn btn-primary" style="padding:14px 26px;font-size:14px;font-weight:700" onclick="openLayoutLibraryAndCreate()">+ '+(LANG==='es'?'Crear primer layout':'Create First Layout')+'</button><button class="btn btn-ghost" style="padding:14px 22px;font-size:14px;font-weight:700" onclick="openLayoutImportModal()">'+(LANG==='es'?'Importa tu layout':'Import your layout')+'</button></div></div></div>';
    return;
  }
  var isPhone=isPhoneViewport();
  el.innerHTML=`
  <div class="layout-shell">
    <input id="layout-floorplan-input" type="file" accept="image/*" style="display:none" onchange="handleFloorplanUpload(event)">
    <!-- MAIN -->
    <!-- MAIN -->
    <!-- MAIN -->
    <div class="layout-main">
      <!-- Toolbar -->
      <div class="layout-toolbar">
        <div style="position:relative">
          <button id="add-element-trigger" class="btn btn-ghost btn-sm" onclick="toggleAddElementMenu()" style="height:28px;padding:0 10px;font-size:12px;white-space:nowrap">+ ${LANG==='es'?'Agregar elemento':'Add element'}</button>
          <div id="add-element-menu" style="display:none;position:absolute;left:0;top:calc(100% + 6px);min-width:200px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px;box-shadow:0 12px 24px rgba(0,0,0,0.12);z-index:50">
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('table')">${LANG==='es'?'Mesa':'Table'}</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('event-element')">${LANG==='es'?'Elemento de evento':'Event element'}</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px" onclick="selectAddElement('floorplan')">${LState.floorplan.img?(LANG==='es'?'Reemplazar plano':'Replace floorplan'):(LANG==='es'?'Plano (Imagen)':'Floorplan image')}</button>
            <div style="height:1px;background:var(--border);margin:6px 2px"></div>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px;color:var(--muted)" onclick="openChairEditor()">${LANG==='es'?'Gestionar sillas':'Manage chairs'}</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;padding:8px 10px;font-size:12px;color:var(--muted)" onclick="openCenterpieceEditor()">${LANG==='es'?'Gestionar centros de mesa':'Manage centerpieces'}</button>
          </div>
        </div>
        <div id="layout-zoom-bar" class="zoom-bar">
          <button class="zoom-btn" onclick="lZoom(-0.1)">-</button>
          <input id="layout-zoom-input" class="zoom-input" type="text" value="${Math.round(LState.zoom*100)}%" onkeydown="if(event.key==='Enter'){lZoomTo(this.value);this.blur();}" onblur="lZoomTo(this.value)" onfocus="this.select()">
          <button class="zoom-btn" onclick="lZoom(0.1)">+</button>
        </div>
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <button id="lbtn-zoom-fit" title="Zoom to fit" onclick="lZoom(0,'fit')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6"/></svg></button>
        <button id="lbtn-zoom-sel" title="Zoom to selected" onclick="lZoom(0,'sel')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="18" cy="18" r="3" fill="currentColor" stroke="none"/></svg></button>
        <button id="lbtn-measure" title="${LANG==='es'?'Medir distancias':'Measure distances'}" onclick="toggleMeasureMode()" style="width:28px;height:28px;border:1px solid ${LState.measureMode?'var(--gold)':'var(--border)'};background:${LState.measureMode?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${LState.measureMode?'var(--gold-h)':'var(--muted)'};transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="if(!LState.measureMode){this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'}"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2 2l20 20M6 2v4M2 6h4M18 22v-4M22 18h-4"/></svg></button>${_measureLines.length?`<button title="${LANG==='es'?'Borrar mediciones':'Clear measurements'}" onclick="clearMeasurements()" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--danger);transition:var(--tr)" onmouseover="this.style.background='rgba(220,53,69,.08)';this.style.borderColor='var(--danger)'" onmouseout="this.style.background='transparent';this.style.borderColor='var(--border)'"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`:''}
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <span style="font-size:12px;color:var(--muted)">
          ${LState.items.length} ${t('items_count')} |
          ${LState.items.filter(i=>i.shape.includes('table')).length} ${t('tables_lbl')} |
          ${LState.items.reduce((s,i)=>s+(i.chairs||0),0)} ${t('chairs_lbl')}

          ${LState.addMode?`<strong style="color:var(--gold-h)"> | Click canvas to place ${LState.addMode.replace('-',' ')}</strong>`:''}
        </span>
        <div style="flex:1"></div>
        ${(()=>{const q=getLayoutQuoteSummary(LState.items, ensureLayoutQuoteState(p));return (q.total>0||q.extraRows.length)?`<div id="layout-quote-total-pill" style="background:var(--gold-l);border:1px solid rgba(166,124,61,.3);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;color:var(--gold-h);cursor:pointer" onclick="showLayoutBudget()" title="${t('layout_quote_open')}">${t('layout_quote_title')}: ${formatCost(q.total)}</div>`:'';})()}
        <button id="lbtn-snap" onclick="LState.useSnap=!LState.useSnap;renderLayoutUI()" title="${LANG==='es'?'Alinear a objetos':'Snap to objects'}"
          style="height:28px;padding:0 10px;border:1px solid ${LState.useSnap?'var(--gold)':'var(--border)'};background:${LState.useSnap?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:${LState.useSnap?'var(--gold-h)':'var(--muted)'};transition:var(--tr);white-space:nowrap"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="if(!LState.useSnap)this.style.borderColor='var(--border)'">
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1 6h10"/><rect x="2" y="2" width="3" height="3" rx=".5"/><rect x="7" y="7" width="3" height="3" rx=".5"/></svg>${LState.useSnap?'Snap':'Snap'}</span>
        </button>
        ${LState.floorplan.img?`
        <div id="lbtn-floorplan" style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">${LANG==='es'?'Plano':'Floorplan'}</span>
          ${LState.scaleMode?`
          <span style="font-size:12px;color:var(--gold-h);font-weight:600;display:flex;align-items:center;gap:5px"><svg width="8" height="8" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor"/></svg>${LANG==='es'?'Calibrando escala…':'Calibrating scale…'}</span>
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
        <div id="lbtn-font" style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;opacity:1;gap:5px">
          <span style="font-size:10px;color:var(--muted);margin-right:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Aa</span>
          <button title="Decrease font size" onclick="changeFontSize(-1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">-</button>
          <span style="font-size:11px;color:var(--muted);min-width:44px;text-align:center"><input id="toolbar-font-size" type="number" min="5" max="99" style="width:44px;font-size:12px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px;background:var(--bg);color:var(--text)" placeholder="--" oninput="setFontSizeDirect(+this.value)" onkeydown="if(event.key==='Enter')this.blur();event.stopPropagation();" onclick="event.stopPropagation()"></span>
          <button title="Increase font size" onclick="changeFontSize(1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">+</button>
        </div>
        <div id="lbtn-align" style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:3px 6px;opacity:1">
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
        <div id="lbtn-rotate" style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;opacity:1">
          <button title="Rotate counterclockwise" onclick="doRotate(-getRotateStep())" style="width:32px;height:32px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 10H4V5"/><path d="M20 11a8 8 0 1 0-2.34 5.66L20 14"/></svg></button>
          <input id="rotate-step" type="number" value="90" min="1" step="1" style="width:54px;height:30px;border:1px solid var(--border);border-radius:5px;background:var(--bg2);color:var(--text);font-size:12px;text-align:center;padding:0 4px" title="Degrees per rotation step" onclick="event.stopPropagation()">
          <button title="Rotate clockwise" onclick="doRotate(getRotateStep())" style="width:32px;height:32px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 10h5V5"/><path d="M4 11a8 8 0 1 1 2.34 5.66L4 14"/></svg></button>
        </div>
        <button id="lbtn-export" class="btn btn-ghost btn-sm" onclick="exportLayoutFull()">${t('export')}</button>
        <button id="lbtn-highlights" class="btn btn-ghost btn-sm" onclick="startLayoutTour()" title="${LANG==='es'?'Ver guía interactiva':'Rewatch layout highlights'}" style="display:flex;align-items:center;gap:5px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/></svg>${LANG==='es'?'Guía':'Highlights'}</button>
      </div>
      ${isPhone?renderLayoutMobileQuickBar():''}
      ${isPhone?'':renderLayoutQuoteWorkspace(p)}
      <!-- Canvas -->
      <div class="layout-canvas-outer" id="lcanvas-outer"
        onmousedown="lCanvasDown(event)"
        oncontextmenu="return false"
        onmouseleave="lCanvasLeave(event)"
        style="position:relative;cursor:${LState.scaleMode||LState.measureMode?'crosshair':_fpDragging?'grabbing':'default'}">
        <div class="layout-canvas" id="lcanvas"
          style="width:${LState.canvasW}px;height:${LState.canvasH}px;margin:${_canvasPad}px;transform:scale(${LState.zoom});transform-origin:0 0;background:#fff;position:relative">
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
                <button class="btn btn-primary" style="padding:14px 28px;font-size:14px;font-weight:700" onclick="openLayoutLibraryAndCreate()">+ ${t("create_general_layout")||"Create General Layout"}</button>
                <button class="btn btn-ghost" style="padding:14px 22px;font-size:14px;font-weight:700" onclick="openLayoutImportModal()">${LANG==="es"?"Importa tu layout":"Import your layout"}</button>
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
              <text id="measure-preview-label" x="${_measurePoints[0].x}" y="${_measurePoints[0].y-10}" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">...</text>
            `:''}
          </svg>
        </div>
      ${LState.scaleMode?`<div id="scale-wizard" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" style="position:fixed;top:130px;left:50%;transform:translateX(-50%);z-index:500;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 22px;box-shadow:var(--sh-md);min-width:300px;max-width:400px;pointer-events:all">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:16px">
          <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;${LState.scalePoints.length===0?'background:var(--gold-h);color:#fff':'background:var(--gold-l);color:var(--gold-h);border:2px solid var(--gold-h)'}">${LState.scalePoints.length>0?'✓':'A'}</div>
          <div style="flex:1;height:1px;background:${LState.scalePoints.length>0?'var(--gold-h)':'var(--border)'}"></div>
          <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;${LState.scalePoints.length===1?'background:var(--gold-h);color:#fff':LState.scalePoints.length>1?'background:var(--gold-l);color:var(--gold-h);border:2px solid var(--gold-h)':'background:var(--bg2);color:var(--muted);border:2px solid var(--border)'}">${LState.scalePoints.length>1?'✓':'B'}</div>
          <div style="flex:1;height:1px;background:${LState.scalePoints.length>1?'var(--gold-h)':'var(--border)'}"></div>
          <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;${LState.scalePoints.length===2?'background:var(--gold-h);color:#fff':'background:var(--bg2);color:var(--muted);border:2px solid var(--border)'}">m</div>
        </div>
        ${LState.scalePoints.length===0?`<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><div style="width:36px;height:36px;border-radius:50%;background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg></div><div><div style="font-weight:700;font-size:14px">${LANG==='es'?'Haz clic en el punto A':'Click point A'}</div><div style="font-size:12px;color:var(--muted);margin-top:2px">${LANG==='es'?'Elige un extremo de una distancia conocida en el plano':'Pick one end of a known distance on the floorplan'}</div></div></div>`:''}
        ${LState.scalePoints.length===1?`<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><div style="width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg></div><div><div style="font-weight:700;font-size:14px">${LANG==='es'?'Haz clic en el punto B':'Click point B'}</div><div style="font-size:12px;color:var(--muted);margin-top:2px">${LANG==='es'?'Elige el otro extremo de la misma distancia':'Pick the other end of the same distance'}</div></div></div>`:''}
        ${LState.scalePoints.length>=2?`<div style="margin-bottom:14px"><div style="font-weight:700;font-size:14px;margin-bottom:3px">${LANG==='es'?'Ingresa la distancia real':'Enter real-world distance'}</div><div style="font-size:12px;color:var(--muted);margin-bottom:10px">${LANG==='es'?'¿Cuántos metros hay entre A y B en la realidad?':'How many meters apart are A and B in real life?'}</div><div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--muted);margin-bottom:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="8" x2="4" y2="16"/><line x1="20" y1="8" x2="20" y2="16"/></svg>${Math.round(Math.hypot(LState.scalePoints[1].x-LState.scalePoints[0].x,LState.scalePoints[1].y-LState.scalePoints[0].y))} px ${LANG==='es'?'medidos':'measured'}</div><div style="display:flex;align-items:center;gap:8px"><input id="scale-dist" type="number" step="0.1" min="0.1" placeholder="0.00" style="width:88px;height:34px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:14px;text-align:center;padding:0 8px" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){applyScaleCalibration();}event.stopPropagation();"><span style="font-size:13px;color:var(--muted);font-weight:600">m</span><button class="btn btn-primary btn-sm" onclick="applyScaleCalibration()" style="flex:1">${LANG==='es'?'Aplicar':'Apply'}</button></div></div>`:''}
        <button class="btn btn-ghost btn-sm" onclick="cancelScaleMode()" style="width:100%;justify-content:center;margin-top:2px">${LANG==='es'?'Cancelar':'Cancel'}</button>
      </div>`:''}
      </div>
      ${isPhone?renderLayoutMobileInspector(p):''}
      <div style="padding:5px 16px;background:var(--card);border-top:1px solid var(--border);font-size:10.5px;color:var(--muted);display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        ${isPhone?`
          <span>${LANG==='es'?'Arrastra para mover':'Drag to pan'}</span>
          <span>${LANG==='es'?'Pellizca para zoom':'Pinch to zoom'}</span>
          <span>${LANG==='es'?'Toca un elemento para moverlo':'Tap item to move'}</span>
          <span>${LANG==='es'?'Doble toque para editar':'Double-tap to edit'}</span>
          <span>${LANG==='es'?'Mantén presionado para opciones':'Long-press for options'}</span>
        `:`
          <span>${t('scroll_zoom')}</span>
          <span>${t('space_pan')}</span>
          <span>${t('drag_select')}</span>
          <span>${t('shift_drag_add')}</span>
          <span>${t('ctrl_drag_remove')}</span>
          <span>${t('shift_click_add')}</span>
          <span>${t('ctrl_click_desel')}</span>
          <span>${t('copy_paste')}</span>
          <span>${t('del_remove')}</span>
        `}
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
    } else {
      co.scrollLeft=_canvasPad;
      co.scrollTop=_canvasPad;
    }
  }
  syncLayoutMobileInspector();
}

function renderLayoutUI(){
  renderLayout();
}

function setLayoutMobilePane(pane){
  _layoutMobilePane=pane||'items';
  if(_layoutMobilePane==='quote') _layoutQuoteCollapsed=false;
  syncLayoutMobileInspector();
}

function renderLayoutMobileQuickBar(){
  var hasFloorplan=!!(LState.floorplan&&LState.floorplan.img);
  return `<div class="layout-mobile-quickbar">
    <div class="layout-mobile-quickrow">
      <button class="layout-mobile-btn lm-primary" onclick="toggleAddElementMenu()">${LANG==='es'?'Agregar':'Add'}</button>
      <button class="layout-mobile-btn" onclick="lZoom(0,'fit')">${LANG==='es'?'Ajustar':'Fit'}</button>
      <button class="layout-mobile-btn" onclick="lZoom(-0.1)">-</button>
      <button class="layout-mobile-btn" onclick="lZoom(0.1)">+</button>
      <button class="layout-mobile-btn" onclick="setLayoutMobilePane('items')">${LANG==='es'?'Items':'Items'}</button>
      <button class="layout-mobile-btn" onclick="setLayoutMobilePane('quote')">${LANG==='es'?'Cotización':'Quote'}</button>
      <button class="layout-mobile-btn" onclick="setLayoutMobilePane('properties')">${LANG==='es'?'Propiedades':'Properties'}</button>
      <button class="layout-mobile-btn" onclick="${hasFloorplan?'startScaleMode()':'triggerFloorplanUpload()'}">${hasFloorplan?(LANG==='es'?'Escalar':'Scale'):(LANG==='es'?'Plano':'Floorplan')}</button>
      <button class="layout-mobile-btn" onclick="startLayoutTour()">${LANG==='es'?'Guía':'Highlights'}</button>
    </div>
  </div>`;
}

function renderLayoutMobileInspector(p){
  var panes=[
    {key:'items',label:LANG==='es'?'Items':'Items'},
    {key:'selection',label:LANG==='es'?'Selección':'Selection'},
    {key:'properties',label:LANG==='es'?'Propiedades':'Properties'},
    {key:'quote',label:LANG==='es'?'Cotización':'Quote'}
  ];
  return `<div class="layout-mobile-inspector" id="layout-mobile-inspector">
    <div class="layout-mobile-tabs">
      ${panes.map(function(pane){
        return `<button class="layout-mobile-tab ${_layoutMobilePane===pane.key?'active':''}" data-pane="${pane.key}" onclick="setLayoutMobilePane('${pane.key}')">${pane.label}</button>`;
      }).join('')}
    </div>
    <div class="layout-mobile-pane" id="layout-mobile-pane">${renderLayoutMobileInspectorBody(p)}</div>
  </div>`;
}

function renderLayoutMobileInspectorBody(p){
  var items=LState.items||[];
  var selected=LState.items.filter(function(item){ return LState.sel.includes(item.id); });
  if(_layoutMobilePane==='selection'){
    if(!selected.length) return `<div class="layout-mobile-empty">${LANG==='es'?'Selecciona un elemento en el canvas para rotarlo, duplicarlo o eliminarlo.':'Select an item on the canvas to rotate, duplicate, or delete it.'}</div>`;
    return `<div class="mobile-meta-grid">
        ${renderMobileActionChip(LANG==='es'?'Seleccionados':'Selected', selected.length)}
        ${renderMobileActionChip(LANG==='es'?'Mesas':'Tables', selected.filter(function(item){ return String(item.shape||'').includes('table'); }).length)}
        ${renderMobileActionChip(LANG==='es'?'Sillas':'Chairs', selected.reduce(function(sum,item){ return sum+Number(item.chairs||0); },0))}
        ${renderMobileActionChip(LANG==='es'?'Rotación':'Rotation', selected.length===1?`${Math.round(selected[0].rotation||0)}°`:(LANG==='es'?'Múltiple':'Multiple'))}
      </div>
      <div class="layout-mobile-actions">
        <button class="btn btn-ghost btn-sm" onclick="lZoom(0,'sel')">${LANG==='es'?'Enfocar':'Focus'}</button>
        <button class="btn btn-ghost btn-sm" onclick="openSelectedLayoutItemModal()">${LANG==='es'?'Editar':'Edit'}</button>
        <button class="btn btn-ghost btn-sm" onclick="duplicateSelectedLayoutItems('copy')">${LANG==='es'?'Copiar':'Copy'}</button>
        <button class="btn btn-ghost btn-sm" onclick="duplicateSelectedLayoutItems('instance')">${LANG==='es'?'Instancia':'Instance'}</button>
        <button class="btn btn-ghost btn-sm" onclick="doRotate(-getRotateStep())">${LANG==='es'?'Girar -':'Rotate -'}</button>
        <button class="btn btn-ghost btn-sm" onclick="doRotate(getRotateStep())">${LANG==='es'?'Girar +':'Rotate +'}</button>
        <button class="btn btn-danger btn-sm" onclick="delSelected()">${LANG==='es'?'Eliminar':'Delete'}</button>
      </div>`;
  }
  if(_layoutMobilePane==='properties'){
    if(LState.sel.length!==1) return `<div class="layout-mobile-empty">${LANG==='es'?'Selecciona un solo elemento para editar sus propiedades.':'Select a single item to edit its properties.'}</div>`;
    return `<div id="lsb-props"><div id="lsb-props-inner"></div></div>`;
  }
  if(_layoutMobilePane==='quote'){
    return renderLayoutQuoteWorkspace(p);
  }
  if(!items.length) return `<div class="layout-mobile-empty">${LANG==='es'?'Tu layout aún no tiene elementos. Usa Agregar para empezar.':'Your layout has no elements yet. Use Add to get started.'}</div>`;
  return items.map(function(item){
    return `<button class="litem-list-row ${LState.sel.includes(item.id)?'sel-row':''}" data-id="${item.id}" style="width:100%;justify-content:space-between;border:1px solid var(--border);background:transparent" onclick="selectLayoutMobileItem('${item.id}')">
      <span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0">
        <span style="font-weight:700;color:var(--text)">${esc(item.label||getLayoutShapeLabel(item.shape))}</span>
        <span style="font-size:11px;color:var(--muted)">${esc(getLayoutShapeLabel(item.shape))}${item.chairs?` · ${item.chairs} ${LANG==='es'?'sillas':'chairs'}`:''}</span>
      </span>
      <span style="font-size:11px;color:var(--gold-h);font-weight:700">${Math.round(item.rotation||0)}°</span>
    </button>`;
  }).join('');
}

function syncLayoutMobileInspector(){
  var root=document.getElementById('layout-mobile-inspector');
  var pane=document.getElementById('layout-mobile-pane');
  if(!root || !pane) return;
  root.querySelectorAll('.layout-mobile-tab').forEach(function(tab){
    tab.classList.toggle('active', tab.dataset.pane===_layoutMobilePane);
  });
  pane.innerHTML=renderLayoutMobileInspectorBody(proj());
  if(_layoutMobilePane==='properties'&&LState.sel.length===1) renderLPropsPanel();
}

function selectLayoutMobileItem(id){
  LState.sel=[id];
  _layoutMobilePane='selection';
  updateSelUI();
  setTimeout(function(){ lZoom(0,'sel'); },30);
}

function duplicateSelectedLayoutItems(mode){
  if(!LState.sel.length) return;
  if(LState.sel.length===1){
    makeLayoutDuplicate(LState.sel[0], mode||'copy');
    return;
  }
  window.LClipboard=LState.items.filter(function(item){ return LState.sel.includes(item.id); }).map(function(item){ return JSON.parse(JSON.stringify(item)); });
  lPaste(mode==='instance'?'instance':'copy');
}

function openSelectedLayoutItemModal(){
  if(LState.sel.length!==1) return;
  openLItemModal(LState.sel[0]);
}

function ensureLayoutQuoteState(p){
  if(!p) return [];
  if(!p.layoutQuoteExtras) p.layoutQuoteExtras=[];
  return p.layoutQuoteExtras;
}

function getLayoutQuoteGroupKey(item){
  return [
    item.shape||'',
    item._elemKey||'',
    Math.round(item.w||0),
    Math.round(item.h||0),
    item.chairs||0,
    item.bg||'',
    item.bdClr||'',
    item.chairType||'default',
    item.centerpiece||'none',
    item._quoteGroup||''
  ].join('||');
}

function getLayoutShapeLabel(shape){
  if(typeof LSHAPES_M==='undefined' || !LSHAPES_M) LSHAPES_M=getLSHAPES();
  return LSHAPES_M[shape] && LSHAPES_M[shape].label ? LSHAPES_M[shape].label : String(shape||'Element').replace(/-/g,' ');
}

function getLayoutQuoteSummary(items, extras){
  items = items || [];
  extras = extras || [];
  if(typeof LSHAPES_M==='undefined' || !LSHAPES_M) LSHAPES_M=getLSHAPES();

  var elemGroups={};
  var chairCounts={};
  var cpCounts={};

  items.forEach(function(item){
    var key=getLayoutQuoteGroupKey(item);
    var shapeDef=LSHAPES_M[item.shape] || null;
    var isRound=item.shape==='round-table'||String(item.radius||'').indexOf('50')>=0||(shapeDef&&shapeDef.radius==='50%');
    if(!elemGroups[key]){
      var chairType=item.chairType||'default';
      var cpKey=item.centerpiece||'none';
      var chairDef=CHAIR_TYPES[chairType]||CHAIR_TYPES['default']||{label:chairType};
      var cpDef=CENTERPIECE_TYPES[cpKey]||{label:cpKey};
      elemGroups[key]={
        key:key,
        shape:item.shape,
        _elemKey:item._elemKey||'',
        label:item._quoteLabel||(item._elemKey?item.label:getLayoutShapeLabel(item.shape)),
        w:item.w||0,
        h:item.h||0,
        bg:item.bg||'#e8e2d8',
        bdClr:item.bdClr||'#b0a898',
        isRound:isRound,
        chairs:Number(item.chairs||0),
        chairType:chairType,
        chairLabel:chairDef.label||chairType,
        centerpieceKey:cpKey,
        centerpieceLabel:cpKey!=='none'?(cpDef.label||cpKey):null,
        cost:Number(item.cost||0),
        qty:0
      };
    }
    elemGroups[key].qty++;

    var _chairType=item.chairType||'default';
    var nChairs=Number(item.chairs||0);
    if(nChairs>0){
      chairCounts[_chairType]=(chairCounts[_chairType]||0)+nChairs;
    }

    var _cpKey=item.centerpiece||'none';
    if(_cpKey!=='none'){
      cpCounts[_cpKey]=(cpCounts[_cpKey]||0)+1;
    }
  });

  var elementRows=Object.keys(elemGroups).map(function(key){
    var row=elemGroups[key];
    row.rowTotal=row.cost*row.qty;
    return row;
  }).sort(function(a,b){ return a.label.localeCompare(b.label); });

  var chairRows=Object.keys(chairCounts).map(function(chairType){
    var def=CHAIR_TYPES[chairType]||CHAIR_TYPES['default']||{label:chairType,fill:'#e8e2d8',costPerChair:0};
    var qty=chairCounts[chairType];
    var unitPrice=Number(def.costPerChair||0);
    return {key:chairType, label:def.label||chairType, fill:def.fill||'#e8e2d8', qty:qty, unitPrice:unitPrice, rowTotal:qty*unitPrice};
  }).sort(function(a,b){ return a.label.localeCompare(b.label); });

  var centerpieceRows=Object.keys(cpCounts).map(function(cpKey){
    var def=CENTERPIECE_TYPES[cpKey]||{label:cpKey,color:'#a67c3d',cost:0};
    var qty=cpCounts[cpKey];
    var unitPrice=Number(def.cost||0);
    return {key:cpKey, label:def.label||cpKey, color:def.color||'#a67c3d', qty:qty, unitPrice:unitPrice, rowTotal:qty*unitPrice};
  }).sort(function(a,b){ return a.label.localeCompare(b.label); });

  var extraRows=extras.map(function(extra,index){
    var qty=Math.max(0,parseInt(extra.quantity,10)||0);
    var unitPrice=Number(extra.unitPrice||0);
    return {
      id:extra.id||('lqe_'+index),
      name:String(extra.name||'').trim(),
      category:String(extra.category||'').trim(),
      quantity:qty,
      unitPrice:unitPrice,
      notes:String(extra.notes||''),
      rowTotal:qty*unitPrice
    };
  });

  var elementsTotal=elementRows.reduce(function(s,r){ return s+r.rowTotal; },0);
  var chairsTotal=chairRows.reduce(function(s,r){ return s+r.rowTotal; },0);
  var centerpiecesTotal=centerpieceRows.reduce(function(s,r){ return s+r.rowTotal; },0);
  var extrasTotal=extraRows.reduce(function(s,r){ return s+r.rowTotal; },0);
  var totalSeats=items.reduce(function(s,item){ return s+Number(item.chairs||0); },0);
  var extraQtyTotal=extraRows.reduce(function(s,r){ return s+r.quantity; },0);
  var autoTotal=elementsTotal+chairsTotal+centerpiecesTotal;

  return {
    elementRows:elementRows,
    chairRows:chairRows,
    centerpieceRows:centerpieceRows,
    extraRows:extraRows,
    elementsTotal:elementsTotal,
    chairsTotal:chairsTotal,
    centerpiecesTotal:centerpiecesTotal,
    extrasTotal:extrasTotal,
    autoTotal:autoTotal,
    autoRows:elementRows,
    total:autoTotal+extrasTotal,
    totalSeats:totalSeats,
    layoutItemCount:items.length,
    extraQtyTotal:extraQtyTotal,
    totalElements:items.length+extraQtyTotal
  };
}

function renderLayoutQuoteWorkspace(p){
  if(!p) return '';
  var extras=ensureLayoutQuoteState(p);
  var quote=getLayoutQuoteSummary(LState.items, extras);
  var isES=LANG==='es';
  var hiddenBody=_layoutQuoteCollapsed ? 'display:none;' : '';
  var empty = !quote.elementRows.length && !quote.chairRows.length && !quote.centerpieceRows.length && !quote.extraRows.length;
  return `
    <div id="layout-quote-workspace" style="margin:0 12px 12px;background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">${t('layout_quote_title')}</div>
          <div style="font-size:12px;color:var(--muted)">${t('layout_quote_sub')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button id="lbtn-quote-toggle" class="btn btn-ghost btn-sm" onclick="toggleLayoutQuoteWorkspace()">${_layoutQuoteCollapsed?t('layout_quote_show'):t('layout_quote_hide')}</button>
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

function renderLayoutQuoteAutoTable(quote, prefix, readOnly){
  var pfx=prefix||'lQuote';
  var isES=LANG==='es';
  var hasElements=quote.elementRows.length>0;
  var hasChairs=quote.chairRows.length>0;
  var hasCenterpieces=quote.centerpieceRows.length>0;
  if(!hasElements&&!hasChairs&&!hasCenterpieces) return '';

  var ppm=typeof getPPM==='function'?getPPM():100;

  function elemSvg(row){
    var fill=row.bg||'#e8e2d8';
    var stroke=row.bdClr||'#b0a898';
    if(row.isRound){
      return '<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5"/></svg>';
    }
    return '<svg width="34" height="34" viewBox="0 0 34 34"><rect x="3" y="7" width="28" height="20" rx="3" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5"/></svg>';
  }

  function colorDot(color){
    return '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="'+(color||'#e8e2d8')+'" stroke="#c0b8ac" stroke-width="1"/></svg>';
  }

  function secHeader(label){
    return '<tr style="background:var(--bg2)"><td colspan="'+(readOnly?6:7)+'" style="padding:7px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">'+label+'</td></tr>';
  }

  var body='';

  if(hasElements){
    body+=secHeader(isES?'Elementos':'Elements');
    body+=quote.elementRows.map(function(row){
      var wM=(row.w/ppm).toFixed(1);
      var hM=(row.h/ppm).toFixed(1);
      var dims=row.w&&row.h?wM+' \xd7 '+hM+' m':'-';
      var tags=[];
      if(row.chairs>0) tags.push(row.chairs+(isES?' sillas':' chairs')+' \xb7 '+esc(row.chairLabel));
      if(row.centerpieceLabel) tags.push(esc(row.centerpieceLabel));
      var subLabel=tags.length?'<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:400">'+tags.join(' \xb7 ')+'</div>':'';
      var splitMergeBtn='';
      if(!readOnly){
        var _hasQG=row.key.indexOf('||')>=0&&row.key.split('||').pop()!=='';
        if(_hasQG){
          splitMergeBtn='<td style="padding:4px 6px;text-align:center"><button class="btn btn-ghost btn-sm" onclick="'+pfx+'MergeGroup(\''+row.key.replace(/'/g,"\\'")+'\')" title="'+(isES?'Reagrupar':'Merge')+'" style="font-size:10px;padding:2px 6px">↩</button></td>';
        } else if(row.qty>1){
          splitMergeBtn='<td style="padding:4px 6px;text-align:center"><button class="btn btn-ghost btn-sm" onclick="'+pfx+'SplitGroup(\''+row.key.replace(/'/g,"\\'")+'\')" title="'+(isES?'Separar':'Split')+'" style="font-size:10px;padding:2px 6px">✂</button></td>';
        } else {
          splitMergeBtn='<td></td>';
        }
      }
      var nameCell=readOnly
        ?'<td style="padding:9px 10px"><div style="font-size:12px;font-weight:600">'+esc(row.label)+'</div>'+subLabel+'</td>'
        :'<td style="padding:6px 8px"><input class="input" value="'+esc(row.label)+'" style="font-size:12px;font-weight:600;padding:5px 6px;min-width:100px" onchange="'+pfx+'RenameGroup(\''+row.key.replace(/'/g,"\\'")+'\',this.value)">'+subLabel+'</td>';
      return '<tr style="border-bottom:1px solid var(--bg2)">'+
        nameCell+
        '<td style="padding:5px 10px;text-align:center">'+elemSvg(row)+'</td>'+
        '<td style="padding:9px 10px;font-size:11px;color:var(--muted);white-space:nowrap">'+dims+'</td>'+
        '<td style="padding:9px 10px;text-align:center;font-size:12px">'+row.qty+'</td>'+
        (readOnly?'<td style="padding:9px 10px;font-size:12px">'+formatCost(row.cost)+'</td>':'<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.cost+'" style="font-size:11px;padding:5px 6px;width:90px" onchange="'+pfx+'UpdateGroupCost(\''+row.key+'\',this.value)"></td>')+
        '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
        splitMergeBtn+
      '</tr>';
    }).join('');
  }

  if(hasChairs){
    body+=secHeader(isES?'Sillas':'Chairs');
    body+=quote.chairRows.map(function(row){
      return '<tr style="border-bottom:1px solid var(--bg2)">'+
        '<td style="padding:9px 10px;font-size:12px;font-weight:600">'+esc(row.label)+'</td>'+
        '<td style="padding:5px 10px;text-align:center">'+colorDot(row.fill)+'</td>'+
        '<td style="padding:9px 10px;font-size:11px;color:var(--muted)">-</td>'+
        '<td style="padding:9px 10px;text-align:center;font-size:12px">'+row.qty+'</td>'+
        (readOnly?'<td style="padding:9px 10px;font-size:12px">'+formatCost(row.unitPrice)+'</td>':'<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.unitPrice+'" style="font-size:11px;padding:5px 6px;width:90px" title="'+(isES?'Precio por silla':'Price per chair')+'" onchange="'+pfx+'UpdateChairTypeCost(\''+row.key+'\',this.value)"></td>')+
        '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
        (readOnly?'':'<td></td>')+
      '</tr>';
    }).join('');
  }

  if(hasCenterpieces){
    body+=secHeader(isES?'Centros de mesa':'Centerpieces');
    body+=quote.centerpieceRows.map(function(row){
      return '<tr style="border-bottom:1px solid var(--bg2)">'+
        '<td style="padding:9px 10px;font-size:12px;font-weight:600">'+esc(row.label)+'</td>'+
        '<td style="padding:5px 10px;text-align:center">'+colorDot(row.color)+'</td>'+
        '<td style="padding:9px 10px;font-size:11px;color:var(--muted)">-</td>'+
        '<td style="padding:9px 10px;text-align:center;font-size:12px">'+row.qty+'</td>'+
        (readOnly?'<td style="padding:9px 10px;font-size:12px">'+formatCost(row.unitPrice)+'</td>':'<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.unitPrice+'" style="font-size:11px;padding:5px 6px;width:90px" title="'+(isES?'Precio por centro':'Price per piece')+'" onchange="'+pfx+'UpdateCenterpieceTypeCost(\''+row.key+'\',this.value)"></td>')+
        '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
        (readOnly?'':'<td></td>')+
      '</tr>';
    }).join('');
  }

  var layoutSubtotal=quote.elementsTotal+quote.chairsTotal+quote.centerpiecesTotal;

  return '<div style="padding:16px 16px 0">'+
    '<div style="overflow:auto;border:1px solid var(--border);border-radius:10px">'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff">'+
        '<thead><tr style="background:var(--bg2)">'+
          '<th style="padding:8px 10px;text-align:left">'+(isES?'Elemento':'Item')+'</th>'+
          '<th style="padding:8px 10px;text-align:center">'+(isES?'Vista':'Preview')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+(isES?'Dimensiones':'Dimensions')+'</th>'+
          '<th style="padding:8px 10px;text-align:center">'+t('layout_quote_quantity')+'</th>'+
          '<th style="padding:8px 10px;text-align:left">'+t('layout_quote_base')+'</th>'+
          '<th style="padding:8px 10px;text-align:right">'+t('layout_quote_row_total')+'</th>'+
          (readOnly?'':'<th style="padding:8px 6px;text-align:center;width:40px"></th>')+
        '</tr></thead>'+
        '<tbody>'+body+
          '<tr style="background:var(--gold-l)">'+
            '<td colspan="'+(readOnly?5:6)+'" style="padding:9px 12px;font-size:12px;font-weight:700">'+(isES?'Subtotal layout':'Layout subtotal')+'</td>'+
            '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(layoutSubtotal)+'</td>'+
          '</tr>'+
        '</tbody>'+
      '</table>'+
    '</div>'+
  '</div>';
}

function lQuoteUpdateChairTypeCost(chairType, val){
  if(!CHAIR_TYPES[chairType]) return;
  CHAIR_TYPES[chairType].costPerChair=Math.max(0,Number(val||0));
  saveLayoutStyles();
  renderLayoutUI();
}

function lQuoteUpdateCenterpieceTypeCost(cpKey, val){
  if(!CENTERPIECE_TYPES[cpKey]) return;
  CENTERPIECE_TYPES[cpKey].cost=Math.max(0,Number(val||0));
  saveLayoutStyles();
  renderLayoutUI();
}

function lQuoteSplitGroup(groupKey){
  var matching=LState.items.filter(function(i){return getLayoutQuoteGroupKey(i)===groupKey;});
  if(matching.length<2) return;
  matching[0]._quoteGroup='qg_'+Date.now()+Math.random().toString(36).slice(2,6);
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  renderLayoutUI();
}

function lQuoteMergeGroup(groupKey){
  LState.items.forEach(function(item){
    if(getLayoutQuoteGroupKey(item)===groupKey){
      delete item._quoteGroup;
    }
  });
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  renderLayoutUI();
}

function renderLayoutQuoteExtrasTable(quote, prefix){
  var pfx=prefix||'lQuote';
  if(!quote.extraRows.length) return '';
  var rows=quote.extraRows.map(function(row){
    return '<tr style="border-bottom:1px solid var(--bg2)">'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.name)+'" style="font-size:11px;padding:5px 6px;min-width:160px" onchange="'+pfx+'UpdateExtraField(\''+row.id+'\',\'name\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.category)+'" style="font-size:11px;padding:5px 6px;min-width:120px" onchange="'+pfx+'UpdateExtraField(\''+row.id+'\',\'category\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" type="number" min="0" step="1" value="'+row.quantity+'" style="font-size:11px;padding:5px 6px;min-width:70px" onchange="'+pfx+'UpdateExtraField(\''+row.id+'\',\'quantity\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" type="number" min="0" step="0.01" value="'+row.unitPrice+'" style="font-size:11px;padding:5px 6px;min-width:90px" onchange="'+pfx+'UpdateExtraField(\''+row.id+'\',\'unitPrice\',this.value)"></td>'+
      '<td style="padding:6px 8px"><input class="input" value="'+esc(row.notes)+'" style="font-size:11px;padding:5px 6px;min-width:180px" onchange="'+pfx+'UpdateExtraField(\''+row.id+'\',\'notes\',this.value)"></td>'+
      '<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--gold-h)">'+formatCost(row.rowTotal)+'</td>'+
      '<td style="padding:6px 8px;text-align:center"><button class="btn btn-danger btn-sm btn-icon" onclick="'+pfx+'DeleteExtra(\''+row.id+'\')" title="'+t('delete')+'"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td>'+
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
  lHistorySave();
  var cost=Math.max(0, Number(value||0));
  p.layoutItems=(p.layoutItems||[]).map(function(item){
    if(getLayoutQuoteGroupKey(item)===key) item.cost=cost;
    return item;
  });
  saveProj(p);
  LState.items=p.layoutItems;
  renderLayoutUI();
}

function lQuoteRenameGroup(key, newName){
  var name=String(newName||'').trim();
  if(!name) return;
  var p=proj();
  if(!p) return;
  lHistorySave();
  p.layoutItems=(p.layoutItems||[]).map(function(item){
    if(getLayoutQuoteGroupKey(item)===key) item._quoteLabel=name;
    return item;
  });
  saveProj(p);
  LState.items=p.layoutItems;
  renderLayoutUI();
}

function lQuoteUpdateGroupChairType(key, chairType){
  var p=proj();
  if(!p) return;
  lHistorySave();
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
  lHistorySave();
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
  lHistorySave();
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
  lHistorySave();
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
  lHistorySave();
  p.layoutQuoteExtras=ensureLayoutQuoteState(p).filter(function(entry){ return entry.id!==id; });
  saveProj(p);
  renderLayoutUI();
}

function renderEventLayoutQuoteSection(p){
  if(!p) return '';
  // Resolve items from the library entry (p.layoutItems is emptied on library import)
  var items=p.layoutItems||[];
  if(p.layoutExport && p.layoutExport.layoutId && typeof getLib==='function'){
    var _libE=getLib().layouts.find(function(e){ return e.id===p.layoutExport.layoutId; });
    if(_libE) items=_libE.items||[];
  }
  // Apply library entry's chair/centerpiece costs for quote calculation, then restore
  var _savedCT, _savedCP, _didSwap=false;
  if(_libE && (_libE.chairTypes || _libE.centerpieceTypes)){
    _savedCT=CHAIR_TYPES; _savedCP=CENTERPIECE_TYPES; _didSwap=true;
    syncLayoutStyles({chairTypes:_libE.chairTypes||{}, centerpieceTypes:_libE.centerpieceTypes||{}, customShapes:{}});
  }
  var quote=getLayoutQuoteSummary(items, []);
  if(_didSwap){ CHAIR_TYPES=_savedCT; CENTERPIECE_TYPES=_savedCP; }
  var isES=LANG==='es';
  var empty=!quote.elementRows.length&&!quote.chairRows.length&&!quote.centerpieceRows.length;
  return '<div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--sh-sm);margin-top:18px">'
    +'<div style="margin-bottom:14px">'
      +'<div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:700">'+(isES?'Cotización de Layout':'Layout Quote')+'</div>'
      +'<div style="font-size:12px;color:var(--muted)">'+(isES?'Precios definidos en el editor de layout de la Biblioteca':'Prices are defined in the Library layout editor')+'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px">'
      +'<div style="background:var(--bg2);border-radius:10px;padding:12px 14px">'
        +'<div style="font-size:20px;font-weight:700;color:var(--gold-h)">'+quote.totalElements+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+(isES?'Elementos cotizados':'Quoted elements')+'</div>'
      +'</div>'
      +'<div style="background:var(--bg2);border-radius:10px;padding:12px 14px">'
        +'<div style="font-size:20px;font-weight:700">'+quote.totalSeats+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+(isES?'Asientos totales':'Total seats')+'</div>'
      +'</div>'
      +'<div style="background:var(--gold-l);border-radius:10px;padding:12px 14px">'
        +'<div style="font-size:20px;font-weight:700;color:var(--gold-h)">'+formatCost(quote.total)+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+(isES?'Total estimado':'Estimated total')+'</div>'
      +'</div>'
    +'</div>'
    +(empty
      ?'<div style="padding:28px 18px;text-align:center">'
        +'<div style="font-size:15px;font-weight:700;margin-bottom:6px">'+(isES?'Sin elementos que cotizar':'No items to quote')+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">'+(isES?'Los precios se definen en el editor de la Biblioteca':'Prices are set in the Library editor')+'</div>'
        +'</div>'
      :renderLayoutQuoteAutoTable(quote, null, true))
    +'</div>';
}

function getChairPx(item){
  return Math.max(8, Math.round(CHAIR_SIZE_M * getPPM()));
}
function getChairGap(item){
  return 0;
}
function getChairPad(item){
  if(!item.chairs) return 0;
  return getChairPx(item) + getChairGap(item);
}
 
function renderLItem(item){
  const isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  const isSTable = item.shape==='s-table';
  const chairsHTML = renderChairs(item);
  const pad = getChairPad(item);
  const cornerRadius = isRound ? '50%' : '0px';
  const textClr = item.bdClr;
  const wM = item.w / getPPM();
  const autoFontSize = Math.max(7, Math.min(14, Math.round(wM * 8)));
  const fontSize = item.fontSize || autoFontSize;
  const seatsSize = Math.max(6, Math.min(11, Math.round(wM * 6)));
  const cpHTML = renderCenterpiece(item);
  const bodyHTML = isSTable ? _renderSTableBody(item) :
    `<div style="position:absolute;inset:0;border-radius:${cornerRadius};background:${item.bg};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10)">
        ${cpHTML}
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:2;pointer-events:none">
          <div class="litem-label" style="color:${textClr};font-size:${fontSize}px;font-weight:300;letter-spacing:0.03em;font-family:'Jost',sans-serif;text-align:center;line-height:1.2">${esc(item.label)}</div>
        </div>
      </div>`;
  return `<div class="litem ${LState.sel.includes(item.id)?'sel':''}"
    id="li_${item.id}"
    data-id="${item.id}"
    style="left:${item.x}px;top:${item.y}px;width:${item.w+pad*2}px;height:${item.h+pad*2}px;padding:${pad}px;transform:rotate(${item.rotation||0}deg);transform-origin:center center"
    ondblclick="openLItemModal('${item.id}')">
    <div style="position:relative;width:100%;height:100%">
      ${renderOutline(item)}
      ${chairsHTML}
      ${bodyHTML}
    </div>
  </div>`;
}

function _renderSTableBody(item){
  var w=item.w, h=item.h;
  var amp=h*0.19;
  var bh=h/2;
  var bandW=h*0.22;
  var pts=40;
  function topEdge(t){ return bh-amp*Math.sin(t*Math.PI)-bandW+(bandW*0.35)*Math.sin(t*Math.PI); }
  function botEdge(t){ return bh+amp*Math.sin(t*Math.PI)+bandW-(bandW*0.35)*Math.sin(t*Math.PI); }
  var topPath=''; var botPath='';
  for(var i=0;i<=pts;i++){
    var t=i/pts; var x=t*w;
    topPath+=(i===0?'M':'L')+x.toFixed(1)+','+topEdge(t).toFixed(1);
  }
  for(var i=pts;i>=0;i--){
    var t=i/pts; var x=t*w;
    botPath+='L'+x.toFixed(1)+','+botEdge(t).toFixed(1);
  }
  return '<div style="position:absolute;inset:0;overflow:visible;pointer-events:none">'
    +'<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="position:absolute;inset:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.10))">'
    +'<path d="'+topPath+botPath+'Z" fill="'+item.bg+'"/>'
    +'</svg>'
    +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none">'
    +'<div class="litem-label" style="color:'+item.bdClr+';font-size:'+(item.fontSize||Math.max(7,Math.min(14,Math.round((w/getPPM())*8))))+'px;font-weight:300;letter-spacing:0.03em;font-family:Jost,sans-serif;text-align:center;line-height:1.2">'+esc(item.label)+'</div>'
    +'</div></div>';
}

function renderOutline(item){
  var isTable=['round-table','rect-table','square-table'].includes(item.shape)||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape]._isCustomTable);
  if(!isTable) return '';
  var off=item.outlineOffset;
  if(off==null) off=(typeof DEFAULT_OUTLINE_OFFSET!=='undefined'?DEFAULT_OUTLINE_OFFSET:1.30);
  if(off<=0) return '';
  var ppm=getPPM();
  var offPx=Math.round(off*ppm);
  var isRound=item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  var isSTable=item.shape==='s-table';
  if(isSTable) return '';
  var br=isRound?'50%':(item.radius||'0px');
  return '<div style="position:absolute;left:'+ -offPx+'px;top:'+ -offPx+'px;width:'+(item.w+offPx*2)+'px;height:'+(item.h+offPx*2)+'px;border:1.5px dashed '+(item.bdClr||'#999')+';border-radius:'+br+';pointer-events:none;opacity:0.45;z-index:0"></div>';
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


function _updateRectChairTotal(){
  var top=+(document.getElementById('li-cs-top')||{}).value||0;
  var bot=+(document.getElementById('li-cs-bottom')||{}).value||0;
  var left=+(document.getElementById('li-cs-left')||{}).value||0;
  var right=+(document.getElementById('li-cs-right')||{}).value||0;
  var total=top+bot+left+right;
  var el=document.getElementById('li-chairs-total'); if(el) el.textContent=total;
  var hid=document.getElementById('li-chairs'); if(hid) hid.value=total;
}

// Returns per-side chair gap in px for a rect table.
// item.chairGaps stores {top,bottom,left,right} in meters; defaults to auto-fit.
function _getRectSideGapPx(item, side, sideLength, chairCount){
  var ppm=getPPM();
  if(item.chairGaps && item.chairGaps[side]!=null){
    return Math.round(item.chairGaps[side]*ppm);
  }
  // Auto: evenly distribute chairs along the side
  if(!chairCount) return 0;
  var cs=Math.max(8,Math.round(CHAIR_SIZE_M*ppm));
  var totalChair=chairCount*cs;
  var free=sideLength-totalChair;
  return chairCount>1?Math.max(0,free/(chairCount+1)):Math.max(0,free/2);
}

function _defaultRectChairSides(n){
  // Default: split evenly top/bottom, no short sides
  var top=Math.ceil(n/2), bot=Math.floor(n/2);
  return {top:top, bottom:bot, left:0, right:0};
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
  
  if(item.shape==='s-table'){
    // S-table: chairs along the serpentine edges
    const half=Math.floor(n/2);
    const amp=h*0.19; const bh=h/2; const bandW=h*0.22;
    function sTopEdge(t){ return bh-amp*Math.sin(t*Math.PI)-bandW+(bandW*0.35)*Math.sin(t*Math.PI); }
    function sBotEdge(t){ return bh+amp*Math.sin(t*Math.PI)+bandW-(bandW*0.35)*Math.sin(t*Math.PI); }
    const is16=n>=16;
    for(let ci=0;ci<half;ci++){
      const t=is16?(ci+0.5)/half:(ci+1)/(half+1);
      positions.push({x:t*w, y:sTopEdge(t)-(cs/2+gap)});
    }
    for(let ci=0;ci<half;ci++){
      const t=is16?(ci+0.5)/half:(ci+1)/(half+1);
      positions.push({x:t*w, y:sBotEdge(t)+(cs/2+gap)});
    }
  } else if(isRound){
    for(let i=0;i<n;i++){
      const angle=(i/n)*2*Math.PI - Math.PI/2;
      positions.push({x:w/2+(w/2+cs/2+gap)*Math.cos(angle), y:h/2+(h/2+cs/2+gap)*Math.sin(angle)});
    }
  } else if(item.shape==='rect-table'){
    const sides=item.chairSides||_defaultRectChairSides(n);
    const topN=sides.top||0, botN=sides.bottom||0, leftN=sides.left||0, rightN=sides.right||0;
    // Per-side gap: spacing between chairs along each side (in px)
    const gapTop=_getRectSideGapPx(item,'top',w,topN);
    const gapBot=_getRectSideGapPx(item,'bottom',w,botN);
    const gapLeft=_getRectSideGapPx(item,'left',h,leftN);
    const gapRight=_getRectSideGapPx(item,'right',h,rightN);
    // Top side — centered, chairs separated by gapTop
    if(topN){
      const totalW=topN*cs+(topN-1)*gapTop;
      const startX=(w-totalW)/2+cs/2;
      for(let i=0;i<topN;i++) positions.push({x:startX+i*(cs+gapTop), y:-(cs/2+gap)});
    }
    // Bottom side
    if(botN){
      const totalW=botN*cs+(botN-1)*gapBot;
      const startX=(w-totalW)/2+cs/2;
      for(let i=0;i<botN;i++) positions.push({x:startX+i*(cs+gapBot), y:h+cs/2+gap});
    }
    // Left side
    if(leftN){
      const totalH=leftN*cs+(leftN-1)*gapLeft;
      const startY=(h-totalH)/2+cs/2;
      for(let i=0;i<leftN;i++) positions.push({x:-(cs/2+gap), y:startY+i*(cs+gapLeft)});
    }
    // Right side
    if(rightN){
      const totalH=rightN*cs+(rightN-1)*gapRight;
      const startY=(h-totalH)/2+cs/2;
      for(let i=0;i<rightN;i++) positions.push({x:w+cs/2+gap, y:startY+i*(cs+gapRight)});
    }
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
  // Place item immediately at the center of the visible viewport
  LSHAPES=getLSHAPES();
  var def=LSHAPES[shape]||LSHAPES['round-table'];
  if(!def) return;
  var p=proj(); if(!p) return;
  var chairs=def.chairs||0;
  var _tempChairPx=Math.max(8,Math.round(CHAIR_SIZE_M*getPPM()));
  var _tempGapPx=Math.max(2,Math.round(0.05*getPPM()));
  var pad=chairs?_tempChairPx+_tempGapPx:0;
  var vc=_getVisibleCanvasCenter();
  var snap=function(n){return LState.useSnap?Math.round(n/LState.snapGrid)*LState.snapGrid:Math.round(n);};
  var isTable=['round-table','rect-table','square-table'].includes(shape)||!!(LSHAPES_M[shape]&&LSHAPES_M[shape]._isCustomTable);
  var tableCount=LState.items.filter(function(i){return ['round-table','rect-table','square-table'].includes(i.shape)||(LSHAPES_M[i.shape]&&LSHAPES_M[i.shape]._isCustomTable);}).length+1;
  var newLabel=isTable?String(tableCount):def.label;
  var newItem={
    id:'li'+Date.now(),shape:shape,
    x:snap(vc.x-def.w/2-pad),y:snap(vc.y-def.h/2-pad),
    w:def.w,h:def.h,bg:def.bg,bdClr:def.bdClr,
    radius:def.radius,label:newLabel,chairs:chairs,
    chairType:'default',centerpiece:'none',cost:0,rotation:0,
  };
  LState.items.push(newItem);p.layoutItems=LState.items;saveProj(p);
  LState.sel=[newItem.id];LState.addMode=null;
  lHistorySave();
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
  var CS=0.32*SCALE; var CG=0.06*SCALE;
  var tableFill=selected?'#e8dcc8':'#f0ece0';
  var chairFill=selected?'#9a7b5a':'#b08968';

  if(item.cat==='s-table'){
    return _drawSTableSVG(item, tableFill, chairFill);
  }

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
    var _svgSides=item.chairSides||_defaultRectChairSides(n);
    var _svgTop=_svgSides.top||0, _svgBot=_svgSides.bottom||0, _svgLeft=_svgSides.left||0, _svgRight=_svgSides.right||0;
    for(var ci=0;ci<_svgTop;ci++){
      var cx2=tx+(ci+0.5)*(tw/_svgTop); var cy2=ty-CG-CS/2;
      chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    for(var ci=0;ci<_svgBot;ci++){
      var cx2=tx+(ci+0.5)*(tw/_svgBot); var cy2=ty+th+CG+CS/2;
      chairs+='<circle cx="'+cx2.toFixed(1)+'" cy="'+cy2.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    for(var ci=0;ci<_svgLeft;ci++){
      var cy3=ty+(ci+0.5)*(th/_svgLeft);
      chairs+='<circle cx="'+(tx-CG-CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    for(var ci=0;ci<_svgRight;ci++){
      var cy3=ty+(ci+0.5)*(th/_svgRight);
      chairs+='<circle cx="'+(tx+tw+CG+CS/2).toFixed(1)+'" cy="'+cy3.toFixed(1)+'" r="'+(CS/2).toFixed(1)+'" fill="'+chairFill+'"/>';
    }
    chairs+='<rect x="'+tx.toFixed(1)+'" y="'+ty.toFixed(1)+'" width="'+tw.toFixed(1)+'" height="'+th.toFixed(1)+'" rx="2" fill="'+tableFill+'"/>';
  }
  return '<svg viewBox="0 0 '+svgW.toFixed(0)+' '+svgH.toFixed(0)+'" width="'+svgW.toFixed(0)+'" height="'+svgH.toFixed(0)+'" style="display:block;overflow:visible">'+chairs+'</svg>';
}

function _drawSTableSVG(item, tableFill, chairFill){
  // S-shaped serpentine table — exact geometry from reference images
  var n=item.chairs;
  var half=Math.floor(n/2);
  var W=160; var H=72;
  var pad=16; var cr=6.5;
  var svgW=W+pad*2; var svgH=H+pad*2;
  var ox=pad; var oy=pad;
  // S-curve wave amplitude and table band half-height
  var amp=14; var bh=H/2;
  // The S-shape body: top edge curves up-left then down-right, bottom edge inverse
  // Build as a closed path: top edge left-to-right, then bottom edge right-to-left
  function topY(t){ return oy+bh - amp*Math.sin(t*Math.PI); }
  function botY(t){ return oy+bh + amp*Math.sin(t*Math.PI); }
  // Top edge narrower at ends via vertical pinch
  var bandW=16;
  function topEdge(t){ return topY(t)-bandW+(bandW*0.35)*Math.sin(t*Math.PI); }
  function botEdge(t){ return botY(t)+bandW-(bandW*0.35)*Math.sin(t*Math.PI); }
  var pts=40;
  var topPath=''; var botPath='';
  for(var i=0;i<=pts;i++){
    var t=i/pts; var x=ox+t*W;
    topPath+=(i===0?'M':'L')+x.toFixed(1)+','+topEdge(t).toFixed(1);
  }
  for(var i=pts;i>=0;i--){
    var t=i/pts; var x=ox+t*W;
    botPath+='L'+x.toFixed(1)+','+botEdge(t).toFixed(1);
  }
  var path='<path d="'+topPath+botPath+'Z" fill="'+tableFill+'"/>';
  // Chairs along the top and bottom edges of the S
  var chairs='';
  var is16=n>=16;
  for(var ci=0;ci<half;ci++){
    // Top row: chairs above the top edge
    var t;
    if(is16){ t=(ci+0.5)/half; }
    else { t=(ci+1)/(half+1); }
    var cx=ox+t*W;
    var cy=topEdge(t)-cr-3;
    chairs+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+cr+'" fill="'+chairFill+'"/>';
  }
  for(var ci=0;ci<half;ci++){
    // Bottom row: chairs below the bottom edge
    var t;
    if(is16){ t=(ci+0.5)/half; }
    else { t=(ci+1)/(half+1); }
    var cx=ox+t*W;
    var cy=botEdge(t)+cr+3;
    chairs+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+cr+'" fill="'+chairFill+'"/>';
  }
  return '<svg viewBox="0 0 '+svgW+' '+svgH+'" width="'+svgW+'" height="'+svgH+'" style="display:block;overflow:visible">'+chairs+path+'</svg>';
}

function _addTableCatalogue(){
  return [
    {key:'round-1.2', cat:'round',label:'4 seats',dim:'1.2m',wM:1.2,hM:1.2,chairs:4},
    {key:'round-1.5', cat:'round',label:'6 seats',dim:'1.5m',wM:1.5,hM:1.5,chairs:6},
    {key:'round-1.8', cat:'round',label:'8 seats',dim:'1.8m',wM:1.8,hM:1.8,chairs:8},
    {key:'round-2.0', cat:'round',label:'10 seats',dim:'2.0m',wM:2.0,hM:2.0,chairs:10},
    {key:'rect-2.44x1.20',cat:'rect',label:'8 seats',dim:'2.44 x 1.20m',wM:2.44,hM:1.20,chairs:8,chairSides:{top:4,bottom:4,left:0,right:0}},
    {key:'rect-4.88x1.80-12',cat:'rect',label:'12 seats',dim:'4.88 x 1.80m',wM:4.88,hM:1.80,chairs:12,chairSides:{top:6,bottom:6,left:0,right:0}},
    {key:'rect-4.88x1.80-16',cat:'rect',label:'16 seats',dim:'4.88 x 1.80m',wM:4.88,hM:1.80,chairs:16,chairSides:{top:6,bottom:6,left:2,right:2}},
    {key:'s-table-14',cat:'s-table',label:'14 seats',dim:'4.0 x 1.5m',wM:4.0,hM:1.5,chairs:14},
    {key:'s-table-16',cat:'s-table',label:'16 seats',dim:'4.5 x 1.5m',wM:4.5,hM:1.5,chairs:16},
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
    if(cat){totalT+=e.n; totalC+=e.n*(e.chairs!=null?e.chairs:cat.chairs);}
  });
  function catSection(catKey,titleEN,titleES){
    var items=catalogue.filter(function(c){return c.cat===catKey;});
    return '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">'+(isES?titleES:titleEN)+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
      +items.map(function(item){
        var sel=_addTableSelection[item.key]&&_addTableSelection[item.key].n>0;
        var cnt=(_addTableSelection[item.key]||{}).n||0;
        return '<div onclick="_addTableToggle(\''+item.key+'\')" style="cursor:pointer;padding:8px 6px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s;min-width:72px;position:relative">'
          +_addTableDrawSVG(item,sel)
          +'<div style="margin-top:5px;font-size:12px;font-weight:600;color:var(--text);line-height:1.2">'+esc(item.label)+'</div>'
          +'<div style="font-size:10px;color:var(--muted);margin-top:1px">'+(item.dim||'')+'</div>'
          +(sel
            ?'<div onclick="event.stopPropagation()" style="margin-top:5px"><input type="number" min="1" value="'+cnt+'" onchange="_addTableSelection[\''+item.key+'\'].n=parseInt(this.value)||1;_renderAddTableModalBody()" oninput="_addTableSelection[\''+item.key+'\'].n=parseInt(this.value)||1" style="width:48px;text-align:center;padding:3px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:700;background:var(--bg)"><div style="font-size:9px;color:var(--muted);margin-top:1px">'+(isES?'cantidad':'qty')+'</div></div>'
            :'')
          +'</div>';
      }).join('')
      +'</div>';
  }
  var body=catSection('round','Round Tables','Mesas Redondas')
    +catSection('rect','Rectangular Tables','Mesas Rectangulares')
    +catSection('s-table','Special Tables','Mesas Especiales')
    +'<div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;display:flex;gap:24px;font-size:13px;margin-top:14px;flex-wrap:wrap">'
    +'<span><strong>'+totalT+'</strong> '+(isES?'mesas':'tables')+'</span>'
    +'<span><strong>'+totalC+'</strong> '+(isES?'sillas':'seats')+'</span>'
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
  var cx=(outer.scrollLeft-_canvasPad+outer.clientWidth/2)/LState.zoom;
  var cy=(outer.scrollTop-_canvasPad+outer.clientHeight/2)/LState.zoom;
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
    'rect':'rect-table','dend':'rect-table','oval':'rect-table','round':'round-table','s-table':'s-table'
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
    var pad2=cat.chairs?Math.round(CHAIR_SIZE_M*ppm)+Math.round(0.05*ppm):0;
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
    var defShape=SHAPES[shape]||{bg:'#f0ece0',bdClr:'#a67c3d'};
    var pad=sel.chairs||cat.chairs?Math.round(CHAIR_SIZE_M*ppm)+Math.round(0.05*ppm):0;
    var cellW=tw+pad*2+spacing; var cellH=th+pad*2+spacing;
    for(var i=0;i<sel.n;i++){
      tableNum++;
      if(curX+cellW>4000){curX=startX;curY+=rowMaxH;rowMaxH=0;}
      newItems.push({
        id:'li'+Date.now()+Math.random().toString(36).slice(2,6),
        shape:shape, x:Math.round(curX+pad), y:Math.round(curY+pad),
        w:tw, h:th, bg:defShape.bg||'#f0ece0', bdClr:defShape.bdClr||'#a67c3d',
        radius:cat.cat==='round'?'50%':'0px',
        label:String(tableNum), chairs:cat.chairs,
        chairSides:cat.chairSides||null,
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
    {key:'dance-floor', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/><path d="M7 4v16M12 4v16M17 4v16"/></svg>', labelEN:'Dance Floor', labelES:'Pista de Baile', shape:'dance-floor'},
    {key:'bar', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16l-2 6H6L4 6Z"/><path d="M12 12v6"/><path d="M9 18h6"/></svg>', labelEN:'Shot Bar', labelES:'Barra de Shots', shape:'bar'},
    {key:'stage', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M7 17v3M12 17v3M17 17v3"/></svg>', labelEN:'Stage', labelES:'Escenario', shape:'stage'},
    {key:'dj-booth', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="8" width="14" height="8" rx="2"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/></svg>', labelEN:'DJ Booth', labelES:'Cabina de DJ', shape:'dj-booth'},
    {key:'platform', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="9" width="18" height="6" rx="2"/><path d="M6 15v3M12 15v3M18 15v3"/></svg>', labelEN:'Dinner Platform', labelES:'Plataforma de Cena', shape:'stage'},
    {key:'gift-table', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="9" width="16" height="9" rx="2"/><path d="M12 9v9M4 12h16"/><path d="M9.5 9s-1.5-1-1.5-2.5S9 4 10.5 5c.9.6 1.5 2 1.5 4"/><path d="M14.5 9s1.5-1 1.5-2.5S15 4 13.5 5c-.9.6-1.5 2-1.5 4"/></svg>', labelEN:'Gift Table', labelES:'Mesa de Regalos', shape:'gift-table'},
    {key:'photo-booth', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="16" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M9 6l1.2-2h3.6L15 6"/></svg>', labelEN:'Photo Booth', labelES:'Photo Booth', shape:'photo-booth'},
    {key:'custom', icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>', labelEN:'Custom Element', labelES:'Elemento Personalizado', shape:'custom'},
  ];
  var html='<div class="mo-title">'+(isES?'Agregar Elemento':'Add Event Element')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto">'
    +elements.map(function(el){
      if(el.key==='custom'){
        return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;background:var(--card)">'
          +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
          +'<span style="width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;color:var(--gold-h);flex-shrink:0">'+el.icon+'</span>'
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
        +'<span style="width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;color:var(--gold-h);flex-shrink:0">'+el.icon+'</span> '+(isES?el.labelES:el.labelEN)
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
    _elemKey:key,
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
  var nameEl=document.getElementById('custom-elem-name');
  var name=nameEl?nameEl.value.trim():'';
  if(!name) return toast(isES?'Ingresa un nombre':'Enter a name','e');
  var shapeEl=document.getElementById('custom-elem-shape');
  var shapeType=shapeEl?shapeEl.value:'rect';
  var wM=parseFloat((document.getElementById('custom-elem-w')||{}).value)||2;
  var hM=parseFloat((document.getElementById('custom-elem-h')||{}).value)||2;
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

var _lItemDelegationCanvas = null;
function attachLItemEvents(){
  // Reset pointerEvents in case a previous drag left it stuck
  var cv=document.getElementById('lcanvas');
  if(cv) cv.style.pointerEvents='';
  // Reset any stale drag state
  _lDragItem=null;_panning=false;_marquee=false;_fpDragging=false;
  // Use event delegation on canvas — re-attach if canvas was rebuilt
  if(cv && cv !== _lItemDelegationCanvas){
    _lItemDelegationCanvas = cv;
    cv.addEventListener('mousedown',function(e){
      var el=e.target.closest('.litem');
      if(el){ e.litemEl=el; lItemDown(e); }
    },{passive:false});
    cv.addEventListener('contextmenu',function(e){
      var el=e.target.closest('.litem');
      if(el){ e.litemEl=el; _lItemContextMenu(e); }
    },{passive:false});
  }
  window.removeEventListener('mousemove',lCanvasMove);
  window.removeEventListener('mouseup',lCanvasUp);
  window.addEventListener('mousemove',lCanvasMove);
  window.addEventListener('mouseup',lCanvasUp);
}

// ── Right-click context menu ──
function _lItemContextMenu(e){
  e.preventDefault();e.stopPropagation();
  var el=e.litemEl||e.currentTarget;
  var id=el&&el.dataset?el.dataset.id:null;
  if(!id)return;
  if(!LState.sel.includes(id)) LState.sel=[id];
  updateSelUI();
  _showLayoutContextMenu(e.clientX,e.clientY,id);
}

function _showLayoutContextMenu(cx,cy,id){
  _closeLayoutContextMenu();
  var _es=LANG==='es';
  var item=LState.items.find(function(i){return i.id===id;});
  if(!item)return;
  var isTable=['round-table','rect-table','square-table'].includes(item.shape)||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape]._isCustomTable);
  var menu=document.createElement('div');
  menu.id='l-ctx-menu';
  menu.style.cssText='position:fixed;left:'+cx+'px;top:'+cy+'px;z-index:99999;background:var(--card);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:4px 0;min-width:180px;font-size:13px;font-family:Jost,sans-serif';
  function mi(label,icon,fn,danger){
    return '<div onclick="'+fn+';_closeLayoutContextMenu()" style="padding:7px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;color:'+(danger?'var(--danger)':'var(--text)')+'" onmouseenter="this.style.background=\'var(--bg2)\'" onmouseleave="this.style.background=\'none\'">'
      +'<span style="width:18px;text-align:center;font-size:14px;flex-shrink:0">'+icon+'</span>'+label+'</div>';
  }
  function sep(){return '<div style="height:1px;background:var(--border);margin:3px 0"></div>';}
  var html='';
  html+=mi(_es?'Editar':'Edit','&#9998;','openLItemModal(\''+id+'\')');
  if(isTable){
    html+=mi(_es?'Copia':'Copy','&#128203;','makeLayoutDuplicate(\''+id+'\',\'copy\')');
    html+=mi(_es?'Instancia':'Instance','&#128279;','makeLayoutDuplicate(\''+id+'\',\'instance\')');
  }
  html+=sep();
  html+=mi(_es?'Traer al Frente':'Bring to Front','&#8679;','_lZOrder(\''+id+'\',\'front\')');
  html+=mi(_es?'Adelantar':'Bring Forward','&#8593;','_lZOrder(\''+id+'\',\'forward\')');
  html+=mi(_es?'Atrasar':'Send Backward','&#8595;','_lZOrder(\''+id+'\',\'backward\')');
  html+=mi(_es?'Enviar al Fondo':'Send to Back','&#8681;','_lZOrder(\''+id+'\',\'back\')');
  html+=sep();
  html+=mi(_es?'Eliminar':'Delete','&#128465;','delLItem(\''+id+'\')',true);
  menu.innerHTML=html;
  document.body.appendChild(menu);
  // Adjust if overflows viewport
  var rect=menu.getBoundingClientRect();
  if(rect.right>window.innerWidth) menu.style.left=(cx-rect.width)+'px';
  if(rect.bottom>window.innerHeight) menu.style.top=(cy-rect.height)+'px';
  // Close on click outside (remove first to prevent accumulation)
  document.removeEventListener('mousedown',_ctxMenuOutsideClick);
  setTimeout(function(){document.addEventListener('mousedown',_ctxMenuOutsideClick,{once:true});},0);
}
function _ctxMenuOutsideClick(e){
  var menu=document.getElementById('l-ctx-menu');
  if(menu&&!menu.contains(e.target)) _closeLayoutContextMenu();
}
function _closeLayoutContextMenu(){
  var menu=document.getElementById('l-ctx-menu');
  if(menu) menu.remove();
  document.removeEventListener('mousedown',_ctxMenuOutsideClick);
}

// ── Z-order functions ──
function _lZOrder(id,action){
  var idx=LState.items.findIndex(function(i){return i.id===id;});
  if(idx<0)return;
  var item=LState.items[idx];
  lHistorySave();
  switch(action){
    case 'front':
      LState.items.splice(idx,1);
      LState.items.push(item);
      break;
    case 'back':
      LState.items.splice(idx,1);
      LState.items.unshift(item);
      break;
    case 'forward':
      if(idx<LState.items.length-1){
        LState.items.splice(idx,1);
        LState.items.splice(idx+1,0,item);
      }
      break;
    case 'backward':
      if(idx>0){
        LState.items.splice(idx,1);
        LState.items.splice(idx-1,0,item);
      }
      break;
  }
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  renderLayout();
}

let _lDragItem=null,_lDragOffX=0,_lDragOffY=0,_lDidDrag=false;
let _lDragStartAnchorX=0,_lDragStartAnchorY=0,_lDragAxisLock=null;
let _lDragOffsets={};
let _panning=false,_panStart={x:0,y:0},_panOrigin={x:0,y:0};
var _lDragSnapTargets=[];
var _lSnapGuides=[];
var _SNAP_THRESHOLD=15;

function _getItemSnapPoints(item){
  var cx=item.x+item.w/2, cy=item.y+item.h/2;
  var isRound=item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  var pts=[];
  // Center
  pts.push({x:cx,y:cy,t:'c'});
  if(isRound){
    // Quadrant points: N, E, S, W
    var rx=item.w/2, ry=item.h/2;
    pts.push({x:cx,y:item.y,t:'n'});        // North
    pts.push({x:item.x+item.w,y:cy,t:'e'}); // East
    pts.push({x:cx,y:item.y+item.h,t:'s'}); // South
    pts.push({x:item.x,y:cy,t:'w'});        // West
  } else {
    // Edge midpoints
    pts.push({x:cx,y:item.y,t:'tc'});             // Top center
    pts.push({x:cx,y:item.y+item.h,t:'bc'});      // Bottom center
    pts.push({x:item.x,y:cy,t:'lc'});             // Left center
    pts.push({x:item.x+item.w,y:cy,t:'rc'});      // Right center
    // Corners
    pts.push({x:item.x,y:item.y,t:'tl'});
    pts.push({x:item.x+item.w,y:item.y,t:'tr'});
    pts.push({x:item.x,y:item.y+item.h,t:'bl'});
    pts.push({x:item.x+item.w,y:item.y+item.h,t:'br'});
  }
  return pts;
}

function _cacheSnapTargets(excludeIds){
  _lDragSnapTargets=[];
  var excSet={};
  excludeIds.forEach(function(id){excSet[id]=true;});
  LState.items.forEach(function(item){
    if(excSet[item.id]) return;
    _getItemSnapPoints(item).forEach(function(p){
      _lDragSnapTargets.push(p);
    });
  });
}

function _objectSnap(rawX, rawY, draggedItem){
  if(!LState.useSnap) return {x:Math.round(rawX),y:Math.round(rawY)};
  var thresh=_SNAP_THRESHOLD/LState.zoom;
  // Compute snap points for dragged item at tentative position
  var tempItem={x:rawX,y:rawY,w:draggedItem.w,h:draggedItem.h,shape:draggedItem.shape,radius:draggedItem.radius};
  var srcPts=_getItemSnapPoints(tempItem);
  var bestDx=null, bestDistX=thresh+1;
  var bestDy=null, bestDistY=thresh+1;
  var guideX=null, guideY=null;
  // Check X alignment independently from Y
  for(var si=0;si<srcPts.length;si++){
    var sp=srcPts[si];
    for(var ti=0;ti<_lDragSnapTargets.length;ti++){
      var tp=_lDragSnapTargets[ti];
      var dx=Math.abs(sp.x-tp.x);
      var dy=Math.abs(sp.y-tp.y);
      if(dx<bestDistX){
        bestDistX=dx; bestDx=tp.x-sp.x;
        guideX={x:tp.x,srcY:sp.y,tgtY:tp.y};
      }
      if(dy<bestDistY){
        bestDistY=dy; bestDy=tp.y-sp.y;
        guideY={y:tp.y,srcX:sp.x,tgtX:tp.x};
      }
    }
  }
  var snapX=Math.round(rawX+(bestDistX<=thresh?bestDx:0));
  var snapY=Math.round(rawY+(bestDistY<=thresh?bestDy:0));
  // Build guide lines
  _lSnapGuides=[];
  if(bestDistX<=thresh&&guideX){
    var minY=Math.min(guideX.srcY,guideX.tgtY)-20;
    var maxY=Math.max(guideX.srcY,guideX.tgtY)+20;
    _lSnapGuides.push({x1:guideX.x,y1:minY,x2:guideX.x,y2:maxY});
  }
  if(bestDistY<=thresh&&guideY){
    var minX=Math.min(guideY.srcX,guideY.tgtX)-20;
    var maxX=Math.max(guideY.srcX,guideY.tgtX)+20;
    _lSnapGuides.push({x1:minX,y1:guideY.y,x2:maxX,y2:guideY.y});
  }
  return {x:snapX,y:snapY};
}
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

var LHistory=[], LHistoryPos=-1, LHistorySaving=true, _LHistoryContextId=null;
function lHistoryReset(){
  LHistory=[]; LHistoryPos=-1;
}
function lHistorySave(){
  if(!LHistorySaving)return;
  markLayoutDirty();
  var fp=LState.floorplan;
  var snapshot=JSON.stringify({
    items:LState.items,
    fp:{x:fp.x,y:fp.y,scale:fp.scale,rotation:fp.rotation||0,opacity:fp.opacity,w:fp.w,h:fp.h,locked:fp.locked}
  });
  if(LHistoryPos<LHistory.length-1) LHistory=LHistory.slice(0,LHistoryPos+1);
  if(LHistory.length>0&&LHistory[LHistoryPos]===snapshot)return;
  LHistory.push(snapshot);
  if(LHistory.length>200){ LHistory.shift(); }
  LHistoryPos=LHistory.length-1;
}
function _lHistoryApply(snap){
  if(Array.isArray(snap)){
    LState.items=snap;
  } else {
    LState.items=snap.items;
    if(snap.fp) Object.assign(LState.floorplan,snap.fp);
  }
}
function lUndo(){
  if(LHistoryPos<=0){toast(LANG==='es'?'Nada que deshacer':'Nothing to undo','e');return;}
  LHistoryPos--;
  LHistorySaving=false;
  _lHistoryApply(JSON.parse(LHistory[LHistoryPos]));
  LState.sel=[];
  var p=proj();p.layoutItems=LState.items;saveFloorplan();
  renderLayoutCanvas();LHistorySaving=true;toast(LANG==='es'?'Deshacer':'Undo','s');
}
function lRedo(){
  if(LHistoryPos>=LHistory.length-1){toast(LANG==='es'?'Nada que rehacer':'Nothing to redo','e');return;}
  LHistoryPos++;
  LHistorySaving=false;
  _lHistoryApply(JSON.parse(LHistory[LHistoryPos]));
  LState.sel=[];
  var p=proj();p.layoutItems=LState.items;saveFloorplan();
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
function showLayoutShortcuts(){
  var isES=LANG==='es';
  var rows=[
    ['Ctrl+Z','Cmd+Z',isES?'Deshacer':'Undo'],
    ['Ctrl+Y','Cmd+Shift+Z',isES?'Rehacer':'Redo'],
    ['Ctrl+A','Cmd+A',isES?'Seleccionar todo':'Select all'],
    ['Ctrl+C','Cmd+C',isES?'Copiar':'Copy'],
    ['Ctrl+V','Cmd+V',isES?'Pegar':'Paste'],
    ['Ctrl+D','Cmd+D',isES?'Duplicar':'Duplicate'],
    ['Delete','Backspace',isES?'Eliminar selección':'Delete selected'],
    ['Space',isES?'(mantener)':'(hold)',isES?'Mover lienzo':'Pan canvas'],
    ['Escape','',isES?'Cancelar / Deseleccionar':'Cancel / Deselect'],
    ['Shift',isES?'(al medir)':'(measure)',isES?'Restringir ángulo':'Constrain angle'],
  ];
  var html='<div class="mo-title">'+(isES?'Atajos de teclado':'Keyboard Shortcuts')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:6px 12px;font-size:13px;padding:8px 0">'
    +rows.map(function(r){
      return '<div><kbd style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace">'+r[0]+'</kbd></div>'
        +'<div style="color:var(--muted);font-size:11px">'+r[1]+'</div>'
        +'<div>'+r[2]+'</div>';
    }).join('')
    +'</div>'
    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cerrar':'Close')+'</button></div>';
  openMo(html);
}

document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  var moOpen=document.getElementById('mo')&&document.getElementById('mo').classList.contains('open');

  // Show keyboard shortcuts help on ? key
  if(e.key==='?'&&!moOpen&&typeof CTAB!=='undefined'&&CTAB==='layout'){
    showLayoutShortcuts(); return;
  }

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
  var el=e.litemEl||e.currentTarget;
  const id=el&&el.dataset?el.dataset.id:null;
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
  _cacheSnapTargets(LState.sel);
  _lSnapGuides=[];
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
  if(e.button===2||e.button===1||_spaceDown){
    e.preventDefault();
    _panning=true;_panStart={x:e.clientX,y:e.clientY};
    const outer=document.getElementById('lcanvas-outer');
    _panOrigin={x:outer.scrollLeft,y:outer.scrollTop};
    outer.style.cursor='grabbing';
    return;
  }
  if(e.button!==0)return;

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
      mq.style.cssText='position:absolute;border:1.5px dashed var(--gold);background:rgba(166,124,61,.08);pointer-events:none;z-index:100;display:none';
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

var _lMoveRafPending = false;
var _lMoveCachedRect = null;
function lCanvasMove(e){
  // Throttle via requestAnimationFrame — skip if a frame is already queued
  if(_lMoveRafPending){ e.preventDefault(); return; }
  _lMoveRafPending = true;
  _lMoveCachedRect = null; // invalidate per-frame cache
  // Capture coordinates immediately to avoid stale event reference in RAF callback
  var snapshot = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, buttons: e.buttons, preventDefault: function(){} };
  requestAnimationFrame(function(){ _lMoveRafPending = false; _lCanvasMoveInner(snapshot); });
}
function _lGetCanvasRect(){
  if(!_lMoveCachedRect){
    var el = document.getElementById('lcanvas');
    if(el) _lMoveCachedRect = el.getBoundingClientRect();
  }
  return _lMoveCachedRect;
}
function _lCanvasMoveInner(e){
  if(_panning){
    const outer=document.getElementById('lcanvas-outer');
    outer.scrollLeft=_panOrigin.x-(e.clientX-_panStart.x);
    outer.scrollTop=_panOrigin.y-(e.clientY-_panStart.y);
    return;
  }
  if(_fpDragging){
    const cr=_lGetCanvasRect();
    if(!cr) return;
    const cx=(e.clientX-cr.left)/LState.zoom;
    const cy=(e.clientY-cr.top)/LState.zoom;
    LState.floorplan.x=Math.round(cx-_fpDragOffX);
    LState.floorplan.y=Math.round(cy-_fpDragOffY);
    const fpImg=document.getElementById('fp-img');
    if(fpImg){fpImg.style.left=LState.floorplan.x+'px';fpImg.style.top=LState.floorplan.y+'px';}
    return;
  }
  if(LState.measureMode&&_measurePoints.length===1){
    const cr=_lGetCanvasRect();
    if(cr){
      _measurePreviewMouse={
        x:(e.clientX-cr.left)/LState.zoom,
        y:(e.clientY-cr.top)/LState.zoom
      };
      updateMeasurePreview(_measurePreviewMouse,e.shiftKey);
    }
  }

  if(_marquee){
    const cr=_lGetCanvasRect();
    if(!cr) return;
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
  const cr=_lGetCanvasRect();
  if(!cr) return;
  const anchor=LState.items.find(i=>i.id===_lDragItem);
  if(!anchor)return;
  var rawX=Math.round((e.clientX-cr.left)/LState.zoom-_lDragOffX);
  var rawY=Math.round((e.clientY-cr.top)/LState.zoom-_lDragOffY);
  var snapped=_objectSnap(rawX,rawY,anchor);
  let anchorX=snapped.x;
  let anchorY=snapped.y;

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

  // Only update DOM for items that actually moved (selected items)
  var movedIds = [_lDragItem].concat(LState.sel);
  for(var mi=0; mi<movedIds.length; mi++){
    var mid = movedIds[mi];
    if(!mid) continue;
    var mel = document.querySelector('.litem[data-id="'+mid+'"]');
    if(mel){
      var mit = LState.items.find(function(i){return i.id===mid;});
      if(mit){mel.style.left=mit.x+'px';mel.style.top=mit.y+'px';}
    }
  }
  // Render snap guide lines
  _renderSnapGuides();
}

function _renderSnapGuides(){
  var canvas=document.getElementById('lcanvas');
  if(!canvas) return;
  var existing=canvas.querySelectorAll('.snap-guide');
  for(var i=0;i<existing.length;i++) existing[i].remove();
  if(!_lSnapGuides.length) return;
  _lSnapGuides.forEach(function(g){
    var line=document.createElement('div');
    line.className='snap-guide';
    var isVertical=Math.abs(g.x1-g.x2)<1;
    if(isVertical){
      line.style.cssText='position:absolute;left:'+g.x1+'px;top:'+g.y1+'px;width:0;height:'+(g.y2-g.y1)+'px;border-left:1px dashed #a67c3d;pointer-events:none;z-index:90;opacity:0.7';
    } else {
      line.style.cssText='position:absolute;left:'+g.x1+'px;top:'+g.y1+'px;width:'+(g.x2-g.x1)+'px;height:0;border-top:1px dashed #a67c3d;pointer-events:none;z-index:90;opacity:0.7';
    }
    canvas.appendChild(line);
  });
}

function _clearSnapGuides(){
  _lSnapGuides=[];
  var canvas=document.getElementById('lcanvas');
  if(!canvas) return;
  var existing=canvas.querySelectorAll('.snap-guide');
  for(var i=0;i<existing.length;i++) existing[i].remove();
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
    lHistorySave();
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
    _clearSnapGuides();
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
  syncLayoutMobileInspector();
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
  var count=LState.sel.length;
  function doDelete(){
    LState.items=LState.items.filter(i=>!LState.sel.includes(i.id));LState.sel=[];
    const p=proj();p.layoutItems=LState.items;saveProj(p);renderLayout();
    lHistorySave();toast(LANG==='es'?'Eliminado':'Deleted','s');
  }
  if(count>1){
    openConfirmModal({ title:LANG==='es'?'Eliminar elementos':'Delete items', message:(LANG==='es'?'¿Eliminar ':'Delete ')+count+(LANG==='es'?' elementos seleccionados?':' selected items?'), onConfirm:doDelete });
  } else { doDelete(); }
}
function clearLayoutConfirm(){
  openConfirmModal({
    title:LANG==='es'?'Limpiar diseño':'Clear layout',
    message:LANG==='es'?'¿Eliminar todos los elementos del diseño?':'Clear all layout items?',
    onConfirm:function(){ lHistorySave();LState.items=[];LState.sel=[];const p=proj();p.layoutItems=[];saveProj(p);renderLayout(); }
  });
}

function openChairEditor(){
  var isES=LANG==='es';
  var rows=Object.entries(CHAIR_TYPES).map(([k,v])=>{
    var isDefault=k==='default';
    var swatch='<div style="width:28px;height:28px;border-radius:50%;background:'+(v.fill.startsWith('rgba')?'#e8e8e8':v.fill)+';border:1.5px solid var(--border);flex-shrink:0"></div>';
    var delBtn=isDefault
      ? '<div style="width:28px"></div>'
      : '<button class="btn btn-danger btn-icon btn-sm" onclick="deleteChairType(\''+k+'\')" title="'+(isES?'Eliminar':'Delete')+'"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
    return '<div style="display:grid;grid-template-columns:32px 1fr 36px 84px 28px;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)">'+
      swatch+
      '<input class="input" style="font-size:11px;padding:4px 8px" id="ch-label-'+k+'" value="'+esc(v.label)+'" placeholder="'+(isES?'Nombre':'Name')+'"'+(isDefault?' readonly style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--muted)"':'')+'>'+
      '<input class="input" type="color" style="width:34px;height:30px;padding:2px;cursor:pointer" id="ch-fill-'+k+'" value="'+(v.fill.startsWith('rgba')?'#e8e8e8':v.fill)+'" title="'+(isES?'Color':'Color')+'">'+
      '<input class="input" type="number" min="0" step="0.01" style="font-size:11px;padding:4px 6px" id="ch-cost-'+k+'" value="'+(v.costPerChair||0)+'" placeholder="0">'+
      delBtn+
    '</div>';
  }).join('');
  openMo(
    '<div class="mo-title">'+(isES?'Sillas':'Chairs')+'</div>'+
    '<div style="display:grid;grid-template-columns:32px 1fr 36px 84px 28px;gap:6px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:2px">'+
      '<span></span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+(isES?'Nombre':'Name')+'</span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+(isES?'Color':'Color')+'</span>'+
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">$/'+( isES?'Silla':'Chair')+'</span>'+
      '<span></span>'+
    '</div>'+
    '<div style="max-height:55vh;overflow-y:auto">'+rows+
      '<div style="padding:12px 0 4px;margin-top:8px;border-top:1px solid var(--border)">'+
        '<div style="font-size:11px;font-weight:700;color:var(--gold-h);margin-bottom:8px">'+(isES?'Agregar silla personalizada':'Add custom chair')+'</div>'+
        '<div style="display:flex;gap:6px;align-items:center">'+
          '<input class="input" id="ch-new-label" placeholder="'+(isES?'Nombre (requerido)':'Name (required)')+'" style="flex:1;font-size:11px">'+
          '<input class="input" type="color" id="ch-new-fill" value="#a67c3d" style="width:34px;height:34px;padding:2px;flex-shrink:0" title="'+(isES?'Color (requerido)':'Color (required)')+'">'+
          '<input class="input" type="number" min="0" step="0.01" id="ch-new-cost" placeholder="$/'+( isES?'silla':'chair')+'" value="0" style="width:72px;font-size:11px">'+
          '<button class="btn btn-ghost btn-sm" onclick="addNewChairType()" style="white-space:nowrap">'+t('add')+'</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="mo-foot">'+
      '<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'+
      '<button class="btn btn-primary" onclick="saveChairEditor()">'+t('save')+'</button>'+
    '</div>'
  );
}

function deleteChairType(key){
  if(key==='default') return;
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar silla':'Delete chair',
    message:isES?'Las mesas que la usan pasarán a la silla predeterminada.':'Tables using it will revert to the default chair.',
    onConfirm:function(){
      delete CHAIR_TYPES[key];
      var p=proj();
      if(p){ (p.layoutItems||[]).forEach(function(it){ if(it.chairType===key) it.chairType='default'; }); }
      saveLayoutStyles(); if(p) saveProj(p);
      closeMo(); openChairEditor(); renderLayout();
    }
  });
}

function addNewChairType(){
  var lbl=(document.getElementById('ch-new-label')||{value:''}).value.trim();
  if(!lbl)return toast(LANG==='es'?'Ingresa un nombre':'Enter a name','e');
  var fill=(document.getElementById('ch-new-fill')||{value:'#e8d8c8'}).value;
  var cost=+(document.getElementById('ch-new-cost')||{value:0}).value||0;
  var key='custom-'+Date.now();
  CHAIR_TYPES[key]={label:lbl,fill:fill,stroke:fill,costPerChair:cost};
  var p=proj();if(!p.chairTypes)p.chairTypes={};
  p.chairTypes[key]=CHAIR_TYPES[key];saveProj(p);
  closeMo();openChairEditor();toast(LANG==='es'?'Estilo de silla agregado':'Chair style added','s');
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
  closeMo();renderLayout();toast(LANG==='es'?'Estilos de silla guardados':'Chair styles saved','s');
}

function openCenterpieceEditor(){
  var isES=LANG==='es';
  var customRows=Object.entries(CENTERPIECE_TYPES).filter(([k])=>k!=='none').map(([k,v])=>
    '<div style="display:grid;grid-template-columns:28px 1fr 36px 84px 28px;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)">'+
      '<div style="width:24px;height:24px;border-radius:50%;background:'+(v.color||'#ccc')+';border:1.5px solid var(--border);flex-shrink:0"></div>'+
      '<input class="input" style="font-size:11px;padding:4px 8px" id="cp-label-'+k+'" value="'+esc(v.label)+'" placeholder="'+(isES?'Nombre':'Name')+'">'+
      '<input class="input" type="color" style="width:34px;height:30px;padding:2px;cursor:pointer" id="cp-color-'+k+'" value="'+(v.color||'#e05080')+'" title="Color">'+
      '<input class="input" type="number" min="0" step="0.01" style="font-size:11px;padding:4px 6px" id="cp-cost-'+k+'" value="'+(v.cost||0)+'" placeholder="0">'+
      '<button class="btn btn-danger btn-icon btn-sm" onclick="deleteCenterpieceType(\''+k+'\')" title="'+(isES?'Eliminar':'Delete')+'"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'+
    '</div>'
  ).join('');

  var emptyMsg=!customRows ? '<div style="padding:12px 0;font-size:12px;color:var(--muted)">'+(isES?'Sin centros de mesa personalizados aún.':'No custom centerpieces yet.')+'</div>' : '';

  openMo(
    '<div class="mo-title">'+(isES?'Centros de mesa':'Centerpieces')+'</div>'+
    (customRows
      ? '<div style="display:grid;grid-template-columns:28px 1fr 36px 84px 28px;gap:6px;padding:4px 0 8px;border-bottom:2px solid var(--border);margin-bottom:2px">'+
          '<span></span>'+
          '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+(isES?'Nombre':'Name')+'</span>'+
          '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'+(isES?'Color':'Color')+'</span>'+
          '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">$/'+( isES?'Centro':'Piece')+'</span>'+
          '<span></span>'+
        '</div>'
      : '')+
    '<div style="max-height:55vh;overflow-y:auto">'+customRows+emptyMsg+
      '<div style="padding:12px 0 4px;margin-top:8px;border-top:1px solid var(--border)">'+
        '<div style="font-size:11px;font-weight:700;color:var(--gold-h);margin-bottom:8px">'+(isES?'Agregar centro de mesa':'Add centerpiece')+'</div>'+
        '<div style="display:flex;gap:6px;align-items:center">'+
          '<input class="input" id="cp-new-label" placeholder="'+(isES?'Nombre (requerido)':'Name (required)')+'" style="flex:1;font-size:11px">'+
          '<input class="input" type="color" id="cp-new-color" value="#e05080" style="width:34px;height:34px;padding:2px;flex-shrink:0" title="'+(isES?'Color (requerido)':'Color (required)')+'">'+
          '<input class="input" type="number" min="0" step="0.01" id="cp-new-cost" placeholder="$/'+( isES?'centro':'piece')+'" value="0" style="width:72px;font-size:11px">'+
          '<button class="btn btn-ghost btn-sm" onclick="addNewCenterpieceType()" style="white-space:nowrap">'+t('add')+'</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="mo-foot">'+
      '<button class="btn btn-ghost" onclick="closeMo()">'+t('cancel')+'</button>'+
      '<button class="btn btn-primary" onclick="saveCenterpieceEditor()">'+t('save')+'</button>'+
    '</div>'
  );
}

function deleteCenterpieceType(key){
  if(key==='none') return;
  var isES=LANG==='es';
  openConfirmModal({
    title:isES?'Eliminar centro de mesa':'Delete centerpiece',
    message:isES?'Las mesas que lo usan quedarán sin centro.':'Tables using it will revert to none.',
    onConfirm:function(){
      delete CENTERPIECE_TYPES[key];
      var p=proj();
      if(p){ (p.layoutItems||[]).forEach(function(it){ if(it.centerpiece===key) it.centerpiece='none'; }); }
      saveLayoutStyles(); if(p) saveProj(p);
      closeMo(); openCenterpieceEditor(); renderLayout();
    }
  });
}

function addNewCenterpieceType(){
  var lbl=(document.getElementById('cp-new-label')||{value:''}).value.trim();
  if(!lbl)return toast(LANG==='es'?'Ingresa un nombre':'Enter a name','e');
  var color=(document.getElementById('cp-new-color')||{value:'#e05080'}).value;
  var cost=+(document.getElementById('cp-new-cost')||{value:0}).value||0;
  var key='custom-'+Date.now();
  CENTERPIECE_TYPES[key]={label:lbl,color:color,cost:cost};
  var p=proj();if(!p.centerpieceTypes)p.centerpieceTypes={};
  p.centerpieceTypes[key]=CENTERPIECE_TYPES[key];saveProj(p);
  closeMo();openCenterpieceEditor();toast(LANG==='es'?'Centro de mesa agregado':'Centerpiece added','s');
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
  closeMo();renderLayout();toast(LANG==='es'?'Centros de mesa guardados':'Centerpieces saved','s');
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
      <input class="input" style="font-size:11px;padding:4px 8px" id="tt-${k}-label" value="${esc(s.label)}" placeholder="Name">
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
  if(!lbl)return toast(LANG==='es'?'Ingresa un nombre':'Enter a name','e');
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
      <input class="input" style="font-size:11px;padding:4px 8px" id="et-${k}-label" value="${esc(s.label)}" placeholder="Name">
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
  if(!lbl)return toast(LANG==='es'?'Ingresa un nombre':'Enter a name','e');
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
  var chairOpts=Object.entries(CHAIR_TYPES).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label)}${v.costPerChair>0?' ($'+v.costPerChair+'/silla)':''}</option>`).join('');
  var cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label)}</option>`).join('');
  openMo(`<div class="mo-title">🏛️ Create General Layout</div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Configure your venue layout. Default: 30 round tables (6×5), dance floor, shot bar, dinner platform and DJ booth in center.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">⭕ Round Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-round-n" value="30" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-round-chairs" value="10" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-round-cols" value="6" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-round-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-round-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">▭ Rect Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-rect-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-rect-chairs" value="12" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-rect-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-rect-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-rect-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">◻️ Square Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-sq-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-sq-chairs" value="8" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-sq-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-sq-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-sq-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
  </div>
  <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">
    <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">&#10022; Center Elements</div>
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
  <div style="background:rgba(166,124,61,.08);border:1px solid rgba(166,124,61,.2);border-radius:8px;padding:10px;font-size:11px;color:var(--muted);margin-bottom:16px">
    &#9432; This will replace your current layout. Tables are arranged in a grid; center elements are placed in the middle.
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="generateGeneralLayout()">✨ Generate Layout</button>
  </div>`);
}

function generateGeneralLayout(){
  var ppm=getPPM();
  LSHAPES=getLSHAPES();
  var items=[];
  var _idN=0;
  var idGen=function(){_idN++;return 'li'+(Date.now()+_idN)+Math.random().toString(36).slice(2,5);};
  var sp=Math.round(0.25*ppm); // gap between table edges

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
    var _cp=Math.max(8,Math.round(CHAIR_SIZE_M*ppm));
    var _cg=Math.max(2,Math.round(0.05*ppm));
    var pad=chairs?_cp+_cg:0;
    return {w:def.w+pad*2+sp, h:def.h+pad*2+sp, pad:pad, def:def};
  }
  var rCell=makeCell(rDef,roundChairs);
  var rcCell=makeCell(rcDef,rectChairs);
  var sqCell=makeCell(sqDef,sqChairs);

  // Distribute each table type evenly — half of each type on each side
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

  // Place RIGHT tables — columns reversed so layout mirrors the left side
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
  toast((LANG==='es'?'Plano generado: ':'Layout generated: ')+total+(LANG==='es'?' mesas':' tables'),'s');
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
  toast(LANG==='es'?'Mediciones borradas':'Measurements cleared','s');
}
function toggleFloorplanLock(){
  LState.floorplan.locked=!LState.floorplan.locked;
  saveFloorplan();
  renderLayout();
  toast(LState.floorplan.locked?'&#128274; Floorplan locked':'&#128275; Floorplan unlocked','s');
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
    '<text id="measure-preview-label" x="'+_measurePoints[0].x+'" y="'+(+_measurePoints[0].y-10)+'" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">...</text>':
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
  if(file.size > 10*1024*1024){toast(LANG==='es'?'Archivo muy grande (max 10MB)':'File too large (max 10MB)','e');return;}
  toast(LANG==='es'?'Cargando plano...':'Loading floorplan...');
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
      // Save to IndexedDB as local cache
      _fpSave(_fpKey, finalData).catch(function(){});
      var targetW=LState.canvasW*0.8;
      var fpScale=1;
      if(cw>targetW) fpScale=targetW/cw;
      var placement=_getCenteredFloorplanPlacement(cw,ch,fpScale);
      // Upload to Convex file storage
      var fpBlob=EVENTOS_DATA.base64ToBlob(finalData);
      EVENTOS_DATA.uploadFile(fpBlob).then(function(storageId){
        return EVENTOS_DATA.getFileUrl(storageId).then(function(url){
          LState.floorplan={
            img:url||finalData,
            opacity:0.4,
            scale:fpScale,
            x:placement.x,y:placement.y,
            w:cw,h:ch,
            _idb:_fpKey,
            _storageId:storageId
          };
          var p=proj();
          p.floorplan={opacity:0.4,scale:LState.floorplan.scale,x:LState.floorplan.x,y:LState.floorplan.y,w:cw,h:ch,locked:false,rotation:0,pxPerMeter:null,img:'__stored__',_idb:_fpKey,_storageId:storageId};
          saveProj(p);
          renderLayout();
          startScaleMode();
        });
      }).catch(function(err){
        console.error('Convex upload error, falling back to IndexedDB:',err);
        LState.floorplan={
          img:finalData,
          opacity:0.4,
          scale:fpScale,
          x:placement.x,y:placement.y,
          w:cw,h:ch,
          _idb:_fpKey
        };
        var p=proj();
        p.floorplan={opacity:0.4,scale:LState.floorplan.scale,x:LState.floorplan.x,y:LState.floorplan.y,w:cw,h:ch,locked:false,rotation:0,pxPerMeter:null,img:'__idb__',_idb:_fpKey};
        saveProj(p);
        renderLayout();
        toast(LANG==='es'?'Plano guardado localmente':'Floorplan saved locally','s');
        startScaleMode();
      });
    };
    img.src=origData;
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

function handleFloorplanDrop(e){
  var file=e.dataTransfer&&e.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/'))return toast(LANG==='es'?'Suelta un archivo de imagen':'Please drop an image file','e');
  var fakeEvt={target:{files:[file],value:''},preventDefault:function(){}};
  handleFloorplanUpload(fakeEvt);
}

function removeFloorplan(){
  openConfirmModal({
    title:LANG==='es'?'Quitar plano':'Remove floorplan',
    message:LANG==='es'?'¿Quitar la imagen del plano?':'Remove the floorplan image?',
    onConfirm:function(){
      var idbKey=LState.floorplan._idb;
      var storageId=LState.floorplan._storageId;
      // Reset to the same shape used everywhere else so no key (locked/rotation/pxPerMeter)
      // is left undefined after a remove → re-add cycle.
      LState.floorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0,pxPerMeter:null};
      LState.scaleMode=false;LState.scalePoints=[];
      var p=proj();delete p.floorplan;saveProj(p);
      if(idbKey) _fpDelete(idbKey).catch(function(){});
      if(storageId) EVENTOS_DATA.deleteFile(storageId).catch(function(){});
      renderLayout();
      toast(LANG==='es'?'Plano eliminado':'Floorplan removed','s');
    }
  });
}

function saveFloorplan(){
  var p=proj();
  var fpCopy=JSON.parse(JSON.stringify(LState.floorplan));
  if(fpCopy._storageId){
    fpCopy.img='__stored__';
    delete fpCopy.thumb;
  } else if(fpCopy._idb){
    if(!fpCopy.thumb && fpCopy.img && fpCopy.img!=='__idb__') fpCopy.thumb=fpCopy.img;
    fpCopy.img='__idb__';
  }
  p.floorplan=fpCopy;
  saveProj(p);
}
function startScaleMode(){
  if(!LState.floorplan.img) return toast(LANG==='es'?'Primero sube un plano':'Upload a floorplan first','e');
  var isES=LANG==='es';
  openMo('<div style="max-width:460px;padding:4px 0">'
    +'<div style="font-family:Cormorant Garamond,serif;font-size:28px;font-weight:700;margin-bottom:8px">'+(isES?'Escalar plano':'Scale Floor Plan')+'</div>'
    +'<div style="color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:22px">'+(isES?'Selecciona dos puntos a lo largo de una distancia conocida en tu plano, luego ingresa la distancia real para ajustar la escala.':'Pick two points along a known distance on your floorplan, then enter the real-world length to set the correct scale.')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">'
    +'<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 14px;background:var(--bg2);border-radius:12px">'
    +'<div style="min-width:26px;height:26px;border-radius:50%;background:rgba(245,158,11,.15);color:var(--gold-h);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid var(--gold-h)">1</div>'
    +'<div><div style="font-weight:600;font-size:13px;margin-bottom:2px">'+(isES?'Haz clic en el punto A':'Click point A')+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+(isES?'Elige un extremo de una distancia conocida, como el ancho de una sala.':'Pick one end of a known distance, like a room width or wall length.')+'</div></div></div>'
    +'<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 14px;background:var(--bg2);border-radius:12px">'
    +'<div style="min-width:26px;height:26px;border-radius:50%;background:rgba(16,185,129,.1);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #10b981">2</div>'
    +'<div><div style="font-weight:600;font-size:13px;margin-bottom:2px">'+(isES?'Haz clic en el punto B':'Click point B')+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+(isES?'Elige el otro extremo de la misma distancia.':'Pick the other end of the same known distance.')+'</div></div></div>'
    +'<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 14px;background:var(--bg2);border-radius:12px">'
    +'<div style="min-width:26px;height:26px;border-radius:50%;background:var(--bg);color:var(--muted);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid var(--border)">m</div>'
    +'<div><div style="font-weight:600;font-size:13px;margin-bottom:2px">'+(isES?'Ingresa la distancia real':'Enter the real distance')+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+(isES?'Escribe cuántos metros hay entre A y B en la realidad.':'Type how many meters apart A and B are in real life.')+'</div></div></div>'
    +'</div>'
    +'<div style="display:flex;gap:10px;justify-content:flex-end">'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button class="btn btn-primary" onclick="closeMo();_beginScaleMode()">'+(isES?'Iniciar escalado':'Begin Scaling')+'</button>'
    +'</div></div>');
}
function _beginScaleMode(){
  LState.scaleMode=true;LState.scalePoints=[];renderLayout();
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
  if(!realMeters||realMeters<=0)return toast(LANG==='es'?'Ingresa una distancia real válida':'Enter a valid real-world distance','e');
  var pt1=LState.scalePoints[0],pt2=LState.scalePoints[1];
  var pxDist=Math.hypot(pt2.x-pt1.x,pt2.y-pt1.y);
  if(pxDist<5)return toast(LANG==='es'?'Los puntos están demasiado cerca':'Points are too close together','e');
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
  toast((LANG==='es'?'Plano escalado para coincidir con el layout (':'Floorplan scaled to match layout (')+DEFAULT_PPM+' px/m)','s');
}

// NOTA: no hay UI que genere los inputs qc-*, asi que esta funcion no es alcanzable
// hoy.  Se conserva completa (el algoritmo de rejilla es util) y aborta limpiamente.
function quickCreate(){
  var typeEl=document.getElementById('qc-type');
  var nEl=document.getElementById('qc-n');
  var chairsEl=document.getElementById('qc-chairs');
  var colsEl=document.getElementById('qc-cols');
  var spacingEl=document.getElementById('qc-spacing');
  if(!typeEl||!nEl||!chairsEl)return toast(LANG==='es'?'No se encontraron los controles de creación rápida':'Quick Create controls not found','e');
  var shape=typeEl.value;
  var n=Math.max(1,Math.min(100,+nEl.value||8));
  var chairs=Math.max(0,Math.min(30,+chairsEl.value||8));
  var cols=Math.max(1,Math.min(20,colsEl?+colsEl.value||4:4));
  var spacingM=Math.max(0.1,spacingEl?+spacingEl.value||1.5:1.5);
  var spacing=Math.round(spacingM*getPPM());
  LSHAPES=getLSHAPES();
  var def=LSHAPES[shape];
  if(!def)return toast(LANG==='es'?'Tipo de mesa desconocido':'Unknown table type','e');
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
  toast((LANG==='es'?'Se crearon ':'Created ')+n+' '+shape.replace(/-/g,' ')+(n>1?'s':''),'s');
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
    inp.placeholder = LState.sel.length > 1 ? '·' : '—';
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
  if(!LState.sel.length)return toast(LANG==='es'?'Selecciona elementos para rotar':'Select items to rotate','e');
  if(!deg||isNaN(deg))return toast(LANG==='es'?'Ingresa un ángulo válido':'Enter a valid angle','e');
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
  toast((LANG==='es'?'Rotado ':'Rotated ')+deg+'°','s');
}

function alignSelected(mode){
  if(LState.sel.length<2)return toast(LANG==='es'?'Selecciona 2 o más elementos para alinear':'Select 2+ items to align','e');
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
  renderLayout();toast(LANG==='es'?'Alineado':'Aligned','s');
}

function renderLPropsPanel(){
  const id=LState.sel[0];if(!id)return;
  const item=LState.items.find(i=>i.id===id);if(!item)return;
  const panel=document.getElementById('lsb-props-inner');if(!panel)return;
  const isTable=item.chairs>0;
  const cType=item.chairType||'default';
  const cpType=item.centerpiece||'none';

  const chairOpts=Object.entries(CHAIR_TYPES).map(([k,v])=>
    `<option value="${esc(k)}" ${cType===k?'selected':''}>${esc(v.label)}</option>`).join('');
  // Las imagenes viven en chair-images.js (carga diferida).  Si aun no estan, se
  // piden y se vuelve a pintar el panel; mientras tanto simplemente no hay preview.
  const selectedChairImg = (window.CHAIR_IMAGES || {})[cType] || null;
  if(!selectedChairImg && !window.CHAIR_IMAGES_LOADED && typeof ensureChairImages === 'function' &&
     typeof CHAIR_IMAGE_KEYS !== 'undefined' && CHAIR_IMAGE_KEYS.indexOf(cType) !== -1){
    ensureChairImages().then(function(){
      if(typeof renderLPropsPanel === 'function') renderLPropsPanel();
    }).catch(function(){});
  }
  const cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>
    `<option value="${esc(k)}" ${cpType===k?'selected':''}>${esc(v.label)}</option>`).join('');

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
      '<div style="display:flex;align-items:center;gap:6px">'+
      '<select class="input" style="font-size:11px;flex:1" onchange="lPropChange(\''+id+'\',\'chairType\',this.value);renderLPropsPanel()">'+chairOpts+'</select>'+
      '<button class="btn btn-ghost btn-icon btn-sm" onclick="openChairEditor()" title="'+(LANG==='es'?'Gestionar sillas':'Manage chairs')+'"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'+
      '</div></div>'+
      '<div class="lsb-prop"><label>'+t('centerpiece')+'</label>'+
      '<div style="display:flex;align-items:center;gap:6px">'+
      '<select class="input" style="font-size:11px;flex:1" onchange="lPropChange(\''+id+'\',\'centerpiece\',this.value)">'+cpOpts+'</select>'+
      '<button class="btn btn-ghost btn-icon btn-sm" onclick="openCenterpieceEditor()" title="'+(LANG==='es'?'Gestionar centros':'Manage centerpieces')+'"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'+
      '</div></div>'
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
    `<option value="${esc(k)}" ${(item.chairType||'default')===k?'selected':''}>${esc(v.label)}</option>`).join('');
  const cpOpts=Object.entries(CENTERPIECE_TYPES).map(([k,v])=>
    `<option value="${esc(k)}" ${(item.centerpiece||'none')===k?'selected':''}>${esc(v.label)}</option>`).join('');


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
    ${isTable&&item.shape==='rect-table'?function(){
      var _cs=item.chairSides||_defaultRectChairSides(item.chairs||0);
      var _cg=item.chairGaps||{};
      function _gapVal(side){return _cg[side]!=null?_cg[side].toFixed(2):'';}
      return '<div class="ig" style="grid-column:1/-1"><label>'+(_es?'Sillas por Lado':'Chairs per Side')+'</label>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        +'<div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;color:var(--muted);min-width:48px">'+(_es?'Arriba':'Top')+'</span><input class="input" id="li-cs-top" type="number" min="0" max="20" value="'+(_cs.top||0)+'" style="width:72px;min-width:72px;padding:4px 6px" onchange="_updateRectChairTotal()"></div>'
        +'<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:9px;color:var(--muted);min-width:48px">'+(_es?'Esp. (m)':'Gap (m)')+'</span><input class="input" id="li-cg-top" type="number" min="0" max="2" step="0.01" value="'+_gapVal('top')+'" placeholder="auto" style="width:72px;min-width:72px;padding:4px 6px;font-size:11px"></div></div>'
        +'<div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;color:var(--muted);min-width:48px">'+(_es?'Abajo':'Bottom')+'</span><input class="input" id="li-cs-bottom" type="number" min="0" max="20" value="'+(_cs.bottom||0)+'" style="width:72px;min-width:72px;padding:4px 6px" onchange="_updateRectChairTotal()"></div>'
        +'<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:9px;color:var(--muted);min-width:48px">'+(_es?'Esp. (m)':'Gap (m)')+'</span><input class="input" id="li-cg-bottom" type="number" min="0" max="2" step="0.01" value="'+_gapVal('bottom')+'" placeholder="auto" style="width:72px;min-width:72px;padding:4px 6px;font-size:11px"></div></div>'
        +'<div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;color:var(--muted);min-width:48px">'+(_es?'Izquierda':'Left')+'</span><input class="input" id="li-cs-left" type="number" min="0" max="10" value="'+(_cs.left||0)+'" style="width:72px;min-width:72px;padding:4px 6px" onchange="_updateRectChairTotal()"></div>'
        +'<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:9px;color:var(--muted);min-width:48px">'+(_es?'Esp. (m)':'Gap (m)')+'</span><input class="input" id="li-cg-left" type="number" min="0" max="2" step="0.01" value="'+_gapVal('left')+'" placeholder="auto" style="width:72px;min-width:72px;padding:4px 6px;font-size:11px"></div></div>'
        +'<div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;color:var(--muted);min-width:48px">'+(_es?'Derecha':'Right')+'</span><input class="input" id="li-cs-right" type="number" min="0" max="10" value="'+(_cs.right||0)+'" style="width:72px;min-width:72px;padding:4px 6px" onchange="_updateRectChairTotal()"></div>'
        +'<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:9px;color:var(--muted);min-width:48px">'+(_es?'Esp. (m)':'Gap (m)')+'</span><input class="input" id="li-cg-right" type="number" min="0" max="2" step="0.01" value="'+_gapVal('right')+'" placeholder="auto" style="width:72px;min-width:72px;padding:4px 6px;font-size:11px"></div></div>'
        +'</div>'
        +'<div style="margin-top:4px;font-size:11px;color:var(--muted)">Total: <strong id="li-chairs-total">'+(_cs.top+_cs.bottom+_cs.left+_cs.right||item.chairs||0)+'</strong></div>'
        +'<input type="hidden" id="li-chairs" value="'+(item.chairs||0)+'">'
        +'</div>';
    }():(isTable?`<div class="ig"><label>${_es?'Sillas / Asientos':'Chairs / Seats'}</label>
      <input class="input" id="li-chairs" type="number" value="${item.chairs||0}" min="0" max="30">
    </div>`:'')}
    ${isTable?`<div class="ig" style="grid-column:1/-1"><label>${_es?'Tipo de Mesa':'Table Type'}</label>
      <input type="hidden" id="li-new-typekey" value="">
      <input type="hidden" id="li-new-shape" value="">
      <input type="hidden" id="li-new-w" value="">
      <input type="hidden" id="li-new-h" value="">
      <input type="hidden" id="li-new-chairs" value="">
      <input type="hidden" id="li-new-radius" value="">
      <div style="display:flex;align-items:center;gap:10px">
        <span id="li-type-label" style="font-size:13px;color:var(--text)">${item._typeKey?item._typeKey.replace(/-/g,' ').replace(/(\d)/,' $1'):(item.shape==='round-table'?(item.w/getPPM()).toFixed(1)+'m '+ (_es?'Redonda':'Round'):(item.w/getPPM()).toFixed(1)+'×'+(item.h/getPPM()).toFixed(1)+'m '+(_es?'Rectangular':'Rect'))}</span>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openChangeTableTypePicker('${id}')" style="white-space:nowrap">&#8635; ${_es?'Cambiar Tipo':'Change Type'}</button>
      </div>
    </div>`:''}
    <div class="ig"><label>${_es?'Color de Relleno':'Fill Color'}</label>
      <input class="input" id="li-bg" type="color" value="${item.bg}" style="height:38px;padding:2px">
    </div>
    <div class="ig"><label>${_es?'Color de Etiqueta':'Label Color'}</label>
      <input class="input" id="li-bdc" type="color" value="${item.bdClr}" style="height:38px;padding:2px">
    </div>
    ${isTable?`<div class="ig"><label>${_es?'Línea guía (m)':'Guide line (m)'}</label>
      <input class="input" id="li-outline" type="number" step="0.05" min="0" max="3" value="${(item.outlineOffset!=null?item.outlineOffset:(typeof DEFAULT_OUTLINE_OFFSET!=='undefined'?DEFAULT_OUTLINE_OFFSET:1.30)).toFixed(2)}">
    </div>`:''}
  ${hasChairs?`
  <div class="ig" style="grid-column:1/-1">
    <label style="font-size:10.5px;font-weight:700;color:var(--light);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:8px">${_es?'Estilo de Silla':'Chair Style'}</label>
    <div style="display:flex;align-items:center;gap:6px">
      <select class="input" id="li-ctype" style="font-size:12px;flex:1">${chairOpts}</select>
      <button class="btn btn-ghost btn-sm" type="button" onclick="openChairEditor()" title="${_es?'Gestionar sillas':'Manage Chairs'}" style="white-space:nowrap;font-size:11px;padding:4px 8px">${_es?'Gestionar':'Manage'}</button>
    </div>
  </div>
  <div class="ig" style="grid-column:1/-1">
    <label style="font-size:10.5px;font-weight:700;color:var(--light);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:8px">${_es?'Centro de Mesa':'Centerpiece'}</label>
    <div style="display:flex;align-items:center;gap:6px">
      <select class="input" id="li-cp" style="font-size:12px;flex:1">${cpOpts}</select>
      <button class="btn btn-ghost btn-sm" type="button" onclick="openCenterpieceEditor()" title="${_es?'Gestionar centros de mesa':'Manage Centerpieces'}" style="white-space:nowrap;font-size:11px;padding:4px 8px">${_es?'Gestionar':'Manage'}</button>
    </div>
  </div>`:''}
  <div style="font-size:10.5px;color:var(--muted);margin-bottom:8px;padding:8px;background:rgba(166,124,61,.06);border-radius:6px;border:1px solid rgba(166,124,61,.15)">
    &#9432; ${_es?`Las <strong>instancias</strong> comparten cambios. Las <strong>copias</strong> quedan separadas.`:`<strong>Instances</strong> share changes. <strong>Copies</strong> stay independent.`}
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
    if(ptc.chairSides){
      var _cst=document.getElementById('li-cs-top');
      if(_cst){
        _cst.value=ptc.chairSides.top||0;
        var _csb=document.getElementById('li-cs-bottom');if(_csb)_csb.value=ptc.chairSides.bottom||0;
        var _csl=document.getElementById('li-cs-left');if(_csl)_csl.value=ptc.chairSides.left||0;
        var _csr=document.getElementById('li-cs-right');if(_csr)_csr.value=ptc.chairSides.right||0;
        _updateRectChairTotal();
      }
    }
    // Set li-chairs AFTER chairSides handling so _updateRectChairTotal() can't overwrite it
    // when per-side inputs don't exist (e.g. changing from round → rect)
    var _chInpFinal=document.getElementById('li-chairs');if(_chInpFinal)_chInpFinal.value=ptc.chairs;
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
    return '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 8px">'+(isES?titleES:titleEN)+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
      +items.map(function(it){
        var sel=it.key===currentKey;
        return '<div onclick="selectNewTableType(\''+itemId+'\',\''+it.key+'\')" style="cursor:pointer;padding:8px 6px 6px;border:2px solid '+(sel?'var(--gold)':'var(--border)')+';border-radius:10px;background:'+(sel?'var(--gold-l)':'var(--card)')+';text-align:center;transition:.15s;min-width:72px">'
          +_addTableDrawSVG(it,sel)
          +'<div style="margin-top:5px;font-size:12px;font-weight:600;color:var(--text);line-height:1.2">'+it.label+'</div>'
          +'<div style="font-size:10px;color:var(--muted);margin-top:1px">'+(it.dim||'')+'</div>'
          +'</div>';
      }).join('')
      +'</div>';
  }
  openMo('<div class="mo-title">'+(isES?'Seleccionar Tipo de Mesa':'Select Table Type')+'</div>'
    +'<div style="overflow-y:auto;max-height:55vh">'
    +catSection('round','Round Tables','Mesas Redondas')
    +catSection('rect','Rectangular Tables','Mesas Rectangulares')
    +catSection('s-table','Special Tables','Mesas Especiales')
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="closeMo();openLItemModal(\''+itemId+'\')">&#8592; '+(isES?'Volver':'Back')+'</button>'
    +'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'</div>');
}

function selectNewTableType(itemId,typeKey){
  var catalogue=_addTableCatalogue();
  var cat=catalogue.find(function(c){return c.key===typeKey;});
  if(!cat) return;
  var ppm=(typeof DEFAULT_PPM!=='undefined')?DEFAULT_PPM:(typeof getPPM==='function'?getPPM():40);
  var shapeMap={'round':'round-table','rect':'rect-table','s-table':'s-table'};
  var shape=shapeMap[cat.cat]||'rect-table';
  var tw=Math.round(cat.wM*ppm);
  var th=Math.round(cat.hM*ppm);
  var radius=cat.cat==='round'?'50%':'0px';
  // Store in a temporary global so the edit modal can read it
  window._pendingTypeChange={typeKey:typeKey,shape:shape,w:tw,h:th,chairs:cat.chairs,chairSides:cat.chairSides||null,radius:radius,label:cat.label};
  closeMo();
  // Re-open the edit modal — the hidden inputs will be populated
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
  const _chEl=document.getElementById('li-chairs');
  const newChairs=_chEl?+_chEl.value:(item.chairs||0);
  var _olEl=document.getElementById('li-outline');
  var newOutlineOffset=_olEl?parseFloat(_olEl.value):null;
  if(newOutlineOffset!=null&&isNaN(newOutlineOffset)) newOutlineOffset=(typeof DEFAULT_OUTLINE_OFFSET!=='undefined'?DEFAULT_OUTLINE_OFFSET:1.30);
  var newChairSides=null;
  var newChairGaps=null;
  var _csTopEl=document.getElementById('li-cs-top');
  if(_csTopEl){
    newChairSides={
      top:+(document.getElementById('li-cs-top')||{}).value||0,
      bottom:+(document.getElementById('li-cs-bottom')||{}).value||0,
      left:+(document.getElementById('li-cs-left')||{}).value||0,
      right:+(document.getElementById('li-cs-right')||{}).value||0
    };
    // Read per-side gaps (empty = auto)
    var _cgT=document.getElementById('li-cg-top'),_cgB=document.getElementById('li-cg-bottom');
    var _cgL=document.getElementById('li-cg-left'),_cgR=document.getElementById('li-cg-right');
    newChairGaps={};
    if(_cgT&&_cgT.value!=='') newChairGaps.top=parseFloat(_cgT.value);
    if(_cgB&&_cgB.value!=='') newChairGaps.bottom=parseFloat(_cgB.value);
    if(_cgL&&_cgL.value!=='') newChairGaps.left=parseFloat(_cgL.value);
    if(_cgR&&_cgR.value!=='') newChairGaps.right=parseFloat(_cgR.value);
    if(!Object.keys(newChairGaps).length) newChairGaps=null;
  }
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
    // When shape changes via type picker, use the catalogue's chairSides
    // instead of form inputs (which were rendered for the OLD shape)
    var _catEntry=_addTableCatalogue().find(function(c){return c.key===newTypeKey;});
    if(_catEntry){
      if(_catEntry.chairSides) newChairSides=_catEntry.chairSides;
      else { newChairSides=null; newChairGaps=null; }
    }
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
    if(newChairSides) it.chairSides=newChairSides;
    else if(newShape!=='rect-table') delete it.chairSides;
    if(newChairGaps) it.chairGaps=newChairGaps;
    else if(newShape!=='rect-table') delete it.chairGaps;
    if(newOutlineOffset!=null) it.outlineOffset=newOutlineOffset;
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
  toast(LANG==='es' ? ('Aplicado a '+totalUpdated+' elemento'+(totalUpdated!==1?'s':'')) : ('Applied to '+totalUpdated+' item'+(totalUpdated!==1?'s':'')),'s');
}



var _lt={pinching:false,lastDist:0,lastMid:null,lastTap:0,tapId:null,dragId:null,dragFp:false,didDrag:false,longPressTimer:null,offX:0,offY:0};
function _ltDist(t){ return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY); }
function _ltSnap(n){ return LState.useSnap?Math.round(n/LState.snapGrid)*LState.snapGrid:Math.round(n); }
function _ltClearLongPress(){ if(_lt.longPressTimer){clearTimeout(_lt.longPressTimer);_lt.longPressTimer=null;} }
function initLayoutTouchHandlers(){
  var co=document.getElementById('lcanvas-outer');
  var cv=document.getElementById('lcanvas');
  if(!co||!cv||co._ltBound) return;
  co._ltBound=true;
  co.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      _lt.pinching=true; _lt.lastDist=_ltDist(e.touches);
      _lt.lastMid={x:(e.touches[0].clientX+e.touches[1].clientX)/2,y:(e.touches[0].clientY+e.touches[1].clientY)/2};
      _ltClearLongPress(); e.preventDefault(); return;
    }
    _lt.pinching=false; _lt.didDrag=false;
    var touch=e.touches[0];
    // Floorplan drag
    var fpEl=touch.target.closest('#fp-img');
    if(fpEl&&LState.floorplan&&!LState.floorplan.locked){
      _lt.dragFp=true; _lt.dragId=null;
      var cr=cv.getBoundingClientRect();
      _lt.offX=(touch.clientX-cr.left)/LState.zoom-LState.floorplan.x;
      _lt.offY=(touch.clientY-cr.top)/LState.zoom-LState.floorplan.y;
      e.preventDefault(); return;
    }
    // Item drag
    var item=touch.target.closest('.litem');
    if(item){
      var id=item.dataset.id;
      var now=Date.now();
      if(now-_lt.lastTap<350&&_lt.tapId===id){ openLItemModal(id); _lt.lastTap=0; _lt.tapId=null; _ltClearLongPress(); e.preventDefault(); return; }
      _lt.lastTap=now; _lt.tapId=id;
      var cr=cv.getBoundingClientRect();
      var mx=(touch.clientX-cr.left)/LState.zoom, my=(touch.clientY-cr.top)/LState.zoom;
      var it=LState.items.find(i=>i.id===id);
      if(it){
        _lt.dragId=id; _lt.offX=mx-it.x; _lt.offY=my-it.y;
        co.classList.add('layout-dragging-item');
        if(!LState.sel.includes(id)){LState.sel=[id];updateSelUI();}
        // Long-press context menu
        var tx=touch.clientX,ty=touch.clientY;
        _ltClearLongPress();
        _lt.longPressTimer=setTimeout(function(){
          if(_lt.dragId===id&&!_lt.didDrag){
            _lItemContextMenu({clientX:tx,clientY:ty,preventDefault:function(){}},id);
            _lt.dragId=null;
          }
        },500);
      }
      e.preventDefault();
    } else {
      // Single-finger on empty canvas = pan
      _lt.dragId=null; _lt.dragFp=false;
      _lt.panning=true;
      _lt.panStartX=touch.clientX; _lt.panStartY=touch.clientY;
      _lt.panScrollX=co.scrollLeft; _lt.panScrollY=co.scrollTop;
    }
  },{passive:false});
  co.addEventListener('touchmove',function(e){
    // Pinch-zoom + two-finger pan
    if(_lt.pinching&&e.touches.length===2){
      var nd=_ltDist(e.touches), ratio=nd/(_lt.lastDist||nd);
      if(Math.abs(ratio-1)>0.015){ lZoom((ratio>1?1:-1)*0.03); }
      _lt.lastDist=nd;
      var mid={x:(e.touches[0].clientX+e.touches[1].clientX)/2,y:(e.touches[0].clientY+e.touches[1].clientY)/2};
      if(_lt.lastMid){
        co.scrollLeft-=(mid.x-_lt.lastMid.x);
        co.scrollTop-=(mid.y-_lt.lastMid.y);
      }
      _lt.lastMid=mid;
      e.preventDefault(); return;
    }
    // Floorplan drag
    if(!_lt.pinching&&_lt.dragFp&&e.touches.length===1){
      var t2=e.touches[0], cr2=cv.getBoundingClientRect();
      LState.floorplan.x=Math.round((t2.clientX-cr2.left)/LState.zoom-_lt.offX);
      LState.floorplan.y=Math.round((t2.clientY-cr2.top)/LState.zoom-_lt.offY);
      var fpImg=document.getElementById('fp-img');
      if(fpImg){fpImg.style.left=LState.floorplan.x+'px';fpImg.style.top=LState.floorplan.y+'px';}
      e.preventDefault(); return;
    }
    // Item drag with snap grid
    if(!_lt.pinching&&_lt.dragId&&e.touches.length===1){
      _lt.didDrag=true; _ltClearLongPress();
      var t2=e.touches[0], cr2=cv.getBoundingClientRect();
      var mx2=(t2.clientX-cr2.left)/LState.zoom, my2=(t2.clientY-cr2.top)/LState.zoom;
      var it2=LState.items.find(i=>i.id===_lt.dragId);
      if(it2){ it2.x=_ltSnap(mx2-_lt.offX); it2.y=_ltSnap(my2-_lt.offY); var el=document.getElementById('li_'+it2.id); if(el){el.style.left=it2.x+'px';el.style.top=it2.y+'px';} }
      e.preventDefault();
    }
    // Single-finger canvas pan
    if(_lt.panning&&!_lt.pinching&&!_lt.dragId&&!_lt.dragFp&&e.touches.length===1){
      var pt=e.touches[0];
      co.scrollLeft=_lt.panScrollX-(pt.clientX-_lt.panStartX);
      co.scrollTop=_lt.panScrollY-(pt.clientY-_lt.panStartY);
      e.preventDefault();
    }
  },{passive:false});
  co.addEventListener('touchend',function(){
    _ltClearLongPress();
    if(_lt.dragFp){ var p=proj();if(p&&LState.floorplan){p.layoutFloorplan=LState.floorplan;saveProj(p);lHistorySave();} _lt.dragFp=false; }
    if(_lt.dragId){ var p=proj();p.layoutItems=LState.items;saveProj(p);lHistorySave(); _lt.dragId=null; }
    co.classList.remove('layout-dragging-item');
    _lt.pinching=false; _lt.lastMid=null; _lt.didDrag=false; _lt.panning=false;
  });
  co.addEventListener('touchcancel',function(){
    _ltClearLongPress();
    _lt.dragId=null; _lt.dragFp=false; _lt.panning=false;
    _lt.pinching=false; _lt.lastMid=null; _lt.didDrag=false;
    co.classList.remove('layout-dragging-item');
  },{passive:true});
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
            var centerX=(minX+maxX)/2;
            var centerY=(minY+maxY)/2;
            outer.scrollLeft=_canvasPad + centerX*LState.zoom - vw/2;
            outer.scrollTop=_canvasPad + centerY*LState.zoom - vh/2;
        },20);
      }
    }
  } else {
    LState.zoom=Math.max(0.1,Math.min(3,LState.zoom+delta));
    // Zoom toward point — use cursor if provided, otherwise visible canvas center
    if(outer){
      if(cx==null){
        var vc=_getVisibleCanvasCenter();
        cx=vc.x; cy=vc.y;
      }
      const newZoom=LState.zoom;
      outer.scrollLeft=_canvasPad + cx*newZoom - (cx*oldZoom + _canvasPad - outer.scrollLeft);
      outer.scrollTop=_canvasPad + cy*newZoom - (cy*oldZoom + _canvasPad - outer.scrollTop);
    }
  }
  const canvas=document.getElementById('lcanvas');
  if(canvas)canvas.style.transform=`scale(${LState.zoom})`;
  var zi=document.getElementById('layout-zoom-input');
  if(zi&&document.activeElement!==zi) zi.value=Math.round(LState.zoom*100)+'%';
}
function lZoomTo(val){
  var n=parseInt(String(val).replace(/[^0-9]/g,''),10);
  if(!n||n<10) n=10; if(n>300) n=300;
  var oldZoom=LState.zoom;
  LState.zoom=n/100;
  var outer=document.getElementById('lcanvas-outer');
  if(outer){
    var vc=_getVisibleCanvasCenter();
    outer.scrollLeft=_canvasPad + vc.x*LState.zoom - outer.clientWidth/2;
    outer.scrollTop=_canvasPad + vc.y*LState.zoom - outer.clientHeight/2;
  }
  var canvas=document.getElementById('lcanvas');
  if(canvas) canvas.style.transform='scale('+LState.zoom+')';
  var zi=document.getElementById('layout-zoom-input');
  if(zi) zi.value=Math.round(LState.zoom*100)+'%';
}

function lWheel(e){
  e.preventDefault();
  const outer=document.getElementById('lcanvas-outer');
  const canvas=document.getElementById('lcanvas');
  const outerRect=outer?outer.getBoundingClientRect():null;
  let cx=0,cy=0;
  if(outerRect&&canvas){
    cx=((e.clientX-outerRect.left+outer.scrollLeft-_canvasPad)/LState.zoom);
    cy=((e.clientY-outerRect.top+outer.scrollTop-_canvasPad)/LState.zoom);
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
  openChairEditor();
}




function exportLayoutFull(layoutName){
  if(typeof showLoading === 'function') showLoading(t('exporting'));
  try{ _exportLayoutFullInner(layoutName); }finally{ if(typeof hideLoading === 'function') setTimeout(hideLoading, 500); }
}
function _exportLayoutFullInner(layoutName){
  const p=proj();
  const items=LState.items || [];
  const extras=ensureLayoutQuoteState(p);
  const quote=getLayoutQuoteSummary(items, extras);
  if(!quote.elementRows.length && !quote.chairRows.length && !quote.centerpieceRows.length && !quote.extraRows.length) return toast(LANG==='es'?'No hay elementos para exportar':'No items to export','e');

  const isES = LANG==='es';
  const floorplan = (LState.floorplan && LState.floorplan.img) ? LState.floorplan : (p.floorplan || null);
  const graphic = items.length ? buildLayoutSnapshotGraphic({ items: items, floorplan: floorplan, maxWidth: 1200 }) : null;
  // Resolve the actual layout name — when editing a library entry the pseudo-project name is '__lib_layout__'
  var _resolvedName = layoutName;
  if(!_resolvedName && typeof _libEditingLayoutId!=='undefined' && _libEditingLayoutId && typeof getLib==='function'){
    var _exportLibEntry=getLib().layouts.find(function(e){return e.id===_libEditingLayoutId;});
    if(_exportLibEntry) _resolvedName=_exportLibEntry.name;
  }
  const name = _resolvedName || (p && p.name && p.name!=='__lib_layout__' ? p.name : null) || (isES ? 'Plano' : 'Layout');
  const exportedOn = new Date().toLocaleDateString(isES ? 'es-MX' : 'en-US', { year:'numeric', month:'long', day:'numeric' });
  const summary = getLayoutSummary(items, {}, floorplan);

  function money(v){ return fmtMoney(Number(v||0)); }
  function text(v){ return esc(v==null ? '' : String(v)); }

  const ppm = typeof getPPM==='function' ? getPPM() : 100;

  function colorSwatch(color){
    return `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color||'#e8e2d8'};border:1px solid #ccc;vertical-align:middle;margin-right:4px"></span>`;
  }

  const elementRowsHtml = quote.elementRows.map(function(row){
    const wM=(row.w/ppm).toFixed(1), hM=(row.h/ppm).toFixed(1);
    const dims=row.w&&row.h?`${wM} \xd7 ${hM} m`:'-';
    const tags=[];
    if(row.chairs>0) tags.push(row.chairs+(isES?' sillas':' chairs')+' \xb7 '+text(row.chairLabel));
    if(row.centerpieceLabel) tags.push(text(row.centerpieceLabel));
    const subLabel=tags.length?`<div style="font-size:10px;color:#6f665c;margin-top:2px">${tags.join(' · ')}</div>`:'';
    return `<tr>
      <td>${text(row.label)}${subLabel}</td>
      <td>${colorSwatch(row.bg)}</td>
      <td>${dims}</td>
      <td class="num">${text(row.qty)}</td>
      <td class="num">${money(row.cost)}</td>
      <td class="num strong">${money(row.rowTotal)}</td>
    </tr>`;
  }).join('');

  const chairRowsHtml = quote.chairRows.map(function(row){
    return `<tr>
      <td>${text(row.label)}</td>
      <td>${colorSwatch(row.fill)}</td>
      <td>-</td>
      <td class="num">${text(row.qty)}</td>
      <td class="num">${money(row.unitPrice)}</td>
      <td class="num strong">${money(row.rowTotal)}</td>
    </tr>`;
  }).join('');

  const cpRowsHtml = quote.centerpieceRows.map(function(row){
    return `<tr>
      <td>${text(row.label)}</td>
      <td>${colorSwatch(row.color)}</td>
      <td>-</td>
      <td class="num">${text(row.qty)}</td>
      <td class="num">${money(row.unitPrice)}</td>
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
  .sec-hdr td{background:#faf7f2;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6f665c;padding:6px 8px}
  .preview-wrap{border:1px solid #eee6da;border-radius:14px;background:#fff;padding:12px}
  .preview-img{display:block;width:100%;height:auto;border-radius:10px}
  .footer{display:flex;justify-content:flex-end;margin-top:24px}
  .print-btn{padding:12px 26px;background:#a67c3d;border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer}
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
      <div class="sub">${text(isES?'Generado el':'Generated on')} ${text(exportedOn)}</div>
    </div>
  </section>

  <section class="stats">
    <div class="stat"><div class="n">${money(quote.total)}</div><div class="l">${text(t('layout_quote_title'))}</div></div>
    <div class="stat"><div class="n">${text(quote.totalElements)}</div><div class="l">${text(isES?'Elementos cotizados':'Quoted elements')}</div></div>
    <div class="stat"><div class="n">${text(quote.totalSeats)}</div><div class="l">${text(isES?'Asientos totales':'Total seats')}</div></div>
  </section>

  ${previewHtml}

  ${summary.elements.length ? `
  <section class="panel">
    <h2>${text(isES?'Resumen de Elementos':'Element Summary')}</h2>
    <table>
      <thead>
        <tr>
          <th>${text(isES?'Elemento':'Element')}</th>
          <th>${text(isES?'Dimensiones':'Dimensions')}</th>
          <th class="num">${text(isES?'Cantidad':'Qty')}</th>
          <th>${text(isES?'Etiquetas':'Labels')}</th>
        </tr>
      </thead>
      <tbody>
        ${summary.elements.map(function(row){
          return `<tr>
            <td>${text(row.type)}</td>
            <td>${text(row.dimensions)}</td>
            <td class="num">${row.qty}</td>
            <td class="sub">${text(row.labels.join(', '))}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>` : ''}

  <section class="panel">
    <h2>${text(t('layout_quote_auto'))}</h2>
    <table>
      <thead>
        <tr>
          <th>${text(isES?'Elemento':'Item')}</th>
          <th>${text(isES?'Color':'Color')}</th>
          <th>${text(isES?'Dimensiones':'Dimensions')}</th>
          <th class="num">${text(t('layout_quote_quantity'))}</th>
          <th class="num">${text(t('layout_quote_base'))}</th>
          <th class="num">${text(t('layout_quote_row_total'))}</th>
        </tr>
      </thead>
      <tbody>
        ${quote.elementRows.length ? `<tr class="sec-hdr"><td colspan="6">${text(isES?'Elementos':'Elements')}</td></tr>${elementRowsHtml}` : ''}
        ${quote.chairRows.length ? `<tr class="sec-hdr"><td colspan="6">${text(isES?'Sillas':'Chairs')}</td></tr>${chairRowsHtml}` : ''}
        ${quote.centerpieceRows.length ? `<tr class="sec-hdr"><td colspan="6">${text(isES?'Centros de mesa':'Centerpieces')}</td></tr>${cpRowsHtml}` : ''}
        <tr class="total-row"><td colspan="5">${text(isES?'Subtotal layout':'Layout subtotal')}</td><td class="num">${money(quote.elementsTotal+quote.chairsTotal+quote.centerpiecesTotal)}</td></tr>
      </tbody>
    </table>
  </section>

  ${quote.extraRows.length ? `
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
        ${extraRowsHtml}
        <tr class="total-row"><td colspan="5">${text(isES?'Subtotal personalizado':'Custom subtotal')}</td><td class="num">${money(quote.extrasTotal)}</td></tr>
      </tbody>
    </table>
  </section>` : ''}

  <section class="panel">
    <table>
      <tbody>
        <tr class="total-row"><td colspan="5" style="font-size:15px">${text(isES?'Total general':'Grand total')}</td><td class="num" style="font-size:15px">${money(quote.total)}</td></tr>
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
  toast(isES?'Exportación descargada':'Export downloaded','s');
}

function exportLayoutPDF(){ exportLayoutFull(); }

function exportEventLayoutSnapshot(){
  var p=proj(); if(!p) return;
  var exp=p.layoutExport;
  if(!exp||!exp.image) return toast(LANG==='es'?'No hay layout para exportar':'No layout to export','e');
  var isES=LANG==='es';
  var name=exp.layoutName||(isES?'Layout':'Layout');
  var exportedAt=exp.exportedAt?new Date(exp.exportedAt).toLocaleDateString(isES?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'}):'';
  var genDate=new Date().toLocaleDateString(isES?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'});
  var summary=exp.summary||null;
  function _e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var summaryRowsHtml='';
  if(summary&&summary.elements&&summary.elements.length){
    summaryRowsHtml=summary.elements.map(function(row){
      var labels=row.labels&&row.labels.length?row.labels.join(', '):'';
      return '<tr><td>'+_e(row.type)+'</td><td>'+_e(row.dimensions)+'</td><td class="num">'+row.qty+'</td><td class="muted">'+_e(labels)+'</td></tr>';
    }).join('');
  }

  // Resolve library entry items and costs for the quote (same logic as the viewer)
  var _quoteItems=p.layoutItems||[];
  var _snapshotLibE=null;
  if(exp.layoutId&&typeof getLib==='function'){
    _snapshotLibE=getLib().layouts.find(function(e){return e.id===exp.layoutId;});
    if(_snapshotLibE) _quoteItems=_snapshotLibE.items||[];
  }
  var _savedCT2,_savedCP2,_didSwap2=false;
  if(_snapshotLibE&&(_snapshotLibE.chairTypes||_snapshotLibE.centerpieceTypes)){
    _savedCT2=CHAIR_TYPES;_savedCP2=CENTERPIECE_TYPES;_didSwap2=true;
    syncLayoutStyles({chairTypes:_snapshotLibE.chairTypes||{},centerpieceTypes:_snapshotLibE.centerpieceTypes||{},customShapes:{}});
  }
  var _snapQuote=getLayoutQuoteSummary(_quoteItems,[]);
  if(_didSwap2){CHAIR_TYPES=_savedCT2;CENTERPIECE_TYPES=_savedCP2;}
  var _snapHasQuote=_snapQuote.elementRows.length||_snapQuote.chairRows.length||_snapQuote.centerpieceRows.length;

  function _money(v){return typeof fmtMoney==='function'?fmtMoney(Number(v||0)):String(Number(v||0).toFixed(2));}
  function _swatch(color){return '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+(color||'#e8e2d8')+';border:1px solid #ccc;vertical-align:middle;margin-right:3px"></span>';}
  var ppm2=typeof getPPM==='function'?getPPM():100;

  var _quoteBodyHtml='';
  if(_snapQuote.elementRows.length){
    _quoteBodyHtml+='<tr class="sec-hdr"><td colspan="5">'+(isES?'Elementos':'Elements')+'</td></tr>';
    _quoteBodyHtml+=_snapQuote.elementRows.map(function(row){
      var wM=(row.w/ppm2).toFixed(1),hM=(row.h/ppm2).toFixed(1);
      var dims=row.w&&row.h?wM+' \xd7 '+hM+' m':'-';
      var tags=[];
      if(row.chairs>0)tags.push(row.chairs+(isES?' sillas':' chairs')+' \xb7 '+_e(row.chairLabel));
      if(row.centerpieceLabel)tags.push(_e(row.centerpieceLabel));
      var sub=tags.length?'<div style="font-size:10px;color:#6f665c;margin-top:2px">'+tags.join(' · ')+'</div>':'';
      return '<tr><td>'+_e(row.label)+sub+'</td><td>'+_swatch(row.bg)+dims+'</td><td class="num">'+row.qty+'</td><td class="num">'+_money(row.cost)+'</td><td class="num strong">'+_money(row.rowTotal)+'</td></tr>';
    }).join('');
  }
  if(_snapQuote.chairRows.length){
    _quoteBodyHtml+='<tr class="sec-hdr"><td colspan="5">'+(isES?'Sillas':'Chairs')+'</td></tr>';
    _quoteBodyHtml+=_snapQuote.chairRows.map(function(row){
      return '<tr><td>'+_e(row.label)+'</td><td>'+_swatch(row.fill)+'-</td><td class="num">'+row.qty+'</td><td class="num">'+_money(row.unitPrice)+'</td><td class="num strong">'+_money(row.rowTotal)+'</td></tr>';
    }).join('');
  }
  if(_snapQuote.centerpieceRows.length){
    _quoteBodyHtml+='<tr class="sec-hdr"><td colspan="5">'+(isES?'Centros de mesa':'Centerpieces')+'</td></tr>';
    _quoteBodyHtml+=_snapQuote.centerpieceRows.map(function(row){
      return '<tr><td>'+_e(row.label)+'</td><td>'+_swatch(row.color)+'-</td><td class="num">'+row.qty+'</td><td class="num">'+_money(row.unitPrice)+'</td><td class="num strong">'+_money(row.rowTotal)+'</td></tr>';
    }).join('');
  }
  if(_snapHasQuote){
    _quoteBodyHtml+='<tr class="total-row"><td colspan="4">'+(isES?'Subtotal':'Subtotal')+'</td><td class="num">'+_money(_snapQuote.autoTotal)+'</td></tr>';
  }

  var css='*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:"Segoe UI",system-ui,Arial,sans-serif;color:#241f17;background:#f6f1e8;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'.cover{background:#fff;padding:52px 56px 44px;border-bottom:4px solid #a67c3d}'
    +'.brand{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#a67c3d;margin-bottom:28px}'
    +'.lname{font-size:36px;font-weight:700;letter-spacing:-.5px;color:#241f17;margin-bottom:8px}'
    +'.evname{font-size:15px;color:#6f665c;margin-bottom:20px}'
    +'.rule{width:48px;height:3px;background:#a67c3d;border-radius:2px;margin-bottom:20px}'
    +'.meta{font-size:11px;color:#b0a898}'
    +'.body{padding:36px 48px}'
    +'.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:24px}'
    +'.stat{background:#fff;border:1px solid #e7dccb;border-radius:12px;padding:14px 16px}'
    +'.stat-v{font-size:22px;font-weight:700;color:#8a6a1d;line-height:1}'
    +'.stat-l{font-size:10px;color:#b0a898;text-transform:uppercase;letter-spacing:.07em;margin-top:5px}'
    +'.img-wrap{background:#fff;border:1px solid #e7dccb;border-radius:16px;overflow:hidden;margin-bottom:24px}'
    +'.img-wrap img{display:block;width:100%;height:auto}'
    +'.panel{background:#fff;border:1px solid #e7dccb;border-radius:16px;overflow:hidden}'
    +'.panel-title{padding:14px 18px;font-size:13px;font-weight:700;border-bottom:1px solid #e7dccb;background:#f6f1e8}'
    +'table{width:100%;border-collapse:collapse;font-size:12px}'
    +'th{padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6f665c;border-bottom:1px solid #e7dccb;background:#faf7f2}'
    +'td{padding:9px 14px;border-bottom:1px solid #f2ece0;color:#241f17}'
    +'tr:last-child td{border-bottom:none}'
    +'td.num{text-align:right;font-weight:600}'
    +'td.muted{color:#6f665c}'
    +'.sec-hdr td{background:#faf7f2;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6f665c;padding:6px 14px}'
    +'.total-row td{background:#fbf5e7;font-weight:700}'
    +'.strong{font-weight:700;color:#8a6a1d}'
    +'.mb{margin-bottom:16px}'
    +'.print-btn{margin-top:20px;padding:10px 22px;background:#a67c3d;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:13px}'
    +'@media print{body{background:#fff}.body{background:#fff}.print-btn{display:none}}';

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+_e(name)+' — '+_e(p.name||'')+'</title><style>'+css+'</style></head><body>'
    +'<div class="cover">'
      +'<div class="brand">EventOS &nbsp;·&nbsp; '+(isES?'Plano del Evento':'Event Layout')+'</div>'
      +'<div class="lname">'+_e(name)+'</div>'
      +(p.name?'<div class="evname">'+_e(p.name)+'</div>':'')
      +'<div class="rule"></div>'
      +'<div class="meta">'+(exportedAt?(isES?'Exportado el ':'Exported on ')+exportedAt+'&ensp;&middot;&ensp;':'')+(isES?'Generado el ':'Generated on ')+genDate+'</div>'
    +'</div>'
    +'<div class="body">';

  if(summary){
    html+='<div class="stats">'
      +'<div class="stat"><div class="stat-v">'+(summary.tables||0)+'</div><div class="stat-l">'+(isES?'Mesas':'Tables')+'</div></div>'
      +'<div class="stat"><div class="stat-v">'+(summary.guests||'—')+'</div><div class="stat-l">'+(isES?'Invitados':'Guests')+'</div></div>'
      +'<div class="stat"><div class="stat-v">'+((summary.elements||[]).reduce(function(s,r){return s+r.qty;},0)||0)+'</div><div class="stat-l">'+(isES?'Elementos':'Elements')+'</div></div>'
    +'</div>';
  }

  html+='<div class="img-wrap"><img src="'+exp.image+'" alt="'+_e(name)+'"></div>';

  if(summaryRowsHtml){
    html+='<div class="panel">'
      +'<div class="panel-title">'+(isES?'Resumen de Elementos':'Element Summary')+'</div>'
      +'<table><thead><tr>'
        +'<th>'+(isES?'Elemento':'Element')+'</th>'
        +'<th>'+(isES?'Dimensiones':'Dimensions')+'</th>'
        +'<th style="text-align:right">'+(isES?'Cantidad':'Qty')+'</th>'
        +'<th>'+(isES?'Etiquetas':'Labels')+'</th>'
      +'</tr></thead><tbody>'+summaryRowsHtml+'</tbody></table>'
    +'</div>';
  }

  if(_snapHasQuote){
    html+='<div class="panel mb" style="margin-top:16px">'
      +'<div class="panel-title">'+(isES?'Cotización de Layout':'Layout Quote')+'</div>'
      +'<table><thead><tr>'
        +'<th>'+(isES?'Elemento':'Item')+'</th>'
        +'<th>'+(isES?'Dimensiones / Color':'Dimensions / Color')+'</th>'
        +'<th style="text-align:right">'+(isES?'Cantidad':'Qty')+'</th>'
        +'<th style="text-align:right">'+(isES?'Precio unitario':'Unit price')+'</th>'
        +'<th style="text-align:right">'+(isES?'Subtotal':'Subtotal')+'</th>'
      +'</tr></thead>'
      +'<tbody>'+_quoteBodyHtml+'</tbody>'
      +'</table>'
    +'</div>';
  }

  html+='<div style="margin-top:20px;text-align:right"><button class="print-btn" onclick="window.print()">'+(isES?'Imprimir / Guardar PDF':'Print / Save PDF')+'</button></div>'
    +'</div></body></html>';

  var blob=new Blob([html],{type:'text/html'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name.replace(/[^a-zA-Z0-9_\-]/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.html';
  a.click();
  toast(isES?'Layout exportado':'Layout exported','s');
}


// ─── Layout Editor Guided Tour ─────────────────────────────────────────────

var _lTourIndex=0;

var _lTourSteps=[
  {
    target:'add-element-trigger',
    title:function(){return LANG==='es'?'Agregar elementos':'Add Elements';},
    body:function(){return LANG==='es'
      ?'Haz clic aquí para agregar mesas y elementos de evento al plano. También puedes cargar una imagen de plano de piso.'
      :'Click here to add tables and event elements to your layout. You can also upload a floorplan image.';},
    pos:'bottom'
  },
  {
    target:'layout-zoom-bar',
    title:function(){return LANG==='es'?'Zoom':'Zoom';},
    body:function(){return LANG==='es'
      ?'Usa los botones – y + para hacer zoom. También puedes hacer scroll con el mouse sobre el lienzo para acercar o alejar.'
      :'Use the – and + buttons to zoom. You can also scroll the mouse wheel over the canvas to zoom in and out.';},
    pos:'bottom'
  },
  {
    target:'lbtn-zoom-fit',
    title:function(){return LANG==='es'?'Zoom para ajustar':'Zoom to Fit';},
    body:function(){return LANG==='es'
      ?'Haz clic para que todos los elementos quepan en la pantalla de una vez.'
      :'Click to fit all elements into view at once.';},
    pos:'bottom'
  },
  {
    target:'lbtn-zoom-sel',
    title:function(){return LANG==='es'?'Zoom a selección':'Zoom to Selected';},
    body:function(){return LANG==='es'
      ?'Selecciona uno o más elementos y haz clic aquí para enfocar la vista en ellos.'
      :'Select one or more elements, then click here to focus the view on them.';},
    pos:'bottom'
  },
  {
    target:'lbtn-measure',
    title:function(){return LANG==='es'?'Herramienta de medición':'Measure Tool';},
    body:function(){return LANG==='es'
      ?'Activa la herramienta de medición y haz clic y arrastra en el lienzo para medir distancias entre puntos.'
      :'Activate the measure tool and click-drag on the canvas to measure distances between points.';},
    pos:'bottom'
  },
  {
    target:'lbtn-snap',
    title:function(){return LANG==='es'?'Alinear a cuadrícula (Snap)':'Snap to Grid';},
    body:function(){return LANG==='es'
      ?'Cuando está activado, los elementos se alinean automáticamente a la cuadrícula al moverlos, facilitando la organización precisa.'
      :'When enabled, elements snap to the grid as you move them, making precise arrangement easy.';},
    pos:'bottom'
  },
  {
    target:'lbtn-floorplan',
    fallback:'add-element-trigger',
    title:function(){return LANG==='es'?'Controles del plano de piso':'Floorplan Controls';},
    body:function(){return LANG==='es'
      ?'Cuando hay un plano cargado, usa estos controles para cambiar la imagen, calibrar la escala, bloquearla o ajustar su opacidad.'
      :'When a floorplan is loaded, use these controls to swap the image, calibrate scale, lock it in place, or adjust its opacity.';},
    pos:'bottom'
  },
  {
    target:'lbtn-font',
    title:function(){return LANG==='es'?'Controles de fuente':'Font Controls';},
    body:function(){return LANG==='es'
      ?'Ajusta el tamaño de fuente de las etiquetas de los elementos seleccionados.'
      :'Adjust the font size of labels on selected elements.';},
    pos:'bottom'
  },
  {
    target:'lbtn-align',
    title:function(){return LANG==='es'?'Controles de alineación':'Align Controls';},
    body:function(){return LANG==='es'
      ?'Alinea o distribuye varios elementos seleccionados: izquierda, centro, derecha, arriba, medio, abajo, o distribución equitativa.'
      :'Align or distribute multiple selected elements: left, center, right, top, middle, bottom, or even spacing.';},
    pos:'bottom'
  },
  {
    target:'lbtn-rotate',
    title:function(){return LANG==='es'?'Controles de rotación':'Rotate Controls';},
    body:function(){return LANG==='es'
      ?'Rota los elementos seleccionados en sentido horario o antihorario. El número central define los grados por paso.'
      :'Rotate selected elements clockwise or counter-clockwise. The center number sets degrees per step.';},
    pos:'bottom'
  },
  {
    target:'lbtn-quote-toggle',
    title:function(){return LANG==='es'?'Herramienta de cotización':'Quote Tool';},
    body:function(){return LANG==='es'
      ?'Cuando los elementos tienen precios asignados, aparece aquí el total de la cotización. Haz clic para ver el desglose completo de costos del plano.'
      :'When elements have prices assigned, the quote total appears here. Click it to see the full cost breakdown for the layout.';},
    pos:'bottom'
  },
  {
    target:'lbtn-export',
    title:function(){return LANG==='es'?'Exportar':'Export';},
    body:function(){return LANG==='es'
      ?'Exporta tu plano como un archivo HTML completo con detalles de elementos, cotización y una vista previa visual.'
      :'Export your layout as a self-contained HTML file with element details, quote, and a visual preview.';},
    pos:'bottom'
  },
  {
    target:null,
    title:function(){return LANG==='es'?'Edición con doble clic':'Double-Click Editing';},
    body:function(){return LANG==='es'
      ?'Haz doble clic en cualquier elemento del lienzo para editar su etiqueta, precio, sillas y más directamente en el panel de propiedades.'
      :'Double-click any element on the canvas to edit its label, price, chairs, and more directly in the properties panel.';},
    pos:'center'
  },
  {
    target:null,
    title:function(){return LANG==='es'?'Instancia vs. Copia':'Instance vs. Copy';},
    body:function(){return LANG==='es'
      ?'Los elementos de la biblioteca son instancias vinculadas: editarlos actualiza todas sus copias en el plano. Usa el menú contextual para crear una copia independiente.'
      :'Library elements are linked instances: editing one updates all copies in the layout. Use the right-click menu to create an independent copy.';},
    pos:'center'
  },
  {
    target:null,
    title:function(){return LANG==='es'?'Desplazamiento y selección múltiple':'Pan & Multi-Select';},
    body:function(){return LANG==='es'
      ?'<strong>Desplazarse:</strong> Mantén espacio y arrastra para mover el lienzo.<br><strong>Seleccionar varios:</strong> Arrastra en el lienzo vacío para un rectángulo de selección. Mantén Shift y haz clic para agregar o quitar elementos de la selección.'
      :'<strong>Pan:</strong> Hold Space and drag to pan the canvas.<br><strong>Multi-select:</strong> Drag on empty canvas for a selection box. Hold Shift and click to add or remove items from the selection.';},
    pos:'center'
  },
  {
    target:null,
    title:function(){return LANG==='es'?'Atajos de teclado':'Keyboard Shortcuts';},
    body:function(){return LANG==='es'
      ?'<strong>Ctrl+C / Ctrl+V</strong> — Copiar y pegar<br><strong>Supr / Retroceso</strong> — Eliminar seleccionados<br><strong>Ctrl+Z</strong> — Deshacer<br><strong>Flechas</strong> — Mover con precisión'
      :'<strong>Ctrl+C / Ctrl+V</strong> — Copy and paste<br><strong>Delete / Backspace</strong> — Delete selected<br><strong>Ctrl+Z</strong> — Undo<br><strong>Arrow keys</strong> — Nudge selected elements';},
    pos:'center'
  }
];

function startLayoutTour(){
  _lTourIndex=0;
  _renderLayoutTourStep();
}

function _lTourGetEl(step){
  if(!step.target) return null;
  var el=document.getElementById(step.target);
  if(!el && step.fallback) el=document.getElementById(step.fallback);
  return el||null;
}

function _renderLayoutTourStep(){
  var existing=document.getElementById('ltour-overlay');
  if(existing) existing.remove();

  if(_lTourIndex>=_lTourSteps.length){ _lTourEnd(); return; }

  var step=_lTourSteps[_lTourIndex];
  var targetEl=_lTourGetEl(step);
  var isCenter=!targetEl||step.pos==='center';
  var isES=LANG==='es';
  var total=_lTourSteps.length;

  // Progress dots
  var dots='';
  for(var i=0;i<total;i++){
    dots+='<span style="width:'+(i===_lTourIndex?'18':'7')+'px;height:7px;border-radius:4px;background:'+(i===_lTourIndex?'var(--gold,#a67c3d)':'rgba(166,124,61,.3)')+';display:inline-block;transition:width .25s,background .25s"></span>';
  }

  // Spotlight rect
  var spotRect=null;
  if(targetEl){
    var r=targetEl.getBoundingClientRect();
    var pad=8;
    spotRect={x:r.left-pad,y:r.top-pad,w:r.width+pad*2,h:r.height+pad*2};
  }

  // Card position
  var cardStyle='';
  if(isCenter){
    cardStyle='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100002;';
  } else {
    var br=targetEl.getBoundingClientRect();
    var vw=window.innerWidth;
    var cardW=320;
    var left=br.left+cardW+12>vw ? Math.max(12,br.right-cardW) : br.left;
    left=Math.max(12,Math.min(left,vw-cardW-12));
    var top=br.bottom+12;
    if(top+240>window.innerHeight) top=br.top-252;
    if(top<8) top=8;
    cardStyle='position:fixed;top:'+top+'px;left:'+left+'px;z-index:100002;';
  }

  // SVG mask
  var svgMask='';
  if(spotRect){
    var rx=Math.min(10,spotRect.h/2);
    svgMask='<svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100001" xmlns="http://www.w3.org/2000/svg"><defs><mask id="ltourmask"><rect width="100%" height="100%" fill="white"/><rect x="'+spotRect.x+'" y="'+spotRect.y+'" width="'+spotRect.w+'" height="'+spotRect.h+'" rx="'+rx+'" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(10,8,5,0.62)" mask="url(#ltourmask)"/></svg>';
  } else {
    svgMask='<div style="position:fixed;inset:0;background:rgba(10,8,5,0.55);z-index:100001;pointer-events:none"></div>';
  }

  var prevBtn=_lTourIndex>0
    ?'<button onclick="_lTourPrev()" style="border:1px solid var(--border,#e7dccb);background:transparent;color:var(--text,#241f17);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">'+(isES?'Atrás':'Back')+'</button>'
    :'';
  var nextLabel=_lTourIndex===total-1?(isES?'Finalizar':'Done'):(isES?'Siguiente':'Next');

  var html='<div id="ltour-overlay" style="position:fixed;inset:0;z-index:100000;pointer-events:none">'
    +svgMask
    +'<div style="'+cardStyle+'pointer-events:auto;width:320px;background:var(--card,#fff);border:1px solid var(--border,#e7dccb);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.22);padding:22px 22px 18px;font-family:inherit;box-sizing:border-box">'
    +  '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">'
    +    '<div style="font-size:15px;font-weight:700;color:var(--text,#241f17);line-height:1.3">'+step.title()+'</div>'
    +    '<button onclick="_lTourEnd()" style="border:none;background:transparent;cursor:pointer;color:var(--muted,#9a8a6a);font-size:20px;line-height:1;padding:0;flex-shrink:0;margin-top:-2px" title="'+(isES?'Cerrar tour':'Close tour')+'">×</button>'
    +  '</div>'
    +  '<div style="font-size:13px;color:var(--muted,#6f665c);line-height:1.65;margin-bottom:18px">'+step.body()+'</div>'
    +  '<div style="display:flex;align-items:center;gap:8px">'
    +    '<div style="display:flex;gap:4px;align-items:center;flex:1;min-width:0;overflow:hidden">'+dots+'</div>'
    +    '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">'
    +      prevBtn
    +      '<button onclick="_lTourNext()" style="border:none;background:var(--gold,#a67c3d);color:#fff;border-radius:8px;padding:6px 18px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">'+nextLabel+'</button>'
    +    '</div>'
    +  '</div>'
    +'</div>'
    +'</div>';

  var wrap=document.createElement('div');
  wrap.innerHTML=html;
  document.body.appendChild(wrap.firstChild);
}

function _lTourNext(){
  _lTourIndex++;
  if(_lTourIndex>=_lTourSteps.length){ _lTourEnd(); return; }
  _renderLayoutTourStep();
}

function _lTourPrev(){
  if(_lTourIndex>0){ _lTourIndex--; _renderLayoutTourStep(); }
}

function _lTourEnd(){
  var el=document.getElementById('ltour-overlay');
  if(el) el.remove();
}







    _lDragItem=null;_lDragOffsets={};_lDragAxisLock=null;




















