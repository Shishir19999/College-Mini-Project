import { API_URL, IS_PREVIEW, getAuthToken } from './config';
import { ApiError, notifyUnauthorized } from './errors';

// The Live preview server is loaded on demand so the full-stack build never ships it.
let demoPromise = null;
const demo = () => (demoPromise ||= import('./demoClient').then((m) => m.getDemoClient()));

const tz = () => new Date().getTimezoneOffset();

async function send(method, path, { params, data, auth = false } = {}) {
  const query = { tz: tz(), ...(params || {}) };
  for (const k of Object.keys(query)) if (query[k] === undefined || query[k] === null || query[k] === '') delete query[k];
  let status;
  let body;
  if (IS_PREVIEW) {
    ({ status, body } = await (await demo()).request(method, path, { query, body: data, token: getAuthToken() }));
  } else {
    try {
      const qs = new URLSearchParams(query).toString();
      const res = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ''}`, {
        method,
        headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
        body: data !== undefined ? JSON.stringify(data) : undefined,
      });
      status = res.status;
      body = await res.json().catch(() => ({}));
    } catch {
      throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
    }
  }
  if (status >= 400) {
    if (status === 401 && !auth) notifyUnauthorized();
    throw new ApiError((typeof body === 'string' ? body : body?.error) || 'Request failed', status);
  }
  return body;
}

export const api = {
  isPreview: IS_PREVIEW,
  get: (path, params) => send('GET', path, { params }),
  post: (path, data, opts) => send('POST', path, { data: data ?? {}, ...opts }),
  put: (path, data) => send('PUT', path, { data }),
  patch: (path, data) => send('PATCH', path, { data }),
  del: (path) => send('DELETE', path),
  auth: {
    login: (email, password) => send('POST', '/auth/login', { data: { email, password }, auth: true }),
    register: (name, email, password) => send('POST', '/auth/register', { data: { name, email, password }, auth: true }),
    logout: () => send('POST', '/auth/logout', { data: {}, auth: true }),
    me: () => send('GET', '/auth/me', { auth: true }),
  },
  // restore the sample data (Live preview only)
  reset: async () => {
    if (IS_PREVIEW) await (await demo()).reset();
  },
};
