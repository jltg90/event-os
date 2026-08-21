var bTab='comp';

// Memoizacion de los agregados de presupuesto.
//
// La version anterior construia la clave como una SUMA de importes, con dos fallos:
//  - dos repartos distintos con el mismo total colisionaban (mover $100 del
//    proveedor A al B no invalidaba el cache);
//  - un solo proveedor sin `budget` numerico hacia que la suma fuera NaN; como la
//    clave es un string, "…:NaN" === "…:NaN" para siempre y el panel quedaba
//    congelado mostrando $NaN de forma permanente.
// Tampoco incluia el id del proyecto, asi que dos proyectos parecidos compartian
// resultado.  Ahora la clave es una huella posicional y siempre finita.
var _budgetCache = { key: '', result: null };
function _num(n){ var x = Number(n); return isFinite(x) ? x : 0; }
function _budgetCacheKey(p){
  var parts = [String(p.id||''), _num(p.budget), (p.guests||[]).length];
  (p.guests||[]).forEach(function(g){ if(g && g.plusOne) parts.push('+'); });
  (p.vendors||[]).forEach(function(v){
    parts.push(v && v.id, _num(v && v.budget), (v && v.hired) ? 1 : 0);
    ((v && v.payments)||[]).forEach(function(pay){ parts.push(pay && pay.id, _num(pay && pay.amount)); });
  });
  return parts.join('|');
}
function calcBudgetStats(p){
  var key = _budgetCacheKey(p);
  if(_budgetCache.key === key) return _budgetCache.result;
  var allVendors = p.vendors || [];
  var hired = allVendors.filter(function(v){ return v.hired; });
  // _num() en todas las sumas: un importe vacio o corrupto ya no propaga NaN a la UI.
  var estimatedTotal = allVendors.reduce(function(s,v){ return s+_num(v.budget); },0);
  var tb = hired.reduce(function(s,v){ return s+_num(v.budget); },0);
  var paid = hired.reduce(function(s,v){ return s+(v.payments||[]).reduce(function(a,pay){ return a+_num(pay.amount); },0); },0);
  var projBudget = _num(p.budget);
  var diff = projBudget - estimatedTotal;
  var guestTotal = (p.guests||[]).length;
  var plusOnes = (p.guests||[]).filter(function(g){ return g.plusOne; }).length;
  var totalWithPlusOnes = guestTotal + plusOnes;
  var budgetPerGuest = totalWithPlusOnes>0&&projBudget>0 ? Math.ceil(projBudget/totalWithPlusOnes) : 0;
  var budgetPct = projBudget>0 ? Math.min(100,Math.round(estimatedTotal/projBudget*100)) : 0;
  _budgetCache.key = key;
  _budgetCache.result = { allVendors:allVendors, hired:hired, estimatedTotal:estimatedTotal, tb:tb, paid:paid, projBudget:projBudget, diff:diff, guestTotal:guestTotal, plusOnes:plusOnes, totalWithPlusOnes:totalWithPlusOnes, budgetPerGuest:budgetPerGuest, budgetPct:budgetPct };
  return _budgetCache.result;
}

