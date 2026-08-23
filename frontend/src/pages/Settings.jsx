import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Moon, Plus, Save, ShieldCheck, Sun, UserPlus } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { useTheme } from '../context/ThemeContext';
import { updatedAtLabel } from '../lib/date';
import { Field, ImageField, Loading, MemberAvatar, PageHeader, SectionHeader } from '../components/ui';
import Modal from '../components/ui/Modal';

const EMPTY_USER = { name: '', email: '', password: '', role: 'member', role_title: '' };

const THEME_OPTIONS = [
  { value: 'dark', label: 'Escuro', icon: Moon, hint: 'Padrão da Máximus — ideal para o dia a dia da produção.' },
  { value: 'light', label: 'Claro', icon: Sun, hint: 'Melhor em ambientes muito iluminados e em apresentações.' },
];

function UserFormModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_USER);
      setErrors({});
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/users', form);
      toast.success('Acesso criado. Avise a pessoa para trocar a senha no primeiro login.');
      onSaved?.();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err, 'Não foi possível criar o acesso.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Novo acesso"
      description="A pessoa entra com e-mail e senha e já pode ser escalada nas gravações."
      onClose={busy ? undefined : onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="user-form" className="btn" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <UserPlus size={16} />}
            Criar acesso
          </button>
        </>
      }
    >
      <form id="user-form" className="modal-body" onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={errors.name} htmlFor="user-name">
          <input
            id="user-name"
            className="input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="E-mail" error={errors.email} htmlFor="user-email">
          <input
            id="user-email"
            type="email"
            className="input"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </Field>
        <Field label="Senha provisória" hint="Mínimo de 6 caracteres" error={errors.password} htmlFor="user-password">
          <input
            id="user-password"
            type="text"
            className="input"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </Field>
        <Field label="Função na equipe" hint="Opcional" error={errors.role_title} htmlFor="user-role-title">
          <input
            id="user-role-title"
            className="input"
            value={form.role_title}
            onChange={(event) => setForm({ ...form, role_title: event.target.value })}
            placeholder="Ex.: cinegrafista"
          />
        </Field>
        <Field label="Nível de acesso" error={errors.role} htmlFor="user-role">
          <select
            id="user-role"
            className="select"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="member">Membro da equipe — cria e edita captações e vídeos</option>
            <option value="admin">Administrador — também gerencia clientes, acessos e configurações</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export default function Settings() {
  const toast = useToast();
  const { user, workspace, isAdmin, setUser, setWorkspace } = useAuth();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState({ name: '', avatar_url: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', home_city: '', home_region: '' });
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userModal, setUserModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name, avatar_url: user.avatar_url || '' });
  }, [user]);

  useEffect(() => {
    if (workspace) {
      setWorkspaceForm({
        name: workspace.name,
        home_city: workspace.home_city || '',
        home_region: workspace.home_region || '',
      });
    }
  }, [workspace]);

  const load = useCallback(async () => {
    try {
      const requests = [api.get('/workspace/activity', { params: { limit: 20 } })];
      if (isAdmin) requests.push(api.get('/users'));
      const [activityRes, usersRes] = await Promise.all(requests);
      setActivity(activityRes.data);
      if (usersRes) setUsers(usersRes.data);
    } catch {
      /* silencioso: a tela continua utilizável */
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent(['team', 'workspace', 'clients', 'captures', 'videos'], () => load());

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/me', profile);
      setUser(data.user);
      toast.success('Perfil atualizado.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar o perfil.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      await api.post('/auth/change-password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Senha alterada.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível alterar a senha.'));
    }
  }

  async function saveWorkspace(event) {
    event.preventDefault();
    setSavingWorkspace(true);
    try {
      const { data } = await api.put('/workspace', workspaceForm);
      setWorkspace(data);
      toast.success('Configurações salvas.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar.'));
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function updateUser(target, changes) {
    try {
      await api.put(`/users/${target.id}`, { name: target.name, role: target.role, active: target.active, ...changes });
      toast.success('Acesso atualizado.');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível atualizar o acesso.'));
    }
  }

  async function resetPassword(target) {
    const password = window.prompt(`Nova senha para ${target.name} (mínimo 6 caracteres):`);
    if (!password) return;
    try {
      await api.post(`/users/${target.id}/reset-password`, { password });
      toast.success('Senha redefinida.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível redefinir a senha.'));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Ajustes"
        title="Configurações"
        description="Seu perfil, dados da produtora e acessos da equipe."
      />

      <div className="settings-grid">
        <section className="card card-pad settings-section" style={{ gridColumn: '1 / -1' }}>
          <SectionHeader
            title="Aparência"
            description="Escolha como o sistema aparece neste dispositivo. A preferência fica salva só para você."
          />

          <div className="theme-options" role="radiogroup" aria-label="Tema da interface">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={theme === option.value}
                className={`theme-option ${theme === option.value ? 'is-selected' : ''}`}
                onClick={() => setTheme(option.value)}
              >
                <span className={`theme-preview theme-preview-${option.value}`} aria-hidden="true">
                  <span className="theme-preview-bar" />
                  <span className="theme-preview-body">
                    <span className="theme-preview-line" />
                    <span className="theme-preview-line short" />
                  </span>
                </span>
                <span className="theme-option-label">
                  <option.icon size={16} strokeWidth={1.75} />
                  <strong>{option.label}</strong>
                  {theme === option.value && <Check size={15} strokeWidth={2} className="theme-check" />}
                </span>
                <span className="theme-option-hint">{option.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card card-pad settings-section">
          <SectionHeader title="Meu perfil" description="Como seu nome aparece para o restante da equipe." />

          <form className="settings-section" onSubmit={saveProfile}>
            <Field label="Nome" htmlFor="profile-name">
              <input
                id="profile-name"
                className="input"
                value={profile.name}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                required
              />
            </Field>
            <Field label="Foto">
              <ImageField
                value={profile.avatar_url}
                onChange={(value) => setProfile({ ...profile, avatar_url: value })}
                bucket="avatars"
                fallbackName={profile.name}
                label="Enviar foto"
              />
            </Field>
            <div className="row">
              <span className="badge">
                <ShieldCheck size={12} />
                {user?.role === 'admin' ? 'Administrador' : 'Membro da equipe'}
              </span>
              <span className="small muted">{user?.email}</span>
            </div>
            <button type="submit" className="btn" disabled={savingProfile}>
              {savingProfile ? <span className="spinner" aria-hidden="true" /> : <Save size={16} />}
              Salvar perfil
            </button>
          </form>

          <hr className="divider" />

          <form className="settings-section" onSubmit={changePassword}>
            <h3 className="row gap-6">
              <KeyRound size={15} />
              Alterar senha
            </h3>
            <Field label="Senha atual" htmlFor="current-password">
              <input
                id="current-password"
                type="password"
                className="input"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                required
              />
            </Field>
            <Field label="Nova senha" hint="Mínimo de 6 caracteres" htmlFor="new-password">
              <input
                id="new-password"
                type="password"
                className="input"
                value={passwords.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                required
              />
            </Field>
            <button type="submit" className="btn btn-secondary">
              Alterar senha
            </button>
          </form>
        </section>

        {isAdmin && (
          <section className="card card-pad settings-section">
            <SectionHeader
              title="Produtora"
              description="Sede usada como referência nas rotas e sugestões de deslocamento."
            />

            <form className="settings-section" onSubmit={saveWorkspace}>
              <Field label="Nome da produtora" htmlFor="workspace-name">
                <input
                  id="workspace-name"
                  className="input"
                  value={workspaceForm.name}
                  onChange={(event) => setWorkspaceForm({ ...workspaceForm, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Município sede" htmlFor="workspace-city">
                <input
                  id="workspace-city"
                  className="input"
                  value={workspaceForm.home_city}
                  onChange={(event) => setWorkspaceForm({ ...workspaceForm, home_city: event.target.value })}
                  required
                />
              </Field>
              <Field label="Região padrão" hint="Usada como sugestão ao cadastrar clientes" htmlFor="workspace-region">
                <input
                  id="workspace-region"
                  className="input"
                  value={workspaceForm.home_region}
                  onChange={(event) => setWorkspaceForm({ ...workspaceForm, home_region: event.target.value })}
                />
              </Field>
              <Field label="Fuso horário">
                <input className="input" value={workspace?.timezone || 'America/Fortaleza'} disabled readOnly />
              </Field>
              <button type="submit" className="btn" disabled={savingWorkspace}>
                {savingWorkspace ? <span className="spinner" aria-hidden="true" /> : <Save size={16} />}
                Salvar configurações
              </button>
            </form>
          </section>
        )}

        {isAdmin && (
          <section className="card card-pad settings-section" style={{ gridColumn: '1 / -1' }}>
            <div className="row-between">
              <SectionHeader title="Acessos" description="Quem pode entrar no sistema e com qual nível." />
              <button type="button" className="btn" onClick={() => setUserModal(true)}>
                <Plus size={16} />
                Novo acesso
              </button>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Nível</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className={item.active ? '' : 'is-inactive'}>
                      <td>
                        <span className="client-cell">
                          <MemberAvatar name={item.name} photoUrl={item.avatar_url} size="md" />
                          <span className="strong">{item.name}</span>
                        </span>
                      </td>
                      <td className="muted">{item.email}</td>
                      <td>
                        <select
                          className="select"
                          style={{ maxWidth: 150, padding: '5px 26px 5px 8px', fontSize: '0.82rem' }}
                          value={item.role}
                          onChange={(event) => updateUser(item, { role: event.target.value })}
                          aria-label={`Nível de acesso de ${item.name}`}
                        >
                          <option value="member">Equipe</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            autoComplete="off"
                            checked={Boolean(item.active)}
                            onChange={(event) => updateUser(item, { active: event.target.checked })}
                          />
                          {item.active ? 'Ativo' : 'Inativo'}
                        </label>
                      </td>
                      <td>
                        <span className="row-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetPassword(item)}>
                            <KeyRound size={14} />
                            Redefinir senha
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-list">
              {users.map((item) => (
                <div key={item.id} className="list-card">
                  <div className="list-card-head">
                    <MemberAvatar name={item.name} photoUrl={item.avatar_url} size="md" />
                    <div className="grow">
                      <div className="strong">{item.name}</div>
                      <div className="tiny muted">{item.email}</div>
                    </div>
                    <span className={`badge ${item.role === 'admin' ? 'badge-accent' : ''}`}>
                      {item.role === 'admin' ? 'Admin' : 'Equipe'}
                    </span>
                  </div>
                  <div className="list-card-actions">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        autoComplete="off"
                        checked={Boolean(item.active)}
                        onChange={(event) => updateUser(item, { active: event.target.checked })}
                      />
                      Ativo
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetPassword(item)}>
                      <KeyRound size={14} />
                      Redefinir senha
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card card-pad settings-section" style={{ gridColumn: '1 / -1' }}>
          <div>
            <SectionHeader title="Atividade recente" description="Quem alterou o quê no planejamento da equipe." />
          </div>

          {loading ? (
            <Loading label="Carregando atividade…" />
          ) : activity.length === 0 ? (
            <p className="small muted">Nenhuma atividade registrada ainda.</p>
          ) : (
            <div>
              {activity.map((item) => (
                <div className="activity-item" key={item.id}>
                  <span className="grow">{item.description}</span>
                  <time dateTime={item.created_at}>{updatedAtLabel(item.created_at)}</time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <UserFormModal
        open={userModal}
        onClose={() => setUserModal(false)}
        onSaved={() => {
          setUserModal(false);
          load();
        }}
      />
    </>
  );
}
