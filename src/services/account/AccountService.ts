import { db } from '../database/db';
import type { Account } from '../../types';
import { hashPassword } from '../../utils/crypto';

export class AccountService {
  static async createAccount(username: string, plainPassword: string): Promise<Account> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      throw new Error('O nome de usuário é obrigatório.');
    }
    if (!plainPassword || plainPassword.length < 4) {
      throw new Error('A senha deve conter no mínimo 4 caracteres.');
    }

    const existing = await db.accounts.where('username').equalsIgnoreCase(trimmedUsername).first();
    if (existing) {
      throw new Error('Este nome de usuário já está cadastrado. Escolha outro.');
    }

    const { hash, salt } = await hashPassword(plainPassword);
    const account: Account = {
      id: crypto.randomUUID(),
      username: trimmedUsername,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };

    await db.accounts.add(account);
    this.setActiveAccountId(account.id);
    await syncBackendAuth(trimmedUsername, plainPassword);
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

    const account = await this.getAccountByUsername(trimmedUsername);
    if (!account) {
      throw new Error('Usuário ou senha incorretos.');
    }

    const { hash } = await hashPassword(plainPassword, account.salt);
    if (hash !== account.passwordHash) {
      throw new Error('Usuário ou senha incorretos.');
    }

    this.setActiveAccountId(account.id);
    await syncBackendAuth(trimmedUsername, plainPassword);
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('doses_active_account_id');
      localStorage.removeItem('doses_access_token');
      localStorage.removeItem('doses_refresh_token');
      localStorage.removeItem('doses_backend_account_id');
      localStorage.removeItem('doses_push_subscribed');
      localStorage.removeItem('doses_push_subscription_id');
    }
  }
}

async function syncBackendAuth(username: string, plainPassword: string) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: plainPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('doses_access_token', data.accessToken);
        localStorage.setItem('doses_refresh_token', data.refreshToken);
        localStorage.setItem('doses_backend_account_id', data.account.id);
      }
      return data;
    }

    if (res.status === 401 || res.status === 404 || res.status === 400) {
      const regRes = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: plainPassword }),
      });
      if (regRes.ok) {
        const data = await regRes.json();
        if (data.accessToken && typeof localStorage !== 'undefined') {
          localStorage.setItem('doses_access_token', data.accessToken);
          localStorage.setItem('doses_refresh_token', data.refreshToken);
          localStorage.setItem('doses_backend_account_id', data.account.id);
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('[AccountService] Backend offline, prosseguindo com autenticação local IndexedDB.');
  }
}
