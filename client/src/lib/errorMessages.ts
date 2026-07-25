import { TRPCClientError } from "@trpc/client";

// U-14: Zentrale, deutsche Fehlertexte für Endkunden statt roher
// error.message-Durchreichung («UNAUTHORIZED», Zod-JSON, englische Servertexte).

const FALLBACK_MESSAGE =
  "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.";
const NETWORK_MESSAGE =
  "Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.";

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Bitte melden Sie sich an.",
  FORBIDDEN: "Sie haben keine Berechtigung für diese Aktion.",
  TOO_MANY_REQUESTS: "Zu viele Versuche. Bitte warten Sie einen Moment.",
  NOT_FOUND: "Der angeforderte Eintrag wurde nicht gefunden.",
  TIMEOUT: NETWORK_MESSAGE,
};

/**
 * Übersetzt einen (tRPC-)Fehler in einen nutzergerechten deutschen Text.
 *
 * Regel: BAD_REQUEST-Meldungen stammen von unseren bewusst formulierten
 * Business-/Validierungsfehlern (z. B. Oversell, FX) und werden durchgereicht;
 * alle anderen Codes werden auf feste deutsche Texte gemappt. Der rohe Fehler
 * wird für die Diagnose in die Konsole geloggt.
 */
export function getUserErrorMessage(error: unknown): string {
  console.error("[getUserErrorMessage]", error);

  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | null | undefined)?.code;
    if (code === "BAD_REQUEST" && error.message) {
      return error.message;
    }
    // FORBIDDEN: Der Server formuliert hier bewusste, kundengerechte deutsche
    // Meldungen — vor allem die Plan-/Paywall-Hinweise («… Teil von Basic/Pro.
    // Jetzt upgraden …», «Ihr Plan erlaubt maximal N …»). Diese durchreichen
    // statt sie durch einen generischen Text zu ersetzen, macht die Gates zu
    // sofort verständlichen Upgrade-Prompts. Nur echte englische Roh-Codes
    // (kein Leerzeichen, komplett GROSS) fallen auf den festen Text zurück.
    if (code === "FORBIDDEN" && error.message && /\s/.test(error.message) && error.message !== error.message.toUpperCase()) {
      return error.message;
    }
    if (code && CODE_MESSAGES[code]) {
      return CODE_MESSAGES[code];
    }
    // Kein strukturiertes Fehlerobjekt vom Server → Transport-/Netzwerkfehler
    // (z. B. "Failed to fetch", abgebrochene Verbindung).
    if (!error.data) {
      return NETWORK_MESSAGE;
    }
  }

  return FALLBACK_MESSAGE;
}
