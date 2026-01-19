CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verification_codes_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "connected_wallet" text;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "withdrawal_address";