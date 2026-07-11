import express from "express";
import "./secretsTimingTest"; // Start timing tests on server boot
import "./logMonitor"; // Start log monitoring
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { COOKIE_NAME } from "@shared/const";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { AuthError, loginSchema, loginUser, registerSchema, registerUser, SESSION_MAX_AGE_MS } from "./authService";
import { getClientIp, isRateLimited, LOGIN_RATE_LIMIT, RATE_LIMIT_MESSAGE, REGISTER_RATE_LIMIT } from "./rateLimit";
import { serveStatic, setupVite } from "./vite";
import { startPriceUpdater } from "../priceUpdater";
import { initializeNewsUpdater } from "../newsUpdater";
import { initializePEGUpdater } from "../pegUpdater";
import { initYTDUpdater } from "../cron/ytdUpdater";
import { initDividendCaptureJob } from "../dividendCaptureJob";
import { initFxRatesCron } from "../fxRatesFetchJob";
import { initTransactionFxUpdateCron } from "../transactionFxUpdateJob";
import { initHistoricalPricesCron } from "../cron/historicalPricesCron";
import { initDailyRefreshCron } from "./dailyRefreshCron";
import { initPriceAlertsCron } from "../cron/priceAlertsCron";
import { initWatchlistAlertsCron } from "../cron/watchlistAlertsCron";
import { initLpplBubbleAlertCron } from "../cron/lpplBubbleAlertCron";
import { initMlTrainingCron } from "../cron/mlTrainingCron";
import { initSignalEvaluationCron } from "../cron/signalEvaluationCron";
import { initSignalCacheCron } from "../cron/signalCacheCron";
import { initMarketAnalysisCron } from "../cron/marketAnalysisCron";
import { initRecommendationCron } from "../cron/recommendationCron";
import { checkDatabaseHealth } from "./dbHealthcheck";
import { handleWalkForwardWeekly, handleLPPLMonitoring, handleEvaluateRecommendations } from "../scheduled/copilotScheduled";
import { handlePriceAlertsCheck } from "../scheduled/priceAlertsScheduled";
import { handleWeeklyReview } from "../scheduled/weeklyReviewScheduled";
import { handleHistoricalPricesUpdate } from "../scheduled/historicalPricesScheduled";
import { handleScoreSnapshot } from "../scheduled/scoreSnapshotScheduled";
import { handleSignalAlerts } from "../scheduled/signalAlertsScheduled";
import { handleOptimizationAlert } from "../scheduled/optimizationAlertScheduled";
import { handleMarketReportWebhook } from "../routers/marketReportRouter";

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
  
  // Body-parser limit (A-04): the largest legitimate payload is the PDF import
  // (pdfImportRouter caps files at 20 MB; sent as base64 → ~27 MB JSON), so
  // 30 MB covers it with headroom. Previously 50 MB.
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ limit: "30mb", extended: true }));
  // Traditional login endpoint — thin delegate to the shared auth service (D-08).
  // Cookie handling stays here in the transport layer; client expects { success: true }.
  app.post("/api/auth/login", async (req, res) => {
    try {
      if (isRateLimited(`login:${getClientIp(req)}`, LOGIN_RATE_LIMIT)) {
        return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
      }

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Ungültige Eingabe: Bitte E-Mail und Passwort prüfen" });
      }

      const { sessionToken } = await loginUser(parsed.data.email, parsed.data.password);

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: SESSION_MAX_AGE_MS,
      });

      // Return success - client will handle redirect
      res.json({ success: true });
    } catch (error: any) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });

  // Traditional register endpoint — thin delegate to the shared auth service (D-08).
  app.post("/api/auth/register", async (req, res) => {
    try {
      if (isRateLimited(`register:${getClientIp(req)}`, REGISTER_RATE_LIMIT)) {
        return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
      }

      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Ungültige Eingabe: Bitte alle Felder prüfen (Passwort mind. 8 Zeichen)" });
      }

      const { sessionToken } = await registerUser(parsed.data);

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: SESSION_MAX_AGE_MS,
      });

      // Return success - client will handle redirect
      res.json({ success: true });
    } catch (error: any) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Register error:", error);
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });
  
  // OAuth callback under /api/oauth/callback (DISABLED)
  // registerOAuthRoutes(app);
  
  // Debug endpoint (only in development)
  if (process.env.NODE_ENV === "development") {
    const { debugRouter } = await import("../debug-endpoint");
    app.use("/api", debugRouter);
  }
  
  // Scheduled endpoints (Heartbeat cron callbacks)
  app.post("/api/scheduled/walkForwardWeekly", handleWalkForwardWeekly);
  app.post("/api/scheduled/lpplMonitoring", handleLPPLMonitoring);
  app.post("/api/scheduled/evaluateRecommendations", handleEvaluateRecommendations);
  app.post("/api/scheduled/priceAlertsCheck", handlePriceAlertsCheck);
  app.post("/api/scheduled/weeklyReview", handleWeeklyReview);
  app.post("/api/scheduled/historicalPricesUpdate", handleHistoricalPricesUpdate);
  app.post("/api/scheduled/scoreSnapshot", handleScoreSnapshot);
  app.post("/api/scheduled/signalAlerts", handleSignalAlerts);
  app.post("/api/scheduled/optimizationAlert", handleOptimizationAlert);

  // Market Report Webhook (empfängt tägliche Berichte von Manus-Tasks)
  app.post("/api/market-report", handleMarketReportWebhook);

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

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Run database healthcheck (dev only)
    await checkDatabaseHealth();
    
    // Start price updater
    startPriceUpdater().catch(console.error);
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
    // Start daily stock-data refresh incl. daily change (runs daily at 23:00 UTC)
    initDailyRefreshCron();
    // Start price alerts checker (runs every hour)
    initPriceAlertsCron();
    // Start watchlist alerts checker (runs every 4h during market hours)
    initWatchlistAlertsCron();
    // Start LPPL bubble alert checker (runs daily at 20:00 UTC)
    initLpplBubbleAlertCron();
    // Start weekly ML pre-training (no-op unless ANALYTICS_SERVICE_URL is set)
    initMlTrainingCron();
    // Start signal evaluation cron (daily lookback + snapshot)
    initSignalEvaluationCron();
    // Start signal cache cron (pre-computes signals every 2h for fast portfolio signal loading)
    initSignalCacheCron();
    // Start market analysis cron (daily 08:00 CET = 07:00 UTC)
    initMarketAnalysisCron();
    // Start recommendation cron (Track D: daily due-check per portfolio cadence)
    initRecommendationCron();
  });
}

startServer().catch(console.error);
