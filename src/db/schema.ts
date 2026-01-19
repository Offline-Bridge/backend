import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumber: text("phone_number").unique().notNull(),
  address: text("address").unique().notNull(),
  privateKey: text("private_key").unique().notNull(),
  balance: text("balance").default("0").notNull(),
  pin: text("pin"),
  isActive: boolean("is_active").default(false).notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").unique(),
  connectedWallet: text("connected_wallet").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumber: text("phone_number").unique().notNull(),     
  code: text("code").notNull(), 
  expiresAt: timestamp("expires_at").notNull(), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
