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

function renderLayout(){
  var _savedScroll={x:0,y:0};
  var _outerBefore=document.getElementById('lcanvas-outer');
  if(_outerBefore){_savedScroll.x=_outerBefore.scrollLeft;_savedScroll.y=_outerBefore.scrollTop;}
  const p=proj();
  LState.items=p.layoutItems||[];
  syncLayoutStyles(p);
  if(LHistorySaving&&LHistory.length===0) lHistorySave();
  LSHAPES=getLSHAPES();
  if(p.floorplan&&p.floorplan.img){
    LState.floorplan=Object.assign({opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false,rotation:0},p.floorplan);
  } else {
    LState.floorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0,locked:false};
  }
  if(typeof _measureLines==='undefined')window._measureLines=[];
  if(typeof _measurePoints==='undefined')window._measurePoints=[];
  const el=document.getElementById('tab-layout');
  if(window.innerWidth <= 768){
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  } else {
    var tnavH = (document.querySelector('.tnav')||{}).offsetHeight || 62;
    var pnavH = (document.querySelector('.pnav')||{}).offsetHeight || 58;
    el.style.height = 'calc(100vh - ' + (tnavH + pnavH) + 'px)';
    el.style.overflow = 'hidden';
  }
  el.innerHTML=`
  <div class="layout-shell">
    <!-- SIDEBAR -->
    <div class="layout-sidebar">
      
      <!-- Tables (collapsible) -->
      <div class="layout-sb-section">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="toggleSbSection('sb-tables')">
          <div class="layout-sb-title" style="margin-bottom:0">${t('tables')}</div>
          <div style="display:flex;gap:4px;align-items:center">
            <button onclick="event.stopPropagation();openTableTypesEditor()" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px">✏️</button>
            <span id="sb-tables-arrow" style="font-size:11px;color:var(--muted);transition:.2s">▼</span>
          </div>
        </div>
        <div id="sb-tables" style="margin-top:8px;display:none">
          ${Object.keys(LSHAPES_M).filter(k=>['round-table','rect-table','square-table'].includes(k)||LSHAPES_M[k]._isCustomTable).map(k=>{
            const s=LSHAPES_M[k];
            return lAddBtn(k,s.label,s.radius==='50%'?'⬤':'◼',s.bg,s.bdClr);
          }).join('')}
        </div>
      </div>
      <!-- Event Elements (collapsible) -->
      <div class="layout-sb-section">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="toggleSbSection('sb-elements')">
          <div class="layout-sb-title" style="margin-bottom:0">${t('event_elements')}</div>
          <div style="display:flex;gap:4px;align-items:center">
            <button onclick="event.stopPropagation();openElementTypesEditor()" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px">✏️</button>
            <span id="sb-elements-arrow" style="font-size:11px;color:var(--muted);transition:.2s">▼</span>
          </div>
        </div>
        <div id="sb-elements" style="margin-top:8px;display:none">
          ${Object.keys(LSHAPES_M).filter(k=>!['round-table','rect-table','square-table'].includes(k)&&!LSHAPES_M[k]._isCustomTable).map(k=>{
            const s=LSHAPES_M[k];
            return lAddBtn(k,s.label,'◼',s.bg,s.bdClr);
          }).join('')}
        </div>
      </div>
      <!-- Chairs (collapsible) -->
      <div class="layout-sb-section">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="toggleSbSection('sb-chairs')">
          <div class="layout-sb-title" style="margin-bottom:0">${t('chairs_section')}</div>
          <div style="display:flex;gap:4px;align-items:center">
            <button onclick="event.stopPropagation();openChairEditor()" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px">✏️</button>
            <span id="sb-chairs-arrow" style="font-size:11px;color:var(--muted);transition:.2s">▼</span>
          </div>
        </div>
        <div id="sb-chairs" style="margin-top:8px;display:none">
          <div style="display:flex;flex-direction:column;gap:3px">
            ${Object.entries(CHAIR_TYPES).filter(([k])=>k!=='default').map(([k,v])=>`
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:13px;height:13px;border-radius:50%;flex-shrink:0;background:${v.fill.startsWith('rgba')?'#e8e8e8':v.fill};${v.stroke?'border:1.5px solid '+v.stroke:'border:none'}"></div>
              <span style="font-size:10.5px;color:var(--muted)">${v.label}${v.costPerChair>0?` <span style="color:var(--gold-h)">$${v.costPerChair}/silla</span>`:''}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <!-- Centerpieces (collapsible) -->
      <div class="layout-sb-section">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="toggleSbSection('sb-centrepieces')">
          <div class="layout-sb-title" style="margin-bottom:0">${t('centrepieces_section')}</div>
          <div style="display:flex;gap:4px;align-items:center">
            <button onclick="event.stopPropagation();openCenterpieceEditor()" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px">✏️</button>
            <span id="sb-centrepieces-arrow" style="font-size:11px;color:var(--muted);transition:.2s">▼</span>
          </div>
        </div>
        <div id="sb-centrepieces" style="margin-top:8px;display:none">
          <div style="display:flex;flex-direction:column;gap:3px">
            ${Object.entries(CENTERPIECE_TYPES).filter(([k])=>k!=='none').map(([k,v])=>`
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:13px;height:13px;border-radius:50%;flex-shrink:0;background:${v.color||'#ccc'}"></div>
              <span style="font-size:10.5px;color:var(--muted)">${v.label}${v.cost>0?` <span style="color:var(--gold-h)">$${v.cost}/pc</span>`:''}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <!-- Floorplan -->
      <div class="layout-sb-section">
        <div class="layout-sb-title" style="display:flex;align-items:center;justify-content:space-between">
          ${t('floorplan_lbl')}
          ${LState.floorplan.img?`<div style="display:flex;gap:4px;align-items:center">
            <button onclick="toggleFloorplanLock()" title="${LState.floorplan.locked?'Unlock floorplan to move/scale':'Lock floorplan to prevent accidental moves'}"
              style="font-size:10px;font-weight:700;letter-spacing:.03em;background:${LState.floorplan.locked?'var(--gold-l)':'transparent'};border:1px solid ${LState.floorplan.locked?'var(--gold)':'var(--border)'};border-radius:5px;cursor:pointer;color:${LState.floorplan.locked?'var(--gold-h)':'var(--muted)'};padding:3px 8px;line-height:1.4;transition:var(--tr)"
              onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold-h)'" onmouseout="this.style.borderColor='${LState.floorplan.locked?'var(--gold)':'var(--border)'}';this.style.color='${LState.floorplan.locked?'var(--gold-h)':'var(--muted)'}'">${LState.floorplan.locked?'Unlock':'Lock'}</button>
            <button onclick="removeFloorplan()" class="btn btn-danger btn-sm" style="font-size:10px;padding:3px 8px">${LANG==='es'?'Quitar plano':'Remove plan'}</button>
          </div>`:''} 
        </div>
        ${LState.floorplan.img?`
        <div style="margin-bottom:8px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">${t('opacity_lbl')}</label>
          <input type="range" min="0.05" max="1" step="0.05" value="${LState.floorplan.opacity}"
            oninput="LState.floorplan.opacity=+this.value;saveFloorplan();renderLayoutCanvas()"
            style="width:100%;height:4px;cursor:pointer">
        </div>
        <div style="margin-bottom:8px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Rotation: ${LState.floorplan.rotation||0}°</label>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="range" min="0" max="359" step="1" value="${LState.floorplan.rotation||0}"
              oninput="LState.floorplan.rotation=+this.value;saveFloorplan();renderLayoutCanvas()"
              style="flex:1;height:4px;cursor:pointer">
            <button onclick="LState.floorplan.rotation=Math.round(((LState.floorplan.rotation||0)-90+360)%360);saveFloorplan();renderLayoutCanvas()" title="Rotate -90°"
              style="font-size:13px;background:transparent;border:1px solid var(--border);border-radius:5px;cursor:pointer;padding:3px 7px;line-height:1.4">↺</button>
            <button onclick="LState.floorplan.rotation=Math.round(((LState.floorplan.rotation||0)+90)%360);saveFloorplan();renderLayoutCanvas()" title="Rotate +90°"
              style="font-size:13px;background:transparent;border:1px solid var(--border);border-radius:5px;cursor:pointer;padding:3px 7px;line-height:1.4">↻</button>
          </div>
        </div>
        <div style="margin-bottom:4px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">
            ${LState.floorplan.pxPerMeter?'Scale set (' + LState.floorplan.pxPerMeter.toFixed(1) + ' px/m)':'Not calibrated — click Scale'}
          </label>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" style="flex:1;font-size:11px" onclick="startScaleMode()" title="Click 2 points on a known distance to calibrate scale">
              📏 ${LState.scaleMode?`<span style=\"color:var(--gold-h)\">Picking... ('+LState.scalePoints.length+'/2)</span>`:'Scale'}
            </button>
            ${LState.scaleMode?`<button class="btn btn-danger btn-sm" onclick="cancelScaleMode()" style="padding:4px 8px">Cancel</button>`:''}
          </div>
          ${LState.scaleMode?`<div style="margin-top:6px;padding:8px;background:var(--gold-l);border-radius:6px;border:1px solid rgba(201,168,76,.3)">
            <div style="font-size:11px;color:var(--gold-h);font-weight:600;margin-bottom:4px">
              ${LState.scalePoints.length===0?'Click point A on canvas':'Click point B on canvas'}
            </div>
            <div class="s-sm">${LState.scalePoints.length===1?'Point A set ✓':''}</div>
          </div>`:''}
          ${LState.scaleMode&&LState.scalePoints.length===2?`
          <div style="margin-top:6px">
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Real distance (meters)</label>
            <div style="display:flex;gap:4px">
              <input type="number" id="scale-dist" class="input" value="5" min="0.1" step="0.1" style="flex:1;padding:4px 8px;font-size:12px">
              <button class="btn btn-primary btn-sm" onclick="applyScaleCalibration()">Apply</button>
            </div>
          </div>`:''} 
        </div>
        `:`
        <div style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;transition:var(--tr)"
          onclick="document.getElementById('fp-upload').click()"
          ondragover="event.preventDefault();this.style.borderColor='var(--gold)'"
          ondragleave="this.style.borderColor='var(--border)'"
          ondrop="event.preventDefault();this.style.borderColor='var(--border)';handleFloorplanDrop(event)">
          <div style="font-size:24px;margin-bottom:6px">🖼️</div>
          <div style="font-size:12px;font-weight:600;color:var(--muted)">${t('upload_floorplan_lbl')}</div>
          <div style="font-size:11px;color:var(--light);margin-top:2px">PNG, JPG, SVG, PDF</div>
        </div>
        <input type="file" id="fp-upload" accept="image/*,.pdf" style="display:none" onchange="handleFloorplanUpload(event)">
        `}
      </div>
      <!-- Properties panel -->
      <div class="layout-sb-section" id="lsb-props" style="display:${LState.sel.length===1?'block':'none'}">
        <div class="layout-sb-title">${t('properties')}</div>
        <div id="lsb-props-inner"></div>
      </div>
      <!-- Item list -->
      <div class="layout-sb-section" style="flex:1">
        <div class="layout-sb-title">${t('items_count')} (${LState.items.length})</div>
        <div id="litem-list" style="max-height:200px;overflow-y:auto">
          ${LState.items.map(item=>`
          <div class="litem-list-row ${LState.sel.includes(item.id)?'sel-row':''}" onclick="lSelectOnly(event,'${item.id}')">
            <div style="width:14px;height:14px;border-radius:${item.shape==='round-table'?'50%':'2px'};background:${item.bg};flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div>
            <span style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.label}</span>
            <button style="width:18px;height:18px;border:none;background:transparent;cursor:pointer;color:var(--muted);font-size:12px" onclick="event.stopPropagation();delLItem('${item.id}')">✕</button>
          </div>`).join('')}
        </div>
      </div>
    </div>
    <!-- MAIN -->
    <!-- MAIN -->
    <div class="layout-main">
      <!-- Toolbar -->
      <div class="layout-toolbar">
        <div class="zoom-bar">
          <button class="zoom-btn" onclick="lZoom(-0.1)">−</button>
          <span style="font-size:12px;font-weight:600;min-width:45px;text-align:center">${Math.round(LState.zoom*100)}%</span>
          <button class="zoom-btn" onclick="lZoom(0.1)">+</button>
        </div>
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <button title="Zoom to fit" onclick="lZoom(0,'fit')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6"/></svg></button>
        <button title="Zoom to selected" onclick="lZoom(0,'sel')" style="width:28px;height:28px;border:1px solid var(--border);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';this.style.borderColor='var(--border)'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="18" cy="18" r="3" fill="currentColor" stroke="none"/></svg></button>
        <button title="${LState.measureMode?'Exit measure (Esc)':'Measure distances'}" onclick="toggleMeasureMode()" style="width:28px;height:28px;border:1px solid ${LState.measureMode?'var(--gold)':'var(--border)'};background:${LState.measureMode?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${LState.measureMode?'var(--gold-h)':'var(--muted)'};transition:var(--tr)" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)';this.style.borderColor='var(--gold)'" onmouseout="this.style.background='${LState.measureMode?'var(--gold-l)':'transparent'}';this.style.color='${LState.measureMode?'var(--gold-h)':'var(--muted)'}';this.style.borderColor='${LState.measureMode?'var(--gold)':'var(--border)'}'"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v4M9 7v3M12 7v4M15 7v3M18 7v4"/></svg></button>
        ${_measureLines.length>0?`<button title="Clear measurements" onclick="clearMeasurements()" style="width:28px;height:28px;border:1px solid rgba(239,68,68,.4);background:transparent;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--danger);font-size:10px;font-weight:700;transition:var(--tr)" onmouseover="this.style.background='rgba(239,68,68,.1)'" onmouseout="this.style.background='transparent'">✕m</button>`:''}
        <div style="width:1px;height:24px;background:var(--border)"></div>
        <span style="font-size:12px;color:var(--muted)">
          ${LState.items.length} ${t('items_count')} ·
          ${LState.items.filter(i=>i.shape.includes('table')).length} ${t('tables_lbl')} ·
          ${LState.items.reduce((s,i)=>s+(i.chairs||0),0)} ${t('chairs_lbl')}

          ${LState.addMode?`<strong style="color:var(--gold-h)"> · Click canvas to place ${LState.addMode.replace('-',' ')}</strong>`:''}
        </span>
        <div style="flex:1"></div>
        ${(()=>{const b=calcLayoutBudget(LState.items);return b.total>0?`<div style="background:var(--gold-l);border:1px solid rgba(201,168,76,.3);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;color:var(--gold-h);cursor:pointer" onclick="showLayoutBudget()" title="View budget breakdown">💰 ${fmtMoney(b.total)}</div>`:'';})()}
        <button onclick="LState.useSnap=!LState.useSnap;renderLayoutUI()" title="Toggle snap to grid"
          style="height:28px;padding:0 10px;border:1px solid ${LState.useSnap?'var(--gold)':'var(--border)'};background:${LState.useSnap?'var(--gold-l)':'transparent'};border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:${LState.useSnap?'var(--gold-h)':'var(--muted)'};transition:var(--tr);white-space:nowrap"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="if(!LState.useSnap)this.style.borderColor='var(--border)'">
          ${LState.useSnap?'⊞ Snap ON':'⊟ Snap OFF'}
        </button>
        <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;opacity:1;gap:5px">
          <span style="font-size:10px;color:var(--muted);margin-right:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Aa</span>
          <button title="Decrease font size" onclick="changeFontSize(-1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">−</button>
          <span style="font-size:11px;color:var(--muted);min-width:44px;text-align:center"><input id="toolbar-font-size" type="number" min="5" max="99" style="width:44px;font-size:12px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px;background:var(--bg);color:var(--text)" placeholder="—" oninput="setFontSizeDirect(+this.value)" onkeydown="if(event.key==='Enter')this.blur();event.stopPropagation();" onclick="event.stopPropagation()"></span>
          <button title="Increase font size" onclick="changeFontSize(1)" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:18px;color:var(--muted);line-height:1" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">+</button>
          <button title="Reset font size" onclick="changeFontSize(0)" style="width:22px;height:22px;border:none;background:transparent;cursor:pointer;border-radius:4px;font-size:9px;color:var(--muted);font-weight:700" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">↺</button>
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
        <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:3px 6px;opacity:1">
          <span style="font-size:10px;color:var(--muted);margin-right:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${t('rotate_lbl')}</span>
          <button title="Rotate -90°" onclick="rotateSelected(-90)" style="width:26px;height:26px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;font-weight:700" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button title="Rotate -90°" onclick="rotateSelected(-90)" style="width:26px;height:26px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px;font-weight:700" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">−90°</button>
          <button title="Rotate +90°" onclick="rotateSelected(90)" style="width:26px;height:26px;border:none;background:transparent;cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px;font-weight:700" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">+90°</button>
          <button title="Rotate +90°" onclick="rotateSelected(90)" class="s-ibtn" onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          </button>
          <div style="width:1px;height:18px;background:var(--border);margin:0 2px"></div>
          <input id="rotate-custom-deg" type="number" value="15" min="-360" max="360" step="1"
            style="width:44px;height:26px;border:1px solid var(--border);border-radius:5px;background:var(--bg2);color:var(--text);font-size:11px;text-align:center;padding:0 2px"
            title="Custom degrees" onclick="event.stopPropagation()">
          <button title="Apply custom rotation" onclick="rotateSelected(+document.getElementById('rotate-custom-deg').value)"
            class="s-ibtn"
            onmouseover="this.style.background='var(--gold-l)';this.style.color='var(--gold-h)'" onmouseout="this.style.background='transparent';this.style.color='var(--muted)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        ${LState.sel.length?`<button class="btn btn-danger btn-sm" onclick="delSelected()">Delete (${LState.sel.length})</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="openSaveLayoutModal()" title="Save current layout as a named version">${t('save_layout')}</button>
        <button class="btn btn-ghost btn-sm" onclick="openLayoutsLibrary()" title="View saved layouts">${(p.savedLayouts||[]).length > 0 ? `📐 Layouts (${(p.savedLayouts||[]).length})` : '📐 Layouts'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libQuickSaveLayout()" title="Save layout to cross-project library">📚 ${LANG==='es'?'Guardar en Biblioteca':'Save to Library'}</button>
        <button class="btn btn-ghost btn-sm" onclick="libQuickLoadLayout()" title="Load layout from cross-project library">📚 ${LANG==='es'?'Cargar de Biblioteca':'Load from Library'}</button>
        <button class="btn btn-ghost btn-sm" onclick="exportLayoutFull()">${t('export')}</button>
      </div>
      <!-- Canvas -->
      <div class="layout-canvas-outer" id="lcanvas-outer"
        onmousedown="lCanvasDown(event)"
        onmousemove="lCanvasMove(event)"
        onmouseup="lCanvasUp(event)"
        onmouseleave="lCanvasUp(event)"
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
            ${LState.items.length===0?`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto">
              <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:var(--muted);margin-bottom:16px">${t('create_general_layout')||'Start your layout'}</div>
              <button class="btn btn-primary" style="padding:14px 28px;font-size:14px;font-weight:700" onclick="openGeneralLayoutModal()">
                ⚡ ${t('create_general_layout')||'Create General Layout'}
              </button>
              <div style="font-size:12px;color:var(--light);margin-top:10px">${LANG==='es'?'O arrastra elementos desde el panel izquierdo':'Or drag elements from the left panel'}</div>
            </div>`:''}
          </div>
          <!-- Measure overlay -->
          <svg id="measure-overlay" style="position:absolute;left:0;top:0;width:${LState.canvasW}px;height:${LState.canvasH}px;pointer-events:none;z-index:200;overflow:visible">
            ${_measureLines.map((ln,i)=>`
              <line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="0"/>
              <circle cx="${ln.x1}" cy="${ln.y1}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
              <circle cx="${ln.x2}" cy="${ln.y2}" r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
              <rect x="${(ln.x1+ln.x2)/2-28}" y="${(ln.y1+ln.y2)/2-22}" width="56" height="18" rx="4" fill="rgba(30,30,50,.82)"/>
              <text x="${(ln.x1+ln.x2)/2}" y="${(ln.y1+ln.y2)/2-9}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" font-family="monospace">${ln.calibrated&&ln.m>0?ln.m.toFixed(2)+'m':ln.px+'px'}</text>
            `).join('')}
            ${_measurePoints.length===1?`
              <circle cx="${_measurePoints[0].x}" cy="${_measurePoints[0].y}" r="6" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
              <line id="measure-preview" x1="${_measurePoints[0].x}" y1="${_measurePoints[0].y}" x2="${_measurePoints[0].x}" y2="${_measurePoints[0].y}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 3"/>
              <text id="measure-preview-label" x="${_measurePoints[0].x}" y="${_measurePoints[0].y-10}" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">…</text>
            `:''}
          </svg>
        </div>
      </div>
      <div style="padding:5px 16px;background:var(--card);border-top:1px solid var(--border);font-size:10.5px;color:var(--muted);display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span>${t('scroll_zoom')}</span>
        <span>${t('space_pan')}</span>
        <span>${t('drag_select')}</span>
        <span>${t('copy_paste')}</span>
        <span>${t('del_remove')}</span>
        ${LState.sel.length?`<span style="color:var(--gold-h);font-weight:600">${LState.sel.length} selected</span>`:''}
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

function renderLItem(item){
  const isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
  const chairsHTML = renderChairs(item);
  const pad = item.chairs ? Math.round(CHAIR_SIZE_M*getPPM())+Math.round(0.05*getPPM()) : 0;
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
  const cs=Math.max(8,Math.round(CHAIR_SIZE_M*getPPM())); // 0.5m chair, min 8px
  const gap=Math.max(2,Math.round(0.05*getPPM())); // 5cm gap
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
    const longSide=4, shortSide=Math.max(1,Math.round((n-longSide*2)/2));
    const top=longSide, bot=longSide, left=shortSide, right=shortSide;
    for(let i=0;i<top;i++)    positions.push({x:(i+1)*w/(top+1),   y:-(cs/2+gap)});
    for(let i=0;i<bot;i++)    positions.push({x:(i+1)*w/(bot+1),   y:h+cs/2+gap});
    for(let i=0;i<left;i++)   positions.push({x:-(cs/2+gap),       y:(i+1)*h/(left+1)});
    for(let i=0;i<right;i++)  positions.push({x:w+cs/2+gap,        y:(i+1)*h/(right+1)});
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

function attachLItemEvents(){
  document.querySelectorAll('.litem').forEach(el=>{
    el.addEventListener('mousedown',lItemDown,{passive:false});
  });
}

let _lDragItem=null,_lDragOffX=0,_lDragOffY=0,_lDidDrag=false;
let _lDragOffsets={};
let _panning=false,_panStart={x:0,y:0},_panOrigin={x:0,y:0};
let _spaceDown=false;
let _marquee=false,_marqueeStart={x:0,y:0};
let _fpDragging=false,_fpDragOffX=0,_fpDragOffY=0;
let _measuring=false,_measurePoints=[],_measureLines=[];
if(!window.LClipboard)window.LClipboard=[];

var LHistory=[], LHistoryPos=-1, LHistorySaving=true;
function lHistorySave(){
  if(!LHistorySaving)return;
  var snapshot=JSON.stringify(LState.items);
  if(LHistoryPos<LHistory.length-1) LHistory=LHistory.slice(0,LHistoryPos+1);
  if(LHistory.length>0&&LHistory[LHistoryPos]===snapshot)return;
  LHistory.push(snapshot);
  if(LHistory.length>60)LHistory.shift();
  LHistoryPos=LHistory.length-1;
}
function lUndo(){
  if(LHistoryPos<=0){toast('Nothing to undo','e');return;}
  LHistoryPos--;
  LHistorySaving=false;
  LState.items=JSON.parse(LHistory[LHistoryPos]);
  LState.sel=[];
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  renderLayout();LHistorySaving=true;toast('Undo','s');
}
function lRedo(){
  if(LHistoryPos>=LHistory.length-1){toast('Nothing to redo','e');return;}
  LHistoryPos++;
  LHistorySaving=false;
  LState.items=JSON.parse(LHistory[LHistoryPos]);
  LState.sel=[];
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  renderLayout();LHistorySaving=true;toast('Redo','s');
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
      if(LState.measureMode){LState.measureMode=false;_measurePoints=[];renderLayout();return;}
      if(LState.scaleMode){cancelScaleMode();return;}
      if(LState.addMode){LState.addMode=null;renderLayout();return;}
      LState.sel=[];updateSelUI();
    }
    return;
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
    lPaste();return;
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
});

