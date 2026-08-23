const { toMinutes } = require('./date');

// Quando a captação não tem horário final, consideramos esta duração
// para avaliar sobreposição de agenda do profissional.
const DEFAULT_DURATION_MIN = 60;

function rangeOf(capture) {
  const start = toMinutes(capture.start_time);
  if (start === null) return null;
  const end = toMinutes(capture.end_time) ?? start + DEFAULT_DURATION_MIN;
  return { start, end: Math.max(end, start + 1) };
}

/** Dois intervalos se sobrepõem se um começa antes do outro terminar. */
function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Verifica se algum responsável já está escalado em horário conflitante
 * no mesmo dia. Retorna avisos — nunca bloqueia o agendamento.
 *
 * @param {object} candidate  { date, start_time, end_time, assigneeIds }
 * @param {Array} sameDayCaptures  captações já salvas no mesmo dia,
 *   cada uma com { id, start_time, end_time, client_name, assignees: [{id, name}] }
 * @param {number|null} excludeId  id da captação em edição
 */
function findAssigneeConflicts(candidate, sameDayCaptures, excludeId = null) {
  const candidateRange = rangeOf(candidate);
  if (!candidateRange) return [];
  const assigneeIds = (candidate.assigneeIds || []).map(Number);
  if (assigneeIds.length === 0) return [];

  const conflicts = [];
  for (const capture of sameDayCaptures) {
    if (excludeId && Number(capture.id) === Number(excludeId)) continue;
    const range = rangeOf(capture);
    if (!range || !overlaps(candidateRange, range)) continue;

    for (const assignee of capture.assignees || []) {
      if (!assigneeIds.includes(Number(assignee.id))) continue;
      conflicts.push({
        member_id: assignee.id,
        member_name: assignee.name,
        capture_id: capture.id,
        client_name: capture.client_name,
        start_time: capture.start_time,
        end_time: capture.end_time,
        message: `${assignee.name} já está escalado(a) para ${capture.client_name} às ${capture.start_time}.`,
      });
    }
  }
  return conflicts;
}

module.exports = { findAssigneeConflicts, overlaps, rangeOf, DEFAULT_DURATION_MIN };
