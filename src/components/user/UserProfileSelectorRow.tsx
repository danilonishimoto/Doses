import { ChevronLeftIcon, ChevronRightIcon } from '../../assets/icons';
import { AvatarRenderer, getAvatarBgColor } from '../profile/AvatarRenderer';
import type { Profile } from '../../types';

interface UserProfileSelectorRowProps {
  currentProfile: Profile;
  currentIndex: number;
  totalProfiles: number;
  onPrev: () => void;
  onNext: () => void;
}

export function UserProfileSelectorRow({
  currentProfile,
  currentIndex,
  totalProfiles,
  onPrev,
  onNext,
}: UserProfileSelectorRowProps) {
  const avatarBgColor = getAvatarBgColor(currentProfile.avatar);

  return (
    <div
      className="user-profile-selector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}
    >
      {/* Linha com setas de troca e avatar em destaque */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          aria-label="Perfil anterior"
          className="user-nav-arrow"
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            outline: 'none',
            color: '#000000',
            transition: 'transform 0.1s ease',
          }}
        >
          <ChevronLeftIcon size={40} />
        </button>

        {/* Avatar grande com fundo temático */}
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            backgroundColor: avatarBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            transition: 'background-color 0.25s ease',
          }}
        >
          <AvatarRenderer avatar={currentProfile.avatar} size={96} />
        </div>

        <button
          type="button"
          onClick={onNext}
          aria-label="Próximo perfil"
          className="user-nav-arrow"
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            outline: 'none',
            color: '#000000',
            transition: 'transform 0.1s ease',
          }}
        >
          <ChevronRightIcon size={40} />
        </button>
      </div>

      {/* Nome e subtítulo de paginação */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 20,
            lineHeight: '24px',
            color: '#000000',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {currentProfile.name}
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 14,
            lineHeight: '20px',
            color: '#000000',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Perfil selecionado · {currentIndex + 1} de {totalProfiles}
        </p>
      </div>
    </div>
  );
}
