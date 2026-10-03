import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ApplicationPersistence } from "@/lib/persistence";
import type { LocalChamberView as ChamberView, ChatMessage, ReactionValue } from "@/lib/types";

export class SqlitePersistence implements ApplicationPersistence {
  private readonly database: DatabaseSync;
  private readonly displayPath: string;

  constructor(path = process.env.AUGUR_DB_PATH || resolve(process.cwd(), ".augur/augur.sqlite3")) {
    const resolved = resolve(path);
    mkdirSync(dirname(resolved), { recursive: true });
    this.database = new DatabaseSync(resolved);
    this.displayPath = process.env.AUGUR_DB_PATH ? "configured" : ".augur/augur.sqlite3";
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS created_chambers (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        chamber_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        moderated INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chat_by_chamber ON chat_messages(chamber_id, created_at);
      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chamber_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        reaction TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reactions_by_chamber ON reactions(chamber_id);
    `);
  }

  loadChambers(): ChamberView[] {
    const rows = this.database.prepare("SELECT payload FROM created_chambers ORDER BY created_at").all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as ChamberView);
  }

  saveChamber(chamber: ChamberView): void {
    this.database.prepare(`
      INSERT INTO created_chambers(id, slug, payload, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
    `).run(chamber.id, chamber.slug, JSON.stringify(chamber), new Date().toISOString());
  }

  loadMessages(chamberId: string): ChatMessage[] {
    const rows = this.database.prepare(`
      SELECT id, chamber_id, session_id, display_name, text, created_at, moderated
      FROM chat_messages WHERE chamber_id = ? ORDER BY created_at DESC LIMIT 100
    `).all(chamberId) as Array<Record<string, string | number>>;
    return rows.reverse().map((row) => ({
      id: String(row.id),
      chamberId: String(row.chamber_id),
      sessionId: String(row.session_id),
      displayName: String(row.display_name),
      text: String(row.text),
      createdAt: String(row.created_at),
      moderated: Boolean(row.moderated),
    }));
  }

  saveMessage(message: ChatMessage): void {
    this.database.prepare(`
      INSERT INTO chat_messages(id, chamber_id, session_id, display_name, text, created_at, moderated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.chamberId,
      message.sessionId,
      message.displayName,
      message.text,
      message.createdAt,
      message.moderated ? 1 : 0,
    );
  }

  loadReactions(chamberId: string): ReactionValue[] {
    const rows = this.database.prepare(
      "SELECT reaction FROM reactions WHERE chamber_id = ? ORDER BY id",
    ).all(chamberId) as Array<{ reaction: ReactionValue }>;
    return rows.map((row) => row.reaction);
  }

  saveReaction(
    chamberId: string,
    sessionId: string,
    reaction: ReactionValue,
    createdAt: string,
  ): void {
    this.database.prepare(`
      INSERT INTO reactions(chamber_id, session_id, reaction, created_at) VALUES (?, ?, ?, ?)
    `).run(chamberId, sessionId, reaction, createdAt);
  }

  health(): { mode: string; path: string } {
    this.database.prepare("SELECT 1").get();
    return { mode: "SQLITE", path: this.displayPath };
  }

  close(): void {
    this.database.close();
  }
}

declare global {
  var __augurPersistence: SqlitePersistence | undefined;
}

export function getPersistence(): SqlitePersistence {
  globalThis.__augurPersistence ??= new SqlitePersistence();
  return globalThis.__augurPersistence;
}
