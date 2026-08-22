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
  if(!name||!client||!date)return toast(LANG==='es'?'Nombre, cliente y fecha son requeridos':'Name, client and date required','e');
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
/* ─── Rediseño 2026-08 · iconos y utilidades compartidas del módulo ──────── */
var EV_ICONS = {
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  money:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  tasks:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  vendors:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  pdf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash:'<polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>',
  arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin:'<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/><circle cx="12" cy="9" r="2.5"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
};
/** SVG en línea 24x24, stroke currentColor, como en el diseño. */
function _evIcon(name, size, sw){
  var paths = EV_ICONS[name] || '';
  var s = size || 16;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}

// Los proyectos viejos guardan 'planning'; los nuevos 'to-be-confirmed'.
function _evNormStatus(s){ return s === 'planning' ? 'to-be-confirmed' : (s || 'to-be-confirmed'); }
var _EV_STATUS_ORDER = ['confirmed','in-progress','to-be-confirmed','completed','cancelled'];
var _EV_STATUS_DOT = {
  'confirmed':'#17A398', 'in-progress':'#F2A93B', 'to-be-confirmed':'#8C8072',
  'completed':'#3B7DD8', 'cancelled':'#C23C15'
};
/** Etiqueta de tipo, respetando los tipos libres guardados como 'other:…'. */
function _evTypeText(ty){
  if(ty && ty.indexOf('other:') === 0) return ty.slice(6);
  return evTypeLabel(ty);
}
/** Nº de invitados de un proyecto (los stubs de metadatos solo traen guestCount). */
function _evGuestCount(p){
  var n = (p && p.guests && p.guests.length) || 0;
  if(!n) n = Number(p && p.guestCount) || 0;
  return n;
}

/* ─── Filtro por estado (en memoria, no se guarda) ───────────────────────── */
var _evStatusFilter = 'all';
function setEvStatusFilter(v){
  _evStatusFilter = v || 'all';
  renderEvents();
}
window.setEvStatusFilter = setEvStatusFilter;

/** Host de la fila de píldoras: se inserta justo antes de #evgrid. */
function _evStatusBarHost(){
  var g = document.getElementById('evgrid');
  if(!g || !g.parentElement) return null;
  var bar = document.getElementById('ev-statusbar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'ev-statusbar';
    bar.className = 'rd-filterbar ev-statusbar';
    g.parentElement.insertBefore(bar, g);
  }
  return bar;
}
function _evStatusBarHTML(counts, total){
  var isES = LANG === 'es';
  var html = '<button type="button" class="rd-filter' + (_evStatusFilter === 'all' ? ' active' : '') +
    '" onclick="setEvStatusFilter(\'all\')"><i class="dot" style="background:var(--hairline)"></i>' +
    (isES ? 'Todos' : 'All') + '<span class="cnt">' + total + '</span></button>';
  _EV_STATUS_ORDER.forEach(function(k){
    if(!counts[k] && _evStatusFilter !== k) return;
    html += '<button type="button" class="rd-filter' + (_evStatusFilter === k ? ' active' : '') +
      '" onclick="setEvStatusFilter(\'' + k + '\')"><i class="dot" style="background:' + _EV_STATUS_DOT[k] + '"></i>' +
      esc(statusLabel(k)) + '<span class="cnt">' + (counts[k] || 0) + '</span></button>';
  });
  return html;
}

/** Botonera por tarjeta/fila (PDF, duplicar, editar, borrar). */
function _evRowActions(id){
  var e = esc(id);
  return '<button type="button" class="rd-ibtn" title="' + esc(t('export_pdf')) + '" aria-label="' + esc(t('export_pdf')) +
      '" onclick="openExportPDFForEvent(\'' + e + '\')">' + _evIcon('pdf', 13, 2) + '</button>' +
    '<button type="button" class="rd-ibtn" title="' + (LANG === 'es' ? 'Duplicar' : 'Duplicate') + '" aria-label="' +
      (LANG === 'es' ? 'Duplicar' : 'Duplicate') + '" onclick="dupProj(\'' + e + '\')">' + _evIcon('copy', 13, 2) + '</button>' +
    '<button type="button" class="rd-ibtn" title="' + esc(t('edit')) + '" aria-label="' + esc(t('edit')) +
      '" onclick="openEventModal(\'' + e + '\')">' + _evIcon('edit', 13, 2) + '</button>' +
    '<button type="button" class="rd-ibtn danger" title="' + esc(t('delete')) + '" aria-label="' + esc(t('delete')) +
      '" onclick="confirmDelProj(\'' + e + '\')">' + _evIcon('trash', 13, 2) + '</button>';
}

