"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "../../lib/api";
import { saveSession } from "../../lib/sessionStore";

type MistakeLevel = "careless" | "stubborn" | "similar_confusion";

type MistakesResponse = {
  items: {
    vocabId: number;
    mistakeCount: number;
    mistakeLevel: MistakeLevel;
    lastMistakeAt: string;
    word: string;
    pos: string | null;
    meaningZh: unknown;
  }[];
  limit: number;
  offset: number;
  level: MistakeLevel | null;
};

const TABS: { key: MistakeLevel | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "careless", label: "粗心" },
  { key: "stubborn", label: "顽固" },
  { key: "similar_confusion", label: "易混" },
];

export default function MistakesPage() {
  const [tab, setTab] = useState<MistakeLevel | "all">("all");
  const [data, setData] = useState<MistakesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const levelParam = tab === "all" ? "" : `?level=${tab}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<MistakesResponse>(`/api/v1/mistakes${levelParam}`)
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
  }, [levelParam]);

  const drillSessionId = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return `mistakes-${tab}-${date}`;
  }, [tab]);

  const drillHref = `/session/${encodeURIComponent(drillSessionId)}`;

  function onStartDrill() {
    if (!data) return;
    const items = data.items.map((it, idx) => ({
      vocabId: it.vocabId,
      mode: "mistake" as const,
      questionType: idx % 2 === 0 ? ("flashcard" as const) : ("mcq" as const),
      payload: {},
    }));

    saveSession({
      id: drillSessionId,
      createdAt: new Date().toISOString(),
      items,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">错词本</h1>
        <div className="text-xs text-zinc-500">Demo 用户：demo</div>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-xl border p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "h-9 shrink-0 rounded-md px-3 text-sm font-medium " +
              (tab === t.key
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">练一练</div>
          <Link
            href={drillHref}
            onClick={onStartDrill}
            className="text-sm underline"
          >
            开始 Drill →
          </Link>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Drill 会把当前 tab 下的错词按顺序生成一个 session。
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">
          Loading...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-2 text-sm font-medium">
            列表（{data.items.length}）
          </div>
          <ul className="divide-y">
            {data.items.map((it) => (
              <li key={it.vocabId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold">{it.word}</div>
                  <div className="text-xs text-zinc-500">
                    {it.mistakeLevel} · {it.mistakeCount}
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {it.pos ? `${it.pos} · ` : ""}vocab #{it.vocabId}
                </div>
                <div className="mt-2 flex gap-3">
                  <Link
                    className="text-xs underline"
                    href={`/word/${it.vocabId}`}
                  >
                    详情
                  </Link>
                  <Link
                    className="text-xs underline"
                    href={`/session/${encodeURIComponent(drillSessionId)}`}
                    onClick={onStartDrill}
                  >
                    从这里开始
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="pt-2 text-xs text-zinc-500">
        <div className="flex gap-3">
          <Link href="/today" className="underline">
            今日任务
          </Link>
          <Link href="/" className="underline">
            首页
          </Link>
        </div>
      </footer>
    </main>
  );
}
