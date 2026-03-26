var mbOpenFolders = {};
var _lightboxItems = [];
var _lightboxIndex = 0;
function mbDefaultFolderName(){
  return LANG==='es' ? 'Imagenes Importadas' : 'Imported Images';
}

function getMB(p){
  if(Array.isArray(p.moodboard)){
    p.moodboard = { folders:[], uncategorized: p.moodboard };
    saveProj(p);
  }
  if(!p.moodboard.folders) p.moodboard.folders=[];
  if(!p.moodboard.uncategorized) p.moodboard.uncategorized=[];
  if(p.moodboard.uncategorized.length){
    var target = p.moodboard.folders.find(function(f){ return f && f._systemFolder; });
    if(!target){
      target = {id:'mf'+Date.now(),name:mbDefaultFolderName(),color:'#6b7280',images:[],_systemFolder:true};
      p.moodboard.folders.unshift(target);
    }
    target.images = target.images.concat(p.moodboard.uncategorized);
    p.moodboard.uncategorized = [];
    saveProj(p);
  }
  return p.moodboard;
}

function totalMBImages(p){
  const mb=getMB(p);
  return mb.uncategorized.length + mb.folders.reduce((s,f)=>s+f.images.length,0);
}

function mbSpanClass(index, total){
  var pattern = total <= 2
    ? ['mb-span-feature','mb-span-wide']
    : ['mb-span-feature','mb-span-tall','mb-span-wide','','mb-span-tall','','mb-span-wide',''];
  return pattern[index % pattern.length] || '';
}

function mbFolderLabel(folderId){
  if(!folderId) return t('uncategorized');
  var p = proj();
  var mb = getMB(p);
  var folder = mb.folders.find(function(f){ return f.id===folderId; });
  return folder ? folder.name : t('uncategorized');
}

function mbCollectImages(folderId){
  var p = proj();
  var mb = getMB(p);
  var source = folderId
    ? ((mb.folders.find(function(f){ return f.id===folderId; })||{}).images||[])
    : (mb.uncategorized||[]);
  return source.map(function(img, idx){
    return {
      src: img.src,
      name: img.name || '',
      folderId: folderId || null,
      idx: idx
    };
  });
}

function renderMoodboard(){
  const p=proj(); const el=document.getElementById('tab-moodboard');
  const mb=getMB(p);
  const total=totalMBImages(p);

  el.innerHTML=`
  <div class="sh">
    <div>
      <div class="sh-title editorial-title" style="color:#7c3aed">${t('moodboard_library_title')}</div>
      <div class="sh-sub">${total} ${t('images')} · ${mb.folders.length} folders</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="libQuickLoadMoodboards()">${LANG==='es'?'Importar Moodboard':'Import Moodboard'}</button>
      <button class="btn btn-primary" onclick="openNewFolderModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${t('new_folder_btn')}
      </button>
    </div>
  </div>

  ${total===0 && mb.folders.length===0 ? `
  <div class="card" style="text-align:center;padding:60px">
    <svg width="48" height="48" fill="none" stroke="var(--light)" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 14px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
    <p style="font-size:16px;font-weight:600;margin-bottom:8px">${t('start_moodboard')}</p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">${t('start_moodboard_sub')}</p>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-ghost" onclick="openNewFolderModal()">${t('create_folder_btn')}</button>
    </div>
  </div>` : ''}

  <!-- Folders -->
  ${mb.folders.map((folder,fi)=>`
  <div class="mb-folder">
    <div class="mb-folder-header" onclick="toggleMBFolder('${folder.id}')">
      <svg width="18" height="18" fill="${folder.color||'#f59e0b'}" stroke="none" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <div class="mb-folder-title">${esc(folder.name)}</div>
      <span class="mb-folder-count">${folder.images.length} images</span>
      <div style="display:flex;gap:6px;align-items:center" onclick="event.stopPropagation()">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer;padding:5px 10px">
          + Add<input type="file" accept="image/*" multiple class="hidden" onchange="addMBImages(this,'${folder.id}')">
        </label>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="renameFolderModal('${folder.id}')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
        </button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMBFolder('${folder.id}')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
      <svg class="mb-folder-chevron ${mbOpenFolders[folder.id]!==false?'open':''}" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
    </div>
    <div class="mb-folder-body" style="display:${mbOpenFolders[folder.id]===false?'none':'block'}">
      ${folder.images.length===0 ? `
      <div style="text-align:center;padding:24px;color:var(--muted)">
        <p style="font-size:13px;margin-bottom:10px">${t('no_images_yet')}</p>
        <label class="btn btn-ghost btn-sm" style="cursor:pointer;display:inline-flex">
          ${t('upload_images_btn')}<input type="file" accept="image/*" multiple class="hidden" onchange="addMBImages(this,'${folder.id}')">
        </label>
      </div>` : `
      <div class="mb-gallery">
        ${folder.images.map((img,ii)=>mbImageCard(img,ii,folder.id,folder.images.length)).join('')}
      </div>`}
    </div>
  </div>`).join('')}

  `;
}

function mbImageCard(img, ii, folderId, total){
  const fKey = folderId || '__root__';
  const fidJs = folderId ? `'${folderId}'` : 'null';
  const spanClass = mbSpanClass(ii, total || 0);
  const folderLabel = mbFolderLabel(folderId);
  return `<div class="mb-card mb-bento-item ${spanClass}" draggable="true"
      data-mbidx="${ii}" data-mbfolder="${fKey}"
      ondragstart="mbDragStart(event,'${fKey}',${ii})"
      ondragover="event.preventDefault()"
      ondrop="mbDrop(event,'${fKey}',${ii})">
    <div class="media-zoom" style="position:relative;overflow:hidden;cursor:zoom-in;flex:1;min-height:0"
         onclick="mbOpenLightboxIdx(${ii},${fidJs})">
      <img src="${img.src}" class="media-zoom-img" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">
      <div class="media-zoom-overlay">
        <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 3.5 3.5"/><path d="M11 8v6M8 11h6"/></svg>
      </div>
      <div class="mb-meta">
        <div class="mb-meta-title">${esc(img.name||'Untitled image')}</div>
        <div class="mb-meta-sub">${esc(folderLabel)}</div>
      </div>
    </div>
    <div class="mb-card-actions">
      <button class="icon-btn" onclick="event.stopPropagation();moveMBImageModal(${ii},${fidJs})" title="Move to folder">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
      <button class="icon-btn icon-btn-danger"
              onclick="event.stopPropagation();delMBImg(${ii},${fidJs})" title="Delete">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>
    <div style="padding:8px 12px">
      <input style="width:100%;border:none;border-bottom:1.5px solid var(--border);background:transparent;font-size:12px;font-family:inherit;padding:4px 0;outline:none;color:var(--text)"
        value="${esc(img.name||'')}" placeholder="${t('add_label')}"
        onclick="event.stopPropagation()"
        onfocus="this.style.borderColor='var(--gold)'"
        onblur="this.style.borderColor='var(--border)';renameMBImg(${ii},${fidJs},this.value)">
    </div>
  </div>`;
}

function mbOpenLightboxIdx(idx, folderId){
  var items = mbCollectImages(folderId);
  if(items[idx]) openLightbox(items[idx].src, items[idx].name||'', items, idx);
}

function mbCardInfo(card){
  const idx=parseInt(card.dataset.mbidx);
  const fkey=card.dataset.mbfolder;
  const fid=(fkey==='__root__')?null:fkey;
  return{idx,fid};
}
function mbLightbox(card){
  const img=card.querySelector('img');
  const name=card.querySelector('input')?.value||'';
  if(img)openLightbox(img.src,name);
}
function mbDelByCard(card){
  if(!card)return;
  const{idx,fid}=mbCardInfo(card);
  if(!confirm('Delete this image?'))return;
  const p=proj();const mb=getMB(p);
  if(fid){const f=mb.folders.find(f=>f.id===fid);if(f)f.images.splice(idx,1);}
  else{mb.uncategorized.splice(idx,1);}
  saveProj(p);renderMoodboard();
}
function mbMoveByCard(card){
  if(!card)return;
  const{idx,fid}=mbCardInfo(card);
  moveMBImageModal(idx,fid);
}
function mbRenameByCard(card,name){
  if(!card)return;
  const{idx,fid}=mbCardInfo(card);
  renameMBImg(idx,fid,name);
}


function toggleMBFolder(id){
  mbOpenFolders[id] = mbOpenFolders[id]===false ? true : false;
  renderMoodboard();
}

function openNewFolderModal(){
  const colors=['#f59e0b','#10b981','#c9a84c','#7c3aed','#ec4899','#ef4444','#06b6d4','#6b7280'];
  openMo(`<div class="mo-title">${t('new_folder')}</div>
  <div class="ig" style="margin-bottom:16px"><label>Folder Name *</label><input class="input" id="mf-name" placeholder="e.g. Floral Inspiration, Venue Ideas..."></div>
  <div class="ig" style="margin-bottom:4px"><label>Folder Color</label></div>
  <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
    ${colors.map((c,i)=>`<div onclick="selectMBFolderColor(this,'${c}')" data-color="${c}" style="width:30px;height:30px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${i===0?'#000':'transparent'};transition:all .15s"></div>`).join('')}
  </div>
  <input type="hidden" id="mf-color" value="${colors[0]}">
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="createMBFolder()">Create Folder</button>
  </div>`);
}

function selectMBFolderColor(el,c){
  document.querySelectorAll('#mo-body [data-color]').forEach(d=>d.style.borderColor='transparent');
  el.style.borderColor='#000';
  document.getElementById('mf-color').value=c;
}

function createMBFolder(){
  const name=gv('mf-name').trim();
  if(!name)return toast('Folder name required','e');
  const p=proj(); const mb=getMB(p);
  mb.folders.push({id:'mf'+Date.now(),name,color:gv('mf-color'),images:[]});
  saveProj(p); closeMo(); renderMoodboard(); toast('Folder created','s');
}

function renameFolderModal(fid){
  const p=proj(); const mb=getMB(p);
  const folder=mb.folders.find(f=>f.id===fid);
  if(!folder)return;
  openMo(`<div class="mo-title">Rename Folder</div>
  <div class="ig" style="margin-bottom:16px"><label>Folder Name</label><input class="input" id="mfr-name" value="${esc(folder.name)}"></div>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-primary" onclick="saveFolderRename('${fid}')">Save</button>
  </div>`);
}
function saveFolderRename(fid){
  const name=gv('mfr-name').trim();if(!name)return toast('Name required','e');
  const p=proj();const mb=getMB(p);
  const f=mb.folders.find(f=>f.id===fid);if(f)f.name=name;
  saveProj(p);closeMo();renderMoodboard();toast('Folder renamed','s');
}

function deleteMBFolder(fid){
  const p=proj();const mb=getMB(p);
  const folder=mb.folders.find(f=>f.id===fid);
  if(!folder)return;
  const msg=`Delete folder "${folder.name}"?${folder.images.length?` (${folder.images.length} image${folder.images.length>1?'s':''} will be deleted too)`:''}`;
  openMo(`<div class="mo-title" style="color:#ef4444">Delete Folder</div>
  <p style="font-size:14px;color:var(--muted);margin-bottom:24px">${msg}</p>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-danger" onclick="closeMo();_doDeleteMBFolder('${fid}')">Delete</button>
  </div>`);
}
function _doDeleteMBFolder(fid){
  const p=proj();const mb=getMB(p);
  const folder=mb.folders.find(f=>f.id===fid);if(!folder)return;
  mb.folders=mb.folders.filter(f=>f.id!==fid);
  saveProj(p);renderMoodboard();toast('Folder deleted');
}

async function addMBImages(input, folderId){
  const files=Array.from(input.files);
  if(!files.length)return;
  if(!folderId){
    input.value='';
    return toast(LANG==='es'?'Crea o elige una carpeta antes de subir imagenes':'Create or choose a folder before uploading images','e');
  }
  var MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per image
  const p=proj();const mb=getMB(p);
  toast('Uploading images…');
  let uploaded=0;
  for(const f of files){
    if(f.size > MAX_FILE_SIZE){
      toast(f.name + ' is too large (max 5MB)','e');
      continue;
    }
    try{
      var storageId = await EVENTOS_DATA.uploadFile(f);
      var url = await EVENTOS_DATA.getFileUrl(storageId);
      const img={id:'mi'+Date.now()+uploaded,src:url,storageId:storageId,name:f.name.replace(/\.[^/.]+$/,''),mimeType:f.type||'image/*'};
      const folder=mb.folders.find(fo=>fo.id===folderId);if(folder)folder.images.push(img);
      uploaded++;
    }catch(e){console.error('Upload error:',e);toast('Upload error: '+f.name,'e');}
  }
  if(uploaded>0){
    if(folderId&&!mbOpenFolders[folderId])mbOpenFolders[folderId]=true;
    saveProj(p);renderMoodboard();
    toast(uploaded+' image'+(uploaded>1?'s':'')+' added','s');
  }
}

function delMBImg(idx, folderId){
  openMo(`<div class="mo-title" style="color:#ef4444">Delete Image</div>
  <p style="font-size:14px;color:var(--muted);margin-bottom:24px">Are you sure you want to delete this image? This cannot be undone.</p>
  <div class="mo-foot">
    <button class="btn btn-ghost" onclick="closeMo()">Cancel</button>
    <button class="btn btn-danger" onclick="closeMo();_doDelMBImg(${idx},${folderId===null||folderId===undefined?'null':`'${folderId}'`})">Delete</button>
  </div>`);
}
async function _doDelMBImg(idx, folderId){
  const p=proj();const mb=getMB(p);
  var removed;
  if(folderId){const f=mb.folders.find(f=>f.id===folderId);if(f){removed=f.images.splice(idx,1)[0];}}
  else{removed=(mb.uncategorized||[]).splice(idx,1)[0];}
  if(removed && removed.storageId){
    EVENTOS_DATA.deleteFile(removed.storageId).catch(function(e){console.error('Failed to delete file:',e);});
  }
  saveProj(p);renderMoodboard();toast('Image deleted');
}

