import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightAction?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, rightAction, containerStyle, id, ...inputProps },
  ref
) {
  const inputId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="form-group" style={containerStyle}>
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <div className={`input-wrapper ${error ? 'has-error' : ''}`}>
        <input
          ref={ref}
          id={inputId}
          className="input-field"
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
