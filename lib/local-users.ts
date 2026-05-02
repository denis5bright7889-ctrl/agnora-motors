/**
 * File-based user store used when DATABASE_URL is not configured.
 * Writes to .local-users.json in the project root (dev-only).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  createdAt: string;
}

const FILE = resolve(process.cwd(), ".local-users.json");

function read(): LocalUser[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as LocalUser[];
  } catch {
    return [];
  }
}

function write(users: LocalUser[]): void {
  writeFileSync(FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function findLocalUser(email: string): LocalUser | null {
  return read().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function localUserExists(email: string): boolean {
  return Boolean(findLocalUser(email));
}

export function createLocalUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}): LocalUser {
  const users = read();
  const user: LocalUser = {
    id: `local-${crypto.randomUUID()}`,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role ?? "buyer",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write(users);
  return user;
}

export function listLocalUsers(): LocalUser[] {
  return read();
}
