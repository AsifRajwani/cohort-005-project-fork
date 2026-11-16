import { describe, it, expect } from "vitest";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeNoteDraft, normaliseNote } from "../index";

describe("normaliseNote", () => {
  it("trims surrounding whitespace and keeps the inside", () => {
    expect(normaliseNote("  first line\n\n  second  \n")).toBe(
      "first line\n\n  second"
    );
  });
});

describe("describeNoteDraft", () => {
  it("cannot save an empty draft when there is no Note", () => {
    expect(describeNoteDraft("", null)).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      tooLong: false,
      empty: true,
      unsaved: false,
      canSave: false,
    });
  });

  it("treats a whitespace-only draft as empty", () => {
    const draft = describeNoteDraft("   \n ", null);
    expect(draft.empty).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("can save a new draft", () => {
    expect(describeNoteDraft("Remember this", null)).toMatchObject({
      length: 13,
      empty: false,
      unsaved: true,
      canSave: true,
    });
  });

  it("counts the characters the server would store", () => {
    expect(describeNoteDraft("  abc  ", null).length).toBe(3);
  });

  it("is saved when the draft matches the Note apart from whitespace", () => {
    const draft = describeNoteDraft("Remember this  \n", "Remember this");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("has unsaved changes once the draft differs from the Note", () => {
    const draft = describeNoteDraft("Remember that", "Remember this");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("allows a draft of exactly the maximum length", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a draft over the maximum length", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(draft.tooLong).toBe(true);
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("does not count trailing whitespace towards the maximum", () => {
    const draft = describeNoteDraft(`${"a".repeat(MAX_NOTE_LENGTH)}   `, null);
    expect(draft.tooLong).toBe(false);
  });

  it("has unsaved changes when the Student clears a saved Note", () => {
    const draft = describeNoteDraft("", "Remember this");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });
});
