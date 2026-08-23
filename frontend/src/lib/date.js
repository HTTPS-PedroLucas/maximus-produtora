import { addDays, format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const TIMEZONE = 'America/Fortaleza';

/**
 * Datas trafegam sempre como texto YYYY-MM-DD. Converter para Date com
 * parseISO evita o deslocamento de fuso que acontece com new Date('2026-08-17').
 */
export function toDate(dateStr) {
  const date = parseISO(dateStr);
  return isValid(date) ? date : new Date();
}

/** Hoje no fuso da produtora (America/Fortaleza), no formato YYYY-MM-DD. */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isoOf(date) {
  return format(date, 'yyyy-MM-dd');
}

export function shiftDays(dateStr, amount) {
  return isoOf(addDays(toDate(dateStr), amount));
}

/** Segunda-feira da semana da data informada. */
export function startOfWeekISO(dateStr) {
  const date = toDate(dateStr);
  const day = date.getDay();
  return isoOf(addDays(date, day === 0 ? -6 : 1 - day));
}

/** "Segunda-feira" — só a primeira letra em maiúscula, como se escreve em português. */
export function weekdayName(dateStr) {
  const name = format(toDate(dateStr), 'EEEE', { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "Segunda" */
export function weekdayShort(dateStr) {
  const name = format(toDate(dateStr), 'EEEE', { locale: ptBR }).replace('-feira', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "17/08" */
export function dayMonth(dateStr) {
  return format(toDate(dateStr), 'dd/MM', { locale: ptBR });
}

/** "17 de agosto de 2026" */
export function longDate(dateStr) {
  return format(toDate(dateStr), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** "17 a 21 de agosto de 2026" */
export function weekRangeLabel(start, end) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const sameMonth = format(startDate, 'MM') === format(endDate, 'MM');
  const startLabel = sameMonth
    ? format(startDate, 'd', { locale: ptBR })
    : format(startDate, "d 'de' MMM", { locale: ptBR });
  return `${startLabel} a ${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
}

/** Data e hora de uma alteração: "17/08/2026 às 14:32". */
export function updatedAtLabel(sqlDatetime) {
  if (!sqlDatetime) return '';
  // O SQLite grava em UTC ("YYYY-MM-DD HH:MM:SS").
  const date = new Date(`${sqlDatetime.replace(' ', 'T')}Z`);
  if (!isValid(date)) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(', ', ' às ');
}

/** Intervalo de horário legível: "09:00 — 11:00" ou apenas "09:00". */
export function timeRange(start, end) {
  return end ? `${start} — ${end}` : start;
}
