const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');
const { removeStoredFile } = require('../middleware/upload');

const router = express.Router();

const SELECT_CLIENT = `
  SELECT c.*,
         creator.name AS created_by_name,
         editor.name  AS updated_by_name
    FROM clients c
    LEFT JOIN profiles creator ON creator.id = c.created_by
    LEFT JOIN profiles editor  ON editor.id  = c.updated_by
`;

const clientSchema = {
  name: { required: true, min: 2, max: 120 },
  short_name: { required: true, min: 1, max: 40 },
  logo_url: { max: 500 },
  color: { required: true, type: 'color' },
  city: { required: true, min: 2, max: 80 },
  region: { max: 80 },
  address: { max: 200 },
  capture_type: { required: true, enum: ['recorrente', 'flexivel'] },
  notes: { max: 2000 },
  active: { type: 'boolean', default: 1 },
};

router.use(requireAuth);

router.get('/', (req, res) => {
  const onlyActive = req.query.active === '1';
  const rows = db
    .prepare(
      `${SELECT_CLIENT} WHERE c.workspace_id = ? ${onlyActive ? 'AND c.active = 1' : ''}
       ORDER BY c.active DESC, c.name COLLATE NOCASE`
    )
    .all(req.workspaceId);
  res.json(rows);
});

/** Municípios já cadastrados — alimenta filtros e sugestões de deslocamento. */
router.get('/cities', (req, res) => {
  const rows = db
    .prepare(
      `SELECT city, COUNT(*) AS total
         FROM clients WHERE workspace_id = ? AND active = 1
        GROUP BY city ORDER BY city COLLATE NOCASE`
    )
    .all(req.workspaceId);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const client = db.prepare(`${SELECT_CLIENT} WHERE c.id = ? AND c.workspace_id = ?`)
    .get(req.params.id, req.workspaceId);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(client);
});

router.post('/', requireAdmin, (req, res) => {
  const data = parse(req.body, clientSchema);

  const info = db
    .prepare(
      `INSERT INTO clients
         (workspace_id, name, short_name, logo_url, color, city, region, address, capture_type, notes, active, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.workspaceId, data.name, data.short_name, data.logo_url, data.color,
      data.city, data.region, data.address, data.capture_type, data.notes,
      data.active, req.user.id, req.user.id
    );

  const client = db.prepare(`${SELECT_CLIENT} WHERE c.id = ?`).get(Number(info.lastInsertRowid));

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'clients',
    entityId: client.id,
    action: 'create',
    description: req.user.name + ' cadastrou o cliente ' + client.name,
  });

  res.status(201).json(client);
});

router.put('/:id', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM clients WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const data = parse(req.body, clientSchema);

  db.prepare(
    `UPDATE clients SET name = ?, short_name = ?, logo_url = ?, color = ?, city = ?, region = ?,
            address = ?, capture_type = ?, notes = ?, active = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    data.name, data.short_name, data.logo_url, data.color, data.city, data.region,
    data.address, data.capture_type, data.notes, data.active, req.user.id, current.id
  );

  if (current.logo_url && current.logo_url !== data.logo_url) removeStoredFile(current.logo_url);

  const client = db.prepare(`${SELECT_CLIENT} WHERE c.id = ?`).get(current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'clients',
    entityId: client.id,
    action: 'update',
    description: req.user.name + ' atualizou o cliente ' + client.name,
  });

  res.json(client);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const current = db
    .prepare('SELECT * FROM clients WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const captures = db
    .prepare('SELECT COUNT(*) AS total FROM capture_schedules WHERE client_id = ?')
    .get(current.id).total;

  // Cliente com histórico é desativado (preserva as captações já registradas).
  if (captures > 0 && req.query.force !== '1') {
    return res.status(409).json({
      error: 'Este cliente tem ' + captures + ' captação(ões) registrada(s).',
      captures,
      hint: 'Desative o cliente para tirá-lo da agenda sem apagar o histórico.',
    });
  }

  db.prepare('DELETE FROM clients WHERE id = ?').run(current.id);
  if (current.logo_url) removeStoredFile(current.logo_url);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'clients',
    entityId: current.id,
    action: 'delete',
    description: req.user.name + ' excluiu o cliente ' + current.name,
  });

  res.json({ ok: true });
});

module.exports = router;
