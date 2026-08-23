const bcrypt = require('bcryptjs');
const db = require('../db');

const WORKSPACE_SLUG = process.env.WORKSPACE_SLUG || 'maximus-produtora';
const WORKSPACE_NAME = process.env.WORKSPACE_NAME || 'Máximus Produtora';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administração Máximus';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@maximusprodutora.com.br').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'maximus123';

/**
 * Garante que existe o workspace da Máximus e ao menos um administrador.
 * Roda a cada inicialização e é idempotente.
 */
function ensureBaseData({ silent = false } = {}) {
  let workspace = db.prepare('SELECT * FROM workspaces WHERE slug = ?').get(WORKSPACE_SLUG);

  if (!workspace) {
    const info = db
      .prepare('INSERT INTO workspaces (name, slug, timezone, home_city, home_region) VALUES (?, ?, ?, ?, ?)')
      .run(
        WORKSPACE_NAME,
        WORKSPACE_SLUG,
        process.env.TIMEZONE || 'America/Fortaleza',
        process.env.HOME_CITY || 'Senador Pompeu',
        process.env.HOME_REGION || 'Sertão Central'
      );
    workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(Number(info.lastInsertRowid));
    if (!silent) console.log(`[bootstrap] workspace criado: ${workspace.name}`);
  }

  const admins = db
    .prepare("SELECT COUNT(*) AS total FROM profiles WHERE workspace_id = ? AND role = 'admin'")
    .get(workspace.id).total;

  if (admins === 0) {
    const info = db
      .prepare('INSERT INTO profiles (workspace_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(workspace.id, ADMIN_NAME, ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASSWORD, 10), 'admin');

    const profileId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO team_members (workspace_id, profile_id, name, role_title, email, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(workspace.id, profileId, ADMIN_NAME, 'Coordenação', ADMIN_EMAIL, profileId, profileId);

    if (!silent) {
      console.log(`[bootstrap] administrador criado: ${ADMIN_EMAIL} / senha: ${ADMIN_PASSWORD}`);
      console.log('[bootstrap] troque a senha no primeiro acesso, em Configurações.');
    }
  }

  return workspace;
}

module.exports = { ensureBaseData, WORKSPACE_SLUG, ADMIN_EMAIL, ADMIN_PASSWORD };
