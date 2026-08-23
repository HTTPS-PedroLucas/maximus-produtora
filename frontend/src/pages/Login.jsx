import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, CalendarDays, Clapperboard, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';
import { BrandBackground, BrandLogo, BrandRay } from '../components/brand';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={location.state?.from || '/agenda'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(form.email.trim(), form.password);
    setBusy(false);
    if (result.ok) {
      navigate(location.state?.from || '/agenda', { replace: true });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="login-page">
      {/* Área institucional: o ponto mais expressivo da identidade. */}
      <section className="login-stage">
        <BrandBackground variant="login" vignette />
        <BrandRay className="login-stage-ray" />

        <BrandLogo size="lg" />

        <div className="login-headline">
          <span className="eyebrow">Máximus Produtora</span>
          <h1>
            Planejamento, captação e produção em <span className="gradient-text">um só lugar</span>.
          </h1>
          <p>A lousa da semana agora é digital, compartilhada e atualizada em tempo real com toda a equipe.</p>
        </div>

        <div className="login-points">
          <span>
            <CalendarDays size={16} strokeWidth={1.75} />
            Agenda semanal de segunda a sexta, com rota por município
          </span>
          <span>
            <Clapperboard size={16} strokeWidth={1.75} />
            Roteiros, referências e imagens de apoio por vídeo
          </span>
          <span>
            <Users size={16} strokeWidth={1.75} />
            Equipe escalada, progresso e conclusão acompanhados juntos
          </span>
        </div>
      </section>

      {/* Área do formulário: limpa, sem decoração sobre os campos. */}
      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand">
            <BrandLogo size="lg" />
            <p>Planejamento, captação e produção em um só lugar.</p>
          </div>

          <h2>Entrar no sistema</h2>
          <p className="login-sub">Use o e-mail e a senha cadastrados para a equipe.</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertCircle size={17} strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            <Field label="E-mail" htmlFor="email">
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="voce@maximusprodutora.com.br"
              />
            </Field>

            <Field label="Senha" htmlFor="password">
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="••••••••"
              />
            </Field>

            <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <LogIn size={17} strokeWidth={1.75} />}
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="login-hint">
            Não tem acesso? Peça para um administrador da Máximus criar seu usuário em
            <strong> Configurações → Acessos</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}
