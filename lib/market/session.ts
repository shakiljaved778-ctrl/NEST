/**
 * Demo auth + persistence (browser localStorage).
 *
 * ⚠️ DEMO ONLY. This exists so the freemium/portfolio flows are fully usable
 * without a database. In production this is replaced by NextAuth (email/password
 * + OAuth) with the Prisma models in `prisma/market.schema.prisma`; the
 * SessionUser/Portfolio shapes are already aligned with that schema.
 *
 * Passwords are lightly hashed (NOT secure) purely to avoid storing plaintext
 * in localStorage — real hashing (bcrypt/argon2) happens server-side later.
 */
import type {
  PlanTier,
  Portfolio,
  PriceAlert,
  SessionUser,
  UserProfile,
} from "@/types/market";

const K = {
  users: "qmd:users",
  session: "qmd:session",
  portfolios: (uid: string) => `qmd:portfolios:${uid}`,
  watchlist: (uid: string) => `qmd:watchlist:${uid}`,
  alerts: (uid: string) => `qmd:alerts:${uid}`,
};

interface StoredUser extends SessionUser {
  passwordHash: string;
}

/* -------------------------------- utils -------------------------------- */

function isBrowser() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Non-cryptographic hash — demo only. */
function weakHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------------------- auth -------------------------------- */

function loadUsers(): StoredUser[] {
  return read<StoredUser[]>(K.users, []);
}
function saveUsers(users: StoredUser[]): void {
  write(K.users, users);
}

function toSession(u: StoredUser): SessionUser {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export function signUp(
  name: string,
  email: string,
  password: string,
): AuthResult {
  const users = loadUsers();
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { ok: false, error: "Email and password are required." };
  if (users.some((u) => u.email === normalized))
    return { ok: false, error: "An account with that email already exists." };
  const user: StoredUser = {
    id: uid("usr"),
    email: normalized,
    name: name.trim() || normalized.split("@")[0],
    plan: "free",
    profile: null,
    passwordHash: weakHash(password),
  };
  users.push(user);
  saveUsers(users);
  setSession(user.id);
  return { ok: true, user: toSession(user) };
}

export function logIn(email: string, password: string): AuthResult {
  const users = loadUsers();
  const normalized = email.trim().toLowerCase();
  const user = users.find((u) => u.email === normalized);
  if (!user || user.passwordHash !== weakHash(password))
    return { ok: false, error: "Invalid email or password." };
  setSession(user.id);
  return { ok: true, user: toSession(user) };
}

export function logOut(): void {
  if (isBrowser()) window.localStorage.removeItem(K.session);
}

function setSession(userId: string): void {
  write(K.session, { userId });
}

export function currentUser(): SessionUser | null {
  const sess = read<{ userId?: string }>(K.session, {});
  if (!sess.userId) return null;
  const user = loadUsers().find((u) => u.id === sess.userId);
  return user ? toSession(user) : null;
}

function updateUser(userId: string, patch: Partial<StoredUser>): SessionUser | null {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return toSession(users[idx]);
}

export function setProfile(userId: string, profile: UserProfile): SessionUser | null {
  return updateUser(userId, { profile });
}

export function setPlan(userId: string, plan: PlanTier): SessionUser | null {
  return updateUser(userId, { plan });
}

/* ------------------------------ portfolios ----------------------------- */

export function loadPortfolios(userId: string): Portfolio[] {
  return read<Portfolio[]>(K.portfolios(userId), []);
}
export function savePortfolios(userId: string, portfolios: Portfolio[]): void {
  write(K.portfolios(userId), portfolios);
}
export function newPortfolio(name: string): Portfolio {
  return { id: uid("pf"), name, holdings: [], cash: 0, createdAt: Date.now() };
}
export function newHoldingId(): string {
  return uid("hld");
}

/* ------------------------------ watchlist ------------------------------ */

export function loadWatchlist(userId: string): string[] {
  return read<string[]>(K.watchlist(userId), ["QSE", "QNBK", "IQCD", "ORDS"]);
}
export function saveWatchlist(userId: string, symbols: string[]): void {
  write(K.watchlist(userId), symbols);
}

/* -------------------------------- alerts ------------------------------- */

export function loadAlerts(userId: string): PriceAlert[] {
  return read<PriceAlert[]>(K.alerts(userId), []);
}
export function saveAlerts(userId: string, alerts: PriceAlert[]): void {
  write(K.alerts(userId), alerts);
}
export function newAlertId(): string {
  return uid("alt");
}
