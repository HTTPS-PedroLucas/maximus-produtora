const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parse } = require('../lib/validate');
const activity = require('../lib/activity');
const dates = require('../lib/date');
const { findAssigneeConflicts } = require('../lib/conflicts');
const captures = require('../lib/captures');

const router = express.Router();

router.use(requireAuth);

const captureSchema = {
  client_id: { required: true, type: 'number' },
  date: { required: true, type: 'date' },
  start_time: { required: true, type: 'time' },
  end_time: { type: 'time' },
  city: { max: 80 },
  location: { max: 200 },
  objective: { max: 500 },
  notes: { max: 2000 },
  estimated_videos: { type: 'number', min: 0, max: 99 },
  assignee_ids: { type: 'array', default: [] },
};

function readFilters(query) {
  return {
    clientId: query.client_id || null,
    memberId: query.member_id || null,
    city: query.city || null,
    status: query.status || null,
  };
}

/** Confere se o horário final é posterior ao inicial. */
function validateTimeRange(data) {
  if (!data.end_time) return null;
  if (dates.toMinutes(data.end_time) <= dates.toMinutes(data.start_time)) {
    return { end_time: 'O horário final deve ser depois do inicial.' };
  }
  return null;
}

function loadClient(workspaceId, clientId) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND workspace_id = ?').get(clientId, workspaceId);
}

/** Conflitos de escala do profissional no mesmo dia (aviso, nunca bloqueio). */
function conflictsFor(workspaceId, data, excludeId = null) {
  const sameDay = captures.listCaptures(workspaceId, { from: data.date, to: data.date });
  return findAssigneeConflicts(
    {
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      assigneeIds: data.assignee_ids,
    },
    sameDay,
    excludeId
  );
}

function saveAssignees(workspaceId, captureId, assigneeIds) {
  db.prepare('DELETE FROM capture_assignees WHERE capture_id = ?').run(captureId);
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) return;

  const insert = db.prepare('INSERT OR IGNORE INTO capture_assignees (capture_id, team_member_id) VALUES (?, ?)');
  const valid = db
    .prepare('SELECT id FROM team_members WHERE workspace_id = ?')
    .all(workspaceId)
    .map((row) => row.id);

  for (const id of assigneeIds) {
    if (valid.includes(Number(id))) insert.run(captureId, Number(id));
  }
}

// --- Agenda semanal -------------------------------------------------------

router.get('/week', (req, res) => {
  const reference = dates.isValidDate(req.query.date) ? req.query.date : dates.today();
  const days = dates.weekDays(reference);
  const filters = readFilters(req.query);

  const list = captures.listCaptures(req.workspaceId, { from: days[0], to: days[4], ...filters });
  const weekendList = captures.listCaptures(req.workspaceId, {
    from: dates.addDays(days[4], 1),
    to: dates.addDays(days[4], 2),
    ...filters,
  });

  res.json({
    reference,
    start: days[0],
    end: days[4],
    today: dates.today(),
    days: days.map((date) => {
      const dayCaptures = list.filter((capture) => capture.date === date);
      return { date, captures: dayCaptures, summary: captures.daySummary(dayCaptures) };
    }),
    // Sábado e domingo aparecem apenas se houver algo agendado (a lousa é de segunda a sexta).
    weekend: [dates.addDays(days[4], 1), dates.addDays(days[4], 2)]
      .map((date) => ({ date, captures: weekendList.filter((capture) => capture.date === date) }))
      .filter((day) => day.captures.length > 0),
    summary: captures.weekSummary(list),
  });
});

// --- Tela do dia ----------------------------------------------------------

router.get('/day/:date', (req, res) => {
  const { date } = req.params;
  if (!dates.isValidDate(date)) return res.status(400).json({ error: 'Data inválida.' });

  const list = captures.listCaptures(req.workspaceId, { from: date, to: date, ...readFilters(req.query) });
  const summary = captures.daySummary(list);

  res.json({
    date,
    today: dates.today(),
    captures: list,
    summary,
    suggestions: captures.travelSuggestions(req.workspaceId, { date, cities: summary.cities }),
  });
});

// --- Sugestões de deslocamento -------------------------------------------

router.get('/suggestions', (req, res) => {
  const { date } = req.query;
  if (!dates.isValidDate(date)) return res.status(400).json({ error: 'Data inválida.' });

  const cities = String(req.query.city || '')
    .split(',')
    .map((city) => city.trim())
    .filter(Boolean);

  if (cities.length === 0) {
    const dayCaptures = captures.listCaptures(req.workspaceId, { from: date, to: date });
    cities.push(...captures.daySummary(dayCaptures).cities);
  }

  res.json({
    date,
    cities,
    suggestions: captures.travelSuggestions(req.workspaceId, { date, cities }),
  });
});

// --- Checagem de conflito antes de salvar --------------------------------

router.post('/check-conflicts', (req, res) => {
  const { date, start_time, end_time, assignee_ids, exclude_id } = req.body || {};
  if (!dates.isValidDate(date) || !dates.isValidTime(start_time)) return res.json({ conflicts: [] });

  const conflicts = conflictsFor(
    req.workspaceId,
    {
      date,
      start_time,
      end_time: dates.isValidTime(end_time) ? end_time : null,
      assignee_ids: assignee_ids || [],
    },
    exclude_id || null
  );
  res.json({ conflicts });
});

// --- CRUD -----------------------------------------------------------------

