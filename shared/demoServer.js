// The whole API running in the browser: same routes, roles and rules as the server, with the
// sample data kept in storage (localStorage in the Live preview). Also works in Node (used by tests).
import { dispatch } from './engine.js';
import { ROUTES, publicUser } from './routes.js';
import { buildDataset } from './seed.js';
import { createMemoryStore } from './memoryStore.js';

export const DB_KEY = 'fs_preview_db_v1';
const VERSION = 1;

// Sample-account passwords are hashed (SHA-256) before they are stored, like the server would hash them.
export async function hashPassword(email, plain) {
  const data = new TextEncoder().encode(`fs:${String(email).toLowerCase()}:${plain}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return `sha256:${[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function createDemoServer({ storage = null, key = DB_KEY, now = () => new Date(), onEvent = null } = {}) {
  let db = null;

  const persist = () => {
    if (!storage || !db) return;
    try {
      storage.setItem(key, JSON.stringify(db));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  };

  const fresh = async () => {
    const ds = buildDataset({ now: now() });
    for (const u of ds.users) u.password = await hashPassword(u.email, u.password);
    return { ...ds, version: VERSION };
  };

  const load = async () => {
    if (db) return db;
    try {
      const raw = storage?.getItem(key);
      if (raw) db = JSON.parse(raw);
    } catch {
      db = null;
    }
    if (!db || db.version !== VERSION || !db.users) {
      db = await fresh();
      persist();
    }
    return db;
  };

  const helpers = {
    hashPassword: (plain, email) => hashPassword(email, plain),
    verifyPassword: async (email, password) => {
      const hash = await hashPassword(email, password);
      return db.users.find((u) => u.email === email && u.password === hash) || null;
    },
    signToken: (u) => `demo.${u._id}.${u.tokenVersion || 0}`,
    emit: (event, payload, rooms) => onEvent?.({ event, payload, rooms }),
  };

  const authenticate = (token) => {
    const [tag, id, tv] = String(token || '').split('.');
    if (tag !== 'demo' || !id) return { error: 'Invalid or expired token' };
    const u = db.users.find((x) => x._id === id);
    if (!u) return { error: 'User no longer exists' };
    if (Number(tv) !== (u.tokenVersion || 0)) return { error: 'Token has been revoked' };
    if (u.active === false) return { error: 'This account has been disabled' };
    return { user: { id: u._id, role: u.role, name: u.name } };
  };

  return {
    // request('GET', '/menu', { query, body, token }) -> { status, body }
    async request(method, path, { query = {}, body = {}, token = null } = {}) {
      await load();
      const store = createMemoryStore(db, persist);
      let user = null;
      if (token) {
        const r = authenticate(token);
        if (r.error) {
          if (!ROUTES.some((x) => x.public && x.method === method && x.path === path)) return { status: 401, body: { error: r.error } };
        } else user = r.user;
      }
      return dispatch(ROUTES, { method, path, query, body, user, store, helpers, now: now(), tz: query.tz }, { onError: (e) => console.error(e) });
    },
    // Replace everything with the original sample data.
    async reset() {
      db = await fresh();
      persist();
    },
    // Another tab changed the stored data: read it again on the next request.
    invalidate() {
      db = null;
    },
    async whoami(token) {
      await load();
      const r = authenticate(token);
      return r.error ? null : publicUser(db.users.find((u) => u._id === r.user.id));
    },
    flush: persist,
  };
}
