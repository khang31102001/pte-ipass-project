-- DROP TYPE public."contact_method";

CREATE TYPE public."contact_method" AS ENUM (
	'PHONE',
	'EMAIL',
	'ZALO',
	'MESSENGER',
	'WHATSAPP',
	'OTHER');

-- DROP TYPE public."course_category";

CREATE TYPE public."course_category" AS ENUM (
	'BASIS',
	'ADVANCE',
	'IPASS');

-- DROP TYPE public."course_level";

CREATE TYPE public."course_level" AS ENUM (
	'BEGINNER',
	'INTERMEDIATE',
	'ADVANCED');

-- DROP TYPE public."course_mode";

CREATE TYPE public."course_mode" AS ENUM (
	'ONLINE',
	'OFFLINE',
	'HYBRID');

-- DROP TYPE public."enrollment_status";

CREATE TYPE public."enrollment_status" AS ENUM (
	'INTERESTED',
	'REGISTERED',
	'IN_PROGRESS',
	'COMPLETED',
	'CANCELLED');

-- DROP TYPE public."payment_status";

CREATE TYPE public."payment_status" AS ENUM (
	'UNPAID',
	'PAID',
	'PARTIAL',
	'REFUNDED');

-- DROP TYPE public."publish_status";

CREATE TYPE public."publish_status" AS ENUM (
	'DRAFT',
	'PUBLISHED',
	'ARCHIVED');