// Runs against a throwaway database (cm_test_<pid>) that is dropped afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cm_uploads_'));
const BASE = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB = `cm_test_${process.pid}`;

const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcryptjs');
const { Server } = await import('socket.io');
const { io: ioClient } = await import('socket.io-client');
const { createApp } = await import('../app.js');
const { MODELS, Counter, User } = await import('../models/index.js');
const { buildDataset } = await import('../../shared/seed.js');
const { runScenario } = await import('../../shared/test/scenario.js');
const { authenticateToken } = await import('../middleware/auth.js');

const server = http.createServer();
const io = new Server(server, { path: '/api/socket.io' });
io.use(async (socket, next) => {
  const { user, error } = await authenticateToken(String(socket.handshake.auth?.token || ''));
  if (error) return next(new Error(error));
  socket.data.user = user;
  next();
});
io.on('connection', (s) => {
  s.join(`user:${s.data.user.id}`);
  if (s.data.user.role !== 'customer') s.join('staff');
});
const app = createApp({ rateLimit: false, io });
server.on('request', app);

async function seed() {
  const { counters, ...cols } = buildDataset({ now: new Date() });
  for (const u of cols.users) u.password = await bcrypt.hash(u.password, 4);
  for (const [n, docs] of Object.entries(cols)) await MODELS[n].insertMany(docs);
  for (const [n, value] of Object.entries(counters)) await Counter.updateOne({ _id: n }, { $set: { value } }, { upsert: true });
}

before(async () => {
  await mongoose.connect(`${BASE}/${DB}`);
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();
  await seed();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
});
after(async () => {
  io.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

const call = async (method, p, { body, query, token } = {}) => {
  let r = request(app)[method.toLowerCase()](`/api${p}`);
  if (token) r = r.set('Authorization', `Bearer ${token}`);
  if (query) r = r.query(query);
  if (body) r = r.send(body);
  const res = await r;
  return { status: res.status, body: res.body };
};

test('shared scenario passes against Express + Mongo', async () => {
  await runScenario(call);
});

test('uploaded dish images are stored and served', async () => {
  const login = (await call('POST', '/auth/login', { body: { email: 'admin@foodshop.example', password: 'Admin@123' } })).body.token;
  const cat = (await call('GET', '/menu')).body.categories[0];
  const png = `data:image/png;base64,${Buffer.from('not-really-a-png').toString('base64')}`;
  const d = await call('POST', '/admin/dishes', { token: login, body: { name: 'Upload Dish', categoryId: cat._id, price: 10, image: png } });
  assert.equal(d.status, 201);
  assert.match(d.body.image, /^uploads\/.+\.png$/);
  const file = await request(app).get(`/api/${d.body.image}`);
  assert.equal(file.status, 200);
  const bad = await call('POST', '/admin/dishes', { token: login, body: { name: 'Bad', categoryId: cat._id, price: 10, image: 'data:text/html;base64,PGI+' } });
  assert.equal(bad.status, 400);
});

test('health, bad JSON and auth errors', async () => {
  assert.equal((await request(app).get('/health')).body.ok, true);
  assert.equal((await request(app).get('/api/health')).body.ok, true);
  assert.equal((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad')).status, 400);
  const r = await request(app).get('/api/orders').set('Authorization', 'Bearer nonsense');
  assert.equal(r.status, 401);
  assert.equal((await request(app).get('/api/nothing-here')).status, 404);
});

test('Socket.IO pushes live order events to the kitchen and the customer', async () => {
  const { port } = server.address();
  const tok = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).body.token;
  const [customer, kitchen] = [await tok('demo@example.com', 'Demo@1234'), await tok('kitchen@foodshop.example', 'Kitchen@123')];
  const connect = (token) => new Promise((resolve, reject) => {
    const s = ioClient(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
  const bad = await new Promise((resolve) => {
    const s = ioClient(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token: 'nope' }, transports: ['websocket'], reconnection: false });
    s.on('connect_error', (e) => { s.close(); resolve(e.message); });
  });
  assert.match(bad, /Invalid/);
  const k = await connect(kitchen);
  const c = await connect(customer);
  const got = { newOrder: new Promise((r) => k.once('order:new', r)), update: new Promise((r) => c.once('order:update', r)) };
  const dish = (await call('GET', '/menu')).body.dishes[0];
  const o = await call('POST', '/orders', { token: customer, body: { items: [{ dish: dish._id, qty: 1 }], mode: 'pickup', pay: 'cod', name: 'Demo', phone: '1234567' } });
  assert.equal((await got.newOrder).code, o.body.code);
  await call('PATCH', `/orders/${o.body._id}/status`, { token: kitchen, body: { status: 'preparing' } });
  assert.equal((await got.update).status, 'preparing');
  k.close();
  c.close();
});
