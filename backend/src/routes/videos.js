const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parse, domainOf } = require('../lib/validate');
const activity = require('../lib/activity');
const { upload, removeStoredFile } = require('../middleware/upload');
const { generateScriptDoc } = require('../lib/scriptDoc');

const router = express.Router();

router.use(requireAuth);

/** Carrega um vídeo garantindo que ele pertence ao workspace do usuário. */
function loadVideo(workspaceId, videoId) {
  return db
    .prepare(
      `SELECT v.*, s.workspace_id, s.id AS capture_id, c.name AS client_name,
              s.date AS capture_date, s.start_time AS capture_start_time
         FROM video_ideas v
         JOIN capture_schedules s ON s.id = v.capture_id
         JOIN clients c ON c.id = s.client_id
        WHERE v.id = ? AND s.workspace_id = ?`
    )
    .get(videoId, workspaceId);
}

function loadCapture(workspaceId, captureId) {
  return db
    .prepare(
      `SELECT s.*, c.name AS client_name
         FROM capture_schedules s
         JOIN clients c ON c.id = s.client_id
        WHERE s.id = ? AND s.workspace_id = ?`
    )
    .get(captureId, workspaceId);
}

/** Serializa um vídeo com sua numeração, links e imagens. */
function serialize(videoId) {
  const video = db
    .prepare(
      `SELECT v.*, creator.name AS created_by_name, editor.name AS updated_by_name
         FROM video_ideas v
         LEFT JOIN profiles creator ON creator.id = v.created_by
         LEFT JOIN profiles editor  ON editor.id  = v.updated_by
        WHERE v.id = ?`
    )
    .get(videoId);
  if (!video) return null;

  const order = db
    .prepare('SELECT id FROM video_ideas WHERE capture_id = ? ORDER BY position, id')
    .all(video.capture_id)
    .map((row) => row.id);

  return {
    ...video,
    number: order.indexOf(video.id) + 1,
    references: db.prepare('SELECT * FROM video_references WHERE video_id = ? ORDER BY id').all(videoId),
    attachments: db.prepare('SELECT * FROM video_attachments WHERE video_id = ? ORDER BY id').all(videoId),
  };
}

