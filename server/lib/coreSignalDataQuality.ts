export const SIGNAL_GATE_MARKER = "[Signalgate]";

export type CoreSignalDataQualityInput = {
  signalScore: number | null;
  reason?: string | null;
  dataQualityStatus?: string | null;
  dataQualityNotes?: string | null;
};

export type CoreSignalDataQualityUpdate = {
  dataQualityStatus?: string | null;
  dataQualityNotes?: string | null;
  dataQualityUpdatedAt?: Date;
};

function removePriorGateNote(notes: string | null | undefined): string {
  return (notes ?? "")
    .split(" · ")
    .filter((note) => !note.startsWith(SIGNAL_GATE_MARKER))
    .join(" · ");
}

/**
 * Projects a core-signal data gap into the title's transparent data-quality
 * contract. A released signal removes only this module's own prior note; it
 * never hides independently recorded data-quality concerns.
 */
export function projectCoreSignalDataQuality(input: CoreSignalDataQualityInput): CoreSignalDataQualityUpdate {
  const notesWithoutPriorGate = removePriorGateNote(input.dataQualityNotes);
  if (input.signalScore === null) {
    return {
      dataQualityStatus: "pruefen",
      dataQualityNotes: [
        notesWithoutPriorGate,
        `${SIGNAL_GATE_MARKER} ${input.reason ?? "Keine freigegebene Kernsignalbasis"}`,
      ].filter(Boolean).join(" · "),
      dataQualityUpdatedAt: new Date(),
    };
  }

  if (!input.dataQualityNotes?.includes(SIGNAL_GATE_MARKER)) return {};
  return {
    // If the gate was the only recorded warning, return control to the normal
    // dynamic data-status calculation instead of asserting 'vollstaendig'.
    dataQualityStatus: notesWithoutPriorGate || input.dataQualityStatus !== "pruefen"
      ? undefined
      : null,
    dataQualityNotes: notesWithoutPriorGate || null,
    dataQualityUpdatedAt: new Date(),
  };
}
