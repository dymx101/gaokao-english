import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqliteFile = process.env.SQLITE_FILE ?? "./dev.sqlite3";

export const sqlite = new Database(sqliteFile);
// Better defaults for dev.
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);
