import * as cheerio from "cheerio";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { stripImgTags } from "@utils/objectUtils";

const apiKey = process.env.GEMINI_API_KEY!;
const modelName = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

export interface SeoEvaluationResult {
    score: number; // 0–100
    issues: string[]; // list of problems
    suggestions: string[]; // concrete improvement tips
    overallComment: string; // short summary
}

export async function evaluateSeo(data: SeoEvaluationInput): Promise<SeoEvaluationResult> {
    const { content } = data;

    const html = typeof content === "string" && content.trim().length > 0 ? content : "";

    const cleanedContent = stripImgTags(html);

    const textOnly = cheerio.load(cleanedContent).text();
    const prompt = `
Bạn là chuyên gia SEO đánh giá nội dung cho website trung tâm tiếng Anh.

Nhiệm vụ:
- Đánh giá chất lượng SEO của nội dung theo thang điểm 0–100
- Chỉ ra các vấn đề SEO cụ thể
- Đề xuất cách cải thiện SEO (cụ thể, có thể hành động)

Chỉ trả về MỘT đối tượng JSON hợp lệ theo đúng cấu trúc sau (không thêm bất kỳ nội dung nào khác):

{
  "score": number,          // số nguyên 0–100
  "issues": string[],       // mỗi mục ≤ 200 ký tự
  "suggestions": string[],  // mỗi mục ≤ 200 ký tự
  "overallComment": string  // 1–3 câu
}

Tiêu chí chấm điểm:
- Liên quan đến học tiếng Anh (30)
- Từ khóa & tối ưu SEO (25)
- Cấu trúc & độ dễ đọc (20)
- Meta & mô tả (15)
- Thân thiện mobile & tốc độ tải (10)

Đối tượng: học sinh và phụ huynh tìm khóa học tiếng Anh.

Nội dung cần đánh giá (chỉ là TEXT, không có HTML):

${textOnly}

QUAN TRỌNG:
- Chỉ trả về JSON, không markdown, không giải thích.
- "score" bắt buộc là số nguyên từ 0 đến 100.
`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const rawText = result.response.text().trim();

    // 1. Remove Markdown code fences if present
    let text = rawText;

    // Case: ```json\n{...}\n```
    if (text.startsWith("```")) {
        // Remove leading ``` or ```json
        text = text.replace(/^```(?:json)?\s*/i, "");
        // Remove trailing ```
        text = text.replace(/```$/, "").trim();
    }

    // Extra safety: extract first JSON object if there is any leftover text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Gemini response does not contain a JSON object: " + rawText);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
        throw new Error("Gemini response is not valid JSON: " + rawText);
    }

    const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0)));

    return {
        score,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        overallComment: typeof parsed.overallComment === "string" ? parsed.overallComment : "",
    };
}
