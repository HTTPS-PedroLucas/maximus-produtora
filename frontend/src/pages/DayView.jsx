import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarPlus, ChevronLeft, ChevronRight, Clapperboard, MapPin, Pencil,
  Route, TriangleAlert, Trash2, Users, ArrowLeft, CalendarDays,
} from 'lucide-react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { dayMonth, longDate, shiftDays, timeRange, todayISO, weekdayName, startOfWeekISO } from '../lib/date';
import { useClientStyle } from '../context/ThemeContext';
import { ClientAvatar, EmptyState, Loading, MemberAvatar, MetricCard, PageHeader, ProgressBar } from '../components/ui';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import CaptureFormModal from '../components/agenda/CaptureFormModal';
import TravelSuggestions from '../components/agenda/TravelSuggestions';

export default function DayView() {
  const { data: date } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const clientStyle = useClientStyle();

  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [formState, setFormState] = useState({ open: false, capture: null, presetClientId: null });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data: payload } = await api.get(`/captures/day/${date}`);
        setDay(payload);
      } catch (err) {
        toast.error(errorMessage(err, 'Não foi possível carregar o dia.'));
      } finally {
        setLoading(false);
      }
    },
    [date, toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([api.get('/clients'), api.get('/team')])
      .then(([clientsRes, teamRes]) => {
        setClients(clientsRes.data);
        setTeam(teamRes.data);
      })
      .catch(() => {});
  }, []);

  useRealtimeEvent(['captures', 'videos'], () => load({ quiet: true }));

  async function toggleDone(capture, done) {
    try {
      await api.patch(`/captures/${capture.id}/done`, { done });
      toast.success(done ? 'Captação concluída.' : 'Captação reaberta.');
      load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível atualizar o status.'));
    }
  }

  async function removeCapture(capture) {
    try {
      await api.delete(`/captures/${capture.id}`);
      toast.success('Captação excluída.');
      setConfirm(null);
      load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir.'));
      setConfirm(null);
    }
  }

  const summary = day?.summary;
  const isToday = date === todayISO();

  return (
    <>
      <PageHeader
        eyebrow={longDate(date)}
        title={weekdayName(date)}
        description={
          summary?.captures_total > 0
            ? `${summary.captures_total} captação(ões) · ${summary.cities.join(' → ')}`
            : 'Nenhuma captação registrada para este dia ainda.'
        }
        actions={
          <>
            <div className="week-nav">
              <button
                type="button"
                className="btn-icon"
                onClick={() => navigate(`/agenda/${shiftDays(date, -1)}`)}
                aria-label="Dia anterior"
              >
                <ChevronLeft size={18} strokeWidth={1.75} />
              </button>
              <span className="week-label">{dayMonth(date)}</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => navigate(`/agenda/${shiftDays(date, 1)}`)}
                aria-label="Próximo dia"
              >
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setFormState({ open: true, capture: null, presetClientId: null })}
            >
              <CalendarPlus size={17} strokeWidth={1.75} />
              Adicionar cliente
            </button>
          </>
        }
      >
        <span className="breadcrumb">
          <Link to={`/agenda?semana=${startOfWeekISO(date)}`}>
            <ArrowLeft size={13} strokeWidth={2} /> Agenda semanal
          </Link>
          {isToday && <span className="badge badge-brand">Hoje</span>}
        </span>
      </PageHeader>

      {loading && !day ? (
        <Loading label="Carregando o dia…" />
      ) : (
        <>
          <div className="day-stats">
            <MetricCard
              value={summary.captures_total}
              label="Captações no dia"
              extra={`${summary.captures_done} concluída(s) · ${summary.captures_pending} pendente(s)`}
              plain
            />
            <MetricCard
              value={summary.cities.length}
              label="Municípios"
              extra={summary.cities.join(', ') || '—'}
              plain
            />
            <MetricCard
              value={summary.videos_total}
              label="Vídeos previstos"
              extra={`${summary.videos_done} concluído(s)${
                summary.videos_estimated > 0 ? ` · estimativa da equipe: ${summary.videos_estimated}` : ''
              }`}
              plain
            />
            <MetricCard value={`${summary.progress}%`} label="Progresso dos vídeos" highlight>
              <ProgressBar
                value={summary.videos_done}
                total={summary.videos_total}
                success={summary.progress === 100}
              />
            </MetricCard>
          </div>

          {summary.cities.length > 0 && (
            <div className={`alert ${summary.multi_city ? 'alert-warning' : 'alert-brand'}`}>
              {summary.multi_city ? (
                <TriangleAlert size={17} strokeWidth={1.75} />
              ) : (
                <Route size={17} strokeWidth={1.75} />
              )}
              <div>
                <strong>Rota do dia: {summary.route}</strong>
                {summary.multi_city && (
                  <p className="mt-8">
                    Há clientes de municípios diferentes neste dia — confira o tempo de deslocamento entre eles.
                  </p>
                )}
              </div>
            </div>
          )}

          {day.captures.length > 1 && (
            <div className="day-timeline" aria-label="Ordem das captações do dia">
              {day.captures.map((capture, index) => (
                <span key={capture.id} className="row gap-6">
                  <span className="timeline-item" style={clientStyle(capture.client_color)}>
                    <span className="timeline-time">{capture.start_time}</span>
                    {capture.client_short_name}
                  </span>
                  {index < day.captures.length - 1 && (
                    <ChevronRight size={14} className="timeline-arrow" aria-hidden="true" />
                  )}
                </span>
              ))}
            </div>
          )}

          <TravelSuggestions
            cities={summary.cities}
            suggestions={day.suggestions}
            onAdd={(client) => setFormState({ open: true, capture: null, presetClientId: client.id })}
          />

          {day.captures.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CalendarDays}
                title="Nenhuma captação neste dia"
                description="Adicione o primeiro cliente para começar o planejamento deste dia."
                action={
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setFormState({ open: true, capture: null, presetClientId: null })}
                  >
                    <CalendarPlus size={17} strokeWidth={1.75} />
                    Adicionar cliente
                  </button>
                }
              />
            </div>
          ) : (
            <div className="day-capture-list">
              {day.captures.map((capture) => (
                <article
                  key={capture.id}
                  className={`day-capture ${capture.done ? 'is-done' : ''}`}
                  style={clientStyle(capture.client_color)}
                >
                  <div className="day-capture-main">
                    <div className="day-capture-title">
                      <button type="button" className="client-open" onClick={() => navigate(`/captacoes/${capture.id}`)}>
                        <ClientAvatar
                          name={capture.client_name}
                          logoUrl={capture.client_logo_url}
                          color={capture.client_color}
                          size="lg"
                        />
                        <span className="col gap-4">
                          <span className="client-name">{capture.client_name}</span>
                          <span className="small muted">{capture.objective || 'Sem objetivo definido'}</span>
                        </span>
                      </button>
                      {Boolean(capture.done) && <span className="badge badge-success">Concluída</span>}
                      {capture.client_capture_type === 'flexivel' && <span className="badge">Captação flexível</span>}
                    </div>

                    <div className="day-capture-info">
                      <span>
                        <Clapperboard size={15} strokeWidth={1.75} />
                        {timeRange(capture.start_time, capture.end_time)}
                      </span>
                      <span>
                        <MapPin size={15} strokeWidth={1.75} />
                        {capture.city}
                        {capture.location ? ` · ${capture.location}` : ''}
                      </span>
                      <span>
                        <Users size={15} strokeWidth={1.75} />
                        {capture.assignees.length > 0 ? (
                          <span className="row gap-6">
                            <span className="row gap-4">
                              {capture.assignees.map((member) => (
                                <MemberAvatar key={member.id} name={member.name} photoUrl={member.photo_url} ring />
                              ))}
                            </span>
                            {capture.assignees.map((member) => member.name).join(', ')}
                          </span>
                        ) : (
                          'Sem responsável definido'
                        )}
                      </span>
                    </div>

                    {capture.notes && <p className="day-capture-notes">{capture.notes}</p>}

                    <div className="row gap-6 row-wrap">
                      <span className="capture-progress">
                        {capture.videos_total > 0 ? (
                          <>
                            <ProgressBar
                              value={capture.videos_done}
                              total={capture.videos_total}
                              success={capture.videos_done === capture.videos_total}
                            />
                            {capture.videos_done} de {capture.videos_total} vídeo(s) concluído(s)
                          </>
                        ) : (
                          <span className="small dim">Nenhum vídeo planejado ainda</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="day-capture-actions">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        autoComplete="off"
                        checked={Boolean(capture.done)}
                        onChange={(event) => toggleDone(capture, event.target.checked)}
                      />
                      Captação concluída
                    </label>

                    <div className="row gap-6">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/captacoes/${capture.id}`)}
                      >
                        <Clapperboard size={14} strokeWidth={1.75} />
                        Roteiros
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setFormState({ open: true, capture, presetClientId: null })}
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                        Editar
                      </button>
                      {(isAdmin || capture.created_by === user?.id) && (
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setConfirm(capture)}
                          aria-label={`Excluir captação de ${capture.client_name}`}
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <CaptureFormModal
        open={formState.open}
        date={date}
        capture={formState.capture}
        presetClientId={formState.presetClientId}
        clients={clients}
        team={team}
        onClose={() => setFormState({ open: false, capture: null, presetClientId: null })}
        onSaved={() => {
          setFormState({ open: false, capture: null, presetClientId: null });
          load({ quiet: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        message={`Excluir a captação de ${confirm?.client_name}?`}
        detail="Os vídeos, roteiros, links e imagens desta captação também serão apagados. Esta ação não pode ser desfeita."
        onConfirm={() => removeCapture(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
