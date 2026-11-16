import type { LessonProgressStatus } from "~/db/schema";
import { useFetcher } from "react-router";
import { Clock, Github } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  CommentThread,
  type RenderedComment,
} from "~/components/comment-thread";
import { YouTubePlayer } from "~/components/youtube-player";
import { formatDuration } from "~/lib/utils";
import { BookmarkToggle } from "./bookmark-toggle";
import type { Curriculum } from "./curriculum-sidebar";
import { LessonLayout } from "./lesson-layout";
import { LessonCompletion, type LessonLink } from "./lesson-completion";
import { LessonNote, type SavedNote } from "./lesson-note";
import { LessonPager } from "./lesson-pager";
import { QuizSection } from "./quiz-section";
import type {
  BestAttempt,
  LessonQuiz as Quiz,
  QuizResult,
} from "~/modules/quiz-attempts/index.server";
import { useAutoplay } from "./use-autoplay";

type Lesson = {
  id: number;
  title: string;
  videoUrl: string | null;
  githubRepoUrl: string | null;
  durationMinutes: number | null;
};

export type FullLessonData = {
  course: { id: number; title: string; slug: string };
  curriculum: Curriculum;
  module: { id: number; title: string };
  lesson: Lesson;
  contentHtml: string | null;
  lessonStatus: LessonProgressStatus | null;
  enrolled: boolean;
  currentUserId: number | null;
  prevLesson: LessonLink | null;
  nextLesson: LessonLink | null;
  quiz: Quiz | null;
  bestAttempt: BestAttempt | null;
  lastWatchPosition: number;
  watchProgress: number;
  lessonProgressMap: Record<number, LessonProgressStatus>;
  comments: RenderedComment[];
  canModerate: boolean;
  instructorName: string;
  bookmarked: boolean;
  note: SavedNote;
};

export function FullLesson({ data }: { data: FullLessonData }) {
  const { course, lesson, enrolled, currentUserId } = data;
  const canTake = enrolled && !!currentUserId;

  return (
    <LessonLayout
      course={course}
      curriculum={data.curriculum}
      mod={data.module}
      lesson={lesson}
      lessonProgressMap={data.lessonProgressMap}
      enrolled={enrolled}
    >
      <LessonHeader
        lesson={lesson}
        bookmarked={currentUserId ? data.bookmarked : null}
      />
      <LessonVideo data={data} trackingEnabled={canTake} />

      {currentUserId && <LessonNote key={lesson.id} note={data.note} />}

      <LessonContent
        contentHtml={data.contentHtml}
        hasVideo={!!lesson.videoUrl}
      />

      {canTake && <LessonQuiz data={data} />}
      {canTake && (
        <LessonCompletion
          courseSlug={course.slug}
          lessonId={lesson.id}
          lessonStatus={data.lessonStatus}
          nextLesson={data.nextLesson}
        />
      )}

      <CommentThread
        comments={data.comments}
        currentUserId={currentUserId}
        canModerate={data.canModerate}
        canPost
        instructorName={data.instructorName}
      />

      <LessonPager
        course={course}
        prevLesson={data.prevLesson}
        nextLesson={data.nextLesson}
      />
    </LessonLayout>
  );
}

function LessonVideo({
  data: { lesson, lastWatchPosition, watchProgress },
  trackingEnabled,
}: {
  data: FullLessonData;
  trackingEnabled: boolean;
}) {
  const [autoplay, toggleAutoplay] = useAutoplay();
  if (!lesson.videoUrl) return null;

  return (
    <YouTubePlayer
      videoUrl={lesson.videoUrl}
      lessonId={lesson.id}
      title={lesson.title}
      startPosition={lastWatchPosition}
      durationMinutes={lesson.durationMinutes}
      watchProgress={watchProgress}
      trackingEnabled={trackingEnabled}
      autoplay={autoplay}
      onToggleAutoplay={toggleAutoplay}
    />
  );
}

function LessonQuiz({
  data: { lesson, quiz, bestAttempt },
}: {
  data: FullLessonData;
}) {
  const quizFetcher = useFetcher<{ quizResult?: QuizResult }>({
    key: `quiz-${lesson.id}`,
  });
  if (!quiz) return null;

  return (
    <QuizSection
      quiz={quiz}
      bestAttempt={bestAttempt}
      quizResult={quizFetcher.data?.quizResult ?? null}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
    />
  );
}

function LessonHeader({
  lesson,
  bookmarked,
}: {
  lesson: Lesson;
  /** Null when nobody is signed in to bookmark it. */
  bookmarked: boolean | null;
}) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {bookmarked !== null && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonContent({
  contentHtml,
  hasVideo,
}: {
  contentHtml: string | null;
  hasVideo: boolean;
}) {
  if (contentHtml) {
    return (
      <div
        className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
        // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  }
  if (hasVideo) return null;

  return (
    <Card className="mb-8">
      <CardContent className="py-12 text-center text-muted-foreground">
        No content has been added to this lesson yet.
      </CardContent>
    </Card>
  );
}
