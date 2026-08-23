const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');

const router = express.Router();

function publicProfile(profile) {
  return {
    id: profile.id,
    workspace_id: profile.workspace_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatar_url,
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const profile = db
    .prepare('SELECT * FROM profiles WHERE email = ?')
    .get(String(email).trim().toLowerCase());

  if (!profile || !bcrypt.compareSync(String(password), profile.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  if (!profile.active) {
    return res.status(403).json({ error: 'Seu acesso está inativo. Fale com um administrador.' });
  }

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(profile.workspace_id);
  res.json({ token: signToken(profile), user: publicProfile(profile), workspace });
});

router.get('/me', requireAuth, (req, res) => {
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId);
  const member = db
    .prepare('SELECT id, name, role_title, photo_url FROM team_members WHERE profile_id = ?')
    .get(req.user.id);
  res.json({ user: publicProfile(req.user), workspace, team_member: member || null });
});

router.put('/me', requireAuth, (req, res) => {
  const data = parse(req.body, {
    name: { required: true, min: 2, max: 80 },
    avatar_url: { max: 500 },
  });

  db.prepare("UPDATE profiles SET name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?")
    .run(data.name, data.avatar_url, req.user.id);

  db.prepare("UPDATE team_members SET name = ?, updated_at = datetime('now') WHERE profile_id = ?")
    .run(data.name, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: req.user.id,
    action: 'update',
    description: data.name + ' atualizou o próprio perfil',
  });

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  res.json({ user: publicProfile(profile) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);

  if (!currentPassword || !bcrypt.compareSync(String(currentPassword), profile.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });
  }

  db.prepare("UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(bcrypt.hashSync(String(newPassword), 10), req.user.id);

  res.json({ ok: true });
});

module.exports = router;
module.exports.publicProfile = publicProfile;
