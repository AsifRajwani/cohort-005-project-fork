import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { createComment, deleteComment } from "~/lib/comments.server";
import { fakeNotifications } from "~/lib/notifications.fake.server";
import { createLessonThread } from "../index.server";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const LATER = new Date("2026-11-15T13:00:00.000Z");

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let thread: ReturnType<typeof createLessonThread>;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module", position: 1 })
    .returning()
    .get();
  lessonId = addLesson(mod.id);
  thread = createLessonThread(db);
});

// Lessons and users belong to other parts of the app, so the tests insert
// them directly. Comments are written through ~/lib/comments.server.
function addLesson(moduleId: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title: "Lesson", position: 1 })
    .returning()
    .get().id;
}

async function post(
  authorId: number,
  body: string,
  options: { parentId?: number; at?: Date; lesson?: number } = {}
) {
  const result = await createComment(
    db,
    authorId,
    options.lesson ?? lessonId,
    options.parentId ?? null,
    body,
    options.at ?? NOW,
    fakeNotifications()
  );
  if (!result.ok) throw new Error(result.error);
  return result.comment.id;
}

async function remove(commentId: number, userId: number) {
  await deleteComment(db, commentId, userId, false, LATER, fakeNotifications());
}

describe("rendering a Lesson's thread", () => {
  it("is empty when nobody has posted", async () => {
    expect(await thread.render(lessonId)).toEqual([]);
  });

  it("is empty for a Lesson that does not exist", async () => {
    expect(await thread.render(lessonId + 100)).toEqual([]);
  });

  it("renders each body to HTML and nests replies under their question", async () => {
    const question = await post(base.user.id, "How does **this** work?");
    const reply = await post(base.instructor.id, "Like this.", {
      parentId: question,
      at: LATER,
    });

    const rendered = (await thread.render(lessonId))[0];
    expect(await thread.render(lessonId)).toHaveLength(1);
    expect(rendered).toMatchObject({
      id: question,
      deleted: false,
      editedAt: null,
      createdAt: NOW.toISOString(),
      author: {
        id: base.user.id,
        name: "Test User",
        isInstructor: false,
        isPlatformAdmin: false,
      },
    });
    expect(rendered.bodyHtml).toContain("<strong>this</strong>");
    expect(rendered.replies).toHaveLength(1);
    expect(rendered.replies[0]).toMatchObject({
      id: reply,
      author: { id: base.instructor.id, isInstructor: true },
    });
  });

  it("orders questions oldest first", async () => {
    const second = await post(base.user.id, "Second", { at: LATER });
    const first = await post(base.user.id, "First", { at: NOW });
    const rendered = await thread.render(lessonId);
    expect(rendered.map((c) => c.id)).toEqual([first, second]);
  });

  it("marks a Platform Admin's post", async () => {
    const admin = db
      .insert(schema.users)
      .values({ name: "Admin", email: "a@example.com", role: UserRole.Admin })
      .returning()
      .get();
    await post(admin.id, "Hello");
    const [rendered] = await thread.render(lessonId);
    expect(rendered.author.isPlatformAdmin).toBe(true);
  });

  it("leaves out comments on other Lessons", async () => {
    const mod = db
      .insert(schema.modules)
      .values({ courseId: base.course.id, title: "Other", position: 2 })
      .returning()
      .get();
    await post(base.user.id, "Elsewhere", { lesson: addLesson(mod.id) });
    expect(await thread.render(lessonId)).toEqual([]);
  });
});

describe("deleted comments", () => {
  it("drops a deleted question with no replies", async () => {
    const question = await post(base.user.id, "Never mind");
    await remove(question, base.user.id);
    expect(await thread.render(lessonId)).toEqual([]);
  });

  it("keeps a deleted question with replies, without its body", async () => {
    const question = await post(base.user.id, "Secret question");
    await post(base.instructor.id, "An answer", { parentId: question });
    await remove(question, base.user.id);

    const [rendered] = await thread.render(lessonId);
    expect(rendered).toMatchObject({
      id: question,
      deleted: true,
      body: "",
      bodyHtml: "",
      editedAt: null,
    });
    expect(rendered.replies).toHaveLength(1);
  });

  it("drops a deleted reply", async () => {
    const question = await post(base.user.id, "Question");
    const reply = await post(base.instructor.id, "Oops", {
      parentId: question,
    });
    await remove(reply, base.instructor.id);

    const [rendered] = await thread.render(lessonId);
    expect(rendered.replies).toEqual([]);
  });
});

describe("finding a comment", () => {
  it("finds a comment by its id", async () => {
    const id = await post(base.user.id, "Hello");
    expect(thread.findComment(id)?.lessonId).toBe(lessonId);
    expect(thread.findComment(id + 1)).toBeUndefined();
  });
});
