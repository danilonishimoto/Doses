import { AvatarRenderer, getAvatarBgColor } from './AvatarRenderer';
import type { AvatarId } from '../../types';

export const ALL_AVATARS: AvatarId[] = [
  'young-woman',
  'senior-person',
  'doguinho-fofo',
  'profile-04',
  'profile-05',
  'profile-06',
  'profile-07',
  'profile-08',
  'profile-09',
  'profile-10',
  'profile-11',
  'profile-12',
  'profile-13',
  'profile-14',
];

export const AVATAR_NAMES: Record<string, string> = {
  'young-woman': 'Mulher jovem',
  'senior-person': 'Pessoa idosa',
  'doguinho-fofo': 'Cachorrinho',
  'profile-01': 'Mulher jovem',
  'profile-02': 'Pessoa idosa',
  'profile-03': 'Cachorrinho',
  'profile-04': 'Cabelo crespo curto',
  'profile-05': 'Coque e óculos redondos',
  'profile-06': 'Cabelo curto e barba',
  'profile-07': 'Pessoa com hijab',
  'profile-08': 'Dois coques crespos',
  'profile-09': 'Aparelho auditivo',
  'profile-10': 'Gato amigável',
  'profile-11': 'Cabelo cacheado',
  'profile-12': 'Afro volumoso',
  'profile-13': 'Tranças presas',
  'profile-14': 'Curto e óculos',
};

interface AvatarSelectorProps {
  selectedAvatar: AvatarId;
  onSelectAvatar: (avatar: AvatarId) => void;
  label?: string;
  options?: AvatarId[];
}

export function AvatarSelector({
  selectedAvatar,
  onSelectAvatar,
  label = 'Escolha um avatar',
  options = ALL_AVATARS,
}: AvatarSelectorProps) {
  return (
    <div className="avatar-selection-section" role="group" aria-label={label}>
      <p className="form-label">{label}</p>
      <div className="avatar-options-row">
        {options.map((option) => {
          const isSelected = selectedAvatar === option;
          const bgColor = getAvatarBgColor(option);
          const avatarName = AVATAR_NAMES[option] || option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelectAvatar(option)}
              className="avatar-option-item"
              aria-pressed={isSelected}
              aria-label={`Avatar ${avatarName}`}
            >
              <div
                className="avatar-circle-wrapper"
                style={{
                  backgroundColor: bgColor,
                  border: isSelected ? '2px solid #000000' : 'none',
                }}
              >
                <AvatarRenderer avatar={option} size={76} />
              </div>
              <span className="avatar-option-status">
                {isSelected ? 'Selecionado' : 'Selecionar'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