function renameMBImg(idx, folderId, name){
  const p=proj();const mb=getMB(p);
  if(folderId){const f=mb.folders.find(f=>f.id===folderId);if(f&&f.images[idx])f.images[idx].name=name;}
  else{if(mb.uncategorized[idx])mb.uncategorized[idx].name=name;}
  saveProj(p);
}

function moveMBImageModal(idx, folderId){
  const p=proj();const mb=getMB(p);
  const folders=mb.folders;
  openMo(`<div class="mo-title">Move Image to Folder</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
    ${folders.map(f=>`
    <div onclick="doMoveMBImage(${idx},'${folderId||'__root__'}','${f.id}')" class="option-card">
      <svg width="16" height="16" fill="${f.color||'#f59e0b'}" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      ${esc(f.name)} <span style="color:var(--muted);font-size:11px">(${f.images.length})</span>
    </div>`).join('')}
  </div>
  <div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">Cancel</button></div>`);
}

function doMoveMBImage(idx, fromId, toId){
  if(fromId===toId){closeMo();return;}
  const p=proj();const mb=getMB(p);
  let img;
  if(fromId==='__root__'){img=mb.uncategorized.splice(idx,1)[0];}
  else{const f=mb.folders.find(f=>f.id===fromId);if(f){img=f.images.splice(idx,1)[0];}}
  if(!img){closeMo();return;}
  const tf=mb.folders.find(f=>f.id===toId);if(tf){tf.images.push(img);mbOpenFolders[toId]=true;}
  saveProj(p);closeMo();renderMoodboard();toast('Image moved','s');
}

let _mbDragSrc={fid:null,idx:0};
function mbDragStart(e,fid,idx){ _mbDragSrc={fid,idx}; e.dataTransfer.effectAllowed='move'; }
function mbDrop(e,fid,idx){
  e.preventDefault();
  if(_mbDragSrc.fid===fid && _mbDragSrc.idx!==idx){
    const p=proj();const mb=getMB(p);
    const arr=fid==='__root__'?mb.uncategorized:mb.folders.find(f=>f.id===fid)?.images;
    if(arr){const [item]=arr.splice(_mbDragSrc.idx,1);arr.splice(idx,0,item);saveProj(p);renderMoodboard();}
  }
}

let V3D = {
  renderer:null, scene:null, camera:null, controls:null,
  animId:null, models:[], activeModel:null,
  orbitTarget:{x:0,y:0,z:0},
  mouse:{down:false,right:false,lastX:0,lastY:0,rotX:0,rotY:0,dist:5},
};


function initThreeJS(){
  const canvas=document.getElementById('three-canvas');
  if(!canvas)return;
  const wrap=document.getElementById('v3d-wrap');
  if(!wrap)return;

  if(V3D.renderer){
    cancelAnimationFrame(V3D.animId);
    V3D.renderer.dispose();
    V3D.renderer=null;
  }

  const W=wrap.clientWidth||800, H=wrap.clientHeight||600;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0f0f1a);
  scene.fog=new THREE.Fog(0x0f0f1a,50,200);

  const grid=new THREE.GridHelper(40,40,0x222244,0x222244);
  scene.add(grid);

  const ambient=new THREE.AmbientLight(0xffffff,0.6);
  scene.add(ambient);
  const dir1=new THREE.DirectionalLight(0xffffff,0.8);
  dir1.position.set(10,20,10);dir1.castShadow=true;
  scene.add(dir1);
  const dir2=new THREE.DirectionalLight(0x8888ff,0.3);
  dir2.position.set(-10,5,-10);
  scene.add(dir2);
  const hemi=new THREE.HemisphereLight(0xaaccff,0x334422,0.4);
  scene.add(hemi);

  const camera=new THREE.PerspectiveCamera(60,W/H,0.01,1000);
  camera.position.set(5,3,5);
  camera.lookAt(0,0,0);

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;

  V3D.renderer=renderer;V3D.scene=scene;V3D.camera=camera;
  V3D.mouse={down:false,right:false,lastX:0,lastY:0,rotX:0.4,rotY:0.6,dist:8,panX:0,panY:0};
  V3D.lights={ambient,dir1,dir2,hemi};
  V3D.wireframe=false;

  updateCameraOrbit();

  canvas.addEventListener('mousedown',v3dMouseDown);
  canvas.addEventListener('mousemove',v3dMouseMove);
  canvas.addEventListener('mouseup',v3dMouseUp);
  canvas.addEventListener('wheel',v3dWheel,{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  canvas.addEventListener('touchstart',v3dTouchStart,{passive:false});
  canvas.addEventListener('touchmove',v3dTouchMove,{passive:false});
  canvas.addEventListener('touchend',v3dTouchEnd);

  const ro=new ResizeObserver(()=>{
    const w=wrap.clientWidth,h=wrap.clientHeight;
    renderer.setSize(w,h);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  });
  ro.observe(wrap);

  function animate(){
    V3D.animId=requestAnimationFrame(animate);
    renderer.render(scene,camera);
  }
  animate();
}

let _v3dTouch={dist:0,lastX:0,lastY:0};

function v3dMouseDown(e){
  V3D.mouse.down=true;
  V3D.mouse.right=(e.button===2);
  V3D.mouse.lastX=e.clientX;
  V3D.mouse.lastY=e.clientY;
  e.preventDefault();
}
function v3dMouseUp(){V3D.mouse.down=false;}
function v3dMouseMove(e){
  if(!V3D.mouse.down)return;
  const dx=e.clientX-V3D.mouse.lastX;
  const dy=e.clientY-V3D.mouse.lastY;
  V3D.mouse.lastX=e.clientX;V3D.mouse.lastY=e.clientY;
  if(V3D.mouse.right){
    V3D.mouse.panX-=dx*0.01;
    V3D.mouse.panY+=dy*0.01;
  } else {
    V3D.mouse.rotY+=dx*0.008;
    V3D.mouse.rotX+=dy*0.008;
    V3D.mouse.rotX=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,V3D.mouse.rotX));
  }
  updateCameraOrbit();
}
function v3dWheel(e){
  e.preventDefault();
  V3D.mouse.dist=Math.max(0.5,Math.min(100,V3D.mouse.dist+e.deltaY*0.01));
  updateCameraOrbit();
}
function v3dTouchStart(e){
  if(e.touches.length===2){
    _v3dTouch.dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  } else if(e.touches.length===1){
    _v3dTouch.lastX=e.touches[0].clientX;_v3dTouch.lastY=e.touches[0].clientY;
  }
  e.preventDefault();
}
function v3dTouchMove(e){
  if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    V3D.mouse.dist=Math.max(0.5,Math.min(100,V3D.mouse.dist-( d-_v3dTouch.dist)*0.02));
    _v3dTouch.dist=d;
  } else if(e.touches.length===1){
    const dx=e.touches[0].clientX-_v3dTouch.lastX;
    const dy=e.touches[0].clientY-_v3dTouch.lastY;
    V3D.mouse.rotY+=dx*0.008;V3D.mouse.rotX+=dy*0.008;
    V3D.mouse.rotX=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,V3D.mouse.rotX));
    _v3dTouch.lastX=e.touches[0].clientX;_v3dTouch.lastY=e.touches[0].clientY;
  }
  updateCameraOrbit();e.preventDefault();
}
function v3dTouchEnd(){}

function updateCameraOrbit(){
  if(!V3D.camera)return;
  const r=V3D.mouse.dist;
  const x=r*Math.sin(V3D.mouse.rotY)*Math.cos(V3D.mouse.rotX)+(V3D.mouse.panX||0);
  const y=r*Math.sin(V3D.mouse.rotX)+(V3D.mouse.panY||0);
  const z=r*Math.cos(V3D.mouse.rotY)*Math.cos(V3D.mouse.rotX);
  V3D.camera.position.set(x,y,z);
  V3D.camera.lookAt(V3D.mouse.panX||0,V3D.mouse.panY||0,0);
}

function v3dResetCamera(){
  if(!V3D.mouse)return;
  V3D.mouse.rotX=0.4;V3D.mouse.rotY=0.6;V3D.mouse.dist=8;V3D.mouse.panX=0;V3D.mouse.panY=0;
  updateCameraOrbit();
}

function v3dToggleWireframe(){
  V3D.wireframe=!V3D.wireframe;
  if(V3D.scene){
    V3D.scene.traverse(obj=>{
      if(obj.isMesh&&obj.material){
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(m=>m.wireframe=V3D.wireframe);
      }
    });
  }
  const btn=document.getElementById('wire-btn');
  if(btn)btn.textContent='Wireframe: '+(V3D.wireframe?'On':'Off');
}

function v3dToggleLights(){
  if(!V3D.lights)return;
  const on=V3D.lights.dir1.visible;
  V3D.lights.dir1.visible=!on;V3D.lights.dir2.visible=!on;V3D.lights.hemi.visible=!on;
  V3D.lights.ambient.intensity=on?1.4:0.6;
  const btn=document.getElementById('light-btn');
  if(btn)btn.textContent='Lights: '+(on?'Off':'On');
}

function loadGLBFile(input){
  const file=input.files[0];if(!file)return;
  const uploadZone=document.getElementById('v3d-upload');
  const loading=document.getElementById('v3d-loading');
  const hud=document.getElementById('v3d-hud');
  if(uploadZone)uploadZone.style.display='none';
  if(loading){loading.classList.remove('hidden');document.getElementById('v3d-load-msg').textContent='Reading file...';}

  const reader=new FileReader();
  reader.onload=e=>{
    if(loading)document.getElementById('v3d-load-msg').textContent='Parsing model...';
    setTimeout(()=>loadGLBBuffer(e.target.result,file.name,file.size),50);
  };
  reader.onerror=()=>{toast('Failed to read file','e');if(loading)loading.classList.add('hidden');};
  reader.readAsArrayBuffer(file);
}

function v3dHandleDrop(e){
  e.preventDefault();
  const file=e.dataTransfer.files[0];
  if(!file||(!file.name.endsWith('.glb')&&!file.name.endsWith('.gltf'))){toast('Please drop a GLB or GLTF file','e');return;}
  const dt=new DataTransfer();dt.items.add(file);
  const fakeInput={files:dt.files};
  loadGLBFile(fakeInput);
}

function loadGLBBuffer(buffer, filename, filesize){
  if(!V3D.scene){toast('Viewer not ready, please try again','e');return;}

  if(!window.THREE_GLTFLoader){
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    script.onload=()=>{window.THREE_GLTFLoader=true;_doLoadGLB(buffer,filename,filesize);};
    script.onerror=()=>toast('Could not load GLTFLoader — check your internet connection','e');
    document.head.appendChild(script);
  } else {
    _doLoadGLB(buffer,filename,filesize);
  }
}

function _doLoadGLB(buffer,filename,filesize){
  const loading=document.getElementById('v3d-loading');
  const hud=document.getElementById('v3d-hud');
  if(loading)document.getElementById('v3d-load-msg').textContent='Building scene...';

  try{
    const loader=new THREE.GLTFLoader();
    loader.parse(buffer,'',(gltf)=>{
      if(V3D.activeModel){V3D.scene.remove(V3D.activeModel);V3D.activeModel=null;}

      const model=gltf.scene;

      const box=new THREE.Box3().setFromObject(model);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const maxDim=Math.max(size.x,size.y,size.z);
      const scale=maxDim>0?4/maxDim:1;
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.position.y-=box.min.y*scale;

      model.traverse(child=>{
        if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}
      });

      V3D.scene.add(model);V3D.activeModel=model;

      V3D.mouse.dist=maxDim*scale*2.5;
      V3D.mouse.rotX=0.35;V3D.mouse.rotY=0.6;
      V3D.mouse.panX=0;V3D.mouse.panY=0;
      updateCameraOrbit();

      if(loading)loading.classList.add('hidden');
      if(hud){hud.classList.remove('hidden');document.getElementById('v3d-model-name').textContent=filename;}

      const p=proj();if(!p.models3d)p.models3d=[];
      const sizeStr=filesize?(filesize>1048576?(filesize/1048576).toFixed(1)+'MB':(filesize/1024).toFixed(0)+'KB'):'';
      const existing=p.models3d.findIndex(m=>m.name===filename);
      if(existing===-1)p.models3d.push({id:'m'+Date.now(),name:filename,size:sizeStr,loaded:new Date().toISOString()});
      saveProj(p);

      toast(`✓ Model loaded: ${filename}`,'s');
    },(err)=>{
      console.error(err);
      if(loading)loading.classList.add('hidden');
      toast('Error parsing model. Make sure it\'s a valid GLB/GLTF file.','e');
      const uz=document.getElementById('v3d-upload');if(uz)uz.style.display='flex';
    });
  }catch(err){
    console.error(err);
    if(loading)loading.classList.add('hidden');
    toast('Failed to load model: '+err.message,'e');
    const uz=document.getElementById('v3d-upload');if(uz)uz.style.display='flex';
  }
}

function del3DModel(idx){
  if(!confirm('Remove this model from the list?'))return;
  const p=proj();if(!p.models3d)return;
  p.models3d.splice(idx,1);saveProj(p);renderViewer3D();
}

let _moMouseDownOnOverlay=false;
function moDown(e){ _moMouseDownOnOverlay=(e.target===document.getElementById('mo')); }
window.addEventListener('mouseup',e=>{
  if(_moMouseDownOnOverlay&&e.target===document.getElementById('mo'))closeMo();
  _moMouseDownOnOverlay=false;
});
function openMo(html){ document.getElementById('mo-body').innerHTML=html; document.getElementById('mo').classList.add('open'); }
function closeMo(){ document.getElementById('mo').classList.remove('open'); }
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMo();});

