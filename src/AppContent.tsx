import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './hooks/useApp';
import { CreateAccountScreen } from './pages/onboarding/CreateAccountScreen';
import { MainProfileScreen } from './pages/onboarding/MainProfileScreen';
import { ProfileSelectionScreen } from './pages/onboarding/ProfileSelectionScreen';
import { AddPersonScreen } from './pages/onboarding/AddPersonScreen';
import { UpdatedProfilesScreen } from './pages/onboarding/UpdatedProfilesScreen';
import { ProfileSelectionEntryScreen } from './pages/onboarding/ProfileSelectionEntryScreen';
import { AppLayout } from './components/layout/AppLayout';
import { HomeScreen } from './pages/home/HomeScreen';
import { CronogramaScreen } from './pages/cronograma/CronogramaScreen';
import { ReceitasScreen } from './pages/receitas/ReceitasScreen';
import { UsuariosScreen } from './pages/usuarios/UsuariosScreen';
import type { Profile } from './types';

export type FlowStep =
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
  } = useApp();

  const [onboardingSubstep, setOnboardingSubstep] = useState<FlowStep | null>(null);

  if (isLoading) {
    return (
      <div className="onboarding-screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--color-blue-input)' }}>
          Carregando Doses...
        </p>
      </div>
    );
  }

  // 1. Se não há conta cadastrada, vai para criação de conta
  if (!currentAccount) {
    return (
      <CreateAccountScreen
        onSuccess={async (account) => {
          await loginAccount(account);
          setOnboardingSubstep('main-profile');
        }}
      />
    );
  }

  // 2. Se a conta existe mas ainda não possui perfil principal cadastrado
  if (profiles.length === 0) {
    return (
      <MainProfileScreen
        accountId={currentAccount.id}
        onBack={() => {}}
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
          if (profiles.length === 1 && profiles[0].isMainProfile) {
            await selectActiveProfile(profiles[0].id);
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
        onComplete={() => setOnboardingSubstep(null)}
      />
    );
  }

  // 4. Se já há um perfil ativo selecionado e persistido, exibe a Home e a navegação principal do aplicativo
  if (activeProfile) {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/cronograma" element={<CronogramaScreen />} />
          <Route path="/receitas" element={<ReceitasScreen />} />
          <Route path="/usuarios" element={<UsuariosScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // 5. Tela de Seleção de Perfil ("Entrar · [nome]")
  return (
    <ProfileSelectionEntryScreen
      profiles={profiles}
      onSelectProfile={async (selected: Profile) => {
        await selectActiveProfile(selected.id);
      }}
      onBackToOnboarding={() => setOnboardingSubstep('updated-profiles')}
    />
  );
}

export default function App() {
  return <AppContent />;
}
