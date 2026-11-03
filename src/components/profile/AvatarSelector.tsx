import { AvatarRenderer, getAvatarBgColor } from './AvatarRenderer';
import type { AvatarId } from '../../types';

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
  options = ['young-woman', 'senior-person'],
}: AvatarSelectorProps) {
  return (
    <div className="avatar-selection-section" role="group" aria-label={label}>
      <p className="form-label">{label}</p>
      <div className="avatar-options-row">
        {options.map((option) => {
          const isSelected = selectedAvatar === option;
          const bgColor = getAvatarBgColor(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelectAvatar(option)}
              className="avatar-option-item"
              aria-pressed={isSelected}
              aria-label={`Avatar ${option}`}
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