const GUEST_TEMPLATE_B64 = 'UEsDBBQAAAAAAAAAAACkAYS4tQIAALUCAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHM8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+DQo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj48UmVsYXRpb25zaGlwIElkPSJySWQxIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3dvcmtzaGVldCIgVGFyZ2V0PSJ3b3Jrc2hlZXRzL3NoZWV0MS54bWwiLz48UmVsYXRpb25zaGlwIElkPSJySWQyIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3RoZW1lIiBUYXJnZXQ9InRoZW1lL3RoZW1lMS54bWwiLz48UmVsYXRpb25zaGlwIElkPSJySWQzIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3N0eWxlcyIgVGFyZ2V0PSJzdHlsZXMueG1sIi8+PFJlbGF0aW9uc2hpcCBJZD0icklkNCIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9zaGVldE1ldGFkYXRhIiBUYXJnZXQ9Im1ldGFkYXRhLnhtbCIvPjwvUmVsYXRpb25zaGlwcz5QSwMEFAAAAAAAAAAAADAPiGveHQAA3h0AABMAAAB4bC90aGVtZS90aGVtZTEueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPGE6dGhlbWUgeG1sbnM6YT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L21haW4iIG5hbWU9Ik9mZmljZSBUaGVtZSI+PGE6dGhlbWVFbGVtZW50cz48YTpjbHJTY2hlbWUgbmFtZT0iT2ZmaWNlIj48YTpkazE+PGE6c3lzQ2xyIHZhbD0id2luZG93VGV4dCIgbGFzdENscj0iMDAwMDAwIi8+PC9hOmRrMT48YTpsdDE+PGE6c3lzQ2xyIHZhbD0id2luZG93IiBsYXN0Q2xyPSJGRkZGRkYiLz48L2E6bHQxPjxhOmRrMj48YTpzcmdiQ2xyIHZhbD0iMUY0OTdEIi8+PC9hOmRrMj48YTpsdDI+PGE6c3JnYkNsciB2YWw9IkVFRUNFMSIvPjwvYTpsdDI+PGE6YWNjZW50MT48YTpzcmdiQ2xyIHZhbD0iNEY4MUJEIi8+PC9hOmFjY2VudDE+PGE6YWNjZW50Mj48YTpzcmdiQ2xyIHZhbD0iQzA1MDREIi8+PC9hOmFjY2VudDI+PGE6YWNjZW50Mz48YTpzcmdiQ2xyIHZhbD0iOUJCQjU5Ii8+PC9hOmFjY2VudDM+PGE6YWNjZW50ND48YTpzcmdiQ2xyIHZhbD0iODA2NEEyIi8+PC9hOmFjY2VudDQ+PGE6YWNjZW50NT48YTpzcmdiQ2xyIHZhbD0iNEJBQ0M2Ii8+PC9hOmFjY2VudDU+PGE6YWNjZW50Nj48YTpzcmdiQ2xyIHZhbD0iRjc5NjQ2Ii8+PC9hOmFjY2VudDY+PGE6aGxpbms+PGE6c3JnYkNsciB2YWw9IjAwMDBGRiIvPjwvYTpobGluaz48YTpmb2xIbGluaz48YTpzcmdiQ2xyIHZhbD0iODAwMDgwIi8+PC9hOmZvbEhsaW5rPjwvYTpjbHJTY2hlbWU+PGE6Zm9udFNjaGVtZSBuYW1lPSJPZmZpY2UiPjxhOm1ham9yRm9udD48YTpsYXRpbiB0eXBlZmFjZT0iQ2FtYnJpYSIvPjxhOmVhIHR5cGVmYWNlPSIiLz48YTpjcyB0eXBlZmFjZT0iIi8+PGE6Zm9udCBzY3JpcHQ9IkpwYW4iIHR5cGVmYWNlPSLvvK3vvLMg77yw44K044K344OD44KvIi8+PGE6Zm9udCBzY3JpcHQ9IkhhbmciIHR5cGVmYWNlPSLrp5HsnYAg6rOg65SVIi8+PGE6Zm9udCBzY3JpcHQ9IkhhbnMiIHR5cGVmYWNlPSLlrovkvZMiLz48YTpmb250IHNjcmlwdD0iSGFudCIgdHlwZWZhY2U9IuaWsOe0sOaYjumrlCIvPjxhOmZvbnQgc2NyaXB0PSJBcmFiIiB0eXBlZmFjZT0iVGltZXMgTmV3IFJvbWFuIi8+PGE6Zm9udCBzY3JpcHQ9IkhlYnIiIHR5cGVmYWNlPSJUaW1lcyBOZXcgUm9tYW4iLz48YTpmb250IHNjcmlwdD0iVGhhaSIgdHlwZWZhY2U9IlRhaG9tYSIvPjxhOmZvbnQgc2NyaXB0PSJFdGhpIiB0eXBlZmFjZT0iTnlhbGEiLz48YTpmb250IHNjcmlwdD0iQmVuZyIgdHlwZWZhY2U9IlZyaW5kYSIvPjxhOmZvbnQgc2NyaXB0PSJHdWpyIiB0eXBlZmFjZT0iU2hydXRpIi8+PGE6Zm9udCBzY3JpcHQ9IktobXIiIHR5cGVmYWNlPSJNb29sQm9yYW4iLz48YTpmb250IHNjcmlwdD0iS25kYSIgdHlwZWZhY2U9IlR1bmdhIi8+PGE6Zm9udCBzY3JpcHQ9Ikd1cnUiIHR5cGVmYWNlPSJSYWF2aSIvPjxhOmZvbnQgc2NyaXB0PSJDYW5zIiB0eXBlZmFjZT0iRXVwaGVtaWEiLz48YTpmb250IHNjcmlwdD0iQ2hlciIgdHlwZWZhY2U9IlBsYW50YWdlbmV0IENoZXJva2VlIi8+PGE6Zm9udCBzY3JpcHQ9IllpaWkiIHR5cGVmYWNlPSJNaWNyb3NvZnQgWWkgQmFpdGkiLz48YTpmb250IHNjcmlwdD0iVGlidCIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBIaW1hbGF5YSIvPjxhOmZvbnQgc2NyaXB0PSJUaGFhIiB0eXBlZmFjZT0iTVYgQm9saSIvPjxhOmZvbnQgc2NyaXB0PSJEZXZhIiB0eXBlZmFjZT0iTWFuZ2FsIi8+PGE6Zm9udCBzY3JpcHQ9IlRlbHUiIHR5cGVmYWNlPSJHYXV0YW1pIi8+PGE6Zm9udCBzY3JpcHQ9IlRhbWwiIHR5cGVmYWNlPSJMYXRoYSIvPjxhOmZvbnQgc2NyaXB0PSJTeXJjIiB0eXBlZmFjZT0iRXN0cmFuZ2VsbyBFZGVzc2EiLz48YTpmb250IHNjcmlwdD0iT3J5YSIgdHlwZWZhY2U9IkthbGluZ2EiLz48YTpmb250IHNjcmlwdD0iTWx5bSIgdHlwZWZhY2U9IkthcnRpa2EiLz48YTpmb250IHNjcmlwdD0iTGFvbyIgdHlwZWZhY2U9IkRva0NoYW1wYSIvPjxhOmZvbnQgc2NyaXB0PSJTaW5oIiB0eXBlZmFjZT0iSXNrb29sYSBQb3RhIi8+PGE6Zm9udCBzY3JpcHQ9Ik1vbmciIHR5cGVmYWNlPSJNb25nb2xpYW4gQmFpdGkiLz48YTpmb250IHNjcmlwdD0iVmlldCIgdHlwZWZhY2U9IlRpbWVzIE5ldyBSb21hbiIvPjxhOmZvbnQgc2NyaXB0PSJVaWdoIiB0eXBlZmFjZT0iTWljcm9zb2Z0IFVpZ2h1ciIvPjxhOmZvbnQgc2NyaXB0PSJHZW9yIiB0eXBlZmFjZT0iU3lsZmFlbiIvPjwvYTptYWpvckZvbnQ+PGE6bWlub3JGb250PjxhOmxhdGluIHR5cGVmYWNlPSJDYWxpYnJpIi8+PGE6ZWEgdHlwZWZhY2U9IiIvPjxhOmNzIHR5cGVmYWNlPSIiLz48YTpmb250IHNjcmlwdD0iSnBhbiIgdHlwZWZhY2U9Iu+8re+8syDvvLDjgrTjgrfjg4Pjgq8iLz48YTpmb250IHNjcmlwdD0iSGFuZyIgdHlwZWZhY2U9IuunkeydgCDqs6DrlJUiLz48YTpmb250IHNjcmlwdD0iSGFucyIgdHlwZWZhY2U9IuWui+S9kyIvPjxhOmZvbnQgc2NyaXB0PSJIYW50IiB0eXBlZmFjZT0i5paw57Sw5piO6auUIi8+PGE6Zm9udCBzY3JpcHQ9IkFyYWIiIHR5cGVmYWNlPSJBcmlhbCIvPjxhOmZvbnQgc2NyaXB0PSJIZWJyIiB0eXBlZmFjZT0iQXJpYWwiLz48YTpmb250IHNjcmlwdD0iVGhhaSIgdHlwZWZhY2U9IlRhaG9tYSIvPjxhOmZvbnQgc2NyaXB0PSJFdGhpIiB0eXBlZmFjZT0iTnlhbGEiLz48YTpmb250IHNjcmlwdD0iQmVuZyIgdHlwZWZhY2U9IlZyaW5kYSIvPjxhOmZvbnQgc2NyaXB0PSJHdWpyIiB0eXBlZmFjZT0iU2hydXRpIi8+PGE6Zm9udCBzY3JpcHQ9IktobXIiIHR5cGVmYWNlPSJEYXVuUGVuaCIvPjxhOmZvbnQgc2NyaXB0PSJLbmRhIiB0eXBlZmFjZT0iVHVuZ2EiLz48YTpmb250IHNjcmlwdD0iR3VydSIgdHlwZWZhY2U9IlJhYXZpIi8+PGE6Zm9udCBzY3JpcHQ9IkNhbnMiIHR5cGVmYWNlPSJFdXBoZW1pYSIvPjxhOmZvbnQgc2NyaXB0PSJDaGVyIiB0eXBlZmFjZT0iUGxhbnRhZ2VuZXQgQ2hlcm9rZWUiLz48YTpmb250IHNjcmlwdD0iWWlpaSIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBZaSBCYWl0aSIvPjxhOmZvbnQgc2NyaXB0PSJUaWJ0IiB0eXBlZmFjZT0iTWljcm9zb2Z0IEhpbWFsYXlhIi8+PGE6Zm9udCBzY3JpcHQ9IlRoYWEiIHR5cGVmYWNlPSJNViBCb2xpIi8+PGE6Zm9udCBzY3JpcHQ9IkRldmEiIHR5cGVmYWNlPSJNYW5nYWwiLz48YTpmb250IHNjcmlwdD0iVGVsdSIgdHlwZWZhY2U9IkdhdXRhbWkiLz48YTpmb250IHNjcmlwdD0iVGFtbCIgdHlwZWZhY2U9IkxhdGhhIi8+PGE6Zm9udCBzY3JpcHQ9IlN5cmMiIHR5cGVmYWNlPSJFc3RyYW5nZWxvIEVkZXNzYSIvPjxhOmZvbnQgc2NyaXB0PSJPcnlhIiB0eXBlZmFjZT0iS2FsaW5nYSIvPjxhOmZvbnQgc2NyaXB0PSJNbHltIiB0eXBlZmFjZT0iS2FydGlrYSIvPjxhOmZvbnQgc2NyaXB0PSJMYW9vIiB0eXBlZmFjZT0iRG9rQ2hhbXBhIi8+PGE6Zm9udCBzY3JpcHQ9IlNpbmgiIHR5cGVmYWNlPSJJc2tvb2xhIFBvdGEiLz48YTpmb250IHNjcmlwdD0iTW9uZyIgdHlwZWZhY2U9Ik1vbmdvbGlhbiBCYWl0aSIvPjxhOmZvbnQgc2NyaXB0PSJWaWV0IiB0eXBlZmFjZT0iQXJpYWwiLz48YTpmb250IHNjcmlwdD0iVWlnaCIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBVaWdodXIiLz48YTpmb250IHNjcmlwdD0iR2VvciIgdHlwZWZhY2U9IlN5bGZhZW4iLz48L2E6bWlub3JGb250PjwvYTpmb250U2NoZW1lPjxhOmZtdFNjaGVtZSBuYW1lPSJPZmZpY2UiPjxhOmZpbGxTdHlsZUxzdD48YTpzb2xpZEZpbGw+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiLz48L2E6c29saWRGaWxsPjxhOmdyYWRGaWxsIHJvdFdpdGhTaGFwZT0iMSI+PGE6Z3NMc3Q+PGE6Z3MgcG9zPSIwIj48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6dGludCB2YWw9IjUwMDAwIi8+PGE6c2F0TW9kIHZhbD0iMzAwMDAwIi8+PC9hOnNjaGVtZUNscj48L2E6Z3M+PGE6Z3MgcG9zPSIzNTAwMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnRpbnQgdmFsPSIzNzAwMCIvPjxhOnNhdE1vZCB2YWw9IjMwMDAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjxhOmdzIHBvcz0iMTAwMDAwIj48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6dGludCB2YWw9IjE1MDAwIi8+PGE6c2F0TW9kIHZhbD0iMzUwMDAwIi8+PC9hOnNjaGVtZUNscj48L2E6Z3M+PC9hOmdzTHN0PjxhOmxpbiBhbmc9IjE2MjAwMDAwIiBzY2FsZWQ9IjEiLz48L2E6Z3JhZEZpbGw+PGE6Z3JhZEZpbGwgcm90V2l0aFNoYXBlPSIxIj48YTpnc0xzdD48YTpncyBwb3M9IjAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTp0aW50IHZhbD0iMTAwMDAwIi8+PGE6c2hhZGUgdmFsPSIxMDAwMDAiLz48YTpzYXRNb2QgdmFsPSIxMzAwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjEwMDAwMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnRpbnQgdmFsPSI1MDAwMCIvPjxhOnNoYWRlIHZhbD0iMTAwMDAwIi8+PGE6c2F0TW9kIHZhbD0iMzUwMDAwIi8+PC9hOnNjaGVtZUNscj48L2E6Z3M+PC9hOmdzTHN0PjxhOmxpbiBhbmc9IjE2MjAwMDAwIiBzY2FsZWQ9IjAiLz48L2E6Z3JhZEZpbGw+PC9hOmZpbGxTdHlsZUxzdD48YTpsblN0eWxlTHN0PjxhOmxuIHc9Ijk1MjUiIGNhcD0iZmxhdCIgY21wZD0ic25nIiBhbGduPSJjdHIiPjxhOnNvbGlkRmlsbD48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6c2hhZGUgdmFsPSI5NTAwMCIvPjxhOnNhdE1vZCB2YWw9IjEwNTAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOnNvbGlkRmlsbD48YTpwcnN0RGFzaCB2YWw9InNvbGlkIi8+PC9hOmxuPjxhOmxuIHc9IjI1NDAwIiBjYXA9ImZsYXQiIGNtcGQ9InNuZyIgYWxnbj0iY3RyIj48YTpzb2xpZEZpbGw+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiLz48L2E6c29saWRGaWxsPjxhOnByc3REYXNoIHZhbD0ic29saWQiLz48L2E6bG4+PGE6bG4gdz0iMzgxMDAiIGNhcD0iZmxhdCIgY21wZD0ic25nIiBhbGduPSJjdHIiPjxhOnNvbGlkRmlsbD48YTpzY2hlbWVDbHIgdmFsPSJwaENsciIvPjwvYTpzb2xpZEZpbGw+PGE6cHJzdERhc2ggdmFsPSJzb2xpZCIvPjwvYTpsbj48L2E6bG5TdHlsZUxzdD48YTplZmZlY3RTdHlsZUxzdD48YTplZmZlY3RTdHlsZT48YTplZmZlY3RMc3Q+PGE6b3V0ZXJTaGR3IGJsdXJSYWQ9IjQwMDAwIiBkaXN0PSIyMDAwMCIgZGlyPSI1NDAwMDAwIiByb3RXaXRoU2hhcGU9IjAiPjxhOnNyZ2JDbHIgdmFsPSIwMDAwMDAiPjxhOmFscGhhIHZhbD0iMzgwMDAiLz48L2E6c3JnYkNscj48L2E6b3V0ZXJTaGR3PjwvYTplZmZlY3RMc3Q+PC9hOmVmZmVjdFN0eWxlPjxhOmVmZmVjdFN0eWxlPjxhOmVmZmVjdExzdD48YTpvdXRlclNoZHcgYmx1clJhZD0iNDAwMDAiIGRpc3Q9IjIzMDAwIiBkaXI9IjU0MDAwMDAiIHJvdFdpdGhTaGFwZT0iMCI+PGE6c3JnYkNsciB2YWw9IjAwMDAwMCI+PGE6YWxwaGEgdmFsPSIzNTAwMCIvPjwvYTpzcmdiQ2xyPjwvYTpvdXRlclNoZHc+PC9hOmVmZmVjdExzdD48L2E6ZWZmZWN0U3R5bGU+PGE6ZWZmZWN0U3R5bGU+PGE6ZWZmZWN0THN0PjxhOm91dGVyU2hkdyBibHVyUmFkPSI0MDAwMCIgZGlzdD0iMjMwMDAiIGRpcj0iNTQwMDAwMCIgcm90V2l0aFNoYXBlPSIwIj48YTpzcmdiQ2xyIHZhbD0iMDAwMDAwIj48YTphbHBoYSB2YWw9IjM1MDAwIi8+PC9hOnNyZ2JDbHI+PC9hOm91dGVyU2hkdz48L2E6ZWZmZWN0THN0PjxhOnNjZW5lM2Q+PGE6Y2FtZXJhIHByc3Q9Im9ydGhvZ3JhcGhpY0Zyb250Ij48YTpyb3QgbGF0PSIwIiBsb249IjAiIHJldj0iMCIvPjwvYTpjYW1lcmE+PGE6bGlnaHRSaWcgcmlnPSJ0aHJlZVB0IiBkaXI9InQiPjxhOnJvdCBsYXQ9IjAiIGxvbj0iMCIgcmV2PSIxMjAwMDAwIi8+PC9hOmxpZ2h0UmlnPjwvYTpzY2VuZTNkPjxhOnNwM2Q+PGE6YmV2ZWxUIHc9IjYzNTAwIiBoPSIyNTQwMCIvPjwvYTpzcDNkPjwvYTplZmZlY3RTdHlsZT48L2E6ZWZmZWN0U3R5bGVMc3Q+PGE6YmdGaWxsU3R5bGVMc3Q+PGE6c29saWRGaWxsPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIi8+PC9hOnNvbGlkRmlsbD48YTpncmFkRmlsbCByb3RXaXRoU2hhcGU9IjEiPjxhOmdzTHN0PjxhOmdzIHBvcz0iMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnRpbnQgdmFsPSI0MDAwMCIvPjxhOnNhdE1vZCB2YWw9IjM1MDAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjxhOmdzIHBvcz0iNDAwMDAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTp0aW50IHZhbD0iNDUwMDAiLz48YTpzaGFkZSB2YWw9Ijk5MDAwIi8+PGE6c2F0TW9kIHZhbD0iMzUwMDAwIi8+PC9hOnNjaGVtZUNscj48L2E6Z3M+PGE6Z3MgcG9zPSIxMDAwMDAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTpzaGFkZSB2YWw9IjIwMDAwIi8+PGE6c2F0TW9kIHZhbD0iMjU1MDAwIi8+PC9hOnNjaGVtZUNscj48L2E6Z3M+PC9hOmdzTHN0PjxhOnBhdGggcGF0aD0iY2lyY2xlIj48YTpmaWxsVG9SZWN0IGw9IjUwMDAwIiB0PSItODAwMDAiIHI9IjUwMDAwIiBiPSIxODAwMDAiLz48L2E6cGF0aD48L2E6Z3JhZEZpbGw+PGE6Z3JhZEZpbGwgcm90V2l0aFNoYXBlPSIxIj48YTpnc0xzdD48YTpncyBwb3M9IjAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTp0aW50IHZhbD0iODAwMDAiLz48YTpzYXRNb2QgdmFsPSIzMDAwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjEwMDAwMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnNoYWRlIHZhbD0iMzAwMDAiLz48YTpzYXRNb2QgdmFsPSIyMDAwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48L2E6Z3NMc3Q+PGE6cGF0aCBwYXRoPSJjaXJjbGUiPjxhOmZpbGxUb1JlY3QgbD0iNTAwMDAiIHQ9IjUwMDAwIiByPSI1MDAwMCIgYj0iNTAwMDAiLz48L2E6cGF0aD48L2E6Z3JhZEZpbGw+PC9hOmJnRmlsbFN0eWxlTHN0PjwvYTpmbXRTY2hlbWU+PC9hOnRoZW1lRWxlbWVudHM+PGE6b2JqZWN0RGVmYXVsdHM+PGE6c3BEZWY+PGE6c3BQci8+PGE6Ym9keVByLz48YTpsc3RTdHlsZS8+PGE6c3R5bGU+PGE6bG5SZWYgaWR4PSIxIj48YTpzY2hlbWVDbHIgdmFsPSJhY2NlbnQxIi8+PC9hOmxuUmVmPjxhOmZpbGxSZWYgaWR4PSIzIj48YTpzY2hlbWVDbHIgdmFsPSJhY2NlbnQxIi8+PC9hOmZpbGxSZWY+PGE6ZWZmZWN0UmVmIGlkeD0iMiI+PGE6c2NoZW1lQ2xyIHZhbD0iYWNjZW50MSIvPjwvYTplZmZlY3RSZWY+PGE6Zm9udFJlZiBpZHg9Im1pbm9yIj48YTpzY2hlbWVDbHIgdmFsPSJsdDEiLz48L2E6Zm9udFJlZj48L2E6c3R5bGU+PC9hOnNwRGVmPjxhOmxuRGVmPjxhOnNwUHIvPjxhOmJvZHlQci8+PGE6bHN0U3R5bGUvPjxhOnN0eWxlPjxhOmxuUmVmIGlkeD0iMiI+PGE6c2NoZW1lQ2xyIHZhbD0iYWNjZW50MSIvPjwvYTpsblJlZj48YTpmaWxsUmVmIGlkeD0iMCI+PGE6c2NoZW1lQ2xyIHZhbD0iYWNjZW50MSIvPjwvYTpmaWxsUmVmPjxhOmVmZmVjdFJlZiBpZHg9IjEiPjxhOnNjaGVtZUNsciB2YWw9ImFjY2VudDEiLz48L2E6ZWZmZWN0UmVmPjxhOmZvbnRSZWYgaWR4PSJtaW5vciI+PGE6c2NoZW1lQ2xyIHZhbD0idHgxIi8+PC9hOmZvbnRSZWY+PC9hOnN0eWxlPjwvYTpsbkRlZj48L2E6b2JqZWN0RGVmYXVsdHM+PGE6ZXh0cmFDbHJTY2hlbWVMc3QvPjwvYTp0aGVtZT5QSwMEFAAAAAAAAAAAAFX0BJRaBAAAWgQAAA0AAAB4bC9zdHlsZXMueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPHN0eWxlU2hlZXQgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9zcHJlYWRzaGVldG1sLzIwMDYvbWFpbiIgeG1sbnM6dnQ9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L2RvY1Byb3BzVlR5cGVzIj48bnVtRm10cyBjb3VudD0iMSI+PG51bUZtdCBudW1GbXRJZD0iNTYiIGZvcm1hdENvZGU9IiZxdW90O+S4iuWNiC/kuIvljYggJnF1b3Q7aGgmcXVvdDvmmYImcXVvdDttbSZxdW90O+WIhiZxdW90O3NzJnF1b3Q756eSICZxdW90OyIvPjwvbnVtRm10cz48Zm9udHMgY291bnQ9IjEiPjxmb250PjxzeiB2YWw9IjEyIi8+PGNvbG9yIHRoZW1lPSIxIi8+PG5hbWUgdmFsPSJDYWxpYnJpIi8+PGZhbWlseSB2YWw9IjIiLz48c2NoZW1lIHZhbD0ibWlub3IiLz48L2ZvbnQ+PC9mb250cz48ZmlsbHMgY291bnQ9IjIiPjxmaWxsPjxwYXR0ZXJuRmlsbCBwYXR0ZXJuVHlwZT0ibm9uZSIvPjwvZmlsbD48ZmlsbD48cGF0dGVybkZpbGwgcGF0dGVyblR5cGU9ImdyYXkxMjUiLz48L2ZpbGw+PC9maWxscz48Ym9yZGVycyBjb3VudD0iMSI+PGJvcmRlcj48bGVmdC8+PHJpZ2h0Lz48dG9wLz48Ym90dG9tLz48ZGlhZ29uYWwvPjwvYm9yZGVyPjwvYm9yZGVycz48Y2VsbFN0eWxlWGZzIGNvdW50PSIxIj48eGYgbnVtRm10SWQ9IjAiIGZvbnRJZD0iMCIgZmlsbElkPSIwIiBib3JkZXJJZD0iMCIvPjwvY2VsbFN0eWxlWGZzPjxjZWxsWGZzIGNvdW50PSIxIj48eGYgbnVtRm10SWQ9IjAiIGZvbnRJZD0iMCIgZmlsbElkPSIwIiBib3JkZXJJZD0iMCIgeGZJZD0iMCIgYXBwbHlOdW1iZXJGb3JtYXQ9IjEiLz48L2NlbGxYZnM+PGNlbGxTdHlsZXMgY291bnQ9IjEiPjxjZWxsU3R5bGUgbmFtZT0iTm9ybWFsIiB4ZklkPSIwIiBidWlsdGluSWQ9IjAiLz48L2NlbGxTdHlsZXM+PGR4ZnMgY291bnQ9IjAiLz48dGFibGVTdHlsZXMgY291bnQ9IjAiIGRlZmF1bHRUYWJsZVN0eWxlPSJUYWJsZVN0eWxlTWVkaXVtOSIgZGVmYXVsdFBpdm90U3R5bGU9IlBpdm90U3R5bGVNZWRpdW00Ii8+PC9zdHlsZVNoZWV0PlBLAwQUAAAAAAAAAAAAzEk556oJAACqCQAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4NCjx3b3Jrc2hlZXQgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9zcHJlYWRzaGVldG1sLzIwMDYvbWFpbiIgeG1sbnM6cj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcyI+PGRpbWVuc2lvbiByZWY9IkExOko0Ii8+PHNoZWV0Vmlld3M+PHNoZWV0VmlldyB3b3JrYm9va1ZpZXdJZD0iMCIvPjwvc2hlZXRWaWV3cz48Y29scz48Y29sIG1pbj0iMSIgbWF4PSIxIiB3aWR0aD0iMTYuODMyMDMxMjUiIGN1c3RvbVdpZHRoPSIxIi8+PGNvbCBtaW49IjIiIG1heD0iMiIgd2lkdGg9IjE2LjgzMjAzMTI1IiBjdXN0b21XaWR0aD0iMSIvPjxjb2wgbWluPSIzIiBtYXg9IjMiIHdpZHRoPSIxNi44MzIwMzEyNSIgY3VzdG9tV2lkdGg9IjEiLz48Y29sIG1pbj0iNCIgbWF4PSI0IiB3aWR0aD0iMTYuODMyMDMxMjUiIGN1c3RvbVdpZHRoPSIxIi8+PGNvbCBtaW49IjUiIG1heD0iNSIgd2lkdGg9IjE2LjgzMjAzMTI1IiBjdXN0b21XaWR0aD0iMSIvPjxjb2wgbWluPSI2IiBtYXg9IjYiIHdpZHRoPSIxNi44MzIwMzEyNSIgY3VzdG9tV2lkdGg9IjEiLz48Y29sIG1pbj0iNyIgbWF4PSI3IiB3aWR0aD0iMTYuODMyMDMxMjUiIGN1c3RvbVdpZHRoPSIxIi8+PGNvbCBtaW49IjgiIG1heD0iOCIgd2lkdGg9IjE5LjgzMjAzMTI1IiBjdXN0b21XaWR0aD0iMSIvPjxjb2wgbWluPSI5IiBtYXg9IjkiIHdpZHRoPSIyNC44MzIwMzEyNSIgY3VzdG9tV2lkdGg9IjEiLz48Y29sIG1pbj0iMTAiIG1heD0iMTAiIHdpZHRoPSIxNi44MzIwMzEyNSIgY3VzdG9tV2lkdGg9IjEiLz48L2NvbHM+PHNoZWV0RGF0YT48cm93IHI9IjEiPjxjIHI9IkExIiB0PSJzdHIiPjx2Pk5hbWU8L3Y+PC9jPjxjIHI9IkIxIiB0PSJzdHIiPjx2PkVtYWlsPC92PjwvYz48YyByPSJDMSIgdD0ic3RyIj48dj5QaG9uZTwvdj48L2M+PGMgcj0iRDEiIHQ9InN0ciI+PHY+Q2F0ZWdvcnk8L3Y+PC9jPjxjIHI9IkUxIiB0PSJzdHIiPjx2PlJTVlA8L3Y+PC9jPjxjIHI9IkYxIiB0PSJzdHIiPjx2PlRhYmxlPC92PjwvYz48YyByPSJHMSIgdD0ic3RyIj48dj5QbHVzIE9uZTwvdj48L2M+PGMgcj0iSDEiIHQ9InN0ciI+PHY+TWVhbCBQcmVmZXJlbmNlPC92PjwvYz48YyByPSJJMSIgdD0ic3RyIj48dj5EaWV0YXJ5IFJlc3RyaWN0aW9uczwvdj48L2M+PGMgcj0iSjEiIHQ9InN0ciI+PHY+Tm90ZXM8L3Y+PC9jPjwvcm93Pjxyb3cgcj0iMiI+PGMgcj0iQTIiIHQ9InN0ciI+PHY+Sm9yZ2UgTG9wZXo8L3Y+PC9jPjxjIHI9IkIyIiB0PSJzdHIiPjx2PmpvcmdlQGVtYWlsLmNvbTwvdj48L2M+PGMgcj0iQzIiIHQ9InN0ciI+PHY+NTU1LTAwMDE8L3Y+PC9jPjxjIHI9IkQyIiB0PSJzdHIiPjx2PkZhbWlseTwvdj48L2M+PGMgcj0iRTIiIHQ9InN0ciI+PHY+Y29uZmlybWVkPC92PjwvYz48YyByPSJGMiIgdD0ic3RyIj48dj4xPC92PjwvYz48YyByPSJHMiIgdD0ic3RyIj48dj55ZXM8L3Y+PC9jPjxjIHI9IkgyIiB0PSJzdHIiPjx2PkNoaWNrZW48L3Y+PC9jPjxjIHI9IkkyIiB0PSJzdHIiPjx2Pjwvdj48L2M+PGMgcj0iSjIiIHQ9InN0ciI+PHY+VklQIGd1ZXN0PC92PjwvYz48L3Jvdz48cm93IHI9IjMiPjxjIHI9IkEzIiB0PSJzdHIiPjx2PkFuYSBNYXJ0aW5lejwvdj48L2M+PGMgcj0iQjMiIHQ9InN0ciI+PHY+YW5hQGVtYWlsLmNvbTwvdj48L2M+PGMgcj0iQzMiIHQ9InN0ciI+PHY+NTU1LTAwMDI8L3Y+PC9jPjxjIHI9IkQzIiB0PSJzdHIiPjx2PkZyaWVuZHM8L3Y+PC9jPjxjIHI9IkUzIiB0PSJzdHIiPjx2PnBlbmRpbmc8L3Y+PC9jPjxjIHI9IkYzIiB0PSJzdHIiPjx2PjI8L3Y+PC9jPjxjIHI9IkczIiB0PSJzdHIiPjx2Pm5vPC92PjwvYz48YyByPSJIMyIgdD0ic3RyIj48dj5WZWdldGFyaWFuPC92PjwvYz48YyByPSJJMyIgdD0ic3RyIj48dj5HbHV0ZW4tZnJlZTwvdj48L2M+PGMgcj0iSjMiIHQ9InN0ciI+PHY+PC92PjwvYz48L3Jvdz48cm93IHI9IjQiPjxjIHI9IkE0IiB0PSJzdHIiPjx2PkNhcmxvcyBSdWl6PC92PjwvYz48YyByPSJCNCIgdD0ic3RyIj48dj48L3Y+PC9jPjxjIHI9IkM0IiB0PSJzdHIiPjx2Pjwvdj48L2M+PGMgcj0iRDQiIHQ9InN0ciI+PHY+V29yazwvdj48L2M+PGMgcj0iRTQiIHQ9InN0ciI+PHY+cGVuZGluZzwvdj48L2M+PGMgcj0iRjQiIHQ9InN0ciI+PHY+PC92PjwvYz48YyByPSJHNCIgdD0ic3RyIj48dj48L3Y+PC9jPjxjIHI9Ikg0IiB0PSJzdHIiPjx2Pjwvdj48L2M+PGMgcj0iSTQiIHQ9InN0ciI+PHY+PC92PjwvYz48YyByPSJKNCIgdD0ic3RyIj48dj48L3Y+PC9jPjwvcm93Pjwvc2hlZXREYXRhPjxpZ25vcmVkRXJyb3JzPjxpZ25vcmVkRXJyb3IgbnVtYmVyU3RvcmVkQXNUZXh0PSIxIiBzcXJlZj0iQTE6SjQiLz48L2lnbm9yZWRFcnJvcnM+PC93b3Jrc2hlZXQ+UEsDBBQAAAAAAAAAAABggACBiAMAAIgDAAAPAAAAeGwvbWV0YWRhdGEueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPG1ldGFkYXRhIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvc3ByZWFkc2hlZXRtbC8yMDA2L21haW4iIHhtbG5zOnhscmQ9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxNy9yaWNoZGF0YSIgeG1sbnM6eGRhPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9zcHJlYWRzaGVldG1sLzIwMTcvZHluYW1pY2FycmF5Ij4KICA8bWV0YWRhdGFUeXBlcyBjb3VudD0iMSI+CiAgICA8bWV0YWRhdGFUeXBlIG5hbWU9IlhMREFQUiIgbWluU3VwcG9ydGVkVmVyc2lvbj0iMTIwMDAwIiBjb3B5PSIxIiBwYXN0ZUFsbD0iMSIgcGFzdGVWYWx1ZXM9IjEiIG1lcmdlPSIxIiBzcGxpdEZpcnN0PSIxIiByb3dDb2xTaGlmdD0iMSIgY2xlYXJGb3JtYXRzPSIxIiBjbGVhckNvbW1lbnRzPSIxIiBhc3NpZ249IjEiIGNvZXJjZT0iMSIgY2VsbE1ldGE9IjEiLz4KICA8L21ldGFkYXRhVHlwZXM+CiAgPGZ1dHVyZU1ldGFkYXRhIG5hbWU9IlhMREFQUiIgY291bnQ9IjEiPgogICAgPGJrPgogICAgICA8ZXh0THN0PgogICAgICAgIDxleHQgdXJpPSJ7YmRiYjhjZGMtZmExZS00OTZlLWE4NTctM2MzZjMwYzAyOWMzfSI+CiAgICAgICAgICA8eGRhOmR5bmFtaWNBcnJheVByb3BlcnRpZXMgZkR5bmFtaWM9IjEiIGZDb2xsYXBzZWQ9IjAiLz4KICAgICAgICA8L2V4dD4KICAgICAgPC9leHRMc3Q+CiAgICA8L2JrPgogIDwvZnV0dXJlTWV0YWRhdGE+CiAgPGNlbGxNZXRhZGF0YSBjb3VudD0iMSI+CiAgICA8Yms+CiAgICAgIDxyYyB0PSIxIiB2PSIwIi8+CiAgICA8L2JrPgogIDwvY2VsbE1ldGFkYXRhPgo8L21ldGFkYXRhPlBLAwQUAAAAAAAAAAAAOWnOwEIBAABCAQAADwAAAHhsL3dvcmtib29rLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4NCjx3b3JrYm9vayB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NwcmVhZHNoZWV0bWwvMjAwNi9tYWluIiB4bWxuczpyPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzIj48d29ya2Jvb2tQciBjb2RlTmFtZT0iVGhpc1dvcmtib29rIi8+PHNoZWV0cz48c2hlZXQgbmFtZT0iR3Vlc3RzIiBzaGVldElkPSIxIiByOmlkPSJySWQxIi8+PC9zaGVldHM+PC93b3JrYm9vaz5QSwMEFAAAAAAAAAAAAEpqEflMAgAATAIAAAsAAABfcmVscy8ucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4NCjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDIiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcy9tZXRhZGF0YS9jb3JlLXByb3BlcnRpZXMiIFRhcmdldD0iZG9jUHJvcHMvY29yZS54bWwiLz48UmVsYXRpb25zaGlwIElkPSJySWQzIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL2V4dGVuZGVkLXByb3BlcnRpZXMiIFRhcmdldD0iZG9jUHJvcHMvYXBwLnhtbCIvPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0ieGwvd29ya2Jvb2sueG1sIi8+PC9SZWxhdGlvbnNoaXBzPlBLAwQUAAAAAAAAAAAAV2BHYTICAAAyAgAAEAAAAGRvY1Byb3BzL2FwcC54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+DQo8UHJvcGVydGllcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvZXh0ZW5kZWQtcHJvcGVydGllcyIgeG1sbnM6dnQ9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L2RvY1Byb3BzVlR5cGVzIj48QXBwbGljYXRpb24+U2hlZXRKUzwvQXBwbGljYXRpb24+PEhlYWRpbmdQYWlycz48dnQ6dmVjdG9yIHNpemU9IjIiIGJhc2VUeXBlPSJ2YXJpYW50Ij48dnQ6dmFyaWFudD48dnQ6bHBzdHI+V29ya3NoZWV0czwvdnQ6bHBzdHI+PC92dDp2YXJpYW50Pjx2dDp2YXJpYW50Pjx2dDppND4xPC92dDppND48L3Z0OnZhcmlhbnQ+PC92dDp2ZWN0b3I+PC9IZWFkaW5nUGFpcnM+PFRpdGxlc09mUGFydHM+PHZ0OnZlY3RvciBzaXplPSIxIiBiYXNlVHlwZT0ibHBzdHIiPjx2dDpscHN0cj5HdWVzdHM8L3Z0Omxwc3RyPjwvdnQ6dmVjdG9yPjwvVGl0bGVzT2ZQYXJ0cz48L1Byb3BlcnRpZXM+UEsDBBQAAAAAAAAAAADWknwRWgEAAFoBAAARAAAAZG9jUHJvcHMvY29yZS54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+DQo8Y3A6Y29yZVByb3BlcnRpZXMgeG1sbnM6Y3A9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvbWV0YWRhdGEvY29yZS1wcm9wZXJ0aWVzIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOmRjdGVybXM9Imh0dHA6Ly9wdXJsLm9yZy9kYy90ZXJtcy8iIHhtbG5zOmRjbWl0eXBlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvIiB4bWxuczp4c2k9Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hLWluc3RhbmNlIi8+UEsDBBQAAAAAAAAAAACo12qAFQgAABUIAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4NCjxUeXBlcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9jb250ZW50LXR5cGVzIiB4bWxuczp4c2Q9Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hIiB4bWxuczp4c2k9Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hLWluc3RhbmNlIj48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxEZWZhdWx0IEV4dGVuc2lvbj0iYmluIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm1zLWV4Y2VsLnNoZWV0LmJpbmFyeS5tYWNyb0VuYWJsZWQubWFpbiIvPjxEZWZhdWx0IEV4dGVuc2lvbj0idm1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnZtbERyYXdpbmciLz48RGVmYXVsdCBFeHRlbnNpb249ImRhdGEiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQubW9kZWwrZGF0YSIvPjxEZWZhdWx0IEV4dGVuc2lvbj0iYm1wIiBDb250ZW50VHlwZT0iaW1hZ2UvYm1wIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJwbmciIENvbnRlbnRUeXBlPSJpbWFnZS9wbmciLz48RGVmYXVsdCBFeHRlbnNpb249ImdpZiIgQ29udGVudFR5cGU9ImltYWdlL2dpZiIvPjxEZWZhdWx0IEV4dGVuc2lvbj0iZW1mIiBDb250ZW50VHlwZT0iaW1hZ2UveC1lbWYiLz48RGVmYXVsdCBFeHRlbnNpb249IndtZiIgQ29udGVudFR5cGU9ImltYWdlL3gtd21mIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJqcGciIENvbnRlbnRUeXBlPSJpbWFnZS9qcGVnIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJqcGVnIiBDb250ZW50VHlwZT0iaW1hZ2UvanBlZyIvPjxEZWZhdWx0IEV4dGVuc2lvbj0idGlmIiBDb250ZW50VHlwZT0iaW1hZ2UvdGlmZiIvPjxEZWZhdWx0IEV4dGVuc2lvbj0idGlmZiIgQ29udGVudFR5cGU9ImltYWdlL3RpZmYiLz48RGVmYXVsdCBFeHRlbnNpb249InBkZiIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3BkZiIvPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIveGwvd29ya2Jvb2sueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hlZXQubWFpbit4bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC93b3Jrc2hlZXRzL3NoZWV0MS54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC53b3Jrc2hlZXQreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIveGwvdGhlbWUvdGhlbWUxLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC50aGVtZSt4bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC9zdHlsZXMueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc3R5bGVzK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL2RvY1Byb3BzL2NvcmUueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UuY29yZS1wcm9wZXJ0aWVzK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL2RvY1Byb3BzL2FwcC54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuZXh0ZW5kZWQtcHJvcGVydGllcyt4bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC9tZXRhZGF0YS54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldE1ldGFkYXRhK3htbCIvPjwvVHlwZXM+UEsBAgAAFAAAAAAAAAAAAKQBhLi1AgAAtQIAABoAAAAAAAAAAAAAAAAAAAAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAgAAFAAAAAAAAAAAADAPiGveHQAA3h0AABMAAAAAAAAAAAAAAAAA7QIAAHhsL3RoZW1lL3RoZW1lMS54bWxQSwECAAAUAAAAAAAAAAAAVfQElFoEAABaBAAADQAAAAAAAAAAAAAAAAD8IAAAeGwvc3R5bGVzLnhtbFBLAQIAABQAAAAAAAAAAADMSTnnqgkAAKoJAAAYAAAAAAAAAAAAAAAAAIElAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECAAAUAAAAAAAAAAAAYIAAgYgDAACIAwAADwAAAAAAAAAAAAAAAABhLwAAeGwvbWV0YWRhdGEueG1sUEsBAgAAFAAAAAAAAAAAADlpzsBCAQAAQgEAAA8AAAAAAAAAAAAAAAAAFjMAAHhsL3dvcmtib29rLnhtbFBLAQIAABQAAAAAAAAAAABKahH5TAIAAEwCAAALAAAAAAAAAAAAAAAAAIU0AABfcmVscy8ucmVsc1BLAQIAABQAAAAAAAAAAABXYEdhMgIAADICAAAQAAAAAAAAAAAAAAAAAPo2AABkb2NQcm9wcy9hcHAueG1sUEsBAgAAFAAAAAAAAAAAANaSfBFaAQAAWgEAABEAAAAAAAAAAAAAAAAAWjkAAGRvY1Byb3BzL2NvcmUueG1sUEsBAgAAFAAAAAAAAAAAAKjXaoAVCAAAFQgAABMAAAAAAAAAAAAAAAAA4zoAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAoACgB7AgAAKUMAAAAA';
function downloadGuestTemplate(){
  const byteChars = atob(GUEST_TEMPLATE_B64);
  const byteArr = new Uint8Array(byteChars.length);
  for(let i=0;i<byteChars.length;i++) byteArr[i]=byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='EventOS_Guests_Template.xlsx';
  a.click(); URL.revokeObjectURL(url);
  toast('Template downloaded!','s');
}
function renderLightboxDock(){
  var dockWrap = document.getElementById('lightbox-dock-wrap');
  var dock = document.getElementById('lightbox-dock');
  if(!_lightboxItems.length){
    dockWrap.classList.remove('show');
    dock.innerHTML = '';
    return;
  }
  dockWrap.classList.add('show');
  dock.innerHTML = _lightboxItems.map(function(item, idx){
    return '<button class="lightbox-thumb'+(idx===_lightboxIndex?' active':'')+'" onclick="event.stopPropagation();lightboxGo('+idx+')" aria-label="'+esc(item.name||('Image '+(idx+1)))+'">'
      +'<img src="'+item.src+'" alt="'+esc(item.name||('Image '+(idx+1)))+'">'
      +'</button>';
  }).join('');
}

