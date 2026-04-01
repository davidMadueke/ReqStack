import { initDB, verifyDB, getProjects, saveProject, deleteProject, 
         getRequirements, saveRequirement, deleteRequirement,
         getCategories, saveCategory, deleteCategory, 
         migrateDB} from "./db.js"

import { generateId, LEVELS, validateParent, getDescendantReqIds, sortRequirements } from "./requirements.js";

import { buildMarkdown } from "./markdownHandler.js";

import { confirmAddProject } from "./projects.js";

// ── STATE ──
// Only UI-level state lives here

let projects = [];
// projects: [{ id, name, reqs: [], categories: [], req_type: {sys,sub,der} }]

let activeProjectId  = null;
let activeCategoryId = null;
let activeFilter     = 'all';

// In-memory cache of current project data — loaded on project select
let currentProject  = null;
let currentReqs     = [];
let currentCats     = [];

// ── INIT ──
// Entry point — called once on page load
async function init() {
    try {
        await initDB();
        await migrateDB();
        await verifyDB();
        projects = await getProjects();
        for (const project in projects){
          let i = project.id;
          let req = await getRequirements(i);
          console.log(req);
        }
        await initEventListeners();
        await renderSidebar();
        renderMain(); // renders the "no project selected" state
      
      } catch (err) {
        console.error('[UI] Init failed:', err);
        showToast('Failed to initialise database. See console for details.', 'error');
      }
}

async function renderSidebar() {
  const list = document.getElementById('project-list');
  projects = await getProjects();

  if (projects.length === 0) {
    list.innerHTML = /*html*/`<div class="no-projects">No projects yet.<br/>Click + to add one.</div>`;
    return;
  }
  list.innerHTML = projects.map(p => {
    const active = p.id === activeProjectId ? 'active' : '';
    return /*html*/`<div class='project-item ${active}' data-action="select-project" data-id='${p.id}'>
      <div class="project-dot"></div>
      <div class="project-name" title="${esc(p.name)}">${esc(p.name)}</div>
      <button class="project-del" title="Delete project" data-action="delete-project" data-id='${p.id}'>×</button>
    </div>`;
  }).join('');
}

async function renderMain() {
    const area = document.getElementById('main-area');
    const proj = handleActiveProject();

    if (!proj) {
        area.innerHTML = /*html*/`<div class="no-select-msg">
        <div class="big">← Select a project</div>
        <div>or add a new one to get started</div>
        </div>`;
        document.getElementById('header-project').textContent = 'No project selected';
        return;
    }
    
    document.getElementById('header-project').innerHTML = /*html*/`Project: <strong>${esc(proj.name)}</strong>`;

  area.innerHTML = /*html*/`
    <div class="workspace">
      <div class="category-panel" id="category-panel"></div>
      <div class="req-area">
        <div class="add-form" id="add-form">
          <div class="form-row">
            <span class="form-label">Level</span>
            <select id="inp-level">
              <option value="sys">System</option>
              <option value="sub">Subsystem</option>
              <option value="der">Derived</option>
            </select>
            <span class="form-label">Parent ID</span>
            <input type="text" id="inp-parent" placeholder="e.g. SYS-001" style="width:110px;" />
            <span class="form-label">Category</span>
            <select id="inp-category">
              <option value=null>— none —</option>
            </select>
            <button class="btn btn-accent" workspace-action="add-requirement"
              style="margin-left:auto;">+ Add requirement</button>
            <button class="btn btn-import" workspace-action="import">
              ↑ Import REQUIREMENTS.md</button>
            <button class="btn btn-export" workspace-action="export">
              ↓ Export REQUIREMENTS.md</button>
          </div>
          <textarea id="inp-text" rows="2"
            placeholder="The system shall/may… (Ctrl+Enter to submit)"></textarea>
        </div>

        <div class="filter-bar" id="filter-bar">
          <span class="filter-label">Show</span>
          <button class="filter-chip active" data-filter="all" >All</button>
          <button class="filter-chip f-sys"  data-filter="sys">System</button>
          <button class="filter-chip f-sub"  data-filter="sub">Subsystem</button>
          <button class="filter-chip f-der"  data-filter="der">Derived</button>
          <div class="stats" id="stats-bar"></div>
        </div>

        <div class="req-list" id="req-list"></div>
      </div>
    </div>
  `;


  renderRequirements();
}


