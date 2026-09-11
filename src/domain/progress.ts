import type { ExamResult, Progress } from "./types";

export const PROGRESS_KEY = "it-passport/v1/progress";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type LoadStatus = "empty" | "ok" | "incompatible";

export function emptyProgress(): Progress {
  return { version: 1, attempts: {}, examResults: [] };
}

export function loadProgress(storage: StorageLike): { progress: Progress; status: LoadStatus } {
  const raw = storage.getItem(PROGRESS_KEY);
  if (raw === null) return { progress: emptyProgress(), status: "empty" };
  try {
    const data = JSON.parse(raw) as Partial<Progress>;
    if (
      data.version !== 1 ||
      typeof data.attempts !== "object" ||
      data.attempts === null ||
      Array.isArray(data.attempts) ||
      !Array.isArray(data.examResults)
    ) {
      return { progress: emptyProgress(), status: "incompatible" };
    }
    return { progress: data as Progress, status: "ok" };
  } catch {
    return { progress: emptyProgress(), status: "incompatible" };
  }
}

export function saveProgress(storage: StorageLike, progress: Progress): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function recordAnswer(progress: Progress, questionId: string, correct: boolean, now: string): Progress {
  const prev = progress.attempts[questionId] ?? { correct: 0, wrong: 0, lastAnsweredAt: "", lastCorrect: false };
  return {
    ...progress,
    attempts: {
      ...progress.attempts,
      [questionId]: {
        correct: prev.correct + (correct ? 1 : 0),
        wrong: prev.wrong + (correct ? 0 : 1),
        lastAnsweredAt: now,
        lastCorrect: correct,
      },
    },
  };
}

export function recordExam(progress: Progress, result: ExamResult): Progress {
  return { ...progress, examResults: [...progress.examResults, result] };
}

export function summarize(progress: Progress) {
  const attempts = Object.values(progress.attempts);
  const correct = attempts.reduce((n, a) => n + a.correct, 0);
  const wrong = attempts.reduce((n, a) => n + a.wrong, 0);
  const total = correct + wrong;
  return {
    answered: attempts.length,
    correct,
    wrong,
    accuracy: total === 0 ? null : correct / total,
    lastExam: progress.examResults.at(-1) ?? null,
  };
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

/** localStorage が使えればそれを、使えなければメモリ上のストレージを返す */
export function detectStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    const probe = "it-passport/probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return { storage: window.localStorage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
