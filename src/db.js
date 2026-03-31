import { openDB } from'https://cdn.jsdelivr.net/npm/idb@8/+esm';
//import { openDB } from './lib/idb.js';

let db;

export const initDB =  async () => {
    db = await openDB('ReqStack', 1, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);

      // Projects store — keyed by id
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
        console.log('Created object store: projects');
      }

      // Categories store — keyed by id
      if (!db.objectStoreNames.contains('categories')) {
        const categories = db.createObjectStore('categories', { keyPath: 'id' });
        categories.createIndex('by_project', 'projectId')
        console.log('Created object store: categories');
      }

      // Requirements store — keyed by id, indexed by project
      if (!db.objectStoreNames.contains('requirements')) {
        const reqs = db.createObjectStore('requirements', { keyPath: 'id' });
        reqs.createIndex('by_project', 'projectId', { unique: false });
        reqs.createIndex('by_parent', 'parentCategoryId', { unique: false });
        console.log('Created object store: categories');
      }
    }
  });

  console.log('DB opened successfully:', db.name, 'version', db.version);
  return db;
}

export const verifyDB = async () => {
  console.log('--- Verification ---');
  const projects = await db.getAll('projects');
  console.log(`Projects: ${projects.length}`);
  for (const p of projects) {
    const reqs = await db.getAllFromIndex('requirements', 'by_project', p.id);
    console.log(`  "${p.name}" — ${reqs.length} requirement(s)`);
    reqs.forEach(r => console.log(`    ${r.id} [${r.level}] ${r.text.slice(0, 50)}`));
  }
  console.log('--- End verification ---');

}

export async function migrateDB(){
  const projects =  await getProjects();

  for (const project of (projects || [])){
    const reqs = await getRequirements();
    for (const req of (reqs || [])) {
      await saveRequirement({
        ...req,
        categoryId: null,
      });
    }
  }
}

// Data access functions — all use the module-scoped db handle
export async function getProjects() {
  return db.getAll('projects');
}

export async function saveProject(project) {
  return db.put('projects', project);
}

export async function deleteProject(id) {
  return db.delete('projects', id);
}

export async function getRequirements(projectId) {
  return db.getAllFromIndex('requirements', 'by_project', projectId);
}

export async function saveRequirement(req) {
  return db.put('requirements', req);
}

export async function deleteRequirement(id) {
  return db.delete('requirements', id);
}

export async function getCategories(projectId) {
  return db.getAllFromIndex('categories', 'by_project', projectId);
}

export async function saveCategory(category) {
  return db.put('categories', category);
}

export async function deleteCategory(id) {
  return db.delete('categories', id);
}