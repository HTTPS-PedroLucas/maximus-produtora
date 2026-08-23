import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O proxy evita configurar CORS no desenvolvimento: o front chama /api
// e o Vite encaminha para a API da Máximus.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4100', changeOrigin: true },
    },
  },
});
