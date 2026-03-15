import type { TodayTaskItem } from "./types";

export type LocalSession = {
  id: string;
  createdAt: string;
  items: TodayTaskItem[];
};

const KEY_PREFIX = "gaokao.session.";

export function saveSession(session: LocalSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${KEY_PREFIX}${session.id}`,
    JSON.stringify(session),
  );
}

export function loadSession(id: string): LocalSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${KEY_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
}
