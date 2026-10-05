-- public.category definition

-- Drop table

-- DROP TABLE public.category;

CREATE TABLE public.category (
	category_id serial4 NOT NULL,
	icon text NULL,
	"name" varchar(200) NOT NULL,
	slug varchar(200) NOT NULL,
	description text NULL,
	parent_id int8 NULL,
	category_type varchar(50) NOT NULL,
	meta_title varchar(255) NULL,
	meta_description text NULL,
	h1_heading varchar(255) NULL,
	seo_content_top text NULL,
	seo_content_bottom text NULL,
	canonical_url text NULL,
	noindex bool DEFAULT false NULL,
	url text NULL,
	"level" int4 NULL,
	is_featured bool DEFAULT false NULL,
	is_disable bool DEFAULT false NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT category_pkey PRIMARY KEY (category_id)
);


-- public.consultation definition

-- Drop table

-- DROP TABLE public.consultation;

CREATE TABLE public.consultation (
	consultation_id serial4 NOT NULL,
	"name" varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	phone varchar(30) NULL,
	course_id int4 NULL,
	message text NULL,
	status varchar(50) DEFAULT 'NEW'::character varying NOT NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	target_score varchar(255) NULL,
	CONSTRAINT consultation_pkey PRIMARY KEY (consultation_id)
);


-- public.course definition

-- Drop table

-- DROP TABLE public.course;

CREATE TABLE public.course (
	course_id serial4 NOT NULL,
	course_code varchar(50) NULL,
	course_name varchar(255) NOT NULL,
	slug varchar(255) NULL,
	title text NULL,
	description text NULL,
	"level" public."course_level" DEFAULT 'BEGINNER'::course_level NOT NULL,
	"mode" public."course_mode" DEFAULT 'ONLINE'::course_mode NOT NULL,
	"language" varchar(50) DEFAULT 'en'::character varying NULL,
	price numeric(12, 2) DEFAULT 0 NULL,
	duration varchar(255) NULL,
	start_date date NULL,
	end_date date NULL,
	image text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	category public."course_category" NULL,
	schedule varchar(255) NULL,
	tuition varchar(255) NULL,
	"content" text NULL,
	category_id int4 NULL,
	is_featured bool DEFAULT false NULL,
	is_disabled bool DEFAULT false NULL,
	meta_title text NULL,
	meta_description text NULL,
	audience _text DEFAULT ARRAY[]::text[] NULL,
	keywords _text DEFAULT ARRAY[]::text[] NULL,
	schema_enabled bool DEFAULT false NULL,
	schema_mode varchar(50) NULL,
	schema_data text NULL,
	benefits text NULL,
	seo_score int4 NULL,
	delete_image_url text NULL,
	category_type varchar(255) NULL,
	CONSTRAINT course_pkey PRIMARY KEY (course_id)
);
CREATE UNIQUE INDEX course_course_code_key ON public.course USING btree (course_code);
CREATE UNIQUE INDEX course_slug_key ON public.course USING btree (slug);
CREATE INDEX idx_course_level ON public.course USING btree (level);
CREATE INDEX idx_course_mode ON public.course USING btree (mode);
CREATE INDEX idx_course_slug ON public.course USING btree (slug);


-- public.deleted_image definition

-- Drop table

-- DROP TABLE public.deleted_image;

CREATE TABLE public.deleted_image (
	deleted_image_id serial4 NOT NULL,
	delete_image_url text NOT NULL,
	CONSTRAINT deleted_image_pkey PRIMARY KEY (deleted_image_id)
);


-- public.information definition

-- Drop table

-- DROP TABLE public.information;

CREATE TABLE public.information (
	information_id serial4 NOT NULL,
	title varchar(255) NULL,
	description text NULL,
	mission text NULL,
	vision text NULL,
	email varchar(255) NULL,
	phone varchar(50) NULL,
	hotline varchar(50) NULL,
	address text NULL,
	social_url varchar(255) NULL,
	category_type varchar(255) NULL,
	map_url text NULL,
	slug varchar(255) NULL,
	image text NULL,
	delete_image_url text NULL,
	category_id int4 NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	video varchar NULL,
	"content" text NULL,
	CONSTRAINT ainformation_pkey PRIMARY KEY (information_id)
);


-- public.media definition

-- Drop table

-- DROP TABLE public.media;

CREATE TABLE public.media (
	media_id serial4 NOT NULL,
	title text NULL,
	description text NULL,
	image_name varchar(255) NULL,
	delete_image_url text NULL,
	image_url text NULL,
	video_url text NULL,
	is_disabled bool DEFAULT false NULL,
	media_type varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	category_id int4 NULL,
	category_type varchar(255) NULL,
	href varchar(255) NULL,
	CONSTRAINT media_pkey PRIMARY KEY (media_id)
);


