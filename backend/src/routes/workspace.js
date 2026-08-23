const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');
const dates = require('../lib/date');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId);
  const counts = {
    clients: db.prepare('SELECT COUNT(*) AS total FROM clients WHERE workspace_id = ?').get(req.workspaceId).total,
    team: db.prepare('SELECT COUNT(*) AS total FROM team_members WHERE workspace_id = ?').get(req.workspaceId).total,
    captures: db.prepare('SELECT COUNT(*) AS total FROM capture_schedules WHERE workspace_id = ?').get(req.workspaceId).total,
  };
  res.json({ workspace, counts, today: dates.today(), timezone: dates.TIMEZONE });
});

router.put('/', requireAdmin, (req, res) => {
  const data = parse(req.body, {
    name: { required: true, min: 2, max: 120 },
    home_city: { required: true, min: 2, max: 80 },
    home_region: { max: 80 },
  });

  db.prepare("UPDATE workspaces SET name = ?, home_city = ?, home_region = ?, updated_at = datetime('now') WHERE id = ?")
    .run(data.name, data.home_city, data.home_region, req.workspaceId);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'workspace',
    entityId: req.workspaceId,
    action: 'update',
    description: req.user.name + ' atualizou as configurações do workspace',
  });

  res.json(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.workspaceId));
});

/** Últimas alterações feitas pela equipe (quem mexeu em quê e quando). */
router.get('/activity', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  res.json(activity.list(req.workspaceId, limit));
});

module.exports = router;
