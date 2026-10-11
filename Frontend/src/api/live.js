import { API_URL, IS_PREVIEW } from './config';

// Real-time channel. Real mode: Socket.IO against the API. Live preview: the in-browser server's event bus.
// connectLive({ token, user }) -> { on(event, fn) -> off, close() }
export async function connectLive({ token, user }) {
  const handlers = new Map();
  const fire = (event, payload) => handlers.get(event)?.forEach((fn) => fn(payload));
  const api = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event)?.delete(fn);
    },
    close() {},
    status: 'connected',
  };
  if (IS_PREVIEW) {
    const { getDemoClient } = await import('./demoClient');
    const client = getDemoClient();
    const staff = user.role === 'kitchen' || user.role === 'admin';
    const off = client.subscribe(({ event, payload, rooms }) => {
      if (event === 'reset') return fire('reset', null);
      if ((rooms || []).some((r) => (r === 'staff' && staff) || r === `user:${user.id}`)) fire(event, payload);
    });
    api.close = off;
    return api;
  }
  const { io } = await import('socket.io-client');
  const socket = io({ path: `${API_URL}/socket.io`, auth: { token }, transports: ['websocket', 'polling'] });
  for (const e of ['order:new', 'order:update', 'notification']) socket.on(e, (p) => fire(e, p));
  socket.on('connect', () => { api.status = 'connected'; fire('status', 'connected'); });
  socket.on('disconnect', () => { api.status = 'offline'; fire('status', 'offline'); });
  api.status = 'connecting';
  api.close = () => socket.close();
  return api;
}
