const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'dev-secret-maximus-troque-em-producao';
const TOKEN_TTL = process.env.TOKEN_TTL || '12h';

function signToken(profile) {
  return jwt.sign(
    { sub: profile.id, workspace_id: profile.workspace_id, role: profile.role },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  // EventSource (SSE) não permite cabeçalhos personalizados.
  if (req.query && typeof req.query.token === 'string') return req.query.token;
  return null;
}

/** Exige um usuário autenticado e ativo; anexa req.user. */
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  }

  const profile = db
    .prepare('SELECT id, workspace_id, name, email, role, avatar_url, active FROM profiles WHERE id = ?')
    .get(payload.sub);

  if (!profile) return res.status(401).json({ error: 'Usuário não encontrado.' });
  if (!profile.active) return res.status(403).json({ error: 'Seu acesso está inativo. Fale com um administrador.' });

  req.user = profile;
  req.workspaceId = profile.workspace_id;
  next();
}

/** Restringe a rota a administradores. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Somente administradores podem fazer esta alteração.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, signToken, SECRET, TOKEN_TTL };
