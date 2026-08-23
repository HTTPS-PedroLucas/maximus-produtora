-- Estrutura inicial do sistema de captações da Máximus Produtora.
-- Todas as entidades de negócio pertencem a um workspace.

CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  home_city TEXT NOT NULL DEFAULT 'Senador Pompeu',
  home_region TEXT NOT NULL DEFAULT 'Sertão Central',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usuários que fazem login no sistema.
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_profiles_workspace ON profiles(workspace_id);

-- Membros da equipe (quem grava). Pode ou não ter um usuário de login associado.
CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  photo_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_team_members_workspace ON team_members(workspace_id);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  color TEXT NOT NULL DEFAULT '#64748B',
  city TEXT NOT NULL,
  region TEXT,
  address TEXT,
  capture_type TEXT NOT NULL DEFAULT 'recorrente' CHECK (capture_type IN ('recorrente', 'flexivel')),
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_clients_workspace ON clients(workspace_id);
CREATE INDEX idx_clients_city ON clients(workspace_id, city);

-- Captação agendada: um cliente, em uma data, num horário.
CREATE TABLE capture_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  start_time TEXT NOT NULL,          -- HH:MM
  end_time TEXT,                     -- HH:MM (opcional)
  city TEXT NOT NULL,                -- município da captação (vem do cliente, editável)
  location TEXT,                     -- local/endereço específico
  objective TEXT,
  notes TEXT,
  estimated_videos INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  done_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_captures_date ON capture_schedules(workspace_id, date);
CREATE INDEX idx_captures_client ON capture_schedules(client_id);

-- Responsáveis pela gravação (uma captação pode ter vários).
CREATE TABLE capture_assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id INTEGER NOT NULL REFERENCES capture_schedules(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (capture_id, team_member_id)
);
CREATE INDEX idx_assignees_member ON capture_assignees(team_member_id);

-- Vídeos planejados dentro de uma captação (Vídeo 01, Vídeo 02...).
CREATE TABLE video_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id INTEGER NOT NULL REFERENCES capture_schedules(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  script TEXT,
  notes TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_videos_capture ON video_ideas(capture_id, position);

-- Links de referência (Instagram, TikTok, YouTube, qualquer página).
CREATE TABLE video_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES video_ideas(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  domain TEXT,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_references_video ON video_references(video_id);

-- Imagens de apoio do vídeo.
CREATE TABLE video_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES video_ideas(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attachments_video ON video_attachments(video_id);

-- Histórico de alterações compartilhado pela equipe.
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_workspace ON activity_logs(workspace_id, created_at);
