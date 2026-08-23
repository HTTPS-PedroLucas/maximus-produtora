const db = require('../db');

// Quantos clientes de outros municípios da mesma região podem aparecer nas sugestões.
const REGION_SUGGESTION_LIMIT = 4;

const SELECT_CAPTURE = `
  SELECT s.*,
         c.name        AS client_name,
         c.short_name  AS client_short_name,
         c.color       AS client_color,
         c.logo_url    AS client_logo_url,
         c.city        AS client_city,
         c.region      AS client_region,
         c.capture_type AS client_capture_type,
         creator.name  AS created_by_name,
         editor.name   AS updated_by_name,
         (SELECT COUNT(*) FROM video_ideas v WHERE v.capture_id = s.id)                 AS videos_total,
         (SELECT COUNT(*) FROM video_ideas v WHERE v.capture_id = s.id AND v.done = 1)  AS videos_done
    FROM capture_schedules s
    JOIN clients c        ON c.id = s.client_id
    LEFT JOIN profiles creator ON creator.id = s.created_by
    LEFT JOIN profiles editor  ON editor.id  = s.updated_by
`;

/** Anexa os responsáveis (capture_assignees) a uma lista de captações. */
function attachAssignees(captures) {
  if (captures.length === 0) return captures;
  const ids = captures.map((capture) => capture.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT a.capture_id, m.id, m.name, m.role_title, m.photo_url, m.active
         FROM capture_assignees a
         JOIN team_members m ON m.id = a.team_member_id
        WHERE a.capture_id IN (${placeholders})
        ORDER BY m.name COLLATE NOCASE`
    )
    .all(...ids);

  const byCapture = new Map(ids.map((id) => [id, []]));
  for (const row of rows) {
    byCapture.get(row.capture_id)?.push({
      id: row.id,
      name: row.name,
      role_title: row.role_title,
      photo_url: row.photo_url,
      active: row.active,
    });
  }

  return captures.map((capture) => ({ ...capture, assignees: byCapture.get(capture.id) || [] }));
}

/**
 * Lista captações de um intervalo de datas, aplicando os filtros da agenda.
 * @param {object} filters { clientId, memberId, city, status: 'todos'|'pendente'|'concluido' }
 */
function listCaptures(workspaceId, { from, to, clientId, memberId, city, status } = {}) {
  const where = ['s.workspace_id = ?'];
  const params = [workspaceId];

  if (from) { where.push('s.date >= ?'); params.push(from); }
  if (to) { where.push('s.date <= ?'); params.push(to); }
  if (clientId) { where.push('s.client_id = ?'); params.push(Number(clientId)); }
  if (city) { where.push('s.city = ?'); params.push(city); }
  if (status === 'concluido') where.push('s.done = 1');
  if (status === 'pendente') where.push('s.done = 0');
  if (memberId) {
    where.push('EXISTS (SELECT 1 FROM capture_assignees a WHERE a.capture_id = s.id AND a.team_member_id = ?)');
    params.push(Number(memberId));
  }

  const rows = db
    .prepare(`${SELECT_CAPTURE} WHERE ${where.join(' AND ')} ORDER BY s.date, s.start_time, c.name COLLATE NOCASE`)
    .all(...params);

  return attachAssignees(rows);
}

function getCapture(workspaceId, id) {
  const capture = db.prepare(`${SELECT_CAPTURE} WHERE s.id = ? AND s.workspace_id = ?`).get(id, workspaceId);
  if (!capture) return null;
  return attachAssignees([capture])[0];
}

/** Resumo de um dia: municípios, rota, contagem de vídeos e captações. */
function daySummary(captures) {
  const cities = [];
  for (const capture of captures) {
    if (!cities.includes(capture.city)) cities.push(capture.city);
  }

  const videosTotal = captures.reduce((sum, capture) => sum + capture.videos_total, 0);
  const videosDone = captures.reduce((sum, capture) => sum + capture.videos_done, 0);
  const estimated = captures.reduce((sum, capture) => sum + (capture.estimated_videos || 0), 0);

  return {
    captures_total: captures.length,
    captures_done: captures.filter((capture) => capture.done).length,
    captures_pending: captures.filter((capture) => !capture.done).length,
    cities,
    route: cities.join(' → '),
    multi_city: cities.length > 1,
    videos_total: videosTotal,
    videos_done: videosDone,
    videos_estimated: estimated,
    progress: videosTotal > 0 ? Math.round((videosDone / videosTotal) * 100) : 0,
  };
}

/** Monitoramento semanal exibido no topo da agenda. */
function weekSummary(captures) {
  const base = daySummary(captures);
  const clients = new Set(captures.map((capture) => capture.client_id));
  const capturesRatio = captures.length > 0 ? base.captures_done / captures.length : 0;
  const videosRatio = base.videos_total > 0 ? base.videos_done / base.videos_total : null;

  // Percentual geral: média entre captações concluídas e vídeos concluídos
  // (quando ainda não há vídeos planejados, usa só as captações).
  const overall = videosRatio === null ? capturesRatio : (capturesRatio + videosRatio) / 2;

  return {
    ...base,
    clients_total: clients.size,
    overall_progress: Math.round(overall * 100),
  };
}

/**
 * Sugestões de deslocamento: clientes ativos do mesmo município (ou região)
 * que ainda não estão agendados naquela data.
 */
function travelSuggestions(workspaceId, { date, cities, excludeClientIds = [] }) {
  if (!date || !cities || cities.length === 0) return [];

  const scheduled = db
    .prepare('SELECT client_id FROM capture_schedules WHERE workspace_id = ? AND date = ?')
    .all(workspaceId, date)
    .map((row) => row.client_id);

  const skip = new Set([...scheduled, ...excludeClientIds.map(Number)]);
  const cityPlaceholders = cities.map(() => '?').join(',');

  const regions = db
    .prepare(`SELECT DISTINCT region FROM clients WHERE workspace_id = ? AND city IN (${cityPlaceholders}) AND region IS NOT NULL`)
    .all(workspaceId, ...cities)
    .map((row) => row.region)
    .filter(Boolean);

  const params = [workspaceId, ...cities];
  let regionClause = '';
  if (regions.length > 0) {
    regionClause = ` OR region IN (${regions.map(() => '?').join(',')})`;
    params.push(...regions);
  }

  const candidates = db
    .prepare(
      `SELECT id, name, short_name, color, logo_url, city, region, capture_type
         FROM clients
        WHERE workspace_id = ? AND active = 1 AND (city IN (${cityPlaceholders})${regionClause})
        ORDER BY name COLLATE NOCASE`
    )
    .all(...params);

  const available = candidates
    .filter((client) => !skip.has(client.id))
    .map((client) => ({
      ...client,
      same_city: cities.includes(client.city),
      reason: cities.includes(client.city)
        ? 'Mesmo município da captação já agendada'
        : 'Mesma região de deslocamento',
    }));

  // O município é o que importa para aproveitar a viagem; a região entra
  // como complemento, limitada para não virar uma lista de todos os clientes.
  const sameCity = available.filter((client) => client.same_city);
  const sameRegion = available.filter((client) => !client.same_city).slice(0, REGION_SUGGESTION_LIMIT);
  return [...sameCity, ...sameRegion];
}

module.exports = {
  SELECT_CAPTURE,
  attachAssignees,
  listCaptures,
  getCapture,
  daySummary,
  weekSummary,
  travelSuggestions,
};