function lPaste(){
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
    LState.items.push(newItem);
    newIds.push(newItem.id);
  });
  window.LClipboard=window.LClipboard.map(i=>({...i,x:i.x+offset,y:i.y+offset}));
  const p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.sel=newIds;
  renderLayout();
  lHistorySave();toast(`${newIds.length} item${newIds.length>1?'s':''} pasted`,'s');
}

function lItemDown(e){
  if(e.button!==0)return;
  e.stopPropagation();e.preventDefault();
  const id=e.currentTarget.dataset.id;
  if(!e.shiftKey){
    if(!LState.sel.includes(id)){LState.sel=[id];updateSelUI();}
  } else {
    if(LState.sel.includes(id))LState.sel=LState.sel.filter(s=>s!==id);
    else LState.sel.push(id);
    updateSelUI();
  }
  const canvas=document.getElementById('lcanvas');
  const cr=canvas.getBoundingClientRect();
  const mouseX=(e.clientX-cr.left)/LState.zoom;
  const mouseY=(e.clientY-cr.top)/LState.zoom;
  _lDragItem=id;
  const anchor=LState.items.find(i=>i.id===id);
  if(!anchor)return;
  _lDragOffX=mouseX-anchor.x;
  _lDragOffY=mouseY-anchor.y;
  _lDragOffsets={};
  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    if(it)_lDragOffsets[sid]={dx:it.x-anchor.x,dy:it.y-anchor.y};
  });
  _lDidDrag=false;
}

