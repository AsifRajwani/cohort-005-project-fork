import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { describeNoteDraft, type NoteDraft } from "~/modules/note-draft";

export type SavedNote = { body: string; updatedAt: string } | null;

/**
 * The Student's private Note on the Lesson. Key it by the Lesson's id, so a
 * draft never carries over to another Lesson.
 */
export function LessonNote({ note }: { note: SavedNote }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const draft = describeNoteDraft(body, note?.body ?? null);
  const isSaving = fetcher.state !== "idle";

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
          />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus
              draft={draft}
              note={note}
              error={isSaving ? undefined : fetcher.data?.error}
            />
            <span
              className={cn(
                "ml-auto text-xs",
                draft.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {draft.length} / {draft.max}
            </span>
          </div>

          <NoteHint />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteStatus({
  draft,
  note,
  error,
}: {
  draft: NoteDraft;
  note: SavedNote;
  error: string | undefined;
}) {
  if (error) {
    return <span className="text-xs text-destructive">{error}</span>;
  }
  if (draft.unsaved) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!note) return null;

  return (
    <span suppressHydrationWarning className="text-xs text-muted-foreground">
      Saved · edited {formatRelativeTime(note.updatedAt)}
    </span>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Private
      </span>
    </div>
  );
}

function NoteHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Only you can see this note. Find all your notes on your{" "}
      <Link to="/saved" className="underline hover:text-foreground">
        Saved
      </Link>{" "}
      page.
    </p>
  );
}
