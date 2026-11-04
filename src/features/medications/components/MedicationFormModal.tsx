import React, { useState, useEffect } from 'react';
import type { CreateMedicationDTO, Medication, MedicationRecurrence, RecurrenceType, UpdateMedicationDTO } from '../types/medication';
import { CloseIcon, PlusIcon, TrashIcon } from '../../../assets/icons';

interface MedicationFormModalProps {
  isOpen: boolean;
  initialData?: Medication | null;
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

const DAYS_OF_WEEK = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export const MedicationFormModal: React.FC<MedicationFormModalProps> = ({
  isOpen,
  initialData,
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [schedules, setSchedules] = useState<string[]>(['08:00']);
  const [newTime, setNewTime] = useState('12:00');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex default
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(8);
  const [instructions, setInstructions] = useState('');
  const [cardColor, setCardColor] = useState('#B4ECFB');

  const [errors, setErrors] = useState<{ name?: string; schedules?: string; timeInput?: string }>({});

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
      setSchedules(['08:00']);
      setNewTime('12:00');
      setRecurrenceType('daily');
      setWeeklyDays([1, 3, 5]);
      setCustomIntervalHours(8);
      setInstructions('');
      setCardColor('#B4ECFB');
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleAddTime = () => {
    setErrors((prev) => ({ ...prev, timeInput: undefined, schedules: undefined }));

    if (!newTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) {
      setErrors((prev) => ({ ...prev, timeInput: 'Horário inválido. Utilize o formato HH:mm.' }));
      return;
    }

    if (schedules.includes(newTime)) {
      setErrors((prev) => ({ ...prev, timeInput: 'Este horário já foi adicionado.' }));
      return;
    }

    setSchedules((prev) => [...prev, newTime].sort());
  };

  const handleRemoveTime = (timeToRemove: string) => {
    setSchedules((prev) => prev.filter((t) => t !== timeToRemove));
  };

  const toggleDayOfWeek = (dayId: number) => {
    setWeeklyDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; schedules?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'O nome do medicamento é obrigatório.';
    }

    if (schedules.length === 0) {
      newErrors.schedules = 'Adicione ao menos um horário para o medicamento.';
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
      // Error handling is handled in the hook / parent
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="medication-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(2px)',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          maxWidth: 420,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            id="medication-modal-title"
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: '#00254E',
              fontFamily: 'Urbanist, sans-serif',
            }}
          >
            {isEditing ? 'Editar medicamento' : 'Novo medicamento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#6B7280',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Nome do medicamento */}
            <div>
              <label
                htmlFor="med-name"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1F2937',
                  marginBottom: '6px',
                }}
              >
                Nome do medicamento *
              </label>
              <input
                id="med-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Ex: Vitamina D, Novalgina 500mg"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: errors.name ? '1.5px solid #EF4444' : '1px solid #D1D5DB',
                  fontSize: '16px', // Prevents iOS zoom
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {errors.name && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#EF4444' }}>{errors.name}</p>
              )}
            </div>

            {/* Horários */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1F2937',
                  marginBottom: '6px',
                }}
              >
                Horários programados *
              </label>

              {/* Added times list */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '10px',
                  minHeight: '36px',
                }}
              >
                {schedules.map((time) => (
                  <span
                    key={time}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#E6F4FF',
                      color: '#00254E',
                      fontWeight: 700,
                      fontSize: '14px',
                      padding: '4px 10px',
                      borderRadius: 10,
                      border: '1px solid #BAE6FD',
                    }}
                  >
                    ⏰ {time}
                    <button
                      type="button"
                      onClick={() => handleRemoveTime(time)}
                      aria-label={`Remover horário ${time}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add new time row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid #D1D5DB',
                    fontSize: '16px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTime}
                  style={{
                    backgroundColor: '#00254E',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <PlusIcon size={16} /> Adicionar
                </button>
              </div>

              {errors.timeInput && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#EF4444' }}>
                  {errors.timeInput}
                </p>
              )}
              {errors.schedules && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#EF4444' }}>
                  {errors.schedules}
                </p>
              )}
            </div>

            {/* Recorrência */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1F2937',
                  marginBottom: '6px',
                }}
              >
                Recorrência
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {[
                  { id: 'daily', label: 'Diário' },
                  { id: 'weekly', label: 'Semanal' },
                  { id: 'custom', label: 'Intervalo (h)' },
                ].map((type) => {
                  const isSelected = recurrenceType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setRecurrenceType(type.id as RecurrenceType)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: isSelected ? '2px solid #00254E' : '1px solid #D1D5DB',
                        backgroundColor: isSelected ? '#E6F4FF' : '#FFFFFF',
                        color: isSelected ? '#00254E' : '#4B5563',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>

              {/* Weekly selector */}
              {recurrenceType === 'weekly' && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                    Dias da semana:
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {DAYS_OF_WEEK.map((d) => {
                      const active = weeklyDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.id)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            borderRadius: 8,
                            border: active ? '1.5px solid #00254E' : '1px solid #D1D5DB',
                            backgroundColor: active ? '#00254E' : '#FFFFFF',
                            color: active ? '#FFFFFF' : '#374151',
                            fontSize: '11px',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom hours selector */}
              {recurrenceType === 'custom' && (
                <div style={{ marginTop: '8px' }}>
                  <label
                    htmlFor="custom-interval"
                    style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}
                  >
                    Tomar a cada quantas horas?
                  </label>
                  <input
                    id="custom-interval"
                    type="number"
                    min="1"
                    max="48"
                    value={customIntervalHours}
                    onChange={(e) => setCustomIntervalHours(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #D1D5DB',
                      fontSize: '15px',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Instruções / Dosagem */}
            <div>
              <label
                htmlFor="med-instructions"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1F2937',
                  marginBottom: '6px',
                }}
              >
                Instruções e dosagem (opcional)
              </label>
              <textarea
                id="med-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: 1 cápsula em jejum com água"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #D1D5DB',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'none',
                  fontFamily: 'Open Sans, sans-serif',
                }}
              />
            </div>

            {/* Cor do card */}
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1F2937',
                  marginBottom: '6px',
                }}
              >
                Cor de identificação
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = cardColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCardColor(c.value)}
                      title={c.label}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: c.value,
                        border: isSelected ? '3px solid #00254E' : '1px solid rgba(0, 0, 0, 0.15)',
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

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: '#374151',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                backgroundColor: '#00254E',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
