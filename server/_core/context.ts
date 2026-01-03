import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Backward compatibility alias
export type Context = TrpcContext;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    console.log('[createContext] Auth successful - userId:', user?.id, 'openId:', user?.openId);
  } catch (error) {
    // Authentication is optional for public procedures.
    console.log('[createContext] Auth failed (expected for public procedures):', String(error));
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
