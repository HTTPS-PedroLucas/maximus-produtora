import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Users, UserCog, Settings, LogOut, KeyRound,
  PanelLeftClose, PanelLeftOpen, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { MemberAvatar } from '../ui';
import { BrandLogo, BrandSymbol, BrandWatermark } from '../brand';

const NAV = [
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/equipe', label: 'Equipe', icon: UserCog },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const COLLAPSE_KEY = 'maximus_sidebar_collapsed';

const PAGE_TITLES = {
  '/agenda': 'Agenda semanal',
  '/clientes': 'Clientes',
  '/equipe': 'Equipe',
  '/configuracoes': 'Configurações',
};

function currentTitle(pathname) {
  if (pathname.startsWith('/captacoes/')) return 'Captação';
  if (pathname.startsWith('/agenda/')) return 'Dia da agenda';
  return PAGE_TITLES[pathname] || 'Máximus Produtora';
}

export default function AppShell({ children }) {
  const { user, workspace, logout } = useAuth();
  const { connected } = useRealtime();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <div className="app-body">
        <nav className={`sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Navegação principal">
          <div className="sidebar-brand">
            <Link to="/agenda" className="brand-lockup" aria-label="Máximus Produtora — ir para a agenda">
              {collapsed ? <BrandSymbol size="md" /> : <BrandLogo size="md" />}
            </Link>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          <div className="sidebar-nav">
            <span className="nav-section">Produção</span>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="sidebar-foot">
            {!collapsed && (
              <div className="sidebar-card">
                <BrandWatermark intensity="visible" style={{ height: 96, right: -14, top: -18 }} />
                <span className="sidebar-card-title">Semana em movimento</span>
                <p>Planejamento, captação e produção da equipe em um só lugar.</p>
              </div>
            )}

            <button
              type="button"
              className="sidebar-user"
              onClick={() => navigate('/configuracoes')}
              title="Meu perfil e senha"
            >
              <MemberAvatar name={user?.name} photoUrl={user?.avatar_url} ring />
              <span className="grow">
                <strong className="truncate">{user?.name}</strong>
                <span>{user?.role === 'admin' ? 'Administrador' : 'Equipe'}</span>
              </span>
              <ChevronRight size={15} />
            </button>
          </div>
        </nav>

        <div className="grow">
          <header className="topbar">
            <Link to="/agenda" className="brand-lockup topbar-brand" aria-label="Máximus Produtora">
              <BrandLogo size="sm" />
            </Link>

            <div className="topbar-title hide-sm">
              <strong>{currentTitle(location.pathname)}</strong>
              <span>{workspace?.name || 'Máximus Produtora'}</span>
            </div>

            <div className="topbar-spacer" />

            <span
              className={`realtime-dot ${connected ? '' : 'offline'}`}
              title={
                connected
                  ? 'Alterações da equipe chegam em tempo real'
                  : 'Sem conexão em tempo real — os dados são atualizados ao recarregar'
              }
            >
              <i />
              <span className="hide-sm">{connected ? 'Em tempo real' : 'Offline'}</span>
            </span>

            <button
              type="button"
              className="user-chip"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MemberAvatar name={user?.name} photoUrl={user?.avatar_url} ring />
              <span className="user-meta hide-sm">
                <strong>{user?.name}</strong>
                <span>{user?.role === 'admin' ? 'Administrador' : 'Equipe'}</span>
              </span>
            </button>

            {menuOpen && (
              <div className="menu" role="menu" onClick={(event) => event.stopPropagation()}>
                <div className="menu-head">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <button type="button" className="menu-item" role="menuitem" onClick={() => navigate('/configuracoes')}>
                  <KeyRound size={16} strokeWidth={1.75} />
                  Meu perfil e senha
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  Sair
                </button>
              </div>
            )}
          </header>

          <main className="main">{children}</main>
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Navegação">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <item.icon size={19} strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
