import { useState } from 'react';
import { Plus, Route } from 'lucide-react';
import { useClientStyle } from '../../context/ThemeContext';
import { ClientAvatar } from '../ui';
import { BrandWatermark } from '../brand';

/**
 * Sugestão de aproveitamento de deslocamento. Nunca agenda sozinho:
 * apenas oferece um botão rápido para incluir o cliente no mesmo dia.
 */
export default function TravelSuggestions({ cities = [], suggestions = [], onAdd, compact = false }) {
  const clientStyle = useClientStyle();
  const [showRegion, setShowRegion] = useState(false);
  if (suggestions.length === 0) return null;

  const sameCity = suggestions.filter((client) => client.same_city);
  const sameRegion = suggestions.filter((client) => !client.same_city);
  const cityLabel = cities.join(', ');
  const visible = showRegion ? [...sameCity, ...sameRegion] : sameCity;

  if (visible.length === 0 && sameRegion.length === 0) return null;

  return (
    <div className="suggestion-box">
      <BrandWatermark />
      <h4>
        <Route size={17} strokeWidth={1.75} />
        Aproveitar o deslocamento
      </h4>
      <p>
        {sameCity.length > 0
          ? `Você já terá uma captação em ${cityLabel}. Deseja aproveitar o deslocamento e adicionar outro cliente da região?`
          : `Nenhum outro cliente ativo em ${cityLabel}. Veja opções da mesma região.`}
      </p>

      <div className="suggestion-list">
        {(visible.length > 0 ? visible : []).map((client) => (
          <button
            key={client.id}
            type="button"
            className="suggestion-chip"
            style={clientStyle(client.color)}
            onClick={() => onAdd(client)}
            title={client.reason}
          >
            <ClientAvatar name={client.name} logoUrl={client.logo_url} color={client.color} size="sm" />
            {compact ? client.short_name : client.name}
            <span className="chip-city">{client.city}</span>
            <Plus size={14} />
          </button>
        ))}
      </div>

      {sameRegion.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRegion((value) => !value)}>
          {showRegion ? 'Mostrar só o município' : `Ver ${sameRegion.length} cliente(s) da mesma região`}
        </button>
      )}
    </div>
  );
}
