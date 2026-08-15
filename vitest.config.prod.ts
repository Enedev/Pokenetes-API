import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

const gates = JSON.parse(readFileSync('./coverage-gates.json', 'utf8')) as {
  test: number;
  prod: number;
};

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      all: true,
      thresholds: {
        lines: gates.prod,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
