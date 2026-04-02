// --- WIZARD STATE ---------------------------------------------------------
var _wiz = null;
document.addEventListener('keydown', function(e){
  if(!_wiz || e.key !== 'Enter' || e.shiftKey) return;
  var modal = document.getElementById('mo');
  if(!modal || !modal.classList.contains('open')) return;
  var active = document.activeElement;
  if(active && active.tagName === 'TEXTAREA') return;
  e.preventDefault();
  _wizNext();
});

// --- STATUS LABEL ---------------------------------------------------------
var _STATUS_KEY = {'to-be-confirmed':'planning','confirmed':'confirmed','in-progress':'in_progress','completed':'completed','cancelled':'cancelled'};
function statusLabel(s){ return s ? t('status_'+(_STATUS_KEY[s]||s.replace(/-/g,'_')))||s : ''; }

// --- EVENT SEARCH ---------------------------------------------------------
var _evSearch = '';
var _evSelected = {};
var _evVisibleIds = [];
var _evSearchTimer = null;
function filterEvents(query){
  _evSearch = typeof query === 'string' && query.length > 200 ? query.substring(0, 200) : (query || '');
  clearTimeout(_evSearchTimer);
  _evSearchTimer = setTimeout(renderEvents, 250);
}

var _WIZ_TYPES = [
  { value:'social',     icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    label_en:'Social',     label_es:'Social',        desc_en:'Weddings, birthdays, private celebrations',    desc_es:'Bodas, cumpleaños, celebraciones privadas' },
  { value:'corporate',  icon:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    label_en:'Corporate',  label_es:'Corporativo',   desc_en:'Conferences, galas, corporate gatherings',     desc_es:'Conferencias, galas, eventos de empresa' },
  { value:'community',  icon:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    label_en:'Community',  label_es:'Comunidad',     desc_en:'Fairs, fundraisers, public gatherings',        desc_es:'Ferias, recaudaciones, reuniones públicas' },
  { value:'government', icon:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    label_en:'Government', label_es:'Gubernamental', desc_en:'Official ceremonies and civic events',          desc_es:'Ceremonias oficiales y eventos cívicos' },
  { value:'education',  icon:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    label_en:'Education',  label_es:'Educación',     desc_en:'Graduations, workshops, seminars',             desc_es:'Graduaciones, talleres, seminarios' },
  { value:'other', icon:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    label_en:'Other', label_es:'Otro', desc_en:'Custom event - define your own category', desc_es:'Evento personalizado - define tu propia categoría',
    isOther: true },
];

