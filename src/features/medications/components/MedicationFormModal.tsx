import React, { useState, useEffect } from 'react';
import type {
  CreateMedicationDTO,
  Medication,
  MedicationRecurrence,
  RecurrenceType,
  UpdateMedicationDTO,
} from '../types/medication';
import { OnboardingHeader } from '../../../components/ui/OnboardingHeader';
import { PlusIcon, CloseIcon } from '../../../assets/icons';
import { MedicationTimePickerSheet } from './MedicationTimePickerSheet';

interface MedicationFormModalProps {
  isOpen: boolean;
  initialData?: Medication | null;
  profileName?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateMedicationDTO, 'profileId'> | UpdateMedicationDTO) => Promise<void>;
}

const COLOR_OPTIONS = [
  { value: '#B4ECFB', label: 'Azul' },
  { value: '#FFF6E1', label: 'Amarelo' },
  { value: '#BBF9E0', label: 'Verde Menta' },
  { value: '#E8F4F1', label: 'Verde Claro' },
];

const WEEK_DAYS = [
  { id: 1, label: 'Seg', name: 'segundas', prep: 'às' },
  { id: 2, label: 'Ter', name: 'terças', prep: 'às' },
  { id: 3, label: 'Qua', name: 'quartas', prep: 'às' },
  { id: 4, label: 'Qui', name: 'quintas', prep: 'às' },
  { id: 5, label: 'Sex', name: 'sextas', prep: 'às' },
  { id: 6, label: 'Sáb', name: 'sábados', prep: 'aos' },
  { id: 0, label: 'Dom', name: 'domingos', prep: 'aos' },
];

function formatDaysSentence(selectedDayIds: number[]): string {
  if (selectedDayIds.length === 0) return 'Selecione pelo menos um dia.';
  if (selectedDayIds.length === 7) return 'Repetir todos os dias.';

  const sorted = WEEK_DAYS.filter((d) => selectedDayIds.includes(d.id));
  if (sorted.length === 1) {
    return `Repetir ${sorted[0].prep} ${sorted[0].name}.`;
  }

  const names = sorted.map((d) => d.name);
  const last = names.pop();
  const joined = `${names.join(', ')} e ${last}`;
  const firstPrep = sorted[0].prep;
  return `Repetir ${firstPrep} ${joined}.`;
}

