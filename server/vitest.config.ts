import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: '@shared', replacement: resolve(__dirname, '../shared') },
      // 웹 lib 를 그대로 시험할 때 (lib 은 '@/…' 로 가져온다)
      { find: /^@\/(.*)$/, replacement: `${resolve(__dirname, '..')}/$1` },
    ],
  },
});
