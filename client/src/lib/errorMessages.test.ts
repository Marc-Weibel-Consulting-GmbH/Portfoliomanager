import { describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { getUserErrorMessage } from "./errorMessages";

// Konsole im Test stumm schalten (getUserErrorMessage loggt den Rohfehler)
vi.spyOn(console, "error").mockImplementation(() => {});

function trpcError(message: string, code?: string) {
  return TRPCClientError.from({
    error: {
      message,
      code: -32600,
      data: code ? { code, httpStatus: 400 } : undefined,
    },
  } as any);
}

describe("getUserErrorMessage (U-14)", () => {
  it("reicht BAD_REQUEST-Meldungen (eigene Business-/Zod-Fehler) durch", () => {
    expect(
      getUserErrorMessage(trpcError("Nicht genügend Stücke für den Verkauf vorhanden", "BAD_REQUEST"))
    ).toBe("Nicht genügend Stücke für den Verkauf vorhanden");
  });

  it("mappt bekannte tRPC-Codes auf deutsche Klartexte", () => {
    expect(getUserErrorMessage(trpcError("UNAUTHORIZED", "UNAUTHORIZED"))).toBe(
      "Bitte melden Sie sich an."
    );
    // Roher englischer Code (kein Leerzeichen) → generischer Text.
    expect(getUserErrorMessage(trpcError("forbidden", "FORBIDDEN"))).toBe(
      "Sie haben keine Berechtigung für diese Aktion."
    );
    // Bewusste deutsche Paywall-/Upgrade-Meldung → durchgereicht (A3).
    expect(
      getUserErrorMessage(trpcError("Ihr Plan erlaubt maximal 1 Live-Portfolios. Jetzt upgraden unter Einstellungen › Abo.", "FORBIDDEN"))
    ).toBe("Ihr Plan erlaubt maximal 1 Live-Portfolios. Jetzt upgraden unter Einstellungen › Abo.");
    expect(getUserErrorMessage(trpcError("rate limited", "TOO_MANY_REQUESTS"))).toBe(
      "Zu viele Versuche. Bitte warten Sie einen Moment."
    );
    expect(getUserErrorMessage(trpcError("not found", "NOT_FOUND"))).toBe(
      "Der angeforderte Eintrag wurde nicht gefunden."
    );
    expect(getUserErrorMessage(trpcError("timeout", "TIMEOUT"))).toBe(
      "Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut."
    );
  });

  it("erkennt Transportfehler ohne Server-Fehlerobjekt als Verbindungsfehler", () => {
    const networkError = TRPCClientError.from(new TypeError("Failed to fetch"));
    expect(getUserErrorMessage(networkError)).toBe(
      "Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut."
    );
  });

  it("fällt bei unbekannten Codes und Nicht-tRPC-Fehlern auf den generischen Text zurück", () => {
    expect(getUserErrorMessage(trpcError("boom", "INTERNAL_SERVER_ERROR"))).toBe(
      "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut."
    );
    expect(getUserErrorMessage(new Error("Database not available"))).toBe(
      "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut."
    );
    expect(getUserErrorMessage(undefined)).toBe(
      "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut."
    );
  });
});
