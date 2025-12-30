import express from "express";
import "./secretsTimingTest"; // Start timing tests on server boot
import "./logMonitor"; // Start log monitoring
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startPriceUpdater } from "../priceUpdater";
import { initializeNewsUpdater } from "../newsUpdater";
import { startChartDataUpdater } from "../chartDataUpdater";
import { initializePEGUpdater } from "../pegUpdater";
import { initYTDUpdater } from "../cron/ytdUpdater";
import { initDividendCaptureJob } from "../dividendCaptureJob";
import { initFxRatesCron } from "../fxRatesFetchJob";
import { initTransactionFxUpdateCron } from "../transactionFxUpdateJob";
import { initHistoricalPricesCron } from "../cron/historicalPricesCron";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook endpoint (must be before body parser middleware)
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const { handleStripeWebhook } = await import("../webhooks/stripe");
    await handleStripeWebhook(req, res);
  });
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Traditional login endpoint with server-side redirect for mobile compatibility
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const bcrypt = await import("bcryptjs");
      const { sdk } = await import("./sdk");
      const { COOKIE_NAME } = await import("@shared/const");
      const { getSessionCookieOptions } = await import("./cookies");
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }
      
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (!user) {
        return res.status(401).json({ error: "E-Mail oder Passwort falsch" });
      }
      
      // Verify password
      const isValid = await bcrypt.default.compare(password, user.password || "");
      if (!isValid) {
        return res.status(401).json({ error: "E-Mail oder Passwort falsch" });
      }
      
      // Ensure user has an openId (for email/password login users)
      let userOpenId = user.openId;
      if (!userOpenId) {
        userOpenId = `email_${user.id}`;
        // Update user with openId if missing
        await db.update(users).set({ openId: userOpenId }).where(eq(users.id, user.id));
      }
      
      // Create session token and set cookie
      const sessionToken = await sdk.createSessionToken(userOpenId, {
        name: user.name || `${user.firstName} ${user.lastName}`,
        expiresInMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      console.log("[Auth] Cookie set:", {
        cookieName: COOKIE_NAME,
        cookieOptions,
        userAgent: req.headers['user-agent'],
      });
      
      // Return success - client will handle redirect
      res.json({ success: true });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });
  
  // Traditional register endpoint with server-side redirect for mobile compatibility
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { firstName, lastName, email, password, mobile } = req.body;
      const { getDb } = await import("../db");
      const { users, newsletter } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const bcrypt = await import("bcryptjs");
      const { sdk } = await import("./sdk");
      const { COOKIE_NAME } = await import("@shared/const");
      const { getSessionCookieOptions } = await import("./cookies");
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }
      
      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser) {
        return res.status(400).json({ error: "E-Mail bereits registriert" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.default.hash(password, 10);
      
      // Create unique openId for guest user
      const openId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Insert user
      await db.insert(users).values({
        openId,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        mobile: mobile || null,
        name: `${firstName} ${lastName}`,
        loginMethod: "email",
      });
      
      // Add to newsletter
      try {
        await db.insert(newsletter).values({
          email,
          isActive: 1,
        });
      } catch (error) {
        console.error("Failed to add to newsletter:", error);
      }
      
      // Create session token and set cookie
      const sessionToken = await sdk.createSessionToken(openId, {
        name: `${firstName} ${lastName}`,
        expiresInMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      console.log("[Auth] Cookie set:", {
        cookieName: COOKIE_NAME,
        cookieOptions,
        userAgent: req.headers['user-agent'],
      });
      
      // Return success - client will handle redirect
      res.json({ success: true });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });
  
  // OAuth callback under /api/oauth/callback (DISABLED)
  // registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start price updater
    startPriceUpdater().catch(console.error);
    // Chart data updater disabled to prevent memory leaks
    // startChartDataUpdater().catch(console.error);
    // News updater disabled to reduce memory usage
    // initializeNewsUpdater();
    // Start PEG ratio updater
    initializePEGUpdater();
    // Start YTD updater (runs on January 1st)
    initYTDUpdater();
    // Start dividend capture job (runs daily at 6:00 AM)
    initDividendCaptureJob();
    // Start FX rates updater (runs daily at 6:30 AM)
    initFxRatesCron();
    // Start transaction FX rate update job (runs daily at 7:00 AM)
    initTransactionFxUpdateCron();
    // Start historical prices updater (runs daily at 2:00 AM UTC)
    initHistoricalPricesCron();
  });
}

startServer().catch(console.error);
