/**
 * Componentes da marca Máximus Produtora.
 *
 * As imagens oficiais ficam em /public/brand e nunca são recriadas com fonte
 * comum, redesenhadas ou distorcidas. O raio é elemento decorativo — jamais
 * substitui a logo nem os ícones funcionais do sistema.
 */
import { useTheme } from '../../context/ThemeContext';

const LOGO_ON_DARK = '/brand/maximus-logo-on-dark.png';
const LOGO_ON_LIGHT = '/brand/maximus-logo-on-light.png';
const SYMBOL = '/brand/maximus-symbol.png';
const RAY_FILLED = '/brand/maximus-ray-filled.png';
const RAY_OUTLINE = '/brand/maximus-ray-outline.png';

/**
 * Assinatura completa (símbolo + MÁXIMUS + Produtora).
 * Por padrão acompanha o tema: versão clara no tema escuro e a versão preta
 * no tema claro. `variant="dark"|"light"` força uma delas.
 */
export function BrandLogo({ variant = 'auto', size = 'md', className = '', alt = 'Máximus Produtora' }) {
  const { isLight } = useTheme();
  const sizeClass = size === 'sm' ? 'brand-logo-sm' : size === 'lg' ? 'brand-logo-lg' : size === 'xl' ? 'brand-logo-xl' : '';
  const useLightVersion = variant === 'light' || (variant === 'auto' && isLight);

  return (
    <img
      src={useLightVersion ? LOGO_ON_LIGHT : LOGO_ON_DARK}
      alt={alt}
      className={`brand-logo ${sizeClass} ${className}`.trim()}
      draggable="false"
      decoding="async"
    />
  );
}

/** Apenas o símbolo — usado na barra lateral recolhida e em espaços curtos. */
export function BrandSymbol({ size = 'md', className = '', alt = '' }) {
  const sizeClass = size === 'sm' ? 'brand-symbol-sm' : size === 'lg' ? 'brand-symbol-lg' : '';
  return (
    <img
      src={SYMBOL}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      className={`brand-symbol ${sizeClass} ${className}`.trim()}
      draggable="false"
      decoding="async"
    />
  );
}

/**
 * Elemento gráfico "raio".
 * `variant="outline"` é a versão vazada, indicada para marca d'água.
 */
export function BrandRay({ variant = 'filled', className = '', style }) {
  return (
    <img
      src={variant === 'outline' ? RAY_OUTLINE : RAY_FILLED}
      alt=""
      aria-hidden="true"
      className={`brand-ray ${className}`.trim()}
      style={style}
      draggable="false"
      decoding="async"
      loading="lazy"
    />
  );
}

/**
 * Marca d'água decorativa: raio vazado ao fundo, em opacidade baixa.
 * Nunca deve ficar atrás de textos pequenos — use em áreas vazias e cabeçalhos.
 */
export function BrandWatermark({ variant = 'outline', intensity = 'default', className = '', style }) {
  const intensityClass = intensity === 'subtle' ? 'is-subtle' : intensity === 'visible' ? 'is-visible' : '';
  return (
    <img
      src={variant === 'filled' ? RAY_FILLED : RAY_OUTLINE}
      alt=""
      aria-hidden="true"
      className={`brand-ray-watermark ${intensityClass} ${className}`.trim()}
      style={style}
      draggable="false"
      decoding="async"
      loading="lazy"
    />
  );
}

/** Ponto de luz difusa. Use com moderação, sempre atrás de áreas sem texto denso. */
export function BrandGlow({ color = 'purple', size = 320, top, left, right, bottom, opacity }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-glow brand-glow-${color}`}
      style={{ width: size, height: size, top, left, right, bottom, opacity }}
    />
  );
}

/**
 * Camada de fundo com a iluminação da marca (roxo, magenta e coral),
 * opcionalmente com o raio vazado como marca d'água.
 */
export function BrandBackground({ variant = 'header', watermark = false, vignette = false }) {
  const presets = {
    header: [
      { color: 'purple', size: 420, top: -220, left: -120, opacity: 0.42 },
      { color: 'coral', size: 320, top: -180, right: -60, opacity: 0.26 },
    ],
    login: [
      { color: 'purple', size: 720, top: -220, left: -240, opacity: 0.75 },
      { color: 'magenta', size: 560, bottom: -200, left: 60, opacity: 0.55 },
      { color: 'coral', size: 480, top: 120, right: -140, opacity: 0.45 },
    ],
    empty: [{ color: 'magenta', size: 300, top: -120, left: '50%', opacity: 0.18 }],
  };

  return (
    <div className="brand-bg" aria-hidden="true">
      {(presets[variant] || presets.header).map((glow, index) => (
        <BrandGlow key={index} {...glow} />
      ))}
      {watermark && (
        <BrandWatermark
          intensity={variant === 'empty' ? 'default' : 'subtle'}
          style={
            variant === 'empty'
              ? { height: 190, right: '50%', top: '50%', transform: 'translate(50%, -50%)' }
              : { height: 260, right: -30, top: -60 }
          }
        />
      )}
      {vignette && <span className="brand-vignette" />}
    </div>
  );
}
