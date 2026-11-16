import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LessonLink } from "./lesson-completion";

const LINK =
  "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground";

export function LessonPager({
  course,
  prevLesson,
  nextLesson,
}: {
  course: { title: string; slug: string };
  prevLesson: LessonLink | null;
  nextLesson: LessonLink | null;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {prevLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
          className={LINK}
        >
          <ChevronLeft className="size-4" />
          <PagerLabel label="Previous" title={prevLesson.title} />
        </Link>
      ) : (
        <div />
      )}

      {nextLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
          className={`${LINK} text-right`}
        >
          <PagerLabel label="Next" title={nextLesson.title} />
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <Link to={`/courses/${course.slug}`} className={LINK}>
          <PagerLabel label="Back to" title={course.title} />
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function PagerLabel({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{title}</div>
    </div>
  );
}
