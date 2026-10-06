-- CreateTable
CREATE TABLE "legacy_map" (
    "source" VARCHAR(60) NOT NULL,
    "source_id" VARCHAR(60) NOT NULL,
    "target_table" VARCHAR(60) NOT NULL,
    "target_id" VARCHAR(80) NOT NULL,
    "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_map_pkey" PRIMARY KEY ("source","source_id")
);

-- CreateIndex
CREATE INDEX "legacy_map_target_table_target_id_idx" ON "legacy_map"("target_table", "target_id");
