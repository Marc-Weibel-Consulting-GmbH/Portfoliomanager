export const COPILOT_TIMEOUT_HISTORY_MESSAGE =
  "Die Copilot-Antwort hat das Zeitlimit überschritten. Ihre Frage wurde gespeichert – bitte versuchen Sie es erneut.";

const COPILOT_GENERIC_FAILURE_HISTORY_MESSAGE =
  "Die Copilot-Antwort konnte momentan nicht erstellt werden. Ihre Frage wurde gespeichert – bitte versuchen Sie es erneut.";

type CopilotFailureStore = {
  appendAssistantMessage: (message: { conversationId: number; content: string }) => Promise<void>;
  touchConversation: (conversationId: number) => Promise<void>;
};

export async function persistCopilotFailure(
  store: CopilotFailureStore,
  conversationId: number,
  error: unknown
): Promise<string> {
  const errorMessage = error instanceof Error ? error.message : "";
  const content = errorMessage.includes("Zeitlimit")
    ? COPILOT_TIMEOUT_HISTORY_MESSAGE
    : COPILOT_GENERIC_FAILURE_HISTORY_MESSAGE;

  await store.appendAssistantMessage({ conversationId, content });
  await store.touchConversation(conversationId);
  return content;
}
