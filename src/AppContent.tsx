import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './hooks/useApp';
import { LoginScreen } from './pages/onboarding/LoginScreen';
import { CreateAccountScreen } from './pages/onboarding/CreateAccountScreen';
import { MainProfileScreen } from './pages/onboarding/MainProfileScreen';
import { ProfileSelectionScreen } from './pages/onboarding/ProfileSelectionScreen';
import { AddPersonScreen } from './pages/onboarding/AddPersonScreen';
import { UpdatedProfilesScreen } from './pages/onboarding/UpdatedProfilesScreen';
import { ProfileSelectionEntryScreen } from './pages/onboarding/ProfileSelectionEntryScreen';
import { AccountService } from './services/account/AccountService';
import { AppLayout } from './components/layout/AppLayout';
import { HomeScreen } from './pages/home/HomeScreen';
import { CronogramaScreen } from './pages/cronograma/CronogramaScreen';
import { ReceitasScreen } from './pages/receitas/ReceitasScreen';
import { MedicationsScreen } from './features/medications/pages/MedicationsScreen';
import { UsuariosScreen } from './pages/usuarios/UsuariosScreen';
import { NotificationOnboardingModal } from './components/notification/NotificationOnboardingModal';
import type { Profile, OnboardingDraft } from './types';

export type FlowStep =
  | 'login'
  | 'create-account'
  | 'main-profile'
  | 'profile-selection'
  | 'add-person'
  | 'updated-profiles'
  | 'profile-entry'
  | 'app-home';

export function AppContent() {
  const {
    currentAccount,
    activeProfile,
    profiles,
    isLoading,
    loginAccount,
    selectActiveProfile,
    refreshProfiles,
    logout,
  } = useApp();

  const [onboardingSubstep, setOnboardingSubstep] = useState<FlowStep | null>(null);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft>({});
  const [hasAccountsInDb, setHasAccountsInDb] = useState<boolean | null>(null);

  // Verifica se há alguma conta cadastrada no IndexedDB
  useEffect(() => {
    async function checkExistingAccounts() {
      try {
        const has = await AccountService.hasAnyAccount();
        setHasAccountsInDb(has);
      } catch (err) {
        console.error('Erro ao verificar contas existentes:', err);
        setHasAccountsInDb(false);
      }
    }
    checkExistingAccounts();
  }, [currentAccount]);

  if (isLoading || hasAccountsInDb === null) {
    return (
      <div className="onboarding-screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--color-blue-input)' }}>
          Carregando Doses...
        </p>
      </div>
    );
  }

  // 1. Se não há conta autenticada na sessão atual
  if (!currentAccount) {
    // Se o usuário solicitou explicitamente criar conta OU se não há nenhuma conta no sistema (e não solicitou login)
    if ((onboardingSubstep === 'create-account' || !hasAccountsInDb) && onboardingSubstep !== 'login') {
      return (
        <CreateAccountScreen
          initialUsername={onboardingDraft.username}
          initialPassword={onboardingDraft.password}
          onNavigateToLogin={() => setOnboardingSubstep('login')}
          onSuccess={async (account, creds) => {
            if (creds) {
              setOnboardingDraft((prev) => ({
                ...prev,
                username: creds.username,
                password: creds.password,
              }));
            }
            await loginAccount(account);
            setHasAccountsInDb(true);
            setOnboardingSubstep('main-profile');
          }}
        />
      );
    }

    // Tela de login para contas existentes
    return (
      <LoginScreen
        onSuccess={async (account) => {
          await loginAccount(account);
          setOnboardingSubstep(null);
        }}
        onNavigateToCreateAccount={() => setOnboardingSubstep('create-account')}
      />
    );
  }

  // 2. Se a conta existe mas ainda não possui perfil principal cadastrado (ou retornou a ela)
  if (profiles.length === 0 || onboardingSubstep === 'main-profile') {
    return (
      <MainProfileScreen
        accountId={currentAccount.id}
        initialData={onboardingDraft.mainProfile}
        onBack={(draft) => {
          if (draft) {
            setOnboardingDraft((prev) => ({ ...prev, mainProfile: draft }));
          }
          setOnboardingSubstep('create-account');
        }}
        onSuccess={async () => {
          await refreshProfiles();
          setOnboardingSubstep('profile-selection');
        }}
      />
    );
  }

  // 3. Subetapas de Onboarding (quando o usuário está finalizando cadastro ou adicionando pessoa)
  if (onboardingSubstep === 'profile-selection') {
    return (
      <ProfileSelectionScreen
        profiles={profiles}
        onBack={() => setOnboardingSubstep(null)}
        onAddPerson={() => setOnboardingSubstep('add-person')}
        onComplete={async () => {
          setOnboardingSubstep(null);
          const mainProf = profiles.find((p) => p.isMainProfile) || profiles[0];
          if (mainProf) {
            await selectActiveProfile(mainProf.id);
          }
        }}
      />
    );
  }

  if (onboardingSubstep === 'add-person') {
    return (
      <AddPersonScreen
        accountId={currentAccount.id}
        onBack={() => setOnboardingSubstep(profiles.length > 1 ? 'updated-profiles' : 'profile-selection')}
        onSuccess={async () => {
          await refreshProfiles();
          setOnboardingSubstep('updated-profiles');
        }}
      />
    );
  }

  if (onboardingSubstep === 'updated-profiles') {
    return (
      <UpdatedProfilesScreen
        profiles={profiles}
        onBack={() => setOnboardingSubstep('profile-selection')}
        onAddAnother={() => setOnboardingSubstep('add-person')}
        onComplete={async () => {
          setOnboardingSubstep(null);
          const mainProf = profiles.find((p) => p.isMainProfile) || profiles[0];
          if (mainProf) {
            await selectActiveProfile(mainProf.id);
          }
        }}
      />
    );
  }

  // 4. Se já há um perfil ativo na sessão em memória, exibe a Home e a navegação principal do aplicativo
  if (activeProfile && currentAccount) {
    return (
      <>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/cronograma" element={<CronogramaScreen />} />
            <Route path="/receitas" element={<ReceitasScreen />} />
            <Route path="/medicamentos" element={<MedicationsScreen />} />
            <Route path="/usuarios" element={<UsuariosScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <NotificationOnboardingModal account={currentAccount} />
      </>
    );
  }

  // 5. Tela de Seleção de Perfil ("Entrar")
  return (
    <ProfileSelectionEntryScreen
      profiles={profiles}
      onSelectProfile={async (selected: Profile) => {
        await selectActiveProfile(selected.id);
      }}
      onLogout={() => {
        logout();
        setOnboardingSubstep('login');
      }}
    />
  );
}

export default function App() {
  return <AppContent />;
}
