const fs = require('fs');
const path = require('path');
const db = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Aplica, em ordem, as migrations ainda não executadas.
 * Cada arquivo .sql roda dentro de uma transação e é registrado em schema_migrations.
 */
function runMigrations({ silent = false } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const executed = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Falha na migration ${file}: ${err.message}`);
    }
    executed.push(file);
    if (!silent) console.log(`[migrate] aplicada: ${file}`);
  }

  if (!silent && executed.length === 0) console.log('[migrate] banco já está atualizado.');
  return executed;
}

module.exports = { runMigrations };
