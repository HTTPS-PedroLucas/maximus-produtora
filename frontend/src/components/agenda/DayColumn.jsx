import { Link } from 'react-router-dom';
import { Plus, Route, TriangleAlert } from 'lucide-react';
import { dayMonth, weekdayShort } from '../../lib/date';
import { BrandWatermark } from '../brand';
import CaptureCard from './CaptureCard';

/** Uma coluna da lousa: um dia da semana com seus clientes, em ordem de horário. */
export default function DayColumn({ day, isToday, isPast, onAdd, onOpenCapture, onToggleDone, onDelete, canDelete }) {
  const { date, captures, summary } = day;

  return (
    <section
      className={`day-column ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}
      aria-label={weekdayShort(date)}
    >
      <header className="day-head">
        <Link to={`/agenda/${date}`} className="day-head-link">
          <span className="day-name">{weekdayShort(date)}</span>
          <span className="day-date">{dayMonth(date)}</span>
        </Link>
        {isToday && <span className="day-today-tag">Hoje</span>}
      </header>

      <div className="day-list">
        {captures.length === 0 ? (
          <p className="day-empty">
            <BrandWatermark />
            <span>Nenhuma captação</span>
          </p>
        ) : (
          captures.map((capture) => (
            <CaptureCard
              key={capture.id}
              capture={capture}
              onOpen={onOpenCapture}
              onToggleDone={onToggleDone}
              onDelete={onDelete && (!canDelete || canDelete(capture)) ? onDelete : undefined}
            />
          ))
        )}
      </div>

      <div className="day-foot">
        {summary.cities.length > 0 && (
          <span className={`day-route ${summary.multi_city ? 'is-multi' : ''}`} title="Municípios do dia">
            {summary.multi_city ? <TriangleAlert size={12} strokeWidth={1.75} /> : <Route size={12} strokeWidth={1.75} />}
            <span className="truncate">{summary.route}</span>
          </span>
        )}
        <button type="button" className="add-capture-btn" onClick={() => onAdd(date)}>
          <Plus size={15} strokeWidth={2} />
          Adicionar cliente
        </button>
      </div>
    </section>
  );
}
