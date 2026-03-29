const LEVELS = {
  sys: { prefix: 'SYS', label: 'System',     badge: 'badge-sys' },
  sub: { prefix: 'SUB', label: 'Subsystem',  badge: 'badge-sub' },
  der: { prefix: 'DER', label: 'Derived',    badge: 'badge-der' },
};

export function nextId(proj, level) {
  proj.counters[level]++;
  return LEVELS[level].prefix + '-' + String(proj.counters[level]).padStart(3, '0');
}