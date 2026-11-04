import { useState, FormEvent } from 'react';
import { CloseIcon, PlusIcon } from '../../assets/icons';
import { FormField } from '../forms/FormField';
import type { ReceitaMedicaItem, Profile, AvatarId } from '../../types';

interface ReceitaFormModalProps {
  isOpen: boolean;
  initialData?: ReceitaMedicaItem | null;
  profiles: Profile[];
  activeProfile: Profile | null;
  onClose: () => void;
  onSave: (receita: ReceitaMedicaItem) => void;
}

const PASTEL_COLORS = [
  { label: 'Azul Claro', value: '#B4ECFB' },
  { label: 'Verde Menta', value: '#BBF9E0' },
  { label: 'Rosa Claro', value: '#FBD4EC' },
  { label: 'Amarelo Creme', value: '#FFF4DA' },
];

export function ReceitaFormModal({
  isOpen,
  initialData,
  profiles,
  activeProfile,
  onClose,
  onSave,
}: ReceitaFormModalProps) {
  if (!isOpen) return null;

  const isEditing = Boolean(initialData);

  const [specialty, setSpecialty] = useState(initialData?.specialty || '');
  const [doctorName, setDoctorName] = useState(initialData?.doctorName || '');
  const [crm, setCrm] = useState(initialData?.crm || '');
  const [clinicOrHospital, setClinicOrHospital] = useState(initialData?.clinicOrHospital || '');
  const [emissionDate, setEmissionDate] = useState(
    initialData?.emissionDate || new Date().toLocaleDateString('pt-BR')
  );
  const [expirationDate, setExpirationDate] = useState(initialData?.expirationDate || '');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [cardColor, setCardColor] = useState(initialData?.cardColor || '#B4ECFB');

  // Perfil selecionado
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialData?.profileId || activeProfile?.id || (profiles[0] ? profiles[0].id : '')
  );

  // Lista de medicamentos receitados
  const [medications, setMedications] = useState<string[]>(initialData?.medications || []);
  const [newMedicationInput, setNewMedicationInput] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleAddMedication = () => {
    const trimmed = newMedicationInput.trim();
    if (!trimmed) return;
    if (!medications.includes(trimmed)) {
      setMedications([...medications, trimmed]);
    }
    setNewMedicationInput('');
  };

  const handleRemoveMedication = (indexToRemove: number) => {
    setMedications(medications.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!specialty.trim()) newErrors.specialty = 'Informe a especialidade ou título.';
    if (!doctorName.trim()) newErrors.doctorName = 'Informe o nome do médico ou profissional.';
    if (!emissionDate.trim()) newErrors.emissionDate = 'Informe a data de emissão.';
    if (medications.length === 0) newErrors.medications = 'Adicione ao menos um medicamento à receita.';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const chosenProfile = profiles.find((p) => p.id === selectedProfileId) || activeProfile;
    const profileName = chosenProfile ? chosenProfile.name : 'Camilla';
    const avatar: AvatarId = chosenProfile ? chosenProfile.avatar : 'young-woman';

    const savedReceita: ReceitaMedicaItem = {
      id: initialData?.id || `rec-${Date.now()}`,
      profileId: chosenProfile?.id,
      profileName,
      avatar,
      specialty: specialty.trim(),
      doctorName: doctorName.trim(),
      crm: crm.trim() || undefined,
      clinicOrHospital: clinicOrHospital.trim() || undefined,
      emissionDate: emissionDate.trim(),
      expirationDate: expirationDate.trim() || undefined,
      medications,
      instructions: instructions.trim() || undefined,
      cardColor,
    };

    onSave(savedReceita);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-form-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 2, 3, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 220,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        className="receita-form-sheet"
        style={{
          width: '100%',
          maxWidth: 402,
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do modal */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <h2
            id="modal-form-title"
            style={{
              margin: 0,
              fontSize: 20,
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: '#000000',
            }}
          >
            {isEditing ? 'Editar Receita Médica' : 'Nova Receita Médica'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            style={{
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        {/* Formulário com scroll */}
        <form
          id="receita-form"
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxSizing: 'border-box',
          }}
        >
          {/* Perfil associado (se houver mais de 1) */}
          {profiles.length > 1 && (
            <div className="form-group">
              <label htmlFor="field-profile" className="form-label">
                Paciente / Perfil
              </label>
              <div className="input-wrapper">
                <select
                  id="field-profile"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'transparent' }}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isMainProfile ? '(Principal)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Especialidade / Título */}
          <FormField
            label="Especialidade ou Título"
            placeholder="Ex: Cardiologista, Nutricionista..."
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            error={errors.specialty}
          />

          {/* Médico / Profissional */}
          <FormField
            label="Médico / Profissional Responsável"
            placeholder="Ex: Dra. Ana Martins"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            error={errors.doctorName}
          />

          {/* CRM e Clínica */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FormField
                label="CRM / Registro"
                placeholder="Ex: CRM/SP 123456"
                value={crm}
                onChange={(e) => setCrm(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <FormField
                label="Data de Emissão"
                placeholder="DD/MM/AAAA"
                value={emissionDate}
                onChange={(e) => setEmissionDate(e.target.value)}
                error={errors.emissionDate}
              />
            </div>
          </div>

          <FormField
            label="Clínica / Hospital (opcional)"
            placeholder="Ex: Hospital do Coração"
            value={clinicOrHospital}
            onChange={(e) => setClinicOrHospital(e.target.value)}
          />

          <FormField
            label="Data de Validade (opcional)"
            placeholder="DD/MM/AAAA"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />

          {/* Seção de Adicionar Medicamentos */}
          <div className="form-group">
            <label className="form-label" htmlFor="field-new-med">
              Medicamentos Prescritos *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="field-new-med"
                type="text"
                placeholder="Ex: Losartana 50 mg"
                value={newMedicationInput}
                onChange={(e) => setNewMedicationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                className="input-field"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAddMedication}
                style={{
                  backgroundColor: '#4E6D93',
                  color: '#FFFFFF',
                  borderRadius: 16,
                  padding: '0 16px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Adicionar medicamento à lista"
              >
                <PlusIcon size={20} />
              </button>
            </div>
            {errors.medications && (
              <span className="field-error-text" role="alert" style={{ marginTop: 4 }}>
                {errors.medications}
              </span>
            )}

            {/* Tags adicionadas */}
            {medications.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {medications.map((med, idx) => (
                  <span
                    key={`${med}-${idx}`}
                    style={{
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 13,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      color: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {med}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label={`Remover ${med}`}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Instruções / Posologia */}
          <div className="form-group">
            <label className="form-label" htmlFor="field-instructions">
              Instruções de Uso & Posologia
            </label>
            <div className="input-wrapper" style={{ height: 'auto', padding: '8px 12px' }}>
              <textarea
                id="field-instructions"
                rows={3}
                placeholder="Ex: Tomar 1 comprimido pela manhã em jejum..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Seletor de Cor do Card (Paleta do Figma) */}
          <div className="form-group">
            <span className="form-label">Cor do Card (Design Doses)</span>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {PASTEL_COLORS.map((c) => {
                const isSelected = cardColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCardColor(c.value)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: isSelected ? '3px solid #000203' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                    title={c.label}
                    aria-label={`Selecionar cor ${c.label}`}
                  />
                );
              })}
            </div>
          </div>
        </form>

        {/* Rodapé com botões de ação */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 20,
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#4E6D93',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="receita-form"
            className="primary-action-button"
            style={{
              flex: 2,
              height: 48,
              borderRadius: 20,
              backgroundColor: '#000203',
              color: '#FFFFFF',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 18,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Salvar alterações' : 'Salvar receita'}
          </button>
        </div>
      </div>
    </div>
  );
}