function _budgetToolbarHtml(isES){
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-ghost" onclick="libDownloadVendorTemplate()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>${isES?'Descargar Plantilla':'Download Template'}</span>
      </button>
      <button class="btn btn-ghost" onclick="libQuickLoadVendors()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>${isES?'Importar Proveedores':'Import Vendors'}</span>
      </button>
      <button class="btn btn-ghost" onclick="libQuickSaveVendors()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>${isES?'Guardar en Biblioteca':'Save to Library'}</span>
      </button>
      <button class="btn btn-primary btn-create-gradient" onclick="openVendorModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${t('add_vendor')}
      </button>
    </div>`;
}
function _budgetStatCard(label, value, valueColor, sub){
  return `<div class="bstat-card"><div class="bstat-label">${label}</div><div class="bstat-value" style="color:${valueColor}">${value}</div>${sub?'<div class="bstat-sub">'+sub+'</div>':''}</div>`;
}
function renderBudget(){
  const p=proj();const el=document.getElementById('tab-budget');
  if(ensureDefaultVendors(p)) saveProj(p);
  const allVendors = p.vendors;
  const isES = LANG==='es';
  const isMob = isPhoneViewport();
  if(!allVendors.length){
    el.innerHTML=`
  <div class="sh">
    <div><div class="sh-title editorial-title" style="color:var(--text)">${t('budget_management_title')}</div>
    <div class="sh-sub">${isES?'Gestiona tus proveedores y presupuesto del evento':'Manage your event vendors and budget'}</div></div>
    ${isMob?'':_budgetToolbarHtml(isES)}
  </div>
  ${renderVendorEmptyState()}
  ${renderMobileStickyActionBar(`
    <button class="btn btn-ghost" onclick="libQuickLoadVendors()">${isES?'Importar':'Import'}</button>
    <button class="btn btn-primary btn-create-gradient" onclick="openVendorModal()">${t('add_vendor')}</button>
  `)}`;
    return;
  }
  const bs=calcBudgetStats(p);
  const hired=bs.hired, estimatedTotal=bs.estimatedTotal, tb=bs.tb, paid=bs.paid;
  const projBudget=bs.projBudget, diff=bs.diff;
  const guestTotalB=bs.guestTotal, plusOnesB=bs.plusOnes, totalWithPlusOnesB=bs.totalWithPlusOnes;
  const budgetPerGuestB=bs.budgetPerGuest, budgetPct=bs.budgetPct;
  const diffClr = diff>=0?'var(--success)':'var(--danger)';
  const paidPct = tb>0 ? Math.min(100, Math.round(paid/tb*100)) : 0;
  el.innerHTML=`
  <div class="sh">
    <div><div class="sh-title editorial-title" style="color:var(--text)">${t('budget_management_title')}</div>
    <div class="sh-sub">${t('budget_label')}: ${fmtMoney(tb)} &middot; ${t('paid_label')}: ${fmtMoney(paid)} &middot; ${t('balance_label')}: ${fmtMoney(tb-paid)}</div></div>
    ${isMob?'':_budgetToolbarHtml(isES)}
  </div>
  ${isMob?`
  <div class="bstat-scroll">
    ${_budgetStatCard(t('event_total_budget'), fmtMoney(projBudget), 'var(--gold-h)', t('approved_budget'))}
    ${_budgetStatCard(t('estimated_cost'), fmtMoney(estimatedTotal), '#f59e0b',
      '<div class="prog" style="margin-bottom:2px"><div class="prog-f" style="width:'+budgetPct+'%;background:'+(budgetPct>100?'var(--danger)':'#f59e0b')+'"></div></div>'+budgetPct+'% '+t('of_approved'))}
    ${_budgetStatCard(t('actual_paid'), fmtMoney(paid), 'var(--success)',
      '<div class="prog" style="margin-bottom:2px"><div class="prog-f" style="width:'+paidPct+'%;background:var(--success)"></div></div>'+t('balance_label')+': '+fmtMoney(tb-paid))}
    ${_budgetStatCard(t('budget_variance'), (diff>=0?'+':'')+fmtMoney(diff), diffClr,
      '<span style="font-weight:600;color:'+diffClr+'">'+(diff>=0?t('under_budget'):t('over_budget'))+'</span>')}
    ${totalWithPlusOnesB>0&&projBudget>0?_budgetStatCard(isES?'Presupuesto p/Inv.':'Budget / Guest', fmtMoney(budgetPerGuestB), 'var(--gold-h)', totalWithPlusOnesB+' '+(isES?'invitados':'guests')):''}
  </div>`:`
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px">
    <div class="card" style="padding:18px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--light);font-weight:600;margin-bottom:6px">${t('event_total_budget')}</div>
      <div style="font-size:22px;font-weight:700;color:var(--gold-h)">${fmtMoney(projBudget)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${t('approved_budget')}</div>
    </div>
    ${totalWithPlusOnesB>0&&projBudget>0?`<div class="card" style="padding:18px;cursor:default" title="${isES?'Presupuesto ('+fmtMoney(projBudget)+') ÷ '+totalWithPlusOnesB+' invitados (incl. acompañantes)':'Budget ('+fmtMoney(projBudget)+') ÷ '+totalWithPlusOnesB+' guests (incl. plus-ones)'}">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--light);font-weight:600;margin-bottom:6px">${isES?'Presupuesto p/Inv.':'Budget / Guest'}</div>
      <div style="font-size:22px;font-weight:700;color:var(--gold-h)">${fmtMoney(budgetPerGuestB)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${totalWithPlusOnesB} ${isES?'invitados':'guests'}</div>
    </div>`:''}
    <div class="card" style="padding:18px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--light);font-weight:600;margin-bottom:6px">${t('estimated_cost')}</div>
      <div style="font-size:22px;font-weight:700;color:#f59e0b">${fmtMoney(estimatedTotal)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">
        <div class="prog" style="margin-bottom:2px"><div class="prog-f" style="width:${budgetPct}%;background:${budgetPct>100?'var(--danger)':'#f59e0b'}"></div></div>
        ${budgetPct}% ${t('of_approved')}
      </div>
    </div>
    <div class="card" style="padding:18px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--light);font-weight:600;margin-bottom:6px">${t('actual_paid')}</div>
      <div style="font-size:22px;font-weight:700;color:var(--success)">${fmtMoney(paid)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${t('balance_label')}: ${fmtMoney(tb-paid)}</div>
    </div>
    <div class="card" style="padding:18px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--light);font-weight:600;margin-bottom:6px">${t('budget_variance')}</div>
      <div style="font-size:22px;font-weight:700;color:${diffClr}">${diff>=0?'+':''}${fmtMoney(diff)}</div>
      <div style="font-size:11px;color:${diffClr};margin-top:2px;font-weight:600">${diff>=0?t('under_budget'):t('over_budget')}</div>
    </div>
  </div>`}
  <div style="margin-bottom:14px;position:relative;display:flex;align-items:center">
    <svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input id="vendor-search" class="input" placeholder="${LANG==='es'?'Buscar proveedores...':'Search vendors...'}" oninput="filterVendors(this.value)" style="padding-left:36px;width:100%" aria-label="${LANG==='es'?'Buscar proveedores':'Search vendors'}">
  </div>
  <div id="vlist">${renderVendorTable(allVendors, '')}</div>
  ${renderMobileStickyActionBar(`
    <button class="btn btn-ghost" onclick="libQuickLoadVendors()">${isES?'Importar':'Import'}</button>
    <button class="btn btn-primary btn-create-gradient" onclick="openVendorModal()">${t('add_vendor')}</button>
  `)}`;
}

function renderVendorEmptyState(){
  const isES = LANG==='es';
  return `<section class="ev-empty fade-in">
    <div class="ev-empty-shell">
      <div class="ev-empty-aurora" aria-hidden="true"></div>
      <div class="ev-empty-grid">
        <div class="ev-empty-copy">
          <div class="ev-empty-badge">${isES?'Configuracion de proveedores':'Vendor setup'}</div>
          <h2 class="ev-empty-title">${isES?'Organiza todos tus proveedores en un solo lugar.':'Organize all your vendors in one place.'}</h2>
          <p class="ev-empty-subtitle">${isES?'Crea un plan de proveedores personalizado para tu evento. El asistente sugiere los proveedores que necesitas segun los servicios que requieras, y te permite marcar los que ya tienes confirmados.':'Create a tailored vendor plan for your event. The wizard suggests the vendors you need based on your services, and lets you mark which ones are already confirmed.'}</p>
          <div class="ev-empty-actions">
            <button class="btn btn-primary btn-create-gradient ev-empty-cta" onclick="openVendorSetupWizard()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${isES?'Crear Plan de Proveedores':'Create Vendor Plan'}
            </button>
            <button class="btn btn-ghost ev-empty-cta" onclick="openVendorModal()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${t('add_vendor')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// ── Vendor Setup Wizard ────────────────────────────────────────────────────────

var VENDOR_TEMPLATES = [
  {id:'venue',      name_en:'Venue',                name_es:'Lugar',                  services_en:'Venue / Event Space',            services_es:'Lugar / Espacio para eventos',  serviceKey:'venue',         priority:'critical'},
  {id:'coordinator',name_en:'Event Coordinator',    name_es:'Coordinador de Eventos',  services_en:'Event Coordination',            services_es:'Coordinacion de eventos',        serviceKey:'coordinator',   priority:'critical'},
  {id:'catering',   name_en:'Catering',             name_es:'Catering',                services_en:'Catering, Food & Beverage',     services_es:'Catering, Alimentos y Bebidas', serviceKey:'catering',      priority:'critical'},
  {id:'bar',        name_en:'Bar Service',          name_es:'Servicio de Bar',         services_en:'Bar & Beverage Service',        services_es:'Servicio de Bar y Bebidas',      serviceKey:'catering',      priority:'important'},
  {id:'decor',      name_en:'Decor & Florals',      name_es:'Decoracion y Flores',     services_en:'Decor, Florals & Styling',      services_es:'Decoracion, Flores y Estilismo',serviceKey:'decor',         priority:'important'},
  {id:'rentals',    name_en:'Rentals',              name_es:'Alquiler de Mobiliario',  services_en:'Furniture & Equipment Rentals', services_es:'Alquiler de Muebles y Equipos',  serviceKey:'decor',         priority:'important'},
  {id:'av',         name_en:'AV & Lighting',        name_es:'Audio y Luces',           services_en:'AV / Lighting / Production',    services_es:'Audio, Luces y Produccion',      serviceKey:'av',            priority:'important'},
  {id:'photo',      name_en:'Photographer',         name_es:'Fotografo',               services_en:'Photography',                   services_es:'Fotografia',                     serviceKey:'photo',         priority:'critical'},
  {id:'video',      name_en:'Videographer',         name_es:'Videografo',              services_en:'Videography',                   services_es:'Videografia',                    serviceKey:'photo',         priority:'important'},
  {id:'entertain',  name_en:'Entertainment',        name_es:'Entretenimiento',         services_en:'Entertainment / Music / DJ',   services_es:'Entretenimiento / Musica / DJ',  serviceKey:'entertainment', priority:'important'},
  {id:'staffing',   name_en:'Event Staffing',       name_es:'Personal de Evento',      services_en:'Event Staffing & Servers',     services_es:'Personal y Meseros',             serviceKey:'catering',      priority:'optional'},
  {id:'transport',  name_en:'Transportation',       name_es:'Transporte',              services_en:'Guest Transportation',         services_es:'Transporte de Invitados',        serviceKey:'transport',     priority:'optional'},
  {id:'permits',    name_en:'Permits & Security',   name_es:'Permisos y Seguridad',    services_en:'Permits, Licenses & Security', services_es:'Permisos, Licencias y Seguridad',serviceKey:'permits',       priority:'optional'},
  {id:'signage',    name_en:'Signage & Print',      name_es:'Senaletica e Impresos',   services_en:'Signage, Printing & Stationery',services_es:'Senaletica, Impresos y Papeleria',serviceKey:'decor',        priority:'optional'},
  {id:'seating',    name_en:'Seating Chart Service',name_es:'Servicio de Mesas',       services_en:'Seating Chart & Table Layout', services_es:'Distribucion de Mesas',          serviceKey:'seating',       priority:'optional'}
];

var _vendorWiz = null;

// SVG icons for vendor service tiles (no emoji — consistent cross-platform rendering)
var _vwIcons = {
  needVenue:       '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  needCoordinator: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>',
  needCatering:    '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  needBar:         '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M8 22H6a2 2 0 0 1-2-2v-7l-1-1V6h14v6l-1 1v7a2 2 0 0 1-2 2h-2"/><path d="M6 6V2h12v4"/><path d="M10 11v5a2 2 0 0 0 4 0v-5"/></svg>',
  needDecor:       '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  needRentals:     '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/></svg>',
  needAV:          '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  needPhoto:       '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  needVideo:       '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  needEntertain:   '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  needStaffing:    '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  needTransport:   '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  needPermits:     '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
  needSignage:     '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  needSeating:     '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
};

function openVendorSetupWizard(){
  _vendorWiz = {
    step: 0,
    needVenue: true, needCoordinator: true, needCatering: true, needBar: false,
    needDecor: false, needRentals: false, needAV: false, needPhoto: true,
    needVideo: false, needEntertain: false, needStaffing: false,
    needTransport: false, needPermits: false, needSignage: false, needSeating: false,
    confirmed: {}
  };
  _renderVendorWiz();
}

function _renderVendorWiz(){
  if(!_vendorWiz) return;
  var isES = LANG==='es';
  var s = _vendorWiz.step;
  var stepLabels = isES ? ['Servicios','Confirmados','Vista previa'] : ['Services','Confirmed','Preview'];

  var prog = '<div style="display:flex;align-items:flex-start;gap:0;margin-bottom:24px;">';
  for(var i=0;i<stepLabels.length;i++){
    var done=i<s, active=i===s;
    var circBg  = done?'var(--gold)':active?'var(--gold-l)':'var(--bg)';
    var circBd  = (done||active)?'var(--gold)':'var(--border)';
    var circClr = done?'#fff':active?'var(--gold-h)':'var(--light)';
    var txtClr  = active?'var(--gold-h)':done?'var(--text)':'var(--light)';
    var inner   = done?'<svg width="11" height="11" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':String(i+1);
    var lineClr = i<=s?'var(--gold)':'var(--border)';
    var line    = i>0?'<div style="position:absolute;right:50%;top:13px;width:100%;height:1px;background:'+lineClr+'"></div>':'';
    prog += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;">'
      +line
      +'<div style="width:26px;height:26px;border-radius:50%;border:1.5px solid '+circBd+';background:'+circBg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:'+circClr+';position:relative;z-index:1;">'+inner+'</div>'
      +'<div style="font-size:10px;margin-top:5px;color:'+txtClr+';font-weight:'+(active?'600':'400')+';white-space:nowrap;letter-spacing:.3px;">'+stepLabels[i]+'</div>'
      +'</div>';
  }
  prog += '</div>';

  var body = s===0 ? _vendorWizStep0(isES) : s===1 ? _vendorWizStep1(isES) : _vendorWizStep2(isES);
  var backBtn = s>0
    ? '<button class="btn btn-ghost" onclick="_vendorWizBack()">'+(isES?'← Atras':'← Back')+'</button>'
    : '<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>';
  var nextLbl = s===2
    ? (isES?'Crear Plan':'Create Plan')
    : (isES?'Siguiente →':'Next →');
  var nextOnclick = s===2 ? '_vendorWizGenerate()' : '_vendorWizNext()';

  openMo(
    '<div style="width:100%;max-width:600px;">'
    +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;color:var(--gold-h);margin-bottom:3px;">'+(isES?'Plan de Proveedores':'Vendor Plan')+'</div>'
    +'<div style="font-size:12px;color:var(--light);margin-bottom:22px;letter-spacing:.3px;text-transform:uppercase;">'+(isES?'Paso '+(s+1)+' de 3':'Step '+(s+1)+' of 3')+'</div>'
    +prog+body
    +'<div class="mo-foot" style="margin-top:24px;">'+backBtn
    +'<button class="btn btn-primary btn-create-gradient" onclick="'+nextOnclick+'">'+nextLbl+'</button>'
    +'</div></div>'
  );
}

function _vendorWizStep0(isES){
  var services = [
    {key:'needVenue',       label_en:'Venue / Space',       label_es:'Lugar / Espacio'},
    {key:'needCoordinator', label_en:'Coordinator',          label_es:'Coordinador'},
    {key:'needCatering',    label_en:'Catering & Food',      label_es:'Catering y Alimentos'},
    {key:'needBar',         label_en:'Bar Service',          label_es:'Servicio de Bar'},
    {key:'needDecor',       label_en:'Decor & Florals',      label_es:'Decoracion y Flores'},
    {key:'needRentals',     label_en:'Furniture Rentals',    label_es:'Alquiler de Mobiliario'},
    {key:'needAV',          label_en:'AV & Lighting',        label_es:'Audio y Luces'},
    {key:'needPhoto',       label_en:'Photography',          label_es:'Fotografia'},
    {key:'needVideo',       label_en:'Videography',          label_es:'Videografia'},
    {key:'needEntertain',   label_en:'Entertainment / DJ',   label_es:'Entretenimiento / DJ'},
    {key:'needStaffing',    label_en:'Event Staffing',       label_es:'Personal de Evento'},
    {key:'needTransport',   label_en:'Transportation',       label_es:'Transporte'},
    {key:'needPermits',     label_en:'Permits & Security',   label_es:'Permisos y Seguridad'},
    {key:'needSignage',     label_en:'Signage & Print',      label_es:'Senaletica e Impresos'},
    {key:'needSeating',     label_en:'Seating Chart',        label_es:'Distribucion de Mesas'}
  ];
  var grid = services.map(function(s){
    var on = !!_vendorWiz[s.key];
    var lbl = isES ? s.label_es : s.label_en;
    var ic = _vwIcons[s.key]||'';
    return '<div onclick="_vendorWizToggle(\''+s.key+'\')" style="cursor:pointer;border:2px solid '+(on?'var(--accent)':'var(--border)')+';border-radius:10px;padding:14px 10px 10px;text-align:center;background:'+(on?'rgba(139,92,246,.12)':'transparent')+';transition:border-color .15s,background .15s">'
      +'<div style="color:'+(on?'var(--accent)':'var(--muted)')+';display:flex;justify-content:center;margin-bottom:7px;transition:color .15s">'+ic+'</div>'
      +'<div style="font-size:11px;font-weight:600;color:'+(on?'var(--accent)':'var(--light)')+';line-height:1.3">'+lbl+'</div>'
      +'</div>';
  }).join('');
  return '<h3 style="margin:0 0 4px;font-size:16px;font-weight:600">'+(isES?'Que servicios necesita tu evento?':'What services does your event need?')+'</h3>'
    +'<p style="margin:0 0 16px;font-size:13px;color:var(--muted)">'+(isES?'Selecciona todos los que apliquen.':'Select all that apply.')+'</p>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">'+grid+'</div>';
}

function _vendorWizStep1(isES){
  var selected = _vendorWizSelectedTemplates();
  var rows = selected.map(function(tmpl){
    var on = !!_vendorWiz.confirmed[tmpl.id];
    var name = isES ? tmpl.name_es : tmpl.name_en;
    return '<div onclick="_vendorWizToggleConfirmed(\''+tmpl.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:10px 12px;border:2px solid '+(on?'var(--success)':'var(--border)')+';border-radius:8px;background:'+(on?'rgba(34,197,94,.08)':'transparent')+';transition:border-color .15s,background .15s;margin-bottom:8px">'
      +'<div style="width:18px;height:18px;border-radius:50%;border:2px solid '+(on?'var(--success)':'var(--border)')+';flex-shrink:0;display:flex;align-items:center;justify-content:center">'
      +(on?'<svg width="10" height="10" fill="none" stroke="var(--success)" stroke-width="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>':'')
      +'</div>'
      +'<span style="font-size:13px;font-weight:600;color:var(--text)">'+esc(name)+'</span>'
      +'<span style="font-size:11px;color:'+(on?'var(--success)':'var(--muted)')+';margin-left:auto;font-weight:'+(on?'600':'400')+'">'+(on?(isES?'Contratado':'Hired'):(isES?'Por contratar':'To hire'))+'</span>'
      +'</div>';
  }).join('');
  return '<h3 style="margin:0 0 4px;font-size:16px;font-weight:600">'+(isES?'Cuales ya tienes confirmados?':'Which are already confirmed?')+'</h3>'
    +'<p style="margin:0 0 14px;font-size:13px;color:var(--muted)">'+(isES?'Los marcados se crean como "Contratado".':'Marked ones are created as "Hired".')+'</p>'
    +'<div style="max-height:320px;overflow-y:auto;padding-right:4px">'+rows+'</div>';
}

function _vendorWizStep2(isES){
  var selected = _vendorWizSelectedTemplates();
  var confirmedCount = selected.filter(function(t){ return !!_vendorWiz.confirmed[t.id]; }).length;
  var pendingCount = selected.length - confirmedCount;
  var rows = selected.map(function(tmpl){
    var confirmed = !!_vendorWiz.confirmed[tmpl.id];
    var name = isES ? tmpl.name_es : tmpl.name_en;
    var svc  = isES ? tmpl.services_es : tmpl.services_en;
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:'+(confirmed?'var(--success)':'var(--accent)')+'"></div>'
      +'<div><div style="font-size:12px;font-weight:600">'+esc(name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+esc(svc)+'</div></div>'
      +'<div style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:'+(confirmed?'rgba(34,197,94,.15)':'rgba(139,92,246,.15)')+';color:'+(confirmed?'var(--success)':'var(--accent)')+'">'+
        (confirmed?(isES?'Contratado':'Hired'):(isES?'Pendiente':'Pending'))+'</div>'
      +'</div>';
  }).join('');
  return '<h3 style="margin:0 0 4px;font-size:16px;font-weight:600">'+(isES?'Vista previa del plan':'Plan preview')+'</h3>'
    +'<p style="margin:0 0 14px;font-size:13px;color:var(--muted)">'+(isES?'Se crearan estos proveedores. Puedes editarlos despues.':'These vendors will be created. You can edit them after.')+'</p>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
    +'<div class="card" style="padding:14px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--accent)">'+selected.length+'</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">'+(isES?'Proveedores':'Vendors')+'</div></div>'
    +'<div class="card" style="padding:14px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--success)">'+confirmedCount+'</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">'+(isES?'Confirmados':'Confirmed')+'</div></div>'
    +'<div class="card" style="padding:14px;text-align:center"><div style="font-size:22px;font-weight:700;color:#f59e0b">'+pendingCount+'</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">'+(isES?'Por contratar':'To hire')+'</div></div>'
    +'</div>'
    +'<div style="max-height:260px;overflow-y:auto;padding-right:4px">'+rows+'</div>';
}

function _vendorWizSelectedTemplates(){
  if(!_vendorWiz) return [];
  var keyMap = {
    needVenue:'venue', needCoordinator:'coordinator', needCatering:'catering',
    needBar:'bar', needDecor:'decor', needRentals:'rentals', needAV:'av',
    needPhoto:'photo', needVideo:'video', needEntertain:'entertain',
    needStaffing:'staffing', needTransport:'transport', needPermits:'permits',
    needSignage:'signage', needSeating:'seating'
  };
  var selectedIds = [];
  Object.keys(keyMap).forEach(function(k){ if(_vendorWiz[k]) selectedIds.push(keyMap[k]); });
  return VENDOR_TEMPLATES.filter(function(t){ return selectedIds.indexOf(t.id) > -1; });
}

function _vendorWizToggle(field){
  if(!_vendorWiz) return;
  _vendorWiz[field] = !_vendorWiz[field];
  _renderVendorWiz();
}

function _vendorWizToggleConfirmed(id){
  if(!_vendorWiz) return;
  _vendorWiz.confirmed[id] = !_vendorWiz.confirmed[id];
  _renderVendorWiz();
}

function _vendorWizNext(){
  if(!_vendorWiz) return;
  _vendorWiz.step = Math.min(_vendorWiz.step + 1, 2);
  _renderVendorWiz();
}

function _vendorWizBack(){
  if(!_vendorWiz) return;
  _vendorWiz.step = Math.max(_vendorWiz.step - 1, 0);
  _renderVendorWiz();
}

function buildVendorWizardVendors(){
  if(!_vendorWiz) return [];
  var isES = LANG==='es';
  return _vendorWizSelectedTemplates().map(function(tmpl){
    var confirmed = !!_vendorWiz.confirmed[tmpl.id];
    return {
      id: 'v'+Date.now()+Math.random().toString(36).slice(2,7),
      name: isES ? tmpl.name_es : tmpl.name_en,
      services: isES ? tmpl.services_es : tmpl.services_en,
      contact: '', phone: '', budget: 0,
      vendorStatus: confirmed ? 'hired' : 'pending',
      hired: confirmed,
      notes: '', payments: []
    };
  });
}

function _vendorWizGenerate(){
  if(!_vendorWiz) return;
  if(typeof _libVendorWizTargetGroupId !== 'undefined' && _libVendorWizTargetGroupId){
    var lib=getLib();
    var entry=lib.vendors.find(function(e){return e.id===_libVendorWizTargetGroupId;});
    if(entry){
      buildVendorWizardVendors().forEach(function(v){
        v.id='lv'+Date.now()+Math.random().toString(36).slice(2,6);
        entry.vendors.push(v);
      });
      saveLib(lib);
    }
    _libVendorWizTargetGroupId=null; _vendorWiz=null; closeMo();
    toast(LANG==='es'?'Plan guardado en biblioteca':'Plan saved to library','s');
    if(typeof renderLibrary==='function') renderLibrary();
    return;
  }
  var p = proj();
  p.vendors = buildVendorWizardVendors();
  saveProj(p);
  _vendorWiz = null;
  closeMo();
  toast(LANG==='es'?'Plan de proveedores creado':'Vendor plan created', 's');
  renderBudget();
}

var vSelectedVendorIds = [];
function vendorSelectionCount(){ return vSelectedVendorIds.length; }
function isVendorSelected(id){ return vSelectedVendorIds.indexOf(id) > -1; }
function toggleVendorSelection(id, checked){
  if(checked){
    if(!isVendorSelected(id)) vSelectedVendorIds.push(id);
  } else {
    vSelectedVendorIds = vSelectedVendorIds.filter(function(x){ return x !== id; });
  }
  updateVendorBulkBar();
}
function clearVendorSelection(){
  vSelectedVendorIds = [];
  updateVendorBulkBar();
}
function syncVendorSelectionToVisible(){
  document.querySelectorAll('.vendor-sel').forEach(function(chk){
    chk.checked = isVendorSelected(chk.dataset.vid);
  });
  var visible = document.querySelectorAll('.vendor-sel').length;
  var checked = document.querySelectorAll('.vendor-sel:checked').length;
  var all = document.getElementById('vendor-chk-all');
  if(all) all.checked = visible > 0 && visible === checked;
}
function updateVendorBulkBar(){
  var bar = document.getElementById('vendor-bulk-bar');
  var lbl = document.getElementById('vendor-bulk-count');
  if(bar) bar.style.display = vendorSelectionCount() ? 'flex' : 'none';
  if(lbl) lbl.textContent = vendorSelectionCount() + ' ' + (LANG==='es' ? 'seleccionado(s)' : 'selected');
  syncVendorSelectionToVisible();
}
function toggleAllVisibleVendors(checked){
  document.querySelectorAll('.vendor-sel').forEach(function(chk){
    if(checked && !isVendorSelected(chk.dataset.vid)) vSelectedVendorIds.push(chk.dataset.vid);
    if(!checked) vSelectedVendorIds = vSelectedVendorIds.filter(function(x){ return x !== chk.dataset.vid; });
  });
  updateVendorBulkBar();
}
function vendorStatusInfo(v){
  const st = v.vendorStatus || (v.hired ? 'hired' : 'pending');
  const map = {
    pending:      { label: LANG==='es'?'Pendiente':'Pending',       bg:'#f3f4f6', clr:'#374151' },
    hired:        { label: LANG==='es'?'Contratado':'Hired',         bg:'#d1fae5', clr:'#065f46' },
    'in-progress':{ label: LANG==='es'?'En Progreso':'In Progress',  bg:'#fef3c7', clr:'#92400e' },
    paid:         { label: LANG==='es'?'Pagado':'Paid',              bg:'#dbeafe', clr:'#1e40af' },
    cancelled:    { label: LANG==='es'?'Cancelado':'Cancelled',      bg:'#fee2e2', clr:'#991b1b' },
  };
  return map[st] || map.pending;
}
function filterVendors(query){
  const p=proj(); if(!p) return;
  const q=query.trim().toLowerCase();
  const vendors = q==='' ? p.vendors : p.vendors.filter(v=>{
    return [v.name,v.category,v.subcategory,v.services,v.contact,v.notes].some(f=>f&&f.toLowerCase().includes(q));
  });
  document.getElementById('vlist').innerHTML = renderVendorTable(vendors, '');
  syncVendorSelectionToVisible();
}
function renderVendorTable(vendors, tab){
  if(!vendors.length) return `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${t(tab==='hired'?'no_hired_vendors':'no_comparison_vendors')}<br><br><button class="btn btn-primary btn-create-gradient btn-sm" onclick="openVendorModal()">Add Vendor</button></div>`;
  if(isPhoneViewport()) return renderVendorMobileCards(vendors, tab);
  const isES = LANG==='es';
  const rows = vendors.map(v=>{
    const paid = v.payments.reduce((a,p)=>a+Number(p.amount),0);
    const si = vendorStatusInfo(v);
    return `<tr style="cursor:pointer;transition:.15s" onclick="showVendorDetail('${v.id}')" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
      <td style="padding:12px 10px" onclick="event.stopPropagation()"><input class="vendor-sel" type="checkbox" data-vid="${v.id}" ${isVendorSelected(v.id)?'checked':''} onchange="toggleVendorSelection('${v.id}', this.checked)" style="width:14px;height:14px;accent-color:var(--gold-h);cursor:pointer"></td>
      <td style="padding:12px 16px;font-weight:600;font-size:13px">${esc(v.name)}<div style="font-size:11px;font-weight:400;color:var(--muted);margin-top:2px">${esc(v.category||'')}${v.subcategory?' · '+esc(v.subcategory):''}</div></td>
      <td style="padding:12px 16px;font-size:12px;color:var(--muted)">${esc(v.contact||'—')}</td>
      <td style="padding:12px 16px;font-size:13px;font-weight:600">${fmtMoney(v.budget)}</td>
      <td style="padding:12px 16px">
        <select class="select" style="font-size:11px;padding:3px 8px;height:28px;background:${si.bg};color:${si.clr};border:none;font-weight:600;border-radius:20px;cursor:pointer" onclick="event.stopPropagation()" onchange="setVendorStatus('${v.id}',this.value)">
          ${['pending','hired','in-progress','paid','cancelled'].map(s=>`<option value="${s}"${(v.vendorStatus||(v.hired?'hired':'pending'))===s?' selected':''}>${{pending:isES?'Pendiente':'Pending',hired:isES?'Contratado':'Hired','in-progress':isES?'En Progreso':'In Progress',paid:isES?'Pagado':'Paid',cancelled:isES?'Cancelado':'Cancelled'}[s]}</option>`).join('')}
        </select>
      </td>
      <td style="padding:12px 16px;font-size:13px;font-weight:600;color:var(--success)">${fmtMoney(paid)}</td>
      <td style="padding:12px 16px">
        ${v.payments.length?`<span style="font-size:11px;background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:10px;font-weight:600">${v.payments.length} ${isES?'pago(s)':'payment(s)'}</span>`:`<span style="font-size:11px;color:var(--light)">—</span>`}
      </td>
      <td style="padding:12px 16px" onclick="event.stopPropagation()">
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm btn-icon" title="${isES?'Duplicar':'Duplicate'}" onclick="dupVendor('${v.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="btn btn-ghost btn-sm btn-icon" title="${isES?'Editar':'Edit'}" onclick="openVendorModal('${v.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-icon" title="${isES?'Eliminar':'Delete'}" onclick="delV('${v.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm)">
    <div id="vendor-bulk-bar" style="display:${vendorSelectionCount()?'flex':'none'};padding:10px 16px;border-bottom:1px solid var(--border);gap:8px;align-items:center;flex-wrap:wrap;background:var(--gold-l)">
      <span id="vendor-bulk-count" style="font-size:12px;font-weight:600;color:var(--gold-h)">${vendorSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
      <button class="btn btn-ghost btn-sm" onclick="openBulkVendorEditModal()">${isES?'Editar seleccionados':'Edit selected'}</button>
      <button class="btn btn-danger btn-sm" onclick="bulkDeleteVendors()">${isES?'Eliminar seleccionados':'Delete selected'}</button>
      <button class="btn btn-ghost btn-sm" onclick="clearVendorSelection()">${isES?'Limpiar selección':'Clear selection'}</button>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--bg2);border-bottom:1px solid var(--border)">
          <th style="padding:10px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)"><input type="checkbox" id="vendor-chk-all" onchange="toggleAllVisibleVendors(this.checked)" style="width:14px;height:14px;accent-color:var(--gold-h);cursor:pointer"></th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Proveedor':'Vendor'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Contacto':'Contact'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Presupuesto':'Budget'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Estado':'Status'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Pagado':'Paid'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${isES?'Pagos':'Payments'}</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
var _expandedVendorIds = [];
function toggleVendorExpand(vid){
  var idx = _expandedVendorIds.indexOf(vid);
  if(idx > -1) _expandedVendorIds.splice(idx, 1);
  else _expandedVendorIds.push(vid);
  var card = document.querySelector('.vmc[data-vid="'+vid+'"]');
  if(!card) return;
  card.classList.toggle('vmc-open', _expandedVendorIds.indexOf(vid) > -1);
}
function renderVendorMobileCards(vendors, tab){
  const isES = LANG==='es';
  if(!vendors.length) return `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${t(tab==='hired'?'no_hired_vendors':'no_comparison_vendors')}</div>`;
  return `<div class="mobile-section-toolbar">
      <div id="vendor-bulk-bar" class="mobile-inline-actions" style="display:${vendorSelectionCount()?'flex':'none'};padding:12px 14px;border:1px solid rgba(166,124,61,.28);border-radius:16px;background:var(--gold-l)">
        <span id="vendor-bulk-count" style="font-size:12px;font-weight:700;color:var(--gold-h)">${vendorSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
        <button class="btn btn-ghost btn-sm" onclick="openBulkVendorEditModal()">${isES?'Editar':'Edit'}</button>
        <button class="btn btn-danger btn-sm" onclick="bulkDeleteVendors()">${isES?'Eliminar':'Delete'}</button>
        <button class="btn btn-ghost btn-sm" onclick="clearVendorSelection()">${isES?'Limpiar':'Clear'}</button>
      </div>
      <div class="mobile-inline-actions">
        <label class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:8px">
          <input type="checkbox" id="vendor-chk-all" onchange="toggleAllVisibleVendors(this.checked)" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer">
          <span>${isES?'Seleccionar visibles':'Select visible'}</span>
        </label>
      </div>
    </div>
    <div class="mobile-card-list">
      ${vendors.map(function(v){
        var paid = (v.payments||[]).reduce(function(a,p){ return a+Number(p.amount); },0);
        var si = vendorStatusInfo(v);
        var isOpen = _expandedVendorIds.indexOf(v.id) > -1;
        var remaining = Math.max(0, Number(v.budget||0) - paid);
        var pct = v.budget > 0 ? Math.min(100, Math.round(paid / v.budget * 100)) : 0;
        return `<article class="vmc${isOpen?' vmc-open':''}" data-vid="${v.id}">
          <div class="vmc-summary" onclick="toggleVendorExpand('${v.id}')">
            <label class="vmc-chk" onclick="event.stopPropagation()">
              <input class="vendor-sel" type="checkbox" data-vid="${v.id}" ${isVendorSelected(v.id)?'checked':''} onchange="toggleVendorSelection('${v.id}', this.checked)">
            </label>
            <div class="vmc-info">
              <div class="vmc-name">${esc(v.name)}</div>
              <div class="vmc-row">
                <span class="vmc-badge" style="background:${si.bg};color:${si.clr}">${si.label}</span>
                <span class="vmc-money">${fmtMoney(v.budget)}</span>
                ${paid > 0 ? `<span class="vmc-paid">${fmtMoney(paid)} ${isES?'pagado':'paid'}</span>` : ''}
              </div>
            </div>
            <svg class="vmc-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="vmc-detail">
            <div class="vmc-progress-wrap">
              <div class="vmc-progress-bar"><div class="vmc-progress-fill" style="width:${pct}%"></div></div>
              <div class="vmc-progress-labels">
                <span>${isES?'Pagado':'Paid'}: ${fmtMoney(paid)}</span>
                <span>${isES?'Restante':'Remaining'}: ${fmtMoney(remaining)}</span>
              </div>
            </div>
            <div class="vmc-meta">
              ${v.category ? `<div class="vmc-meta-item"><span class="vmc-meta-label">${isES?'Categoría':'Category'}</span><span class="vmc-meta-value">${esc(v.category)}${v.subcategory?' · '+esc(v.subcategory):''}</span></div>` : ''}
              ${v.contact ? `<div class="vmc-meta-item"><span class="vmc-meta-label">${isES?'Contacto':'Contact'}</span><span class="vmc-meta-value">${esc(v.contact)}</span></div>` : ''}
              ${v.phone ? `<div class="vmc-meta-item"><span class="vmc-meta-label">${isES?'Teléfono':'Phone'}</span><span class="vmc-meta-value">${esc(v.phone)}</span></div>` : ''}
              ${(v.payments||[]).length ? `<div class="vmc-meta-item"><span class="vmc-meta-label">${isES?'Pagos':'Payments'}</span><span class="vmc-meta-value">${v.payments.length}</span></div>` : ''}
              ${v.notes ? `<div class="vmc-meta-item vmc-meta-full"><span class="vmc-meta-label">${isES?'Notas':'Notes'}</span><span class="vmc-meta-value">${esc(v.notes)}</span></div>` : ''}
            </div>
            <div class="vmc-status-row" onclick="event.stopPropagation()">
              <select class="select vmc-status-select" style="background:${si.bg};color:${si.clr}" onchange="setVendorStatus('${v.id}',this.value)">
                ${['pending','hired','in-progress','paid','cancelled'].map(function(s){
                  return `<option value="${s}"${(v.vendorStatus||(v.hired?'hired':'pending'))===s?' selected':''}>${{pending:isES?'Pendiente':'Pending',hired:isES?'Contratado':'Hired','in-progress':isES?'En Progreso':'In Progress',paid:isES?'Pagado':'Paid',cancelled:isES?'Cancelado':'Cancelled'}[s]}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="vmc-actions" onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-sm" onclick="showVendorDetail('${v.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${isES?'Ver':'View'}</button>
              <button class="btn btn-ghost btn-sm" onclick="openVendorModal('${v.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg> ${isES?'Editar':'Edit'}</button>
              <button class="btn btn-ghost btn-sm" onclick="dupVendor('${v.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${isES?'Duplicar':'Duplicate'}</button>
              <button class="btn btn-danger btn-sm" onclick="delV('${v.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg> ${isES?'Eliminar':'Delete'}</button>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>`;
}
function setVendorStatus(id, status){
  const p=proj(); const v=p.vendors.find(v=>v.id===id); if(!v) return;
  v.vendorStatus = status;
  v.hired = (status==='hired'||status==='in-progress'||status==='paid');
  saveProj(p); renderBudget();
}
function hireV(id){const p=proj();const v=p.vendors.find(v=>v.id===id);if(v){v.hired=true;v.vendorStatus='hired';saveProj(p);renderBudget();toast(LANG==='es'?'Proveedor contratado':'Vendor hired','s');}}
function unhireV(id){const p=proj();const v=p.vendors.find(v=>v.id===id);if(v){v.hired=false;v.vendorStatus='pending';saveProj(p);renderBudget();toast(LANG==='es'?'Proveedor movido a comparación':'Vendor moved to comparisons');}}
function delV(id){
  openConfirmModal({
    title: LANG==='es'?'Eliminar proveedor':'Delete vendor',
    message: LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    confirmLabel: LANG==='es'?'Eliminar':'Delete',
    onConfirm: function(){
      const p=proj();
      p.vendors=p.vendors.filter(v=>v.id!==id);
      vSelectedVendorIds=vSelectedVendorIds.filter(function(x){ return x!==id; });
      saveProj(p);renderBudget();toast(LANG==='es'?'Proveedor eliminado':'Vendor deleted');
    }
  });
}
function openBulkVendorEditModal(){
  if(!vendorSelectionCount()) return toast(LANG==='es'?'Selecciona al menos un proveedor':'Select at least one vendor','e');
  const isES = LANG==='es';
  openMo(`<div class="mo-title">${isES?'Editar proveedores seleccionados':'Edit selected vendors'}</div>
  <div class="form-grid">
    <div class="ig"><label>${isES?'Estado':'Status'}</label>
      <select class="select" id="bulk-vendor-status">
        <option value="">${isES?'Sin cambios':'No change'}</option>
        <option value="pending">${isES?'Pendiente':'Pending'}</option>
        <option value="hired">${isES?'Contratado':'Hired'}</option>
        <option value="in-progress">${isES?'En Progreso':'In Progress'}</option>
        <option value="paid">${isES?'Pagado':'Paid'}</option>
        <option value="cancelled">${isES?'Cancelado':'Cancelled'}</option>
      </select>
    </div>
    <div class="ig"><label>${isES?'Presupuesto':'Budget'}</label><input class="input" id="bulk-vendor-budget" type="number" placeholder="${isES?'Sin cambios':'No change'}"></div>
    <div class="ig" style="grid-column:1/-1"><label>${isES?'Notas':'Notes'}</label><textarea class="textarea" id="bulk-vendor-notes" rows="3" placeholder="${isES?'Dejar en blanco para no cambiar':'Leave blank to keep current notes'}"></textarea></div>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-primary" onclick="applyBulkVendorEdit()">${isES?'Guardar cambios':'Save changes'}</button>
  </div>`);
}
function applyBulkVendorEdit(){
  if(!vendorSelectionCount()) return closeMo();
  const p = proj();
  const status = gv('bulk-vendor-status');
  const budgetEl = document.getElementById('bulk-vendor-budget');
  const notesEl = document.getElementById('bulk-vendor-notes');
  const budgetRaw = budgetEl ? budgetEl.value.trim() : '';
  const notes = notesEl ? notesEl.value : '';
  p.vendors.forEach(function(v){
    if(vSelectedVendorIds.indexOf(v.id)===-1) return;
    if(status){
      v.vendorStatus = status;
      v.hired = (status==='hired'||status==='in-progress'||status==='paid');
    }
    if(budgetRaw!=='') v.budget = +budgetRaw || 0;
    if(notes.trim()!=='') v.notes = notes;
  });
  saveProj(p);
  closeMo();
  renderBudget();
  toast(LANG==='es'?'Proveedores actualizados':'Vendors updated','s');
}
function bulkDeleteVendors(){
  if(!vendorSelectionCount()) return;
  openConfirmModal({
    title: LANG==='es'?'Eliminar proveedores':'Delete vendors',
    message: LANG==='es'?'¿Eliminar los proveedores seleccionados?':'Delete selected vendors?',
    onConfirm: function(){
      const p = proj();
      p.vendors = p.vendors.filter(function(v){ return vSelectedVendorIds.indexOf(v.id)===-1; });
      vSelectedVendorIds = [];
      saveProj(p); renderBudget();
      toast(LANG==='es'?'Proveedores eliminados':'Vendors deleted','s');
    }
  });
}
function dupVendor(id){
  const p=proj(); const v=p.vendors.find(v=>v.id===id); if(!v) return;
  const copy=JSON.parse(JSON.stringify(v));
  copy.id='v'+Date.now();
  copy.name=(v.name||'Vendor')+' (Copy)';
  copy.payments=(copy.payments||[]).map(function(pay,idx){
    pay.id='p'+Date.now()+idx;
    return pay;
  });
  p.vendors.push(copy);
  saveProj(p); renderBudget(); toast(LANG==='es'?'Proveedor duplicado':'Vendor duplicated','s');
}
function delPay(vid,pid){const p=proj();const v=p.vendors.find(v=>v.id===vid);if(v){var removed=v.payments.find(function(pay){return pay.id===pid;});if(removed&&removed.receiptStorageId){EVENTOS_DATA.deleteFile(removed.receiptStorageId).catch(function(){});}v.payments=v.payments.filter(pay=>pay.id!==pid);saveProj(p);renderBudget();toast(LANG==='es'?'Pago eliminado':'Payment deleted');}}
function viewReceipt(vid,pid){
  const p=proj();const v=p.vendors.find(v=>v.id===vid);const pay=v?.payments?.find(pay=>pay.id===pid);
  if(pay?.receipt)openMo(`<div class="mo-title">${esc(LANG==='es'?'Comprobante':'Receipt')}</div><img src="${pay.receipt}" alt="${esc(LANG==='es'?'Comprobante de pago':'Payment receipt')}" style="width:100%;border-radius:8px"><div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">${t('close')}</button></div>`);
}

function openVendorModal(vid){
  const p=proj();const v=vid?p.vendors.find(x=>x.id===vid):null;
  const isES=LANG==='es';
  const titleRow = v
    ? `<div class="mo-title">${t('edit_vendor')}</div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div class="mo-title" style="margin:0">${t('add_vendor')}</div>
        <button class="btn btn-ghost btn-sm" onclick="libQuickLoadVendors()" style="font-size:11px;display:flex;align-items:center;gap:5px">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span id="lib-load-vendor-lbl">${isES?'CARGAR':'LOAD'}</span>
        </button>
      </div>`;
  openMo(`${titleRow}
  <div class="form-grid">
    <div class="ig" style="grid-column:1/-1"><label>${t('vendor_name_lbl')} *</label><input class="input" id="vn-name" value="${esc(v?.name||'')}" placeholder="${t('vendor_name_lbl')}"></div>
    
    <div class="ig" style="grid-column:1/-1"><label>${t('services_lbl')}</label><input class="input" id="vn-svc" value="${esc(v?.services||'')}" placeholder="Describe services..."></div>
    <div class="ig"><label>${t('contact_email')}</label><input class="input" id="vn-email" type="email" value="${esc(v?.contact||'')}" placeholder="vendor@email.com"></div>
    <div class="ig"><label>${t('phone')}</label><input class="input" id="vn-phone" value="${esc(v?.phone||'')}" placeholder="555-0000"></div>
    <div class="ig"><label>${t('budget_field')}</label><input class="input" id="vn-budget" type="number" value="${v?.budget||''}" placeholder="0"></div>
    <div class="ig"><label>${t('vendor_status')}</label><select class="select" id="vn-hired"><option value="0"${!v?.hired?' selected':''}>${t('comparison')}</option><option value="1"${v?.hired?' selected':''}>${t('hired')}</option></select></div>
    <div class="ig" style="grid-column:1/-1"><label>${t('notes')}</label><textarea class="textarea" id="vn-notes" rows="2" placeholder="Additional notes...">${esc(v?.notes||'')}</textarea></div>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-primary" onclick="saveVendor('${vid||''}')">${t('save_vendor')}</button>
  </div>`);
}
function saveVendor(vid){
  const name=gv('vn-name');if(!name)return toast(LANG==='es'?'El nombre es requerido':'Name required','e');
  const p=proj();
  const hiredVal=gv('vn-hired')==='1';
  const data={name,services:gv('vn-svc'),contact:gv('vn-email'),phone:gv('vn-phone'),budget:+gv('vn-budget')||0,hired:hiredVal,vendorStatus:hiredVal?'hired':'pending',notes:gv('vn-notes')};
  if(vid){const v=p.vendors.find(v=>v.id===vid);if(v) Object.assign(v,data);}
  else{
    const newV={id:'v'+Date.now(),payments:[],...data};
    if(!p.vendors) p.vendors=[];
    p.vendors.push(newV);
    autoSyncVendorToGlobal(newV);
  }
  saveProj(p);closeMo();renderBudget();toast(vid?'Vendor updated':'Vendor added','s');
}
function autoSyncVendorToGlobal(v){
  try {
    const lib=getLib();
    if(!lib||!Array.isArray(lib.vendors)) return;
    const exists=lib.vendors.some(e=>e.vendors&&e.vendors.some(lv=>lv.name.toLowerCase()===v.name.toLowerCase()));
    if(!exists){
      lib.vendors.push({id:'lv'+Date.now(),name:v.name,date:formatDMY(today()),vendors:[JSON.parse(JSON.stringify(v))]});
      saveLib(lib);
    }
  } catch(e){ console.warn('EventOS: autoSyncVendorToGlobal failed', e); }
}
function openPayModal(vid){
  _paySubmitting=false; // Reset in case previous modal was closed mid-upload
  openMo(`<div class="mo-title">${t('add_payment')}</div>
  <div class="ig" style="margin-bottom:12px"><label>${t('amount_field')} *</label><input class="input" id="pay-amt" type="number" placeholder="0.00"></div>
  <div class="ig" style="margin-bottom:12px"><label>${t('date_field')}</label>
    <div class="date-field">
      <input class="input date-field-input" type="text" id="pay-date" value="${formatDMY(today())}" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker('pay-date')" onfocus="openCalendarPicker('pay-date')">
      <button type="button" class="date-field-btn" onclick="openCalendarPicker('pay-date')" aria-label="${t('date_field')}"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></button>
    </div>
  </div>
  <div class="ig" style="margin-bottom:12px"><label>${t('note_field')}</label><input class="input" id="pay-note" placeholder="e.g. Deposit, Final payment"></div>
  <div class="ig" style="margin-bottom:12px">
    <label>Receipt / Proof of Payment</label>
    <div class="upload-area" onclick="document.getElementById('pay-file').click()">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 8px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p style="font-size:13px">${t('upload_receipt')}</p>
    </div>
    <input type="file" id="pay-file" accept="image/*" class="hidden" onchange="previewPay(this)">
    <img id="pay-prev" class="hidden" alt="${esc(LANG==='es'?'Vista previa del comprobante':'Receipt preview')}" style="margin-top:10px;max-height:120px;border-radius:8px;border:1px solid var(--border)">
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-success" onclick="savePay('${vid}')">${t('add_payment_save')}</button>
  </div>`);
}
var _payReceiptFile=null;
function previewPay(input){
  const f=input.files[0];if(!f)return;
  if(f.size > 5*1024*1024){toast(LANG==='es'?'El recibo es muy grande (máx. 5 MB)':'Receipt too large (max 5MB)','e');return;}
  _payReceiptFile=f;
  const r=new FileReader();r.onload=e=>{const img=document.getElementById('pay-prev');img.src=e.target.result;img.classList.remove('hidden');};r.readAsDataURL(f);
}
var _paySubmitting=false;
async function savePay(vid){
  if(_paySubmitting) return; // Prevent double-submit during upload
  const amt=+gv('pay-amt');if(!amt)return toast(LANG==='es'?'Ingresa un monto válido':'Enter a valid amount','e');
  _paySubmitting=true;
  // Disable submit button visually
  var submitBtn=document.querySelector('.mo-foot .btn-success');
  if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent=t('saving'); }
  const p=proj();const v=p.vendors.find(v=>v.id===vid);
  if(!v){_paySubmitting=false;toast(LANG==='es'?'Proveedor no encontrado':'Vendor not found','e');return;}
  if(!v.payments) v.payments=[];
  const img=document.getElementById('pay-prev');
  var receiptUrl=null, receiptStorageId=null;
  if(img&&!img.classList.contains('hidden') && _payReceiptFile){
    try{
      toast(t('uploading'));
      receiptStorageId = await EVENTOS_DATA.uploadFile(_payReceiptFile);
      receiptUrl = await EVENTOS_DATA.getFileUrl(receiptStorageId);
    }catch(e){console.error('Receipt upload error:',e);toast(t('err_upload_failed'),'e');_paySubmitting=false;if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=t('add_payment_save');}return;}
  }
  v.payments.push({id:'p'+Date.now(),amount:amt,date:parseUserDate(gv('pay-date'))||today(),note:gv('pay-note'),receipt:receiptUrl,receiptStorageId:receiptStorageId});
  _payReceiptFile=null;
  _paySubmitting=false;
  saveProj(p);closeMo();renderBudget();toast(LANG==='es'?'Pago registrado':'Payment recorded','s');
}
function showVendorDetail(vid){
  const p=proj(); const v=p.vendors.find(v=>v.id===vid); if(!v) return;
  if(!v.payments) v.payments=[];
  const isES=LANG==='es';
  const paid=v.payments.reduce((a,py)=>a+Number(py.amount),0);
  const pct=v.budget>0?Math.min(100,Math.round(paid/v.budget*100)):0;
  const si=vendorStatusInfo(v);
  const payRows=v.payments.length?v.payments.map(pay=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bg)">
      <div>
        <div style="font-size:13px;font-weight:600">${fmtMoney(pay.amount)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${pay.note||''} · ${pay.date?fmtDate(pay.date):''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${pay.receipt?`<button class="btn btn-ghost btn-sm" onclick="viewReceipt('${v.id}','${pay.id}')">${t('receipt_btn')}</button>`:''}
        <button class="btn btn-danger btn-sm btn-icon" onclick="delPay('${v.id}','${pay.id}');closeMo();showVendorDetail('${v.id}')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div>
    </div>`).join(''):`<div style="font-size:12px;color:var(--light);padding:12px 0">${isES?'Sin pagos registrados':'No payments recorded'}</div>`;
  openMo(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <div style="font-size:20px;font-weight:700">${esc(v.name)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:3px">${esc(v.category||'')}${v.subcategory?' &middot; '+esc(v.subcategory):''}</div>
      </div>
      <span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;background:${si.bg};color:${si.clr}">${si.label}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:var(--bg);border-radius:var(--r);padding:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:4px">${isES?'Presupuesto':'Budget'}</div>
        <div style="font-size:18px;font-weight:700;color:var(--gold-h)">${fmtMoney(v.budget)}</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--r);padding:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:4px">${isES?'Total Pagado':'Total Paid'}</div>
        <div style="font-size:18px;font-weight:700;color:var(--success)">${fmtMoney(paid)}</div>
      </div>
    </div>
    ${v.budget>0?`<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>${isES?'Progreso de pago':'Payment progress'}</span><span>${pct}%</span></div>
      <div class="prog"><div class="prog-f" style="width:${pct}%;background:var(--success)"></div></div>
    </div>`:''}
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px">
      ${v.contact?`<tr><td style="padding:7px 0;color:var(--muted);width:110px;font-weight:600">${isES?'Email':'Email'}</td><td style="padding:7px 0">${esc(v.contact)}</td></tr>`:''}
      ${v.phone?`<tr><td style="padding:7px 0;color:var(--muted);font-weight:600">${isES?'Teléfono':'Phone'}</td><td style="padding:7px 0">${esc(v.phone)}</td></tr>`:''}
      ${v.services?`<tr><td style="padding:7px 0;color:var(--muted);font-weight:600;vertical-align:top">${isES?'Servicios':'Services'}</td><td style="padding:7px 0">${esc(v.services)}</td></tr>`:''}
      ${v.notes?`<tr><td style="padding:7px 0;color:var(--muted);font-weight:600;vertical-align:top">${isES?'Notas':'Notes'}</td><td style="padding:7px 0;font-style:italic;color:var(--muted)">${esc(v.notes)}</td></tr>`:''}
    </table>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">${isES?'Historial de Pagos':'Payment History'}</div>
    ${payRows}
    <div class="mo-foot" style="margin-top:16px">
      <button class="btn btn-ghost" onclick="closeMo()">${t('close')}</button>
      <button class="btn btn-ghost btn-sm" onclick="closeMo();openPayModal('${v.id}')">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> ${isES?'Agregar Pago':'Add Payment'}
      </button>
      <button class="btn btn-primary" onclick="closeMo();openVendorModal('${vid}')">${isES?'Editar':'Edit'}</button>
    </div>`);
}

var tView='list';
// priority: 'critical' | 'important' | 'optional'
// requiresService: skip task entirely if user says they don't need this service
//   values: 'venue_search','catering','av','decor','photo','entertainment','transport','permits','seating'
// completedIfDone: pre-mark task as completed based on setup answer
//   values: 'venue_booked','venue_contract','save_the_date','invitations',
//           'guest_list_started','guest_list_finalized','vendor_contracts'
// skipIfDone: skip task entirely (don't include in plan) based on setup answer
//   values: 'save_the_date','invitations'
var TEMPLATE_PLAN_TASKS = [
  { title:'Define Event Goals', title_es:'Definir Objetivos del Evento', desc:'Establish the purpose, success criteria, guest profile, style, and main priorities of the event.', desc_es:'Establecer el propósito, criterios de éxito, perfil de invitados, estilo y prioridades principales del evento.', durationDays:5, assignee:'Client / Event Lead', assignee_es:'Cliente / Líder de Evento', planningWindow:'12 months before', priority:'critical' },
  { title:'Set Preliminary Budget', title_es:'Establecer Presupuesto Preliminar', desc:'Define an initial budget range, spending priorities, and contingency allowance.', desc_es:'Definir un rango de presupuesto inicial, prioridades de gasto y margen de contingencia.', durationDays:4, assignee:'Client / Finance Lead', assignee_es:'Cliente / Responsable Financiero', planningWindow:'12 months before', priority:'critical' },
  { title:'Create Planning Team', title_es:'Formar Equipo de Planificación', desc:'Assign internal stakeholders, decision-makers, and operational support roles.', desc_es:'Asignar partes interesadas, tomadores de decisiones y roles de apoyo operativo.', durationDays:3, assignee:'Event Lead', assignee_es:'Líder de Evento', planningWindow:'12 months before', priority:'important' },
  { title:'Define Event Scope', title_es:'Definir Alcance del Evento', desc:'Confirm approximate guest count, event format, duration, program needs, and service level.', desc_es:'Confirmar número aproximado de invitados, formato del evento, duración, necesidades del programa y nivel de servicio.', durationDays:5, assignee:'Event Lead / Client', assignee_es:'Líder de Evento / Cliente', planningWindow:'11-12 months before', priority:'critical' },
  { title:'Build Master Timeline', title_es:'Crear Cronograma General', desc:'Create the overall planning schedule with milestones, dependencies, and deadlines.', desc_es:'Elaborar el calendario de planificación general con hitos, dependencias y fechas clave.', durationDays:3, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'11-12 months before', priority:'important' },
  { title:'Research Venue Options', title_es:'Investigar Opciones de Sede', desc:'Identify and compare venues or host locations that fit capacity, budget, logistics, and style.', desc_es:'Identificar y comparar sedes o lugares que se ajusten a la capacidad, presupuesto, logística y estilo.', durationDays:10, assignee:'Venue Coordinator', assignee_es:'Coordinador de Sede', planningWindow:'11 months before', priority:'critical', requiresService:'venue_search' },
  { title:'Site Visits / Venue Tours', title_es:'Visitas al Lugar / Recorridos de Sede', desc:'Visit shortlisted venues or review virtual walkthroughs and operational requirements.', desc_es:'Visitar las sedes preseleccionadas o revisar recorridos virtuales y requisitos operativos.', durationDays:7, assignee:'Client / Planner / Venue Coordinator', assignee_es:'Cliente / Organizador / Coordinador de Sede', planningWindow:'11 months before', priority:'important', requiresService:'venue_search' },
  { title:'Select Venue', title_es:'Seleccionar Sede', desc:'Choose the final venue based on fit, cost, availability, and operational practicality.', desc_es:'Elegir la sede final según adecuación, costo, disponibilidad y practicidad operativa.', durationDays:4, assignee:'Client / Event Lead', assignee_es:'Cliente / Líder de Evento', planningWindow:'10-11 months before', priority:'critical', requiresService:'venue_search' },
  { title:'Secure Venue Contract', title_es:'Asegurar Contrato de Sede', desc:'Finalize agreement, review terms, and submit deposit or reservation requirements.', desc_es:'Finalizar el acuerdo, revisar términos y presentar depósito o requisitos de reserva.', durationDays:5, assignee:'Client / Finance Lead', assignee_es:'Cliente / Responsable Financiero', planningWindow:'10-11 months before', priority:'critical', completedIfDone:'venue_contract' },
  { title:'Define Event Theme / Creative Direction', title_es:'Definir Tema / Dirección Creativa', desc:'Establish the visual and experiential direction, mood, branding, and design references.', desc_es:'Establecer la dirección visual y experiencial, ambiente, identidad de marca y referencias de diseño.', durationDays:7, assignee:'Creative Lead / Client', assignee_es:'Líder Creativo / Cliente', planningWindow:'10 months before', priority:'important' },
  { title:'Create Initial Guest List', title_es:'Crear Lista Inicial de Invitados', desc:'Draft a first-pass attendee list, categories, and target attendance ranges.', desc_es:'Elaborar una primera lista de asistentes, categorías y rangos de asistencia objetivo.', durationDays:6, assignee:'Client / Guest Coordinator', assignee_es:'Cliente / Coordinador de Invitados', planningWindow:'10 months before', priority:'critical', completedIfDone:'guest_list_started' },
  { title:'Identify Key Vendors', title_es:'Identificar Proveedores Clave', desc:'Build a shortlist of core vendors such as catering, production, decor, AV, entertainment, photography, or staffing.', desc_es:'Crear una lista corta de proveedores principales como catering, producción, decoración, AV, entretenimiento, fotografía o personal.', durationDays:8, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'9-10 months before', priority:'critical' },
  { title:'Request Vendor Proposals', title_es:'Solicitar Propuestas a Proveedores', desc:'Send requirements and obtain quotes, capabilities, and availability from vendors.', desc_es:'Enviar requisitos y obtener cotizaciones, capacidades y disponibilidad de los proveedores.', durationDays:7, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'9-10 months before', priority:'important' },
  { title:'Select Catering / Food Service', title_es:'Seleccionar Catering / Servicio de Alimentos', desc:'Confirm food and beverage partner or service approach for the event.', desc_es:'Confirmar el proveedor de alimentos y bebidas o el enfoque de servicio para el evento.', durationDays:6, assignee:'Client / Catering Coordinator', assignee_es:'Cliente / Coordinador de Catering', planningWindow:'9 months before', priority:'important', requiresService:'catering', completedIfDone:'vendor_contracts' },
  { title:'Select Production / Technical Vendor', title_es:'Seleccionar Proveedor Técnico / de Producción', desc:'Confirm AV, lighting, staging, power, or technical support provider if needed.', desc_es:'Confirmar proveedor de AV, iluminación, escenario, energía o soporte técnico si es necesario.', durationDays:6, assignee:'Production Lead', assignee_es:'Líder de Producción', planningWindow:'9 months before', priority:'important', requiresService:'av', completedIfDone:'vendor_contracts' },
  { title:'Select Decor / Design Vendor', title_es:'Seleccionar Proveedor de Decoración / Diseño', desc:'Confirm vendor for florals, decor, furniture, styling, signage, or experience design.', desc_es:'Confirmar proveedor de flores, decoración, mobiliario, estilismo, señalética o diseño de experiencia.', durationDays:6, assignee:'Design Lead', assignee_es:'Líder de Diseño', planningWindow:'9 months before', priority:'important', requiresService:'decor', completedIfDone:'vendor_contracts' },
  { title:'Select Photo / Video Coverage', title_es:'Seleccionar Fotografía / Cobertura de Video', desc:'Confirm documentation team for photography, videography, or content capture.', desc_es:'Confirmar equipo de documentación para fotografía, videografía o captura de contenido.', durationDays:4, assignee:'Client / Planner', assignee_es:'Cliente / Organizador', planningWindow:'9 months before', priority:'important', requiresService:'photo', completedIfDone:'vendor_contracts' },
  { title:'Build Event Layout Plan', title_es:'Elaborar Plan de Distribución del Evento', desc:'Draft the event layout including guest flow, focal points, seating zones, vendor areas, and service spaces.', desc_es:'Diseñar la disposición del evento incluyendo flujo de invitados, puntos focales, zonas de mesas, áreas de proveedores y espacios de servicio.', durationDays:7, assignee:'Planner / Layout Designer', assignee_es:'Organizador / Diseñador de Layout', planningWindow:'8-9 months before', priority:'important' },
  { title:'Launch Branding / Invitations Concept', title_es:'Lanzar Concepto de Marca / Invitaciones', desc:'Develop invitation style, event identity, guest-facing graphics, and communication design.', desc_es:'Desarrollar el estilo de invitación, identidad del evento, gráficos y diseño de comunicación para los invitados.', durationDays:8, assignee:'Creative Lead', assignee_es:'Líder Creativo', planningWindow:'8 months before', priority:'important', skipIfDone:'invitations' },
  { title:'Confirm Entertainment / Speakers', title_es:'Confirmar Entretenimiento / Ponentes', desc:'Book performers, MC, host, speakers, or presentation participants.', desc_es:'Contratar artistas, MC, presentador, oradores o participantes de presentaciones.', durationDays:5, assignee:'Program Lead', assignee_es:'Líder de Programa', planningWindow:'8 months before', priority:'important', requiresService:'entertainment', completedIfDone:'vendor_contracts' },
  { title:'Establish Registration / RSVP Method', title_es:'Establecer Método de Registro / RSVP', desc:'Set up RSVP tracking, registration workflow, or attendee data collection process.', desc_es:'Configurar seguimiento de RSVP, flujo de registro o proceso de recopilación de datos de asistentes.', durationDays:4, assignee:'Admin / Guest Coordinator', assignee_es:'Administrador / Coordinador de Invitados', planningWindow:'8 months before', priority:'important' },
  { title:'Review Logistics Requirements', title_es:'Revisar Requisitos Logísticos', desc:'Identify power, load-in, parking, permits, storage, accessibility, transportation, and venue restrictions.', desc_es:'Identificar energía, carga, estacionamiento, permisos, almacenamiento, accesibilidad, transporte y restricciones de sede.', durationDays:6, assignee:'Operations Lead', assignee_es:'Líder de Operaciones', planningWindow:'7-8 months before', priority:'important' },
  { title:'Send Save-the-Date / Early Notice', title_es:'Enviar Save-the-Date / Aviso Anticipado', desc:'Notify attendees of the event date early enough to support attendance planning.', desc_es:'Notificar a los asistentes sobre la fecha del evento con suficiente anticipación para apoyar su asistencia.', durationDays:3, assignee:'Guest Coordinator', assignee_es:'Coordinador de Invitados', planningWindow:'7 months before', priority:'important', skipIfDone:'save_the_date' },
  { title:'Finalize Core Vendor Contracts', title_es:'Finalizar Contratos con Proveedores Clave', desc:'Confirm scope, timing, and payment terms with all major vendors.', desc_es:'Confirmar alcance, tiempos y condiciones de pago con todos los proveedores principales.', durationDays:10, assignee:'Event Planner / Client', assignee_es:'Organizador de Evento / Cliente', planningWindow:'7 months before', priority:'critical', completedIfDone:'vendor_contracts' },
  { title:'Develop Detailed Budget Tracker', title_es:'Desarrollar Seguimiento de Presupuesto Detallado', desc:'Turn the preliminary budget into a line-by-line tracked budget with committed and projected costs.', desc_es:'Convertir el presupuesto preliminar en un seguimiento detallado línea por línea con costos comprometidos y proyectados.', durationDays:4, assignee:'Finance Lead', assignee_es:'Responsable Financiero', planningWindow:'6-7 months before', priority:'important' },
  { title:'Create Initial Run of Show', title_es:'Crear Guion de Evento Inicial', desc:'Draft the high-level sequence of the event including arrivals, presentations, meals, activations, and wrap-up.', desc_es:'Elaborar la secuencia general del evento incluyendo llegadas, presentaciones, comidas, activaciones y cierre.', durationDays:5, assignee:'Event Planner / Program Lead', assignee_es:'Organizador de Evento / Líder de Programa', planningWindow:'6 months before', priority:'critical' },
  { title:'Confirm Rentals / Furniture Needs', title_es:'Confirmar Alquileres / Necesidades de Mobiliario', desc:'Define tables, chairs, lounge pieces, linens, bars, structures, staging, and other rental needs.', desc_es:'Definir mesas, sillas, piezas de lounge, manteles, barras, estructuras, escenario y otros alquileres necesarios.', durationDays:6, assignee:'Design Lead / Planner', assignee_es:'Líder de Diseño / Organizador', planningWindow:'6 months before', priority:'important' },
  { title:'Start Guest Communication Plan', title_es:'Iniciar Plan de Comunicación con Invitados', desc:'Plan attendee messaging cadence, reminders, information emails, or printed notices.', desc_es:'Planificar la cadencia de mensajes para asistentes, recordatorios, correos informativos o avisos impresos.', durationDays:4, assignee:'Communications Lead', assignee_es:'Líder de Comunicaciones', planningWindow:'6 months before', priority:'important' },
  { title:'Review Menu / Experience Options', title_es:'Revisar Opciones de Menú / Experiencia', desc:'Evaluate and refine menu selections, service style, dietary considerations, and guest experience details.', desc_es:'Evaluar y refinar selecciones de menú, estilo de servicio, consideraciones dietéticas y detalles de experiencia del invitado.', durationDays:5, assignee:'Client / Catering Coordinator', assignee_es:'Cliente / Coordinador de Catering', planningWindow:'5-6 months before', priority:'optional', requiresService:'catering' },
  { title:'Begin Permit / Approval Process', title_es:'Iniciar Proceso de Permisos / Aprobaciones', desc:'Obtain any permits, certificates, insurance documents, or venue approvals required.', desc_es:'Obtener los permisos, certificados, documentos de seguro o aprobaciones de sede requeridos.', durationDays:15, assignee:'Operations Lead', assignee_es:'Líder de Operaciones', planningWindow:'5 months before', priority:'important', requiresService:'permits' },
  { title:'Confirm Accommodation / Travel Needs', title_es:'Confirmar Necesidades de Hospedaje / Traslados', desc:'Coordinate lodging blocks, travel support, parking plans, or transportation logistics as needed.', desc_es:'Coordinar bloques de alojamiento, apoyo de viaje, planes de estacionamiento o logística de transporte según sea necesario.', durationDays:7, assignee:'Logistics Coordinator', assignee_es:'Coordinador Logístico', planningWindow:'5 months before', priority:'optional', requiresService:'transport' },
  { title:'Finalize Design Concept', title_es:'Finalizar Concepto de Diseño', desc:'Lock in decor, styling, visual details, branded elements, and environmental design direction.', desc_es:'Confirmar decoración, estilismo, detalles visuales, elementos de marca y dirección de diseño ambiental.', durationDays:7, assignee:'Creative Lead / Client', assignee_es:'Líder Creativo / Cliente', planningWindow:'4-5 months before', priority:'important', requiresService:'decor' },
  { title:'Produce Invitation / Registration Materials', title_es:'Producir Invitaciones / Materiales de Registro', desc:'Prepare final invites, digital registration assets, event website copy, or guest information materials.', desc_es:'Preparar invitaciones finales, recursos digitales de registro, texto del sitio web del evento o materiales informativos para invitados.', durationDays:8, assignee:'Creative Lead / Admin', assignee_es:'Líder Creativo / Administrador', planningWindow:'4 months before', priority:'important', skipIfDone:'invitations' },
  { title:'Send Invitations / Open Registration', title_es:'Enviar Invitaciones / Abrir Registro', desc:'Launch the formal invitation or registration process and begin response tracking.', desc_es:'Lanzar el proceso formal de invitación o registro y comenzar el seguimiento de respuestas.', durationDays:3, assignee:'Guest Coordinator', assignee_es:'Coordinador de Invitados', planningWindow:'4 months before', priority:'critical', skipIfDone:'invitations' },
  { title:'Confirm Staffing Requirements', title_es:'Confirmar Necesidades de Personal', desc:'Determine event-day staffing such as coordinators, hosts, registration, security, catering support, and technical crew.', desc_es:'Determinar el personal para el día del evento: coordinadores, anfitriones, registro, seguridad, apoyo de catering y equipo técnico.', durationDays:5, assignee:'Operations Lead', assignee_es:'Líder de Operaciones', planningWindow:'4 months before', priority:'important' },
  { title:'Refine Guest List', title_es:'Depurar Lista de Invitados', desc:'Update attendee list based on priorities, targets, response expectations, and internal approvals.', desc_es:'Actualizar la lista de asistentes según prioridades, objetivos, expectativas de respuesta y aprobaciones internas.', durationDays:6, assignee:'Client / Guest Coordinator', assignee_es:'Cliente / Coordinador de Invitados', planningWindow:'3-4 months before', priority:'important', completedIfDone:'guest_list_finalized' },
  { title:'Midpoint Planning Review', title_es:'Revisión de Planificación a Mitad del Proceso', desc:'Review status of budget, RSVPs, vendors, design, and unresolved decisions.', desc_es:'Revisar estado del presupuesto, RSVPs, proveedores, diseño y decisiones pendientes.', durationDays:2, assignee:'Event Lead / Client', assignee_es:'Líder de Evento / Cliente', planningWindow:'3 months before', priority:'important' },
  { title:'Finalize Program Content', title_es:'Finalizar Contenido del Programa', desc:'Confirm presentations, speeches, entertainment flow, session timing, or key experience moments.', desc_es:'Confirmar presentaciones, discursos, flujo de entretenimiento, tiempos de sesiones o momentos clave de experiencia.', durationDays:7, assignee:'Program Lead', assignee_es:'Líder de Programa', planningWindow:'3 months before', priority:'important' },
  { title:'Review Layout and Floor Plan', title_es:'Revisar Distribución y Plano del Evento', desc:'Update the floor plan using current attendance projections and vendor requirements.', desc_es:'Actualizar el plano del evento con las proyecciones de asistencia actuales y requisitos de proveedores.', durationDays:5, assignee:'Planner / Layout Designer', assignee_es:'Organizador / Diseñador de Layout', planningWindow:'3 months before', priority:'important' },
  { title:'Order Signage / Printed Materials', title_es:'Pedir Señalética / Materiales Impresos', desc:'Submit signage, menus, programs, badges, labels, or other printed materials.', desc_es:'Solicitar señalética, menús, programas, credenciales, etiquetas u otros materiales impresos.', durationDays:6, assignee:'Creative Lead', assignee_es:'Líder Creativo', planningWindow:'3 months before', priority:'optional' },
  { title:'Conduct Vendor Alignment Meeting', title_es:'Realizar Reunión de Alineación con Proveedores', desc:'Bring all main vendors into one planning review to confirm expectations and responsibilities.', desc_es:'Reunir a los proveedores principales en una revisión de planificación para confirmar expectativas y responsabilidades.', durationDays:2, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'2-3 months before', priority:'important' },
  { title:'Track RSVP Progress', title_es:'Seguimiento de RSVPs', desc:'Review open responses, send reminders, and identify attendance gaps or overages.', desc_es:'Revisar respuestas pendientes, enviar recordatorios e identificar brechas o excesos en la asistencia.', durationDays:10, assignee:'Guest Coordinator', assignee_es:'Coordinador de Invitados', planningWindow:'2 months before', priority:'critical' },
  { title:'Confirm Transportation / Access Plan', title_es:'Confirmar Plan de Transporte / Acceso', desc:'Finalize arrival, unloading, valet, shuttle, parking, and guest movement logistics.', desc_es:'Finalizar logística de llegada, descarga, valet, shuttle, estacionamiento y movimiento de invitados.', durationDays:4, assignee:'Logistics Coordinator', assignee_es:'Coordinador Logístico', planningWindow:'2 months before', priority:'optional', requiresService:'transport' },
  { title:'Review Risk & Contingency Plans', title_es:'Revisar Planes de Riesgo y Contingencia', desc:'Prepare backup plans for weather, delays, technical issues, staffing problems, and supply gaps.', desc_es:'Preparar planes de respaldo para clima, retrasos, problemas técnicos, dificultades de personal y falta de suministros.', durationDays:4, assignee:'Operations Lead', assignee_es:'Líder de Operaciones', planningWindow:'2 months before', priority:'important' },
  { title:'Finalize Seating / Zoning Strategy', title_es:'Finalizar Estrategia de Distribución / Zonas', desc:'Assign tables, zones, sections, or attendee placement if the event requires structured placement.', desc_es:'Asignar mesas, zonas, secciones o ubicación de asistentes si el evento requiere distribución estructurada.', durationDays:8, assignee:'Guest Coordinator / Planner', assignee_es:'Coordinador de Invitados / Organizador', planningWindow:'6-8 weeks before', priority:'important', requiresService:'seating' },
  { title:'Confirm Equipment and Rental Counts', title_es:'Confirmar Cantidades de Equipos y Alquileres', desc:'Lock in updated counts for furniture, AV, decor, tableware, or production equipment.', desc_es:'Confirmar cantidades actualizadas de mobiliario, AV, decoración, vajilla o equipos de producción.', durationDays:5, assignee:'Planner / Production Lead', assignee_es:'Organizador / Líder de Producción', planningWindow:'6 weeks before', priority:'important' },
  { title:'Finalize Menu Counts / Service Plan', title_es:'Finalizar Conteos de Menú / Plan de Servicio', desc:'Confirm headcount assumptions and service timing with catering or hospitality teams.', desc_es:'Confirmar supuestos de número de personas y tiempos de servicio con los equipos de catering u hospitalidad.', durationDays:4, assignee:'Catering Coordinator', assignee_es:'Coordinador de Catering', planningWindow:'6 weeks before', priority:'important', requiresService:'catering' },
  { title:'Review Event Script / Cue Sheet', title_es:'Revisar Guion / Hoja de Señales del Evento', desc:'Build a detailed timing document with cues, handoffs, transitions, and responsibilities.', desc_es:'Elaborar un documento detallado con señales, traspasos, transiciones y responsabilidades.', durationDays:5, assignee:'Program Lead / Planner', assignee_es:'Líder de Programa / Organizador', planningWindow:'5-6 weeks before', priority:'important' },
  { title:'Final Guest List Review', title_es:'Revisión Final de Lista de Invitados', desc:'Reconcile confirmed attendees, VIPs, special accommodations, and no-response follow-up.', desc_es:'Conciliar asistentes confirmados, VIPs, necesidades especiales y seguimiento a quienes no respondieron.', durationDays:5, assignee:'Guest Coordinator', assignee_es:'Coordinador de Invitados', planningWindow:'1 month before', priority:'critical', completedIfDone:'guest_list_finalized' },
  { title:'Final Venue Walkthrough', title_es:'Recorrido Final de Sede', desc:'Conduct a detailed on-site review with venue and key vendors using the latest plan.', desc_es:'Realizar una revisión detallada en sitio con la sede y los proveedores clave usando el plan más reciente.', durationDays:2, assignee:'Planner / Client / Operations Lead', assignee_es:'Organizador / Cliente / Líder de Operaciones', planningWindow:'1 month before', priority:'critical' },
  { title:'Confirm Final Vendor Deliverables', title_es:'Confirmar Entregables Finales de Proveedores', desc:'Verify arrival times, setup scope, contact list, production details, and outstanding balances.', desc_es:'Verificar horarios de llegada, alcance de montaje, lista de contactos, detalles de producción y saldos pendientes.', durationDays:5, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'1 month before', priority:'critical' },
  { title:'Prepare Event-Day Materials', title_es:'Preparar Materiales para el Día del Evento', desc:'Assemble checklists, credentials, signage packs, schedules, emergency contacts, and production documents.', desc_es:'Reunir listas de verificación, credenciales, paquetes de señalética, horarios, contactos de emergencia y documentos de producción.', durationDays:6, assignee:'Admin / Planner', assignee_es:'Administrador / Organizador', planningWindow:'3 weeks before', priority:'critical' },
  { title:'Team Briefing', title_es:'Briefing del Equipo', desc:'Train internal staff or support team on responsibilities, schedules, escalation points, and guest handling.', desc_es:'Capacitar al personal interno o equipo de apoyo sobre responsabilidades, horarios, puntos de escalación y atención a invitados.', durationDays:2, assignee:'Event Lead', assignee_es:'Líder de Evento', planningWindow:'3 weeks before', priority:'critical' },
  { title:'Confirm Final Payments Schedule', title_es:'Confirmar Calendario de Pagos Finales', desc:'Review due dates, payment methods, approvals, and final vendor invoices.', desc_es:'Revisar fechas de vencimiento, métodos de pago, aprobaciones y facturas finales de proveedores.', durationDays:3, assignee:'Finance Lead', assignee_es:'Responsable Financiero', planningWindow:'2-3 weeks before', priority:'important' },
  { title:'Lock Final Layout / Seating', title_es:'Cerrar Distribución / Ubicación Final', desc:'Finalize seating chart, room layout, signage placements, and operational zones.', desc_es:'Finalizar el plano de mesas, distribución del salón, ubicaciones de señalética y zonas operativas.', durationDays:4, assignee:'Planner / Guest Coordinator', assignee_es:'Organizador / Coordinador de Invitados', planningWindow:'2 weeks before', priority:'important', requiresService:'seating' },
  { title:'Send Final Guest Communication', title_es:'Enviar Comunicación Final a Invitados', desc:'Share arrival instructions, schedule details, parking, dress guidance, or participation notes.', desc_es:'Compartir instrucciones de llegada, detalles del programa, estacionamiento, vestimenta o notas de participación.', durationDays:2, assignee:'Communications Lead', assignee_es:'Líder de Comunicaciones', planningWindow:'2 weeks before', priority:'critical' },
  { title:'Confirm Final Guest Count', title_es:'Confirmar Conteo Final de Invitados', desc:'Submit final attendance count to venue, catering, and applicable vendors.', desc_es:'Enviar el conteo final de asistencia a la sede, catering y proveedores aplicables.', durationDays:2, assignee:'Guest Coordinator', assignee_es:'Coordinador de Invitados', planningWindow:'10 days before', priority:'critical' },
  { title:'Reconfirm All Vendors', title_es:'Reconfirmar Todos los Proveedores', desc:'Perform final reconfirmation of schedule, contacts, deliveries, and setup timing.', desc_es:'Realizar confirmación final de horarios, contactos, entregas y tiempos de montaje.', durationDays:3, assignee:'Event Planner', assignee_es:'Organizador de Evento', planningWindow:'1 week before', priority:'critical' },
  { title:'Pack Emergency / Backup Materials', title_es:'Preparar Materiales de Emergencia / Respaldo', desc:'Prepare extra supplies, printed copies, cables, tools, labels, extension cords, first-aid items, and stationery.', desc_es:'Preparar suministros extra, copias impresas, cables, herramientas, etiquetas, extensiones, botiquín y papelería.', durationDays:2, assignee:'Operations Lead', assignee_es:'Líder de Operaciones', planningWindow:'1 week before', priority:'important' },
  { title:'Final Internal Review', title_es:'Revisión Interna Final', desc:'Review the master checklist, outstanding items, dependencies, and contingency plan readiness.', desc_es:'Revisar la lista maestra de verificación, pendientes, dependencias y preparación del plan de contingencia.', durationDays:2, assignee:'Event Lead', assignee_es:'Líder de Evento', planningWindow:'3-5 days before', priority:'critical' },
  { title:'Venue Setup / Load-In', title_es:'Montaje de Sede / Carga', desc:'Install production, decor, rentals, signage, registration, and all physical event elements.', desc_es:'Instalar producción, decoración, alquileres, señalética, registro y todos los elementos físicos del evento.', durationDays:2, assignee:'Operations Lead / Vendors', assignee_es:'Líder de Operaciones / Proveedores', planningWindow:'1-2 days before', priority:'critical' },
  { title:'Event Execution', title_es:'Ejecución del Evento', desc:'Manage guest experience, timeline, vendor coordination, troubleshooting, and live operations.', desc_es:'Gestionar la experiencia de invitados, cronograma, coordinación de proveedores, resolución de problemas y operaciones en vivo.', durationDays:1, assignee:'Event Lead / Full Team', assignee_es:'Líder de Evento / Equipo Completo', planningWindow:'Event day', priority:'critical' },
  { title:'Breakdown / Load-Out', title_es:'Desmontaje / Desalojo', desc:'Oversee teardown, returns, cleanup, and removal of materials and equipment.', desc_es:'Supervisar el desmontaje, devoluciones, limpieza y retiro de materiales y equipos.', durationDays:1, assignee:'Operations Lead / Vendors', assignee_es:'Líder de Operaciones / Proveedores', planningWindow:'1 day after', priority:'critical' },
  { title:'Payment Reconciliation', title_es:'Conciliación de Pagos', desc:'Review final invoices, adjustments, reimbursements, and close out event expenses.', desc_es:'Revisar facturas finales, ajustes, reembolsos y cerrar gastos del evento.', durationDays:3, assignee:'Finance Lead', assignee_es:'Responsable Financiero', planningWindow:'1-3 days after', priority:'critical' },
  { title:'Thank You / Follow-Up Communications', title_es:'Comunicaciones de Agradecimiento / Seguimiento', desc:'Send appreciation messages, post-event notes, or next-step communication to attendees and partners.', desc_es:'Enviar mensajes de agradecimiento, notas post-evento o comunicación de próximos pasos a asistentes y socios.', durationDays:3, assignee:'Communications Lead', assignee_es:'Líder de Comunicaciones', planningWindow:'3-7 days after', priority:'important' },
  { title:'Collect Photos / Assets / Reports', title_es:'Recopilar Fotos / Archivos / Reportes', desc:'Gather media, vendor deliverables, attendance reports, and other final files.', desc_es:'Reunir medios, entregables de proveedores, reportes de asistencia y otros archivos finales.', durationDays:5, assignee:'Admin / Creative Lead', assignee_es:'Administrador / Líder Creativo', planningWindow:'1 week after', priority:'important', requiresService:'photo' },
  { title:'Post-Event Review', title_es:'Revisión Post-Evento', desc:'Evaluate what worked, what did not, budget performance, attendance, and lessons learned.', desc_es:'Evaluar qué funcionó, qué no, el desempeño del presupuesto, la asistencia y las lecciones aprendidas.', durationDays:2, assignee:'Event Lead / Client', assignee_es:'Líder de Evento / Cliente', planningWindow:'1-2 weeks after', priority:'important' },
  { title:'Archive Project Files', title_es:'Archivar Archivos del Proyecto', desc:'Organize final documents, floor plans, contracts, budgets, media, and notes for future use.', desc_es:'Organizar documentos finales, planos, contratos, presupuestos, medios y notas para uso futuro.', durationDays:2, assignee:'Admin', assignee_es:'Administrador', planningWindow:'2 weeks after', priority:'optional' }
];
function timelineTemplateDate(d){
  const dt = d instanceof Date ? new Date(d) : new Date(d+'T12:00:00');
  dt.setHours(12,0,0,0);
  return dt;
}
function taskStatusValue(tk){
  if(tk && tk.status) return tk.status;
  return tk && tk.done ? 'completed' : 'not-started';
}
function taskStatusLabel(tk){
  const status = typeof tk === 'string' ? tk : taskStatusValue(tk);
  if(status==='completed') return LANG==='es' ? 'Completada' : 'Completed';
  if(status==='in-progress') return LANG==='es' ? 'En progreso' : 'In progress';
  return LANG==='es' ? 'No iniciada' : 'Not started';
}
function taskIsDone(tk){
  return taskStatusValue(tk)==='completed';
}
function taskPhaseValue(task){
  const text=((task.title||'')+' '+(task.assignee||'')).toLowerCase();
  if(/breakdown|load-out|reconciliation|thank you|collect photos|post-event|archive/.test(text)) return 'Post-Event';
  if(/setup|load-in|execution|briefing|internal review|backup materials/.test(text)) return 'Event Week';
  if(/walkthrough|deliverables|payment schedule|final payments|final guest count|reconfirm/.test(text)) return 'Final Confirmation';
  if(/goal|budget|planning team|scope|master timeline|review/.test(text)) return 'Strategy & Budget';
  if(/venue|vendor|catering|production|photo|video/.test(text)) return 'Venue & Core Vendors';
  if(/theme|creative|design|decor|branding|signage|menu|experience|speaker|entertainment/.test(text)) return 'Design & Guest Experience';
  if(/logistics|operations|permit|approval|transport|access|staffing|equipment|rental|risk|contingency/.test(text)) return 'Logistics & Operations';
  if(/guest|invitation|registration|rsvp|seating|communication/.test(text)) return 'Guest Management';
  return 'Logistics & Operations';
}
function timelineTemplateIso(d){
  return timelineTemplateDate(d).toISOString().split('T')[0];
}
function timelineTemplateAddDays(d, days){
  const dt = timelineTemplateDate(d);
  dt.setDate(dt.getDate()+days);
  return dt;
}
function timelineTemplateColor(task){
  const text = ((task.assignee||'')+' '+(task.title||'')).toLowerCase();
  if(/finance|budget|payment/.test(text)) return '#a67c3d';
  if(/guest|invitation|registration|communication|rsvp/.test(text)) return '#f59e0b';
  if(/creative|design|decor|branding|photo|video|signage/.test(text)) return '#ec4899';
  if(/operations|logistics|venue|production|catering|vendor|rental|transport/.test(text)) return '#10b981';
  return '#7c3aed';
}

// ---- ADAPTIVE PLAN ENGINE --------------------------------------------

// Convert a planningWindow string to approximate days relative to event.
// Positive = days before event. Negative = days after event. 0 = event day.
function planningWindowToDays(w){
  var s = String(w||'').toLowerCase().replace(/[–—]/g,'-').trim();
  if(!s || s==='event day') return 0;
  var nums = (s.match(/\d+(?:\.\d+)?/g)||[]).map(Number).filter(Boolean);
  var avg = nums.length===1 ? nums[0] : nums.length>=2 ? (nums[0]+nums[1])/2 : 0;
  if(s.indexOf('month')>-1)      avg = avg*30;
  else if(s.indexOf('week')>-1)  avg = avg*7;
  if(s.indexOf('before')>-1) return Math.round(avg);
  if(s.indexOf('after')>-1)  return -Math.round(avg);
  return 0;
}

// Return the planning mode based on days remaining until the event.
function getPlanMode(daysRemaining){
  if(daysRemaining>=270) return 'full';       // 9+ months
  if(daysRemaining>=180) return 'reduced';    // 6–9 months
  if(daysRemaining>=90)  return 'compressed'; // 3–6 months
  return 'urgent';                             // <3 months
}

// Returns true if a task should be included in the plan given the user's
// setup answers and the computed plan mode.
function _planTaskVisible(task, answers, mode){
  // Priority gating: critical shows in all modes; important needs ≥compressed;
  // optional needs ≥reduced.
  var modeRank = {urgent:0,compressed:1,reduced:2,full:3};
  var priRank  = {critical:0,important:1,optional:2};
  if((priRank[task.priority||'important']||0) > (modeRank[mode]||0)) return false;

  // Service gating: skip if user said they don't need this service.
  var svc = task.requiresService;
  if(svc==='catering'      && answers.needCatering===false)      return false;
  if(svc==='av'            && answers.needAV===false)            return false;
  if(svc==='decor'         && answers.needDecor===false)         return false;
  if(svc==='photo'         && answers.needPhoto===false)         return false;
  if(svc==='entertainment' && answers.needEntertainment===false) return false;
  if(svc==='transport'     && answers.needTransport===false)     return false;
  if(svc==='permits'       && answers.needPermits===false)       return false;
  if(svc==='seating'       && answers.needSeating===false)       return false;
  if(svc==='venue_search'  && answers.venueBooked)               return false;

  // Skip-if-done gating: omit tasks that are no longer needed because the
  // milestone was completed outside this system.
  var sid = task.skipIfDone;
  if(sid==='save_the_date' && answers.saveTheDateSent)  return false;
  if(sid==='invitations'   && answers.invitationsSent)  return false;

  return true;
}

// Returns true if a task should be pre-marked as completed based on answers.
function _planTaskCompleted(task, answers){
  var c = task.completedIfDone;
  if(!c) return false;
  if(c==='venue_booked'         && answers.venueBooked)                           return true;
  if(c==='venue_contract'       && answers.venueContractDone)                     return true;
  if(c==='save_the_date'        && answers.saveTheDateSent)                       return true;
  if(c==='invitations'          && answers.invitationsSent)                       return true;
  if(c==='guest_list_started'   && answers.guestListStatus!=='not_started')       return true;
  if(c==='guest_list_finalized' && answers.guestListStatus==='finalized')         return true;
  if(c==='vendor_contracts'     && answers.vendorContractsDone)                   return true;
  return false;
}

// Build the task list, distributing them proportionally across the available
// window from today to the event date. Never produces past start dates.
function buildAdaptiveTemplateTasks(eventDate, answers){
  var today = new Date(); today.setHours(0,0,0,0);
  var evDate = timelineTemplateDate(eventDate); evDate.setHours(0,0,0,0);
  var daysRemaining = Math.round((evDate-today)/86400000);

  var mode;
  if((answers.planScope||'smart')==='essentials')    mode='urgent';
  else if((answers.planScope||'smart')==='full')     mode='full';
  else                                               mode=getPlanMode(daysRemaining);

  var MAX_SPAN = 365; // original template spans ~12 months

  var isES = (typeof LANG !== 'undefined' && LANG === 'es');
  return TEMPLATE_PLAN_TASKS
    .filter(function(task){ return _planTaskVisible(task,answers,mode); })
    .map(function(task,index){
      var daysBefore = planningWindowToDays(task.planningWindow);
      var startDate;
      if(daysBefore<0){
        // Post-event task: keep fixed offset after the event date.
        startDate = timelineTemplateAddDays(evDate, Math.abs(daysBefore));
      } else {
        // Pre-event: map proportionally. ratio=1 → today, ratio=0 → event day.
        var ratio = Math.min(1, daysBefore/MAX_SPAN);
        var daysFromToday = Math.round(daysRemaining*(1-ratio));
        daysFromToday = Math.max(0, Math.min(daysRemaining, daysFromToday));
        startDate = timelineTemplateAddDays(today, daysFromToday);
      }
      // Compress durations for tight timelines so tasks don't overlap badly.
      var dur = task.durationDays||1;
      if(mode==='urgent')      dur = Math.min(dur, 2);
      else if(mode==='compressed') dur = Math.max(1, Math.round(dur*0.6));
      var endDate = timelineTemplateAddDays(startDate, Math.max(0, dur-1));
      var completed = _planTaskCompleted(task, answers);
      return {
        id:'tpl_'+Date.now()+'_'+index,
        title: isES ? (task.title_es || task.title) : task.title,
        desc: isES ? (task.desc_es || task.desc) : task.desc,
        startDate:timelineTemplateIso(startDate),
        dueDate:timelineTemplateIso(endDate),
        endDate:timelineTemplateIso(endDate),
        durationDays:dur,
        assignee: isES ? (task.assignee_es || task.assignee) : task.assignee,
        planningWindow:task.planningWindow,
        phase:task.phase||taskPhaseValue(task),
        priority:task.priority||'important',
        status:completed?'completed':'not-started',
        done:completed,
        color:timelineTemplateColor(task)
      };
    })
    .sort(function(a,b){
      return (a.startDate||a.dueDate).localeCompare(b.startDate||b.dueDate)
        ||(a.dueDate||a.startDate).localeCompare(b.dueDate||b.startDate)
        ||a.title.localeCompare(b.title);
    });
}

// Compute preview counts without generating the full task objects.
function _previewAdaptivePlan(eventDate, answers){
  var today = new Date(); today.setHours(0,0,0,0);
  var evDate = timelineTemplateDate(eventDate); evDate.setHours(0,0,0,0);
  var daysRemaining = Math.round((evDate-today)/86400000);
  var mode;
  if((answers.planScope||'smart')==='essentials')  mode='urgent';
  else if((answers.planScope||'smart')==='full')   mode='full';
  else                                             mode=getPlanMode(daysRemaining);
  var included=0, skipped=0, completed=0;
  TEMPLATE_PLAN_TASKS.forEach(function(task){
    if(!_planTaskVisible(task,answers,mode)){ skipped++; }
    else{ included++; if(_planTaskCompleted(task,answers)) completed++; }
  });
  return {mode:mode, daysRemaining:daysRemaining, included:included, skipped:skipped, completed:completed};
}
// ---- PLAN SETUP WIZARD -----------------------------------------------

var _planWiz = null;

function openTemplatePlanWizard(){
  var p = proj();
  if(!p) return;
  if(!p.date) return toast(LANG==='es'?'Primero agrega una fecha al evento para generar el cronograma':'Add an event date first so the template plan can be generated','e');
  _planWiz = {
    step:0,
    // Step 1 — current status
    venueBooked:false, venueContractDone:false, plannerHired:false,
    saveTheDateSent:false, invitationsSent:false,
    guestListStatus:'not_started', vendorContractsDone:false,
    // Step 2 — services
    needCatering:true, needAV:true, needDecor:true, needPhoto:true,
    needEntertainment:false, needTransport:false, needPermits:false, needSeating:true,
    // Step 3 — scope (set at preview step)
    planScope:'smart'
  };
  _renderPlanWiz();
}

function _renderPlanWiz(){
  var isES = LANG==='es';
  var s    = _planWiz.step;
  var stepLabels = isES ? ['Estado actual','Servicios','Vista previa'] : ['Current status','Services','Preview'];

  // Progress bar (same style as event creation wizard)
  var prog = '<div style="display:flex;align-items:flex-start;gap:0;margin-bottom:28px;">';
  for(var i=0;i<stepLabels.length;i++){
    var done   = i<s, active = i===s;
    var circBg  = done?'var(--gold)':active?'var(--gold-l)':'var(--bg)';
    var circBd  = (done||active)?'var(--gold)':'var(--border)';
    var circClr = done?'#fff':active?'var(--gold-h)':'var(--light)';
    var txtClr  = active?'var(--gold-h)':done?'var(--text)':'var(--light)';
    var inner   = done?'<svg width="11" height="11" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':String(i+1);
    var lineClr = i<=s?'var(--gold)':'var(--border)';
    var line    = i>0?'<div style="position:absolute;right:50%;top:13px;width:100%;height:1px;background:'+lineClr+'"></div>':'';
    prog += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;">'
      +line
      +'<div style="width:26px;height:26px;border-radius:50%;border:1.5px solid '+circBd+';background:'+circBg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:'+circClr+';position:relative;z-index:1;">'+inner+'</div>'
      +'<div style="font-size:10px;margin-top:5px;color:'+txtClr+';font-weight:'+(active?'600':'400')+';white-space:nowrap;letter-spacing:.3px;">'+stepLabels[i]+'</div>'
      +'</div>';
  }
  prog += '</div>';

  var body    = s===0?_planWizStep0(isES):s===1?_planWizStep1(isES):_planWizStep2(isES);
  var backBtn = s>0
    ?'<button class="btn btn-ghost" onclick="_planWizBack()">'+(isES?'← Atrás':'← Back')+'</button>'
    :'<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>';
  var nextLbl = s===2?(isES?'Generar plan':'Generate plan'):(isES?'Siguiente →':'Next →');

  openMo(
    '<div style="width:100%;max-width:580px;">'
    +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;color:var(--gold-h);margin-bottom:3px;">'+(isES?'Crear plan de evento':'Create Event Plan')+'</div>'
    +'<div style="font-size:12px;color:var(--light);margin-bottom:24px;letter-spacing:.3px;text-transform:uppercase;">'+(isES?'Paso '+(s+1)+' de 3':'Step '+(s+1)+' of 3')+'</div>'
    +prog+body
    +'<div class="mo-foot" style="margin-top:28px;">'+backBtn
    +'<button class="btn btn-primary btn-create-gradient" onclick="_planWizNext()">'+nextLbl+'</button>'
    +'</div></div>'
  );
}

// Reusable checkbox row for the wizard
function _planWizCheck(field, label, sub){
  var checked = !!_planWiz[field];
  return '<div onclick="_planWizToggle(\''+field+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--r);border:1.5px solid '+(checked?'var(--gold)':'var(--border)')+';background:'+(checked?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
    +'<div style="width:18px;height:18px;border-radius:4px;border:1.5px solid '+(checked?'var(--gold)':'var(--border)')+';background:'+(checked?'var(--gold)':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
    +(checked?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
    +'</div>'
    +'<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:'+(checked?'600':'400')+';color:var(--text);">'+label+'</div>'
    +(sub?'<div style="font-size:11px;color:var(--muted);margin-top:1px;">'+sub+'</div>':'')
    +'</div></div>';
}

// Step 1 — What's already in place?
function _planWizStep0(isES){
  var glOptions = [
    ['not_started', isES?'Aún no iniciada':'Not started yet'],
    ['started',     isES?'Comenzada':'Started'],
    ['finalized',   isES?'Finalizada':'Finalized']
  ];
  var glRadios = glOptions.map(function(opt){
    var sel = _planWiz.guestListStatus===opt[0];
    return '<div onclick="_planWizSetGL(\''+opt[0]+'\')" style="display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:var(--r);border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);font-size:13px;font-weight:'+(sel?'600':'400')+';color:var(--text);">'
      +'<div style="width:14px;height:14px;border-radius:50%;border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold)':'transparent')+'"></div>'
      +opt[1]+'</div>';
  }).join('');

  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Qué ya está listo?':'What\'s already in place?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Marca lo que ya está resuelto y el plan omitirá o marcará como completadas las tareas correspondientes.':'Check what\'s already handled and the plan will skip or pre-complete those tasks.')+'</div>'
    +_planWizCheck('venueBooked',       isES?'La sede / lugar ya está reservada':'Venue is already booked',                isES?'Se omitirán las tareas de búsqueda y selección de sede':'Venue search and selection tasks will be skipped')
    +(_planWiz.venueBooked ? _planWizCheck('venueContractDone', isES?'Contrato / depósito de sede ya firmado':'Venue contract / deposit already signed', null) : '')
    +_planWizCheck('plannerHired',      isES?'Coordinador / planificador ya contratado':'Event planner / coordinator already hired', null)
    +_planWizCheck('saveTheDateSent',   isES?'Save-the-date ya enviado':'Save-the-date / early notice already sent',       isES?'Se omitirá la tarea de envío de save-the-date':'Save-the-date task will be skipped')
    +_planWizCheck('invitationsSent',   isES?'Invitaciones ya enviadas':'Invitations already sent',                        isES?'Se omitirán producción y envío de invitaciones':'Invitation production and sending tasks will be skipped')
    +_planWizCheck('vendorContractsDone',isES?'Contratos / depósitos de proveedores ya completados':'Vendor contracts / deposits already completed', isES?'Las tareas de selección de proveedor se marcarán como completadas':'Vendor selection tasks will be pre-marked as completed')
    +'<div style="margin-top:16px;margin-bottom:4px;">'
    +'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);margin-bottom:10px;">'+(isES?'Estado de la lista de invitados':'Guest list status')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'+glRadios+'</div>'
    +'</div></div>';
}

// Step 2 — What does this event need?
function _planWizStep1(isES){
  var services = [
    {id:'needCatering',      en:'Catering / Food service',           es:'Catering / Servicio de alimentos'},
    {id:'needAV',            en:'AV / Lighting / Production',        es:'Sonido / Iluminación / Producción'},
    {id:'needDecor',         en:'Décor / Floral design',             es:'Decoración / Diseño floral'},
    {id:'needPhoto',         en:'Photography / Videography',         es:'Fotografía / Videografía'},
    {id:'needEntertainment', en:'Entertainment or Speakers',         es:'Entretenimiento o ponentes'},
    {id:'needTransport',     en:'Guest transport / Accommodations',  es:'Transporte / Alojamiento de invitados'},
    {id:'needPermits',       en:'Permits / Insurance / Approvals',   es:'Permisos / Seguros / Aprobaciones'},
    {id:'needSeating',       en:'Seating / Table assignments',       es:'Distribución / Asignación de mesas'}
  ];
  var items = services.map(function(svc){
    var checked = !!_planWiz[svc.id];
    var lbl = isES?svc.es:svc.en;
    return '<div onclick="_planWizToggle(\''+svc.id+'\')" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--r);border:1.5px solid '+(checked?'var(--gold)':'var(--border)')+';background:'+(checked?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<div style="width:18px;height:18px;border-radius:4px;border:1.5px solid '+(checked?'var(--gold)':'var(--border)')+';background:'+(checked?'var(--gold)':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +(checked?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div>'
      +'<span style="font-size:13px;font-weight:'+(checked?'600':'400')+';color:var(--text);flex:1;">'+lbl+'</span>'
      +'</div>';
  }).join('');
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Qué necesita este evento?':'What does this event need?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Activa solo lo que aplica. Los servicios no seleccionados quedarán fuera del plan.':'Enable only what applies. Unselected services will be removed from the plan.')+'</div>'
    +items+'</div>';
}

// Step 3 — Preview + scope choice
function _planWizStep2(isES){
  var p = proj();
  if(!p||!p.date) return '<div style="color:var(--muted);font-size:13px;">'+(isES?'Sin fecha de evento.':'No event date.')+'</div>';

  var prev = _previewAdaptivePlan(p.date, _planWiz);
  var modeData = {
    full:       {label_en:'Full plan (9+ months)',              label_es:'Plan completo (9+ meses)',              color:'#10b981', bg:'rgba(16,185,129,.08)',  bd:'rgba(16,185,129,.2)'},
    reduced:    {label_en:'Reduced plan (6–9 months)',          label_es:'Plan reducido (6–9 meses)',             color:'#7c3aed', bg:'rgba(124,58,237,.08)', bd:'rgba(124,58,237,.2)'},
    compressed: {label_en:'Compressed plan (3–6 months)',       label_es:'Plan comprimido (3–6 meses)',           color:'#f59e0b', bg:'rgba(245,158,11,.08)', bd:'rgba(245,158,11,.2)'},
    urgent:     {label_en:'Urgent essentials (<3 months)',      label_es:'Esenciales urgentes (<3 meses)',        color:'#ef4444', bg:'rgba(239,68,68,.08)',  bd:'rgba(239,68,68,.2)'}
  };
  var md = modeData[prev.mode]||modeData.full;
  var modeLabel = isES?md.label_es:md.label_en;

  var hasTasks = Array.isArray(p.tasks)&&p.tasks.length>0;

  // Scope options
  var scopes = [
    {id:'smart',      en:'Smart plan (recommended)',  es:'Plan inteligente (recomendado)',  den:'Adapts tasks to time available',                   des:'Adapta las tareas al tiempo disponible'},
    {id:'full',       en:'Full plan',                 es:'Plan completo',                   den:'Include all applicable tasks regardless of timeline',des:'Incluye todas las tareas aplicables'},
    {id:'essentials', en:'Essentials only',           es:'Solo esenciales',                  den:'Critical tasks only — minimal setup',               des:'Solo tareas críticas — configuración mínima'}
  ];
  var scopeItems = scopes.map(function(sc){
    var sel = _planWiz.planScope===sc.id;
    var lbl = isES?sc.es:sc.en;
    var desc = isES?sc.des:sc.den;
    return '<div onclick="_planWizSetScope(\''+sc.id+'\')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--r);border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<div style="width:16px;height:16px;border-radius:50%;border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold)':'transparent')+';flex-shrink:0;"></div>'
      +'<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:'+(sel?'600':'400')+';color:var(--text);">'+lbl+'</div>'
      +'<div style="font-size:11px;color:var(--muted);">'+desc+'</div></div></div>';
  }).join('');

  // Summary stat tile
  function stat(val,lbl,color){
    return '<div style="text-align:center;padding:14px 8px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg);">'
      +'<div style="font-size:22px;font-weight:700;color:'+color+';">'+val+'</div>'
      +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px;">'+lbl+'</div>'
      +'</div>';
  }

  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'Vista previa del plan':'Plan preview')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Elige el alcance y revisa el resumen antes de generar.':'Choose scope and review the summary before generating.')+'</div>'
    // Mode indicator
    +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--r);background:'+md.bg+';border:1px solid '+md.bd+';margin-bottom:14px;">'
    +'<div style="width:10px;height:10px;border-radius:50%;background:'+md.color+';flex-shrink:0;"></div>'
    +'<div style="font-size:13px;font-weight:600;color:var(--text);flex:1;">'+modeLabel+'</div>'
    +'<div style="font-size:11px;color:var(--muted);">'+(isES?'Días disponibles: ':'Days available: ')+Math.max(0,prev.daysRemaining)+'</div>'
    +'</div>'
    // Stats
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">'
    +stat(prev.included-prev.completed, isES?'Tareas nuevas':'New tasks',     '#7c3aed')
    +stat(prev.completed,               isES?'Ya completadas':'Pre-completed', '#10b981')
    +stat(prev.skipped,                 isES?'Omitidas':'Skipped',             '#94a3b8')
    +'</div>'
    // Scope selector
    +'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);margin-bottom:10px;">'+(isES?'Alcance del plan':'Plan scope')+'</div>'
    +scopeItems
    +(hasTasks?'<div style="margin-top:12px;font-size:12px;color:#b45309;padding:10px 14px;background:rgba(180,83,9,.07);border-radius:var(--r);">'+(isES?'⚠ Esto reemplazará las tareas actuales del cronograma.':'⚠ This will replace the current timeline tasks.')+'</div>':'')
    +'</div>';
}

function _planWizToggle(field){
  if(!_planWiz) return;
  _planWiz[field] = !_planWiz[field];
  _renderPlanWiz();
}
function _planWizSetGL(val){
  if(!_planWiz) return;
  _planWiz.guestListStatus = val;
  _renderPlanWiz();
}
function _planWizSetScope(val){
  if(!_planWiz) return;
  _planWiz.planScope = val;
  _renderPlanWiz();
}
function _planWizNext(){
  if(!_planWiz) return;
  if(_planWiz.step<2){ _planWiz.step++; _renderPlanWiz(); }
  else { _planWizGenerate(); }
}
function _planWizBack(){
  if(!_planWiz) return;
  _planWiz.step--;
  _renderPlanWiz();
}
function _planWizGenerate(){
  if(typeof _libPlanWizTargetGroupId !== 'undefined' && _libPlanWizTargetGroupId){
    var lib=getLib();
    var entry=lib.tasks.find(function(e){return e.id===_libPlanWizTargetGroupId;});
    if(entry){
      // Use a 1-year-ahead date to drive proportional scheduling, then strip dates
      var futureDate=new Date(); futureDate.setFullYear(futureDate.getFullYear()+1);
      var isoDate=futureDate.toISOString().split('T')[0];
      buildAdaptiveTemplateTasks(isoDate, _planWiz).forEach(function(tk){
        tk.id='gt'+Date.now()+Math.random().toString(36).slice(2,6);
        tk.startDate=''; tk.dueDate=''; tk.endDate=''; tk.done=false; tk.status='not-started';
        entry.tasks.push(tk);
      });
      saveLib(lib);
    }
    _libPlanWizTargetGroupId=null; _planWiz=null; closeMo();
    toast(LANG==='es'?'Plan guardado en biblioteca':'Plan saved to library','s');
    if(typeof renderLibrary==='function') renderLibrary();
    return;
  }
  var p = proj();
  if(!p||!p.date) return toast(LANG==='es'?'Selecciona una fecha del evento':'Select an event date','e');
  p.tasks = buildAdaptiveTemplateTasks(p.date, _planWiz);
  p.tasksInitialized = true;
  saveProj(p);
  _planWiz = null;
  closeMo();
  renderTimeline();
  toast(LANG==='es'?'Plan creado':'Plan created','s');
}

// Keep legacy name working in case called from elsewhere.
function generateTemplatePlan(){ _planWizGenerate(); }

// Entry point for library context — skips the event-date requirement
function openTemplatePlanWizardForLib(){
  _planWiz = {
    step:0,
    venueBooked:false, venueContractDone:false, plannerHired:false,
    saveTheDateSent:false, invitationsSent:false,
    guestListStatus:'not_started', vendorContractsDone:false,
    needCatering:true, needAV:true, needDecor:true, needPhoto:true,
    needEntertainment:false, needTransport:false, needPermits:false, needSeating:true,
    planScope:'smart'
  };
  _renderPlanWiz();
}
function renderTimelineEmptyState(){
  const isES = LANG==='es';
  return `<section class="ev-empty fade-in">
    <div class="ev-empty-shell">
      <div class="ev-empty-aurora" aria-hidden="true"></div>
      <div class="ev-empty-grid">
        <div class="ev-empty-copy">
          <div class="ev-empty-badge">${isES ? 'Cronograma inicial' : 'Timeline starter'}</div>
          <h2 class="ev-empty-title">${isES ? 'Comienza este evento con un plan maestro listo para trabajar.' : 'Start this event with a master plan that is ready to work from.'}</h2>
          <p class="ev-empty-subtitle">${isES ? 'Crea una plantilla completa de planificación para eventos sociales, corporativos, galas, celebraciones privadas y recaudaciones. Después podrás editar cada tarea, responsable y fecha como quieras.' : 'Create a full planning template for social events, corporate events, galas, private celebrations, and fundraisers. After that, you can edit every task, assignee, and date however you like.'}</p>
          <div class="ev-empty-actions">
            <button class="btn btn-primary btn-create-gradient ev-empty-cta" onclick="openTemplatePlanWizard()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${isES ? 'Crear Plan de Plantilla' : 'Create Template Plan'}
            </button>
            <button class="btn btn-ghost ev-empty-cta" onclick="openTaskModal()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${t('add_task')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}
function _libUpdateSectionLabels(){
  // 'lib-save-vendor-lbl' no existe en ningun render: el boton de guardar proveedores
  // ya se re-pinta con renderBudget() al cambiar de idioma.  Se elimina la linea muerta.
  var lt=document.getElementById('lib-save-task-lbl');   if(lt) lt.textContent=t('lib_save_to');
  var lvl=document.getElementById('lib-load-vendor-lbl'); if(lvl) lvl.textContent=LANG==='es'?'CARGAR':'LOAD';
  var ltl=document.getElementById('lib-load-task-lbl');   if(ltl) ltl.textContent=LANG==='es'?'Importar Tareas':'Import Tasks';
}
function renderTimeline(){
  const p=proj();const el=document.getElementById('tab-timeline');
  if(!Array.isArray(p.tasks)) p.tasks=[];
  const done=p.tasks.filter(taskIsDone).length;
  const ov=p.tasks.filter(tk=>!taskIsDone(tk)&&tk.dueDate<today()).length;
  const pct=p.tasks.length?Math.round(done/p.tasks.length*100):0;
  el.innerHTML=`
  <div class="sh">
    <div><div class="sh-title editorial-title" style="color:var(--text)">${t('timeline')}</div>
    <div class="sh-sub">${t('timeline_sub')}</div></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="openTemplatePlanWizard()" style="display:flex;align-items:center;gap:5px;font-size:11px">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/><path d="M19 3v4M17 5h4"/></svg>
        <span>${LANG==='es'?'Crear Plan de Plantilla':'Create Template Plan'}</span>
      </button>
      <button class="btn btn-ghost btn-sm" onclick="libQuickSaveTasks()" style="display:flex;align-items:center;gap:5px;font-size:11px">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <span id="lib-save-task-lbl">${t('lib_save_to')}</span>
      </button>
      <button class="btn btn-ghost btn-sm" onclick="libQuickLoadTasks()" style="display:flex;align-items:center;gap:5px;font-size:11px">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="8,10 12,14 16,10"/></svg>
        <span id="lib-load-task-lbl">${LANG==='es'?'Importar Tareas':'Import Tasks'}</span>
      </button>
      <button class="btn btn-primary btn-create-gradient" onclick="openTaskModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${t('add_task')}
      </button>
    </div>
  </div>
  <div class="sg" style="margin-bottom:20px">
    ${statCard(t('total_tasks'),'#f5f3ff','#7c3aed','<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',p.tasks.length,t('tasks_sub'),'0','#7c3aed')}
    ${statCard(t('completed_tasks'),'#ecfdf5','#10b981','<polyline points="20,6 9,17 4,12"/>',done,t('done'),pct,'#10b981')}
    ${statCard(t('overdue_tasks'),'#fff0f0','#ef4444','<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',ov,t('tasks_overdue_sub'),'0','#ef4444')}
    ${statCard(t('progress'),'#f7f0de','#7a5c2a','<circle cx="12" cy="12" r="10"/>',pct+'%',t('completed_tasks'),pct,'#a67c3d')}
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
    <div class="vtabs" style="margin-bottom:0">
      <div class="vtab ${tView==='list'?'active':''}" onclick="tView='list';renderTimeline()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>${t('list_view')}
      </div>
      <div class="vtab ${tView==='gantt'?'active':''}" onclick="tView='gantt';renderTimeline()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="12" height="4" rx="1"/><rect x="7" y="16" width="14" height="4" rx="1"/></svg>${t('gantt_view')}
      </div>
      <div class="vtab ${tView==='calendar'?'active':''}" onclick="tView='calendar';renderTimeline()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${t('calendar_view')}
      </div>
    </div>
    <div class="vtabs" style="margin-bottom:0">
      ${[['all',LANG==='es'?'Todas':'All'],['overdue',LANG==='es'?'Vencidas':'Overdue'],['today',LANG==='es'?'Hoy':'Today'],['upcoming',LANG==='es'?'Próximas':'Upcoming']].map(([k,l])=>`<div class="vtab ${taskListFilter===k?'active':''}" data-task-filter="${k}" onclick="setTaskListFilter('${k}',this)">${l}</div>`).join('')}
    </div>
  </div>
  <div class="timeline-search-wrap" style="position:relative;display:flex;align-items:center;margin-bottom:4px">
    <svg width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input id="timeline-task-search" class="input" placeholder="${t('search_tasks')}" value="${esc(taskSearchQuery)}" oninput="debouncedTaskSearch(this.value)" style="padding-left:36px;width:100%">
  </div>
  <div id="tview-content" style="margin-top:12px"></div>
  ${renderMobileStickyActionBar(`
    <button class="btn btn-ghost" onclick="libQuickLoadTasks()">${LANG==='es'?'Importar':'Import'}</button>
    <button class="btn btn-primary btn-create-gradient" onclick="openTaskModal()">${t('add_task')}</button>
  `)}`;
  renderTimelineView(p);
}
var taskListFilter='all';
var taskSearchQuery='';
function setTaskListFilter(filter,el){
  taskListFilter=filter;
  const scope=el&&el.parentElement?el.parentElement:document;
  scope.querySelectorAll('[data-task-filter]').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.taskFilter===filter);
  });
  setTimeout(()=>renderTimelineView(proj()),0);
}
function filterTasks(tasks){
  const tod=today();
  let filtered=[...tasks];
  if(taskListFilter==='overdue') filtered=filtered.filter(tk=>!taskIsDone(tk)&&tk.dueDate&&tk.dueDate<tod);
  else if(taskListFilter==='today') filtered=filtered.filter(tk=>tk.dueDate===tod);
  else if(taskListFilter==='upcoming') filtered=filtered.filter(tk=>tk.dueDate&&tk.dueDate>tod&&!taskIsDone(tk));
  const q=taskSearchQuery.trim().toLowerCase();
  if(q) filtered=filtered.filter(tk=>[tk.title,tk.desc,tk.assignee,tk.startDate,tk.dueDate,tk.endDate,tk.planningWindow,tk.durationDays,tk.status,tk.phase].some(v=>String(v||'').toLowerCase().includes(q)));
  return filtered;
}
function renderTimelineView(p){
  if(!(p.tasks||[]).length && !taskSearchQuery.trim()){
    document.getElementById('tview-content').innerHTML=renderTimelineEmptyState();
    return;
  }
  if(tView==='list')renderTaskList(p);
  else if(tView==='gantt')renderGantt(p);
  else renderCal(p);
}
var _expandedTaskIds = [];
function toggleTaskExpand(tid){
  var idx = _expandedTaskIds.indexOf(tid);
  if(idx > -1) _expandedTaskIds.splice(idx, 1);
  else _expandedTaskIds.push(tid);
  var card = document.querySelector('.tmc[data-tid="'+tid+'"]');
  if(card) card.classList.toggle('tmc-open', _expandedTaskIds.indexOf(tid) > -1);
}
function renderTaskList(p){
  const el=document.getElementById('tview-content');
  const tod=today();
  const isMob=isPhoneViewport();
  let sorted=filterTasks([...p.tasks]).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  if(!sorted.length){ el.innerHTML=`<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${taskSearchQuery.trim()?t('no_tasks_found'):t('no_tasks_yet')}</div>`; return; }
  if(isMob){
    el.innerHTML=sorted.map(function(tk){
      var status=taskStatusValue(tk);
      var isDone=taskIsDone(tk);
      var ov=!isDone&&tk.dueDate&&tk.dueDate<tod;
      var isOpen=_expandedTaskIds.indexOf(tk.id)>-1;
      var dateStr=fmtDate(tk.dueDate||tk.startDate);
      var statusLbl=taskStatusLabel(status);
      return `<article class="tmc${isOpen?' tmc-open':''}" data-tid="${tk.id}">
        <div class="tmc-summary" onclick="toggleTaskExpand('${tk.id}')">
          <div class="tchk ${isDone?'done':''}" onclick="event.stopPropagation();toggleTask('${tk.id}')">
            ${isDone?'<svg width="12" height="12" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>':''}
          </div>
          <div class="tmc-info">
            <div class="tmc-name ${isDone?'tmc-done':''}">${esc(tk.title)}</div>
            <div class="tmc-row">
              <span class="tmc-date${ov?' tmc-overdue':''}">${dateStr}${ov?' · '+t('overdue'):''}</span>
              <span class="tmc-status">${esc(statusLbl)}</span>
            </div>
          </div>
          <div class="tmc-color" style="background:${tk.color||'#7c3aed'}"></div>
          <svg class="tmc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="tmc-detail">
          ${tk.desc?'<div class="tmc-desc">'+esc(tk.desc)+'</div>':''}
          <div class="tmc-meta">
            <div class="tmc-meta-item"><span class="tmc-meta-lbl">${LANG==='es'?'Fechas':'Dates'}</span><span class="tmc-meta-val" style="color:${ov?'var(--danger)':'var(--text)'}">${fmtDate(tk.startDate||tk.dueDate)}${tk.startDate&&tk.dueDate?' → '+fmtDate(tk.dueDate):''}</span></div>
            <div class="tmc-meta-item"><span class="tmc-meta-lbl">${LANG==='es'?'Asignado':'Assignee'}</span><span class="tmc-meta-val">${esc(tk.assignee||t('unassigned'))}</span></div>
            <div class="tmc-meta-item"><span class="tmc-meta-lbl">${LANG==='es'?'Duración':'Duration'}</span><span class="tmc-meta-val">${tk.durationDays||1} ${LANG==='es'?'días':'days'}</span></div>
            <div class="tmc-meta-item"><span class="tmc-meta-lbl">${LANG==='es'?'Fase':'Phase'}</span><span class="tmc-meta-val">${esc(tk.phase||taskPhaseValue(tk))}</span></div>
            ${tk.planningWindow?'<div class="tmc-meta-item"><span class="tmc-meta-lbl">'+(LANG==='es'?'Ventana':'Window')+'</span><span class="tmc-meta-val">'+esc(tk.planningWindow)+'</span></div>':''}
          </div>
          <div class="tmc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="openTaskModal('${tk.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg> ${LANG==='es'?'Editar':'Edit'}</button>
            <button class="btn btn-ghost btn-sm" onclick="dupTask('${tk.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${LANG==='es'?'Duplicar':'Duplicate'}</button>
            <button class="btn btn-danger btn-sm" onclick="delTask('${tk.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg> ${LANG==='es'?'Eliminar':'Delete'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
    return;
  }
  el.innerHTML=sorted.map(tk=>{
    const status=taskStatusValue(tk);
    const isDone=taskIsDone(tk);
    const ov=!isDone&&tk.dueDate&&tk.dueDate<tod;
    return `<div class="task-row">
      <div class="tchk ${isDone?'done':''}" onclick="toggleTask('${tk.id}')">
        ${isDone?`<svg width="12" height="12" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>`:''}
      </div>
      <div style="flex:1">
        <div class="task-title ${isDone?'done':''}">${esc(tk.title)}</div>
        ${tk.desc?`<div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(tk.desc)}</div>`:''}
        <div class="task-meta">
          <span style="color:${ov?'var(--danger)':'var(--muted)'};display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${fmtDate(tk.startDate||tk.dueDate)}${tk.startDate&&tk.dueDate?' - '+fmtDate(tk.dueDate):''}${ov?' ('+t('overdue')+')':''}</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(tk.assignee||t('unassigned'))}</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>${esc(String(tk.durationDays||1))} ${LANG==='es'?'días':'days'}</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/></svg>${esc(tk.phase||taskPhaseValue(tk))}</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${esc(taskStatusLabel(status))}</span>
          ${tk.planningWindow?`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18"/><path d="M12 3v18"/></svg>${esc(tk.planningWindow)}</span>`:''}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <div style="width:12px;height:12px;border-radius:50%;background:${tk.color||'#7c3aed'};flex-shrink:0;margin-top:4px"></div>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="dupTask('${tk.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openTaskModal('${tk.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="delTask('${tk.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div>
    </div>`;
  }).join('');
}
var _ganttZoom=14; var _ganttOffset=0; // px per day
function renderGantt(p){
  const el=document.getElementById('tview-content');
  const tasks=filterTasks([...p.tasks]).filter(tk=>tk.startDate||tk.dueDate).sort((a,b)=>(a.startDate||a.dueDate).localeCompare(b.startDate||b.dueDate));
  if(!tasks.length){el.innerHTML=`<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${taskSearchQuery.trim()?t('no_tasks_found'):t('no_tasks_yet')}</div>`;return;}
  const isES=LANG==='es';
  const allDates=tasks.flatMap(tk=>[tk.startDate||tk.dueDate,tk.dueDate||tk.startDate].filter(Boolean).map(d=>new Date(d+'T12:00:00')));
  let minD=new Date(Math.min(...allDates)); let maxD=new Date(Math.max(...allDates));
  // Apply offset (months navigation)
  minD.setMonth(minD.getMonth()+_ganttOffset); maxD.setMonth(maxD.getMonth()+_ganttOffset);
  minD.setDate(1); minD.setHours(0,0,0,0);
  maxD.setDate(new Date(maxD.getFullYear(),maxD.getMonth()+1,0).getDate()); maxD.setHours(23,59,59,999);
  const totalDays=Math.max(1,(maxD-minD)/86400000);
  const pxPerDay=_ganttZoom; // px per day
  const totalW=Math.round(totalDays*pxPerDay);
  const months=[]; const cur=new Date(minD);
  while(cur<=maxD){months.push({y:cur.getFullYear(),m:cur.getMonth(),lbl:cur.toLocaleString(isES?'es-MX':'en-US',{month:'short'})+' '+cur.getFullYear(),days:new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate()});cur.setMonth(cur.getMonth()+1);}
  // Build week sub-header
  const weekCells=[];
  const wCur=new Date(minD);
  while(wCur<=maxD){
    const wEnd=new Date(wCur); wEnd.setDate(wEnd.getDate()+6);
    const pct=Math.min(wEnd,maxD)-wCur;
    const wDays=Math.round(pct/86400000)+1;
    const wW=wDays*pxPerDay;
    weekCells.push(`<div style="width:${wW}px;flex-shrink:0;border-right:1px solid var(--border);padding:0 4px;font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;box-sizing:border-box;text-align:center">${isES?'S':'W'} ${Math.ceil(wCur.getDate()/7)}</div>`);
    wCur.setDate(wCur.getDate()+7);
  }
  const rows=tasks.map(tk=>{
    const tks=new Date((tk.startDate||tk.dueDate)+'T12:00:00');
    const tke=new Date((tk.dueDate||tk.startDate)+'T12:00:00');
    // Hide task entirely if it ends before the visible range starts
    if(tke<minD) return '';
    // Hide task entirely if it starts after the visible range ends
    if(tks>maxD) return '';
    // Clip start to visible range
    const clippedStart=tks<minD?minD:tks;
    const l=Math.max(0,Math.round((clippedStart-minD)/86400000)*pxPerDay);
    const fullW=Math.max(4,Math.round((tke-tks)/86400000+1)*pxPerDay);
    // Reduce width by how much was clipped on the left
    const clippedDays=tks<minD?Math.round((minD-tks)/86400000):0;
    const w=Math.max(4,fullW-clippedDays*pxPerDay);
    const isDone=taskIsDone(tk);
    const clr=isDone?'#10b981':(tk.dueDate&&tk.dueDate<today())?'#ef4444':(tk.color||'#7c3aed');
    return `<div class="g-row">
      <div class="g-tl">
        <div class="tchk ${isDone?'done':''}" style="width:16px;height:16px;flex-shrink:0" onclick="toggleTask('${tk.id}')">
          ${isDone?`<svg width="10" height="10" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>`:''}
        </div>
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(tk.title)}">${esc(tk.title)}</div>
          <div style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tk.phase||taskPhaseValue(tk))}</div>
        </div>
      </div>
      <div class="g-bars" style="position:relative">
        <div class="g-bar" style="left:${l}px;width:${w}px;background:${clr};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;color:#fff;font-weight:600;padding:0 8px;box-sizing:border-box;display:flex;align-items:center;min-width:4px;position:absolute" title="${esc(tk.title)} - ${tk.startDate||''} to ${tk.dueDate||''} - ${esc(tk.phase||taskPhaseValue(tk))} - ${esc(taskStatusLabel(tk))}" onclick="openTaskModal('${tk.id}')">${esc(tk.title)}</div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="_ganttOffset--;renderGantt(proj())" title="${isES?'Anterior':'Previous'}">&#8592;</button>
      <button class="btn btn-ghost btn-sm" onclick="_ganttOffset=0;renderGantt(proj())">${isES?'Hoy':'Reset'}</button>
      <button class="btn btn-ghost btn-sm" onclick="_ganttOffset++;renderGantt(proj())" title="${isES?'Siguiente':'Next'}">&#8594;</button>
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
        <button class="btn btn-ghost btn-sm" onclick="_ganttZoom=Math.max(2,_ganttZoom-4);renderGantt(proj())" title="${isES?'Alejar':'Zoom out'}">-</button>
        <span style="font-size:11px;color:var(--muted);min-width:40px;text-align:center">${isES?'Zoom':'Zoom'}</span>
        <button class="btn btn-ghost btn-sm" onclick="_ganttZoom=Math.min(60,_ganttZoom+4);renderGantt(proj())" title="${isES?'Acercar':'Zoom in'}">+</button>
      </div>
    </div>
    <div class="gantt-wrap"><div class="gantt-scroll"><div class="gantt-inner" style="min-width:${220+totalW}px">
      <div class="g-hdr">
        <div class="g-lbl-col">${t('task')}</div>
        <div class="g-months">${months.map(m=>`<div class="g-month" style="width:${m.days*pxPerDay}px;flex-shrink:0">${m.lbl}</div>`).join('')}</div>
      </div>
      <div style="display:flex;margin-left:220px;border-bottom:1px solid var(--border);background:var(--bg2)">
        ${weekCells.join('')}
      </div>
      ${rows}
    </div></div></div>`;
  // Allow simultaneous horizontal (gantt) and vertical (page) scrolling.
  // Without this the browser locks to one axis for the entire wheel gesture.
  var gs = el.querySelector('.gantt-scroll');
  if(gs){
    gs.addEventListener('wheel', function(e){
      if(e.deltaX !== 0){
        gs.scrollLeft += e.deltaX;
        if(e.deltaY !== 0) window.scrollBy(0, e.deltaY);
        e.preventDefault();
      }
    }, {passive:false});
  }
}
function dupTask(id){
  const p=proj(); const tk=p.tasks.find(function(t){ return t.id===id; }); if(!tk) return;
  const copy=JSON.parse(JSON.stringify(tk));
  copy.id='t'+Date.now();
  copy.title=(tk.title||'Task')+' (Copy)';
  p.tasks.push(copy);
  saveProj(p); renderTimeline(); toast(LANG==='es'?'Tarea duplicada':'Task duplicated','s');
}
var calD=new Date();
function renderCal(p){
  const el=document.getElementById('tview-content');
  const tasks=filterTasks(p.tasks);
  if(!tasks.length){el.innerHTML=`<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${taskSearchQuery.trim()?t('no_tasks_found'):t('no_tasks_yet')}</div>`;return;}
  const yr=calD.getFullYear();const mo=calD.getMonth();
  const fd=new Date(yr,mo,1).getDay();const dim=new Date(yr,mo+1,0).getDate();
  const mn=calD.toLocaleString('default',{month:'long',year:'numeric'});
  const tod=today();const tbd={};
  tasks.forEach(tk=>{if(!tbd[tk.dueDate])tbd[tk.dueDate]=[];tbd[tk.dueDate].push(tk);});
  let cells='';
  for(let i=0;i<fd;i++)cells+=`<div class="cal-cell"><div class="cal-date om"></div></div>`;
  for(let i=1;i<=dim;i++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const tks=tbd[ds]||[];
    cells+=`<div class="cal-cell"><div class="cal-date ${ds===tod?'today':''}">${i}</div>${tks.map(tk=>`<div class="cal-ev" style="background:${taskIsDone(tk)?'#10b981':tk.color||'#a67c3d'};cursor:pointer" title="${esc(tk.title)}" onclick="openTaskModal('${tk.id}')">${esc(tk.title)}</div>`).join('')}</div>`;
  }
  const rem=42-fd-dim;for(let i=0;i<rem;i++)cells+=`<div class="cal-cell"><div class="cal-date om"></div></div>`;
  el.innerHTML=`<div class="cal-wrap">
    <div class="cal-hdr">
      <div class="cal-mn">${mn}</div>
      <div style="display:flex;gap:8px">
        <button class="cal-nav-btn" onclick="calD.setMonth(calD.getMonth()-1);renderCal(proj())">&#8592;</button>
        <button class="cal-nav-btn" onclick="calD.setMonth(calD.getMonth()+1);renderCal(proj())">&#8594;</button>
      </div>
    </div>
    <div class="cal-dh">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-dh-cell">${d}</div>`).join('')}</div>
    <div class="cal-cells">${cells}</div>
  </div>`;
}
function toggleTask(tid){const p=proj();const tk=p.tasks.find(tk=>tk.id===tid);if(tk){const nextDone=!taskIsDone(tk);tk.done=nextDone;tk.status=nextDone?'completed':'not-started';saveProj(p);renderTimeline();}}
function delTask(tid){
  openConfirmModal({
    title: LANG==='es'?'Eliminar tarea':'Delete task',
    message: LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm: function(){ const p=proj();p.tasks=p.tasks.filter(tk=>tk.id!==tid);saveProj(p);renderTimeline(); }
  });
}
function openTaskModal(tid){
  const p=proj();const tk=tid?p.tasks.find(x=>x.id===tid):null;
  const colors=['#7c3aed','#a67c3d','#10b981','#f59e0b','#ec4899','#ef4444'];
  openMo(`<div class="mo-title">${tk?t('edit_task'):t('add_task')}</div>
  <div class="ig" style="margin-bottom:12px"><label>${t('task_title_lbl')} *</label><input class="input" id="tk-title" value="${esc(tk?.title||'')}" placeholder="${t('task_title_lbl')}"></div>
  <div class="ig" style="margin-bottom:12px"><label>${t('description_lbl')}</label><textarea class="textarea" id="tk-desc" rows="2" placeholder="Describe the task...">${tk?.desc||''}</textarea></div>
  <div class="form-grid" style="margin-bottom:12px">
    <div class="ig"><label>${LANG==='es'?'Fecha de Inicio *':'Start Date *'}</label>
      <div class="date-field">
        <input class="input date-field-input" id="tk-start" type="text" value="${tk?.startDate?formatDMY(tk.startDate):''}" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker('tk-start')" onfocus="openCalendarPicker('tk-start')">
        <button type="button" class="date-field-btn" onclick="openCalendarPicker('tk-start')" aria-label="${LANG==='es'?'Fecha de Inicio':'Start Date'}">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </button>
      </div>
    </div>
    <div class="ig"><label>${t('due_date_lbl')} *</label>
      <div class="date-field">
        <input class="input date-field-input" id="tk-due" type="text" value="${tk?.dueDate?formatDMY(tk.dueDate):''}" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker('tk-due')" onfocus="openCalendarPicker('tk-due')">
        <button type="button" class="date-field-btn" onclick="openCalendarPicker('tk-due')" aria-label="${t('due_date_lbl')}">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </button>
      </div>
    </div>
  </div>
  <div class="form-grid" style="margin-bottom:12px">
    <div class="ig"><label>${t('assignee')}</label><input class="input" id="tk-who" value="${esc(tk?.assignee||'')}" placeholder="Event Coordinator"></div>
    <div class="ig"><label>${LANG==='es'?'Duración (días)':'Duration (days)'}</label><input class="input" id="tk-duration" type="number" min="1" value="${esc(String(tk?.durationDays||''))}" placeholder="5"></div>
  </div>
  <div class="form-grid" style="margin-bottom:12px">
    <div class="ig"><label>${LANG==='es'?'Fase':'Phase'}</label><input class="input" id="tk-phase" value="${esc(tk?.phase||'')}" placeholder="Strategy & Budget"></div>
    <div class="ig"><label>${LANG==='es'?'Estado':'Status'}</label><select class="select" id="tk-status">
      <option value="not-started"${taskStatusValue(tk)==='not-started'?' selected':''}>${LANG==='es'?'No iniciada':'Not started'}</option>
      <option value="in-progress"${taskStatusValue(tk)==='in-progress'?' selected':''}>${LANG==='es'?'En progreso':'In progress'}</option>
      <option value="completed"${taskStatusValue(tk)==='completed'?' selected':''}>${LANG==='es'?'Completada':'Completed'}</option>
    </select></div>
  </div>
  <div class="ig" style="margin-bottom:12px"><label>${LANG==='es'?'Ventana recomendada':'Recommended planning window'}</label><input class="input" id="tk-window" value="${esc(tk?.planningWindow||'')}" placeholder="${LANG==='es'?'6 meses antes':'6 months before'}"></div>
  <div class="ig" style="margin-bottom:4px"><label>${t('color_label_lbl')}</label></div>
  <div style="display:flex;gap:10px;margin-bottom:16px">
    ${colors.map(cl=>`<div onclick="pickColor(this,'${cl}')" data-color="${cl}" style="width:28px;height:28px;border-radius:50%;background:${cl};cursor:pointer;border:3px solid ${(tk?.color||colors[0])===cl?'#000':'transparent'};transition:all .15s"></div>`).join('')}
  </div>
  <input type="hidden" id="tk-color" value="${tk?.color||colors[0]}">
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-primary" onclick="saveTask('${tid||''}')">${t('save_task')}</button>
  </div>`);
}
function pickColor(el,c){document.querySelectorAll('#mo-body [data-color]').forEach(d=>d.style.borderColor='transparent');el.style.borderColor='#000';document.getElementById('tk-color').value=c;}
function saveTask(tid){
  const title=gv('tk-title');const due=parseUserDate(gv('tk-due'));const start=parseUserDate(gv('tk-start'));
  if(!title||!start||!due)return toast(LANG==='es'?'Título, fecha de inicio y fecha límite son requeridos':'Title, start date and due date required','e');
  const durationInput=parseInt(gv('tk-duration'),10);
  const durationDays=Number.isFinite(durationInput)&&durationInput>0 ? durationInput : Math.max(1, Math.round((timelineTemplateDate(due)-timelineTemplateDate(start))/86400000)+1);
  const status=gv('tk-status')||'not-started';
  const p=proj();
  const data={title,desc:gv('tk-desc'),startDate:start,dueDate:due,endDate:due,durationDays:durationDays,assignee:gv('tk-who'),phase:gv('tk-phase').trim()||taskPhaseValue({title:title,assignee:gv('tk-who')}),planningWindow:gv('tk-window').trim(),status:status,done:status==='completed',color:gv('tk-color')};
  if(tid){const tk=p.tasks.find(tk=>tk.id===tid);if(tk) Object.assign(tk,data);}
  else{if(!p.tasks) p.tasks=[];p.tasks.push({id:'t'+Date.now(),...data});}
  saveProj(p);closeMo();renderTimeline();toast(tid?'Task updated':'Task added','s');
}

var gView='list',gSort='name',gAsc=true,gFilter='';
var _gFilterTimer=null, _seatingFilterTimer=null, _tSearchTimer=null;
function _guestMatchesFilter(g,q){ return [g.name,g.email,g.phone,g.category,g.rsvp,g.table,g.notes,g.meal].some(function(f){return f&&String(f).toLowerCase().indexOf(q)!==-1;}); }
function _truncSearch(v){ return typeof v==='string'&&v.length>200?v.substring(0,200):(v||''); }
function debouncedGuestFilter(val){ gFilter=_truncSearch(val); clearTimeout(_gFilterTimer); _gFilterTimer=setTimeout(function(){ renderGuestRows(proj()); },250); }
function debouncedSeatingFilter(val){ gFilter=_truncSearch(val); clearTimeout(_seatingFilterTimer); _seatingFilterTimer=setTimeout(function(){ renderSeating(proj()); var el=document.getElementById('seating-search-input'); if(el){el.focus();el.value=val;try{el.setSelectionRange(val.length,val.length);}catch(e){}} },250); }
function debouncedTaskSearch(val){ taskSearchQuery=_truncSearch(val); clearTimeout(_tSearchTimer); _tSearchTimer=setTimeout(function(){ renderTimelineView(proj()); },250); }
function clearSearchTimers(){ clearTimeout(_gFilterTimer); clearTimeout(_seatingFilterTimer); clearTimeout(_tSearchTimer); _gFilterTimer=null; _seatingFilterTimer=null; _tSearchTimer=null; }
function renderGuestEmptyState(){
  const isES=LANG==='es';
  return `<section class="ev-empty fade-in">
    <div class="ev-empty-shell">
      <div class="ev-empty-aurora" aria-hidden="true"></div>
      <div class="ev-empty-grid">
        <div class="ev-empty-copy">
          <div class="ev-empty-badge">${isES?'Lista de invitados':'Guest list'}</div>
          <h2 class="ev-empty-title">${isES?'Construye tu lista de invitados en minutos.':'Build your guest list in minutes.'}</h2>
          <p class="ev-empty-subtitle">${isES?'Descarga la plantilla de Excel, llénala con tus invitados e impórtala de vuelta. También puedes agregar invitados manualmente uno a uno.':'Download the Excel template, fill it in with your guests, and import it back. You can also add guests one by one manually.'}</p>
          <div class="ev-empty-actions">
            <button class="btn btn-primary btn-create-gradient ev-empty-cta" onclick="downloadGuestTemplate()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${isES?'Descargar Plantilla':'Download Template'}
            </button>
            <label class="btn btn-ghost ev-empty-cta" style="cursor:pointer">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              ${isES?'Importar Invitados':'Import Guests'}
              <input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)">
            </label>
            <button class="btn btn-ghost ev-empty-cta" onclick="openGuestModal()">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${isES?'Agregar Manualmente':'Add Manually'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}
function renderGuests(){
  const p=proj();const el=document.getElementById('tab-guests');
  if(!p||!el) return;
  if(!p.guests||!p.guests.length){el.innerHTML=renderGuestEmptyState();return;}
  const guestCount=p.guests.length;
  const plusOnes=p.guests.filter(g=>g.plusOne).length;
  const totalGuests=guestCount+plusOnes;
  const confirmedGuests=p.guests.filter(g=>g.rsvp==='confirmed').length;
  const confirmedPlusOnes=p.guests.filter(g=>g.rsvp==='confirmed'&&g.plusOne).length;
  const confirmed=confirmedGuests+confirmedPlusOnes;
  const declinedGuests=p.guests.filter(g=>g.rsvp==='declined').length;
  const declinedPlusOnes=p.guests.filter(g=>g.rsvp==='declined'&&g.plusOne).length;
  const declined=declinedGuests+declinedPlusOnes;
  const pendingGuests=p.guests.filter(g=>!g.rsvp||g.rsvp==='pending').length;
  const pendingPlusOnes=p.guests.filter(g=>(!g.rsvp||g.rsvp==='pending')&&g.plusOne).length;
  const pending=pendingGuests+pendingPlusOnes;
  const tables=[...new Set(p.guests.filter(g=>g.table).map(g=>g.table))].length;
  el.innerHTML=`
  <div class="sh">
    <div><div class="sh-title" style="color:var(--text)">${t('guest_management')}</div>
    <div class="sh-sub">${totalGuests} ${t('total')} &middot; ${confirmed} ${t('confirmed_guests')} &middot; ${pending} ${t('pending_guests')}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="downloadGuestTemplate()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ${t('download_template')}
      </button>
      <label class="btn btn-ghost btn-sm" style="cursor:pointer">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        ${LANG==='es'?'Importar Invitados':'Import Guests'}<input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)">
      </label>
      <button class="btn btn-ghost btn-sm" onclick="exportGuestsExcel()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ${LANG==='es'?'Exportar Invitados':'Export Guests'}
      </button>
      <button class="btn btn-primary btn-create-gradient btn-sm" onclick="openGuestModal()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${t('add_guest')}
      </button>
    </div>
  </div>
  <div class="gs-stats">
    <div class="gs-stat" title="${LANG==='es'?'Invitados principales en la lista, sin acompañantes.':'Primary guests on the list, excluding plus ones.'}"><div class="gs-val">${guestCount}</div><div class="gs-lbl">${LANG==='es'?'Invitados':'Guests'}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Acompañantes marcados como +1 en la lista.':'Guests marked as plus ones on the list.'}"><div class="gs-val">${plusOnes}</div><div class="gs-lbl">${LANG==='es'?'Plus Ones':'Plus Ones'}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Total de asistentes previstos: invitados ('+guestCount+') + plus ones ('+plusOnes+').':'Total expected attendees: guests ('+guestCount+') + plus ones ('+plusOnes+').'}"><div class="gs-val">${totalGuests}</div><div class="gs-lbl">${t('total_guests')}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Confirmados: invitados ('+confirmedGuests+') + plus ones ('+confirmedPlusOnes+').':'Confirmed: guests ('+confirmedGuests+') + plus ones ('+confirmedPlusOnes+').'}"><div class="gs-val" style="color:var(--success)">${confirmed}</div><div class="gs-lbl">${t('confirmed_guests')}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Pendientes: invitados ('+pendingGuests+') + plus ones ('+pendingPlusOnes+').':'Pending: guests ('+pendingGuests+') + plus ones ('+pendingPlusOnes+').'}"><div class="gs-val" style="color:var(--warn)">${pending}</div><div class="gs-lbl">${t('pending')}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Rechazados: invitados ('+declinedGuests+') + plus ones ('+declinedPlusOnes+').':'Declined: guests ('+declinedGuests+') + plus ones ('+declinedPlusOnes+').'}"><div class="gs-val" style="color:var(--danger)">${declined}</div><div class="gs-lbl">${t('declined')}</div></div>
    <div class="gs-stat" title="${LANG==='es'?'Número de mesas asignadas actualmente en la lista de invitados.':'Number of tables currently assigned in the guest list.'}"><div class="gs-val" style="color:var(--gold-h)">${tables}</div><div class="gs-lbl">${t('tables')}</div></div>
  </div>
  <div class="tbar">
    <button class="tb ${gView==='list'?'active':''}" onclick="gView='list';renderGuests()">${LANG==='es'?'Todos los Invitados':'All Guests'}</button>
    <button class="tb ${gView==='seating'?'active':''}" onclick="gView='seating';renderGuests()">${LANG==='es'?'Asignación por Mesas':'Table Assignments'}</button>
  </div>
  <div id="gview"></div>
  ${renderMobileStickyActionBar(`
    <label class="btn btn-ghost" style="cursor:pointer">
      ${LANG==='es'?'Importar':'Import'}<input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)">
    </label>
    <button class="btn btn-primary btn-create-gradient" onclick="openGuestModal()">${t('add_guest')}</button>
  `)}`;
  gView==='list'?renderGuestList(p):renderSeating(p);
}
function guestText(v){
  return esc(fixMojibake(String(v == null ? '' : v)));
}
function guestValueOrDash(v){
  var fixed = fixMojibake(String(v == null ? '' : v)).trim();
  return fixed ? esc(fixed) : '&mdash;';
}
function guestRsvpValue(v){
  var fixed = fixMojibake(String(v == null ? '' : v)).trim().toLowerCase();
  return fixed || 'pending';
}
function guestRsvpClass(v){
  var value = guestRsvpValue(v);
  return value === 'confirmed' ? 'rb-c' : value === 'declined' ? 'rb-d' : 'rb-p';
}

function openGuestModal(gid){
  const p=proj();const g=gid?p.guests.find(x=>x.id===gid):null;
  openMo(`<div class="mo-title">${g?t('edit_guest'):t('add_guest')}</div>
  <div class="form-grid">
    <div class="ig" style="grid-column:1/-1"><label>${t('full_name')} *</label><input class="input" id="gf-name" value="${esc(g?.name||'')}" placeholder="Jane Smith"></div>
    <div class="ig"><label>Email</label><input class="input" id="gf-email" type="email" value="${esc(g?.email||'')}" placeholder="jane@email.com"></div>
    <div class="ig"><label>Phone</label><input class="input" id="gf-phone" value="${esc(g?.phone||'')}" placeholder="555-0000"></div>
    <div class="ig"><label>${t('category')}</label><select class="select" id="gf-cat">${['Family','Friends','Work','VIP','Other'].map(c=>`<option${g?.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
    <div class="ig"><label>${t('rsvp_status')}</label><select class="select" id="gf-rsvp"><option value="pending"${(!g?.rsvp||g.rsvp==='pending')?' selected':''}>${t('pending_guests')}</option><option value="confirmed"${g?.rsvp==='confirmed'?' selected':''}>Confirmed</option><option value="declined"${g?.rsvp==='declined'?' selected':''}>Declined</option></select></div>
    <div class="ig"><label>${t('table_number')}</label><input class="input" id="gf-table" value="${esc(g?.table||'')}" placeholder="e.g. 1, A, VIP"></div>
    <div class="ig"><label>${t('plus_one_q')}</label><select class="select" id="gf-plus"><option value="0"${!g?.plusOne?' selected':''}>${t('no')}</option><option value="1"${g?.plusOne?' selected':''}>${t('yes')}</option></select></div>
    <div class="ig"><label>${t('meal_pref')}</label><select class="select" id="gf-meal">${['','Chicken','Fish','Beef','Vegetarian','Vegan','Kids Menu'].map(m=>`<option${g?.meal===m?' selected':''}>${m}</option>`).join('')}</select></div>
    <div class="ig" style="grid-column:1/-1"><label>${t('dietary_rest')}</label><input class="input" id="gf-diet" value="${esc(g?.dietary||'')}" placeholder="e.g. Gluten-free, Nut allergy"></div>
    <div class="ig" style="grid-column:1/-1"><label>Notes</label><textarea class="textarea" id="gf-notes" rows="2">${esc(g?.notes||'')}</textarea></div>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-primary" onclick="saveGuest('${gid||''}')">${t('save_guest')}</button>
  </div>`);
}

function renderSeating(p){
  let seated = p.guests.filter(g => g.table);
  if(gFilter){var _sfq=gFilter.toLowerCase();seated=seated.filter(function(g){return _guestMatchesFilter(g,_sfq);});}
  seated = seated.sort((a,b) => a.table.localeCompare(b.table, undefined, { numeric:true }));
  const tables = [...new Set(seated.map(g => g.table))];
  document.getElementById('gview').innerHTML = `<div style="background:var(--card-solid);border-radius:var(--r);border:1px solid var(--border);overflow:hidden">
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg2)">
      <input class="input" id="seating-search-input" style="flex:1;min-width:200px" placeholder="${t('search_guests')}" aria-label="${t('search_guests')}" value="${esc(gFilter)}" oninput="debouncedSeatingFilter(this.value)">
    </div>
    <div style="padding:16px">
      ${tables.length ? tables.map(tb => {
        const gs = seated.filter(g => g.table === tb);
        return `<div style="margin-bottom:20px">
          <div class="seating-th">${t('table_header')} ${tb} &middot; ${gs.length} ${t('guests_lbl')}</div>
          ${gs.map(g => `<div class="seating-row">
            <div><strong>${guestText(g.name)}</strong>${g.plusOne ? ' <span class="s-sm">+1</span>' : ''}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
              <span>${guestValueOrDash(g.meal)}</span>
              <span class="rb ${guestRsvpClass(g.rsvp)}">${guestText(guestRsvpValue(g.rsvp))}</span>
            </div>
          </div>`).join('')}
        </div>`;
      }).join('') : `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">${t('no_guests_found')}</div>`}
    </div>
  </div>`;
}
function saveGuest(gid){
  const name=gv('gf-name');if(!name)return toast(LANG==='es'?'El nombre es requerido':'Name required','e');
  const p=proj();
  const data={name,email:gv('gf-email'),phone:gv('gf-phone'),category:gv('gf-cat'),rsvp:gv('gf-rsvp'),table:gv('gf-table'),plusOne:gv('gf-plus')==='1',meal:gv('gf-meal'),dietary:gv('gf-diet'),notes:gv('gf-notes')};
  if(gid){const g=p.guests.find(g=>g.id===gid);if(g) Object.assign(g,data);}
  else{if(!p.guests) p.guests=[];p.guests.push({id:'g'+Date.now(),...data});}
  saveProj(p);closeMo();renderGuests();toast(gid?'Guest updated':'Guest added','s');
}

function exportGuestsCSV(){
  var p=proj();
  if(!p||!Array.isArray(p.guests)||!p.guests.length) return toast(LANG==='es'?'No hay invitados para exportar':'No guests to export','e');
  var isES=LANG==='es';
  var headers=[isES?'Nombre':'Name','Email',isES?'Telefono':'Phone',isES?'Categoria':'Category','RSVP',isES?'Mesa':'Table',isES?'Acompanante':'Plus One',isES?'Comida':'Meal',isES?'Restricciones':'Dietary',isES?'Notas':'Notes'];
  var csvRow=function(arr){return arr.map(function(v){var s=String(v||'').replace(/"/g,'""');return s.indexOf(',')>-1||s.indexOf('"')>-1||s.indexOf('\n')>-1?'"'+s+'"':s;}).join(',');};
  var lines=[csvRow(headers)];
  p.guests.forEach(function(g){
    lines.push(csvRow([g.name,g.email,g.phone,g.category,g.rsvp||'pending',g.table,g.plusOne?(isES?'Si':'Yes'):(isES?'No':'No'),g.meal,g.dietary,g.notes]));
  });
  var blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=(p.name||'guests')+'-guests.csv';a.click();
  URL.revokeObjectURL(url);
  toast(isES?'CSV exportado':'CSV exported','s');
}

function exportGuestsExcel(){
  const p = proj();
  if(!p || !Array.isArray(p.guests) || !p.guests.length) return toast(LANG==='es'?'No hay invitados para exportar':'No guests to export','e');
  const rows = p.guests.map(function(g){
    return [
      g.name || '',
      g.email || '',
      g.phone || '',
      g.category || '',
      g.rsvp || 'pending',
      g.table || '',
      g.plusOne ? (LANG==='es' ? 'Si' : 'Yes') : (LANG==='es' ? 'No' : 'No'),
      g.meal || '',
      g.dietary || '',
      g.notes || ''
    ];
  });
  const headers = [
    LANG==='es' ? 'Nombre' : 'Name',
    'Email',
    LANG==='es' ? 'Telefono' : 'Phone',
    LANG==='es' ? 'Categoria' : 'Category',
    'RSVP',
    LANG==='es' ? 'Mesa' : 'Table',
    LANG==='es' ? 'Acompanante' : 'Plus One',
    LANG==='es' ? 'Comida' : 'Meal',
    LANG==='es' ? 'Restricciones' : 'Dietary',
    LANG==='es' ? 'Notas' : 'Notes'
  ];
  function escCell(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  const table = '<table><thead><tr>'
    + headers.map(function(h){ return '<th>'+escCell(h)+'</th>'; }).join('')
    + '</tr></thead><tbody>'
    + rows.map(function(r){
      return '<tr>' + r.map(function(c){ return '<td>'+escCell(c)+'</td>'; }).join('') + '</tr>';
    }).join('')
    + '</tbody></table>';
  const html = '<html><head><meta charset="utf-8"></head><body>'+table+'</body></html>';
  const blob = new Blob([html], { type:'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (p.name || 'guests').replace(/[\\/:*?"<>|]+/g,'-').trim() || 'guests';
  a.href = url;
  a.download = safeName + '-guests.xls';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

var gSelectedGuestIds = [];
function guestSelectionCount(){ return gSelectedGuestIds.length; }
function isGuestSelected(id){ return gSelectedGuestIds.indexOf(id) > -1; }
function toggleGuestSelection(id, checked){
  if(checked){
    if(!isGuestSelected(id)) gSelectedGuestIds.push(id);
  } else {
    gSelectedGuestIds = gSelectedGuestIds.filter(function(x){ return x !== id; });
  }
  updateGuestBulkBar();
}
function clearGuestSelection(){
  gSelectedGuestIds = [];
  updateGuestBulkBar();
}
function syncGuestSelectionToVisible(){
  document.querySelectorAll('.guest-sel').forEach(function(chk){
    chk.checked = isGuestSelected(chk.dataset.gid);
  });
  var visible = document.querySelectorAll('.guest-sel').length;
  var checked = document.querySelectorAll('.guest-sel:checked').length;
  var all = document.getElementById('guest-chk-all');
  if(all) all.checked = visible > 0 && visible === checked;
}
function updateGuestBulkBar(){
  var bar = document.getElementById('guest-bulk-bar');
  var lbl = document.getElementById('guest-bulk-count');
  if(bar) bar.style.display = guestSelectionCount() ? 'flex' : 'none';
  if(lbl) lbl.textContent = guestSelectionCount() + ' ' + (LANG==='es' ? 'seleccionado(s)' : 'selected');
  syncGuestSelectionToVisible();
}
function toggleAllVisibleGuests(checked){
  document.querySelectorAll('.guest-sel').forEach(function(chk){
    if(checked && !isGuestSelected(chk.dataset.gid)) gSelectedGuestIds.push(chk.dataset.gid);
    if(!checked) gSelectedGuestIds = gSelectedGuestIds.filter(function(x){ return x !== chk.dataset.gid; });
  });
  updateGuestBulkBar();
}
function openBulkGuestEditModal(){
  if(!guestSelectionCount()) return;
  openMo(`<div class="mo-title">${LANG==='es'?'Editar invitados seleccionados':'Edit selected guests'}</div>
  <div class="form-grid">
    <div class="ig"><label>${t('category')}</label><select class="select" id="bg-cat">
      <option value="">${LANG==='es'?'Sin cambios':'No change'}</option>
      ${['Family','Friends','Work','VIP','Other'].map(c=>`<option value="${c}">${c}</option>`).join('')}
    </select></div>
    <div class="ig"><label>${t('rsvp_status')}</label><select class="select" id="bg-rsvp">
      <option value="">${LANG==='es'?'Sin cambios':'No change'}</option>
      <option value="pending">${t('pending_guests')}</option>
      <option value="confirmed">Confirmed</option>
      <option value="declined">Declined</option>
    </select></div>
    <div class="ig"><label>${t('table_number')}</label><input class="input" id="bg-table" placeholder="${LANG==='es'?'Sin cambios':'No change'}"></div>
    <div class="ig"><label>${t('meal_pref')}</label><select class="select" id="bg-meal">
      <option value="">${LANG==='es'?'Sin cambios':'No change'}</option>
      ${['__clear__','Chicken','Fish','Beef','Vegetarian','Vegan','Kids Menu'].map(m=>`<option value="${m}">${m==='__clear__'?(LANG==='es'?'Limpiar':'Clear'):m}</option>`).join('')}
    </select></div>
    <div class="ig"><label>${t('plus_one_q')}</label><select class="select" id="bg-plus">
      <option value="">${LANG==='es'?'Sin cambios':'No change'}</option>
      <option value="1">${t('yes')}</option>
      <option value="0">${t('no')}</option>
    </select></div>
    <div class="ig" style="grid-column:1/-1"><label>Notes</label><textarea class="textarea" id="bg-notes" rows="2" placeholder="${LANG==='es'?'Sin cambios si lo dejas vacío':'Leave empty for no change'}"></textarea></div>
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button class="btn btn-primary" onclick="applyBulkGuestEdit()">${LANG==='es'?'Aplicar cambios':'Apply changes'}</button>
  </div>`);
}
function applyBulkGuestEdit(){
  const p = proj();
  const selected = p.guests.filter(function(g){ return isGuestSelected(g.id); });
  if(!selected.length) return closeMo();
  const cat = gv('bg-cat');
  const rsvp = gv('bg-rsvp');
  const table = gv('bg-table');
  const meal = gv('bg-meal');
  const plus = gv('bg-plus');
  const notes = gv('bg-notes');
  selected.forEach(function(g){
    if(cat) g.category = cat;
    if(rsvp) g.rsvp = rsvp;
    if(table) g.table = table;
    if(meal) g.meal = meal==='__clear__' ? '' : meal;
    if(plus!=='') g.plusOne = plus==='1';
    if(notes) g.notes = notes;
  });
  saveProj(p);
  closeMo();
  renderGuests();
  toast(LANG==='es'?'Invitados actualizados':'Guests updated','s');
}
function bulkDeleteGuests(){
  if(!guestSelectionCount()) return;
  openConfirmModal({
    title: LANG==='es'?'Eliminar invitados':'Delete guests',
    message: LANG==='es'?'¿Eliminar los invitados seleccionados?':'Delete selected guests?',
    onConfirm: function(){
      const p = proj();
      p.guests = p.guests.filter(function(g){ return !isGuestSelected(g.id); });
      saveProj(p); clearGuestSelection(); renderGuests();
      toast(LANG==='es'?'Invitados eliminados':'Guests deleted','s');
    }
  }); return;
}
function delGuest(gid){
  openConfirmModal({
    title: LANG==='es'?'Eliminar invitado':'Delete guest',
    message: LANG==='es'?'Esta acción no se puede deshacer.':'This action cannot be undone.',
    onConfirm: function(){
      const p = proj();
      p.guests = p.guests.filter(g => g.id !== gid);
      gSelectedGuestIds = gSelectedGuestIds.filter(id => id !== gid);
      saveProj(p); renderGuests();
    }
  });
}
function renderGuestList(p){
  let guests=[...p.guests];
  if(gFilter){var _gfq=gFilter.toLowerCase();guests=guests.filter(function(g){return _guestMatchesFilter(g,_gfq);});}
  guests.sort((a,b)=>{const va=String(a[gSort]||''),vb=String(b[gSort]||'');return gAsc?va.localeCompare(vb,undefined,{numeric:true}):vb.localeCompare(va,undefined,{numeric:true});});
  if(isPhoneViewport()){
    document.getElementById('gview').innerHTML = renderGuestMobileCards(guests);
    updateGuestBulkBar();
    return;
  }
  const si=k=>gSort===k?(gAsc?'&uarr;':'&darr;'):'&harr;';
  document.getElementById('gview').innerHTML=`
  <div style="background:var(--card-solid);border-radius:var(--r);border:1px solid var(--border);overflow:hidden">
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg2)">
      <input class="input" style="flex:1;min-width:200px" placeholder="${t('search_guests')}" aria-label="${t('search_guests')}" value="${esc(gFilter)}" oninput="debouncedGuestFilter(this.value)">
      <select class="select" style="width:auto" onchange="gSort=this.value;renderGuestList(proj())">
        <option value="name" ${gSort==='name'?'selected':''}>${t('sort_name')}</option>
        <option value="rsvp" ${gSort==='rsvp'?'selected':''}>${t('sort_rsvp')}</option>
        <option value="table" ${gSort==='table'?'selected':''}>${t('sort_table')}</option>
        <option value="category" ${gSort==='category'?'selected':''}>${t('sort_category')}</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="gAsc=!gAsc;renderGuestList(proj())">${gAsc?t('asc'):t('desc')}</button>
    </div>
    <div id="guest-bulk-bar" style="display:${guestSelectionCount()?'flex':'none'};padding:10px 16px;border-bottom:1px solid var(--border);gap:8px;align-items:center;flex-wrap:wrap;background:var(--gold-l)">
      <span id="guest-bulk-count" style="font-size:12px;font-weight:600;color:var(--gold-h)">${guestSelectionCount()} ${LANG==='es'?'seleccionado(s)':'selected'}</span>
      <button class="btn btn-ghost btn-sm" onclick="openBulkGuestEditModal()">${LANG==='es'?'Editar seleccionados':'Edit selected'}</button>
      <button class="btn btn-danger btn-sm" onclick="bulkDeleteGuests()">${LANG==='es'?'Eliminar seleccionados':'Delete selected'}</button>
      <button class="btn btn-ghost btn-sm" onclick="clearGuestSelection()">${LANG==='es'?'Limpiar selección':'Clear selection'}</button>
    </div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" id="guest-chk-all" style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="toggleAllVisibleGuests(this.checked)"></th>
        <th onclick="gSort='name';gAsc=gSort==='name'?!gAsc:true;renderGuestList(proj())">${t('col_name')} ${si('name')}</th>
        <th>${t('col_contact')}</th>
        <th onclick="gSort='category';gAsc=gSort==='category'?!gAsc:true;renderGuestList(proj())">${t('col_category')} ${si('category')}</th>
        <th onclick="gSort='rsvp';gAsc=gSort==='rsvp'?!gAsc:true;renderGuestList(proj())">${t('col_rsvp')} ${si('rsvp')}</th>
        <th onclick="gSort='table';gAsc=gSort==='table'?!gAsc:true;renderGuestList(proj())">${t('col_table')} ${si('table')}</th>
        <th>${t('col_plus_one')}</th><th>${t('col_meal')}</th><th>${t('col_notes')}</th><th>${t('col_actions')}</th>
      </tr></thead>
      <tbody id="guest-rows-body">
        ${buildGuestRows(guests)}
      </tbody>
    </table>
    </div>
  </div>`;
  updateGuestBulkBar();
}
function renderGuestMobileCards(guests){
  const isES = LANG==='es';
  const empty = `<div class="mobile-record-card" style="text-align:center;color:var(--muted)">${t('no_guests_found')}</div>`;
  return `<div class="mobile-section-toolbar">
      <div style="display:grid;gap:10px">
        <input class="input" placeholder="${t('search_guests')}" aria-label="${t('search_guests')}" value="${esc(gFilter)}" oninput="debouncedGuestFilter(this.value)">
        <div class="mobile-inline-actions">
          <select class="select" style="flex:1;min-width:0" onchange="gSort=this.value;renderGuestList(proj())">
            <option value="name" ${gSort==='name'?'selected':''}>${t('sort_name')}</option>
            <option value="rsvp" ${gSort==='rsvp'?'selected':''}>${t('sort_rsvp')}</option>
            <option value="table" ${gSort==='table'?'selected':''}>${t('sort_table')}</option>
            <option value="category" ${gSort==='category'?'selected':''}>${t('sort_category')}</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="gAsc=!gAsc;renderGuestList(proj())">${gAsc?t('asc'):t('desc')}</button>
          <label class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:8px">
            <input type="checkbox" id="guest-chk-all" style="width:16px;height:16px;accent-color:var(--gold-h);cursor:pointer" onchange="toggleAllVisibleGuests(this.checked)">
            <span>${isES?'Todos':'All'}</span>
          </label>
        </div>
      </div>
      <div id="guest-bulk-bar" class="mobile-inline-actions" style="display:${guestSelectionCount()?'flex':'none'};padding:12px 14px;border:1px solid rgba(166,124,61,.28);border-radius:16px;background:var(--gold-l)">
        <span id="guest-bulk-count" style="font-size:12px;font-weight:700;color:var(--gold-h)">${guestSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
        <button class="btn btn-ghost btn-sm" onclick="openBulkGuestEditModal()">${isES?'Editar':'Edit'}</button>
        <button class="btn btn-danger btn-sm" onclick="bulkDeleteGuests()">${isES?'Eliminar':'Delete'}</button>
        <button class="btn btn-ghost btn-sm" onclick="clearGuestSelection()">${isES?'Limpiar':'Clear'}</button>
      </div>
    </div>
    <div id="guest-mobile-list" class="mobile-card-list">
      ${guests.length ? guests.map(function(g){
        var contact = guestText(g.email);
        if(g.phone) contact += '<br>'+guestText(g.phone);
        return `<article class="mobile-record-card" onclick="openGuestModal('${g.id}')" style="padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px">
            <label onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <input type="checkbox" class="guest-sel" data-gid="${g.id}" ${isGuestSelected(g.id)?'checked':''} style="width:18px;height:18px;accent-color:var(--gold-h);cursor:pointer" onchange="toggleGuestSelection('${g.id}',this.checked)">
            </label>
            <div style="flex:1;min-width:0">
              <div style="font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#242424;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${guestText(g.name)}</div>
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-family:'DM Sans',sans-serif;font-size:12px;color:#787470;margin-top:3px">
                <span>${guestValueOrDash(g.category)}</span>
                ${g.table?'<span>· '+t('table_header')+' '+guestText(g.table)+'</span>':''}
                <span class="rb rb-tap ${guestRsvpClass(g.rsvp)}" onclick="event.stopPropagation();cycleGuestRsvp('${g.id}')" style="margin-left:auto" title="${isES?'Toca para cambiar el RSVP':'Tap to change RSVP'}">${guestText(guestRsvpValue(g.rsvp))}</span>
              </div>
            </div>
          </div>
        </article>`;
      }).join('') : empty}
    </div>`;
}
// Mobile quick-edit: tapping a guest's RSVP pill cycles pending -> confirmed -> declined.
function cycleGuestRsvp(gid){
  var p=proj(); if(!p||!Array.isArray(p.guests)) return;
  var g=p.guests.find(function(x){return x.id===gid;}); if(!g) return;
  var order=['pending','confirmed','declined'];
  var next=order[(order.indexOf(guestRsvpValue(g.rsvp))+1)%order.length];
  g.rsvp=next;
  saveProj(p);
  renderGuests();
  var es=LANG==='es';
  var label=next==='confirmed'?(es?'Confirmado':'Confirmed'):next==='declined'?(es?'Rechazado':'Declined'):(es?'Pendiente':'Pending');
  toast(g.name+': '+label,'s');
}
window.cycleGuestRsvp = cycleGuestRsvp;
// Wrap a guest cell value so clicking it edits that field inline (see gInlineEdit).
function gEditSpan(gid, field, displayVal){
  var v=(displayVal==null||displayVal==='')?'<span style="opacity:.4">&mdash;</span>':displayVal;
  return '<span class="gedit" data-gid="'+gid+'" data-field="'+field+'" onclick="gInlineEdit(this)" title="'+(LANG==='es'?'Clic para editar':'Click to edit')+'">'+v+'</span>';
}
function buildGuestRows(guests){
  if(!guests.length) return `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--muted)">${t('no_guests_found')}</td></tr>`;
  return guests.map(g=>`<tr data-gid="${g.id}">
    <td><input type="checkbox" class="guest-sel" data-gid="${g.id}" ${isGuestSelected(g.id)?'checked':''} style="width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer" onchange="toggleGuestSelection('${g.id}',this.checked)"></td>
    <td style="font-weight:600">${gEditSpan(g.id,'name',guestText(g.name))}</td>
    <td style="font-size:12px;color:var(--muted)">${gEditSpan(g.id,'email',guestText(g.email))}<br>${gEditSpan(g.id,'phone',guestText(g.phone))}</td>
    <td>${gEditSpan(g.id,'category','<span class="badge b-gray">'+guestValueOrDash(g.category)+'</span>')}</td>
    <td>${gEditSpan(g.id,'rsvp','<span class="rb '+guestRsvpClass(g.rsvp)+'">'+guestText(guestRsvpValue(g.rsvp))+'</span>')}</td>
    <td>${gEditSpan(g.id,'table',guestText(g.table))}</td>
    <td>${gEditSpan(g.id,'plusOne',g.plusOne?'&#10003;':'')}</td>
    <td style="font-size:12px">${gEditSpan(g.id,'meal',guestText(g.meal))}</td>
    <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${gEditSpan(g.id,'notes',guestText(g.notes))}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="openGuestModal('${g.id}')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="delGuest('${g.id}')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
    </div></td>
  </tr>`).join('');
}

// Inline-edit a single guest field in place. Click a .gedit cell -> swap to an input/select;
// Enter or blur commits, Escape cancels. The row is rebuilt on commit so badges/pills refresh.
function gInlineEdit(span){
  if(!span || span.getAttribute('data-editing')==='1') return;
  var gid=span.getAttribute('data-gid'), field=span.getAttribute('data-field');
  var p=proj(); var g=p&&Array.isArray(p.guests)?p.guests.find(function(x){return x.id===gid;}):null;
  if(!g) return;
  span.setAttribute('data-editing','1');
  var es=LANG==='es', cur=g[field]==null?'':g[field], editor;
  function selOpts(pairs, sel){
    return pairs.map(function(pr){return '<option value="'+esc(String(pr[0]))+'"'+(String(pr[0])===String(sel)?' selected':'')+'>'+esc(pr[1])+'</option>';}).join('');
  }
  if(field==='category'){
    editor=document.createElement('select'); editor.className='select';
    editor.innerHTML=selOpts([['',''],['Family',es?'Familia':'Family'],['Friends',es?'Amigos':'Friends'],['Work',es?'Trabajo':'Work'],['VIP','VIP'],['Other',es?'Otro':'Other']], cur);
  } else if(field==='rsvp'){
    editor=document.createElement('select'); editor.className='select';
    editor.innerHTML=selOpts([['pending',es?'Pendiente':'Pending'],['confirmed',es?'Confirmado':'Confirmed'],['declined',es?'Rechazado':'Declined']], guestRsvpValue(cur));
  } else if(field==='meal'){
    editor=document.createElement('select'); editor.className='select';
    editor.innerHTML=selOpts([['',''],['Chicken',es?'Pollo':'Chicken'],['Fish',es?'Pescado':'Fish'],['Beef',es?'Res':'Beef'],['Vegetarian',es?'Vegetariano':'Vegetarian'],['Vegan',es?'Vegano':'Vegan'],['Kids Menu',es?'Menú Niños':'Kids Menu']], cur);
  } else if(field==='plusOne'){
    editor=document.createElement('select'); editor.className='select';
    editor.innerHTML=selOpts([['0',es?'No':'No'],['1',es?'Sí':'Yes']], g.plusOne?'1':'0');
  } else {
    editor=document.createElement('input'); editor.className='input'; editor.type=(field==='email'?'email':'text'); editor.value=cur;
  }
  editor.style.cssText='width:100%;min-width:70px;font-size:12px;padding:3px 6px';
  var done=false;
  function rebuildRow(){ var tr=editor.closest('tr'); if(tr) tr.outerHTML=buildGuestRows([g]); }
  function commit(){
    if(done) return; done=true;
    var nv = (field==='plusOne') ? (editor.value==='1') : editor.value;
    if(field==='name' && !String(nv).trim()) nv=g.name; // name is required — revert if blanked
    var changed = (field==='plusOne') ? (g.plusOne!==nv) : (String(g[field]==null?'':g[field])!==String(nv));
    g[field]=nv;
    if(changed) saveProj(p);
    rebuildRow();
  }
  function cancel(){ if(done) return; done=true; rebuildRow(); }
  editor.addEventListener('keydown', function(ev){
    if(ev.key==='Enter'){ ev.preventDefault(); commit(); }
    else if(ev.key==='Escape'){ ev.preventDefault(); cancel(); }
  });
  editor.addEventListener('blur', commit);
  if(editor.tagName==='SELECT') editor.addEventListener('change', commit);
  span.replaceWith(editor);
  editor.focus();
  if(editor.select){ try{ editor.select(); }catch(e){} }
}
function renderGuestRows(p){
  if(isPhoneViewport()){ renderGuestList(p); return; }
  var tbody = document.getElementById('guest-rows-body');
  if(!tbody){ renderGuestList(p); return; }
  var guests=[...p.guests];
  if(gFilter){var _gfq=gFilter.toLowerCase();guests=guests.filter(function(g){return _guestMatchesFilter(g,_gfq);});}
  guests.sort((a,b)=>{const va=String(a[gSort]||''),vb=String(b[gSort]||'');return gAsc?va.localeCompare(vb,undefined,{numeric:true}):vb.localeCompare(va,undefined,{numeric:true});});
  tbody.innerHTML = buildGuestRows(guests);
  updateGuestBulkBar();
}
function importCSV(input){
  const files=Array.from(input.files);
  if(!files.length)return;
  input.value='';
  processImportFiles(files);
}

function processImportFiles(files){
  let allParsed=[];let filesProcessed=0;
  files.forEach(file=>{
    const isExcel=/\.(xlsx|xls)$/i.test(file.name);
    const r=new FileReader();
    r.onload=async function(e){
      let parsed=[];
      try{
        if(isExcel){parsed=await parseGuestFileExcel(e.target.result,file.name);}
        else{parsed=parseGuestFileCSV(decodeCsvBytes(e.target.result),file.name);}
      }catch(err){console.error('Import parse error:',err);}
      allParsed=allParsed.concat(parsed);
      filesProcessed++;
      if(filesProcessed===files.length)showImportPreview(allParsed);
    };
    // Without this, a single unreadable file leaves filesProcessed stuck below
    // files.length and the import preview never opens (silent hang).
    r.onerror=function(){
      console.error('Import: failed to read file', file.name);
      filesProcessed++;
      if(filesProcessed===files.length)showImportPreview(allParsed);
    };
    // Read every file as bytes so CSVs can be decoded with the right charset below.
    r.readAsArrayBuffer(file);
  });
}

// Decode raw CSV bytes into a string, auto-detecting the encoding.  Excel on a Spanish
// Windows commonly saves CSV as Windows-1252/Latin-1 (ñ=0xF1, á=0xE1, …); reading those
// bytes as UTF-8 corrupts the accents.  We honor a UTF-8 BOM, try strict UTF-8 first, and
// fall back to Windows-1252 when the bytes aren't valid UTF-8.
function decodeCsvBytes(buf){
  var bytes = new Uint8Array(buf);
  if(typeof TextDecoder === 'undefined'){
    var s=''; for(var i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
    try{ return decodeURIComponent(escape(s)); }catch(e){ return s; }
  }
  if(bytes.length>=3 && bytes[0]===0xEF && bytes[1]===0xBB && bytes[2]===0xBF){
    return new TextDecoder('utf-8').decode(bytes.subarray(3)); // strip UTF-8 BOM
  }
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }catch(e){
    try{ return new TextDecoder('windows-1252').decode(bytes); }
    catch(e2){ return new TextDecoder('utf-8').decode(bytes); }
  }
}

function normalizeHeader(h){
  return String(h)
    .replace(/\n.*/g,'')
    .replace(/\*/g,'')
    .replace(/\?/g,'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_]/g,'')
    .replace(/_+$/,'');
}

// Map free-text RSVP values (English or Spanish) to the canonical set the app uses
// internally: 'confirmed' | 'declined' | 'pending'.  Without this, an imported Spanish
// "Confirmado"/"Rechazado" is stored verbatim and counted as neither, falling into "pending".
function normalizeRsvp(raw){
  var v=String(raw||'').trim().toLowerCase();
  if(!v) return 'pending';
  var confirmed=['confirmed','confirm','confirmado','confirmada','yes','y','si','sí','going','attending','attend','accepted','accept','asiste','acepta','aceptado','aceptada'];
  var declined=['declined','decline','rechazado','rechazada','no','not attending','regrets','cancelled','canceled','cancelado','cancelada','rechaza','no asiste'];
  if(confirmed.indexOf(v)!==-1) return 'confirmed';
  if(declined.indexOf(v)!==-1) return 'declined';
  // Tolerate minor variations / trailing marks (e.g. "confirmed ✓", "asistirá")
  if(v.indexOf('confirm')===0||v.indexOf('asist')===0||v.indexOf('acept')===0) return 'confirmed';
  if(v.indexOf('declin')===0||v.indexOf('rechaz')===0||v.indexOf('cancel')===0) return 'declined';
  return 'pending';
}
function rowToGuest(obj,filename){
  const name=fixMojibake(obj.full_name||obj.name||obj.guest_name||obj.nombre||obj.nombre_completo||'');
  if(!name||String(name).trim().length<2)return null;
  const rsvpRaw=fixMojibake(obj.rsvp_status||obj.rsvp||obj.status||obj.estado||'pending');
  return{
    _src:filename,
    name:String(name).trim(),
    email:fixMojibake(String(obj.email||obj.correo||'')).trim(),
    phone:fixMojibake(String(obj.phone||obj.telefono||obj.mobile||'')).trim(),
    category:fixMojibake(String(obj.category||obj.categoria||obj.group||obj.grupo||'')).trim(),
    rsvp:normalizeRsvp(fixMojibake(String(rsvpRaw))),
    table:fixMojibake(String(obj.table_number||obj.table||obj.mesa||'')).trim(),
    plusOne:['yes','1','true','sí','si'].includes(fixMojibake(String(obj.plus_one||obj.plusone||obj.acompanante||'')).toLowerCase().trim()),
    meal:fixMojibake(String(obj.meal_preference||obj.meal||obj.menu||obj.comida||'')).trim(),
    dietary:fixMojibake(String(obj.dietary_restrictions||obj.dietary||obj.restricciones||'')).trim(),
    notes:fixMojibake(String(obj.notes||obj.notas||obj.comments||'')).trim()
  };
}

async function parseGuestFileExcel(arrayBuffer,filename){
  if(typeof XLSX === 'undefined' && typeof ensureXLSX === 'function') await ensureXLSX();
  const workbook=XLSX.read(new Uint8Array(arrayBuffer),{type:'array'});
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
  const guests=[];
  rows.forEach(row=>{
    const obj={};
    Object.keys(row).forEach(k=>{obj[normalizeHeader(k)]=row[k];});
    const g=rowToGuest(obj,filename);
    if(g)guests.push(g);
  });
  return guests;
}

function parseGuestFileCSV(text,filename){
  function parseCSVLine(line){
    const result=[];let cur='';let inQuote=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(inQuote&&line[i+1]==='"'){cur+='"';i++;}else inQuote=!inQuote;}
      else if(ch===','&&!inQuote){result.push(cur.trim());cur='';}
      else cur+=ch;
    }
    result.push(cur.trim());return result;
  }
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2)return[];
  const hdrs=parseCSVLine(lines[0]).map(normalizeHeader);
  const guests=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const vals=parseCSVLine(lines[i]);
    const obj={};hdrs.forEach((h,j)=>obj[h]=vals[j]||'');
    const g=rowToGuest(obj,filename);
    if(g)guests.push(g);
  }
  return guests;
}

// Fields compared when an imported row matches an existing guest (name is the match key,
// so it's excluded). Labels are localized.
function guestImportFieldDefs(){
  var es=LANG==='es';
  return [
    {k:'email', label:'Email'},
    {k:'phone', label: es?'Teléfono':'Phone'},
    {k:'category', label: es?'Categoría':'Category'},
    {k:'rsvp', label:'RSVP'},
    {k:'table', label: es?'Mesa':'Table'},
    {k:'plusOne', label:'+1', bool:true},
    {k:'meal', label: es?'Comida':'Meal'},
    {k:'dietary', label: es?'Restricciones':'Dietary'},
    {k:'notes', label: es?'Notas':'Notes'}
  ];
}
function findExistingGuest(p, ng){
  var nm=String(ng.name||'').toLowerCase().trim();
  var em=ng.email?String(ng.email).toLowerCase().trim():'';
  return (p.guests||[]).find(function(eg){
    var en=String(eg.name||'').toLowerCase().trim();
    var ee=eg.email?String(eg.email).toLowerCase().trim():'';
    return (nm && en===nm) || (em && ee===em);
  });
}
// Diff an imported row against the existing guest. Empty imported values never overwrite;
// +1 is only ever added (never auto-removed by an import).
function computeGuestChanges(existing, imported){
  var es=LANG==='es', changes=[];
  guestImportFieldDefs().forEach(function(d){
    if(d.k==='rsvp'){
      var nvr=guestRsvpValue(imported.rsvp), ovr=guestRsvpValue(existing.rsvp);
      if(nvr!==ovr) changes.push({k:'rsvp',label:'RSVP',oldVal:ovr,newVal:nvr,val:nvr});
      return;
    }
    if(d.bool){
      if(imported.plusOne===true && existing.plusOne!==true)
        changes.push({k:'plusOne',label:'+1',oldVal:(es?'No':'No'),newVal:(es?'Sí':'Yes'),val:true});
      return;
    }
    var nv=String(imported[d.k]==null?'':imported[d.k]).trim();
    var ov=String(existing[d.k]==null?'':existing[d.k]).trim();
    if(nv && nv.toLowerCase()!==ov.toLowerCase())
      changes.push({k:d.k,label:d.label,oldVal:ov,newVal:nv,val:imported[d.k]});
  });
  return changes;
}
function importToggleUpdates(checked){
  document.querySelectorAll('.upd-sel').forEach(function(c){ c.checked=checked; });
}

function showImportPreview(newGuests){
  var es=LANG==='es';
  if(!newGuests.length)return toast(es?'No se encontraron invitados válidos en el archivo':'No valid guests found in file(s)','e');
  const p=proj();
  const unique=[]; const updates=[]; let identical=0;
  // String()-guarded so a legacy guest record with a missing name/email can't crash import.
  const existingNames=new Set((p.guests||[]).map(function(g){return String(g.name||'').toLowerCase().trim();}));
  const existingEmails=new Set((p.guests||[]).filter(function(g){return g.email;}).map(function(g){return String(g.email).toLowerCase().trim();}));
  newGuests.forEach(ng=>{
    const nm=String(ng.name||'').toLowerCase().trim();
    const em=ng.email?String(ng.email).toLowerCase().trim():'';
    const isDupe=existingNames.has(nm)||(em && existingEmails.has(em));
    if(isDupe){
      const ex=findExistingGuest(p,ng);
      if(ex){
        const changes=computeGuestChanges(ex,ng);
        // Keep a direct reference to the live guest so the apply step can't miss it
        // (e.g. guests with no/duplicate id).
        if(changes.length) updates.push({id:ex.id,ref:ex,name:ex.name,changes:changes});
        else identical++;
      } else { identical++; } // intra-batch duplicate of a row already counted as new
    } else {
      unique.push(ng);
      if(nm)existingNames.add(nm);   // catch duplicates within the same import batch
      if(em)existingEmails.add(em);
    }
  });
  const srcFiles=[...new Set(newGuests.map(g=>g._src))];

  const updHtml = updates.length ? `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px 16px;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px;flex-wrap:wrap">
      <div style="font-weight:600;font-size:13px;color:var(--gold-h)">&#8635; ${updates.length} ${es?('invitado'+(updates.length>1?'s':'')+' con cambios'):('guest'+(updates.length>1?'s':'')+' with updates')}</div>
      <div style="display:flex;gap:6px">
        <button type="button" class="btn btn-ghost btn-sm" style="font-size:11px" onclick="importToggleUpdates(true)">${es?'Marcar todas':'Select all'}</button>
        <button type="button" class="btn btn-ghost btn-sm" style="font-size:11px" onclick="importToggleUpdates(false)">${es?'Desmarcar todas':'Clear all'}</button>
      </div>
    </div>
    <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">${es?'Estos invitados ya existen. Revisa los cambios y elige cuáles aplicar:':'These guests already exist. Review the changes and choose which to apply:'}</div>
    <div style="max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
      ${updates.map((u,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 11px;background:var(--card-solid);border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" class="upd-sel" data-uidx="${i}" checked style="margin-top:2px;width:15px;height:15px;accent-color:var(--gold-h);cursor:pointer;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12.5px;margin-bottom:3px">${esc(u.name)}</div>
          ${u.changes.map(c=>`<div style="font-size:11.5px;line-height:1.5"><span style="color:var(--light)">${esc(c.label)}:</span> <span style="text-decoration:line-through;opacity:.65">${esc(c.oldVal||'—')}</span> &rarr; <span style="color:var(--text);font-weight:500">${esc(String(c.newVal))}</span></div>`).join('')}
        </div>
      </label>`).join('')}
    </div>
  </div>` : (identical?`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-sm);padding:11px 16px;margin-bottom:16px;font-size:12.5px;color:var(--muted)">${es?'Los invitados que ya existen no tienen cambios.':'No changes for guests that already exist.'}</div>`:'');

  const newCountHtml = unique.length
    ? `<div style="background:var(--success-l);border:1px solid rgba(45,122,94,.25);border-radius:var(--r-sm);padding:11px 16px;margin-bottom:16px;font-size:13px;color:var(--success);font-weight:600">&#10003; ${unique.length} ${es?('invitado'+(unique.length>1?'s':'')+' nuevo'+(unique.length>1?'s':'')):('new guest'+(unique.length>1?'s':''))}</div>`
    : '';

  var btnParts=[];
  if(unique.length) btnParts.push(unique.length+' '+(es?'nuevos':'new'));
  if(updates.length) btnParts.push(updates.length+' '+(es?'cambios':'updates'));
  // The footer button is the ONLY action that actually applies — give it the "Aceptar" verb
  // so a user looking to "accept the changes" clicks the button that really applies them.
  var btnAct = updates.length ? (es?'Aceptar e importar':'Accept & import') : (es?'Importar':'Import');
  const importBtnLabel=btnAct+(btnParts.length?(' ('+btnParts.join(' · ')+')'):'');
  const canImport = unique.length || updates.length;

  openMo(`<div class="mo-title">${es?'Importar Invitados':'Import Guests'}</div>
  <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
    ${es?'Se encontraron':'Found'} <strong style="color:var(--text)">${newGuests.length} ${es?('invitado'+(newGuests.length>1?'s':'')):('guest'+(newGuests.length>1?'s':''))}</strong> ${es?'en':'in'} ${srcFiles.length} ${es?('archivo'+(srcFiles.length>1?'s':'')):('file'+(srcFiles.length>1?'s':''))}
    &nbsp;&#183;&nbsp; <span style="color:var(--success)">${unique.length} ${es?'nuevos':'new'}</span>
    ${updates.length?'&nbsp;&#183;&nbsp; <span style="color:var(--gold-h)">'+updates.length+' '+(es?'con cambios':'updates')+'</span>':''}
    ${identical?'&nbsp;&#183;&nbsp; <span style="color:var(--light)">'+identical+' '+(es?'sin cambios':'unchanged')+'</span>':''}
  </div>
  ${newCountHtml}
  ${updHtml}
  <div style="background:var(--bg2);border-radius:var(--r-sm);padding:12px 16px;font-size:12px;max-height:160px;overflow-y:auto;border:1px solid var(--border)">
    <div style="font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--light);margin-bottom:8px">${es?'Vista previa':'Preview'}</div>
    ${newGuests.slice(0,8).map(g=>`<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:600;flex:1;font-size:12px">${esc(g.name)}</span>
      <span style="color:var(--muted);font-size:12px">${esc(g.email||'—')}</span>
      <span class="rb ${g.rsvp==='confirmed'?'rb-c':g.rsvp==='declined'?'rb-d':'rb-p'}">${esc(g.rsvp)}</span>
    </div>`).join('')}
    ${newGuests.length>8?`<div style="padding:6px 0;color:var(--light);font-size:11px">+ ${newGuests.length-8} ${es?'más...':'more...'}</div>`:''}
  </div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">${es?'Cancelar':'Cancel'}</button>
    <button class="btn btn-primary" onclick="doImport()" ${canImport?'':'disabled'}>${esc(importBtnLabel)}</button>
  </div>`);
  window._pendingImport={unique,updates};
}

