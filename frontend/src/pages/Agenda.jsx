import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { shiftDays, startOfWeekISO, todayISO, weekRangeLabel, weekdayShort, dayMonth } from '../lib/date';
import { EmptyState, Loading, PageHeader, SectionHeader } from '../components/ui';
import WeekSummary from '../components/agenda/WeekSummary';
import AgendaFilters from '../components/agenda/AgendaFilters';
import DayColumn from '../components/agenda/DayColumn';
import CaptureCard from '../components/agenda/CaptureCard';
import CaptureFormModal from '../components/agenda/CaptureFormModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import TravelSuggestions from '../components/agenda/TravelSuggestions';

const NO_FILTERS = { client_id: '', member_id: '', city: '', status: '' };

export default function Agenda() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const reference = searchParams.get('semana') || todayISO();
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);

  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [cities, setCities] = useState([]);

  const [formState, setFormState] = useState({ open: false, date: '', capture: null, presetClientId: null });
  const [travelHint, setTravelHint] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const today = todayISO();

  const loadWeek = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const params = { date: reference };
        for (const [key, value] of Object.entries(filters)) if (value) params[key] = value;
        const { data } = await api.get('/captures/week', { params });
        setWeek(data);
        setError('');
      } catch (err) {
        setError(errorMessage(err, 'Não foi possível carregar a agenda.'));
      } finally {
        setLoading(false);
      }
    },
    [reference, filters]
  );

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    Promise.all([api.get('/clients'), api.get('/team'), api.get('/clients/cities')])
      .then(([clientsRes, teamRes, citiesRes]) => {
        setClients(clientsRes.data);
        setTeam(teamRes.data);
        setCities(citiesRes.data);
      })
      .catch(() => {
        /* os filtros continuam utilizáveis sem as listas */
      });
  }, []);

  // Alterações de qualquer pessoa da equipe recarregam a agenda.
  useRealtimeEvent(['captures', 'videos', 'clients', 'team'], () => loadWeek({ quiet: true }));

  function goToWeek(dateStr) {
    const params = new URLSearchParams(searchParams);
    if (dateStr === todayISO()) params.delete('semana');
    else params.set('semana', startOfWeekISO(dateStr));
    setSearchParams(params, { replace: true });
  }

  async function toggleDone(capture, done) {
    // Atualização otimista: o quadro responde na hora e sincroniza depois.
    setWeek((current) =>
      current
        ? {
            ...current,
            days: current.days.map((day) => ({
              ...day,
              captures: day.captures.map((item) => (item.id === capture.id ? { ...item, done: done ? 1 : 0 } : item)),
            })),
          }
        : current
    );

    try {
      await api.patch(`/captures/${capture.id}/done`, { done });
      toast.success(done ? 'Captação concluída.' : 'Captação reaberta.');
      loadWeek({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível atualizar o status.'));
      loadWeek({ quiet: true });
    }
  }

  /** Membro exclui o que agendou; administrador exclui qualquer captação. */
  function canDelete(capture) {
    return isAdmin || capture.created_by === user?.id;
  }

  async function removeCapture(capture) {
    try {
      await api.delete(`/captures/${capture.id}`);
      toast.success('Captação excluída.');
      setConfirmDelete(null);
      loadWeek({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir a captação.'));
      setConfirmDelete(null);
    }
  }

  function openNew(date, presetClientId = null) {
    setFormState({ open: true, date, capture: null, presetClientId });
  }

  function handleSaved(data) {
    setFormState({ open: false, date: '', capture: null, presetClientId: null });
    loadWeek({ quiet: true });
    if (data?.suggestions?.length > 0) {
      setTravelHint({ date: data.capture.date, cities: [data.capture.city], suggestions: data.suggestions });
    }
  }

  const weekLabel = useMemo(
    () => (week ? weekRangeLabel(week.start, week.end) : ''),
    [week]
  );

  return (
    <>
      <PageHeader
        eyebrow="Máximus Produtora"
        title="Agenda semanal"
        description="Planejamento de captações de segunda a sexta — compartilhado com toda a equipe."
        actions={
          <button type="button" className="btn" onClick={() => openNew(week?.days?.[0]?.date || today)}>
            <CalendarPlus size={17} strokeWidth={1.75} />
            Nova captação
          </button>
        }
      />

      <WeekSummary summary={week?.summary} />

      <div className="agenda-toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="btn-icon"
            onClick={() => goToWeek(shiftDays(week?.start || today, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="week-label">{weekLabel || '—'}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => goToWeek(shiftDays(week?.start || today, 7))}
            aria-label="Próxima semana"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToWeek(today)}>
          <CalendarDays size={15} />
          Semana atual
        </button>

        <AgendaFilters filters={filters} onChange={setFilters} clients={clients} team={team} cities={cities} />
      </div>

      {travelHint && (
        <TravelSuggestions
          cities={travelHint.cities}
          suggestions={travelHint.suggestions}
          onAdd={(client) => {
            setTravelHint(null);
            openNew(travelHint.date, client.id);
          }}
        />
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {loading && !week ? (
        <Loading label="Carregando a agenda da semana…" />
      ) : (
        <>
          <div className="week-board">
            {week?.days.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                isToday={day.date === week.today}
                isPast={day.date < week.today}
                onAdd={openNew}
                onOpenCapture={(capture) => navigate(`/captacoes/${capture.id}`)}
                onToggleDone={toggleDone}
                onDelete={setConfirmDelete}
                canDelete={canDelete}
              />
            ))}
          </div>

          {week?.weekend?.length > 0 && (
            <section className="card card-pad">
              <SectionHeader
                title="Fora dos dias úteis"
                description="Captações registradas no fim de semana desta semana."
              />
              <div className="col">
                {week.weekend.map((day) => (
                  <div key={day.date} className="col gap-6">
                    <span className="small strong">
                      {weekdayShort(day.date)} — {dayMonth(day.date)}
                    </span>
                    {day.captures.map((capture) => (
                      <CaptureCard
                        key={capture.id}
                        capture={capture}
                        onOpen={(item) => navigate(`/captacoes/${item.id}`)}
                        onToggleDone={toggleDone}
                        onDelete={canDelete(capture) ? setConfirmDelete : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {week?.summary?.captures_total === 0 && (
            <div className="card">
              <EmptyState
                icon={CalendarDays}
                title="Nenhuma captação nesta semana"
                description="Comece adicionando um cliente em um dos dias. Você pode colocar vários clientes no mesmo dia."
                action={
                  <button type="button" className="btn" onClick={() => openNew(week.days[0].date)}>
                    <CalendarPlus size={16} />
                    Adicionar captação
                  </button>
                }
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        message={`Excluir a captação de ${confirmDelete?.client_name}?`}
        detail="Os vídeos, roteiros, links e imagens desta captação também serão apagados. Esta ação não pode ser desfeita."
        onConfirm={() => removeCapture(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <CaptureFormModal
        open={formState.open}
        date={formState.date}
        capture={formState.capture}
        presetClientId={formState.presetClientId}
        clients={clients}
        team={team}
        onClose={() => setFormState({ open: false, date: '', capture: null, presetClientId: null })}
        onSaved={handleSaved}
      />
    </>
  );
}
