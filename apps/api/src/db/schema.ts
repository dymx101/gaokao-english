import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const vocabItems = sqliteTable("vocab_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  word: text("word").notNull().unique(),
  phonetic: text("phonetic"),
  pos: text("pos"),
  meaningZh: text("meaning_zh", { mode: "json" }).notNull(),
  roots: text("roots", { mode: "json" }),
});
