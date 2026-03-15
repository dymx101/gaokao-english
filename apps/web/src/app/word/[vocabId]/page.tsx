"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchJson } from "../../../lib/api";
import type { WordResponse } from "../../../lib/types";

export default function WordPage({ params }: { params: { vocabId: string } }) {
  const vocabId = Number(params.vocabId);

  const [data, setData] = useState<WordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(vocabId)) {
      setError("invalid vocabId");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchJson<WordResponse>(`/api/v1/word/${vocabId}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vocabId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">单词详情</h1>
        <div className="text-xs text-zinc-500">vocabId: {params.vocabId}</div>
      </header>

      {loading ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">
          Loading...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-semibold tracking-tight">
            {data.word}
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            {data.phonetic ? <span>{data.phonetic}</span> : null}
            {data.pos ? <span className="ml-2">{data.pos}</span> : null}
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">释义</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {JSON.stringify(data.meaningZh, null, 2)}
            </pre>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">掌握状态</div>
            {data.state ? (
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                status: <b>{data.state.status}</b>, strength:{" "}
                {data.state.strength}
                <div className="text-xs text-zinc-500">
                  nextReviewAt: {data.state.nextReviewAt}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-600">暂无记录</div>
            )}
          </div>
        </div>
      ) : null}

      <footer className="pt-2 text-xs text-zinc-500">
        <Link href="/today" className="underline">
          ← 返回今日任务
        </Link>
      </footer>
    </main>
  );
}
