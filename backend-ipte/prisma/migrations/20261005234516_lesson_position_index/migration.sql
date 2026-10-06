-- DropIndex
DROP INDEX "lessons_course_id_position_key";

-- CreateIndex
CREATE INDEX "lessons_course_id_position_idx" ON "lessons"("course_id", "position");
