import { Router } from "express";
import { CourseController } from "@controllers/course.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";
import { upload } from "@middlewares/upload";

const router = Router();
const courseController = new CourseController();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Course]
 *     summary: List courses
 *     description: Lọc, tìm kiếm, phân trang danh sách khóa học.
 *     security:
 *       - bearerAuth: []   # Nếu muốn public list, xóa block security này
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Tìm kiếm theo tên khóa học
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: mode
 *         schema: { type: string }
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *       - in: query
 *         name: min_price
 *         schema: { type: number }
 *       - in: query
 *         name: max_price
 *         schema: { type: number }
 *       - in: query
 *         name: start_after
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end_before
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, enum: [price, created_at, updated_at] }
 *       - in: query
 *         name: sort_order
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: page_size
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Danh sách course
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseListResponse'
 *
 *   post:
 *     tags: [Course]
 *     summary: Create course
 *     description: Chỉ ADMIN được phép tạo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseCreateDTO'
 *           examples:
 *             sample:
 *               value:
 *                 branch_id: 1
 *                 course_name: "Khóa học A"
 *                 description: "Mô tả khóa học A"
 *                 duration: 12
 *                 price: 5000000
 *     responses:
 *       201:
 *         description: Tạo course thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       409:
 *         description: Course code hoặc slug đã tồn tại
 *       500:
 *         description: Failed to create course
 *
 * /api/courses/{id}:
 *   get:
 *     tags: [Course]
 *     summary: Get course by ID
 *     description: Lấy thông tin chi tiết của course theo ID.
 *     security:
 *       - bearerAuth: []   # Nếu muốn public getById, xóa block security này
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Thông tin chi tiết course
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400: { description: Invalid course id }
 *       404: { description: Course not found }
 *       500: { description: Failed to get course }
 *
 *   put:
 *     tags: [Course]
 *     summary: Update course by ID
 *     description: Chỉ ADMIN được cập nhật.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseUpdateDTO'
 *           examples:
 *             sample:
 *               value:
 *                 branch_id: 2
 *                 course_name: "Khóa học B"
 *                 description: "Mô tả khóa học B"
 *                 duration: 6
 *                 price: 3000000
 *     responses:
 *       200:
 *         description: Cập nhật course thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400: { description: Invalid course id }
 *       404: { description: Course not found }
 *       409: { description: Course code hoặc slug đã tồn tại }
 *       500: { description: Failed to update course }
 *
 *   delete:
 *     tags: [Course]
 *     summary: Delete course by ID
 *     description: Chỉ ADMIN được xóa.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Xóa thành công, không có nội dung trả về }
 *       400: { description: Invalid course id }
 *       404: { description: Course not found }
 *       500: { description: Failed to delete course }
 */

router.get("/detail", courseController.getCourseDetail.bind(courseController));

router.post(
    "/",
    authRole([Role.ADMIN]),
    upload.single("file"),
    courseController.create.bind(courseController)
);
router.get("/", courseController.list.bind(courseController));
router.get("/:id", courseController.getById.bind(courseController));
router.put(
    "/:id",
    authRole([Role.ADMIN]),
    upload.single("file"),
    courseController.update.bind(courseController)
);
router.delete("/:id", authRole([Role.ADMIN]), courseController.remove.bind(courseController));
router.delete(
    "/",
    authRole([Role.ADMIN]),
    courseController.deleteCourseByIds.bind(courseController)
);

router.get("/slug/:slug", courseController.getBySlug.bind(courseController));

export default router;
