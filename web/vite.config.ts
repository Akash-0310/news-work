import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';

/**
 * Vite configuration.
 *
 * `envDir` points at the repository root because a single `.env` is shared by docker
 * compose and both workspaces. Only `VITE_*` variables are ever exposed to the bundle,
 * so provider API keys and database credentials in that same file cannot leak into the
 * browser -- Vite refuses to inline anything without the prefix.
 */
export default defineConfig(({ mode }) => {
  // `import.meta.dirname` (Node 20.11+, which package.json already requires) rather
  // than `__dirname`: Vite's native config loader does not provide CommonJS globals.
  const here = import.meta.dirname;
  const repoRoot = path.resolve(here, '..');
  const env = loadEnv(mode, repoRoot, 'VITE_');
  const apiBaseUrl = env['VITE_API_BASE_URL'] ?? 'http://localhost:4000/api';

  return {
    plugins: [react(), tailwindcss()],
    envDir: repoRoot,

    resolve: {
      alias: { '@': path.resolve(here, 'src') },
    },

    server: {
      port: 5173,
      // Fail loudly instead of silently moving to 5174, which would break the API's
      // CORS allowlist and produce confusing "blocked by CORS" errors.
      strictPort: true,
      proxy: {
        // Lets the app be used same-origin during development if desired. The default
        // path is the absolute VITE_API_BASE_URL, so this is opt-in.
        '/api': {
          target: apiBaseUrl.replace(/\/api$/, ''),
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Warn earlier than Vite's 500 kB default: this app should stay well under it
      // thanks to route-level code splitting.
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          /**
           * Split rarely-changing vendor code so an app deploy does not invalidate it
           * in users' caches.
           *
           * Function form, not the object form: Rollup 5 (shipped with Vite 8) accepts
           * only a callback here. Matching on the `node_modules/<pkg>` path segment
           * rather than a bare substring avoids miscategorising unrelated packages
           * whose names merely contain "react".
           */
          manualChunks: (id: string) => {
            const match = /node_modules[/\\](?<pkg>@[^/\\]+[/\\][^/\\]+|[^/\\]+)/.exec(id);
            const pkg = match?.groups?.['pkg']?.replace(/\\/g, '/');
            if (!pkg) return undefined;

            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router' || pkg === 'react-router-dom') {
              return 'react';
            }
            if (pkg === '@tanstack/react-query' || pkg === 'axios') return 'query';
            return undefined;
          },
        },
      },
    },
  };
});