function doImport(){
  if(!window._pendingImport)return;
  const {unique,updates}=window._pendingImport;
  const p=proj();let added=0;let updated=0;
  if(!Array.isArray(p.guests))p.guests=[];
  unique.forEach(ng=>{
    p.guests.push({id:'g'+Date.now()+Math.random().toString(36).slice(2,7),
      name:ng.name,email:ng.email,phone:ng.phone,category:ng.category||'',
      rsvp:ng.rsvp,table:ng.table,plusOne:ng.plusOne,meal:ng.meal,
      dietary:ng.dietary,notes:ng.notes});
    added++;
  });
  // Apply only the per-guest updates the user kept checked, and only the changed fields.
  (updates||[]).forEach(function(u,i){
    var chk=document.querySelector('.upd-sel[data-uidx="'+i+'"]');
    if(chk && !chk.checked) return;
    // Apply to the live guest object captured at preview time; fall back to id match.
    var ex=(u.ref && p.guests.indexOf(u.ref)!==-1) ? u.ref : p.guests.find(function(g){return g.id&&g.id===u.id;});
    if(!ex) return;
    u.changes.forEach(function(c){
      if(c.k==='plusOne') ex.plusOne=true;
      else ex[c.k]=c.val;
    });
    updated++;
  });
  saveProj(p);
  // Persist this import right away so the changes can't be lost to the save debounce
  // (e.g. if the user reloads immediately after importing).
  if(typeof flushSave==='function') flushSave();
  closeMo();renderGuests();
  var es=LANG==='es';
  toast(`${added} ${es?'agregados':'imported'}${updated?', '+updated+' '+(es?'actualizados':'updated'):''}`, 's');
  window._pendingImport=null;
}

