require('dotenv').config();
const db = require('../db');
const { runMigrations } = require('../db/migrate');
const { ensureBaseData } = require('./bootstrap');
const { seed } = require('./seed');
const dates = require('../lib/date');
const { domainOf } = require('../lib/validate');

// Captações de demonstração distribuídas na semana atual, reproduzindo
// o jeito como a equipe usa a lousa (vários clientes no mesmo dia e
// aproveitamento de deslocamento por município).
const PLAN = [
  {
    day: 0,
    client: 'Drogaria Bem Estar',
    start_time: '08:30',
    end_time: '10:00',
    objective: 'Ofertas da semana e institucional da farmácia',
    videos: [
      { title: 'Oferta do dia', script: 'Abertura na frente da loja mostrando o cartaz da promoção.', done: 1 },
      { title: 'Trend de atendimento', references: ['https://www.instagram.com/reel/exemplo-bem-estar/'] },
    ],
  },
  {
    day: 0,
    client: 'Capibaribe',
    start_time: '10:30',
    objective: 'Novidades da loja',
    videos: [{ title: 'Vitrine da semana', script: 'Passeio pela loja destacando os produtos novos.' }],
  },
  {
    day: 1,
    client: 'SOS Farma',
    start_time: '09:00',
    end_time: '11:00',
    objective: 'Campanha de vacinação e ofertas',
    notes: 'Viagem para Banabuiú — aproveitar para gravar a Clínica Moreira no mesmo dia.',
    videos: [
      { title: 'Campanha de vacinação', script: 'Entrevista rápida com a farmacêutica.', done: 1 },
      { title: 'Ofertas do mês', done: 1 },
      { notes: 'Somente referência: repetir o formato do vídeo abaixo.', references: ['https://www.tiktok.com/@exemplo/video/123456'] },
    ],
  },
  {
    day: 1,
    client: 'Clínica Moreira',
    start_time: '11:30',
    objective: 'Apresentação dos convênios atendidos',
    videos: [
      { title: 'Convênios atendidos', script: 'Fachada + fala da recepção sobre os convênios.' },
      { title: 'Bastidores do atendimento' },
    ],
  },
  {
    day: 2,
    client: 'Central Autopeças',
    start_time: '09:00',
    objective: 'Peças em promoção',
    notes: 'Dia de Piquet Carneiro.',
    videos: [{ title: 'Promoção de filtros e óleos' }],
  },
  {
    day: 2,
    client: 'Supermercado Central',
    start_time: '10:30',
    objective: 'Encarte da semana',
    videos: [
      { title: 'Encarte da semana', script: 'Gravar os principais itens do encarte com locução.' },
      { title: 'Depoimento de cliente' },
    ],
  },
  {
    day: 3,
    client: 'Prefeitura de Banabuiú',
    start_time: '08:00',
    end_time: '12:00',
    objective: 'Cobertura da entrega de obra',
    notes: 'Captação flexível — confirmar pauta com a assessoria na véspera.',
    videos: [
      { title: 'Entrega da obra', script: 'Chegada das autoridades, corte de fita e falas.' },
      { title: 'Depoimentos da comunidade' },
    ],
  },
  {
    day: 4,
    client: 'Prefeitura de Mombaça',
    start_time: '09:00',
    objective: 'Agenda do gabinete e ações da semana',
    videos: [{ title: 'Resumo da semana' }],
  },
];

function reset(workspaceId) {
  db.prepare('DELETE FROM capture_schedules WHERE workspace_id = ?').run(workspaceId);
  console.log('[seed:demo] captações anteriores removidas (--reset).');
}

function seedDemo({ resetFirst = false } = {}) {
  runMigrations({ silent: true });
  seed();

  const workspace = ensureBaseData({ silent: true });
  const admin = db
    .prepare("SELECT * FROM profiles WHERE workspace_id = ? AND role = 'admin' ORDER BY id LIMIT 1")
    .get(workspace.id);
  const members = db
    .prepare('SELECT * FROM team_members WHERE workspace_id = ? AND active = 1 ORDER BY id')
    .all(workspace.id);

  if (resetFirst) reset(workspace.id);

  const week = dates.weekDays(dates.today());
  let created = 0;

  for (const [index, item] of PLAN.entries()) {
    const client = db
      .prepare('SELECT * FROM clients WHERE workspace_id = ? AND name = ?')
      .get(workspace.id, item.client);
    if (!client) continue;

    const date = week[item.day];
    const already = db
      .prepare('SELECT id FROM capture_schedules WHERE workspace_id = ? AND client_id = ? AND date = ?')
      .get(workspace.id, client.id, date);
    if (already) continue;

    const info = db
      .prepare(
        `INSERT INTO capture_schedules
           (workspace_id, client_id, date, start_time, end_time, city, location, objective, notes, estimated_videos, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        workspace.id, client.id, date, item.start_time, item.end_time || null, client.city,
        client.address || null, item.objective || null, item.notes || null,
        item.videos?.length || null, admin.id, admin.id
      );

    const captureId = Number(info.lastInsertRowid);

    // Alterna os responsáveis para o quadro ficar parecido com a rotina real.
    const assignee = members[index % members.length];
    if (assignee) {
      db.prepare('INSERT OR IGNORE INTO capture_assignees (capture_id, team_member_id) VALUES (?, ?)')
        .run(captureId, assignee.id);
    }

    (item.videos || []).forEach((video, position) => {
      const videoInfo = db
        .prepare(
          `INSERT INTO video_ideas (capture_id, position, title, script, notes, done, done_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, ?, ?)`
        )
        .run(
          captureId, position, video.title || null, video.script || null, video.notes || null,
          video.done ? 1 : 0, video.done ? 1 : 0, admin.id, admin.id
        );

      for (const url of video.references || []) {
        db.prepare('INSERT INTO video_references (video_id, url, domain, created_by) VALUES (?, ?, ?, ?)')
          .run(Number(videoInfo.lastInsertRowid), url, domainOf(url), admin.id);
      }
    });

    created += 1;
  }

  console.log(`[seed:demo] ${created} captação(ões) criada(s) na semana de ${week[0]} a ${week[4]}.`);
}

if (require.main === module) {
  seedDemo({ resetFirst: process.argv.includes('--reset') });
}

module.exports = { seedDemo };
