ALTER TABLE "comments" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "issues_read" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "issues_read" DROP COLUMN "photo_count";--> statement-breakpoint
ALTER TABLE "issues_read" DROP COLUMN "photos";