import { useState } from 'react';
import { useApp } from '../../../hooks/useApp';
import { useMedications } from '../hooks/useMedications';
import { MedicationManagementCard } from '../components/MedicationManagementCard';
import { MedicationFormModal } from '../components/MedicationFormModal';
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog';
import { MedicamentosTabIcon } from '../../../assets/icons';
import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';

export function MedicationsScreen() {
  const { activeProfile } = useApp();
  const profileId = activeProfile?.id;
  const profileName = activeProfile?.name || 'Camilla';
  const profileAvatar = activeProfile?.avatar || 'young-woman';

  const {
    medications,
    isLoading,
    isSubmitting,
    error,
    refresh,
    createMedication,
    updateMedication,
    deleteMedication,
  } = useMedications({ profileId });

  // Modal / Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleOpenCreate = () => {
    setEditingMedication(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (medication: Medication) => {
    setMedicationToDelete(medication);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (
    data: Omit<CreateMedicationDTO, 'profileId'> | UpdateMedicationDTO
  ) => {
    if (editingMedication) {
      await updateMedication(editingMedication.id, data as UpdateMedicationDTO);
      showToast(`Medicamento "${data.name || editingMedication.name}" atualizado com sucesso!`);
    } else {
      await createMedication(data as Omit<CreateMedicationDTO, 'profileId'>);
      showToast(`Medicamento "${data.name}" cadastrado com sucesso!`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!medicationToDelete) return;
    try {
      await deleteMedication(medicationToDelete.id);
      showToast(`Medicamento "${medicationToDelete.name}" removido com sucesso.`);
      setIsDeleteDialogOpen(false);
      setMedicationToDelete(null);
    } catch {
      // Handled by hook error state
    }
  };

  const activeCount = medications.length;
  const activeCountLabel =
    activeCount === 1 ? '1 medicamento ativo' : `${activeCount} medicamentos ativos`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#FFFFFF',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 402,
          padding: '20px 24px 130px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Apresentação (Figma node 301:6716 & 301:6888) */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'Urbanist, sans-serif',
              fontWeight: 600,
              fontSize: '36px',
              lineHeight: '1.2',
              color: '#000203',
            }}
          >
            Medicamentos
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: 'Open Sans, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: '#565651',
            }}
          >
            Perfil de {profileName}
          </p>
        </header>

        {/* Error notification banner */}
        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #F87171',
              borderRadius: '20px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ color: '#991B1B', fontSize: '14px', fontFamily: 'Open Sans, sans-serif' }}>
              {error}
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              style={{
                backgroundColor: '#000203',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Content State: Loading, Empty or List */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  height: '140px',
                  backgroundColor: '#F1F5F9',
                  borderRadius: '20px',
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
            ))}
          </div>
        ) : medications.length === 0 ? (
          /* Estado Vazio (Figma node 301:6880 - Medicamentos · Estado vazio · Doses) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '28px',
              paddingTop: '40px',
              paddingBottom: '20px',
              width: '100%',
            }}
          >
            {/* Símbolo de medicamentos */}
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: '50%',
                backgroundColor: '#E6F4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MedicamentosTabIcon active size={56} />
            </div>

            {/* Mensagem de acolhimento (Figma node 301:6894) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'Urbanist, sans-serif',
                  fontWeight: 400,
                  fontSize: '32px',
                  color: '#000000',
                  lineHeight: 'normal',
                }}
              >
                Tudo começa por aqui
              </h2>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000203',
                  lineHeight: 'normal',
                }}
              >
                Ainda não há medicamentos no perfil de {profileName}. Adicione o primeiro para
                organizar seus horários.
              </p>
            </div>

            {/* Doses / Botão principal (Figma node 301:6891 DosesBotaoPrincipal) */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="primary-action-button"
              style={{
                width: '100%',
                minHeight: '96px',
                borderRadius: '20px',
                backgroundColor: '#000203',
                color: '#FFFFFF',
                fontFamily: 'Urbanist, sans-serif',
                fontWeight: 700,
                fontSize: '20px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              Adicionar primeiro medicamento
            </button>
          </div>
        ) : (
          /* Listagem de medicamentos ativos (Figma node 301:6719) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {/* Quantidade */}
            <p
              style={{
                margin: 0,
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: '#565651',
              }}
            >
              {activeCountLabel}
            </p>

            {/* Lista de medicamentos com cartões e ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {medications.map((medication) => (
                <MedicationManagementCard
                  key={medication.id}
                  medication={medication}
                  profileName={profileName}
                  profileAvatar={profileAvatar}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                />
              ))}
            </div>

            {/* Doses / Botão principal: Adicionar medicamento (Figma node 301:6707) */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="primary-action-button"
              style={{
                width: '100%',
                minHeight: '96px',
                borderRadius: '20px',
                backgroundColor: '#000203',
                color: '#FFFFFF',
                fontFamily: 'Urbanist, sans-serif',
                fontWeight: 700,
                fontSize: '20px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
                marginTop: '8px',
              }}
            >
              Adicionar medicamento
            </button>
          </div>
        )}

        {/* Modal / Tela de Cadastro e Edição (Figma nodes 301:6972 & 301:7018) */}
        <MedicationFormModal
          isOpen={isFormOpen}
          initialData={editingMedication}
          profileName={profileName}
          isSubmitting={isSubmitting}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
        />

        {/* Confirmação de Remoção (Figma node 301:7073 / 301:7246) */}
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          medication={medicationToDelete}
          profileName={profileName}
          isSubmitting={isSubmitting}
          onCancel={() => {
            setIsDeleteDialogOpen(false);
            setMedicationToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
        />

        {/* Toast flutuante de sucesso */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#000203',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: '24px',
              fontSize: '15px',
              fontFamily: 'Urbanist, sans-serif',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0, 37, 78, 0.25)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '90%',
              textAlign: 'center',
            }}
          >
            <span>✓</span> {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
