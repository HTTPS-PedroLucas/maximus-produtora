import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert, Save } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Field, MemberAvatar } from '../ui';
import Modal from '../ui/Modal';

const EMPTY = {
  client_id: '',
  date: '',
  start_time: '09:00',
  end_time: '',
  city: '',
  location: '',
  objective: '',
  notes: '',
  estimated_videos: '',
  assignee_ids: [],
};

/**
 * Formulário de agendamento de captação. A localidade é preenchida a partir
 * do cliente e pode ser alterada. Conflitos de escala aparecem como aviso,
 * sem apagar nada do que já foi digitado.
 */
export default function CaptureFormModal({ open, date, capture, clients, team, presetClientId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [busy, setBusy] = useState(false);
  const cityTouched = useRef(false);

  const activeClients = useMemo(() => clients.filter((client) => client.active || client.id === capture?.client_id), [clients, capture]);
  const activeTeam = useMemo(
    () => team.filter((member) => member.active || (capture?.assignees || []).some((assignee) => assignee.id === member.id)),
    [team, capture]
  );

  // Preenche o formulário ao abrir (novo agendamento ou edição).
  useEffect(() => {
    if (!open) return;
    cityTouched.current = Boolean(capture);
    setErrors({});
    setConflicts([]);

    if (capture) {
      setForm({
        client_id: String(capture.client_id),
        date: capture.date,
        start_time: capture.start_time,
        end_time: capture.end_time || '',
        city: capture.city || '',
        location: capture.location || '',
        objective: capture.objective || '',
        notes: capture.notes || '',
        estimated_videos: capture.estimated_videos ?? '',
        assignee_ids: (capture.assignees || []).map((member) => member.id),
      });
      return;
    }

    const client = presetClientId ? clients.find((item) => item.id === Number(presetClientId)) : null;
    setForm({
      ...EMPTY,
      date: date || '',
      client_id: client ? String(client.id) : '',
      city: client?.city || '',
      location: client?.address || '',
    });
  }, [open, capture, date, presetClientId, clients]);

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(form.client_id)) || null,
    [clients, form.client_id]
  );

  // Verifica conflito de escala enquanto a equipe preenche o formulário.
  useEffect(() => {
    if (!open || !form.date || !form.start_time || form.assignee_ids.length === 0) {
      setConflicts([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .post('/captures/check-conflicts', {
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time || null,
          assignee_ids: form.assignee_ids,
          exclude_id: capture?.id || null,
        })
        .then(({ data }) => setConflicts(data.conflicts || []))
        .catch(() => setConflicts([]));
    }, 400);

    return () => clearTimeout(timer);
  }, [open, form.date, form.start_time, form.end_time, form.assignee_ids, capture]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleClientChange(value) {
    const client = clients.find((item) => String(item.id) === String(value));
    setForm((current) => ({
      ...current,
      client_id: value,
      // A localidade vem do cliente, mas continua editável.
      city: cityTouched.current && current.city ? current.city : client?.city || '',
      location: current.location || client?.address || '',
    }));
    setErrors((current) => ({ ...current, client_id: undefined }));
  }

  function toggleAssignee(id) {
    setForm((current) => ({
      ...current,
      assignee_ids: current.assignee_ids.includes(id)
        ? current.assignee_ids.filter((item) => item !== id)
        : [...current.assignee_ids, id],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});

    const payload = {
      ...form,
      client_id: Number(form.client_id),
      end_time: form.end_time || null,
      estimated_videos: form.estimated_videos === '' ? null : Number(form.estimated_videos),
    };

    try {
      const { data } = capture
        ? await api.put(`/captures/${capture.id}`, payload)
        : await api.post('/captures', payload);

      toast.success(capture ? 'Captação atualizada.' : 'Captação adicionada à agenda.');
      if (data.conflicts?.length > 0) {
        toast.warning(`Atenção: ${data.conflicts[0].message}`);
      }
      onSaved?.(data);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err, 'Não foi possível salvar a captação.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={capture ? 'Editar captação' : 'Nova captação'}
      description={capture ? `${capture.client_name}` : 'Adicione um cliente a este dia da agenda.'}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          {conflicts.length > 0 && (
            <span className="footer-note" style={{ color: 'var(--warning)' }}>
              {conflicts.length} conflito(s) de escala — a captação ainda pode ser salva.
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="capture-form" className="btn" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Save size={16} />}
            {busy ? 'Salvando…' : 'Salvar captação'}
          </button>
        </>
      }
    >
      <form id="capture-form" className="modal-body" onSubmit={handleSubmit} noValidate>
        {conflicts.length > 0 && (
          <div className="alert alert-warning" role="alert">
            <TriangleAlert size={17} />
            <div>
              <strong>Conflito de horário</strong>
              {conflicts.map((conflict) => (
                <p key={`${conflict.member_id}-${conflict.capture_id}`}>{conflict.message}</p>
              ))}
              <p className="tiny mt-8">Se for intencional (equipes diferentes), pode salvar normalmente.</p>
            </div>
          </div>
        )}

        <div className="form-grid">
          <Field label="Cliente" error={errors.client_id} className="span-2" htmlFor="capture-client">
            <select
              id="capture-client"
              className="select"
              value={form.client_id}
              onChange={(event) => handleClientChange(event.target.value)}
              aria-invalid={Boolean(errors.client_id)}
              required
            >
              <option value="">Selecione o cliente…</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} — {client.city}
                  {client.capture_type === 'flexivel' ? ' (flexível)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Data" error={errors.date} htmlFor="capture-date">
            <input
              id="capture-date"
              type="date"
              className="input"
              value={form.date}
              onChange={(event) => update('date', event.target.value)}
              aria-invalid={Boolean(errors.date)}
              required
            />
          </Field>

          <div className="form-grid" style={{ gap: 10 }}>
            <Field label="Horário inicial" error={errors.start_time} htmlFor="capture-start">
              <input
                id="capture-start"
                type="time"
                className="input"
                value={form.start_time}
                onChange={(event) => update('start_time', event.target.value)}
                aria-invalid={Boolean(errors.start_time)}
                required
              />
            </Field>
            <Field label="Horário final" hint="Opcional" error={errors.end_time} htmlFor="capture-end">
              <input
                id="capture-end"
                type="time"
                className="input"
                value={form.end_time}
                onChange={(event) => update('end_time', event.target.value)}
                aria-invalid={Boolean(errors.end_time)}
              />
            </Field>
          </div>

          <Field
            label="Município"
            hint={selectedClient ? `Preenchido a partir de ${selectedClient.short_name}` : 'Preenchido pelo cliente'}
            error={errors.city}
            htmlFor="capture-city"
          >
            <input
              id="capture-city"
              className="input"
              value={form.city}
              onChange={(event) => {
                cityTouched.current = true;
                update('city', event.target.value);
              }}
              placeholder="Ex.: Banabuiú"
            />
          </Field>

          <Field label="Local / endereço" hint="Opcional" error={errors.location} htmlFor="capture-location">
            <input
              id="capture-location"
              className="input"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              placeholder="Ex.: Loja do centro"
            />
          </Field>

          <Field label="Quem irá gravar" className="span-2" error={errors.assignee_ids}>
            <div className="row row-wrap gap-6">
              {activeTeam.length === 0 && <span className="small muted">Cadastre a equipe para escalar responsáveis.</span>}
              {activeTeam.map((member) => {
                const checked = form.assignee_ids.includes(member.id);
                return (
                  <label key={member.id} className={`assignee-chip ${checked ? 'is-selected' : ''}`}>
                    <input type="checkbox" autoComplete="off" checked={checked} onChange={() => toggleAssignee(member.id)} />
                    <MemberAvatar name={member.name} photoUrl={member.photo_url} ring={checked} />
                    {member.name}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Objetivo da captação" hint="Opcional" error={errors.objective} className="span-2" htmlFor="capture-objective">
            <input
              id="capture-objective"
              className="input"
              value={form.objective}
              onChange={(event) => update('objective', event.target.value)}
              placeholder="Ex.: Ofertas da semana e institucional"
            />
          </Field>

          <Field label="Quantidade estimada de vídeos" hint="Opcional" error={errors.estimated_videos} htmlFor="capture-estimated">
            <input
              id="capture-estimated"
              type="number"
              min="0"
              max="99"
              className="input"
              value={form.estimated_videos}
              onChange={(event) => update('estimated_videos', event.target.value)}
              placeholder="Ex.: 5"
            />
          </Field>

          <Field label="Observações" hint="Opcional" error={errors.notes} className="span-2" htmlFor="capture-notes">
            <textarea
              id="capture-notes"
              className="textarea"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Combinados, contato no local, materiais necessários…"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
