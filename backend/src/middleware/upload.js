const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const MAX_FILE_MB = Number(process.env.MAX_UPLOAD_MB || 8);

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

// "Bucket" de armazenamento local, separado por finalidade.
const BUCKETS = ['logos', 'avatars', 'videos'];
for (const bucket of BUCKETS) {
  const dir = path.join(UPLOADS_DIR, bucket);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const bucket = BUCKETS.includes(req.params.bucket) ? req.params.bucket : 'videos';
    cb(null, path.join(UPLOADS_DIR, bucket));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '.png';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error('Formato não suportado. Envie PNG, JPG, WEBP, GIF ou SVG.'));
    }
    cb(null, true);
  },
});

/** Remove do disco um arquivo salvo por este módulo (ignora caminhos externos). */
function removeStoredFile(fileUrl) {
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith('/uploads/')) return;
  const relative = fileUrl.replace('/uploads/', '');
  const target = path.normalize(path.join(UPLOADS_DIR, relative));
  if (!target.startsWith(path.normalize(UPLOADS_DIR))) return;
  fs.promises.unlink(target).catch(() => {});
}

module.exports = { upload, UPLOADS_DIR, MAX_FILE_MB, BUCKETS, removeStoredFile };