var DEFAULT_PPM = 40;
function getPPM(){
  return DEFAULT_PPM;
}
function getFloorplanPPM(){
  if(LState&&LState.floorplan&&LState.floorplan.pxPerMeter) return LState.floorplan.pxPerMeter;
  return 0;
}

function mToPx(m){ return Math.round(m*getPPM()); }
function pxToM(px){ return px/getPPM(); }

var LSHAPES_M={
  'round-table':  {wm:1.8, hm:1.8, bg:'#e8d5c4',bdClr:'#8a5e3c',radius:'50%', label:'Round Table',  chairs:8, price:150},
  'rect-table':   {wm:2.44, hm:1.20,bg:'#d4e0f0',bdClr:'#2d4a7a',radius:'0px', label:'Rect Table',   chairs:8, price:1750},
  'square-table': {wm:1.5, hm:1.5, bg:'#d4e8d4',bdClr:'#2d6040',radius:'0px', label:'Square Table', chairs:8, price:1700},
  'dance-floor':  {wm:7.32,hm:7.32,bg:'#ddd0f0',bdClr:'#5a3d8a',radius:'0px', label:'Dance Floor',  chairs:0},
  'bar':          {wm:7.32,hm:0.4, bg:'#f5e8c0',bdClr:'#8a6820',radius:'0px', label:'Shot Bar',      chairs:0},
  'stage':        {wm:3.66,hm:2.44,bg:'#d0d8e8',bdClr:'#3a4466',radius:'0px', label:'Dinner Platform',chairs:0},
  'dj-booth':     {wm:3.66,hm:1.22,bg:'#e8d5f0',bdClr:'#6a3d8a',radius:'0px', label:'DJ Booth',     chairs:0},
  'gift-table':   {wm:1.8, hm:0.6, bg:'#f0d8e8',bdClr:'#7a3060',radius:'0px', label:'Gift Table',   chairs:0},
  'photo-booth':  {wm:2.0, hm:2.0, bg:'#cce8f5',bdClr:'#1a5580',radius:'0px', label:'Photo Booth',  chairs:0},
  'custom-elem':  {wm:2.0, hm:2.0, bg:'#e0e0e0',bdClr:'#888888',radius:'0px', label:'Custom',       chairs:0},
  's-table':      {wm:4.0, hm:1.5, bg:'#f0ece0',bdClr:'#8a6820',radius:'0px', label:'S-Table',     chairs:14, _isCustomTable:true},
};
var CHAIR_SIZE_M = 0.45;

