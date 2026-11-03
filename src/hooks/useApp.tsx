import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AccountService } from '../services/account/AccountService';
import { ProfileService } from '../services/profile/ProfileService';
import type { Account, Profile } from '../types';

interface AppContextValue {
  currentAccount: Account | null;
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  selectActiveProfile: (profileId: string) => Promise<boolean>;
  refreshProfiles: () => Promise<void>;
  logout: () => void;
  switchProfile: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfiles = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const userProfiles = await ProfileService.getProfilesByAccount(currentAccount.id);
      setProfiles(userProfiles);

      const activeId = ProfileService.getActiveProfileId();
      if (activeId) {
        const found = userProfiles.find((p) => p.id === activeId);
        if (found) {
          setActiveProfile(found);
        } else {
          ProfileService.clearActiveProfileId();
          setActiveProfile(null);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar lista de perfis:', err);
    }
  }, [currentAccount]);

  useEffect(() => {
    async function loadInitial() {
      try {
        const activeAccountId = AccountService.getActiveAccountId();
        let account: Account | undefined;

        if (activeAccountId) {
          account = await AccountService.getAccountById(activeAccountId);
        }
        if (!account) {
          account = await AccountService.getFirstAccount();
          if (account) AccountService.setActiveAccountId(account.id);
        }

        if (account) {
          setCurrentAccount(account);
          const userProfiles = await ProfileService.getProfilesByAccount(account.id);
          setProfiles(userProfiles);

          // Verifica se há perfil ativo persistido
          const savedProfileId = ProfileService.getActiveProfileId();
          if (savedProfileId) {
            const matchedProfile = userProfiles.find((p) => p.id === savedProfileId);
            if (matchedProfile) {
              setActiveProfile(matchedProfile);
            } else {
              ProfileService.clearActiveProfileId();
              setActiveProfile(null);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do usuário:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitial();
  }, []);

  const selectActiveProfile = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!currentAccount) return false;
      const target = profiles.find((p) => p.id === profileId);
      if (!target || target.accountId !== currentAccount.id) {
        console.error('Tentativa de selecionar perfil inválido ou de outra conta.');
        return false;
      }

      ProfileService.setActiveProfileId(target.id);
      setActiveProfile(target);
      return true;
    },
    [currentAccount, profiles]
  );

  const switchProfile = useCallback(() => {
    ProfileService.clearActiveProfileId();
    setActiveProfile(null);
  }, []);

  const logout = useCallback(() => {
    AccountService.clearActiveAccount();
    ProfileService.clearActiveProfileId();
    setCurrentAccount(null);
    setActiveProfile(null);
    setProfiles([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentAccount,
        activeProfile,
        profiles,
        isLoading,
        selectActiveProfile,
        refreshProfiles,
        logout,
        switchProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider');
  }
  return context;
}
