import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Clapperboard, Film, MapPin, Pencil, Plus, Users, CheckCircle2, Clock,
} from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { longDate, timeRange, updatedAtLabel, weekdayName } from '../lib/date';
import { useClientStyle } from '../context/ThemeContext';
import { ClientAvatar, EmptyState, Loading, MemberAvatar, PageHeader, ProgressBar } from '../components/ui';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import CaptureFormModal from '../components/agenda/CaptureFormModal';
import VideoCard from '../components/capture/VideoCard';

export default function CaptureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const clientStyle = useClientStyle();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [editing, setEditing] = useState(false);
  const [confirmVideo, setConfirmVideo] = useState(null);
  const [creating, setCreating] = useState(false);
  const [suggestDone, setSuggestDone] = useState(false);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data: payload } = await api.get(`/captures/${id}`);
        setData(payload);
      } catch (err) {
        toast.error(errorMessage(err, 'Não foi possível carregar a captação.'));
        navigate('/agenda');
      } finally {
        setLoading(false);
      }
    },
    [id, navigate, toast]
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

  async function addVideo() {
    setCreating(true);
    try {
      await api.post('/videos', { capture_id: Number(id) });
      await load({ quiet: true });
      toast.success('Vídeo adicionado.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível adicionar o vídeo.'));
    } finally {
      setCreating(false);
    }
  }

  async function duplicateVideo(video) {
    try {
      await api.post(`/videos/${video.id}/duplicate`);
      await load({ quiet: true });
      toast.success('Vídeo duplicado.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível duplicar.'));
    }
  }

  async function removeVideo(video) {
    try {
      await api.delete(`/videos/${video.id}`);
      setConfirmVideo(null);
      await load({ quiet: true });
      toast.success('Vídeo excluído.');
    } catch (err) {
      setConfirmVideo(null);
      toast.error(errorMessage(err, 'Não foi possível excluir o vídeo.'));
    }
  }

  async function moveVideo(video, direction) {
    const videos = data.videos;
    const index = videos.findIndex((item) => item.id === video.id);
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;

    const order = videos.map((item) => item.id);
    [order[index], order[target]] = [order[target], order[index]];

    // Reordena localmente para a resposta ser imediata.
    const reordered = order.map((videoId, position) => {
      const item = videos.find((entry) => entry.id === videoId);
      return { ...item, number: position + 1 };
    });
    setData((current) => ({ ...current, videos: reordered }));

    try {
      await api.put(`/videos/reorder/${id}`, { ids: order });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível reordenar.'));
      load({ quiet: true });
    }
  }

  /** Recebe o vídeo já atualizado pela API e atualiza só ele na tela. */
  function handleVideoChanged(updated, extra) {
    setData((current) => {
      if (!current) return current;
      const videos = current.videos.map((item) => (item.id === updated.id ? { ...updated, number: item.number } : item));
      const done = videos.filter((item) => item.done).length;
      return {
        ...current,
        videos,
        capture: { ...current.capture, videos_total: videos.length, videos_done: done },
      };
    });
    if (extra?.suggest_capture_done && !data?.capture?.done) setSuggestDone(true);
  }

  async function toggleCaptureDone(done) {
    try {
      const { data: payload } = await api.patch(`/captures/${id}/done`, { done });
      setData((current) => ({ ...current, capture: { ...current.capture, ...payload.capture } }));
      setSuggestDone(false);
      toast.success(done ? 'Captação marcada como concluída.' : 'Captação reaberta.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível atualizar o status.'));
    }
  }

  if (loading && !data) return <Loading label="Carregando a captação…" />;
  if (!data) return null;

  const { capture, videos } = data;
  const doneCount = videos.filter((video) => video.done).length;

  return (
    <>
      <PageHeader
        eyebrow="Planejamento da captação"
        title={capture.client_name}
        description={capture.objective || 'Roteiros, referências e imagens de apoio desta gravação.'}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} strokeWidth={1.75} />
              Editar captação
            </button>
            <button type="button" className="btn" onClick={addVideo} disabled={creating}>
              {creating ? <span className="spinner" aria-hidden="true" /> : <Plus size={17} strokeWidth={2} />}
              Adicionar vídeo
            </button>
          </>
        }
      >
        <span className="breadcrumb">
          <Link to={`/agenda/${capture.date}`}>
            <ArrowLeft size={13} strokeWidth={2} /> {weekdayName(capture.date)}, {longDate(capture.date)}
          </Link>
        </span>
      </PageHeader>

      <section className="capture-hero" style={clientStyle(capture.client_color)}>
        <div className="capture-hero-top">
          <ClientAvatar name={capture.client_name} logoUrl={capture.client_logo_url} color={capture.client_color} size="lg" />
          <div className="capture-hero-title">
            <h1>{capture.client_short_name || capture.client_name}</h1>
            <span className="small muted">
              {capture.city}
              {capture.location ? ` · ${capture.location}` : ''}
            </span>
          </div>
          <div className="row gap-6 row-wrap">
            {capture.done ? (
              <span className="badge badge-success">
                <CheckCircle2 size={13} strokeWidth={1.75} /> Captação concluída
              </span>
            ) : (
              <span className="badge badge-warning">
                <Clock size={13} strokeWidth={1.75} /> Pendente
              </span>
            )}
            {capture.client_capture_type === 'flexivel' && <span className="badge">Captação flexível</span>}
          </div>
        </div>

        <div className="capture-hero-info">
          <span className="info-item">
            <Clapperboard size={15} />
            {weekdayName(capture.date)}, {longDate(capture.date)} · {timeRange(capture.start_time, capture.end_time)}
          </span>
          <span className="info-item">
            <MapPin size={15} />
            {capture.city}
            {capture.location ? ` · ${capture.location}` : ''}
          </span>
          <span className="info-item">
            <Users size={15} strokeWidth={1.75} />
            {capture.assignees.length > 0 ? (
              <>
                {capture.assignees.map((member) => (
                  <MemberAvatar key={member.id} name={member.name} photoUrl={member.photo_url} ring />
                ))}
                {capture.assignees.map((member) => member.name).join(', ')}
              </>
            ) : (
              'Sem responsável definido'
            )}
          </span>
        </div>

        {capture.notes && <p className="capture-hero-notes">{capture.notes}</p>}

        <div className="capture-progress-bar">
          <span className="small strong">
            {doneCount} de {videos.length} vídeo(s) concluído(s)
          </span>
          <ProgressBar value={doneCount} total={videos.length} success={videos.length > 0 && doneCount === videos.length} />
          <label className="checkbox">
            <input type="checkbox" autoComplete="off" checked={Boolean(capture.done)} onChange={(event) => toggleCaptureDone(event.target.checked)} />
            Captação concluída
          </label>
        </div>

        <div className="capture-hero-info" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="tiny muted">
            Criada por {capture.created_by_name || 'equipe'}
            {capture.updated_by_name ? ` · última alteração por ${capture.updated_by_name}` : ''} ·{' '}
            {updatedAtLabel(capture.updated_at)}
          </span>
        </div>
      </section>

      {suggestDone && !capture.done && (
        <div className="alert alert-success">
          <CheckCircle2 size={17} />
          <div className="row row-wrap gap-6">
            <span>Todos os vídeos estão concluídos. Deseja marcar a captação inteira como concluída?</span>
            <button type="button" className="btn btn-sm" onClick={() => toggleCaptureDone(true)}>
              Marcar como concluída
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSuggestDone(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Film}
            title="Nenhum vídeo planejado"
            description="Crie um contêiner para cada vídeo desta captação. Ele pode ter só roteiro, só link de referência, ou os dois."
            action={
              <button type="button" className="btn" onClick={addVideo} disabled={creating}>
                <Plus size={16} />
                Adicionar vídeo
              </button>
            }
          />
        </div>
      ) : (
        <div className="video-list">
          {videos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              index={index}
              total={videos.length}
              onChanged={handleVideoChanged}
              onRemove={setConfirmVideo}
              onMove={moveVideo}
              onDuplicate={duplicateVideo}
            />
          ))}

          <button type="button" className="add-capture-btn" onClick={addVideo} disabled={creating}>
            <Plus size={16} />
            Adicionar outro vídeo
          </button>
        </div>
      )}

      <CaptureFormModal
        open={editing}
        capture={capture}
        date={capture.date}
        clients={clients}
        team={team}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load({ quiet: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmVideo)}
        message={`Excluir o Vídeo ${String(confirmVideo?.number || '').padStart(2, '0')}?`}
        detail="O roteiro, os links e as imagens deste vídeo serão apagados."
        onConfirm={() => removeVideo(confirmVideo)}
        onCancel={() => setConfirmVideo(null)}
      />
    </>
  );
}
