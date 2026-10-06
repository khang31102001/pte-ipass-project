/**
 * Nội dung nền tảng cho website (idempotent): chỉ tạo khi CHƯA tồn tại (khóa theo slug/key) — không ghi đè nội dung đã chỉnh trong CMS.
 * Chỉ là dữ liệu cấu hình/khung nội dung, không phải dữ liệu học viên.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

const section = (type: string, heading: string, extra: Record<string, unknown> = {}) => ({ type, heading, items: [], ...extra });

const FORMS = [
  {
    name: "Đăng ký học thử miễn phí",
    slug: "dang-ky-hoc-thu-mien-phi",
    type: "trial_registration" as const,
    submitLabel: "Đăng ký ngay",
    successMessage: "Cảm ơn bạn! Tư vấn viên sẽ liên hệ xác nhận lịch học thử trong vòng 24 giờ.",
    fields: [
      { key: "fullName", label: "Họ và tên", type: "text", required: true, options: [] },
      { key: "phone", label: "Số điện thoại", type: "phone", required: true, options: [] },
      { key: "email", label: "Email", type: "email", required: false, options: [] },
      { key: "purpose", label: "Mục đích học PTE", type: "select", required: true, options: ["Du học", "Định cư", "Làm việc", "Học bổng", "Khác"] },
      { key: "targetScore", label: "Điểm mục tiêu", type: "select", required: true, options: ["PTE 36", "PTE 42", "PTE 50", "PTE 58", "PTE 65", "PTE 79"] },
      { key: "message", label: "Lời nhắn", type: "textarea", required: false, options: [] },
    ],
  },
  {
    name: "Đăng ký tư vấn",
    slug: "dang-ky-tu-van",
    type: "consultation" as const,
    submitLabel: "Nhận tư vấn",
    successMessage: "Đã nhận thông tin. Chúng tôi sẽ gọi lại cho bạn sớm nhất!",
    fields: [
      { key: "fullName", label: "Họ và tên", type: "text", required: true, options: [] },
      { key: "phone", label: "Số điện thoại", type: "phone", required: true, options: [] },
      { key: "targetScore", label: "Điểm mục tiêu", type: "select", required: false, options: ["PTE 36", "PTE 42", "PTE 50", "PTE 58", "PTE 65", "PTE 79"] },
      { key: "agree", label: "Tôi đồng ý được liên hệ tư vấn", type: "checkbox", required: true, options: [] },
    ],
  },
  {
    name: "Đặt lịch test đầu vào",
    slug: "dat-lich-test-dau-vao",
    type: "placement_booking" as const,
    submitLabel: "Đặt lịch",
    successMessage: "Đặt lịch thành công! Vui lòng kiểm tra email xác nhận.",
    fields: [
      { key: "fullName", label: "Họ và tên", type: "text", required: true, options: [] },
      { key: "phone", label: "Số điện thoại", type: "phone", required: true, options: [] },
      { key: "email", label: "Email", type: "email", required: true, options: [] },
      { key: "preferredDate", label: "Ngày mong muốn", type: "date", required: true, options: [] },
    ],
  },
  {
    name: "Liên hệ",
    slug: "lien-he",
    type: "contact" as const,
    submitLabel: "Gửi liên hệ",
    successMessage: "Cảm ơn bạn đã liên hệ PTE iPASS. Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.",
    fields: [
      { key: "fullName", label: "Họ và tên", type: "text", required: true, options: [] },
      { key: "phone", label: "Số điện thoại", type: "phone", required: true, options: [] },
      { key: "email", label: "Email", type: "email", required: false, options: [] },
      { key: "message", label: "Nội dung cần tư vấn", type: "textarea", required: false, options: [] },
    ],
  },
];

const PAGES = [
  {
    title: "Trang chủ",
    slug: "trang-chu",
    template: "landing" as const,
    summary: "PTE iPASS cung cấp khóa học PTE 1:1, nhóm nhỏ, lộ trình rõ ràng, giáo viên điểm cao, cam kết đầu ra 50 – 65 – 79+.",
    sections: [
      section("hero", "Đạt điểm PTE nhanh hơn", { body: "Tiết kiệm 30% chi phí!", items: ["Cam kết đầu ra", "Ôn luyện miễn phí, mọi lúc mọi nơi", "Kho tài liệu khổng lồ, cập nhật mỗi ngày", "Review 1 - 1 siêu chi tiết, khắc phục điểm yếu"] }),
      section("stats", "Con số nổi bật", { items: ["15.000+ đạt điểm", "Giảng viên chất lượng", "Cam kết đầu ra", "Online & Offline"] }),
      section("steps", "Lộ trình học PTE chuẩn quốc tế", {
        body: "Từ test đầu vào đến ngày thi, mỗi bước đều có giáo viên đồng hành và số liệu theo dõi tiến bộ.",
        items: [
          "Test đầu vào & tư vấn lộ trình | Đánh giá trình độ miễn phí, xác định điểm mục tiêu và thời hạn nộp hồ sơ.",
          "Xây nền tảng | Phát âm, từ vựng học thuật và chiến lược từng dạng câu hỏi PTE.",
          "Luyện đề theo kỹ năng | Speaking, Writing, Reading, Listening với phản hồi chi tiết mỗi tuần.",
          "Mock test & chốt lịch thi | Thi thử sát đề thật, tinh chỉnh chiến lược trước ngày thi chính thức.",
        ],
      }),
      section("programs", "Chương trình đào tạo chất lượng cao", {
        body: "Chọn lộ trình phù hợp với điểm xuất phát và mục tiêu của bạn.",
        items: [
          "PTE Nền tảng | Dành cho học viên mới bắt đầu, xây phát âm, từ vựng và kỹ năng cốt lõi. | /khoa-hoc/pte-nen-tang-pre-pte",
          "PTE 50 – 58 | Lộ trình cho du học và visa làm việc, tập trung kỹ năng còn yếu. | /khoa-hoc/pte-50-58",
          "PTE 65 – 79 | Lộ trình định cư 189/190, luyện đề chuyên sâu và mock test hằng tuần. | /khoa-hoc/pte-65-79",
          "Cấp tốc | Khóa ngắn hạn tăng tốc trước ngày thi, lịch học dày và chấm bài mỗi buổi. | /khoa-hoc/cap-toc",
        ],
      }),
      section("courses", "Khóa học nổi bật", { body: "Các khóa được học viên lựa chọn nhiều nhất." }),
      section("teachers", "Đội ngũ giáo viên", { body: "Giáo viên PTE 85+ giàu kinh nghiệm, tận tâm với từng học viên." }),
      section("articles", "Tin tức mới nhất", { body: "Lịch khai giảng, ưu đãi và kinh nghiệm thi PTE được cập nhật liên tục." }),
      section("community", "Tham gia cộng đồng iPTE", { body: "Kết nối với hàng nghìn học viên trong cộng đồng học tập năng động. Chia sẻ kinh nghiệm, học hỏi và cùng nhau tiến bộ." }),
      section("lead_form", "Đánh giá trình độ tiếng Anh miễn phí", { body: "Tư vấn lộ trình PTE phù hợp mục tiêu của bạn - Liên hệ trong 24 giờ – không ràng buộc" }),
    ],
  },
  {
    title: "Giới thiệu PTE iPASS",
    slug: "gioi-thieu-pte-ipass",
    template: "static" as const,
    summary: "Trung tâm luyện thi PTE với giáo viên điểm cao và lộ trình cá nhân hóa.",
    content: "<p>PTE iPASS đồng hành cùng học viên từ những bước đầu tiên đến ngày đạt mục tiêu điểm PTE.</p><p>Chúng tôi tập trung vào lộ trình rõ ràng, phản hồi chi tiết, mock test hằng tuần và đội ngũ giáo viên điểm cao.</p>",
    sections: [
      section("text", "Sứ mệnh của PTE iPASS", { body: "<p>Mang đến lộ trình PTE rõ ràng, dễ hiểu và hiệu quả cho người bận rộn; giúp mỗi học viên đạt điểm mục tiêu với chi phí và thời gian hợp lý.</p>" }),
      section("text", "Tầm nhìn", { body: "<p>Trở thành trung tâm luyện thi PTE được học viên Việt Nam và cộng đồng du học – định cư Úc tin chọn nhờ chất lượng giảng dạy minh bạch.</p>" }),
      section("features", "Đối tượng phù hợp", {
        body: "PTE iPASS thiết kế khóa học và lộ trình cho nhiều nhóm học viên khác nhau:",
        items: ["Du học sinh | Cần điểm PTE để nộp hồ sơ vào các trường đại học tại Úc.", "Định cư & visa | Cần 65–79+ cho các diện visa 189, 190, 491.", "Người đi làm bận rộn | Lịch học linh hoạt buổi tối và cuối tuần, học online hoặc tại trung tâm.", "Mất gốc tiếng Anh | Lớp nền tảng xây phát âm, từ vựng và ngữ pháp trước khi vào lộ trình điểm cao."],
      }),
      section("features", "Hệ sinh thái iPASS", {
        body: "Một hành trình học liền mạch từ test đầu vào đến ngày thi:",
        items: ["Test đầu vào & tư vấn lộ trình | Đánh giá trình độ miễn phí và gợi ý khóa phù hợp.", "Lớp học theo mục tiêu điểm | Từ nền tảng đến 79+, giáo viên chấm và sửa bài chi tiết.", "Mock test hằng tuần | Quen áp lực phòng thi, theo dõi tiến bộ bằng số liệu.", "Cộng đồng học viên | Chia sẻ kinh nghiệm, tài liệu và lịch thi mới nhất."],
      }),
    ],
  },
  {
    title: "Câu hỏi thường gặp về khóa học",
    slug: "cau-hoi-thuong-gap-ve-khoa-hoc",
    template: "landing" as const,
    summary: "Giải đáp nhanh về học phí, lịch học, giáo viên và cam kết đầu ra.",
    sections: [
      section("faq", "Câu hỏi thường gặp", {
        items: [
          "Tôi mất gốc tiếng Anh có học PTE được không? | Được. Lớp PTE Nền tảng xây lại phát âm, từ vựng và ngữ pháp trước khi vào lộ trình điểm mục tiêu.",
          "Học online hay tại trung tâm? | Cả hai hình thức đều có. Lớp online học trực tiếp qua Zoom, có ghi hình để xem lại.",
          "Học phí đã gồm tài liệu và mock test chưa? | Đã gồm tài liệu, mock test hằng tuần và chấm bài Writing/Speaking.",
          "Bao lâu thì thi được? | Tùy điểm đầu vào và mục tiêu. Tư vấn viên sẽ ước lượng sau khi bạn làm test đầu vào miễn phí.",
        ],
      }),
    ],
  },
];

const ARTICLE_CATEGORIES = ["Kiến thức PTE", "Kinh nghiệm thi", "Tin tức & sự kiện", "Du học & định cư", "Câu chuyện học viên", "PTE cho đại học"];
const COURSE_CATEGORIES = [
  ["PTE Nền tảng (Pre PTE)", "pte-nen-tang-pre-pte", "Dành cho học viên mới bắt đầu, xây phát âm, từ vựng và kỹ năng cốt lõi."],
  ["PTE 30 – 42", "pte-30-42", "Lộ trình đạt 30–42 điểm cho mục tiêu cơ bản."],
  ["PTE 50 – 58", "pte-50-58", "Lộ trình 50–58 điểm: du học, visa 482/485/491."],
  ["PTE 65 – 79", "pte-65-79", "Lộ trình 65–79 điểm: định cư (189/190), cạnh tranh điểm cao."],
  ["PTE Core (Canada)", "pte-core-canada", "Luyện thi PTE Core cho di trú Canada."],
  ["Kèm 1-1", "kem-1-1", "Học riêng với giáo viên theo lộ trình cá nhân hóa."],
  ["Chuyên sâu phát âm", "chuyen-sau-phat-am", "Sửa phát âm, ngữ điệu, nhịp điệu cho Speaking."],
  ["Cấp tốc", "cap-toc", "Khóa ngắn hạn tăng tốc trước ngày thi."],
] as const;

const TEMPLATES = [
  { key: "lead_new", name: "Thông báo lead mới cho tư vấn viên", channel: "email" as const, subject: "Lead mới: {{fullName}}", body: "Có lead mới từ biểu mẫu {{formName}}.\nHọ tên: {{fullName}}\nSĐT: {{phone}}\nVui lòng liên hệ trong {{slaDays}} ngày.", variables: ["fullName", "formName", "phone", "slaDays"] },
  { key: "trial_confirmation", name: "Xác nhận đăng ký học thử", channel: "email" as const, subject: "PTE iPASS xác nhận lịch học thử của {{fullName}}", body: "Chào {{fullName}},\nChúng tôi đã nhận đăng ký học thử. Lịch học: {{schedule}}.\nHotline: {{hotline}}.", variables: ["fullName", "schedule", "hotline"] },
  { key: "exam_reminder", name: "Nhắc lịch thi", channel: "email" as const, subject: "Nhắc lịch thi PTE ngày {{examDate}}", body: "Chào {{fullName}}, bạn có lịch thi vào {{examDate}}. Chúc bạn thi tốt!", variables: ["fullName", "examDate"] },
];

const slugOf = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const json = (v: unknown) => v as Prisma.InputJsonValue;

export async function seedWebsiteContent(prisma: PrismaClient): Promise<void> {
  for (const f of FORMS) {
    await prisma.form.upsert({ where: { slug: f.slug }, create: { ...f, fields: json(f.fields), notifyEmails: [], description: `Biểu mẫu ${f.name.toLowerCase()} trên website.` }, update: {} });
  }
  for (const [i, p] of PAGES.entries()) {
    void i;
    await prisma.page.upsert({
      where: { slug: p.slug },
      create: { title: p.title, slug: p.slug, template: p.template, status: "published", summary: p.summary, content: "content" in p ? p.content : null, sections: json(p.sections), metaTitle: `${p.title} | PTE iPASS`, metaDescription: p.summary, publishedAt: new Date() },
      update: {},
    });
  }
  for (const [i, name] of ARTICLE_CATEGORIES.entries()) {
    await prisma.articleCategory.upsert({ where: { slug: slugOf(name) }, create: { name, slug: slugOf(name), sortOrder: i + 1 }, update: {} });
  }
  for (const [i, [name, slug, description]] of COURSE_CATEGORIES.entries()) {
    await prisma.courseCategory.upsert({ where: { slug }, create: { name, slug, description, sortOrder: i + 1 }, update: {} });
  }
  for (const t of TEMPLATES) {
    await prisma.notificationTemplate.upsert({ where: { key: t.key }, create: t, update: {} });
  }

  await prisma.siteConfig.upsert({
    where: { id: "site" },
    create: {
      id: "site",
      general: json({ siteName: "PTE iPASS", tagline: "Luyện thi PTE – lộ trình rõ ràng, giáo viên điểm cao", logoUrl: "/images/logo/logo-final.jpg", defaultMetaTitle: "PTE iPASS – Luyện thi PTE hiệu quả", defaultMetaDescription: "Trung tâm luyện thi PTE với lộ trình cá nhân hóa, giáo viên PTE 85+ và mock test hàng tuần." }),
      contact: json({ hotlineVN: "+84 345 939 566", email: "tuvan@pteipass.vn", workingHours: "08:00 – 21:00 (Thứ 2 – Chủ nhật)" }),
      social: json({}),
      policies: json([]),
      chat: json({ zalo: { enabled: false }, messenger: { enabled: false }, thirdParty: { enabled: false } }),
      tracking: json({}),
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { group: "global" },
    create: { group: "global", value: json({ timezone: "Asia/Ho_Chi_Minh", language: "vi", dateFormat: "dd/MM/yyyy", currency: "VND", defaultPageSize: 20, maintenanceMode: false, leadFollowUpDays: 2 }) },
    update: {},
  });
  await prisma.setting.upsert({
    where: { group: "integration" },
    create: {
      group: "integration",
      value: json({ smtp: { enabled: false, secure: false }, recaptcha: { enabled: false }, crm: { enabled: false, provider: "none" }, storage: { provider: "local" } }),
    },
    update: {},
  });
}
