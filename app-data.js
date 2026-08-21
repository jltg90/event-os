(function(){
  var EVENTOS_CONFIG = window.EVENTOS_CONFIG || {};
  var CONVEX_URL = (EVENTOS_CONFIG.convexUrl || "").replace(/\/+$/, "");

  // ─── Identidad ────────────────────────────────────────────────────────────
  //
  // Antes esta capa emitia y administraba un `sessionToken` propio que viajaba
  // como argumento en cada llamada, y lo renovaba a mano con el JWT de Wix.
  //
  // Ahora la identidad la lleva Clerk: pedimos un JWT corto con la plantilla
  // `convex` y lo mandamos en la cabecera Authorization.  Clerk cachea y renueva
  // solo, asi que desaparece toda la maquinaria de renovacion — y con ella el
  // problema de que un token guardado se quedara rancio.
  var CLERK_JWT_TEMPLATE = "convex";
  var _tenantId = null;

  function isConfigured(){
    return !!CONVEX_URL;
  }

  function getConfigErrorMessage(){
    return "Missing app configuration. Check app-config.js for convexUrl and reload.";
  }

  function _clerk(){
    return (typeof window !== "undefined" && window.Clerk) ? window.Clerk : null;
  }

  /**
   * JWT vigente de Clerk.  `skipCache` fuerza uno nuevo: se usa en el reintento
   * tras un 401, para el caso de que el cacheado acabe de expirar.
   */
  async function _getAuthToken(skipCache){
    var clerk = _clerk();
    if(!clerk || !clerk.session) return null;
    try{
      return await clerk.session.getToken({
        template: CLERK_JWT_TEMPLATE,
        skipCache: !!skipCache
      });
    }catch(e){
      console.warn("EventOS: could not get Clerk token", e);
      return null;
    }
  }

  function _isAuthError(err){
    var m = err && err.message ? String(err.message) : '';
    return m.indexOf('Unauthorized') !== -1 || m.indexOf('HTTP 401') !== -1;
  }

  // Envuelve _callConvexOnce con un reintento unico ante error de autenticacion:
  // si la sesion expiro (o fue revocada desde otro dispositivo) se renueva y se
  // repite la llamada, en vez de romper la app hasta que el usuario recargue.
  // Un unico reintento ante error de autenticacion, pidiendole a Clerk un token
  // fresco (skipCache).  Cubre el caso de que el token cacheado expire justo entre
  // que se construye la peticion y llega al servidor.
  async function callConvex(kind, path, args, options){
    try{
      return await _callConvexOnce(kind, path, args, options);
    }catch(err){
      if(!_isAuthError(err)) throw err;
      var fresh = await _getAuthToken(true);
      if(!fresh) throw err;
      return await _callConvexOnce(kind, path, args, options, fresh);
    }
  }

  async function _callConvexOnce(kind, path, args, options, forcedToken){
    if(!isConfigured()) throw new Error(getConfigErrorMessage());

    var token = forcedToken || await _getAuthToken(false);
    var fetchOptions = options || {};
    var body = JSON.stringify({
      path: path,
      args: args || {},
      format: "json"
    });

    // Guardado de emergencia (beforeunload / pagehide): sin `keepalive` el navegador
    // cancela el fetch al descargar la pagina y la escritura nunca llega.
    // El limite de keepalive es ~64 KB, asi que solo se usa cuando el cuerpo cabe;
    // para blobs mas grandes existe la recuperacion via localStorage en core.js.
    var KEEPALIVE_MAX_BYTES = 60000;
    var useKeepalive = !!fetchOptions.keepalive && body.length <= KEEPALIVE_MAX_BYTES;

    var headers = { "Content-Type": "application/json" };
    // Convex verifica este JWT contra convex/auth.config.ts y rellena
    // ctx.auth.getUserIdentity().  Ya no mandamos ningun token como argumento.
    if(token) headers["Authorization"] = "Bearer " + token;

    var reqInit = {
      method: "POST",
      headers: headers,
      body: body
    };
    if(useKeepalive){
      reqInit.keepalive = true;   // sin signal: un timeout abortaria el envio de salida
    } else {
      // Use caller's signal or create a 15-second timeout
      var signal = fetchOptions.signal;
      if(!signal && typeof AbortSignal !== 'undefined' && AbortSignal.timeout){
        signal = AbortSignal.timeout(15000);
      }
      reqInit.signal = signal;
    }
    var res = await fetch(CONVEX_URL + "/api/" + kind, reqInit);
    var payload = await res.json().catch(function(){ return null; });
    if(!res.ok){
      var errMsg = (payload && payload.errorMessage) ? payload.errorMessage : "status " + res.status;
      throw new Error("HTTP " + res.status + ": " + errMsg);
    }
    if(!payload || payload.status !== "success"){
      throw new Error(payload && payload.errorMessage ? payload.errorMessage : "Convex request failed");
    }
    return payload.value;
  }

  function normalizeProjectRows(rows){
    var projects = {};
    (rows || []).forEach(function(row){
      if(row && row.projectId && row.data){
        // Stamp version for optimistic locking on save
        row.data._expectedVersion = row.updatedAt;
        projects[row.projectId] = row.data;
      }
    });
    return projects;
  }

  function isBase64Image(s){
    return typeof s === 'string' && s.indexOf('data:image') === 0;
  }

  function base64ToBlob(dataUrl){
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    var binary = atob(parts[1] || '');
    var arr = new Uint8Array(binary.length);
    for(var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // Validate project data shape before saving — catches corruption early
  function validateProjectShape(p){
    if(!p || typeof p !== 'object') return 'Project must be an object';
    if(!p.id || typeof p.id !== 'string') return 'Project must have a string id';
    if(p.name !== undefined && typeof p.name !== 'string') return 'name must be a string';
    if(p.budget !== undefined && typeof p.budget !== 'number') return 'budget must be a number';
    if(p.vendors !== undefined && !Array.isArray(p.vendors)) return 'vendors must be an array';
    if(p.tasks !== undefined && !Array.isArray(p.tasks)) return 'tasks must be an array';
    if(p.guests !== undefined && !Array.isArray(p.guests)) return 'guests must be an array';
    if(p.layoutItems !== undefined && !Array.isArray(p.layoutItems)) return 'layoutItems must be an array';
    return null; // valid
  }

  // Strip resolved URLs / base64 from objects that have a storageId before saving to Convex.
  // The in-memory project keeps URLs for display; only the saved copy is cleaned.
  // Increment this when the project data shape changes and a migration is needed.
  var CURRENT_DATA_VERSION = 1;

  function prepareProjectForSave(p){
    var copy = JSON.parse(JSON.stringify(p));
    // Stamp the current data format version so future code can detect and migrate old projects
    copy._dataVersion = CURRENT_DATA_VERSION;
    // Transient in-memory flags — never persist to Convex
    delete copy._extrasLoaded;
    delete copy._pendingSave;
    delete copy._extrasPending;
    delete copy._fromCache;
    delete copy._migrating;
    // NOTE: _expectedVersion is intentionally kept in the blob — the server reads it
    // for optimistic-lock conflict detection.  It is deleted from the in-memory project
    // after each successful save (in core.js _executeSave) to prevent staleness.
    var mb = copy.moodboard;
    if(mb){
      var stripImg = function(img){
        if(img.storageId){ delete img.src; }
      };
      (mb.uncategorized || []).forEach(stripImg);
      (mb.folders || []).forEach(function(f){ (f.images || []).forEach(stripImg); });
    }
    (copy.vendors || []).forEach(function(v){
      (v.payments || []).forEach(function(pay){
        if(pay.receiptStorageId){ delete pay.receipt; }
      });
    });
    if(copy.floorplan && copy.floorplan._storageId){
      copy.floorplan.img = '__stored__';
      delete copy.floorplan.thumb;
    }
    // Also handle library layouts' floorplans
    (copy.layouts || []).forEach(function(entry){
      if(entry.floorplan && entry.floorplan._storageId){
        entry.floorplan.img = '__stored__';
        delete entry.floorplan.thumb;
      }
    });
    // Strip the layout snapshot image — it's a large SVG that can be regenerated from the
    // library entry on the next render.  Keep the rest of layoutExport (layoutId, summary, etc.)
    // so the viewer knows which library layout it came from.
    // Keep the image for "_detached" exports — those are self-contained snapshots of a
    // library layout that was deleted, so there is no source entry to regenerate them from.
    if(copy.layoutExport && copy.layoutExport.image && !copy.layoutExport._detached){
      delete copy.layoutExport.image;
    }
    // Also strip images from all eventLayouts entries (except detached snapshots)
    (copy.eventLayouts || []).forEach(function(entry){
      if(entry.layoutExport && entry.layoutExport.image && !entry.layoutExport._detached){
        delete entry.layoutExport.image;
      }
    });
    return copy;
  }

  window.EVENTOS_DATA = {
    isConfigured: isConfigured,
    getConfigErrorMessage: getConfigErrorMessage,

    /**
     * Se llama una vez tras iniciar sesion en Clerk.
     *
     * Resuelve el "tenant" del usuario: para un cliente heredado de Wix devuelve
     * su wixUserId de siempre (enlazado por email desde legacy_links); para uno
     * nuevo, su propio id de Clerk.  Ese valor es el que la app usa como DB.cur.
     */
    /**
     * bootstrapIdentity es una ACTION porque necesita consultar la API de Clerk
     * para el enlace automático de los clientes heredados (los que entraban con
     * Google en la versión de Wix).  Si falla, se cae a ensureIdentity, que hace
     * lo mismo pero solo con el mapeo manual por correo.
     */
    ensureIdentity: async function(options){
      var profile;
      try{
        profile = await callConvex("action", "auth:bootstrapIdentity", {}, options);
      }catch(e){
        console.warn("EventOS: bootstrapIdentity failed, falling back", e);
        profile = await callConvex("mutation", "auth:ensureIdentity", {}, options);
      }
      _tenantId = profile.tenantId;
      return profile;
    },

    getTenantId: function(){
      return _tenantId || '';
    },

    // Token de Clerk para servicios externos (el proxy de IA).  Es asincrono
    // porque Clerk puede tener que renovarlo.
    getAuthToken: function(skipCache){
      return _getAuthToken(!!skipCache);
    },

    isSignedIn: function(){
      var clerk = _clerk();
      return !!(clerk && clerk.session);
    },

    signOut: async function(){
      _tenantId = null;
      var clerk = _clerk();
      if(clerk && clerk.signOut) await clerk.signOut();
    },

    getProjectsByWixUserId: async function(options){
      var rows = await callConvex("query", "projects:getProjectsByWixUserId", {}, options);
      return normalizeProjectRows(rows);
    },
    getChangedProjectIds: async function(since, options){
      return await callConvex("query", "projects:getChangedProjectIds", {
        since: since
      }, options);
    },
    getProjectMetaByWixUserId: async function(options){
      var rows = await callConvex("query", "projects:getProjectMetaByWixUserId", {}, options);
      return normalizeProjectRows(rows);
    },
    getProjectById: async function(projectId, options){
      var row = await callConvex("query", "projects:getProjectById", {
        projectId: projectId
      }, options);
      if(!row || !row.data) return null;
      // Stamp version for optimistic locking (same as normalizeProjectRows)
      if(row.updatedAt) row.data._expectedVersion = row.updatedAt;
      return row.data;
    },
    upsertProject: async function(project, options){
      var validationError = validateProjectShape(project);
      if(validationError){
        console.warn('EventOS: project validation failed:', validationError, project);
        throw new Error('Invalid project data: ' + validationError);
      }
      var cleaned = prepareProjectForSave(project);

      // If previous extras save failed, force retry regardless of size
      var forceExtras = !!project._extrasPending;

      // If the document exceeds 700 KB (or extras retry is pending), automatically split
      // large arrays into a companion project_extras document.
      if(forceExtras || JSON.stringify(cleaned).length > 700000){
        var extras = {
          guests: cleaned.guests || [],
          layoutItems: cleaned.layoutItems || [],
          savedLayouts: cleaned.savedLayouts || [],
        };
        // Library projects store layout entries (with embedded items) in layouts[]
        if(cleaned.layouts && cleaned.layouts.length){
          extras.layouts = cleaned.layouts;
          cleaned.layouts = [];
        }
        // Vendors can be large when they contain unmigrated receipt base64 data
        if(cleaned.vendors && cleaned.vendors.length){
          extras.vendors = cleaned.vendors;
          cleaned.vendors = [];
        }
        // Moodboard images (especially unmigrated base64) can be very large
        if(cleaned.moodboard){
          extras.moodboard = cleaned.moodboard;
          cleaned.moodboard = {folders:[],uncategorized:[]};
        }
        // eventLayouts can grow large, especially when they hold detached (self-contained)
        // layout snapshots whose images are intentionally kept (not stripped).
        if(cleaned.eventLayouts && cleaned.eventLayouts.length){
          extras.eventLayouts = cleaned.eventLayouts;
          cleaned.eventLayouts = [];
        }
        cleaned.guests = [];
        cleaned.layoutItems = [];
        cleaned.savedLayouts = [];
        cleaned._hasExtras = true;

        // Final guard: if the main record is still over 950 KB after splitting, reject with a
        // sentinel error so the caller can show an appropriate message.
        if(JSON.stringify(cleaned).length > 950000){
          throw new Error("__oversize__: Project data too large. Please remove some content (images, guests, or layouts) and try again.");
        }

        // Save main document FIRST, then extras. If extras fails, log a warning
        // but don't lose the main save. On next load the app will re-merge from
        // the in-memory copy and retry the extras on the following save.
        await callConvex("mutation", "projects:upsertProject", {
          project: cleaned
        }, options);

        try {
          await callConvex("mutation", "projects:upsertProjectExtras", {
            projectId: String(cleaned.id || ""),
            extras: extras
          });
          delete project._extrasPending;
          // Clear persisted retry flag on success
          try{ localStorage.removeItem('eventos_extras_pending_'+String(cleaned.id||'')); }catch(e){}
        } catch(extrasErr) {
          console.warn("EventOS: extras save failed (main document saved OK)", extrasErr);
          project._extrasPending = true;
          // Persist retry flag so it survives page reload
          try{ localStorage.setItem('eventos_extras_pending_'+String(cleaned.id||''), '1'); }catch(e){}
        }
        return;
      } else {
        cleaned._hasExtras = false;
      }

      // No extras needed — just save the main document
      if(JSON.stringify(cleaned).length > 950000){
        throw new Error("__oversize__");
      }

      await callConvex("mutation", "projects:upsertProject", {
        project: cleaned
      }, options);
    },
    getProjectExtras: async function(projectId, options){
      return await callConvex("query", "projects:getProjectExtras", {
        projectId: projectId
      }, options);
    },
    deleteProject: async function(projectId, options){
      return await callConvex("mutation", "projects:deleteProject", {
        projectId: projectId
      }, options);
    },
    // closeOtherSessions / revokeSession se retiraron: las sesiones ya no son
    // nuestras, las administra Clerk (signOut cierra la del dispositivo, y el
    // usuario puede cerrar las demas desde su perfil de Clerk).
    // Borra archivos que el cliente acaba de desvincular del proyecto.
    deleteFilesForProject: async function(storageIds, options){
      if(!storageIds || !storageIds.length) return 0;
      return await callConvex("mutation", "projects:deleteFilesForProject", {
        storageIds: storageIds
      }, options);
    },
    // Reclama la propiedad de archivos antiguos (subidos antes de que existiera
    // file_ownership) verificando en el servidor que el proyecto del usuario los
    // referencia.  Sin esto, endurecer el control de acceso romperia esas imagenes.
    claimFileOwnership: async function(storageIds, options){
      if(!storageIds || !storageIds.length) return 0;
      return await callConvex("mutation", "files:claimOwnership", {
        storageIds: storageIds
      }, options);
    },
    // --- File Storage API ---
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024, // 10 MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
      'application/pdf'
    ],
    _validateUpload: function(blob){
      if(blob.size > this.MAX_UPLOAD_BYTES){
        throw new Error("File too large (max " + Math.round(this.MAX_UPLOAD_BYTES/1024/1024) + " MB)");
      }
      var mime = (blob.type || 'application/octet-stream').toLowerCase();
      if(this.ALLOWED_MIME_TYPES.length && this.ALLOWED_MIME_TYPES.indexOf(mime) === -1){
        throw new Error("File type not allowed: " + mime);
      }
    },
    generateUploadUrl: async function(options){
      return await callConvex("mutation", "files:generateUploadUrl", {}, options);
    },
    uploadFile: async function(fileOrBlob, options){
      this._validateUpload(fileOrBlob);
      var uploadUrl = await callConvex("mutation", "files:generateUploadUrl", {}, options);
      var res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileOrBlob.type || "application/octet-stream" },
        body: fileOrBlob,
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined
      });
      if(!res.ok) throw new Error("File upload failed: HTTP " + res.status);
      var json = await res.json();
      var storageId = json.storageId;
      // Validacion en servidor.  Si la llamada falla (red, sesion) el archivo queda
      // subido pero SIN registro de propiedad: hay que borrarlo o se vuelve un
      // huerfano inaccesible que igual consume cuota.
      var validation;
      try{
        validation = await callConvex("mutation", "files:validateUpload", { storageId: storageId }, options);
      }catch(validationErr){
        try{ await callConvex("mutation", "files:discardUpload", { storageId: storageId }); }catch(e2){}
        throw validationErr;
      }
      if(!validation.valid) throw new Error(validation.reason || "File rejected by server");
      return storageId;
    },
    uploadBase64: async function(dataUrl, options){
      var blob = base64ToBlob(dataUrl);
      return await window.EVENTOS_DATA.uploadFile(blob, options);
    },
    getFileUrl: async function(storageId, options){
      return await callConvex("query", "files:getFileUrl", { storageId: storageId }, options);
    },
    getFileUrls: async function(storageIds, options){
      if(!storageIds || !storageIds.length) return [];
      return await callConvex("query", "files:getFileUrls", { storageIds: storageIds }, options);
    },
    deleteFile: async function(storageId, options){
      return await callConvex("mutation", "files:deleteFile", { storageId: storageId }, options);
    },
    isBase64Image: isBase64Image,
    base64ToBlob: base64ToBlob
  };
})();
