require('dotenv').config();
const db = require('../db');
const { runMigrations } = require('../db/migrate');
const { generateScriptDoc } = require('../lib/scriptDoc');
const { removeStoredFile } = require('../middleware/upload');

/**
 * Gera os documentos dos roteiros que já existiam antes desta funcionalidade.
 * Roda sozinho na inicialização do servidor e também pode ser chamado à mão:
 *   npm run backfill:scripts
 *
 * É seguro repetir: só mexe em vídeos que têm roteiro e ainda não têm documento.
 */
async function backfillScriptDocs({ silent = false, all = false } = {}) {
  // Com `all`, todos os roteiros são regerados — útil quando o formato do
  // documento muda e os arquivos antigos ficam desatualizados.
  const filtroDocumento = all ? '' : 'AND v.script_doc_url IS NULL';

  const pendentes = db
    .prepare(
      `SELECT v.id, v.title, v.script, v.notes, v.capture_id, v.script_doc_url,
              c.name AS client_name, s.date AS capture_date, s.start_time AS capture_start_time
         FROM video_ideas v
         JOIN capture_schedules s ON s.id = v.capture_id
         JOIN clients c ON c.id = s.client_id
        WHERE v.script IS NOT NULL
          AND TRIM(v.script) <> ''
          ${filtroDocumento}`
    )
    .all();

  if (pendentes.length === 0) return 0;

  const update = db.prepare(
    `UPDATE video_ideas
        SET script_doc_url = ?, script_doc_name = ?, script_doc_size_bytes = ?,
            script_doc_updated_at = datetime('now')
      WHERE id = ?`
  );

  let gerados = 0;
  for (const video of pendentes) {
    try {
      const order = db
        .prepare('SELECT id FROM video_ideas WHERE capture_id = ? ORDER BY position, id')
        .all(video.capture_id)
        .map((row) => row.id);

      const documento = await generateScriptDoc({
        number: order.indexOf(video.id) + 1,
        title: video.title,
        script: video.script,
        notes: video.notes,
        clientName: video.client_name,
        date: video.capture_date,
        startTime: video.capture_start_time,
      });

      if (documento) {
        update.run(documento.url, documento.name, documento.size, video.id);
        // Ao regerar, o arquivo anterior não serve mais.
        if (video.script_doc_url && video.script_doc_url !== documento.url) {
          removeStoredFile(video.script_doc_url);
        }
        gerados += 1;
        if (!silent) console.log(`[backfill] ${documento.name}`);
      }
    } catch (err) {
      // Um roteiro problemático não pode impedir os outros.
      console.error(`[backfill] falhou no vídeo ${video.id}: ${err.message}`);
    }
  }

  if (!silent) console.log(`[backfill] ${gerados} documento(s) de roteiro gerado(s).`);
  return gerados;
}

if (require.main === module) {
  runMigrations({ silent: true });
  backfillScriptDocs({ all: process.argv.includes('--all') }).then((total) => {
    if (total === 0) console.log('[backfill] nenhum roteiro pendente — tudo em dia.');
  });
}

module.exports = { backfillScriptDocs };
