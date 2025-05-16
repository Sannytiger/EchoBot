import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Bot-specific schemas
export const commands = pgTable("commands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  prefix: text("prefix").notNull(),
  cooldown: integer("cooldown").notNull().default(3),
  permissionLevel: text("permission_level").notNull().default("None"),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
});

export const insertCommandSchema = createInsertSchema(commands).omit({
  id: true,
  usageCount: true,
});

export type InsertCommand = z.infer<typeof insertCommandSchema>;
export type Command = typeof commands.$inferSelect;

export const commandLogs = pgTable("command_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  command: text("command").notNull(),
  serverId: text("server_id"),
  serverName: text("server_name"),
  status: text("status").notNull(),
});

export const insertCommandLogSchema = createInsertSchema(commandLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertCommandLog = z.infer<typeof insertCommandLogSchema>;
export type CommandLog = typeof commandLogs.$inferSelect;
