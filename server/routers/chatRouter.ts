import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { chatConversations, chatMessages, savedPortfolios, stocks } from "../../drizzle/schema";
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

      // Build portfolio context if available
      let portfolioContext = "";
      if (conversation.portfolioId) {
        const [portfolio] = await db
          .select()
          .from(savedPortfolios)
          .where(eq(savedPortfolios.id, conversation.portfolioId))
          .limit(1);

        if (portfolio) {
          portfolioContext = `\n\nAktuelles Portfolio-Kontext:\n`;
          portfolioContext += `- Portfolio Name: ${portfolio.name}\n`;
          portfolioContext += `- Status: ${portfolio.isLive ? "LIVE" : "TEST"}\n`;
          portfolioContext += `- Erstellt am: ${portfolio.createdAt}\n`;

          if (portfolio.portfolioData) {
            try {
              const data = JSON.parse(portfolio.portfolioData);
              if (data.stocks && Array.isArray(data.stocks)) {
                portfolioContext += `- Anzahl Positionen: ${data.stocks.length}\n`;
                portfolioContext += `\nPositionen:\n`;
                for (const stock of data.stocks.slice(0, 10)) {
                  portfolioContext += `  * ${stock.ticker}: ${stock.weight || 0}% (${stock.shares || 0} Aktien)\n`;
                }
              }
            } catch (e) {
              console.error("Failed to parse portfolio data:", e);
            }
          }
        }
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
- Antworte auf Deutsch
- Sei präzise und fundiert
- Verwende den Portfolio-Kontext, wenn verfügbar
- Erkläre komplexe Konzepte verständlich
- Gib keine Finanzberatung, sondern nur allgemeine Informationen
- Bei spezifischen Fragen zu Aktien, verwende dein Wissen über Finanzmärkte
${portfolioContext}`;

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
