ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" integer DEFAULT 0 NOT NULL;