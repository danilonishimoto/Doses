import { db } from '../database/db';
import type { Account } from '../../types';
import { hashPassword } from '../../utils/crypto';
import { apiClient } from '../api/apiClient';

export class AccountService {
  static async createAccount(username: string, plainPassword: string): Promise<Account> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      throw new Error('O nome de usuário é obrigatório.');
    }
    if (!plainPassword || plainPassword.length < 8) {
      throw new Error('A senha deve conter no mínimo 8 caracteres.');
    }

    const existing = await db.accounts.where('username').equalsIgnoreCase(trimmedUsername).first();
    if (existing) {
      throw new Error('Este nome de usuário já está cadastrado. Escolha outro.');
    }

    // 1. Tenta cadastrar no backend se estiver online
    const remoteData = await syncBackendRegister(trimmedUsername, plainPassword);

    const { hash, salt } = await hashPassword(plainPassword);
    const account: Account = {
      id: remoteData?.account?.id || crypto.randomUUID(),
      username: trimmedUsername,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };

    await db.accounts.add(account);
    this.setActiveAccountId(account.id);
    return account;
  }

  static async getAccountById(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  }

  static async getAccountByUsername(username: string): Promise<Account | undefined> {
    return db.accounts.where('username').equalsIgnoreCase(username.trim()).first();
  }

  static async authenticate(username: string, plainPassword: string): Promise<Account> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      throw new Error('Informe o nome de usuário.');
    }
    if (!plainPassword) {
      throw new Error('Informe a senha.');
    }

    let account = await this.getAccountByUsername(trimmedUsername);

    if (account) {
      // Conta existe localmente: valida hash local
      const { hash } = await hashPassword(plainPassword, account.salt);
      if (hash !== account.passwordHash) {
        throw new Error('Usuário ou senha incorretos.');
      }
      this.setActiveAccountId(account.id);
      try {
        await syncBackendLogin(trimmedUsername, plainPassword);
      } catch (syncErr) {
        console.warn('[AccountService] Login local mantido, sincronização remota indisponível:', syncErr);
      }
      return account;
    }

    // Conta NÃO existe localmente (ex: primeiro login neste dispositivo): tenta autenticar no backend
    const remoteData = await syncBackendLogin(trimmedUsername, plainPassword);
    if (!remoteData || !remoteData.account) {
      throw new Error('Usuário ou senha incorretos.');
    }

    // Cria registro no Dexie local para manter disponibilidade offline
    const { hash, salt } = await hashPassword(plainPassword);
    account = {
      id: remoteData.account.id,
      username: trimmedUsername,
      passwordHash: hash,
      salt,
      createdAt: remoteData.account.createdAt || new Date().toISOString(),
    };

    await db.accounts.put(account);
    this.setActiveAccountId(account.id);
    return account;
  }

  static async hasAnyAccount(): Promise<boolean> {
    const count = await db.accounts.count();
    return count > 0;
  }

  static async getFirstAccount(): Promise<Account | undefined> {
    return db.accounts.orderBy('createdAt').first();
  }

  static setActiveAccountId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('doses_active_account_id', id);
    }
  }

  static getActiveAccountId(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('doses_active_account_id');
    }
    return null;
  }

  static clearActiveAccount(): void {
    // Tenta revogar a sessão no backend
    const token = apiClient.getAccessToken();
    if (token) {
      apiClient.post('/auth/logout').catch(() => null);
    }

    apiClient.clearTokens();

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('doses_active_account_id');
      localStorage.removeItem('doses_push_subscribed');
      localStorage.removeItem('doses_push_subscription_id');
    }
  }
}

function getBaseUrl() {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    ((globalThis as any).process?.env?.VITE_API_URL) ||
    (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null'
      ? '/api/v1'
      : 'http://localhost:3333/api/v1')
  );
}

async function syncBackendRegister(username: string, plainPassword: string) {
  if (typeof fetch === 'undefined') return null;
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: plainPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken && data.refreshToken) {
        apiClient.setTokens(data.accessToken, data.refreshToken);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('doses_backend_account_id', data.account.id);
        }
      }
      return data;
    }

    if (res.status === 409) {
      throw new Error('Este nome de usuário já está cadastrado no servidor.');
    }

    if (res.status === 400) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Dados inválidos para criação de conta.');
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('cadastrado') || err.message.includes('inválidos'))) {
      throw err;
    }
    console.warn('[AccountService] Backend offline, prosseguindo com criação de conta local no IndexedDB.');
  }
  return null;
}

async function syncBackendLogin(username: string, plainPassword: string) {
  if (typeof fetch === 'undefined') return null;
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: plainPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken && data.refreshToken) {
        apiClient.setTokens(data.accessToken, data.refreshToken);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('doses_backend_account_id', data.account.id);
        }
      }
      return data;
    }

    if (res.status === 401) {
      throw new Error('Usuário ou senha incorretos.');
    }

    if (res.status === 429) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Muitas tentativas de login falhas. Tente novamente mais tarde.');
    }

    if (res.status === 400) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Dados de login inválidos.');
    }

    if (res.status >= 500) {
      throw new Error('Serviço temporariamente indisponível no servidor.');
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes('incorretos') ||
        err.message.includes('tentativas') ||
        err.message.includes('inválidos') ||
        err.message.includes('indisponível'))
    ) {
      throw err;
    }

    console.warn('[AccountService] Erro de rede ou backend offline:', err);
    if (typeof window !== 'undefined') {
      throw new Error('Não foi possível conectar ao servidor. Verifique a conexão de rede.');
    }
  }
  return null;
}
