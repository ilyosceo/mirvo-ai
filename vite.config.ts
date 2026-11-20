import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BACKEND_URL || 'https://mirvo-ai.vercel.app',
        changeOrigin: true,
      },
    },
  },
});
