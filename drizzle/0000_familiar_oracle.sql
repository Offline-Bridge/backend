CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"address" text NOT NULL,
	"private_key" text NOT NULL,
	"balance" text DEFAULT '0' NOT NULL,
	"pin" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"withdrawal_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "users_address_unique" UNIQUE("address"),
	CONSTRAINT "users_private_key_unique" UNIQUE("private_key"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
