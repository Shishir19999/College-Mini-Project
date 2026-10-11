import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_BASE = '/College-Mini-Project/';

// Modes: default (full stack, talks to the API), `preview` (the Live preview served at /),
// `pages` (the Live preview built for GitHub Pages under the repository path).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const preview = mode === 'pages' || mode === 'preview' || env.VITE_PREVIEW === 'true';
  return {
    base: mode === 'pages' ? REPO_BASE : env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      fs: { allow: ['..'] },
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080', ws: true, changeOrigin: true },
      },
    },
    define: preview ? { 'import.meta.env.VITE_PREVIEW': JSON.stringify('true') } : {},
    test: { environment: 'node', include: ['src/**/*.test.js'] },
  };
});
