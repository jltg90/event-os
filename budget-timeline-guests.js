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
  // `paid` suma los pagos de TODOS los proveedores, no solo los contratados.
  // Antes filtraba por `hired` y eso hacia que un anticipo registrado a un
  // proveedor todavia marcado como "pendiente" (savePay no toca v.hired)
  // desapareciera del total: la tarjeta "Pagado real" y la fila TOTAL de la
  // tabla mostraban cifras distintas en la misma pantalla, y ademas no cuadraba
  // con rdEventSummary() de core.js, que es lo que usan el panel y las
  // analiticas.  Un pago registrado es dinero pagado, con contrato o sin el.
  var paid = allVendors.reduce(function(s,v){ return s+(v.payments||[]).reduce(function(a,pay){ return a+_num(pay.amount); },0); },0);
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

// ── Iconos y utilidades compartidas del rediseño (presupuesto/cronograma/invitados) ──
var BG_IC = {
  plus:   '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
  edit:   '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
  trash:  '<polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  copy:   '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  down:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  up:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  book:   '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  cash:   '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  cal:    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  check:  '<polyline points="20,6 9,17 4,12"/>',
  chev:   '<path d="m6 9 6 6 6-6"/>',
  eye:    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  sparks: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M7.5 7.5 5 5M19 19l-2.5-2.5M16.5 7.5 19 5M5 19l2.5-2.5"/>',
  users:  '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  table:  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  grid:   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list:   '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  gantt:  '<rect x="3" y="4" width="14" height="4" rx="1.5"/><rect x="6" y="10" width="12" height="4" rx="1.5"/><rect x="9" y="16" width="11" height="4" rx="1.5"/>'
};
function _bgSvg(paths, size, sw){
  var s = size || 14;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}
/** Estado vacío común a presupuesto / cronograma / invitados. `actions` ya es HTML. */
function _bgEmptyState(eyebrow, title, body, actions, icon){
  return '<section class="bg-empty rd-card fade-in">' +
    '<span class="bg-empty-ico">' + _bgSvg(icon || BG_IC.sparks, 22, 1.7) + '</span>' +
    '<div class="rd-eyebrow">' + esc(eyebrow) + '</div>' +
    '<h2 class="rd-h3 bg-empty-title">' + esc(title) + '</h2>' +
    '<p class="bg-empty-sub">' + esc(body) + '</p>' +
    '<div class="bg-empty-actions">' + actions + '</div>' +
    '</section>';
}
/** Buscador con lupa. `oninput` ya es una llamada JS. */
function _bgSearch(id, placeholder, value, oninput, extraCls){
  return '<div class="rd-search' + (extraCls ? ' ' + extraCls : '') + '">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' + BG_IC.search + '</svg>' +
    '<input id="' + id + '" type="search" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '" value="' + esc(value || '') + '" oninput="' + oninput + '">' +
    '</div>';
}

