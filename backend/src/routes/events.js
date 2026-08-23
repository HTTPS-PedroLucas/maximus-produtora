const express = require('express');
const { requireAuth } = require('../middleware/auth');
const events = require('../lib/events');

const router = express.Router();

/**
 * Canal de tempo real (Server-Sent Events). Cada aba da equipe abre uma
 * conexão e recebe um aviso sempre que alguém altera algo no workspace.
 * O token vai na query porque o EventSource não envia cabeçalhos.
 */
router.get('/', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ user_id: req.user.id })}\n\n`);

  const unsubscribe = events.subscribe(res, req.workspaceId);
  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

module.exports = router;
