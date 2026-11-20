#!/usr/bin/env node
/**
 * Local PostgreSQL for development — no Docker or system install needed.
 * Uses the `embedded-postgres` npm package (downloads Postgres binaries for your OS).
 *
 *   npm run db:start        # starts Postgres on port 5433 and keeps running (Ctrl+C to stop)
 *
 * Data lives in ./.dev-db (git-ignored). Connection string:
 *   postgresql://okidoc:okidoc@localhost:5433/okidoc
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(fileURLToPath(import.meta.url), '../../apps/api/package.json'));
const EmbeddedPostgres = require('embedded-postgres').default ?? require('embedded-postgres');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.dev-db', 'data-utf8');
const port = Number(process.env.DEV_DB_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'okidoc',
  password: 'okidoc',
  port,
  persistent: true,
  // UTF-8 is required for Bengali/Hindi text (Windows would otherwise default to WIN1252).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (e) => console.error('[postgres]', String(e).trim()),
});

const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
if (fresh) {
  console.log('Initialising a new local Postgres cluster in .dev-db ...');
  await pg.initialise();
}
await pg.start();
if (fresh) {
  try {
    await pg.createDatabase('okidoc');
  } catch (e) {
    if (!String(e).includes('already exists')) throw e;
  }
}
console.log(`Postgres running → postgresql://okidoc:okidoc@localhost:${port}/okidoc  (Ctrl+C to stop)`);

const stop = async () => {
  console.log('\nStopping Postgres ...');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