var _WIZ_GOALS = [
  { id:'vendors',   icon:'<path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    en:'Manage vendors and suppliers',    es:'Gestionar proveedores' },
  { id:'budget',    icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    en:'Track budget and payments',       es:'Presupuesto y pagos' },
  { id:'guests',    icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    en:'Guest list and RSVPs',            es:'Lista de invitados y confirmaciones' },
  { id:'tasks',     icon:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    en:'Timeline and task tracking',      es:'Cronograma y seguimiento de tareas' },
  { id:'layout',    icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    en:'Venue layout design',             es:'Diseño del plano del lugar' },
  { id:'moodboard', icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    en:'Moodboard and visual references', es:'Moodboard y referencias visuales' },
];

function openEventModal(id) {
  var p = id ? uproj()[id] : null;
  if (p) { _openEditModal(id, p); return; }
  _wiz = { step:0, type:window._settingsDefaultEventType||'', name:'', clientName:'', description:'', date:'', location:'', budget:'', goals:[], otherLabel:'' };
  _renderWizard();
}

function _openEditModal(id, p) {
  openMo(`<form onsubmit="event.preventDefault();saveEvent('${id||''}')">
  <div class="mo-title">${t('edit_event_title')}</div>
  <div class="form-grid">
    <div class="ig" style="grid-column:1/-1"><label>${t('event_name')} *</label><input class="input" id="e-name" value="${esc(p?.name||'')}"></div>
    <div class="ig" style="grid-column:1/-1"><label>${t('description')}</label><input class="input" id="e-desc" value="${esc(p?.description||'')}"></div>
    <div class="ig"><label>${t('client_name')} *</label><input class="input" id="e-client" value="${esc(p?.clientName||'')}"></div>
    <div class="ig"><label>${t('event_type')}</label><select class="select" id="e-type">${[['social',t('type_social')],['corporate',t('type_corporate')],['community',t('type_community')],['government',t('type_government')],['education',t('type_education')]].map(([v,l])=>`<option value="${v}"${p?.type===v?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="ig"><label>${t('event_date')} *</label>
      <div class="date-field">
        <input class="input date-field-input" type="text" id="e-date" value="${p?.date?formatDMY(p.date):''}" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker('e-date')" onfocus="openCalendarPicker('e-date')">
        <button type="button" class="date-field-btn" onclick="openCalendarPicker('e-date')" aria-label="${t('event_date')}">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </button>
      </div>
    </div>
    <div class="ig"><label>${t('location')}</label><input class="input" id="e-location" value="${esc(p?.location||'')}"></div>
    <div class="ig"><label>${t('total_budget')} ($)</label><input class="input" id="e-budget" type="number" min="0" value="${p?.budget||''}"></div>
    <div class="ig"><label>${t('status')}</label><select class="select" id="e-status"><option value="to-be-confirmed"${p?.status==='to-be-confirmed'?' selected':''}>${t('status_planning')}</option><option value="confirmed"${p?.status==='confirmed'?' selected':''}>${t('status_confirmed')}</option><option value="in-progress"${p?.status==='in-progress'?' selected':''}>${t('status_in_progress')}</option><option value="completed"${p?.status==='completed'?' selected':''}>${t('status_completed')}</option><option value="cancelled"${p?.status==='cancelled'?' selected':''}>${t('status_cancelled')}</option></select></div>
  </div>
  <div class="mo-foot">
    <button type="button" class="btn btn-ghost" onclick="closeMo()">${t('cancel')}</button>
    <button type="submit" class="btn btn-primary">${t('save_event')}</button>
  </div></form>`);
}

function _renderWizard() {
  var s = _wiz.step;
  var isES = LANG === 'es';
  var stepLabels = isES
    ? ['Tipo','Detalles','Logística']
    : ['Type','Details','Logistics'];

  var prog = '<div style="display:flex;align-items:flex-start;gap:0;margin-bottom:30px;">';
  for (var i = 0; i < stepLabels.length; i++) {
    var done   = i < s;
    var active = i === s;
    var circBg  = done ? 'var(--gold)' : active ? 'var(--gold-l)' : 'var(--bg)';
    var circBd  = (done || active) ? 'var(--gold)' : 'var(--border)';
    var circClr = done ? '#fff' : active ? 'var(--gold-h)' : 'var(--light)';
    var txtClr  = active ? 'var(--gold-h)' : done ? 'var(--text)' : 'var(--light)';
    var txtW    = active ? '600' : '400';
    var inner   = done ? '<svg width="11" height="11" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : String(i + 1);
    var lineClr = i <= s ? 'var(--gold)' : 'var(--border)';
    var line    = i > 0 ? '<div style="position:absolute;right:50%;top:13px;width:100%;height:1px;background:'+lineClr+'"></div>' : '';
    prog += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;">'
      + line
      + '<div style="width:26px;height:26px;border-radius:50%;border:1.5px solid '+circBd+';background:'+circBg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:'+circClr+';position:relative;z-index:1;">'+inner+'</div>'
      + '<div style="font-size:10px;margin-top:5px;color:'+txtClr+';font-weight:'+txtW+';white-space:nowrap;letter-spacing:.3px;">'+stepLabels[i]+'</div>'
      + '</div>';
  }
  prog += '</div>';

  var body = '';
  if      (s === 0) body = _wizStep0(isES);
  else if (s === 1) body = _wizStep1(isES);
  else if (s === 2) body = _wizStep2(isES);
  else if (s === 3) body = _wizStep3(isES);
  else              body = _wizStep4(isES);

  var backBtn = s > 0
    ? '<button class="btn btn-ghost" onclick="_wizBack()">'+(isES?'← Atrás':'← Back')+'</button>'
    : '<button class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>';

  var nextLbl = s === 2 ? (isES ? 'Crear evento' : 'Create event') : (isES ? 'Siguiente' : 'Next →');

  openMo(
    '<div style="width:100%;max-width:560px;">'
    + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;color:var(--gold-h);margin-bottom:3px;">'+(isES?'Nuevo evento':'New event')+'</div>'
    + '<div style="font-size:12px;color:var(--light);margin-bottom:24px;letter-spacing:.3px;text-transform:uppercase;">'+(isES?'Paso '+(s+1)+' de 3':'Step '+(s+1)+' of 3')+'</div>'
    + prog + body
    + '<div class="mo-foot" style="margin-top:28px;">'
    + backBtn
    + '<button class="btn btn-primary" onclick="_wizNext()">'+nextLbl+'</button>'
    + '</div></div>'
  );
}

function _wizStep0(isES) {
  var cards = '';
  for (var i = 0; i < _WIZ_TYPES.length; i++) {
    var et  = _WIZ_TYPES[i];
    var sel = _wiz.type === et.value;
    var lbl  = isES ? et.label_es : et.label_en;
    var desc = isES ? et.desc_es  : et.desc_en;
    var isOther = et.isOther;
    var unselBd  = isOther ? '#94a3b8' : 'var(--border)';
    var selBd    = isOther ? '#475569' : 'var(--gold)';
    var selBg    = isOther ? '#f1f5f9' : 'var(--gold-l)';
    var icoBgSel = isOther ? '#475569' : 'var(--gold)';
    var icoBgUn  = isOther ? '#cbd5e1' : 'var(--border)';
    var checkClr = isOther ? '#475569' : 'var(--gold)';
    cards += '<div onclick="_wizPickType(\''+et.value+'\')" style="display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:var(--r);border:1.5px solid '+(sel?selBd:unselBd)+';background:'+(sel?selBg:'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<div style="width:36px;height:36px;border-radius:9px;background:'+(sel?icoBgSel:icoBgUn)+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +'<svg width="17" height="17" fill="none" stroke="'+(sel?'#fff':'var(--muted)')+'" stroke-width="1.8" viewBox="0 0 24 24">'+et.icon+'</svg></div>'
      +'<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:1px;">'+lbl+'</div><div style="font-size:12px;color:var(--muted);">'+desc+'</div></div>'
      +(sel?'<svg width="16" height="16" fill="none" stroke="'+checkClr+'" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div>';
  }
  var otherInput = _wiz.type === 'other'
    ? '<div class="ig" style="margin-top:4px;margin-bottom:4px;">'
      +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+(isES?'¿Cómo llamarías a este tipo?':'What would you call this event type?')+'</label>'
      +'<input class="input" id="wiz-other-label" placeholder="'+(isES?'Ej. Festival, Retiro...':'E.g. Festival, Retreat...')+'" value="'+(esc(_wiz.otherLabel||''))+'" oninput="if(_wiz)_wiz.otherLabel=this.value">'
      +'</div>'
    : '';
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'Tipo de evento':'Event type')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Selecciona la categoría que mejor describe este evento.':'Select the category that best describes this event.')+'</div>'
    +cards+otherInput+'</div>';
}
function _wizPickType(val) { if (_wiz) { _wiz.type = val; _renderWizard(); } }

function _wizStep1(isES) {
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'Detalles del evento':'Event details')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px;">'+(isES?'Asigna un nombre y vincúlalo a un cliente u organización.':'Give it a name and link it to a client or organization.')+'</div>'
    +_wizField('wiz-name',   isES?'Nombre del evento *':'Event name *',          isES?'Ej. Gala de Verano 2026':'E.g. Summer Gala 2026',     _wiz.name,        'text')
    +_wizField('wiz-client', isES?'Cliente / Organización *':'Client / Organization *', isES?'Nombre del cliente':'Client name',          _wiz.clientName,  'text')
    +_wizField('wiz-desc',   isES?'Descripción (opcional)':'Description (optional)',    isES?'Una línea sobre el evento':'One line about this event', _wiz.description,'text')
    +'</div>';
}

function _wizStep2(isES) {
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'Fecha y lugar':'Date and venue')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px;">'+(isES?'Define cuándo y dónde se llevará a cabo el evento.':'Set when and where the event will take place.')+'</div>'
    +'<div class="ig" style="margin-bottom:14px;">'
    +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+(isES?'Fecha del evento *':'Event date *')+'</label>'
    +'<div class="date-field">'
    +'<input class="input date-field-input" type="text" id="wiz-date" value="'+(_wiz.date?formatDMY(_wiz.date):'')+'" placeholder="DD/MM/YYYY" readonly onclick="openCalendarPicker(\'wiz-date\')" onfocus="openCalendarPicker(\'wiz-date\')">'
    +'<button type="button" class="date-field-btn" onclick="openCalendarPicker(\'wiz-date\')" aria-label="'+(isES?'Fecha del evento':'Event date')+'">'
    +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
    +'</button></div>'
    +'</div>'
    +_wizField('wiz-location', isES?'Sede / Lugar':'Venue / Location', isES?'Nombre o dirección del lugar':'Venue name or address', _wiz.location, 'text')
    +_wizField('wiz-budget',   isES?'Presupuesto total ('+CURRENCY.symbol+')':'Total budget ('+CURRENCY.symbol+')', '0', _wiz.budget, 'number')
    +'</div>';
}

function _wizStep3(isES) {
  var items = '';
  for (var i = 0; i < _WIZ_GOALS.length; i++) {
    var g   = _WIZ_GOALS[i];
    var sel = _wiz.goals.indexOf(g.id) > -1;
    var lbl = isES ? g.es : g.en;
    items += '<div onclick="_wizToggleGoal(\''+g.id+'\')" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--r);border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold-l)':'transparent')+';cursor:pointer;transition:var(--tr);margin-bottom:8px;">'
      +'<svg width="16" height="16" fill="none" stroke="'+(sel?'var(--gold-h)':'var(--muted)')+'" stroke-width="1.8" viewBox="0 0 24 24">'+g.icon+'</svg>'
      +'<span style="font-size:13px;font-weight:'+(sel?'600':'400')+';color:var(--text);flex:1;">'+lbl+'</span>'
      +'<div style="width:18px;height:18px;border-radius:4px;border:1.5px solid '+(sel?'var(--gold)':'var(--border)')+';background:'+(sel?'var(--gold)':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +(sel?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div></div>';
  }
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'¿Qué quieres gestionar?':'What will you manage?')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Selecciona todo lo que aplique. Puedes ajustarlo después.':'Select everything that applies. You can adjust this later.')+'</div>'
    +items+'</div>';
}
function _wizToggleGoal(id) {
  if (!_wiz) return;
  var i = _wiz.goals.indexOf(id);
  if (i > -1) _wiz.goals.splice(i, 1); else _wiz.goals.push(id);
  _renderWizard();
}

function _wizStep4(isES) {
  var typeInfo = null;
  for (var i = 0; i < _WIZ_TYPES.length; i++) { if (_WIZ_TYPES[i].value === _wiz.type) { typeInfo = _WIZ_TYPES[i]; break; } }
  typeInfo = typeInfo || {};
  var typeLbl  = isES ? typeInfo.label_es : typeInfo.label_en;
  var goalLbls = [];
  for (var j = 0; j < _wiz.goals.length; j++) {
    for (var k = 0; k < _WIZ_GOALS.length; k++) {
      if (_WIZ_GOALS[k].id === _wiz.goals[j]) { goalLbls.push(isES ? _WIZ_GOALS[k].es : _WIZ_GOALS[k].en); break; }
    }
  }
  var na = '<span style="color:var(--light);font-style:italic;">'+(isES?'No especificado':'Not specified')+'</span>';
  function row(label, value) {
    return '<div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid var(--border);">'
      +'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;color:var(--light);width:110px;flex-shrink:0;padding-top:2px;">'+label+'</div>'
      +'<div style="font-size:13px;font-weight:500;color:var(--text);">'+value+'</div></div>';
  }
  var rows = row(isES?'Tipo':'Type', typeLbl||na)
    + row(isES?'Nombre':'Name', _wiz.name ? esc(_wiz.name) : na)
    + row(isES?'Cliente':'Client', _wiz.clientName ? esc(_wiz.clientName) : na)
    + (_wiz.description ? row(isES?'Descripción':'Description', esc(_wiz.description)) : '')
    + row(isES?'Fecha':'Date', _wiz.date ? formatDMY(_wiz.date) : na)
    + row(isES?'Sede':'Venue', _wiz.location ? esc(_wiz.location) : na)
    + row(isES?'Presupuesto':'Budget', _wiz.budget ? (CURRENCY.symbol + Number(_wiz.budget).toLocaleString()) : na)
    + (goalLbls.length ? row(isES?'Objetivos':'Goals', goalLbls.join(', ')) : '');
  return '<div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">'+(isES?'Confirma los detalles':'Confirm details')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">'+(isES?'Revisa todo antes de crear el evento.':'Review everything before creating the event.')+'</div>'
    +'<div style="border:1px solid var(--border);border-radius:var(--r);padding:0 16px;background:var(--bg);">'+rows+'</div></div>';
}

function _wizField(id, label, placeholder, value, type) {
  var val = value ? esc(String(value)) : '';
  return '<div class="ig" style="margin-bottom:14px;">'
    +'<label style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;">'+label+'</label>'
    +'<input class="input" id="'+id+'" type="'+(type||'text')+'" placeholder="'+placeholder+'" value="'+val+'">'
    +'</div>';
}

function _wizFlush() {
  if (!_wiz) return;
  var fields = [
    ['wiz-name',     'name'],
    ['wiz-client',   'clientName'],
    ['wiz-desc',     'description'],
    ['wiz-date',     'date'],
    ['wiz-location',    'location'],
    ['wiz-budget',      'budget'],
    ['wiz-other-label', 'otherLabel']
  ];
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i][0]);
    if (el) _wiz[fields[i][1]] = el.value;
  }
}

function _wizNext() {
  if (!_wiz) return;
  _wizFlush();
  var s    = _wiz.step;
  var isES = LANG === 'es';
  if (s === 0 && !_wiz.type) { toast(isES?'Selecciona un tipo de evento':'Select an event type','e'); return; }
  if (s === 1) {
    if (!(_wiz.name||'').trim())       { toast(isES?'El nombre es requerido':'Event name is required','e'); return; }
    if (!(_wiz.clientName||'').trim()) { toast(isES?'El cliente es requerido':'Client name is required','e'); return; }
  }
  if (s === 2 && !_wiz.date) { toast(isES?'La fecha es requerida':'Event date is required','e'); return; }
  if (s === 2 && _wiz.budget && +_wiz.budget < 0) { toast(isES?'El presupuesto no puede ser negativo':'Budget cannot be negative','e'); return; }
  if (s === 2) { _wizFinish(); return; }
  _wiz.step++;
  _renderWizard();
}

function _wizBack() {
  if (!_wiz) return;
  _wizFlush();
  if (_wiz.step > 0) { _wiz.step--; _renderWizard(); }
}

function _wizFinish() {
  _wizFlush();
  var isES   = LANG === 'es';
  var name   = (_wiz.name||'').trim();
  var client = (_wiz.clientName||'').trim();
  var date   = parseUserDate(_wiz.date);
  if (!name||!client||!date) { toast(isES?'Nombre, cliente y fecha son requeridos':'Name, client and date required','e'); return; }
  var np = {
    id: 'p'+Date.now(),
    vendors: [], vendorsInitialized: true,
    tasks: [], tasksInitialized: true, guests: [], layoutItems: [], layoutQuoteExtras: [], layoutExport: null, savedLayouts: [],
    moodboard: { folders:[], uncategorized:[] },
    name: name, clientName: client, description: _wiz.description,
    type: _wiz.type === 'other' ? ('other:' + ((_wiz.otherLabel||'').trim() || 'Other')) : _wiz.type, date: date, location: _wiz.location,
    budget: +_wiz.budget||0, status: 'to-be-confirmed',
    wizardGoals: _wiz.goals
  };
  saveProj(np);
  closeMo();
  _wiz = null;
  toast(isES?'¡Evento creado!':'Event created!','s');
  setTimeout(function(){ openProject(np.id); }, 80);
}

async function saveEvent(id){
  const name=gv('e-name'),client=gv('e-client'),date=parseUserDate(gv('e-date'));
  if(!name||!client||!date)return toast('Name, client and date required','e');
  if(+gv('e-budget') < 0) return toast(LANG==='es'?'El presupuesto no puede ser negativo':'Budget cannot be negative','e');
  var p=id?uproj()[id]:null;
  const data={name,clientName:client,date,description:gv('e-desc'),type:gv('e-type'),location:gv('e-location'),budget:+gv('e-budget')||0,status:gv('e-status')};
  if(p){
    // If full data not yet loaded, fetch it before mutating to avoid overwriting with stub
    if(p._metaOnly && typeof loadProjectById==='function'){
      var loaded=await loadProjectById(id);
      if(loaded) p=loaded;
    }
    Object.assign(p,data);saveProj(p);if(CID===id){renderPNav();if(CTAB==='dashboard')renderDash();}
  }
  else{const np={id:'p'+Date.now(),vendors:[],vendorsInitialized:true,tasks:[],tasksInitialized:true,guests:[],layoutItems:[],layoutQuoteExtras:[],layoutExport:null,savedLayouts:[],moodboard:{folders:[],uncategorized:[]},...data};saveProj(np);}
  closeMo();
  setTimeout(function(){ renderEvents(); }, 50);
  toast(id?'Event updated':'Event created!','s');
}

var _expandedEventIds = [];
function toggleEventExpand(eid){
  var idx = _expandedEventIds.indexOf(eid);
  if(idx > -1) _expandedEventIds.splice(idx, 1);
  else _expandedEventIds.push(eid);
  var card = document.querySelector('.emc[data-eid="'+eid+'"]');
  if(card) card.classList.toggle('emc-open', _expandedEventIds.indexOf(eid) > -1);
}
function renderEvents(){
  var isMob = typeof isPhoneViewport === 'function' && isPhoneViewport();
  if(isMob) _evView='grid';
  updateEvSortLabel();
  updateEvFilterLabels();
  const esEl=document.getElementById('event-search');
  if(esEl) esEl.placeholder=LANG==='es'?'Buscar eventos...':'Search events...';
  const efFrom=document.getElementById('ef-from'); const efTo=document.getElementById('ef-to');
  if(efFrom&&!efFrom.value&&_efFr){ efFrom.value=formatDMY(_efFr.toISOString().slice(0,10)); }
  if(efTo&&!efTo.value&&_efTo){ efTo.value=formatDMY(_efTo.toISOString().slice(0,10)); }
  const efBtn=document.getElementById('ef-alltime');
  if(efBtn) efBtn.classList.toggle('active',_efAt);
  const evGridBtn=document.getElementById('ev-view-grid');
  const evListBtn=document.getElementById('ev-view-list');
  if(evGridBtn) evGridBtn.style.display = isMob ? 'none' : '';
  if(evListBtn) evListBtn.style.display = isMob ? 'none' : '';
  if(evGridBtn) evGridBtn.classList.toggle('active',_evView==='grid');
  if(evListBtn) evListBtn.classList.toggle('active',_evView==='list');
  // Hide desktop toolbar on mobile, show compact search inline
  var evToolbarEl = document.getElementById('ev-toolbar');
  if(evToolbarEl) evToolbarEl.style.display = isMob ? 'none' : 'flex';

  const allEvents=Object.values(uproj()).filter(p=>p&&p.id&&p.id!=='__library__'&&p.id!=='__lib_layout__'&&p.status&&p.status!=='__internal__');
  let list=allEvents.slice();
  if(_evSearch.trim()){
    const q=_evSearch.trim().toLowerCase();
    list=list.filter(p=>[p.name,p.clientName,p.date,p.location].some(f=>f&&f.toLowerCase().includes(q)));
  }
  if(!_efAt){
    const fp=new Date('1900-01-01'); const ff=new Date('2100-12-31');
    const fFrom=_efFr||fp; const fTo=_efTo||ff;
    list=list.filter(p=>{
      if(!p.date)return false;
      const d=new Date(p.date); d.setHours(0,0,0,0);
      return d>=fFrom&&d<=fTo;
    });
  }
  list.sort((a,b)=>{
    let av,bv;
    if(_evSort==='name'){ av=(a.name||'').toLowerCase(); bv=(b.name||'').toLowerCase(); }
    else if(_evSort==='date'){ av=a.date||''; bv=b.date||''; }
    else if(_evSort==='type'){ av=(a.type||'').toLowerCase(); bv=(b.type||'').toLowerCase(); }
    else if(_evSort==='location'){ av=(a.location||'').toLowerCase(); bv=(b.location||'').toLowerCase(); }
    else if(_evSort==='budget'){ av=Number(a.budget||0); bv=Number(b.budget||0); }
    else if(_evSort==='created'){ av=Number((a.id||'').replace(/\D/g,''))||0; bv=Number((b.id||'').replace(/\D/g,''))||0; }
    else { av=a.name||''; bv=b.name||''; }
    if(av<bv)return -1*_evSortDir; if(av>bv)return 1*_evSortDir; return 0;
  });
  _evVisibleIds = list.map(function(p){ return p.id; });
  Object.keys(_evSelected).forEach(function(id){
    if(!uproj()[id]) delete _evSelected[id];
  });

  const g=document.getElementById('evgrid');
  let mobileActions=document.getElementById('events-mobile-actions');
  if(!mobileActions && g && g.parentElement){
    mobileActions=document.createElement('div');
    mobileActions.id='events-mobile-actions';
    g.parentElement.appendChild(mobileActions);
  }
  g.className=_evView==='list'?'evgrid ev-list':'evgrid';

  const evHeader = document.getElementById('ev-header');
  const evHeaderCopy = document.getElementById('ev-header-copy');
  const evCreateBtn = document.getElementById('ev-create-btn');
  const evSearchbar = document.getElementById('ev-searchbar');
  const evToolbar = document.getElementById('ev-toolbar');
  if (!list.length) {
    if (!allEvents.length) {
      if (evHeaderCopy) evHeaderCopy.style.display = 'none';
      if (evCreateBtn) evCreateBtn.style.display = 'none';
      if (evSearchbar) evSearchbar.style.display = 'none';
      if (evToolbar) evToolbar.style.display = 'none';
      if (evHeader) evHeader.style.marginBottom = '0';
      g.className = 'ev-empty-host';
      g.innerHTML = renderEventsEmptyState();
      if (mobileActions) mobileActions.innerHTML = renderEventsMobileActionBar();
      updateEvBulkBar();
      return;
    }
    if (evHeaderCopy) evHeaderCopy.style.display = '';
    if (evCreateBtn) evCreateBtn.style.display = 'inline-flex';
    if (evSearchbar) evSearchbar.style.display = 'flex';
    if (evToolbar) evToolbar.style.display = 'flex';
    if (evHeader) evHeader.style.marginBottom = '';
    g.className = 'ev-empty-host';
    g.innerHTML = renderEventsNoResultsState();
    if (mobileActions) mobileActions.innerHTML = renderEventsMobileActionBar();
    updateEvBulkBar();
    return;
  }
  if (evHeaderCopy) evHeaderCopy.style.display = '';
  if (evCreateBtn) evCreateBtn.style.display = 'inline-flex';
  if (evSearchbar) evSearchbar.style.display = 'flex';
  if (evToolbar) evToolbar.style.display = 'flex';
  if (evHeader) evHeader.style.marginBottom = '';
  const tc={social:'b-pink',corporate:'b-blue',community:'b-green',government:'b-orange',education:'b-purple'};
  const tl={social:t('type_social'),corporate:t('type_corporate'),community:t('type_community'),government:t('type_government'),education:t('type_education')};
  if(_evView==='list'){
    const isES=LANG==='es';
    const listHeader=`<div class="ev-list-header">
      <div>${isES?'Evento':'Event'}</div>
      <div>${isES?'Fecha':'Date'}</div>
      <div>${isES?'Ubicación':'Location'}</div>
      <div>${isES?'Estado':'Status'}</div>
      <div>${isES?'Días':'Days'}</div>
    </div>`;
    g.innerHTML=listHeader+list.map(p=>{
      const da=daysAway(p.date); const isPast=da<0;
      const dLabel=da===0?t('today'):da>0?`${da} ${t('days_away')}`:`${Math.abs(da)} ${t('days_ago')}`;
      const checked=_evSelected[p.id] ? ' checked' : '';
      const selCls=_evSelected[p.id] ? ' evc-selected' : '';
      return `<div class="evc evc-type-${p.type||'default'}${selCls} fade-in" onclick="openProject('${p.id}')">
        <label class="ev-select" onclick="event.stopPropagation()">
          <input type="checkbox" class="ev-select-input"${checked} onchange="toggleEvSelected('${p.id}',this.checked)">
          <span class="ev-select-box">${checkIcon()}</span>
        </label>
        <div class="evc-body">
          <div class="ev-list-main ev-list-cell">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(p.name)}</div>
              <span class="badge ${tc[p.type]||'b-gray'}">${tl[p.type]||esc(p.type)}</span>
            </div>
            <div class="s-sm ev-hover-detail ev-list-client">${esc(p.clientName)}</div>
          </div>
          <div class="ev-list-cell ev-list-date" style="font-size:12px;white-space:nowrap">${fmtDate(p.date)}</div>
          <div class="ev-list-cell ev-list-location" style="font-size:12px;white-space:nowrap">${esc(p.location||'—')}</div>
          <div class="ev-list-cell ev-hover-detail ev-list-budget" style="font-size:12px;white-space:nowrap">${fmtMoney(p.budget)}</div>
          <div class="ev-list-cell ev-list-status" style="font-size:12px;white-space:nowrap">${statusLabel(p.status)}</div>
          <div class="ev-list-actions" onclick="event.stopPropagation()">
            <span class="ev-list-days" style="font-size:11px;font-weight:600;color:${isPast?'var(--light)':'var(--accent)'};white-space:nowrap;margin-right:6px">${dLabel}</span>
            <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="openEventModal('${p.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
            <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="confirmDelProj('${p.id}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>
          </div>
        </div>
      </div>`;
    }).join('');
  } else if(isMob) {
    // ── Mobile: compact expandable event cards ──
    g.className='emc-list';
    g.innerHTML=list.map(p=>{
      const da=daysAway(p.date); const isPast=da<0;
      const dLabel=da===0?t('today'):da>0?`${da} ${t('days_away')}`:`${Math.abs(da)} ${t('days_ago')}`;
      const isOpen=_expandedEventIds.indexOf(p.id)>-1;
      const isES=LANG==='es';
      return `<article class="emc${isOpen?' emc-open':''}" data-eid="${p.id}">
        <div class="emc-summary" onclick="toggleEventExpand('${p.id}')">
          <div class="emc-info">
            <div class="emc-name">${esc(p.name)}</div>
            <div class="emc-row">
              <span class="badge ${tc[p.type]||'b-gray'}" style="font-size:9px;padding:1px 7px">${tl[p.type]||esc(p.type)}</span>
              <span class="emc-date">${fmtDate(p.date)}</span>
              <span class="emc-days" style="color:${isPast?'var(--light)':'var(--success)'}">${dLabel}</span>
            </div>
          </div>
          <svg class="emc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="emc-detail">
          <div class="emc-meta">
            ${p.clientName?'<div class="emc-meta-item"><span class="emc-meta-lbl">'+(isES?'Cliente':'Client')+'</span><span class="emc-meta-val">'+esc(p.clientName)+'</span></div>':''}
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Ubicación':'Location'}</span><span class="emc-meta-val">${esc(p.location||'TBD')}</span></div>
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Presupuesto':'Budget'}</span><span class="emc-meta-val">${fmtMoney(p.budget)}</span></div>
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Estado':'Status'}</span><span class="emc-meta-val" style="text-transform:capitalize">${statusLabel(p.status)}</span></div>
          </div>
          <div class="emc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-primary btn-sm" onclick="openProject('${p.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg> ${isES?'Abrir':'Open'}</button>
            <button class="btn btn-ghost btn-sm" onclick="openEventModal('${p.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg> ${isES?'Editar':'Edit'}</button>
            <button class="btn btn-ghost btn-sm" onclick="dupProj('${p.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${isES?'Duplicar':'Duplicate'}</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelProj('${p.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg> ${isES?'Eliminar':'Delete'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  } else {
    g.innerHTML=list.map(p=>{
      const da=daysAway(p.date); const isPast=da<0;
      const dLabel=da===0?t('today'):da>0?`${da} ${t('days_away')}`:`${Math.abs(da)} ${t('days_ago')}`;
      const checked=_evSelected[p.id] ? ' checked' : '';
      const selCls=_evSelected[p.id] ? ' evc-selected' : '';
      return `<div class="evc evc-type-${p.type||'default'}${selCls} fade-in" onclick="openProject('${p.id}')">
        <label class="ev-select" onclick="event.stopPropagation()">
          <input type="checkbox" class="ev-select-input"${checked} onchange="toggleEvSelected('${p.id}',this.checked)">
          <span class="ev-select-box">${checkIcon()}</span>
        </label>
        <div class="evc-top"></div>
        <div class="evc-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px">
            <div style="min-width:0;flex:1">
              <div style="font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(p.description||'')}</div>
            </div>
            <span class="badge ${tc[p.type]||'b-gray'}">${tl[p.type]||esc(p.type)}</span>
          </div>
          <div class="ev-hover-detail ev-grid-client" style="font-size:12px;color:var(--muted);margin-bottom:14px">${t('client')}: <span style="color:var(--text);font-weight:500">${esc(p.clientName)}</span></div>
          ${evcRow('#f7f0de','#a8862e','<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',t('event_date'),fmtDate(p.date))}
          ${evcRow('#f0fdf4','#10b981','<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/><circle cx="12" cy="9" r="2.5"/>',t('location'),esc(p.location||'TBD'))}
          ${evcRow('#fdf4e0','#b8861a','<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',t('total_budget'),fmtMoney(p.budget),'ev-hover-detail ev-grid-budget')}
        </div>
        <div class="evc-foot">
          <span style="font-size:12px;font-weight:600;text-transform:capitalize;color:var(--muted)">${statusLabel(p.status)}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:12px;font-weight:600;color:${isPast?'var(--light)':'var(--accent)'}">${dLabel}</span>
            <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-sm btn-icon" title="Duplicate" onclick="dupProj('${p.id}')">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="openEventModal('${p.id}')">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
              </button>
              <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="confirmDelProj('${p.id}')">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  setupEventCardHoverEffects();
  if(mobileActions) mobileActions.innerHTML = renderEventsMobileActionBar();
  updateEvBulkBar();
}

function renderEventsMobileActionBar(){
  return renderMobileStickyActionBar(`<button class="btn btn-primary btn-create-gradient" onclick="openEventModal()">${t('create_event')}</button>`);
}

function setupEventCardHoverEffects(){
  if(typeof window==='undefined') return;
  if(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('.evc').forEach(function(card){
    if(card.dataset.holoBound==='1') return;
    card.dataset.holoBound='1';
    card.addEventListener('mousemove', function(e){
      const rect=card.getBoundingClientRect();
      const x=e.clientX-rect.left;
      const y=e.clientY-rect.top;
      const px=(x/rect.width)*100;
      const py=(y/rect.height)*100;
      const rotateX=((rect.height/2)-y)/28;
      const rotateY=(x-(rect.width/2))/34;
      card.style.setProperty('--evc-glow-x', px+'%');
      card.style.setProperty('--evc-glow-y', py+'%');
      card.style.setProperty('--evc-bg-x', (35 + (px * .7)) + '%');
      card.style.setProperty('--evc-bg-y', (35 + (py * .7)) + '%');
      card.style.setProperty('--evc-rotate-x', rotateX.toFixed(2)+'deg');
      card.style.setProperty('--evc-rotate-y', rotateY.toFixed(2)+'deg');
    });
    card.addEventListener('mouseleave', function(){
      card.style.setProperty('--evc-glow-x', '50%');
      card.style.setProperty('--evc-glow-y', '50%');
      card.style.setProperty('--evc-bg-x', '50%');
      card.style.setProperty('--evc-bg-y', '50%');
      card.style.setProperty('--evc-rotate-x', '0deg');
      card.style.setProperty('--evc-rotate-y', '0deg');
    });
  });
}

function getEvSelectedIds(){
  return Object.keys(_evSelected).filter(function(id){ return !!_evSelected[id] && !!uproj()[id]; });
}

function toggleEvSelected(id, checked){
  if(checked) _evSelected[id]=1;
  else delete _evSelected[id];
  renderEvents();
}
window.toggleEvSelected = toggleEvSelected;

function clearEvSelection(){
  _evSelected={};
  renderEvents();
}
window.clearEvSelection = clearEvSelection;

function evSelectAllVisible(){
  var visible=(_evVisibleIds||[]).filter(function(id){ return !!uproj()[id]; });
  var allSelected=visible.length && visible.every(function(id){ return !!_evSelected[id]; });
  visible.forEach(function(id){
    if(allSelected) delete _evSelected[id];
    else _evSelected[id]=1;
  });
  renderEvents();
}
window.evSelectAllVisible = evSelectAllVisible;

function updateEvBulkBar(){
  var wrap=document.getElementById('ev-select-all-wrap');
  if(!wrap) return;
  var allInput=document.getElementById('ev-select-all');
  var allLabel=document.getElementById('ev-select-all-label');
  var editEl=document.getElementById('ev-bulk-edit');
  var delEl=document.getElementById('ev-bulk-delete');
  var isES=LANG==='es';
  var selected=getEvSelectedIds();
  var visible=(_evVisibleIds||[]).filter(function(id){ return !!uproj()[id]; });
  var allVisibleSelected=visible.length && visible.every(function(id){ return !!_evSelected[id]; });
  if(allLabel) allLabel.textContent = isES?'Seleccionar todo':'Select all';
  if(allInput){
    allInput.checked = !!allVisibleSelected;
    allInput.indeterminate = !allVisibleSelected && selected.length > 0;
    allInput.disabled = !visible.length;
  }
  if(editEl){
    editEl.textContent = isES?'Editar varios':'Edit multiple';
    editEl.style.display = selected.length ? 'inline-flex' : 'none';
  }
  if(delEl){
    delEl.textContent = isES?'Eliminar varios':'Delete multiple';
    delEl.style.display = selected.length ? 'inline-flex' : 'none';
  }
}

function openBulkEditEventsModal(){
  var ids=getEvSelectedIds();
  if(!ids.length) return;
  var isES=LANG==='es';
  openMo('<div class="mo-title">'+(isES?'Editar eventos':'Edit events')+'</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:16px">'+(isES?('Aplica cambios a '+ids.length+' eventos seleccionados. Solo se actualizarán los campos que modifiques.'):'Apply changes to '+ids.length+' selected events. Only changed fields will be updated.')+'</div>'
    +'<div class="form-grid">'
    +'<div class="ig"><label>'+(isES?'Estado':'Status')+'</label><select class="select" id="be-status"><option value="">'+(isES?'Sin cambios':'No change')+'</option><option value="to-be-confirmed">'+t('status_planning')+'</option><option value="confirmed">'+t('status_confirmed')+'</option><option value="in-progress">'+t('status_in_progress')+'</option><option value="completed">'+t('status_completed')+'</option><option value="cancelled">'+t('status_cancelled')+'</option></select></div>'
    +'<div class="ig"><label>'+(isES?'Tipo de evento':'Event type')+'</label><select class="select" id="be-type"><option value="">'+(isES?'Sin cambios':'No change')+'</option><option value="social">'+t('type_social')+'</option><option value="corporate">'+t('type_corporate')+'</option><option value="community">'+t('type_community')+'</option><option value="government">'+t('type_government')+'</option><option value="education">'+t('type_education')+'</option></select></div>'
    +'<div class="ig"><label>'+t('event_date')+'</label><input class="input" id="be-date" type="date"></div>'
    +'<div class="ig"><label>'+t('location')+'</label><input class="input" id="be-location" placeholder="'+(isES?'Vacío = sin cambios':'Blank = no change')+'"></div>'
    +'</div>'
    +'<div class="mo-foot">'
    +'<button type="button" class="btn btn-ghost" onclick="closeMo()">'+(isES?'Cancelar':'Cancel')+'</button>'
    +'<button type="button" class="btn btn-primary" onclick="saveBulkEditEvents()">'+(isES?'Guardar cambios':'Save changes')+'</button>'
    +'</div>');
}
window.openBulkEditEventsModal = openBulkEditEventsModal;

async function saveBulkEditEvents(){
  var ids=getEvSelectedIds();
  if(!ids.length) return closeMo();
  var status=(document.getElementById('be-status')||{}).value||'';
  var type=(document.getElementById('be-type')||{}).value||'';
  var date=(document.getElementById('be-date')||{}).value||'';
  var locationInput=document.getElementById('be-location');
  var locationChanged=!!locationInput && locationInput.value.trim()!=='';
  var location=locationChanged ? locationInput.value.trim() : '';
  // Load full data for any stub projects before applying changes
  var stubIds=ids.filter(function(id){ var p=uproj()[id]; return p&&p._metaOnly; });
  if(stubIds.length && typeof loadProjectById==='function'){
    await Promise.all(stubIds.map(function(id){ return loadProjectById(id); }));
  }
  ids.forEach(function(id){
    var p=uproj()[id];
    if(!p) return;
    if(status) p.status=status;
    if(type) p.type=type;
    if(date) p.date=date;
    if(locationChanged) p.location=location;
    saveProj(p);
  });
  closeMo();
  renderEvents();
  toast((LANG==='es'?('Actualizados '+ids.length+' eventos'):('Updated '+ids.length+' events')),'s');
}
window.saveBulkEditEvents = saveBulkEditEvents;

function bulkDeleteEvents(){
  var ids=getEvSelectedIds();
  if(!ids.length) return;
  var isES=LANG==='es';
  openConfirmModal({
    title: isES?'Eliminar eventos':'Delete events',
    message: isES?('¿Eliminar '+ids.length+' eventos seleccionados? Esta acción no se puede deshacer.'):('Delete '+ids.length+' selected events? This cannot be undone.'),
    onConfirm: function(){
      ids.forEach(function(id){ delProj(id); delete _evSelected[id]; });
      renderEvents();
      toast(isES?(ids.length+' eventos eliminados'):(ids.length+' events deleted'),'s');
    }
  });
}
window.bulkDeleteEvents = bulkDeleteEvents;

function renderEventsNoResultsState(){
  const isES = LANG === 'es';
  const msg = isES
    ? 'No hay eventos en este rango de fechas.'
    : 'No events match this date range.';
  const hint = isES
    ? 'Ajusta las fechas o vuelve a "Todas las fechas" para ver más resultados.'
    : 'Adjust the dates or switch back to "All Dates" to see more results.';
  return `<section class="card fade-in" style="text-align:center;padding:44px 28px;color:var(--muted);max-width:760px;margin:0 auto">
    <div style="font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700;color:var(--text);margin-bottom:8px">${msg}</div>
    <div style="font-size:14px;line-height:1.7">${hint}</div>
  </section>`;
}

function renderEventsEmptyState(){
  const isES = LANG === 'es';
  return `<section class="ev-empty fade-in">
    <div class="ev-empty-shell">
      <div class="ev-empty-grid">
        <div class="ev-empty-copy">
          <h2 class="ev-empty-title">${isES ? 'Donde cada <em>detalle</em> importa' : 'Where every <em>detail</em> matters'}</h2>
          <p class="ev-empty-subtitle">${isES
            ? 'Presupuesto, invitados, cronograma y diseño del espacio, todo en un solo lugar.'
            : 'Budget, guests, timeline, and venue design \u2014 all in one place.'}</p>
          <div class="ev-empty-actions">
            <button class="ev-empty-cta" onclick="openEventModal()">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              ${isES ? 'Crear evento' : 'Create Event'}
            </button>
          </div>
        </div>
        <div class="ev-empty-bento">
          <div class="ev-empty-bento-card --cool">
            <div class="ev-empty-bento-icon">
              <svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </div>
            <div class="ev-empty-bento-stat">6</div>
            <div class="ev-empty-bento-label">${isES ? 'Herramientas integradas' : 'Built-in tools'}</div>
          </div>
          <div class="ev-empty-bento-card --sand">
            <div class="ev-empty-bento-icon">
              <svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="ev-empty-bento-stat">100%</div>
            <div class="ev-empty-bento-label">${isES ? 'Control total de tu evento' : 'Full control of your event'}</div>
          </div>
          <div class="ev-empty-bento-card --white --wide">
            <div class="ev-empty-bento-label" style="margin-bottom:10px;font-weight:600;color:#DFD7C9">${isES ? 'Todo lo que necesitas' : 'Everything you need'}</div>
            <div class="ev-empty-bento-features">
              <span class="ev-empty-bento-chip">${isES ? 'Presupuesto' : 'Budget'}</span>
              <span class="ev-empty-bento-chip">${isES ? 'Cronograma' : 'Timeline'}</span>
              <span class="ev-empty-bento-chip">${isES ? 'Invitados' : 'Guests'}</span>
              <span class="ev-empty-bento-chip">${isES ? 'Diseño' : 'Layout'}</span>
              <span class="ev-empty-bento-chip">Moodboard</span>
              <span class="ev-empty-bento-chip">${isES ? 'Exportar PDF' : 'PDF Export'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function checkIcon(){
  return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>';
}

function evcRow(bg,clr,icon,lbl,val,extraClass){return `<div class="${extraClass||''}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bg)">
  <div style="width:28px;height:28px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
    <svg width="14" height="14" fill="none" stroke="${clr}" stroke-width="2" viewBox="0 0 24 24">${icon}</svg>
  </div>
  <div><div style="font-size:10px;color:var(--light);text-transform:uppercase;letter-spacing:.5px">${lbl}</div><div style="font-weight:500">${val}</div></div>
</div>`;}

async function dupProj(id){
  var p=uproj()[id];if(!p)return;
  // Load full data before duplicating — a meta stub would create an event without vendors/guests/tasks
  if(p._metaOnly && typeof loadProjectById==='function'){
    var loaded=await loadProjectById(id);
    if(loaded) p=loaded;
  }
  const c=JSON.parse(JSON.stringify(p));c.id='p'+Date.now();c.name=p.name+' (Copy)';
  delete c._metaOnly;
  saveProj(c);renderEvents();toast('Event duplicated','s');
}

function confirmDelProj(id){
  const p=uproj()[id];
  openConfirmModal({
    title: LANG==='es'?'Eliminar evento':'Delete event',
    message: (LANG==='es'?'¿Eliminar "':'Delete "')+esc(p.name)+'"?',
    onConfirm: function(){ delProj(id);renderEvents();toast(LANG==='es'?'Evento eliminado':'Event deleted'); }
  });
}

function _dashDonut(data, colorFn, size){
  var total=data.reduce(function(s,d){return s+d[1];},0);
  if(!total) return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted)">—</div>';
  var r=size*0.38, circ=2*Math.PI*r, cx=size/2, cy=size/2, sw=size*0.15;
  var rotation=-90;
  var circles=data.map(function(d){
    var pct=d[1]/total, dash=pct*circ;
    var seg='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+colorFn(d[0])+'" stroke-width="'+sw+'" stroke-dasharray="'+dash.toFixed(2)+' '+(circ-dash).toFixed(2)+'" stroke-dashoffset="'+(circ*0.25).toFixed(2)+'" transform="rotate('+rotation.toFixed(2)+' '+cx+' '+cy+')"/>';
    rotation+=pct*360;
    return seg;
  }).join('');
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="flex-shrink:0">'+circles+'</svg>';
}
function _dashRing(pct, color, size){
  var r=size*0.4, circ=2*Math.PI*r, cx=size/2, cy=size/2, sw=size*0.12;
  var dash=pct/100*circ;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="flex-shrink:0">'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--bg2)" stroke-width="'+sw+'"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-dasharray="'+dash.toFixed(2)+' '+(circ-dash).toFixed(2)+'" stroke-linecap="round" transform="rotate(-90 '+cx+' '+cy+')" style="transition:stroke-dasharray .6s"/>'
    +'<text x="'+cx+'" y="'+cy+'" text-anchor="middle" dominant-baseline="central" fill="'+color+'" font-size="'+(size*0.22)+'" font-weight="700" font-family="Jost,sans-serif">'+pct+'%</text>'
    +'</svg>';
}
function _dashKPI(label, value, sub, color, tooltip){
  var clr = color || '#242424';
  return '<div class="card" style="padding:16px 12px;text-align:center'+(tooltip?';cursor:default':'')+'"'+(tooltip?' title="'+tooltip+'"':'')+'>'+
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#787470;font-weight:600;margin-bottom:8px">'+label+'</div>'+
    '<div style="font-size:18px;font-weight:600;color:'+clr+';font-family:\'DM Sans\',sans-serif;line-height:1.2">'+value+'</div>'+
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:10px;color:#787470;margin-top:4px">'+sub+'</div>'+
    '</div>';
}
function dismissOnboarding(pid){
  localStorage.setItem('eventos_onb_'+pid,'1');
  renderDash();
}
function _dashOnboarding(p,hired,done,litems){
  var pid=p.id;
  if(localStorage.getItem('eventos_onb_'+pid)) return '';
  var steps=[
    {key:'onb_budget',   ok:(p.budget||0)>0,        action:"openEventModal('"+pid+"')", hint:''},
    {key:'onb_vendors',  ok:hired.length>0,           action:"switchTab('budget')",       hint:t('tab_budget')},
    {key:'onb_timeline', ok:done>0,                   action:"switchTab('timeline')",     hint:t('tab_timeline')},
    {key:'onb_guests',   ok:(p.guests||[]).length>0,  action:"switchTab('guests')",       hint:t('tab_guests')},
    {key:'onb_layout',   ok:litems.length>0,          action:"switchTab('layout')",       hint:t('tab_layout')},
  ];
  var complete=steps.filter(function(s){return s.ok;}).length;
  if(complete===steps.length) return '';
  var pct=Math.round(complete/steps.length*100);
  var stepsHtml=steps.map(function(s){
    if(s.ok){
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:#F2EFE9;border:1px solid rgba(36,36,36,.06)">'
        +'<div style="width:20px;height:20px;border-radius:50%;background:#242424;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
          +'<svg width="10" height="10" fill="none" stroke="#F2EFE9" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
        +'</div>'
        +'<span style="font-family:\'DM Sans\',sans-serif;font-size:12px;font-weight:500;color:#242424">'+t(s.key)+'</span>'
      +'</div>';
    }
    return '<button onclick="'+s.action+'" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:#fff;border:1px solid rgba(36,36,36,.08);cursor:pointer;text-align:left;width:100%;transition:all .15s ease;font-family:\'DM Sans\',sans-serif" onmouseover="this.style.borderColor=\'#242424\'" onmouseout="this.style.borderColor=\'rgba(36,36,36,.08)\'">'
      +'<div style="width:20px;height:20px;border-radius:50%;border:1.5px solid #DFD7C9;flex-shrink:0"></div>'
      +'<div style="min-width:0">'
        +'<div style="font-size:12px;font-weight:500;color:#242424">'+t(s.key)+'</div>'
        +(s.hint?'<div style="font-size:10px;color:#787470;margin-top:1px">'+esc(s.hint)+' &rarr;</div>':'')
      +'</div>'
    +'</button>';
  }).join('');
  return '<div class="card" style="padding:20px 22px;margin-bottom:20px;background:#fff;border:1px solid rgba(36,36,36,.08)">'
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">'
      +'<div>'
        +'<div style="font-family:\'DM Sans\',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#787470">'+t('onb_title')+'</div>'
        +'<div style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:#787470;margin-top:3px">'+complete+' / '+steps.length+' '+t('onb_steps_done')+'</div>'
      +'</div>'
      +'<button class="btn btn-ghost" style="padding:2px 8px;font-size:12px;line-height:1.8;color:#787470" onclick="dismissOnboarding(\''+esc(pid)+'\')" title="'+t('onb_dismiss')+'">&#10005;</button>'
    +'</div>'
    +'<div class="prog" style="margin-bottom:14px;background:#F2EFE9"><div class="prog-f" style="width:'+pct+'%;background:#242424;transition:width .4s"></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px">'
      +stepsHtml
    +'</div>'
  +'</div>';
}
function renderDash(){
  var p=proj();if(!p)return;
  var el=document.getElementById('tab-dashboard');
  // Budget
  var tb=p.budget||0;
  var hired=p.vendors.filter(function(v){return v.hired;});
  var paid=hired.reduce(function(s,v){return s+v.payments.reduce(function(a,pay){return a+Number(pay.amount);},0);},0);
  var allocated=p.vendors.reduce(function(s,v){return s+(Number(v.budget)||0);},0);
  var remaining=tb-paid;
  var budgetPct=tb>0?Math.min(100,Math.round(paid/tb*100)):0;
  var allocPct=tb>0?Math.min(100,Math.round(allocated/tb*100)):0;
  // Category breakdown
  var catSpend={};
  hired.forEach(function(v){
    var cat=v.name||'Other';
    if(!catSpend[cat]) catSpend[cat]={budget:0,paid:0};
    catSpend[cat].budget+=Number(v.budget)||0;
    catSpend[cat].paid+=v.payments.reduce(function(a,pay){return a+Number(pay.amount);},0);
  });
  var catEntries=Object.entries(catSpend).sort(function(a,b){return b[1].budget-a[1].budget;}).slice(0,5);
  var catMax=catEntries.length?catEntries[0][1].budget:1;
  var catColors=['#f59e0b','#3b82f6','#10b981','#ec4899','#8b5cf6','#6b7280'];
  var catBarsHtml=catEntries.map(function(e,i){
    var pct=catMax>0?Math.round(e[1].budget/catMax*100):0;
    return '<div style="display:grid;grid-template-columns:100px 1fr 60px;align-items:center;gap:8px;margin-bottom:6px">'
      +'<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(e[0])+'">'+esc(e[0])+'</div>'
      +'<div style="background:var(--bg2);border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;border-radius:4px;background:'+catColors[i%catColors.length]+';width:'+pct+'%;transition:width .4s"></div></div>'
      +'<div style="font-size:11px;font-weight:600;color:var(--text);text-align:right">'+formatCost(e[1].budget)+'</div>'
      +'</div>';
  }).join('');
  // Guests
  var confirmed=p.guests.filter(function(g){return g.rsvp==='confirmed';}).length;
  var pending=p.guests.filter(function(g){return g.rsvp==='pending';}).length;
  var declined=p.guests.filter(function(g){return g.rsvp==='declined';}).length;
  var plusOnes=p.guests.filter(function(g){return g.plusOne;}).length;
  var guestTotal=p.guests.length;
  // Tasks
  var done=p.tasks.filter(function(tk){return tk.done;}).length;
  var tpct=p.tasks.length?Math.round(done/p.tasks.length*100):0;
  var today=new Date().toISOString().slice(0,10);
  var overdue=p.tasks.filter(function(tk){return !tk.done&&tk.dueDate&&tk.dueDate<today;}).length;
  // Layout
  var litems=p.layoutItems||[];
  if(!litems.length&&p.layoutExport&&p.layoutExport.layoutId&&typeof getLib==='function'){
    var _dashLibE=getLib().layouts.find(function(e){return e.id===p.layoutExport.layoutId;});
    if(_dashLibE) litems=_dashLibE.items||[];
  }
  var chairs=litems.reduce(function(s,i){return s+(i.chairs||0);},0);
  var assignedGuestTables=p.guests.filter(function(g){return g.table;});
  var tables=[...new Set(assignedGuestTables.map(function(g){return g.table;}))].length;
  var guestsWithTable=assignedGuestTables.length;
  var guestsWithoutTable=guestTotal-guestsWithTable;
  var layoutName=(p.layoutExport&&p.layoutExport.layoutName)||'';
  // Budget per guest
  var totalWithPlusOnes=guestTotal+plusOnes;
  var budgetPerGuest=totalWithPlusOnes>0&&tb>0?Math.ceil(tb/totalWithPlusOnes):0;
  // Date
  var dl=daysAway(p.date);
  var dlBadge=dl===0?'b-gold':dl>0?(dl<=7?'b-orange':'b-green'):'b-pink';
  var dlText=dl===0?t('dash_today'):dl>0?dl+' '+t('days_away'):Math.abs(dl)+' '+t('days_ago');
  // Guest donut
  var rsvpColorFn=function(k){return k==='confirmed'?'#10b981':k==='pending'?'#f59e0b':'#ef4444';};
  var rsvpData=[['confirmed',confirmed],['pending',pending],['declined',declined]].filter(function(d){return d[1]>0;});
  var guestDonut=_dashDonut(rsvpData,rsvpColorFn,64);
  // Render
  el.innerHTML=_dashOnboarding(p,hired,done,litems)
  // HEADER
  +'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">'
    +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
      +'<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;font-weight:600;color:#242424">'+esc(p.name)+'</div>'
      +(p.clientName?'<span style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#787470">· '+esc(p.clientName)+'</span>':'')
      +'<span class="badge b-blue">'+fmtDateShort(p.date)+'</span>'
      +'<span class="badge '+dlBadge+'">'+dlText+'</span>'
    +'</div>'
    +'<button class="btn btn-ghost" onclick="openEventModal(\''+p.id+'\')">'
      +'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg> '+t('edit_event')
    +'</button>'
  +'</div>'
  // KPI ROW
  +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px">'
    +_dashKPI(t('dash_total_budget'), tb>0?formatCost(tb):'—', t('dash_event_budget'), '#242424')
    +(totalWithPlusOnes>0&&tb>0?_dashKPI(LANG==='es'?'Presupuesto p/Inv.':'Budget / Guest', formatCost(budgetPerGuest), totalWithPlusOnes+' '+(LANG==='es'?'invitados':'guests'), '#242424', LANG==='es'?'Presupuesto ('+formatCost(tb)+') ÷ '+totalWithPlusOnes+' invitados (incl. acompañantes)':'Budget ('+formatCost(tb)+') ÷ '+totalWithPlusOnes+' guests (incl. plus-ones)'):'')
    +_dashKPI(t('dash_paid'), formatCost(paid), tb>0?budgetPct+'% '+t('dash_of_budget'):'', '#ef4444')
    +_dashKPI(t('dash_remaining'), formatCost(remaining), tb>0?t('dash_left'):'', remaining>=0?'#10b981':'#ef4444')
    +_dashKPI(t('dash_guests_total'), guestTotal+(plusOnes?'<span style="font-family:\'DM Sans\',sans-serif;font-size:14px;color:#787470;font-weight:400"> +'+plusOnes+'</span>':''), confirmed+' '+t('dash_confirmed'), '#10b981')
    +_dashKPI(t('dash_vendors_hired'), hired.length+'<span style="font-family:\'DM Sans\',sans-serif;font-size:14px;color:#787470;font-weight:400">/'+p.vendors.length+'</span>', t('dash_hired'), '#f59e0b')
    +_dashKPI(t('dash_tasks_progress'), done+'<span style="font-family:\'DM Sans\',sans-serif;font-size:14px;color:#787470;font-weight:400">/'+p.tasks.length+'</span>', tpct+'% '+t('dash_complete'), '#7c3aed')
    +_dashKPI(t('dash_tables'), tables||'0', chairs+' '+t('dash_chairs'), '#242424', LANG==='es'?'Total: '+guestTotal+' | Con mesa: '+guestsWithTable+' | Sin mesa: '+guestsWithoutTable:'Total: '+guestTotal+' | Assigned: '+guestsWithTable+' | Unassigned: '+guestsWithoutTable)
  +'</div>'
  // DETAIL GRID
  +'<div class="dash-grid">'
    // LEFT: Budget Card
    +'<div class="card" style="padding:20px">'
      +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:16px">'+t('dash_budget_overview')+'</div>'
      // Allocated bar
      +'<div style="margin-bottom:12px">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">'
          +'<span>'+t('dash_allocated')+'</span>'
          +'<span style="font-weight:600;color:var(--text)">'+formatCost(allocated)+(tb>0?' / '+formatCost(tb):'')+'</span>'
        +'</div>'
        +'<div class="prog"><div class="prog-f" style="width:'+(allocPct>100?100:allocPct)+'%;background:'+(allocPct>100?'#ef4444':'#f59e0b')+'"></div></div>'
      +'</div>'
      // Paid bar
      +'<div style="margin-bottom:12px">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">'
          +'<span>'+t('dash_paid')+'</span>'
          +'<span style="font-weight:600;color:var(--text)">'+formatCost(paid)+(allocated>0?' / '+formatCost(allocated):'')+'</span>'
        +'</div>'
        +'<div class="prog"><div class="prog-f" style="width:'+(allocated>0?Math.min(100,Math.round(paid/allocated*100)):0)+'%;background:'+(budgetPct>90?'#ef4444':budgetPct>70?'#f59e0b':'#10b981')+'"></div></div>'
      +'</div>'
      // Unallocated
      +(tb>0?'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:16px"><span style="color:var(--muted)">'+t('dash_unallocated')+'</span><span style="font-weight:600;color:'+((tb-allocated)>=0?'#10b981':'#ef4444')+'">'+formatCost(tb-allocated)+'</span></div>':'')
      // Category breakdown
      +(catEntries.length?'<div style="border-top:1px solid var(--border);padding-top:14px">'
        +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:10px">'+t('dash_budget_by_category')+'</div>'
        +catBarsHtml
      +'</div>':'')
    +'</div>'
    // RIGHT: stacked cards
    +'<div style="display:flex;flex-direction:column;gap:14px">'
      // Guests card
      +'<div class="card" style="padding:18px">'
        +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:12px">'+t('dash_guests_total')+'</div>'
        +(guestTotal>0
          ?'<div style="display:flex;align-items:center;gap:16px">'
            +guestDonut
            +'<div style="flex:1">'
              +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><div style="width:8px;height:8px;border-radius:50%;background:#10b981;flex-shrink:0"></div><span style="font-size:12px;flex:1">'+t('dash_confirmed')+'</span><span style="font-size:12px;font-weight:700">'+confirmed+'</span></div>'
              +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0"></div><span style="font-size:12px;flex:1">'+t('dash_pending')+'</span><span style="font-size:12px;font-weight:700">'+pending+'</span></div>'
              +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><div style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0"></div><span style="font-size:12px;flex:1">'+t('dash_declined')+'</span><span style="font-size:12px;font-weight:700">'+declined+'</span></div>'
              +(plusOnes?'<div style="font-size:11px;color:var(--muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">'+t('dash_plus_ones')+': <strong>'+plusOnes+'</strong></div>':'')
            +'</div>'
          +'</div>'
          :'<div style="font-size:12px;color:var(--muted)">—</div>')
      +'</div>'
      // Tasks card
      +'<div class="card" style="padding:18px">'
        +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:12px">'+t('dash_tasks_progress')+'</div>'
        +(p.tasks.length>0
          ?'<div style="display:flex;align-items:center;gap:16px">'
            +_dashRing(tpct,'#7c3aed',56)
            +'<div style="flex:1">'
              +'<div style="font-size:13px;font-weight:600;color:var(--text)">'+done+' / '+p.tasks.length+'</div>'
              +'<div style="font-size:11px;color:var(--muted)">'+t('dash_complete')+'</div>'
              +(overdue>0?'<div style="font-size:11px;font-weight:600;color:#ef4444;margin-top:6px">⚠ '+overdue+' '+t('dash_overdue')+'</div>':'')
            +'</div>'
          +'</div>'
          :'<div style="font-size:12px;color:var(--muted)">—</div>')
      +'</div>'
      // Layout card
      +'<div class="card" style="padding:18px">'
        +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--light);margin-bottom:12px">'+t('dash_layout_summary')+'</div>'
        +(tables>0||layoutName
          ?'<div style="display:flex;gap:20px;align-items:center">'
            +'<div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--navy);font-family:\'Cormorant Garamond\',serif">'+tables+'</div><div style="font-size:10px;color:var(--muted)">'+t('dash_tables')+'</div></div>'
            +'<div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--navy);font-family:\'Cormorant Garamond\',serif">'+chairs+'</div><div style="font-size:10px;color:var(--muted)">'+t('dash_chairs')+'</div></div>'
            +(layoutName?'<div style="flex:1;font-size:12px;color:var(--muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(layoutName)+'">'+esc(layoutName)+'</div>':'')
          +'</div>'
          :'<div style="font-size:12px;color:var(--muted)">'+t('dash_no_layout')+'</div>')
      +'</div>'
    +'</div>'
  +'</div>';
}

function statCard(lbl,ibg,iclr,icon,val,sub,pct,barClr){
  return '<div class="sc"><div class="sc-top"><span class="sc-label">'+lbl+'</span><div style="width:36px;height:36px;border-radius:10px;background:'+ibg+';display:flex;align-items:center;justify-content:center"><svg width="18" height="18" fill="none" stroke="'+iclr+'" stroke-width="2" viewBox="0 0 24 24">'+icon+'</svg></div></div>'
  +'<div class="sc-val" style="color:'+iclr+'">'+val+'</div><div class="sc-sub">'+sub+'</div>'
  +(pct>0?'<div class="sbar"><div class="sbar-f" style="width:'+pct+'%;background:'+barClr+'"></div></div>':'')
  +'</div>';
}

function qaction(ibg,iclr,icon,lbl,onclick){
  return `<div onclick="${onclick}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;border-radius:var(--r);border:1.5px solid var(--border);cursor:pointer;transition:var(--tr);background:#fff;text-align:center" onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-l)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
    <svg width="22" height="22" fill="none" stroke="${iclr}" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom:6px">${icon}</svg>
    <span style="font-size:12px;font-weight:600;color:var(--muted)">${lbl}</span>
  </div>`;
}
var _dashTasksExpanded={};
function renderAppDash(){
  const el = document.getElementById('pg-dashboard-content');
  if (!el) return;
  const isES = LANG === 'es';
  var isMob_ = typeof isPhoneViewport==='function' && isPhoneViewport();
  const allProjects = Object.values(uproj()).filter(p => p && p.id && !p._metaOnly && p.id !== '__library__' && p.id !== '__lib_layout__' && p.status && p.status !== '__internal__');
  const now = new Date(); now.setHours(0,0,0,0);
  const todayTasks = [], expiredTasks = [], upcomingEvents = [];
  allProjects.forEach(p => {
    (p.tasks||[]).forEach(tk => {
      if (tk.done) return;
      if (!tk.dueDate) { todayTasks.push({tk,p}); return; }
      const due = new Date(tk.dueDate+'T12:00:00'); due.setHours(0,0,0,0);
      if (due < now) expiredTasks.push({tk,p});
      else if (due.getTime() === now.getTime()) todayTasks.push({tk,p});
    });
    if (p.date) { const da = daysAway(p.date); if (da >= 0) upcomingEvents.push({p,da}); }
  });
  upcomingEvents.sort((a,b) => a.da - b.da);
  const within30 = upcomingEvents.filter(e => e.da <= 30);
  const displayEvents = within30.length >= 3 ? within30 : upcomingEvents.slice(0, Math.max(3, within30.length));

  // -- Status donut data --
  const statusDef = [
    { key:'to-be-confirmed', clr:'#a78bfa', labelEN:'To be Confirmed', labelES:'Por Confirmar' },
    { key:'confirmed',       clr:'#34d399', labelEN:'Confirmed',        labelES:'Confirmado' },
    { key:'in-progress',     clr:'#fbbf24', labelEN:'In Progress',      labelES:'En Progreso' },
    { key:'completed',       clr:'#60a5fa', labelEN:'Completed',        labelES:'Completado' },
    { key:'cancelled',       clr:'#f87171', labelEN:'Cancelled',        labelES:'Cancelado' },
  ];
  const statusCounts = {};
  statusDef.forEach(s => { statusCounts[s.key] = 0; });
  allProjects.forEach(p => {
    const st = p.status === 'planning' ? 'to-be-confirmed' : p.status;
    if (statusCounts[st] !== undefined) statusCounts[st]++;
  });
  const grandTotal = allProjects.length;
  const activeSlices = statusDef.filter(s => statusCounts[s.key] > 0);
  const legendHTML = activeSlices.length === 0
    ? `<span style="font-size:12px;color:var(--light)">${isES?'Sin proyectos aún':'No projects yet'}</span>`
    : activeSlices.map(s => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="width:10px;height:10px;border-radius:50%;background:${s.clr};flex-shrink:0"></div>
          <span style="font-size:12px;color:var(--text);flex:1">${isES?s.labelES:s.labelEN}</span>
          <span style="font-size:12px;font-weight:700;color:var(--text)">${statusCounts[s.key]}</span>
        </div>`).join('');

  function buildSVGDonut() {
    if (grandTotal === 0) return `<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="38" fill="none" stroke="#e5e7eb" stroke-width="16"/></svg>`;
    const r = 38, circ = 2 * Math.PI * r, cx = 55, cy = 55;
    let rotation = -90;
    const circles = activeSlices.map(s => {
      const pct = statusCounts[s.key] / grandTotal;
      const dash = pct * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.clr}" stroke-width="16" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(circ * 0.25).toFixed(2)}" transform="rotate(${rotation.toFixed(2)} ${cx} ${cy})"/>`;
      rotation += pct * 360;
      return seg;
    }).join('');
    return `<svg width="110" height="110" viewBox="0 0 110 110">${circles}</svg>`;
  }
  const donutSVG = buildSVGDonut();
  const donutCard = `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--sh-sm);">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">${isES?'Eventos por Estado':'Events by Status'}</div>
    <div style="display:flex;align-items:center;gap:20px;">
      <div style="position:relative;width:110px;height:110px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        ${donutSVG}
        <div style="position:absolute;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${grandTotal}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${isES?'eventos':'events'}</div>
        </div>
      </div>
      <div style="flex:1">${legendHTML}</div>
    </div>
  </div>`;

  function taskTable(title, items, emptyMsg, accentClr, sectionKey) {
    var isMob_ = typeof isPhoneViewport==='function' && isPhoneViewport();
    var isOpen = _dashTasksExpanded[sectionKey];
    if(isMob_){
      var mobileRows = items.slice(0,8).map(({tk,p}) =>
        `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer" onclick="openProject('${p.id}');setTimeout(()=>switchTab('timeline'),120)">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tk.title||tk.name||'Task')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(p.name)} · ${tk.dueDate?fmtDateShort(tk.dueDate):'—'}</div>
          </div>
          <svg width="14" height="14" fill="none" stroke="var(--light)" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </div>`
      ).join('');
      return `<div style="background:var(--card);border-radius:16px;border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm);margin-bottom:12px">
        <div style="padding:14px 14px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="_dashTasksExpanded['${sectionKey}']=!_dashTasksExpanded['${sectionKey}'];renderAppDash()">
          <div style="width:8px;height:8px;border-radius:50%;background:${accentClr};flex-shrink:0"></div>
          <span style="font-size:14px;font-weight:700;flex:1">${title}</span>
          <span style="font-size:11px;font-weight:600;color:var(--muted);background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:2px 9px">${items.length}</span>
          <svg width="16" height="16" fill="none" stroke="var(--light)" stroke-width="2.5" viewBox="0 0 24 24" style="transition:transform .25s;transform:rotate(${isOpen?'180':'0'}deg)"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        ${isOpen?(items.length===0
          ?`<div style="padding:24px;text-align:center;font-size:13px;color:var(--light);border-top:1px solid var(--border)">${emptyMsg}</div>`
          :mobileRows):''}
      </div>`;
    }
    const rows = items.slice(0,8).map(({tk,p}) =>
      `<tr>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;cursor:pointer;color:var(--gold-h)" onclick="openProject('${p.id}');setTimeout(()=>switchTab('timeline'),120)">${esc(tk.title||tk.name||'Task')}</td>
        <td><span style="font-size:11px;color:var(--gold-h);font-weight:600;cursor:pointer" onclick="openProject('${p.id}');setTimeout(()=>switchTab('timeline'),120)">${esc(p.name)}</span></td>
        <td style="font-size:12px;color:var(--muted);white-space:nowrap">${tk.dueDate?fmtDateShort(tk.dueDate):'—'}</td>
      </tr>`
    ).join('');
    return `<div style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);overflow:hidden;box-shadow:var(--sh-sm);margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${accentClr};flex-shrink:0"></div>
        <span style="font-size:14px;font-weight:700">${title}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;color:var(--muted);background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:2px 9px">${items.length}</span>
      </div>
      ${items.length===0
        ?`<div style="padding:28px;text-align:center;font-size:13px;color:var(--light)">${emptyMsg}</div>`
        :`<div style="overflow-x:auto"><table><thead><tr><th>${isES?'Tarea':'Task'}</th><th>${isES?'Evento':'Event'}</th><th>${isES?'Fecha límite':'Due date'}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      }
    </div>`;
  }
  const tc={social:'b-pink',corporate:'b-blue',community:'b-green',government:'b-orange',education:'b-purple'};
  const tl={social:t('type_social'),corporate:t('type_corporate'),community:t('type_community'),government:t('type_government'),education:t('type_education')};
  const evCards = displayEvents.map(({p,da}) => {
    const done=(p.tasks||[]).filter(tk=>tk.done).length;
    const total=(p.tasks||[]).length;
    const pct=total?Math.round(done/total*100):0;
    const barClr='var(--success)';
    const typeLbl=tl[p.type]||(p.type&&p.type.startsWith('other:')?p.type.slice(6):p.type)||'';
    return `<div onclick="openProject('${p.id}')" style="background:var(--card);border-radius:var(--r-lg);border:1px solid var(--border);padding:18px;box-shadow:var(--sh-sm);cursor:pointer;transition:var(--tr);"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--sh-lg)'"
      onmouseout="this.style.transform='';this.style.boxShadow='var(--sh-sm)'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:11px;font-weight:600;color:var(--gold-h);background:var(--gold-l);padding:3px 10px;border-radius:20px">${da===0?t('today'):da+' '+(isES?'días':'days')}</span>
        <span class="badge ${tc[p.type]||'b-gray'}">${typeLbl}</span>
      </div>
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:14px">${esc(p.clientName)}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px">
        <span>${isES?'Progreso':'Progress'}</span><span style="font-weight:600;color:var(--text)">${pct}%</span>
      </div>
      <div class="prog"><div class="prog-f" style="width:${pct}%;background:${barClr}"></div></div>
    </div>`;
  }).join('');

  el.innerHTML=`
    <div style="margin-bottom:24px">
      <h1 class="editorial-title" style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700">${isES?'Panel General':'Dashboard'}</h1>
      <p style="color:var(--muted);font-size:14px;margin-top:2px">${isES?'Resumen de todos tus proyectos':'Overview across all your projects'}</p>
    </div>
    ${displayEvents.length>0?`<div style="margin-bottom:20px"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;color:var(--text)">${within30.length>=3?(isES?'Próximos Eventos (30 días)':'Upcoming Events (30 days)'):(isES?'Próximos 3 Eventos':'Next 3 Events')}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">${evCards}</div></div>`:''}
    <div style="display:grid;grid-template-columns:${isMob_?'1fr':'1fr 1fr'};gap:${isMob_?'0':'20'}px;align-items:start">
      <div>${taskTable(isES?'Tareas de Hoy':"Today's Tasks",todayTasks,isES?'Sin tareas para hoy':'No tasks due today','var(--gold)','today')}</div>
      <div>${taskTable(isES?'Tareas Vencidas':'Expired Tasks',expiredTasks,isES?'Sin tareas vencidas':'No overdue tasks','var(--danger)','expired')}</div>
    </div>`;

  }

