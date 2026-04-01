export const LEVELS = {
  sys: { prefix: 'SYS', label: 'System',     badge: 'badge-sys' },
  sub: { prefix: 'SUB', label: 'Subsystem',  badge: 'badge-sub' },
  der: { prefix: 'DER', label: 'Derived',    badge: 'badge-der' },
};

export function sortRequirements(reqs) {
const LEVEL_ORDER = { sys: 0, sub: 1, der: 2 };
  return [...reqs].sort((a, b) => {
    const diff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    return diff !== 0 ? diff : a.id.localeCompare(b.id); // use localeCompare to ensure alphabetical / lexiographical ordering of reqs of the same level
  });
}

// Generate the next sequential ID for a given level.
// Mutates counters in place and returns the new ID string.
export function generateId(counters, level) {
  counters[level]++;
  return LEVELS[level].prefix + '-' + String(counters[level]).padStart(3, '0');
}

// Returns true if a parent ID is valid within the given reqs array.
export function validateParent(reqs, parentId) {
  if (!parentId) return true;
  return reqs.some(r => r.id === parentId);
}

// Recursively collect all requirement IDs that are children of a given req ID.
// Used when cascade-deleting a requirement and its children.
export function getDescendantReqIds(reqId, allReqs) {
  const ids = new Set();
  let frontier = [reqId];

  while (frontier.length > 0) {
    const children = allReqs
      .filter(r => frontier.includes(r.parent))
      .map(r => r.id);
    children.forEach(id => ids.add(id));
    frontier = children;
  }

  return ids;
}

// Parse a level string from a requirement ID prefix.
// e.g. 'SYS-001' -> 'sys'
export function levelFromId(id) {
  const prefix = id.split('-')[0];
  const map = { SYS: 'sys', SUB: 'sub', DER: 'der' };
  return map[prefix] || null;
}

// Rebuild counters object from an existing array of requirements.
// Used after import to ensure new IDs continue from the right number.
export function rebuildCounters(reqs) {
  const counters = { sys: 0, sub: 0, der: 0 };
  for (const req of reqs) {
    const level = levelFromId(req.id);
    if (!level) continue;
    const num = parseInt(req.id.split('-')[1], 10);
    if (num > counters[level]) counters[level] = num;
  }
  return counters;
}
