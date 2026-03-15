import express from "express";
import cors from "cors";
import { z } from "zod";
import { and, asc, eq, lte, sql } from "drizzle-orm";

import { db } from "./db/client.js";
import {
  userAttempts,
  userVocabState,
  users,
  vocabItems,
} from "./db/schema.js";
import { seedVocabIfEmpty } from "./seed/seedVocab.js";

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_USER_ID = "demo";

function getUserId(req: express.Request) {
  const header = req.header("x-user-id");
  return header && header.trim().length > 0 ? header.trim() : DEFAULT_USER_ID;
}

async function ensureUser(userId: string) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(users).values({ id: userId, createdAt: new Date() });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/v1/dev/seed", async (req, res) => {
  const token = req.header("x-dev-token");
  if (
    (process.env.DEV_SEED_TOKEN ?? "") &&
    token !== process.env.DEV_SEED_TOKEN
  ) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const result = await seedVocabIfEmpty();
  res.json({ ok: true, ...result });
});

app.get("/api/v1/tasks/today", async (req, res) => {
  const userId = getUserId(req);
  await ensureUser(userId);

  // Seed for first run dev convenience (idempotent).
  await seedVocabIfEmpty();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const due = await db
    .select({
      vocabId: userVocabState.vocabId,
      status: userVocabState.status,
      nextReviewAt: userVocabState.nextReviewAt,
    })
    .from(userVocabState)
    .where(
      and(
        eq(userVocabState.userId, userId),
        lte(userVocabState.nextReviewAt, now),
      ),
    )
    .orderBy(asc(userVocabState.nextReviewAt))
    .limit(8);

  const dueIds = due.map((d) => d.vocabId);

  const [{ totalVocab }] = await db
    .select({ totalVocab: sql<number>`count(*)` })
    .from(vocabItems);

  // Pick some new ones: the earliest ids not yet in state.
  const newItems = await db
    .select({ id: vocabItems.id })
    .from(vocabItems)
    .where(
      dueIds.length > 0 ? sql`${vocabItems.id} not in ${dueIds}` : sql`1=1`,
    )
    .orderBy(asc(vocabItems.id))
    .limit(12 - due.length);

  const items = [
    ...due.map((d, idx) => ({
      vocabId: d.vocabId,
      mode: "review" as const,
      questionType: idx % 2 === 0 ? ("flashcard" as const) : ("mcq" as const),
      payload: {},
    })),
    ...newItems.map((n, idx) => ({
      vocabId: n.id,
      mode: "new" as const,
      questionType:
        (due.length + idx) % 2 === 0
          ? ("flashcard" as const)
          : ("mcq" as const),
      payload: {},
    })),
  ];

  res.json({
    date: today,
    totalVocab,
    items,
  });
});

app.get("/api/v1/word/:id", async (req, res) => {
  const userId = getUserId(req);
  await ensureUser(userId);
  await seedVocabIfEmpty();

  const vocabId = Number(req.params.id);
  if (!Number.isFinite(vocabId)) {
    return res.status(400).json({ error: "invalid vocabId" });
  }

  const word = await db
    .select({
      id: vocabItems.id,
      word: vocabItems.word,
      phonetic: vocabItems.phonetic,
      pos: vocabItems.pos,
      meaningZh: vocabItems.meaningZh,
    })
    .from(vocabItems)
    .where(eq(vocabItems.id, vocabId))
    .limit(1);

  if (word.length === 0) return res.status(404).json({ error: "not found" });

  const state = await db
    .select({
      status: userVocabState.status,
      strength: userVocabState.strength,
      nextReviewAt: userVocabState.nextReviewAt,
    })
    .from(userVocabState)
    .where(
      and(
        eq(userVocabState.userId, userId),
        eq(userVocabState.vocabId, vocabId),
      ),
    )
    .limit(1);

  res.json({
    ...word[0],
    state: state[0] ?? null,
  });
});

