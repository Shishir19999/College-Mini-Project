// Transport-free request engine: route matching, role checks, validation and errors.
// Express (server) and the in-browser Live preview both feed requests into `dispatch`.
import { validate } from './validate.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createRegistry() {
  const routes = [];
  // add('GET', '/path/:id', { public, roles, schema }, handler)
  const add = (method, path, opts, handler) => {
    routes.push({ method, path, segs: path.split('/').filter(Boolean), ...opts, handler });
  };
  return { routes, add };
}

function matchPath(segs, parts) {
  if (segs.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].startsWith(':')) params[segs[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (segs[i] !== parts[i]) return null;
  }
  return params;
}

export function findRoute(routes, method, path) {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method) continue;
    const params = matchPath(r.segs, parts);
    if (params) return { route: r, params };
  }
  return null;
}

const fail = (status, error) => ({ status, body: { error } });

// request: { method, path, query, body, user, store, helpers, now }
export async function dispatch(routes, request, { onError } = {}) {
  const { method, path, query = {}, body = {}, user = null, store, helpers = {} } = request;
  const now = request.now || new Date();
  const hit = findRoute(routes, method, path);
  if (!hit) return fail(404, 'Not found');
  const { route, params } = hit;
  if (!route.public && !user) return fail(401, 'Authentication required');
  if (route.roles && !route.roles.includes(user?.role)) return fail(403, 'You do not have permission to do that');
  let data = body;
  if (route.schema) {
    const parsed = validate(body, route.schema);
    if (!parsed.ok) return fail(400, parsed.errors.join('; '));
    data = parsed.value;
  }
  const tzRaw = Number(request.tz ?? query.tz);
  const ctx = { store, user, params, query, body: data, raw: body, now, helpers, tz: Number.isFinite(tzRaw) ? tzRaw : 0 };
  try {
    const result = await route.handler(ctx);
    return { status: route.status || 200, body: result === undefined ? { ok: true } : result };
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message);
    onError?.(err);
    return fail(500, 'Internal Server Error');
  }
}
