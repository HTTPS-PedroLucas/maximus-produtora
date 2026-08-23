import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { useClientStyle } from '../context/ThemeContext';
import { ClientAvatar, EmptyState, Loading, PageHeader } from '../components/ui';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ClientFormModal from '../components/clients/ClientFormModal';

export default function Clients() {
  const toast = useToast();
  const { isAdmin, workspace } = useAuth();
  const clientStyle = useClientStyle();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ open: false, client: null });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.get('/clients');
        setClients(data);
      } catch (err) {
        toast.error(errorMessage(err, 'Não foi possível carregar os clientes.'));
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent(['clients'], () => load({ quiet: true }));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.short_name, client.city, client.region].some((value) =>
        String(value || '').toLowerCase().includes(term)
      )
    );
  }, [clients, search]);

  async function removeClient(client, force = false) {
    try {
      await api.delete(`/clients/${client.id}${force ? '?force=1' : ''}`);
      toast.success('Cliente excluído.');
      setConfirm(null);
      load({ quiet: true });
    } catch (err) {
      const captures = err?.response?.data?.captures;
      if (captures) {
        // Cliente com histórico: oferecemos desativar em vez de apagar tudo.
        setConfirm({ ...client, captures, blocked: true });
        return;
      }
      toast.error(errorMessage(err, 'Não foi possível excluir.'));
      setConfirm(null);
    }
  }

  async function deactivate(client) {
    try {
      await api.put(`/clients/${client.id}`, { ...client, active: false });
      toast.success(`${client.short_name} foi desativado.`);
      setConfirm(null);
      load({ quiet: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível desativar.'));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Clientes"
        description="Cor de identificação, município e tipo de captação de cada cliente da Máximus."
        actions={
          <>
            <div className="search-field">
              <label className="sr-only" htmlFor="client-search">
                Buscar cliente
              </label>
              <Search size={15} strokeWidth={1.75} />
              <input
                id="client-search"
                className="input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou município"
              />
            </div>
            {isAdmin && (
              <button type="button" className="btn" onClick={() => setForm({ open: true, client: null })}>
                <Plus size={17} strokeWidth={2} />
                Novo cliente
              </button>
            )}
          </>
        }
      />

      {loading ? (
        <Loading label="Carregando clientes…" />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={
              search
                ? 'Tente outro termo de busca.'
                : 'Cadastre os clientes da Máximus para começar a montar a agenda semanal.'
            }
            action={
              isAdmin && !search ? (
                <button type="button" className="btn" onClick={() => setForm({ open: true, client: null })}>
                  <Plus size={16} />
                  Cadastrar cliente
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
                  <th>Cliente</th>
                  <th>Município</th>
                  <th>Região</th>
                  <th>Captação</th>
                  <th>Status</th>
                  {isAdmin && <th aria-label="Ações" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className={client.active ? '' : 'is-inactive'} style={clientStyle(client.color)}>
                    <td>
                      <span className="client-cell">
                        <ClientAvatar name={client.name} logoUrl={client.logo_url} color={client.color} />
                        <span className="col gap-4">
                          <span className="strong">{client.name}</span>
                          <span className="tiny muted">{client.short_name}</span>
                        </span>
                      </span>
                    </td>
                    <td>{client.city}</td>
                    <td className="muted">{client.region || '—'}</td>
                    <td>
                      <span className={`badge ${client.capture_type === 'flexivel' ? 'badge-accent' : ''}`}>
                        {client.capture_type === 'flexivel' ? 'Flexível' : 'Recorrente'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${client.active ? 'badge-success' : ''}`}>
                        {client.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setForm({ open: true, client })}
                            aria-label={`Editar ${client.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setConfirm(client)}
                            aria-label={`Excluir ${client.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-list">
            {filtered.map((client) => (
              <div key={client.id} className="list-card" style={clientStyle(client.color)}>
                <div className="list-card-head">
                  <ClientAvatar name={client.name} logoUrl={client.logo_url} color={client.color} />
                  <div className="grow">
                    <div className="strong">{client.name}</div>
                    <div className="tiny muted">
                      {client.city}
                      {client.region ? ` · ${client.region}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${client.active ? 'badge-success' : ''}`}>
                    {client.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="row gap-6 row-wrap">
                  <span className={`badge ${client.capture_type === 'flexivel' ? 'badge-accent' : ''}`}>
                    {client.capture_type === 'flexivel' ? 'Flexível' : 'Recorrente'}
                  </span>
                </div>
                {isAdmin && (
                  <div className="list-card-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ open: true, client })}>
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(client)}>
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <ClientFormModal
        open={form.open}
        client={form.client}
        defaultRegion={workspace?.home_region}
        onClose={() => setForm({ open: false, client: null })}
        onSaved={() => {
          setForm({ open: false, client: null });
          load({ quiet: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.blocked ? 'Cliente com histórico' : 'Excluir cliente'}
        message={
          confirm?.blocked
            ? `${confirm?.name} tem ${confirm?.captures} captação(ões) registrada(s).`
            : `Excluir ${confirm?.name}?`
        }
        detail={
          confirm?.blocked
            ? 'Recomendamos desativar o cliente: ele sai da agenda e das sugestões, mas o histórico é preservado.'
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel={confirm?.blocked ? 'Desativar cliente' : 'Excluir'}
        danger={!confirm?.blocked}
        onConfirm={() => (confirm?.blocked ? deactivate(confirm) : removeClient(confirm))}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
