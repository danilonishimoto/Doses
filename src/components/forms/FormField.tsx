import { InputHTMLAttributes, ReactNode, forwardRef, useImperativeHandle, useRef } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightAction?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, rightAction, containerStyle, id, className, ...inputProps },
  ref
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const inputId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const errorId = `${inputId}-error`;

  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Se o toque/clique foi na borda ou no fundo do container (fora de botões de ação),
    // garante a delegação nativa direta para o campo
    if (e.target === e.currentTarget && innerRef.current) {
      innerRef.current.focus();
    }
  };

  return (
    <div className="form-group" style={containerStyle}>
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <div
        className={`input-wrapper ${error ? 'has-error' : ''}`}
        onClick={handleWrapperClick}
      >
        <input
          ref={innerRef}
          id={inputId}
          className={`input-field ${rightAction ? 'has-action' : ''} ${className || ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {rightAction}
      </div>
      {error && (
        <span id={errorId} className="field-error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