router.get('/:id', (req, res) => {
  const capture = captures.getCapture(req.workspaceId, req.params.id);
  if (!capture) return res.status(404).json({ error: 'Captação não encontrada.' });

  const videos = db
    .prepare(
      `SELECT v.*, creator.name AS created_by_name, editor.name AS updated_by_name
         FROM video_ideas v
         LEFT JOIN profiles creator ON creator.id = v.created_by
         LEFT JOIN profiles editor  ON editor.id  = v.updated_by
        WHERE v.capture_id = ?
        ORDER BY v.position, v.id`
    )
    .all(capture.id);

  const videoIds = videos.map((video) => video.id);
  const placeholders = videoIds.map(() => '?').join(',');
  const references = videoIds.length
    ? db.prepare(`SELECT * FROM video_references WHERE video_id IN (${placeholders}) ORDER BY id`).all(...videoIds)
    : [];
  const attachments = videoIds.length
    ? db.prepare(`SELECT * FROM video_attachments WHERE video_id IN (${placeholders}) ORDER BY id`).all(...videoIds)
    : [];

  res.json({
    capture,
    videos: videos.map((video, index) => ({
      ...video,
      number: index + 1,
      references: references.filter((item) => item.video_id === video.id),
      attachments: attachments.filter((item) => item.video_id === video.id),
    })),
  });
});

router.post('/', (req, res) => {
  const data = parse(req.body, captureSchema);
  const rangeError = validateTimeRange(data);
  if (rangeError) return res.status(400).json({ error: 'Dados inválidos.', errors: rangeError });

  const client = loadClient(req.workspaceId, data.client_id);
  if (!client) {
    return res.status(400).json({ error: 'Selecione um cliente válido.', errors: { client_id: 'Cliente não encontrado.' } });
  }

  const city = data.city || client.city;

  const info = db
    .prepare(
      `INSERT INTO capture_schedules
         (workspace_id, client_id, date, start_time, end_time, city, location, objective, notes, estimated_videos, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.workspaceId,
      client.id,
      data.date,
      data.start_time,
      data.end_time,
      city,
      data.location || client.address,
      data.objective,
      data.notes,
      data.estimated_videos,
      req.user.id,
      req.user.id
    );

  const captureId = Number(info.lastInsertRowid);
  saveAssignees(req.workspaceId, captureId, data.assignee_ids);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'captures',
    entityId: captureId,
    action: 'create',
    description: `${req.user.name} agendou ${client.name} em ${dates.formatBR(data.date)} às ${data.start_time}`,
  });

  res.status(201).json({
    capture: captures.getCapture(req.workspaceId, captureId),
    conflicts: conflictsFor(req.workspaceId, { ...data, city }, captureId),
    suggestions: captures.travelSuggestions(req.workspaceId, {
      date: data.date,
      cities: [city],
      excludeClientIds: [client.id],
    }),
  });
});

router.put('/:id', (req, res) => {
  const current = db
    .prepare('SELECT * FROM capture_schedules WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Captação não encontrada.' });

  const data = parse(req.body, captureSchema);
  const rangeError = validateTimeRange(data);
  if (rangeError) return res.status(400).json({ error: 'Dados inválidos.', errors: rangeError });

  const client = loadClient(req.workspaceId, data.client_id);
  if (!client) {
    return res.status(400).json({ error: 'Selecione um cliente válido.', errors: { client_id: 'Cliente não encontrado.' } });
  }

  const city = data.city || client.city;

  db.prepare(
    `UPDATE capture_schedules
        SET client_id = ?, date = ?, start_time = ?, end_time = ?, city = ?, location = ?,
            objective = ?, notes = ?, estimated_videos = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    client.id,
    data.date,
    data.start_time,
    data.end_time,
    city,
    data.location,
    data.objective,
    data.notes,
    data.estimated_videos,
    req.user.id,
    current.id
  );

  saveAssignees(req.workspaceId, current.id, data.assignee_ids);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'captures',
    entityId: current.id,
    action: 'update',
    description: `${req.user.name} atualizou a captação de ${client.name}`,
  });

  res.json({
    capture: captures.getCapture(req.workspaceId, current.id),
    conflicts: conflictsFor(req.workspaceId, { ...data, city }, current.id),
    suggestions: captures.travelSuggestions(req.workspaceId, {
      date: data.date,
      cities: [city],
      excludeClientIds: [client.id],
    }),
  });
});

router.patch('/:id/done', (req, res) => {
  const current = db
    .prepare('SELECT * FROM capture_schedules WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.workspaceId);
  if (!current) return res.status(404).json({ error: 'Captação não encontrada.' });

  const done = req.body?.done === true || req.body?.done === 1 ? 1 : 0;

  db.prepare(
    `UPDATE capture_schedules
        SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, done_by = ?,
            updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(done, done, done ? req.user.id : null, req.user.id, current.id);

  const capture = captures.getCapture(req.workspaceId, current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'captures',
    entityId: current.id,
    action: done ? 'done' : 'reopen',
    description: `${req.user.name} ${done ? 'concluiu' : 'reabriu'} a captação de ${capture.client_name}`,
  });

  res.json({ capture });
});

router.delete('/:id', (req, res) => {
  const current = captures.getCapture(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Captação não encontrada.' });

  // Membro remove apenas o que agendou; administrador remove qualquer captação.
  if (req.user.role !== 'admin' && current.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Somente quem agendou (ou um administrador) pode excluir esta captação.' });
  }

  db.prepare('DELETE FROM capture_schedules WHERE id = ?').run(current.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'captures',
    entityId: current.id,
    action: 'delete',
    description: `${req.user.name} excluiu a captação de ${current.client_name}`,
  });

  res.json({ ok: true });
});

module.exports = router;
