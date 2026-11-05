import { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { PrescriptionClientService } from '../../services/api/prescriptionClientService';
import { ReceitaCard } from '../../components/receitas/ReceitaCard';
import { FloatingAddButton } from '../../components/receitas/FloatingAddButton';
import { ReceitaDetailModal } from '../../components/receitas/ReceitaDetailModal';
import { ReceitaFormModal } from '../../components/receitas/ReceitaFormModal';
import { FileTextIcon, PlusIcon } from '../../assets/icons';
import type { ReceitaMedicaItem } from '../../types';

export function ReceitasScreen() {
  const { activeProfile, profiles } = useApp();

  const [receitas, setReceitas] = useState<ReceitaMedicaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados dos modais
  const [selectedReceita, setSelectedReceita] = useState<ReceitaMedicaItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<ReceitaMedicaItem | null>(null);

  // Feedback toast
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000);
  };

  useEffect(() => {
    let isMounted = true;
    if (!activeProfile) {
      setReceitas([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    PrescriptionClientService.listPrescriptions(activeProfile.id, activeProfile.name, activeProfile.avatar)
      .then((items) => {
        if (!isMounted) return;
        setReceitas(items);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeProfile]);

  const handleOpenAccess = (item: ReceitaMedicaItem) => {
    setSelectedReceita(item);
  };

  const handleStartCreate = () => {
    setEditingReceita(null);
    setIsFormOpen(true);
  };

  const handleStartEdit = (item: ReceitaMedicaItem) => {
    setSelectedReceita(null);
    setEditingReceita(item);
    setIsFormOpen(true);
  };

  const handleSaveReceita = async (savedItem: ReceitaMedicaItem) => {
    if (!activeProfile) return;
    const exists = receitas.some((r) => r.id === savedItem.id);
    if (exists) {
      const updated = await PrescriptionClientService.updatePrescription(
        activeProfile.id,
        savedItem.id,
        activeProfile.name,
        activeProfile.avatar,
        savedItem
      );
      setReceitas((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showToast('Receita atualizada com sucesso!');
    } else {
      const created = await PrescriptionClientService.createPrescription(
        activeProfile.id,
        activeProfile.name,
        activeProfile.avatar,
        savedItem
      );
      setReceitas((prev) => [created, ...prev]);
      showToast('Receita cadastrada com sucesso!');
    }
  };

  const handleDeleteReceita = async (receitaId: string) => {
    if (!activeProfile) return;
    await PrescriptionClientService.deletePrescription(activeProfile.id, receitaId);
    setReceitas((prev) => prev.filter((r) => r.id !== receitaId));
    showToast('Receita removida.');
  };

  return (
    <div
      className="receitas-screen"
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
      aria-label="Tela de Receitas Médicas"
    >
      {/* Toast de Feedback */}
      {feedbackMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#00254E',
            color: '#FFFFFF',
            borderRadius: 16,
            padding: '10px 20px',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 300,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease-out',
            maxWidth: 354,
            textAlign: 'center',
          }}
        >
          {feedbackMessage}
        </div>
      )}

      {/* Conteúdo principal rolável */}
      <div
        className="receitas-content"
        style={{
          width: '100%',
          padding: '24px 24px calc(200px + env(safe-area-inset-bottom, 0px)) 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Título da tela conforme Figma (Node 222:310: 36px Urbanist SemiBold) */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
            Minhas receitas
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: '#4E6D93',
              margin: 0,
            }}
          >
            {activeProfile
              ? `Receitas cadastradas para o cuidado de ${activeProfile.name}`
              : 'Consulte e acompanhe suas prescrições e medicamentos'}
          </p>
        </header>

        {/* Indicador de Carregamento */}
        {isLoading && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#4E6D93',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
            }}
          >
            Carregando receitas médicas...
          </div>
        )}

        {/* Lista de receitas */}
        {!isLoading && receitas.length === 0 ? (
          <div
            className="empty-receitas-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              backgroundColor: '#F8FAFC',
              borderRadius: 20,
              border: '1px dashed #CBD5E1',
              textAlign: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#B4ECFB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00254E',
              }}
            >
              <FileTextIcon size={28} />
            </div>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#000000',
                  margin: '0 0 4px 0',
                }}
              >
                Nenhuma receita cadastrada
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#64748B',
                  margin: 0,
                }}
              >
                Cadastre sua primeira receita médica para acompanhar medicamentos e posologias.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartCreate}
              style={{
                backgroundColor: '#000203',
                color: '#FFFFFF',
                borderRadius: 20,
                padding: '12px 24px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <PlusIcon size={20} />
              Adicionar primeira receita
            </button>
          </div>
        ) : (
          !isLoading && (
            <div
              className="receitas-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
              aria-label="Lista de receitas médicas"
            >
              {receitas.map((receita) => (
                <ReceitaCard
                  key={receita.id}
                  receita={receita}
                  onAccess={handleOpenAccess}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Botão Flutuante Adicionar Receita (Figma 222:384) */}
      <FloatingAddButton onClick={handleStartCreate} />

      {/* Modal de Detalhes da Receita */}
      <ReceitaDetailModal
        receita={selectedReceita}
        onClose={() => setSelectedReceita(null)}
        onEdit={handleStartEdit}
        onDelete={handleDeleteReceita}
      />

      {/* Modal de Criação / Edição de Receita */}
      <ReceitaFormModal
        isOpen={isFormOpen}
        initialData={editingReceita}
        profiles={profiles}
        activeProfile={activeProfile}
        onClose={() => {
          setIsFormOpen(false);
          setEditingReceita(null);
        }}
        onSave={handleSaveReceita}
      />
    </div>
  );
}