function renderEvents(){
  var isMob = typeof isPhoneViewport === 'function' && isPhoneViewport();
  if(isMob) _evView='grid';
  var isES = LANG === 'es';
  updateEvSortLabel();
  updateEvFilterLabels();
  const esEl=document.getElementById('event-search');
  if(esEl) esEl.placeholder=isES?'Buscar eventos...':'Search events...';
  const efFrom=document.getElementById('ef-from'); const efTo=document.getElementById('ef-to');
  if(efFrom&&!efFrom.value&&_efFr){ efFrom.value=formatDMY(toLocalYMD(_efFr)); }
  if(efTo&&!efTo.value&&_efTo){ efTo.value=formatDMY(toLocalYMD(_efTo)); }
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

  // Los stubs de metadatos no traen tareas: sin ellas el "avance del plan" saldria
  // siempre en 0%.  Se completan en segundo plano y se vuelve a pintar una vez.
  if(typeof _ensureAllProjectsComplete === 'function' &&
     allEvents.some(function(p){ return p._metaOnly || (p._hasExtras && !p._extrasLoaded); })){
    _ensureAllProjectsComplete().then(function(changed){
      if(changed && (typeof _currentPage === 'undefined' || _currentPage === 'events')) renderEvents();
    });
  }

  // Linea de portafolio: eventos vivos y presupuesto agregado.
  var pfLine=document.getElementById('ev-portfolio-line');
  if(pfLine){
    var liveEvents=allEvents.filter(function(p){
      var st=_evNormStatus(p.status);
      return st!=='completed' && st!=='cancelled';
    });
    var liveBudget=liveEvents.reduce(function(s,p){ return s+(Number(p.budget)||0); },0);
    pfLine.textContent = allEvents.length
      ? (isES
          ? (liveEvents.length+' '+(liveEvents.length===1?'evento activo':'eventos activos')+' · '+fmtMoney(liveBudget)+' bajo gestión')
          : (liveEvents.length+' active '+(liveEvents.length===1?'event':'events')+' · '+fmtMoney(liveBudget)+' under management'))
      : (isES?'Todavía no hay eventos en tu portafolio.':'No events in your portfolio yet.');
  }

  let base=allEvents.slice();
  if(_evSearch.trim()){
    const q=_evSearch.trim().toLowerCase();
    base=base.filter(p=>[p.name,p.clientName,p.date,p.location].some(f=>f&&f.toLowerCase().includes(q)));
  }
  if(!_efAt){
    const fp=new Date('1900-01-01'); const ff=new Date('2100-12-31');
    const fFrom=_efFr||fp; const fTo=_efTo||ff;
    base=base.filter(p=>{
      if(!p.date)return false;
      const d=startOfLocalDay(p.date); if(!d) return _efAt;
      return d>=fFrom&&d<=fTo;
    });
  }
  // Conteos por estado sobre lo que ya paso busqueda + fechas.
  var stCounts={};
  base.forEach(function(p){ var k=_evNormStatus(p.status); stCounts[k]=(stCounts[k]||0)+1; });
  let list = _evStatusFilter==='all'
    ? base.slice()
    : base.filter(function(p){ return _evNormStatus(p.status)===_evStatusFilter; });
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

  // Fila de filtros por estado (nueva).  Se oculta cuando aun no hay eventos.
  var stBar=_evStatusBarHost();
  if(stBar){
    if(allEvents.length){
      stBar.style.display='';
      stBar.innerHTML=_evStatusBarHTML(stCounts, base.length);
    } else {
      stBar.style.display='none';
      stBar.innerHTML='';
    }
  }

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
    if (evSearchbar) evSearchbar.style.display = '';
    if (evToolbar) evToolbar.style.display = isMob ? 'none' : 'flex';
    if (evHeader) evHeader.style.marginBottom = '';
    g.className = 'ev-empty-host';
    g.innerHTML = renderEventsNoResultsState();
    if (mobileActions) mobileActions.innerHTML = renderEventsMobileActionBar();
    updateEvBulkBar();
    return;
  }
  if (evHeaderCopy) evHeaderCopy.style.display = '';
  if (evCreateBtn) evCreateBtn.style.display = 'inline-flex';
  if (evSearchbar) evSearchbar.style.display = '';
  if (evToolbar) evToolbar.style.display = isMob ? 'none' : 'flex';
  if (evHeader) evHeader.style.marginBottom = '';

  if(_evView==='list' && !isMob){
    // ── Escritorio: tabla ──
    var cols='30px minmax(160px,2fr) 112px 96px minmax(110px,1fr) 110px 78px 96px 140px';
    var head='<div class="rd-thead" style="grid-template-columns:'+cols+';gap:12px">'
      +'<div></div>'
      +'<div>'+(isES?'Evento':'Event')+'</div>'
      +'<div>'+(isES?'Tipo':'Type')+'</div>'
      +'<div>'+(isES?'Fecha':'Date')+'</div>'
      +'<div>'+(isES?'Sede':'Venue')+'</div>'
      +'<div>'+(isES?'Presupuesto':'Budget')+'</div>'
      +'<div>'+(isES?'Avance':'Progress')+'</div>'
      +'<div>'+(isES?'Estado':'Status')+'</div>'
      +'<div style="text-align:right">'+(isES?'Acciones':'Actions')+'</div>'
      +'</div>';
    var rows=list.map(function(p){
      var du=rdDaysUntil(p.date);
      var pct=evProgress(p);
      var sel=_evSelected[p.id]?' ev-row-sel':'';
      return '<div class="rd-row click ev-row'+sel+'" style="grid-template-columns:'+cols+';gap:12px" onclick="openProject(\''+esc(p.id)+'\')">'
        +'<label class="ev-rowcheck" onclick="event.stopPropagation()">'
          +'<input type="checkbox" class="ev-select-input"'+(_evSelected[p.id]?' checked':'')+' onchange="toggleEvSelected(\''+esc(p.id)+'\',this.checked)" aria-label="'+esc(p.name)+'">'
          +'<span class="ev-select-box">'+checkIcon()+'</span>'
        +'</label>'
        +'<div><div class="rd-cell-main">'+esc(p.name)+'</div><div class="rd-cell-sub">'+esc(p.clientName||'—')+'</div></div>'
        +'<div class="ev-cell-clip">'+rdPill(_evTypeText(p.type)||'—', evTypeTone(p.type), {up:true})+'</div>'
        +'<div class="rd-cell">'+esc(fmtDate(p.date))+'</div>'
        +'<div class="rd-cell">'+esc(p.location||'—')+'</div>'
        +'<div class="rd-cell-money">'+esc(fmtMoney(p.budget||0))+'</div>'
        +'<div><div class="rd-bar thin flat"><i style="width:'+pct+'%"></i></div><div class="rd-hint rd-num" style="margin-top:4px">'+pct+'%</div></div>'
        +'<div class="ev-cell-clip">'+rdPill(statusLabel(p.status)||'—', evStatusTone(p.status), {})+'</div>'
        +'<div class="ev-row-actions" onclick="event.stopPropagation()">'+_evRowActions(p.id)+'</div>'
        +'</div>';
    }).join('');
    g.className='ev-tablehost';
    g.innerHTML='<div class="rd-table"><div class="rd-table-scroll"><div style="min-width:1060px">'+head+rows+'</div></div></div>';
  } else if(isMob) {
    // ── Mobile: compact expandable event cards ──
    g.className='emc-list';
    g.innerHTML=list.map(p=>{
      const du=rdDaysUntil(p.date);
      const isOpen=_expandedEventIds.indexOf(p.id)>-1;
      return `<article class="emc${isOpen?' emc-open':''}" data-eid="${esc(p.id)}">
        <div class="emc-summary" onclick="toggleEventExpand('${esc(p.id)}')">
          <div class="emc-info">
            <div class="emc-name">${esc(p.name)}</div>
            <div class="emc-row">
              ${rdPill(_evTypeText(p.type)||'—', evTypeTone(p.type), {up:true, sm:true})}
              <span class="emc-date">${esc(fmtDate(p.date))}</span>
              <span class="emc-days${du.past?' is-past':''}">${esc(du.label)}</span>
            </div>
          </div>
          <svg class="emc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="emc-detail">
          <div class="emc-meta">
            ${p.clientName?'<div class="emc-meta-item"><span class="emc-meta-lbl">'+esc(t('client'))+'</span><span class="emc-meta-val">'+esc(p.clientName)+'</span></div>':''}
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Sede':'Venue'}</span><span class="emc-meta-val">${esc(p.location||'—')}</span></div>
            <div class="emc-meta-item"><span class="emc-meta-lbl">${esc(t('total_budget'))}</span><span class="emc-meta-val rd-num">${esc(fmtMoney(p.budget||0))}</span></div>
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Estado':'Status'}</span><span class="emc-meta-val">${esc(statusLabel(p.status))}</span></div>
            <div class="emc-meta-item"><span class="emc-meta-lbl">${isES?'Avance del plan':'Plan progress'}</span><span class="emc-meta-val rd-num">${evProgress(p)}%</span></div>
          </div>
          <div class="emc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-primary btn-sm" onclick="openProject('${esc(p.id)}')">${_evIcon('arrow',14,2.2)} ${isES?'Abrir':'Open'}</button>
            <button class="btn btn-sm" onclick="openEventModal('${esc(p.id)}')">${_evIcon('edit',14,2)} ${esc(t('edit'))}</button>
            <button class="btn btn-sm" onclick="openExportPDFForEvent('${esc(p.id)}')">${_evIcon('pdf',14,2)} PDF</button>
            <button class="btn btn-sm" onclick="dupProj('${esc(p.id)}')">${_evIcon('copy',14,2)} ${isES?'Duplicar':'Duplicate'}</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelProj('${esc(p.id)}')">${_evIcon('trash',14,2)} ${esc(t('delete'))}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  } else {
    // ── Escritorio: tarjetas ──
    g.className='ev-cards';
    g.innerHTML=list.map(function(p){
      var du=rdDaysUntil(p.date);
      var pct=evProgress(p);
      var guests=_evGuestCount(p);
      var typeFg=rdTone(evTypeTone(p.type)).fg;
      var daysBlock;
      if(!du.valid){
        daysBlock='<div class="rd-days is-past ev-days-sm">'+esc(t('no_date'))+'</div>';
      } else if(du.past){
        daysBlock='<div class="rd-days is-past ev-days-sm">'+esc(du.label)+'</div>';
      } else if(du.n===0){
        daysBlock='<div class="rd-days ev-days-sm">'+esc(t('today_label'))+'</div>';
      } else {
        daysBlock='<div class="rd-hint">'+(isES?'faltan':'in')+'</div>'
          +'<div class="rd-days">'+du.n+' '+(isES?'días':'days')+'</div>';
      }
      return '<article class="ev-card fade-in'+(_evSelected[p.id]?' is-sel':'')+'" onclick="openProject(\''+esc(p.id)+'\')">'
        +'<label class="ev-select" onclick="event.stopPropagation()">'
          +'<input type="checkbox" class="ev-select-input"'+(_evSelected[p.id]?' checked':'')+' onchange="toggleEvSelected(\''+esc(p.id)+'\',this.checked)" aria-label="'+esc(p.name)+'">'
          +'<span class="ev-select-box">'+checkIcon()+'</span>'
        +'</label>'
        +'<div class="rd-cover" style="background:'+evTypeCover(p.type)+'">'
          +'<span class="ev-cover-type" style="color:'+typeFg+'">'+esc(_evTypeText(p.type)||(isES?'Evento':'Event'))+'</span>'
          +'<div class="ev-cover-date">'+esc(fmtDate(p.date))+'</div>'
        +'</div>'
        +'<div class="ev-card-body">'
          +'<div class="ev-card-top">'
            +'<div style="min-width:0">'
              +'<h3 class="rd-h3 ev-card-name">'+esc(p.name)+'</h3>'
              +'<div class="ev-card-client">'+esc(p.clientName||'—')+'</div>'
            +'</div>'
            +'<div class="ev-card-days">'+daysBlock+'</div>'
          +'</div>'
          +'<div class="ev-card-meta">'
            +'<div style="min-width:0;flex:1"><div class="rd-label">'+(isES?'Sede':'Venue')+'</div>'
              +'<div class="ev-card-metaval rd-ellipsis" title="'+esc(p.location||'')+'">'+esc(p.location||'—')+'</div></div>'
            +'<div style="text-align:right;flex-shrink:0"><div class="rd-label">'+esc(t('total_budget'))+'</div>'
              +'<div class="ev-card-metaval rd-num">'+esc(fmtMoney(p.budget||0))+'</div></div>'
          +'</div>'
          +'<div class="ev-card-prog">'
            +'<div class="ev-card-prog-top"><span>'+(isES?'Avance del plan':'Plan progress')+'</span><span class="rd-num">'+pct+'%</span></div>'
            +'<div class="rd-bar"><i style="width:'+pct+'%"></i></div>'
          +'</div>'
          +'<div class="ev-card-foot">'
            +rdPill(statusLabel(p.status)||'—', evStatusTone(p.status), {dot:true})
            +'<span class="ev-card-guests rd-hint">'+guests+' '+esc(t('dash_guests_total')).toLowerCase()+'</span>'
            +'<span class="ev-card-open">'+(isES?'Abrir':'Open')+_evIcon('arrow',13,2.2)+'</span>'
            +'<div class="ev-card-actions" onclick="event.stopPropagation()">'+_evRowActions(p.id)+'</div>'
          +'</div>'
        +'</div>'
      +'</article>';
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
  const byStatus = _evStatusFilter !== 'all';
  const msg = byStatus
    ? (isES ? 'Ningún evento con este estado.' : 'No events with this status.')
    : (isES ? 'Ningún evento coincide con los filtros.' : 'No events match these filters.');
  const hint = isES
    ? 'Ajusta la búsqueda, el estado o el rango de fechas para ver más resultados.'
    : 'Adjust the search, the status or the date range to see more results.';
  return `<section class="rd-card pad-lg fade-in ev-noresults">
    <span class="ev-noresults-ico">${_evIcon('calendar', 20, 1.7)}</span>
    <h2 class="rd-h2">${msg}</h2>
    <p class="rd-sub">${hint}</p>
    ${byStatus ? `<button type="button" class="btn" style="margin-top:18px" onclick="setEvStatusFilter('all')">${isES ? 'Ver todos los eventos' : 'Show all events'}</button>` : ''}
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
            <div class="ev-empty-bento-label" style="margin-bottom:10px;font-weight:600;color:var(--sand-3)">${isES ? 'Todo lo que necesitas' : 'Everything you need'}</div>
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
  saveProj(c);renderEvents();toast(LANG==='es'?'Evento duplicado':'Event duplicated','s');
}

function confirmDelProj(id){
  const p=uproj()[id];
  openConfirmModal({
    title: LANG==='es'?'Eliminar evento':'Delete event',
    message: (LANG==='es'?'¿Eliminar "':'Delete "')+esc(p.name)+'"?',
    onConfirm: function(){ delProj(id);renderEvents();toast(LANG==='es'?'Evento eliminado':'Event deleted'); }
  });
}

// Los tres ayudantes de abajo conservan su firma historica pero delegan en los
// helpers compartidos de core.js (rdDonut / rdRing / rdMetric) para que el panel
// use exactamente la misma gramatica visual que el resto del rediseño.
function _dashDonut(data, colorFn, size){
  var pairs=(data||[]).map(function(d){ return [colorFn(d[0]), d[1]]; });
  return rdDonut(pairs, { size:size||118, stroke:Math.max(8,Math.round((size||118)*0.13)), center:null });
}
function _dashRing(pct, color, size){
  return rdRing(pct, { size:size||76, stroke:Math.max(5,Math.round((size||76)*0.12)), color:color||'#E4572E', sub:null, labelSize:Math.round((size||76)*0.24) });
}
function _dashKPI(label, value, sub, color, tooltip){
  return rdMetric({ label:label, value:value, sub:sub, color:color, center:true,
    valClass:'sm', attrs: tooltip ? 'title="'+esc(tooltip)+'"' : '' });
}
function dismissOnboarding(pid){
  localStorage.setItem('eventos_onb_'+pid,'1');
  renderDash();
}
function _dashOnboarding(p,hired,done,litems){
  var pid=p.id;
  if(localStorage.getItem('eventos_onb_'+pid)) return '';
  var steps=[
    {key:'onb_budget',   ok:(p.budget||0)>0,          action:"openEventModal('"+esc(pid)+"')", hint:''},
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
      return '<div class="pd-onb-step is-done">'
        +'<span class="rd-check done sm">'+_evIcon('check',11,3)+'</span>'
        +'<span class="pd-onb-step-lbl">'+esc(t(s.key))+'</span>'
      +'</div>';
    }
    return '<button type="button" class="pd-onb-step" onclick="'+esc(s.action)+'">'
      +'<span class="rd-check sm"></span>'
      +'<span style="min-width:0">'
        +'<span class="pd-onb-step-lbl">'+esc(t(s.key))+'</span>'
        +(s.hint?'<span class="pd-onb-step-hint">'+esc(s.hint)+' &rarr;</span>':'')
      +'</span>'
    +'</button>';
  }).join('');
  return '<div class="rd-card pad pd-onb">'
    +'<div class="pd-onb-head">'
      +'<div>'
        +'<div class="rd-label">'+esc(t('onb_title'))+'</div>'
        +'<div class="rd-hint" style="margin-top:4px">'+complete+' / '+steps.length+' '+esc(t('onb_steps_done'))+'</div>'
      +'</div>'
      +'<button type="button" class="rd-ibtn" onclick="dismissOnboarding(\''+esc(pid)+'\')" title="'+esc(t('onb_dismiss'))+'" aria-label="'+esc(t('onb_dismiss'))+'">&#10005;</button>'
    +'</div>'
    +'<div class="rd-bar thin" style="margin:14px 0"><i style="width:'+pct+'%"></i></div>'
    +'<div class="pd-onb-steps">'+stepsHtml+'</div>'
  +'</div>';
}

