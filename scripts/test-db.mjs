// scripts/test-db.mjs — `npm run test:db`
//
// Runs the whole test suite INCLUDING the tests that need a real PostgreSQL
// (lib/*.integration.test.ts): the document registers through their route
// handlers (add / edit / order / delete), and transactions. They use the
// database of .env.local, tag everything they create and remove it again.
// Run this before pushing a change that touches a query.
import { spawnSync } from 'node:child_process'

const result = spawnSync('npx', ['vitest', 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ISMS_DB_TESTS: '1', ISMS_JOBS: 'false' },
})
process.exit(result.status ?? 1)
