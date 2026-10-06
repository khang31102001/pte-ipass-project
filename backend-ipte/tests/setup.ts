import "dotenv/config";

// Mọi test chạy trên DB riêng (TEST_DATABASE_URL), tuyệt đối không chạm DB phát triển/thật.
const testUrl = process.env["TEST_DATABASE_URL"];
if (!testUrl) throw new Error("Thiếu TEST_DATABASE_URL");
if (!/\/[^/?]*_test(\?|$)/.test(testUrl)) throw new Error("TEST_DATABASE_URL phải trỏ tới database có tên kết thúc bằng _test — dừng để bảo vệ dữ liệu");

process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = testUrl;
