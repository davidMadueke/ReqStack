export const LEVELS = {
  sys: { prefix: 'SYS', label: 'System',     badge: 'badge-sys' },
  sub: { prefix: 'SUB', label: 'Subsystem',  badge: 'badge-sub' },
  der: { prefix: 'DER', label: 'Derived',    badge: 'badge-der' },
};

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
