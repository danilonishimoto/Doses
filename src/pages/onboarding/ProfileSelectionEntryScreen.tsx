import { useState, useEffect } from 'react';
import { DosesLogo, ChevronLeftIcon, ChevronRightIcon } from '../../assets/icons';
import { AvatarRenderer, getAvatarBgColor } from '../../components/profile/AvatarRenderer';
import type { Profile } from '../../types';

interface ProfileSelectionEntryScreenProps {
  profiles: Profile[];
  initialSelectedId?: string;
  onSelectProfile: (profile: Profile) => void;
  onBackToOnboarding?: () => void;
}

export function ProfileSelectionEntryScreen({
  profiles,
  initialSelectedId,
  onSelectProfile,
  onBackToOnboarding,
}: ProfileSelectionEntryScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialSelectedId) {
      const idx = profiles.findIndex((p) => p.id === initialSelectedId);
      if (idx !== -1) return idx;
    }
    const mainIdx = profiles.findIndex((p) => p.isMainProfile);
    if (mainIdx !== -1) return mainIdx;
    return 0;
  });

  // Garante que o índice continue dentro dos limites caso os perfis mudem
  useEffect(() => {
    if (currentIndex >= profiles.length) {
      setCurrentIndex(Math.max(0, profiles.length - 1));
    }
  }, [profiles.length, currentIndex]);

  if (profiles.length === 0) {
    return (
      <div className="profile-entry-screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>Nenhum perfil cadastrado.</p>
        {onBackToOnboarding && (
          <button type="button" onClick={onBackToOnboarding} className="add-other-person-button" style={{ marginTop: 16 }}>
            Criar perfil
          </button>
        )}
      </div>
    );
  }

  const currentProfile = profiles[currentIndex] || profiles[0];
  const heroBgColor = getAvatarBgColor(currentProfile.avatar);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : profiles.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < profiles.length - 1 ? prev + 1 : 0));
  };

  const handleConfirm = () => {
    onSelectProfile(currentProfile);
  };

  const hasMultiple = profiles.length > 1;

  return (
    <div className="profile-entry-screen">
      <header className="profile-entry-header">
        <div style={{ width: 56, height: 56 }} aria-hidden="true" />
        <DosesLogo />
      </header>

      <main className="profile-entry-content">
        <div className="profile-entry-title-box">
          <h1 className="profile-entry-title">De quem você vai cuidar hoje?</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card Hero com troca de perfis (Figma: height 406px, rounded 20px) */}
          <section
            className="profile-selector-hero"
            style={{ backgroundColor: heroBgColor }}
            aria-label={`Perfil em exibição: ${currentProfile.name}`}
          >
            <div className="profile-switcher-row">
              <button
                type="button"
                onClick={handlePrevious}
                className="nav-arrow-button"
                disabled={!hasMultiple}
                aria-label="Perfil anterior"
              >
                <ChevronLeftIcon size={32} />
              </button>

              <div className="hero-avatar-container">
                <AvatarRenderer avatar={currentProfile.avatar} size={156} />
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="nav-arrow-button"
                disabled={!hasMultiple}
                aria-label="Próximo perfil"
              >
                <ChevronRightIcon size={32} />
              </button>
            </div>

            <div className="hero-profile-info">
              <p className="hero-profile-name">{currentProfile.name}</p>
              {currentProfile.isMainProfile && (
                <p className="hero-profile-badge">Principal</p>
              )}
            </div>
          </section>

          <p className="profile-instruction-text">
            {hasMultiple
              ? 'Use as setas para trocar de perfil.'
              : 'Perfil selecionado para o cuidado de hoje.'}
          </p>
        </div>
      </main>

      <footer className="onboarding-footer">
        <button
          type="button"
          onClick={handleConfirm}
          className="primary-action-button"
          aria-label={`Acessar medicamentos de ${currentProfile.name}`}
        >
          Acessar medicamentos de {currentProfile.name}
        </button>
      </footer>
    </div>
  );
}
