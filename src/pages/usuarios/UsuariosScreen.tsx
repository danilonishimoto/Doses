import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { UserProfileSelectorRow } from '../../components/user/UserProfileSelectorRow';
import { UserPhysicalDataCard } from '../../components/user/UserPhysicalDataCard';
import { UserMedicalConditionsCard } from '../../components/user/UserMedicalConditionsCard';
import { UserAllergiesCard } from '../../components/user/UserAllergiesCard';
import { UserNotificationsCard } from '../../components/user/UserNotificationsCard';
import { LogOutIcon } from '../../assets/icons';
import type { Profile } from '../../types';

export function UsuariosScreen() {
  const { activeProfile, profiles, selectActiveProfile, updateProfile, logout } = useApp();
  const navigate = useNavigate();

  // Índice do perfil exibido
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

  const handleSaveMedicalConditions = async (newText: string) => {
    await updateProfile(displayedProfile.id, { medicalConditions: newText });
  };

  const handleSaveAllergies = async (newText: string) => {
    await updateProfile(displayedProfile.id, { allergies: newText });
  };

  // Se o perfil ainda não possui condições ou alergias persistidas, inicializa com os dados de referência
  useEffect(() => {
    if (!displayedProfile) return;
    const lower = displayedProfile.name.toLowerCase();
    const needsConditions = !displayedProfile.medicalConditions;
    const needsAllergies = !displayedProfile.allergies;

    if (needsConditions || needsAllergies) {
      let initialCond = displayedProfile.medicalConditions;
      let initialAllerg = displayedProfile.allergies;

      if (needsConditions) {
        if (lower.includes('camilla')) initialCond = 'Menopausa';
        else if (lower.includes('josé') || lower.includes('jose')) initialCond = 'Parkinson';
        else initialCond = 'Não informadas.';
      }

      if (needsAllergies) {
        if (lower.includes('josé') || lower.includes('jose')) initialAllerg = 'Camarão\nAmendoim';
        else initialAllerg = 'Não informadas.';
      }

      updateProfile(displayedProfile.id, {
        medicalConditions: initialCond,
        allergies: initialAllerg,
      }).catch(console.warn);
    }
  }, [displayedProfile?.id]);

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
        {/* Título da tela e Botão Sair */}
        <header
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
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

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 20,
              border: '1px solid #000000',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-heading)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
            }}
            aria-label="Sair da sessão e voltar para a tela Entrar"
          >
            <LogOutIcon size={16} />
            <span>Sair</span>
          </button>
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
            {/* Card 1: Notificações Web Push */}
            <UserNotificationsCard />

            {/* Card 2: Dados físicos com suporte a edição e persistência */}
            <UserPhysicalDataCard
              profile={displayedProfile}
              onSave={handleSavePhysicalData}
            />

            {/* Card 3: Condições médicas com persistência real */}
            <UserMedicalConditionsCard
              conditionsText={displayedProfile.medicalConditions || 'Não informadas.'}
              onSave={handleSaveMedicalConditions}
            />

            {/* Card 4: Alergias com persistência real */}
            <UserAllergiesCard
              allergiesText={displayedProfile.allergies || 'Não informadas.'}
              onSave={handleSaveAllergies}
            />

            {/* Ação de Sair da Sessão */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={handleLogout}
                className="add-other-person-button"
                style={{
                  fontSize: 18,
                  height: 56,
                  borderColor: '#CBD5E1',
                  color: '#475569',
                }}
                aria-label="Sair da sessão atual"
              >
                <LogOutIcon size={20} />
                <span>Sair da sessão</span>
              </button>
            </div>
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
