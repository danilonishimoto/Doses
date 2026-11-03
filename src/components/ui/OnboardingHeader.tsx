import { DosesLogo, ChevronLeftIcon } from '../../assets/icons';

interface OnboardingHeaderProps {
  onBack?: () => void;
  showBack?: boolean;
}

export function OnboardingHeader({ onBack, showBack = true }: OnboardingHeaderProps) {
  return (
    <header className="onboarding-header">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="header-back-button"
          aria-label="Voltar para a etapa anterior"
        >
          <div className="back-icon-box">
            <ChevronLeftIcon size={28} />
          </div>
          <span className="back-label">Voltar</span>
        </button>
      ) : (
        <div style={{ width: 56, height: 56 }} aria-hidden="true" />
      )}

      <DosesLogo />
    </header>
  );
}
