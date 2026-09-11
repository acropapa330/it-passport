import { describe, expect, test } from "vitest";
import { loadQuestions } from "./questions";
import { makeQuestion } from "./testUtils";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response) as typeof fetch;
}

describe("loadQuestions", () => {
  test("version 1 の配列を返す", async () => {
    const q = makeQuestion();
    const out = await loadQuestions("x", fakeFetch(200, { version: 1, questions: [q] }));
    expect(out).toEqual([q]);
  });

  test("HTTP エラーは例外", async () => {
    await expect(loadQuestions("x", fakeFetch(404, {}))).rejects.toThrow("404");
  });

  test("形式が違えば例外", async () => {
    await expect(loadQuestions("x", fakeFetch(200, { version: 2, questions: [] }))).rejects.toThrow("形式");
  });
});
