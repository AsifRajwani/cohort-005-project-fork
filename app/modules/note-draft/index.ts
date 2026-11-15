import {
  describeNoteDraft as describe,
  normaliseNote as normalise,
  type NoteDraft,
} from "./lib/draft";

export type { NoteDraft };

/**
 * The one normalisation a Note body goes through before it is stored. The
 * server calls it before saving and the Note box calls it before counting or
 * comparing, so the two always agree.
 */
export function normaliseNote(body: string): string {
  return normalise(body);
}

/**
 * Where the Student's draft stands against their saved Note (null if they
 * have none): how long it is, whether it fits, whether it has changed, and so
 * whether Save should be enabled.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  return describe(draft, savedBody);
}