function _budgetToolbarHtml(isES){
  return `<div class="rd-actions">
      <button class="btn" onclick="libDownloadVendorTemplate()">${_bgSvg(BG_IC.down,13,2)}<span>${isES?'Plantilla':'Template'}</span></button>
      <button class="btn" onclick="libQuickLoadVendors()">${_bgSvg(BG_IC.up,13,2)}<span>${isES?'Importar de biblioteca':'Import from library'}</span></button>
      <button class="btn" onclick="libQuickSaveVendors()">${_bgSvg(BG_IC.book,13,2)}<span>${isES?'Guardar en biblioteca':'Save to library'}</span></button>
      <button class="btn btn-primary" onclick="openVendorModal()">${_bgSvg(BG_IC.plus,14,2.4)}${t('add_vendor')}</button>
    </div>`;
}
function _budgetStatCard(label, value, valueColor, sub){
  return `<div class="rd-metric"><div class="rd-label" style="margin-bottom:11px">${label}</div><div class="rd-metric-val" style="color:${valueColor}">${value}</div>${sub?'<div class="rd-metric-sub">'+sub+'</div>':''}</div>`;
}
// Filtro de estado de la tabla de proveedores (se conserva entre repintados).
var vendorStatusFilter = 'all';
var vendorSearchQuery = '';
var VENDOR_STATUSES = ['pending','hired','in-progress','paid','cancelled'];
function vendorStatusValue(v){ return (v && v.vendorStatus) || (v && v.hired ? 'hired' : 'pending'); }
function vendorStatusLabel(st){
  var isES = LANG==='es';
  return { pending:isES?'Pendiente':'Pending', hired:isES?'Contratado':'Hired',
           'in-progress':isES?'En Progreso':'In Progress', paid:isES?'Pagado':'Paid',
           cancelled:isES?'Cancelado':'Cancelled' }[st] || (isES?'Pendiente':'Pending');
}
function vendorStatusTone(st){
  return { pending:'neutral', hired:'success', 'in-progress':'warn', paid:'info', cancelled:'danger' }[st] || 'neutral';
}
/** Tono estable por categoría, para el avatar de la fila. */
function _bgCatTone(cat){
  var keys = ['accent','info','success','warn','purple','champagne'];
  var s = String(cat||''), h = 0;
  for(var i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return rdTone(s ? keys[h % keys.length] : 'neutral');
}
function _bgMatchesVendor(v, q){
  return [v.name,v.category,v.subcategory,v.services,v.contact,v.phone,v.notes]
    .some(function(f){ return f && String(f).toLowerCase().indexOf(q) !== -1; });
}
/** Proveedores que pasan el buscador (sin aplicar el filtro de estado). */
function _bgSearchedVendors(p){
  var list = (p && p.vendors) || [];
  var q = String(vendorSearchQuery||'').trim().toLowerCase();
  return q ? list.filter(function(v){ return _bgMatchesVendor(v, q); }) : list.slice();
}
/** Proveedores visibles = buscador + filtro de estado. */
function _bgVisibleVendors(p){
  var list = _bgSearchedVendors(p);
  if(vendorStatusFilter !== 'all') list = list.filter(function(v){ return vendorStatusValue(v) === vendorStatusFilter; });
  return list;
}
function _bgVendorFiltersHtml(p){
  var searched = _bgSearchedVendors(p);
  var isES = LANG==='es';
  var counts = {}; VENDOR_STATUSES.forEach(function(s){ counts[s] = 0; });
  searched.forEach(function(v){ var s = vendorStatusValue(v); if(counts[s] !== undefined) counts[s]++; });
  var items = [['all', isES?'Todos':'All', searched.length, '']];
  VENDOR_STATUSES.forEach(function(s){
    if(counts[s] > 0 || vendorStatusFilter === s) items.push([s, vendorStatusLabel(s), counts[s], rdTone(vendorStatusTone(s)).fg]);
  });
  return items.map(function(it){
    return '<button class="rd-filter sm' + (vendorStatusFilter===it[0]?' active':'') + '" onclick="setVendorStatusFilter(\'' + it[0] + '\')">' +
      (it[3] ? '<i class="dot" style="background:' + it[3] + '"></i>' : '') +
      esc(it[1]) + ' <span class="cnt">' + it[2] + '</span></button>';
  }).join('');
}
function setVendorStatusFilter(k){
  vendorStatusFilter = k;
  _bgRefreshVendorList();
}
/** Repinta solo las filas (y las píldoras) para no perder el foco del buscador. */
function _bgRefreshVendorList(){
  var p = proj(); if(!p) return;
  var list = _bgVisibleVendors(p);
  var rows = document.getElementById('vendor-rows');
  if(rows){
    rows.innerHTML = _bgVendorRowsHtml(p, list);
    var f = document.getElementById('vendor-filters');
    if(f) f.innerHTML = _bgVendorFiltersHtml(p);
  } else {
    var vl = document.getElementById('vlist');
    if(vl) vl.innerHTML = renderVendorTable(list, '');
  }
  syncVendorSelectionToVisible();
}

function renderBudget(){
  const p=proj();const el=document.getElementById('tab-budget');
  if(ensureDefaultVendors(p)) saveProj(p);
  const allVendors = p.vendors;
  const isES = LANG==='es';
  const isMob = isPhoneViewport();
  const mobBar = renderMobileStickyActionBar(`
    <button class="btn" onclick="libQuickLoadVendors()">${isES?'Importar':'Import'}</button>
    <button class="btn btn-primary" onclick="openVendorModal()">${t('add_vendor')}</button>
  `);
  if(!allVendors.length){
    el.innerHTML=`
  <div class="rd-tab-head">
    <div>
      <h2 class="rd-h2">${isES?'Presupuesto y proveedores':'Budget & vendors'}</h2>
      <p class="rd-sub">${isES?'Gestiona tus proveedores y el presupuesto del evento':'Manage your event vendors and budget'}</p>
    </div>
    ${isMob?'':_budgetToolbarHtml(isES)}
  </div>
  ${renderVendorEmptyState()}
  ${mobBar}`;
    return;
  }
  const bs=calcBudgetStats(p);
  const hired=bs.hired, estimatedTotal=bs.estimatedTotal, tb=bs.tb, paid=bs.paid;
  const projBudget=bs.projBudget, diff=bs.diff;
  const totalWithPlusOnesB=bs.totalWithPlusOnes;
  const budgetPerGuestB=bs.budgetPerGuest, budgetPct=bs.budgetPct;
  const diffClr = diff>=0?'var(--success)':'var(--accent-deep)';
  const paidPct = tb>0 ? Math.min(100, Math.round(paid/tb*100)) : 0;
  const perGuestSub = (totalWithPlusOnesB>0&&projBudget>0)
    ? fmtMoney(budgetPerGuestB)+' '+(isES?'por invitado':'per guest')
    : t('approved_budget');
  const metrics = `<div class="rd-metrics">
    ${rdMetric({label:isES?'Aprobado':'Approved', value:fmtMoney(projBudget), sub:perGuestSub, color:'var(--ink)'})}
    ${rdMetric({label:isES?'Asignado':'Allocated', value:fmtMoney(estimatedTotal), color:'var(--warn)',
      sub:budgetPct+'% '+t('of_approved'), bar:{pct:budgetPct, color:budgetPct>100?'var(--accent)':'var(--warn-2)'}})}
    ${rdMetric({label:t('actual_paid'), value:fmtMoney(paid), color:'var(--success)',
      sub:t('balance_label')+': '+fmtMoney(tb-paid), bar:{pct:paidPct, color:'var(--success)'}})}
    ${rdMetric({label:t('budget_variance'), value:(diff>=0?'+':'')+fmtMoney(diff), color:diffClr,
      sub:diff>=0?t('under_budget'):t('over_budget')})}
  </div>`;
  el.innerHTML=`
  <div class="rd-tab-head">
    <div>
      <h2 class="rd-h2">${isES?'Presupuesto y proveedores':'Budget & vendors'}</h2>
      <p class="rd-sub">${allVendors.length} ${isES?'proveedores':'vendors'} &middot; ${hired.length} ${isES?'contratados':'hired'} &middot; ${t('paid_label')}: ${fmtMoney(paid)} &middot; ${t('balance_label')}: ${fmtMoney(tb-paid)}</p>
    </div>
    ${isMob?'':_budgetToolbarHtml(isES)}
  </div>
  ${metrics}
  ${isMob?`<div class="bg-mobsearch">${_bgSearch('vendor-search', isES?'Buscar proveedor, categoría o contacto…':'Search vendor, category or contact…', vendorSearchQuery, 'filterVendors(this.value)')}</div>`:''}
  <div id="vlist">${renderVendorTable(_bgVisibleVendors(p), '')}</div>
  ${mobBar}`;
}

function renderVendorEmptyState(){
  const isES = LANG==='es';
  return _bgEmptyState(
    isES?'Configuración de proveedores':'Vendor setup',
    isES?'Organiza todos tus proveedores en un solo lugar.':'Organize all your vendors in one place.',
    isES?'Crea un plan de proveedores a la medida de tu evento. El asistente sugiere los proveedores que necesitas según los servicios que requieras y te deja marcar los que ya tienes confirmados.':'Create a tailored vendor plan for your event. The wizard suggests the vendors you need based on your services, and lets you mark which ones are already confirmed.',
    `<button class="btn btn-primary" onclick="openVendorSetupWizard()">${_bgSvg(BG_IC.plus,14,2.4)}${isES?'Crear plan de proveedores':'Create vendor plan'}</button>
     <button class="btn" onclick="openVendorModal()">${_bgSvg(BG_IC.plus,14,2.2)}${t('add_vendor')}</button>
     <button class="btn" onclick="libQuickLoadVendors()">${_bgSvg(BG_IC.up,13,2)}${isES?'Importar de biblioteca':'Import from library'}</button>`,
    BG_IC.cash);
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
  const st = vendorStatusValue(v);
  const tone = rdTone(vendorStatusTone(st));
  return { label: vendorStatusLabel(st), bg: tone.bg, clr: tone.fg, tone: vendorStatusTone(st), status: st };
}
function filterVendors(query){
  vendorSearchQuery = typeof query==='string' ? (query.length>200?query.substring(0,200):query) : '';
  _bgRefreshVendorList();
}
var BG_VCOLS = 'style="grid-template-columns:34px minmax(180px,2fr) minmax(130px,1.1fr) 122px 146px 132px 138px"';
/** Filas + pie de la tabla de proveedores (sin la cabecera ni las herramientas). */
function _bgVendorRowsHtml(p, vendors){
  const isES = LANG==='es';
  if(!vendors.length){
    const filtered = (p.vendors||[]).length > 0;
    return `<div class="bg-norows">${filtered ? (isES?'Ningún proveedor coincide con la búsqueda.':'No vendors match your search.') : t('no_comparison_vendors')}
      <button class="btn btn-sm" onclick="filterVendors('');setVendorStatusFilter('all')">${isES?'Limpiar filtros':'Clear filters'}</button></div>`;
  }
  let totBudget = 0, totPaid = 0;
  const rows = vendors.map(function(v){
    const paid = (v.payments||[]).reduce(function(a,py){ return a+_num(py.amount); }, 0);
    const budget = _num(v.budget);
    totBudget += budget; totPaid += paid;
    const pct = budget>0 ? Math.min(100, Math.round(paid/budget*100)) : 0;
    const st = vendorStatusValue(v);
    const tone = rdTone(vendorStatusTone(st));
    const cat = _bgCatTone(v.category);
    const nPays = (v.payments||[]).length;
    return `<div class="rd-row click" ${BG_VCOLS} onclick="showVendorDetail('${v.id}')">
      <div onclick="event.stopPropagation()"><input class="vendor-sel bg-chk" type="checkbox" data-vid="${v.id}" ${isVendorSelected(v.id)?'checked':''} onchange="toggleVendorSelection('${v.id}', this.checked)" aria-label="${isES?'Seleccionar':'Select'} ${esc(v.name)}"></div>
      <div class="bg-vname">
        <span class="rd-avatar" style="background:${cat.bg};color:${cat.fg}">${esc(rdInitials(v.name))}</span>
        <div style="min-width:0">
          <div class="rd-cell-main">${esc(v.name)}</div>
          <div class="rd-cell-sub">${esc(v.category||(isES?'Sin categoría':'Uncategorized'))}${v.subcategory?' · '+esc(v.subcategory):''}</div>
        </div>
      </div>
      <div class="rd-cell">${v.contact?esc(v.contact):(v.phone?esc(v.phone):'&mdash;')}</div>
      <div class="rd-cell-money">${fmtMoney(budget)}</div>
      <div>
        <div class="bg-paidval">${fmtMoney(paid)}${nPays?`<span class="bg-paidn">${nPays} ${isES?(nPays===1?'pago':'pagos'):(nPays===1?'payment':'payments')}</span>`:''}</div>
        <div class="rd-bar thin" style="margin-top:5px"><i style="width:${pct}%;background:var(--success)"></i></div>
      </div>
      <div onclick="event.stopPropagation()">
        <span class="bg-stsel t-${vendorStatusTone(st)}">
          <i></i><span>${esc(vendorStatusLabel(st))}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">${BG_IC.chev}</svg>
          <select aria-label="${isES?'Estado del proveedor':'Vendor status'}" onchange="setVendorStatus('${v.id}',this.value)">
            ${VENDOR_STATUSES.map(function(s){ return `<option value="${s}"${st===s?' selected':''}>${esc(vendorStatusLabel(s))}</option>`; }).join('')}
          </select>
        </span>
      </div>
      <div class="bg-rowacts" onclick="event.stopPropagation()">
        <button class="rd-ibtn" title="${isES?'Registrar pago':'Add payment'}" aria-label="${isES?'Registrar pago':'Add payment'}" onclick="openPayModal('${v.id}')">${_bgSvg(BG_IC.cash,13,2)}</button>
        <button class="rd-ibtn" title="${isES?'Duplicar':'Duplicate'}" aria-label="${isES?'Duplicar':'Duplicate'}" onclick="dupVendor('${v.id}')">${_bgSvg(BG_IC.copy,13,2)}</button>
        <button class="rd-ibtn" title="${isES?'Editar':'Edit'}" aria-label="${isES?'Editar':'Edit'}" onclick="openVendorModal('${v.id}')">${_bgSvg(BG_IC.edit,13,2)}</button>
        <button class="rd-ibtn danger" title="${isES?'Eliminar':'Delete'}" aria-label="${isES?'Eliminar':'Delete'}" onclick="delV('${v.id}')">${_bgSvg(BG_IC.trash,13,2)}</button>
      </div>
    </div>`;
  }).join('');
  const foot = `<div class="rd-tfoot" ${BG_VCOLS}>
    <div></div>
    <div class="rd-label">${isES?'Total':'Total'}</div>
    <div></div>
    <div class="rd-cell-money" style="font-weight:600">${fmtMoney(totBudget)}</div>
    <div class="rd-cell-money" style="font-weight:600;color:var(--success)">${fmtMoney(totPaid)}</div>
    <div class="rd-cell">${totBudget>0?Math.min(100,Math.round(totPaid/totBudget*100)):0}% ${isES?'pagado':'paid'}</div>
    <div></div>
  </div>`;
  return rows + foot;
}
function renderVendorTable(vendors, tab){
  if(isPhoneViewport()) return renderVendorMobileCards(vendors, tab);
  const p = proj() || { vendors: [] };
  const isES = LANG==='es';
  return `<div class="rd-table">
    <div class="rd-table-tools">
      ${_bgSearch('vendor-search', isES?'Buscar proveedor, categoría o contacto…':'Search vendor, category or contact…', vendorSearchQuery, 'filterVendors(this.value)')}
      <div class="rd-pillrow" id="vendor-filters">${_bgVendorFiltersHtml(p)}</div>
    </div>
    <div id="vendor-bulk-bar" class="bg-bulk" style="display:${vendorSelectionCount()?'flex':'none'}">
      <span id="vendor-bulk-count" class="bg-bulk-count">${vendorSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
      <button class="btn btn-sm" onclick="openBulkVendorEditModal()">${isES?'Editar seleccionados':'Edit selected'}</button>
      <button class="btn btn-sm btn-danger" onclick="bulkDeleteVendors()">${isES?'Eliminar seleccionados':'Delete selected'}</button>
      <button class="btn btn-sm" onclick="clearVendorSelection()">${isES?'Limpiar selección':'Clear selection'}</button>
    </div>
    <div class="rd-table-scroll"><div style="min-width:960px">
      <div class="rd-thead" ${BG_VCOLS}>
        <div><input type="checkbox" id="vendor-chk-all" class="bg-chk" onchange="toggleAllVisibleVendors(this.checked)" aria-label="${isES?'Seleccionar todos':'Select all'}"></div>
        <div>${isES?'Proveedor':'Vendor'}</div>
        <div>${isES?'Contacto':'Contact'}</div>
        <div>${isES?'Presupuesto':'Budget'}</div>
        <div>${isES?'Pagado':'Paid'}</div>
        <div>${isES?'Estado':'Status'}</div>
        <div></div>
      </div>
      <div id="vendor-rows">${_bgVendorRowsHtml(p, vendors)}</div>
    </div></div>
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
  const p = proj() || { vendors: [] };
  const empty = `<div class="bg-norows">${(p.vendors||[]).length?(isES?'Ningún proveedor coincide con la búsqueda.':'No vendors match your search.'):t('no_comparison_vendors')}</div>`;
  return `<div class="bg-mobtools">
      <div class="rd-pillrow">${_bgVendorFiltersHtml(p)}</div>
      <div id="vendor-bulk-bar" class="bg-bulk" style="display:${vendorSelectionCount()?'flex':'none'}">
        <span id="vendor-bulk-count" class="bg-bulk-count">${vendorSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
        <button class="btn btn-sm" onclick="openBulkVendorEditModal()">${isES?'Editar':'Edit'}</button>
        <button class="btn btn-sm btn-danger" onclick="bulkDeleteVendors()">${isES?'Eliminar':'Delete'}</button>
        <button class="btn btn-sm" onclick="clearVendorSelection()">${isES?'Limpiar':'Clear'}</button>
      </div>
      <label class="bg-selall">
        <input type="checkbox" id="vendor-chk-all" class="bg-chk" onchange="toggleAllVisibleVendors(this.checked)">
        <span>${isES?'Seleccionar visibles':'Select visible'}</span>
      </label>
    </div>
    <div class="bg-cards">
      ${vendors.length ? vendors.map(function(v){
        var paid = (v.payments||[]).reduce(function(a,py){ return a+_num(py.amount); },0);
        var budget = _num(v.budget);
        var isOpen = _expandedVendorIds.indexOf(v.id) > -1;
        var remaining = Math.max(0, budget - paid);
        var pct = budget > 0 ? Math.min(100, Math.round(paid / budget * 100)) : 0;
        var st = vendorStatusValue(v);
        var cat = _bgCatTone(v.category);
        return `<article class="vmc bg-card${isOpen?' vmc-open':''}" data-vid="${v.id}">
          <div class="vmc-summary bg-card-top" onclick="toggleVendorExpand('${v.id}')">
            <label class="vmc-chk" onclick="event.stopPropagation()">
              <input class="vendor-sel bg-chk" type="checkbox" data-vid="${v.id}" ${isVendorSelected(v.id)?'checked':''} onchange="toggleVendorSelection('${v.id}', this.checked)" aria-label="${isES?'Seleccionar':'Select'} ${esc(v.name)}">
            </label>
            <span class="rd-avatar" style="background:${cat.bg};color:${cat.fg}">${esc(rdInitials(v.name))}</span>
            <div class="bg-card-info">
              <div class="rd-cell-main">${esc(v.name)}</div>
              <div class="bg-card-row">
                <span class="rd-pill sm t-${vendorStatusTone(st)}"><i></i>${esc(vendorStatusLabel(st))}</span>
                <span class="rd-cell-money">${fmtMoney(budget)}</span>
              </div>
            </div>
            <svg class="vmc-chevron bg-card-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BG_IC.chev}</svg>
          </div>
          <div class="vmc-detail bg-card-detail">
            <div class="rd-bar thin"><i style="width:${pct}%;background:var(--success)"></i></div>
            <div class="bg-card-barlbl">
              <span>${isES?'Pagado':'Paid'}: ${fmtMoney(paid)}</span>
              <span>${isES?'Restante':'Remaining'}: ${fmtMoney(remaining)}</span>
            </div>
            <div class="bg-card-meta">
              ${v.category ? `<div><span class="rd-label">${isES?'Categoría':'Category'}</span><span>${esc(v.category)}${v.subcategory?' · '+esc(v.subcategory):''}</span></div>` : ''}
              ${v.contact ? `<div><span class="rd-label">${isES?'Contacto':'Contact'}</span><span>${esc(v.contact)}</span></div>` : ''}
              ${v.phone ? `<div><span class="rd-label">${isES?'Teléfono':'Phone'}</span><span>${esc(v.phone)}</span></div>` : ''}
              ${(v.payments||[]).length ? `<div><span class="rd-label">${isES?'Pagos':'Payments'}</span><span>${v.payments.length}</span></div>` : ''}
              ${v.notes ? `<div class="bg-card-meta-full"><span class="rd-label">${isES?'Notas':'Notes'}</span><span>${esc(v.notes)}</span></div>` : ''}
            </div>
            <div onclick="event.stopPropagation()" style="margin-top:12px">
              <span class="bg-stsel t-${vendorStatusTone(st)}">
                <i></i><span>${esc(vendorStatusLabel(st))}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">${BG_IC.chev}</svg>
                <select aria-label="${isES?'Estado del proveedor':'Vendor status'}" onchange="setVendorStatus('${v.id}',this.value)">
                  ${VENDOR_STATUSES.map(function(s){ return `<option value="${s}"${st===s?' selected':''}>${esc(vendorStatusLabel(s))}</option>`; }).join('')}
                </select>
              </span>
            </div>
            <div class="bg-card-acts" onclick="event.stopPropagation()">
              <button class="btn btn-sm" onclick="showVendorDetail('${v.id}')">${_bgSvg(BG_IC.eye,13,2)} ${isES?'Ver':'View'}</button>
              <button class="btn btn-sm" onclick="openPayModal('${v.id}')">${_bgSvg(BG_IC.cash,13,2)} ${isES?'Pago':'Payment'}</button>
              <button class="btn btn-sm" onclick="openVendorModal('${v.id}')">${_bgSvg(BG_IC.edit,13,2)} ${isES?'Editar':'Edit'}</button>
              <button class="btn btn-sm" onclick="dupVendor('${v.id}')">${_bgSvg(BG_IC.copy,13,2)} ${isES?'Duplicar':'Duplicate'}</button>
              <button class="btn btn-sm btn-danger" onclick="delV('${v.id}')">${_bgSvg(BG_IC.trash,13,2)} ${isES?'Eliminar':'Delete'}</button>
            </div>
          </div>
        </article>`;
      }).join('') : empty}
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
/** Vencida: usa las fechas civiles locales (startOfLocalDay), nunca new Date(fecha). */
function _tlOverdue(tk){
  if(!tk || taskIsDone(tk) || !tk.dueDate) return false;
  var due = startOfLocalDay(tk.dueDate);
  if(!due) return false;
  var t0 = new Date(); t0.setHours(0,0,0,0);
  return due < t0;
}
/** Las fases se guardan en inglés en los datos; aquí se traducen para la UI. */
function _tlPhaseLabel(phase){
  var isES = LANG==='es';
  var map = {
    'Strategy & Budget':          isES?'Estrategia y presupuesto':'Strategy & Budget',
    'Venue & Core Vendors':       isES?'Sede y proveedores clave':'Venue & Core Vendors',
    'Design & Guest Experience':  isES?'Diseño y experiencia':'Design & Guest Experience',
    'Logistics & Operations':     isES?'Logística y operación':'Logistics & Operations',
    'Guest Management':           isES?'Gestión de invitados':'Guest Management',
    'Final Confirmation':         isES?'Confirmación final':'Final Confirmation',
    'Event Week':                 isES?'Semana del evento':'Event Week',
    'Post-Event':                 isES?'Post-evento':'Post-Event'
  };
  return map[phase] || phase || '';
}
function _tlPhaseTone(phase){
  var map = {
    'Strategy & Budget':'champagne', 'Venue & Core Vendors':'info',
    'Design & Guest Experience':'purple', 'Logistics & Operations':'neutral',
    'Guest Management':'accent', 'Final Confirmation':'warn',
    'Event Week':'danger', 'Post-Event':'success'
  };
  if(map[phase]) return map[phase];
  var keys=['info','purple','champagne','warn','accent','success'];
  var str=String(phase||''), h=0;
  for(var i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0;
  return str ? keys[h%keys.length] : 'neutral';
}
function _tlTaskPhase(tk){ return tk.phase || taskPhaseValue(tk); }
/** Tono de la barra/píldora de una tarea: hecha, vencida o por fase. */
function _tlTaskTone(tk){
  if(taskIsDone(tk)) return 'success';
  if(_tlOverdue(tk)) return 'danger';
  return _tlPhaseTone(_tlTaskPhase(tk));
}
function _tlBarColor(tk){
  if(taskIsDone(tk)) return 'var(--success)';
  if(_tlOverdue(tk)) return 'var(--accent)';
  return tk.color || rdTone(_tlPhaseTone(_tlTaskPhase(tk))).fg;
}

function renderTimelineEmptyState(){
  const isES = LANG==='es';
  return _bgEmptyState(
    isES ? 'Cronograma inicial' : 'Timeline starter',
    isES ? 'Comienza este evento con un plan maestro listo para trabajar.' : 'Start this event with a master plan that is ready to work from.',
    isES ? 'Crea una plantilla completa de planificación para eventos sociales, corporativos, galas, celebraciones privadas y recaudaciones. Después podrás editar cada tarea, responsable y fecha como quieras.' : 'Create a full planning template for social events, corporate events, galas, private celebrations, and fundraisers. After that, you can edit every task, assignee, and date however you like.',
    `<button class="btn btn-primary" onclick="openTemplatePlanWizard()">${_bgSvg(BG_IC.plus,14,2.4)}${isES?'Crear plan de plantilla':'Create template plan'}</button>
     <button class="btn" onclick="openTaskModal()">${_bgSvg(BG_IC.plus,14,2.2)}${t('add_task')}</button>
     <button class="btn" onclick="libQuickLoadTasks()">${_bgSvg(BG_IC.up,13,2)}${isES?'Importar tareas':'Import tasks'}</button>`,
    BG_IC.cal);
}
function _libUpdateSectionLabels(){
  // 'lib-save-vendor-lbl' no existe en ningun render: el boton de guardar proveedores
  // ya se re-pinta con renderBudget() al cambiar de idioma.  Se elimina la linea muerta.
  var lt=document.getElementById('lib-save-task-lbl');   if(lt) lt.textContent=t('lib_save_to');
  var lvl=document.getElementById('lib-load-vendor-lbl'); if(lvl) lvl.textContent=LANG==='es'?'CARGAR':'LOAD';
  var ltl=document.getElementById('lib-load-task-lbl');   if(ltl) ltl.textContent=LANG==='es'?'Importar Tareas':'Import Tasks';
}
/** Tareas que pasan el buscador (sin aplicar el filtro de estado). */
function _tlSearchedTasks(p){
  var tasks = (p && p.tasks) || [];
  var q = String(taskSearchQuery||'').trim().toLowerCase();
  if(!q) return tasks.slice();
  return tasks.filter(function(tk){
    return [tk.title,tk.desc,tk.assignee,tk.startDate,tk.dueDate,tk.endDate,tk.planningWindow,tk.durationDays,tk.status,_tlTaskPhase(tk),_tlPhaseLabel(_tlTaskPhase(tk))]
      .some(function(v){ return String(v||'').toLowerCase().indexOf(q) !== -1; });
  });
}
function _tlFiltersHtml(p){
  const isES = LANG==='es';
  const tod = today();
  const list = _tlSearchedTasks(p);
  const c = {
    all: list.length,
    overdue: list.filter(function(tk){ return _tlOverdue(tk); }).length,
    pending: list.filter(function(tk){ return !taskIsDone(tk); }).length,
    done:    list.filter(function(tk){ return taskIsDone(tk); }).length,
    today:   list.filter(function(tk){ return tk.dueDate===tod; }).length,
    upcoming:list.filter(function(tk){ return tk.dueDate && tk.dueDate>tod && !taskIsDone(tk); }).length
  };
  const defs = [
    ['all',      isES?'Todas':'All',        ''],
    ['overdue',  isES?'Vencidas':'Overdue',  rdTone('danger').fg],
    ['pending',  isES?'Pendientes':'Pending', rdTone('warn').fg],
    ['today',    isES?'Hoy':'Today',        rdTone('info').fg],
    ['upcoming', isES?'Próximas':'Upcoming', rdTone('champagne').fg],
    ['done',     isES?'Listas':'Done',      rdTone('success').fg]
  ];
  return defs.filter(function(d){
    return d[0]==='all' || c[d[0]]>0 || taskListFilter===d[0];
  }).map(function(d){
    return '<button class="rd-filter sm' + (taskListFilter===d[0]?' active':'') + '" data-task-filter="' + d[0] + '" onclick="setTaskListFilter(\'' + d[0] + '\')">' +
      (d[2] ? '<i class="dot" style="background:' + d[2] + '"></i>' : '') +
      esc(d[1]) + ' <span class="cnt">' + c[d[0]] + '</span></button>';
  }).join('');
}
function _tlRefreshFilters(p){
  var box = document.getElementById('timeline-filters');
  if(box) box.innerHTML = _tlFiltersHtml(p || proj());
}

function renderTimeline(){
  const p=proj();const el=document.getElementById('tab-timeline');
  if(!Array.isArray(p.tasks)) p.tasks=[];
  const isES=LANG==='es';
  const isMob=isPhoneViewport();
  const total=p.tasks.length;
  const done=p.tasks.filter(taskIsDone).length;
  const ov=p.tasks.filter(_tlOverdue).length;
  const pct=total?Math.round(done/total*100):0;
  const sub = total
    ? `${total} ${isES?'tareas':'tasks'} &middot; ${done} ${isES?'completadas':'done'} &middot; ${ov} ${isES?'vencidas':'overdue'} &middot; ${pct}% ${isES?'de avance':'complete'}`
    : t('timeline_sub');
  el.innerHTML=`
  <div class="rd-tab-head">
    <div>
      <h2 class="rd-h2">${t('timeline')}</h2>
      <p class="rd-sub">${sub}</p>
    </div>
    ${isMob?'':`<div class="rd-actions">
      <button class="btn" onclick="openTemplatePlanWizard()">${_bgSvg(BG_IC.sparks,13,2)}<span>${isES?'Plan de plantilla':'Template plan'}</span></button>
      <button class="btn" onclick="libQuickSaveTasks()">${_bgSvg(BG_IC.book,13,2)}<span id="lib-save-task-lbl">${t('lib_save_to')}</span></button>
      <button class="btn" onclick="libQuickLoadTasks()">${_bgSvg(BG_IC.up,13,2)}<span id="lib-load-task-lbl">${isES?'Importar tareas':'Import tasks'}</span></button>
      <button class="btn btn-primary" onclick="openTaskModal()">${_bgSvg(BG_IC.plus,14,2.4)}${t('add_task')}</button>
    </div>`}
  </div>
  <div class="tl-toolrow">
    <div class="rd-seg">
      <button class="${tView==='list'?'active':''}" onclick="tView='list';renderTimeline()">${t('list_view')}</button>
      <button class="${tView==='gantt'?'active':''}" onclick="tView='gantt';renderTimeline()">${t('gantt_view')}</button>
      <button class="${tView==='calendar'?'active':''}" onclick="tView='calendar';renderTimeline()">${t('calendar_view')}</button>
    </div>
    <div class="tl-spacer"></div>
    <div class="rd-pillrow" id="timeline-filters">${_tlFiltersHtml(p)}</div>
  </div>
  <div class="tl-search">${_bgSearch('timeline-task-search', t('search_tasks'), taskSearchQuery, 'debouncedTaskSearch(this.value)')}</div>
  <div id="tview-content"></div>
  ${renderMobileStickyActionBar(`
    <button class="btn" onclick="libQuickLoadTasks()">${isES?'Importar':'Import'}</button>
    <button class="btn btn-primary" onclick="openTaskModal()">${t('add_task')}</button>
  `)}`;
  renderTimelineView(p);
}
var taskListFilter='all';
var taskSearchQuery='';
function setTaskListFilter(filter,el){
  taskListFilter=filter;
  _tlRefreshFilters(proj());
  setTimeout(function(){ renderTimelineView(proj()); },0);
}
function filterTasks(tasks){
  const tod=today();
  let filtered=[...tasks];
  if(taskListFilter==='overdue') filtered=filtered.filter(function(tk){ return _tlOverdue(tk); });
  else if(taskListFilter==='today') filtered=filtered.filter(tk=>tk.dueDate===tod);
  else if(taskListFilter==='upcoming') filtered=filtered.filter(tk=>tk.dueDate&&tk.dueDate>tod&&!taskIsDone(tk));
  else if(taskListFilter==='pending') filtered=filtered.filter(tk=>!taskIsDone(tk));
  else if(taskListFilter==='done') filtered=filtered.filter(taskIsDone);
  const q=taskSearchQuery.trim().toLowerCase();
  if(q) filtered=filtered.filter(tk=>[tk.title,tk.desc,tk.assignee,tk.startDate,tk.dueDate,tk.endDate,tk.planningWindow,tk.durationDays,tk.status,_tlTaskPhase(tk),_tlPhaseLabel(_tlTaskPhase(tk))].some(v=>String(v||'').toLowerCase().includes(q)));
  return filtered;
}
function renderTimelineView(p){
  _tlRefreshFilters(p);
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
/** Aviso de "no hay resultados" común a las tres vistas del cronograma. */
function _tlNoTasks(){
  const isES = LANG==='es';
  return `<div class="bg-norows">${taskSearchQuery.trim()?t('no_tasks_found'):t('no_tasks_yet')}
    ${taskSearchQuery.trim()||taskListFilter!=='all'?`<button class="btn btn-sm" onclick="taskSearchQuery='';setTaskListFilter('all');renderTimeline()">${isES?'Limpiar filtros':'Clear filters'}</button>`:''}</div>`;
}
function renderTaskList(p){
  const el=document.getElementById('tview-content');
  const isES=LANG==='es';
  let sorted=filterTasks([...p.tasks]).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  if(!sorted.length){ el.innerHTML=_tlNoTasks(); return; }
  el.innerHTML='<div class="tl-list">'+sorted.map(function(tk){
    const isDone=taskIsDone(tk);
    const ov=_tlOverdue(tk);
    const phase=_tlTaskPhase(tk);
    const dates=fmtDate(tk.startDate||tk.dueDate)+(tk.startDate&&tk.dueDate?' → '+fmtDate(tk.dueDate):'');
    return `<div class="tl-task${isDone?' is-done':''}">
      <button class="rd-check tl-check${isDone?' done':''}" onclick="toggleTask('${tk.id}')" aria-label="${isDone?(isES?'Marcar como pendiente':'Mark as pending'):(isES?'Marcar como hecha':'Mark as done')}" title="${isDone?(isES?'Marcar como pendiente':'Mark as pending'):(isES?'Marcar como hecha':'Mark as done')}">${isDone?_bgSvg(BG_IC.check,12,3):''}</button>
      <div class="tl-task-body">
        <div class="tl-task-head">
          <span class="tl-task-title">${esc(tk.title)}</span>
          ${rdPill(_tlPhaseLabel(phase), _tlPhaseTone(phase), {up:true})}
          ${!isDone&&taskStatusValue(tk)==='in-progress'?rdPill(taskStatusLabel(tk),'info',{sm:true}):''}
          ${ov?rdPill(t('overdue'),'danger',{sm:true,dot:true}):''}
        </div>
        ${tk.desc?`<div class="tl-task-desc">${esc(tk.desc)}</div>`:''}
        <div class="tl-task-meta">
          <span class="${ov?'is-over':''}">${_bgSvg(BG_IC.cal,13,1.9)}${esc(dates)}</span>
          <span>${_bgSvg(BG_IC.user,13,1.9)}${esc(tk.assignee||t('unassigned'))}</span>
          <span>${_bgSvg(BG_IC.clock,13,1.9)}${esc(String(tk.durationDays||1))} ${(Number(tk.durationDays)||1)===1?(isES?'día':'day'):(isES?'días':'days')}</span>
          ${tk.planningWindow?`<span>${_bgSvg(BG_IC.list,13,1.9)}${esc(tk.planningWindow)}</span>`:''}
        </div>
      </div>
      <div class="tl-task-acts">
        <span class="tl-task-color" style="background:${_tlBarColor(tk)}" aria-hidden="true"></span>
        <button class="rd-ibtn" title="${isES?'Duplicar':'Duplicate'}" aria-label="${isES?'Duplicar':'Duplicate'}" onclick="dupTask('${tk.id}')">${_bgSvg(BG_IC.copy,13,2)}</button>
        <button class="rd-ibtn" title="${isES?'Editar':'Edit'}" aria-label="${isES?'Editar':'Edit'}" onclick="openTaskModal('${tk.id}')">${_bgSvg(BG_IC.edit,13,2)}</button>
        <button class="rd-ibtn danger" title="${isES?'Eliminar':'Delete'}" aria-label="${isES?'Eliminar':'Delete'}" onclick="delTask('${tk.id}')">${_bgSvg(BG_IC.trash,13,2)}</button>
      </div>
    </div>`;
  }).join('')+'</div>';
}
var _ganttZoom=14; var _ganttOffset=0; // px por dia
// Con zoom automatico el rango completo entra en el ancho disponible; los botones
// +/- lo desactivan para respetar la eleccion del usuario.
var _ganttZoomAuto=true;
function _tlSetGanttZoom(px){ _ganttZoomAuto=false; _ganttZoom=Math.max(2,Math.min(60,px)); renderGantt(proj()); }
function renderGantt(p){
  const el=document.getElementById('tview-content');
  const tasks=filterTasks([...p.tasks]).filter(tk=>tk.startDate||tk.dueDate).sort((a,b)=>(a.startDate||a.dueDate).localeCompare(b.startDate||b.dueDate));
  if(!tasks.length){ el.innerHTML=_tlNoTasks(); return; }
  const isES=LANG==='es';
  const allDates=tasks.flatMap(tk=>[tk.startDate||tk.dueDate,tk.dueDate||tk.startDate].filter(Boolean).map(d=>parseLocalDate(d))).filter(Boolean);
  let minD=new Date(Math.min(...allDates)); let maxD=new Date(Math.max(...allDates));
  minD.setMonth(minD.getMonth()+_ganttOffset); maxD.setMonth(maxD.getMonth()+_ganttOffset);
  minD.setDate(1); minD.setHours(0,0,0,0);
  maxD.setDate(new Date(maxD.getFullYear(),maxD.getMonth()+1,0).getDate()); maxD.setHours(23,59,59,999);
  const totalDays=Math.max(1,(maxD-minD)/86400000);
  if(_ganttZoomAuto){
    var avail=(el&&el.clientWidth?el.clientWidth:1000)-260-2;
    _ganttZoom=Math.max(3,Math.min(24,Math.floor(avail/Math.max(1,totalDays))));
  }
  const pxPerDay=_ganttZoom;
  const totalW=Math.round(totalDays*pxPerDay);
  const months=[]; const cur=new Date(minD);
  while(cur<=maxD){months.push({lbl:cur.toLocaleString(isES?'es-MX':'en-US',{month:'short'})+' '+cur.getFullYear(),days:new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate()});cur.setMonth(cur.getMonth()+1);}
  const weekCells=[];
  const wCur=new Date(minD);
  while(wCur<=maxD){
    const wEnd=new Date(wCur); wEnd.setDate(wEnd.getDate()+6);
    const wDays=Math.round((Math.min(wEnd,maxD)-wCur)/86400000)+1;
    weekCells.push(`<div class="tl-gantt-week" style="width:${wDays*pxPerDay}px">${isES?'S':'W'} ${Math.ceil(wCur.getDate()/7)}</div>`);
    wCur.setDate(wCur.getDate()+7);
  }
  const rows=tasks.map(tk=>{
    const tks=parseLocalDate(tk.startDate||tk.dueDate);
    const tke=parseLocalDate(tk.dueDate||tk.startDate);
    if(!tks||!tke||tke<minD||tks>maxD) return '';
    const clippedStart=tks<minD?minD:tks;
    const fullW=Math.round((tke-tks)/86400000+1)*pxPerDay;
    const clippedDays=tks<minD?Math.round((minD-tks)/86400000):0;
    // Ancho minimo para que una tarea de 1-2 dias siga leyendose como barra y no como punto.
    const w=Math.min(totalW,Math.max(38,fullW-clippedDays*pxPerDay));
    const l=Math.min(Math.max(0,totalW-w),Math.max(0,Math.round((clippedStart-minD)/86400000)*pxPerDay));
    const isDone=taskIsDone(tk);
    const phase=_tlTaskPhase(tk);
    return `<div class="tl-gantt-row">
      <div class="tl-gantt-lbl">
        <button class="rd-check sm${isDone?' done':''}" onclick="toggleTask('${tk.id}')" aria-label="${isDone?(isES?'Marcar como pendiente':'Mark as pending'):(isES?'Marcar como hecha':'Mark as done')}">${isDone?_bgSvg(BG_IC.check,10,3):''}</button>
        <div>
          <div class="rd-cell-main" title="${esc(tk.title)}">${esc(tk.title)}</div>
          <div class="rd-cell-sub">${esc(_tlPhaseLabel(phase))}</div>
        </div>
      </div>
      <div class="tl-gantt-track">
        <div class="tl-gantt-bar" style="left:${l}px;width:${w}px;background:${_tlBarColor(tk)}" title="${esc(tk.title)} · ${fmtDate(tk.startDate||tk.dueDate)} → ${fmtDate(tk.dueDate||tk.startDate)} · ${esc(taskStatusLabel(tk))}" onclick="openTaskModal('${tk.id}')">${w>=54?esc(tk.title):''}</div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=`
    <div class="tl-gantt-nav">
      <button class="rd-ibtn" onclick="_ganttOffset--;renderGantt(proj())" title="${isES?'Mes anterior':'Previous month'}" aria-label="${isES?'Mes anterior':'Previous month'}">&#8249;</button>
      <button class="btn btn-sm" onclick="_ganttOffset=0;_ganttZoomAuto=true;renderGantt(proj())">${isES?'Hoy':'Today'}</button>
      <button class="rd-ibtn" onclick="_ganttOffset++;renderGantt(proj())" title="${isES?'Mes siguiente':'Next month'}" aria-label="${isES?'Mes siguiente':'Next month'}">&#8250;</button>
      <div class="tl-zoom">
        <span class="rd-label">${isES?'Zoom':'Zoom'}</span>
        <button class="rd-ibtn" onclick="_tlSetGanttZoom(_ganttZoom-4)" title="${isES?'Alejar':'Zoom out'}" aria-label="${isES?'Alejar':'Zoom out'}">&minus;</button>
        <button class="rd-ibtn" onclick="_tlSetGanttZoom(_ganttZoom+4)" title="${isES?'Acercar':'Zoom in'}" aria-label="${isES?'Acercar':'Zoom in'}">+</button>
      </div>
    </div>
    <div class="tl-gantt"><div class="tl-gantt-scroll"><div style="min-width:${260+totalW}px">
      <div class="tl-gantt-head">
        <div class="tl-gantt-headlbl">${t('task')}</div>
        <div class="tl-gantt-months">${months.map(m=>`<div class="tl-gantt-month" style="width:${m.days*pxPerDay}px;flex-shrink:0">${esc(m.lbl)}</div>`).join('')}</div>
      </div>
      <div class="tl-gantt-weeks" style="padding-left:260px">${weekCells.join('')}</div>
      ${rows}
    </div></div></div>`;
  // Permite desplazar el gantt en horizontal y la página en vertical a la vez.
  var gs = el.querySelector('.tl-gantt-scroll');
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
  const isES=LANG==='es';
  const tasks=filterTasks(p.tasks);
  if(!tasks.length){ el.innerHTML=_tlNoTasks(); return; }
  const yr=calD.getFullYear();const mo=calD.getMonth();
  const fd=new Date(yr,mo,1).getDay();const dim=new Date(yr,mo+1,0).getDate();
  let mn=calD.toLocaleString(isES?'es-MX':'en-US',{month:'long',year:'numeric'});
  mn=mn.charAt(0).toUpperCase()+mn.slice(1);
  const tod=today();const tbd={};
  tasks.forEach(tk=>{if(!tk.dueDate)return;if(!tbd[tk.dueDate])tbd[tk.dueDate]=[];tbd[tk.dueDate].push(tk);});
  const dow=isES?['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let cells='';
  for(let i=0;i<fd;i++)cells+='<div class="tl-cal-cell is-out"></div>';
  for(let i=1;i<=dim;i++){
    const ds=yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');
    const tks=tbd[ds]||[];
    cells+=`<div class="tl-cal-cell${ds===tod?' is-today':''}">
      <div class="tl-cal-day">${i}</div>
      ${tks.map(function(tk){
        var tone=rdTone(_tlTaskTone(tk));
        return `<div class="tl-cal-ev" style="background:${tone.bg};color:${tone.fg}" title="${esc(tk.title)}" onclick="openTaskModal('${tk.id}')">${esc(tk.title)}</div>`;
      }).join('')}
    </div>`;
  }
  const rem=42-fd-dim;for(let i=0;i<rem;i++)cells+='<div class="tl-cal-cell is-out"></div>';
  el.innerHTML=`<div class="tl-cal">
    <div class="tl-cal-head">
      <h3 class="tl-cal-title">${esc(mn)}</h3>
      <div style="display:flex;gap:6px">
        <button class="rd-ibtn lg" onclick="calD.setMonth(calD.getMonth()-1);renderCal(proj())" title="${isES?'Mes anterior':'Previous month'}" aria-label="${isES?'Mes anterior':'Previous month'}">&#8249;</button>
        <button class="rd-ibtn lg" onclick="calD.setMonth(calD.getMonth()+1);renderCal(proj())" title="${isES?'Mes siguiente':'Next month'}" aria-label="${isES?'Mes siguiente':'Next month'}">&#8250;</button>
      </div>
    </div>
    <div class="tl-cal-dow">${dow.map(d=>'<div>'+d+'</div>').join('')}</div>
    <div class="tl-cal-grid">${cells}</div>
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
  return _bgEmptyState(
    isES?'Lista de invitados':'Guest list',
    isES?'Construye tu lista de invitados en minutos.':'Build your guest list in minutes.',
    isES?'Descarga la plantilla, llénala con tus invitados e impórtala de vuelta. También puedes agregarlos manualmente uno a uno.':'Download the template, fill it in with your guests, and import it back. You can also add guests one by one manually.',
    `<button class="btn btn-primary" onclick="downloadGuestTemplate()">${_bgSvg(BG_IC.down,13,2)}${isES?'Descargar plantilla':'Download template'}</button>
     <label class="btn" style="cursor:pointer">${_bgSvg(BG_IC.up,13,2)}${isES?'Importar invitados':'Import guests'}<input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)"></label>
     <button class="btn" onclick="openGuestModal()">${_bgSvg(BG_IC.plus,14,2.2)}${isES?'Agregar manualmente':'Add manually'}</button>`,
    BG_IC.users);
}
/** Color del punto de menú en la vista por mesas. */
var GS_MEAL_COLORS = {
  'chicken':'#F2A93B', 'pollo':'#F2A93B',
  'fish':'#3B7DD8',    'pescado':'#3B7DD8',
  'beef':'#C23C15',    'res':'#C23C15',
  'vegetarian':'#17A398', 'vegetariano':'#17A398',
  'vegan':'#0E7F76',   'vegano':'#0E7F76',
  'kids menu':'#7C5CE0', 'menú niños':'#7C5CE0', 'menu ninos':'#7C5CE0'
};
function _gsMealColor(meal){
  var key = String(meal==null?'':meal).trim().toLowerCase();
  if(!key) return 'var(--hairline)';
  if(GS_MEAL_COLORS[key]) return GS_MEAL_COLORS[key];
  var pal = ['#E4572E','#F2870F','#F2A93B','#17A398','#3B7DD8','#7C5CE0','#C89B6A'];
  var h = 0;
  for(var i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i)) >>> 0;
  return pal[h % pal.length];
}
/** 'Mesa 3' si el dato es solo un numero/letra; el valor tal cual si ya trae texto. */
function _gsTableLabel(tb){
  var v = fixMojibake(String(tb==null?'':tb)).trim();
  if(!v) return '';
  return (/^[0-9]+$/.test(v) || v.length <= 2) ? (t('table_header') + ' ' + v) : v;
}
function _gsRsvpTone(v){
  var value = guestRsvpValue(v);
  return value==='confirmed' ? 'success' : value==='declined' ? 'danger' : 'warn';
}
function _gsRsvpLabel(v){
  var value = guestRsvpValue(v), isES = LANG==='es';
  if(value==='confirmed') return isES?'Confirmado':'Confirmed';
  if(value==='declined')  return isES?'Rechazado':'Declined';
  return isES?'Pendiente':'Pending';
}
/** Píldora de RSVP que cicla pendiente → confirmado → rechazado al hacer clic. */
function _gsRsvpPill(g){
  var isES = LANG==='es';
  var hint = isES?'Clic para cambiar el RSVP':'Click to change RSVP';
  return rdPill(_gsRsvpLabel(g.rsvp), _gsRsvpTone(g.rsvp), { dot:true, click:true,
    attrs:'role="button" tabindex="0" title="'+esc(hint)+'" onclick="event.stopPropagation();cycleGuestRsvp(\''+g.id+'\')"' +
          ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();cycleGuestRsvp(\''+g.id+'\');}"' });
}

function renderGuests(){
  const p=proj();const el=document.getElementById('tab-guests');
  if(!p||!el) return;
  const isES=LANG==='es';
  if(!p.guests||!p.guests.length){
    el.innerHTML=`
    <div class="rd-tab-head">
      <div>
        <h2 class="rd-h2">${t('guest_management')}</h2>
        <p class="rd-sub">${isES?'Importa, organiza y confirma a tus invitados':'Import, organize and confirm your guests'}</p>
      </div>
    </div>
    ${renderGuestEmptyState()}`;
    return;
  }
  const guestCount=p.guests.length;
  const plusOnes=p.guests.filter(g=>g.plusOne).length;
  const totalGuests=guestCount+plusOnes;
  const confirmedGuests=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='confirmed').length;
  const confirmedPlusOnes=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='confirmed'&&g.plusOne).length;
  const confirmed=confirmedGuests+confirmedPlusOnes;
  const declinedGuests=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='declined').length;
  const declinedPlusOnes=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='declined'&&g.plusOne).length;
  const declined=declinedGuests+declinedPlusOnes;
  const pendingGuests=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='pending').length;
  const pendingPlusOnes=p.guests.filter(g=>guestRsvpValue(g.rsvp)==='pending'&&g.plusOne).length;
  const pending=pendingGuests+pendingPlusOnes;
  const tables=[...new Set(p.guests.filter(g=>g.table).map(g=>g.table))].length;
  const mt=function(label,value,color,title){
    return rdMetric({center:true, label:label, value:String(value), color:color, attrs:'title="'+esc(title)+'"'});
  };
  el.innerHTML=`
  <div class="rd-tab-head">
    <div>
      <h2 class="rd-h2">${t('guest_management')}</h2>
      <p class="rd-sub">${totalGuests} ${isES?'personas esperadas':'people expected'} &middot; ${confirmed} ${isES?'confirmadas':'confirmed'} &middot; ${pending} ${isES?'sin responder':'awaiting reply'}</p>
    </div>
    <div class="rd-actions">
      <button class="btn" onclick="downloadGuestTemplate()">${_bgSvg(BG_IC.down,13,2)}<span>${isES?'Plantilla CSV':'CSV template'}</span></button>
      <label class="btn" style="cursor:pointer">${_bgSvg(BG_IC.up,13,2)}<span>${isES?'Importar':'Import'}</span><input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)"></label>
      <button class="btn" onclick="exportGuestsExcel()">${_bgSvg(BG_IC.down,13,2)}<span>${isES?'Exportar Excel':'Export Excel'}</span></button>
      <button class="btn" onclick="exportGuestsCSV()">${_bgSvg(BG_IC.down,13,2)}<span>${isES?'Exportar CSV':'Export CSV'}</span></button>
      <button class="btn btn-primary" onclick="openGuestModal()">${_bgSvg(BG_IC.plus,14,2.4)}${t('add_guest')}</button>
    </div>
  </div>
  <div class="rd-metrics tight">
    ${mt(isES?'Invitados':'Guests', guestCount, 'var(--ink)', isES?'Invitados principales en la lista, sin acompañantes.':'Primary guests on the list, excluding plus ones.')}
    ${mt(isES?'Plus ones':'Plus ones', plusOnes, 'var(--champagne-deep)', isES?'Acompañantes marcados como +1 en la lista.':'Guests marked as plus ones on the list.')}
    ${mt(t('total_guests'), totalGuests, 'var(--accent-deep)', isES?('Total de asistentes previstos: invitados ('+guestCount+') + plus ones ('+plusOnes+').'):('Total expected attendees: guests ('+guestCount+') + plus ones ('+plusOnes+').'))}
    ${mt(t('confirmed_guests'), confirmed, 'var(--success)', isES?('Confirmados: invitados ('+confirmedGuests+') + plus ones ('+confirmedPlusOnes+').'):('Confirmed: guests ('+confirmedGuests+') + plus ones ('+confirmedPlusOnes+').'))}
    ${mt(t('pending'), pending, 'var(--warn)', isES?('Pendientes: invitados ('+pendingGuests+') + plus ones ('+pendingPlusOnes+').'):('Pending: guests ('+pendingGuests+') + plus ones ('+pendingPlusOnes+').'))}
    ${mt(t('declined'), declined, 'var(--accent-deep)', isES?('Rechazados: invitados ('+declinedGuests+') + plus ones ('+declinedPlusOnes+').'):('Declined: guests ('+declinedGuests+') + plus ones ('+declinedPlusOnes+').'))}
    ${mt(t('tables'), tables, 'var(--info)', isES?'Número de mesas asignadas actualmente en la lista de invitados.':'Number of tables currently assigned in the guest list.')}
  </div>
  <div class="gs-toolrow">
    <div class="rd-seg">
      <button class="${gView==='list'?'active':''}" onclick="gView='list';renderGuests()">${isES?'Lista completa':'Full list'}</button>
      <button class="${gView==='seating'?'active':''}" onclick="gView='seating';renderGuests()">${isES?'Por mesas':'By table'}</button>
    </div>
    ${_bgSearch('guest-search-input', isES?'Buscar invitado, mesa o categoría…':'Search guest, table or category…', gFilter, gView==='seating'?'debouncedSeatingFilter(this.value)':'debouncedGuestFilter(this.value)')}
  </div>
  <div id="gview"></div>
  ${renderMobileStickyActionBar(`
    <label class="btn" style="cursor:pointer">
      ${isES?'Importar':'Import'}<input type="file" accept=".csv,.xlsx" multiple class="hidden" onchange="importCSV(this)">
    </label>
    <button class="btn btn-primary" onclick="openGuestModal()">${t('add_guest')}</button>
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
  const isES=LANG==='es';
  let seated = p.guests.filter(g => g.table);
  if(gFilter){var _sfq=gFilter.toLowerCase();seated=seated.filter(function(g){return _guestMatchesFilter(g,_sfq);});}
  seated = seated.sort((a,b) => String(a.table).localeCompare(String(b.table), undefined, { numeric:true }));
  const tables = [...new Set(seated.map(g => g.table))];
  const unseated = p.guests.filter(function(g){ return !g.table; }).length;
  const meals = [...new Set(p.guests.map(function(g){ return String(g.meal||'').trim(); }).filter(Boolean))];
  const legend = meals.length ? `<div class="gs-legend">${meals.map(function(m){
      return '<span><i class="gs-dot" style="background:'+_gsMealColor(m)+'"></i>'+esc(fixMojibake(m))+'</span>';
    }).join('')}${unseated?'<span><i class="gs-dot" style="background:var(--hairline)"></i>'+esc(unseated+' '+(isES?'sin mesa':'unseated'))+'</span>':''}</div>` : '';
  document.getElementById('gview').innerHTML = tables.length
    ? legend + '<div class="gs-tables">' + tables.map(function(tb){
        var gs = seated.filter(function(g){ return g.table === tb; });
        var seats = gs.reduce(function(a,g){ return a + 1 + (g.plusOne?1:0); }, 0);
        return `<section class="gs-table-card">
          <div class="gs-table-head">
            <h3 class="gs-table-name">${esc(_gsTableLabel(tb))}</h3>
            ${rdPill(seats+' '+(seats===1?(isES?'lugar':'seat'):(isES?'lugares':'seats')), seats>0?'champagne':'neutral', {sm:true})}
          </div>
          ${gs.map(function(g){
            return `<div class="gs-guest" onclick="openGuestModal('${g.id}')" title="${esc(isES?'Editar invitado':'Edit guest')}">
              <span class="gs-dot" style="background:${_gsMealColor(g.meal)}"></span>
              <span class="gs-guest-name">${guestText(g.name)}${g.plusOne?' +1':''}</span>
              <span class="gs-guest-meal">${g.meal?guestText(g.meal):_gsRsvpLabel(g.rsvp)}</span>
            </div>`;
          }).join('')}
        </section>`;
      }).join('') + '</div>'
    : `<div class="bg-norows">${t('no_guests_found')}
        <button class="btn btn-sm" onclick="gView='list';renderGuests()">${isES?'Ver lista completa':'See full list'}</button></div>`;
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
var GS_COLS = 'style="grid-template-columns:34px minmax(170px,1.5fr) minmax(140px,1.1fr) 118px 130px 84px 56px 110px 74px"';
function _gsSortHead(key, label){
  var isActive = gSort===key;
  var arrow = isActive ? (gAsc?'&#9650;':'&#9660;') : '&#8597;';
  return '<button class="gs-sortbtn' + (isActive?' is-active':'') + '" onclick="gSort=\'' + key + '\';gAsc=' + (isActive?'!gAsc':'true') + ';renderGuestList(proj())">' +
    esc(label) + '<span class="gs-arrow">' + arrow + '</span></button>';
}
function renderGuestList(p){
  const isES=LANG==='es';
  let guests=[...p.guests];
  if(gFilter){var _gfq=gFilter.toLowerCase();guests=guests.filter(function(g){return _guestMatchesFilter(g,_gfq);});}
  guests.sort((a,b)=>{const va=String(a[gSort]||''),vb=String(b[gSort]||'');return gAsc?va.localeCompare(vb,undefined,{numeric:true}):vb.localeCompare(va,undefined,{numeric:true});});
  if(isPhoneViewport()){
    document.getElementById('gview').innerHTML = renderGuestMobileCards(guests);
    updateGuestBulkBar();
    return;
  }
  document.getElementById('gview').innerHTML=`
  <div class="rd-table">
    <div class="rd-table-tools">
      <span class="rd-hint">${guests.length} ${guests.length===1?(isES?'invitado':'guest'):(isES?'invitados':'guests')}</span>
      <div class="rd-spacer"></div>
      <select class="rd-input" style="width:auto" aria-label="${t('sort_name')}" onchange="gSort=this.value;renderGuestList(proj())">
        <option value="name" ${gSort==='name'?'selected':''}>${esc(t('sort_name'))}</option>
        <option value="rsvp" ${gSort==='rsvp'?'selected':''}>${esc(t('sort_rsvp'))}</option>
        <option value="table" ${gSort==='table'?'selected':''}>${esc(t('sort_table'))}</option>
        <option value="category" ${gSort==='category'?'selected':''}>${esc(t('sort_category'))}</option>
      </select>
      <button class="btn btn-sm" onclick="gAsc=!gAsc;renderGuestList(proj())">${gAsc?t('asc'):t('desc')}</button>
    </div>
    <div id="guest-bulk-bar" class="bg-bulk" style="display:${guestSelectionCount()?'flex':'none'}">
      <span id="guest-bulk-count" class="bg-bulk-count">${guestSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
      <button class="btn btn-sm" onclick="openBulkGuestEditModal()">${isES?'Editar seleccionados':'Edit selected'}</button>
      <button class="btn btn-sm btn-danger" onclick="bulkDeleteGuests()">${isES?'Eliminar seleccionados':'Delete selected'}</button>
      <button class="btn btn-sm" onclick="clearGuestSelection()">${isES?'Limpiar selección':'Clear selection'}</button>
    </div>
    <div class="rd-table-scroll"><div style="min-width:1040px">
      <div class="rd-thead" ${GS_COLS}>
        <div><input type="checkbox" id="guest-chk-all" class="bg-chk" onchange="toggleAllVisibleGuests(this.checked)" aria-label="${isES?'Seleccionar todos':'Select all'}"></div>
        <div>${_gsSortHead('name', t('col_name'))}</div>
        <div>${t('col_contact')}</div>
        <div>${_gsSortHead('category', t('col_category'))}</div>
        <div>${_gsSortHead('rsvp', t('col_rsvp'))}</div>
        <div>${_gsSortHead('table', t('col_table'))}</div>
        <div>${t('col_plus_one')}</div>
        <div>${t('col_meal')}</div>
        <div></div>
      </div>
      <div id="guest-rows-body">${buildGuestRows(guests)}</div>
    </div></div>
  </div>`;
  updateGuestBulkBar();
}
function renderGuestMobileCards(guests){
  const isES = LANG==='es';
  const empty = `<div class="bg-norows">${t('no_guests_found')}</div>`;
  return `<div class="gs-mobtools">
      <div class="gs-mobrow">
        <select class="rd-input" style="flex:1;min-width:0" aria-label="${t('sort_name')}" onchange="gSort=this.value;renderGuestList(proj())">
          <option value="name" ${gSort==='name'?'selected':''}>${esc(t('sort_name'))}</option>
          <option value="rsvp" ${gSort==='rsvp'?'selected':''}>${esc(t('sort_rsvp'))}</option>
          <option value="table" ${gSort==='table'?'selected':''}>${esc(t('sort_table'))}</option>
          <option value="category" ${gSort==='category'?'selected':''}>${esc(t('sort_category'))}</option>
        </select>
        <button class="btn btn-sm" onclick="gAsc=!gAsc;renderGuestList(proj())">${gAsc?t('asc'):t('desc')}</button>
        <label class="bg-selall">
          <input type="checkbox" id="guest-chk-all" class="bg-chk" onchange="toggleAllVisibleGuests(this.checked)">
          <span>${isES?'Todos':'All'}</span>
        </label>
      </div>
      <div id="guest-bulk-bar" class="bg-bulk" style="display:${guestSelectionCount()?'flex':'none'};border-radius:14px;border-bottom:none">
        <span id="guest-bulk-count" class="bg-bulk-count">${guestSelectionCount()} ${isES?'seleccionado(s)':'selected'}</span>
        <button class="btn btn-sm" onclick="openBulkGuestEditModal()">${isES?'Editar':'Edit'}</button>
        <button class="btn btn-sm btn-danger" onclick="bulkDeleteGuests()">${isES?'Eliminar':'Delete'}</button>
        <button class="btn btn-sm" onclick="clearGuestSelection()">${isES?'Limpiar':'Clear'}</button>
      </div>
    </div>
    <div id="guest-mobile-list" class="gs-cards">
      ${guests.length ? guests.map(function(g){
        return `<article class="gs-card" onclick="openGuestModal('${g.id}')">
          <label onclick="event.stopPropagation()" style="display:flex;align-items:center">
            <input type="checkbox" class="guest-sel bg-chk" data-gid="${g.id}" ${isGuestSelected(g.id)?'checked':''} onchange="toggleGuestSelection('${g.id}',this.checked)" aria-label="${isES?'Seleccionar':'Select'} ${guestText(g.name)}">
          </label>
          <span class="rd-avatar round">${esc(rdInitials(fixMojibake(String(g.name||''))))}</span>
          <div class="gs-card-info">
            <div class="rd-cell-main">${guestText(g.name)}${g.plusOne?' +1':''}</div>
            <div class="gs-card-row">
              <span>${guestValueOrDash(g.category)}</span>
              ${g.table?'<span>· '+esc(_gsTableLabel(g.table))+'</span>':''}
              <span class="gs-push">${_gsRsvpPill(g)}</span>
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
  const isES=LANG==='es';
  if(!guests.length) return `<div class="bg-norows">${t('no_guests_found')}</div>`;
  return guests.map(function(g){
    return `<div class="rd-row" ${GS_COLS} data-gid="${g.id}">
    <div><input type="checkbox" class="guest-sel bg-chk" data-gid="${g.id}" ${isGuestSelected(g.id)?'checked':''} onchange="toggleGuestSelection('${g.id}',this.checked)" aria-label="${isES?'Seleccionar':'Select'} ${guestText(g.name)}"></div>
    <div class="gs-name">
      <span class="rd-avatar round">${esc(rdInitials(fixMojibake(String(g.name||''))))}</span>
      <div class="gs-name-txt">
        <div class="rd-cell-main">${gEditSpan(g.id,'name',guestText(g.name))}</div>
        <div class="rd-cell-sub">${gEditSpan(g.id,'notes',guestText(g.notes))}</div>
      </div>
    </div>
    <div class="rd-cell">
      <div>${gEditSpan(g.id,'email',guestText(g.email))}</div>
      <div class="rd-cell-sub">${gEditSpan(g.id,'phone',guestText(g.phone))}</div>
    </div>
    <div class="rd-cell">${gEditSpan(g.id,'category',guestValueOrDash(g.category))}</div>
    <div>${_gsRsvpPill(g)}</div>
    <div class="rd-cell">${gEditSpan(g.id,'table',guestText(g.table))}</div>
    <div class="rd-cell">${gEditSpan(g.id,'plusOne',g.plusOne?'&#10003;':'')}</div>
    <div class="rd-cell">${gEditSpan(g.id,'meal',guestText(g.meal))}</div>
    <div class="gs-rowacts">
      <button class="rd-ibtn" title="${isES?'Editar':'Edit'}" aria-label="${isES?'Editar':'Edit'}" onclick="openGuestModal('${g.id}')">${_bgSvg(BG_IC.edit,13,2)}</button>
      <button class="rd-ibtn danger" title="${isES?'Eliminar':'Delete'}" aria-label="${isES?'Eliminar':'Delete'}" onclick="delGuest('${g.id}')">${_bgSvg(BG_IC.trash,13,2)}</button>
    </div>
  </div>`;
  }).join('');
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
  function rebuildRow(){ var tr=editor.closest('.rd-row'); if(tr) tr.outerHTML=buildGuestRows([g]); }
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
      ${rdPill(_gsRsvpLabel(g.rsvp), _gsRsvpTone(g.rsvp), {sm:true, dot:true})}
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
