import { db, type Db } from "~/db";
import { getAttempt, getQuizById } from "./lib/quiz";
import { getLessonQuiz } from "./lib/lesson-quiz";
import { computeResult } from "./lib/grade";

export type { BestAttempt, LessonQuiz } from "./lib/lesson-quiz";
export type { Grade, QuestionResult, QuizResult } from "./lib/grade";

/**
 * A Lesson's quiz and the Students' attempts at it, bound to a database. The
 * app uses `quizAttempts`; tests build their own against a test database.
 */
export function createQuizAttempts(database: Db) {
  return {
    findQuiz: (quizId: number) => getQuizById(database, quizId),
    /** A recorded attempt and the answers it gave; null if there is none. */
    findAttempt: (attemptId: number) => getAttempt(database, attemptId),
    /** The quiz as a Student may see it (no answers), and their best score. */
    forLesson: (lessonId: number, userId: number | null) =>
      getLessonQuiz(database, lessonId, userId),
    /** Grades and records an attempt; null if the quiz is gone or it fails. */
    submit: (
      userId: number,
      quizId: number,
      selectedAnswers: Record<number, number>
    ) => computeResult(database, { userId, quizId }, selectedAnswers),
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const quizAttempts = /* @__PURE__ */ createQuizAttempts(db);