function getLSHAPES(){
  var ppm=getPPM();
  var out={};
  Object.keys(LSHAPES_M).forEach(function(k){
    var s=LSHAPES_M[k];
    out[k]=Object.assign({},s,{w:Math.round(s.wm*ppm),h:Math.round(s.hm*ppm)});
  });
  return out;
}
var LSHAPES=getLSHAPES();

function defaultChairTypes(){
  return {
    'default': { label: LANG==='es'?'Predeterminada':'Default', fill: '#e8e2d8', stroke: '#b0a898', costPerChair: 0 }
  };
}
function defaultCenterpieceTypes(){
  return {
    'none': { label: LANG==='es'?'Ninguno':'None', color: null, cost: 0 },
    'default-floral': { label: LANG==='es'?'Arreglo Floral':'Flower Arrangement', color: '#a67c3d', cost: 0 }
  };
}

var CHAIR_TYPES = defaultChairTypes();
var CENTERPIECE_TYPES = defaultCenterpieceTypes();
// El blob de imagenes vive en chair-images.js y se carga bajo demanda.
// `var` en el ambito global es la MISMA referencia que window.CHAIR_IMAGES, asi que
// cuando el archivo diferido se ejecuta, esta variable ve el objeto ya poblado.
var CHAIR_IMAGES = window.CHAIR_IMAGES || {};
// Las claves si viven en el bundle principal: la UI necesita saber que sillas
// existen antes de descargar los 630 KB de imagenes.
var CHAIR_IMAGE_KEYS = ["elisa","oval-chair","hoffman","florencia","elena","regina","camila","basket","sara","lucia","valentina","frida","dapa","contempo","luis-xv","chanel","lucca","phoenix","peineta","tiffany","plegable-adulto","plegable-infantil","infantil-mono","infantil-wishbone","mirage","acrilico-novios","deco","lino","lino-novios","lux","napoleon"];
;


