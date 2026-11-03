import { DosesLogo } from '../assets/icons';
import { AvatarRenderer, getAvatarBgColor } from './profile/AvatarRenderer';
import type { Profile } from '../types';

interface AppDashboardPlaceholderProps {
  activeProfile: Profile;
  onSwitchProfile: () => void;
}

export function AppDashboardPlaceholder({
  activeProfile,
  onSwitchProfile,
}: AppDashboardPlaceholderProps) {
  const avatarBg = getAvatarBgColor(activeProfile.avatar);

  return (
    <div className="onboarding-screen">
      <header className="onboarding-header">
        <DosesLogo />
        <button
          type="button"
          onClick={onSwitchProfile}
          className="field-action-button"
          style={{ width: 'auto', fontSize: 13, color: '#4E6D93', padding: '0 8px' }}
          aria-label="Trocar de perfil"
        >
          Trocar perfil
        </button>
      </header>

      <main className="onboarding-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <article
          style={{
            width: '100%',
            maxWidth: 354,
            padding: 24,
            borderRadius: 20,
            backgroundColor: avatarBg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
          aria-labelledby="active-profile-heading"
        >
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 56,
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AvatarRenderer avatar={activeProfile.avatar} size={88} />
          </div>

          <div>
            <h1 id="active-profile-heading" style={{ fontSize: 28, fontWeight: 700 }}>
              {activeProfile.name} {activeProfile.surname}
            </h1>
            <p style={{ fontSize: 16, color: '#1E1E1E' }}>
              {activeProfile.isMainProfile ? 'Perfil principal' : 'Perfil sob cuidados'}
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: '12px 16px',
              width: '100%',
              fontSize: 14,
              color: '#4E6D93',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Idade: <strong>{activeProfile.age} anos</strong></span>
            <span>Peso: <strong>{activeProfile.weight} kg</strong></span>
            <span>Altura: <strong>{activeProfile.height} cm</strong></span>
          </div>
        </article>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#565651', marginTop: 12 }}>
          Perfil ativo selecionado com sucesso no Doses. As telas de medicamentos e cronograma serão integradas nas próximas etapas.
        </p>
      </main>

      <footer className="onboarding-footer">
        <button
          type="button"
          onClick={onSwitchProfile}
          className="add-other-person-button"
          style={{ height: 64 }}
        >
          Alternar para outro perfil
        </button>
      </footer>
    </div>
  );
}
