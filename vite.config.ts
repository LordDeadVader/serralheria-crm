/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// O CRM é publicado dentro do Worker do site, em /crm/ (arquivos em worker/public/crm).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_PATH ?? '/crm/') : '/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1400, outDir: 'worker/public/crm', emptyOutDir: true },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
}));
