import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { createQuizAttempts } from "../index.server";

let db: TestDb;
let quizzes: ReturnType<typeof createQuizAttempts>;
let studentId: number;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  studentId = base.user.id;
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module", position: 1 })
    .returning()
    .get();
  lessonId = addLesson(mod.id);
  quizzes = createQuizAttempts(db);
});

// Quizzes are written on the instructor pages, not through this module, so
// the tests insert them directly.
function addLesson(moduleId: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title: "Lesson", position: 1 })
    .returning()
    .get().id;
}

type QuestionSpec = {
  type: QuestionType;
  options: Array<[text: string, isCorrect: boolean]>;
};

function addQuiz(forLesson: number, questions: QuestionSpec[]) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId: forLesson, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const ids = questions.map((spec, index) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Question ${index + 1}`,
        questionType: spec.type,
        // Inserted in reverse so the order comes from position, not id.
        position: questions.length - index,
      })
      .returning()
      .get();
    const options = spec.options.map(
      ([optionText, isCorrect]) =>
        db
          .insert(schema.quizOptions)
          .values({ questionId: question.id, optionText, isCorrect })
          .returning()
          .get().id
    );
    return { questionId: question.id, options };
  });
  return { quizId: quiz.id, questions: ids };
}

const choice: QuestionSpec = {
  type: QuestionType.MultipleChoice,
  options: [
    ["wrong", false],
    ["right", true],
    ["also wrong", false],
  ],
};
const trueFalse: QuestionSpec = {
  type: QuestionType.TrueFalse,
  options: [
    ["True", true],
    ["False", false],
  ],
};

describe("the quiz a Student sees", () => {
  it("is null when the Lesson has no quiz", () => {
    expect(quizzes.forLesson(lessonId, studentId)).toEqual({
      quiz: null,
      bestAttempt: null,
    });
  });

  it("lists questions by position without saying which option is correct", () => {
    const { quizId, questions } = addQuiz(lessonId, [choice, trueFalse]);
    const { quiz } = quizzes.forLesson(lessonId, studentId);

    expect(quiz?.id).toBe(quizId);
    expect(quiz?.title).toBe("Check");
    expect(quiz?.passingScore).toBe(0.7);
    expect(quiz?.questions.map((q) => q.id)).toEqual([
      questions[1].questionId,
      questions[0].questionId,
    ]);
    expect(quiz?.questions[0]).toEqual({
      id: questions[1].questionId,
      questionText: "Question 2",
      questionType: QuestionType.TrueFalse,
      position: 1,
      options: [
        { id: questions[1].options[0], optionText: "True" },
        { id: questions[1].options[1], optionText: "False" },
      ],
    });
  });

  it("has no best attempt for a signed-out viewer", () => {
    addQuiz(lessonId, [choice]);
    expect(quizzes.forLesson(lessonId, null).bestAttempt).toBeNull();
  });

  it("reports the Student's best attempt, not their latest", () => {
    const { quizId, questions } = addQuiz(lessonId, [choice, trueFalse]);
    const [q1, q2] = questions;
    quizzes.submit(studentId, quizId, {
      [q1.questionId]: q1.options[1],
      [q2.questionId]: q2.options[0],
    });
    quizzes.submit(studentId, quizId, { [q1.questionId]: q1.options[0] });

    expect(quizzes.forLesson(lessonId, studentId).bestAttempt).toEqual({
      score: 1,
      passed: true,
    });
  });

  it("finds a quiz by its id", () => {
    const { quizId } = addQuiz(lessonId, [choice]);
    expect(quizzes.findQuiz(quizId)?.lessonId).toBe(lessonId);
    expect(quizzes.findQuiz(quizId + 1)).toBeUndefined();
  });
});

describe("submitting a quiz", () => {
  it("scores every question right as a pass with an A", () => {
    const { quizId, questions } = addQuiz(lessonId, [choice, trueFalse]);
    const [q1, q2] = questions;

    const result = quizzes.submit(studentId, quizId, {
      [q1.questionId]: q1.options[1],
      [q2.questionId]: q2.options[0],
    });

    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 1 + 1,
      totalQuestions: 2,
    });
  });

  it("marks each question with what was picked and what was right", () => {
    const { quizId, questions } = addQuiz(lessonId, [choice, trueFalse]);
    const [q1, q2] = questions;

    const result = quizzes.submit(studentId, quizId, {
      [q1.questionId]: q1.options[0],
    });

    expect(result?.questionResults).toEqual([
      {
        questionId: q2.questionId,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
      {
        questionId: q1.questionId,
        correct: false,
        selectedOptionId: q1.options[0],
        correctOptionId: q1.options[1],
      },
    ]);
    expect(result).toMatchObject({ score: 0, passed: false, grade: "F" });
  });

  it("finds the right answer to a true/false question", () => {
    const { quizId, questions } = addQuiz(lessonId, [trueFalse]);
    const [q] = questions;
    const result = quizzes.submit(studentId, quizId, {
      [q.questionId]: q.options[0],
    });
    expect(result?.questionResults[0]).toMatchObject({
      correct: true,
      correctOptionId: q.options[0],
    });
  });

  it("counts only the first option marked right when two are", () => {
    const { quizId, questions } = addQuiz(lessonId, [
      {
        type: QuestionType.MultipleChoice,
        options: [
          ["right", true],
          ["also marked right", true],
        ],
      },
    ]);
    const [q] = questions;
    const result = quizzes.submit(studentId, quizId, {
      [q.questionId]: q.options[1],
    });
    expect(result?.questionResults[0]).toMatchObject({
      correct: false,
      correctOptionId: q.options[0],
    });
  });

  it("does not pass at exactly 70%", () => {
    const specs = Array.from({ length: 10 }, () => choice);
    const { quizId, questions } = addQuiz(lessonId, specs);
    const answers = Object.fromEntries(
      questions.map((q, i) => [q.questionId, q.options[i < 7 ? 1 : 0]])
    );
    const result = quizzes.submit(studentId, quizId, answers);
    expect(result).toMatchObject({ score: 0.7, passed: false, grade: "C" });
  });

  it.each([
    [9, "A"],
    [8, "B"],
    [7, "C"],
    [6, "D"],
    [5, "F"],
  ])("grades %i out of 10 as %s", (right, grade) => {
    const specs = Array.from({ length: 10 }, () => choice);
    const { quizId, questions } = addQuiz(lessonId, specs);
    const answers = Object.fromEntries(
      questions.map((q, i) => [q.questionId, q.options[i < right ? 1 : 0]])
    );
    expect(quizzes.submit(studentId, quizId, answers)?.grade).toBe(grade);
  });

  it("scores a quiz with no questions as 0", () => {
    const { quizId } = addQuiz(lessonId, []);
    expect(quizzes.submit(studentId, quizId, {})).toMatchObject({
      score: 0,
      passed: false,
      totalQuestions: 0,
    });
  });

  it("records the attempt and only the answered questions", () => {
    const { quizId, questions } = addQuiz(lessonId, [choice, trueFalse]);
    const [q1] = questions;

    const result = quizzes.submit(studentId, quizId, {
      [q1.questionId]: q1.options[1],
    });

    const attempt = db
      .select()
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.id, result?.attemptId ?? -1))
      .get();
    expect(attempt).toMatchObject({
      userId: studentId,
      quizId,
      score: 0.5,
      passed: false,
    });
    const answers = db.select().from(schema.quizAnswers).all();
    expect(answers).toEqual([
      expect.objectContaining({
        attemptId: result?.attemptId,
        questionId: q1.questionId,
        selectedOptionId: q1.options[1],
      }),
    ]);
  });

  it("returns null for a quiz that does not exist", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(quizzes.submit(studentId, 999, {})).toBeNull();
    expect(errors).toHaveBeenCalledWith("quiz not found");
    errors.mockRestore();
  });

  it("returns null when recording the attempt fails", () => {
    const { quizId } = addQuiz(lessonId, [choice]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(quizzes.submit(999, quizId, {})).toBeNull();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
