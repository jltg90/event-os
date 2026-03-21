var _aAt = true;
var _aFr = null;
var _aTo   = null;

function setAnalyticsAllTime(){
  _aAt = true;
  _aFr = null;
  _aTo   = null;
  const fromEl=document.getElementById('ap-from'); const toEl=document.getElementById('ap-to');
  if(fromEl) fromEl.value=''; if(toEl) toEl.value='';
  const fromDisp=document.getElementById('ap-from-display'); if(fromDisp) fromDisp.firstElementChild.textContent='DD/MM/YYYY';
  const toDisp=document.getElementById('ap-to-display'); if(toDisp) toDisp.firstElementChild.textContent='DD/MM/YYYY';
  const btn=document.getElementById('ap-alltime'); if(btn) btn.classList.add('active');
  saveEvPrefs();
  renderAnalytics();
}

function setAnalyticsDateRange(){
  const fromVal=(document.getElementById('ap-from')||{}).value;
  const toVal=(document.getElementById('ap-to')||{}).value;
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
    fromEl.value=_aFr.toISOString().slice(0,10);
    const d=document.getElementById('ap-from-display'); if(d) d.firstElementChild.textContent=formatDMY(fromEl.value);
  }
  if(toEl&&!toEl.value&&_aTo){
    toEl.value=_aTo.toISOString().slice(0,10);
    const d=document.getElementById('ap-to-display'); if(d) d.firstElementChild.textContent=formatDMY(toEl.value);
  }

  const el = document.getElementById('analytics-content');
  if(!el) return;

  if(!inPeriod.length){
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:12px">📊</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">${t('analytics_no_data')}</div>
      <div style="font-size:13px">${LANG==='es'?'Intenta con un período de tiempo más amplio.':'Try a different time period.'}</div>
    </div>`;
    return;
  }

  const totalBudget = inPeriod.reduce((s,p)=>s+Number(p.budget||0),0);
  const avgBudget = totalBudget/inPeriod.length;
  const totalGuests = inPeriod.reduce((s,p)=>s+p.guests.length,0);
  const avgGuests = totalGuests/inPeriod.length;
  const confirmedGuests = inPeriod.reduce((s,p)=>s+p.guests.filter(g=>g.rsvp==='confirmed').length,0);

  const byType = {};
  inPeriod.forEach(p=>{ byType[p.type]=(byType[p.type]||0)+1; });
  const byStatus = {};
  inPeriod.forEach(p=>{ if(p.status) byStatus[p.status]=(byStatus[p.status]||0)+1; });
  const vendorCats = {};
  inPeriod.forEach(p=>{ p.vendors.filter(v=>v.hired).forEach(v=>{ vendorCats[v.category]=(vendorCats[v.category]||0)+1; }); });
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

  const monthBuckets = {};
  inPeriod.forEach(p=>{
    if(!p.date) return;
    const d=new Date(p.date);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    monthBuckets[key]=(monthBuckets[key]||0)+1;
  });
  const sortedMonths = Object.keys(monthBuckets).sort();
  const maxMonthCount = Math.max(...Object.values(monthBuckets),1);
  const timelineHtml = sortedMonths.length > 0 ? `
    <div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:0 4px;border-bottom:1px solid var(--border)">
      ${sortedMonths.map(m=>{
        const cnt=monthBuckets[m];
        const pct=Math.round(cnt/maxMonthCount*100);
        const [yr,mo]=m.split('-');
        const moName=new Date(+yr,+mo-1,1).toLocaleString(LANG==='es'?'es-MX':'en-US',{month:'short'});
        return `<div style="flex:1;min-width:32px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%">
          <div style="font-size:10px;font-weight:700;color:var(--gold-h)">${cnt}</div>
          <div style="width:70%;background:linear-gradient(180deg,var(--gold-l),var(--gold-h));border-radius:4px 4px 0 0;height:${Math.max(pct,4)}%;transition:height .4s"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:6px;padding:6px 4px 0">
      ${sortedMonths.map(m=>{
        const [yr,mo]=m.split('-');
        const moName=new Date(+yr,+mo-1,1).toLocaleString(LANG==='es'?'es-MX':'en-US',{month:'short'});
        return `<div style="flex:1;min-width:32px;text-align:center;font-size:9px;color:var(--muted);white-space:nowrap">${moName} ${yr.slice(2)}</div>`;
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
        <span style="font-size:12px;color:var(--text);flex:1">${labelFn(k)}</span>
        <span style="font-size:12px;font-weight:700;color:var(--text)">${v}</span>
      </div>`).join('');
    return `<div style="display:flex;align-items:center;gap:20px;">
      <div style="position:relative;width:110px;height:110px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        ${svg}
        <div style="position:absolute;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${total}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${LANG==='es'?'eventos':'events'}</div>
        </div>
      </div>
      <div style="flex:1">${legend}</div>
    </div>`;
  }

  el.innerHTML = `
  <!-- KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:8px">${t('analytics_events')}</div>
      <div style="font-size:36px;font-weight:700;color:var(--gold-h);font-family:'Cormorant Garamond',serif">${inPeriod.length}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${LANG==='es'?'de '+allProjects.length+' total':'of '+allProjects.length+' total'}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:8px">${t('analytics_avg_budget')}</div>
      <div style="font-size:28px;font-weight:700;color:#f59e0b;font-family:'Cormorant Garamond',serif">${fmtMoney(avgBudget)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${t('total_budget')}: ${fmtMoney(totalBudget)}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:8px">${t('analytics_avg_guests')}</div>
      <div style="font-size:36px;font-weight:700;color:#10b981;font-family:'Cormorant Garamond',serif">${Math.round(avgGuests)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${totalGuests} ${LANG==='es'?'confirmados '+confirmedGuests:'total, '+confirmedGuests+' confirmed'}</div>
    </div>
    <div class="card" style="padding:18px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:8px">${LANG==='es'?'Completados':'Completed'}</div>
      <div style="font-size:36px;font-weight:700;color:#6b4fa0;font-family:'Cormorant Garamond',serif">${byStatus['completed']||0}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${LANG==='es'?'eventos completados':'events completed'}</div>
    </div>
  </div>

  <!-- CHARTS ROW -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

    <!-- Event Timeline -->
    <div class="card" style="padding:20px;grid-column:1/-1">
      <div style="font-weight:700;font-size:14px;margin-bottom:16px">${t('analytics_timeline')}</div>
      ${timelineHtml||'<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">—</div>'}
    </div>

    <!-- By Type -->
    <div class="card" style="padding:20px">
      <div style="font-weight:700;font-size:14px;margin-bottom:14px">${t('analytics_by_type')}</div>
      ${Object.keys(byType).length?buildLargeDonut(Object.entries(byType).sort((a,b)=>b[1]-a[1]),k=>typeClrs[k]||'#9e9e9e',k=>tl[k]||k):'<div style="color:var(--muted);font-size:12px">—</div>'}
    </div>

    <!-- By Status -->
    <div class="card" style="padding:20px">
      <div style="font-weight:700;font-size:14px;margin-bottom:14px">${LANG==='es'?'Eventos por Estado':'Events by Status'}</div>
      ${Object.keys(byStatus).length?buildLargeDonut(Object.entries(byStatus).sort((a,b)=>b[1]-a[1]),k=>statusClrs[k]||'#9e9e9e',k=>sl[k]||k):'<div style="color:var(--muted);font-size:12px">—</div>'}
    </div>

  </div>

  <!-- TOP VENDORS + EVENT LIST -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

    <!-- Top vendor categories -->
    <div class="card" style="padding:20px">
      <div style="font-weight:700;font-size:14px;margin-bottom:14px">${t('analytics_top_vendors')}</div>
      ${topVendors.length?topVendors.map(([cat,cnt])=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bg)">
          <div style="font-size:12px;font-weight:600">${cat}</div>
          <span class="badge b-gold" style="min-width:28px;text-align:center">${cnt}</span>
        </div>`).join(''):`<div style="color:var(--muted);font-size:12px">${LANG==='es'?'Sin proveedores contratados':'No hired vendors'}</div>`}
    </div>

    <!-- Events in period list -->
    <div class="card" style="padding:20px">
      <div style="font-weight:700;font-size:14px;margin-bottom:14px">${LANG==='es'?'Eventos del Período':'Events in Period'}</div>
      ${inPeriod.sort((a,b)=>a.date<b.date?-1:1).map(p=>`
        <div onclick="openProject('${p.id}')" class="analytics-project-row">
          <div>
            <div style="font-size:13px;font-weight:600">${p.name}</div>
            <div class="s-sm">${fmtDate(p.date)} · ${p.guests.length} ${LANG==='es'?'inv.':'guests'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;font-weight:700;color:var(--gold-h)">${fmtMoney(p.budget)}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${p.status?t('status_'+p.status.replace('-','_'))||p.status:''}</div>
          </div>
        </div>`).join('')}
    </div>

  </div>`;
}

function openExportPDFModal(){
  const p = proj();
  if(!p) return toast(LANG==='es'?'Abre un proyecto primero':'Open a project first','e');
  openMo(`<div class="mo-title">${t('export_pdf_title')}</div>
  <div style="margin-bottom:16px;font-size:13px;color:var(--muted)">${t('export_pdf_select')}</div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
    ${[['sec_dash','section_dashboard',true],['sec_budget','section_budget',true],['sec_timeline','section_timeline',true],['sec_guests','section_guests',true],['sec_moodboard','section_moodboard',false]].map(([id,key,checked])=>`
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
  const incDash = document.getElementById('sec_dash')?.checked;
  const incBudget = document.getElementById('sec_budget')?.checked;
  const incTimeline = document.getElementById('sec_timeline')?.checked;
  const incGuests = document.getElementById('sec_guests')?.checked;
  const incMoodboard = document.getElementById('sec_moodboard')?.checked;
  closeMo();

  const hired = p.vendors.filter(v=>v.hired);
  const paid = hired.reduce((s,v)=>s+v.payments.reduce((a,py)=>a+Number(py.amount),0),0);
  const tb = hired.reduce((s,v)=>s+Number(v.budget),0);
  const done = p.tasks.filter(t=>t.done).length;
  const confirmed = p.guests.filter(g=>g.rsvp==='confirmed').length;
  const tl={social:t('type_social'),corporate:t('type_corporate'),community:t('type_community'),government:t('type_government'),education:t('type_education')};

  const sec = (title,body) => `
    <div class="pdf-section">
      <div class="pdf-sec-title">${title}</div>
      ${body}
    </div>`;

  const kv = (label,val) => `<div class="pdf-kv"><span class="pdf-kl">${label}</span><span class="pdf-kv-val">${val}</span></div>`;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${esc(p.name)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;font-size:13px}
    .pdf-cover{background:linear-gradient(135deg,#1a2235 0%,#2d3f5e 60%,#3a4f6e 100%);color:#fff;padding:60px 50px;min-height:220px;display:flex;flex-direction:column;justify-content:flex-end}
    .pdf-cover-title{font-size:36px;font-weight:700;letter-spacing:-.5px;margin-bottom:8px;font-family:Georgia,serif;color:#c9a84c}
    .pdf-cover-sub{font-size:15px;opacity:.7;margin-bottom:6px}
    .pdf-cover-meta{font-size:12px;opacity:.5;margin-top:16px}
    .pdf-body{padding:32px 40px}
    .pdf-section{margin-bottom:36px;break-inside:avoid}
    .pdf-sec-title{font-size:17px;font-weight:700;color:#1a2235;border-bottom:2px solid #c9a84c;padding-bottom:6px;margin-bottom:16px;font-family:Georgia,serif}
    .pdf-kv{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ece0;font-size:12px}
    .pdf-kl{color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.4px;font-size:10px;padding-top:2px}
    .pdf-kv-val{color:#222;font-weight:500;text-align:right;max-width:60%}
    .pdf-stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .pdf-stat{flex:1;min-width:120px;background:#f9f6ee;border-radius:8px;padding:14px;text-align:center}
    .pdf-stat-val{font-size:22px;font-weight:700;color:#c9a84c;font-family:Georgia,serif}
    .pdf-stat-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-top:4px}
    .pdf-prog-wrap{margin:8px 0}
    .pdf-prog-label{display:flex;justify-content:space-between;font-size:10px;color:#888;margin-bottom:3px}
    .pdf-prog-bar{height:8px;background:#f0ece0;border-radius:4px;overflow:hidden}
    .pdf-prog-fill{height:100%;border-radius:4px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#1a2235;color:#c9a84c;padding:7px 10px;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.4px;font-size:10px}
    td{padding:7px 10px;border-bottom:1px solid #f0ece0}
    tr:last-child td{border-bottom:none}
    .badge-g{background:#e8f5ef;color:#2d7a5e;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600}
    .badge-r{background:#fbeaea;color:#b5403a;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600}
    .badge-y{background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600}
    .badge-b{background:#eff6ff;color:#1e40af;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600}
    .mood-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
    .mood-img{width:100px;height:80px;object-fit:cover;border-radius:6px}
    @media print{body{font-size:12px}.pdf-body{padding:20px 24px}}
  </style></head><body>

  <div class="pdf-cover">
    <div class="pdf-cover-title">${esc(p.name)}</div>
    <div class="pdf-cover-sub">${p.clientName} · ${tl[p.type]||p.type}</div>
    <div class="pdf-cover-sub">${p.location||'TBD'} · ${fmtDate(p.date)}</div>
    <div class="pdf-cover-meta">${LANG==='es'?'Generado el':'Generated on'} ${new Date().toLocaleDateString(LANG==='es'?'es-MX':'en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
  </div>
  <div class="pdf-body">`;

  if(incDash){
    const pct = tb>0?Math.min(100,Math.round(paid/tb*100)):0;
    const tpct = p.tasks.length?Math.round(done/p.tasks.length*100):0;
    html += sec(t('section_dashboard'),`
      <div class="pdf-stat-row">
        <div class="pdf-stat"><div class="pdf-stat-val">${fmtMoney(p.budget)}</div><div class="pdf-stat-lbl">${t('total_budget')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val">${p.guests.length}</div><div class="pdf-stat-lbl">${t('stat_guests')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val">${confirmed}</div><div class="pdf-stat-lbl">${t('rsvp_confirmed')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val">${done}/${p.tasks.length}</div><div class="pdf-stat-lbl">${t('tasks_completed')}</div></div>
      </div>
      ${kv(t('event_name'), p.name)}
      ${kv(t('client_name'), p.clientName)}
      ${kv(t('event_type'), tl[p.type]||p.type)}
      ${kv(t('event_date'), fmtDate(p.date))}
      ${kv(t('location'), p.location||'TBD')}
      ${kv(t('status'), p.status?t('status_'+p.status.replace('-','_'))||p.status:'')}
      ${p.description?kv(t('description'),p.description):''}
      <div class="pdf-prog-wrap" style="margin-top:12px">
        <div class="pdf-prog-label"><span>${t('tasks_completed')}</span><span>${tpct}%</span></div>
        <div class="pdf-prog-bar"><div class="pdf-prog-fill" style="width:${tpct}%;background:#7c3aed"></div></div>
      </div>
      <div class="pdf-prog-wrap">
        <div class="pdf-prog-label"><span>${t('budget_used')}</span><span>${pct}%</span></div>
        <div class="pdf-prog-bar"><div class="pdf-prog-fill" style="width:${pct}%;background:${pct>90?'#ef4444':pct>70?'#f59e0b':'#10b981'}"></div></div>
      </div>`);
  }

  if(incBudget){
    const allEst = p.vendors.reduce((s,v)=>s+Number(v.budget),0);
    const diff = (p.budget||0) - allEst;
    html += sec(t('section_budget'),`
      <div class="pdf-stat-row">
        <div class="pdf-stat"><div class="pdf-stat-val">${fmtMoney(p.budget||0)}</div><div class="pdf-stat-lbl">${t('event_total_budget')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val">${fmtMoney(allEst)}</div><div class="pdf-stat-lbl">${t('estimated_cost')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val">${fmtMoney(paid)}</div><div class="pdf-stat-lbl">${t('actual_paid')}</div></div>
        <div class="pdf-stat" style="background:${diff>=0?'#e8f5ef':'#fbeaea'}"><div class="pdf-stat-val" style="color:${diff>=0?'#2d7a5e':'#b5403a'}">${diff>=0?'+':''}${fmtMoney(diff)}</div><div class="pdf-stat-lbl">${t('budget_variance')}</div></div>
      </div>
      ${hired.length?`<table style="margin-top:12px">
        <tr><th>${t('vendor_name_lbl')}</th><th>${t('category')}</th><th>${t('budget_label')}</th><th>${t('paid')}</th><th>%</th></tr>
        ${hired.map(v=>{
          const vpaid=v.payments.reduce((s,py)=>s+Number(py.amount),0);
          const vpct=v.budget>0?Math.min(100,Math.round(vpaid/v.budget*100)):0;
          return `<tr><td>${esc(v.name)}</td><td>${esc(v.category)}</td><td>${fmtMoney(v.budget)}</td><td>${fmtMoney(vpaid)}</td><td>${vpct}%</td></tr>`;
        }).join('')}
      </table>`:`<div style="color:#999;font-size:12px">${t('no_hired_vendors')}</div>`}`);
  }

  if(incTimeline){
    const overdue = p.tasks.filter(tk=>!tk.done&&tk.dueDate&&new Date(tk.dueDate)<new Date());
    html += sec(t('section_timeline'),`
      <div class="pdf-stat-row" style="margin-bottom:12px">
        <div class="pdf-stat"><div class="pdf-stat-val">${p.tasks.length}</div><div class="pdf-stat-lbl">${t('total_tasks')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val" style="color:#2d7a5e">${done}</div><div class="pdf-stat-lbl">${t('completed_tasks')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val" style="color:#b5403a">${overdue.length}</div><div class="pdf-stat-lbl">${t('overdue_tasks')}</div></div>
      </div>
      ${p.tasks.length?`<table>
        <tr><th>${t('task_title_lbl')}</th><th>${t('due_date_lbl')}</th><th>${t('assigned_to')||'Assigned'}</th><th>${t('status')}</th></tr>
        ${p.tasks.map(tk=>{
          const isOv=!tk.done&&tk.dueDate&&new Date(tk.dueDate)<new Date();
          return `<tr><td>${esc(tk.title)}</td><td>${tk.dueDate||'—'}</td><td>${esc(tk.assignee||'—')}</td>
            <td>${tk.done?`<span class="badge-g">${t('completed_tasks').split(' ')[0]||'Done'}</span>`:isOv?`<span class="badge-r">${t('overdue_lbl')}</span>`:`<span class="badge-y">${t('status_in_progress')}</span>`}</td></tr>`;
        }).join('')}
      </table>`:`<div style="color:#999;font-size:12px">—</div>`}`);
  }

  if(incGuests){
    html += sec(t('section_guests'),`
      <div class="pdf-stat-row" style="margin-bottom:12px">
        <div class="pdf-stat"><div class="pdf-stat-val">${p.guests.length}</div><div class="pdf-stat-lbl">${t('total_guests')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val" style="color:#2d7a5e">${confirmed}</div><div class="pdf-stat-lbl">${t('rsvp_confirmed')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val" style="color:#b5403a">${p.guests.filter(g=>g.rsvp==='declined').length}</div><div class="pdf-stat-lbl">${t('rsvp_declined')}</div></div>
        <div class="pdf-stat"><div class="pdf-stat-val" style="color:#888">${p.guests.filter(g=>!g.rsvp||g.rsvp==='pending').length}</div><div class="pdf-stat-lbl">${t('pending_guests')}</div></div>
      </div>
      ${p.guests.length?`<table>
        <tr><th>${t('col_name')}</th><th>${t('rsvp_status')}</th><th>${t('table_number')}</th><th>${t('meal_pref')}</th></tr>
        ${p.guests.map(g=>{
          const rBadge=g.rsvp==='confirmed'?'badge-g':g.rsvp==='declined'?'badge-r':'badge-y';
          return `<tr><td>${esc(g.name)}</td><td><span class="${rBadge}">${g.rsvp||'pending'}</span></td><td>${g.table||'—'}</td><td>${esc(g.meal||'—')}</td></tr>`;
        }).join('')}
      </table>`:`<div style="color:#999;font-size:12px">—</div>`}`);
  }

  if(incMoodboard && p.moodboard && p.moodboard.length){
    const imgs = p.moodboard.filter(item=>item.url||item.src).slice(0,12);
    html += sec(t('section_moodboard'),`
      ${p.aiTheme?kv(LANG==='es'?'Tema':'Theme', p.aiTheme):''}
      ${p.aiPalette?kv(LANG==='es'?'Paleta':'Palette', Array.isArray(p.aiPalette)?p.aiPalette.join(', '):p.aiPalette):''}
      ${imgs.length?`<div class="mood-grid">${imgs.map(item=>`<img src="${item.url||item.src}" class="mood-img" onerror="this.style.display='none'">`).join('')}</div>`:''}`);
  }

  html += `</div></body></html>`;

  const win = window.open('','_blank','width=900,height=700');
  if(!win){ toast(LANG==='es'?'Permite ventanas emergentes para exportar':'Allow popups to export PDF','e'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 800);
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
