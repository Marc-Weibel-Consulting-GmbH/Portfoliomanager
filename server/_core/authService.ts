/**
 * Shared email/password auth implementation (D-08).
 *
 * Single source of truth for register/login used by BOTH transports:
 * - REST endpoints `/api/auth/login|register` in `_core/index.ts`
 * - tRPC procedures `auth.login` / `auth.register` in `routers.ts`
 *
 * Session cookie handling stays in the transport layer — this module only
 * creates the session token.
 */
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users, newsletter } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "./sdk";

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const registerSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  mobile: z.string().nullish(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Auth failure with an HTTP status for the REST layer (tRPC uses the message). */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: typeof users.$inferSelect; sessionToken: string }> {
  const db = await getDb();
  if (!db) {
    throw new AuthError("Database not available", 500);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new AuthError("E-Mail oder Passwort falsch", 401);
  }

  const isValid = await bcrypt.compare(password, user.password || "");
  if (!isValid) {
    throw new AuthError("E-Mail oder Passwort falsch", 401);
  }

  // Ensure user has an openId (older email/password users may lack one)
  let userOpenId = user.openId;
  if (!userOpenId) {
    userOpenId = `email_${user.id}`;
    await db.update(users).set({ openId: userOpenId }).where(eq(users.id, user.id));
  }

  const sessionToken = await sdk.createSessionToken(userOpenId, {
    name: user.name || `${user.firstName} ${user.lastName}`,
    expiresInMs: SESSION_MAX_AGE_MS,
  });

  return { user, sessionToken };
}

export async function registerUser(
  input: RegisterInput
): Promise<{ openId: string; name: string; sessionToken: string }> {
  const db = await getDb();
  if (!db) {
    throw new AuthError("Database not available", 500);
  }

  // Check if email already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existingUser) {
    throw new AuthError("Diese E-Mail-Adresse ist bereits registriert", 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const openId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const name = `${input.firstName} ${input.lastName}`;

  await db.insert(users).values({
    openId,
    firstName: input.firstName,
    lastName: input.lastName,
    name,
    email: input.email,
    password: hashedPassword,
    mobile: input.mobile || null,
    loginMethod: "email",
    role: "user",
    hasPaid: 0,
  });

  // Newsletter opt-in is best-effort — must not fail the registration
  try {
    await db.insert(newsletter).values({
      email: input.email,
      isActive: 1,
    });
  } catch (error) {
    console.error("Failed to add to newsletter:", error);
  }

  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: SESSION_MAX_AGE_MS,
  });

  return { openId, name, sessionToken };
}