function syncLightbox(){
  const lb = document.getElementById('lightbox');
  var current = _lightboxItems[_lightboxIndex] || null;
  var prevBtn = document.querySelector('.lightbox-nav-prev');
  var nextBtn = document.querySelector('.lightbox-nav-next');
  if(!current) return;
  document.getElementById('lightbox-img').src = current.src;
  document.getElementById('lightbox-img').alt = current.name || '';
  document.getElementById('lightbox-caption').textContent = current.name || '';
  if(prevBtn) prevBtn.style.display = _lightboxItems.length > 1 ? 'flex' : 'none';
  if(nextBtn) nextBtn.style.display = _lightboxItems.length > 1 ? 'flex' : 'none';
  renderLightboxDock();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openLightbox(src, caption, items, index){
  _lightboxItems = Array.isArray(items) && items.length ? items : [{ src: src, name: caption || '' }];
  _lightboxIndex = typeof index === 'number' ? index : 0;
  syncLightbox();
}

function lightboxGo(index){
  if(!_lightboxItems.length) return;
  _lightboxIndex = (index + _lightboxItems.length) % _lightboxItems.length;
  syncLightbox();
}

function lightboxPrev(){
  if(_lightboxItems.length <= 1) return;
  lightboxGo(_lightboxIndex - 1);
}

function lightboxNext(){
  if(_lightboxItems.length <= 1) return;
  lightboxGo(_lightboxIndex + 1);
}

function closeLightbox(e){
  if(e && e.target !== document.getElementById('lightbox') && !e.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') { document.getElementById('lightbox').classList.remove('open'); document.body.style.overflow=''; }
  else if(e.key === 'ArrowLeft' && document.getElementById('lightbox').classList.contains('open')) lightboxPrev();
  else if(e.key === 'ArrowRight' && document.getElementById('lightbox').classList.contains('open')) lightboxNext();
});

function toast(msg,type=''){
  const c=document.getElementById('toast-c');
  const t=document.createElement('div');
  t.className='toast '+(type==='s'?'s':type==='e'?'e':'');
  t.innerHTML=(type==='s'?'✓':type==='e'?'✕':'ℹ')+' '+fixMojibake(msg);
  c.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
}

function today(){
  var dt = new Date();
  var y = dt.getFullYear();
  var m = String(dt.getMonth()+1).padStart(2,'0');
  var d = String(dt.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
}
function formatDMY(s){
  var isMDY = (typeof DATE_FORMAT!=='undefined' && DATE_FORMAT==='MDY');
  var placeholder = isMDY ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
  if(!s) return placeholder;
  function _fmt(dd,mm,yy){ return isMDY ? mm+'/'+dd+'/'+yy : dd+'/'+mm+'/'+yy; }
  if(s instanceof Date && !isNaN(s.getTime())){
    return _fmt(String(s.getDate()).padStart(2,'0'),String(s.getMonth()+1).padStart(2,'0'),s.getFullYear());
  }
  var str = String(s).trim();
  if(!str) return placeholder;
  var m1 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m1) return _fmt(m1[3],m1[2],m1[1]);
  var m2 = str.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if(m2) return _fmt(m2[3],m2[2],m2[1]);
  var m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m3) return _fmt(String(m3[1]).padStart(2,'0'),String(m3[2]).padStart(2,'0'),m3[3]);
  var dt = new Date(str);
  if(!isNaN(dt.getTime())){
    return _fmt(String(dt.getDate()).padStart(2,'0'),String(dt.getMonth()+1).padStart(2,'0'),dt.getFullYear());
  }
  return str;
}
function parseUserDate(s){
  if(!s) return '';
  var str = String(s).trim();
  if(!str) return '';
  var isMDY = (typeof DATE_FORMAT!=='undefined' && DATE_FORMAT==='MDY');
  // MM/DD/YYYY or DD/MM/YYYY depending on format
  var m1 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m1){
    if(isMDY) return m1[3]+'-'+m1[1]+'-'+m1[2]; // m1[1]=MM, m1[2]=DD
    return m1[3]+'-'+m1[2]+'-'+m1[1]; // m1[1]=DD, m1[2]=MM
  }
  var m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m2) return str;
  var dt = new Date(str);
  if(!isNaN(dt.getTime())){
    return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  }
  return '';
}
function normalizeDateInput(el){
  if(!el) return '';
  var iso = parseUserDate(el.value);
  if(iso) el.value = formatDMY(iso);
  return iso;
}
var _calendarPicker = { targetId:null, month:null };
function openCalendarPicker(id){
  var input = document.getElementById(id);
  if(!input) return;
  var iso = parseUserDate(input.value) || today();
  var parts = iso.split('-');
  _calendarPicker.targetId = id;
  _calendarPicker.month = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  renderCalendarPicker();
  positionCalendarPicker(input);
}
function closeCalendarPicker(){
  var picker = document.getElementById('calendar-picker');
  if(picker) picker.classList.remove('open');
  _calendarPicker.targetId = null;
}
function positionCalendarPicker(input){
  var picker = document.getElementById('calendar-picker');
  if(!picker || !input) return;
  picker.style.visibility = 'hidden';
  picker.classList.add('open');
  var rect = input.getBoundingClientRect();
  var top = rect.bottom + window.scrollY + 8;
  var left = rect.left + window.scrollX;
  var pickerWidth = picker.offsetWidth || 302;
  var viewportRight = window.scrollX + document.documentElement.clientWidth - 12;
  if(left + pickerWidth > viewportRight) left = Math.max(12 + window.scrollX, viewportRight - pickerWidth);
  picker.style.top = top + 'px';
  picker.style.left = left + 'px';
  picker.style.visibility = 'visible';
}
function shiftCalendarPicker(delta){
  if(!_calendarPicker.month) return;
  _calendarPicker.month = new Date(_calendarPicker.month.getFullYear(), _calendarPicker.month.getMonth() + delta, 1);
  renderCalendarPicker();
}
function selectCalendarDate(iso){
  if(!_calendarPicker.targetId) return;
  var input = document.getElementById(_calendarPicker.targetId);
  if(input){
    input.value = formatDMY(iso);
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }
  closeCalendarPicker();
}
function renderCalendarPicker(){
  var picker = document.getElementById('calendar-picker');
  if(!picker){
    picker = document.createElement('div');
    picker.id = 'calendar-picker';
    picker.className = 'calendar-picker';
    ['pointerdown','mousedown','click'].forEach(function(evt){
      picker.addEventListener(evt, function(e){
        e.stopPropagation();
      });
    });
    document.body.appendChild(picker);
  }
  if(!_calendarPicker.month) _calendarPicker.month = new Date();
  var month = _calendarPicker.month;
  var monthName = month.toLocaleString(LANG==='es'?'es-MX':'en-GB', { month:'long', year:'numeric' });
  monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  var first = new Date(month.getFullYear(), month.getMonth(), 1);
  var startDay = (first.getDay() + 6) % 7;
  var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  var selectedIso = _calendarPicker.targetId ? parseUserDate((document.getElementById(_calendarPicker.targetId)||{}).value) : '';
  var todayIso = today();
  var weekDays = LANG==='es' ? ['L','M','M','J','V','S','D'] : ['M','T','W','T','F','S','S'];
  var cells = '';
  for(var i=0;i<startDay;i++) cells += '<div class="calendar-day is-empty"></div>';
  for(var d=1; d<=daysInMonth; d++){
    var iso = month.getFullYear() + '-' + String(month.getMonth()+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls = 'calendar-day';
    if(iso === selectedIso) cls += ' is-selected';
    if(iso === todayIso) cls += ' is-today';
    cells += '<button type="button" class="'+cls+'" onclick="selectCalendarDate(\''+iso+'\')">'+d+'</button>';
  }
  picker.innerHTML = ''
    + '<div class="calendar-picker-head">'
    +   '<button type="button" class="calendar-nav-btn" onclick="shiftCalendarPicker(-1)" aria-label="Previous month">'
    +     '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>'
    +   '</button>'
    +   '<div class="calendar-month-label">'+monthName+'</div>'
    +   '<button type="button" class="calendar-nav-btn" onclick="shiftCalendarPicker(1)" aria-label="Next month">'
    +     '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'
    +   '</button>'
    + '</div>'
    + '<div class="calendar-weekdays">'+weekDays.map(function(day){ return '<div>'+day+'</div>'; }).join('')+'</div>'
    + '<div class="calendar-grid">'+cells+'</div>';
  if(_calendarPicker.targetId){
    var input = document.getElementById(_calendarPicker.targetId);
    if(input) positionCalendarPicker(input);
  }
}
document.addEventListener('click', function(e){
  var picker = document.getElementById('calendar-picker');
  if(!picker || !picker.classList.contains('open')) return;
  if(e.target.closest('#calendar-picker')) return;
  if(e.target.closest('.date-field')) return;
  closeCalendarPicker();
});
window.addEventListener('resize', function(){
  if(!_calendarPicker.targetId) return;
  var input = document.getElementById(_calendarPicker.targetId);
  if(input) positionCalendarPicker(input);
});
window.addEventListener('scroll', function(){
  if(!_calendarPicker.targetId) return;
  var input = document.getElementById(_calendarPicker.targetId);
  if(input) positionCalendarPicker(input);
}, true);
function openDateField(id){
  var el = document.getElementById(id);
  if(!el) return;
  try{
    if(typeof el.focus === 'function') el.focus({ preventScroll:true });
  }catch(e){
    try{ el.focus(); }catch(_e){}
  }
  try{
    if(typeof el.showPicker === 'function'){
      el.showPicker();
      return;
    }
  }catch(e){}
  try{
    if(typeof el.click === 'function') el.click();
  }catch(e){}
  setTimeout(function(){
    try{
      if(typeof el.focus === 'function') el.focus({ preventScroll:true });
    }catch(e){
      try{ el.focus(); }catch(_e){}
    }
    try{
      if(typeof el.showPicker === 'function') el.showPicker();
      else if(typeof el.click === 'function') el.click();
    }catch(e){}
  }, 0);
}
function daysAway(d){ const dt=new Date(d+'T12:00:00');const n=new Date();n.setHours(0,0,0,0);dt.setHours(0,0,0,0);return Math.round((dt-n)/86400000); }
function fmtDate(s){ if(!s)return'—'; return formatDMY(s); }
function fmtDateShort(s){ if(!s)return'—'; return formatDMY(s); }
function fmtMoney(n){ return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0}); }
function gv(id){ const el=document.getElementById(id);return el?el.value:''; }
function esc(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }





