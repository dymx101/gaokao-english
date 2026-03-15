"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "../../lib/api";
import type { TodayTasksResponse } from "../../lib/types";
import { saveSession } from "../../lib/sessionStore";

export default function TodayPage() {
  const [data, setData] = useState<TodayTasksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<TodayTasksResponse>("/api/v1/tasks/today")
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
  }, []);

  const sessionId = useMemo(() => {
    const date = data?.date ?? new Date().toISOString().slice(0, 10);
    return `today-${date}`;
  }, [data?.date]);

  const startHref = `/session/${encodeURIComponent(sessionId)}`;

  function onStart() {
    if (!data) return;
    saveSession({
      id: sessionId,
      createdAt: new Date().toISOString(),
      items: data.items,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
      <header className="space-y-1">
        <div className="text-xs text-zinc-500">Demo 用户：demo</div>
        <h1 className="text-xl font-semibold">今日任务</h1>
      </header>

      {loading ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">
          Loading...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <div className="mt-2 text-xs text-red-600">
            请确认后端已启动：pnpm dev:api（默认端口 3001）
          </div>
        </div>
      ) : data ? (
        <>
          <div className="rounded-xl border p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-medium">{data.date}</div>
              <div className="text-xs text-zinc-500">
                items: {data.items.length} / vocab: {data.totalVocab}
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              <Link
                href={startHref}
                onClick={onStart}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black"
              >
                开始学习
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
              >
                刷新
              </button>
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="border-b px-4 py-2 text-sm font-medium">
              任务列表
            </div>
            <ul className="divide-y">
              {data.items.map((it, idx) => (
                <li key={`${it.vocabId}-${idx}`} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">vocab #{it.vocabId}</span>
                    <span className="text-xs text-zinc-500">
                      {it.mode} / {it.questionType}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <footer className="pt-2 text-xs text-zinc-500">
        <div className="flex gap-3">
          <Link href="/mistakes" className="underline">
            错词本
          </Link>
          <Link href="/" className="underline">
            首页
          </Link>
        </div>
      </footer>
    </main>
  );
}
