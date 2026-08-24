const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const zlib = require('zlib');

/**
 * Lê o word/document.xml de dentro de um .docx (que é um zip), para conferir
 * a formatação real do arquivo sem depender de biblioteca extra.
 */
function lerDocumentXml(arquivo) {
  const buffer = fs.readFileSync(arquivo);
  let pos = 0;
  while (pos < buffer.length - 4) {
    if (buffer.readUInt32LE(pos) !== 0x04034b50) break;
    const metodo = buffer.readUInt16LE(pos + 8);
    const comprimido = buffer.readUInt32LE(pos + 18);
    const tamanhoNome = buffer.readUInt16LE(pos + 26);
    const tamanhoExtra = buffer.readUInt16LE(pos + 28);
    const nome = buffer.subarray(pos + 30, pos + 30 + tamanhoNome).toString('utf8');
    const inicio = pos + 30 + tamanhoNome + tamanhoExtra;
    const dados = buffer.subarray(inicio, inicio + comprimido);
    if (nome === 'word/document.xml') {
      return (metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString('utf8');
    }
    pos = inicio + comprimido;
  }
  throw new Error('word/document.xml não encontrado no .docx');
}

// Banco e uploads isolados: o teste não toca nos dados de trabalho.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maximus-test-'));
process.env.DB_FILE = path.join(tempDir, 'test.sqlite');
process.env.UPLOADS_DIR = path.join(tempDir, 'uploads');
process.env.ADMIN_EMAIL = 'admin@teste.com';
process.env.ADMIN_PASSWORD = 'teste123';
process.env.NODE_ENV = 'test';

const app = require('../src/server');

let server;
let baseUrl;
let adminToken;
let memberToken;
let clientId;
let captureId;
let videoId;

async function call(method, url, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => {
  server?.close();
  // Fecha o banco antes de apagar (no Windows o arquivo fica travado enquanto aberto).
  try {
    require('../src/db').close();
  } catch {
    /* já fechado */
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    /* o sistema operacional limpa a pasta temporária depois */
  }
});

test('login do administrador criado no bootstrap', async () => {
  const bad = await call('POST', '/auth/login', { body: { email: 'admin@teste.com', password: 'errada' } });
  assert.strictEqual(bad.status, 401);

  const { status, data } = await call('POST', '/auth/login', {
    body: { email: 'admin@teste.com', password: 'teste123' },
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.user.role, 'admin');
  adminToken = data.token;
});

test('rotas protegidas exigem sessão', async () => {
  const { status } = await call('GET', '/clients');
  assert.strictEqual(status, 401);
});

test('administrador cadastra cliente com município e cor', async () => {
  const { status, data } = await call('POST', '/clients', {
    token: adminToken,
    body: {
      name: 'SOS Farma',
      short_name: 'SOS Farma',
      color: '#DC2626',
      city: 'Banabuiú',
      region: 'Sertão Central',
      capture_type: 'recorrente',
    },
  });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.color, '#DC2626');
  assert.strictEqual(data.created_by_name, 'Administração Máximus');
  clientId = data.id;

  const segundo = await call('POST', '/clients', {
    token: adminToken,
    body: {
      name: 'Clínica Moreira',
      short_name: 'Cl. Moreira',
      color: '#166534',
      city: 'Banabuiú',
      region: 'Sertão Central',
      capture_type: 'recorrente',
    },
  });
  assert.strictEqual(segundo.status, 201);
});

test('cor inválida é recusada com erro por campo', async () => {
  const { status, data } = await call('POST', '/clients', {
    token: adminToken,
    body: { name: 'X', short_name: 'X', color: 'azul', city: 'Banabuiú', capture_type: 'recorrente' },
  });
  assert.strictEqual(status, 400);
  assert.ok(data.errors.color);
});

test('administrador cria acesso de membro da equipe', async () => {
  const criado = await call('POST', '/users', {
    token: adminToken,
    body: { name: 'Equipe Teste', email: 'equipe@teste.com', password: 'equipe123', role: 'member' },
  });
  assert.strictEqual(criado.status, 201);

  const login = await call('POST', '/auth/login', {
    body: { email: 'equipe@teste.com', password: 'equipe123' },
  });
  assert.strictEqual(login.status, 200);
  memberToken = login.data.token;

  // Todo usuário também vira membro da equipe (aparece em "quem irá gravar").
  const team = await call('GET', '/team?active=1', { token: memberToken });
  assert.ok(team.data.some((member) => member.name === 'Equipe Teste'));
});

test('membro não pode cadastrar clientes', async () => {
  const { status } = await call('POST', '/clients', {
    token: memberToken,
    body: { name: 'Y', short_name: 'Y', color: '#123456', city: 'Z', capture_type: 'recorrente' },
  });
  assert.strictEqual(status, 403);
});

test('membro cria captação e recebe sugestão de deslocamento', async () => {
  const team = await call('GET', '/team?active=1', { token: memberToken });
  const memberId = team.data.find((member) => member.name === 'Equipe Teste').id;

  const { status, data } = await call('POST', '/captures', {
    token: memberToken,
    body: {
      client_id: clientId,
      date: '2026-08-18',
      start_time: '09:00',
      end_time: '11:00',
      objective: 'Campanha de vacinação',
      assignee_ids: [memberId],
    },
  });

  assert.strictEqual(status, 201);
  assert.strictEqual(data.capture.city, 'Banabuiú'); // veio do cliente
  assert.strictEqual(data.capture.assignees.length, 1);
  assert.deepStrictEqual(data.conflicts, []);
  // Clínica Moreira é do mesmo município e ainda não está agendada nesse dia.
  assert.ok(data.suggestions.some((client) => client.name === 'Clínica Moreira' && client.same_city));
  captureId = data.capture.id;
});

test('conflito de escala é apenas aviso, não bloqueio', async () => {
  const team = await call('GET', '/team?active=1', { token: adminToken });
  const memberId = team.data.find((member) => member.name === 'Equipe Teste').id;
  const outro = await call('GET', '/clients', { token: adminToken });
  const outroCliente = outro.data.find((client) => client.name === 'Clínica Moreira');

  const { status, data } = await call('POST', '/captures', {
    token: adminToken,
    body: {
      client_id: outroCliente.id,
      date: '2026-08-18',
      start_time: '10:00',
      end_time: '12:00',
      assignee_ids: [memberId],
    },
  });

  assert.strictEqual(status, 201); // salvou mesmo com conflito
  assert.strictEqual(data.conflicts.length, 1);
  assert.match(data.conflicts[0].message, /SOS Farma/);
});

test('vídeos são numerados automaticamente e aceitam só roteiro ou só link', async () => {
  const primeiro = await call('POST', '/videos', {
    token: memberToken,
    body: { capture_id: captureId, script: 'Somente roteiro, sem título.' },
  });
  assert.strictEqual(primeiro.status, 201);
  assert.strictEqual(primeiro.data.number, 1);
  videoId = primeiro.data.id;

  const segundo = await call('POST', '/videos', { token: memberToken, body: { capture_id: captureId } });
  assert.strictEqual(segundo.data.number, 2);

  const link = await call('POST', `/videos/${segundo.data.id}/references`, {
    token: memberToken,
    body: { url: 'https://www.instagram.com/reel/abc123/' },
  });
  assert.strictEqual(link.status, 201);
  assert.strictEqual(link.data.references[0].domain, 'instagram.com');
});

test('o documento .docx do roteiro é gerado, atualizado e removido sozinho', async () => {
  // Vídeo sem roteiro não tem documento.
  const vazio = await call('POST', '/videos', { token: memberToken, body: { capture_id: captureId } });
  assert.strictEqual(vazio.data.script_doc_url, null);
  const id = vazio.data.id;

  // Ao salvar o roteiro, o documento nasce junto.
  const comRoteiro = await call('PUT', `/videos/${id}`, {
    token: memberToken,
    body: { title: 'Campanha', script: 'ABERTURA\n\nFala da farmacêutica.' },
  });
  assert.match(comRoteiro.data.script_doc_url, /^\/uploads\/scripts\/.+\.docx$/);
  assert.match(comRoteiro.data.script_doc_name, /^Roteiro_Video-\d{2}_.*\.docx$/);
  assert.ok(comRoteiro.data.script_doc_size_bytes > 0);

  // O arquivo existe em disco e é um .docx de verdade (zip começa com "PK").
  const caminho = path.join(process.env.UPLOADS_DIR, comRoteiro.data.script_doc_url.replace('/uploads/', ''));
  assert.ok(fs.existsSync(caminho));
  assert.strictEqual(fs.readFileSync(caminho).subarray(0, 2).toString('latin1'), 'PK');

  // A marcação colada pela equipe vira formatação real: nada de asteriscos
  // aparecendo no Word.
  const comMarcacao = await call('PUT', `/videos/${id}`, {
    token: memberToken,
    body: { title: 'Campanha', script: '### TÍTULO\n\n**CENA 1**\nFala normal.\n\n- item da lista' },
  });
  const docXml = lerDocumentXml(
    path.join(process.env.UPLOADS_DIR, comMarcacao.data.script_doc_url.replace('/uploads/', ''))
  );
  const textos = [...docXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('\n');
  assert.ok(!textos.includes('**'), 'os asteriscos de negrito não podem sobrar no documento');
  assert.ok(!textos.includes('### '), 'a marcação de título não pode sobrar no documento');
  assert.ok(textos.includes('TÍTULO') && textos.includes('CENA 1'), 'o texto precisa continuar lá');
  assert.ok(/<w:b\b/.test(docXml), 'o documento precisa ter trechos em negrito de verdade');
  assert.ok(/<w:numPr>/.test(docXml), 'a lista precisa virar marcador do Word');

  // Editar o roteiro troca o documento e descarta o arquivo anterior.
  const anterior = comMarcacao.data.script_doc_url;
  const editado = await call('PUT', `/videos/${id}`, {
    token: memberToken,
    body: { title: 'Campanha', script: 'ABERTURA\n\nNova versão da fala.' },
  });
  assert.notStrictEqual(editado.data.script_doc_url, anterior);
  assert.ok(!fs.existsSync(path.join(process.env.UPLOADS_DIR, anterior.replace('/uploads/', ''))));

  // Apagar o roteiro remove o documento.
  const semRoteiro = await call('PUT', `/videos/${id}`, {
    token: memberToken,
    body: { title: 'Campanha', script: '' },
  });
  assert.strictEqual(semRoteiro.data.script_doc_url, null);

  await call('DELETE', `/videos/${id}`, { token: memberToken });
});

test('progresso da captação acompanha os vídeos concluídos', async () => {
  const marcado = await call('PATCH', `/videos/${videoId}/done`, { token: memberToken, body: { done: true } });
  assert.strictEqual(marcado.data.progress.done, 1);
  assert.strictEqual(marcado.data.progress.total, 2);
  assert.strictEqual(marcado.data.suggest_capture_done, false);

  const capture = await call('GET', `/captures/${captureId}`, { token: memberToken });
  assert.strictEqual(capture.data.capture.videos_done, 1);
  assert.strictEqual(capture.data.capture.videos_total, 2);
});

test('reordenar vídeos renumera a lista', async () => {
  const antes = await call('GET', `/captures/${captureId}`, { token: memberToken });
  const ids = antes.data.videos.map((video) => video.id);

  await call('PUT', `/videos/reorder/${captureId}`, { token: memberToken, body: { ids: [...ids].reverse() } });

  const depois = await call('GET', `/captures/${captureId}`, { token: memberToken });
  assert.deepStrictEqual(
    depois.data.videos.map((video) => video.id),
    [...ids].reverse()
  );
  assert.strictEqual(depois.data.videos[0].number, 1);
});

test('duplicar vídeo copia roteiro e referências', async () => {
  const { status, data } = await call('POST', `/videos/${videoId}/duplicate`, { token: memberToken });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.script, 'Somente roteiro, sem título.');
  assert.strictEqual(data.done, 0); // a cópia nasce pendente
});

test('agenda semanal agrupa por dia e calcula o resumo', async () => {
  const { data } = await call('GET', '/captures/week?date=2026-08-19', { token: memberToken });
  assert.strictEqual(data.start, '2026-08-17');
  assert.strictEqual(data.end, '2026-08-21');
  assert.strictEqual(data.days.length, 5);

  const terca = data.days.find((day) => day.date === '2026-08-18');
  assert.strictEqual(terca.captures.length, 2);
  assert.strictEqual(terca.summary.cities.length, 1);
  assert.strictEqual(data.summary.clients_total, 2);
  assert.strictEqual(data.summary.captures_pending, 2);
});

test('tela do dia traz rota, totais e sugestões', async () => {
  const { data } = await call('GET', '/captures/day/2026-08-18', { token: memberToken });
  assert.strictEqual(data.summary.captures_total, 2);
  assert.strictEqual(data.summary.route, 'Banabuiú');
  assert.strictEqual(data.summary.multi_city, false);
  assert.strictEqual(data.captures[0].start_time, '09:00'); // ordenado por horário
});

test('concluir a captação registra quem concluiu', async () => {
  const { data } = await call('PATCH', `/captures/${captureId}/done`, { token: memberToken, body: { done: true } });
  assert.strictEqual(data.capture.done, 1);
  assert.ok(data.capture.done_at);

  const reaberta = await call('PATCH', `/captures/${captureId}/done`, { token: memberToken, body: { done: false } });
  assert.strictEqual(reaberta.data.capture.done, 0);
  assert.strictEqual(reaberta.data.capture.done_at, null);
});

test('cliente com captações não é apagado por engano', async () => {
  const { status, data } = await call('DELETE', `/clients/${clientId}`, { token: adminToken });
  assert.strictEqual(status, 409);
  assert.ok(data.captures >= 1);
});

test('membro não exclui captação criada por outra pessoa', async () => {
  const week = await call('GET', '/captures/week?date=2026-08-18', { token: adminToken });
  const doAdmin = week.data.days
    .flatMap((day) => day.captures)
    .find((capture) => capture.created_by_name === 'Administração Máximus');

  const { status } = await call('DELETE', `/captures/${doAdmin.id}`, { token: memberToken });
  assert.strictEqual(status, 403);

  const comoAdmin = await call('DELETE', `/captures/${doAdmin.id}`, { token: adminToken });
  assert.strictEqual(comoAdmin.status, 200);
});

test('histórico registra as alterações da equipe', async () => {
  const { data } = await call('GET', '/workspace/activity', { token: adminToken });
  assert.ok(data.length > 0);
  assert.ok(data.some((item) => item.entity_type === 'captures'));
  assert.ok(data.every((item) => item.actor_name));
});
