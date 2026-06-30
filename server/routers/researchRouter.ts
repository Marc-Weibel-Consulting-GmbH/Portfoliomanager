import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { researchDocuments, multiAgentSessions } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { storagePut, storageGet } from "../storage";
import { getSecret } from "../_core/secretsManager";

// ============================================
// Document Text Extraction
// ============================================
async function extractTextFromBuffer(buffer: Buffer, fileType: string, filename: string): Promise<string> {
  try {
    if (fileType === "pdf") {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default;
      const data = await pdfParse(buffer);
      return data.text || "";
    }
    if (fileType === "word") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
    if (fileType === "excel") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      let text = "";
      workbook.eachSheet((sheet) => {
        text += `\n--- Sheet: ${sheet.name} ---\n`;
        sheet.eachRow((row) => {
          const values = (row.values as any[]).slice(1).map(v => v?.toString() || "").join(" | ");
          text += values + "\n";
        });
      });
      return text;
    }
    if (fileType === "ppt") {
      const officeparser = await import("officeparser");
      const parseFn = (officeparser as any).parseOfficeAsync || (officeparser as any).parseOffice || (officeparser as any).default?.parseOfficeAsync;
      if (parseFn) {
        const text = await parseFn(buffer);
        return text || "";
      }
      return "[PPT extraction not available]";
    }
    return "";
  } catch (error: any) {
    console.error(`[Research] Text extraction failed for ${filename}:`, error.message);
    return `[Extraction error: ${error.message}]`;
  }
}

function detectFileType(filename: string): "pdf" | "word" | "ppt" | "excel" | "other" {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  return "other";
}

// ============================================
// LLM Analysis of Research Document
// ============================================
async function analyzeDocument(extractedText: string, title: string): Promise<{
  summary: string;
  keyInsights: string[];
  relevantTickers: string[];
}> {
  const truncatedText = extractedText.slice(0, 8000); // Limit to ~8K chars for speed
  
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Du bist ein Finanzanalyst. Analysiere das Research-Dokument und antworte im vorgegebenen JSON-Format auf Deutsch."
      },
      {
        role: "user",
        content: `Analysiere dieses Dokument:\n\nTitel: "${title}"\n\nInhalt (gekürzt):\n${truncatedText}\n\nErstelle:\n1. summary: Zusammenfassung max. 200 Wörter\n2. keyInsights: Array mit max. 6 wichtigsten Erkenntnissen (je 1 Satz)\n3. relevantTickers: Array mit erwähnten Aktien-Ticker-Symbolen (z.B. AAPL, NESN.SW)`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "document_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Zusammenfassung des Dokuments auf Deutsch" },
            keyInsights: { type: "array", items: { type: "string" }, description: "Wichtigste Erkenntnisse" },
            relevantTickers: { type: "array", items: { type: "string" }, description: "Erwähnte Aktien-Ticker" }
          },
          required: ["summary", "keyInsights", "relevantTickers"],
          additionalProperties: false
        }
      }
    }
  });

  try {
    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    console.log(`[Research] Analysis complete for "${title}": ${parsed.summary?.length} chars summary, ${parsed.keyInsights?.length} insights`);
    return {
      summary: parsed.summary || "Keine Zusammenfassung verfügbar",
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      relevantTickers: Array.isArray(parsed.relevantTickers) ? parsed.relevantTickers : [],
    };
  } catch (err: any) {
    const rawContent = result.choices[0]?.message?.content;
    const preview = typeof rawContent === 'string' ? rawContent.substring(0, 200) : JSON.stringify(rawContent)?.substring(0, 200);
    console.error(`[Research] Analysis parse error for "${title}":`, err.message, preview);
    return { summary: "Analyse fehlgeschlagen", keyInsights: [], relevantTickers: [] };
  }
}

// ============================================
// Multi-Agent Orchestrator
// ============================================
async function callAnthropic(prompt: string, systemPrompt: string): Promise<{ response: string; tokens: number; durationMs: number }> {
  const apiKey = await getSecret("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Anthropic API Key nicht konfiguriert");
  
  const start = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }
  
  const data = await res.json();
  const durationMs = Date.now() - start;
  const text = data.content?.[0]?.text || "";
  const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  
  return { response: text, tokens, durationMs };
}

