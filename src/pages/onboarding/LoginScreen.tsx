import { useState, FormEvent } from 'react';
import { OnboardingHeader } from '../../components/ui/OnboardingHeader';
import { FormField } from '../../components/forms/FormField';
import { EyeIcon, EyeOffIcon } from '../../assets/icons';
import { AccountService } from '../../services/account/AccountService';
import type { Account } from '../../types';

interface LoginScreenProps {
  onSuccess: (account: Account) => Promise<void> | void;
  onNavigateToCreateAccount: () => void;
}

export function LoginScreen({ onSuccess, onNavigateToCreateAccount }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setPasswordError(null);
    setGeneralError(null);

    let hasError = false;
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setUsernameError('Informe o nome de usuário.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Informe a senha.');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      const account = await AccountService.authenticate(trimmedUsername, password);
      await onSuccess(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar. Tente novamente.';
      setGeneralError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-screen">
      <OnboardingHeader showBack={false} />

      <main className="onboarding-content">
        <div className="onboarding-presentation">
          <h1 className="onboarding-title">Bem-vindo de volta!</h1>
          <p className="onboarding-description">
            Acesse sua conta para organizar seus cuidados e acompanhar quem você ama.
          </p>
        </div>

        <form
          id="login-form"
          onSubmit={handleSubmit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {generalError && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: 'var(--color-bg-error)',
                border: '1px solid var(--color-border-error)',
                color: 'var(--color-border-error)',
                fontSize: 14,
                fontFamily: 'Open Sans, sans-serif',
              }}
              role="alert"
            >
              {generalError}
            </div>
          )}

          <FormField
            label="Usuário"
            type="text"
            inputMode="text"
            placeholder="Digite seu nome de usuário"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(null);
              if (generalError) setGeneralError(null);
            }}
            error={usernameError || undefined}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isSubmitting}
            required
          />

          <FormField
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
              if (generalError) setGeneralError(null);
            }}
            error={passwordError || undefined}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isSubmitting}
            required
            rightAction={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="field-action-button"
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOffIcon size={24} /> : <EyeIcon size={24} />}
              </button>
            }
          />
        </form>
      </main>

      <footer className="onboarding-footer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="submit"
          form="login-form"
          className="primary-action-button"
          disabled={isSubmitting}
          aria-label="Entrar na conta"
          onClick={(e) => {
            const form = document.getElementById('login-form') as HTMLFormElement | null;
            if (form && typeof form.requestSubmit === 'function') {
              try {
                form.requestSubmit();
                return;
              } catch {
                // Fallback caso ocorra restrição de submit no WebKit standalone
              }
            }
            handleSubmit(e);
          }}
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={onNavigateToCreateAccount}
          className="add-other-person-button"
          aria-label="Criar nova conta"
          style={{
            height: 56,
            fontSize: 18,
          }}
        >
          Criar nova conta
        </button>
      </footer>
    </div>
  );
}