-- public."permission" definition

-- Drop table

-- DROP TABLE public."permission";

CREATE TABLE public."permission" (
	permission_id serial4 NOT NULL,
	permission_name varchar(50) NOT NULL,
	permission_description text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT permission_pkey PRIMARY KEY (permission_id)
);
CREATE UNIQUE INDEX permission_permission_name_key ON public.permission USING btree (permission_name);


-- public.refresh_token definition

-- Drop table

-- DROP TABLE public.refresh_token;

CREATE TABLE public.refresh_token (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	jti varchar(100) NOT NULL,
	token_hash varchar(255) NOT NULL,
	session_id uuid NOT NULL,
	device_name varchar(100) NULL,
	user_agent text NULL,
	ip varchar(45) NULL,
	expires_at timestamp(6) NOT NULL,
	last_used_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	revoked_at timestamp(6) NULL,
	replaced_by_jti varchar(100) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT refresh_token_pkey PRIMARY KEY (id)
);


-- public."role" definition

-- Drop table

-- DROP TABLE public."role";

CREATE TABLE public."role" (
	role_id serial4 NOT NULL,
	role_name varchar(50) NOT NULL,
	role_description text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT role_pkey PRIMARY KEY (role_id)
);
CREATE UNIQUE INDEX role_role_name_key ON public.role USING btree (role_name);


-- public.tag definition

-- Drop table

-- DROP TABLE public.tag;

CREATE TABLE public.tag (
	tag_id serial4 NOT NULL,
	"name" varchar(100) NOT NULL,
	description text NULL,
	slug varchar(150) NOT NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT tag_pkey PRIMARY KEY (tag_id)
);
CREATE UNIQUE INDEX tag_name_key ON public.tag USING btree (name);
CREATE UNIQUE INDEX tag_slug_key ON public.tag USING btree (slug);


-- public.teacher definition

-- Drop table

-- DROP TABLE public.teacher;

CREATE TABLE public.teacher (
	teacher_id serial4 NOT NULL,
	user_id int4 NULL,
	bio text NULL,
	"name" varchar(100) NOT NULL,
	image varchar(255) NULL,
	overall_score numeric(3, 2) DEFAULT 0 NULL,
	listening_score numeric(3, 2) DEFAULT 0 NULL,
	speaking_score numeric(3, 2) DEFAULT 0 NULL,
	reading_score numeric(3, 2) DEFAULT 0 NULL,
	writing_score numeric(3, 2) DEFAULT 0 NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	slug varchar(255) DEFAULT ''::character varying NOT NULL,
	"content" text NULL,
	delete_image_url text NULL,
	seo_score int4 NULL,
	CONSTRAINT teacher_pkey PRIMARY KEY (teacher_id)
);


-- public."user" definition

-- Drop table

-- DROP TABLE public."user";

CREATE TABLE public."user" (
	user_id serial4 NOT NULL,
	username varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	email varchar(100) NOT NULL,
	full_name varchar(100) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	avatar varchar(50) NULL,
	is_active bool DEFAULT true NULL,
	bio text NULL,
	slug varchar(50) NULL,
	address text NULL,
	CONSTRAINT user_pkey PRIMARY KEY (user_id)
);
CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email);
CREATE UNIQUE INDEX user_username_key ON public."user" USING btree (username);


-- public.banner definition

-- Drop table

-- DROP TABLE public.banner;

CREATE TABLE public.banner (
	banner_id serial4 NOT NULL,
	title varchar(255) NOT NULL,
	sub_title varchar(255) NOT NULL,
	placement varchar(255) NOT NULL,
	image text NULL,
	delete_image_url text NULL,
	action_type varchar(255) NOT NULL,
	action_label varchar(255) NOT NULL,
	is_active bool DEFAULT true NULL,
	"order" int4 NULL,
	start_date date NULL,
	end_date date NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	action_url varchar(255) NULL,
	category_id int4 NOT NULL,
	CONSTRAINT banner_pkey PRIMARY KEY (banner_id),
	CONSTRAINT fk_banner_category FOREIGN KEY (category_id) REFERENCES public.category(category_id)
);


CREATE TABLE public.document (
	document_id serial4 NOT NULL,
	author_id int4 NULL,
	category_id int4 NULL,
	image text NULL,
	title varchar(255) NOT NULL,
	slug varchar(255) NOT NULL,
	description text NULL,
	"content" text NOT NULL,
	status varchar(50) NULL,
	published_at timestamp(6) NULL,
	tags _text DEFAULT ARRAY[]::text[] NULL,
	keywords _text DEFAULT ARRAY[]::text[] NULL,
	is_prominent bool DEFAULT false NULL,
	category_type varchar(255) NULL,
	is_featured bool DEFAULT false NULL,
	is_disabled bool DEFAULT false NULL,
	meta_title text NULL,
	meta_description text NULL,
	audience _text DEFAULT ARRAY[]::text[] NULL,
	schema_enabled bool DEFAULT false NULL,
	schema_mode varchar(50) NULL,
	schema_data text NULL,
	seo_score int4 NULL,
	start_date date NULL,
	end_date date NULL,
	delete_image_url text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT document_pkey PRIMARY KEY (document_id)
);
CREATE UNIQUE INDEX document_slug_key ON public.document USING btree (slug);


