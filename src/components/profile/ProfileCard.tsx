import { AvatarRenderer, getAvatarBgColor } from './AvatarRenderer';
import type { Profile } from '../../types';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const bgColor = getAvatarBgColor(profile.avatar);

  return (
    <article
      className="profile-registered-card"
      style={{ backgroundColor: bgColor }}
      aria-label={`Perfil de ${profile.name} ${profile.surname}`}
    >
      <div className="profile-card-avatar">
        <AvatarRenderer avatar={profile.avatar} size={68} />
      </div>
      <div className="profile-card-info">
        <h2 className="profile-card-name">
          {profile.name} {profile.surname}
        </h2>
        {profile.isMainProfile && (
          <p className="profile-card-badge">Perfil principal</p>
        )}
      </div>
    </article>
  );
}