function touchCapture(captureId, userId) {
  db.prepare("UPDATE capture_schedules SET updated_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(userId, captureId);
}

/**
 * Mantém o documento .docx em sincronia com o roteiro digitado.
 * Roteiro preenchido gera (ou regera) o arquivo; roteiro apagado remove o
 * documento. O arquivo antigo é sempre descartado para não acumular lixo.
 */
async function syncScriptDoc(workspaceId, videoId) {
  const video = loadVideo(workspaceId, videoId);
  if (!video) return;

  const previousUrl = video.script_doc_url;
  const hasScript = Boolean(video.script && video.script.trim());

  if (!hasScript) {
    if (previousUrl) {
      db.prepare(
        `UPDATE video_ideas
            SET script_doc_url = NULL, script_doc_name = NULL,
                script_doc_size_bytes = NULL, script_doc_updated_at = NULL
          WHERE id = ?`
      ).run(videoId);
      removeStoredFile(previousUrl);
    }
    return;
  }

  const order = db
    .prepare('SELECT id FROM video_ideas WHERE capture_id = ? ORDER BY position, id')
    .all(video.capture_id)
    .map((row) => row.id);

  const generated = await generateScriptDoc({
    number: order.indexOf(video.id) + 1,
    title: video.title,
    script: video.script,
    notes: video.notes,
    clientName: video.client_name,
    date: video.capture_date,
    startTime: video.capture_start_time,
  });

  if (!generated) return;

  db.prepare(
    `UPDATE video_ideas
        SET script_doc_url = ?, script_doc_name = ?, script_doc_size_bytes = ?,
            script_doc_updated_at = datetime('now')
      WHERE id = ?`
  ).run(generated.url, generated.name, generated.size, videoId);

  if (previousUrl && previousUrl !== generated.url) removeStoredFile(previousUrl);
}

// --- Vídeos ---------------------------------------------------------------

router.post('/', async (req, res) => {
  const captureId = Number(req.body?.capture_id);
  const capture = loadCapture(req.workspaceId, captureId);
  if (!capture) return res.status(404).json({ error: 'Captação não encontrada.' });

  const data = parse(req.body, {
    title: { max: 160 },
    script: { max: 20000 },
    notes: { max: 4000 },
  });

  const nextPosition =
    (db.prepare('SELECT MAX(position) AS max FROM video_ideas WHERE capture_id = ?').get(captureId).max ?? -1) + 1;

  const info = db
    .prepare(
      `INSERT INTO video_ideas (capture_id, position, title, script, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(captureId, nextPosition, data.title, data.script, data.notes, req.user.id, req.user.id);

  const videoId = Number(info.lastInsertRowid);
  await syncScriptDoc(req.workspaceId, videoId);

  const video = serialize(videoId);
  touchCapture(captureId, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: video.id,
    action: 'create',
    description: `${req.user.name} criou o Vídeo ${String(video.number).padStart(2, '0')} de ${capture.client_name}`,
  });

  res.status(201).json(video);
});

router.put('/:id', async (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const data = parse(req.body, {
    title: { max: 160 },
    script: { max: 20000 },
    notes: { max: 4000 },
  });

  db.prepare(
    `UPDATE video_ideas SET title = ?, script = ?, notes = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(data.title, data.script, data.notes, req.user.id, current.id);

  // O documento do roteiro acompanha o texto: é regerado a cada alteração.
  await syncScriptDoc(req.workspaceId, current.id);

  touchCapture(current.capture_id, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: current.id,
    action: 'update',
    description: `${req.user.name} editou um vídeo de ${current.client_name}`,
  });

  res.json(serialize(current.id));
});

router.patch('/:id/done', (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const done = req.body?.done === true || req.body?.done === 1 ? 1 : 0;

  db.prepare(
    `UPDATE video_ideas
        SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
            updated_by = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(done, done, req.user.id, current.id);

  touchCapture(current.capture_id, req.user.id);

  const video = serialize(current.id);
  const totals = db
    .prepare('SELECT COUNT(*) AS total, SUM(done) AS done FROM video_ideas WHERE capture_id = ?')
    .get(current.capture_id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: current.id,
    action: done ? 'done' : 'reopen',
    description: `${req.user.name} ${done ? 'concluiu' : 'reabriu'} o Vídeo ${String(video.number).padStart(2, '0')} de ${current.client_name}`,
  });

  res.json({
    video,
    progress: { total: totals.total, done: totals.done || 0 },
    // O sistema apenas sugere concluir a captação — a decisão continua da equipe.
    suggest_capture_done: totals.total > 0 && Number(totals.done) === totals.total,
  });
});

router.post('/:id/duplicate', async (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const nextPosition =
    (db.prepare('SELECT MAX(position) AS max FROM video_ideas WHERE capture_id = ?').get(current.capture_id).max ?? -1) + 1;

  const info = db
    .prepare(
      `INSERT INTO video_ideas (capture_id, position, title, script, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      current.capture_id,
      nextPosition,
      current.title ? `${current.title} (cópia)` : null,
      current.script,
      current.notes,
      req.user.id,
      req.user.id
    );

  const newId = Number(info.lastInsertRowid);

  const refs = db.prepare('SELECT * FROM video_references WHERE video_id = ?').all(current.id);
  const insertRef = db.prepare(
    'INSERT INTO video_references (video_id, url, label, domain, created_by) VALUES (?, ?, ?, ?, ?)'
  );
  for (const ref of refs) insertRef.run(newId, ref.url, ref.label, ref.domain, req.user.id);

  // As imagens são referenciadas pelo mesmo arquivo já enviado (sem duplicar no disco).
  const files = db.prepare('SELECT * FROM video_attachments WHERE video_id = ?').all(current.id);
  const insertFile = db.prepare(
    'INSERT INTO video_attachments (video_id, file_url, file_name, mime_type, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const file of files) {
    insertFile.run(newId, file.file_url, file.file_name, file.mime_type, file.size_bytes, req.user.id);
  }

  // A cópia ganha o próprio documento — os dois não compartilham arquivo.
  await syncScriptDoc(req.workspaceId, newId);

  touchCapture(current.capture_id, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: newId,
    action: 'create',
    description: `${req.user.name} duplicou um vídeo de ${current.client_name}`,
  });

  res.status(201).json(serialize(newId));
});

router.put('/reorder/:captureId', (req, res) => {
  const capture = loadCapture(req.workspaceId, req.params.captureId);
  if (!capture) return res.status(404).json({ error: 'Captação não encontrada.' });

  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const existing = db
    .prepare('SELECT id FROM video_ideas WHERE capture_id = ?')
    .all(capture.id)
    .map((row) => row.id);

  const ordered = ids.filter((id) => existing.includes(id));
  for (const id of existing) if (!ordered.includes(id)) ordered.push(id);

  const update = db.prepare('UPDATE video_ideas SET position = ? WHERE id = ?');
  ordered.forEach((id, index) => update.run(index, id));

  touchCapture(capture.id, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: capture.id,
    action: 'reorder',
    description: `${req.user.name} reordenou os vídeos de ${capture.client_name}`,
  });

  res.json({ ok: true, order: ordered });
});

