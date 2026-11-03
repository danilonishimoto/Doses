import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BrandCapsuleIcon,
  DashboardIcon,
  HistoryIcon,
  PetPawIcon,
  PillIcon,
  ProfilesIcon,
  SettingsIcon,
} from '../assets/icons';
import { useDoses } from '../hooks/useDosesData';
import { usePWAStatus } from '../hooks/usePWAStatus';
import { formatFullHeaderDate } from '../utils/dateUtils';

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: DashboardIcon, end: true },
  { to: '/medicamentos', label: 'Medicamentos', icon: PillIcon },
  { to: '/perfis', label: 'Perfis', icon: ProfilesIcon },
  { to: '/historico', label: 'Histórico', icon: HistoryIcon },
  { to: '/configuracoes', label: 'Ajustes', icon: SettingsIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    profiles,
    activeProfileFilter,
    setActiveProfileFilter,
    toastMessage,
    dismissToast,
  } = useDoses();
  const { isOnline, canInstallNatively, promptInstall } = usePWAStatus();

  return (
    <div className="app-shell">
      <a href="#main-heading" className="skip-link visually-hidden">
        Pular para o conteúdo principal
      </a>

      {/* Sidebar para Desktop e Tablets horizontais */}
      <aside className="app-sidebar" aria-label="Menu lateral e informações do aplicativo">
        <div>
          <div className="sidebar-brand">
            <BrandCapsuleIcon size={40} />
            <div>
              <span className="sidebar-brand-name">Doses</span>
              <span className="sidebar-brand-tagline" style={{ display: 'block' }}>
                Gestão segura e acessível
              </span>
            </div>
          </div>

          <nav aria-label="Principal Desktop">
            <ul className="sidebar-nav-list" role="list">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className="sidebar-nav-link">
                    <Icon size={20} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer">
          <p style={{ color: '#FFFFFF', fontWeight: 700, marginBottom: '0.25rem' }}>
            Status de Operação
          </p>
          <p style={{ color: 'var(--color-blue-gray)', fontSize: '0.78rem' }}>
            {isOnline
              ? 'Conectado • Cache offline ativo (PWA)'
              : 'Modo Offline • Seus registros estão salvos neste dispositivo'}
          </p>
          {canInstallNatively && (
            <button
              type="button"
              onClick={promptInstall}
              className="btn btn-success btn-sm"
              style={{ width: '100%', marginTop: '0.65rem' }}
            >
              Instalar aplicativo
            </button>
          )}
        </div>
      </aside>

      <div className="app-main-wrapper">
        {/* Cabeçalho Superior com Filtro Global de Perfis */}
        <header className="app-topbar">
          <div className="topbar-inner">
            <div className="brand-lockup">
              <div className="mobile-only-brand">
                <BrandCapsuleIcon size={34} />
              </div>
              <div>
                <span className="brand-title mobile-only-brand">Doses</span>
                <span className="brand-subtitle">{formatFullHeaderDate()}</span>
              </div>
            </div>

            {!isOnline && (
              <div className="badge badge-pending" role="status">
                <span>Modo Offline • Dados locais</span>
              </div>
            )}

            <div
              className="profile-switcher"
              role="group"
              aria-label="Filtrar visualização por perfil acompanhado"
            >
              <button
                type="button"
                className="profile-pill"
                aria-pressed={activeProfileFilter === 'all'}
                onClick={() => setActiveProfileFilter('all')}
              >
                <span>Todos os perfis ({profiles.length})</span>
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="profile-pill"
                  aria-pressed={activeProfileFilter === profile.id}
                  onClick={() => setActiveProfileFilter(profile.id)}
                >
                  <span
                    className="avatar-dot"
                    style={{ backgroundColor: profile.avatarColor }}
                    aria-hidden="true"
                  />
                  {profile.type === 'pet' && <PetPawIcon size={14} />}
                  <span>{profile.name}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Área Principal de Conteúdo */}
        <main className="app-content" id="main-content">
          {children}
        </main>

        {/* Região Live centralizada para feedback das ações do usuário */}
        <div aria-live="polite" aria-atomic="true">
          {toastMessage && (
            <div className="toast-banner" role="status">
              <span>{toastMessage}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={dismissToast}
                aria-label="Fechar aviso"
              >
                OK
              </button>
            </div>
          )}
        </div>

        {/* Navegação Inferior Mobile-First */}
        <nav className="bottom-nav" aria-label="Principal Mobile">
          <ul className="bottom-nav-list" role="list">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="bottom-nav-link">
                  <span className="nav-icon-pill">
                    <Icon size={20} />
                  </span>
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
