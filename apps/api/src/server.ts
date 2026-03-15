import express from "express";
import cors from "cors";
import { z } from "zod";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import { db } from "./db/client.js";
import {
  userAttempts,
  userMistakes,
  userVocabState,
  users,
  vocabItems,
} from "./db/schema.js";
import { seedVocabIfEmpty } from "./seed/seedVocab.js";
import { levenshtein } from "./utils/levenshtein.js";

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

app.get("/api/v1/mistakes", async (req, res) => {
  const userId = getUserId(req);
  await ensureUser(userId);

  const levelRaw = req.query.level;
  const level =
    levelRaw === "careless" ||
    levelRaw === "stubborn" ||
    levelRaw === "similar_confusion"
      ? levelRaw
      : null;

  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));

  const rows = await db
    .select({
      vocabId: userMistakes.vocabId,
      mistakeCount: userMistakes.mistakeCount,
      mistakeLevel: userMistakes.mistakeLevel,
      lastMistakeAt: userMistakes.lastMistakeAt,
      word: vocabItems.word,
      pos: vocabItems.pos,
      meaningZh: vocabItems.meaningZh,
    })
    .from(userMistakes)
    .innerJoin(vocabItems, eq(userMistakes.vocabId, vocabItems.id))
    .where(
      level
        ? and(
            eq(userMistakes.userId, userId),
            eq(userMistakes.mistakeLevel, level),
          )
        : eq(userMistakes.userId, userId),
    )
    .orderBy(desc(userMistakes.lastMistakeAt))
    .limit(limit)
    .offset(offset);

  res.json({ items: rows, limit, offset, level });
});

const AttemptSubmitSchema = z.object({
  vocabId: z.number().int().positive(),
  questionType: z.enum(["flashcard", "mcq", "cloze", "semantic"]),
  isCorrect: z.boolean(),
  responseMs: z.number().int().min(0),
  changedAnswer: z.boolean().optional(),
  meta: z
    .object({
      choice: z.string().optional(),
      options: z.array(z.string()).optional(),
    })
    .optional(),
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

  const { vocabId, questionType, isCorrect, responseMs, changedAnswer, meta } =
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

  // Mistakes aggregation (M2): only update on wrong answers.
  let mistakeSummary: null | {
    mistakeCount: number;
    mistakeLevel: "careless" | "stubborn" | "similar_confusion";
  } = null;

  if (!isCorrect) {
    const existing = await db
      .select({
        mistakeCount: userMistakes.mistakeCount,
        confusionWith: userMistakes.confusionWith,
      })
      .from(userMistakes)
      .where(and(eq(userMistakes.userId, userId), eq(userMistakes.vocabId, vocabId)))
      .limit(1);

    const prevCount = existing[0]?.mistakeCount ?? 0;
    const newCount = prevCount + 1;

    // Minimal heuristic v1:
    // - similar_confusion if meta.choice exists and is similar to target word
    // - stubborn if >= 3
    // - else careless
    let level: "careless" | "stubborn" | "similar_confusion" =
      newCount >= 3 ? "stubborn" : "careless";

    if (meta?.choice) {
      const choice = meta.choice.toLowerCase();
      const target = (
        await db
          .select({ word: vocabItems.word })
          .from(vocabItems)
          .where(eq(vocabItems.id, vocabId))
          .limit(1)
      )[0]?.word?.toLowerCase();

      if (target && levenshtein(choice, target) <= 2) {
        level = "similar_confusion";
      }
    }

    const prevConf = (existing[0]?.confusionWith ?? null) as null | string[];
    const nextConf = meta?.choice
      ? Array.from(new Set([...(prevConf ?? []), meta.choice])).slice(0, 10)
      : prevConf;

    await db
      .insert(userMistakes)
      .values({
        userId,
        vocabId,
        mistakeCount: newCount,
        mistakeLevel: level,
        lastMistakeAt: now,
        confusionWith: nextConf ?? null,
      })
      .onConflictDoUpdate({
        target: [userMistakes.userId, userMistakes.vocabId],
        set: {
          mistakeCount: newCount,
          mistakeLevel: level,
          lastMistakeAt: now,
          confusionWith: nextConf ?? null,
        },
      });

    mistakeSummary = { mistakeCount: newCount, mistakeLevel: level };
  }

  res.json({
    updatedState: {
      status: next.status,
      strength: next.strength,
      nextReviewAt: next.nextReviewAt.toISOString(),
    },
    mistake: mistakeSummary,
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
