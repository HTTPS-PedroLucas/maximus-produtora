require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { runMigrations } = require('../db/migrate');
const { ensureBaseData } = require('./bootstrap');

// Catálogo inicial de clientes da Máximus. As cores ficam no banco
// (configuráveis pela tela de clientes) — nada fixo no código da interface.
const CLIENTS = [
  { name: 'Drogaria Bem Estar', short_name: 'Bem Estar', color: '#38BDF8', city: 'Senador Pompeu', capture_type: 'recorrente', notes: 'Contorno azul-claro na lousa.' },
  { name: 'Capibaribe', short_name: 'Capibaribe', color: '#F59E0B', city: 'Senador Pompeu', capture_type: 'recorrente', notes: '' },
  { name: 'SOS Farma', short_name: 'SOS Farma', color: '#DC2626', city: 'Banabuiú', capture_type: 'recorrente', notes: 'Contorno vermelho na lousa.' },
  { name: 'Clínica Moreira', short_name: 'Cl. Moreira', color: '#166534', city: 'Banabuiú', capture_type: 'recorrente', notes: 'Contorno verde-escuro na lousa.' },
  { name: 'Câmara Municipal de Banabuiú', short_name: 'Câmara Banabuiú', color: '#7C3AED', city: 'Banabuiú', capture_type: 'flexivel', notes: 'Sem dia fixo — captação conforme pauta.' },
  { name: 'Prefeitura de Banabuiú', short_name: 'Pref. Banabuiú', color: '#0EA5E9', city: 'Banabuiú', capture_type: 'flexivel', notes: 'Sem dia fixo — captação conforme agenda do gabinete.' },
  { name: 'Prefeitura de Mombaça', short_name: 'Pref. Mombaça', color: '#0F766E', city: 'Mombaça', capture_type: 'flexivel', notes: 'Sem dia fixo — captação conforme agenda do gabinete.' },
  { name: 'Central Autopeças', short_name: 'Central Autopeças', color: '#EA580C', city: 'Piquet Carneiro', capture_type: 'recorrente', notes: '' },
  { name: 'Supermercado Central', short_name: 'Super Central', color: '#65A30D', city: 'Piquet Carneiro', capture_type: 'recorrente', notes: '' },
];

const TEAM = [
  { name: 'Equipe de Captação', role_title: 'Cinegrafista', email: '' },
  { name: 'Social Media', role_title: 'Social media / roteiro', email: '' },
];

const EXTRA_USER = {
  name: 'Equipe Máximus',
  email: (process.env.MEMBER_EMAIL || 'equipe@maximusprodutora.com.br').toLowerCase(),
  password: process.env.MEMBER_PASSWORD || 'equipe123',
  role: 'member',
};

function seed() {
  runMigrations({ silent: true });
  const workspace = ensureBaseData();
  const admin = db
    .prepare("SELECT * FROM profiles WHERE workspace_id = ? AND role = 'admin' ORDER BY id LIMIT 1")
    .get(workspace.id);

  const region = workspace.home_region || 'Sertão Central';
  let createdClients = 0;

  const insertClient = db.prepare(
    `INSERT INTO clients (workspace_id, name, short_name, color, city, region, capture_type, notes, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const client of CLIENTS) {
    const exists = db
      .prepare('SELECT id FROM clients WHERE workspace_id = ? AND name = ?')
      .get(workspace.id, client.name);
    if (exists) continue;
    insertClient.run(
      workspace.id, client.name, client.short_name, client.color, client.city,
      region, client.capture_type, client.notes || null, admin.id, admin.id
    );
    createdClients += 1;
  }

  let createdMembers = 0;
  const insertMember = db.prepare(
    `INSERT INTO team_members (workspace_id, name, role_title, email, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const member of TEAM) {
    const exists = db
      .prepare('SELECT id FROM team_members WHERE workspace_id = ? AND name = ?')
      .get(workspace.id, member.name);
    if (exists) continue;
    insertMember.run(workspace.id, member.name, member.role_title, member.email || null, admin.id, admin.id);
    createdMembers += 1;
  }

  // Um segundo acesso (perfil "membro") para a equipe testar os dois níveis.
  const memberExists = db.prepare('SELECT id FROM profiles WHERE email = ?').get(EXTRA_USER.email);
  if (!memberExists) {
    const info = db
      .prepare('INSERT INTO profiles (workspace_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(workspace.id, EXTRA_USER.name, EXTRA_USER.email, bcrypt.hashSync(EXTRA_USER.password, 10), EXTRA_USER.role);
    db.prepare(
      `INSERT INTO team_members (workspace_id, profile_id, name, role_title, email, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(workspace.id, Number(info.lastInsertRowid), EXTRA_USER.name, 'Produção', EXTRA_USER.email, admin.id, admin.id);
    console.log(`[seed] acesso de equipe criado: ${EXTRA_USER.email} / senha: ${EXTRA_USER.password}`);
  }

  console.log(`[seed] ${createdClients} cliente(s) e ${createdMembers} membro(s) adicionados.`);
  console.log('[seed] pronto. Use "npm run seed:demo" para criar captações de exemplo na semana atual.');
}

if (require.main === module) seed();

module.exports = { seed, CLIENTS, TEAM };
