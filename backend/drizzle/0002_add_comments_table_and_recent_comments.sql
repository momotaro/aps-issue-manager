CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"body" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues_read" ADD COLUMN "recent_comments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "comments_issue_id_idx" ON "comments" USING btree ("issue_id");