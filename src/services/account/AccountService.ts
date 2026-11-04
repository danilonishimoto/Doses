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
    }
  }
}
