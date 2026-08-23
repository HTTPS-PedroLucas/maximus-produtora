import { FilterX } from 'lucide-react';

/** Filtros da agenda: cliente, responsável, município e status. */
export default function AgendaFilters({ filters, onChange, clients, team, cities }) {
  const hasFilters = Object.values(filters).some(Boolean);

  function update(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="filters">
      <label className="sr-only" htmlFor="filter-client">Filtrar por cliente</label>
      <select
        id="filter-client"
        className="select"
        value={filters.client_id || ''}
        onChange={(event) => update('client_id', event.target.value)}
      >
        <option value="">Todos os clientes</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-member">Filtrar por responsável</label>
      <select
        id="filter-member"
        className="select"
        value={filters.member_id || ''}
        onChange={(event) => update('member_id', event.target.value)}
      >
        <option value="">Todos os responsáveis</option>
        {team.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-city">Filtrar por município</label>
      <select
        id="filter-city"
        className="select"
        value={filters.city || ''}
        onChange={(event) => update('city', event.target.value)}
      >
        <option value="">Todos os municípios</option>
        {cities.map((city) => (
          <option key={city.city} value={city.city}>
            {city.city}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-status">Filtrar por status</label>
      <select
        id="filter-status"
        className="select"
        value={filters.status || ''}
        onChange={(event) => update('status', event.target.value)}
      >
        <option value="">Todos os status</option>
        <option value="pendente">Pendentes</option>
        <option value="concluido">Concluídas</option>
      </select>

      {hasFilters && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange({ client_id: '', member_id: '', city: '', status: '' })}
        >
          <FilterX size={14} />
          Limpar
        </button>
      )}
    </div>
  );
}
