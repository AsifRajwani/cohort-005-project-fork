import {
  getBestAttempt,
  getQuizByLessonId,
  getQuizWithQuestions,
  type Db,
} from "./quiz";

export type LessonQuiz = {
  id: number;
  title: string;
  passingScore: number;
  questions: Array<{
    id: number;
    questionText: string;
    questionType: string;
    position: number;
    options: Array<{ id: number; optionText: string }>;
  }>;
};

export type BestAttempt = { score: number; passed: boolean };

function toLessonQuiz(
  quizData: NonNullable<ReturnType<typeof getQuizWithQuestions>>
): LessonQuiz {
  // Strip isCorrect from options so answers aren't leaked to the client
  return {
    id: quizData.id,
    title: quizData.title,
    passingScore: quizData.passingScore,
    questions: quizData.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      position: q.position,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
      })),
    })),
  };
}

/** The Lesson's quiz without its answers, and the Student's best attempt. */
export function getLessonQuiz(
  db: Db,
  lessonId: number,
  userId: number | null
): { quiz: LessonQuiz | null; bestAttempt: BestAttempt | null } {
  const quizRecord = getQuizByLessonId(db, lessonId);
  if (!quizRecord) return { quiz: null, bestAttempt: null };

  const quizData = getQuizWithQuestions(db, quizRecord.id);
  const best = userId ? getBestAttempt(db, userId, quizRecord.id) : undefined;

  return {
    quiz: quizData ? toLessonQuiz(quizData) : null,
    bestAttempt: best ? { score: best.score, passed: best.passed } : null,
  };
}
