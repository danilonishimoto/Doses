import { useLocation, useNavigate } from 'react-router-dom';
import { HomeTabIcon, CronogramaTabIcon, ReceitasTabIcon, MedicamentosTabIcon } from '../../assets/icons';
import { AvatarRenderer } from '../profile/AvatarRenderer';
import { useApp } from '../../hooks/useApp';
import type { NavigationTab } from '../../types';

interface BottomNavigationProps {
  currentTab?: NavigationTab;
}

export function BottomNavigation({ currentTab }: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeProfile } = useApp();

  const getActiveTab = (): NavigationTab => {
    if (currentTab) return currentTab;
    const pathname = location.pathname;
    if (pathname === '/cronograma') return 'cronograma';
    if (pathname === '/receitas') return 'receitas';
    if (pathname === '/medicamentos') return 'medicamentos';
    if (pathname === '/usuarios') return 'usuarios';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems: { tab: NavigationTab; label: string; path: string }[] = [
    { tab: 'home', label: 'Home', path: '/' },
    { tab: 'cronograma', label: 'Cronograma', path: '/cronograma' },
    { tab: 'receitas', label: 'Receitas', path: '/receitas' },
    { tab: 'medicamentos', label: 'Medicamentos', path: '/medicamentos' },
    { tab: 'usuarios', label: 'Usuários', path: '/usuarios' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="bottom-nav-container"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 402,
          padding: '0 16px 16px 16px',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      >
        <div
          className="bottom-nav-surface"
          style={{
            backgroundColor: '#FFFFFF',
            height: 80,
            borderRadius: 24,
            boxShadow: '0px 4px 8px rgba(0, 37, 78, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 4px',
            boxSizing: 'border-box',
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;

            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => handleNavigate(item.path)}
                aria-label={`Ir para a aba ${item.label}`}
                aria-current={isActive ? 'page' : undefined}
                className={`bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    backgroundColor: isActive ? '#C8E7FF' : 'transparent',
                    borderRadius: 12,
                    width: '100%',
                    maxWidth: 70,
                    height: 66,
                    padding: '3px 2px 2px 2px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      height: 38.5,
                      width: 38.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.tab === 'home' && <HomeTabIcon active={isActive} size={38} />}
                    {item.tab === 'cronograma' && <CronogramaTabIcon active={isActive} size={38} />}
                    {item.tab === 'receitas' && <ReceitasTabIcon active={isActive} size={38} />}
                    {item.tab === 'medicamentos' && <MedicamentosTabIcon active={isActive} size={38} />}
                    {item.tab === 'usuarios' && (
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isActive ? '0 0 0 1.5px #000000' : 'none',
                        }}
                      >
                        <AvatarRenderer
                          avatar={activeProfile?.avatar || 'young-woman'}
                          size={34}
                        />
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: isActive ? 400 : 400,
                      fontSize: item.tab === 'medicamentos' ? 9.5 : 10,
                      letterSpacing: item.tab === 'medicamentos' ? '-0.25px' : '-0.05px',
                      lineHeight: '14px',
                      marginTop: 1,
                      color: '#000000',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
