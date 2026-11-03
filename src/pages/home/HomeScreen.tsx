import { useState, useMemo } from 'react';
import { DosesLogo } from '../../assets/icons';
import { AiHighlightSection } from '../../components/home/AiHighlightSection';
import { MedicationCard } from '../../components/home/MedicationCard';
import { getDailyMedicationsMock } from '../../mocks/home/dailyMedications.mock';
import { useApp } from '../../hooks/useApp';
import type { DailyMedicationItem } from '../../types';

export function HomeScreen() {
  const { activeProfile } = useApp();

  // Dados mockados sincronizados com o perfil ativo
  const initialMocks = useMemo(() => getDailyMedicationsMock(activeProfile), [activeProfile]);
  const [medications, setMedications] = useState<DailyMedicationItem[]>(initialMocks);

  // Atualiza os dados quando o perfil ativo mudar
  useMemo(() => {
    setMedications(getDailyMedicationsMock(activeProfile));
  }, [activeProfile]);

  const handleToggleStatus = (id: string) => {
    setMedications((prev) =>
      prev.map((med) =>
        med.id === id
          ? { ...med, status: med.status === 'completed' ? 'pending' : 'completed' }
          : med
      )
    );
  };

  const displayName = activeProfile?.name || 'Camilla';

  return (
    <div
      className="home-screen"
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
      {/* Conteúdo rolável da Home */}
      <div
        className="home-content"
        style={{
          width: '100%',
          padding: '24px 24px 0 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Marca Doses */}
        <header
          className="home-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginTop: 8,
          }}
        >
          <DosesLogo width={74} height={58} />
        </header>

        {/* Mensagem de Boas-vindas */}
        <div
          className="home-greeting"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 32,
              lineHeight: 1.2,
              color: '#000000',
              margin: 0,
            }}
          >
            Olá, {displayName}!
          </h1>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 32,
              lineHeight: 1.2,
              color: '#000000',
              margin: 0,
            }}
          >
            Como posso te ajudar?
          </h2>
        </div>

        {/* Região de Destaque com Inteligência Artificial */}
        <AiHighlightSection />

        {/* Lista de Medicamentos do Dia */}
        <section
          aria-label="Lista de medicamentos do dia"
          className="medication-section"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 8,
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 26,
              lineHeight: 1.2,
              color: '#000000',
              margin: 0,
              marginBottom: 4,
            }}
          >
            Medicamentos do dia
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {medications.map((item) => (
              <MedicationCard
                key={item.id}
                item={item}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        </section>

        {/* Espaço reservado para a navegação inferior flutuante não cobrir a lista */}
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
