import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { assetUrl, errorMessage, uploadImage } from '../../api';
import { PALETTE, initialsOf } from '../../lib/colors';
import { useToast } from '../../context/ToastContext';
import { useClientStyle } from '../../context/ThemeContext';
import { BrandBackground } from '../brand';

/** Campo de formulário com rótulo sempre visível, dica e mensagem de erro. */
export function Field({ label, hint, error, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Loading({ label = 'Carregando…' }) {
  return (
    <div className="loading-row">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Estado vazio com iluminação e marca d'água discretas da Máximus. */
export function EmptyState({ icon: Icon, title, description, action, plain = false }) {
  return (
    <div className="empty-state">
      {!plain && <BrandBackground variant="empty" watermark />}
      {Icon && <Icon size={30} strokeWidth={1.75} className="empty-icon" />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, total, success = false }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className={`progress ${success ? 'progress-success' : ''}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value} de ${total} concluídos`}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Cabeçalho de página com a iluminação da marca. */
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="page-head">
      <div className="page-head-titles">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}

/** Título de seção com a barrinha em gradiente. */
export function SectionHeader({ title, description, actions, as: Tag = 'h2' }) {
  return (
    <div className="section-head">
      <span className="section-bar" aria-hidden="true" />
      <div className="grow">
        <Tag>{title}</Tag>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Métrica em tipografia de impacto. */
export function MetricCard({ value, label, extra, highlight = false, plain = false, children }) {
  return (
    <div className={`metric-card ${highlight ? 'is-highlight' : ''} ${plain ? 'is-plain' : ''}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
      {extra && <span className="metric-extra">{extra}</span>}
      {children}
    </div>
  );
}

/** Logotipo do cliente ou, na falta dele, um ícone com as iniciais na cor cadastrada. */
export function ClientAvatar({ name, logoUrl, color, size = 'md', round = false }) {
  const clientStyle = useClientStyle();
  const style = { ...clientStyle(color), background: 'var(--client-soft)', color: 'var(--client-text)', borderColor: 'var(--client-border)' };
  const className = `avatar ${size === 'lg' ? 'avatar-lg' : ''} ${size === 'sm' ? 'avatar-sm' : ''} ${round ? 'avatar-round' : ''}`;

  return (
    <span className={className.trim()} style={style} aria-hidden="true">
      {logoUrl ? <img src={assetUrl(logoUrl)} alt="" loading="lazy" /> : initialsOf(name)}
    </span>
  );
}

/**
 * Foto do membro da equipe ou iniciais.
 * `ring` aplica o aro em gradiente inspirado nos destaques do Instagram —
 * reservado a quem vai gravar, não a todos os ícones.
 */
export function MemberAvatar({ name, photoUrl, size = 'sm', ring = false }) {
  const className = `avatar avatar-round ${size === 'lg' ? 'avatar-lg' : ''} ${size === 'sm' ? 'avatar-sm' : ''}`;
  const avatar = (
    <span className={className.trim()} title={name}>
      {photoUrl ? <img src={assetUrl(photoUrl)} alt="" loading="lazy" /> : initialsOf(name)}
    </span>
  );

  if (!ring) return avatar;
  return (
    <span className="avatar-ring" title={name}>
      {avatar}
    </span>
  );
}

/** Cor de identificação do cliente: paleta sugerida + seletor livre. */
export function ColorPicker({ value, onChange, id }) {
  return (
    <div className="color-picker">
      <input
        id={id}
        type="color"
        className="color-input"
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        aria-label="Cor personalizada"
      />
      <div className="swatches">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`swatch ${value?.toUpperCase() === color ? 'is-selected' : ''}`}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Usar a cor ${color}`}
            aria-pressed={value?.toUpperCase() === color}
          />
        ))}
      </div>
    </div>
  );
}

/** Upload de uma imagem única (logotipo do cliente, foto do membro). */
export function ImageField({ value, onChange, bucket = 'logos', fallbackName = '', label = 'Enviar imagem' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = await uploadImage(file, bucket);
      onChange(data.url);
      toast.success('Imagem enviada.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível enviar a imagem.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="image-field">
      <span className="image-preview">
        {value ? <img src={assetUrl(value)} alt="" /> : initialsOf(fallbackName)}
      </span>
      <div className="row gap-6">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
          {busy ? 'Enviando…' : label}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
            <Trash2 size={14} />
            Remover
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}
