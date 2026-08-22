// Doble de prueba de la capa de datos (Convex) + Clerk, con datos semilla
// realistas.  Solo lo usa el servidor de vista previa; no se despliega.
(function () {
  var Q = window.__PREVIEW_QUERY || {};
  var TENANT = 'preview-tenant';

  function ymd(offsetDays) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function vendor(id, name, cat, budget, paidParts, hired, phone, email) {
    return {
      id: id, name: name, service: cat, category: cat, budget: budget, hired: hired,
      phone: phone || '', email: email || '', notes: '',
      payments: (paidParts || []).map(function (a, i) {
        return { id: id + '-p' + i, amount: a, date: ymd(-30 + i * 10), note: 'Anticipo' };
      })
    };
  }
  function task(id, title, done, dueOffset, phase, who, desc) {
    return {
      id: id, title: title, done: done, dueDate: ymd(dueOffset), startDate: ymd(dueOffset - 3),
      phase: phase, assignee: who, who: who, notes: desc, description: desc, duration: 2
    };
  }
  function guest(id, name, contact, cat, rsvp, table, plus, meal) {
    return {
      id: id, name: name, email: contact.indexOf('@') > -1 ? contact : '', phone: contact.indexOf('@') > -1 ? '' : contact,
      category: cat, group: cat, rsvp: rsvp, table: table, plusOne: !!plus, meal: meal, notes: ''
    };
  }

  var P1 = {
    id: 'p1', name: 'Boda Ramírez & Ortiz', clientName: 'Familia Ramírez', type: 'social',
    status: 'confirmed', date: ymd(85), location: 'Hacienda San Gabriel, Querétaro',
    budget: 960000, currency: { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
    guestCount: 210, _dataVersion: 3,
    vendors: [
      vendor('v1', 'Banquetes Solar', 'Banquete', 310000, [155000], true, '55 1188 4402', 'ana@solar.mx'),
      vendor('v2', 'Hacienda San Gabriel', 'Sede', 240000, [120000, 120000], true, '442 220 9911', 'reservas@sangabriel.mx'),
      vendor('v3', 'Flores del Bajío', 'Decoración', 120000, [40000], false, '55 4090 7781', 'rita@floresbajio.mx'),
      vendor('v4', 'Audio Norte', 'Audio e iluminación', 96000, [28800], true, '81 3344 1290', 'ivan@audionorte.mx'),
      vendor('v5', 'Estudio Mora', 'Foto y video', 85000, [], false, '55 7712 3390', 'lucia@estudiomora.mx'),
      vendor('v6', 'Mariachi Aurora', 'Música', 48000, [], false, '33 2201 8876', 'jorge@aurora.mx')
    ],
    tasks: [
      task('t1', 'Firmar contrato de banquete', true, -40, 'Contratación', 'Jimena L.', 'Revisar cláusulas de cancelación'),
      task('t2', 'Confirmar menú de degustación', true, -19, 'Banquete', 'Jimena L.', 'Elegir entre las tres propuestas'),
      task('t3', 'Enviar invitaciones digitales', false, -3, 'Invitados', 'Sofía R.', 'Lista A y B con RSVP en línea'),
      task('t4', 'Prueba de iluminación en salón', false, 12, 'Producción', 'Iván D.', 'Coordinar con Audio Norte'),
      task('t5', 'Cerrar plano de mesas', false, 30, 'Plano', 'Jimena L.', 'Asignar acompañantes y menús'),
      task('t6', 'Pago final a proveedores', false, 72, 'Pagos', 'Administración', 'Saldos de banquete y flores')
    ],
    guests: [
      guest('g1', 'Alejandra Ríos', 'ale.rios@mail.com', 'Familia novia', 'confirmed', 'Mesa 3', 1, 'Vegetariano'),
      guest('g2', 'Bruno Castillo', 'bruno.c@mail.com', 'Amigos novio', 'confirmed', 'Mesa 7', 0, 'Estándar'),
      guest('g3', 'Carmen Villalobos', '55 1234 8890', 'Familia novio', 'pending', 'Mesa 2', 1, 'Estándar'),
      guest('g4', 'Diego Mendoza', 'diego.m@mail.com', 'Trabajo', 'declined', '', 0, ''),
      guest('g5', 'Elena Fuentes', 'elena.f@mail.com', 'Familia novia', 'confirmed', 'Mesa 1', 1, 'Sin gluten'),
      guest('g6', 'Fernando Ochoa', '55 9087 1122', 'Amigos novia', 'pending', 'Mesa 9', 0, 'Estándar'),
      guest('g7', 'Gabriela Terán', 'gaby.teran@mail.com', 'Trabajo', 'confirmed', 'Mesa 5', 0, 'Vegano'),
      guest('g8', 'Hugo Beltrán', 'hugo.b@mail.com', 'Amigos novio', 'pending', '', 1, 'Estándar')
    ],
    layoutItems: [
      { id: 'L1', type: 'table', shape: 'round', label: 'M1', x: 120, y: 140, w: 180, h: 180, chairs: 10, assigned: 10, cost: 4200 },
      { id: 'L2', type: 'table', shape: 'round', label: 'M2', x: 120, y: 380, w: 180, h: 180, chairs: 10, assigned: 8, cost: 4200 },
      { id: 'L3', type: 'table', shape: 'round', label: 'M3', x: 720, y: 140, w: 180, h: 180, chairs: 10, assigned: 10, cost: 4200 },
      { id: 'L4', type: 'table', shape: 'round', label: 'M4', x: 720, y: 380, w: 180, h: 180, chairs: 10, assigned: 4, cost: 4200 },
      { id: 'L5', type: 'element', shape: 'rect', label: 'Pista de baile', x: 380, y: 260, w: 260, h: 180, cost: 12000 }
    ],
    moodboard: [], savedLayouts: [], eventLayouts: []
  };

  var P2 = {
    id: 'p2', name: 'Cena Anual Grupo Vertiz', clientName: 'Grupo Vertiz', type: 'corporate',
    status: 'in-progress', date: ymd(106), location: 'Salón Bosques, CDMX', budget: 640000,
    guestCount: 240, _dataVersion: 3,
    vendors: [vendor('v1', 'Catering Bosques', 'Banquete', 220000, [66000], true, '', ''),
              vendor('v2', 'Luz & Set', 'Producción', 140000, [], false, '', '')],
    tasks: [task('t1', 'Cerrar sede', true, -20, 'Contratación', 'Ana P.', ''),
            task('t2', 'Definir programa', false, 14, 'Producción', 'Ana P.', ''),
            task('t3', 'Confirmar montaje con sede', false, 6, 'Producción', 'Luis M.', '')],
    guests: [guest('g1', 'Roberto Vertiz', 'rv@vertiz.mx', 'Directivos', 'confirmed', 'Mesa 1', 1, 'Estándar'),
             guest('g2', 'Paola Nieto', 'pn@vertiz.mx', 'Directivos', 'pending', '', 0, 'Estándar')],
    layoutItems: [], moodboard: [], savedLayouts: [], eventLayouts: []
  };

  var P3 = {
    id: 'p3', name: 'Gala Fundación Lumen', clientName: 'Fundación Lumen', type: 'community',
    status: 'to-be-confirmed', date: ymd(184), location: 'Museo Kaluz, CDMX', budget: 1250000,
    guestCount: 380, _dataVersion: 3,
    vendors: [vendor('v1', 'Museo Kaluz', 'Sede', 400000, [], false, '', '')],
    tasks: [task('t1', 'Propuesta de patrocinios', false, 40, 'Contratación', 'Equipo', '')],
    guests: [], layoutItems: [], moodboard: [], savedLayouts: [], eventLayouts: []
  };

  var P4 = {
    id: 'p4', name: 'Congreso Innova 2027', clientName: 'Instituto Innova', type: 'education',
    status: 'to-be-confirmed', date: ymd(231), location: 'Centro Citibanamex, CDMX', budget: 1840000,
    guestCount: 900, _dataVersion: 3,
    vendors: [], tasks: [], guests: [], layoutItems: [], moodboard: [], savedLayouts: [], eventLayouts: []
  };

  var LIB = {
    id: '__library__', name: 'Library', status: '__internal__', type: 'social', _dataVersion: 3,
    vendors: [vendor('lv1', 'Banquetes Solar', 'Banquete', 310000, [], false, '55 1188 4402', 'ana@solar.mx'),
              vendor('lv2', 'Flores del Bajío', 'Decoración', 120000, [], false, '', ''),
              vendor('lv3', 'Audio Norte', 'Audio e iluminación', 96000, [], false, '', '')],
    tasks: [task('lt1', 'Firmar contrato de sede', false, 10, 'Contratación', '', ''),
            task('lt2', 'Cerrar menú', false, 20, 'Banquete', '', '')],
    guests: [], layoutItems: [], moodboard: [], savedLayouts: [], eventLayouts: [],
    vendorGroups: [], taskGroups: [], moodboards: []
  };

  var STORE = {};
  [P1, P2, P3, P4, LIB].forEach(function (p) { STORE[p.id] = p; });

  if (Q.empty === '1') STORE = {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function meta(p) {
    var m = clone(p);
    ['vendors', 'tasks', 'guests', 'layoutItems', 'moodboard', 'savedLayouts', 'eventLayouts'].forEach(function (k) { m[k] = []; });
    m._metaOnly = true;
    return m;
  }

  window.EVENTOS_DATA = {
    isConfigured: function () { return true; },
    getConfigErrorMessage: function () { return ''; },
    ensureIdentity: async function () {
      return { tenantId: TENANT, subject: 'user_preview', email: 'jimena@estudio.mx', name: 'Jimena Lozano', linkedLegacy: false };
    },
    getTenantId: function () { return TENANT; },
    getAuthToken: async function () { return 'preview-token'; },
    isSignedIn: function () { return true; },
    signOut: async function () { },
    getProjectMetaByWixUserId: async function () {
      var out = {}; Object.keys(STORE).forEach(function (id) { out[id] = meta(STORE[id]); }); return out;
    },
    getProjectsByWixUserId: async function () {
      var out = {}; Object.keys(STORE).forEach(function (id) { out[id] = clone(STORE[id]); }); return out;
    },
    getChangedProjectIds: async function () { return []; },
    getProjectById: async function (id) { return STORE[id] ? clone(STORE[id]) : null; },
    getProjectExtras: async function () { return null; },
    upsertProject: async function (p) { STORE[p.id] = clone(p); return { _version: Date.now() }; },
    deleteProject: async function (id) { delete STORE[id]; return true; },
    deleteFilesForProject: async function () { return true; },
    claimFileOwnership: async function () { return true; },
    generateUploadUrl: async function () { return 'about:blank'; },
    uploadFile: async function () { return { storageId: 'preview' }; },
    getFileUrl: async function () { return ''; },
    getFileUrls: async function () { return {}; },
    deleteFile: async function () { return true; }
  };

  // Clerk: solo hace falta el usuario para pintar nombre y avatar.
  window.Clerk = {
    session: { id: 'sess_preview', status: 'active' },
    user: {
      fullName: 'Jimena Lozano', firstName: 'Jimena',
      primaryEmailAddress: { emailAddress: 'jimena@estudio.mx' }
    },
    addListener: function () { }, load: function () { return Promise.resolve(); },
    signOut: function () { return Promise.resolve(); },
    mountSignIn: function () { }, openSignIn: function () { }
  };

  // Registro de errores para que el verificador headless los pueda leer.
  window.__ERRORS = [];
  window.addEventListener('error', function (e) {
    window.__ERRORS.push('error: ' + (e.message || '') + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__ERRORS.push('unhandled rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason));
  });
  var _err = console.error;
  console.error = function () {
    window.__ERRORS.push('console.error: ' + Array.prototype.map.call(arguments, function (a) {
      return (a && a.stack) ? a.stack : (typeof a === 'object' ? JSON.stringify(a) : String(a));
    }).join(' '));
    return _err.apply(console, arguments);
  };

  // Idioma y tema fijados por query, antes de que arranque la app.
  try {
    if (Q.lang) localStorage.setItem('eventos_lang_' + TENANT, Q.lang);
    var settings = { theme: Q.theme === 'dark' ? 'dark' : 'light', lang: Q.lang || 'es' };
    localStorage.setItem('eventos_settings_' + TENANT, JSON.stringify(settings));
    localStorage.removeItem('eventos_lastview_' + TENANT);
    // El asistente de bienvenida taparía la vista que queremos revisar.
    if (Q.tour !== '1') localStorage.setItem('eventos_welcome_tour_' + TENANT, 'done');
    if (Q.theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { }
})();