function openMobDrawer(){
  var d = document.getElementById('mob-drawer');
  if(!d) return;
  d.classList.remove('hidden');
  if(WIX_USER){
    var name  = WIX_USER.displayName || WIX_USER.email || DB.cur || '?';
    var email = WIX_USER.email || DB.cur || '';
    var av    = name[0].toUpperCase();
    var mobAv    = document.getElementById('mob-uav');
    var mobName  = document.getElementById('mob-uname');
    var mobEmail = document.getElementById('mob-uemail');
    if(mobAv)    mobAv.textContent    = av;
    if(mobName)  mobName.textContent  = name;
    if(mobEmail) mobEmail.textContent = email;
  }
  var projNav = document.getElementById('mob-project-nav');
  if(projNav){
    var inProject = CID && !document.getElementById('pg-project').classList.contains('hidden');
    projNav.style.display = inProject ? 'block' : 'none';
  }
  var cl = document.getElementById('mob-currency-label');
  var cbl = document.getElementById('currency-label');
  if(cl && cbl) cl.textContent = 'Currency: ' + cbl.textContent;
  setTimeout(function(){
    var panel = document.getElementById('mob-drawer-panel');
    if(panel) panel.style.transform = 'translateX(0)';
  }, 10);
}
function closeMobDrawer(){
  var panel = document.getElementById('mob-drawer-panel');
  var d = document.getElementById('mob-drawer');
  if(!panel || !d) return;
  panel.style.transform = 'translateX(-100%)';
  setTimeout(function(){ d.classList.add('hidden'); }, 300);
}
function closeMobDrawerIfOverlay(e){
  if(e.target.classList.contains('mob-drawer-overlay') || e.target === document.getElementById('mob-drawer')){
    closeMobDrawer();
  }
}
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    var d = document.getElementById('mob-drawer');
    if(d && !d.classList.contains('hidden')) closeMobDrawer();
  }
});


