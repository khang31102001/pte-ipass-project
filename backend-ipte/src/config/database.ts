import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development"
        ? [{ level: "query", emit: "event" }]
        : [],
});
if (process.env.NODE_ENV === "development") {
    prisma.$on("query", (e) => {
        console.log("🔍 SQL Query:", e.query);
        console.log("📌 Params:", e.params);
        console.log("⏱ Duration:", e.duration, "ms");
    });
}

export default prisma;
