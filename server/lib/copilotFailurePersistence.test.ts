import { describe, expect, it, vi } from "vitest";
import {
  COPILOT_TIMEOUT_HISTORY_MESSAGE,
  persistCopilotFailure,
} from "./copilotFailurePersistence";

describe("persistCopilotFailure", () => {
  it("speichert bei einem Timeout eine verständliche Assistentennachricht und aktualisiert die Konversation", async () => {
    const appendAssistantMessage = vi.fn().mockResolvedValue(undefined);
    const touchConversation = vi.fn().mockResolvedValue(undefined);

    await persistCopilotFailure(
      { appendAssistantMessage, touchConversation },
      42,
      new Error("Copilot-Antwort hat das Zeitlimit überschritten.")
    );

    expect(appendAssistantMessage).toHaveBeenCalledWith({
      conversationId: 42,
      content: COPILOT_TIMEOUT_HISTORY_MESSAGE,
    });
    expect(touchConversation).toHaveBeenCalledWith(42);
  });
});
