require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { UPLOADS_DIR } = require('../middleware/upload');

/**
 * Cópia de segurança do que não pode ser perdido: o banco e as imagens.
 * Uso: npm run backup [-- destino]
 * Sem destino, grava em backend/backups/AAAA-MM-DD_HHMM/.
 */
function backup(target) {
  // Fecha o WAL para o arquivo .sqlite sair completo e consistente.
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', '_')
    .replace(':', '');

  const baseDir = target || path.join(__dirname, '..', '..', 'backups');
  const dir = path.join(baseDir, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const dbFile = db.dbFile || require('../db').dbFile;
  fs.copyFileSync(dbFile, path.join(dir, path.basename(dbFile)));

  if (fs.existsSync(UPLOADS_DIR)) {
    fs.cpSync(UPLOADS_DIR, path.join(dir, 'uploads'), { recursive: true });
  }

  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM clients) AS clientes,
              (SELECT COUNT(*) FROM team_members) AS equipe,
              (SELECT COUNT(*) FROM capture_schedules) AS captacoes,
              (SELECT COUNT(*) FROM video_ideas) AS videos`
    )
    .get();

  console.log(`[backup] salvo em ${dir}`);
  console.log(
    `[backup] ${counts.clientes} cliente(s), ${counts.equipe} membro(s), ` +
      `${counts.captacoes} captação(ões), ${counts.videos} vídeo(s).`
  );

  return dir;
}

if (require.main === module) {
  const destino = process.argv[2];
  backup(destino);
}

module.exports = { backup };
