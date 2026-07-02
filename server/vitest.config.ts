import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    // Tests share a single SQLite DB; running files in parallel causes
    // cross-file race conditions on shared usernames (e.g. 'alice') and
    // on deleteMany ordering. Run test files serially.
    fileParallelism: false,
  },
})