import { CurriculumSidebar, type Curriculum } from "./curriculum-sidebar";
import { LessonBreadcrumb } from "./lesson-breadcrumb";

/** The curriculum sidebar and breadcrumb around a Lesson's page. */
export function LessonLayout({
  course,
  curriculum,
  mod,
  lesson,
  lessonProgressMap,
  enrolled,
  children,
}: {
  course: { id: number; title: string; slug: string };
  curriculum: Curriculum;
  mod: { id: number; title: string };
  lesson: { id: number; title: string };
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
