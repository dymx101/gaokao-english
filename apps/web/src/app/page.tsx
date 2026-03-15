import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          高考英语 AI 词汇专家
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Demo 模式（用户：demo）
        </p>
      </header>

      <div className="rounded-xl border p-4">
        <div className="text-sm font-medium">从这里开始</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/today"
            className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black"
          >
            今日任务
          </Link>
          <Link
            href="/mistakes"
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
          >
            错词本
          </Link>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        需要先启动后端：
        <code className="rounded bg-zinc-100 px-1">pnpm dev:api</code>
      </div>
    </main>
  );
}