const AttemptSubmitSchema = z.object({
  vocabId: z.number().int().positive(),
  questionType: z.enum(["flashcard", "mcq", "cloze", "semantic"]),
  isCorrect: z.boolean(),
  responseMs: z.number().int().min(0),
  changedAnswer: z.boolean().optional(),
  // meta is accepted but ignored in M1.
  meta: z.any().optional(),
});

function computeNewState(input: {
  prevStrength: number;
  isCorrect: boolean;
  responseMs: number;
}) {
  const { prevStrength, isCorrect, responseMs } = input;

  const expectedMs = 3000;
  const timeFactor = Math.max(
    -1,
    Math.min(1, (expectedMs - responseMs) / expectedMs),
  );

  // Very simple heuristic for M1: strength nudges up/down; slow correct answers don't boost much.
  const deltaBase = isCorrect ? 0.12 : -0.18;
  const delta = deltaBase + (isCorrect ? 0.05 * timeFactor : 0);
  const strength = Math.max(0, Math.min(1, prevStrength + delta));

  const status =
    strength >= 0.75 ? "mastered" : strength >= 0.35 ? "fuzzy" : "unknown";

  const now = new Date();
  const days = status === "unknown" ? 1 : status === "fuzzy" ? 2 : 7;
  const nextReviewAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return { strength, status, nextReviewAt, updatedAt: now };
}

app.post("/api/v1/attempts", async (req, res) => {
  const userId = getUserId(req);
  await ensureUser(userId);

  const parsed = AttemptSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const { vocabId, questionType, isCorrect, responseMs, changedAnswer } =
    parsed.data;

  // Ensure vocab exists.
  const vocab = await db
    .select({ id: vocabItems.id })
    .from(vocabItems)
    .where(eq(vocabItems.id, vocabId))
    .limit(1);

  if (vocab.length === 0)
    return res.status(404).json({ error: "vocab_not_found" });

  const now = new Date();

  await db.insert(userAttempts).values({
    userId,
    vocabId,
    questionType,
    isCorrect,
    responseMs,
    changedAnswer: changedAnswer ?? null,
    createdAt: now,
  });

  const prev = await db
    .select({
      strength: userVocabState.strength,
    })
    .from(userVocabState)
    .where(
      and(
        eq(userVocabState.userId, userId),
        eq(userVocabState.vocabId, vocabId),
      ),
    )
    .limit(1);

  const prevStrength = prev[0]?.strength ?? 0;
  const next = computeNewState({ prevStrength, isCorrect, responseMs });

  // SQLite upsert by userId+vocabId.
  await db
    .insert(userVocabState)
    .values({
      userId,
      vocabId,
      status: next.status,
      strength: next.strength,
      nextReviewAt: next.nextReviewAt,
      lastSeenAt: now,
      updatedAt: next.updatedAt,
    })
    .onConflictDoUpdate({
      target: [userVocabState.userId, userVocabState.vocabId],
      set: {
        status: next.status,
        strength: next.strength,
        nextReviewAt: next.nextReviewAt,
        lastSeenAt: now,
        updatedAt: next.updatedAt,
      },
    });

  res.json({
    updatedState: {
      status: next.status,
      strength: next.strength,
      nextReviewAt: next.nextReviewAt.toISOString(),
    },
  });
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST; // set to 0.0.0.0 for LAN access

if (host) {
  app.listen(port, host, async () => {
    // Optional: ensure seed on dev startup.
    if (process.env.AUTO_SEED === "1") {
      try {
        const r = await seedVocabIfEmpty();
        console.log(`[api] auto seed:`, r);
      } catch (e) {
        console.warn(`[api] auto seed failed`, e);
      }
    }

    const shownHost = host !== "0.0.0.0" ? host : "localhost";
    console.log(`[api] listening on http://${shownHost}:${port}`);
  });
} else {
  app.listen(port, async () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
}
