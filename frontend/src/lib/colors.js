// A cor de cada cliente vem do banco e continua sendo a identificação dele na
// agenda — o gradiente da Máximus nunca substitui essas cores.
// Aqui derivamos as variações usadas no tema escuro (contorno, fundo suave e
// tom de texto legível), garantindo contraste sobre as superfícies escuras.

export const PALETTE = [
  '#38BDF8', '#22D3EE', '#2DD4BF', '#4ADE80', '#A3E635',
  '#FBBF24', '#FB923C', '#F87171', '#FB7185', '#F472B6',
  '#C084FC', '#818CF8',
];

export const DEFAULT_COLOR = '#94A3B8';

/** Superfície de referência de cada tema, usada nos cálculos de contraste. */
export const THEME_SURFACE = {
  dark: '#151219',
  light: '#ffffff',
};

const DARK_SURFACE = THEME_SURFACE.dark;

function normalize(hex) {
  if (typeof hex !== 'string') return DEFAULT_COLOR;
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
  }
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : DEFAULT_COLOR;
}

export function toRgb(hex) {
  const value = normalize(hex);
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Luminância relativa (WCAG). */
export function luminance(hex) {
  const { r, g, b } = toRgb(hex);
  const channel = (value) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Preto ou branco — o que tiver melhor contraste sobre a cor informada. */
export function readableOn(hex) {
  return contrastRatio(hex, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#111827';
}

export function rgba(hex, alpha) {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Clareia a cor em direção ao branco (0 = original, 1 = branco). */
export function lighten(hex, amount) {
  const { r, g, b } = toRgb(hex);
  return toHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

/** Escurece a cor em direção ao preto (0 = original, 1 = preto). */
export function darken(hex, amount) {
  const { r, g, b } = toRgb(hex);
  return toHex({ r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) });
}

function isLightBackground(background) {
  return luminance(background) > 0.4;
}

/**
 * Ajusta a cor até alcançar o contraste mínimo com a superfície do tema:
 * clareia sobre fundo escuro, escurece sobre fundo claro.
 */
function toneFor(hex, background, minRatio, fallback) {
  const base = normalize(hex);
  if (contrastRatio(base, background) >= minRatio) return base;

  const towardsDark = isLightBackground(background);
  for (let step = 1; step <= 12; step += 1) {
    const candidate = towardsDark ? darken(base, step * 0.08) : lighten(base, step * 0.08);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return fallback(base);
}

/**
 * Tom da cor do cliente usado em texto (contraste AA, 4.5:1).
 */
export function textTone(hex, background = DARK_SURFACE) {
  return toneFor(hex, background, 4.5, () => (isLightBackground(background) ? '#16121B' : '#F8F5F9'));
}

/**
 * Versão da cor usada em contornos, pontos e barras.
 * Componentes gráficos pedem 3:1 (WCAG), então cores com pouco contraste —
 * como o verde escuro da Clínica Moreira no tema escuro — são ajustadas só na
 * exibição. O valor salvo no banco continua exatamente o que a equipe escolheu.
 */
export function vividTone(hex, background = DARK_SURFACE) {
  return toneFor(hex, background, 3, (base) => (isLightBackground(background) ? darken(base, 0.5) : lighten(base, 0.8)));
}

/** Variáveis CSS aplicadas no cartão/etiqueta de cada cliente. */
export function clientStyle(hex, background = DARK_SURFACE) {
  const color = normalize(hex);
  const vivid = vividTone(color, background);
  const light = isLightBackground(background);

  return {
    '--client-color': vivid,
    '--client-raw': color,
    '--client-soft': rgba(vivid, light ? 0.14 : 0.12),
    '--client-softer': rgba(vivid, light ? 0.07 : 0.06),
    '--client-border': rgba(vivid, light ? 0.5 : 0.55),
    '--client-border-strong': rgba(vivid, 0.9),
    '--client-text': textTone(color, background),
    '--client-contrast': readableOn(color),
    '--client-glow': rgba(vivid, 0.22),
  };
}

/** Iniciais usadas quando o cliente ou o membro não tem imagem. */
export function initialsOf(name = '') {
  const words = String(name)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1 || /\p{L}/u.test(word));

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