function syncLayoutStyles(p){
  // Start with just the built-in defaults, then layer project-saved types on top
  CHAIR_TYPES = defaultChairTypes();
  if(p.chairTypes){
    Object.keys(p.chairTypes).forEach(k=>{
      CHAIR_TYPES[k] = Object.assign({}, CHAIR_TYPES[k]||{}, p.chairTypes[k]);
    });
  }
  if(!CHAIR_TYPES['default']) CHAIR_TYPES['default'] = defaultChairTypes()['default'];

  CENTERPIECE_TYPES = defaultCenterpieceTypes();
  if(p.centerpieceTypes){
    Object.keys(p.centerpieceTypes).forEach(k=>{
      CENTERPIECE_TYPES[k] = Object.assign({}, CENTERPIECE_TYPES[k]||{}, p.centerpieceTypes[k]);
    });
  }
  if(!CENTERPIECE_TYPES['none']) CENTERPIECE_TYPES['none'] = defaultCenterpieceTypes()['none'];

  if(p.customShapes){
    Object.keys(p.customShapes).forEach(k=>{ LSHAPES_M[k]=p.customShapes[k]; });
    LSHAPES=getLSHAPES();
  }
}


function saveLayoutStyles(){
  const p=proj();
  p.chairTypes = JSON.parse(JSON.stringify(CHAIR_TYPES));
  p.centerpieceTypes = JSON.parse(JSON.stringify(CENTERPIECE_TYPES));
  saveProj(p);
}