document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('.chair-zoom') : null;
  if(!el && e.target.classList && e.target.classList.contains('chair-zoom')) el = e.target;
  if(el){
    e.stopPropagation();
    var key = el.getAttribute('data-ci');
    if(key){ showChairImg(key); }
    return;
  }
  var lb = document.getElementById('chair-lb');
  if(lb && !lb.contains(e.target)){ lb.parentNode.removeChild(lb); }
}, true);
function showChairImg(key){
  var imgSrc = CHAIR_IMAGES[key];
  if(!imgSrc){ console.warn('No image for key:', key); return; }
  var label = (CHAIR_TYPES[key]||{}).label || key;
  var existing = document.getElementById('chair-lb');
  if(existing) existing.parentNode.removeChild(existing);
  var lb = document.createElement('div');
  lb.id = 'chair-lb';
  lb.className = 'chair-img-lb';
  var img = document.createElement('img');
  img.src = imgSrc;
  img.alt = label;
  var lbl = document.createElement('div');
  lbl.className = 'chair-img-lb-label';
  lbl.textContent = label;
  lb.appendChild(img);
  lb.appendChild(lbl);
  lb.addEventListener('click', function(){ lb.parentNode.removeChild(lb); });
  document.body.appendChild(lb);
}


var _aiOn = false;
var _aiAct = null;
var _aiPD = null;

