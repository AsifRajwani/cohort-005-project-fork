import { and, eq, inArray } from "drizzle-orm";
import {
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
} from "~/db/schema";
import type { Db } from "~/db";
import { getQuizById, getQuizQuestions } from "./quiz";

export type Grade = "A" | "B" | "C" | "D" | "F";

export function calculateGrade(score: number): Grade {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

export type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

type Question = typeof quizQuestions.$inferSelect;

/** Who is answering which quiz. */
export type QuizSubmission = { userId: number; quizId: number };

/** Question id to its correct option id, in one query for every question. */
function findCorrectOptionIds(db: Db, questions: Question[]) {
  const ids = questions.map((q) => q.id);
  const correctOptionIds = new Map<number, number>();
  const correct = db
    .select({ id: quizOptions.id, questionId: quizOptions.questionId })
    .from(quizOptions)
    .where(
      and(inArray(quizOptions.questionId, ids), eq(quizOptions.isCorrect, true))
    )
    .orderBy(quizOptions.id)
    .all();
  for (const option of correct) {
    if (!correctOptionIds.has(option.questionId)) {
      correctOptionIds.set(option.questionId, option.id);
    }
  }
  return correctOptionIds;
}

function gradeQuestion(
  q: Question,
  selectedAnswers: Record<number, number>,
  correctOptionIds: Map<number, number>
): QuestionResult {
  const selected = selectedAnswers[q.id];

  if (!selected) {
    return {
      questionId: q.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }

  const correctOptionId = correctOptionIds.get(q.id) ?? null;
  return {
    questionId: q.id,
    correct: selected === correctOptionId,
    selectedOptionId: selected,
    correctOptionId,
  };
}

function saveAttempt(
  db: Db,
  attempt: QuizSubmission & { score: number; passed: boolean },
  questionResults: QuestionResult[]
) {
  return db.transaction((tx) => {
    const saved = tx.insert(quizAttempts).values(attempt).returning().get();
    const answers = questionResults.flatMap((result) =>
      result.selectedOptionId === null
        ? []
        : [
            {
              attemptId: saved.id,
              questionId: result.questionId,
              selectedOptionId: result.selectedOptionId,
            },
          ]
    );
    if (answers.length > 0) tx.insert(quizAnswers).values(answers).run();
    return saved;
  });
}

function gradeAndSave(
  db: Db,
  { userId, quizId }: QuizSubmission,
  selectedAnswers: Record<number, number>
) {
  const quiz = getQuizById(db, quizId);
  if (!quiz) {
    console.error("quiz not found");
    return null;
  }

  const questions = getQuizQuestions(db, quizId);
  const correctOptionIds = findCorrectOptionIds(db, questions);
  const questionResults = questions.map((q) =>
    gradeQuestion(q, selectedAnswers, correctOptionIds)
  );
  const correct = questionResults.filter((r) => r.correct).length;
  const total = questions.length;

  const scoreValue = total > 0 ? correct / total : 0;
  const passed = scoreValue > 0.7;
  const grade = calculateGrade(scoreValue);

  const attempt = saveAttempt(
    db,
    { userId, quizId, score: scoreValue, passed },
    questionResults
  );

  return {
    attemptId: attempt.id,
    score: scoreValue,
    passed,
    grade,
    totalCorrect: correct,
    totalQuestions: total,
    questionResults,
  };
}

/**
 * Grades the answers (question id to option id), records the attempt, and
 * returns the result. Null when the quiz does not exist or anything fails.
 */
export function computeResult(
  db: Db,
  submission: QuizSubmission,
  selectedAnswers: Record<number, number>
) {
  try {
    return gradeAndSave(db, submission, selectedAnswers);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** A graded attempt, as the Student sees it after submitting. */
export type QuizResult = NonNullable<ReturnType<typeof computeResult>>;
