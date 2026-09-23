// Tiny module-level store for "who am I" (no auth in this challenge — see README).
// Lets the axios client read the current id synchronously without React context plumbing.
const STORAGE_KEY = 'zangoh.supervisorId';
const DEFAULT_ID = 'supervisor-001';

export const KNOWN_SUPERVISORS = [
  { id: 'supervisor-001', name: 'Jordan Blake' },
  { id: 'supervisor-002', name: 'Sam Rivera' },
  { id: 'supervisor-003', name: 'Casey Morgan' },
];

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

let current = readStored();
const listeners = new Set();

export function getSupervisorId() {
  return current;
}

export function setSupervisorId(id) {
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore (private browsing / storage disabled) */
  }
  listeners.forEach((listener) => listener(id));
}

export function subscribeSupervisor(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function supervisorName(id) {
  return KNOWN_SUPERVISORS.find((s) => s.id === id)?.name || id;
}
