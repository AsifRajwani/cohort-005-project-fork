import { db } from "~/db";
import {
  calculateWatchProgress,
  getLastWatchPosition,
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
  type Db,
} from "./lib/progress";

/**
 * A Student's progress through Lessons, and how far they have watched each
 * video, bound to a database. The app uses `lessonProgress`; tests build their
 * own against a test database.
 */
export function createLessonProgress(database: Db) {
  return {
    get: (userId: number, lessonId: number) =>
      getLessonProgress(database, userId, lessonId),
    forCourse: (userId: number, courseId: number) =>
      getLessonProgressForCourse(database, userId, courseId),
    markComplete: (userId: number, lessonId: number) =>
      markLessonComplete(database, userId, lessonId),
    /** Starts the Lesson; a completed Lesson stays completed. */
    markInProgress: (userId: number, lessonId: number) =>
      markLessonInProgress(database, userId, lessonId),
    /** Where the video was last left, in seconds; 0 if never watched. */
    lastWatchPosition: (userId: number, lessonId: number) =>
      getLastWatchPosition(database, userId, lessonId),
    /** The furthest point watched, as a whole percentage of the video. */
    watchProgress: (
      userId: number,
      lessonId: number,
      videoDurationSeconds: number
    ) =>
      calculateWatchProgress(
        database,
        { userId, lessonId },
        videoDurationSeconds
      ),
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonProgress = /* @__PURE__ */ createLessonProgress(db);