function calcLayoutBudget(items){
  let total=0, breakdown={};
  items.forEach(item=>{
    const itemCost = Number(item.cost||0);
    total += itemCost;
    const cat = item.shape.replace(/-/g,' ');
    if(!breakdown[cat]) breakdown[cat]={label:cat,qty:0,unitCost:itemCost,total:0};
    breakdown[cat].qty++;
    breakdown[cat].total += itemCost;

    if(item.chairs && item.chairType){
      const ct = CHAIR_TYPES[item.chairType];
      const chairCost = ct ? (Number(ct.costPerChair||0) * item.chairs) : 0;
      if(chairCost>0){
        total += chairCost;
        const ccat = 'Chair: '+(ct?ct.label:item.chairType);
        if(!breakdown[ccat]) breakdown[ccat]={label:ccat,qty:0,unitCost:ct?ct.costPerChair:0,total:0};
        breakdown[ccat].qty += item.chairs;
        breakdown[ccat].total += chairCost;
      }
    }

    if(item.centerpiece && item.centerpiece!=='none'){
      const cpt = CENTERPIECE_TYPES[item.centerpiece];
      const cpCost = cpt ? Number(cpt.cost||0) : 0;
      if(cpCost>0){
        total += cpCost;
        const cpcat = 'Centerpiece: '+(cpt?cpt.label:item.centerpiece);
        if(!breakdown[cpcat]) breakdown[cpcat]={label:cpcat,qty:0,unitCost:cpCost,total:0};
        breakdown[cpcat].qty++;
        breakdown[cpcat].total += cpCost;
      }
    }
  });
  return {total, breakdown};
}
