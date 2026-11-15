import { MAX_NOTE_LENGTH } from "~/lib/notes";

/** What the server stores for a Note body: the text, trimmed. */
export function normaliseNote(body: string): string {
  return body.trim();
}

export type NoteDraft = {
  /** Characters the server would store. */
  length: number;
  max: number;
  tooLong: boolean;
  empty: boolean;
  /** The draft differs from the saved Note. */
  unsaved: boolean;
  canSave: boolean;
};

export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  const normalised = normaliseNote(draft);
  const length = normalised.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = length === 0;
  const unsaved = normalised !== (savedBody ?? "");

  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
