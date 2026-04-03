ALTER TABLE "issues_read" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issues_read" ALTER COLUMN "photo_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issues_read" ALTER COLUMN "photos" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "issues_read" ALTER COLUMN "photos" SET NOT NULL;