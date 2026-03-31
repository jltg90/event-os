(function(){
  var EVENTOS_CONFIG = window.EVENTOS_CONFIG || {};
  var CONVEX_URL = (EVENTOS_CONFIG.convexUrl || "").replace(/\/+$/, "");

  // Session state — set by authenticate() and refreshed automatically
  var _sessionToken = null;
  var _sessionExpiresAt = 0;
  var _lastWixToken = null;
  var _lastWixUserId = null;
  var _reauthInFlight = null; // deduplicate concurrent re-auth attempts

  function isConfigured(){
    return !!CONVEX_URL;
  }

  function getConfigErrorMessage(){
    return "Missing app configuration. Check app-config.js for convexUrl and reload.";
  }

  // Internal: call createSession and store result. Deduplicates concurrent calls.
  function _doReauth(){
    if(_reauthInFlight) return _reauthInFlight;
    _reauthInFlight = (async function(){
      try{
        var res = await fetch(CONVEX_URL + "/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "auth:createSession",
            args: { wixToken: _lastWixToken || "", claimedUserId: _lastWixUserId || "" },
            format: "json"
          })
        });
        var payload = await res.json().catch(function(){ return null; });
        if(res.ok && payload && payload.status === "success" && payload.value && payload.value.token){
          _sessionToken = payload.value.token;
          _sessionExpiresAt = payload.value.expiresAt;
        }
      }catch(e){
        console.warn("EventOS: session renewal failed", e);
      }finally{
        _reauthInFlight = null;
      }
    })();
    return _reauthInFlight;
  }

  async function callConvex(kind, path, args, options){
    if(!isConfigured()) throw new Error(getConfigErrorMessage());

    // Proactively renew session when < 5 minutes from expiry
    if(_sessionToken && _lastWixUserId && Date.now() >= _sessionExpiresAt - 5 * 60 * 1000){
      await _doReauth();
    }

    var fetchOptions = options || {};
    // Use caller's signal or create a 15-second timeout
    var signal = fetchOptions.signal;
    if(!signal && typeof AbortSignal !== 'undefined' && AbortSignal.timeout){
      signal = AbortSignal.timeout(15000);
    }
    var res = await fetch(CONVEX_URL + "/api/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path,
        args: args || {},
        format: "json"
      }),
      signal: signal
    });
    var payload = await res.json().catch(function(){ return null; });
    if(!res.ok){
      throw new Error("HTTP " + res.status);
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
    if(copy.layoutExport && copy.layoutExport.image){
      delete copy.layoutExport.image;
    }
    // Also strip images from all eventLayouts entries
    (copy.eventLayouts || []).forEach(function(entry){
      if(entry.layoutExport && entry.layoutExport.image){
        delete entry.layoutExport.image;
      }
    });
    return copy;
  }

  window.EVENTOS_DATA = {
    isConfigured: isConfigured,
    getConfigErrorMessage: getConfigErrorMessage,

    // Exchange a Wix instance token for a server-issued session token.
    // Must be called once during app init before any project API calls.
    authenticate: async function(wixToken, wixUserId){
      // Store credentials so _doReauth() can silently renew without bothering core.js
      _lastWixToken = wixToken || "";
      _lastWixUserId = wixUserId || "";
      var result = await callConvex("action", "auth:createSession", {
        wixToken: _lastWixToken,
        claimedUserId: _lastWixUserId
      });
      _sessionToken = result.token;
      _sessionExpiresAt = result.expiresAt;
    },

    // Call this whenever Wix rotates the instance token (new WIX_USER message, same user).
    // Keeps _lastWixToken current so session renewal uses a valid signature.
    updateWixToken: function(wixToken){
      _lastWixToken = wixToken || "";
    },

    getProjectsByWixUserId: async function(options){
      var rows = await callConvex("query", "projects:getProjectsByWixUserId", {
        sessionToken: _sessionToken
      }, options);
      return normalizeProjectRows(rows);
    },
    getChangedProjectIds: async function(since, options){
      return await callConvex("query", "projects:getChangedProjectIds", {
        sessionToken: _sessionToken,
        since: since
      }, options);
    },
    getProjectMetaByWixUserId: async function(options){
      var rows = await callConvex("query", "projects:getProjectMetaByWixUserId", {
        sessionToken: _sessionToken
      }, options);
      return normalizeProjectRows(rows);
    },
    getProjectById: async function(projectId, options){
      var row = await callConvex("query", "projects:getProjectById", {
        sessionToken: _sessionToken,
        projectId: projectId
      }, options);
      if(!row || !row.data) return null;
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
          sessionToken: _sessionToken,
          project: cleaned
        }, options);

        try {
          await callConvex("mutation", "projects:upsertProjectExtras", {
            sessionToken: _sessionToken,
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

      return await callConvex("mutation", "projects:upsertProject", {
        sessionToken: _sessionToken,
        project: cleaned
      }, options);
    },
    getProjectExtras: async function(projectId, options){
      return await callConvex("query", "projects:getProjectExtras", {
        sessionToken: _sessionToken,
        projectId: projectId
      }, options);
    },
    deleteProject: async function(projectId, options){
      return await callConvex("mutation", "projects:deleteProject", {
        sessionToken: _sessionToken,
        projectId: projectId
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
      return await callConvex("mutation", "files:generateUploadUrl", { sessionToken: _sessionToken }, options);
    },
    uploadFile: async function(fileOrBlob, options){
      this._validateUpload(fileOrBlob);
      var uploadUrl = await callConvex("mutation", "files:generateUploadUrl", { sessionToken: _sessionToken }, options);
      var res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileOrBlob.type || "application/octet-stream" },
        body: fileOrBlob,
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined
      });
      if(!res.ok) throw new Error("File upload failed: HTTP " + res.status);
      var json = await res.json();
      var storageId = json.storageId;
      // Server-side validation — deletes file if invalid
      var validation = await callConvex("mutation", "files:validateUpload", { storageId: storageId, sessionToken: _sessionToken }, options);
      if(!validation.valid) throw new Error(validation.reason || "File rejected by server");
      return storageId;
    },
    uploadBase64: async function(dataUrl, options){
      var blob = base64ToBlob(dataUrl);
      return await window.EVENTOS_DATA.uploadFile(blob, options);
    },
    getFileUrl: async function(storageId, options){
      return await callConvex("query", "files:getFileUrl", { storageId: storageId, sessionToken: _sessionToken }, options);
    },
    getFileUrls: async function(storageIds, options){
      if(!storageIds || !storageIds.length) return [];
      return await callConvex("query", "files:getFileUrls", { storageIds: storageIds, sessionToken: _sessionToken }, options);
    },
    deleteFile: async function(storageId, options){
      return await callConvex("mutation", "files:deleteFile", { storageId: storageId, sessionToken: _sessionToken }, options);
    },
    isBase64Image: isBase64Image,
    base64ToBlob: base64ToBlob
  };
})();
