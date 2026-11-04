import {
  AvatarYoungWoman,
  AvatarSeniorPerson,
  AvatarDoguinhoFofo,
  AvatarProfile04,
  AvatarProfile05,
  AvatarProfile06,
  AvatarProfile07,
  AvatarProfile08,
  AvatarProfile09,
  AvatarProfile10,
  AvatarProfile11,
  AvatarProfile12,
  AvatarProfile13,
  AvatarProfile14,
} from '../../assets/icons';
import type { AvatarId } from '../../types';

interface AvatarRendererProps {
  avatar: AvatarId;
  size?: number;
}

export function AvatarRenderer({ avatar, size = 76 }: AvatarRendererProps) {
  switch (avatar) {
    case 'senior-person':
    case 'profile-02':
      return <AvatarSeniorPerson size={size} />;
    case 'doguinho-fofo':
    case 'profile-03':
      return <AvatarDoguinhoFofo size={size} />;
    case 'profile-04':
      return <AvatarProfile04 size={size} />;
    case 'profile-05':
      return <AvatarProfile05 size={size} />;
    case 'profile-06':
      return <AvatarProfile06 size={size} />;
    case 'profile-07':
      return <AvatarProfile07 size={size} />;
    case 'profile-08':
      return <AvatarProfile08 size={size} />;
    case 'profile-09':
      return <AvatarProfile09 size={size} />;
    case 'profile-10':
      return <AvatarProfile10 size={size} />;
    case 'profile-11':
      return <AvatarProfile11 size={size} />;
    case 'profile-12':
      return <AvatarProfile12 size={size} />;
    case 'profile-13':
      return <AvatarProfile13 size={size} />;
    case 'profile-14':
      return <AvatarProfile14 size={size} />;
    case 'young-woman':
    case 'profile-01':
    default:
      return <AvatarYoungWoman size={size} />;
  }
}

export function getAvatarBgColor(avatar: AvatarId): string {
  switch (avatar) {
    case 'senior-person':
    case 'profile-02':
      return '#B4ECFB';
    case 'doguinho-fofo':
    case 'profile-03':
      return '#FBD4EC';
    case 'profile-04':
      return '#FFF4DA';
    case 'profile-05':
      return '#E8F4F1';
    case 'profile-06':
      return '#E6F4FF';
    case 'profile-07':
      return '#EDE9FE';
    case 'profile-08':
      return '#FED8B1';
    case 'profile-09':
      return '#CCFBF1';
    case 'profile-10':
      return '#FCE7F3';
    case 'profile-11':
      return '#FEF3C7';
    case 'profile-12':
      return '#BBF9E0';
    case 'profile-13':
      return '#B4ECFB';
    case 'profile-14':
      return '#EAE6FD';
    case 'young-woman':
    case 'profile-01':
    default:
      return '#BBF9E0';
  }
}
