var mbOpenFolders = {};

function getMB(p){
  if(Array.isArray(p.moodboard)){
    p.moodboard = { folders:[], uncategorized: p.moodboard };
    saveProj(p);
  }
  if(!p.moodboard.folders) p.moodboard.folders=[];
  if(!p.moodboard.uncategorized) p.moodboard.uncategorized=[];
  return p.moodboard;
}

function totalMBImages(p){
  const mb=getMB(p);
  return mb.uncategorized.length + mb.folders.reduce((s,f)=>s+f.images.length,0);
}

function renderMoodboard(){
  const p=proj(); const el=document.getElementById('tab-moodboard');
  const mb=getMB(p);
  const total=totalMBImages(p);

  el.innerHTML=`
  <div class="sh">
    <div>
      <div class="sh-title" style="color:#7c3aed">${t('moodboard_library_title')}</div>
      <div class="sh-sub">${total} ${t('images')} · ${mb.folders.length} folders</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="openNewFolderModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${t('new_folder_btn')}
      </button>
<button class="btn btn-primary" onclick="window.print()">${t('export_pdf_btn')}</button>
    </div>
  </div>

  ${total===0 && mb.folders.length===0 ? `
  <div class="card" style="text-align:center;padding:60px">
    <svg width="48" height="48" fill="none" stroke="var(--light)" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 14px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
    <p style="font-size:16px;font-weight:600;margin-bottom:8px">${t('start_moodboard')}</p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">${t('start_moodboard_sub')}</p>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-ghost" onclick="openNewFolderModal()">${t('create_folder_btn')}</button>
      <label class="btn btn-primary" style="cursor:pointer;display:inline-flex">
        ${t('upload_images_btn')}<input type="file" accept="image/*" multiple class="hidden" onchange="addMBImages(this,null)">
      </label>
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
      <div class="mb-grid">
        ${folder.images.map((img,ii)=>mbImageCard(img,ii,folder.id)).join('')}
      </div>`}
    </div>
  </div>`).join('')}

  <!-- Uncategorized images -->
  ${mb.uncategorized.length>0 ? `
  <div class="mb-folder">
    <div class="mb-folder-header" onclick="toggleMBFolder('__root__')">
      <svg width="18" height="18" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
      <div class="mb-folder-title" style="color:var(--muted)">${t('uncategorized')}</div>
      <span class="mb-folder-count">${mb.uncategorized.length} images</span>
      <svg class="mb-folder-chevron ${mbOpenFolders['__root__']!==false?'open':''}" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
    </div>
    <div class="mb-folder-body" style="display:${mbOpenFolders['__root__']===false?'none':'block'}">
      <div class="mb-grid">${mb.uncategorized.map((img,ii)=>mbImageCard(img,ii,null)).join('')}</div>
    </div>
  </div>` : ''}`;
}

function mbImageCard(img, ii, folderId){
  const fKey = folderId || '__root__';
  const fidJs = folderId ? `'${folderId}'` : 'null';
  return `<div class="mb-card" draggable="true"
      data-mbidx="${ii}" data-mbfolder="${fKey}"
      ondragstart="mbDragStart(event,'${fKey}',${ii})"
      ondragover="event.preventDefault()"
      ondrop="mbDrop(event,'${fKey}',${ii})">
    <div style="position:relative;overflow:hidden;cursor:zoom-in"
         onclick="mbOpenLightboxIdx(${ii},${fidJs})">
      <img src="${img.src}" style="width:100%;aspect-ratio:4/3;object-fit:cover;transition:transform .3s ease" loading="lazy"
           onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
      <div style="position:absolute;inset:0;background:rgba(28,26,21,0);transition:background .2s;display:flex;align-items:center;justify-content:center;pointer-events:none"
           onmouseover="this.style.background='rgba(28,26,21,.18)'" onmouseout="this.style.background='rgba(28,26,21,0)'">
        <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 3.5 3.5"/><path d="M11 8v6M8 11h6"/></svg>
      </div>
    </div>
    <div class="mb-card-actions">
      <button class="icon-btn" onclick="event.stopPropagation();moveMBImageModal(${ii},${fidJs})" title="Move to folder">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
      <button class="icon-btn" style="color:#fff;background:rgba(181,64,58,.85)"
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
  const p=proj(); const mb=getMB(p);
  const img = folderId
    ? (mb.folders.find(f=>f.id===folderId)||{images:[]}).images[idx]
    : mb.uncategorized[idx];
  if(img) openLightbox(img.src, img.name||'');
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
  const msg=`Delete folder "${folder.name}"?${folder.images.length?` (${folder.images.length} image${folder.images.length>1?'s':''} will be moved to Uncategorized)`:''}`;
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
  mb.uncategorized.push(...folder.images);
  mb.folders=mb.folders.filter(f=>f.id!==fid);
  saveProj(p);renderMoodboard();toast('Folder deleted');
}