router.delete('/:id', (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const files = db.prepare('SELECT file_url FROM video_attachments WHERE video_id = ?').all(current.id);
  db.prepare('DELETE FROM video_ideas WHERE id = ?').run(current.id);

  // Só apaga o arquivo se nenhuma outra ideia de vídeo ainda o utilizar (duplicações).
  for (const file of files) {
    const stillUsed = db
      .prepare('SELECT COUNT(*) AS total FROM video_attachments WHERE file_url = ?')
      .get(file.file_url).total;
    if (stillUsed === 0) removeStoredFile(file.file_url);
  }

  // O documento do roteiro é exclusivo deste vídeo.
  if (current.script_doc_url) removeStoredFile(current.script_doc_url);

  touchCapture(current.capture_id, req.user.id);

  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: current.id,
    action: 'delete',
    description: `${req.user.name} excluiu um vídeo de ${current.client_name}`,
  });

  res.json({ ok: true });
});

// --- Links de referência --------------------------------------------------

router.post('/:id/references', (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const data = parse(req.body, {
    url: { required: true, type: 'url' },
    label: { max: 120 },
  });

  db.prepare('INSERT INTO video_references (video_id, url, label, domain, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(current.id, data.url, data.label, domainOf(data.url), req.user.id);

  touchCapture(current.capture_id, req.user.id);
  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: current.id,
    action: 'update',
    description: `${req.user.name} adicionou uma referência em ${current.client_name}`,
  });

  res.status(201).json(serialize(current.id));
});

router.delete('/references/:referenceId', (req, res) => {
  const reference = db
    .prepare(
      `SELECT r.*, v.capture_id, s.workspace_id
         FROM video_references r
         JOIN video_ideas v ON v.id = r.video_id
         JOIN capture_schedules s ON s.id = v.capture_id
        WHERE r.id = ? AND s.workspace_id = ?`
    )
    .get(req.params.referenceId, req.workspaceId);
  if (!reference) return res.status(404).json({ error: 'Referência não encontrada.' });

  db.prepare('DELETE FROM video_references WHERE id = ?').run(reference.id);
  touchCapture(reference.capture_id, req.user.id);
  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: reference.video_id,
    action: 'update',
    description: `${req.user.name} removeu uma referência`,
  });

  res.json(serialize(reference.video_id));
});

// --- Imagens de apoio -----------------------------------------------------

router.post('/:id/attachments', upload.array('files', 10), (req, res) => {
  const current = loadVideo(req.workspaceId, req.params.id);
  if (!current) return res.status(404).json({ error: 'Vídeo não encontrado.' });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos uma imagem.' });
  }

  const insert = db.prepare(
    'INSERT INTO video_attachments (video_id, file_url, file_name, mime_type, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const file of req.files) {
    insert.run(current.id, `/uploads/videos/${file.filename}`, file.originalname, file.mimetype, file.size, req.user.id);
  }

  touchCapture(current.capture_id, req.user.id);
  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: current.id,
    action: 'update',
    description: `${req.user.name} anexou ${req.files.length} imagem(ns) em ${current.client_name}`,
  });

  res.status(201).json(serialize(current.id));
});

router.delete('/attachments/:attachmentId', (req, res) => {
  const attachment = db
    .prepare(
      `SELECT a.*, v.capture_id, s.workspace_id
         FROM video_attachments a
         JOIN video_ideas v ON v.id = a.video_id
         JOIN capture_schedules s ON s.id = v.capture_id
        WHERE a.id = ? AND s.workspace_id = ?`
    )
    .get(req.params.attachmentId, req.workspaceId);
  if (!attachment) return res.status(404).json({ error: 'Imagem não encontrada.' });

  db.prepare('DELETE FROM video_attachments WHERE id = ?').run(attachment.id);

  const stillUsed = db
    .prepare('SELECT COUNT(*) AS total FROM video_attachments WHERE file_url = ?')
    .get(attachment.file_url).total;
  if (stillUsed === 0) removeStoredFile(attachment.file_url);

  touchCapture(attachment.capture_id, req.user.id);
  activity.log({
    workspaceId: req.workspaceId,
    actorId: req.user.id,
    entityType: 'videos',
    entityId: attachment.video_id,
    action: 'update',
    description: `${req.user.name} removeu uma imagem de apoio`,
  });

  res.json(serialize(attachment.video_id));
});

module.exports = router;
