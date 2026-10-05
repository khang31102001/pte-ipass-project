import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { OpenAPIV3 } from "openapi-types";

// Chú ý: chỉnh URL Render của bạn ở đây
const SERVERS: OpenAPIV3.ServerObject[] = [
    { url: "http://localhost:4000", description: "Local" },
    {
        url: "https://<your-render-app>.onrender.com",
        description: "Production",
    },
];

export const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.3",
        info: {
            title: "IPTE API",
            version: "1.0.0",
            description:
                "OpenAPI docs (Express + TypeScript + Prisma). Dùng swagger-jsdoc để sinh từ JSDoc.",
        },
        servers: SERVERS,
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // ====== Schemas chuẩn cho Branch (từ code của bạn) ======
                OpeningHours: {
                    type: "object",
                    additionalProperties: true,
                    description: "Cấu trúc JSON tùy ý cho giờ mở cửa",
                },
                Branch: {
                    type: "object",
                    properties: {
                        branch_id: { type: "integer" },
                        about_id: { type: "integer" },
                        branch_name: { type: "string" },
                        address: { type: "string" },
                        phone: { type: "string", nullable: true },
                        latitude: { type: "number", nullable: true },
                        longitude: { type: "number", nullable: true },
                        opening_hours: {
                            $ref: "#/components/schemas/OpeningHours",
                        },
                        created_at: { type: "string", format: "date-time" },
                        updated_at: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                        },
                    },
                },
                BranchCreateDTO: {
                    type: "object",
                    required: ["about_id", "branch_name", "address"],
                    properties: {
                        about_id: { type: "integer" },
                        branch_name: { type: "string" },
                        address: { type: "string" },
                        phone: { type: "string", nullable: true },
                        latitude: { type: "number", nullable: true },
                        longitude: { type: "number", nullable: true },
                        opening_hours: {
                            $ref: "#/components/schemas/OpeningHours",
                        },
                    },
                },
                BranchUpdateDTO: {
                    type: "object",
                    description: "Tất cả field đều optional",
                    properties: {
                        about_id: { type: "integer" },
                        branch_name: { type: "string" },
                        address: { type: "string" },
                        phone: { type: "string", nullable: true },
                        latitude: { type: "number", nullable: true },
                        longitude: { type: "number", nullable: true },
                        opening_hours: {
                            $ref: "#/components/schemas/OpeningHours",
                        },
                    },
                },
                BranchListResponse: {
                    type: "object",
                    properties: {
                        items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Branch" },
                        },
                        page: { type: "integer" },
                        page_size: { type: "integer" },
                        total: { type: "integer" },
                        total_pages: { type: "integer" },
                    },
                },
                // =========================================================
                // Thêm các schemas user và AuthResponse để dùng chung
                User: {
                    type: "object",
                    properties: {
                        user_id: { type: "integer" },
                        email: { type: "string", format: "email" },
                        name: { type: "string", nullable: true },
                        role: { type: "string" },
                    },
                },

                AuthResponse: {
                    type: "object",
                    required: ["access_token", "refresh_token"],
                    properties: {
                        access_token: { type: "string" },
                        refresh_token: { type: "string" },
                        token_type: {
                            type: "string",
                            example: "Bearer",
                        },
                        expires_in: { type: "integer", description: "Seconds" },
                        scope: { type: "string" },
                    },
                },
            },
        },
        paths: {},
    },
    // Các file có JSDoc @openapi để swagger-jsdoc quét
    apis: [
        "src/routes/**/*.ts",
        "src/modules/controllers/**/*.ts",
        "src/modules/models/**/*.ts", // nếu bạn để schemas/typedef riêng
    ],
});

export function setupSwagger(app: Express) {
    // JSON spec thuần (hữu ích cho Postman/Generator)
    app.get("/docs.json", (_req, res) => res.json(swaggerSpec));
    // UI
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
