import type { Question } from "../domain/types";

export function formatSource(q: Question): string {
  return `出典：${q.exam} ITパスポート試験 公開問題 問${q.number}`;
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
