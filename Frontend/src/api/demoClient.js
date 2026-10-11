import { createDemoServer } from '../../../shared/demoServer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The browser-only API: the shared server code with sample data in localStorage plus a little latency.
// Order events are fanned out to every open tab through a BroadcastChannel, so the kitchen tab and a
// customer tab update each other just like Socket.IO does against the real server.
export function createDemoClient({ latency = [40, 120] } = {}) {
  let storage = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null; // blocked storage: the preview still works until the page is closed
  }
  const listeners = new Set();
  let channel = null;
  try {
    channel = new BroadcastChannel('fs-preview');
  } catch {
    channel = null;
  }
  const deliver = (msg) => listeners.forEach((fn) => fn(msg));
  const server = createDemoServer({
    storage,
    onEvent: (msg) => {
      deliver(msg);
      channel?.postMessage(msg);
    },
  });
  if (channel) {
    channel.onmessage = (e) => {
      server.invalidate();
      deliver(e.data);
    };
  }
  window.addEventListener('pagehide', () => server.flush());
  return {
    async request(method, path, opts) {
      const [min, max] = latency;
      await sleep(min + Math.random() * (max - min));
      return server.request(method, path, opts);
    },
    async reset() {
      await server.reset();
      channel?.postMessage({ event: 'reset', payload: null, rooms: [] });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

let instance = null;
export const getDemoClient = () => (instance ||= createDemoClient());
