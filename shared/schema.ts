import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
  username: text("username"),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("guest"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  competencies: text("competencies"),
  experience: text("experience"),
  timezone: text("timezone"),
  contact: text("contact"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consultationRequests = pgTable("consultation_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  topic: text("topic").notNull(),
  preferredTime: text("preferred_time"),
  details: text("details"),
  status: text("status").notNull().default("open"),
  consultantId: integer("consultant_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consultationSessions = pgTable("consultation_sessions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => consultationRequests.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  consultantId: integer("consultant_id").notNull().references(() => users.id),
  scheduledAt: text("scheduled_at").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("scheduled"),
  clientConfirmed: boolean("client_confirmed"),
  consultantConfirmed: boolean("consultant_confirmed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  consultationsEnabled: boolean("consultations_enabled").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertRequestSchema = createInsertSchema(consultationRequests).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(consultationSessions).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ConsultationRequest = typeof consultationRequests.$inferSelect;
export type InsertConsultationRequest = z.infer<typeof insertRequestSchema>;
export type ConsultationSession = typeof consultationSessions.$inferSelect;
export type InsertConsultationSession = z.infer<typeof insertSessionSchema>;
export type BotSettings = typeof botSettings.$inferSelect;