-- public.news definition

-- Drop table

-- DROP TABLE public.news;

CREATE TABLE public.news (
	news_id serial4 NOT NULL,
	author_id int4 NULL,
	category_id int4 NULL,
	image text NULL,
	title varchar(255) NOT NULL,
	slug varchar(255) NOT NULL,
	description text NULL,
	"content" text NOT NULL,
	status public."publish_status" DEFAULT 'DRAFT'::publish_status NOT NULL,
	published_at timestamp(6) NULL,
	tags _text DEFAULT ARRAY[]::text[] NULL,
	keywords _text DEFAULT ARRAY[]::text[] NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	is_prominent bool DEFAULT false NULL,
	category_type varchar(255) NULL,
	is_featured bool DEFAULT false NULL,
	is_disabled bool DEFAULT false NULL,
	meta_title text NULL,
	meta_description text NULL,
	audience _text DEFAULT ARRAY[]::text[] NULL,
	schema_enabled bool DEFAULT false NULL,
	schema_mode varchar(50) NULL,
	schema_data text NULL,
	seo_score int4 NULL,
	start_date date NULL,
	end_date date NULL,
	delete_image_url text NULL,
	CONSTRAINT news_pkey PRIMARY KEY (news_id),
	CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public."user"(user_id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX news_slug_key ON public.news USING btree (slug);


-- public.role_permission definition

-- Drop table

-- DROP TABLE public.role_permission;

CREATE TABLE public.role_permission (
	role_id int4 NOT NULL,
	permission_id int4 NOT NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT role_permission_pkey PRIMARY KEY (role_id, permission_id),
	CONSTRAINT role_permission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public."permission"(permission_id) ON DELETE CASCADE,
	CONSTRAINT role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public."role"(role_id) ON DELETE CASCADE
);


-- public.student definition

-- Drop table

-- DROP TABLE public.student;

CREATE TABLE public.student (
	student_id serial4 NOT NULL,
	user_id int4 NULL,
	phone varchar(30) NULL,
	dob date NULL,
	address text NULL,
	note text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	full_name varchar(255) NOT NULL,
	course_id int4 NULL,
	slug varchar(255) NOT NULL,
	CONSTRAINT student_pkey PRIMARY KEY (student_id),
	CONSTRAINT student_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX student_user_id_key ON public.student USING btree (user_id);


-- public.user_role definition

-- Drop table

-- DROP TABLE public.user_role;

CREATE TABLE public.user_role (
	user_id int4 NOT NULL,
	role_id int4 NOT NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id),
	CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public."role"(role_id) ON DELETE CASCADE,
	CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE
);


-- public."comment" definition

-- Drop table

-- DROP TABLE public."comment";

CREATE TABLE public."comment" (
	comment_id serial4 NOT NULL,
	user_id int4 NULL,
	course_id int4 NULL,
	news_id int4 NULL,
	knowledge_id int4 NULL,
	parent_comment_id int4 NULL,
	"content" text NOT NULL,
	is_approved bool DEFAULT true NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	created_by varchar(50) NULL,
	updated_by varchar(50) NULL,
	"version" int4 DEFAULT 1 NULL,
	rating int4 NULL,
	likes int4 DEFAULT 0 NULL,
	user_name varchar(100) DEFAULT NULL::character varying NULL,
	user_avatar varchar(255) DEFAULT NULL::character varying NULL,
	CONSTRAINT comment_pkey PRIMARY KEY (comment_id),
	CONSTRAINT comment_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.course(course_id) ON DELETE CASCADE,
	CONSTRAINT comment_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public."comment"(comment_id) ON DELETE CASCADE,
	CONSTRAINT comment_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL
);
CREATE INDEX idx_comment_course ON public.comment USING btree (course_id);
CREATE INDEX idx_comment_knowledge ON public.comment USING btree (knowledge_id);
CREATE INDEX idx_comment_news ON public.comment USING btree (news_id);
CREATE INDEX idx_comment_parent ON public.comment USING btree (parent_comment_id);

-- ==========================================
-- Gán quyền cho user ipte_admin_db
-- ==========================================
GRANT ALL PRIVILEGES ON SCHEMA public TO ipte_admin_db;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ipte_admin_db;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ipte_admin_db;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO ipte_admin_db;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO ipte_admin_db;

