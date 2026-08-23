import { MapPin, Trash2, Video } from 'lucide-react';
import { useClientStyle } from '../../context/ThemeContext';
import { ClientAvatar, ProgressBar } from '../ui';

/**
 * Etiqueta do cliente na lousa semanal: horário, logo/iniciais, município,
 * responsáveis, progresso dos vídeos e checkbox de conclusão.
 * O contorno e o fundo suave usam a cor cadastrada do cliente — a identidade
 * da Máximus não substitui a cor de cada cliente.
 */
export default function CaptureCard({ capture, onOpen, onToggleDone, onDelete }) {
  const clientStyle = useClientStyle();
  const style = clientStyle(capture.client_color);
  const assignees = capture.assignees || [];

  return (
    <div className={`capture-card ${capture.done ? 'is-done' : ''}`} style={style}>
      <button
        type="button"
        className="capture-open"
        onClick={() => onOpen(capture)}
        aria-label={`Abrir captação de ${capture.client_name} às ${capture.start_time}`}
      >
        <span className="capture-top">
          <span className="capture-time">{capture.start_time}</span>
          <ClientAvatar
            name={capture.client_name}
            logoUrl={capture.client_logo_url}
            color={capture.client_color}
            size="sm"
          />
          <span className="capture-client truncate">{capture.client_short_name || capture.client_name}</span>
        </span>

        <span className="capture-meta">
          <MapPin size={12} strokeWidth={1.75} />
          <span className="truncate">{capture.city}</span>
          {assignees.length > 0 && (
            <>
              <span className="dot" />
              <span className="truncate">{assignees.map((member) => member.name.split(' ')[0]).join(', ')}</span>
            </>
          )}
        </span>
      </button>

      <div className="capture-foot">
        <span className="capture-progress" title={`${capture.videos_done} de ${capture.videos_total} vídeos concluídos`}>
          <Video size={12} strokeWidth={1.75} />
          {capture.videos_total > 0 ? (
            <>
              <ProgressBar
                value={capture.videos_done}
                total={capture.videos_total}
                success={capture.videos_done === capture.videos_total}
              />
              {capture.videos_done}/{capture.videos_total}
            </>
          ) : (
            <span className="tiny dim">sem vídeos</span>
          )}
        </span>

        <span className="capture-actions">
          <label className="capture-check">
            <input
              type="checkbox"
              autoComplete="off"
              checked={Boolean(capture.done)}
              onChange={(event) => onToggleDone(capture, event.target.checked)}
              aria-label={`Marcar captação de ${capture.client_name} como concluída`}
            />
            {capture.done ? 'Feito' : 'Concluir'}
          </label>

          {onDelete && (
            <button
              type="button"
              className="capture-delete"
              onClick={() => onDelete(capture)}
              aria-label={`Excluir captação de ${capture.client_name} às ${capture.start_time}`}
              title="Excluir captação"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          )}
        </span>
      </div>

      {capture.client_capture_type === 'flexivel' && !capture.done && (
        <span className="capture-flexible" title="Cliente de captação flexível (sem dia fixo)">
          flex
        </span>
      )}
    </div>
  );
}
