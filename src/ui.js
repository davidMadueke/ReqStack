import { initDB, verifyDB, getProjects, saveProject, deleteProject, 
         getRequirements, saveRequirement, deleteRequirement,
         getCategories, saveCategory, deleteCategory } from "./db.js"

// ── STATE ──
// Only UI-level state lives here
let activeProjectId  = null;
let activeCategoryId = null;
let activeFilter     = 'all';

// ── INIT ──
// Entry point — called once on page load
async function init() { 
    await initDB();
    await verifyDB();


    //renderSidebar();
    //renderMain();
}

function renderSidebar() {
  const list = document.getElementById('project-list');
  if (projects.length === 0) {
    list.innerHTML = '<div class="no-projects">No projects yet.<br/>Click + to add one.</div>';
    return;
  }
  list.innerHTML = projects.map(p => {
    const active = p.id === activeProjectId ? 'active' : '';
    return `<div class="project-item ${active}" onclick="selectProject('${p.id}')">
      <div class="project-dot"></div>
      <div class="project-name" title="${esc(p.name)}">${esc(p.name)}</div>
      <div class="project-count">${p.reqs.length}</div>
      <button class="project-del" title="Delete project" onclick="deleteProject('${p.id}', event)">×</button>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);