async function renderRequirements() { 
  const proj = handleActiveProject();
  if (!proj) return;

  // Stats
  const cnt = { sys: 0, sub: 0, der: 0 };
  currentReqs.forEach(r => cnt[r.level]++);
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    statsBar.innerHTML = /*html*/`  
      <div class="stat-pill s-sys"><span>${cnt.sys}</span> sys</div>
      <div class="stat-pill s-sub"><span>${cnt.sub}</span> sub</div>
      <div class="stat-pill s-der"><span>${cnt.der}</span> der</div>
    `;
  }

  const list = document.getElementById('req-list');
  if (!list) return;

  const visible = activeFilter === 'all' ? currentReqs : currentReqs.filter(r => r.level === activeFilter);

  if (visible.length === 0) {
    list.innerHTML =/*html*/ `<div class="empty-state">
      <div class="empty-icon">∅</div>
      <div>${currentReqs.length === 0 ? 'No requirements yet.' : 'No requirements at this level.'}</div>
      ${currentReqs.length === 0 ? '<div style="color:var(--text3);font-size:12px;">Add your first requirement above using "shall" language.</div>' : ''}
    </div>`;
    return;
  }

  const indentMap = { sys: 0, sub: 1, der: 2 };
 
  list.innerHTML = visible.map(r => {
    const lm = LEVELS[r.level];
    const indent = indentMap[r.level];
    return /*html*/`<div id="requirements-card" class="req-card level-${r.level} ${indent > 0 ? 'indent-'+indent : ''}">
      <div class="req-id">${r.id}</div>
      <div class="req-body">
        <div class="req-text">${esc(r.text)}</div>
        <div class="req-footer">
          <span class="req-badge ${lm.badge}">${lm.label}</span>
          ${r.parent ? `<span class="req-parent">↑ ${r.parent}</span>` : ''}
        </div>
      </div>
      <button class="req-del" title="Delete" del-req-id='${r.id}'>×</button>
    </div>`;
  }).join('');



 }

 function renderCategoryPanel(){
  return
 }
// ── EVENT HANDLERS ──
async function handleAddProject() {
  const nameEl = document.getElementById('modal-name');
  const name   = nameEl.value.trim();
  if (!name) return;

  const id      = 'proj_' + Date.now();
  const project = { id, name, counters: { sys: 0, sub: 0, der: 0 } };

  await saveProject(project);
  closeModal('modal-overlay');
  await handleSelectProject(id);
}

async function handleDeleteProject(id, e){
    e.stopPropagation();
    const projects = await getProjects();
    const p        = projects.find(p => p.id === id);
    if(!p) return;

    if (!confirm(`Delete project "${p.name}" and all its requirements?`)) return;

    // Delete all reqs and categories related to this project
    const reqs = await getRequirements(id);
    const cats = await getCategories(id);
    reqs.forEach(r => { deleteRequirement(r.id);})
    cats.forEach(c => { deleteRequirement(c.id);})
    await deleteProject(p.id)
    
    if (activeProjectId === id) {
        activeProjectId = null;
        currentProject  = null;
        currentReqs     = [];
        currentCats     = [];
        renderSidebar();
        renderMain();
    } else {
        renderSidebar();
    }
    projects    = await getProjects(); // Refresh the 
}


async function handleSelectProject(id) {
  activeProjectId  = id;
  activeCategoryId = null;
  activeFilter     = 'all';

  projects    = await getProjects();
  currentProject   = projects.find(p => p.id === id) || null;
  currentReqs      = currentProject ? sortRequirements(await getRequirements(id)) : [];
  currentCats      = currentProject ? await getCategories(id)   : [];

  renderSidebar();
  renderMain();
}

function handleActiveProject() {
  return getProject(activeProjectId);
}

function getProject(id){
  return projects.find(p => p.id === id);
}


