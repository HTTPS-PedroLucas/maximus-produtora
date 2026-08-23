const test = require('node:test');
const assert = require('node:assert');

const dates = require('../src/lib/date');
const { findAssigneeConflicts } = require('../src/lib/conflicts');
const { parse, ValidationError, domainOf } = require('../src/lib/validate');

test('semana da agenda vai de segunda a sexta', () => {
  // 2026-08-19 é uma quarta-feira.
  assert.deepStrictEqual(dates.weekDays('2026-08-19'), [
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
  ]);
});

test('domingo pertence à semana que começou na segunda anterior', () => {
  assert.strictEqual(dates.startOfWeek('2026-08-23'), '2026-08-17');
  assert.strictEqual(dates.startOfWeek('2026-08-17'), '2026-08-17');
});

test('soma de dias atravessa a virada de mês', () => {
  assert.strictEqual(dates.addDays('2026-08-31', 1), '2026-09-01');
  assert.strictEqual(dates.addDays('2026-01-01', -1), '2025-12-31');
});

test('validação de data e horário', () => {
  assert.ok(dates.isValidDate('2026-02-28'));
  assert.ok(!dates.isValidDate('2026-02-30'));
  assert.ok(!dates.isValidDate('18/08/2026'));
  assert.ok(dates.isValidTime('09:30'));
  assert.ok(!dates.isValidTime('24:00'));
  assert.strictEqual(dates.toMinutes('09:30'), 570);
  assert.strictEqual(dates.formatBR('2026-08-18'), '18/08/2026');
});

test('hoje respeita o fuso da produtora', () => {
  assert.match(dates.today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(dates.TIMEZONE, 'America/Fortaleza');
});

// --- Conflitos de escala --------------------------------------------------

const sameDay = [
  {
    id: 1,
    start_time: '09:00',
    end_time: '11:00',
    client_name: 'SOS Farma',
    assignees: [{ id: 7, name: 'Social Media' }],
  },
  {
    id: 2,
    start_time: '14:00',
    end_time: null,
    client_name: 'Clínica Moreira',
    assignees: [{ id: 8, name: 'Cinegrafista' }],
  },
];

test('avisa quando o mesmo profissional está em horários sobrepostos', () => {
  const conflicts = findAssigneeConflicts(
    { date: '2026-08-18', start_time: '10:00', end_time: '12:00', assigneeIds: [7] },
    sameDay
  );
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].member_id, 7);
  assert.match(conflicts[0].message, /SOS Farma/);
});

test('não há conflito com profissionais diferentes no mesmo horário', () => {
  const conflicts = findAssigneeConflicts(
    { date: '2026-08-18', start_time: '09:30', end_time: '10:30', assigneeIds: [8] },
    sameDay
  );
  assert.deepStrictEqual(conflicts, []);
});

test('horários encostados não são conflito', () => {
  const conflicts = findAssigneeConflicts(
    { date: '2026-08-18', start_time: '11:00', end_time: '12:00', assigneeIds: [7] },
    sameDay
  );
  assert.deepStrictEqual(conflicts, []);
});

test('sem horário final, considera a duração padrão de 1 hora', () => {
  const conflicts = findAssigneeConflicts(
    { date: '2026-08-18', start_time: '14:30', end_time: null, assigneeIds: [8] },
    sameDay
  );
  assert.strictEqual(conflicts.length, 1);
});

test('a captação em edição não conflita com ela mesma', () => {
  const conflicts = findAssigneeConflicts(
    { date: '2026-08-18', start_time: '09:00', end_time: '11:00', assigneeIds: [7] },
    sameDay,
    1
  );
  assert.deepStrictEqual(conflicts, []);
});

// --- Validação ------------------------------------------------------------

test('campos obrigatórios geram erro por campo', () => {
  assert.throws(
    () => parse({ name: '' }, { name: { required: true } }),
    (err) => err instanceof ValidationError && Boolean(err.errors.name)
  );
});

test('normaliza cor, e-mail e link', () => {
  const data = parse(
    { color: '#abc', email: '  Equipe@Maximus.com ', url: 'instagram.com/reel/xyz' },
    { color: { type: 'color' }, email: { type: 'email' }, url: { type: 'url' } }
  );
  assert.strictEqual(data.color, '#AABBCC');
  assert.strictEqual(data.email, 'equipe@maximus.com');
  assert.strictEqual(data.url, 'https://instagram.com/reel/xyz');
});

test('campos opcionais vazios viram null', () => {
  const data = parse({}, { notes: { max: 100 }, estimated_videos: { type: 'number' } });
  assert.strictEqual(data.notes, null);
  assert.strictEqual(data.estimated_videos, null);
});

test('extrai o domínio do link de referência', () => {
  assert.strictEqual(domainOf('https://www.tiktok.com/@perfil/video/1'), 'tiktok.com');
  assert.strictEqual(domainOf('https://www.instagram.com/reel/abc'), 'instagram.com');
  assert.strictEqual(domainOf('não é link'), null);
});
