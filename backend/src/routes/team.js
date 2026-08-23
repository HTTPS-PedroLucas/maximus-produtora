const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');
const { removeStoredFile } = require('../middleware/upload');

const router = express.Router();

const SELECT_MEMBER = `
  SELECT m.*,
         p.role  AS profile_role,
         p.email AS profile_email,
         p.active AS profile_active,
         creator.name AS created_by_name,
         editor.name  AS updated_by_name
    FROM team_members m
    LEFT JOIN profiles p ON p.id = m.profile_id
    LEFT JOIN profiles creator ON creator.id = m.created_by
    LEFT JOIN profiles editor  ON editor.id  = m.updated_by
`;

const memberSchema = {
  name: { required: true, min: 2, max: 80 },
  role_title: { max: 80 },
  email: { max: 120 },
  photo_url: { max: 500 },
  active: { type: 'boolean', default: 1 },
};

router.use(requireAuth);

router.get('/', (req, res) => {
  const onlyActive = req.query.active === '1';
  const rows = db
    .prepare(
      `${SELECT_MEMBER} WHERE m.workspace_id = ? ${onlyActive ? 'AND m.active = 1' : ''}
       ORDER BY m.active DESC, m.name COLLATE NOCASE`
    )
    .all(req.workspaceId);
  res.json(rows);
});

router.post('/', requireAdmin, (req, res) => {
  const data = parse(req.body, memberSchema);

  const info = db
    .prepare(
      `INSERT INTO team_members (workspace_id, name, role_title, email, photo_url, active, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.workspaceId, data.name, data.role_title, data.email, data.photo_url, data.active, req.user.id, req.user.id);

  const member = db.prepare(`${SELECT_MEMBER} WHERE m.id = ?`).get(Number(info.lastInsertRowid));

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: member.id,
    action: 'create',
    description: req.user.name + ' adicionou ' + member.name + ' à equipe',
  });

  res.status(201).json(member);
});

router.put('/:id', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM team_members WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Membro não encontrado.' });

  const data = parse(req.body, memberSchema);

  db.prepare(
    `UPDATE team_members SET name = ?, role_title = ?, email = ?, photo_url = ?, active = ?,
            updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(data.name, data.role_title, data.email, data.photo_url, data.active, req.user.id, current.id);

  if (current.photo_url && current.photo_url !== data.photo_url) removeStoredFile(current.photo_url);

  // Membro ligado a um usuário de login mantém o nome sincronizado.
  if (current.profile_id) {
    db.prepare("UPDATE profiles SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .run(data.name, current.profile_id);
  }

  const member = db.prepare(`${SELECT_MEMBER} WHERE m.id = ?`).get(current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: member.id,
    action: 'update',
    description: req.user.name + ' atualizou ' + member.name,
  });

  res.json(member);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM team_members WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Membro não encontrado.' });

  if (current.profile_id) {
    return res.status(409).json({
      error: 'Este membro tem acesso ao sistema.',
      hint: 'Desative o usuário em Configurações para remover o acesso.',
    });
  }

  const scheduled = db
    .prepare('SELECT COUNT(*) AS total FROM capture_assignees WHERE team_member_id = ?')
    .get(current.id).total;

  if (scheduled > 0 && req.query.force !== '1') {
    return res.status(409).json({
      error: current.name + ' está escalado(a) em ' + scheduled + ' captação(ões).',
      hint: 'Desative o membro para tirá-lo das próximas escalas sem apagar o histórico.',
    });
  }

  db.prepare('DELETE FROM team_members WHERE id = ?').run(current.id);
  if (current.photo_url) removeStoredFile(current.photo_url);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'team',
    entityId: current.id,
    action: 'delete',
    description: req.user.name + ' removeu ' + current.name + ' da equipe',
  });

  res.json({ ok: true });
});

module.exports = router;
