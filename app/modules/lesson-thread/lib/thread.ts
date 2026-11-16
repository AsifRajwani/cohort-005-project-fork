import { asc, eq } from "drizzle-orm";
import type { Db } from "~/db";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import { markdown, type Markdown } from "~/lib/text";

export type { Db };

type CommentAuthor = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isInstructor: boolean;
  isPlatformAdmin: boolean;
};

export type ThreadComment = {
  id: number;
  body: Markdown;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: CommentAuthor;
  replies: ThreadComment[];
};

function getCourseForLesson(db: Db, lessonId: number) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

export function getCommentById(db: Db, commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

function getThreadRows(db: Db, lessonId: number) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();
}

type ThreadRow = ReturnType<typeof getThreadRows>[number];

function toThreadComment(row: ThreadRow, instructorId: number): ThreadComment {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    body: deleted ? markdown("") : row.body,
    createdAt: row.createdAt,
    editedAt: deleted ? null : row.editedAt,
    deleted,
    author: {
      id: row.authorId,
      name: row.authorName,
      avatarUrl: row.authorAvatarUrl,
      isInstructor: row.authorId === instructorId,
      isPlatformAdmin: row.authorRole === UserRole.Admin,
    },
    replies: [],
  };
}

export function getLessonThread(db: Db, lessonId: number): ThreadComment[] {
  const course = getCourseForLesson(db, lessonId);
  if (!course) return [];

  const rows = getThreadRows(db, lessonId);
  const topLevel: ThreadComment[] = [];
  const byId = new Map<number, ThreadComment>();

  for (const row of rows) {
    if (row.parentId !== null) continue;
    const comment = toThreadComment(row, course.instructorId);
    byId.set(comment.id, comment);
    topLevel.push(comment);
  }

  for (const row of rows) {
    if (row.parentId === null || row.deletedAt !== null) continue;
    byId
      .get(row.parentId)
      ?.replies.push(toThreadComment(row, course.instructorId));
  }

  return topLevel.filter(isStillShown);
}

/** See ADR 0015. */
function isStillShown(question: ThreadComment) {
  return !question.deleted || question.replies.length > 0;
}
