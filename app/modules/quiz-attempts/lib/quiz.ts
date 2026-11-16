import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "~/db";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
} from "~/db/schema";

export function getQuizById(db: Db, quizId: number) {
  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
}

export function getQuizByLessonId(db: Db, lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

/** The quiz's questions, in the order the Student answers them. */
export function getQuizQuestions(db: Db, quizId: number) {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();
}

export function getQuizWithQuestions(db: Db, quizId: number) {
  const quiz = getQuizById(db, quizId);
  if (!quiz) return null;

  const questions = getQuizQuestions(db, quizId);
  const options = db
    .select()
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        questions.map((q) => q.id)
      )
    )
    .orderBy(quizOptions.id)
    .all();
  const questionsWithOptions = questions.map((question) => ({
    ...question,
    options: options.filter((o) => o.questionId === question.id),
  }));

  return { ...quiz, questions: questionsWithOptions };
}

export function getBestAttempt(db: Db, userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

/** A recorded attempt with the answers it gave, or null if there is none. */
export function getAttempt(db: Db, attemptId: number) {
  const attempt = db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();
  if (!attempt) return null;

  const answers = db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId))
    .orderBy(quizAnswers.id)
    .all();
  return { ...attempt, answers };
}
