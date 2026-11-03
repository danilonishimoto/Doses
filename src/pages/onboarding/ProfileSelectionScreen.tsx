import { OnboardingHeader } from '../../components/ui/OnboardingHeader';
import { ProfileCard } from '../../components/profile/ProfileCard';
import { PlusIcon } from '../../assets/icons';
import type { Profile } from '../../types';

interface ProfileSelectionScreenProps {
  profiles: Profile[];
  onBack: () => void;
  onAddPerson: () => void;
  onComplete: () => void;
}

export function ProfileSelectionScreen({
  profiles,
  onBack,
  onAddPerson,
  onComplete,
}: ProfileSelectionScreenProps) {
  return (
    <div className="onboarding-screen">
      <OnboardingHeader onBack={onBack} />

      <main className="onboarding-content">
        <div className="onboarding-presentation">
          <h1 className="onboarding-title">Quem você deseja acompanhar?</h1>
          <p className="onboarding-description">
            Você pode acompanhar seus cuidados e os de outras pessoas, cada um em seu perfil.
          </p>
        </div>

        <section className="profile-list-container" aria-label="Perfis para acompanhar">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}

          <button
            type="button"
            onClick={onAddPerson}
            className="add-other-person-button"
            aria-label="Adicionar outra pessoa"
          >
            <PlusIcon size={24} />
            <span>Adicionar outra pessoa</span>
          </button>
        </section>
      </main>

      <footer className="onboarding-footer">
        <button
          type="button"
          onClick={onComplete}
          className="primary-action-button"
        >
          Concluir e acessar o Doses
        </button>
      </footer>
    </div>
  );
}
