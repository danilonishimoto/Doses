import { useState, FormEvent } from 'react';
import { OnboardingHeader } from '../../components/ui/OnboardingHeader';
import { FormField } from '../../components/forms/FormField';
import { AvatarSelector } from '../../components/profile/AvatarSelector';
import { ProfileService } from '../../services/profile/ProfileService';
import type { AvatarId, Profile } from '../../types';

interface MainProfileScreenProps {
  accountId: string;
  initialData?: {
    avatar: AvatarId;
    name: string;
    surname: string;
    age: string;
    weight: string;
    height: string;
  };
  onBack: (draft?: {
    avatar: AvatarId;
    name: string;
    surname: string;
    age: string;
    weight: string;
    height: string;
  }) => void;
  onSuccess: (profile: Profile) => void;
}

export function MainProfileScreen({
  accountId,
  initialData,
  onBack,
  onSuccess,
}: MainProfileScreenProps) {
  const [avatar, setAvatar] = useState<AvatarId>(initialData?.avatar || 'young-woman');
  const [name, setName] = useState(initialData?.name || '');
  const [surname, setSurname] = useState(initialData?.surname || '');
  const [age, setAge] = useState(initialData?.age || '');
  const [weight, setWeight] = useState(initialData?.weight || '');
  const [height, setHeight] = useState(initialData?.height || '');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'Digite o nome.';
    if (!surname.trim()) newErrors.surname = 'Digite o sobrenome.';

    const numAge = Number(age);
    if (!age.trim() || isNaN(numAge) || numAge <= 0 || numAge > 150) {
      newErrors.age = 'Idade inválida.';
    }

    const numWeight = Number(weight.replace(',', '.'));
    if (!weight.trim() || isNaN(numWeight) || numWeight <= 0 || numWeight > 500) {
      newErrors.weight = 'Peso inválido.';
    }

    const numHeight = Number(height);
    if (!height.trim() || isNaN(numHeight) || numHeight <= 0 || numHeight > 300) {
      newErrors.height = 'Altura inválida.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const existingMain = await ProfileService.getMainProfile(accountId);
      let profile: Profile;
      if (existingMain) {
        profile = await ProfileService.updateProfile(existingMain.id, {
          name: name.trim(),
          surname: surname.trim(),
          age: numAge,
          weight: numWeight,
          height: numHeight,
          avatar,
          isMainProfile: true,
        });
      } else {
        profile = await ProfileService.createProfile({
          accountId,
          name: name.trim(),
          surname: surname.trim(),
          age: numAge,
          weight: numWeight,
          height: numHeight,
          avatar,
          isMainProfile: true,
        });
      }
      onSuccess(profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar perfil principal.';
      setErrors({ form: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-screen">
      <OnboardingHeader
        onBack={() =>
          onBack({
            avatar,
            name,
            surname,
            age,
            weight,
            height,
          })
        }
      />

      <main className="onboarding-content">
        <div className="onboarding-presentation">
          <h1 className="onboarding-title">Agora, vamos conhecer você</h1>
          <p className="onboarding-description">
            Configure seu perfil para deixar seus cuidados organizados no Doses.
          </p>
        </div>

        <form id="main-profile-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {errors.form && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: 'var(--color-bg-error)',
                border: '1px solid var(--color-border-error)',
                color: 'var(--color-border-error)',
                fontSize: 14,
              }}
              role="alert"
            >
              {errors.form}
            </div>
          )}

          <AvatarSelector selectedAvatar={avatar} onSelectAvatar={setAvatar} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Nome e Sobrenome (Figma: flex gap 12px) */}
            <div style={{ display: 'flex', gap: 12 }}>
              <FormField
                label="Nome"
                placeholder="Digite o nome"
                type="text"
                inputMode="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                error={errors.name}
                autoComplete="given-name"
                autoCapitalize="words"
                disabled={isSubmitting}
                required
                containerStyle={{ flex: 1, minWidth: 0 }}
              />

              <FormField
                label="Sobrenome"
                placeholder="O sobrenome"
                type="text"
                inputMode="text"
                value={surname}
                onChange={(e) => {
                  setSurname(e.target.value);
                  if (errors.surname) setErrors((prev) => ({ ...prev, surname: '' }));
                }}
                error={errors.surname}
                autoComplete="family-name"
                autoCapitalize="words"
                disabled={isSubmitting}
                required
                containerStyle={{ flex: 1, minWidth: 0 }}
              />
            </div>

            {/* Dados numéricos: Idade, Peso (kg), Altura (cm) (Figma: 3 colunas) */}
            <div style={{ display: 'flex', gap: 12 }}>
              <FormField
                label="Idade"
                placeholder="Em anos"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                max={150}
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                  if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                }}
                error={errors.age}
                disabled={isSubmitting}
                required
                containerStyle={{ flex: 1, minWidth: 0 }}
              />

              <FormField
                label="Peso (kg)"
                placeholder="Em kg"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  if (errors.weight) setErrors((prev) => ({ ...prev, weight: '' }));
                }}
                error={errors.weight}
                disabled={isSubmitting}
                required
                containerStyle={{ flex: 1, minWidth: 0 }}
              />

              <FormField
                label="Altura (cm)"
                placeholder="Em cm"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                max={300}
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  if (errors.height) setErrors((prev) => ({ ...prev, height: '' }));
                }}
                error={errors.height}
                disabled={isSubmitting}
                required
                containerStyle={{ flex: 1, minWidth: 0 }}
              />
            </div>
          </div>
        </form>
      </main>

      <footer className="onboarding-footer">
        <button
          type="submit"
          form="main-profile-form"
          className="primary-action-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Continuar'}
        </button>
      </footer>
    </div>
  );
}
