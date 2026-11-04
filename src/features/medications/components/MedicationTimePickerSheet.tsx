import { useState, useEffect, useRef } from 'react';
import { CloseIcon } from '../../../assets/icons';

interface MedicationTimePickerSheetProps {
  isOpen: boolean;
  initialTime?: string;
  onClose: () => void;
  onSelectTime: (time: string) => void;
}

function useWheelPicker(
  onAdjust: (delta: number) => void,
  stepValue: number = 1,
  pixelThreshold: number = 24
) {
  const accumulatedWheelRef = useRef(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startYRef = useRef<number | null>(null);
  const accumulatedDragRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();

    accumulatedWheelRef.current += e.deltaY;

    if (wheelTimerRef.current) {
      clearTimeout(wheelTimerRef.current);
    }
    wheelTimerRef.current = setTimeout(() => {
      accumulatedWheelRef.current = 0;
    }, 150);

    const threshold = 30;
    while (Math.abs(accumulatedWheelRef.current) >= threshold) {
      if (accumulatedWheelRef.current > 0) {
        onAdjust(stepValue);
        accumulatedWheelRef.current -= threshold;
      } else {
        onAdjust(-stepValue);
        accumulatedWheelRef.current += threshold;
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    accumulatedDragRef.current = 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = startYRef.current - currentY; // arrastar para cima avança valores

    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }

    accumulatedDragRef.current += deltaY;
    startYRef.current = currentY;

    while (Math.abs(accumulatedDragRef.current) >= pixelThreshold) {
      if (accumulatedDragRef.current > 0) {
        onAdjust(stepValue);
        accumulatedDragRef.current -= pixelThreshold;
      } else {
        onAdjust(-stepValue);
        accumulatedDragRef.current += pixelThreshold;
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    startYRef.current = null;
    accumulatedDragRef.current = 0;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 50);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Evita conflito com touch nativo se o browser disparar ambos
    if (e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    startYRef.current = e.clientY;
    accumulatedDragRef.current = 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (!isDraggingRef.current || startYRef.current === null) return;
    const currentY = e.clientY;
    const deltaY = startYRef.current - currentY;

    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }

    accumulatedDragRef.current += deltaY;
    startYRef.current = currentY;

    while (Math.abs(accumulatedDragRef.current) >= pixelThreshold) {
      if (accumulatedDragRef.current > 0) {
        onAdjust(stepValue);
        accumulatedDragRef.current -= pixelThreshold;
      } else {
        onAdjust(-stepValue);
        accumulatedDragRef.current += pixelThreshold;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      startYRef.current = null;
      accumulatedDragRef.current = 0;
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 50);
    }
  };

  return {
    handlers: {
      onWheel: handleWheel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
    hasMovedRef,
  };
}

function parseTime(timeStr?: string) {
  if (timeStr && timeStr.includes(':')) {
    const [h, m] = timeStr.split(':');
    return {
      h: h.padStart(2, '0'),
      m: m.padStart(2, '0'),
    };
  }
  return { h: '08', m: '00' };
}

export function MedicationTimePickerSheet({
  isOpen,
  initialTime = '08:00',
  onClose,
  onSelectTime,
}: MedicationTimePickerSheetProps) {
  const initial = parseTime(initialTime);
  const [hours, setHours] = useState(initial.h);
  const [minutes, setMinutes] = useState(initial.m);

  useEffect(() => {
    if (initialTime && initialTime.includes(':')) {
      const parsed = parseTime(initialTime);
      setHours(parsed.h);
      setMinutes(parsed.m);
    }
  }, [initialTime, isOpen]);

  const currentH = parseInt(hours, 10) || 0;
  const currentM = parseInt(minutes, 10) || 0;

  const prevH = (currentH - 1 + 24) % 24;
  const nextH = (currentH + 1) % 24;

  const prevM = (currentM - 5 + 60) % 60;
  const nextM = (currentM + 5) % 60;

  const handleAdjustHour = (delta: number) => {
    setHours((prev) => {
      const curr = parseInt(prev, 10) || 0;
      const newH = ((curr + delta) % 24 + 24) % 24;
      return String(newH).padStart(2, '0');
    });
  };

  const handleAdjustMinute = (delta: number) => {
    setMinutes((prev) => {
      const curr = parseInt(prev, 10) || 0;
      const newM = ((curr + delta) % 60 + 60) % 60;
      return String(newM).padStart(2, '0');
    });
  };

  const hourPicker = useWheelPicker(handleAdjustHour, 1, 24);
  const minutePicker = useWheelPicker(handleAdjustMinute, 5, 24);

  const handleHourKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleAdjustHour(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleAdjustHour(-1);
    }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleAdjustMinute(5);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleAdjustMinute(-5);
    }
  };

  const handleConfirm = () => {
    const formatted = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    onSelectTime(formatted);
    onClose();
  };

  if (!isOpen) return null;

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
          <span style={{ width: '40px', textAlign: 'center' }}>Hora</span>
          <span style={{ width: '40px', textAlign: 'center' }}>Minuto</span>
        </div>

        {/* Scroll / Step Picker Wheels */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '132px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {/* Selected value background pill (Figma node 301:7309: bg-[#e6f4ff], rounded-[20px], h-[56px]) */}
          <div
            style={{
              position: 'absolute',
              top: '38px',
              left: 0,
              right: 0,
              height: '56px',
              backgroundColor: '#E6F4FF',
              borderRadius: '20px',
              pointerEvents: 'none',
            }}
          />

          {/* Hour Wheel Column */}
          <div
            {...hourPicker.handlers}
            role="spinbutton"
            aria-label="Seletor de horas"
            aria-valuenow={currentH}
            aria-valuemin={0}
            aria-valuemax={23}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '132px',
              width: '80px',
              cursor: 'ns-resize',
              touchAction: 'none',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (!hourPicker.hasMovedRef.current) handleAdjustHour(-1);
              }}
              aria-label="Hora anterior"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                color: '#4E6D93',
                opacity: 0.7,
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '22px',
                cursor: 'pointer',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                width: '100%',
              }}
            >
              {String(prevH).padStart(2, '0')}
            </button>

            <div
              style={{
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                aria-label="Hora selecionada"
                value={hours}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(-2);
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
                onKeyDown={handleHourKeyDown}
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
                  cursor: 'ns-resize',
                  touchAction: 'none',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!hourPicker.hasMovedRef.current) handleAdjustHour(1);
              }}
              aria-label="Próxima hora"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                color: '#4E6D93',
                opacity: 0.7,
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '22px',
                cursor: 'pointer',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                width: '100%',
              }}
            >
              {String(nextH).padStart(2, '0')}
            </button>
          </div>

          {/* Separator ':' */}
          <div
            style={{
              width: '24px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '28px',
              fontWeight: 400,
              color: '#000000',
              lineHeight: 1,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            :
          </div>

          {/* Minute Wheel Column */}
          <div
            {...minutePicker.handlers}
            role="spinbutton"
            aria-label="Seletor de minutos"
            aria-valuenow={currentM}
            aria-valuemin={0}
            aria-valuemax={59}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '132px',
              width: '80px',
              cursor: 'ns-resize',
              touchAction: 'none',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (!minutePicker.hasMovedRef.current) handleAdjustMinute(-5);
              }}
              aria-label="Minuto anterior"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                color: '#4E6D93',
                opacity: 0.7,
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '22px',
                cursor: 'pointer',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                width: '100%',
              }}
            >
              {String(prevM).padStart(2, '0')}
            </button>

            <div
              style={{
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                aria-label="Minuto selecionado"
                value={minutes}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(-2);
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
                onKeyDown={handleMinuteKeyDown}
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
                  cursor: 'ns-resize',
                  touchAction: 'none',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!minutePicker.hasMovedRef.current) handleAdjustMinute(5);
              }}
              aria-label="Próximo minuto"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                color: '#4E6D93',
                opacity: 0.7,
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '22px',
                cursor: 'pointer',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                width: '100%',
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
