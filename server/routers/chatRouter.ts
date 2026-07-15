import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { chatConversations, chatMessages } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

/**
 * Chat Router - AI-powered portfolio assistant
 * Provides conversational interface for portfolio analysis and insights
 */
export const chatRouter = router({
  /**
   * Create a new chat conversation
   */
  createConversation: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number().optional(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [conversation] = await db.insert(chatConversations).values({
        userId: ctx.user.id,
        portfolioId: input.portfolioId,
        title: input.title || "Neue Konversation",
      });

      return {
        id: conversation.insertId,
        title: input.title || "Neue Konversation",
      };
    }),

  /**
   * Get all conversations for the current user
   */
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const conversations = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, ctx.user.id))
      .orderBy(desc(chatConversations.updatedAt));

    return conversations;
  }),

  /**
   * Get messages for a specific conversation
   */
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify conversation belongs to user
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.id, input.conversationId),
            eq(chatConversations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, input.conversationId))
        .orderBy(chatMessages.createdAt);

      return messages;
    }),

  /**
   * Send a message and get AI response
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify conversation belongs to user
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.id, input.conversationId),
            eq(chatConversations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      // Save user message
      await db.insert(chatMessages).values({
        conversationId: input.conversationId,
        role: "user" as const,
        content: input.message,
      } as const);

      // Get conversation history (last 10 messages for context)
      const history = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, input.conversationId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(10);

      // Reverse to get chronological order
      const contextMessages = history.reverse();

      // Portfolio-Steckbrief (Stufe 1): kompakter Überblick über ALLE eigenen
      // Portfolios + Live-Bewertung des Fokus-Portfolios (verknüpft oder
      // grösstes Live-Portfolio) — vorher sah der Assistent nur 10 Positionen
      // und auch das nur bei verknüpfter Konversation.
      const { buildPortfolioBriefing, APP_HANDBUCH } = await import("../lib/copilotContext");
      let portfolioContext = "";
      try {
        const briefing = await buildPortfolioBriefing(ctx.user.id, conversation.portfolioId);
        if (briefing) portfolioContext = `\n\n${briefing}`;
      } catch (e) {
        console.warn("[chat] Portfolio-Steckbrief fehlgeschlagen:", (e as Error).message);
      }

      // Live-Fundamentaldaten (Financial Datasets, nur US-Titel): Wenn die
      // Nachricht Ticker aus dem Bestand erwähnt, echte Bilanz-Fakten in den
      // Kontext geben statt Modellwissen raten zu lassen. Non-fatal + begrenzt.
      let fundamentalsContext = "";
      try {
        const { isFinancialDatasetsConfigured, getFundamentalsFactsBatch } = await import("../lib/financialDatasets");
        if (isFinancialDatasetsConfigured()) {
          const { stocks: stocksTable } = await import("../../drizzle/schema");
          const knownTickers = new Set(
            (await db.select({ ticker: stocksTable.ticker }).from(stocksTable)).map((r) => r.ticker.toUpperCase())
          );
          const mentioned = Array.from(new Set(
            (input.message.toUpperCase().match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/g) ?? [])
              .filter((t) => knownTickers.has(t))
          ));
          const facts = await getFundamentalsFactsBatch(mentioned, 2);
          if (facts.length > 0) {
            fundamentalsContext =
              `\n\nLive-Fundamentaldaten (Quelle: Financial Datasets, nur US-Titel — nutze diese Zahlen statt Schätzungen):\n` +
              facts.map((f) => `- ${f.summary}`).join("\n");
          }
        }
      } catch (e) {
        console.warn("[chat] Fundamentaldaten-Anreicherung fehlgeschlagen:", (e as Error).message);
      }

      // Build system prompt for portfolio assistant
      const systemPrompt = `Du bist ein hilfreicher Portfolio-Assistent für eine Aktienportfolio-Analyse-Plattform.

Deine Aufgaben:
- Portfolio-Analysen durchführen und Performance erklären
- Aktien-Empfehlungen basierend auf dem aktuellen Portfolio geben
- Markt-Insights und Trends erklären
- Diversifikations-Tipps geben
- Risiko-Analysen durchführen
- Fragen zu Finanzen, Investitionen und Portfolios beantworten

Wichtige Hinweise:
- Antworte auf Deutsch, in der Sie-Form
- Sei präzise und fundiert
- Nutze die untenstehenden Portfolio-Daten für Fragen zum eigenen Portfolio — rechne mit DIESEN Zahlen statt zu schätzen; fehlt eine Angabe, sage das ehrlich
- Bei Fragen zu App-Funktionen: nutze ausschliesslich die Funktionsübersicht und nenne den Ort in der App — erfinde keine Funktionen
- Erkläre komplexe Konzepte verständlich
- Gib keine Finanzberatung, sondern nur allgemeine Informationen

${APP_HANDBUCH}
${portfolioContext}${fundamentalsContext}`;

      // Prepare messages for LLM
      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...contextMessages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
      ];

      try {
        // Call LLM
        const response = await invokeLLM({
          messages: llmMessages,
        });

        // Normalize content to string (LLM can return string or array)
        const rawContent = response.choices[0]?.message?.content;
        const assistantMessage = typeof rawContent === 'string' 
          ? rawContent 
          : Array.isArray(rawContent)
            ? rawContent.map(part => {
                if (typeof part === 'string') return part;
                if ('text' in part) return part.text;
                if ('image_url' in part) return `[Image: ${part.image_url.url}]`;
                if ('file_url' in part) return `[File: ${part.file_url.url}]`;
                return '';
              }).join('\n')
            : "Entschuldigung, ich konnte keine Antwort generieren.";

        // Save assistant response
        await db.insert(chatMessages).values({
          conversationId: input.conversationId,
          role: "assistant" as const,
          content: assistantMessage,
        } as const);

        // Update conversation timestamp
        await db
          .update(chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(chatConversations.id, input.conversationId));

        // Auto-generate title from first message if still default
        if (conversation.title === "Neue Konversation" && contextMessages.length <= 1) {
          const titlePrompt = `Generiere einen kurzen, prägnanten Titel (max. 50 Zeichen) für diese Konversation basierend auf der ersten Frage: "${input.message}". Antworte nur mit dem Titel, ohne Anführungszeichen.`;
          
          try {
            const titleResponse = await invokeLLM({
              messages: [
                { role: "system", content: "Du bist ein Assistent, der prägnante Titel generiert." },
                { role: "user", content: titlePrompt },
              ],
            });

            const rawContent = titleResponse.choices[0]?.message?.content;
            const title = (typeof rawContent === 'string' ? rawContent.trim() : conversation.title);
            await db
              .update(chatConversations)
              .set({ title: title.substring(0, 50) })
              .where(eq(chatConversations.id, input.conversationId));
          } catch (e) {
            console.error("Failed to generate title:", e);
          }
        }

        return {
          message: assistantMessage,
          conversationId: input.conversationId,
        };
      } catch (error) {
        console.error("LLM Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fehler beim Generieren der Antwort. Bitte versuche es erneut.",
        });
      }
    }),

  /**
   * Delete a conversation
   */
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify conversation belongs to user
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.id, input.conversationId),
            eq(chatConversations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      // Delete all messages first
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, input.conversationId));

      // Delete conversation
      await db.delete(chatConversations).where(eq(chatConversations.id, input.conversationId));

      return { success: true };
    }),
});
