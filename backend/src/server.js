require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { runMigrations } = require('./db/migrate');
const { ensureBaseData } = require('./scripts/bootstrap');
const { ValidationError } = require('./lib/validate');
const events = require('./lib/events');
const { UPLOADS_DIR } = require('./middleware/upload');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const clientsRoutes = require('./routes/clients');
const teamRoutes = require('./routes/team');
const capturesRoutes = require('./routes/captures');
const videosRoutes = require('./routes/videos');
const uploadsRoutes = require('./routes/uploads');
const workspaceRoutes = require('./routes/workspace');
const eventsRoutes = require('./routes/events');

// O banco é migrado e preparado antes de qualquer requisição.
runMigrations({ silent: process.env.NODE_ENV === 'test' });
ensureBaseData();

const app = express();
const PORT = process.env.PORT || 4100;

const corsOrigin = process.env.CORS_ORIGIN; // ex: https://agenda.maximusprodutora.com.br
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((item) => item.trim()) } : {}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, realtime_clients: events.connectionCount() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/captures', capturesRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/events', eventsRoutes);

// Em produção o build do frontend pode ser servido pelo próprio backend.
if (process.env.SERVE_FRONTEND === '1') {
  const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, errors: err.errors });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande.' });
  }
  if (err?.message?.startsWith('Formato não suportado')) {
    return res.status(415).json({ error: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor.' });
});

// Mantém as conexões de tempo real vivas atrás de proxies.
const heartbeat = setInterval(() => events.heartbeat(), 25000);
heartbeat.unref?.();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Máximus Produtora — API em http://localhost:${PORT}`);
  });
}

module.exports = app;
