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
  const btn=document.getElementById('ap-alltime'); if(btn) btn.textContent=t('period_alltime');
}

function renderAnalytics(){
  const allProjects = Object.values(uproj()).filter(p=>p&&p.id&&p.id!=='__library__'&&p.id!=='__lib_layout__'&&p.status&&p.status!=='__internal__');
  const farPast=new Date('1900-01-01'); const farFuture=new Date('2100-12-31');
  const from = _aAt ? farPast  : (_aFr||farPast);
  const to   = _aAt ? farFuture: (_aTo  ||farFuture);
  const inPeriod = allProjects.filter(p=>{
    if(!p.date) return _aAt;
    const d=new Date(p.date); d.setHours(0,0,0,0);
    return d>=from && d<=to;
  });
  updateAnalyticsLabels();

  const title=document.getElementById('analytics-title');if(title)title.textContent=t('analytics_title');
  const sub=document.getElementById('analytics-sub');if(sub)sub.textContent=t('analytics_sub');
  const fromEl=document.getElementById('ap-from'); const toEl=document.getElementById('ap-to');
  if(fromEl&&!fromEl.value&&_aFr){
    fromEl.value=formatDMY(_aFr.toISOString().slice(0,10));
  }
  if(toEl&&!toEl.value&&_aTo){
    toEl.value=formatDMY(_aTo.toISOString().slice(0,10));
  }

  const el = document.getElementById('analytics-content');
  if(!el) return;

  if(!inPeriod.length){
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#787470">
      <svg width="40" height="40" fill="none" stroke="#DFD7C9" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 14px;display:block"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
      <div style="font-family:'DM Sans',sans-serif;font-size:16px;font-weight:600;color:#242424;margin-bottom:6px">${t('analytics_no_data')}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:13px">${LANG==='es'?'Intenta con un período de tiempo más amplio.':'Try a different time period.'}</div>
    </div>`;
    return;
  }

  const totalBudget = inPeriod.reduce((s,p)=>s+Number(p.budget||0),0);
  const avgBudget = totalBudget/inPeriod.length;
  const totalGuests = inPeriod.reduce((s,p)=>s+(p.guests||[]).length,0);
  const avgGuests = totalGuests/inPeriod.length;
  const confirmedGuests = inPeriod.reduce((s,p)=>s+(p.guests||[]).filter(g=>g.rsvp==='confirmed').length,0);

  const byType = {};
  inPeriod.forEach(p=>{ byType[p.type]=(byType[p.type]||0)+1; });
  const byStatus = {};
  inPeriod.forEach(p=>{ if(p.status) byStatus[p.status]=(byStatus[p.status]||0)+1; });
  const vendorCats = {};
  inPeriod.forEach(p=>{ (p.vendors||[]).filter(v=>v.hired).forEach(v=>{ vendorCats[v.category]=(vendorCats[v.category]||0)+1; }); });
  const topVendors = Object.entries(vendorCats).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const typeClrs = {social:'#ec4899',corporate:'#3b82f6',community:'#10b981',government:'#f59e0b',education:'#8b5cf6'};
  const statusClrs = {'to-be-confirmed':'#6b7280',confirmed:'#10b981','in-progress':'#f59e0b',completed:'#3b82f6',cancelled:'#ef4444'};
  const tl={social:t('type_social'),corporate:t('type_corporate'),community:t('type_community'),government:t('type_government'),education:t('type_education')};
  const sl={'to-be-confirmed':t('status_planning'),confirmed:t('status_confirmed'),'in-progress':t('status_in_progress'),completed:t('status_completed'),cancelled:t('status_cancelled')};

  function barChart(data, colorFn, labelFn, max){
    return data.map(([k,v])=>`
      <div style="display:grid;grid-template-columns:110px 1fr 40px;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${labelFn(k)}</div>
        <div style="background:var(--bg2);border-radius:4px;height:10px;overflow:hidden">
          <div style="height:100%;border-radius:4px;background:${colorFn(k)};width:${Math.round(v/max*100)}%;transition:width .4s"></div>
        </div>
        <div style="font-size:12px;font-weight:700;color:var(--text);text-align:right">${v}</div>
      </div>`).join('');
  }

  // Stacked bar chart: events per month broken down by type
  var monthByType = {};
  var monthTotals = {};
  inPeriod.forEach(function(p){
    if(!p.date) return;
    var d = new Date(p.date);
    var key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!monthByType[key]) monthByType[key] = {};
    var evType = (p.type||'other').replace(/^other:.*/,'other');
    monthByType[key][evType] = (monthByType[key][evType]||0) + 1;
    monthTotals[key] = (monthTotals[key]||0) + 1;
  });
  var sortedMonths = Object.keys(monthTotals).sort();
  var maxMonthCount = Math.max.apply(null, Object.values(monthTotals).concat([1]));
  var stackTypeOrder = ['social','corporate','community','government','education','other'];
  var stackTypeClrs = Object.assign({}, typeClrs, {other:'#787470'});
  var stackTypeLbls = Object.assign({}, tl, {other: LANG==='es'?'Otro':'Other'});

  // Build active types for legend (only types that appear)
  var activeTypes = stackTypeOrder.filter(function(tp){ return inPeriod.some(function(p){ return (p.type||'other').replace(/^other:.*/,'other') === tp; }); });

  var timelineHtml = sortedMonths.length > 0 ? `
    <div style="display:flex;align-items:flex-end;gap:8px;height:180px;padding:0 4px 0 30px;position:relative">
      ${[0.25,0.5,0.75,1].map(function(frac){
        var val = Math.round(maxMonthCount * frac);
        return '<div style="position:absolute;left:0;bottom:'+Math.round(frac*100)+'%;font-family:\'DM Sans\',sans-serif;font-size:9px;color:#787470;transform:translateY(50%)">'+val+'</div>'
          +'<div style="position:absolute;left:28px;right:0;bottom:'+Math.round(frac*100)+'%;height:1px;background:rgba(36,36,36,.06)"></div>';
      }).join('')}
      ${sortedMonths.map(function(m){
        var total = monthTotals[m];
        var types = monthByType[m];
        var barPct = Math.round(total / maxMonthCount * 100);
        var segments = stackTypeOrder.filter(function(tp){ return types[tp]; }).map(function(tp){
          var segPct = types[tp] / total * 100;
          var showLabel = segPct > 18 && types[tp] > 0;
          return '<div style="width:100%;height:'+segPct.toFixed(1)+'%;background:'+stackTypeClrs[tp]+';display:flex;align-items:center;justify-content:center;min-height:2px">'
            +(showLabel ? '<span style="font-family:\'DM Sans\',sans-serif;font-size:9px;font-weight:600;color:#fff;line-height:1">'+types[tp]+'</span>' : '')
            +'</div>';
        }).join('');
        return '<div style="flex:1;min-width:28px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">'
          +'<div style="font-family:\'DM Sans\',sans-serif;font-size:10px;font-weight:600;color:#242424;margin-bottom:4px">'+total+'</div>'
          +'<div style="width:80%;height:'+Math.max(barPct,3)+'%;border-radius:4px 4px 0 0;overflow:hidden;display:flex;flex-direction:column-reverse;transition:height .4s">'+segments+'</div>'
          +'</div>';
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;padding:4px 4px 0 30px;border-top:1px solid rgba(36,36,36,.08)">
      ${sortedMonths.map(function(m){
        var parts = m.split('-');
        var moName = new Date(+parts[0],+parts[1]-1,1).toLocaleString(LANG==='es'?'es-MX':'en-US',{month:'short'});
        return '<div style="flex:1;min-width:28px;text-align:center;font-family:\'DM Sans\',sans-serif;font-size:9px;color:#787470;padding-top:6px;white-space:nowrap">'+moName+' '+parts[0].slice(2)+'</div>';
      }).join('')}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;padding-left:30px">
      ${activeTypes.map(function(tp){
        return '<div style="display:flex;align-items:center;gap:5px">'
          +'<div style="width:10px;height:10px;border-radius:3px;background:'+stackTypeClrs[tp]+';flex-shrink:0"></div>'
          +'<span style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:#464646">'+(stackTypeLbls[tp]||tp)+'</span>'
          +'</div>';
      }).join('')}
    </div>` : '';

  function donutSegments(data, colorFn){
    const total = data.reduce((s,[,v])=>s+v,0);
    if(!total) return '';
    let offset=25;
    const r=15.9155, circ=2*Math.PI*r;
    return data.map(([k,v])=>{
      const pct=v/total*100;
      const dash=pct/100*circ;
      const gap=circ-dash;
      const seg=`<circle cx="21" cy="21" r="${r}" fill="none" stroke="${colorFn(k)}" stroke-width="5"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-dashoffset="${(100-offset)*circ/100}"
        transform="rotate(-90 21 21)"/>`;
      offset+=pct;
      return seg;
    }).join('');
  }

  function buildLargeDonut(data, colorFn, labelFn) {
    const total = data.reduce((s,[,v])=>s+v,0);
    if (!total) return '<div style="color:var(--muted);font-size:12px">—</div>';
    const r = 38, circ = 2 * Math.PI * r, cx = 55, cy = 55;
    let rotation = -90;
    const circles = data.map(([k,v]) => {
      const pct = v / total;
      const dash = pct * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorFn(k)}" stroke-width="16" stroke-dasharray="${dash.toFixed(2)} ${(circ-dash).toFixed(2)}" stroke-dashoffset="${(circ*0.25).toFixed(2)}" transform="rotate(${rotation.toFixed(2)} ${cx} ${cy})"/>`;
      rotation += pct * 360;
      return seg;
    }).join('');
    const svg = `<svg width="110" height="110" viewBox="0 0 110 110" style="flex-shrink:0">${circles}</svg>`;
    const legend = data.map(([k,v]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${colorFn(k)};flex-shrink:0"></div>
        <span style="font-family:'DM Sans',sans-serif;font-size:12px;color:#242424;flex:1">${labelFn(k)}</span>
        <span style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#242424">${v}</span>
      </div>`).join('');
    return `<div style="display:flex;align-items:center;gap:20px;">
      <div style="position:relative;width:110px;height:110px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        ${svg}
        <div style="position:absolute;text-align:center;">
          <div style="font-size:20px;font-weight:600;color:#242424;line-height:1;font-family:'DM Sans',sans-serif">${total}</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:10px;color:#787470;margin-top:2px">${LANG==='es'?'eventos':'events'}</div>
        </div>
      </div>
      <div style="flex:1">${legend}</div>
    </div>`;
  }

  el.innerHTML = `
  <!-- KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#787470;margin-bottom:8px">${t('analytics_events')}</div>
      <div style="font-size:22px;font-weight:600;color:#242424;font-family:'DM Sans',sans-serif">${inPeriod.length}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#787470;margin-top:4px">${LANG==='es'?'de '+allProjects.length+' total':'of '+allProjects.length+' total'}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#787470;margin-bottom:8px">${t('analytics_avg_budget')}</div>
      <div style="font-size:20px;font-weight:600;color:#242424;font-family:'DM Sans',sans-serif">${fmtMoney(avgBudget)}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#787470;margin-top:4px">${t('total_budget')}: ${fmtMoney(totalBudget)}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#787470;margin-bottom:8px">${t('analytics_avg_guests')}</div>
      <div style="font-size:22px;font-weight:600;color:#242424;font-family:'DM Sans',sans-serif">${Math.round(avgGuests)}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#787470;margin-top:4px">${totalGuests} ${LANG==='es'?'confirmados '+confirmedGuests:'total, '+confirmedGuests+' confirmed'}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#787470;margin-bottom:8px">${LANG==='es'?'Completados':'Completed'}</div>
      <div style="font-size:22px;font-weight:600;color:#242424;font-family:'DM Sans',sans-serif">${byStatus['completed']||0}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#787470;margin-top:4px">${LANG==='es'?'eventos completados':'events completed'}</div>
    </div>
  </div>

  <!-- CHARTS ROW -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

    <!-- Event Timeline -->
    <div class="card" style="padding:20px;grid-column:1/-1">
      <div style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;color:#242424;margin-bottom:16px">${t('analytics_timeline')}</div>
      ${timelineHtml||'<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">—</div>'}
    </div>

    <!-- By Type -->
    <div class="card" style="padding:20px">
      <div style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;color:#242424;margin-bottom:14px">${t('analytics_by_type')}</div>
      ${Object.keys(byType).length?buildLargeDonut(Object.entries(byType).sort((a,b)=>b[1]-a[1]),k=>typeClrs[k]||'#9e9e9e',k=>tl[k]||k):'<div style="color:var(--muted);font-size:12px">—</div>'}
    </div>

    <!-- By Status -->
    <div class="card" style="padding:20px">
      <div style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;color:#242424;margin-bottom:14px">${LANG==='es'?'Eventos por Estado':'Events by Status'}</div>
      ${Object.keys(byStatus).length?buildLargeDonut(Object.entries(byStatus).sort((a,b)=>b[1]-a[1]),k=>statusClrs[k]||'#9e9e9e',k=>sl[k]||k):'<div style="color:var(--muted);font-size:12px">—</div>'}
    </div>

  </div>

  <!-- TOP VENDORS + EVENT LIST -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

    <!-- Top vendor categories -->
    <div class="card" style="padding:20px">
      <div style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;color:#242424;margin-bottom:14px">${t('analytics_top_vendors')}</div>
      ${topVendors.length?topVendors.map(([cat,cnt])=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bg)">
          <div style="font-size:12px;font-weight:600">${cat}</div>
          <span style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#242424;min-width:28px;text-align:center">${cnt}</span>
        </div>`).join(''):`<div style="color:var(--muted);font-size:12px">${LANG==='es'?'Sin proveedores contratados':'No hired vendors'}</div>`}
    </div>

    <!-- Events in period list -->
    <div class="card" style="padding:20px">
      <div style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;color:#242424;margin-bottom:14px">${LANG==='es'?'Eventos del Período':'Events in Period'}</div>
      ${inPeriod.sort((a,b)=>a.date<b.date?-1:1).map(p=>`
        <div onclick="openProject('${p.id}')" class="analytics-project-row">
          <div>
            <div style="font-size:13px;font-weight:600">${esc(p.name)}</div>
            <div class="s-sm">${fmtDate(p.date)} · ${(p.guests||[]).length} ${LANG==='es'?'inv.':'guests'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#242424">${fmtMoney(p.budget)}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${p.status?esc(t('status_'+p.status.replace('-','_'))||p.status):''}</div>
          </div>
        </div>`).join('')}
    </div>

  </div>`;
}

function openExportPDFModal(){
  const p = proj();
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
  const p = proj(); if(!p) return;
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

    .cover{background:#fff;padding:60px 56px 48px;border-bottom:4px solid #c9a84c;page-break-after:always;break-after:page}
    .cover-brand{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#c9a84c;margin-bottom:36px}
    .cover-name{font-size:40px;font-weight:700;letter-spacing:-.5px;line-height:1.1;color:#241f17;margin-bottom:8px}
    .cover-sub{font-size:16px;color:#6f665c;margin-bottom:24px}
    .cover-rule{width:56px;height:3px;background:#c9a84c;border-radius:2px;margin-bottom:28px}
    .cover-facts{display:flex;flex-wrap:wrap;gap:28px}
    .cover-fact-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#b0a898;margin-bottom:3px}
    .cover-fact-v{font-size:13px;font-weight:600;color:#241f17}
    .cover-foot{margin-top:36px;font-size:10px;color:#b0a898}

    .body{padding:40px 48px;background:#f6f1e8}

    .sec{margin-bottom:44px;break-inside:avoid}
    .sec-hd{display:flex;align-items:center;gap:10px;margin-bottom:20px}
    .sec-bar{width:4px;height:20px;background:#c9a84c;border-radius:2px;flex-shrink:0}
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
      .cover{border-bottom:3px solid #c9a84c}
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
    const overdueCt = (p.tasks||[]).filter(tk=>!tk.done&&tk.dueDate&&new Date(tk.dueDate)<new Date()).length;

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
    const overdue  = (p.tasks||[]).filter(tk=>!tk.done&&tk.dueDate&&new Date(tk.dueDate)<new Date());
    const pending  = (p.tasks||[]).filter(tk=>!tk.done&&(!tk.dueDate||new Date(tk.dueDate)>=new Date()));
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
          const isOv = !tk.done&&tk.dueDate&&new Date(tk.dueDate)<new Date();
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
            <div class="mb-dot" style="background:${_esc(folder.color||'#c9a84c')}"></div>
            <div class="mb-fname">${_esc(folder.name)}</div>
            <div class="mb-fcount">${imgs.length} ${isES?'imágenes':'images'}</div>
          </div>
          <div class="mb-grid">${imgs.map(img=>`
            <div class="mb-cell">
              <div class="mb-img-box"><img class="mb-img" src="${img.url||img.src}" onerror="this.style.display='none'"></div>
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
            <div class="mb-img-box"><img class="mb-img" src="${img.url||img.src}" onerror="this.style.display='none'"></div>
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
window.generateExportPDF = generateExportPDF;
