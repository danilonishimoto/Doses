import { useState, FormEvent } from 'react';
import { OnboardingHeader } from '../../components/ui/OnboardingHeader';
import { FormField } from '../../components/forms/FormField';
import { EyeIcon, EyeOffIcon } from '../../assets/icons';
import { AccountService } from '../../services/account/AccountService';
import type { Account } from '../../types';

interface CreateAccountScreenProps {
  initialUsername?: string;
  initialPassword?: string;
  onSuccess: (account: Account) => void;
}

export function CreateAccountScreen({
  initialUsername = '',
  initialPassword = '',
  onSuccess,
}: CreateAccountScreenProps) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState(initialPassword);
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
      setUsernameError('Por favor, escolha seu nome de usuário.');
      hasError = true;
    } else if (trimmedUsername.length < 3) {
      setUsernameError('O usuário deve ter pelo menos 3 caracteres.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Por favor, crie sua senha.');
      hasError = true;
    } else if (password.length < 4) {
      setPasswordError('A senha deve ter pelo menos 4 caracteres.');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      const account = await AccountService.createAccount(trimmedUsername, password);
      onSuccess(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar conta. Tente novamente.';
      if (msg.toLowerCase().includes('usuário já está cadastrado')) {
        setUsernameError(msg);
      } else {
        setGeneralError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-screen">
      <OnboardingHeader showBack={false} />

      <main className="onboarding-content">
        <div className="onboarding-presentation">
          <h1 className="onboarding-title">Vamos começar?</h1>
          <p className="onboarding-description">
            Crie sua conta para organizar seus cuidados e acompanhar quem você ama.
          </p>
        </div>

        <form id="create-account-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {generalError && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: 'var(--color-bg-error)',
                border: '1px solid var(--color-border-error)',
                color: 'var(--color-border-error)',
                fontSize: 14,
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
            placeholder="Escolha seu nome de usuário"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(null);
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
            placeholder="Crie sua senha"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            error={passwordError || undefined}
            autoComplete="new-password"
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

      <footer className="onboarding-footer">
        <button
          type="submit"
          form="create-account-form"
          className="primary-action-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Criando conta...' : 'Continuar'}
        </button>
      </footer>
    </div>
  );
}
