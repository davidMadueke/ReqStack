import { saveProject } from "./db.js";

export const confirmAddProject = async () => {
  const name = document.getElementById('modal-name').value.trim();
  if (!name) return;
  const id = 'proj_' + Date.now();
  saveProject({ id, name, reqs: [], counters: { sys: 0, sub: 0, der: 0 } });
  return id; 
}