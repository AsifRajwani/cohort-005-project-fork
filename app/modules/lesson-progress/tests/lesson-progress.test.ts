import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLessonProgress } from "../index.server";

const NOW = new Date("2026-03-01T12:00:00.000Z");

let db: TestDb;
let progress: ReturnType<typeof createLessonProgress>;
let studentId: number;
let courseId: number;
let categoryId: number;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  studentId = base.user.id;
  courseId = base.course.id;
  categoryId = base.category.id;
  progress = createLessonProgress(db);
});

// Course content belongs to the instructor pages, not this module, so the
// tests insert it directly.
function addModule(course: number, position = 1) {
  return db
    .insert(schema.modules)
    .values({ courseId: course, title: `Module ${position}`, position })
    .returning()
    .get();
}

function addLesson(moduleId: number, position = 1) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title: `Lesson ${position}`, position })
    .returning()
    .get();
}

function watched(lessonId: number, positionSeconds: number, at: string) {
  progress.recordWatch(
    { userId: studentId, lessonId, eventType: "progress", positionSeconds },
    new Date(at)
  );
}

describe("marking progress", () => {
  it("has no progress before the Student opens the Lesson", () => {
    const lesson = addLesson(addModule(courseId).id);
    expect(progress.get(studentId, lesson.id)).toBeUndefined();
  });

  it("starts a Lesson as in progress", () => {
    const lesson = addLesson(addModule(courseId).id);
    progress.markInProgress(studentId, lesson.id);
    expect(progress.get(studentId, lesson.id)?.status).toBe(
      LessonProgressStatus.InProgress
    );
  });

  it("completes a Lesson that was never opened", () => {
    const lesson = addLesson(addModule(courseId).id);
    const done = progress.markComplete(studentId, lesson.id, NOW);
    expect(done.status).toBe(LessonProgressStatus.Completed);
    expect(done.completedAt).toBe(NOW.toISOString());
  });

  it("completes a Lesson in progress without adding a second row", () => {
    const lesson = addLesson(addModule(courseId).id);
    const started = progress.markInProgress(studentId, lesson.id);
    const done = progress.markComplete(studentId, lesson.id, NOW);
    expect(done.id).toBe(started.id);
    expect(progress.get(studentId, lesson.id)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("keeps a completed Lesson completed when it is opened again", () => {
    const lesson = addLesson(addModule(courseId).id);
    const done = progress.markComplete(studentId, lesson.id, NOW);
    const reopened = progress.markInProgress(studentId, lesson.id);
    expect(reopened).toEqual(done);
  });

  it("keeps an in-progress Lesson as one row when it is opened again", () => {
    const lesson = addLesson(addModule(courseId).id);
    const first = progress.markInProgress(studentId, lesson.id);
    const second = progress.markInProgress(studentId, lesson.id);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe(LessonProgressStatus.InProgress);
  });
});

describe("progress across a course", () => {
  it("lists the Student's progress on every Lesson in the course", () => {
    const first = addModule(courseId, 1);
    const second = addModule(courseId, 2);
    const a = addLesson(first.id, 1);
    const b = addLesson(second.id, 1);
    addLesson(second.id, 2);
    progress.markComplete(studentId, a.id, NOW);
    progress.markInProgress(studentId, b.id);

    const rows = progress.forCourse(studentId, courseId);
    expect(rows.map((r) => [r.lessonId, r.status])).toEqual([
      [a.id, LessonProgressStatus.Completed],
      [b.id, LessonProgressStatus.InProgress],
    ]);
  });

  it("leaves out Lessons from another course and other Students", () => {
    const lesson = addLesson(addModule(courseId).id);
    const other = db
      .insert(schema.courses)
      .values({
        title: "Other",
        slug: "other",
        description: "Other course",
        salesCopy: markdown("Other"),
        instructorId: studentId,
        categoryId: categoryId,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
    const elsewhere = addLesson(addModule(other.id).id);
    progress.markComplete(studentId, elsewhere.id, NOW);
    progress.markComplete(studentId + 1, lesson.id, NOW);

    expect(progress.forCourse(studentId, courseId)).toEqual([]);
  });

  it("is empty for a course with no modules", () => {
    expect(progress.forCourse(studentId, courseId)).toEqual([]);
  });

  it("is empty for a course whose modules have no Lessons", () => {
    addModule(courseId);
    expect(progress.forCourse(studentId, courseId)).toEqual([]);
  });
});

describe("watching the video", () => {
  it("resumes from 0 when the video was never played", () => {
    const lesson = addLesson(addModule(courseId).id);
    expect(progress.lastWatchPosition(studentId, lesson.id)).toBe(0);
  });

  it("resumes from the most recent position, not the furthest", () => {
    const lesson = addLesson(addModule(courseId).id);
    watched(lesson.id, 300, "2026-11-01T10:00:00.000Z");
    watched(lesson.id, 120, "2026-11-02T10:00:00.000Z");
    expect(progress.lastWatchPosition(studentId, lesson.id)).toBe(120);
  });

  it("measures progress from the furthest position watched", () => {
    const lesson = addLesson(addModule(courseId).id);
    watched(lesson.id, 300, "2026-11-01T10:00:00.000Z");
    watched(lesson.id, 120, "2026-11-02T10:00:00.000Z");
    expect(progress.watchProgress(studentId, lesson.id, 600)).toBe(50);
  });

  it("rounds progress to a whole percentage", () => {
    const lesson = addLesson(addModule(courseId).id);
    watched(lesson.id, 200, "2026-11-01T10:00:00.000Z");
    expect(progress.watchProgress(studentId, lesson.id, 600)).toBe(33);
  });

  it("caps progress at 100", () => {
    const lesson = addLesson(addModule(courseId).id);
    watched(lesson.id, 900, "2026-11-01T10:00:00.000Z");
    expect(progress.watchProgress(studentId, lesson.id, 600)).toBe(100);
  });

  it("is 0 for an unwatched video", () => {
    const lesson = addLesson(addModule(courseId).id);
    expect(progress.watchProgress(studentId, lesson.id, 600)).toBe(0);
  });

  it("is 0 for a video with no duration", () => {
    const lesson = addLesson(addModule(courseId).id);
    watched(lesson.id, 300, "2026-11-01T10:00:00.000Z");
    expect(progress.watchProgress(studentId, lesson.id, 0)).toBe(0);
  });
});
