"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchJson } from "../../../lib/api";
import { loadSession } from "../../../lib/sessionStore";
import type {
  AttemptSubmitRequest,
  AttemptSubmitResponse,
  WordResponse,
} from "../../../lib/types";

type LocalSessionType = {
  id: string;
  createdAt: string;
  items: {
    vocabId: number;
    mode: "review" | "mistake" | "new";
    questionType: "flashcard" | "mcq" | "cloze" | "semantic";
    payload: unknown;
  }[];
};

function isLocalSession(x: unknown): x is LocalSessionType {
  return !!x && typeof x === "object" && "id" in x && "items" in x;
}

export default function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const sessionId = decodeURIComponent(params.sessionId);

  const [session, setSession] = useState<LocalSessionType | null>(null);
  const [idx, setIdx] = useState(0);
  const [word, setWord] = useState<WordResponse | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const itemStartRef = useRef<number>(Date.now());

  const item = session?.items[idx] ?? null;

  useEffect(() => {
    const raw = loadSession(sessionId);
    if (raw && isLocalSession(raw)) {
      setSession(raw);
      setIdx(0);
      itemStartRef.current = Date.now();
      return;
    }

    setError("未找到本地 session。请从 /today 点击‘开始学习’进入。");
  }, [sessionId]);

  useEffect(() => {
    if (!item) return;
    setRevealed(false);
    itemStartRef.current = Date.now();

    let cancelled = false;
    setLoadingWord(true);
    fetchJson<WordResponse>(`/api/v1/word/${item.vocabId}`)
      .then((d) => {
        if (cancelled) return;
        setWord(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingWord(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item?.vocabId]);

  const progress = useMemo(() => {
    if (!session) return "";
    return `${idx + 1} / ${session.items.length}`;
  }, [idx, session]);

  async function submit(isCorrect: boolean) {
    if (!item) return;

    const responseMs = Date.now() - itemStartRef.current;

    const payload: AttemptSubmitRequest = {
      vocabId: item.vocabId,
      questionType: item.questionType,
      isCorrect,
      responseMs,
    };

    await fetchJson<AttemptSubmitResponse>("/api/v1/attempts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Next
    if (!session) return;
    if (idx + 1 < session.items.length) {
      setIdx(idx + 1);
      setError(null);
      return;
    }

    setError("已完成本次 session ✅");
  }

  if (error && !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <h1 className="text-xl font-semibold">Session</h1>
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link href="/today" className="text-sm underline">
          ← 返回今日任务
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-xs text-zinc-500">{sessionId}</div>
          <h1 className="text-xl font-semibold">学习 Session</h1>
        </div>
        <div className="text-sm text-zinc-500">{progress}</div>
      </header>

      {error ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          {error}
          <div className="mt-3">
            <Link href="/today" className="underline">
              返回今日任务
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border p-4">
        {loadingWord ? (
          <div className="text-sm text-zinc-600">Loading word...</div>
        ) : word ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-semibold tracking-tight">
                {word.word}
              </div>
              <Link
                href={`/word/${word.id}`}
                className="text-xs text-zinc-600 underline"
              >
                详情
              </Link>
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              {word.phonetic ? <span>{word.phonetic}</span> : null}
              {word.pos ? <span className="ml-2">{word.pos}</span> : null}
            </div>

            <div className="mt-4">
              {item?.questionType === "flashcard" ? (
                <>
                  <div className="text-sm font-medium">Flashcard</div>
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border text-sm font-medium"
                  >
                    {revealed ? "隐藏释义" : "显示释义"}
                  </button>
                  {revealed ? (
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      {JSON.stringify(word.meaningZh, null, 2)}
                    </pre>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="text-sm font-medium">MCQ（简化版）</div>
                  <div className="mt-2 text-sm text-zinc-600">
                    暂时用“自评对/错”代替选项（后续再补完整题干/选项）。
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-zinc-600">No word.</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => void submit(false)}
          className="inline-flex h-11 items-center justify-center rounded-md border border-red-300 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
          disabled={!item}
        >
          我错了
        </button>
        <button
          onClick={() => void submit(true)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-black text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black"
          disabled={!item}
        >
          我对了
        </button>
      </div>

      <footer className="pt-2 text-xs text-zinc-500">
        <Link href="/today" className="underline">
          ← 退出并返回今日任务
        </Link>
      </footer>
    </main>
  );
}
