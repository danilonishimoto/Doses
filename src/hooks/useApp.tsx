import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AccountService } from '../services/account/AccountService';
import { ProfileService } from '../services/profile/ProfileService';
import type { Account, Profile } from '../types';

interface AppContextValue {
  currentAccount: Account | null;
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  loginAccount: (account: Account) => Promise<void>;
  selectActiveProfile: (profileId: string) => Promise<boolean>;
  updateProfile: (
    profileId: string,
    updates: Partial<Omit<Profile, 'id' | 'accountId' | 'createdAt'>>
  ) => Promise<Profile>;
  refreshProfiles: () => Promise<Profile[]>;
  logout: () => void;
  switchProfile: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfiles = useCallback(async (): Promise<Profile[]> => {
    let account = currentAccount;
    if (!account) {
      const activeId = AccountService.getActiveAccountId();
      if (activeId) {
        account = (await AccountService.getAccountById(activeId)) || null;
        if (account) setCurrentAccount(account);
      }
    }
    if (!account) return [];

    try {
      const userProfiles = await ProfileService.getProfilesByAccount(account.id);
      setProfiles(userProfiles);

      if (activeProfile) {
        const found = userProfiles.find((p) => p.id === activeProfile.id);
        if (found) {
          setActiveProfile(found);
        } else {
          ProfileService.clearActiveProfileId();
          setActiveProfile(null);
        }
      }
      return userProfiles;
    } catch (err) {
      console.error('Erro ao atualizar lista de perfis:', err);
      return [];
    }
  }, [currentAccount, activeProfile]);

  const loginAccount = useCallback(async (account: Account) => {
    AccountService.setActiveAccountId(account.id);
    setCurrentAccount(account);
    const userProfiles = await ProfileService.getProfilesByAccount(account.id);
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
    } else {
      setActiveProfile(null);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        const activeAccountId = AccountService.getActiveAccountId();
        let account: Account | undefined;

        if (activeAccountId) {
          account = await AccountService.getAccountById(activeAccountId);
        }

        if (account) {
          setCurrentAccount(account);
          const userProfiles = await ProfileService.getProfilesByAccount(account.id);
          setProfiles(userProfiles);

          // Separação entre cadastro persistente e sessão ativa:
          // Ao reabrir ou recarregar a aplicação, a sessão ativa (activeProfile) NÃO é restaurada.
          // O cadastro e os perfis permanecem salvos no IndexedDB, mas activeProfile inicia nulo,
          // direcionando o usuário para a tela "Entrar" com os perfis cadastrados.
          setActiveProfile(null);
          ProfileService.clearActiveProfileId();
        } else {
          // Nenhuma sessão ativa no storage (ou usuário encerrou a sessão)
          setCurrentAccount(null);
          setActiveProfile(null);
          setProfiles([]);
          AccountService.clearActiveAccount();
          ProfileService.clearActiveProfileId();
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
      let account = currentAccount;
      if (!account) {
        const activeId = AccountService.getActiveAccountId();
        if (activeId) {
          account = (await AccountService.getAccountById(activeId)) || null;
          if (account) setCurrentAccount(account);
        }
      }
      if (!account) return false;

      let target = profiles.find((p) => p.id === profileId);
      if (!target) {
        target = await ProfileService.getProfileById(profileId);
      }
      if (!target || target.accountId !== account.id) {
        console.error('Tentativa de selecionar perfil inválido ou de outra conta.');
        return false;
      }

      ProfileService.setActiveProfileId(target.id);
      setActiveProfile(target);
      return true;
    },
    [currentAccount, profiles]
  );

  const updateProfile = useCallback(
    async (
      profileId: string,
      updates: Partial<Omit<Profile, 'id' | 'accountId' | 'createdAt'>>
    ): Promise<Profile> => {
      const updated = await ProfileService.updateProfile(profileId, updates);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (activeProfile?.id === updated.id) {
        setActiveProfile(updated);
      }
      return updated;
    },
    [activeProfile]
  );

  const switchProfile = useCallback(() => {
    ProfileService.clearActiveProfileId();
    setActiveProfile(null);
  }, []);

  const logout = useCallback(() => {
    // Encerra a sessão da conta e limpa estados em memória e storage
    // Não exclui nem modifica os dados persistidos no IndexedDB
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
        loginAccount,
        selectActiveProfile,
        updateProfile,
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
