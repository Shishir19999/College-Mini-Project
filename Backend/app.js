import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { dispatch, findRoute } from '../shared/engine.js';
import { ROUTES } from '../shared/routes.js';
import { authenticateRequest, passwordHelpers } from './middleware/auth.js';
import { createMongoStore } from './store/mongoStore.js';
import { createLimiter } from './utils/rateLimit.js';
import { createContactMailer } from './utils/mail.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = () => process.env.UPLOAD_DIR || path.join(here, 'uploads');
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', gif: 'gif' };

// CORS_ORIGIN: comma-separated list of allowed browser origins. Unset = allow any origin (dev).
export function corsOptions() {
  const list = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? { origin: list } : {};
}
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

// rateLimit: false turns the limiters off (tests). The API lives under /api; `io` (optional) is the Socket.IO server.
export function createApp({ rateLimit = true, io = null } = {}) {
  const app = express();
  const store = createMongoStore();
  const helpers = {
    ...passwordHelpers,
    sendContactMail: createContactMailer(),
    emit: (event, payload, rooms) => {
      if (io) for (const r of rooms || []) io.to(r).emit(event, payload);
    },
    async saveImage(dataUrl, type) {
      fs.mkdirSync(uploadDir(), { recursive: true });
      const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${EXT[type] || 'png'}`;
      fs.writeFileSync(path.join(uploadDir(), name), Buffer.from(dataUrl.split(',')[1], 'base64'));
      return `uploads/${name}`;
    },
  };
  app.disable('x-powered-by');
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '1mb' }));
  // Express 5 leaves req.body undefined when no body is sent; keep an empty object.
  app.use((req, res, next) => { if (req.body === undefined) req.body = {}; next(); });

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/uploads', (req, res, next) => express.static(uploadDir(), { maxAge: '7d', setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') })(req, res, next));

  if (rateLimit) {
    const failedLogins = createLimiter({
      windowMs: num(process.env.LOGIN_WINDOW_MS, 15 * 60 * 1000),
      max: num(process.env.LOGIN_MAX_FAILURES, 10),
      key: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
      countOnly: (res) => res.statusCode === 401,
      message: 'Too many failed sign-in attempts. Please wait a few minutes and try again.',
    });
    api.use(createLimiter({ windowMs: 60 * 1000, max: num(process.env.RATE_LIMIT_PER_MINUTE, 600), message: 'Too many requests. Please slow down.' }));
    api.post('/auth/login', failedLogins);
  }

  api.use(async (req, res) => {
    try {
      const { user, error } = await authenticateRequest(req);
      const hit = findRoute(ROUTES, req.method, req.path);
      if (error && !(hit && hit.route.public)) return res.status(401).json({ error });
      const out = await dispatch(
        ROUTES,
        { method: req.method, path: req.path, query: req.query, body: req.body, user: error ? null : user, store, helpers, now: new Date() },
        { onError: (e) => console.error(e) },
      );
      res.status(out.status).json(out.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  app.use('/api', api);
  app.get('/health', (req, res) => res.json({ ok: true }));

  // body-parser failures (bad JSON, payload too large)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 400).json({ error: err.type === 'entity.too.large' ? 'Request body is too large' : 'Malformed request body' });
  });
  return app;
}
