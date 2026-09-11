import { describe, expect, test } from "vitest";
import { parseAnswerText } from "./answers.mjs";

describe("parseAnswerText", () => {
  test("表形式のテキストから問番号→index を得る", () => {
    const text = `問番号     正解   問番号    正解
問 1      ア   問 26   ア
問 2      イ   問 27   ウ
問 100    エ
`;
    expect(parseAnswerText(text)).toEqual({ 1: 0, 26: 0, 2: 1, 27: 2, 100: 3 });
  });

  test("重複した問番号は例外", () => {
    expect(() => parseAnswerText("問 1 ア\n問 1 イ")).toThrow("重複");
  });
});