async function callPerplexity(prompt: string, systemPrompt: string): Promise<{ response: string; tokens: number; durationMs: number }> {
  const apiKey = await getSecret("PERPLEXITY_API_KEY");
  if (!apiKey) throw new Error("Perplexity API Key nicht konfiguriert");
  
  const start = Date.now();
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error: ${res.status} - ${err}`);
  }
  
  const data = await res.json();
  const durationMs = Date.now() - start;
  const text = data.choices?.[0]?.message?.content || "";
  const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
  
  return { response: text, tokens, durationMs };
}

async function callManusLLM(prompt: string, systemPrompt: string): Promise<{ response: string; tokens: number; durationMs: number }> {
  const start = Date.now();
  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });
  const durationMs = Date.now() - start;
  const text = typeof result.choices[0]?.message?.content === "string" 
    ? result.choices[0].message.content 
    : "";
  const tokens = result.usage?.total_tokens || 0;
  
  return { response: text, tokens, durationMs };
}

// ============================================
// Router
// ============================================
export const researchRouter = router({
  // --- Research Documents ---
  listDocuments: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const docs = await db.select().from(researchDocuments).orderBy(desc(researchDocuments.uploadedAt));
    return docs;
  }),

  getDocument: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, input.id));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return doc;
    }),

  uploadDocument: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      filename: z.string().min(1),
      fileBase64: z.string(), // base64 encoded file content
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const fileType = detectFileType(input.filename);
      const buffer = Buffer.from(input.fileBase64, "base64");
      const fileSize = buffer.length;

      // Upload to S3
      const key = `research/${Date.now()}-${input.filename}`;
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ppt: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        other: "application/octet-stream",
      };
      
      const { url: fileUrl } = await storagePut(key, buffer, contentTypeMap[fileType] || "application/octet-stream");

      // Insert record
      const [inserted] = await db.insert(researchDocuments).values({
        title: input.title,
        filename: input.filename,
        fileUrl,
        fileType,
        fileSize,
        status: "extracting",
        uploadedBy: ctx.user?.id || null,
      }).$returningId();

      const docId = inserted.id;

      // Process async (extract + analyze)
      (async () => {
        try {
          // Extract text
          const extractedText = await extractTextFromBuffer(buffer, fileType, input.filename);
          await db.update(researchDocuments)
            .set({ extractedText, status: "analyzing" })
            .where(eq(researchDocuments.id, docId));

          // Analyze with LLM
          const analysis = await analyzeDocument(extractedText, input.title);
          await db.update(researchDocuments)
            .set({
              summary: analysis.summary,
              keyInsights: analysis.keyInsights,
              relevantTickers: analysis.relevantTickers,
              status: "ready",
              analyzedAt: new Date(),
            })
            .where(eq(researchDocuments.id, docId));

          console.log(`[Research] Document ${docId} analyzed successfully`);
        } catch (error: any) {
          console.error(`[Research] Processing failed for doc ${docId}:`, error.message);
          await db.update(researchDocuments)
            .set({ status: "error", errorMessage: error.message })
            .where(eq(researchDocuments.id, docId));
        }
      })();

      return { id: docId, status: "extracting" };
    }),

  deleteDocument: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.delete(researchDocuments).where(eq(researchDocuments.id, input.id));
      return { success: true };
    }),

  reanalyzeDocument: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      
      const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, input.id));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(researchDocuments)
        .set({ status: "extracting", errorMessage: null })
        .where(eq(researchDocuments.id, input.id));

      // Re-extract and re-analyze async
      (async () => {
        try {
          let extractedText = doc.extractedText || "";
          
          // Re-extract if text is missing or was an error
          if (!extractedText || extractedText.startsWith("[Extraction error")) {
            if (!doc.fileUrl) throw new Error("No file URL available for re-extraction");
            // Download file from S3
            const response = await fetch(doc.fileUrl);
            if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            extractedText = await extractTextFromBuffer(buffer, doc.fileType || "pdf", doc.filename);
            await db.update(researchDocuments)
              .set({ extractedText, status: "analyzing" })
              .where(eq(researchDocuments.id, input.id));
          } else {
            await db.update(researchDocuments)
              .set({ status: "analyzing" })
              .where(eq(researchDocuments.id, input.id));
          }

          // Analyze with LLM
          const analysis = await analyzeDocument(extractedText, doc.title);
          await db.update(researchDocuments)
            .set({
              summary: analysis.summary,
              keyInsights: analysis.keyInsights,
              relevantTickers: analysis.relevantTickers,
              status: "ready",
              analyzedAt: new Date(),
            })
            .where(eq(researchDocuments.id, input.id));
          console.log(`[Research] Document ${input.id} re-analyzed successfully`);
        } catch (error: any) {
          console.error(`[Research] Re-analysis failed for doc ${input.id}:`, error.message);
          await db.update(researchDocuments)
            .set({ status: "error", errorMessage: error.message })
            .where(eq(researchDocuments.id, input.id));
        }
      })();

      return { success: true };
    }),

  // Get all research insights for CopilotInsights context
  getResearchContext: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { insights: [], tickers: [] };
    
    const docs = await db.select({
      summary: researchDocuments.summary,
      keyInsights: researchDocuments.keyInsights,
      relevantTickers: researchDocuments.relevantTickers,
      title: researchDocuments.title,
      analyzedAt: researchDocuments.analyzedAt,
    })
    .from(researchDocuments)
    .where(eq(researchDocuments.status, "ready"))
    .orderBy(desc(researchDocuments.analyzedAt))
    .limit(20);

    const allInsights: string[] = [];
    const allTickers: string[] = [];
    
    for (const doc of docs) {
      if (doc.summary) allInsights.push(`[${doc.title}]: ${doc.summary}`);
      if (Array.isArray(doc.keyInsights)) {
        allInsights.push(...(doc.keyInsights as string[]));
      }
      if (Array.isArray(doc.relevantTickers)) {
        allTickers.push(...(doc.relevantTickers as string[]));
      }
    }

    return { insights: allInsights, tickers: [...new Set(allTickers)] };
  }),

  // --- Multi-Agent System ---
  listSessions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(multiAgentSessions).orderBy(desc(multiAgentSessions.createdAt)).limit(50);
  }),

  getSession: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [session] = await db.select().from(multiAgentSessions).where(eq(multiAgentSessions.id, input.id));
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  runMultiAgent: adminProcedure
    .input(z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      providers: z.array(z.enum(["manus", "anthropic", "perplexity"])).default(["manus", "anthropic", "perplexity"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Create session
      const [inserted] = await db.insert(multiAgentSessions).values({
        prompt: input.prompt,
        context: input.context || null,
        status: "running",
        createdBy: ctx.user?.id || null,
      }).$returningId();

      const sessionId = inserted.id;

      // Run agents in parallel (async)
      (async () => {
        try {
          const systemPrompt = `Du bist ein Experte für Finanzmärkte und Portfolio-Management. Beantworte die Frage präzise und faktenbasiert auf Deutsch. Wenn du unsicher bist, sage es. Gib konkrete Empfehlungen mit Begründung.${input.context ? `\n\nKontext: ${input.context}` : ""}`;

          const agentPromises: Promise<{ provider: string; model: string; response: string; tokens: number; durationMs: number }>[] = [];

          if (input.providers.includes("manus")) {
            agentPromises.push(
              callManusLLM(input.prompt, systemPrompt)
                .then(r => ({ provider: "Manus (Gemini)", model: "gemini-2.5-flash", ...r }))
                .catch(e => ({ provider: "Manus (Gemini)", model: "gemini-2.5-flash", response: `[Fehler: ${e.message}]`, tokens: 0, durationMs: 0 }))
            );
          }
          if (input.providers.includes("anthropic")) {
            agentPromises.push(
              callAnthropic(input.prompt, systemPrompt)
                .then(r => ({ provider: "Anthropic", model: "claude-sonnet-4-20250514", ...r }))
                .catch(e => ({ provider: "Anthropic", model: "claude-sonnet-4-20250514", response: `[Fehler: ${e.message}]`, tokens: 0, durationMs: 0 }))
            );
          }
          if (input.providers.includes("perplexity")) {
            agentPromises.push(
              callPerplexity(input.prompt, systemPrompt)
                .then(r => ({ provider: "Perplexity", model: "sonar-pro", ...r }))
                .catch(e => ({ provider: "Perplexity", model: "sonar-pro", response: `[Fehler: ${e.message}]`, tokens: 0, durationMs: 0 }))
            );
          }

          const responses = await Promise.all(agentPromises);

          // Update with responses
          await db.update(multiAgentSessions)
            .set({ responses, status: "synthesizing" })
            .where(eq(multiAgentSessions.id, sessionId));

          // Filter successful responses for synthesis
          const successfulResponses = responses.filter(r => !r.response.startsWith("[Fehler:"));
          
          if (successfulResponses.length === 0) {
            await db.update(multiAgentSessions)
              .set({ status: "error", errorMessage: "Alle Modelle haben Fehler zurückgegeben. Bitte API-Keys prüfen." })
              .where(eq(multiAgentSessions.id, sessionId));
            return;
          }

          // Synthesis step: use Manus LLM as supervisor
          // Truncate each response to max 1500 chars to keep synthesis fast
          const MAX_CHARS_PER_MODEL = 1500;
          const failedProviders = responses.filter(r => r.response.startsWith("[Fehler:")).map(r => r.provider);
          const synthesisPrompt = `Frage: "${input.prompt}"

Antworten der KI-Modelle (gekürzt):
${successfulResponses.map((r) => `[${r.provider}]: ${r.response.substring(0, MAX_CHARS_PER_MODEL)}${r.response.length > MAX_CHARS_PER_MODEL ? "..." : ""}`).join("\n\n")}
${failedProviders.length > 0 ? `\n(${failedProviders.join(", ")} nicht verfügbar)\n` : ""}
Aufgabe: Erstelle eine kurze, strukturierte Best-Practice-Synthese auf Deutsch:
- Konsens: Was sind die Kernaussagen aller Modelle?
- Unterschiede: Wo gibt es abweichende Einschätzungen?
- Empfehlung: Optimale Schlussfolgerung

Maximal 400 Wörter, prägnant und faktenbasiert.`;

          let synthesisResult;
          try {
            synthesisResult = await callManusLLM(synthesisPrompt, "Du bist ein erfahrener Finanzanalyst der verschiedene Expertenmeinungen zu einer Best-Practice-Empfehlung konsolidiert.");
          } catch (synthError: any) {
            // If synthesis fails, try with a shorter prompt (truncate responses)
            console.warn(`[MultiAgent] Synthesis failed, retrying with truncated input:`, synthError.message);
            const shortPrompt = `Fasse die folgenden Antworten zur Frage "${input.prompt}" zusammen:\n\n${successfulResponses.map(r => `${r.provider}: ${r.response.substring(0, 2000)}`).join("\n\n")}`;
            try {
              synthesisResult = await callManusLLM(shortPrompt, "Erstelle eine konsolidierte Zusammenfassung auf Deutsch.");
            } catch (retryError: any) {
              // Store partial results even if synthesis fails
              await db.update(multiAgentSessions)
                .set({ status: "error", errorMessage: `Synthese fehlgeschlagen: ${retryError.message}. Einzelantworten sind verfügbar.` })
                .where(eq(multiAgentSessions.id, sessionId));
              return;
            }
          }
          
          await db.update(multiAgentSessions)
            .set({
              synthesis: synthesisResult.response,
              status: "completed",
              completedAt: new Date(),
            })
            .where(eq(multiAgentSessions.id, sessionId));

          console.log(`[MultiAgent] Session ${sessionId} completed successfully`);
        } catch (error: any) {
          console.error(`[MultiAgent] Session ${sessionId} failed:`, error.message);
          await db.update(multiAgentSessions)
            .set({ status: "error", errorMessage: error.message })
            .where(eq(multiAgentSessions.id, sessionId));
        }
      })();

      return { id: sessionId, status: "running" };
    }),

  deleteSession: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(multiAgentSessions).where(eq(multiAgentSessions.id, input.id));
      return { success: true };
    }),
});