function lCanvasDown(e){
  if(LState.measureMode&&e.button===0){
    const canvasEl=document.getElementById('lcanvas');
    const cr=canvasEl.getBoundingClientRect();
    const x=(e.clientX-cr.left)/LState.zoom;
    const y=(e.clientY-cr.top)/LState.zoom;
    if(_measurePoints.length===0){
      _measurePoints=[{x,y}];
    } else {
      const pt1=_measurePoints[_measurePoints.length-1];
      const pxDist=Math.hypot(x-pt1.x,y-pt1.y);
      const ppm=LState.floorplan.pxPerMeter||0;
      const realDist=ppm>0?pxDist/ppm:0;
      _measureLines.push({x1:pt1.x,y1:pt1.y,x2:x,y2:y,px:Math.round(pxDist),m:realDist,calibrated:ppm>0});
      _measurePoints=[{x,y}];
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
    const chairPx=Math.round(CHAIR_SIZE_M*getPPM());
    const pad=chairs?chairPx+Math.round(0.05*getPPM()):0;
    const p=proj();
    const isTable=['round-table','rect-table','square-table'].includes(LState.addMode)||!!(LSHAPES_M[LState.addMode]&&LSHAPES_M[LState.addMode]._isCustomTable);
    const tableCount=LState.items.filter(i=>['round-table','rect-table','square-table'].includes(i.shape)||(LSHAPES_M[i.shape]&&LSHAPES_M[i.shape]._isCustomTable)).length+1;
    const newLabel=isTable?String(tableCount):def.label;
    const newItem={
      id:'li'+Date.now(),shape:LState.addMode,
      x:snap(rawX-def.w/2-pad),y:snap(rawY-def.h/2-pad),
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
    LState.sel=[];
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
    const cx=(e.clientX-cr.left)/LState.zoom;
    const cy=(e.clientY-cr.top)/LState.zoom;
    const pt=_measurePoints[0];
    const pxDist=Math.hypot(cx-pt.x,cy-pt.y);
    const realDist=(pxDist/LState.floorplan.scale)/LState.snapGrid;
    let ov=document.getElementById('measure-overlay');
    if(ov){
      const previewLine=ov.querySelector('#measure-preview');
      if(previewLine){
        previewLine.setAttribute('x2',cx);previewLine.setAttribute('y2',cy);
      }
      const previewLabel=ov.querySelector('#measure-preview-label');
      if(previewLabel){
        previewLabel.setAttribute('x',(pt.x+cx)/2);
        previewLabel.setAttribute('y',(pt.y+cy)/2-10);
        const _ppm=LState.floorplan.pxPerMeter||0;
        const _rd=_ppm>0?(Math.hypot(cx-pt.x,cy-pt.y)/_ppm):0;
        previewLabel.textContent=_ppm>0?_rd.toFixed(2)+'m':Math.round(Math.hypot(cx-pt.x,cy-pt.y))+'px';
      }
    }
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
    LState.sel=LState.items.filter(item=>{
      const pad=(item.chairs||0)?30:0;
      const ix=item.x-pad,iy=item.y-pad;
      const iw=item.w+pad*2,ih=item.h+pad*2;
      return ix<rx+rw&&ix+iw>rx&&iy<ry+rh&&iy+ih>ry;
    }).map(i=>i.id);
    updateSelUI();
    return;
  }

  if(_lDragItem===null)return;
  const canvas=document.getElementById('lcanvas');
  const cr=canvas.getBoundingClientRect();
  const snap=n=>LState.useSnap?Math.round(n/LState.snapGrid)*LState.snapGrid:Math.round(n);
  const anchorX=snap((e.clientX-cr.left)/LState.zoom-_lDragOffX);
  const anchorY=snap((e.clientY-cr.top)/LState.zoom-_lDragOffY);
  const anchor=LState.items.find(i=>i.id===_lDragItem);
  if(!anchor)return;

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

  LState.sel.forEach(sid=>{
    const it=LState.items.find(i=>i.id===sid);
    const el2=document.getElementById('li_'+sid);
    if(el2&&it){
      el2.style.left=it.x+'px';el2.style.top=it.y+'px';
    }
  });
}

function lCanvasUp(e){
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
      const p=proj();p.layoutItems=LState.items;saveProj(p);
      lHistorySave();
    }
    _lDragItem=null;_lDragOffsets={};
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
  if(arrow) arrow.textContent=isHidden?'▲':'▼';
}

function duplicateAsCustom(id){
  var item=LState.items.find(function(i){return i.id===id;});
  if(!item)return;
  var isTable=['round-table','rect-table','square-table'].includes(item.shape)||!!(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape]._isCustomTable);
  var isCustomTable=isTable&&!['dance-floor','bar','stage','dj-booth','gift-table','photo-booth'].includes(item.shape);
  var wEl=document.getElementById('li-w');
  var hEl=document.getElementById('li-h');
  var bgEl=document.getElementById('li-bg');
  var bdEl=document.getElementById('li-bdc');
  var chEl=document.getElementById('li-chairs');
  var ctEl=document.getElementById('li-ctype');
  var cpEl=document.getElementById('li-cp');
  var wM=parseFloat(wEl?wEl.value:String(item.w/getPPM()))||item.w/getPPM();
  var hM=parseFloat(hEl?hEl.value:String(item.h/getPPM()))||item.h/getPPM();
  var newBg=bgEl?bgEl.value:item.bg;
  var newBdClr=bdEl?bdEl.value:item.bdClr;
  var newChairs=parseInt(chEl?chEl.value:String(item.chairs||0))||0;
  var newCtype=ctEl?ctEl.value:(item.chairType||'default');
  var newCp=cpEl?cpEl.value:(item.centerpiece||'none');
  window._dupData={id:id,wM:wM,hM:hM,newBg:newBg,newBdClr:newBdClr,newChairs:newChairs,newCtype:newCtype,newCp:newCp,srcRadius:item.radius||'0px',isCustomTable:isCustomTable};
  var html='<div class="mo-title">Create New Type</div>'
    +'<p class="s-hint">A new custom type with the current settings will be created. Only this element will become that new type — all other elements stay unchanged.</p>'
    +'<div class="ig"><label>New Type Name</label>'
    +'<input class="input" id="dup-name" value="'+esc(item.label+' (custom)')+'">'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button class="btn btn-ghost" onclick="openLItemModal(\''+id+'\')">Back</button>'
    +'<button class="btn btn-primary" onclick="confirmDupType()">Create Type</button>'
    +'</div>';
  openMo(html);
  setTimeout(function(){var el=document.getElementById('dup-name');if(el){el.focus();el.select();}},80);
}
function confirmDupType(){
  var el=document.getElementById('dup-name');
  if(!el)return;
  var lbl=el.value.trim();
  if(!lbl){el.style.outline='2px solid var(--danger)';return;}
  var d=window._dupData||{};
  var key='custom-'+(d.isCustomTable?'table':'elem')+'-'+Date.now();
  LSHAPES_M[key]={label:lbl,wm:d.wM||2,hm:d.hM||2,bg:d.newBg||'#e0d8cc',bdClr:d.newBdClr||'#999',radius:d.srcRadius||'0px',chairs:d.newChairs||0,_isCustomTable:!!d.isCustomTable,_isCustomElem:!d.isCustomTable};
  LSHAPES=getLSHAPES();
  var ppm=getPPM();
  var item=LState.items.find(function(i){return i.id===d.id;});
  if(item){
    item.shape=key;
    item.w=Math.round(d.wM*ppm);
    item.h=Math.round(d.hM*ppm);
    item.bg=d.newBg;
    item.bdClr=d.newBdClr;
    item.chairs=d.newChairs;
    item.chairType=d.newCtype;
    item.centerpiece=d.newCp;
    item.radius=d.srcRadius||'0px';
  }
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  closeMo();
  renderLayout();
  toast('Type "'+lbl+'" created — this element is now that type','s');
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
  openMo(`<div class="mo-title">⚡ Create General Layout</div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Configure your venue layout. Default: 30 round tables (6×5), dance floor, shot bar, dinner platform and DJ booth in center.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">⬤ Round Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-round-n" value="30" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-round-chairs" value="10" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-round-cols" value="6" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-round-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-round-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">▬ Rect Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-rect-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-rect-chairs" value="12" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-rect-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-rect-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-rect-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">◼ Square Tables</div>
      <div class="ig"><label># Tables</label><input class="input" type="number" id="gl-sq-n" value="0" min="0"></div>
      <div class="ig"><label>Chairs each</label><input class="input" type="number" id="gl-sq-chairs" value="8" min="0" max="30"></div>
      <div class="ig"><label>Columns</label><input class="input" type="number" id="gl-sq-cols" value="4" min="1"></div>
      <div class="ig"><label>Chair style</label><select class="input" id="gl-sq-ctype" style="font-size:11px">${chairOpts}</select></div>
      <div class="ig"><label>Centerpiece</label><select class="input" id="gl-sq-cp" style="font-size:11px">${cpOpts}</select></div>
    </div>
  </div>
  <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">
    <div style="font-weight:700;font-size:12px;color:var(--gold-h);margin-bottom:10px">🎪 Center Elements</div>
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
    ⚠️ This will replace your current layout. Tables are arranged in a grid; center elements are placed in the middle.
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="generateGeneralLayout()">⚡ Generate Layout</button>
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

  var dfW=Math.round((gn('gl-df-w')||7.32)*ppm),  dfH=Math.round((gn('gl-df-h')||7.32)*ppm);
  var barW=Math.round((gn('gl-bar-w')||dfW/ppm)*ppm), barH=Math.round((gn('gl-bar-h')||0.4)*ppm);
  var stW=Math.round((gn('gl-stage-w')||3.66)*ppm),   stH=Math.round((gn('gl-stage-h')||2.44)*ppm);
  var djW=Math.round((gn('gl-dj-w')||3.66)*ppm),      djH=Math.round((gn('gl-dj-h')||1.22)*ppm);

  var rDef=LSHAPES['round-table'];
  var rcDef=LSHAPES['rect-table'];
  var sqDef=LSHAPES['square-table'];

  function makeCell(def, chairs){
    var pad=chairs?Math.round(CHAIR_SIZE_M*ppm)+Math.round(0.05*ppm):0;
    return {w:def.w+pad*2+sp, h:def.h+pad*2+sp, pad:pad, def:def};
  }
  var rCell=makeCell(rDef,roundChairs);
  var rcCell=makeCell(rcDef,rectChairs);
  var sqCell=makeCell(sqDef,sqChairs);

  // Interleave table types for balanced left/right distribution
  var tableQueue=[];
  var rI=0,rcI=0,sqI=0;
  while(rI<roundN||rcI<rectN||sqI<sqN){
    if(rI<roundN){  tableQueue.push({shape:'round-table', cell:rCell,  chairs:roundChairs,ctype:roundCtype,cp:roundCp, radius:'50%'}); rI++; }
    if(rcI<rectN){  tableQueue.push({shape:'rect-table',  cell:rcCell, chairs:rectChairs, ctype:rectCtype, cp:rectCp,  radius:'0px'}); rcI++; }
    if(sqI<sqN){    tableQueue.push({shape:'square-table',cell:sqCell, chairs:sqChairs,   ctype:sqCtype,   cp:sqCp,    radius:'0px'}); sqI++; }
  }
  var total=tableQueue.length;

  // Split evenly left / right
  var leftQ=[], rightQ=[];
  for(var i=0;i<tableQueue.length;i++){
    if(i%2===0) leftQ.push(tableQueue[i]); else rightQ.push(tableQueue[i]);
  }

  // Cell dimensions per side
  var leftCellW=0,leftCellH=0,rightCellW=0,rightCellH=0;
  leftQ.forEach(function(t){ if(t.cell.w>leftCellW) leftCellW=t.cell.w; if(t.cell.h>leftCellH) leftCellH=t.cell.h; });
  rightQ.forEach(function(t){ if(t.cell.w>rightCellW) rightCellW=t.cell.w; if(t.cell.h>rightCellH) rightCellH=t.cell.h; });
  if(!leftCellW) leftCellW=rCell.w; if(!leftCellH) leftCellH=rCell.h;
  if(!rightCellW) rightCellW=rCell.w; if(!rightCellH) rightCellH=rCell.h;

  // Central entertainment column width
  var centerW=Math.max(dfW,barW,stW,djW)+sp*2;

  // Above-dance-floor: Shot Bar → Stage → DJ Booth
  var aboveH=barH+sp+stH+sp+djH+sp;
  // Below: Dinner Platform
  var belowH=stH+sp;
  var centralColH=aboveH+dfH+sp+belowH;

  // Table grid columns (aim for roughly square block)
  var leftCols=Math.max(1,Math.min(6,Math.round(Math.sqrt(leftQ.length))));
  var rightCols=Math.max(1,Math.min(6,Math.round(Math.sqrt(rightQ.length))));
  var leftRows=Math.ceil(leftQ.length/Math.max(1,leftCols));
  var rightRows=Math.ceil(rightQ.length/Math.max(1,rightCols));
  var leftBlockW=leftCols*leftCellW;
  var rightBlockW=rightCols*rightCellW;
  var leftBlockH=leftRows*leftCellH;
  var rightBlockH=rightRows*rightCellH;
  var tableBlockH=Math.max(leftBlockH,rightBlockH);

  var ox=Math.round(sp*3), oy=Math.round(sp*3);
  var centralX=ox+leftBlockW+sp*2;
  var tableH=Math.max(tableBlockH,centralColH);
  var centralStartY=oy+Math.max(0,Math.round((tableH-centralColH)/2));
  var tableStartY=oy+Math.max(0,Math.round((tableH-tableBlockH)/2));

  // Place LEFT tables (right-aligned against central column)
  var tCount=0;
  for(var row=0;row<leftRows;row++){
    for(var col=0;col<leftCols;col++){
      var idx=row*leftCols+col; if(idx>=leftQ.length) break;
      var t=leftQ[idx];
      var tx=centralX-leftBlockW+col*leftCellW+t.cell.pad-sp;
      var ty=tableStartY+row*leftCellH+t.cell.pad;
      tCount++;
      items.push({id:idGen(),shape:t.shape,x:Math.round(tx),y:Math.round(ty),w:t.cell.def.w,h:t.cell.def.h,bg:t.cell.def.bg,bdClr:t.cell.def.bdClr,radius:t.radius,label:String(tCount),chairs:t.chairs,chairType:t.ctype,centerpiece:t.cp,cost:0,rotation:0});
    }
  }

  // Place RIGHT tables (left-aligned from central column right edge)
  var rightStartX=centralX+centerW;
  for(var row=0;row<rightRows;row++){
    for(var col=0;col<rightCols;col++){
      var idx=row*rightCols+col; if(idx>=rightQ.length) break;
      var t=rightQ[idx];
      var tx=rightStartX+col*rightCellW+t.cell.pad;
      var ty=tableStartY+row*rightCellH+t.cell.pad;
      tCount++;
      items.push({id:idGen(),shape:t.shape,x:Math.round(tx),y:Math.round(ty),w:t.cell.def.w,h:t.cell.def.h,bg:t.cell.def.bg,bdClr:t.cell.def.bdClr,radius:t.radius,label:String(tCount),chairs:t.chairs,chairType:t.ctype,centerpiece:t.cp,cost:0,rotation:0});
    }
  }

  // Place central entertainment elements
  var cy=centralStartY;
  function ctrX(w){ return Math.round(centralX+sp+(centerW-sp*2-w)/2); }

  var dfShape=LSHAPES['dance-floor']||{bg:'#e8e0f0',bdClr:'#7c3aed'};
  var barShape=LSHAPES['bar']||{bg:'#fef3c7',bdClr:'#f59e0b'};
  var stShape=LSHAPES['stage']||{bg:'#dbeafe',bdClr:'#3b82f6'};
  var djShape=LSHAPES['dj-booth']||LSHAPES['dj']||{bg:'#f3e8ff',bdClr:'#9333ea'};

  // Shot Bar (top)
  items.push({id:idGen(),shape:'bar',       x:ctrX(barW),y:Math.round(cy),w:barW,h:barH,bg:barShape.bg,bdClr:barShape.bdClr,radius:'0px',label:LANG==='es'?'Barra de Shots':'Shot Bar',        chairs:0,cost:0,rotation:0}); cy+=barH+sp;
  // Stage
  items.push({id:idGen(),shape:'stage',     x:ctrX(stW), y:Math.round(cy),w:stW, h:stH, bg:stShape.bg, bdClr:stShape.bdClr, radius:'0px',label:LANG==='es'?'Escenario':'Stage',                  chairs:0,cost:0,rotation:0}); cy+=stH+sp;
  // DJ Booth (just above dance floor)
  items.push({id:idGen(),shape:'dj-booth',  x:ctrX(djW), y:Math.round(cy),w:djW, h:djH, bg:djShape.bg, bdClr:djShape.bdClr, radius:'0px',label:'DJ Booth',                                       chairs:0,cost:0,rotation:0}); cy+=djH+sp;
  // Dance Floor (center reference)
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
  if(!LState.measureMode){ _measurePoints=[]; }
  renderLayout();
  if(LState.measureMode) toast('Click point A, then point B to measure. Continue clicking to chain. Esc to exit.','s');
}

function clearMeasurements(){
  _measureLines=[];
  _measurePoints=[];
  renderLayout();
  toast('Measurements cleared','s');
}

function toggleFloorplanLock(){
  LState.floorplan.locked=!LState.floorplan.locked;
  saveFloorplan();
  renderLayout();
  toast(LState.floorplan.locked?'🔒 Floorplan locked':'🔓 Floorplan unlocked','s');
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
    '<text id="measure-preview-label" x="'+_measurePoints[0].x+'" y="'+(+_measurePoints[0].y-10)+'" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle" font-family="monospace">…</text>':
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
  }
  var itemsDiv=el.querySelector('[style*="position:relative;z-index:1"]');
  if(itemsDiv){ itemsDiv.innerHTML=LState.items.map(function(item){return renderLItem(item);}).join(''); attachLItemEvents(); }
  else renderLayout();
}

function handleFloorplanUpload(e){
  var file=e.target.files[0];
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var img=new Image();
    img.onload=function(){
      LState.floorplan={
        img:ev.target.result,
        opacity:0.4,
        scale:1,
        x:0,y:0,
        w:img.naturalWidth,
        h:img.naturalHeight
      };
      var targetW=LState.canvasW*0.8;
      if(img.naturalWidth>targetW){
        LState.floorplan.scale=targetW/img.naturalWidth;
      }
      saveFloorplan();
      renderLayout();
      toast('Floorplan loaded — '+img.naturalWidth+'×'+img.naturalHeight+'px','s');
    };
    img.src=ev.target.result;
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
  if(!confirm('Remove the floorplan image?'))return;
  LState.floorplan={img:null,opacity:0.4,scale:1,x:0,y:0,w:0,h:0};
  LState.scaleMode=false;LState.scalePoints=[];
  var p=proj();delete p.floorplan;saveProj(p);
  renderLayout();
  toast('Floorplan removed','s');
}

function saveFloorplan(){
  var p=proj();
  p.floorplan=JSON.parse(JSON.stringify(LState.floorplan));
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
  var pxPerMeter=pxDist/realMeters;
  var oldPPM=LState.floorplan.pxPerMeter||DEFAULT_PPM;
  LState.floorplan.pxPerMeter=pxPerMeter;
  var ratio=pxPerMeter/oldPPM;
  LState.items.forEach(function(item){
    item.x=Math.round(item.x*ratio);
    item.y=Math.round(item.y*ratio);
    item.w=Math.round(item.w*ratio);
    item.h=Math.round(item.h*ratio);
    delete item.fontSize;
  });
  LState.floorplan.x=Math.round(LState.floorplan.x*ratio);
  LState.floorplan.y=Math.round(LState.floorplan.y*ratio);
  LState.canvasW=Math.max(4000,Math.round(LState.canvasW*ratio));
  LState.canvasH=Math.max(3000,Math.round(LState.canvasH*ratio));
  var p=proj();p.layoutItems=LState.items;saveProj(p);
  LState.scaleMode=false;
  LState.scalePoints=[];
  saveFloorplan();
  renderLayout();
  toast('Calibrated: '+pxPerMeter.toFixed(1)+'px/m. All elements rescaled proportionally.','s');
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
  var chairPx=Math.round(CHAIR_SIZE_M*getPPM());
  var pad=chairs?chairPx+Math.round(0.05*getPPM()):0;
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
    inp.placeholder = LState.sel.length > 1 ? '···' : '—';
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
}function rotateSelected(deg){
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
  renderLayout();
  toast('Rotated '+deg+'°','s');
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
    LState.items.forEach(it=>{ if(it.shape===item.shape) it[key]=val; });
    LState.sel.forEach(selId=>{
      const selItem=LState.items.find(i=>i.id===selId);
      if(selItem && selItem.shape!==item.shape) selItem[key]=val;
    });
  }

  const p=proj();p.layoutItems=LState.items;saveProj(p);
  const toUpdate=new Set();
  if(perElementOnly.includes(key)){
    toUpdate.add(id);
  } else {
    LState.items.forEach(it=>{ if(it.shape===item.shape) toUpdate.add(it.id); });
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
    ${isTable?`<div class="ig" style="grid-column:1/-1"><label>${_es?'Forma de Mesa':'Table Shape'}</label>
      <select class="input" id="li-shape">
        <option value="round" ${(item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%'))?'selected':''}>${_es?'Redonda':'Round'}</option>
        <option value="rect" ${(item.shape==='rect-table'&&item.radius!=='50%')?'selected':''}>${_es?'Rectangular':'Rectangular'}</option>
        <option value="square" ${(item.shape==='square-table'&&item.radius!=='50%')?'selected':''}>${_es?'Cuadrada':'Square'}</option>
      </select>
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
  <div class="ig" style="grid-column:1/-1">
    <label>${_es?'Precio (por elemento)':'Price (per element)'}</label>
    <input class="input" id="li-cost" type="number" step="0.01" min="0" value="${item.cost||0}">
  </div>
  <div style="font-size:10.5px;color:var(--muted);margin-bottom:8px;padding:8px;background:rgba(201,168,76,.06);border-radius:6px;border:1px solid rgba(201,168,76,.15)">
    ℹ️ ${_es?`Al guardar se aplicará tamaño, color, sillas y centro de mesa a <strong>todos los ${item.shape.replace(/-/g,' ')}s</strong> en este plano.`:`Saving will apply size, color, chairs and centerpiece to <strong>all ${item.shape.replace(/-/g,' ')}s</strong> in this layout.`}
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-ghost" onclick="duplicateAsCustom('${id}')" title="${_es?'Crear un nuevo tipo basado en este elemento':'Create a new custom type based on this element'}">⊕ ${_es?'Crear Tipo':'Create new Type'}</button>
    <button class="btn btn-danger" onclick="closeMo();delLItem('${id}')">${t('delete')||(_es?'Eliminar':'Delete')}</button>
    <button class="btn btn-primary" onclick="saveLItem('${id}')">${t('save')}</button>
  </div>`);
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
  const shapeEl=document.getElementById('li-shape');
  const newRadius=shapeEl?(shapeEl.value==='round'?'50%':'0px'):item.radius;
  let newShape=item.shape;
  if(shapeEl){
    if(shapeEl.value==='round') newShape='round-table';
    else if(shapeEl.value==='square') newShape='square-table';
    else if(shapeEl.value==='rect') newShape='rect-table';
  }
  const newCtype=ctEl?ctEl.value:(item.chairType||'default');
  const newCp=cpEl?cpEl.value:(item.centerpiece||'none');

  const sameShape=LState.items.filter(i=>i.shape===item.shape);
  sameShape.forEach(it=>{
    it.w=newW; it.h=newH;
    it.bg=newBg; it.bdClr=newBdClr;
    it.chairs=newChairs;
    it.chairType=newCtype;
    it.centerpiece=newCp;
    it.radius=newRadius;
    it.shape=newShape;
  });

  const newCost=+(document.getElementById('li-cost')||{value:0}).value||0;
  sameShape.forEach(it=>{ it.cost=newCost; });

  LState.sel.forEach(selId=>{
    const selItem=LState.items.find(i=>i.id===selId);
    if(selItem && selItem.shape!==item.shape){
      selItem.w=newW; selItem.h=newH;
      selItem.bg=newBg; selItem.bdClr=newBdClr;
      selItem.chairs=newChairs;
      selItem.chairType=newCtype;
      selItem.centerpiece=newCp;
      selItem.cost=newCost;
    }
  });

  item.label=newLabel;

  const p=proj();p.layoutItems=LState.items;saveProj(p);
  lHistorySave();
  closeMo();renderLayout();
  const selExtra=LState.sel.filter(sid=>{const si=LState.items.find(i=>i.id===sid);return si&&si.shape!==item.shape;}).length;
  const totalUpdated=sameShape.length+selExtra;
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
  if(e.ctrlKey||e.metaKey){
    const delta=e.deltaY>0?-0.08:0.08;
    lZoom(delta,null,cx,cy);
  } else {
    const delta=e.deltaY>0?-0.08:0.08;
    lZoom(delta,null,cx,cy);
  }
}

function showLayoutBudget(){
  renderLayoutBudgetModal();
}
function renderLayoutBudgetModal(){
  var p=proj(); var items=LState.items;
  var total=calcLayoutBudget(items).total;
  var totalSeats=items.reduce(function(s,i){return s+(i.chairs||0);},0);

  var groups={};
  items.forEach(function(item){
    var ctype=item.chairType||'default';
    var cp=item.centerpiece||'none';
    var key=item.shape+'||'+ctype+'||'+cp;
    if(!groups[key]){
      groups[key]={shape:item.shape,chairType:ctype,centerpiece:cp,
        unitCost:parseFloat(item.cost)||0,qty:0,chairs:item.chairs||0};
    }
    groups[key].qty++;

  });

  var tableShapes=Object.keys(LSHAPES_M).filter(function(k){return ['round-table','rect-table','square-table'].includes(k)||!!(LSHAPES_M[k]._isCustomTable);});
  var elemShapes=Object.keys(LSHAPES_M).filter(function(k){return !['round-table','rect-table','square-table'].includes(k)&&!LSHAPES_M[k]._isCustomTable;});

  function shapeOpts(current,list){
    return list.map(function(k){return '<option value="'+k+'"'+(current===k?' selected':'')+'>'+LSHAPES_M[k].label+'</option>';}).join('');
  }
  function chairOpts(current){
    return Object.keys(CHAIR_TYPES).map(function(k){return '<option value="'+k+'"'+(current===k?' selected':'')+'>'+CHAIR_TYPES[k].label+'</option>';}).join('');
  }
  function cpOpts(current){
    return Object.keys(CENTERPIECE_TYPES).map(function(k){return '<option value="'+k+'"'+(current===k?' selected':'')+'>'+CENTERPIECE_TYPES[k].label+'</option>';}).join('');
  }

  var rows=Object.keys(groups).map(function(key){
    var g=groups[key];
    var isTable=['round-table','rect-table','square-table'].includes(g.shape)||!!(LSHAPES_M[g.shape]&&LSHAPES_M[g.shape]._isCustomTable);
    var shapeList=isTable?tableShapes:elemShapes;
    var shapeLbl=LSHAPES_M[g.shape]?LSHAPES_M[g.shape].label:g.shape;
    var chairCost=g.chairs*(CHAIR_TYPES[g.chairType]?CHAIR_TYPES[g.chairType].costPerChair||0:0);
    var cpCost=g.centerpiece&&g.centerpiece!=='none'&&CENTERPIECE_TYPES[g.centerpiece]?CENTERPIECE_TYPES[g.centerpiece].cost||0:0;
    var unitTotal=g.unitCost+chairCost+cpCost;
    var subtotal=unitTotal*g.qty;
    var dk='data-bkey="'+key+'"';
    return '<tr style="border-bottom:1px solid var(--bg2)">'+
      '<td style="padding:6px 8px;font-size:12px;font-weight:600">'+esc(shapeLbl)+'</td>'+
      '<td style="padding:6px 8px;text-align:center;font-size:13px;font-weight:700;color:var(--gold-h)">'+g.qty+'</td>'+
      (isTable?
        '<td style="padding:4px 6px"><select class="input" '+dk+' style="font-size:11px;padding:3px 5px" onchange="lBudgetGrpChairType(this)">'+chairOpts(g.chairType)+'</select></td>'+
        '<td style="padding:4px 6px"><select class="input" '+dk+' style="font-size:11px;padding:3px 5px" onchange="lBudgetGrpCp(this)">'+cpOpts(g.centerpiece)+'</select></td>'
      :
        '<td colspan="2" style="padding:6px 8px;font-size:11px;color:var(--light);text-align:center">—</td>'
      )+
      '<td style="padding:4px 6px"><input type="number" class="input" '+dk+' style="font-size:11px;padding:3px 5px;width:80px" value="'+g.unitCost+'" min="0" step="50" onchange="lBudgetGrpCost(this)"></td>'+
      '<td style="padding:6px 8px;text-align:center;font-size:11px;color:var(--muted)">'+formatCost(unitTotal)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:600;color:var(--gold-h)">'+formatCost(subtotal)+'</td>'+
    '</tr>';
  }).join('');

  openMo(
    '<div class="mo-title">💰 Budget Breakdown — Edit</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">'+
      '<div style="background:var(--gold-l);border-radius:10px;padding:10px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700;color:var(--gold-h)" id="budget-total-display">'+formatCost(total)+'</div>'+
        '<div class="s-sm">Total Budget</div>'+
      '</div>'+
      '<div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700">'+items.length+'</div>'+
        '<div class="s-sm">Elements</div>'+
      '</div>'+
      '<div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">'+
        '<div style="font-size:18px;font-weight:700">'+totalSeats+'</div>'+
        '<div class="s-sm">Total Seats</div>'+
      '</div>'+
    '</div>'+
    '<div style="overflow-x:auto;max-height:55vh;overflow-y:auto">'+
    '<table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:var(--bg2);position:sticky;top:0">'+
        '<th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Type</th>'+
        '<th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase">Qty</th>'+
        '<th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase">Chair Style</th>'+
        '<th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase">Centerpiece</th>'+
        '<th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase">Unit Cost</th>'+
        '<th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase">Unit Total</th>'+
        '<th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase">Subtotal</th>'+
      '</tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
      '<tfoot><tr style="background:var(--gold-l)">'+
        '<td colspan="6" style="padding:10px;font-weight:700;font-size:12px">TOTAL</td>'+
        '<td style="padding:10px;text-align:right;font-weight:700;color:var(--gold-h);font-size:13px" id="budget-total-display2">'+formatCost(total)+'</td>'+
      '</tr></tfoot>'+
    '</table></div>'+
    '<p style="font-size:11px;color:var(--muted);margin:10px 0 0">Editing Unit Cost or Chair Style updates all elements of that type in the layout.</p>'+
    '<div class="mo-foot">'+
      '<button class="btn btn-ghost" onclick="closeMo()">Close</button>'+
      '<button class="btn btn-primary" onclick="exportLayoutFull()">Export Report</button>'+
    '</div>'
  );
}
function lBudgetRefreshTotal(){
  var b=calcLayoutBudget(LState.items);
  var d1=document.getElementById('budget-total-display');
  var d2=document.getElementById('budget-total-display2');
  if(d1)d1.textContent=formatCost(b.total);
  if(d2)d2.textContent=formatCost(b.total);
}
function lBudgetGrpCost(el){
  var key=el.dataset.bkey; var val=+el.value;
  var p=proj();
  var parts=key.split('||');
  var shape=parts[0],ctype=parts[1],cp=parts[2];
  p.layoutItems.forEach(function(it){
    if(it.shape===shape&&(it.chairType||'default')===ctype&&(it.centerpiece||'none')===cp){it.cost=val;}
  });
  saveProj(p);LState.items=p.layoutItems;
  lBudgetRefreshTotal();
}
function lBudgetGrpChairType(el){
  var key=el.dataset.bkey; var ctype=el.value;
  var p=proj();
  var parts=key.split('||');
  var shape=parts[0],oldCtype=parts[1],cp=parts[2];
  p.layoutItems.forEach(function(it){
    if(it.shape===shape&&(it.chairType||'default')===oldCtype&&(it.centerpiece||'none')===cp){it.chairType=ctype;}
  });
  saveProj(p);LState.items=p.layoutItems;
  renderLayoutCanvas();
  renderLayoutBudgetModal();
}
function lBudgetGrpCp(el){
  var key=el.dataset.bkey; var cp=el.value;
  var p=proj();
  var parts=key.split('||');
  var shape=parts[0],ctype=parts[1],oldCp=parts[2];
  p.layoutItems.forEach(function(it){
    if(it.shape===shape&&(it.chairType||'default')===ctype&&(it.centerpiece||'none')===oldCp){it.centerpiece=cp;}
  });
  saveProj(p);LState.items=p.layoutItems;
  renderLayoutCanvas();
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

  openMo(`<div class="mo-title">🎨 Styles Editor</div>
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

function openSaveLayoutModal(){
  const p=proj();
  const saved = getSavedLayouts(p);
  openMo(`<div class="mo-title">💾 Save Layout</div>
  <div class="ig" style="margin-bottom:16px">
    <label>Layout Name</label>
    <input class="input" id="sl-name" placeholder="e.g. Option A — Round Tables" value="Layout ${saved.length+1}">
  </div>
  <div class="ig" style="margin-bottom:4px">
    <label>Notes (optional)</label>
    <textarea class="textarea" id="sl-notes" rows="2" placeholder="Notes about this layout version..."></textarea>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="doSaveLayout()">Save Snapshot</button>
  </div>`);
}
function doSaveLayout(){
  const name = gv('sl-name'); if(!name) return toast('Enter a name','e');
  const notes = gv('sl-notes');
  const p = proj();
  if(!p.savedLayouts) p.savedLayouts=[];
  p.savedLayouts.push({
    id:'sl'+Date.now(),
    name, notes,
    date: new Date().toLocaleDateString(),
    items: JSON.parse(JSON.stringify(LState.items)),
    budget: calcLayoutBudget(LState.items).total
  });
  saveProj(p);
  // Also sync to library if currently editing a library layout
  if(typeof _libEditingLayoutId!=='undefined'&&_libEditingLayoutId&&typeof getLib==='function'){
    var lib2=getLib();
    var entry2=lib2.layouts.find(function(e){return e.id===_libEditingLayoutId;});
    if(entry2){entry2.items=JSON.parse(JSON.stringify(LState.items));if(typeof saveLib==='function')saveLib(lib2);}
  }
  closeMo();
  renderLayout();
  toast('Layout saved: '+name,'s');
}
function openLayoutsLibrary(){
  const p=proj();
  const saved=getSavedLayouts(p);
  if(!saved.length){
    openMo(`<div class="mo-title">📐 Saved Layouts</div>
    <p style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No saved layouts yet.<br>Use <strong>💾 Save Layout</strong> to snapshot the current canvas.</p>
    <div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">Close</button></div>`);
    return;
  }
  openMo(`<div class="mo-title">📐 Saved Layouts (${saved.length})</div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-height:55vh;overflow-y:auto">
    ${saved.map(sl=>`
    <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;background:var(--bg)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div style="font-weight:700;font-size:14px">${esc(sl.name)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${sl.date} · ${sl.items.length} elements · ${sl.items.filter(i=>i.shape.includes('table')).length} tables · ${sl.items.reduce((s,i)=>s+(i.chairs||0),0)} seats${sl.budget>0?' · '+fmtMoney(sl.budget):''}</div>
          ${sl.notes?`<div style="font-size:12px;color:var(--muted);margin-top:5px;font-style:italic">${esc(sl.notes)}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" onclick="closeMo();loadSavedLayout('${sl.id}')">Load</button>
          <button class="btn btn-ghost btn-sm" onclick="closeMo();exportSavedLayout('${sl.id}')">Export</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSavedLayout('${sl.id}')">✕</button>
        </div>
      </div>
    </div>`).join('')}
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Close</button>
    <button class="btn btn-primary" onclick="closeMo();openSaveLayoutModal()">Save Current</button>
  </div>`);
}
function loadSavedLayout(slId){
  const p=proj();
  const sl=getSavedLayouts(p).find(s=>s.id===slId);
  if(!sl)return;
  openMo(`<div class="mo-title">Load Layout</div>
  <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Load "<strong>${esc(sl.name)}</strong>"? This will replace the current canvas. Your current layout will be lost unless you saved it first.</p>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="closeMo();_doLoadLayout('${slId}')">Load It</button>
  </div>`);
}
function _doLoadLayout(slId){
  const p=proj();
  const sl=getSavedLayouts(p).find(s=>s.id===slId);
  if(!sl)return;
  p.layoutItems=JSON.parse(JSON.stringify(sl.items));
  saveProj(p);
  renderLayout();
  toast('Loaded: '+sl.name,'s');
}
function deleteSavedLayout(slId){
  const p=proj();
  p.savedLayouts=(p.savedLayouts||[]).filter(s=>s.id!==slId);
  saveProj(p);
  closeMo();
  openLayoutsLibrary();
  toast('Layout deleted');
}
function exportSavedLayout(slId){
  const p=proj();
  const sl=getSavedLayouts(p).find(s=>s.id===slId);
  if(!sl)return;
  const tmpItems=LState.items;
  LState.items=sl.items;
  exportLayoutFull(sl.name);
  LState.items=tmpItems;
}

function exportLayoutFull(layoutName){
  const p=proj(); const items=LState.items;
  if(!items.length)return toast('No items to export','e');
  const {total, breakdown} = calcLayoutBudget(items);

  const counts={};
  items.forEach(i=>{
    const k=i.shape+'_'+(i.chairType||'')+'_'+(i.centerpiece||'');
    if(!counts[k]) counts[k]={
      label:LSHAPES_M[i.shape]?LSHAPES_M[i.shape].label:i.shape.replace(/-/g,' '),
      shape:i.shape.replace(/-/g,' '),
      chairType: i.chairType||'default',
      centerpieceKey: i.centerpiece||'none',
      chairStyle:i.chairType&&i.chairType!=='default'?(CHAIR_TYPES[i.chairType]?CHAIR_TYPES[i.chairType].label:i.chairType):'—',
      centerpiece:i.centerpiece&&i.centerpiece!=='none'?(CENTERPIECE_TYPES[i.centerpiece]?CENTERPIECE_TYPES[i.centerpiece].label:i.centerpiece):'—',
      chairs:i.chairs||0, unitCost:i.cost||0, qty:0, totalCost:0
    };
    counts[k].qty++;
    counts[k].totalCost += (i.cost||0);
  });
  const rows=Object.values(counts);
  const totalSeats=items.reduce((s,i)=>s+(i.chairs||0),0);
  const name = layoutName||p.name;

  const PPM = getPPM();
  const CHAIR_SZ = Math.max(8, Math.round(CHAIR_SIZE_M * PPM));
  const CHAIR_GAP = Math.max(2, Math.round(0.05 * PPM));
  const PAD = CHAIR_SZ + CHAIR_GAP + 4;

  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  items.forEach(item=>{
    const hasCh = item.chairs > 0;
    const px = hasCh ? PAD : 0;
    minX = Math.min(minX, item.x - px);
    minY = Math.min(minY, item.y - px);
    maxX = Math.max(maxX, item.x + item.w + px);
    maxY = Math.max(maxY, item.y + item.h + px);
  });
  const MARGIN = 80;
  const rawW = maxX - minX + MARGIN*2;
  const rawH = maxY - minY + MARGIN*2;

  const MAX_W = 900;
  const scale = rawW > MAX_W ? MAX_W / rawW : 1;
  const svgW = Math.round(rawW * scale);
  const svgH = Math.round(rawH * scale);
  const ox = (-minX + MARGIN) * scale;
  const oy = (-minY + MARGIN) * scale;

  function sc(v){ return Math.round(v * scale); }
  function sx(v){ return Math.round(v * scale + ox); }
  function sy(v){ return Math.round(v * scale + oy); }

  let svgItems = '';

  items.forEach(item=>{
    const isRound = item.shape==='round-table'||item.radius==='50%'||(LSHAPES_M[item.shape]&&LSHAPES_M[item.shape].radius==='50%');
    const rot = item.rotation || 0;
    const cx = sx(item.x + item.w/2);
    const cy = sy(item.y + item.h/2);
    const iw = sc(item.w);
    const ih = sc(item.h);
    const ix = sx(item.x);
    const iy = sy(item.y);

    let inner = '';

    if(item.chairs){
      const n = item.chairs;
      const cs = Math.max(4, Math.round(CHAIR_SZ * scale));
      const gap = Math.max(1, Math.round(CHAIR_GAP * scale));
      const cType = item.chairType || 'default';
      const ct = CHAIR_TYPES[cType] || CHAIR_TYPES['default'];
      const cfill = ct ? ct.fill : '#e8e4d8';
      const cstroke = ct ? (ct.stroke || 'none') : 'none';

      const positions = [];
      const w = sc(item.w), h = sc(item.h);

      if(isRound){
        for(let i=0;i<n;i++){
          const angle=(i/n)*2*Math.PI - Math.PI/2;
          positions.push({
            x: w/2 + (w/2 + cs/2 + gap)*Math.cos(angle),
            y: h/2 + (h/2 + cs/2 + gap)*Math.sin(angle)
          });
        }
      } else if(item.shape==='rect-table'){
        const longSide=4, shortSide=Math.max(1,Math.round((n-longSide*2)/2));
        const top=longSide, bot=longSide, left=shortSide, right=shortSide;
        for(let i=0;i<top;i++)   positions.push({x:(i+1)*w/(top+1),   y:-(cs/2+gap)});
        for(let i=0;i<bot;i++)   positions.push({x:(i+1)*w/(bot+1),   y:h+cs/2+gap});
        for(let i=0;i<left;i++)  positions.push({x:-(cs/2+gap),       y:(i+1)*h/(left+1)});
        for(let i=0;i<right;i++) positions.push({x:w+cs/2+gap,        y:(i+1)*h/(right+1)});
      } else {
        const chairSlot = cs+5;
        const longCap = Math.max(1,Math.floor(w/chairSlot));
        let top=0,bot=0,left=0,right=0;
        if(n<=2*longCap){ top=Math.ceil(n/2); bot=Math.floor(n/2); }
        else { top=longCap; bot=longCap; const rem=n-top-bot; left=Math.ceil(rem/2); right=Math.floor(rem/2); }
        for(let i=0;i<top;i++)   positions.push({x:(i+1)*w/(top+1),   y:-(cs/2+gap)});
        for(let i=0;i<bot;i++)   positions.push({x:(i+1)*w/(bot+1),   y:h+cs/2+gap});
        for(let i=0;i<left;i++)  positions.push({x:-(cs/2+gap),       y:(i+1)*h/(left+1)});
        for(let i=0;i<right;i++) positions.push({x:w+cs/2+gap,        y:(i+1)*h/(right+1)});
      }

      const _cIsRound = !cType.startsWith('plegable') && !cType.startsWith('basket');
      positions.forEach(pos=>{
        if(_cIsRound){
          inner += `<ellipse cx="${Math.round(pos.x)}" cy="${Math.round(pos.y)}" rx="${Math.round(cs/2)}" ry="${Math.round(cs/2)}" fill="${cfill}" stroke="${cstroke}" stroke-width="0.8"/>`;
        } else {
          inner += `<rect x="${Math.round(pos.x - cs/2)}" y="${Math.round(pos.y - cs/2)}" width="${cs}" height="${cs}" rx="2" fill="${cfill}" stroke="${cstroke}" stroke-width="0.8"/>`;
        }
      });
    }

    let rx;
    if(isRound){ rx = Math.min(iw,ih)/2; }
    else {
      const shapeDef = LSHAPES_M[item.shape];
      if(shapeDef && shapeDef.radius && shapeDef.radius==='0px'){ rx=0; }
      else if(item.radius && item.radius==='0px'){ rx=0; }
      else if(item.radius && item.radius!=='50%'){
        const rNum = parseFloat(item.radius);
        rx = isNaN(rNum) ? 3 : rNum;
      } else { rx = 3; }
    }
    inner += `<rect x="0" y="0" width="${iw}" height="${ih}" rx="${rx}" fill="${item.bg}" stroke="${item.bdClr||'#ccc'}" stroke-width="1"/>`;

    if(item.centerpiece && item.centerpiece!=='none'){
      const ct2 = CENTERPIECE_TYPES[item.centerpiece];
      if(ct2 && ct2.color){
        const cpSz = Math.round(Math.min(iw,ih)*0.55);
        inner += `<ellipse cx="${iw/2}" cy="${ih/2}" rx="${cpSz/2}" ry="${cpSz/2}" fill="${ct2.color}" opacity="0.55"/>`;
      }
    }

    const wM = item.w / PPM;
    const fs = Math.max(6, Math.min(13, Math.round(wM * 8 * scale)));
    inner += `<text x="${iw/2}" y="${ih/2+fs*0.35}" text-anchor="middle" font-family="Jost,'Segoe UI',Arial,sans-serif" font-size="${fs}" fill="${item.bdClr||'#444'}" font-weight="400">${esc(item.label)}</text>`;

    svgItems += `<g transform="translate(${ix},${iy}) rotate(${rot},${iw/2},${ih/2})">${inner}</g>\n`;
  });

  const svgGraphic = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="background:#ffffff;border:1px solid #e8d9a0;border-radius:8px;display:block;max-width:100%">
  <rect width="${svgW}" height="${svgH}" fill="#ffffff"/>
  ${svgItems}
</svg>`;

  const _pdfEs=LANG==='es';
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Layout Export — ${esc(name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#f9f7f2;padding:40px;max-width:980px;margin:0 auto}
  h1{font-size:26px;font-weight:700;margin-bottom:4px;letter-spacing:-.02em}
  h2{font-size:14px;font-weight:700;margin:32px 0 12px;color:#555;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #c9a84c;padding-bottom:6px}
  .meta{font-size:13px;color:#888;margin-bottom:28px}
  .stats{display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap}
  .stat{background:#fff;border:1px solid #e8d9a0;border-radius:10px;padding:14px 22px;text-align:center;flex:1;min-width:120px}
  .stat-n{font-size:24px;font-weight:700;color:#a8862e}
  .stat-l{font-size:11px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:.04em}
  .layout-section{margin-bottom:36px}
  .layout-wrap{background:#fff;border-radius:12px;padding:24px;border:1px solid #e8d9a0;overflow:auto}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px;background:#fff;border-radius:8px;overflow:hidden}
  th{background:#faf8f2;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#999;border-bottom:2px solid #e8d9a0}
  td{padding:9px 12px;border-bottom:1px solid #f0ece0;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  .total-row td{font-weight:700;background:#faf8f2;border-top:2px solid #c9a84c;color:#a8862e}
  .swatch{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle;border:1px solid rgba(0,0,0,.1)}
  @media print{
    body{background:#fff;padding:24px}
    .no-print{display:none!important}
    .layout-wrap{border:none;padding:0}
    h2{margin-top:24px}
  }
</style></head><body>
<h1>Layout — ${esc(name)}</h1>
<div class="meta">${_pdfEs?'Evento':'Event'}: ${esc(p.name)} &nbsp;·&nbsp; ${new Date().toLocaleDateString(_pdfEs?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
<div class="stats">
  <div class="stat"><div class="stat-n">${items.length}</div><div class="stat-l">${_pdfEs?'Elementos':'Elements'}</div></div>
  <div class="stat"><div class="stat-n">${items.filter(i=>i.shape.includes('table')||i.shape.includes('round')||i.shape.includes('rect')||i.shape.includes('square')).length}</div><div class="stat-l">${_pdfEs?'Mesas':'Tables'}</div></div>
  <div class="stat"><div class="stat-n">${totalSeats}</div><div class="stat-l">${_pdfEs?'Asientos':'Total Seats'}</div></div>
  <div class="stat"><div class="stat-n">${fmtMoney(total)}</div><div class="stat-l">${_pdfEs?'Presupuesto':'Budget'}</div></div>
</div>

${_pdfEs?'<h2>Plano</h2>':'<h2>Floor Plan</h2>'}
<div class="layout-wrap">${svgGraphic}</div>

${_pdfEs?'<h2>Resumen de Elementos</h2>':'<h2>Element Summary</h2>'}
<table>
  <thead><tr><th>${_pdfEs?'Tipo':'Type'}</th><th>${_pdfEs?'Sillas':'Chair Style'}</th><th>${_pdfEs?'Centro':'Centerpiece'}</th><th style="text-align:center">${_pdfEs?'Asientos':'Seats/Unit'}</th><th style="text-align:center">${_pdfEs?'Cant.':'Qty'}</th><th style="text-align:right">${_pdfEs?'Costo Elem.':'Element Cost'}</th><th style="text-align:right">${_pdfEs?'Costo Sillas':'Chair Cost'}</th><th style="text-align:right">${_pdfEs?'Centro Mesa':'CP Cost'}</th><th style="text-align:right">${_pdfEs?'Subtotal':'Row Total'}</th></tr></thead>
  <tbody>${rows.map(r=>{
    const chairCostPerUnit = r.chairs>0&&r.chairType&&r.chairType!=='default'?(CHAIR_TYPES[r.chairType]?Number(CHAIR_TYPES[r.chairType].costPerChair||0)*r.chairs:0):0;
    const cpCostPerUnit = r.centerpieceKey&&r.centerpieceKey!=='none'?(CENTERPIECE_TYPES[r.centerpieceKey]?Number(CENTERPIECE_TYPES[r.centerpieceKey].cost||0):0):0;
    const rowTotal = (r.unitCost + chairCostPerUnit + cpCostPerUnit) * r.qty;
    return `<tr>
    <td><strong>${r.label}</strong></td>
    <td style="color:#666">${r.chairStyle}</td>
    <td style="color:#666">${r.centerpiece}</td>
    <td style="text-align:center">${r.chairs||'—'}</td>
    <td style="text-align:center;font-weight:700">${r.qty}</td>
    <td style="text-align:right">${r.unitCost>0?fmtMoney(r.unitCost):'—'}</td>
    <td style="text-align:right">${chairCostPerUnit>0?fmtMoney(chairCostPerUnit):'—'}</td>
    <td style="text-align:right">${cpCostPerUnit>0?fmtMoney(cpCostPerUnit):'—'}</td>
    <td style="text-align:right;font-weight:700">${rowTotal>0?fmtMoney(rowTotal):'—'}</td>
  </tr>`;}).join('')}
  <tr class="total-row"><td colspan="8">${_pdfEs?'TOTAL':'TOTAL'}</td><td style="text-align:right">${fmtMoney(total)}</td></tr>
  </tbody>
</table>

<div class="no-print" style="margin-top:36px;display:flex;justify-content:flex-end">
  <button onclick="window.print()" style="padding:11px 32px;background:#c9a84c;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:700;letter-spacing:.02em">🖨️ Print / Save as PDF</button>
</div>

</body></html>`;

  const blob=new Blob([html],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Layout_${name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  toast('Export downloaded','s');
}

function exportLayoutPDF(){ exportLayoutFull(); }

