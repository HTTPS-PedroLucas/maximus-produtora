const TIMEZONE = process.env.TIMEZONE || 'America/Fortaleza';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje (YYYY-MM-DD) no fuso da produtora. */
function today() {
  return dateFormatter.format(new Date());
}

/** Valida uma data no formato YYYY-MM-DD. */
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Valida um horário no formato HH:MM. */
function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Converte HH:MM em minutos desde a meia-noite. */
function toMinutes(time) {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Soma dias a uma data YYYY-MM-DD (sem depender do fuso local). */
function addDays(dateStr, amount) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Dia da semana: 0=domingo ... 6=sábado. */
function weekday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Segunda-feira da semana da data informada. */
function startOfWeek(dateStr) {
  const day = weekday(dateStr);
  const diff = day === 0 ? -6 : 1 - day; // domingo pertence à semana que começou na segunda anterior
  return addDays(dateStr, diff);
}

/** Os cinco dias úteis (segunda a sexta) da semana da data informada. */
function weekDays(dateStr) {
  const monday = startOfWeek(dateStr);
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

/** Data em formato brasileiro: 18/08/2026. */
function formatBR(dateStr) {
  if (!isValidDate(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-');
  return day + '/' + month + '/' + year;
}

module.exports = {
  TIMEZONE,
  today,
  isValidDate,
  isValidTime,
  toMinutes,
  addDays,
  weekday,
  startOfWeek,
  weekDays,
  formatBR,
};
