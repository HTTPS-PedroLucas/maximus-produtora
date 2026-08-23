const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');

const router = express.Router();

const USER_FIELDS = 'id, name, email, role, avatar_url, active, created_at';

router.use(requireAuth);

router.get('/', (req, res) => {
  const users = db
    .prepare(
      `SELECT ${USER_FIELDS} FROM profiles WHERE workspace_id = ? ORDER BY active DESC, name`
    )
    .all(req.workspaceId);
  res.json(users);
});

router.post('/', requireAdmin, (req, res) => {
  const data = parse(req.body, {
    name: { required: true, min: 2, max: 80 },
    email: { required: true, type: 'email' },
    password: { required: true, min: 6, max: 100 },
    role: { required: true, enum: ['admin', 'member'] },
    role_title: { max: 80 },
  });

  const exists = db.prepare('SELECT id FROM profiles WHERE email = ?').get(data.email);
  if (exists) return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });

  const info = db
    .prepare('INSERT INTO profiles (workspace_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(req.workspaceId, data.name, data.email, bcrypt.hashSync(data.password, 10), data.role);

  const profileId = Number(info.lastInsertRowid);

  // Todo usuário também vira membro da equipe, para poder ser escalado nas gravações.
  db.prepare(
    `INSERT INTO team_members (workspace_id, profile_id, name, role_title, email, active, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(req.workspaceId, profileId, data.name, data.role_title, data.email, req.user.id, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: profileId,
    action: 'create',
    description: req.user.name + ' criou o acesso de ' + data.name,
  });

  res.status(201).json(db.prepare(`SELECT ${USER_FIELDS} FROM profiles WHERE id = ?`).get(profileId));
});

router.put('/:id', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM profiles WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const data = parse(req.body, {
    name: { required: true, min: 2, max: 80 },
    role: { required: true, enum: ['admin', 'member'] },
    active: { type: 'boolean', default: 1 },
  });

  // O workspace nunca pode ficar sem nenhum administrador ativo.
  const activeAdmins = db
    .prepare("SELECT COUNT(*) AS total FROM profiles WHERE workspace_id = ? AND role = 'admin' AND active = 1")
    .get(req.workspaceId).total;
  const losingAdmin =
    current.role === 'admin' && current.active === 1 && (data.role !== 'admin' || data.active === 0);
  if (losingAdmin && activeAdmins <= 1) {
    return res.status(400).json({ error: 'É preciso manter ao menos um administrador ativo.' });
  }

  db.prepare("UPDATE profiles SET name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?")
    .run(data.name, data.role, data.active, current.id);
  db.prepare("UPDATE team_members SET name = ?, updated_at = datetime('now') WHERE profile_id = ?")
    .run(data.name, current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: current.id,
    action: 'update',
    description: req.user.name + ' atualizou o acesso de ' + data.name,
  });

  res.json(db.prepare(`SELECT ${USER_FIELDS} FROM profiles WHERE id = ?`).get(current.id));
});

router.post('/:id/reset-password', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM profiles WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const { password } = req.body || {};
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
  }

  db.prepare("UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(bcrypt.hashSync(String(password), 10), current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: current.id,
    action: 'update',
    description: req.user.name + ' redefiniu a senha de ' + current.name,
  });

  res.json({ ok: true });
});

module.exports = router;