function getAIActions(){
  var isES = (typeof LANG!=='undefined' && LANG==='es');
  return [
    { key:'dashboard',  icon:'📋',
      label: isES?'Completar Detalles':'Fill Event Details',
      sub:   isES?'Genera descripción, tipo y datos clave con un resumen breve':'Generate description, type & key info from a brief',
      prompt:isES?'Describe el evento brevemente y llenaré los detalles.':'Describe the event in a few words and I\'ll fill in the details.',
      section:'dashboard' },
    { key:'budget',     icon:'💰',
      label: isES?'Sugerir Presupuesto':'Suggest Budget',
      sub:   isES?'Estima costos de proveedores para tu tipo y tamaño de evento':'Estimate vendor costs for your event type & size',
      prompt:isES?'¿Cuántos invitados se esperan? Estimaré los costos de proveedores.':'How many guests are expected? I\'ll estimate vendor costs.',
      section:'budget' },
    { key:'timeline',   icon:'📅',
      label: isES?'Generar Cronograma':'Generate Timeline',
      sub:   isES?'Construye una lista de tareas adaptada a tu evento':'Build a task checklist tailored to your event',
      prompt:isES?'¿Cuándo es el evento? Construiré un cronograma completo de tareas.':'When is the event? I\'ll build a full task timeline.',
      section:'timeline' },
    { key:'guests',     icon:'👥',
      label: isES?'Asignar Lugares':'Assign Seating',
      sub:   isES?'Sugiere asignaciones de mesa basadas en tu lista de invitados':'Suggest table assignments from your guest list',
      prompt:isES?'Sugeriré asignaciones de mesa basadas en tu lista de invitados actual.':'I\'ll suggest table assignments based on your current guest list.',
      section:'guests' },
    { key:'layout',     icon:'🏛',
      label: isES?'Diseñar Distribución':'Design Room Layout',
      sub:   isES?'Obtén un plano de distribución con sugerencias de elementos':'Get a layout plan with item suggestions',
      prompt:isES?'¿Qué tipo de espacio? (salón de fiestas, exterior, oficina, etc.)':'What type of space? (ballroom, outdoor, office, etc.)',
      section:'layout' },
    { key:'moodboard',  icon:'🎨',
      label: isES?'Sugerir Tema y Paleta':'Suggest Theme & Palette',
      sub:   isES?'Obtén una paleta de colores y dirección de estilo para tu evento':'Get a color palette and mood direction for your event',
      prompt:isES?'¿Cuál es el estilo o ambiente que buscas?':'What\'s the vibe or style you\'re going for?',
      section:'moodboard' },
  ];
}
var AI_ACTIONS = getAIActions();

function toggleAIPanel(){
  if(_aiOn) closeAIPanel();
  else openAIPanel();
}

function openAIPanel(){
  _aiOn = true;
  var fab = document.getElementById('ai-fab');
  var panel = document.getElementById('ai-panel');
  if(fab) fab.classList.add('active');
  if(panel) panel.classList.remove('hidden');
  renderAIHome();
}

function closeAIPanel(){
  _aiOn = false;
  var fab = document.getElementById('ai-fab');
  var panel = document.getElementById('ai-panel');
  if(fab) fab.classList.remove('active');
  if(panel) panel.classList.add('hidden');
  _aiAct = null;
  _aiPD = null;
}

function renderAIHome(){
  _aiAct = null;
  _aiPD = null;
  var p = proj();
  var bar = document.getElementById('ai-context-bar');
  var body = document.getElementById('ai-panel-body');
  var inputRow = document.getElementById('ai-input-row');

  if(bar){
    if(p){
      bar.innerHTML = '<svg width="12" height="12" fill="none" stroke="var(--gold-h)" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'+
        '<span style="color:var(--gold-h);font-weight:600">'+esc(p.name)+'</span>'+
        '<span style="color:var(--muted)">· '+esc(p.type||'event')+'</span>';
    } else {
      bar.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> '+(LANG==='es'?'Abre un proyecto para habilitar la asistencia AI':'Open a project to enable AI assistance');
    }
  }

  if(!body) return;
  if(inputRow) inputRow.style.display = 'flex';

  if(!p){
    body.innerHTML = '<div style="padding:30px 16px;text-align:center;color:var(--muted)">'+
      '<div style="font-size:32px;margin-bottom:10px">✦</div>'+
      '<div style="font-size:13px;font-weight:600;margin-bottom:6px">'+(LANG==='es'?'Ningún proyecto abierto':'No project open')+'</div>'+
      '<div style="font-size:12px;line-height:1.5">'+(LANG==='es'?'Abre un proyecto primero, luego la IA puede ayudarte a llenar detalles, crear cronogramas, sugerir presupuestos y más.':'Open a project first, then the AI can help fill in details, build timelines, suggest budgets, and more.')+'</div>'+
    '</div>';
    if(inputRow) inputRow.style.display = 'none';
    return;
  }

  AI_ACTIONS = getAIActions();
  body.innerHTML = AI_ACTIONS.map(function(a){
    return '<button class="ai-action-btn" onclick="startAIAction(\''+a.key+'\')">'+
      '<div class="ai-action-icon">'+a.icon+'</div>'+
      '<div>'+
        '<div class="ai-action-label">'+a.label+'</div>'+
        '<div class="ai-action-sub">'+a.sub+'</div>'+
      '</div>'+
      '<svg style="margin-left:auto;flex-shrink:0;color:var(--light)" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>'+
    '</button>';
  }).join('');
}

function startAIAction(key){
  var a = AI_ACTIONS.find(function(x){ return x.key===key; });
  if(!a) return;
  _aiAct = key;
  var p = proj(); if(!p) return;

  var prompts = {}; getAIActions().forEach(function(a){ prompts[a.key]=a.prompt; });

  var body = document.getElementById('ai-panel-body');
  if(!body) return;
  var inputRow = document.getElementById('ai-input-row');
  if(inputRow) inputRow.style.display = 'flex';

  body.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:4px 0 12px">'+
      '<button onclick="renderAIHome()" class="ai-back-btn">'+
        '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> '+(LANG==='es'?'Regresar':'Back')+
      '</button>'+
      '<div style="font-size:13px;font-weight:600">'+a.icon+' '+a.label+'</div>'+
    '</div>'+
    '<div style="font-size:12px;color:var(--muted);line-height:1.6;padding:10px 12px;background:var(--bg2);border-radius:var(--r-sm);border:1px solid var(--border)">'+
      prompts[key]+
    '</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">'+(LANG==='es'?'Escribe tus detalles abajo y presiona Enviar ↵':'Type your details below and press Send ↵')+'</div>';

  var ta = document.getElementById('ai-prompt');
  if(ta){ ta.value=''; ta.focus(); }
}

async function sendAIPrompt(){
  var ta = document.getElementById('ai-prompt');
  var btn = document.getElementById('ai-send-btn');
  var userMsg = ta ? ta.value.trim() : '';
  if(!userMsg && _aiAct !== 'guests') return;

  var p = proj(); if(!p) return;
  if(ta) ta.value='';
  if(btn) btn.disabled = true;

  showAILoading();

  try{
    var result = await callAIForAction(_aiAct, userMsg, p);
    _aiPD = result;
    showAIPreview(result, _aiAct);
  } catch(e){
    showAIError(e.message || 'Something went wrong. Try again.');
  } finally {
    if(btn) btn.disabled = false;
  }
}

function showAILoading(){
  var body = document.getElementById('ai-panel-body');
  var inputRow = document.getElementById('ai-input-row');
  if(inputRow) inputRow.style.display = 'none';
  if(body) body.innerHTML =
    '<div class="ai-loading">'+
      '<div class="ai-spinner"></div>'+
      '<div>'+(LANG==='es'?'Pensando':'Thinking')+'<span id="ai-dots">.</span></div>'+
    '</div>';
  var dots = 0;
  window._aiDotsTimer = setInterval(function(){
    var el = document.getElementById('ai-dots');
    if(!el){ clearInterval(window._aiDotsTimer); return; }
    dots=(dots+1)%4;
    el.textContent='.'.repeat(dots+1);
  }, 400);
}

function showAIError(msg){
  clearInterval(window._aiDotsTimer);
  var body = document.getElementById('ai-panel-body');
  var inputRow = document.getElementById('ai-input-row');
  if(inputRow) inputRow.style.display = 'flex';
  if(body) body.innerHTML =
    '<div style="padding:20px 16px;text-align:center">'+
      '<div style="font-size:28px;margin-bottom:8px">⚠️</div>'+
      '<div style="font-size:13px;color:var(--danger);font-weight:600;margin-bottom:6px">'+(LANG==='es'?'Error':'Error')+'</div>'+
      '<div style="font-size:12px;color:var(--muted);line-height:1.5">'+esc(msg)+'</div>'+
      '<button class="btn btn-ghost btn-sm" onclick="startAIAction(\''+(_aiAct||'dashboard')+'\')" style="margin-top:14px">'+(LANG==='es'?'Intentar de nuevo':'Try again')+'</button>'+
    '</div>';
}

function showAIPreview(data, key){
  clearInterval(window._aiDotsTimer);
  var a = AI_ACTIONS.find(function(x){ return x.key===key; });
  var body = document.getElementById('ai-panel-body');
  var inputRow = document.getElementById('ai-input-row');
  if(inputRow) inputRow.style.display = 'none';
  if(!body) return;

  var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'+
    '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gold-h)">✦ '+(LANG==='es'?'Vista Previa':'Preview')+'</div>'+
    '<div class="s-sm">'+(LANG==='es'?'Revisa antes de aplicar':'Review before applying')+'</div>'+
  '</div>';

  html += renderAIPreviewContent(key, data);

  html += '<div class="ai-preview-footer">'+
    '<button class="btn btn-ghost btn-sm" onclick="startAIAction(\''+key+'\')" style="gap:4px">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'+
      (LANG==='es'?'Regenerar':'Regenerate')+
    '</button>'+
    '<button class="btn btn-primary btn-sm" onclick="applyAIPreview()" style="flex:1;justify-content:center;gap:5px">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'+
      (LANG==='es'?'Aplicar al Proyecto':'Apply to Project')+
    '</button>'+
  '</div>';

  body.innerHTML = html;
}