export const MedicationFormModal: React.FC<MedicationFormModalProps> = ({
  isOpen,
  initialData,
  profileName = 'Camilla',
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [schedules, setSchedules] = useState<string[]>(['08:00']);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex padrão do Figma
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(8);
  const [instructions, setInstructions] = useState('');
  const [cardColor, setCardColor] = useState('#B4ECFB');

  const [errors, setErrors] = useState<{ name?: string; schedules?: string }>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSchedules([...initialData.schedules]);
      setRecurrenceType(initialData.recurrence.type);
      setWeeklyDays(initialData.recurrence.daysOfWeek || [1, 3, 5]);
      setCustomIntervalHours(initialData.recurrence.interval || 8);
      setInstructions(initialData.instructions || '');
      setCardColor(initialData.cardColor || '#B4ECFB');
    } else {
      setName('');
      setSchedules([]);
      setRecurrenceType('daily');
      setWeeklyDays([1, 3, 5]);
      setCustomIntervalHours(8);
      setInstructions('');
      setCardColor('#B4ECFB');
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleAddTime = (timeToAdd: string) => {
    setErrors((prev) => ({ ...prev, schedules: undefined }));
    if (!schedules.includes(timeToAdd)) {
      setSchedules((prev) => [...prev, timeToAdd].sort());
    }
  };

  const handleRemoveTime = (timeToRemove: string) => {
    setSchedules((prev) => prev.filter((t) => t !== timeToRemove));
  };

  const toggleDayOfWeek = (dayId: number) => {
    setWeeklyDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; schedules?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Informe o nome do medicamento.';
    }

    if (schedules.length === 0) {
      newErrors.schedules = 'Adicione pelo menos um horário.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const recurrence: MedicationRecurrence = {
      type: recurrenceType,
      ...(recurrenceType === 'weekly' ? { daysOfWeek: weeklyDays } : {}),
      ...(recurrenceType === 'custom' ? { interval: customIntervalHours } : {}),
    };

    try {
      await onSubmit({
        name: name.trim(),
        schedules,
        recurrence,
        instructions: instructions.trim() || undefined,
        cardColor,
        status: 'active',
      });
      onClose();
    } catch {
      // Handled by parent
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar medicamento' : 'Adicionar medicamento'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FFFFFF',
        zIndex: 1050,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 402,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Top bar with back button and Doses logo */}
        <OnboardingHeader onBack={onClose} showBack />

        {/* Content Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '0 24px 24px 24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '8px' }}>
            {/* Apresentação (Figma nodes 301:6991 & 301:7037) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                {isEditing ? 'Editar medicamento' : 'Adicionar medicamento'}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000203',
                }}
              >
                Organize os horários de {profileName}.
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'Urbanist, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  color: '#565651',
                }}
              >
                * Campos obrigatórios
              </p>
            </div>

            {/* Nome do medicamento (Figma nodes 301:6995 & 301:7730) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                htmlFor="medication-name-input"
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000000',
                }}
              >
                Nome do medicamento *
              </label>
              <div
                style={{
                  height: '56px',
                  borderRadius: '20px',
                  border: errors.name ? '2px solid #000000' : '1px solid #4E6D93',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <input
                  id="medication-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Digite o nome do medicamento"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '16px', // Previne zoom no iOS PWA
                    color: '#000203',
                  }}
                />
              </div>
              {errors.name && (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    fontFamily: 'Urbanist, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#000000',
                  }}
                >
                  {errors.name}
                </p>
              )}
            </div>

            {/* Horários (Figma nodes 301:6999, 301:7045 & 301:7735) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000000',
                }}
              >
                Horários *
              </span>

              {/* Added times chips */}
              {schedules.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '4px',
                  }}
                >
                  {schedules.map((time) => (
                    <div
                      key={time}
                      style={{
                        height: '56px',
                        width: '165px',
                        maxWidth: 'calc(50% - 6px)',
                        borderRadius: '20px',
                        border: '1px solid #4E6D93',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingLeft: '16px',
                        paddingRight: '4px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Open Sans, sans-serif',
                          fontWeight: 600,
                          fontSize: '20px',
                          color: '#000000',
                        }}
                      >
                        {time}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTime(time)}
                        aria-label={`Remover horário ${time}`}
                        style={{
                          width: '44px',
                          height: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#000203',
                        }}
                      >
                        <CloseIcon size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão Secundário: Adicionar horário (Figma node 301:7001) */}
              <button
                type="button"
                onClick={() => setIsTimePickerOpen(true)}
                style={{
                  height: '56px',
                  width: '100%',
                  borderRadius: '20px',
                  border: errors.schedules ? '2px solid #000000' : '1px solid #000203',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontFamily: 'Urbanist, sans-serif',
                  fontWeight: 600,
                  fontSize: '20px',
                  color: '#000203',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <PlusIcon size={22} />
                <span>Adicionar horário</span>
              </button>

              <p
                style={{
                  margin: 0,
                  fontFamily: 'Urbanist, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  color: errors.schedules ? '#000000' : '#565651',
                }}
              >
                {errors.schedules || 'Selecione um ou mais horários.'}
              </p>
            </div>

            {/* Repetições (Figma nodes 301:7005 & 301:7324) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000000',
                }}
              >
                Repetições
              </span>

              {/* Frequency options pills (Figma node 301:7007) */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRecurrenceType('daily')}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '999px',
                    border: '1px solid #000203',
                    backgroundColor: recurrenceType === 'daily' ? '#000203' : '#FFFFFF',
                    color: recurrenceType === 'daily' ? '#FFFFFF' : '#000203',
                    fontFamily: 'Open Sans, sans-serif',
                    fontWeight: recurrenceType === 'daily' ? 600 : 400,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Todos os dias
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrenceType('weekly')}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '999px',
                    border: '1px solid #000203',
                    backgroundColor: recurrenceType === 'weekly' ? '#000203' : '#FFFFFF',
                    color: recurrenceType === 'weekly' ? '#FFFFFF' : '#000203',
                    fontFamily: 'Open Sans, sans-serif',
                    fontWeight: recurrenceType === 'weekly' ? 600 : 400,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Dias da semana
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrenceType('custom')}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '999px',
                    border: '1px solid #000203',
                    backgroundColor: recurrenceType === 'custom' ? '#000203' : '#FFFFFF',
                    color: recurrenceType === 'custom' ? '#FFFFFF' : '#000203',
                    fontFamily: 'Open Sans, sans-serif',
                    fontWeight: recurrenceType === 'custom' ? 600 : 400,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Personalizado
                </button>
              </div>

              {/* Weekly selection (Figma node 301:7373) */}
              {recurrenceType === 'weekly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'Open Sans, sans-serif',
                      fontWeight: 400,
                      fontSize: '16px',
                      color: '#565651',
                    }}
                  >
                    Selecione os dias para repetir.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {WEEK_DAYS.map((d) => {
                      const isSelected = weeklyDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.id)}
                          style={{
                            height: '48px',
                            minWidth: '46px',
                            flex: '1 0 44px',
                            borderRadius: '999px',
                            border: '1px solid #000203',
                            backgroundColor: isSelected ? '#000203' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : '#000203',
                            fontFamily: 'Open Sans, sans-serif',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected && '✓ '}
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'Urbanist, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      color: '#565651',
                    }}
                  >
                    {formatDaysSentence(weeklyDays)}
                  </p>
                </div>
              )}

              {/* Custom Interval (Preserved functionality) */}
              {recurrenceType === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <label
                    htmlFor="custom-hours-interval"
                    style={{
                      fontFamily: 'Open Sans, sans-serif',
                      fontWeight: 400,
                      fontSize: '16px',
                      color: '#565651',
                    }}
                  >
                    Tomar a cada quantas horas?
                  </label>
                  <div
                    style={{
                      height: '56px',
                      borderRadius: '20px',
                      border: '1px solid #4E6D93',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 16px',
                    }}
                  >
                    <input
                      id="custom-hours-interval"
                      type="number"
                      min="1"
                      max="48"
                      value={customIntervalHours}
                      onChange={(e) => setCustomIntervalHours(Number(e.target.value))}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontFamily: 'Open Sans, sans-serif',
                        fontSize: '16px',
                        color: '#000203',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'Urbanist, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      color: '#565651',
                    }}
                  >
                    Repetir a cada {customIntervalHours} horas.
                  </p>
                </div>
              )}
            </div>

            {/* Instruções / Dosagem (Preserved functionality) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                htmlFor="instructions-field"
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000000',
                }}
              >
                Instruções e dosagem (opcional)
              </label>
              <textarea
                id="instructions-field"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: 1 cápsula em jejum com água"
                style={{
                  width: '100%',
                  borderRadius: '20px',
                  border: '1px solid #4E6D93',
                  backgroundColor: '#FFFFFF',
                  padding: '14px 16px',
                  fontFamily: 'Open Sans, sans-serif',
                  fontSize: '16px',
                  color: '#000203',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'none',
                }}
              />
            </div>

            {/* Cor de identificação (Preserved functionality) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#000000',
                }}
              >
                Cor de identificação
              </span>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = cardColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCardColor(c.value)}
                      aria-label={`Cor ${c.label}`}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: c.value,
                        border: isSelected ? '3px solid #000203' : '1px solid rgba(0, 0, 0, 0.2)',
                        boxShadow: isSelected ? '0 0 0 2px #FFFFFF inset' : 'none',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Conclusão (Figma nodes 301:7012 & 301:7067) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingTop: '32px',
              paddingBottom: '20px',
            }}
          >
            <button
              type="submit"
              disabled={isSubmitting}
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
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
            >
              {isSubmitting
                ? 'Salvando...'
                : isEditing
                ? 'Salvar alterações'
                : 'Salvar medicamento'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: '#000203',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>

        {/* Mobile Time Picker Sheet */}
        <MedicationTimePickerSheet
          isOpen={isTimePickerOpen}
          onClose={() => setIsTimePickerOpen(false)}
          onSelectTime={handleAddTime}
        />
      </div>
    </div>
  );
};
