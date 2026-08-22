var _aAt = true;
var _aFr = null;
var _aTo   = null;

function setAnalyticsAllTime(){
  _aAt = true;
  _aFr = null;
  _aTo   = null;
  const fromEl=document.getElementById('ap-from'); const toEl=document.getElementById('ap-to');
  if(fromEl) fromEl.value=''; if(toEl) toEl.value='';
  const btn=document.getElementById('ap-alltime'); if(btn) btn.classList.add('active');
  saveEvPrefs();
  renderAnalytics();
}

function setAnalyticsDateRange(){
  const fromVal=parseUserDate((document.getElementById('ap-from')||{}).value);
  const toVal=parseUserDate((document.getElementById('ap-to')||{}).value);
  _aAt = false;
  _aFr = fromVal ? new Date(fromVal+'T00:00:00') : null;
  _aTo   = toVal   ? new Date(toVal+'T23:59:59')   : null;
  const btn=document.getElementById('ap-alltime'); if(btn) btn.classList.remove('active');
  saveEvPrefs();
  renderAnalytics();
}

function updateAnalyticsLabels(){
  // El botón "Todo" también refleja el estado: al restaurar un rango guardado
  // (loadEvPrefs) nadie le quitaba la clase .active y quedaba mintiendo.
  const btn=document.getElementById('ap-alltime');
  if(btn){ btn.textContent=t('period_alltime'); btn.classList.toggle('active', !!_aAt); }
  const title=document.getElementById('analytics-title'); if(title) title.textContent=t('analytics_title');
  const sub=document.getElementById('analytics-sub'); if(sub) sub.textContent=t('analytics_sub');
}

// ═══════════════════════════════════════════════════════════════════════════
// REDISEÑO 2026-08 — vista de analíticas.
// Un solo color por tipo de evento (tomado de la paleta de series del diseño)
// para que la barra apilada, la dona y las leyendas coincidan en toda la página.
// ═══════════════════════════════════════════════════════════════════════════
var AN_TYPE_COLORS = {
  social:    '#E4572E',
  corporate: '#3B7DD8',
  community: '#17A398',
  government:'#F2A93B',
  education: '#7C5CE0',
  other:     '#C4BBAD'
};
var AN_TYPE_ORDER = ['social','corporate','community','government','education','other'];
// Orden de color del ranking de proveedores (coral → naranja → ámbar → teal → azul).
var AN_RANK_COLORS = ['#E4572E','#F2870F','#F2A93B','#17A398','#3B7DD8'];

/** Normaliza p.type ('other:Aniversario' → 'other') a una llave de color. */
function anTypeKey(ty){
  var k = String(ty == null ? '' : ty).replace(/^other:.*$/, 'other');
  return AN_TYPE_COLORS[k] ? k : 'other';
}
function anTypeName(ty){
  var k = anTypeKey(ty);
  if(k === 'other') return LANG === 'es' ? 'Otro' : 'Other';
  return evTypeLabel(k) || k;
}
/** Enteros con separador de miles del idioma activo (no es dinero). */
function anNum(n){
  var v = Number(n);
  if(!isFinite(v)) v = 0;
  return v.toLocaleString(LANG === 'es' ? 'es-MX' : 'en-US');
}
function anIcon(paths, size){
  var s = size || 20;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}
/** Etiqueta corta de mes desde una llave 'YYYY-MM'.  Nunca new Date(cadena). */
function anMonthLabel(key, withYear){
  var parts = String(key).split('-');
  var y = Number(parts[0]), m = Number(parts[1]);
  if(!isFinite(y) || !isFinite(m)) return String(key);
  var d = new Date(y, m - 1, 1); // constructor local con números: seguro
  var name = d.toLocaleString(LANG === 'es' ? 'es-MX' : 'en-US', { month:'short' }).replace('.', '');
  return withYear ? name + ' ' + String(y).slice(2) : name;
}

/** Estado vacío: sin eventos del todo, o sin eventos dentro del filtro. */
function anEmptyState(hasAnyProject){
  var chart = anIcon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>', 26);
  var title, sub, action;
  if(!hasAnyProject){
    title = LANG === 'es' ? 'Aún no hay datos que analizar' : 'Nothing to analyze yet';
    sub   = LANG === 'es'
      ? 'Crea tu primer evento y aquí verás presupuestos, invitados y proveedores comparados entre todos tus proyectos.'
      : 'Create your first event and this page will compare budgets, guests and vendors across all your projects.';
    action = '<button class="btn btn-primary" onclick="showPage(\'events\')">' +
      anIcon('<path d="M12 5v14M5 12h14"/>', 15) + ' ' +
      esc(t('new_event') || (LANG === 'es' ? 'Nuevo evento' : 'New event')) + '</button>';
  } else {
    title = t('analytics_no_data');
    sub   = LANG === 'es'
      ? 'Ningún evento cae dentro del período seleccionado. Amplía el rango de fechas o vuelve a todo el historial.'
      : 'No event falls inside the selected period. Widen the date range or go back to the full history.';
    action = '<button class="btn" onclick="setAnalyticsAllTime()">' +
      anIcon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', 15) + ' ' +
      esc(t('period_alltime')) + '</button>';
  }
  return '<div class="rd-card"><div class="an-empty">' +
    '<span class="an-empty-ico">' + chart + '</span>' +
    '<div class="an-empty-title">' + esc(title) + '</div>' +
    '<div class="an-empty-sub">' + esc(sub) + '</div>' +
    action +
    '</div></div>';
}