function renderAIPreviewContent(key, data){
  var html = '';
  if(key === 'dashboard'){
    html += aiPreviewSection('Event Details', Object.entries(data).map(function(kv){
      return '<div class="ai-preview-item"><span style="color:var(--muted);font-size:11px">'+kv[0]+'</span><br>'+esc(String(kv[1]))+'</div>';
    }).join(''));
  }
  else if(key === 'budget'){
    html += aiPreviewSection('Vendor Estimates', (data.vendors||[]).map(function(v){
      return '<div class="ai-preview-item" style="display:flex;justify-content:space-between;gap:8px">'+
        '<span>'+esc(v.name)+'<br><span class="s-sm">'+esc(v.category)+'</span></span>'+
        '<span style="color:var(--gold-h);font-weight:600;flex-shrink:0">'+fmtMoney(v.budget||0)+'</span>'+
      '</div>';
    }).join(''));
    if(data.total) html += '<div style="text-align:right;font-size:12px;font-weight:700;color:var(--gold-h);padding:8px 12px">Total: '+fmtMoney(data.total)+'</div>';
  }
  else if(key === 'timeline'){
    html += aiPreviewSection('Tasks', (data.tasks||[]).map(function(t){
      return '<div class="ai-preview-item">'+esc(t.title)+'<br>'+
        '<span class="s-sm">'+esc(t.assignee||'')+(t.dueDate?' · '+fmtDate(t.dueDate):'')+'</span>'+
      '</div>';
    }).join(''));
  }
  else if(key === 'guests'){
    var byTable = {};
    (data.assignments||[]).forEach(function(a){
      if(!byTable[a.table]) byTable[a.table] = [];
      byTable[a.table].push(a.name);
    });
    html += Object.keys(byTable).sort(function(a,b){return Number(a)-Number(b);}).map(function(tbl){
      return aiPreviewSection('Table '+tbl, byTable[tbl].map(function(n){
        return '<div class="ai-preview-item">'+esc(n)+'</div>';
      }).join(''));
    }).join('');
  }
  else if(key === 'layout'){
    html += aiPreviewSection('Layout Concept', '<div class="ai-preview-item" style="line-height:1.6">'+esc(data.description||'')+'</div>');
    if((data.items||[]).length){
      html += aiPreviewSection('Suggested Items', (data.items||[]).map(function(it){
        return '<div class="ai-preview-item" style="display:flex;justify-content:space-between">'+
          '<span>'+esc(it.label)+'</span>'+
          '<span class="s-sm">'+esc(it.type||'')+'</span>'+
        '</div>';
      }).join(''));
    }
  }
  else if(key === 'moodboard'){
    html += aiPreviewSection('Theme', '<div class="ai-preview-item">'+
      '<strong>'+esc(data.theme||'')+'</strong><br>'+
      '<span style="font-size:12px;color:var(--muted);line-height:1.5">'+esc(data.description||'')+'</span>'+
    '</div>');
    if((data.palette||[]).length){
      html += aiPreviewSection('Color Palette',
        '<div style="display:flex;gap:8px;padding:10px 12px;flex-wrap:wrap">'+
        (data.palette||[]).map(function(c){
          return '<div style="text-align:center">'+
            '<div style="width:40px;height:40px;border-radius:8px;background:'+esc(c.hex)+';border:1px solid rgba(0,0,0,.1);margin-bottom:4px"></div>'+
            '<div style="font-size:9px;color:var(--muted)">'+esc(c.name||c.hex)+'</div>'+
          '</div>';
        }).join('')+
        '</div>');
    }
    if((data.keywords||[]).length){
      html += aiPreviewSection('Keywords',
        '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px">'+
        (data.keywords||[]).map(function(k){
          return '<span style="padding:3px 10px;border-radius:20px;background:var(--gold-l);border:1px solid rgba(201,168,76,.3);font-size:11px;color:var(--gold-h)">'+esc(k)+'</span>';
        }).join('')+
        '</div>');
    }
  }
  return html;
}

function aiPreviewSection(title, innerHtml){
  return '<div class="ai-preview-section">'+
    '<div class="ai-preview-section-title">'+esc(title)+'</div>'+
    innerHtml+
  '</div>';
}

function applyAIPreview(){
  var p = proj(); if(!p || !_aiPD) return;
  var key = _aiAct;
  var data = _aiPD;

  if(key === 'dashboard'){
    if(data.name)        p.name        = data.name;
    if(data.description) p.description = data.description;
    if(data.type)        p.type        = data.type;
    if(data.location)    p.location    = data.location;
    if(data.status)      p.status      = data.status;
  }
  else if(key === 'budget'){
    (data.vendors||[]).forEach(function(aiV){
      var existing = (p.vendors||[]).find(function(v){ return v.name===aiV.name; });
      if(existing){ if(aiV.budget) existing.budget = aiV.budget; }
      else { p.vendors = p.vendors||[]; p.vendors.push({id:'ai'+Date.now()+Math.random().toString(36).slice(2,6), name:aiV.name||'', category:aiV.category||'Other Services', subcategory:'Other', services:aiV.services||'', contact:'', phone:'', budget:aiV.budget||0, payments:[], hired:false, notes:aiV.notes||''}); }
    });
  }
  else if(key === 'timeline'){
    var base = new Date(); function dStr(n){var d=new Date(base);d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];}
    var tasks = (data.tasks||[]).map(function(t,i){
      return { id:'ait'+Date.now()+i, title:t.title||'Task', desc:t.desc||'', assignee:t.assignee||'Event Coordinator', dueDate:t.dueDate||dStr(i*7), done:false, color:t.color||'#c9a84c' };
    });
    p.tasks = tasks;
  }
  else if(key === 'guests'){
    (data.assignments||[]).forEach(function(a){
      var g = (p.guests||[]).find(function(g){ return g.name===a.name; });
      if(g) g.table = String(a.table||'');
    });
  }
  else if(key === 'layout'){
    var items = (data.items||[]).slice(0,20);
    var col=0, row=0, perRow=3;
    var newItems = items.map(function(it, i){
      col = i % perRow; row = Math.floor(i / perRow);
      return { id:'ail'+Date.now()+i, type:it.type||'rect', label:it.label||'Item', x:60+col*200, y:60+row*150, w:it.w||160, h:it.h||100, color:it.color||'#e8dcc8', rotation:0 };
    });
    p.layoutItems = (p.layoutItems||[]).concat(newItems);
  }
  else if(key === 'moodboard'){
    var note = '🎨 Theme: '+(data.theme||'')+'\n'+
      (data.description||'')+'\n\nPalette: '+(data.palette||[]).map(function(c){return c.name||c.hex;}).join(', ')+
      '\nKeywords: '+(data.keywords||[]).join(', ');
    p.aiMoodNote = note;
    p.aiPalette = data.palette||[];
    p.aiTheme = data.theme||'';
  }

  saveProj(p);
  toast('✦ AI suggestions applied!','s');
  closeAIPanel();

  var sectionMap = { dashboard:'dash', budget:'budget', timeline:'timeline', guests:'guests', layout:'layout', moodboard:'moodboard' };
  var tab = sectionMap[key];
  if(tab && CID) openTab(tab);
}

async function callAIForAction(key, userMsg, p){
  var isSpanish = (typeof LANG !== 'undefined' && LANG === 'es');

  var langInstr = isSpanish
    ? 'INSTRUCCIÓN CRÍTICA: Todos los valores de texto en el JSON deben estar en ESPAÑOL. Nombres, descripciones, etiquetas, notas, palabras clave, roles — todo en español. '
    : 'CRITICAL INSTRUCTION: All text values in the JSON must be in ENGLISH. Names, descriptions, labels, notes, keywords, roles — all in English. ';

  var jsonDemand = isSpanish
    ? '\n\nRECUERDA: Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después. Sin markdown. Sin bloques de código. Tu respuesta completa debe ser parseable por JSON.parse(). Empieza con { y termina con }.'
    : '\n\nREMEMBER: Respond ONLY with a valid JSON object. No text before or after. No markdown. No code fences. Your entire response must be parseable by JSON.parse(). Start with { and end with }.';

  var systemPrompts = {
    dashboard: langInstr+'You are an event management assistant. The user describes an event in a few words. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with these exact keys: name, description, type (one of: social, corporate, community, government, education), location, status (one of: planning, confirmed, in_progress, completed, cancelled).',

    budget: langInstr+'You are a luxury event planner. Given the event details and guest count, suggest realistic vendor budget allocations. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with: { "vendors": [ { "name": string, "category": string, "budget": number (in MXN), "notes": string } ], "total": number }. Include 5-8 key vendors relevant to the event type. Use MXN peso amounts appropriate for Mexico.',

    timeline: langInstr+'You are an event planning expert. Generate a realistic task timeline for the event. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with: { "tasks": [ { "title": string, "desc": string, "assignee": string, "dueDate": "YYYY-MM-DD", "color": "#hexcolor", "done": false } ] }. Generate 10-15 tasks spread from today to the event date. Colors: #7c3aed for admin, #10b981 for vendor, #f59e0b for guest, #ec4899 for creative, #c9a84c for logistics.',

    guests: langInstr+'You are a seating arrangement expert. Given the guest list, assign each guest to a numbered table (1–N) based on their category, relationships hinted in notes, and RSVP status. Exclude declined guests. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with: { "assignments": [ { "name": string, "table": number } ] }. Group families together, VIPs at low-numbered tables.',

    layout: langInstr+'You are an event space designer. Given the event type and venue description, suggest a room layout. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with: { "description": string (2-3 sentences), "items": [ { "label": string, "type": string (one of: rect, circle, table-round, table-rect), "w": number, "h": number, "color": "#hex" } ] }. Generate 8-15 items. Use warm neutral colors (#e8dcc8, #d4c5a9, #c9b99a).',

    moodboard: langInstr+'You are a luxury event creative director. Given the event description and style notes, suggest a theme and color palette. Return ONLY a raw JSON object (no markdown, no code fences, no explanation) with: { "theme": string (2-5 words), "description": string (2-3 sentences), "palette": [ { "hex": "#RRGGBB", "name": string } ], "keywords": [ string ] }. Include 4-6 palette colors and 6-8 mood keywords.',
  };

  var userContext = 'Event: '+p.name+' | Type: '+(p.type||'social')+' | Date: '+(p.date||'TBD')+' | Location: '+(p.location||'')+' | Budget: '+(p.budget||0)+' MXN | Guests: '+((p.guests||[]).length);

  var messages;
  if(key === 'guests'){
    var guestList = (p.guests||[]).filter(function(g){return g.rsvp!=='declined';}).map(function(g){
      return g.name+' ('+g.category+(g.notes?' — '+g.notes:'')+')';
    }).join('\n');
    messages = [{ role:'user', content: systemPrompts[key]+'\n\n'+userContext+'\n\nGuest list:\n'+guestList+'\n\n'+(userMsg||'Please assign tables.')+jsonDemand }];
  } else {
    messages = [{ role:'user', content: systemPrompts[key]+'\n\n'+userContext+'\n\nUser request: '+userMsg+jsonDemand }];
  }

  if(!AI_PROXY_URL){
    throw new Error('AI proxy not configured.');
  }

  var resp = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: messages,
    })
  });

  if(!resp.ok){
    var errData = await resp.json().catch(function(){return {};});
    throw new Error((errData.error&&errData.error.message)||'API error '+resp.status);
  }

  var data = await resp.json();
  console.log('[EventOS AI] Response status:', resp.status, '| type:', data.type);

  if(data.type === 'error' || data.error){
    var msg = (data.error && data.error.message) || 'API error';
    throw new Error(msg);
  }

  var raw = (data.content||[]).map(function(c){return c.text||'';}).join('');
  console.log('[EventOS AI] Raw text:', raw.slice(0, 200));

  if(!raw.trim()){
    throw new Error('Empty response from AI. Please try again.');
  }

  raw = raw.replace(/^```[a-z]*\s*/i,'').replace(/```\s*$/,'').trim();

  try { return JSON.parse(raw); } catch(e){}

  var start = raw.indexOf('{');
  var end   = raw.lastIndexOf('}');
  if(start !== -1 && end > start){
    try { return JSON.parse(raw.slice(start, end+1)); } catch(e){}
  }

  console.error('[EventOS AI] Parse failed. Raw:', raw);
  throw new Error('Parse error. Check browser console for details.');
}

function updateAIFabVisibility(){
  var fab = document.getElementById('ai-fab');
  if(!fab) return;
  var clientHidden = document.getElementById('pg-client').classList.contains('hidden');
  var appHidden = document.getElementById('pg-app').classList.contains('hidden');
  if(clientHidden && !appHidden && !window._shareMode){
    fab.classList.remove('hidden');
  } else {
    fab.classList.add('hidden');
    closeAIPanel();
  }
}

var _origOpenProject = typeof openProject === 'function' ? openProject : null;
var _origRenderEvents = typeof renderEvents === 'function' ? renderEvents : null;

window.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){ updateAIFabVisibility(); }, 500);
});

(function(){
  var _op = window.openProject;
  if(_op) window.openProject = function(){
    _op.apply(this, arguments);
    setTimeout(updateAIFabVisibility, 100);
  };
  var _rt = window.openTab;
  if(_rt) window.openTab = function(){
    _rt.apply(this, arguments);
    if(_aiOn) renderAIHome(); // refresh context bar
  };
})();


window.SCI={};
(function(){Object.keys(CHAIR_IMAGES).forEach(function(k){window.SCI[k]=function(){showChairImg(k);};});})();

function toggleSidebar(){
  const sb = document.getElementById('app-sidebar');
  if (sb) sb.classList.toggle('collapsed');
}
function sidebarSwitchTab(tab){
  const libTabMap = { budget:'vendors', timeline:'tasks', guests:'vendors', layout:'layouts', moodboard:'moodboards' };
  const libTab = libTabMap[tab] || 'vendors';
  _libTab = libTab;
  openLibrary(); // openLibrary handles closing the layout editor if open
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const tabMap = { budget:'snav-vendors', timeline:'snav-tasks', layout:'snav-layouts', moodboard:'snav-moodboard' };
  const sid = tabMap[tab];
  if (sid) { const se = document.getElementById(sid); if (se) se.classList.add('active'); }
}