/** Alterna una tarea desde el panel del proyecto y repinta solo el panel. */
function dashToggleTask(tid){
  var p=proj(); if(!p) return;
  var tk=(p.tasks||[]).find(function(x){ return x && x.id===tid; });
  if(!tk) return;
  var nd=!(typeof taskIsDone==='function' ? taskIsDone(tk) : !!tk.done);
  tk.done=nd; tk.status=nd?'completed':'not-started';
  saveProj(p);
  renderDash();
}
window.dashToggleTask = dashToggleTask;

function renderDash(){
  var p=proj();if(!p)return;
  var el=document.getElementById('tab-dashboard');
  if(!el) return;
  var isES=LANG==='es';
  var vendors=p.vendors||[], guests=p.guests||[], tasks=p.tasks||[];
  // Presupuesto
  var tb=Number(p.budget)||0;
  var hired=vendors.filter(function(v){return v.hired;});
  var paid=hired.reduce(function(s,v){return s+(v.payments||[]).reduce(function(a,pay){return a+(Number(pay.amount)||0);},0);},0);
  var allocated=vendors.reduce(function(s,v){return s+(Number(v.budget)||0);},0);
  var remaining=tb-paid;
  var budgetPct=tb>0?Math.min(100,Math.round(paid/tb*100)):0;
  var allocPct=tb>0?Math.min(100,Math.round(allocated/tb*100)):0;
  var paidOfAlloc=allocated>0?Math.min(100,Math.round(paid/allocated*100)):0;
  var unallocPct=tb>0?Math.max(0,Math.round((tb-allocated)/tb*100)):0;
  // Desglose por categoria (proveedor contratado)
  var catSpend={};
  hired.forEach(function(v){
    var cat=v.name||(isES?'Otro':'Other');
    if(!catSpend[cat]) catSpend[cat]={budget:0,paid:0};
    catSpend[cat].budget+=Number(v.budget)||0;
    catSpend[cat].paid+=(v.payments||[]).reduce(function(a,pay){return a+(Number(pay.amount)||0);},0);
  });
  var catEntries=Object.entries(catSpend).sort(function(a,b){return b[1].budget-a[1].budget;}).slice(0,5);
  var catMax=catEntries.length?catEntries[0][1].budget:1;
  var catBarsHtml=catEntries.map(function(e,i){
    var pct=catMax>0?Math.round(e[1].budget/catMax*100):0;
    return '<div class="rd-cat-row">'
      +'<span title="'+esc(e[0])+'">'+esc(e[0])+'</span>'
      +'<span class="rd-bar thick"><i style="width:'+pct+'%;background:'+RD_SERIES[i%RD_SERIES.length]+'"></i></span>'
      +'<span>'+esc(formatCost(e[1].budget))+'</span>'
      +'</div>';
  }).join('');
  // Invitados
  var confirmed=guests.filter(function(g){return g.rsvp==='confirmed'||g.rsvp==='yes';}).length;
  var pending=guests.filter(function(g){return g.rsvp!=='confirmed'&&g.rsvp!=='yes'&&g.rsvp!=='declined'&&g.rsvp!=='no';}).length;
  var declined=guests.filter(function(g){return g.rsvp==='declined'||g.rsvp==='no';}).length;
  var plusOnes=guests.filter(function(g){return g.plusOne;}).length;
  var guestTotal=guests.length;
  var guestPct=guestTotal?Math.round(confirmed/guestTotal*100):0;
  // Tareas
  var done=tasks.filter(function(tk){return tk.done;}).length;
  var tpct=tasks.length?Math.round(done/tasks.length*100):0;
  var overdue=tasks.filter(function(tk){return isTaskOverdue(tk);}).length;
  // Plano
  var litems=p.layoutItems||[];
  if(!litems.length&&p.layoutExport&&p.layoutExport.layoutId&&typeof getLib==='function'){
    var _dashLibE=getLib().layouts.find(function(e){return e.id===p.layoutExport.layoutId;});
    if(_dashLibE) litems=_dashLibE.items||[];
  }
  var chairs=litems.reduce(function(s,i){return s+(i.chairs||0);},0);
  var assignedGuestTables=guests.filter(function(g){return g.table;});
  var tables=[...new Set(assignedGuestTables.map(function(g){return g.table;}))].length;
  var guestsWithTable=assignedGuestTables.length;
  var guestsWithoutTable=guestTotal-guestsWithTable;
  var layoutName=(p.layoutExport&&p.layoutExport.layoutName)||'';
  // Presupuesto por invitado
  var totalWithPlusOnes=guestTotal+plusOnes;
  var budgetPerGuest=totalWithPlusOnes>0&&tb>0?Math.ceil(tb/totalWithPlusOnes):0;

  // ── Métricas ───────────────────────────────────────────────────────────
  var metrics=''
    +rdMetric({label:t('dash_total_budget'), value:tb>0?formatCost(tb):'—',
      sub:isES?'aprobado por el cliente':'approved by the client',
      bar:{pct:100, color:'var(--ink)'}})
    +rdMetric({label:t('dash_paid'), value:formatCost(paid), color:'var(--success)',
      sub:tb>0?(budgetPct+'% '+t('dash_of_budget')):'—',
      bar:{pct:budgetPct, color:'var(--success)'}})
    +rdMetric({label:t('dash_remaining'), value:formatCost(remaining), color:remaining>=0?'var(--accent-deep)':'var(--danger)',
      sub:isES?'por pagar':'left to pay',
      bar:{pct:tb>0?Math.min(100,Math.round(Math.max(0,remaining)/tb*100)):0, color:'var(--accent)'}})
    +rdMetric({label:t('dash_guests_total'), value:String(guestTotal),
      sub:confirmed+' '+t('dash_confirmed')+(plusOnes?(' · '+plusOnes+' '+t('dash_plus_ones').toLowerCase()):''),
      bar:{pct:guestPct, color:'var(--champagne-2)'}})
    +rdMetric({label:t('dash_tasks_progress'), value:done+'/'+tasks.length,
      sub:tpct+'% '+t('dash_complete')+(overdue?(' · '+overdue+' '+t('dash_overdue')):''),
      bar:{pct:tpct, color:'var(--champagne)'}});

  // ── Tarjeta de presupuesto ─────────────────────────────────────────────
  var budgetCard='<section class="rd-card pad-lg">'
    +'<div class="rd-card-title"><h2>'+esc(t('dash_budget_overview'))+'</h2>'
      +'<button type="button" class="btn btn-sm" onclick="switchTab(\'budget\')">'+(isES?'Ver proveedores':'View vendors')+'</button></div>'
    +'<div class="pd-bignums">'
      +'<div><div class="rd-label">'+(isES?'Aprobado':'Approved')+'</div><div class="pd-bignum">'+esc(formatCost(tb))+'</div></div>'
      +'<div><div class="rd-label">'+esc(t('dash_paid'))+'</div><div class="pd-smallnum" style="color:var(--success)">'+esc(formatCost(paid))+'</div></div>'
      +'<div><div class="rd-label">'+(isES?'Saldo':'Balance')+'</div><div class="pd-smallnum">'+esc(formatCost(remaining))+'</div></div>'
      +'<div><div class="rd-label">'+esc(t('dash_vendors_hired'))+'</div><div class="pd-smallnum">'+hired.length+'/'+vendors.length+'</div></div>'
    +'</div>'
    +'<div class="pd-barrow"><div class="pd-barrow-top"><span>'+esc(t('dash_allocated'))+'</span>'
      +'<span class="rd-num">'+esc(formatCost(allocated))+(tb>0?' / '+esc(formatCost(tb)):'')+'</span></div>'
      +'<div class="rd-bar thick"><i style="width:'+Math.min(100,allocPct)+'%;background:'+(allocPct>100?'var(--danger)':'var(--warn-2)')+'"></i></div></div>'
    +'<div class="pd-barrow"><div class="pd-barrow-top"><span>'+esc(t('dash_paid'))+'</span>'
      +'<span class="rd-num">'+esc(formatCost(paid))+(allocated>0?' / '+esc(formatCost(allocated)):'')+'</span></div>'
      +'<div class="rd-bar thick"><i style="width:'+paidOfAlloc+'%;background:var(--success-2)"></i></div></div>'
    +(tb>0?('<div class="pd-barrow"><div class="pd-barrow-top"><span>'+esc(t('dash_unallocated'))+'</span>'
      +'<span class="rd-num" style="color:'+((tb-allocated)>=0?'var(--ink)':'var(--danger)')+'">'+esc(formatCost(tb-allocated))+'</span></div>'
      +'<div class="rd-bar thick"><i style="width:'+unallocPct+'%;background:var(--hairline)"></i></div></div>'):'')
    +(budgetPerGuest>0?('<div class="pd-perguest rd-hint">'+(isES?'Equivale a ':'That is ')+esc(formatCost(budgetPerGuest))+(isES?' por invitado (':' per guest (')+totalWithPlusOnes+(isES?' con acompañantes)':' incl. plus-ones)')+'</div>'):'')
    +(catEntries.length?('<div class="pd-cats"><div class="rd-label" style="margin-bottom:14px">'+esc(t('dash_budget_by_category'))+'</div>'+catBarsHtml+'</div>'):'')
  +'</section>';

  // ── Invitados ──────────────────────────────────────────────────────────
  var guestCard='<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+esc(t('dash_guests_total'))+'</h2>'
      +'<button type="button" class="btn btn-sm" onclick="switchTab(\'guests\')">'+(isES?'Abrir lista':'Open list')+'</button></div>'
    +(guestTotal>0
      ?('<div class="pd-donutrow">'
        +rdDonut([['#17A398',confirmed],['#F2A93B',pending],['#E4572E',declined]],
          {size:112, stroke:14, center:String(guestTotal), centerSub:isES?'invitados':'guests'})
        +'<div style="flex:1;min-width:0">'
          +'<div class="rd-legend-row"><i style="background:#17A398"></i><span>'+esc(t('dash_confirmed'))+'</span><b>'+confirmed+'</b></div>'
          +'<div class="rd-legend-row"><i style="background:#F2A93B"></i><span>'+esc(t('dash_pending'))+'</span><b>'+pending+'</b></div>'
          +'<div class="rd-legend-row"><i style="background:#E4572E"></i><span>'+esc(t('dash_declined'))+'</span><b>'+declined+'</b></div>'
          +'<div class="pd-legend-foot rd-hint">'+plusOnes+' '+esc(t('dash_plus_ones')).toLowerCase()+' · '+tables+' '+esc(t('dash_tables')).toLowerCase()+'</div>'
        +'</div>'
      +'</div>')
      :('<div class="pd-empty">'+(isES?'Todavía no hay invitados en la lista.':'No guests on the list yet.')+'</div>'))
  +'</section>';

  // ── Siguientes tareas ──────────────────────────────────────────────────
  var pendingTasks=tasks.filter(function(tk){return !tk.done;}).sort(function(a,b){
    var av=a.dueDate||'9999-12-31', bv=b.dueDate||'9999-12-31';
    return av<bv?-1:av>bv?1:0;
  }).slice(0,5);
  var taskRows=pendingTasks.map(function(tk){
    var od=isTaskOverdue(tk);
    var du=tk.dueDate?rdDaysUntil(tk.dueDate):null;
    var dueTxt=od?(isES?'Vencida':'Overdue'):(du&&du.valid?du.label:esc(t('no_date')));
    return '<div class="pd-task">'
      +'<button type="button" class="rd-check sm" onclick="dashToggleTask(\''+esc(tk.id)+'\')" aria-label="'+esc(tk.title||tk.name||'')+'"></button>'
      +'<div style="min-width:0;flex:1">'
        +'<div class="pd-task-title rd-ellipsis">'+esc(tk.title||tk.name||(isES?'Tarea':'Task'))+'</div>'
        +'<div class="pd-task-sub">'+esc(tk.assignee||tk.who||tk.phase||'—')+'</div>'
      +'</div>'
      +'<span class="pd-task-due'+(od?' is-over':'')+'">'+esc(dueTxt)+'</span>'
    +'</div>';
  }).join('');
  var taskCard='<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+(isES?'Siguientes tareas':'Next tasks')+'</h2>'
      +'<button type="button" class="btn btn-sm" onclick="switchTab(\'timeline\')">'+esc(t('tab_timeline'))+'</button></div>'
    +(pendingTasks.length
      ?taskRows
      :('<div class="pd-empty">'+(tasks.length?(isES?'¡Todas las tareas están hechas!':'Every task is done!'):(isES?'Todavía no hay tareas en el plan.':'No tasks in the plan yet.'))+'</div>'))
  +'</section>';

  // ── Plano ──────────────────────────────────────────────────────────────
  var layoutCard='<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+esc(t('dash_layout_summary'))+'</h2></div>'
    +'<div class="pd-layoutrow">'
      +'<div><div class="pd-layout-num rd-num">'+tables+'</div><div class="rd-mini">'+esc(t('dash_tables'))+'</div></div>'
      +'<div><div class="pd-layout-num rd-num">'+chairs+'</div><div class="rd-mini">'+esc(t('dash_chairs'))+'</div></div>'
      +'<div style="flex:1"></div>'
      +'<button type="button" class="btn btn-sm" onclick="switchTab(\'layout\')">'+(isES?'Abrir editor':'Open editor')+'</button>'
    +'</div>'
    +(layoutName
      ?('<div class="pd-layout-name rd-hint rd-ellipsis" title="'+esc(layoutName)+'">'+esc(layoutName)+'</div>')
      :(tables?'':('<div class="pd-empty" style="padding-top:12px">'+esc(t('dash_no_layout'))+'</div>')))
    +(guestsWithoutTable>0?('<div class="pd-layout-name rd-hint">'+guestsWithoutTable+' '+(isES?'invitados sin mesa asignada':'guests without a table')+'</div>'):'')
  +'</section>';

  el.innerHTML=_dashOnboarding(p,hired,done,litems)
    +'<div class="rd-metrics">'+metrics+'</div>'
    +'<div class="rd-grid-2">'+budgetCard+'<div class="rd-col">'+guestCard+taskCard+layoutCard+'</div></div>';
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
var _AD_MON_ES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var _AD_MON_EN=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function renderAppDash(){
  const el = document.getElementById('pg-dashboard-content');
  if (!el) return;
  const isES = LANG === 'es';
  const all = Object.values(uproj()).filter(function(p){
    return p && p.id && !p._metaOnly && p.id !== '__library__' && p.id !== '__lib_layout__' && p.status && p.status !== '__internal__';
  });

  var head='<div class="rd-page-head"><div>'
    +'<div class="rd-eyebrow">'+esc(t('panel_eyebrow'))+'</div>'
    +'<h1 class="rd-h1">'+(isES?'Panel general':'Dashboard')+'</h1>'
    +'<p class="rd-sub">'+(isES?'Todo lo que necesita tu atención, en un solo lugar.':'Everything that needs your attention, in one place.')+'</p>'
  +'</div></div>';

  if(!all.length){
    el.innerHTML=head
      +'<section class="rd-card pad-lg ad-blank">'
        +'<span class="ad-blank-ico">'+_evIcon('calendar',22,1.7)+'</span>'
        +'<h2 class="rd-h2">'+(isES?'Aún no hay nada que seguir':'Nothing to track yet')+'</h2>'
        +'<p class="rd-sub">'+(isES?'Crea tu primer evento y este panel se llenará con lo que necesita tu atención.':'Create your first event and this panel will fill up with what needs your attention.')+'</p>'
        +'<button type="button" class="btn btn-primary" style="margin-top:18px" onclick="openEventModal()">'+_evIcon('plus',15,2.4)+' '+esc(t('create_event'))+'</button>'
      +'</section>';
    return;
  }

  const todayY = toLocalYMD(new Date());
  var totBudget=0, totGuests=0, totConfirmed=0, openTasks=0, overdueTasks=0, activeCount=0, soonCount=0;
  var upcoming=[], attention=[], risk=null;
  var statusCounts={};

  all.forEach(function(p){
    var s = rdEventSummary(p);
    var st = _evNormStatus(p.status);
    statusCounts[st]=(statusCounts[st]||0)+1;
    var live = st!=='completed' && st!=='cancelled';
    var du = rdDaysUntil(p.date);
    if(live){ activeCount++; totBudget += s.budget; }
    totGuests += s.guestsTotal;
    totConfirmed += s.confirmed;
    openTasks += Math.max(0, s.tasksTotal - s.tasksDone);
    overdueTasks += s.overdue;
    if(live && du.valid && du.n>=0){
      upcoming.push({p:p, n:du.n, label:du.label, pct:evProgress(p)});
      if(du.n<=120) soonCount++;
    }

    // ── Requiere atención: tareas vencidas / de hoy ──
    (p.tasks||[]).forEach(function(tk){
      if(!tk || tk.done) return;
      if(isTaskOverdue(tk)){
        attention.push({sev:0, tone:'danger', icon:'alert',
          title:(tk.title||tk.name||(isES?'Tarea':'Task')),
          meta:p.name+(tk.assignee?(' · '+tk.assignee):''),
          due:isES?'Vencida':'Overdue', dueTone:'danger',
          act:"openProject('"+p.id+"');setTimeout(function(){switchTab('timeline')},140)"});
      } else if(tk.dueDate===todayY){
        attention.push({sev:1, tone:'warn', icon:'clock',
          title:(tk.title||tk.name||(isES?'Tarea':'Task')),
          meta:p.name+(tk.assignee?(' · '+tk.assignee):''),
          due:t('today_label'), dueTone:'warn',
          act:"openProject('"+p.id+"');setTimeout(function(){switchTab('timeline')},140)"});
      }
    });

    // ── Requiere atención: proveedores (agregados por evento) ──
    if(live){
      var toBudget="openProject('"+p.id+"');setTimeout(function(){switchTab('budget')},140)";
      var unbooked=[], unbookedAmt=0, owing=[], owingAmt=0;
      (p.vendors||[]).forEach(function(v){
        if(!v) return;
        var vb=Number(v.budget)||0;
        var vp=(v.payments||[]).reduce(function(a,pay){return a+(Number(pay&&pay.amount)||0);},0);
        if(!v.hired && vb>0){ unbooked.push(v); unbookedAmt+=vb; }
        else if(v.hired && vb-vp>0){ owing.push(v); owingAmt+=(vb-vp); }
      });
      if(unbooked.length && du.valid && du.n>=0 && du.n<=90){
        attention.push({sev:2, tone:'info', icon:'edit',
          title: unbooked.length===1
            ? ((isES?'Sin contratar — ':'Not booked — ')+(unbooked[0].name||(isES?'Proveedor':'Vendor')))
            : (unbooked.length+(isES?' proveedores sin contratar':' vendors not booked')),
          meta:p.name+' · '+fmtMoney(unbookedAmt),
          due:du.label, dueTone:'muted', act:toBudget});
      }
      if(owing.length && du.valid && du.n>=0 && du.n<=30){
        attention.push({sev:1, tone:'warn', icon:'money',
          title: owing.length===1
            ? ((isES?'Saldo pendiente — ':'Balance due — ')+(owing[0].name||(isES?'Proveedor':'Vendor')))
            : (owing.length+(isES?' saldos pendientes':' balances due')),
          meta:p.name+' · '+fmtMoney(owingAmt),
          due:du.label, dueTone:'warn', act:toBudget});
      }
      if(unbooked.length && du.valid && du.n>=0 && (!risk || du.n<risk.n)){
        risk={p:p, n:du.n, count:unbooked.length};
      }
    }

    // ── Requiere atención: datos del evento ──
    if(!p.date){
      attention.push({sev:1, tone:'warn', icon:'calendar',
        title:isES?'Evento sin fecha':'Event without a date',
        meta:p.name, due:'', dueTone:'muted',
        act:"openEventModal('"+p.id+"')"});
    }
    if(live && s.budget>0 && s.allocated>s.budget){
      attention.push({sev:2, tone:'danger', icon:'money',
        title:isES?'Presupuesto excedido':'Over budget',
        meta:p.name+' · '+fmtMoney(s.allocated-s.budget)+(isES?' de más':' over'),
        due:'', dueTone:'muted',
        act:"openProject('"+p.id+"');setTimeout(function(){switchTab('budget')},140)"});
    }
  });

  upcoming.sort(function(a,b){ return a.n-b.n; });
  attention.sort(function(a,b){ return a.sev-b.sev; });
  var attTop=attention.slice(0,6);

  // ── Métricas ───────────────────────────────────────────────────────────
  var moneyTxt=fmtMoney(totBudget);
  var metrics='<div class="rd-metrics">'
    +rdMetric({label:isES?'Eventos activos':'Active events', value:String(activeCount),
      sub:isES?(soonCount+' en los próximos 120 días'):(soonCount+' in the next 120 days'),
      icon:_evIcon('calendar',15), iconBg:'var(--accent-l)', iconFg:'var(--accent-deep)', valClass:'lg'})
    +rdMetric({label:isES?'Bajo gestión':'Under management', value:moneyTxt,
      sub:isES?'presupuesto agregado':'aggregate budget',
      icon:_evIcon('money',15), iconBg:'var(--champagne-l)', iconFg:'var(--champagne-deep)',
      valClass:moneyTxt.length>12?'sm':'lg'})
    +rdMetric({label:isES?'Tareas por hacer':'Open tasks', value:String(openTasks),
      sub:overdueTasks?(overdueTasks+' '+(isES?'vencidas':'overdue')):(isES?'ninguna vencida':'none overdue'),
      icon:_evIcon('tasks',15),
      iconBg:overdueTasks?'var(--accent-l)':'var(--success-l)', iconFg:overdueTasks?'var(--accent-deep)':'var(--success)',
      valClass:'lg'})
    +rdMetric({label:isES?'Invitados totales':'Total guests', value:String(totGuests),
      sub:totConfirmed+' '+t('dash_confirmed').toLowerCase(),
      icon:_evIcon('users',15), iconBg:'var(--success-l)', iconFg:'var(--success)', valClass:'lg'})
  +'</div>';

  // ── Próximos eventos ───────────────────────────────────────────────────
  var MON=isES?_AD_MON_ES:_AD_MON_EN;
  var upRows=upcoming.slice(0,5).map(function(u){
    var d=startOfLocalDay(u.p.date);
    var day=d?String(d.getDate()).padStart(2,'0'):'—';
    var mon=d?MON[d.getMonth()]:'';
    var meta=[u.p.clientName, u.p.location].filter(Boolean).join(' · ');
    return '<div class="rd-card-row click ad-up" onclick="openProject(\''+esc(u.p.id)+'\')">'
      +'<div class="ad-up-date"><div class="ad-up-day rd-num">'+day+'</div><div class="rd-mini" style="font-size:10px;margin-top:2px">'+esc(mon)+'</div></div>'
      +'<span class="ad-up-sep"></span>'
      +'<div style="min-width:0;flex:1"><div class="ad-up-name rd-ellipsis">'+esc(u.p.name)+'</div>'
        +'<div class="ad-up-meta rd-ellipsis">'+esc(meta||'—')+'</div></div>'
      +'<div class="ad-up-prog"><div class="rd-bar thin"><i style="width:'+u.pct+'%"></i></div>'
        +'<div class="rd-hint rd-num" style="margin-top:5px;text-align:right">'+u.pct+'% '+(isES?'listo':'ready')+'</div></div>'
      +rdPill(u.label, evStatusTone(u.p.status), {cls:'ad-up-tag'})
    +'</div>';
  }).join('');
  var upCard='<section class="rd-card clip">'
    +'<div class="rd-card-head"><span class="rd-card-dot"></span><h2>'+(isES?'Próximos eventos':'Upcoming events')+'</h2>'
      +'<span class="rd-spacer"></span>'
      +'<button type="button" class="rd-link" onclick="showPage(\'events\')">'+(isES?'Ver todos':'View all')+'</button></div>'
    +(upRows||('<div class="pd-empty" style="padding:26px 22px">'+(isES?'No hay eventos futuros programados.':'No upcoming events scheduled.')+'</div>'))
  +'</section>';

  // ── Requiere atención ──────────────────────────────────────────────────
  var attRows=attTop.map(function(a){
    var dueColor=a.dueTone==='danger'?'var(--danger)':a.dueTone==='warn'?'var(--warn)':'var(--muted)';
    return '<div class="rd-card-row ad-att">'
      +'<span class="ad-att-ico t-'+a.tone+'">'+_evIcon(a.icon,13,2)+'</span>'
      +'<div style="min-width:0;flex:1"><div class="ad-att-title rd-ellipsis">'+esc(a.title)+'</div>'
        +'<div class="ad-att-meta rd-ellipsis">'+esc(a.meta)+'</div></div>'
      +(a.due?('<span class="ad-att-due" style="color:'+dueColor+'">'+esc(a.due)+'</span>'):'')
      +'<button type="button" class="btn btn-sm ad-att-btn" onclick="'+esc(a.act)+'">'+(isES?'Resolver':'Resolve')+'</button>'
    +'</div>';
  }).join('');
  var attCard='<section class="rd-card clip">'
    +'<div class="rd-card-head"><span class="rd-card-dot deep"></span><h2>'+esc(t('needs_attention'))+'</h2>'
      +(attention.length?('<span class="rd-pill sm t-danger ad-att-count">'+attention.length+'</span>'):'')+'</div>'
    +(attTop.length
      ?(attRows+(attention.length>attTop.length
        ?('<div class="ad-att-more rd-hint">'+(isES?('y '+(attention.length-attTop.length)+' más…'):('and '+(attention.length-attTop.length)+' more…'))+'</div>')
        :''))
      :('<div class="ad-clear">'
        +'<span class="ad-clear-ico">'+_evIcon('check',18,2.2)+'</span>'
        +'<div><div class="ad-clear-title">'+(isES?'Todo en orden':'All clear')+'</div>'
        +'<div class="rd-hint">'+(isES?'Sin tareas vencidas ni saldos urgentes.':'No overdue tasks and no urgent balances.')+'</div></div>'
      +'</div>'))
  +'</section>';

  // ── Eventos por estado ─────────────────────────────────────────────────
  var donutData=[], legendHTML='';
  _EV_STATUS_ORDER.forEach(function(k){
    var n=statusCounts[k]||0;
    if(!n) return;
    donutData.push([_EV_STATUS_DOT[k], n]);
    legendHTML+='<div class="rd-legend-row"><i style="background:'+_EV_STATUS_DOT[k]+'"></i><span>'+esc(statusLabel(k))+'</span><b>'+n+'</b></div>';
  });
  var statusCard='<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+(isES?'Eventos por estado':'Events by status')+'</h2></div>'
    +'<div class="pd-donutrow">'
      +rdDonut(donutData,{size:118,stroke:15,center:String(all.length),centerSub:isES?'eventos':'events'})
      +'<div style="flex:1;min-width:0">'+(legendHTML||('<span class="rd-hint">'+(isES?'Sin eventos todavía':'No events yet')+'</span>'))+'</div>'
    +'</div>'
  +'</section>';

  // ── Riesgo del portafolio (solo si hay algo real que contar) ───────────
  var riskCard='';
  if(risk){
    var rn=risk.count;
    var txt=isES
      ? (rn===1
          ? ('Un proveedor de «'+risk.p.name+'» sigue sin contratar a '+risk.n+' días del evento.')
          : (rn+' proveedores de «'+risk.p.name+'» siguen sin contratar a '+risk.n+' días del evento.'))
      : (rn===1
          ? ('One vendor for “'+risk.p.name+'” is still unbooked, '+risk.n+' days before the event.')
          : (rn+' vendors for “'+risk.p.name+'” are still unbooked, '+risk.n+' days before the event.'));
    riskCard='<section class="rd-dark">'
      +'<div class="rd-dark-eyebrow">'+_evIcon('alert',15,1.8)+'<span>'+(isES?'Riesgo del portafolio':'Portfolio risk')+'</span></div>'
      +'<p>'+esc(txt)+'</p>'
      +'<button type="button" class="btn" onclick="openProject(\''+esc(risk.p.id)+'\');setTimeout(function(){switchTab(\'budget\')},140)">'
        +(isES?'Revisar proveedores':'Review vendors')+'</button>'
    +'</section>';
  }

  // ── Accesos rápidos ────────────────────────────────────────────────────
  var quick=[
    {icon:'plus',     label:t('create_event'),                       act:'openEventModal()'},
    {icon:'vendors',  label:isES?'Biblioteca':'Library',             act:"showPage('library')"},
    {icon:'chart',    label:t('nav_analytics'),                      act:"showPage('analytics')"},
    {icon:'calendar', label:isES?'Ver eventos':'View events',        act:"showPage('events')"}
  ].map(function(q){
    return '<button type="button" class="rd-quick" onclick="'+esc(q.act)+'">'
      +'<span>'+_evIcon(q.icon,17)+'</span><span>'+esc(q.label)+'</span></button>';
  }).join('');
  var quickCard='<section class="rd-card pad">'
    +'<div class="rd-card-title"><h2>'+(isES?'Accesos rápidos':'Quick actions')+'</h2></div>'
    +'<div class="ad-quickgrid">'+quick+'</div>'
  +'</section>';

  el.innerHTML=head+metrics
    +'<div class="rd-grid-2 wide">'
      +'<div class="rd-col">'+upCard+attCard+'</div>'
      +'<div class="rd-col">'+statusCard+riskCard+quickCard+'</div>'
    +'</div>';
}

