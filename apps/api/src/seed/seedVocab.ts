import { readFile } from "node:fs/promises";
import { db } from "../db/client.js";
import { vocabItems } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

type SampleVocabItem = {
  word: string;
  phonetic?: string;
  pos?: string;
  meaningZh: string[];
  roots?: unknown;
};

export async function seedVocabIfEmpty() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabItems);

  if (count > 0) return { seeded: 0, alreadyHad: count };

  const raw = await readFile(new URL("./vocab.sample.json", import.meta.url));
  const data = JSON.parse(raw.toString("utf8")) as SampleVocabItem[];

  let seeded = 0;
  for (const item of data) {
    // Avoid duplicates just in case.
    const existing = await db
      .select({ id: vocabItems.id })
      .from(vocabItems)
      .where(eq(vocabItems.word, item.word))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(vocabItems).values({
      word: item.word,
      phonetic: item.phonetic ?? null,
      pos: item.pos ?? null,
      meaningZh: item.meaningZh,
      roots: item.roots ?? null,
    });
    seeded += 1;
  }

  return { seeded, alreadyHad: 0 };
}