async function addMBImages(input, folderId){
  const files=Array.from(input.files);
  if(!files.length)return;
  const p=proj();const mb=getMB(p);
  toast('Uploading images…');
  let uploaded=0;
  for(const f of files){
    try{
      const ext=f.name.split('.').pop();
      const fileName='mi'+Date.now()+uploaded+'.'+ext;
      const path=DB.cur+'/'+p.id+'/'+fileName;
      const res=await fetch(
        SUPA_URL+'/storage/v1/object/moodboard/'+path,
        {method:'POST',headers:Object.assign({},supaHeaders(),{'Content-Type':f.type}),body:f}
      );
      if(!res.ok){const e=await res.text();console.error('Upload failed:',e);toast('Upload failed: '+f.name,'e');continue;}
      const url=SUPA_URL+'/storage/v1/object/public/moodboard/'+path;
      const img={id:'mi'+Date.now()+uploaded,src:url,name:f.name.replace(/\.[^/.]+$/,''),_path:path};
      if(folderId){const folder=mb.folders.find(fo=>fo.id===folderId);if(folder)folder.images.push(img);}
      else{mb.uncategorized.push(img);}
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
  let img=null;
  if(folderId){const f=mb.folders.find(f=>f.id===folderId);if(f){img=f.images[idx];f.images.splice(idx,1);}}
  else{img=mb.uncategorized[idx];mb.uncategorized.splice(idx,1);}
  if(img&&img._path){
    try{
      await fetch(SUPA_URL+'/storage/v1/object/moodboard/'+img._path,
        {method:'DELETE',headers:supaHeaders()});
    }catch(e){console.error('Storage delete error:',e);}
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
    <div onclick="doMoveMBImage(${idx},'${folderId||'__root__'}','__root__')" style="padding:12px 16px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:10px;font-size:13px" onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-l)'" onmouseout="this.style.borderColor='var(--border)';this.style.background=''">
      <svg width="16" height="16" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
      Uncategorized
    </div>
    ${folders.map(f=>`
    <div onclick="doMoveMBImage(${idx},'${folderId||'__root__'}','${f.id}')" style="padding:12px 16px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:10px;font-size:13px" onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-l)'" onmouseout="this.style.borderColor='var(--border)';this.style.background=''">
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
  if(toId==='__root__'){mb.uncategorized.push(img);}
  else{const tf=mb.folders.find(f=>f.id===toId);if(tf){tf.images.push(img);mbOpenFolders[toId]=true;}}
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
function openLightbox(src, caption){
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-caption').textContent = caption || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(e){
  if(e && e.target !== document.getElementById('lightbox') && !e.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') { document.getElementById('lightbox').classList.remove('open'); document.body.style.overflow=''; }});

function toast(msg,type=''){
  const c=document.getElementById('toast-c');
  const t=document.createElement('div');
  t.className='toast '+(type==='s'?'s':type==='e'?'e':'');
  t.innerHTML=(type==='s'?'✓':type==='e'?'✕':'ℹ')+' '+msg;
  c.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
}

function today(){ return new Date().toISOString().split('T')[0]; }
function formatDMY(s){ if(!s)return'DD / MM / YYYY'; const [y,m,d]=s.split('-'); return `${d} / ${m} / ${y}`; }
function daysAway(d){ const dt=new Date(d+'T12:00:00');const n=new Date();n.setHours(0,0,0,0);dt.setHours(0,0,0,0);return Math.round((dt-n)/86400000); }
function fmtDate(s){ if(!s)return'—'; const [y,mo,d]=s.split('-'); const months=LANG==='es'?['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return d+' '+months[parseInt(mo,10)-1]+' '+y; }
function fmtDateShort(s){ if(!s)return'—'; const [y,mo,d]=s.split('-'); const months=LANG==='es'?['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return d+' '+months[parseInt(mo,10)-1]+' '+y; }
function fmtMoney(n){ return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0}); }
function gv(id){ const el=document.getElementById(id);return el?el.value:''; }
function esc(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }


var SHARE_SECTIONS = [
  {id:'dashboard', label:'Dashboard', icon:'📊', sub:'Event overview, dates, budget summary'},
  {id:'budget',    label:'Budget & Vendors', icon:'💰', sub:'Vendor list, payments, budget tracker'},
  {id:'timeline',  label:'Timeline', icon:'📅', sub:'Tasks, gantt chart, calendar'},
  {id:'guests',    label:'Guest List', icon:'👥', sub:'Guest names, RSVP status, tables'},
  {id:'layout',    label:'Layout', icon:'🪑', sub:'Seating chart and floor plan'},
  {id:'moodboard', label:'Moodboard', icon:'🎨', sub:'Inspiration images and mood'},
];

function getDefaultPerms(){
  var p={};
  SHARE_SECTIONS.forEach(function(s){ p[s.id]='view'; });
  p.budget='off'; p.guests='off';
  return p;
}

function getShare(p){ return p.share || null; }

function generateShareToken(){
  return 'sh_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}

function getShareLink(token){
  return window.location.origin + window.location.pathname + '?share=' + token;
}

function openShareFromNav(){
  if(CID && proj()){
    openShareModal();
  } else {
    var projects = Object.values(DB.projects[DB.cur]||{});
    if(!projects.length){ toast('No projects yet','e'); return; }
    if(projects.length === 1){ CID = projects[0].id; openShareModal(); return; }
    var opts = projects.map(function(p){
      return '<div data-pid="'+p.id+'" onclick="openShareForProject(this.dataset.pid);closeMo()" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--bg2);display:flex;align-items:center;justify-content:space-between" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'+
        '<div><div style="font-size:13px;font-weight:600">'+esc(p.name)+'</div><div class="s-sm">'+fmtDate(p.date)+'</div></div>'+
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'+
      '</div>';
    }).join('');
    openMo('<div class="mo-title">🔗 Share — Select Project</div><div style="margin:-8px -8px 0">'+opts+'</div><div class="mo-foot"><button class="btn btn-ghost" onclick="closeMo()">Cancel</button></div>');
  }
}

function openShareForProject(id){
  CID = id;
  openShareModal();
}

function openShareModal(){
  var p = proj(); if(!p) return;
  if(!p.share){
    p.share = {
      token: generateShareToken(),
      clientName: p.clientName || '',
      clientEmail: '',
      enabled: false,
      perms: getDefaultPerms(),
      sharedAt: null,
      note: ''
    };
    saveProj(p);
  }
  renderShareModal(p);
}

function renderShareModal(p){
  var s = p.share;
  var link = getShareLink(s.token);

  var levels = [
    {lv:'off',  label:'Hidden', icon:'🚫', activeStyle:'background:#fef2f2;border-color:#fca5a5;color:#dc2626;font-weight:700'},
    {lv:'view', label:'View',   icon:'👁',  activeStyle:'background:var(--gold-l);border-color:var(--gold);color:var(--gold-h);font-weight:700'},
    {lv:'edit', label:'Edit',   icon:'✏️',  activeStyle:'background:#f0fdf4;border-color:#86efac;color:#16a34a;font-weight:700'},
  ];

  var permCards = SHARE_SECTIONS.map(function(sec){
    var perm = s.perms[sec.id] || 'off';
    var lvBtns = levels.map(function(lv){
      var isActive = perm === lv.lv;
      var style = isActive ? lv.activeStyle : 'color:var(--muted)';
      return '<button data-sid="'+sec.id+'" data-lv="'+lv.lv+'" onclick="setSharePerm(this.dataset.sid,this.dataset.lv)"'+
        ' style="flex:1;padding:7px 4px;border-radius:7px;border:1.5px solid '+(isActive?'':'var(--border)')+';background:transparent;cursor:pointer;font-size:11px;transition:.15s;'+style+'">'+
        '<div style="font-size:14px;margin-bottom:2px">'+lv.icon+'</div>'+
        '<div>'+lv.label+'</div>'+
      '</button>';
    }).join('');

    var statusColor = perm==='off'?'#ef4444': perm==='edit'?'#22c55e':'var(--gold-h)';
    var statusLabel = perm==='off'?'Hidden': perm==='edit'?'Edit':'View';

    return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;transition:.2s" '+
      'onmouseover="this.style.borderColor=\'rgba(201,168,76,.6)\'" onmouseout="this.style.borderColor=\'rgba(0,0,0,.12)\'">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">'+
            '<span style="font-size:16px">'+sec.icon+'</span>'+sec.label+
          '</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4">'+sec.sub+'</div>'+
        '</div>'+
        '<span style="font-size:10px;font-weight:700;color:'+statusColor+';background:'+statusColor+'18;padding:2px 8px;border-radius:20px;white-space:nowrap;letter-spacing:.04em;text-transform:uppercase;flex-shrink:0;margin-top:2px">'+statusLabel+'</span>'+
      '</div>'+
      '<div style="display:flex;gap:5px">'+lvBtns+'</div>'+
    '</div>';
  }).join('');

  var sharedInfo = s.sharedAt
    ? '<span style="color:var(--gold-h);font-size:11px">✓ Shared '+new Date(s.sharedAt).toLocaleDateString()+'</span>'
    : '<span style="color:var(--muted);font-size:11px">Not yet shared</span>';

  openMo(
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">'+
      '<div style="width:40px;height:40px;border-radius:10px;background:var(--gold-l);border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔗</div>'+
      '<div>'+
        '<div style="font-size:18px;font-weight:700;letter-spacing:-.01em">Share Project</div>'+
        '<div style="font-size:12px;color:var(--muted)">Control what your client can see and do</div>'+
      '</div>'+
    '</div>'+

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px">'+
      '<div>'+
        '<label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Client Name</label>'+
        '<input class="input" id="share-client-name" placeholder="e.g. María García" value="'+esc(s.clientName||'')+'">'+
      '</div>'+
      '<div>'+
        '<label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Note to Client <span style="font-weight:400;opacity:.6">(optional)</span></label>'+
        '<input class="input" id="share-note" placeholder="A message your client will see when opening the portal" value="'+esc(s.note||'')+'">'+
      '</div>'+
    '</div>'+

    '<div style="margin-bottom:22px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:700">Section Permissions</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:1px">Choose what each section shows to your client</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px">'+
          '<button class="btn btn-ghost btn-sm" data-lv="view" onclick="setAllSharePerms(this.dataset.lv)" style="font-size:11px">👁 All View</button>'+
          '<button class="btn btn-ghost btn-sm" data-lv="off" onclick="setAllSharePerms(this.dataset.lv)" style="font-size:11px">🚫 All Hidden</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+permCards+'</div>'+
    '</div>'+

    '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:4px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<div style="font-size:13px;font-weight:700">Share Link</div>'+
        sharedInfo+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<div style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:9px 12px;display:flex;align-items:center;gap:8px;min-width:0">'+
          '<svg width="13" height="13" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'+
          '<input id="share-link-input" value="'+link+'" readonly style="border:none;background:transparent;color:var(--text);font-size:11px;font-family:monospace;outline:none;width:100%;min-width:0">'+
        '</div>'+
        '<button class="btn btn-ghost btn-sm" onclick="copyShareLink()" style="flex-shrink:0;gap:4px">'+
          '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'+
          ' Copy'+
        '</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="previewClientPortal()" style="flex-shrink:0" title="Preview the client portal">'+
          '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'+
          ' Preview'+
        '</button>'+
      '</div>'+
      '<div style="margin-top:10px;display:flex;align-items:center;gap:6px">'+
        '<svg width="12" height="12" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'+
        '<span class="s-sm">Anyone with this link can view shared sections. <button onclick="revokeShareLink()" style="background:none;border:none;color:var(--danger);font-size:11px;cursor:pointer;padding:0;text-decoration:underline">Revoke & regenerate</button> to invalidate it.</span>'+
      '</div>'+
    '</div>'+

    '<div class="mo-foot" style="justify-content:flex-end;gap:10px">'+
      '<button class="btn btn-ghost" onclick="closeMo()">Cancel</button>'+
      '<button class="btn btn-primary" onclick="saveShareSettings()" style="gap:6px">'+
        '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'+
        'Save & Copy Link'+
      '</button>'+
    '</div>'
  );
}

function setSharePerm(sectionId, level){
  var p = proj(); if(!p||!p.share) return;
  p.share.perms[sectionId] = level;
  saveProj(p);
  renderShareModal(p);
}

function setAllSharePerms(level){
  var p = proj(); if(!p||!p.share) return;
  SHARE_SECTIONS.forEach(function(s){ p.share.perms[s.id] = level; });
  saveProj(p);
  renderShareModal(p);
}

function copyShareLink(){
  var el = document.getElementById('share-link-input');
  if(!el) return;
  var p = proj();
  if(p && p.share && !p.share.enabled){
    p.share.enabled = true;
    p.share.sharedAt = Date.now();
    saveProj(p);
    toast('Link enabled & copied!','s');
  } else {
    toast('Link copied!','s');
  }
  navigator.clipboard.writeText(el.value).catch(function(){
    el.select(); document.execCommand('copy');
  });
}

function revokeShareLink(){
  if(!confirm('This will invalidate the current link. A new link will be generated. Continue?')) return;
  var p = proj(); if(!p||!p.share) return;
  p.share.token = generateShareToken();
  saveProj(p);
  renderShareModal(p);
  toast('New link generated','s');
}

function saveShareSettings(){
  var p = proj(); if(!p||!p.share) return;
  var nameEl = document.getElementById('share-client-name');
  var noteEl = document.getElementById('share-note');
  if(nameEl) p.share.clientName = nameEl.value.trim();
  if(noteEl) p.share.note = noteEl.value.trim();
  p.share.enabled = true;
  p.share.sharedAt = Date.now();
  saveProj(p);
  var link = getShareLink(p.share.token);
  navigator.clipboard.writeText(link).then(function(){ toast('Settings saved — link copied!','s'); });
  closeMo();
}

function previewClientPortal(){
  var p = proj(); if(!p||!p.share) return;
  closeMo();
  renderClientPortal(p, p.share, true);
}


var _clientPortalOwnerMode = false;

function renderClientPortal(p, share, ownerPreview){
  _clientPortalOwnerMode = !!ownerPreview;
  document.getElementById('pg-loading').style.display='none';
  document.getElementById('pg-app').classList.add('hidden');
  var pg = document.getElementById('pg-client');
  pg.classList.remove('hidden');

  var perms = share.perms || getDefaultPerms();
  var visibleSections = SHARE_SECTIONS.filter(function(s){ return perms[s.id] !== 'off'; });
  var activeSection = visibleSections.length ? visibleSections[0].id : null;
  window._clientActiveSection = activeSection;
  window._clientPerms = perms;
  window._clientProject = p;

  renderClientPortalContent(p, share, perms, activeSection, ownerPreview);
}

function renderClientPortalContent(p, share, perms, activeSection, ownerPreview){
  var visibleSections = SHARE_SECTIONS.filter(function(s){ return perms[s.id] !== 'off'; });
  var fmtDate2 = function(d){ if(!d)return'TBD'; try{return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}catch(e){return d;} };

  var tabs = visibleSections.map(function(s){
    return '<button class="client-tab '+(activeSection===s.id?'active':'')+'" data-sid="'+s.id+'" onclick="clientSwitchTab(this.dataset.sid)">'+s.icon+' '+s.label+'</button>';
  }).join('');

  var sectionContent = activeSection ? buildClientSection(p, perms, activeSection) : '<div style="color:rgba(240,230,204,.35);padding:40px;text-align:center">No sections shared yet</div>';

  var previewBanner = ownerPreview ?
    '<div style="position:sticky;top:0;z-index:999;background:#1a3a1a;border-bottom:2px solid #4caf50;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;font-family:Jost,sans-serif;font-size:12px">'+
      '<span style="color:#a5d6a7">\u{1F441}\uFE0F Preview mode — this is what your client sees</span>'+
      '<button onclick="exitClientPortal()" style="background:#4caf50;border:none;color:#fff;padding:5px 16px;border-radius:20px;cursor:pointer;font-size:11px;font-weight:600">&larr; Exit Preview</button>'+
    '</div>' : '';

  document.getElementById('client-portal-content').innerHTML =
    previewBanner +
    '<div class="client-hero">'+
      '<div class="client-badge">&#10024; Event Portal</div>'+
      '<h1 style="font-size:clamp(24px,5vw,38px);font-weight:700;margin:0 0 6px;letter-spacing:-.01em;font-family:Cormorant Garamond,serif;color:#f0e6cc">'+esc(p.name)+'</h1>'+
      '<div style="font-size:14px;color:rgba(240,230,204,.55);font-family:Jost,sans-serif;margin-bottom:16px">'+
        fmtDate2(p.date)+(p.location?' &middot; '+esc(p.location):'')+'</div>'+
      (share.note?'<div style="background:rgba(201,168,76,.08);border-left:3px solid #c9a84c;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;color:rgba(240,230,204,.75);max-width:600px;position:relative;z-index:1">'+esc(share.note)+'</div>':'')+
    '</div>'+
    (visibleSections.length >= 1 ? '<div class="client-nav">'+tabs+'</div>' : '')+
    '<div class="client-body">'+
      '<div id="client-section-body">'+sectionContent+'</div>'+
    '</div>';
}


function buildClientSection(p, perms, sectionId){
  var perm = perms[sectionId] || 'view';
  var canEdit = perm === 'edit';

  if(sectionId === 'dashboard'){
    var hired = (p.vendors||[]).filter(function(v){return v.hired;});
    var paid = hired.reduce(function(s,v){return s+v.payments.reduce(function(a,pay){return a+Number(pay.amount);},0);},0);
    var tb = p.budget||0;
    var pct = tb>0?Math.min(100,Math.round(paid/tb*100)):0;
    var confirmed = (p.guests||[]).filter(function(g){return g.rsvp==='confirmed';}).length;
    var editNote = canEdit ? '<div style="margin-top:20px;padding:14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px">'+
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(240,230,204,.4);margin-bottom:8px">Event Notes</div>'+
      '<textarea id="client-edit-notes" style="width:100%;background:transparent;border:none;color:rgba(240,230,204,.85);font-family:Jost,sans-serif;font-size:13px;line-height:1.6;resize:vertical;min-height:80px;outline:none" placeholder="Add notes for your client...">'+esc(p.description||'')+'</textarea>'+
      '<button onclick="clientSaveNotes()" style="margin-top:8px;padding:5px 16px;background:#c9a84c;border:none;color:#1c1a15;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Save Notes</button>'+
      '</div>' : (p.description?'<div style="font-size:14px;color:rgba(240,230,204,.7);line-height:1.6;margin-top:16px">'+esc(p.description)+'</div>':'');
    return '<div class="client-section">'+
      '<div class="client-section-title">📊 Event Overview</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">'+
        clientStatCard('📅','Date',fmtDate(p.date))+
        clientStatCard('📍','Location',p.location||'TBD')+
        clientStatCard('👥','Guests',String((p.guests||[]).length)+' invited, '+confirmed+' confirmed')+
        clientStatCard('💰','Budget',fmtMoney(tb))+
      '</div>'+
      editNote+
    '</div>';
  }

  if(sectionId === 'budget'){
    var hired2 = (p.vendors||[]).filter(function(v){return v.hired;});
    var rows = hired2.map(function(v){
      var vpaid = v.payments.reduce(function(a,pay){return a+Number(pay.amount);},0);
      return '<tr style="border-bottom:1px solid rgba(201,168,76,.1)">'+
        '<td style="padding:10px 12px;font-size:13px">'+esc(v.name)+'</td>'+
        '<td style="padding:10px 12px;font-size:12px;color:rgba(240,230,204,.5)">'+esc(v.category)+'</td>'+
        '<td style="padding:10px 12px;text-align:right;font-size:13px">'+fmtMoney(v.price||0)+'</td>'+
        '<td style="padding:10px 12px;text-align:right;font-size:13px;color:#4caf50">'+fmtMoney(vpaid)+'</td>'+
      '</tr>';
    }).join('');
    var totalPaid = hired2.reduce(function(s,v){return s+v.payments.reduce(function(a,pay){return a+Number(pay.amount);},0);},0);
    return '<div class="client-section">'+
      '<div class="client-section-title">💰 Budget Summary</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'+
        clientStatCard('🎯','Total Budget',fmtMoney(p.budget||0))+
        clientStatCard('✅','Hired Vendors',String(hired2.length))+
        clientStatCard('💸','Total Paid',fmtMoney(totalPaid))+
      '</div>'+
      (rows?'<table style="width:100%;border-collapse:collapse">'+
        '<thead><tr style="border-bottom:1px solid rgba(201,168,76,.2)">'+
          '<th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(240,230,204,.4)">Vendor</th>'+
          '<th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(240,230,204,.4)">Category</th>'+
          '<th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(240,230,204,.4)">Total</th>'+
          '<th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(240,230,204,.4)">Paid</th>'+
        '</tr></thead><tbody>'+rows+'</tbody></table>':'<div style="color:rgba(240,230,204,.35);font-size:13px;padding:20px 0">No vendors hired yet</div>')+
      (canEdit?'<div style="margin-top:16px;padding:12px 14px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.15);border-radius:8px;font-size:12px;color:rgba(240,230,204,.5)">✏️ Edit mode: vendor management available in the main app</div>':'')+
    '</div>';
  }

  if(sectionId === 'timeline'){
    var tasks = (p.tasks||[]).sort(function(a,b){return (a.dueDate||'').localeCompare(b.dueDate||'');});
    var done = tasks.filter(function(t){return t.done;}).length;
    var pct2 = tasks.length ? Math.round(done/tasks.length*100) : 0;
    var trows = tasks.map(function(tk){
      var checkEl = canEdit
        ? '<div onclick="clientToggleTask(\''+esc(tk.id)+'\')" style="width:22px;height:22px;border-radius:50%;background:'+(tk.done?'#4caf50':'rgba(201,168,76,.15)')+';border:2px solid '+(tk.done?'#4caf50':'rgba(201,168,76,.4)')+';flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s">'+
            (tk.done?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>':'')+
          '</div>'
        : '<div style="width:18px;height:18px;border-radius:50%;background:'+(tk.done?'#4caf50':'rgba(201,168,76,.2)')+';border:2px solid '+(tk.done?'#4caf50':'rgba(201,168,76,.4)')+';flex-shrink:0;display:flex;align-items:center;justify-content:center">'+
            (tk.done?'<svg width="10" height="10" fill="none" stroke="#fff" stroke-width="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>':'')+
          '</div>';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(201,168,76,.08)">'+
        checkEl+
        '<div style="flex:1"><div style="font-size:13px;'+(tk.done?'text-decoration:line-through;color:rgba(240,230,204,.4)':'')+'">'+(canEdit?'<span title="Click checkbox to toggle">':'')+esc(tk.title)+(canEdit?'</span>':'')+
          '</div>'+
          (tk.dueDate?'<div style="font-size:11px;color:rgba(240,230,204,.4);font-family:Jost,sans-serif;margin-top:2px">'+fmtDate(tk.dueDate)+'</div>':'')+
        '</div>'+
        (tk.assignee?'<div style="font-size:11px;color:rgba(201,168,76,.7);font-family:Jost,sans-serif">'+esc(tk.assignee)+'</div>':'')+
        '<div style="font-size:11px;padding:2px 8px;border-radius:10px;background:'+(tk.done?'rgba(76,175,80,.15)':'rgba(201,168,76,.1)')+';color:'+(tk.done?'#4caf50':'rgba(201,168,76,.7)')+'">'+
          (tk.done?'Done':'Pending')+
        '</div>'+
      '</div>';
    }).join('');
    return '<div class="client-section">'+
      '<div class="client-section-title">📅 Timeline</div>'+
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">'+
        '<div style="flex:1;height:6px;background:rgba(201,168,76,.15);border-radius:3px">'+
          '<div style="height:100%;width:'+pct2+'%;background:#c9a84c;border-radius:3px;transition:.4s"></div>'+
        '</div>'+
        '<span style="font-size:13px;color:#c9a84c;font-weight:600">'+pct2+'% complete</span>'+
      '</div>'+
      (canEdit?'<div style="font-size:11px;color:rgba(201,168,76,.5);margin-bottom:12px">✏️ Click the checkboxes to mark tasks done</div>':'')+
      (trows||'<div style="color:rgba(240,230,204,.35);font-size:13px;padding:20px 0">No tasks yet</div>')+
    '</div>';
  }

  if(sectionId === 'guests'){
    var guests = p.guests||[];
    var conf = guests.filter(function(g){return g.rsvp==='confirmed';}).length;
    var dec = guests.filter(function(g){return g.rsvp==='declined';}).length;
    var pend = guests.filter(function(g){return !g.rsvp||g.rsvp==='pending';}).length;
    var grows = guests.slice(0,100).map(function(g, gi){
      var badge = g.rsvp==='confirmed'?'#4caf50':g.rsvp==='declined'?'#f44336':'#9e9e9e';
      var rsvpCtrl = canEdit
        ? '<div style="display:flex;gap:4px">'+
            '<button onclick="clientRSVP('+gi+',\'confirmed\')" style="padding:3px 9px;border-radius:12px;border:1.5px solid;font-size:10px;font-weight:600;cursor:pointer;transition:.15s;background:'+(g.rsvp==='confirmed'?'#4caf50':'transparent')+';border-color:'+(g.rsvp==='confirmed'?'#4caf50':'rgba(240,230,204,.2)')+';color:'+(g.rsvp==='confirmed'?'#fff':'rgba(240,230,204,.5)')+'">✓ Yes</button>'+
            '<button onclick="clientRSVP('+gi+',\'declined\')" style="padding:3px 9px;border-radius:12px;border:1.5px solid;font-size:10px;font-weight:600;cursor:pointer;transition:.15s;background:'+(g.rsvp==='declined'?'#f44336':'transparent')+';border-color:'+(g.rsvp==='declined'?'#f44336':'rgba(240,230,204,.2)')+';color:'+(g.rsvp==='declined'?'#fff':'rgba(240,230,204,.5)')+'">✗ No</button>'+
          '</div>'
        : '<div style="width:8px;height:8px;border-radius:50%;background:'+badge+';flex-shrink:0"></div>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(201,168,76,.06)">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:rgba(201,168,76,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#c9a84c;flex-shrink:0">'+esc((g.name||'?')[0].toUpperCase())+'</div>'+
        '<div style="flex:1;font-size:13px">'+esc(g.name)+(canEdit&&g.dietary?'<div style="font-size:10px;color:rgba(240,230,204,.35)">'+esc(g.dietary)+'</div>':'')+'</div>'+
        (g.table?'<div style="font-size:11px;color:rgba(240,230,204,.4);font-family:Jost,sans-serif">Table '+esc(String(g.table))+'</div>':'')+
        rsvpCtrl+
      '</div>';
    }).join('');
    return '<div class="client-section">'+
      '<div class="client-section-title">👥 Guest List</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'+
        clientStatCard('✅','Confirmed',String(conf))+
        clientStatCard('❌','Declined',String(dec))+
        clientStatCard('⏳','Pending',String(pend))+
      '</div>'+
      (canEdit?'<div style="font-size:11px;color:rgba(201,168,76,.5);margin-bottom:12px">✏️ Update RSVP status for each guest</div>':'')+
      (grows||'<div style="color:rgba(240,230,204,.35);font-size:13px;padding:20px 0">No guests yet</div>')+
      (guests.length>100?'<div style="font-size:11px;color:rgba(240,230,204,.3);margin-top:10px">Showing first 100 of '+guests.length+' guests</div>':'')+
    '</div>';
  }

  if(sectionId === 'layout'){
    var litems = p.layoutItems||[];
    var tables = litems.filter(function(i){return i.chairs>0;});
    var seats = litems.reduce(function(s,i){return s+(i.chairs||0);},0);

    var svgContent = '';
    if(litems.length){
      var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      litems.forEach(function(it){
        var x=it.x||0, y=it.y||0, w=it.w||40, h=it.h||40;
        if(x<minX)minX=x; if(y<minY)minY=y;
        if(x+w>maxX)maxX=x+w; if(y+h>maxY)maxY=y+h;
      });
      var bw=maxX-minX, bh=maxY-minY;
      var SVG_W=760, SVG_H=Math.max(200,Math.min(500,Math.round(SVG_W*bh/bw)));
      var scale=Math.min((SVG_W-40)/bw,(SVG_H-40)/bh);
      var offX=20-minX*scale, offY=20-minY*scale;

      var itemSVGs = litems.map(function(it){
        var x=(it.x||0)*scale+offX, y=(it.y||0)*scale+offY;
        var w=(it.w||40)*scale, h=(it.h||40)*scale;
        var bg=it.bg||'#e0d8cc', bd=it.bdClr||'#999';
        var rot=it.rotation||0;
        var cx=x+w/2, cy=y+h/2;
        var isRound=it.radius==='50%';
        var label=esc(it.label||'');
        var fontSize=Math.max(7,Math.min(13,Math.round(w*0.18)));
        var transform=rot?'transform="rotate('+rot+' '+cx+' '+cy+')\"':'';
        if(isRound){
          var rx=w/2, ry=h/2;
          return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="'+bg+'" stroke="'+bd+'" stroke-width="1" '+transform+'/>'+
            '<text x="'+cx+'" y="'+(cy+fontSize*0.35)+'" text-anchor="middle" font-size="'+fontSize+'" font-family="Jost,sans-serif" fill="'+bd+'" '+transform+'>'+label+'</text>';
        } else {
          return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="2" fill="'+bg+'" stroke="'+bd+'" stroke-width="1" '+transform+'/>'+
            '<text x="'+cx+'" y="'+(cy+fontSize*0.35)+'" text-anchor="middle" font-size="'+fontSize+'" font-family="Jost,sans-serif" fill="'+bd+'" '+transform+'>'+label+'</text>';
        }
      }).join('');

      svgContent = '<div style="margin:20px 0;border:1px solid rgba(201,168,76,.15);border-radius:10px;overflow:hidden;background:#1a1712">'+
        '<svg width="100%" viewBox="0 0 '+SVG_W+' '+SVG_H+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+
          '<rect width="'+SVG_W+'" height="'+SVG_H+'" fill="#1a1712"/>'+
          itemSVGs+
        '</svg>'+
      '</div>';
    }

    return '<div class="client-section">'+
      '<div class="client-section-title">🪑 Event Layout</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'+
        clientStatCard('🪑','Tables',String(tables.length))+
        clientStatCard('💺','Total Seats',String(seats))+
        clientStatCard('📐','Elements',String(litems.length))+
      '</div>'+
      (litems.length ? svgContent : '<div style="color:rgba(240,230,204,.35);font-size:13px;padding:20px 0">No layout created yet</div>')+
      (canEdit?'<div style="margin-top:12px;padding:12px 14px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.15);border-radius:8px;font-size:12px;color:rgba(240,230,204,.5)">✏️ Layout editing is available in the main app</div>':'')+
    '</div>';
  }

  if(sectionId === 'moodboard'){
    var mb = p.moodboard;
    var allImgs = [];
    if(Array.isArray(mb)){
      allImgs = mb;
    } else if(mb && typeof mb === 'object'){
      allImgs = (mb.uncategorized||[]).concat(
        (mb.folders||[]).reduce(function(acc,f){ return acc.concat(f.images||[]); }, [])
      );
    }
    var imgGrid = allImgs.length ?
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">'+
        allImgs.map(function(img){
          return '<div style="border-radius:8px;overflow:hidden;background:rgba(201,168,76,.05)">'+
            '<img src="'+img.src+'" style="width:100%;aspect-ratio:1;object-fit:cover;display:block" alt="'+esc(img.label||'')+'" loading="lazy" onerror="this.style.display=\'none\'">'+
            (img.label?'<div style="font-size:10px;color:rgba(240,230,204,.45);padding:4px 6px;font-family:Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(img.label)+'</div>':'')+
          '</div>';
        }).join('')+
      '</div>'
      : '<div style="color:rgba(240,230,204,.35);font-size:13px;padding:20px 0">No images yet</div>';
    return '<div class="client-section">'+
      '<div class="client-section-title">🎨 Moodboard</div>'+
      (allImgs.length ? '<div style="font-size:12px;color:rgba(240,230,204,.4);margin-bottom:14px">'+allImgs.length+' image'+(allImgs.length!==1?'s':'')+' shared</div>' : '')+
      imgGrid+
    '</div>';
  }

  return '<div style="color:rgba(240,230,204,.4);padding:40px;text-align:center">'+
    '<svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 12px;display:block;opacity:.4"><rect width="11" height="11" x="11" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>This section is not available</div>';
}


function clientStatCard(icon, label, value){
  return '<div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:8px;padding:14px">'+
    '<div style="font-size:18px;margin-bottom:4px">'+icon+'</div>'+
    '<div style="font-size:20px;font-weight:700;color:#f0e6cc;margin-bottom:2px">'+esc(value)+'</div>'+
    '<div style="font-size:11px;color:rgba(240,230,204,.4);font-family:Jost,sans-serif;text-transform:uppercase;letter-spacing:.06em">'+label+'</div>'+
  '</div>';
}

function _clientSave(){
  var p = window._clientProject;
  if(!p) return false;

  if(window._shareMode && window._clientProjectUserId){
    fetch(SUPA_URL+'/rest/v1/projects', {
      method: 'POST',
      headers: Object.assign({}, supaHeaders(), {'Prefer':'resolution=merge-duplicates'}),
      body: JSON.stringify({
        id: p.id,
        user_id: window._clientProjectUserId,
        data: p,
        updated_at: new Date().toISOString()
      })
    }).catch(function(e){ console.error('Client save error:', e); });
    return true;
  }

  var found = false;
  Object.keys(DB.projects).forEach(function(user){
    if(DB.projects[user] && DB.projects[user][p.id]){
      DB.projects[user][p.id] = p;
      found = true;
    }
  });
  if(found) saveDB();
  return found;
}

function clientSaveNotes(){
  var el = document.getElementById('client-edit-notes');
  if(!el || !window._clientProject) return;
  window._clientProject.description = el.value;
  if(_clientSave()) toast('Notes saved','s');
  else toast('Could not save — try refreshing','e');
}

function clientToggleTask(taskId){
  var p = window._clientProject;
  if(!p) return;
  var task = (p.tasks||[]).find(function(t){ return t.id === taskId; });
  if(!task) return;
  task.done = !task.done;
  if(_clientSave()){
    var sec = document.getElementById('client-section-body');
    if(sec) sec.innerHTML = buildClientSection(p, window._clientPerms, 'timeline');
    else clientSwitchTab('timeline');
  }
}

function clientRSVP(guestIndex, rsvpValue){
  var p = window._clientProject;
  if(!p || !p.guests || !p.guests[guestIndex]) return;
  p.guests[guestIndex].rsvp = rsvpValue;
  if(_clientSave()){
    var sec = document.getElementById('client-section-body');
    if(sec) sec.innerHTML = buildClientSection(p, window._clientPerms, 'guests');
    else clientSwitchTab('guests');
    toast('RSVP updated','s');
  }
}


function clientSwitchTab(sectionId){
  window._clientActiveSection = sectionId;
  var share = window._clientProject.share;
  var perms = window._clientPerms || (share && share.perms) || getDefaultPerms();
  document.querySelectorAll('.client-tab').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.sid === sectionId);
  });
  var body = document.getElementById('client-section-body');
  if(body){
    body.innerHTML = buildClientSection(window._clientProject, perms, sectionId);
  } else {
    renderClientPortalContent(window._clientProject, share, perms, sectionId, _clientPortalOwnerMode);
  }
}

function exitClientPortal(){
  document.getElementById('pg-client').classList.add('hidden');
  document.getElementById('pg-app').classList.remove('hidden');
  openShareModal();
}

(function(){
  var params = new URLSearchParams(window.location.search);
  var token = params.get('share');
  if(!token) return;

  window._shareMode = true;

  async function loadShareByToken(){
    var loadingEl = document.getElementById('pg-loading');
    var appEl = document.getElementById('pg-app');
    if(loadingEl) loadingEl.style.display='flex';
    if(appEl) appEl.classList.add('hidden');

    try{
      var res = await fetch(
        SUPA_URL+'/rest/v1/projects?select=data&data->>share_token=eq.'+encodeURIComponent(token),
        { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY } }
      );
      var rows = res.ok ? await res.json() : [];

      if(!rows.length){
        var res2 = await fetch(
          SUPA_URL+'/rest/v1/projects?select=data',
          { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY } }
        );
        rows = res2.ok ? await res2.json() : [];
      }

      var found = null, foundShare = null;
      rows.forEach(function(row){
        if(found) return;
        var pr = row.data;
        if(pr && pr.share && pr.share.token === token && pr.share.enabled){
          found = pr; foundShare = pr.share;
        }
      });

      if(found){
        window._clientProjectUserId = null;
        var res3 = await fetch(
          SUPA_URL+'/rest/v1/projects?select=user_id,data',
          { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY } }
        );
        if(res3.ok){
          var rows3 = await res3.json();
          rows3.forEach(function(row){
            if(row.data && row.data.share && row.data.share.token === token){
              window._clientProjectUserId = row.user_id;
            }
          });
        }
        renderClientPortal(found, foundShare, false);
      } else {
        if(loadingEl){
          loadingEl.innerHTML = '<div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:600;color:var(--text)">Event<span style="color:var(--gold);font-style:italic">OS</span></div>'+
            '<div style="font-size:14px;color:var(--danger);margin-top:12px">This share link is invalid or has been revoked.</div>'+
            '<div style="font-size:12px;color:var(--muted);margin-top:6px">Please ask the event organizer for a new link.</div>';
          loadingEl.style.display = 'flex';
        }
      }
    } catch(e){
      console.error('Share link load error:', e);
      if(loadingEl){
        loadingEl.innerHTML += '<div style="font-size:13px;color:var(--danger);margin-top:12px">Could not load event. Check your connection.</div>';
      }
    }
  }

  if(document.readyState !== 'loading') loadShareByToken();
  else window.addEventListener('DOMContentLoaded', loadShareByToken);
})();



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
      '<button onclick="renderAIHome()" style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;gap:4px;font-size:12px;font-family:Jost,sans-serif;transition:.15s" onmouseover="this.style.color=\'var(--text)\'" onmouseout="this.style.color=\'var(--muted)\'">'+
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