window.EVENTOS_CONFIG = window.EVENTOS_CONFIG || {
  aiProxyUrl: 'https://nameless-breeze-1837.jltg90.workers.dev',
  convexUrl: 'https://descriptive-ibis-559.convex.cloud',
  buildVersion: '20260821-1',

  // ─── Clerk ────────────────────────────────────────────────────────────────
  // Pega aqui tu Publishable Key del dashboard de Clerk (API Keys).
  // Empieza con pk_test_ (desarrollo) o pk_live_ (produccion).  Es PUBLICA: va
  // en el navegador a proposito, no es un secreto.
  //
  // La URL del Frontend API se deduce sola de la propia llave, asi que este es
  // el unico valor que hay que tocar.  Si por lo que sea necesitas fijarla a
  // mano (dominio propio, proxy), pon clerkFrontendApi: 'clerk.tudominio.com'.
  clerkPublishableKey: 'pk_test_c3VpdGFibGUtb3J5eC00NjIzLmNsZXJrLmFjY291bnRzLmRldiQ',
  clerkFrontendApi: ''
};

// Deduce el host del Frontend API a partir de la publishable key.
// Formato: pk_(test|live)_<base64 del host + '$'>
window.EVENTOS_CONFIG.resolveClerkFapi = function(){
  var cfg = window.EVENTOS_CONFIG;
  if(cfg.clerkFrontendApi) return cfg.clerkFrontendApi.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  var pk = cfg.clerkPublishableKey || '';
  var m = pk.match(/^pk_(?:test|live)_(.+)$/);
  if(!m) return '';
  try{
    return atob(m[1]).replace(/\$+$/, '');
  }catch(e){
    return '';
  }
};
