var LANG = 'es';

/**
 * Convierte 'YYYY-MM-DD' en un Date LOCAL al mediodia.
 *
 * `new Date('2026-07-01')` se interpreta como medianoche UTC, que en UTC-6 (Mexico)
 * es el 30 de junio a las 18:00.  Eso hacia que un evento del dia 1 cayera en el mes
 * anterior en las graficas y que una tarea con vencimiento HOY apareciera vencida
 * todo el dia.  El mediodia deja 12 h de margen en ambos sentidos, asi que la fecha
 * civil se conserva en cualquier zona horaria del planeta.
 *
 * Los valores que ya traen hora (ISO completo) se pasan tal cual.
 */
function parseLocalDate(s){
  if(s instanceof Date) return s;
  if(typeof s !== 'string' || !s) return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Medianoche local de la fecha civil representada por `s`. */
function startOfLocalDay(s){
  var d = parseLocalDate(s);
  if(!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Date -> 'YYYY-MM-DD' usando la fecha LOCAL.
 * `toISOString().slice(0,10)` convierte a UTC primero, asi que un Date creado como
 * medianoche local (o 23:59:59) devolvia el dia anterior o el siguiente segun la
 * zona horaria del usuario.
 */
function toLocalYMD(d){
  if(!(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

/** true si la tarea esta vencida segun la fecha civil local (no segun UTC). */
function isTaskOverdue(tk){
  if(!tk || tk.done || !tk.dueDate) return false;
  var due = startOfLocalDay(tk.dueDate);
  if(!due) return false;
  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return due < todayStart;
}
var CURRENCY={code:'USD',symbol:'$',name:'US Dollar'};
var DATE_FORMAT = 'DMY';
var WEEK_START = 0;
var DEFAULT_OUTLINE_OFFSET = 1.30;
var THEME = 'light';
var CURRENCIES=[
  {code:'USD',symbol:'$',  name:'US Dollar'},
  {code:'EUR',symbol:'\u20AC',  name:'Euro'},
  {code:'MXN',symbol:'$',  name:'Mexican Peso'},
  {code:'GBP',symbol:'\u00A3',  name:'British Pound'},
  {code:'CAD',symbol:'$',  name:'Canadian Dollar'},
  {code:'ARS',symbol:'$',  name:'Argentine Peso'},
  {code:'COP',symbol:'$',  name:'Colombian Peso'},
  {code:'BRL',symbol:'R$', name:'Brazilian Real'},
  {code:'CLP',symbol:'$',  name:'Chilean Peso'},
  {code:'PEN',symbol:'S/',  name:'Peruvian Sol'},
  {code:'JPY',symbol:'\u00A5',  name:'Japanese Yen'},
  {code:'AUD',symbol:'$',  name:'Australian Dollar'},
  {code:'CHF',symbol:'Fr',  name:'Swiss Franc'},
];
// Moneda por defecto del usuario (se guarda en settings).  Cada proyecto puede
// sobreescribirla con su propio `currency`.
var DEFAULT_CURRENCY = { code:'USD', symbol:'$', name:'US Dollar' };

function findCurrency(code){
  return CURRENCIES.find(function(cu){ return cu.code === code; }) || null;
}

// Locale de formato ligado al idioma activo: antes estaba fijo en 'en-US'.
function currencyLocale(){ return (typeof LANG !== 'undefined' && LANG === 'es') ? 'es-MX' : 'en-US'; }

function formatCost(n){
  var num=parseFloat(n)||0;
  return CURRENCY.symbol+num.toLocaleString(currencyLocale(),{minimumFractionDigits:0,maximumFractionDigits:2});
}

// Aplica la moneda del proyecto (o la del usuario si el proyecto no tiene una).
// Se llama al abrir un proyecto y al volver a la lista de eventos.
function applyProjectCurrency(p){
  var found = (p && p.currency && findCurrency(p.currency.code)) || findCurrency(DEFAULT_CURRENCY.code) || CURRENCIES[0];
  CURRENCY = found;
  updateCurrencyLabels();
}

function updateCurrencyLabels(){
  var lbl=document.getElementById('currency-label');
  if(lbl) lbl.textContent = CURRENCY.code;
  var mob=document.getElementById('mob-currency-label');
  if(mob) mob.textContent = t('currency') + ': ' + CURRENCY.symbol + ' ' + CURRENCY.code;
}

function openCurrencyPicker(){
  var opts=CURRENCIES.map(function(cu){return '<option value="'+cu.code+'" '+(CURRENCY.code===cu.code?'selected':'')+'>'+cu.symbol+' '+cu.code+' - '+cu.name+'</option>';}).join('');
  var scope = (typeof proj==='function' && proj()) ? t('currency_scope_project') : t('currency_scope_default');
  openMo('<div class="mo-title">💱 '+esc(t('currency'))+'</div><p class="s-hint">'+esc(scope)+'</p><div class="ig"><label>'+esc(t('currency'))+'</label><select class="input" id="currency-sel" style="font-size:13px">'+opts+'</select></div><div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+esc(t('cancel'))+'</button><button class="btn btn-primary" onclick="applyCurrency()">'+esc(t('apply'))+'</button></div>');
}
function applyCurrency(){
  var sel=document.getElementById('currency-sel');if(!sel)return;
  var found=findCurrency(sel.value);if(!found)return;
  CURRENCY=found;
  var p=(typeof proj==='function') ? proj() : null;
  if(p){ p.currency=found; saveProj(p); }
  else { DEFAULT_CURRENCY=found; }
  // Persistir SIEMPRE la eleccion como default del usuario: antes no se guardaba
  // en ningun lado y se perdia en cada recarga.
  DEFAULT_CURRENCY=found;
  saveSettings();
  updateCurrencyLabels();
  closeMo();
  var page=document.querySelector('.pg:not(.hidden)');
  if(page&&page.id==='pg-project'){var active=document.querySelector('.ptab.active');if(active){var tab=active.dataset.tab;var fns={dashboard:renderDash,budget:renderBudget,timeline:renderTimeline,guests:renderGuests,layout:renderLayout,moodboard:renderMoodboard};if(fns[tab])fns[tab]();}}
  else if(page&&page.id==='pg-analytics'&&typeof renderAnalytics==='function') renderAnalytics();
  else if(page&&page.id==='pg-events'&&typeof renderEvents==='function') renderEvents();
  toast(t('currency')+': '+found.code+' ('+found.symbol+')','s');
}

var TRANSLATIONS = {
  en: {
    'back_to_events': 'Back to Events',
    'my_events': 'My Events',
    'sign_out': 'Sign Out',
    'signed_out': 'Signed out',
    'save': 'Save',
    'cancel': 'Cancel',
    'apply': 'Apply',
    'currency': 'Currency',
    'currency_scope_project': 'Currency used for all prices in this event.',
    'currency_scope_default': 'Default currency for new events.',
    'delete': 'Delete',
    'edit': 'Edit',
    'close': 'Close',
    'add': 'Add',
    'yes': 'Yes',
    'no': 'No',
    'loading': 'Loading...',
    'confirm_delete': 'Are you sure?',
    'tab_dashboard': 'Dashboard',
    'nav_dashboard': 'Dashboard',
    'nav_events': 'Events',
    'nav_vendors': 'Vendors',
    'nav_tasks': 'Tasks',
    'nav_guests': 'Guests',
    'nav_layouts': 'Layouts',
    'nav_moodboard': 'Moodboard',
    'nav_analytics': 'Analytics',
    'nav_library': 'My Library',
    'nav_section_events': 'Library',
    'nav_section_more': 'More',
    'tab_budget': 'Budget',
    'tab_timeline': 'Timeline',
    'tab_guests': 'Guests',
    'tab_layout': 'Layout',
    'tab_moodboard': 'Moodboard',
    'tab_viewer3d': '3D Viewer',
    'my_events_title': 'My Events',
    'create_event': 'Create Event',
    'no_events': 'No events yet. Create your first event!',
    'planning': 'Planning',
    'confirmed': 'Confirmed',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'edit_event': 'Edit Event',
    'days_away': 'days away',
    'today': 'Today!',
    'budget_progress': 'Budget Progress',
    'tasks_completed': 'Tasks Completed',
    'event_total_budget': 'Total Event Budget',
    'approved_budget': 'Approved budget',
    'estimated_cost': 'Estimated Cost (All Vendors)',
    'of_approved': 'of approved',
    'actual_paid': 'Actual Paid',
    'budget_variance': 'Budget Variance',
    'under_budget': '✓ Under Budget',
    'over_budget': '⚠ Over Budget',
    'sort_by': 'Sort',
    'sort_name': 'Name',
    'sort_date': 'Date',
    'sort_type': 'Type',
    'sort_location': 'Location',
    'sort_budget': 'Budget',
    'sort_created': 'Created Date',
    'view_grid': 'Grid',
    'view_list': 'List',
    'analytics_title': 'Analytics',
    'analytics_sub': 'Insights across all your events',
    'period_1m': '1 Month',
    'period_3m': '3 Months',
    'period_6m': '6 Months',
    'period_1y': '1 Year',
    'period_thisyear': 'This Year',
    'period_next1y': 'Next 12 mo',
    'period_alltime': 'All Time',
    'period_custom': 'Custom',
    'filter_all_dates': 'All Dates',
    'filter_date_range': 'Date Range',
    'lib_title': 'My Library',
    'lib_sub': 'Save and reuse vendors, tasks, layouts and more across projects',
    'lib_vendors': 'Vendors',
    'lib_tasks': 'Tasks',
    'lib_layouts': 'Layouts',
    'lib_tables': 'Tables',
    'lib_elements': 'Elements',
    'lib_chairs': 'Chairs',
    'lib_centerpieces': 'Centerpieces',
    'lib_moodboards': 'Moodboards',
    'lib_save_to': 'Save to Library',
    'lib_load_from': 'Load from Library',
    'lib_empty': 'Nothing saved here yet',
    'lib_empty_sub': 'Save items from any project to reuse them here',
    'lib_saved': 'Saved to library',
    'lib_loaded': 'Loaded into project',
    'lib_delete_confirm': 'Remove from library?',
    'lib_save_name': 'Name for this library entry',
    'lib_save_btn': 'Save to Library',
    'lib_load_btn': 'Load into Project',
    'lib_add_vendor': 'Save Vendors',
    'lib_add_task': 'Save Tasks',
    'lib_add_layout': 'Save Layout',
    'lib_add_moodboard': 'Save Moodboard',
    'lib_add_types': 'Save Types',
    'lib_select_to_save': 'Select items to save:',
    'lib_select_all': 'Select All',
    'analytics_events': 'Events in Period',
    'analytics_avg_budget': 'Avg Budget',
    'analytics_avg_guests': 'Avg Guests',
    'analytics_top_vendors': 'Top Vendor Categories',
    'analytics_by_type': 'Events by Type',
    'analytics_by_status': 'Events by Status',
    'analytics_timeline': 'Event Timeline',
    'analytics_no_data': 'No events in this period',
    'export_pdf_title': 'Export Event PDF',
    'export_pdf_select': 'Select sections to include:',
    'export_pdf_generate': 'Generate PDF',
    'export_pdf_cancel': 'Cancel',
    'section_dashboard': 'Overview & Details',
    'section_budget': 'Budget & Vendors',
    'section_timeline': 'Task Timeline',
    'section_guests': 'Guest List',
    'section_layout': 'Event Layouts',
    'section_moodboard': 'Moodboard',
    'guests_confirmed': 'Guests Confirmed',
    'vendors_hired': 'Vendors Hired',
    'budget_label': 'Budget',
    'paid': 'Paid',
    'balance': 'Balance',
    'add_vendor': 'Add Vendor',
    'add_task': 'Add Task',
    'quick_actions': 'Quick Actions',
    'upcoming_tasks': 'Upcoming Tasks',
    'no_tasks': 'No upcoming tasks',
    'budget_management': 'Budget Management',
    'hired_vendors': 'Hired Vendors',
    'comparisons': 'Comparisons',
    'no_hired_vendors': 'No hired vendors yet.',
    'no_comparison_vendors': 'No comparison vendors yet.',
    'view_details': 'View Details',
    'hire': 'Hire',
    'unhire': 'Unhire',
    'hired': 'Hired',
    'services': 'Services',
    'budget_estimate': 'Budget Estimate',
    'contact': 'Contact',
    'phone': 'Phone',
    'notes': 'Notes',
    'add_payment': 'Add Payment',
    'comparison': 'Comparison',
    'timeline': 'Timeline & Calendar',
    'gantt_view': 'Gantt Chart',
    'calendar_view': 'Calendar',
    'list_view': 'Task List',
    'add_task_btn': 'Add Task',
    'no_tasks_yet': 'No tasks yet',
    'no_tasks_found': 'No tasks match your search',
    'search_tasks': 'Search tasks...',
    'task': 'Task',
    'due_date': 'Due Date',
    'assignee': 'Assignee',
    'done': 'Done',
    'overdue': 'Overdue',
    'pending': 'Pending',
    'guest_management': 'Guest Management',
    'add_guest': 'Add Guest',
    'import_excel': 'Import Excel',
    'export_list': 'Export List',
    'name': 'Name',
    'email': 'Email',
    'category': 'Category',
    'rsvp': 'RSVP',
    'table_num': 'Table #',
    'meal': 'Meal',
    'dietary': 'Dietary',
    'plus_one': '+1',
    'all_guests': 'All Guests',
    'confirmed_guests': 'Confirmed',
    'declined': 'Declined',
    'pending_guests': 'Pending',
    'total_guests': 'Total Guests',
    'layout_designer': 'Seating Designer',
    'tables': 'Tables',
    'event_elements': 'Event Elements',
    'controls': 'Controls',
    'snap_grid': 'Snap Grid',
    'grid_size': 'Grid Size (px)',
    'select_all': 'Select All',
    'clear_all': 'Clear All',
    'quick_create': 'Quick Create',
    'table_type': 'Table Type',
    'num_tables': '# Tables',
    'num_chairs': '# Chairs',
    'columns': 'Columns',
    'spacing': 'Spacing (m)',
    'create_tables': '⚡ Create Tables',
    'properties': 'Properties',
    'label': 'Label',
    'width': 'Width',
    'height': 'Height',
    'seats': 'Seats',
    'fill': 'Fill',
    'label_color': 'Label Color',
    'chair_style': 'Chair Style',
    'centerpiece': 'Centerpiece',
    'cost': 'Cost ($)',
    'items': 'Items',
    'legend': 'Legend',
    'chair_styles': 'Chair Styles',
    'centerpieces': 'Centerpieces',
    'chairs_section': 'Chairs',
    'centrepieces_section': 'Centerpieces',
    'floorplan_section': '🗺️ Floorplan',
    'create_general_layout': 'Create General Layout',
    'layout_quote_title': 'Layout Quote',
    'layout_quote_sub': 'Auto-priced from the layout plus custom extras',
    'layout_quote_empty': 'No priced items yet',
    'layout_quote_empty_sub': 'Add layout items or custom extras to build the quote.',
    'layout_quote_open': 'Open Quote',
    'layout_quote_hide': 'Hide Quote',
    'layout_quote_show': 'Show Quote',
    'layout_quote_add_custom': 'Add Custom Item',
    'layout_quote_auto': 'Layout Items',
    'layout_quote_custom': 'Custom Items',
    'layout_quote_base': 'Base Price',
    'layout_quote_chair_cost': 'Chair Cost',
    'layout_quote_centerpiece_cost': 'Centerpiece Cost',
    'layout_quote_unit_total': 'Unit Total',
    'layout_quote_seats_unit': 'Seats/Unit',
    'layout_quote_row_total': 'Subtotal',
    'layout_quote_unit_price': 'Unit Price',
    'layout_quote_quantity': 'Qty',
    'layout_quote_item': 'Item',
    'layout_quote_actions': 'Actions',
    'layout_quote_custom_name': 'Custom item',
    'layout_quote_custom_category': 'Category',
    'layout_quote_notes': 'Notes',
    'properties': 'Properties',
    'measure_distances': 'Measure distances',
    'save_layout': '💾 Save Layout',
    'layouts': '📐 Layouts',
    'export': '📄 Export',
    'round_table': 'Round Table',
    'rect_table': 'Rectangular Table',
    'oval_table': 'Oval Table',
    'head_table': 'Head / Sweetheart Table',
    'dance_floor': 'Dance Floor',
    'bar_buffet': 'Bar / Buffet',
    'stage': 'Stage / Podium',
    'gift_table': 'Gift Table',
    'photo_booth': 'Photo Booth',
    'align': 'Align',
    'delete_selected': 'Delete',
    'moodboard_library': 'Moodboard Library',
    'images': 'images',
    'folders': 'folders',
    'add_images': 'Add Images',
    'new_folder': 'New Folder',
    'uncategorized': 'Uncategorized',
    'move_to_folder': 'Move to folder',
    'delete_image': 'Delete Image',
    'delete_folder': 'Delete Folder',
    'edit_event_title': 'Edit Event',
    'create_event_title': 'Create Event',
    'event_name': 'Event Name',
    'client_name': 'Client',
    'event_date': 'Date',
    'event_type': 'Type',
    'location': 'Location',
    'description': 'Description',
    'total_budget': 'Total Budget',
    'status': 'Status',
    'manage_events': 'Manage all your event projects',
    'social_private': 'Social / Private',
    'corporate': 'Corporate',
    'community': 'Community',
    'government': 'Government',
    'education': 'Education',
    'recent_vendors': 'Recent Vendors',
    'no_vendors': 'No vendors yet',
    'create_event_hint': 'Create your first event to get started',
    'edit_vendor': 'Edit Vendor',
    'edit_guest': 'Edit Guest',
    'edit_task': 'Edit Task',
    'of': 'of',
    'total': 'total',
    'items': 'items',
    'floorplan': 'Floorplan',
    'calibrate_scale': 'Scale',
    'upload_floorplan': 'Upload Floorplan',
    'status_planning': 'To be Confirmed',
    'status_confirmed': 'Confirmed',
    'status_in_progress': 'In Progress',
    'status_completed': 'Completed',
    'status_cancelled': 'Cancelled',
    'type_social': 'Social / Private',
    'type_corporate': 'Corporate',
    'type_community': 'Community',
    'type_government': 'Government',
    'type_education': 'Education',
    'client': 'Client',
    'budget_used': 'Budget Used',
    'stat_vendors': 'Vendors',
    'stat_guests': 'Guests',
    'stat_event_date': 'Event Date',
    'hired_of': 'hired of',
    'total_guests_sub': 'total guests',
    'days_ago': 'days ago',
    'dash_total_budget': 'Total Budget',
    'dash_paid': 'Paid',
    'dash_remaining': 'Remaining',
    'dash_allocated': 'Allocated',
    'dash_unallocated': 'Unallocated',
    'dash_budget_overview': 'Budget Overview',
    'dash_budget_by_category': 'By Category',
    'dash_guests_total': 'Guests',
    'dash_plus_ones': 'Plus Ones',
    'dash_confirmed': 'Confirmed',
    'dash_pending': 'Pending',
    'dash_declined': 'Declined',
    'dash_vendors_hired': 'Vendors',
    'dash_tasks_progress': 'Tasks',
    'dash_overdue': 'overdue',
    'dash_tables': 'Tables',
    'dash_chairs': 'chairs',
    'dash_layout_summary': 'Layout',
    'dash_no_layout': 'No layout yet',
    'dash_complete': 'complete',
    'dash_hired': 'hired',
    'dash_of_budget': 'of budget',
    'dash_left': 'left',
    'dash_event_budget': 'event budget',
    'dash_today': 'Today',
    'onb_title': 'Get your event ready',
    'onb_steps_done': 'steps complete',
    'onb_dismiss': 'Dismiss',
    'onb_budget': 'Set event budget',
    'onb_vendors': 'Hire a vendor',
    'onb_timeline': 'Complete a task',
    'onb_guests': 'Add guests',
    'onb_layout': 'Design floor plan',
    'budget_management_title': 'Budget Management',
    'paid_label': 'Paid',
    'balance_label': 'Balance',
    'mark_as_hired': 'Mark as Hired',
    'add_payment_btn': 'Add Payment',
    'details_btn': 'Details',
    'payment_progress': 'Payment Progress',
    'payment_history': 'Payment History',
    'receipt_btn': 'Receipt',
    'vendor_name_lbl': 'Vendor Name',
    'sub_category': 'Sub-category',
    'services_lbl': 'Services',
    'contact_email': 'Contact Email',
    'budget_field': 'Budget ($)',
    'vendor_status': 'Status',
    'save_vendor': 'Save Vendor',
    'save_event': 'Save Event',
    'amount_field': 'Amount ($)',
    'date_field': 'Date',
    'note_field': 'Note',
    'upload_receipt': 'Click to upload image',
    'add_payment_save': 'Add Payment',
    'timeline_sub': 'Gantt · Task List · Calendar',
    'total_tasks': 'Total Tasks',
    'completed_tasks': 'Completed',
    'overdue_tasks': 'Overdue',
    'progress': 'Progress',
    'tasks_lbl': 'tasks',
    'overdue_lbl': 'Overdue',
    'tasks_overdue_sub': 'tasks overdue',
    'tasks_sub': 'tasks',
    'unassigned': 'Unassigned',
    'task_title_lbl': 'Task Title',
    'description_lbl': 'Description',
    'due_date_lbl': 'Due Date',
    'color_label_lbl': 'Color Label',
    'save_task': 'Save Task',
    'download_template': 'Download Template',
    'import_csv': 'Import CSV',
    'search_guests': 'Search guests...',
    'sort_rsvp': 'Sort: RSVP',
    'sort_table': 'Sort: Table',
    'sort_category': 'Sort: Category',
    'asc': '↑ Asc',
    'desc': '↓ Desc',
    'col_name': 'Name',
    'col_contact': 'Contact',
    'col_category': 'Category',
    'col_rsvp': 'RSVP',
    'col_table': 'Table',
    'col_plus_one': '+1',
    'col_meal': 'Meal',
    'col_notes': 'Notes',
    'col_actions': 'Actions',
    'no_guests_found': 'No guests found',
    'full_name': 'Full Name',
    'rsvp_status': 'RSVP Status',
    'rsvp_confirmed': 'Confirmed',
    'rsvp_declined': 'Declined',
    'table_number': 'Table Number',
    'plus_one_q': 'Plus One?',
    'meal_pref': 'Meal Preference',
    'dietary_rest': 'Dietary Restrictions',
    'save_guest': 'Save Guest',
    'tables_count': 'Tables',
    'seated_count': 'Seated',
    'table_header': 'Table',
    'guests_lbl': 'guests',
    'floorplan_lbl': '🗺️ Floorplan',
    'upload_floorplan_lbl': 'Upload Floorplan',
    'items_count': 'Items',
    'tables_lbl': 'tables',
    'chairs_lbl': 'chairs',
    'rotate_lbl': 'Rotate',
    'edit_table_types': 'Edit Table Types',
    'edit_event_elements': 'Edit Event Elements',
    'edit_chairs': 'Chairs',
    'edit_centerpieces': 'Centerpieces',
    'col_name': 'Name',
    'col_shape': 'Shape',
    'col_chairs': 'Chairs',
    'col_price': 'Price',
    'col_color': 'Color',
    'col_photo': 'Photo',
    'shape_round': '⭕ Round',
    'shape_rect': '▬ Rect',
    'shape_square': '⬛ Square',
    'add_custom_table': '+ Add Custom Table',
    'add_custom_element': '+ Add Custom Element',
    'add_new_chair': '+ Add New Chair Style',
    'add_new_centerpiece': '+ Add New Centerpiece',
    'vcat_venue': 'Venue & Rentals',
    'vcat_food': 'Food & Beverage',
    'vcat_floral': 'Floral & Decor',
    'vcat_photo': 'Photography & Video',
    'vcat_entertainment': 'Entertainment & Music',
    'vcat_staffing': 'Staffing',
    'vcat_transport': 'Transportation',
    'vcat_admin': 'Admin & Compliance',
    'vcat_other': 'Other',
    'round_table_lbl': 'Round Table',
    'rect_table_lbl': 'Rect Table',
    'square_table_lbl': 'Square Table',
    'scroll_zoom': 'Scroll to zoom',
    'space_pan': 'Space+drag to pan',
    'drag_select': 'Drag on empty area to multi-select',
    'copy_paste': 'Ctrl+C / Ctrl+V to copy/paste',
    'del_remove': 'Del / Backspace to remove',
    'shift_drag_add': 'Shift+drag to add to selection',
    'ctrl_drag_remove': 'Ctrl+drag to deselect',
    'ctrl_click_desel': 'Ctrl+click to deselect item',
    'shift_click_add': 'Shift+click to add item',
    'opacity_lbl': 'Opacity',
    'moodboard_library_title': 'Moodboard Library',
    'new_folder_btn': 'New Folder',
    'add_to_root_btn': 'Add to Root',
    'main_menu_btn': 'Hide Menu',
    'export_pdf_btn': 'Export Event PDF',
    'create_folder_btn': 'Create Folder',
    'upload_images_btn': 'Upload Images',
    'no_images_yet': 'No images yet',
    'start_moodboard': 'Start your moodboard',
    'start_moodboard_sub': 'Create folders to organize your vision, or upload images directly',
    'add_label': 'Add label...',
    'saved': 'Saved',
    'deleted': 'Deleted',
    'error': 'Error',
    'updated': 'Updated',
    'settings': 'Settings',
    'settings_display': 'Display',
    'settings_defaults': 'Defaults',
    'settings_data': 'Data',
    'settings_language': 'Language',
    'settings_date_format': 'Date Format',
    'settings_theme': 'Theme',
    'settings_theme_light': 'Light',
    'settings_theme_dark': 'Dark',
    'settings_default_event_type': 'Default Event Type',
    'settings_default_event_type_none': 'None',
    'settings_default_guide_line': 'Default Guide Line (m)',
    'settings_export_data': 'Export Backup',
    'settings_export_data_desc': 'Download all your events as a single backup file.',
    'settings_import_data': 'Restore Backup',
    'settings_import_data_desc': 'Restore events from a previously exported backup file.',
    'settings_import_confirm': 'This will merge the backup data with your current events. Projects with the same ID will be overwritten. Continue?',
    'settings_import_success': 'Backup restored successfully!',
    'settings_about': 'About',
    'settings_version': 'Version',
    'settings_week_start': 'Week Starts On',
    'settings_sunday': 'Sunday',
    'settings_monday': 'Monday',
    // Error / validation messages
    'err_network': 'Network error. Check your connection and try again.',
    'saved': 'Saved',
    'err_save_failed': 'Failed to save. Please try again.',
    'err_upload_failed': 'File upload failed. Please try again.',
    'err_file_too_large': 'File is too large (max 10 MB).',
    'err_file_type': 'File type not supported.',
    'err_name_required': 'Name is required.',
    'err_client_required': 'Client name is required.',
    'err_date_required': 'Date is required.',
    'err_budget_negative': 'Budget cannot be negative.',
    'err_import_failed': 'Import failed. Check the file format.',
    'err_generic': 'Something went wrong. Please try again.',
    'loading': 'Loading...',
    'saving': 'Saving...',
    'uploading': 'Uploading...',
    'importing': 'Importing...',
    'exporting': 'Exporting...',
    'err_oversize': 'This event has too much data to save. Try removing some images or attachments.',
    'conflict_title': 'Account open elsewhere',
    'conflict_message': 'This account is open on another device, which may cause your changes to not be saved correctly. You can close all other sessions and continue working here.',
    'conflict_dismiss': 'Dismiss',
    'conflict_discard': 'Discard my changes',
    'conflict_overwrite': 'Keep my changes',
    'signin_title': 'Sign in to EventOS',
    'conflict_discarded': 'Your local changes were discarded and the server version was loaded.',
    'elements': 'Elements',
    'layout_total_seats': 'Total seats',
    'assigned_to': 'Assigned to',
    'conflict_close_sessions': 'Continue here & close other sessions',
    'conflict_sessions_closed': 'Other sessions closed. You can continue working here.',
    'sync_remote_update': 'This event was updated from another device. Your view has been refreshed.',
    'sync_project_deleted': 'This event was deleted from another device.',
    // Library module
    'lib_back': 'Back',
    'lib_add_vendor': 'Add Vendor',
    'lib_new_group': 'New Group',
    'lib_add_task': 'Add Task',
    'lib_new_layout': 'New Layout',
    'lib_upload_images': 'Upload Images',
    'lib_new_moodboard': 'New Moodboard',
    'lib_load': 'LOAD',
    'lib_delete_sel': 'Delete Selected',
    'lib_rename': 'Rename',
    'lib_name_col': 'Name',
    'lib_vendors_col': 'Vendors',
    'lib_categories_col': 'Categories',
    'lib_date_col': 'Date',
    'lib_no_vendor_groups': 'No vendor groups saved yet',
    'lib_no_vendor_groups_sub': 'Create a new group to organize your reusable vendors.',
    'lib_new_vendor_group': 'New Vendor Group',
    'lib_search_groups': 'Search groups or vendors...',
    'lib_vendors_title': 'Vendors',
    'lib_tasks_title': 'Tasks',
    'lib_layouts_title': 'Layouts',
    'lib_moodboards_title': 'Moodboards',
    'lib_migrated': 'Migrated',
    'lib_migrated_note': 'Auto-migrated from event',
    'lib_layout_not_found': 'Layout not found in library',
    'lib_export_failed': 'Could not export the layout',
    'lib_exported': 'Layout exported to event',
    'lib_name_exists': 'A layout with that name already exists',
    'lib_untitled': 'Untitled layout',
    'lib_groups_empty': 'Selected groups are empty',
    'lib_enter_name': 'Enter a name',
    'n_items': '{n} item | {n} items',
    'n_guests': '{n} guest | {n} guests',
    'n_vendors': '{n} vendor | {n} vendors',
    'n_tasks': '{n} task | {n} tasks',
  },
  es: {
    'back_to_events': 'Volver a Eventos',
    'my_events': 'Mis Eventos',
    'sign_out': 'Cerrar Sesión',
    'signed_out': 'Sesión cerrada',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'apply': 'Aplicar',
    'currency': 'Moneda',
    'currency_scope_project': 'Moneda usada para todos los precios de este evento.',
    'currency_scope_default': 'Moneda predeterminada para eventos nuevos.',
    'delete': 'Eliminar',
    'edit': 'Editar',
    'close': 'Cerrar',
    'add': 'Agregar',
    'yes': 'Sí',
    'no': 'No',
    'loading': 'Cargando...',
    'confirm_delete': '¿Estás seguro?',
    'tab_dashboard': 'Panel',
    'nav_dashboard': 'Panel',
    'nav_events': 'Eventos',
    'nav_vendors': 'Proveedores',
    'nav_tasks': 'Tareas',
    'nav_guests': 'Invitados',
    'nav_layouts': 'Layouts',
    'nav_moodboard': 'Moodboard',
    'nav_analytics': 'Estadísticas',
    'nav_library': 'Mi Biblioteca',
    'nav_section_events': 'Biblioteca',
    'nav_section_more': 'Más',
    'tab_budget': 'Presupuesto',
    'tab_timeline': 'Cronograma',
    'tab_guests': 'Invitados',
    'tab_layout': 'Diseño',
    'tab_moodboard': 'Moodboard',
    'tab_viewer3d': 'Vista 3D',
    'my_events_title': 'Mis Eventos',
    'create_event': 'Crear Evento',
    'no_events': '¡Aún no hay eventos. Crea tu primer evento!',
    'planning': 'Planificación',
    'confirmed': 'Confirmado',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
    'edit_event': 'Editar Evento',
    'days_away': 'días restantes',
    'today': '¡Hoy!',
    'budget_progress': 'Avance del Presupuesto',
    'tasks_completed': 'Tareas Completadas',
    'event_total_budget': 'Presupuesto Total del Evento',
    'approved_budget': 'Presupuesto aprobado',
    'estimated_cost': 'Costo Estimado (Todos los Proveedores)',
    'of_approved': 'del aprobado',
    'actual_paid': 'Pagado Real',
    'budget_variance': 'Variación de Presupuesto',
    'under_budget': '✓ Bajo Presupuesto',
    'over_budget': '⚠ Sobre Presupuesto',
    'sort_by': 'Ordenar',
    'sort_name': 'Nombre',
    'sort_date': 'Fecha',
    'sort_type': 'Tipo',
    'sort_location': 'Ubicación',
    'sort_budget': 'Presupuesto',
    'sort_created': 'Fecha de Creación',
    'view_grid': 'Cuadrícula',
    'view_list': 'Lista',
    'analytics_title': 'Analítica',
    'analytics_sub': 'Resumen de todos tus eventos',
    'period_1m': '1 Mes',
    'period_3m': '3 Meses',
    'period_6m': '6 Meses',
    'period_1y': '1 Año',
    'period_thisyear': 'Este Año',
    'period_next1y': 'Próximos 12 m',
    'period_alltime': 'Todo',
    'period_custom': 'Personalizado',
    'filter_all_dates': 'Todas las Fechas',
    'filter_date_range': 'Rango de Fechas',
    'lib_title': 'Mi Biblioteca',
    'lib_sub': 'Guarda y reutiliza proveedores, tareas, planos y más en diferentes proyectos',
    'lib_vendors': 'Proveedores',
    'lib_tasks': 'Tareas',
    'lib_layouts': 'Layouts',
    'lib_tables': 'Mesas',
    'lib_elements': 'Elementos',
    'lib_chairs': 'Sillas',
    'lib_centerpieces': 'Centros de Mesa',
    'lib_moodboards': 'Moodboards',
    'lib_save_to': 'Guardar en Biblioteca',
    'lib_load_from': 'Cargar desde Biblioteca',
    'lib_empty': 'Nada guardado aquí aún',
    'lib_empty_sub': 'Guarda elementos de cualquier proyecto para reutilizarlos aquí',
    'lib_saved': 'Guardado en biblioteca',
    'lib_loaded': 'Cargado en el proyecto',
    'lib_delete_confirm': '¿Eliminar de la biblioteca?',
    'lib_save_name': 'Nombre para esta entrada de biblioteca',
    'lib_save_btn': 'Guardar en Biblioteca',
    'lib_load_btn': 'Cargar en Proyecto',
    'lib_add_vendor': 'Guardar Proveedores',
    'lib_add_task': 'Guardar Tareas',
    'lib_add_layout': 'Guardar Plano',
    'lib_add_moodboard': 'Guardar Moodboard',
    'lib_add_types': 'Guardar Tipos',
    'lib_select_to_save': 'Selecciona elementos a guardar:',
    'lib_select_all': 'Seleccionar Todo',
    'analytics_events': 'Eventos en el Período',
    'analytics_avg_budget': 'Presupuesto Promedio',
    'analytics_avg_guests': 'Invitados Promedio',
    'analytics_top_vendors': 'Categorías de Proveedores Más Usadas',
    'analytics_by_type': 'Eventos por Tipo',
    'analytics_by_status': 'Eventos por Estado',
    'analytics_timeline': 'Línea de Tiempo de Eventos',
    'analytics_no_data': 'Sin eventos en este período',
    'export_pdf_title': 'Exportar PDF del Evento',
    'export_pdf_select': 'Seleccionar secciones a incluir:',
    'export_pdf_generate': 'Generar PDF',
    'export_pdf_cancel': 'Cancelar',
    'section_dashboard': 'Resumen y Detalles',
    'section_budget': 'Presupuesto y Proveedores',
    'section_timeline': 'Cronograma de Tareas',
    'section_guests': 'Lista de Invitados',
    'section_layout': 'Planos del Evento',
    'section_moodboard': 'Tablero de Inspiración',
    'guests_confirmed': 'Invitados Confirmados',
    'vendors_hired': 'Proveedores Contratados',
    'budget_label': 'Presupuesto',
    'paid': 'Pagado',
    'balance': 'Saldo',
    'add_vendor': 'Agregar Proveedor',
    'add_task': 'Agregar Tarea',
    'quick_actions': 'Acciones Rápidas',
    'upcoming_tasks': 'Próximas Tareas',
    'no_tasks': 'Sin tareas próximas',
    'budget_management': 'Gestión de Presupuesto',
    'hired_vendors': 'Proveedores Contratados',
    'comparisons': 'Comparaciones',
    'no_hired_vendors': 'Aún no hay proveedores contratados.',
    'no_comparison_vendors': 'Aún no hay proveedores en comparación.',
    'view_details': 'Ver Detalles',
    'hire': 'Contratar',
    'unhire': 'Descontratar',
    'hired': 'Contratado',
    'services': 'Servicios',
    'budget_estimate': 'Estimado de Presupuesto',
    'contact': 'Contacto',
    'phone': 'Teléfono',
    'notes': 'Notas',
    'add_payment': 'Agregar Pago',
    'comparison': 'Comparación',
    'timeline': 'Cronograma y Calendario',
    'gantt_view': 'Diagrama Gantt',
    'calendar_view': 'Calendario',
    'list_view': 'Lista de Tareas',
    'add_task_btn': 'Agregar Tarea',
    'no_tasks_yet': 'Sin tareas aún',
    'task': 'Tarea',
    'due_date': 'Fecha Límite',
    'assignee': 'Responsable',
    'done': 'Hecho',
    'overdue': 'Vencido',
    'pending': 'Pendiente',
    'guest_management': 'Gestión de Invitados',
    'add_guest': 'Agregar Invitado',
    'import_excel': 'Importar Excel',
    'export_list': 'Exportar Lista',
    'name': 'Nombre',
    'email': 'Correo',
    'category': 'Categoría',
    'rsvp': 'RSVP',
    'table_num': 'Mesa #',
    'meal': 'Menú',
    'dietary': 'Dieta',
    'plus_one': '+1',
    'all_guests': 'Todos',
    'confirmed_guests': 'Confirmados',
    'declined': 'Rechazados',
    'pending_guests': 'Pendientes',
    'total_guests': 'Total Invitados',
    'layout_designer': 'Diseñador de Asientos',
    'tables': 'Mesas',
    'event_elements': 'Elementos del Evento',
    'controls': 'Controles',
    'snap_grid': 'Cuadrícula',
    'grid_size': 'Tamaño de Cuadrícula (px)',
    'select_all': 'Seleccionar Todo',
    'clear_all': 'Limpiar Todo',
    'quick_create': 'Creación Rápida',
    'table_type': 'Tipo de Mesa',
    'num_tables': '# Mesas',
    'num_chairs': '# Sillas',
    'columns': 'Columnas',
    'spacing': 'Espaciado (m)',
    'create_tables': '⚡ Crear Mesas',
    'properties': 'Propiedades',
    'label': 'Etiqueta',
    'width': 'Ancho',
    'height': 'Alto',
    'seats': 'Asientos',
    'fill': 'Color de Relleno',
    'label_color': 'Color de Texto',
    'chair_style': 'Estilo de Silla',
    'centerpiece': 'Centro de Mesa',
    'cost': 'Costo ($)',
    'items': 'Elementos',
    'legend': 'Leyenda',
    'chair_styles': 'Estilos de Silla',
    'centerpieces': 'Centros de Mesa',
    'chairs_section': 'Sillas',
    'centrepieces_section': 'Centros de Mesa',
    'floorplan_section': '🗺️ Plano',
    'create_general_layout': 'Crear Layout General',
    'layout_quote_title': 'Cotizacion del Layout',
    'layout_quote_sub': 'Precio automatico desde el layout mas extras manuales',
    'layout_quote_empty': 'Aun no hay elementos con precio',
    'layout_quote_empty_sub': 'Agrega elementos al layout o extras manuales para armar la cotizacion.',
    'layout_quote_open': 'Abrir Cotizacion',
    'layout_quote_hide': 'Ocultar Cotizacion',
    'layout_quote_show': 'Mostrar Cotizacion',
    'layout_quote_add_custom': 'Agregar Item Manual',
    'layout_quote_auto': 'Items del Layout',
    'layout_quote_custom': 'Items Manuales',
    'layout_quote_base': 'Precio Base',
    'layout_quote_chair_cost': 'Costo Sillas',
    'layout_quote_centerpiece_cost': 'Costo Centro',
    'layout_quote_unit_total': 'Total Unitario',
    'layout_quote_seats_unit': 'Asientos/Unidad',
    'layout_quote_row_total': 'Subtotal',
    'layout_quote_unit_price': 'Precio Unitario',
    'layout_quote_quantity': 'Cant.',
    'layout_quote_item': 'Item',
    'layout_quote_actions': 'Acciones',
    'layout_quote_custom_name': 'Item manual',
    'layout_quote_custom_category': 'Categoria',
    'layout_quote_notes': 'Notas',
    'properties': 'Propiedades',
    'measure_distances': 'Medir distancias',
    'save_layout': '💾 Guardar Diseño',
    'layouts': '📐 Layouts',
    'export': '📄 Exportar',
    'round_table': 'Mesa Redonda',
    'rect_table': 'Mesa Rectangular',
    'oval_table': 'Mesa Ovalada',
    'head_table': 'Mesa Principal / de Honor',
    'dance_floor': 'Pista de Baile',
    'bar_buffet': 'Bar / Buffet',
    'stage': 'Escenario / Pódium',
    'gift_table': 'Mesa de Regalos',
    'photo_booth': 'Cabina de Fotos',
    'align': 'Alinear',
    'delete_selected': 'Eliminar',
    'moodboard_library': 'Biblioteca de Inspiración',
    'images': 'imágenes',
    'folders': 'carpetas',
    'add_images': 'Agregar Imágenes',
    'new_folder': 'Nueva Carpeta',
    'uncategorized': 'Sin Categoría',
    'move_to_folder': 'Mover a carpeta',
    'delete_image': 'Eliminar Imagen',
    'delete_folder': 'Eliminar Carpeta',
    'edit_event_title': 'Editar Evento',
    'create_event_title': 'Crear Evento',
    'event_name': 'Nombre del Evento',
    'client_name': 'Cliente',
    'event_date': 'Fecha',
    'event_type': 'Tipo',
    'location': 'Lugar',
    'description': 'Descripción',
    'total_budget': 'Presupuesto Total',
    'status': 'Estado',
    'manage_events': 'Administra todos tus proyectos de eventos',
    'social_private': 'Social / Privado',
    'corporate': 'Corporativo',
    'community': 'Comunitario',
    'government': 'Gubernamental',
    'education': 'Educativo',
    'recent_vendors': 'Proveedores Recientes',
    'no_vendors': 'Aún no hay proveedores',
    'create_event_hint': 'Crea tu primer evento para comenzar',
    'edit_vendor': 'Editar Proveedor',
    'edit_guest': 'Editar Invitado',
    'edit_task': 'Editar Tarea',
    'of': 'de',
    'total': 'total',
    'items': 'elementos',
    'floorplan': 'Plano',
    'calibrate_scale': 'Escala',
    'upload_floorplan': 'Subir Plano',
    'status_planning': 'Por Confirmar',
    'status_confirmed': 'Confirmado',
    'status_in_progress': 'En Progreso',
    'status_completed': 'Completado',
    'status_cancelled': 'Cancelado',
    'type_social': 'Social / Privado',
    'type_corporate': 'Corporativo',
    'type_community': 'Comunitario',
    'type_government': 'Gubernamental',
    'type_education': 'Educativo',
    'client': 'Cliente',
    'budget_used': 'Presupuesto Usado',
    'stat_vendors': 'Proveedores',
    'stat_guests': 'Invitados',
    'stat_event_date': 'Fecha del Evento',
    'hired_of': 'contratados de',
    'total_guests_sub': 'invitados en total',
    'days_ago': 'días atrás',
    'dash_total_budget': 'Presupuesto Total',
    'dash_paid': 'Pagado',
    'dash_remaining': 'Restante',
    'dash_allocated': 'Asignado',
    'dash_unallocated': 'Sin asignar',
    'dash_budget_overview': 'Resumen de Presupuesto',
    'dash_budget_by_category': 'Por Categoría',
    'dash_guests_total': 'Invitados',
    'dash_plus_ones': 'Acompañantes',
    'dash_confirmed': 'Confirmados',
    'dash_pending': 'Pendientes',
    'dash_declined': 'Rechazados',
    'dash_vendors_hired': 'Proveedores',
    'dash_tasks_progress': 'Tareas',
    'dash_overdue': 'atrasadas',
    'dash_tables': 'Mesas',
    'dash_chairs': 'sillas',
    'dash_layout_summary': 'Plano',
    'dash_no_layout': 'Sin plano aún',
    'dash_complete': 'completadas',
    'dash_hired': 'contratados',
    'dash_of_budget': 'del presupuesto',
    'dash_left': 'restante',
    'dash_event_budget': 'presupuesto del evento',
    'dash_today': 'Hoy',
    'onb_title': 'Prepara tu evento',
    'onb_steps_done': 'pasos completados',
    'onb_dismiss': 'Cerrar',
    'onb_budget': 'Establecer presupuesto',
    'onb_vendors': 'Contratar proveedor',
    'onb_timeline': 'Completar una tarea',
    'onb_guests': 'Agregar invitados',
    'onb_layout': 'Diseñar plano',
    'budget_management_title': 'Gestión de Presupuesto',
    'paid_label': 'Pagado',
    'balance_label': 'Saldo',
    'mark_as_hired': 'Marcar como Contratado',
    'add_payment_btn': 'Agregar Pago',
    'details_btn': 'Detalles',
    'payment_progress': 'Progreso de Pago',
    'payment_history': 'Historial de Pagos',
    'receipt_btn': 'Recibo',
    'vendor_name_lbl': 'Nombre del Proveedor',
    'sub_category': 'Sub-categoría',
    'services_lbl': 'Servicios',
    'contact_email': 'Correo de Contacto',
    'budget_field': 'Presupuesto ($)',
    'vendor_status': 'Estado',
    'save_vendor': 'Guardar Proveedor',
    'save_event': 'Guardar Evento',
    'amount_field': 'Monto ($)',
    'date_field': 'Fecha',
    'note_field': 'Nota',
    'upload_receipt': 'Click para subir imagen',
    'add_payment_save': 'Agregar Pago',
    'timeline_sub': 'Gantt · Lista de Tareas · Calendario',
    'total_tasks': 'Total Tareas',
    'completed_tasks': 'Completadas',
    'overdue_tasks': 'Vencidas',
    'progress': 'Progreso',
    'tasks_lbl': 'tareas',
    'overdue_lbl': 'Vencida',
    'tasks_overdue_sub': 'Tareas Vencidas',
    'tasks_sub': 'Tareas',
    'unassigned': 'Sin asignar',
    'task_title_lbl': 'Título de Tarea',
    'description_lbl': 'Descripción',
    'due_date_lbl': 'Fecha Límite',
    'color_label_lbl': 'Etiqueta de Color',
    'save_task': 'Guardar Tarea',
    'download_template': 'Descargar Plantilla',
    'import_csv': 'Importar CSV',
    'search_tasks': 'Buscar tareas...',
    'no_tasks_found': 'No se encontraron tareas',
    'search_guests': 'Buscar invitados...',
    'sort_rsvp': 'Ordenar: RSVP',
    'sort_table': 'Ordenar: Mesa',
    'sort_category': 'Ordenar: Categoría',
    'asc': '↑ Asc',
    'desc': '↓ Desc',
    'col_name': 'Nombre',
    'col_contact': 'Contacto',
    'col_category': 'Categoría',
    'col_rsvp': 'RSVP',
    'col_table': 'Mesa',
    'col_plus_one': '+1',
    'col_meal': 'Menú',
    'col_notes': 'Notas',
    'col_actions': 'Acciones',
    'no_guests_found': 'No se encontraron invitados',
    'full_name': 'Nombre Completo',
    'rsvp_status': 'Estado RSVP',
    'rsvp_confirmed': 'Confirmado',
    'rsvp_declined': 'Rechazado',
    'table_number': 'Número de Mesa',
    'plus_one_q': '¿Acompañante?',
    'meal_pref': 'Preferencia de Menú',
    'dietary_rest': 'Restricciones Alimentarias',
    'save_guest': 'Guardar Invitado',
    'tables_count': 'Mesas',
    'seated_count': 'Sentados',
    'table_header': 'Mesa',
    'guests_lbl': 'invitados',
    'floorplan_lbl': '🗺️ Plano',
    'upload_floorplan_lbl': 'Subir Plano',
    'items_count': 'Elementos',
    'tables_lbl': 'mesas',
    'chairs_lbl': 'sillas',
    'rotate_lbl': 'Rotar',
    'edit_table_types': 'Editar Tipos de Mesa',
    'edit_event_elements': 'Editar Elementos del Evento',
    'edit_chairs': 'Sillas',
    'edit_centerpieces': 'Centros de Mesa',
    'col_name': 'Nombre',
    'col_shape': 'Forma',
    'col_chairs': 'Sillas',
    'col_price': 'Precio',
    'col_color': 'Color',
    'col_photo': 'Foto',
    'shape_round': '⭕ Redonda',
    'shape_rect': '▬ Rectangular',
    'shape_square': '⬛ Cuadrada',
    'add_custom_table': '+ Agregar Mesa Personalizada',
    'add_custom_element': '+ Agregar Elemento Personalizado',
    'add_new_chair': '+ Agregar Estilo de Silla',
    'add_new_centerpiece': '+ Agregar Centro de Mesa',
    'vcat_venue': 'Venue y Rentas',
    'vcat_food': 'Alimentos y Bebidas',
    'vcat_floral': 'Floral y Decoración',
    'vcat_photo': 'Fotografía y Video',
    'vcat_entertainment': 'Entretenimiento y Música',
    'vcat_staffing': 'Personal',
    'vcat_transport': 'Transporte',
    'vcat_admin': 'Administración y Permisos',
    'vcat_other': 'Otros',
    'round_table_lbl': 'Mesa Redonda',
    'rect_table_lbl': 'Mesa Rectangular',
    'square_table_lbl': 'Mesa Cuadrada',
    'scroll_zoom': 'Scroll para zoom',
    'space_pan': 'Espacio+arrastrar para mover',
    'drag_select': 'Arrastrar en área vacía para selección múltiple',
    'copy_paste': 'Ctrl+C / Ctrl+V para copiar/pegar',
    'del_remove': 'Supr / Retroceso para eliminar',
    'shift_drag_add': 'Shift+arrastrar para agregar a selección',
    'ctrl_drag_remove': 'Ctrl+arrastrar para deseleccionar',
    'ctrl_click_desel': 'Ctrl+clic para deseleccionar',
    'shift_click_add': 'Shift+clic para agregar a selección',
    'opacity_lbl': 'Opacidad',
    'moodboard_library_title': 'Biblioteca de Inspiración',
    'new_folder_btn': 'Nueva Carpeta',
    'add_to_root_btn': 'Agregar aquí',
    'main_menu_btn': 'Ocultar Menú',
    'export_pdf_btn': 'Exportar PDF del Evento',
    'create_folder_btn': 'Crear Carpeta',
    'upload_images_btn': 'Subir Imágenes',
    'no_images_yet': 'Sin imágenes aún',
    'start_moodboard': 'Comienza tu moodboard',
    'start_moodboard_sub': 'Crea carpetas para organizar tu visión, o sube imágenes directamente',
    'add_label': 'Agregar etiqueta...',
    'saved': 'Guardado',
    'deleted': 'Eliminado',
    'error': 'Error',
    'updated': 'Actualizado',
    'settings': 'Ajustes',
    'settings_display': 'Pantalla',
    'settings_defaults': 'Por defecto',
    'settings_data': 'Datos',
    'settings_language': 'Idioma',
    'settings_date_format': 'Formato de Fecha',
    'settings_theme': 'Tema',
    'settings_theme_light': 'Claro',
    'settings_theme_dark': 'Oscuro',
    'settings_default_event_type': 'Tipo de evento por defecto',
    'settings_default_event_type_none': 'Ninguno',
    'settings_default_guide_line': 'Línea guía por defecto (m)',
    'settings_export_data': 'Exportar respaldo',
    'settings_export_data_desc': 'Descarga todos tus eventos como un archivo de respaldo.',
    'settings_import_data': 'Restaurar respaldo',
    'settings_import_data_desc': 'Restaura eventos desde un archivo de respaldo previamente exportado.',
    'settings_import_confirm': 'Esto combinará los datos del respaldo con tus eventos actuales. Los proyectos con el mismo ID serán sobrescritos. ¿Continuar?',
    'settings_import_success': '¡Respaldo restaurado exitosamente!',
    'settings_about': 'Acerca de',
    'settings_version': 'Versión',
    'settings_week_start': 'Semana comienza en',
    'settings_sunday': 'Domingo',
    'settings_monday': 'Lunes',
    // Error / validation messages
    'err_network': 'Error de red. Verifica tu conexión e intenta de nuevo.',
    'saved': 'Guardado',
    'err_save_failed': 'No se pudo guardar. Intenta de nuevo.',
    'err_upload_failed': 'Error al subir archivo. Intenta de nuevo.',
    'err_file_too_large': 'Archivo demasiado grande (máx. 10 MB).',
    'err_file_type': 'Tipo de archivo no soportado.',
    'err_name_required': 'El nombre es obligatorio.',
    'err_client_required': 'El nombre del cliente es obligatorio.',
    'err_date_required': 'La fecha es obligatoria.',
    'err_budget_negative': 'El presupuesto no puede ser negativo.',
    'err_import_failed': 'Error al importar. Verifica el formato del archivo.',
    'err_generic': 'Algo salió mal. Intenta de nuevo.',
    'loading': 'Cargando...',
    'saving': 'Guardando...',
    'uploading': 'Subiendo...',
    'importing': 'Importando...',
    'exporting': 'Exportando...',
    'err_oversize': 'Este evento tiene demasiados datos para guardar. Intenta eliminar algunas imágenes o archivos adjuntos.',
    'conflict_title': 'Cuenta abierta en otro lugar',
    'conflict_message': 'Esta cuenta está abierta en otro dispositivo, lo que puede causar que tus cambios no se guarden correctamente. Puedes cerrar las otras sesiones y continuar trabajando aquí.',
    'conflict_dismiss': 'Cerrar',
    'conflict_discard': 'Descartar mis cambios',
    'conflict_overwrite': 'Conservar mis cambios',
    'signin_title': 'Entrar a EventOS',
    'conflict_discarded': 'Se descartaron tus cambios locales y se cargó la versión del servidor.',
    'elements': 'Elementos',
    'layout_total_seats': 'Asientos totales',
    'assigned_to': 'Asignado a',
    'conflict_close_sessions': 'Continuar aquí y cerrar otras sesiones',
    'conflict_sessions_closed': 'Otras sesiones cerradas. Puedes continuar trabajando aquí.',
    'sync_remote_update': 'Este evento fue actualizado desde otro dispositivo. Tu vista se ha actualizado.',
    'sync_project_deleted': 'Este evento fue eliminado desde otro dispositivo.',
    // Library module
    'lib_back': 'Volver',
    'lib_add_vendor': 'Agregar Proveedor',
    'lib_new_group': 'Nuevo Grupo',
    'lib_add_task': 'Agregar Tarea',
    'lib_new_layout': 'Nuevo Plano',
    'lib_upload_images': 'Subir Imágenes',
    'lib_new_moodboard': 'Nuevo Moodboard',
    'lib_load': 'CARGAR',
    'lib_delete_sel': 'Eliminar',
    'lib_rename': 'Renombrar',
    'lib_name_col': 'Nombre',
    'lib_vendors_col': 'Proveedores',
    'lib_categories_col': 'Categorías',
    'lib_date_col': 'Fecha',
    'lib_no_vendor_groups': 'No hay grupos de proveedores guardados',
    'lib_no_vendor_groups_sub': 'Crea un nuevo grupo para organizar tus proveedores reutilizables.',
    'lib_new_vendor_group': 'Nuevo Grupo de Proveedores',
    'lib_search_groups': 'Buscar grupos o proveedores...',
    'lib_vendors_title': 'Proveedores',
    'lib_tasks_title': 'Tareas',
    'lib_layouts_title': 'Layouts',
    'lib_moodboards_title': 'Moodboards',
    'lib_migrated': 'Migrado',
    'lib_migrated_note': 'Migrado automáticamente desde el evento',
    'lib_layout_not_found': 'Layout no encontrado en biblioteca',
    'lib_export_failed': 'No se pudo exportar el layout',
    'lib_exported': 'Layout exportado al evento',
    'lib_name_exists': 'Ya existe un layout con ese nombre',
    'lib_untitled': 'Layout sin nombre',
    'lib_groups_empty': 'Los grupos seleccionados están vacíos',
    'lib_enter_name': 'Ingresa un nombre',
    'n_items': '{n} elemento | {n} elementos',
    'n_guests': '{n} invitado | {n} invitados',
    'n_vendors': '{n} proveedor | {n} proveedores',
    'n_tasks': '{n} tarea | {n} tareas',
  }
};

/* ═══════════════════════════════════════════════════════════════
   SETTINGS — load / save / modal / export / import
   ═══════════════════════════════════════════════════════════════ */

function _settingsKey(){ return 'eventos_settings_'+(DB.cur||'local'); }

function loadSettings(){
  try{
    var raw = localStorage.getItem(_settingsKey());
    if(raw){
      var s = JSON.parse(raw);
      if(s.lang==='en'||s.lang==='es') LANG = s.lang;
      if(s.dateFormat==='DMY'||s.dateFormat==='MDY') DATE_FORMAT = s.dateFormat;
      if(s.theme==='light'||s.theme==='dark') THEME = s.theme;
      if(typeof s.defaultEventType==='string') window._settingsDefaultEventType = s.defaultEventType;
      if(typeof s.defaultOutlineOffset==='number'&&s.defaultOutlineOffset>=0) DEFAULT_OUTLINE_OFFSET = s.defaultOutlineOffset;
      if(s.weekStart===0||s.weekStart===1) WEEK_START = s.weekStart;
      // La moneda no se persistia: se perdia en cada recarga.
      if(s.currencyCode){
        var savedCur = findCurrency(s.currencyCode);
        if(savedCur){ DEFAULT_CURRENCY = savedCur; CURRENCY = savedCur; }
      }
    } else {
      // Migrate legacy lang key
      try{
        var legacyLang = localStorage.getItem('eventos_lang_'+(DB.cur||'local'));
        if(legacyLang==='en'||legacyLang==='es') LANG = legacyLang;
      }catch(e2){}
    }
  }catch(e){ console.warn('EventOS: loadSettings failed', e); }
  _applyThemeClass();
  if(typeof updateCurrencyLabels === 'function') updateCurrencyLabels();
}

function saveSettings(){
  try{
    localStorage.setItem(_settingsKey(), JSON.stringify({
      lang: LANG,
      dateFormat: DATE_FORMAT,
      theme: THEME,
      defaultEventType: window._settingsDefaultEventType||'',
      defaultOutlineOffset: DEFAULT_OUTLINE_OFFSET,
      weekStart: WEEK_START,
      currencyCode: (DEFAULT_CURRENCY && DEFAULT_CURRENCY.code) || 'USD'
    }));
  }catch(e){ console.warn('EventOS: saveSettings failed', e); }
}

function _applyThemeClass(){
  if(THEME==='dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

function _settingsTab(name){
  ['display','defaults','data'].forEach(function(tab){
    var el=document.getElementById('stab-'+tab);
    var btn=document.getElementById('stab-btn-'+tab);
    if(el) el.style.display = tab===name?'block':'none';
    if(btn){ btn.classList.toggle('active',tab===name); }
  });
}

function openSettings(){
  var isES=LANG==='es';
  var langOpts='<option value="en" '+(LANG==='en'?'selected':'')+'>English</option>'
    +'<option value="es" '+(LANG==='es'?'selected':'')+'>Español</option>';
  var dfOpts='<option value="DMY" '+(DATE_FORMAT==='DMY'?'selected':'')+'>DD/MM/YYYY</option>'
    +'<option value="MDY" '+(DATE_FORMAT==='MDY'?'selected':'')+'>MM/DD/YYYY</option>';
  var themeLight=t('settings_theme_light'), themeDark=t('settings_theme_dark');
  var evTypes=[
    {v:'',l:t('settings_default_event_type_none')},
    {v:'social',l:t('type_social')},
    {v:'corporate',l:t('type_corporate')},
    {v:'community',l:t('type_community')},
    {v:'government',l:t('type_government')},
    {v:'education',l:t('type_education')}
  ];
  var defET=window._settingsDefaultEventType||'';
  var etOpts=evTypes.map(function(o){return '<option value="'+o.v+'" '+(defET===o.v?'selected':'')+'>'+o.l+'</option>';}).join('');
  var wsOpts='<option value="0" '+(WEEK_START===0?'selected':'')+'>'+t('settings_sunday')+'</option>'
    +'<option value="1" '+(WEEK_START===1?'selected':'')+'>'+t('settings_monday')+'</option>';
  var ver=(window.EVENTOS_CONFIG&&window.EVENTOS_CONFIG.buildVersion)||'—';

  var html='<div class="mo-title">'+t('settings')+'</div>'
    +'<div class="settings-tabs">'
    +'<button id="stab-btn-display" class="settings-tab active" onclick="_settingsTab(\'display\')">'+t('settings_display')+'</button>'
    +'<button id="stab-btn-defaults" class="settings-tab" onclick="_settingsTab(\'defaults\')">'+t('settings_defaults')+'</button>'
    +'<button id="stab-btn-data" class="settings-tab" onclick="_settingsTab(\'data\')">'+t('settings_data')+'</button>'
    +'</div>'

    // — Display tab —
    +'<div id="stab-display">'
    +'<div class="settings-row"><label>'+t('settings_language')+'</label><select class="input settings-control" id="set-lang" onchange="_setLang(this.value)">'+langOpts+'</select></div>'
    +'<div class="settings-row"><label>'+t('settings_date_format')+'</label><select class="input settings-control" id="set-df" onchange="_setDateFormat(this.value)">'+dfOpts+'</select></div>'
    +'<div class="settings-row"><label>'+t('settings_theme')+'</label>'
    +'<div class="theme-toggle">'
    +'<button class="theme-opt'+(THEME==='light'?' active':'')+'" onclick="_setTheme(\'light\')">'+themeLight+'</button>'
    +'<button class="theme-opt'+(THEME==='dark'?' active':'')+'" onclick="_setTheme(\'dark\')">'+themeDark+'</button>'
    +'</div></div>'
    +'</div>'

    // — Defaults tab —
    +'<div id="stab-defaults" style="display:none">'
    +'<div class="settings-row"><label>'+t('settings_default_event_type')+'</label><select class="input settings-control" id="set-et" onchange="_setDefaultEventType(this.value)">'+etOpts+'</select></div>'
    +'<div class="settings-row"><label>'+t('settings_default_guide_line')+'</label><input type="number" class="input settings-control" id="set-gl" value="'+DEFAULT_OUTLINE_OFFSET+'" min="0" max="3" step="0.05" onchange="_setDefaultGuideLine(this.value)"></div>'
    +'<div class="settings-row"><label>'+t('settings_week_start')+'</label><select class="input settings-control" id="set-ws" onchange="_setWeekStart(this.value)">'+wsOpts+'</select></div>'
    +'</div>'

    // — Data tab —
    +'<div id="stab-data" style="display:none">'
    +'<div class="settings-action">'
    +'<div><div class="settings-action-title">'+t('settings_export_data')+'</div>'
    +'<div class="settings-action-desc">'+t('settings_export_data_desc')+'</div></div>'
    +'<button class="btn btn-primary btn-sm" onclick="exportBackup()">'+t('settings_export_data')+'</button>'
    +'</div>'
    +'<div class="settings-action">'
    +'<div><div class="settings-action-title">'+t('settings_import_data')+'</div>'
    +'<div class="settings-action-desc">'+t('settings_import_data_desc')+'</div></div>'
    +'<button class="btn btn-ghost btn-sm" onclick="importBackup()">'+t('settings_import_data')+'</button>'
    +'</div>'
    +'<div class="settings-action">'
    +'<div><div class="settings-action-title">'+(isES?'Retroalimentación':'Feedback')+'</div>'
    +'<div class="settings-action-desc">'+(isES?'Ver reportes y sugerencias de usuarios':'View user reports and suggestions')+'</div></div>'
    +'<button class="btn btn-ghost btn-sm" onclick="closeMo();setTimeout(openFeedbackAdmin,200)">'+(isES?'Ver Feedback':'View Feedback')+'</button>'
    +'</div>'
    +'<div class="settings-about">'
    +'<div style="font-size:12px;color:var(--muted)">'+t('settings_version')+': <strong>'+ver+'</strong></div>'
    +'<div style="font-size:11px;color:var(--light);margin-top:4px">EventOS &copy; '+(new Date().getFullYear())+'</div>'
    +'</div>'
    +'</div>'

    +'<div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">'+t('close')+'</button></div>';

  openMo(html);
}

/* ── Setting change handlers ── */

function _setLang(val){
  if(val!=='en'&&val!=='es') return;
  LANG=val;
  saveSettings();
  saveLangPref();
  var btn=document.getElementById('lang-label'); if(btn) btn.textContent=LANG==='es'?'EN':'ES';
  applyTranslations();
  toast(LANG==='es'?'Idioma: Español':'Language: English','s');
  closeMo(); setTimeout(openSettings,150);
}

function _setDateFormat(val){
  if(val!=='DMY'&&val!=='MDY') return;
  DATE_FORMAT=val;
  saveSettings();
  toast(val==='DMY'?'DD/MM/YYYY':'MM/DD/YYYY','s');
}

function _setTheme(val){
  if(val!=='light'&&val!=='dark') return;
  THEME=val;
  _applyThemeClass();
  saveSettings();
  document.querySelectorAll('.theme-opt').forEach(function(b){
    b.classList.toggle('active',b.textContent.trim()===(val==='light'?t('settings_theme_light'):t('settings_theme_dark')));
  });
}

function _setDefaultEventType(val){
  window._settingsDefaultEventType=val;
  saveSettings();
}

function _setDefaultGuideLine(val){
  var n=parseFloat(val);
  if(isNaN(n)||n<0) n=0.90;
  DEFAULT_OUTLINE_OFFSET=n;
  saveSettings();
}

function _setWeekStart(val){
  WEEK_START=parseInt(val,10)||0;
  saveSettings();
}

/* ── Export / Import backup ── */

// Carga completa (incluyendo el documento companion project_extras) de TODOS los
// proyectos del usuario.  Sin esto el respaldo se llevaria stubs _metaOnly y arrays
// vacios para los proyectos grandes, produciendo un archivo que parece valido pero
// no tiene invitados, planos ni moodboard.
async function _hydrateAllProjectsForBackup(){
  var projects = DB.projects && DB.projects[DB.cur];
  if(!projects) return [];
  var pending = [];
  var pids = Object.keys(projects);
  for(var i=0;i<pids.length;i++){
    var pid = pids[i];
    if(pid === '__lib_layout__') continue;
    var p = projects[pid];
    if(p && p._metaOnly){
      if(typeof loadProjectById === 'function'){
        var loaded = await loadProjectById(pid);
        if(!loaded || loaded._metaOnly){ pending.push(pid); continue; }
        p = DB.projects[DB.cur][pid];
      } else { pending.push(pid); continue; }
    }
    if(p && p._hasExtras && !p._extrasLoaded && typeof _mergeProjectExtras === 'function'){
      await _mergeProjectExtras(pid, p);
      if(!p._extrasLoaded) pending.push(pid);
    }
  }
  return pending;
}

async function exportBackup(){
  try{
    var projects = DB.projects && DB.projects[DB.cur];
    if(!projects||!Object.keys(projects).length){
      toast(LANG==='es'?'No hay eventos para exportar':'No events to export','e');
      return;
    }
    toast(LANG==='es'?'Preparando respaldo…':'Preparing backup…');
    var incompletos = await _hydrateAllProjectsForBackup();
    if(incompletos.length){
      // Nunca escribimos un respaldo parcial en silencio: es peor que no tener respaldo.
      toast(LANG==='es'
        ? 'No se pudo descargar todo ('+incompletos.length+' evento(s)). Revisa tu conexion e intenta de nuevo.'
        : 'Could not load everything ('+incompletos.length+' event(s)). Check your connection and try again.','e');
      return;
    }
    projects = DB.projects[DB.cur];
    var limpio = {};
    Object.keys(projects).forEach(function(pid){
      if(pid === '__lib_layout__') return;
      var copia = JSON.parse(JSON.stringify(projects[pid]));
      // Banderas transitorias que no deben viajar en el archivo
      delete copia._metaOnly; delete copia._extrasLoaded; delete copia._extrasPending;
      delete copia._pendingSave; delete copia._expectedVersion; delete copia._hasExtras;
      limpio[pid] = copia;
    });
    var backup={
      _type:'eventos_backup',
      _version:1,
      _exportedAt:new Date().toISOString(),
      _userId:DB.cur||'unknown',
      projects: limpio
    };
    var blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download='EventOS-Backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(LANG==='es'?'Respaldo descargado':'Backup downloaded','s');
  }catch(e){
    console.error('exportBackup',e);
    toast(LANG==='es'?'Error al exportar':'Export failed','e');
  }
}

function importBackup(){
  var inp=document.createElement('input');
  inp.type='file';
  inp.accept='.json';
  inp.onchange=function(){
    var file=inp.files&&inp.files[0];
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(){
      try{
        var data=JSON.parse(reader.result);
        if(!data||data._type!=='eventos_backup'||!data.projects){
          toast(LANG==='es'?'Archivo no válido':'Invalid backup file','e');
          return;
        }
        // Rechaza archivos que solo traen stubs de metadata: restaurarlos borraria
        // los datos reales del proyecto en la nube.
        var pids = Object.keys(data.projects).filter(function(pid){ return pid !== '__lib_layout__'; });
        var stubs = pids.filter(function(pid){
          var p = data.projects[pid];
          return !p || typeof p !== 'object' || p._metaOnly === true || !p.id;
        });
        if(!pids.length || stubs.length){
          toast(LANG==='es'
            ? 'El respaldo esta incompleto ('+stubs.length+' evento(s) sin datos). No se restauro nada.'
            : 'This backup is incomplete ('+stubs.length+' event(s) have no data). Nothing was restored.','e');
          return;
        }
        openConfirmModal({
          title: LANG==='es' ? 'Restaurar respaldo' : 'Restore backup',
          message: t('settings_import_confirm'),
          confirmLabel: LANG==='es' ? 'Restaurar' : 'Restore',
          danger: true,
          onConfirm: function(){ _applyBackup(data, pids); }
        });
      }catch(e2){
        console.error('importBackup',e2);
        toast(LANG==='es'?'Error al restaurar':'Restore failed','e');
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

// Aplica un respaldo ya validado.  Se ejecuta solo tras la confirmacion del usuario.
function _applyBackup(data, pids){
  try{
    if(!DB.projects) DB.projects={};
    if(!DB.projects[DB.cur]) DB.projects[DB.cur]={};
    var imported=0;
    pids.forEach(function(pid){
      var p = JSON.parse(JSON.stringify(data.projects[pid]));
      // El id manda sobre la llave del objeto: evita escribir bajo una llave ajena.
      p.id = String(p.id);
      delete p._metaOnly; delete p._extrasLoaded; delete p._extrasPending;
      delete p._pendingSave; delete p._expectedVersion; delete p._hasExtras;
      DB.projects[DB.cur][p.id] = p;
      imported++;
    });
    if(typeof cacheDB==='function') cacheDB();
    pids.forEach(function(pid){
      var p=DB.projects[DB.cur][String(data.projects[pid].id)];
      if(p&&typeof saveProj==='function') saveProj(p);
    });
    if(typeof flushSave==='function') flushSave();
    toast(t('settings_import_success')+' ('+imported+')','s');
    closeMo();
    if(typeof showPage==='function') showPage('events');
  }catch(e){
    console.error('_applyBackup',e);
    toast(LANG==='es'?'Error al restaurar':'Restore failed','e');
  }
}
