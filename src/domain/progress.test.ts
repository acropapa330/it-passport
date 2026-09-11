import { describe, expect, test } from "vitest";
import {
  PROGRESS_KEY,
  emptyProgress,
  loadProgress,
  memoryStorage,
  recordAnswer,
  recordExam,
  saveProgress,
  summarize,
} from "./progress";
import { emptyFieldStats } from "./grading";

describe("loadProgress", () => {
  test("未保存なら empty", () => {
    const { progress, status } = loadProgress(memoryStorage());
    expect(status).toBe("empty");
    expect(progress).toEqual(emptyProgress());
  });

  test("保存したものを読める", () => {
    const s = memoryStorage();
    const p = recordAnswer(emptyProgress(), "r08-001", true, "2026-09-11T00:00:00Z");
    saveProgress(s, p);
    const { progress, status } = loadProgress(s);
    expect(status).toBe("ok");
    expect(progress).toEqual(p);
  });

  test("version 不一致は incompatible で空を返す", () => {
    const s = memoryStorage();
    s.setItem(PROGRESS_KEY, JSON.stringify({ version: 0, attempts: {} }));
    const { progress, status } = loadProgress(s);
    expect(status).toBe("incompatible");
    expect(progress).toEqual(emptyProgress());
  });

  test("壊れた JSON は incompatible", () => {
    const s = memoryStorage();
    s.setItem(PROGRESS_KEY, "{not json");
    expect(loadProgress(s).status).toBe("incompatible");
  });
});

describe("recordAnswer", () => {
  test("正解・不正解を加算し lastCorrect を更新。元は変更しない", () => {
    const p0 = emptyProgress();
    const p1 = recordAnswer(p0, "q1", true, "t1");
    const p2 = recordAnswer(p1, "q1", false, "t2");
    expect(p0.attempts).toEqual({});
    expect(p1.attempts.q1).toEqual({ correct: 1, wrong: 0, lastAnsweredAt: "t1", lastCorrect: true });
    expect(p2.attempts.q1).toEqual({ correct: 1, wrong: 1, lastAnsweredAt: "t2", lastCorrect: false });
  });
});

describe("recordExam / summarize", () => {
  test("模試結果を追加し、summary に反映", () => {
    let p = emptyProgress();
    p = recordAnswer(p, "q1", true, "t");
    p = recordAnswer(p, "q2", false, "t");
    p = recordAnswer(p, "q2", false, "t");
    const result = { finishedAt: "t", score: 70, byField: emptyFieldStats() };
    p = recordExam(p, result);
    expect(p.examResults).toEqual([result]);
    const s = summarize(p);
    expect(s.answered).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.wrong).toBe(2);
    expect(s.accuracy).toBeCloseTo(1 / 3);
    expect(s.lastExam).toEqual(result);
  });

  test("未回答なら accuracy は null", () => {
    expect(summarize(emptyProgress()).accuracy).toBeNull();
    expect(summarize(emptyProgress()).lastExam).toBeNull();
  });
});