function renderAnalytics(){
  const allProjects = Object.values(uproj()).filter(p=>p&&p.id&&p.id!=='__library__'&&p.id!=='__lib_layout__'&&p.status&&p.status!=='__internal__');
  const farPast=new Date('1900-01-01'); const farFuture=new Date('2100-12-31');
  const from = _aAt ? farPast  : (_aFr||farPast);
  const to   = _aAt ? farFuture: (_aTo  ||farFuture);
  const inPeriod = allProjects.filter(p=>{
    if(!p.date) return _aAt;
    const d=startOfLocalDay(p.date);
    if(!d) return _aAt;
    return d>=from && d<=to;
  });
  updateAnalyticsLabels();

  const fromEl=document.getElementById('ap-from'); const toEl=document.getElementById('ap-to');
  if(fromEl&&!fromEl.value&&_aFr) fromEl.value=formatDMY(toLocalYMD(_aFr));
  if(toEl&&!toEl.value&&_aTo)     toEl.value=formatDMY(toLocalYMD(_aTo));

  const el = document.getElementById('analytics-content');
  if(!el) return;

  if(!inPeriod.length){
    el.innerHTML = anEmptyState(allProjects.length > 0);
    return;
  }

  // ── Agregados ────────────────────────────────────────────────────────────
  // Ojo: un proyecto con _hasExtras sin cargar trae guests/vendors vacíos.
  // core.js llama a _ensureAllProjectsComplete() y vuelve a renderizar.
  const sums = inPeriod.map(rdEventSummary);
  const totalBudget = sums.reduce((s,x)=>s+x.budget,0);
  const avgBudget   = totalBudget/inPeriod.length;
  const totalSeats  = sums.reduce((s,x)=>s+x.seats,0);
  const avgSeats    = totalSeats/inPeriod.length;
  const confirmed   = sums.reduce((s,x)=>s+x.confirmed,0);
  const confirmPct  = totalSeats ? Math.round(confirmed/totalSeats*100) : 0;

  const byType = {};
  inPeriod.forEach(p=>{ const k=anTypeKey(p.type); byType[k]=(byType[k]||0)+1; });
  const typeEntries = AN_TYPE_ORDER.filter(k=>byType[k]).map(k=>[k,byType[k]]);

  const vendorCats = {};
  inPeriod.forEach(p=>{
    (p.vendors||[]).filter(v=>v&&v.hired).forEach(v=>{
      const cat = String(v.category||v.service||'').trim() || (LANG==='es'?'Sin categoría':'Uncategorized');
      vendorCats[cat]=(vendorCats[cat]||0)+1;
    });
  });
  const topVendors = Object.entries(vendorCats)
    .sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))
    .slice(0,5);

  // ── Fila de métricas ─────────────────────────────────────────────────────
  const metrics =
    rdMetric({
      label: t('analytics_events'),
      value: anNum(inPeriod.length),
      sub: LANG==='es' ? 'de '+anNum(allProjects.length)+' en total' : 'of '+anNum(allProjects.length)+' in total',
      valClass: 'lg'
    }) +
    rdMetric({
      label: t('analytics_avg_budget'),
      value: fmtMoney(Math.round(avgBudget)),
      sub: (LANG==='es' ? 'total ' : 'total ') + fmtMoney(totalBudget),
      valClass: 'lg'
    }) +
    rdMetric({
      label: t('analytics_avg_guests'),
      value: anNum(Math.round(avgSeats)),
      sub: LANG==='es' ? anNum(totalSeats)+' en total' : anNum(totalSeats)+' in total',
      valClass: 'lg'
    }) +
    rdMetric({
      label: LANG==='es' ? 'Tasa de confirmación' : 'Confirmation rate',
      value: totalSeats ? confirmPct+'%' : '—',
      sub: LANG==='es' ? anNum(confirmed)+' confirmados' : anNum(confirmed)+' confirmed',
      valClass: 'lg'
    });

  // ── Eventos por mes (barras apiladas por tipo) ───────────────────────────
  const monthTypes = {}, monthTotals = {};
  let undated = 0;
  inPeriod.forEach(p=>{
    const d = parseLocalDate(p.date);
    if(!d){ undated++; return; }
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!monthTypes[key]) monthTypes[key] = {};
    const k = anTypeKey(p.type);
    monthTypes[key][k] = (monthTypes[key][k]||0)+1;
    monthTotals[key]   = (monthTotals[key]||0)+1;
  });
  // Meses con datos, rellenando los huecos para que el eje sea continuo.
  // Si el rango es enorme (>24 meses) se muestran solo los meses con eventos.
  let months = Object.keys(monthTotals).sort();
  if(months.length > 1){
    const a = months[0].split('-'), b = months[months.length-1].split('-');
    const span = (Number(b[0])-Number(a[0]))*12 + (Number(b[1])-Number(a[1])) + 1;
    if(span <= 24){
      const filled = [];
      for(let i=0;i<span;i++){
        const y = Number(a[0]) + Math.floor((Number(a[1])-1+i)/12);
        const m = ((Number(a[1])-1+i) % 12) + 1;
        filled.push(y+'-'+String(m).padStart(2,'0'));
      }
      months = filled;
    }
  }
  const maxMonth  = months.reduce((m,k)=>Math.max(m,monthTotals[k]||0),1);
  const multiYear = months.length ? months[0].slice(0,4)!==months[months.length-1].slice(0,4) : false;
  const AN_BAR_MAX = 150; // px: alto de .an-bars (196) menos cifra, etiqueta y gaps

  const legend = AN_TYPE_ORDER.filter(k=>byType[k]).map(k=>
    '<span class="an-legend-item"><i style="background:'+AN_TYPE_COLORS[k]+'"></i>'+esc(anTypeName(k))+'</span>'
  ).join('');

  const bars = months.map(key=>{
    const total = monthTotals[key]||0;
    const types = monthTypes[key]||{};
    if(!total){
      return '<div class="an-bar-col">'+
        '<span class="an-bar-total zero">0</span>'+
        '<span class="an-bar-stack zero" style="height:4px"></span>'+
        '<span class="an-bar-lbl">'+esc(anMonthLabel(key, multiYear))+'</span>'+
      '</div>';
    }
    const h = Math.max(6, Math.round(total/maxMonth*AN_BAR_MAX));
    const segs = AN_TYPE_ORDER.filter(k=>types[k]).map(k=>
      '<span class="an-bar-seg" style="height:'+(types[k]/total*100).toFixed(2)+'%;background:'+AN_TYPE_COLORS[k]+'"'+
      ' title="'+esc(anTypeName(k)+': '+anNum(types[k]))+'"></span>'
    ).join('');
    return '<div class="an-bar-col">'+
      '<span class="an-bar-total">'+esc(anNum(total))+'</span>'+
      '<span class="an-bar-stack" style="height:'+h+'px">'+segs+'</span>'+
      '<span class="an-bar-lbl">'+esc(anMonthLabel(key, multiYear))+'</span>'+
    '</div>';
  }).join('');

  const monthCard =
    '<section class="rd-card pad-lg an-sec">'+
      '<div class="rd-card-title an-head">'+
        '<h2>'+esc(LANG==='es'?'Eventos por mes':'Events per month')+'</h2>'+
        '<div class="an-legend">'+legend+'</div>'+
      '</div>'+
      (months.length
        ? '<div class="an-chart"><div class="an-bars">'+bars+'</div></div>'
        : '<div class="an-note">'+esc(LANG==='es'?'Ninguno de estos eventos tiene fecha asignada.':'None of these events has a date yet.')+'</div>')+
      (undated
        ? '<div class="an-note">'+esc(LANG==='es'
            ? anNum(undated)+' evento(s) sin fecha no aparecen en la gráfica.'
            : anNum(undated)+' event(s) without a date are not shown in the chart.')+'</div>'
        : '')+
    '</section>';

  // ── Dona por tipo de evento ──────────────────────────────────────────────
  const donutData = typeEntries.map(([k,v])=>[AN_TYPE_COLORS[k], v, anTypeName(k)]);
  const donutLegend = typeEntries.map(([k,v])=>
    '<div class="rd-legend-row"><i style="background:'+AN_TYPE_COLORS[k]+'"></i>'+
    '<span>'+esc(anTypeName(k))+'</span><b>'+esc(anNum(v))+'</b></div>'
  ).join('');
  const typeCard =
    '<section class="rd-card pad-lg">'+
      '<div class="rd-card-title"><h2>'+esc(LANG==='es'?'Por tipo de evento':'By event type')+'</h2></div>'+
      '<div class="an-donut-wrap">'+
        rdDonut(donutData, { size:128, stroke:16, centerSub: LANG==='es'?'eventos':'events' })+
        '<div class="an-donut-legend">'+donutLegend+'</div>'+
      '</div>'+
    '</section>';

  // ── Ranking de categorías de proveedor ───────────────────────────────────
  const maxCat = topVendors.length ? topVendors[0][1] : 1;
  const rankCard =
    '<section class="rd-card pad-lg">'+
      '<div class="rd-card-title"><h2>'+
        esc(LANG==='es'?'Categorías de proveedor más contratadas':'Most hired vendor categories')+'</h2></div>'+
      (topVendors.length
        ? topVendors.map(([cat,n],i)=>
            '<div class="an-rank-row">'+
              '<span class="an-rank-name" title="'+esc(cat)+'">'+esc(cat)+'</span>'+
              '<span class="rd-bar thick"><i style="width:'+Math.max(4,Math.round(n/maxCat*100))+'%;background:'+
                AN_RANK_COLORS[i % AN_RANK_COLORS.length]+'"></i></span>'+
              '<span class="an-rank-cnt">'+esc(anNum(n))+'</span>'+
            '</div>'
          ).join('')
        : '<div class="an-note">'+esc(LANG==='es'?'Todavía no hay proveedores contratados en este período.':'No hired vendors in this period yet.')+'</div>')+
    '</section>';

  // ── Eventos del período (conserva la navegación a cada proyecto) ─────────
  const rows = inPeriod.slice()
    .sort((a,b)=>String(a.date||'9999-99-99').localeCompare(String(b.date||'9999-99-99')))
    .map(p=>{
      const s = rdEventSummary(p);
      // El id va dentro de una cadena JS dentro de un atributo: esc() no basta
      // (decodifica a comilla), así que también se quitan comillas y barras.
      const pid = esc(String(p.id).replace(/['"\\]/g, ''));
      return '<div class="rd-card-row click" onclick="openProject(\''+pid+'\')">'+
        '<span class="rd-avatar an-row-avatar" style="background:'+evTypeCover(anTypeKey(p.type))+'">'+esc(rdInitials(p.name))+'</span>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="rd-cell-main">'+esc(p.name)+'</div>'+
          '<div class="rd-cell-sub">'+esc(fmtDate(p.date))+' · '+esc(anTypeName(p.type))+' · '+
            esc(anNum(s.seats)+' '+(LANG==='es'?'inv.':'guests'))+'</div>'+
        '</div>'+
        '<span class="rd-cell-money an-row-money">'+esc(fmtMoney(s.budget))+'</span>'+
        rdPill(statusLabel(p.status), evStatusTone(p.status), { sm:true, dot:true })+
      '</div>';
    }).join('');
  const listCard =
    '<section class="rd-card clip an-sec">'+
      '<div class="rd-card-head">'+
        '<span class="rd-card-dot"></span>'+
        '<h2>'+esc(LANG==='es'?'Eventos del período':'Events in period')+'</h2>'+
        '<span class="rd-hint" style="margin-left:auto">'+esc(anNum(inPeriod.length))+'</span>'+
      '</div>'+
      rows+
    '</section>';

  el.innerHTML =
    '<div class="rd-metrics an-metrics">'+metrics+'</div>'+
    monthCard+
    '<div class="rd-grid-2 eq an-sec an-cards-2">'+typeCard+rankCard+'</div>'+
    listCard;
}

var _exportPDFTarget = null; // when set, generateExportPDF uses this project instead of proj()
function openExportPDFForEvent(eventId){
  var projects = DB.projects[DB.cur] || {};
  var p = projects[eventId];
  if(!p) return toast(LANG==='es'?'Proyecto no encontrado':'Project not found','e');
  _exportPDFTarget = p;
  openExportPDFModal();
}
function openExportPDFModal(){
  const p = _exportPDFTarget || proj();
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  const sections = [
    ['sec_dash','section_dashboard',true],
    ['sec_budget','section_budget',true],
    ['sec_timeline','section_timeline',true],
    ['sec_guests','section_guests',true],
    ['sec_layout','section_layout',true],
    ['sec_moodboard','section_moodboard',true]
  ];
  openMo(`<div class="mo-title">${t('export_pdf_title')}</div>
  <div style="margin-bottom:16px;font-size:13px;color:var(--muted)">${t('export_pdf_select')}</div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
    ${sections.map(([id,key,checked])=>`
    <label class="option-check">
      <input type="checkbox" id="${id}" ${checked?'checked':''} style="width:16px;height:16px;accent-color:var(--gold-h)">
      <span style="font-weight:600;font-size:13px">${t(key)}</span>
    </label>`).join('')}
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('export_pdf_cancel')}</button>
    <button class="btn btn-primary" onclick="generateExportPDF()">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${t('export_pdf_generate')}
    </button>
  </div>`);
}

function generateExportPDF(){
  const p = _exportPDFTarget || proj(); _exportPDFTarget = null; if(!p) return;
  const incDash     = document.getElementById('sec_dash')?.checked;
  const incBudget   = document.getElementById('sec_budget')?.checked;
  const incTimeline = document.getElementById('sec_timeline')?.checked;
  const incGuests   = document.getElementById('sec_guests')?.checked;
  const incLayout   = document.getElementById('sec_layout')?.checked;
  const incMoodboard= document.getElementById('sec_moodboard')?.checked;
  closeMo();

  const isES = LANG === 'es';
  const hired   = (p.vendors||[]).filter(v=>v.hired);
  const paid    = hired.reduce((s,v)=>s+(v.payments||[]).reduce((a,py)=>a+Number(py.amount),0),0);
  const tb      = hired.reduce((s,v)=>s+Number(v.budget),0);
  const done    = (p.tasks||[]).filter(tk=>tk.done).length;
  const confirmed = (p.guests||[]).filter(g=>g.rsvp==='confirmed').length;
  const typeLabels = {social:t('type_social'),corporate:t('type_corporate'),community:t('type_community'),government:t('type_government'),education:t('type_education')};
  const eventType  = typeLabels[p.type] || (p.type?p.type.replace(/^other:/,''):'') || '—';
  const genDate    = new Date().toLocaleDateString(isES?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'});
  const statusLabels = {
    'confirmed':isES?'Confirmado':'Confirmed',
    'to-be-confirmed':isES?'Por confirmar':'To be confirmed',
    'in-progress':isES?'En progreso':'In progress',
    'completed':isES?'Completado':'Completed',
    'cancelled':isES?'Cancelado':'Cancelled'
  };

  function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  function sec(title, countLabel, body){
    const cl = countLabel!=null?`<span style="font-size:11px;color:#b0a898;margin-left:auto;font-weight:500">${countLabel}</span>`:'';
    return `<div class="sec">
      <div class="sec-hd"><div class="sec-bar"></div><div class="sec-title">${title}</div>${cl}</div>
      ${body}
    </div>`;
  }
  function kv(label,val){
    return `<div class="kv"><span class="kv-l">${label}</span><span class="kv-v">${val}</span></div>`;
  }
  function badge(text,cls){
    return `<span class="badge ${cls}">${text}</span>`;
  }
  function prog(label,pct,color){
    return `<div class="prog">
      <div class="prog-hd"><span>${label}</span><span>${pct}%</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#241f17;background:#f6f1e8;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    a{color:inherit;text-decoration:none}

    .cover{background:#fff;padding:60px 56px 48px;border-bottom:4px solid #a67c3d;page-break-after:always;break-after:page}
    .cover-brand{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#a67c3d;margin-bottom:36px}
    .cover-name{font-size:40px;font-weight:700;letter-spacing:-.5px;line-height:1.1;color:#241f17;margin-bottom:8px}
    .cover-sub{font-size:16px;color:#6f665c;margin-bottom:24px}
    .cover-rule{width:56px;height:3px;background:#a67c3d;border-radius:2px;margin-bottom:28px}
    .cover-facts{display:flex;flex-wrap:wrap;gap:28px}
    .cover-fact-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#b0a898;margin-bottom:3px}
    .cover-fact-v{font-size:13px;font-weight:600;color:#241f17}
    .cover-foot{margin-top:36px;font-size:10px;color:#b0a898}

    .body{padding:40px 48px;background:#f6f1e8}

    .sec{margin-bottom:44px;break-inside:avoid}
    .sec-hd{display:flex;align-items:center;gap:10px;margin-bottom:20px}
    .sec-bar{width:4px;height:20px;background:#a67c3d;border-radius:2px;flex-shrink:0}
    .sec-title{font-size:15px;font-weight:700;color:#241f17;letter-spacing:-.2px}

    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
    .stats-3{grid-template-columns:repeat(3,minmax(0,1fr))}
    .stat{background:#fff;border:1px solid #e7dccb;border-radius:12px;padding:14px 16px}
    .stat-v{font-size:22px;font-weight:700;color:#8a6a1d;line-height:1}
    .stat-l{font-size:10px;color:#b0a898;text-transform:uppercase;letter-spacing:.07em;margin-top:5px}
    .stat-green .stat-v{color:#1f7a4a}
    .stat-red .stat-v{color:#b5403a}
    .stat-muted .stat-v{color:#6f665c}

    .kvbox{background:#fff;border:1px solid #e7dccb;border-radius:12px;overflow:hidden;margin-bottom:16px}
    .kv{display:flex;justify-content:space-between;align-items:baseline;padding:9px 16px;border-bottom:1px solid #f2ece0;font-size:12px}
    .kv:last-child{border-bottom:none}
    .kv-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#b0a898;flex-shrink:0;margin-right:12px}
    .kv-v{color:#241f17;font-weight:500;text-align:right}

    .prog{margin-bottom:10px}
    .prog-hd{display:flex;justify-content:space-between;font-size:11px;color:#6f665c;margin-bottom:4px}
    .prog-track{height:7px;background:#e7dccb;border-radius:4px;overflow:hidden}
    .prog-fill{height:100%;border-radius:4px}

    .tbl-wrap{background:#fff;border:1px solid #e7dccb;border-radius:12px;overflow:hidden;margin-top:6px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f6f1e8;color:#6f665c;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e7dccb}
    td{padding:9px 12px;border-bottom:1px solid #f2ece0;color:#241f17;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:nth-child(even) td{background:#fdfaf5}

    .badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;display:inline-block;white-space:nowrap}
    .badge-g{background:#e6f5ee;color:#1f7a4a}
    .badge-r{background:#fbeaea;color:#b5403a}
    .badge-y{background:#fef3c7;color:#92400e}
    .badge-b{background:#eff6ff;color:#1e40af}
    .badge-d{background:#f0ece0;color:#6f665c}

    .warn{margin-top:10px;padding:10px 14px;background:#fbeaea;border-radius:8px;font-size:11px;color:#b5403a;font-weight:600}

    .layouts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .layout-card{background:#fff;border:1px solid #e7dccb;border-radius:12px;overflow:hidden;break-inside:avoid}
    .layout-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#f2ece0}
    .layout-meta{padding:10px 14px;border-top:1px solid #f2ece0}
    .layout-name{font-size:12px;font-weight:600;color:#241f17}
    .layout-date{font-size:10px;color:#b0a898;margin-top:2px}

    .mb-folder{margin-bottom:28px;break-inside:avoid}
    .mb-fhd{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#fff;border:1px solid #e7dccb;border-radius:8px}
    .mb-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .mb-fname{font-size:12px;font-weight:700;color:#241f17}
    .mb-fcount{font-size:10px;color:#b0a898;margin-left:auto}
    .mb-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .mb-cell{break-inside:avoid}
    .mb-img-box{border-radius:8px;overflow:hidden;aspect-ratio:4/3;background:#e7dccb}
    .mb-img{width:100%;height:100%;object-fit:cover;display:block}
    .mb-cap{font-size:9px;color:#b0a898;margin-top:3px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mb-theme{background:#fff;border:1px solid #e7dccb;border-radius:10px;overflow:hidden;margin-bottom:16px}
    .palette-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.08);vertical-align:middle;margin-right:4px}

    .empty{padding:18px;color:#b0a898;font-size:12px;font-style:italic}

    @media print{
      body{background:#fff}
      .body{background:#fff;padding:28px 36px}
      .cover{border-bottom:3px solid #a67c3d}
      .sec,.layout-card,.mb-folder{break-inside:avoid}
    }
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${_esc(p.name)} — ${isES?'Resumen del Evento':'Event Summary'}</title>
<style>${css}</style></head><body>

<div class="cover">
  <div class="cover-brand">EventOS &nbsp;·&nbsp; ${isES?'Resumen del Evento':'Event Summary'}</div>
  <div class="cover-name">${_esc(p.name)}</div>
  <div class="cover-sub">${p.clientName?_esc(p.clientName)+' &nbsp;·&nbsp; ':''} ${_esc(eventType)}</div>
  <div class="cover-rule"></div>
  <div class="cover-facts">
    <div><div class="cover-fact-l">${isES?'Fecha':'Date'}</div><div class="cover-fact-v">${fmtDate(p.date)||'—'}</div></div>
    <div><div class="cover-fact-l">${isES?'Lugar':'Venue'}</div><div class="cover-fact-v">${_esc(p.location||'—')}</div></div>
    <div><div class="cover-fact-l">${t('status')}</div><div class="cover-fact-v">${statusLabels[p.status]||_esc(p.status||'—')}</div></div>
    ${p.budget?`<div><div class="cover-fact-l">${t('total_budget')}</div><div class="cover-fact-v">${fmtMoney(p.budget)}</div></div>`:''}
    <div><div class="cover-fact-l">${isES?'Invitados':'Guests'}</div><div class="cover-fact-v">${(p.guests||[]).length}</div></div>
  </div>
  <div class="cover-foot">${isES?'Generado el':'Generated on'} ${genDate}</div>
</div>

<div class="body">`;

  // ── Overview & Details ────────────────────────────────────────────────────
  if(incDash){
    const pct  = tb>0 ? Math.min(100,Math.round(paid/tb*100)) : 0;
    const tpct = (p.tasks||[]).length ? Math.round(done/(p.tasks||[]).length*100) : 0;
    const overdueCt = (p.tasks||[]).filter(isTaskOverdue).length;

    html += sec(t('section_dashboard'), null, `
      <div class="stats">
        <div class="stat"><div class="stat-v">${fmtMoney(p.budget||0)}</div><div class="stat-l">${t('total_budget')}</div></div>
        <div class="stat"><div class="stat-v">${(p.guests||[]).length}</div><div class="stat-l">${t('stat_guests')}</div></div>
        <div class="stat stat-green"><div class="stat-v">${confirmed}</div><div class="stat-l">${t('rsvp_confirmed')}</div></div>
        <div class="stat"><div class="stat-v">${done}/${(p.tasks||[]).length}</div><div class="stat-l">${t('tasks_completed')}</div></div>
      </div>
      <div class="kvbox">
        ${kv(t('event_name'), _esc(p.name))}
        ${p.clientName ? kv(t('client_name'), _esc(p.clientName)) : ''}
        ${kv(t('event_type'), _esc(eventType))}
        ${kv(t('event_date'), fmtDate(p.date)||'—')}
        ${kv(t('location'), _esc(p.location||'—'))}
        ${kv(t('status'), statusLabels[p.status]||_esc(p.status||'—'))}
        ${p.description ? kv(t('description'), _esc(p.description)) : ''}
      </div>
      ${(p.tasks||[]).length ? prog(t('tasks_completed'), tpct, '#7c3aed') : ''}
      ${tb>0 ? prog(t('budget_used'), pct, pct>90?'#ef4444':pct>70?'#f59e0b':'#2a7a56') : ''}
      ${overdueCt ? `<div class="warn">${overdueCt} ${isES?'tarea(s) vencida(s)':'overdue task(s)'}</div>` : ''}
    `);
  }

  // ── Budget & Vendors ──────────────────────────────────────────────────────
  if(incBudget){
    const allEst = (p.vendors||[]).reduce((s,v)=>s+Number(v.budget),0);
    const diff   = (p.budget||0) - allEst;
    const diffClr = diff>=0 ? '#1f7a4a' : '#b5403a';

    html += sec(t('section_budget'), hired.length ? hired.length+' '+(isES?'proveedores contratados':'hired vendors') : null, `
      <div class="stats">
        <div class="stat"><div class="stat-v">${fmtMoney(p.budget||0)}</div><div class="stat-l">${t('event_total_budget')}</div></div>
        <div class="stat"><div class="stat-v">${fmtMoney(allEst)}</div><div class="stat-l">${t('estimated_cost')}</div></div>
        <div class="stat stat-green"><div class="stat-v">${fmtMoney(paid)}</div><div class="stat-l">${t('actual_paid')}</div></div>
        <div class="stat"><div class="stat-v" style="color:${diffClr}">${diff>=0?'+':''}${fmtMoney(diff)}</div><div class="stat-l">${t('budget_variance')}</div></div>
      </div>
      ${tb>0 ? prog(t('budget_used'), Math.min(100,Math.round(paid/tb*100)), paid/tb>0.9?'#ef4444':paid/tb>0.7?'#f59e0b':'#2a7a56') : ''}
      ${hired.length ? `<div class="tbl-wrap"><table>
        <thead><tr>
          <th>${t('vendor_name_lbl')}</th><th>${t('category')}</th>
          <th style="text-align:right">${t('budget_label')}</th>
          <th style="text-align:right">${t('paid')}</th>
          <th style="text-align:right">${isES?'Pagado %':'Paid %'}</th>
          <th>${t('status')}</th>
        </tr></thead>
        <tbody>${hired.map(v=>{
          const vp   = v.payments.reduce((s,py)=>s+Number(py.amount),0);
          const vpct = v.budget>0 ? Math.min(100,Math.round(vp/v.budget*100)) : 0;
          const vClr = vpct>=100?'#1f7a4a':vpct>50?'#92400e':'#b0a898';
          return `<tr>
            <td style="font-weight:600">${_esc(v.name)}</td>
            <td>${_esc(v.category)}</td>
            <td style="text-align:right">${fmtMoney(v.budget)}</td>
            <td style="text-align:right">${fmtMoney(vp)}</td>
            <td style="text-align:right;font-weight:600;color:${vClr}">${vpct}%</td>
            <td>${badge(vpct>=100?(isES?'Pagado':'Paid'):(isES?'Pendiente':'Pending'),vpct>=100?'badge-g':'badge-y')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="empty">${t('no_hired_vendors')}</div>`}
    `);
  }

  // ── Task Timeline ─────────────────────────────────────────────────────────
  if(incTimeline){
    const overdue  = (p.tasks||[]).filter(isTaskOverdue);
    const pending  = (p.tasks||[]).filter(tk=>!tk.done&&!isTaskOverdue(tk));
    const sorted   = [...overdue, ...pending, ...(p.tasks||[]).filter(tk=>tk.done)];

    html += sec(t('section_timeline'), (p.tasks||[]).length+' '+(isES?'tareas':'tasks'), `
      <div class="stats stats-3">
        <div class="stat"><div class="stat-v">${(p.tasks||[]).length}</div><div class="stat-l">${t('total_tasks')}</div></div>
        <div class="stat stat-green"><div class="stat-v">${done}</div><div class="stat-l">${t('completed_tasks')}</div></div>
        <div class="stat stat-red"><div class="stat-v">${overdue.length}</div><div class="stat-l">${t('overdue_tasks')}</div></div>
      </div>
      ${sorted.length ? `<div class="tbl-wrap"><table>
        <thead><tr>
          <th>${t('task_title_lbl')}</th>
          <th>${t('due_date_lbl')}</th>
          <th>${t('assigned_to')||'Assigned'}</th>
          <th>${t('status')}</th>
        </tr></thead>
        <tbody>${sorted.map(tk=>{
          const isOv = isTaskOverdue(tk);
          const st   = tk.done ? badge(isES?'Completo':'Done','badge-g')
                     : isOv    ? badge(isES?'Vencida':'Overdue','badge-r')
                               : badge(isES?'Pendiente':'Pending','badge-y');
          return `<tr>
            <td style="font-weight:600">${_esc(tk.title)}</td>
            <td style="white-space:nowrap">${tk.dueDate||'—'}</td>
            <td>${_esc(tk.assignee||'—')}</td>
            <td>${st}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="empty">—</div>`}
    `);
  }

  // ── Guest List ────────────────────────────────────────────────────────────
  if(incGuests){
    const declined = (p.guests||[]).filter(g=>g.rsvp==='declined').length;
    const pending  = (p.guests||[]).filter(g=>!g.rsvp||g.rsvp==='pending').length;
    const hasPlusOne = (p.guests||[]).some(g=>g.plusOne);
    const sorted   = [...p.guests].sort((a,b)=>String(a.name).localeCompare(String(b.name)));

    html += sec(t('section_guests'), (p.guests||[]).length+' '+(isES?'invitados':'guests'), `
      <div class="stats">
        <div class="stat"><div class="stat-v">${(p.guests||[]).length}</div><div class="stat-l">${t('total_guests')}</div></div>
        <div class="stat stat-green"><div class="stat-v">${confirmed}</div><div class="stat-l">${t('rsvp_confirmed')}</div></div>
        <div class="stat stat-red"><div class="stat-v">${declined}</div><div class="stat-l">${t('rsvp_declined')}</div></div>
        <div class="stat stat-muted"><div class="stat-v">${pending}</div><div class="stat-l">${t('pending_guests')}</div></div>
      </div>
      ${sorted.length ? `<div class="tbl-wrap"><table>
        <thead><tr>
          <th>${t('col_name')}</th>
          <th>${t('rsvp_status')}</th>
          <th>${t('table_number')}</th>
          <th>${t('meal_pref')}</th>
          ${hasPlusOne ? `<th>+1</th>` : ''}
        </tr></thead>
        <tbody>${sorted.map(g=>{
          const rl  = g.rsvp==='confirmed'?(isES?'Confirmado':'Confirmed'):g.rsvp==='declined'?(isES?'Declinó':'Declined'):(isES?'Pendiente':'Pending');
          const rc  = g.rsvp==='confirmed'?'badge-g':g.rsvp==='declined'?'badge-r':'badge-y';
          return `<tr>
            <td style="font-weight:600">${_esc(g.name)}</td>
            <td>${badge(rl,rc)}</td>
            <td>${_esc(g.table||'—')}</td>
            <td>${_esc(g.meal||'—')}</td>
            ${hasPlusOne ? `<td>${g.plusOne ? badge('+1','badge-b') : ''}</td>` : ''}
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="empty">—</div>`}
    `);
  }

  // ── Event Layouts ─────────────────────────────────────────────────────────
  if(incLayout){
    const rawLayouts = (p.eventLayouts||[]).filter(e=>e.layoutExport&&e.layoutExport.image);
    const layoutList = rawLayouts.length
      ? rawLayouts
      : (p.layoutExport&&p.layoutExport.image ? [{layoutExport:p.layoutExport,addedAt:p.layoutExport.exportedAt}] : []);

    if(layoutList.length){
      html += sec(t('section_layout'), layoutList.length, `
        <div class="layouts-grid">${layoutList.map(entry=>{
          const ex = entry.layoutExport||{};
          const nm = ex.layoutName||(isES?'Plano':'Layout');
          const dt = entry.addedAt ? new Date(entry.addedAt).toLocaleDateString(isES?'es-MX':'en-US',{year:'numeric',month:'short',day:'numeric'}) : '';
          return `<div class="layout-card">
            <img class="layout-img" src="${ex.image}" alt="${_esc(nm)}" onerror="this.style.display='none'">
            <div class="layout-meta">
              <div class="layout-name">${_esc(nm)}</div>
              ${dt?`<div class="layout-date">${dt}</div>`:''}
            </div>
          </div>`;
        }).join('')}</div>
      `);
    }
  }

  // ── Moodboard ─────────────────────────────────────────────────────────────
  if(incMoodboard){
    const rawMb = p.moodboard||{};
    const mb    = Array.isArray(rawMb) ? {folders:[],uncategorized:rawMb} : rawMb;
    const folders    = (mb.folders||[]).filter(f=>f.images&&f.images.length);
    const uncatImgs  = (mb.uncategorized||[]).filter(img=>img.url||img.src);
    const hasContent = folders.length||uncatImgs.length;

    if(hasContent){
      const palette = p.aiPalette;
      const hasMeta = p.aiTheme||(Array.isArray(palette)&&palette.length);
      const metaHtml = hasMeta ? `<div class="mb-theme">
        ${p.aiTheme ? kv(isES?'Tema':'Theme', _esc(p.aiTheme)) : ''}
        ${Array.isArray(palette)&&palette.length ? kv(isES?'Paleta':'Palette',
          palette.map(c=>{
            const hex = typeof c==='object'?(c.hex||''):c;
            const name= typeof c==='object'?(c.name||hex):c;
            return `<span style="white-space:nowrap;margin-right:8px"><span class="palette-dot" style="background:${_esc(hex)}"></span>${_esc(name)}</span>`;
          }).join('')
        ) : ''}
      </div>` : '';

      const folderHtml = folders.map(folder=>{
        const imgs = folder.images.filter(img=>img.url||img.src);
        return `<div class="mb-folder">
          <div class="mb-fhd">
            <div class="mb-dot" style="background:${_esc(folder.color||'#a67c3d')}"></div>
            <div class="mb-fname">${_esc(folder.name)}</div>
            <div class="mb-fcount">${imgs.length} ${isES?'imágenes':'images'}</div>
          </div>
          <div class="mb-grid">${imgs.map(img=>`
            <div class="mb-cell">
              <div class="mb-img-box"><img class="mb-img" src="${img.url||img.src}" alt="${_esc(img.name||(isES?'Imagen del moodboard':'Moodboard image'))}" onerror="this.style.display='none'"></div>
              ${img.name?`<div class="mb-cap">${_esc(img.name)}</div>`:''}
            </div>`).join('')}
          </div>
        </div>`;
      }).join('');

      const uncatHtml = uncatImgs.length ? `<div class="mb-folder">
        <div class="mb-fhd">
          <div class="mb-dot" style="background:#b0a898"></div>
          <div class="mb-fname">${isES?'Sin clasificar':'Uncategorized'}</div>
          <div class="mb-fcount">${uncatImgs.length} ${isES?'imágenes':'images'}</div>
        </div>
        <div class="mb-grid">${uncatImgs.map(img=>`
          <div class="mb-cell">
            <div class="mb-img-box"><img class="mb-img" src="${img.url||img.src}" alt="${_esc(img.name||(isES?'Imagen del moodboard':'Moodboard image'))}" onerror="this.style.display='none'"></div>
            ${img.name?`<div class="mb-cap">${_esc(img.name)}</div>`:''}
          </div>`).join('')}
        </div>
      </div>` : '';

      html += sec(t('section_moodboard'), null, metaHtml + folderHtml + uncatHtml);
    }
  }

  html += `</div></body></html>`;

  const win = window.open('','_blank','width=960,height=760');
  if(!win){ toast(isES?'Permite ventanas emergentes para exportar':'Allow popups to export PDF','e'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 900);
}

document.addEventListener('click',function(e){
  var trigger=document.getElementById('ev-sort-trigger');
  var menu=document.getElementById('ev-sort-menu');
  if(menu&&trigger&&!trigger.contains(e.target)&&!menu.contains(e.target)) menu.style.display='none';
});
window.setEvSort = setEvSort;
window.toggleEvSortMenu = toggleEvSortMenu;
window.toggleEvSortDir = toggleEvSortDir;
window.setEvView = setEvView;
window.openExportPDFModal = openExportPDFModal;
window.openExportPDFForEvent = openExportPDFForEvent;
window.generateExportPDF = generateExportPDF;
