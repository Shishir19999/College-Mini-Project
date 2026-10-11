// localStorage helpers that never throw (private windows, blocked storage).
export const load = (key, fallback, session = false) => {
  try {
    const v = (session ? sessionStorage : localStorage).getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
export const save = (key, value, session = false) => {
  try {
    (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* blocked */
  }
};
export const drop = (key) => {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* blocked */
  }
};
