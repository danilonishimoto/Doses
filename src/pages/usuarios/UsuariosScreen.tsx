import { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { UserProfileSelectorRow } from '../../components/user/UserProfileSelectorRow';
import { UserPhysicalDataCard } from '../../components/user/UserPhysicalDataCard';
import { UserMedicalConditionsCard } from '../../components/user/UserMedicalConditionsCard';
import { UserAllergiesCard } from '../../components/user/UserAllergiesCard';
import type { Profile } from '../../types';

export function UsuariosScreen() {
  const { activeProfile, profiles, selectActiveProfile, updateProfile } = useApp();

  // Índice do perfil exibido
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sincroniza o índice com o perfil ativo do contexto
  useEffect(() => {
    if (activeProfile && profiles.length > 0) {
      const idx = profiles.findIndex((p) => p.id === activeProfile.id);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [activeProfile, profiles]);

  if (profiles.length === 0) {
    return (
      <div
        className="usuarios-empty"
        style={{
          width: '100%',
          maxWidth: 402,
          margin: '0 auto',
          minHeight: '100vh',
          backgroundColor: '#FFFFFF',
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ fontFamily: 'var(--font-body)', color: '#4E6D93' }}>Nenhum perfil encontrado.</p>
      </div>
    );
  }

  const displayedProfile: Profile = profiles[currentIndex] || profiles[0];

  const handlePrevProfile = async () => {
    const nextIdx = (currentIndex - 1 + profiles.length) % profiles.length;
    setCurrentIndex(nextIdx);
    const target = profiles[nextIdx];
    if (target) {
      await selectActiveProfile(target.id);
    }
  };

  const handleNextProfile = async () => {
    const nextIdx = (currentIndex + 1) % profiles.length;
    setCurrentIndex(nextIdx);
    const target = profiles[nextIdx];
    if (target) {
      await selectActiveProfile(target.id);
    }
  };

  const handleSavePhysicalData = async (updates: { height: number; weight: number; age: number }) => {
    await updateProfile(displayedProfile.id, updates);
  };

  // Mapeamento contextual de condições e alergias conforme o perfil do Figma
  const getConditionsText = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('camilla')) return 'Menopausa';
    if (lower.includes('josé') || lower.includes('jose')) return 'Parkinson';
    return 'Não informadas.';
  };

  const getAllergiesText = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('josé') || lower.includes('jose')) return 'Camarão\nAmendoim';
    return 'Não informadas.';
  };

  return (
    <div
      className="usuarios-screen"
      style={{
        width: '100%',
        maxWidth: 402,
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        className="usuarios-content"
        style={{
          width: '100%',
          padding: '20px 24px 0 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Título da tela */}
        <header style={{ marginTop: 8 }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 36,
              lineHeight: 1.2,
              color: '#000000',
              margin: 0,
            }}
          >
            Usuários
          </h1>
        </header>

        {/* Seletor de Perfil com Avatar e Navegação */}
        <UserProfileSelectorRow
          currentProfile={displayedProfile}
          currentIndex={currentIndex}
          totalProfiles={profiles.length}
          onPrev={handlePrevProfile}
          onNext={handleNextProfile}
        />

        {/* Seção Dados do Usuário */}
        <section
          aria-label="Dados do usuário"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Título e Identificação dos dados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 20,
                lineHeight: '24px',
                color: '#000000',
                margin: 0,
              }}
            >
              Dados do usuário
            </h2>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 14,
                lineHeight: '20px',
                color: '#1E1E1E',
              }}
            >
              <p style={{ margin: 0 }}>Dados do perfil cadastrado</p>
              <p style={{ margin: 0 }}>Persistidos de forma segura no dispositivo.</p>
            </div>
          </div>

          {/* Cards de Categorias */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Card 1: Dados físicos com suporte a edição e persistência */}
            <UserPhysicalDataCard
              profile={displayedProfile}
              onSave={handleSavePhysicalData}
            />

            {/* Card 2: Condições médicas */}
            <UserMedicalConditionsCard
              conditionsText={getConditionsText(displayedProfile.name)}
            />

            {/* Card 3: Alergias */}
            <UserAllergiesCard
              allergiesText={getAllergiesText(displayedProfile.name)}
            />
          </div>
        </section>

        {/* Espaço reservado inferior para não sobrepor a barra de navegação flutuante */}
        <div
          className="bottom-nav-spacer"
          style={{
            height: 110,
            width: '100%',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
