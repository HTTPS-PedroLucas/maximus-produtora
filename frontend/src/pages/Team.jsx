import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, UserCog, Save, ShieldCheck } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { updatedAtLabel } from '../lib/date';
import { EmptyState, Field, ImageField, Loading, MemberAvatar, PageHeader } from '../components/ui';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const EMPTY = { name: '', role_title: '', email: '', photo_url: '', active: true };

function MemberFormModal({ open, member, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      member
        ? {
            name: member.name,
            role_title: member.role_title || '',
            email: member.email || '',
            photo_url: member.photo_url || '',
            active: Boolean(member.active),
          }
        : EMPTY
    );
  }, [open, member]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = member ? await api.put(`/team/${member.id}`, form) : await api.post('/team', form);
      toast.success(member ? 'Membro atualizado.' : 'Membro adicionado.');
      onSaved?.(data);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={member ? 'Editar membro' : 'Novo membro da equipe'}
      description="Membros ativos aparecem no campo “Quem irá gravar”."
      onClose={busy ? undefined : onClose}
      size="sm"
      footer={
        <>
          {member && (
            <span className="footer-note">
              Criado por {member.created_by_name || 'equipe'} · {updatedAtLabel(member.updated_at)}
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="member-form" className="btn" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Save size={16} />}
            Salvar
          </button>
        </>
      }
    >
      <form id="member-form" className="modal-body" onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={errors.name} htmlFor="member-name">
          <input
            id="member-name"
            className="input"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            required
            autoFocus
          />
        </Field>

        <Field label="Função" hint="Ex.: cinegrafista, social media" error={errors.role_title} htmlFor="member-role">
          <input
            id="member-role"
            className="input"
            value={form.role_title}
            onChange={(event) => update('role_title', event.target.value)}
          />
        </Field>

        <Field label="E-mail" hint="Opcional" error={errors.email} htmlFor="member-email">
          <input
            id="member-email"
            type="email"
            className="input"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
          />
        </Field>

        <Field label="Foto" hint="Sem foto, mostramos as iniciais">
          <ImageField
            value={form.photo_url}
            onChange={(value) => update('photo_url', value)}
            bucket="avatars"
            fallbackName={form.name}
            label="Enviar foto"
          />
        </Field>

        <label className="checkbox">
          <input type="checkbox" autoComplete="off" checked={form.active} onChange={(event) => update('active', event.target.checked)} />
          Ativo (pode ser escalado nas gravações)
        </label>
      </form>
    </Modal>
  );
}

export default function Team() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ open: false, member: null });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.get('/team');
        setMembers(data);
      } catch (err) {
        toast.error(errorMessage(err, 'Não foi possível carregar a equipe.'));
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent(['team'], () => load({ quiet: true }));

  async function removeMember(member) {
    try {
      await api.delete(`/team/${member.id}`);
      toast.success('Membro removido.');
      setConfirm(null);
      load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível remover.'));
      setConfirm(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Time Máximus"
        title="Equipe"
        description="Quem pode ser escalado como responsável pelas gravações."
        actions={
          isAdmin ? (
            <button type="button" className="btn" onClick={() => setForm({ open: true, member: null })}>
              <Plus size={17} strokeWidth={2} />
              Novo membro
            </button>
          ) : null
        }
      />

      {loading ? (
        <Loading label="Carregando a equipe…" />
      ) : members.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserCog}
            title="Nenhum membro cadastrado"
            description="Cadastre quem grava para poder escalar responsáveis nas captações."
            action={
              isAdmin ? (
                <button type="button" className="btn" onClick={() => setForm({ open: true, member: null })}>
                  <Plus size={16} />
                  Adicionar membro
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Membro</th>
                  <th>Função</th>
                  <th>E-mail</th>
                  <th>Acesso</th>
                  <th>Status</th>
                  {isAdmin && <th aria-label="Ações" />}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className={member.active ? '' : 'is-inactive'}>
                    <td>
                      <span className="client-cell">
                        <MemberAvatar name={member.name} photoUrl={member.photo_url} size="md" />
                        <span className="strong">{member.name}</span>
                      </span>
                    </td>
                    <td className="muted">{member.role_title || '—'}</td>
                    <td className="muted">{member.email || member.profile_email || '—'}</td>
                    <td>
                      {member.profile_id ? (
                        <span className="badge badge-accent">
                          <ShieldCheck size={12} />
                          {member.profile_role === 'admin' ? 'Administrador' : 'Equipe'}
                        </span>
                      ) : (
                        <span className="badge">Sem login</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${member.active ? 'badge-success' : ''}`}>
                        {member.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setForm({ open: true, member })}
                            aria-label={`Editar ${member.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          {!member.profile_id && (
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setConfirm(member)}
                              aria-label={`Remover ${member.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-list">
            {members.map((member) => (
              <div key={member.id} className="list-card">
                <div className="list-card-head">
                  <MemberAvatar name={member.name} photoUrl={member.photo_url} size="md" />
                  <div className="grow">
                    <div className="strong">{member.name}</div>
                    <div className="tiny muted">{member.role_title || 'Sem função definida'}</div>
                  </div>
                  <span className={`badge ${member.active ? 'badge-success' : ''}`}>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {isAdmin && (
                  <div className="list-card-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ open: true, member })}>
                      <Pencil size={14} />
                      Editar
                    </button>
                    {!member.profile_id && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(member)}>
                        <Trash2 size={14} />
                        Remover
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <MemberFormModal
        open={form.open}
        member={form.member}
        onClose={() => setForm({ open: false, member: null })}
        onSaved={() => {
          setForm({ open: false, member: null });
          load({ quiet: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        message={`Remover ${confirm?.name} da equipe?`}
        detail="Se a pessoa já estiver escalada em captações, prefira desativá-la para preservar o histórico."
        onConfirm={() => removeMember(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
