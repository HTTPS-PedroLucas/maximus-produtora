const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload, BUCKETS, MAX_FILE_MB } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

/**
 * Envia uma imagem para o bucket local (logos | avatars | videos)
 * e devolve a URL pública já pronta para salvar no banco.
 */
router.post('/:bucket', upload.single('file'), (req, res) => {
  if (!BUCKETS.includes(req.params.bucket)) {
    return res.status(400).json({ error: 'Destino de upload inválido.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  res.status(201).json({
    url: `/uploads/${req.params.bucket}/${req.file.filename}`,
    file_name: req.file.originalname,
    mime_type: req.file.mimetype,
    size_bytes: req.file.size,
  });
});

router.get('/limits', (req, res) => {
  res.json({ max_file_mb: MAX_FILE_MB, buckets: BUCKETS });
});

module.exports = router;
