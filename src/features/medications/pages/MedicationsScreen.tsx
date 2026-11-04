import { useState } from 'react';
import { useApp } from '../../../hooks/useApp';
import { useMedications } from '../hooks/useMedications';
import { MedicationManagementCard } from '../components/MedicationManagementCard';
import { MedicationFormModal } from '../components/MedicationFormModal';
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog';
import { AvatarRenderer } from '../../../components/profile/AvatarRenderer';
import { PlusIcon } from '../../../assets/icons';
import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';

export function MedicationsScreen() {
  const { activeProfile } = useApp();
  const profileId = activeProfile?.id;

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

  // Modal states
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 402,
          padding: '24px 20px 120px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header Section */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '26px',
                fontWeight: 700,
                color: '#00254E',
                fontFamily: 'Urbanist, sans-serif',
              }}
            >
              Medicamentos
            </h1>
            {activeProfile && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden' }}>
                  <AvatarRenderer avatar={activeProfile.avatar} size={20} />
                </div>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4B5563',
                    fontFamily: 'Open Sans, sans-serif',
                  }}
                >
                  Perfil de {activeProfile.name}
                </span>
              </div>
            )}
          </div>

          {/* Add New Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            aria-label="Cadastrar novo medicamento"
            style={{
              backgroundColor: '#00254E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0, 37, 78, 0.2)',
            }}
          >
            <PlusIcon size={18} />
            <span>Novo</span>
          </button>
        </header>

        {/* Error notification banner */}
        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #F87171',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ color: '#991B1B', fontSize: '14px', fontWeight: 500 }}>
              {error}
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: '12px',
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              paddingTop: '20px',
            }}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: '110px',
                  backgroundColor: '#E2E8F0',
                  borderRadius: 20,
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
            ))}
          </div>
        ) : medications.length === 0 ? (
          /* Empty State */
          <div
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              boxShadow: '0 2px 8px rgba(0, 37, 78, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#E6F4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
              }}
            >
              💊
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#00254E',
                fontFamily: 'Urbanist, sans-serif',
              }}
            >
              Nenhum medicamento cadastrado
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: '#6B7280',
                maxWidth: 280,
                lineHeight: '1.4',
                fontFamily: 'Open Sans, sans-serif',
              }}
            >
              Organize os horários e dosagens de {activeProfile?.name || 'seu perfil'}.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                marginTop: '8px',
                backgroundColor: '#00254E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 14,
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <PlusIcon size={18} /> Adicionar medicamento
            </button>
          </div>
        ) : (
          /* Medication List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {medications.map((medication) => (
              <MedicationManagementCard
                key={medication.id}
                medication={medication}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
              />
            ))}
          </div>
        )}

        {/* Form Modal (Create or Edit) */}
        <MedicationFormModal
          isOpen={isFormOpen}
          initialData={editingMedication}
          isSubmitting={isSubmitting}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          medication={medicationToDelete}
          isSubmitting={isSubmitting}
          onCancel={() => {
            setIsDeleteDialogOpen(false);
            setMedicationToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
        />

        {/* Floating Toast notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#00254E',
              color: '#FFFFFF',
              padding: '12px 20px',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 37, 78, 0.25)',
              zIndex: 1100,
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
