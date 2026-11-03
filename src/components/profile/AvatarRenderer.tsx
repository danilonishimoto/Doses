import { AvatarYoungWoman, AvatarSeniorPerson, AvatarDoguinhoFofo } from '../../assets/icons';
import type { AvatarId } from '../../types';

interface AvatarRendererProps {
  avatar: AvatarId;
  size?: number;
}

export function AvatarRenderer({ avatar, size = 76 }: AvatarRendererProps) {
  switch (avatar) {
    case 'senior-person':
      return <AvatarSeniorPerson size={size} />;
    case 'doguinho-fofo':
      return <AvatarDoguinhoFofo size={size} />;
    case 'young-woman':
    default:
      return <AvatarYoungWoman size={size} />;
  }
}

export function getAvatarBgColor(avatar: AvatarId): string {
  switch (avatar) {
    case 'senior-person':
      return '#B4ECFB';
    case 'doguinho-fofo':
      return '#FBD4EC';
    case 'young-woman':
    default:
      return '#BBF9E0';
  }
}
