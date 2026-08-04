import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptField, verifyTotp } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

const LOCKOUT_MAX = Number(process.env.LOCKOUT_MAX_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_WINDOW_MINUTES ?? 15);
const SESSION_HOURS = Number(process.env.SESSION_MAX_AGE_HOURS ?? 12);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

import type { Provider } from "next-auth/providers";

const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {}, totp: {} },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password, totp } = parsed.data;

      const user = await db.user.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
      });
      if (!user || !user.passwordHash || !user.active) {
        await logAudit({
          action: "LOGIN_FAILED",
          entityType: "USER",
          actorEmail: email.toLowerCase(),
          after: { reason: user ? "inactive" : "unknown_user" },
        });
        return null;
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await logAudit({
          action: "LOGIN_FAILED",
          entityType: "USER",
          entityId: user.id,
          actorEmail: user.email,
          after: { reason: "locked" },
        });
        throw new Error("ACCOUNT_LOCKED");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        const failed = user.failedLoginCount + 1;
        const lock = failed >= LOCKOUT_MAX;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: lock ? 0 : failed,
            lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
          },
        });
        await logAudit({
          action: lock ? "LOCKOUT" : "LOGIN_FAILED",
          entityType: "USER",
          entityId: user.id,
          actorEmail: user.email,
          after: { failedAttempts: failed },
        });
        if (lock) throw new Error("ACCOUNT_LOCKED");
        return null;
      }

      if (user.totpEnabled && user.totpSecret) {
        const secret = decryptField(user.totpSecret);
        if (!totp) throw new Error("TOTP_REQUIRED");
        if (!verifyTotp(secret, totp)) {
          await logAudit({
            action: "LOGIN_FAILED",
            entityType: "USER",
            entityId: user.id,
            actorEmail: user.email,
            after: { reason: "bad_totp" },
          });
          throw new Error("TOTP_INVALID");
        }
      }

      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      await logAudit({
        action: "LOGIN",
        entityType: "USER",
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
        territory: user.territory,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: SESSION_HOURS * 3600 },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Google SSO: only allow existing, active users (no self-signup).
      if (account?.provider === "google") {
        const existing = await db.user.findFirst({
          where: { email: user.email?.toLowerCase() ?? "", active: true, deletedAt: null },
        });
        if (!existing) return false;
        user.id = existing.id;
        user.role = existing.role;
        user.teamId = existing.teamId;
        user.territory = existing.territory;
        await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
        await logAudit({
          action: "LOGIN",
          entityType: "USER",
          entityId: existing.id,
          actorId: existing.id,
          actorEmail: existing.email,
          after: { provider: "google" },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.teamId = user.teamId;
        token.territory = user.territory;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role as Role;
      session.user.teamId = token.teamId;
      session.user.territory = token.territory;
      return session;
    },
  },
});

export class AuthError extends Error {}

/** Get the current session user or throw. Use at the top of every server action / service call. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("Not authenticated");
  return session.user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("Forbidden");
  return user;
}
