import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const vocabItems = sqliteTable(
  "vocab_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    word: text("word").notNull().unique(),
    phonetic: text("phonetic"),
    pos: text("pos"),
    meaningZh: text("meaning_zh", { mode: "json" }).notNull(),
    roots: text("roots", { mode: "json" }),
  },
  (t) => ({
    wordIdx: index("vocab_items_word_idx").on(t.word),
  }),
);

export const userVocabState = sqliteTable(
  "user_vocab_state",
  {
    userId: text("user_id").notNull(),
    vocabId: integer("vocab_id").notNull(),
    status: text("status").notNull(), // unknown | fuzzy | mastered
    strength: real("strength").notNull(), // 0..1
    nextReviewAt: integer("next_review_at", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    pk: uniqueIndex("user_vocab_state_user_vocab_uniq").on(t.userId, t.vocabId),
    nextReviewIdx: index("user_vocab_state_next_review_idx").on(
      t.userId,
      t.nextReviewAt,
    ),
  }),
);

export const userAttempts = sqliteTable(
  "user_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    vocabId: integer("vocab_id").notNull(),
    questionType: text("question_type").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    responseMs: integer("response_ms").notNull(),
    changedAnswer: integer("changed_answer", { mode: "boolean" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    userVocabCreatedIdx: index("user_attempts_user_vocab_created_idx").on(
      t.userId,
      t.vocabId,
      t.createdAt,
    ),
  }),
);

export const userMistakes = sqliteTable(
  "user_mistakes",
  {
    userId: text("user_id").notNull(),
    vocabId: integer("vocab_id").notNull(),
    mistakeCount: integer("mistake_count").notNull(),
    mistakeLevel: text("mistake_level").notNull(), // careless | stubborn | similar_confusion
    lastMistakeAt: integer("last_mistake_at", { mode: "timestamp" }).notNull(),
    confusionWith: text("confusion_with", { mode: "json" }),
  },
  (t) => ({
    uniq: uniqueIndex("user_mistakes_user_vocab_uniq").on(t.userId, t.vocabId),
    levelIdx: index("user_mistakes_level_idx").on(t.userId, t.mistakeLevel),
    lastIdx: index("user_mistakes_last_idx").on(t.userId, t.lastMistakeAt),
  }),
);
