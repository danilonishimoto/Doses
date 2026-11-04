import { useState, useEffect } from 'react';
import { CloseIcon } from '../../../assets/icons';

interface MedicationTimePickerSheetProps {
  isOpen: boolean;
  initialTime?: string;
  onClose: () => void;
  onSelectTime: (time: string) => void;
}

export function MedicationTimePickerSheet({
  isOpen,
  initialTime = '08:00',
  onClose,
  onSelectTime,
}: MedicationTimePickerSheetProps) {
  const [hours, setHours] = useState('08');
  const [minutes, setMinutes] = useState('00');

  useEffect(() => {
    if (initialTime && initialTime.includes(':')) {
      const [h, m] = initialTime.split(':');
      setHours(h.padStart(2, '0'));
      setMinutes(m.padStart(2, '0'));
    }
  }, [initialTime, isOpen]);

  if (!isOpen) return null;

  const currentH = parseInt(hours, 10) || 0;
  const currentM = parseInt(minutes, 10) || 0;

  const prevH = (currentH - 1 + 24) % 24;
  const nextH = (currentH + 1) % 24;

  const prevM = (currentM - 5 + 60) % 60;
  const nextM = (currentM + 5) % 60;

  const handleAdjustHour = (delta: number) => {
    const newH = (currentH + delta + 24) % 24;
    setHours(String(newH).padStart(2, '0'));
  };

  const handleAdjustMinute = (delta: number) => {
    const newM = (currentM + delta + 60) % 60;
    setMinutes(String(newM).padStart(2, '0'));
  };

  const handleConfirm = () => {
    const formatted = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    onSelectTime(formatted);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seletor de horário"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 37, 78, 0.4)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '24px 24px 34px',
          width: '100%',
          maxWidth: 402,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 -4px 16px rgba(0, 37, 78, 0.12)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Urbanist, sans-serif',
              fontWeight: 600,
              fontSize: '26px',
              color: '#000000',
            }}
          >
            Adicionar horário
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seletor"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#4E6D93',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        {/* Column Labels */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '80px',
            fontFamily: 'Open Sans, sans-serif',
            fontSize: '16px',
            color: '#000000',
            marginTop: '4px',
          }}
        >
          <span>Hora</span>
          <span>Minuto</span>
        </div>

        {/* Scroll / Step Picker Wheels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {/* Previous values */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '68px',
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '22px',
              color: '#4E6D93',
              opacity: 0.7,
              height: '32px',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => handleAdjustHour(-1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                width: '40px',
              }}
            >
              {String(prevH).padStart(2, '0')}
            </button>
            <button
              type="button"
              onClick={() => handleAdjustMinute(-5)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                width: '40px',
              }}
            >
              {String(prevM).padStart(2, '0')}
            </button>
          </div>

          {/* Selected value (Figma node 301:7309: bg-[#e6f4ff], rounded-[20px], h-[56px], text-[#00254e]) */}
          <div
            style={{
              backgroundColor: '#E6F4FF',
              borderRadius: '20px',
              height: '56px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              color: '#000000',
            }}
          >
            <input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => {
                const val = e.target.value.slice(-2);
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 0 && n <= 23) {
                  setHours(val.padStart(2, '0'));
                } else if (val === '') {
                  setHours('');
                }
              }}
              onBlur={() => {
                const n = parseInt(hours, 10) || 0;
                setHours(String(Math.min(23, Math.max(0, n))).padStart(2, '0'));
              }}
              style={{
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 600,
                fontSize: '32px',
                color: '#000000',
                background: 'transparent',
                border: 'none',
                width: '50px',
                textAlign: 'center',
                outline: 'none',
                padding: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '28px',
                fontWeight: 400,
                lineHeight: 1,
              }}
            >
              :
            </span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => {
                const val = e.target.value.slice(-2);
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 0 && n <= 59) {
                  setMinutes(val.padStart(2, '0'));
                } else if (val === '') {
                  setMinutes('');
                }
              }}
              onBlur={() => {
                const n = parseInt(minutes, 10) || 0;
                setMinutes(String(Math.min(59, Math.max(0, n))).padStart(2, '0'));
              }}
              style={{
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 600,
                fontSize: '32px',
                color: '#000000',
                background: 'transparent',
                border: 'none',
                width: '50px',
                textAlign: 'center',
                outline: 'none',
                padding: 0,
              }}
            />
          </div>

          {/* Next values */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '68px',
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '22px',
              color: '#4E6D93',
              opacity: 0.7,
              height: '32px',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => handleAdjustHour(1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                width: '40px',
              }}
            >
              {String(nextH).padStart(2, '0')}
            </button>
            <button
              type="button"
              onClick={() => handleAdjustMinute(5)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                width: '40px',
              }}
            >
              {String(nextM).padStart(2, '0')}
            </button>
          </div>
        </div>

        {/* Action buttons (Figma node 301:7316) */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: '56px',
              borderRadius: '20px',
              border: '1px solid #000203',
              backgroundColor: '#FFFFFF',
              color: '#000203',
              fontFamily: 'Urbanist, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              flex: 1,
              minHeight: '64px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#000203',
              color: '#FFFFFF',
              fontFamily: 'Urbanist, sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
