import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Stejný alias jako ve vite.config.ts — testy můžou importovat komponenty přes '@/…'.
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
