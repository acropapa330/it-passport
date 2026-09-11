import type { Question, QuestionSet } from "./types";

export async function loadQuestions(url: string, fetchFn: typeof fetch = fetch): Promise<Question[]> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`問題データの取得に失敗しました (HTTP ${res.status})`);
  const data = (await res.json()) as Partial<QuestionSet>;
  if (data.version !== 1 || !Array.isArray(data.questions)) {
    throw new Error("問題データの形式が不正です");
  }
  return data.questions;
}
