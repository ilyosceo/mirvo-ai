import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    {
      name: 'disable-hmr-websocket-in-iframe',
      apply: 'serve',
      enforce: 'post',
      transform(code, id) {
        if (id.includes('/vite/dist/client/client.mjs') || id.includes('@vite/client')) {
          return code
            .replace(
              /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
              '/* HMR WebSocket disabled */'
            )
            .replace(
              /throw new Error\(["']send was called before connect["']\);?/g,
              'return;'
            )
            .replace(
              /throw new Error\(["']invoke was called before connect["']\);?/g,
              'return undefined;'
            );
        }
        if (id.includes('pwa-entry-point-loaded')) {
          return code.replace(
            /import\.meta\.hot\.send\([^)]*\);?/g,
            "if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/', type: 'module' }).catch(() => {}); }"
          );
        }
        return null;
      },
    },
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'offline-3d-primitives.json',
      ],
      manifest: {
        id: '/',
        name: 'Mirvo AI — Interaktiv Doska',
        short_name: 'Mirvo AI',
        description:
          "O'zbek tilidagi interaktiv 2D/3D vizual doska, ovozli ustoz va videodan dars yaratish muhiti.",
        theme_color: '#F5F5F7',
        background_color: '#F5F5F7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,json}'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three/') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/')
          ) {
            return 'vendor-3d';
          }
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex';
          }
          if (id.includes('node_modules/3dmol')) {
            return 'vendor-3dmol';
          }
          if (id.includes('node_modules/plotly.js-dist-min')) {
            return 'vendor-plotly';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
});
