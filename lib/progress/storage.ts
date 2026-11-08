import { emptyProgress, type ProgressState } from "./logic";

const GUEST_KEY = "gridwise.progress.v1";
const userKey = (uid: string) => `gridwise.progress.v1.${uid}`;

function read(key: string): ProgressState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProgressState;
    return p && p.v === 1 ? { ...emptyProgress(), ...p } : null;
  } catch {
    return null;
  }
}
function write(key: string, s: ProgressState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* private window or storage full: progress simply will not persist */
  }
}

export const loadGuest = () => read(GUEST_KEY);
export const saveGuest = (s: ProgressState) => write(GUEST_KEY, s);
export function clearGuest() {
  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {}
}
export const loadUserCache = (uid: string) => read(userKey(uid));
export const saveUserCache = (uid: string, s: ProgressState) => write(userKey(uid), s);
