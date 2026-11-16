import { MAX_NOTE_LENGTH } from "~/lib/notes";

/**
 * The one normalisation a Note body goes through before it is stored: the
 * text, trimmed. The server calls it before saving and the Note box calls it
 * before counting or comparing, so the two always agree.
 */
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

/**
 * Where the Student's draft stands against their saved Note (null if they
 * have none): how long it is, whether it fits, whether it has changed, and so
 * whether Save should be enabled.
 */
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
