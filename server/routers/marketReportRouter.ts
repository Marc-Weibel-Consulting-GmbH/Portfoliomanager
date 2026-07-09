/**
 * Market Report Router
 * Verwaltet tägliche Markt-Update-Berichte von Manus-Tasks.
 * Berichte werden via POST /api/market-report empfangen und in der DB gespeichert.
 */
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketReports } from "../../drizzle/schema";

export const marketReportRouter = router({
  /**
   * Neuesten Bericht abrufen
   */
  getLatest: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(marketReports)
      .orderBy(desc(marketReports.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }),

  /**
   * Liste der letzten Berichte (max. 30)
   */
  list: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(marketReports)
        .orderBy(desc(marketReports.createdAt))
        .limit(input?.limit ?? 10);
      return rows;
    }),

  /**
   * Bericht manuell erstellen (Admin only)
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      content: z.string().min(1),
      reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      source: z.string().optional(),
      taskId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Nur Admins können Berichte erstellen");
      }
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      await db.insert(marketReports).values({
        title: input.title,
        content: input.content,
        reportDate: input.reportDate,
        source: input.source ?? "manual",
        taskId: input.taskId ?? null,
      });
      return { success: true };
    }),

  /**
   * Bericht löschen (Admin only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Nur Admins können Berichte löschen");
      }
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      await db.delete(marketReports).where(eq(marketReports.id, input.id));
      return { success: true };
    }),
});

/**
 * Express-Handler für POST /api/market-report
 * Empfängt Berichte von Manus-Tasks via API-Key-Authentifizierung.
 */
export async function handleMarketReportWebhook(req: any, res: any) {
  try {
    // API-Key Authentifizierung
    const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
    const expectedKey = process.env.MARKET_REPORT_API_KEY || process.env.JWT_SECRET;
    
    if (!apiKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: "Ungültiger API-Key" });
    }

    const { title, content, reportDate, source, taskId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title und content sind erforderlich" });
    }

    const date = reportDate || new Date().toISOString().split("T")[0];

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Datenbank nicht verfügbar" });
    }

    // Deduplizierung via taskId
    if (taskId) {
      const { eq } = await import("drizzle-orm");
      const existing = await db
        .select({ id: marketReports.id })
        .from(marketReports)
        .where(eq(marketReports.taskId, taskId))
        .limit(1);
      if (existing.length > 0) {
        return res.status(200).json({ success: true, message: "Bericht bereits vorhanden", id: existing[0].id });
      }
    }

    const result = await db.insert(marketReports).values({
      title: title.slice(0, 500),
      content,
      reportDate: date,
      source: source ?? "manus_task",
      taskId: taskId ?? null,
    });

    console.log(`[MarketReport] Neuer Bericht gespeichert: "${title}" (${date})`);
    return res.status(201).json({ success: true, message: "Bericht gespeichert" });
  } catch (err: any) {
    console.error("[MarketReport] Fehler beim Speichern:", err);
    return res.status(500).json({ error: "Interner Fehler", details: err.message });
  }
}
