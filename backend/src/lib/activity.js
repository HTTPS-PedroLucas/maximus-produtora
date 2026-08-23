const db = require('../db');
const events = require('./events');

/**
 * Registra quem fez o quê e avisa a equipe em tempo real.
 */
function log({ workspaceId, actorId, entityType, entityId, action, description }) {
  db.prepare(
    `INSERT INTO activity_logs (workspace_id, actor_id, entity_type, entity_id, action, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(workspaceId, actorId ?? null, entityType, entityId ?? null, action, description ?? null);

  events.publish(workspaceId, entityType, { entityId, action });
}

function list(workspaceId, limit = 40) {
  return db
    .prepare(
      `SELECT a.*, p.name AS actor_name
         FROM activity_logs a
         LEFT JOIN profiles p ON p.id = a.actor_id
        WHERE a.workspace_id = ?
        ORDER BY a.id DESC
        LIMIT ?`
    )
    .all(workspaceId, limit);
}

module.exports = { log, list };