async function handleAddRequirement() {
  if (!currentProject) return;

  const level    = document.getElementById('inp-level').value;
  const parentRaw = document.getElementById('inp-parent').value.trim().toUpperCase();
  const catId    = document.getElementById('inp-category').value || null;
  const text     = document.getElementById('inp-text').value.trim();

  if (!text) { showToast('Enter a requirement statement.', 'error'); return; }

  if (parentRaw && !validateParent(currentReqs, parentRaw)) {
    showToast(`Parent ID "${parentRaw}" not found.`, 'error'); return;
  }

  const id = generateId(currentProject.counters, level);
  await saveProject(currentProject); // save updated counters

  const req = {
    id,
    level,
    parent:     parentRaw || null,
    categoryId: catId || 0,
    text,
    projectId:  currentProject.id,
  };

  await saveRequirement(req);
  currentReqs.push(req);

  currentReqs = sortRequirements(currentReqs);

  document.getElementById('inp-text').value   = '';
  document.getElementById('inp-parent').value = '';

  //renderCategoryPanel();
  renderRequirements();
  await renderSidebar();
}

async function handleDeleteRequirement(id, e) {
  e.stopPropagation();
  if (!currentProject) return;
  const descendantIds = getDescendantReqIds(id, currentReqs);
  const toDelete      = [id, ...descendantIds];

  if (descendantIds.size > 0 &&
      !confirm(`This requirement has ${descendantIds.size} child(ren). Delete all?`)) return;

  currentReqs = currentReqs.filter(r => !toDelete.includes(r.id));  
  for (const rid of toDelete) await deleteRequirement(rid);

  renderCategoryPanel();
  renderRequirements();
  await renderSidebar();
}

// function handleAddCategory() { ... }

async function handleExport() {
  if (!currentProject) return;

  if (!('showDirectoryPicker' in window)) {
    showToast('File System Access API not supported in this browser.', 'error');
    return;
  }

  try {
    const dirHandle  = await window.showDirectoryPicker({ mode: 'readwrite' });
    const fileHandle = await dirHandle.getFileHandle('REQUIREMENTS.md', { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(buildMarkdown(currentProject, currentReqs, currentCats));
    await writable.close();
    showToast(`REQUIREMENTS.md written to "${dirHandle.name}"`, 'success');
  } catch (err) {
    console.error('Export failed: ' + err.message + err);
    if (err.name !== 'AbortError') showToast('Export failed: ' + err.message, 'error');
  }
}

async function handleImport() {
  console.log("import");
 }

async function initEventListeners(){
  // Project sidebar
  document.getElementById('btn-add-project').addEventListener('click', e => {

    document.getElementById('modal-name').value = '';
    document.getElementById('modal-overlay').classList.add('open');
    setTimeout(() => document.getElementById('modal-name').focus(), 50); // Timer to set when the keyboard shortcuts for modal kick in
  });
  document.getElementById('project-list').addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'select-project') {handleSelectProject(id);}
    if (action === 'delete-project') handleDeleteProject(id, e);
  });

  // Main area

  const mainArea = document.getElementById('main-area');
  mainArea.addEventListener("keydown", e => {
      if (e.target.id === "inp-text") {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddRequirement();
      };
  })

  await mainArea.addEventListener("click", e => {
    const deleteReq = e.target.closest('[del-req-id]');
    if(deleteReq){
      const id = deleteReq.getAttribute("del-req-id");
      handleDeleteRequirement(id, e);
    }
    
    const btn = e.target.closest('[data-filter]');
    if(btn){
      const filterType = btn.dataset.filter;
      setFilter(filterType, btn);
    }

    const workspaceAction = e.target.closest('[workspace-action]');
    if(workspaceAction){
      const action = workspaceAction.getAttribute("workspace-action");
      if (action === "add-requirement") handleAddRequirement();
      if (action === "import") handleImport();
      if (action === "export") handleExport();
    }
  })
  


  // Import Modal overlay
  document.getElementById('btn-add-project-cancel').addEventListener('click', e => {closeModal();});
  document.getElementById('btn-add-project-confirm').addEventListener('click', e => {handleAddProject();});
  
  // Add Project Modal Overlay


  // Modal overlays — close on backdrop click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-overlay');
  });

  document.getElementById('import-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('import-modal-overlay');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-overlay');
      closeModal('import-modal-overlay');
    }
    if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('open')) {
      handleAddProject();
    }});
}


// ── UTILS ──
let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRequirements();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}


document.addEventListener('DOMContentLoaded', init);