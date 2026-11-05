import { useNavigate } from 'react-router-dom';
import { DosesLogo } from '../../assets/icons';
import { AiHighlightSection } from '../../components/home/AiHighlightSection';
import { MedicationCard } from '../../components/home/MedicationCard';
import { useApp } from '../../hooks/useApp';
import { useDailyDoses } from '../../features/medications/hooks/useDailyDoses';

export function HomeScreen() {
  const { activeProfile } = useApp();
  const navigate = useNavigate();

  const {
    doses,
    totalMedicationsCount,
    isLoading,
    error,
    refresh,
    toggleDoseStatus,
  } = useDailyDoses({ activeProfile });

  const displayName = activeProfile?.name || 'você';

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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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

            {!isLoading && doses.length > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#4E6D93',
                  fontWeight: 600,
                }}
              >
                {doses.filter((d) => d.status === 'completed').length}/{doses.length} tomados
              </span>
            )}
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                backgroundColor: '#F8FAFC',
                borderRadius: 20,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: '#4E6D93',
                  margin: 0,
                }}
              >
                Carregando medicamentos do dia...
              </p>
            </div>
          )}

          {/* Estado de Erro */}
          {!isLoading && error && (
            <div
              role="alert"
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--color-bg-error, #FFEBEE)',
                border: '1px solid var(--color-border-error, #E53935)',
                borderRadius: 16,
                color: '#C62828',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
              <button
                type="button"
                onClick={() => refresh()}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: 'none',
                  color: '#000000',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  padding: 0,
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado Vazio 1: Perfil não possui nenhum medicamento cadastrado */}
          {!isLoading && !error && totalMedicationsCount === 0 && (
            <div
              style={{
                padding: '28px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: 20,
                border: '1px dashed #CBD5E1',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#000000',
                  margin: 0,
                }}
              >
                Nenhum medicamento cadastrado
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#475569',
                  margin: 0,
                  maxWidth: 280,
                }}
              >
                Cadastre os medicamentos de {displayName} para acompanhar as doses de hoje.
              </p>
              <button
                type="button"
                onClick={() => navigate('/medicamentos')}
                className="primary-action-button"
                style={{
                  minHeight: 48,
                  height: 48,
                  padding: '10px 20px',
                  fontSize: 16,
                  marginTop: 8,
                }}
              >
                Cadastrar medicamento
              </button>
            </div>
          )}

          {/* Estado Vazio 2: Perfil tem medicamentos, mas nenhum previsto para hoje */}
          {!isLoading && !error && totalMedicationsCount > 0 && doses.length === 0 && (
            <div
              style={{
                padding: '28px 20px',
                backgroundColor: '#F0FDF4',
                borderRadius: 20,
                border: '1px solid #BBF9E0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#166534',
                  margin: 0,
                }}
              >
                Nenhum medicamento para hoje
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#15803D',
                  margin: 0,
                }}
              >
                Tudo em ordem com os cuidados de {displayName} na data de hoje.
              </p>
            </div>
          )}

          {/* Lista de Doses Reais */}
          {!isLoading && !error && doses.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {doses.map((item) => (
                <MedicationCard
                  key={item.id}
                  item={item}
                  onToggleStatus={toggleDoseStatus}
                />
              ))}
            </div>
          )}
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
