-- Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt (kể cả đ/Đ).
-- Rollback: DROP FUNCTION IF EXISTS vn_fold(text); DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION vn_fold(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT translate(lower(unaccent('unaccent', coalesce(input, ''))), 'đ', 'd') $$;
