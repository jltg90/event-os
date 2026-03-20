(function(){
  var EVENTOS_CONFIG = window.EVENTOS_CONFIG || {};
  var CONVEX_URL = (EVENTOS_CONFIG.convexUrl || "").replace(/\/+$/, "");

  function isConfigured(){
    return !!CONVEX_URL;
  }

  function getConfigErrorMessage(){
    return "Missing app configuration. Check app-config.js for convexUrl and reload.";
  }

  async function callConvex(kind, path, args, options){
    if(!isConfigured()) throw new Error(getConfigErrorMessage());
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

  window.EVENTOS_DATA = {
    isConfigured: isConfigured,
    getConfigErrorMessage: getConfigErrorMessage,
    getProjectsByWixUserId: async function(wixUserId, options){
      var rows = await callConvex("query", "projects:getProjectsByWixUserId", {
        wixUserId: wixUserId
      }, options);
      return normalizeProjectRows(rows);
    },
    upsertProject: async function(wixUserId, project, options){
      return await callConvex("mutation", "projects:upsertProject", {
        wixUserId: wixUserId,
        project: project
      }, options);
    },
    deleteProject: async function(wixUserId, projectId, options){
      return await callConvex("mutation", "projects:deleteProject", {
        wixUserId: wixUserId,
        projectId: projectId
      }, options);
    },
    getSharedProjectByToken: async function(token, options){
      return await callConvex("query", "projects:getSharedProjectByToken", {
        token: token
      }, options);
    }
  };
})();
