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
    var res = await fetch(CONVEX_URL + "/api/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path,
        args: args || {},
        format: "json"
      }),
      signal: fetchOptions.signal
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
      if(row && row.projectId && row.data) projects[row.projectId] = row.data;
    });
    return projects;
  }

  function isBase64Image(s){
    return typeof s === 'string' && s.indexOf('data:image') === 0;
  }

  function base64ToBlob(dataUrl){
    var parts = dataUrl.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var binary = atob(parts[1]);
    var arr = new Uint8Array(binary.length);
    for(var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
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
      var cleaned = prepareProjectForSave(project);

      // If the document exceeds 700 KB, automatically split large arrays into a
      // companion project_extras document so the main record stays under Convex's 1 MB limit.
      if(JSON.stringify(cleaned).length > 700000){
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

        // Save extras BEFORE the main document — both must succeed for data integrity
        await callConvex("mutation", "projects:upsertProjectExtras", {
          sessionToken: _sessionToken,
          projectId: String(cleaned.id || ""),
          extras: extras
        });
      } else {
        cleaned._hasExtras = false;
      }

      // Final guard: if the main record is still over 950 KB after splitting, reject with a
      // sentinel error so the caller can show an appropriate message.
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
    generateUploadUrl: async function(options){
      return await callConvex("mutation", "files:generateUploadUrl", {}, options);
    },
    uploadFile: async function(fileOrBlob, options){
      var uploadUrl = await callConvex("mutation", "files:generateUploadUrl", {}, options);
      var res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileOrBlob.type || "application/octet-stream" },
        body: fileOrBlob
      });
      if(!res.ok) throw new Error("File upload failed: HTTP " + res.status);
      var json = await res.json();
      return json.storageId;
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
