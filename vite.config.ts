/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serve o projeto em https://<usuario>.github.io/serralheria-crm/
// VITE_BASE_PATH permite sobrescrever (ex.: domínio próprio usa "/").
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_PATH ?? '/serralheria-crm/') : '/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1400 },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
}));
