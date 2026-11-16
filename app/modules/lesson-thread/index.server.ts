import { db, type Db } from "~/db";
import { getCommentById, getLessonThread } from "./lib/thread";
import { renderThread } from "./lib/render.server";

export type { RenderedComment } from "./lib/render.server";

/**
 * A Lesson's Questions & Discussion thread as the Lesson page shows it, bound
 * to a database. Writing comments lives in `~/lib/comments.server`. The app
 * uses `lessonThread`; tests build their own against a test database.
 */
export function createLessonThread(database: Db) {
  return {
    findComment: (commentId: number) => getCommentById(database, commentId),
    /**
     * The Lesson's questions, oldest first, each with its replies and with
     * every body rendered to sanitised HTML. Which deleted comments still
     * show is ADR 0015.
     */
    render: (lessonId: number) =>
      renderThread(getLessonThread(database, lessonId)),
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonThread = /* @__PURE__ */ createLessonThread(db);
