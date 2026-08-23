import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_COLOR } from '../../lib/colors';
import { updatedAtLabel } from '../../lib/date';
import { ColorPicker, Field, ImageField } from '../ui';
import Modal from '../ui/Modal';

const EMPTY = {
  name: '',
  short_name: '',
  logo_url: '',
  color: DEFAULT_COLOR,
  city: '',
  region: '',
  address: '',
  capture_type: 'recorrente',
  notes: '',
  active: true,
};

export default function ClientFormModal({ open, client, defaultRegion, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      client
        ? {
            name: client.name,
            short_name: client.short_name,
            logo_url: client.logo_url || '',
            color: client.color,
            city: client.city,
            region: client.region || '',
            address: client.address || '',
            capture_type: client.capture_type,
            notes: client.notes || '',
            active: Boolean(client.active),
          }
        : { ...EMPTY, region: defaultRegion || '' }
    );
  }, [open, client, defaultRegion]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});

    // O nome curto é o que aparece na lousa; se vier vazio, usamos o nome.
    const payload = { ...form, short_name: form.short_name.trim() || form.name.trim().slice(0, 40) };

    try {
      const { data } = client ? await api.put(`/clients/${client.id}`, payload) : await api.post('/clients', payload);
      toast.success(client ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      onSaved?.(data);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err, 'Não foi possível salvar o cliente.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={client ? 'Editar cliente' : 'Novo cliente'}
      description="A cor escolhida identifica o cliente na agenda semanal."
      onClose={busy ? undefined : onClose}
      footer={
        <>
          {client && (
            <span className="footer-note">
              Criado por {client.created_by_name || 'equipe'}
              {client.updated_by_name ? ` · alterado por ${client.updated_by_name}` : ''} ·{' '}
              {updatedAtLabel(client.updated_at)}
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="client-form" className="btn" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Save size={16} />}
            {busy ? 'Salvando…' : 'Salvar cliente'}
          </button>
        </>
      }
    >
      <form id="client-form" className="modal-body" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <Field label="Nome" error={errors.name} className="span-2" htmlFor="client-name">
            <input
              id="client-name"
              className="input"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              aria-invalid={Boolean(errors.name)}
              placeholder="Ex.: Drogaria Bem Estar"
              required
              autoFocus
            />
          </Field>

          <Field label="Nome curto" hint="Como aparece na agenda" error={errors.short_name} htmlFor="client-short">
            <input
              id="client-short"
              className="input"
              value={form.short_name}
              onChange={(event) => update('short_name', event.target.value)}
              placeholder="Ex.: Bem Estar"
            />
          </Field>

          <Field label="Tipo de captação" error={errors.capture_type} htmlFor="client-type">
            <select
              id="client-type"
              className="select"
              value={form.capture_type}
              onChange={(event) => update('capture_type', event.target.value)}
            >
              <option value="recorrente">Recorrente (dia fixo)</option>
              <option value="flexivel">Flexível (sem dia fixo)</option>
            </select>
          </Field>

          <Field label="Município" error={errors.city} htmlFor="client-city">
            <input
              id="client-city"
              className="input"
              value={form.city}
              onChange={(event) => update('city', event.target.value)}
              aria-invalid={Boolean(errors.city)}
              placeholder="Ex.: Banabuiú"
              required
            />
          </Field>

          <Field label="Região" hint="Opcional" error={errors.region} htmlFor="client-region">
            <input
              id="client-region"
              className="input"
              value={form.region}
              onChange={(event) => update('region', event.target.value)}
              placeholder="Ex.: Sertão Central"
            />
          </Field>

          <Field label="Endereço" hint="Opcional" error={errors.address} className="span-2" htmlFor="client-address">
            <input
              id="client-address"
              className="input"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              placeholder="Ex.: Av. Principal, 123 — Centro"
            />
          </Field>

          <Field label="Cor de identificação" error={errors.color} className="span-2" htmlFor="client-color">
            <ColorPicker id="client-color" value={form.color} onChange={(value) => update('color', value)} />
          </Field>

          <Field label="Logotipo ou ícone" hint="Opcional — sem imagem, mostramos as iniciais" className="span-2">
            <ImageField
              value={form.logo_url}
              onChange={(value) => update('logo_url', value)}
              bucket="logos"
              fallbackName={form.name}
              label="Enviar logotipo"
            />
          </Field>

          <Field label="Observações" hint="Opcional" error={errors.notes} className="span-2" htmlFor="client-notes">
            <textarea
              id="client-notes"
              className="textarea"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Contato no local, preferências, combinados…"
            />
          </Field>

          <label className="checkbox span-2">
            <input type="checkbox" autoComplete="off" checked={form.active} onChange={(event) => update('active', event.target.checked)} />
            Cliente ativo (aparece na agenda e nas sugestões)
          </label>
        </div>
      </form>
    </Modal>
  );
}
