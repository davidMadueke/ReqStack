import { initDB, verifyDB, getProjects, saveProject, deleteProject, 
         getRequirements, saveRequirement, deleteRequirement,
         getCategories, saveCategory, deleteCategory } from "./db.js"

import { nextId } from "./requirements.js";

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
    await initDB();
    await verifyDB();

    projects = await getProjects();
    console.log(projects.length)

    initEventListeners();

    renderSidebar();
    //renderMain();
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
    <div class="add-form" id="add-form">
      <div class="form-row">
        <span class="form-label">Level</span>
        <select id="inp-level">
          <option value="sys">System</option>
          <option value="sub">Subsystem</option>
          <option value="der">Derived</option>
        </select>
        <span class="form-label" style="margin-left:8px;">Parent ID</span>
        <input type="text" id="inp-parent" placeholder="e.g. SYS-001" style="width:120px;" />
        <button class="btn btn-accent" onclick="handleAddRequirement()" style="margin-left:auto;">+ Add requirement</button>
        <button class="btn btn-import" onclick="handleImport()">↑ Import REQUIREMENTS.md</button>
        <button class="btn btn-export" onclick="handleExport()">↓ Export REQUIREMENTS.md</button>
      </div>
      <textarea id="inp-text" placeholder="The system shall… (use 'shall' language for verifiable requirements)" rows="2"></textarea>
    </div>

    <div class="filter-bar">
      <span class="filter-label">Show</span>
      <button class="filter-chip active" onclick="setFilter('all',this)">All</button>
      <button class="filter-chip f-sys" onclick="setFilter('sys',this)">System</button>
      <button class="filter-chip f-sub" onclick="setFilter('sub',this)">Subsystem</button>
      <button class="filter-chip f-der" onclick="setFilter('der',this)">Derived</button>
      <div class="stats" id="stats-bar"></div>
    </div>

    <div class="req-list" id="req-list"></div>
  `;

  document.getElementById('inp-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddRequirement();
  });

  renderRequirements();
}

//async function renderCategoryTree() { ... }

async function renderRequirements() { 
  const proj = handleActiveProject();
  if (!proj) return;

  // Stats
  const cnt = { sys: 0, sub: 0, der: 0 };
  currentReqs.forEach(r => cnt[r.level]++);
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    statsBar.innerHTML = html`
      <div class="stat-pill s-sys"><span>${cnt.sys}</span> sys</div>
      <div class="stat-pill s-sub"><span>${cnt.sub}</span> sub</div>
      <div class="stat-pill s-der"><span>${cnt.der}</span> der</div>
    `;
  }

  const list = document.getElementById('req-list');
  if (!list) return;

  const visible = activeFilter === 'all' ? proj.reqs : proj.reqs.filter(r => r.level === activeFilter);

  if (visible.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">∅</div>
      <div>${proj.reqs.length === 0 ? 'No requirements yet.' : 'No requirements at this level.'}</div>
      ${proj.reqs.length === 0 ? '<div style="color:var(--text3);font-size:12px;">Add your first requirement above using "shall" language.</div>' : ''}
    </div>`;
    return;
  }

  const indentMap = { sys: 0, sub: 1, der: 2 };

  list.innerHTML = visible.map(r => {
    const lm = LEVELS[r.level];
    const indent = indentMap[r.level];
    return html`<div class="req-card level-${r.level} ${indent > 0 ? 'indent-'+indent : ''}">
      <div class="req-id">${r.id}</div>
      <div class="req-body">
        <div class="req-text">${esc(r.text)}</div>
        <div class="req-footer">
          <span class="req-badge ${lm.badge}">${lm.label}</span>
          ${r.parent ? `<span class="req-parent">↑ ${r.parent}</span>` : ''}
        </div>
      </div>
      <button class="req-del" title="Delete" onclick="handleDeleteRequirement('${r.id}', event)">×</button>
    </div>`;
  }).join('');
 }

/* function renderAddProject() {
    document.getElementById('modal-name').value = '';
    document.getElementById('modal-overlay').classList.add('open');
    setTimeout(() => document.getElementById('modal-name').focus(), 50); // Timer to set when the keyboard shortcuts for modal kick in
} */

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

/* async function handleConfirmAddProject() {
    const addProjectOverlay = document.getElementById('modal-overlay')
    if (addProjectOverlay){
      addProjectOverlay.addEventListener('click', e => {
          if (e.target === e.currentTarget) closeModal();
      });
    }
    const cancelAddProject = document.getElementById('btn-add-project-cancel')
    if (cancelAddProject){
      cancelAddProject.addEventListener('click', e => {closeModal();});
    }
    
    const addProjectButton = document.getElementById('btn-add-project')
    if (addProjectButton){
      addProjectButton.addEventListener('click', e => {
        const newId = confirmAddProject();
        closeModal();
        renderSidebar();
        handleSelectProject(newId);
      });
    }

    document.getElementById('modal-name').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const newId = confirmAddProject();
            closeModal();
            renderSidebar();
            handleSelectProject(newId);
        }
        if (e.key === 'Escape') closeModal();
    });

 } */

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
  currentReqs      = currentProject ? await getRequirements(id) : [];
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
    const proj = handleActiveProject();
    if (!proj) return;
    const level = document.getElementById('inp-level').value;
    const parent = document.getElementById('inp-parent').value.trim().toUpperCase();
    const text = document.getElementById('inp-text').value.trim();
    if (!text) { showToast('Enter a requirement statement.', 'error'); return; }
    if (parent && !proj.reqs.find(r => r.id === parent)) {
        showToast(`Parent ID "${parent}" not found.`, 'error'); return;
    }
    const id = nextId(proj, level);
    proj.reqs.push({ id, level, parent: parent || null, text });
    saveProject();
    document.getElementById('inp-text').value = '';
    document.getElementById('inp-parent').value = '';
    renderRequirements();
    renderSidebar();
}

function handleDeleteRequirement(id, e) {
  e.stopPropagation();
  const proj = handleActiveProject();
  if (!proj) return;
  const hasChildren = proj.reqs.some(r => r.parent === id);
  if (hasChildren && !confirm('This requirement has children. Delete it and its children?')) return;
  // Remove children recursively
  function removeChildren(pid) {
    const children = proj.reqs.filter(r => r.parent === pid).map(r => r.id);
    children.forEach(cid => { removeChildren(cid); deleteRequirement(cid); });
  }
  removeChildren(id);
  deleteRequirement(id)
  renderRequirements();
  renderSidebar();
}

// function handleAddCategory() { ... }
// function handleExport() { ... }
// function handleImport() { ... }

function initEventListeners(){
  // Project sidebar
  document.getElementById('btn-add-project').addEventListener('click', e => {

    document.getElementById('modal-name').value = '';
    document.getElementById('modal-overlay').classList.add('open');
    setTimeout(() => document.getElementById('modal-name').focus(), 50); // Timer to set when the keyboard shortcuts for modal kick in
  });
  document.getElementById('project-list').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'select-project') {handleSelectProject(id);}
    if (action === 'delete-project') handleDeleteProject(id, e);
  });


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

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}


document.addEventListener('DOMContentLoaded', init);