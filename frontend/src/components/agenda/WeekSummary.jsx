import { MetricCard } from '../ui';

/** Monitoramento da semana exibido no topo da agenda. */
export default function WeekSummary({ summary }) {
  if (!summary) return null;

  const cells = [
    { label: 'Clientes na semana', value: summary.clients_total },
    { label: 'Captações concluídas', value: summary.captures_done },
    { label: 'Captações pendentes', value: summary.captures_pending },
    { label: 'Vídeos planejados', value: summary.videos_total },
    { label: 'Vídeos concluídos', value: summary.videos_done },
  ];

  return (
    <div className="week-summary" role="group" aria-label="Resumo da semana">
      {cells.map((cell) => (
        <MetricCard key={cell.label} value={cell.value} label={cell.label} plain />
      ))}

      <MetricCard value={`${summary.overall_progress}%`} label="Conclusão da semana" highlight>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={summary.overall_progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Conclusão geral da semana"
        >
          <span style={{ width: `${summary.overall_progress}%` }} />
        </div>
      </MetricCard>
    </div>
  );
}
