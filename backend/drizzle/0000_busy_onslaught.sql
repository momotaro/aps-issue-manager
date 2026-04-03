CREATE TABLE "issue_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issue_events_issue_id_version_unique" UNIQUE("issue_id","version")
);
--> statement-breakpoint
CREATE TABLE "issue_snapshots" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues_read" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) NOT NULL,
	"category" varchar(30) NOT NULL,
	"position_type" varchar(20) NOT NULL,
	"position_data" jsonb NOT NULL,
	"reporter_id" uuid NOT NULL,
	"assignee_id" uuid,
	"photo_count" integer DEFAULT 0,
	"photos" jsonb,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"model_urn" varchar(500) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "issues_read_project_id_idx" ON "issues_read" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issues_read_status_idx" ON "issues_read" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issues_read_category_idx" ON "issues_read" USING btree ("category");--> statement-breakpoint
CREATE INDEX "issues_read_assignee_id_idx" ON "issues_read" USING btree ("assignee_id");