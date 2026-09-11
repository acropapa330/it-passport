# ITパスポート過去問演習アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IPA 公開の ITパスポート過去問（直近3回・300問）をスマホのブラウザで演習できる静的サイトを作る。ドリル・絞り込み・復習・模試の4機能と localStorage の学習記録を持つ。

**Architecture:** `src/domain/` に React 非依存の純粋ロジック（出題・採点・進捗）を置き Vitest で検証する。`src/ui/` は画面のみ。問題データは `tools/import/` の取り込みスクリプトで生成した静的 JSON（`public/data/questions.json`）。問題 PDF は画像のみなので、書き起こしは Claude Code がページ画像を読んで transcript JSON を書き、スクリプトが解答・分野・画像と突き合わせて検証する。

**Tech Stack:** Vite + React 19 + TypeScript / Vitest / Node.js（取り込みスクリプト、依存なし）/ poppler-utils（`pdftoppm`, `pdftotext`）/ GitHub Pages（GitHub Actions）

仕様書: `docs/superpowers/specs/2026-09-11-it-passport-quiz-app-design.md`

## Global Constraints

- 静的サイト。サーバー処理なし。GitHub Pages の base path は `/it-passport/`
- 学習記録の localStorage キーは `it-passport/v1/progress`、`Progress.version` は `1`
- 問題 ID は `<examCode>-<3桁問番号>`（例 `r08-003`）。examCode は `r08` / `r07` / `r06`
- 分野は `"strategy" | "management" | "technology"`。表示名は「ストラテジ系」「マネジメント系」「テクノロジ系」
- 模試は 100 問・7200 秒。分野比率は strategy 35 / management 20 / technology 45
- 問題文・選択肢は原文どおり。改変しない
- 出典表記は「出典：<年度> ITパスポート試験 公開問題 問<番号>」（例「出典：令和8年度 ITパスポート試験 公開問題 問3」）
- `tools/import/raw/` と `tools/import/pages/` は git 管理外。`transcripts/` と `answers/` は git 管理
- コミットしたら `origin` へ push する（CLAUDE.md）
- 応答は日本語

## ファイル構成

```
it-passport/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ .github/workflows/deploy.yml
├─ public/data/
│  ├─ questions.json
│  └─ images/<id>.png
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                  画面遷移と進捗の保持
│  ├─ domain/
│  │  ├─ types.ts              型と定数
│  │  ├─ random.ts             seed 付き乱数とシャッフル
│  │  ├─ quiz.ts               出題リスト生成（ドリル・復習・模試）
│  │  ├─ grading.ts            採点と分野別集計
│  │  ├─ progress.ts           学習記録の読み書き
│  │  ├─ questions.ts          questions.json の取得と検証
│  │  └─ *.test.ts
│  └─ ui/
│     ├─ Home.tsx
│     ├─ Setup.tsx
│     ├─ Session.tsx           演習・模試の共通画面（タイマー含む）
│     ├─ Result.tsx
│     ├─ Footer.tsx
│     ├─ format.ts             出典文字列など表示用の小関数
│     └─ styles.css
└─ tools/import/
   ├─ README.md                取り込み手順と transcript 形式
   ├─ exams.json               回次の定義（コード・年度名・PDF 名・分野範囲）
   ├─ render.sh                PDF → ページ PNG
   ├─ parse-answers.mjs        解答 PDF → answers/<code>.json（CLI）
   ├─ build.mjs                transcripts + answers → questions.json（CLI）
   ├─ crop.mjs                 overrides.json → public/data/images（CLI）
   ├─ overrides.json           図表の切り出し範囲
   ├─ lib/
   │  ├─ answers.mjs           parseAnswerText（純関数）
   │  ├─ answers.test.mjs
   │  ├─ build.mjs             assembleQuestions / validate（純関数）
   │  └─ build.test.mjs
   ├─ raw/        (git 管理外)
   ├─ pages/      (git 管理外)
   ├─ transcripts/<code>/page-NN.json
   └─ answers/<code>.json
```

---

### Task 1: プロジェクト雛形（Vite + React + TS + Vitest）

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/domain/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm test` が動くこと。base path `/it-passport/`

- [ ] **Step 1: 依存をインストール**

```bash
cd /home/user/it-passport
npm init -y >/dev/null
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react vitest @types/react @types/react-dom
```

- [ ] **Step 2: package.json の scripts / type を設定**

`package.json` を開き、`"name"`, `"private"`, `"type"`, `"scripts"` を以下にする（dependencies は Step 1 のまま残す）:

```json
{
  "name": "it-passport",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "import:answers": "node tools/import/parse-answers.mjs",
    "import:build": "node tools/import/build.mjs",
    "import:crop": "node tools/import/crop.mjs"
  }
}
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/it-passport/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "tools/**/*.test.mjs"],
  },
});
```

- [ ] **Step 5: index.html / src/main.tsx / src/App.tsx**

`index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ITパスポート 過去問演習</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`（仮。Task 11 で置き換える）:

```tsx
export function App() {
  return <h1>ITパスポート 過去問演習</h1>;
}
```

- [ ] **Step 6: スモークテスト**

`src/domain/smoke.test.ts`:

```ts
import { expect, test } from "vitest";

test("vitest が動く", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: .gitignore に追記**

```
node_modules/
dist/
tools/import/raw/
tools/import/pages/
```

- [ ] **Step 8: 動作確認**

Run: `npm test`
Expected: `1 passed`

Run: `npm run build`
Expected: `dist/index.html` が生成され、エラーなし

- [ ] **Step 9: Commit & push**

```bash
git add -A
git commit -m "chore: Vite + React + TypeScript + Vitest の雛形を追加"
git push
```

---

### Task 2: 型定義と seed 付き乱数

**Files:**
- Create: `src/domain/types.ts`, `src/domain/random.ts`, `src/domain/random.test.ts`
- Delete: `src/domain/smoke.test.ts`

**Interfaces:**
- Produces:
  - `type Field`, `FIELDS: Field[]`, `FIELD_LABEL`, `type Choice = 0|1|2|3`, `type Question`, `type QuestionSet`, `type Attempt`, `type ExamResult`, `type Progress`, `type SessionConfig`, `type SessionMode`
  - `mulberry32(seed: number): () => number`
  - `shuffle<T>(items: T[], rand: () => number): T[]`（元配列を変更しない）

- [ ] **Step 1: types.ts を書く**

```ts
export type Field = "strategy" | "management" | "technology";

export const FIELDS: Field[] = ["strategy", "management", "technology"];

export const FIELD_LABEL: Record<Field, string> = {
  strategy: "ストラテジ系",
  management: "マネジメント系",
  technology: "テクノロジ系",
};

export type Choice = 0 | 1 | 2 | 3;

export const CHOICE_LABEL = ["ア", "イ", "ウ", "エ"] as const;

export type Question = {
  id: string;
  exam: string;
  examCode: string;
  number: number;
  field: Field;
  text: string;
  image?: string;
  choices: [string, string, string, string];
  answerIndex: Choice;
};

export type QuestionSet = {
  version: 1;
  questions: Question[];
};

export type Attempt = {
  correct: number;
  wrong: number;
  lastAnsweredAt: string;
  lastCorrect: boolean;
};

export type FieldStat = { total: number; correct: number };

export type ExamResult = {
  finishedAt: string;
  score: number;
  byField: Record<Field, FieldStat>;
};

export type Progress = {
  version: 1;
  attempts: Record<string, Attempt>;
  examResults: ExamResult[];
};

export type SessionMode = "drill" | "review" | "exam";

export type SessionConfig = {
  mode: SessionMode;
  questions: Question[];
  instantFeedback: boolean;
  timeLimitSec?: number;
};
```

- [ ] **Step 2: 失敗するテストを書く**

`src/domain/random.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mulberry32, shuffle } from "./random";

describe("mulberry32", () => {
  test("同じ seed なら同じ列", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("0 以上 1 未満", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  test("元配列を変更せず、要素を保つ", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, mulberry32(1));
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("同じ seed なら同じ順", () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(src, mulberry32(3))).toEqual(shuffle(src, mulberry32(3)));
  });

  test("seed が違えば順が変わる", () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(src, mulberry32(3))).not.toEqual(shuffle(src, mulberry32(4)));
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./random"`

- [ ] **Step 4: random.ts を書く**

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 5: 成功を確認**

Run: `rm src/domain/smoke.test.ts && npm test`
Expected: `5 passed`

- [ ] **Step 6: Commit & push**

```bash
git add -A
git commit -m "feat(domain): 型定義と seed 付き乱数を追加"
git push
```

---

### Task 3: 出題リスト生成（quiz.ts）

**Files:**
- Create: `src/domain/quiz.ts`, `src/domain/quiz.test.ts`, `src/domain/testUtils.ts`

**Interfaces:**
- Consumes: `types.ts`, `random.ts`
- Produces:
  - `type DrillOptions = { fields: Field[]; examCodes: string[]; count: number; order: "random" | "number"; seed: number }`
  - `filterQuestions(all, fields, examCodes): Question[]`
  - `buildDrill(all, opts): Question[]`
  - `buildReview(all, progress, seed): Question[]`
  - `buildExam(all, seed): Question[]`
  - `EXAM_QUOTA`, `EXAM_SIZE = 100`, `EXAM_TIME_LIMIT_SEC = 7200`
  - テスト用 `makeQuestion(overrides)` (`testUtils.ts`)

- [ ] **Step 1: テスト用ファクトリ**

`src/domain/testUtils.ts`:

```ts
import type { Field, Question } from "./types";

let seq = 0;

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  seq++;
  const number = overrides.number ?? seq;
  const examCode = overrides.examCode ?? "r08";
  return {
    id: `${examCode}-${String(number).padStart(3, "0")}`,
    exam: "令和8年度",
    examCode,
    number,
    field: "strategy",
    text: `問${number}`,
    choices: ["ア", "イ", "ウ", "エ"],
    answerIndex: 0,
    ...overrides,
  };
}

export function makeQuestions(count: number, field: Field, examCode = "r08"): Question[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion({ number: i + 1, field, examCode }),
  );
}
```

- [ ] **Step 2: 失敗するテストを書く**

`src/domain/quiz.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildDrill, buildExam, buildReview, filterQuestions, EXAM_QUOTA } from "./quiz";
import { makeQuestion, makeQuestions } from "./testUtils";
import type { Progress } from "./types";

describe("filterQuestions", () => {
  test("分野と回次で絞る", () => {
    const all = [
      makeQuestion({ number: 1, field: "strategy", examCode: "r08" }),
      makeQuestion({ number: 2, field: "management", examCode: "r08" }),
      makeQuestion({ number: 3, field: "strategy", examCode: "r07" }),
    ];
    const out = filterQuestions(all, ["strategy"], ["r08"]);
    expect(out.map((q) => q.id)).toEqual(["r08-001"]);
  });
});

describe("buildDrill", () => {
  const all = [
    ...makeQuestions(10, "strategy", "r08"),
    ...makeQuestions(10, "technology", "r07"),
  ];

  test("number 順は回次・問番号順", () => {
    const out = buildDrill(all, {
      fields: ["strategy", "technology"],
      examCodes: ["r07", "r08"],
      count: 0,
      order: "number",
      seed: 1,
    });
    expect(out.map((q) => q.id).slice(0, 3)).toEqual(["r07-001", "r07-002", "r07-003"]);
    expect(out).toHaveLength(20);
  });

  test("count で切り詰める", () => {
    const out = buildDrill(all, {
      fields: ["strategy"],
      examCodes: ["r08"],
      count: 3,
      order: "number",
      seed: 1,
    });
    expect(out).toHaveLength(3);
  });

  test("random は seed で再現できる", () => {
    const opts = { fields: ["strategy" as const], examCodes: ["r08"], count: 0, order: "random" as const, seed: 9 };
    expect(buildDrill(all, opts)).toEqual(buildDrill(all, opts));
    expect(buildDrill(all, opts).map((q) => q.id)).not.toEqual(
      buildDrill(all, { ...opts, order: "number" }).map((q) => q.id),
    );
  });
});

describe("buildReview", () => {
  test("直近が不正解の問題だけ", () => {
    const all = makeQuestions(4, "strategy");
    const progress: Progress = {
      version: 1,
      attempts: {
        "r08-001": { correct: 0, wrong: 1, lastAnsweredAt: "", lastCorrect: false },
        "r08-002": { correct: 1, wrong: 1, lastAnsweredAt: "", lastCorrect: true },
        "r08-003": { correct: 0, wrong: 2, lastAnsweredAt: "", lastCorrect: false },
      },
      examResults: [],
    };
    const ids = buildReview(all, progress, 1).map((q) => q.id).sort();
    expect(ids).toEqual(["r08-001", "r08-003"]);
  });
});

describe("buildExam", () => {
  test("分野比率どおり 100 問、分野順に並ぶ", () => {
    const all = [
      ...makeQuestions(50, "strategy", "r08"),
      ...makeQuestions(50, "management", "r07"),
      ...makeQuestions(60, "technology", "r06"),
    ];
    const out = buildExam(all, 1);
    expect(out).toHaveLength(100);
    const count = (f: string) => out.filter((q) => q.field === f).length;
    expect(count("strategy")).toBe(EXAM_QUOTA.strategy);
    expect(count("management")).toBe(EXAM_QUOTA.management);
    expect(count("technology")).toBe(EXAM_QUOTA.technology);
    const fields = out.map((q) => q.field);
    expect(fields.indexOf("management")).toBeGreaterThan(fields.lastIndexOf("strategy"));
    expect(fields.indexOf("technology")).toBeGreaterThan(fields.lastIndexOf("management"));
    expect(new Set(out.map((q) => q.id)).size).toBe(100);
  });

  test("在庫不足の分野は他分野で補充する", () => {
    const all = [
      ...makeQuestions(10, "strategy", "r08"),
      ...makeQuestions(100, "management", "r07"),
      ...makeQuestions(100, "technology", "r06"),
    ];
    const out = buildExam(all, 1);
    expect(out).toHaveLength(100);
    expect(out.filter((q) => q.field === "strategy")).toHaveLength(10);
  });

  test("全体が 100 問未満ならあるだけ", () => {
    const out = buildExam(makeQuestions(30, "technology"), 1);
    expect(out).toHaveLength(30);
  });

  test("seed で再現できる", () => {
    const all = makeQuestions(120, "technology");
    expect(buildExam(all, 5)).toEqual(buildExam(all, 5));
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./quiz"`

- [ ] **Step 4: quiz.ts を書く**

```ts
import type { Field, Progress, Question } from "./types";
import { FIELDS } from "./types";
import { mulberry32, shuffle } from "./random";

export type DrillOptions = {
  fields: Field[];
  examCodes: string[];
  count: number; // 0 なら全問
  order: "random" | "number";
  seed: number;
};

export const EXAM_QUOTA: Record<Field, number> = {
  strategy: 35,
  management: 20,
  technology: 45,
};
export const EXAM_SIZE = 100;
export const EXAM_TIME_LIMIT_SEC = 7200;

export function filterQuestions(all: Question[], fields: Field[], examCodes: string[]): Question[] {
  return all.filter((q) => fields.includes(q.field) && examCodes.includes(q.examCode));
}

export function buildDrill(all: Question[], opts: DrillOptions): Question[] {
  const pool = filterQuestions(all, opts.fields, opts.examCodes);
  const ordered =
    opts.order === "random"
      ? shuffle(pool, mulberry32(opts.seed))
      : pool.slice().sort(byExamAndNumber);
  return opts.count > 0 ? ordered.slice(0, opts.count) : ordered;
}

export function buildReview(all: Question[], progress: Progress, seed: number): Question[] {
  const wrong = all.filter((q) => progress.attempts[q.id]?.lastCorrect === false);
  return shuffle(wrong, mulberry32(seed));
}

export function buildExam(all: Question[], seed: number): Question[] {
  const rand = mulberry32(seed);
  const picked: Question[] = [];
  const pickedIds = new Set<string>();
  for (const field of FIELDS) {
    const pool = shuffle(all.filter((q) => q.field === field), rand).slice(0, EXAM_QUOTA[field]);
    for (const q of pool) {
      picked.push(q);
      pickedIds.add(q.id);
    }
  }
  const deficit = EXAM_SIZE - picked.length;
  if (deficit > 0) {
    const rest = shuffle(all.filter((q) => !pickedIds.has(q.id)), rand).slice(0, deficit);
    picked.push(...rest);
  }
  // Array.prototype.sort は安定なので、分野内はシャッフル順が保たれる
  return picked.slice().sort((a, b) => FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
}

function byExamAndNumber(a: Question, b: Question): number {
  return a.examCode.localeCompare(b.examCode) || a.number - b.number;
}
```

- [ ] **Step 5: 成功を確認**

Run: `npm test`
Expected: すべて PASS（14 tests）

- [ ] **Step 6: Commit & push**

```bash
git add -A
git commit -m "feat(domain): ドリル・復習・模試の出題リスト生成を追加"
git push
```

---

### Task 4: 採点（grading.ts）

**Files:**
- Create: `src/domain/grading.ts`, `src/domain/grading.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces:
  - `type AnswerMap = Record<string, Choice | null>`
  - `type GradeResult = { score: number; total: number; byField: Record<Field, FieldStat>; wrong: Question[] }`
  - `isCorrect(q, selected): boolean`
  - `grade(questions, answers): GradeResult`
  - `emptyFieldStats(): Record<Field, FieldStat>`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/grading.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { grade, isCorrect } from "./grading";
import { makeQuestion } from "./testUtils";

describe("isCorrect", () => {
  test("一致すれば正解", () => {
    const q = makeQuestion({ answerIndex: 2 });
    expect(isCorrect(q, 2)).toBe(true);
    expect(isCorrect(q, 1)).toBe(false);
    expect(isCorrect(q, null)).toBe(false);
  });
});

describe("grade", () => {
  test("正解数・分野別・不正解一覧", () => {
    const qs = [
      makeQuestion({ number: 1, field: "strategy", answerIndex: 0 }),
      makeQuestion({ number: 2, field: "strategy", answerIndex: 1 }),
      makeQuestion({ number: 3, field: "technology", answerIndex: 3 }),
      makeQuestion({ number: 4, field: "management", answerIndex: 2 }),
    ];
    const result = grade(qs, { "r08-001": 0, "r08-002": 3, "r08-003": 3 });
    expect(result.score).toBe(2);
    expect(result.total).toBe(4);
    expect(result.byField.strategy).toEqual({ total: 2, correct: 1 });
    expect(result.byField.technology).toEqual({ total: 1, correct: 1 });
    expect(result.byField.management).toEqual({ total: 1, correct: 0 });
    expect(result.wrong.map((q) => q.id)).toEqual(["r08-002", "r08-004"]);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./grading"`

- [ ] **Step 3: grading.ts を書く**

```ts
import type { Choice, Field, FieldStat, Question } from "./types";

export type AnswerMap = Record<string, Choice | null>;

export type GradeResult = {
  score: number;
  total: number;
  byField: Record<Field, FieldStat>;
  wrong: Question[];
};

export function emptyFieldStats(): Record<Field, FieldStat> {
  return {
    strategy: { total: 0, correct: 0 },
    management: { total: 0, correct: 0 },
    technology: { total: 0, correct: 0 },
  };
}

export function isCorrect(q: Question, selected: Choice | null): boolean {
  return selected !== null && selected === q.answerIndex;
}

export function grade(questions: Question[], answers: AnswerMap): GradeResult {
  const byField = emptyFieldStats();
  const wrong: Question[] = [];
  let score = 0;
  for (const q of questions) {
    byField[q.field].total++;
    if (isCorrect(q, answers[q.id] ?? null)) {
      byField[q.field].correct++;
      score++;
    } else {
      wrong.push(q);
    }
  }
  return { score, total: questions.length, byField, wrong };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 5: Commit & push**

```bash
git add -A
git commit -m "feat(domain): 採点と分野別集計を追加"
git push
```

---

### Task 5: 学習記録（progress.ts）

**Files:**
- Create: `src/domain/progress.ts`, `src/domain/progress.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces:
  - `PROGRESS_KEY = "it-passport/v1/progress"`
  - `type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `type LoadStatus = "empty" | "ok" | "incompatible"`
  - `emptyProgress(): Progress`
  - `loadProgress(storage): { progress: Progress; status: LoadStatus }`
  - `saveProgress(storage, progress): void`
  - `recordAnswer(progress, questionId, correct, now): Progress`（元を変更しない）
  - `recordExam(progress, result): Progress`
  - `summarize(progress): { answered: number; correct: number; wrong: number; accuracy: number | null; lastExam: ExamResult | null }`
  - `memoryStorage(): StorageLike`
  - `detectStorage(): { storage: StorageLike; persistent: boolean }`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/progress.test.ts`:

```ts
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./progress"`

- [ ] **Step 3: progress.ts を書く**

```ts
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
    if (data.version !== 1 || typeof data.attempts !== "object" || !Array.isArray(data.examResults)) {
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
```

- [ ] **Step 4: 成功を確認**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 5: Commit & push**

```bash
git add -A
git commit -m "feat(domain): 学習記録の読み書きを追加"
git push
```

---

### Task 6: 問題データの取得（questions.ts）

**Files:**
- Create: `src/domain/questions.ts`, `src/domain/questions.test.ts`

**Interfaces:**
- Produces: `loadQuestions(url: string, fetchFn?: typeof fetch): Promise<Question[]>`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/questions.test.ts`:

```ts
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./questions"`

- [ ] **Step 3: questions.ts を書く**

```ts
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
```

- [ ] **Step 4: 成功を確認**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 5: Commit & push**

```bash
git add -A
git commit -m "feat(domain): questions.json の取得と検証を追加"
git push
```

---

### Task 7: 取り込みツール①（回次定義・ページ画像化・解答抽出）

**Files:**
- Create: `tools/import/exams.json`, `tools/import/render.sh`, `tools/import/lib/answers.mjs`, `tools/import/lib/answers.test.mjs`, `tools/import/parse-answers.mjs`, `tools/import/answers/r08.json`, `tools/import/answers/r07.json`, `tools/import/answers/r06.json`

**Interfaces:**
- Produces:
  - `exams.json`: `[{ code, name, qsPdf, ansPdf, fieldRanges: { strategy: [from, to], management: [..], technology: [..] } }]`
  - `parseAnswerText(text: string): Record<string, number>`（`"1" → 0..3`）
  - `answers/<code>.json`: `{ "1": 0, "2": 0, ..., "100": 2 }`

- [ ] **Step 1: PDF を raw/ に置く**

```bash
mkdir -p tools/import/raw
cd tools/import/raw
for f in 2026r08_ip_qs 2026r08_ip_ans 2025r07_ip_qs 2025r07_ip_ans 2024r06_ip_qs 2024r06_ip_ans; do
  curl -sS -L -o $f.pdf "https://www3.jitec.ipa.go.jp/JitesCbt/html/openinfo/pdf/questions/$f.pdf"
done
ls -la
cd /home/user/it-passport
```

Expected: 6 ファイル。`_qs.pdf` は 6〜7MB、`_ans.pdf` は 60〜110KB

- [ ] **Step 2: exams.json（分野範囲は仮。Step 5 で確認して確定）**

```json
[
  {
    "code": "r08",
    "name": "令和8年度",
    "qsPdf": "2026r08_ip_qs.pdf",
    "ansPdf": "2026r08_ip_ans.pdf",
    "fieldRanges": { "strategy": [1, 34], "management": [35, 54], "technology": [55, 100] }
  },
  {
    "code": "r07",
    "name": "令和7年度",
    "qsPdf": "2025r07_ip_qs.pdf",
    "ansPdf": "2025r07_ip_ans.pdf",
    "fieldRanges": { "strategy": [1, 34], "management": [35, 54], "technology": [55, 100] }
  },
  {
    "code": "r06",
    "name": "令和6年度",
    "qsPdf": "2024r06_ip_qs.pdf",
    "ansPdf": "2024r06_ip_ans.pdf",
    "fieldRanges": { "strategy": [1, 34], "management": [35, 54], "technology": [55, 100] }
  }
]
```

- [ ] **Step 3: render.sh**

```bash
#!/usr/bin/env bash
# 問題 PDF を 200dpi の PNG に分割する。usage: tools/import/render.sh [code...]
set -euo pipefail
cd "$(dirname "$0")"
codes=("$@")
if [ ${#codes[@]} -eq 0 ]; then
  codes=($(node -e 'console.log(require("./exams.json").map(e=>e.code).join(" "))'))
fi
for code in "${codes[@]}"; do
  pdf=$(node -e "console.log(require('./exams.json').find(e=>e.code==='$code').qsPdf)")
  mkdir -p "pages/$code"
  pdftoppm -r 200 -png "raw/$pdf" "pages/$code/p"
  echo "$code: $(ls pages/$code | wc -l) pages"
done
```

`chmod +x tools/import/render.sh` を忘れずに。

- [ ] **Step 4: 実行して分野範囲を確認**

Run: `tools/import/render.sh`
Expected: `r08: 56 pages` / `r07: 54 pages` / `r06: 52 pages`

各回次の `pages/<code>/p-02.png`（表紙の次のページ）を Read で見て、「問Xから問Yまでは，○○系の問題です」の記述を確認し、`exams.json` の `fieldRanges` を実際の値に直す。（令和8年度は 1–34 / 35–54 / 55–100 と確認済み）

- [ ] **Step 5: 解答パーサの失敗するテスト**

`tools/import/lib/answers.test.mjs`:

```js
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
```

- [ ] **Step 6: 失敗を確認**

Run: `npm test -- tools`
Expected: FAIL — `Failed to load url ./answers.mjs`

- [ ] **Step 7: lib/answers.mjs**

```js
const LABELS = ["ア", "イ", "ウ", "エ"];

/** pdftotext -layout の出力から { 問番号: answerIndex } を作る */
export function parseAnswerText(text) {
  const out = {};
  const re = /問\s*(\d{1,3})\s+([アイウエ])/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n in out) throw new Error(`問${n} が重複しています`);
    out[n] = LABELS.indexOf(m[2]);
  }
  return out;
}
```

- [ ] **Step 8: 成功を確認**

Run: `npm test -- tools`
Expected: `2 passed`

- [ ] **Step 9: CLI parse-answers.mjs**

```js
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnswerText } from "./lib/answers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(join(here, "answers"), { recursive: true });

for (const exam of exams) {
  if (only.length && !only.includes(exam.code)) continue;
  const text = execFileSync("pdftotext", ["-layout", join(here, "raw", exam.ansPdf), "-"], { encoding: "utf8" });
  const answers = parseAnswerText(text);
  const n = Object.keys(answers).length;
  if (n !== 100) throw new Error(`${exam.code}: 解答が ${n} 問しか読めませんでした`);
  writeFileSync(join(here, "answers", `${exam.code}.json`), JSON.stringify(answers, null, 2) + "\n");
  console.log(`${exam.code}: 100 answers`);
}
```

- [ ] **Step 10: 実行**

Run: `npm run import:answers`
Expected: `r08: 100 answers` / `r07: 100 answers` / `r06: 100 answers`。`tools/import/answers/*.json` が 3 つできる。

`answers/r08.json` の `"1": 0, "2": 0, "3": 2, "100": 2` を確認（解答 PDF: 問1 ア, 問2 ア, 問3 ウ, 問100 ウ）。

- [ ] **Step 11: Commit & push**

```bash
git add tools/import
git commit -m "feat(import): 回次定義・ページ画像化・解答抽出を追加"
git push
```

---

### Task 8: 取り込みツール②（build / crop / README）

**Files:**
- Create: `tools/import/lib/build.mjs`, `tools/import/lib/build.test.mjs`, `tools/import/build.mjs`, `tools/import/crop.mjs`, `tools/import/overrides.json`, `tools/import/README.md`

**Interfaces:**
- Consumes: `exams.json`, `answers/<code>.json`, `transcripts/<code>/page-NN.json`
- Produces:
  - `assembleQuestions({ exam, transcripts, answers, imageExists }): { questions: Question[]; warnings: string[] }`（検証失敗は throw）
  - `public/data/questions.json` = `{ version: 1, questions: [...] }`
  - `overrides.json`: `[{ "id": "r08-003", "page": 3, "x": 0, "y": 620, "w": 1432, "h": 240 }]`（200dpi ピクセル）
  - `public/data/images/<id>.png`

- [ ] **Step 1: 失敗するテスト**

`tools/import/lib/build.test.mjs`:

```js
import { describe, expect, test } from "vitest";
import { assembleQuestions } from "./build.mjs";

const exam = {
  code: "r08",
  name: "令和8年度",
  fieldRanges: { strategy: [1, 1], management: [2, 2], technology: [3, 3] },
};

function tq(number, extra = {}) {
  return { number, text: `本文${number}`, choices: ["a", "b", "c", "d"], hasFigure: false, ...extra };
}

describe("assembleQuestions", () => {
  test("transcript と answers を突き合わせて Question を作る", () => {
    const { questions, warnings } = assembleQuestions({
      exam,
      transcripts: [{ page: 3, questions: [tq(1), tq(2)] }, { page: 4, questions: [tq(3, { hasFigure: true })] }],
      answers: { 1: 0, 2: 3, 3: 1 },
      imageExists: (id) => id === "r08-003",
      expectedCount: 3,
    });
    expect(warnings).toEqual([]);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toEqual({
      id: "r08-001",
      exam: "令和8年度",
      examCode: "r08",
      number: 1,
      field: "strategy",
      text: "本文1",
      choices: ["a", "b", "c", "d"],
      answerIndex: 0,
    });
    expect(questions[1].field).toBe("management");
    expect(questions[2]).toMatchObject({ field: "technology", image: "images/r08-003.png" });
  });

  test("欠番があれば例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("問2");
  });

  test("重複があれば例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(1), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("重複");
  });

  test("選択肢が 4 つでなければ例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1, { choices: ["a", "b"] }), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("選択肢");
  });

  test("正解がなければ例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(2), tq(3)] }], answers: { 1: 0, 2: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("正解");
  });

  test("図表問題に画像がなければ例外。allowMissingImages なら警告", () => {
    const args = { exam, transcripts: [{ page: 3, questions: [tq(1, { hasFigure: true }), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => false, expectedCount: 3 };
    expect(() => assembleQuestions(args)).toThrow("画像");
    const { questions, warnings } = assembleQuestions({ ...args, allowMissingImages: true });
    expect(warnings).toHaveLength(1);
    expect(questions[0].image).toBeUndefined();
  });

  test("分野範囲に含まれない問番号は例外", () => {
    expect(() =>
      assembleQuestions({ exam: { ...exam, fieldRanges: { strategy: [1, 2], management: [3, 3], technology: [4, 4] } }, transcripts: [{ page: 3, questions: [tq(1), tq(2), tq(3), tq(4), tq(5)] }], answers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, imageExists: () => true, expectedCount: 5 }),
    ).toThrow("分野");
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- tools`
Expected: FAIL — `Failed to load url ./build.mjs`

- [ ] **Step 3: lib/build.mjs**

```js
const FIELDS = ["strategy", "management", "technology"];

export function questionId(code, number) {
  return `${code}-${String(number).padStart(3, "0")}`;
}

function fieldOf(exam, number) {
  for (const f of FIELDS) {
    const [from, to] = exam.fieldRanges[f];
    if (number >= from && number <= to) return f;
  }
  throw new Error(`${exam.code} 問${number}: 分野範囲に含まれていません`);
}

/**
 * transcript と answers を突き合わせ、検証済みの Question 配列を返す。
 * 検証に失敗したら throw。allowMissingImages のときだけ画像欠落を warnings に落とす。
 */
export function assembleQuestions({ exam, transcripts, answers, imageExists, expectedCount = 100, allowMissingImages = false }) {
  const warnings = [];
  const byNumber = new Map();

  for (const t of transcripts) {
    for (const q of t.questions) {
      if (byNumber.has(q.number)) throw new Error(`${exam.code} 問${q.number}: 重複しています (page ${t.page})`);
      byNumber.set(q.number, { ...q, page: t.page });
    }
  }

  const questions = [];
  for (let n = 1; n <= expectedCount; n++) {
    const q = byNumber.get(n);
    if (!q) throw new Error(`${exam.code} 問${n}: transcript にありません`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || q.choices.some((c) => typeof c !== "string" || c === "")) {
      throw new Error(`${exam.code} 問${n}: 選択肢は 4 つ必要です (page ${q.page})`);
    }
    if (typeof q.text !== "string" || q.text.trim() === "") throw new Error(`${exam.code} 問${n}: 本文が空です`);
    const answerIndex = answers[n];
    if (![0, 1, 2, 3].includes(answerIndex)) throw new Error(`${exam.code} 問${n}: 正解がありません`);

    const id = questionId(exam.code, n);
    const out = {
      id,
      exam: exam.name,
      examCode: exam.code,
      number: n,
      field: fieldOf(exam, n),
      text: q.text,
      choices: q.choices,
      answerIndex,
    };
    if (q.hasFigure) {
      if (imageExists(id)) out.image = `images/${id}.png`;
      else if (allowMissingImages) warnings.push(`${id}: 図表問題ですが画像がありません (page ${q.page})`);
      else throw new Error(`${id}: 図表問題ですが画像がありません (page ${q.page})`);
    }
    questions.push(out);
  }

  if (byNumber.size !== expectedCount) {
    const extra = [...byNumber.keys()].filter((n) => n < 1 || n > expectedCount);
    throw new Error(`${exam.code}: 範囲外の問番号があります: ${extra.join(", ")}`);
  }
  return { questions, warnings };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npm test -- tools`
Expected: すべて PASS（9 tests）

- [ ] **Step 5: CLI build.mjs**

```js
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleQuestions } from "./lib/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const imagesDir = join(root, "public", "data", "images");
const outFile = join(root, "public", "data", "questions.json");

const args = process.argv.slice(2);
const allowMissingImages = args.includes("--allow-missing-images");
const only = args.filter((a) => !a.startsWith("--"));

const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const all = [];
const warnings = [];

for (const exam of exams) {
  if (only.length && !only.includes(exam.code)) continue;
  const dir = join(here, "transcripts", exam.code);
  if (!existsSync(dir)) {
    console.log(`${exam.code}: transcripts がないのでスキップ`);
    continue;
  }
  const transcripts = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const answers = JSON.parse(readFileSync(join(here, "answers", `${exam.code}.json`), "utf8"));
  const { questions, warnings: w } = assembleQuestions({
    exam,
    transcripts,
    answers,
    imageExists: (id) => existsSync(join(imagesDir, `${id}.png`)),
    allowMissingImages,
  });
  all.push(...questions);
  warnings.push(...w);
  console.log(`${exam.code}: ${questions.length} questions, ${questions.filter((q) => q.image).length} with image`);
}

const ids = new Set(all.map((q) => q.id));
if (ids.size !== all.length) throw new Error("id が重複しています");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ version: 1, questions: all }, null, 1) + "\n");
for (const w of warnings) console.warn(`WARN ${w}`);
console.log(`wrote ${outFile} (${all.length} questions)`);
```

- [ ] **Step 6: crop.mjs と overrides.json**

`tools/import/overrides.json`（最初は空配列）:

```json
[]
```

`tools/import/crop.mjs`:

```js
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const imagesDir = join(root, "public", "data", "images");
mkdirSync(imagesDir, { recursive: true });

const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const overrides = JSON.parse(readFileSync(join(here, "overrides.json"), "utf8"));
const only = process.argv.slice(2);

for (const o of overrides) {
  if (only.length && !only.includes(o.id)) continue;
  const code = o.id.split("-")[0];
  const exam = exams.find((e) => e.code === code);
  if (!exam) throw new Error(`${o.id}: exams.json に ${code} がありません`);
  const prefix = join(imagesDir, `tmp-${o.id}`);
  // pdftoppm は 200dpi のピクセル座標で切り出せる（pages/ の PNG と同じ座標系）
  execFileSync("pdftoppm", [
    "-r", "200", "-png",
    "-f", String(o.page), "-l", String(o.page),
    "-x", String(o.x), "-y", String(o.y), "-W", String(o.w), "-H", String(o.h),
    "-singlefile",
    join(here, "raw", exam.qsPdf), prefix,
  ]);
  renameSync(`${prefix}.png`, join(imagesDir, `${o.id}.png`));
  console.log(`${o.id}: page ${o.page} (${o.x},${o.y}) ${o.w}x${o.h}`);
}
```

- [ ] **Step 7: README.md**

`tools/import/README.md`:

````markdown
# 過去問の取り込み手順

IPA の問題 PDF は全ページが画像なので、本文の書き起こしは Claude Code がページ画像を読んで行う。

## 手順

1. `raw/` に IPA の問題 PDF・解答 PDF を置く（`exams.json` の `qsPdf` / `ansPdf`）
2. `tools/import/render.sh r08` — `pages/r08/p-NN.png` を生成（200dpi）
3. `npm run import:answers` — `answers/r08.json` を生成
4. `pages/r08/p-NN.png` を 1 枚ずつ Read し、`transcripts/r08/page-NN.json` を書く（下記形式）
5. `hasFigure: true` の問題は `overrides.json` に切り出し範囲を追加し `npm run import:crop`
6. `npm run import:build` — 検証して `public/data/questions.json` を生成
   （画像がまだ無い段階で試すなら `npm run import:build -- --allow-missing-images`）

## transcript の形式（`transcripts/<code>/page-NN.json`）

```json
{
  "page": 3,
  "questions": [
    {
      "number": 3,
      "text": "投資会社であるA社が，それぞれの投資戦略を採る場合の利益は，表のように予想される。…",
      "choices": ["−15", "0", "5", "20"],
      "hasFigure": true,
      "figureNote": "表：投資戦略a/b × 市況好転/悪化"
    }
  ]
}
```

- `page` は PNG のページ番号（`p-03.png` → 3）
- 本文・選択肢は原文どおり。句読点「，」「。」もそのまま。改行は段落単位で `\n`
- 1 問がページをまたぐ場合は、始まるページの JSON にまとめて書く
- 表・図・プログラム片など本文にテキストで写せないものは `hasFigure: true` にし、本文には写さない。`figureNote` に内容の要約を書く（切り出し範囲を決めるときの手掛かり）
- 問題が無いページ（表紙・注意書き・白紙）は `{"page": N, "questions": []}` を書く

## overrides.json（図表の切り出し）

```json
[{ "id": "r08-003", "page": 3, "x": 0, "y": 620, "w": 1432, "h": 240 }]
```

座標は 200dpi のピクセル（ページ画像は 1432×2026）。`pages/` の PNG を見て決める。
````

- [ ] **Step 8: 検証（transcripts が無い状態）**

Run: `npm run import:build`
Expected: 3 回次とも `transcripts がないのでスキップ`、`wrote ... (0 questions)`

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 9: Commit & push**

```bash
git add tools/import public/data
git commit -m "feat(import): transcript の組み立て・検証と図表切り出しを追加"
git push
```

---

### Task 9: 令和8年度の書き起こし（transcripts/r08）

**Files:**
- Create: `tools/import/transcripts/r08/page-01.json` … `page-56.json`

**Interfaces:**
- Consumes: `tools/import/pages/r08/p-NN.png`（Task 7）、README の transcript 形式
- Produces: 100 問分の transcript

これは **Claude がページ画像を読んで JSON を書く** 作業。コードは書かない。

- [ ] **Step 1: 1 ページ目〜2 ページ目（表紙・注意書き）**

`pages/r08/p-01.png`, `p-02.png` を Read。問題が無ければ `{"page": 1, "questions": []}` を書く。

- [ ] **Step 2: 3 ページ目以降を順に書き起こす**

各ページを Read し、`transcripts/r08/page-NN.json` を書く。ルール:

- 本文は原文どおり（「，」「。」も PDF のまま。半角/全角は見えるとおり）
- 選択肢は「ア/イ/ウ/エ」のラベルを除いた本文のみ、ア→エの順で 4 つ
- 表・図・プログラム片・擬似言語の記述部分は `hasFigure: true` にして本文に写さない。`figureNote` に要約
- 選択肢そのものが図や表の場合も `hasFigure: true`。選択肢には見える範囲でテキストを入れ、入れられないときは `"（図）"` のように書く
- 1 問がページをまたぐときは始まるページにまとめる

5〜10 ページ書くごとに `npm run import:build -- r08 --allow-missing-images` を実行して、重複・選択肢数のエラーを早めに検出する（欠番エラーは最後まで出るので無視してよい）。

- [ ] **Step 3: 100 問揃ったことを確認**

Run: `npm run import:build -- r08 --allow-missing-images`
Expected: `r08: 100 questions, 0 with image` と `WARN r08-XXX: 図表問題ですが画像がありません` が図表問題の数だけ出る。エラーで止まらない。

- [ ] **Step 4: Commit & push**

```bash
git add tools/import/transcripts public/data/questions.json
git commit -m "data: 令和8年度 ITパスポート公開問題の書き起こしを追加"
git push
```

---

### Task 10: 令和8年度の図表切り出し

**Files:**
- Modify: `tools/import/overrides.json`
- Create: `public/data/images/r08-*.png`

**Interfaces:**
- Consumes: Task 9 の WARN 一覧（図表問題の id とページ）、`pages/r08/p-NN.png`
- Produces: `public/data/questions.json` に `image` が入った状態

- [ ] **Step 1: 対象一覧を出す**

Run: `npm run import:build -- r08 --allow-missing-images 2>&1 | grep WARN`

- [ ] **Step 2: 1 問ずつ切り出し範囲を決める**

対象のページ PNG を Read し、図表が収まる矩形（200dpi ピクセル、ページは 1432×2026）を決めて `overrides.json` に追加する。左右は余白込みで `x: 100, w: 1232` 程度を基本にし、上下は本文の最終行の下から選択肢の上までを目視で決める。

```json
[
  { "id": "r08-003", "page": 3, "x": 100, "y": 610, "w": 1232, "h": 260 }
]
```

- [ ] **Step 3: 切り出して確認**

Run: `npm run import:crop`
Expected: 対象ごとに `r08-003: page 3 (100,610) 1232x260` のような行

生成された `public/data/images/r08-003.png` を Read で見て、図表が欠けず・余計な本文が入っていないことを確認。ずれていれば `overrides.json` を直して再実行。

- [ ] **Step 4: build が警告なしで通ることを確認**

Run: `npm run import:build -- r08`
Expected: `r08: 100 questions, N with image`。WARN なし、エラーなし。

- [ ] **Step 5: Commit & push**

```bash
git add tools/import/overrides.json public/data
git commit -m "data: 令和8年度の図表画像を追加"
git push
```

---

### Task 11: UI の骨組み（App / Home / Footer / 読み込み・エラー・保存不可バナー）

**Files:**
- Create: `src/ui/styles.css`, `src/ui/format.ts`, `src/ui/format.test.ts`（`src/domain` 外だが vitest の include は `src/**/*.test.ts` なので拾われる）, `src/ui/Footer.tsx`, `src/ui/Home.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `loadQuestions`, `detectStorage`, `loadProgress`, `saveProgress`, `summarize`, `buildReview`
- Produces:
  - `formatSource(q: Question): string` → `出典：令和8年度 ITパスポート試験 公開問題 問3`
  - `formatPercent(ratio: number | null): string` → `"—"` / `"75%"`
  - `formatTime(sec: number): string` → `"119:59"` 形式（分は 2 桁以上そのまま）
  - `App` の `Screen` 型: `{ name: "home" } | { name: "setup" } | { name: "session"; config: SessionConfig } | { name: "result"; config: SessionConfig; result: GradeResult }`
  - `Home` props: `{ summary: ReturnType<typeof summarize>; reviewCount: number; onDrill(): void; onExam(): void; onReview(): void }`

- [ ] **Step 1: format.ts のテスト**

`src/ui/format.test.ts`:

```ts
import { expect, test } from "vitest";
import { formatPercent, formatSource, formatTime } from "./format";
import { makeQuestion } from "../domain/testUtils";

test("formatSource", () => {
  expect(formatSource(makeQuestion({ number: 3 }))).toBe("出典：令和8年度 ITパスポート試験 公開問題 問3");
});

test("formatPercent", () => {
  expect(formatPercent(null)).toBe("—");
  expect(formatPercent(0.754)).toBe("75%");
});

test("formatTime", () => {
  expect(formatTime(7200)).toBe("120:00");
  expect(formatTime(59)).toBe("0:59");
  expect(formatTime(0)).toBe("0:00");
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./format"`

- [ ] **Step 3: format.ts**

```ts
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
```

- [ ] **Step 4: 成功を確認**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 5: styles.css（モバイル優先）**

```css
:root {
  --bg: #f7f7f5;
  --fg: #1f2328;
  --muted: #6b7280;
  --line: #d9d9d4;
  --accent: #2563eb;
  --ok: #15803d;
  --ng: #b91c1c;
  --card: #ffffff;
  color-scheme: light;
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 16px; line-height: 1.6; }
#root { max-width: 720px; margin: 0 auto; padding: 16px; min-height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; }
h1 { font-size: 1.25rem; margin: 0 0 12px; }
h2 { font-size: 1.05rem; margin: 16px 0 8px; }
p { margin: 8px 0; }
button { font: inherit; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 10px 0; }
.stack > * + * { margin-top: 10px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.muted { color: var(--muted); font-size: 0.9rem; }
.banner { background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 8px 12px; font-size: 0.9rem; }

.btn { display: block; width: 100%; padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--fg); text-align: left; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; text-align: center; font-weight: 600; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn.small { width: auto; display: inline-block; padding: 8px 12px; }

.choice { display: flex; gap: 10px; align-items: flex-start; }
.choice .label { flex: 0 0 1.6em; font-weight: 600; }
.choice.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent) inset; }
.choice.correct { border-color: var(--ok); background: #f0fdf4; }
.choice.wrong { border-color: var(--ng); background: #fef2f2; }

.question-text { white-space: pre-wrap; }
.figure { display: block; max-width: 100%; margin: 10px auto; border: 1px solid var(--line); border-radius: 6px; }
.figure-error { padding: 12px; border: 1px dashed var(--line); border-radius: 6px; color: var(--muted); text-align: center; }

.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.timer { font-variant-numeric: tabular-nums; font-weight: 600; }
.timer.urgent { color: var(--ng); }

.feedback { font-weight: 700; margin: 12px 0 4px; }
.feedback.ok { color: var(--ok); }
.feedback.ng { color: var(--ng); }

table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid var(--line); padding: 6px 4px; text-align: left; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }

details summary { cursor: pointer; padding: 6px 0; }
label.check { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); }
select { font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); }

footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.8rem; }
.error { color: var(--ng); }
```

- [ ] **Step 6: Footer.tsx**

```tsx
export function Footer() {
  return (
    <footer>
      <p>
        問題は IPA（独立行政法人情報処理推進機構）公開の ITパスポート試験 過去問題を使用しています。
        問題文・選択肢は改変していません。各問題に出典を表示しています。
      </p>
    </footer>
  );
}
```

- [ ] **Step 7: Home.tsx**

```tsx
import type { summarize } from "../domain/progress";
import { formatPercent } from "./format";

type Props = {
  summary: ReturnType<typeof summarize>;
  reviewCount: number;
  onDrill: () => void;
  onExam: () => void;
  onReview: () => void;
};

export function Home({ summary, reviewCount, onDrill, onExam, onReview }: Props) {
  return (
    <div className="stack">
      <h1>ITパスポート 過去問演習</h1>
      <div className="card">
        <div className="row">
          <span>回答済み <b>{summary.answered}</b> 問</span>
          <span>正答率 <b>{formatPercent(summary.accuracy)}</b></span>
          {summary.lastExam && (
            <span>直近の模試 <b>{summary.lastExam.score}</b> / 100</span>
          )}
        </div>
      </div>
      <button className="btn primary" onClick={onDrill}>ドリル（1問ずつ即採点）</button>
      <button className="btn" onClick={onExam}>模試（100問・120分）</button>
      <button className="btn" onClick={onReview} disabled={reviewCount === 0}>
        復習（間違えた問題 {reviewCount} 問）
      </button>
    </div>
  );
}
```

- [ ] **Step 8: App.tsx（Setup / Session / Result は Task 12 で作るので、ここでは仮の画面にする）**

```tsx
import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { Progress, Question, SessionConfig } from "./domain/types";
import type { GradeResult } from "./domain/grading";
import { loadQuestions } from "./domain/questions";
import { buildReview } from "./domain/quiz";
import {
  detectStorage,
  loadProgress,
  memoryStorage,
  saveProgress,
  summarize,
  type StorageLike,
} from "./domain/progress";
import { Home } from "./ui/Home";
import { Footer } from "./ui/Footer";

export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "session"; config: SessionConfig }
  | { name: "result"; config: SessionConfig; result: GradeResult };

const QUESTIONS_URL = `${import.meta.env.BASE_URL}data/questions.json`;

export function App() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ storage: StorageLike; persistent: boolean } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  // 学習記録の読み込み（初回のみ）
  useEffect(() => {
    const detected = detectStorage();
    const loaded = loadProgress(detected.storage);
    if (loaded.status === "incompatible") {
      const reset = window.confirm(
        "保存されている学習記録の形式が古いため読み込めません。記録を初期化しますか？\n（キャンセルすると、このセッションの記録は保存されません）",
      );
      if (reset) saveProgress(detected.storage, loaded.progress);
      else detected.storage = memoryStorage();
    }
    setStorage(detected);
    setProgress(loaded.progress);
  }, []);

  // 問題データの読み込み
  const reload = () => {
    setLoadError(null);
    setQuestions(null);
    loadQuestions(QUESTIONS_URL)
      .then(setQuestions)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(reload, []);

  // 連続回答で古い progress を上書きしないよう関数型更新にする
  const updateProgress = (update: (prev: Progress) => Progress) => {
    setProgress((prev) => {
      if (!prev) return prev;
      const next = update(prev);
      if (storage) saveProgress(storage.storage, next);
      return next;
    });
  };
  void updateProgress; // Task 12 で Session から使う。それまでの未使用警告よけ

  const summary = useMemo(() => (progress ? summarize(progress) : null), [progress]);
  const reviewCount = useMemo(
    () => (questions && progress ? buildReview(questions, progress, 0).length : 0),
    [questions, progress],
  );

  let body: ReactElement;
  if (loadError) {
    body = (
      <div className="card stack">
        <p className="error">{loadError}</p>
        <button className="btn primary" onClick={reload}>再読み込み</button>
      </div>
    );
  } else if (!questions || !progress || !summary) {
    body = <p className="muted">読み込み中…</p>;
  } else if (screen.name === "home") {
    body = (
      <Home
        summary={summary}
        reviewCount={reviewCount}
        onDrill={() => setScreen({ name: "setup" })}
        onExam={() => window.alert("模試は Task 13 で実装")}
        onReview={() => window.alert("復習は Task 13 で実装")}
      />
    );
  } else {
    body = (
      <div className="stack">
        <p>（Task 12 で実装）</p>
        <button className="btn" onClick={() => setScreen({ name: "home" })}>ホームへ</button>
      </div>
    );
  }

  return (
    <>
      {storage && !storage.persistent && (
        <div className="banner">このブラウザでは学習記録を保存できません。閉じると記録は消えます。</div>
      )}
      <main>{body}</main>
      <Footer />
    </>
  );
}
```

注意: `noUnusedLocals` により `updateProgress` が未使用だとビルドが落ちるため `void updateProgress;` を入れている。Task 12 で消す。

- [ ] **Step 9: main.tsx で CSS を読み込む**

`src/main.tsx` の先頭に追加:

```tsx
import "./ui/styles.css";
```

- [ ] **Step 10: 動作確認**

Run: `npm run build`
Expected: エラーなし

Run: `npm run dev` をバックグラウンドで起動し、`curl -s http://localhost:5173/it-passport/ | head -5` で HTML が返ることを確認。ブラウザで `http://localhost:5173/it-passport/` を開き、ホームに回答済み 0 問・正答率 — が出て、復習ボタンが無効なことを確認する。

- [ ] **Step 11: Commit & push**

```bash
git add -A
git commit -m "feat(ui): ホーム画面・フッター・読み込みエラー処理を追加"
git push
```

---

### Task 12: 出題設定・演習・結果（ドリル）

**Files:**
- Create: `src/ui/Setup.tsx`, `src/ui/Session.tsx`, `src/ui/Result.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `buildDrill`, `grade`, `recordAnswer`, `isCorrect`, `formatSource`, `formatTime`, `CHOICE_LABEL`, `FIELD_LABEL`
- Produces:
  - `Setup` props: `{ questions: Question[]; onStart(config: SessionConfig): void; onBack(): void }`
  - `Session` props: `{ config: SessionConfig; onAnswer(q: Question, choice: Choice): void; onFinish(answers: AnswerMap): void; onQuit(): void }`
  - `Result` props: `{ config: SessionConfig; result: GradeResult; onHome(): void }`

- [ ] **Step 1: Setup.tsx**

```tsx
import { useMemo, useState } from "react";
import type { Field, Question, SessionConfig } from "../domain/types";
import { FIELDS, FIELD_LABEL } from "../domain/types";
import { buildDrill, filterQuestions } from "../domain/quiz";

type Props = {
  questions: Question[];
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
};

const COUNTS = [10, 20, 50, 0] as const;

export function Setup({ questions, onStart, onBack }: Props) {
  const exams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of questions) seen.set(q.examCode, q.exam);
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [questions]);

  const [fields, setFields] = useState<Field[]>(FIELDS);
  const [examCodes, setExamCodes] = useState<string[]>(() => exams.map(([code]) => code));
  const [count, setCount] = useState<number>(10);
  const [order, setOrder] = useState<"random" | "number">("random");

  const available = filterQuestions(questions, fields, examCodes).length;

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = () => {
    const list = buildDrill(questions, { fields, examCodes, count, order, seed: Date.now() });
    onStart({ mode: "drill", questions: list, instantFeedback: true });
  };

  return (
    <div className="stack">
      <h1>出題設定</h1>
      <div className="card">
        <h2>分野</h2>
        <div className="row">
          {FIELDS.map((f) => (
            <label key={f} className="check">
              <input type="checkbox" checked={fields.includes(f)} onChange={() => setFields(toggle(fields, f))} />
              {FIELD_LABEL[f]}
            </label>
          ))}
        </div>
        <h2>回次</h2>
        <div className="row">
          {exams.map(([code, name]) => (
            <label key={code} className="check">
              <input type="checkbox" checked={examCodes.includes(code)} onChange={() => setExamCodes(toggle(examCodes, code))} />
              {name}
            </label>
          ))}
        </div>
        <h2>出題数・順序</h2>
        <div className="row">
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((c) => (
              <option key={c} value={c}>{c === 0 ? "全問" : `${c} 問`}</option>
            ))}
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value as "random" | "number")}>
            <option value="random">ランダム</option>
            <option value="number">番号順</option>
          </select>
        </div>
        <p className="muted">対象 {available} 問</p>
      </div>
      <button className="btn primary" onClick={start} disabled={available === 0}>開始</button>
      <button className="btn" onClick={onBack}>戻る</button>
    </div>
  );
}
```

- [ ] **Step 2: Session.tsx**

```tsx
import { useEffect, useRef, useState } from "react";
import type { Choice, Question, SessionConfig } from "../domain/types";
import { CHOICE_LABEL } from "../domain/types";
import type { AnswerMap } from "../domain/grading";
import { isCorrect } from "../domain/grading";
import { formatSource, formatTime } from "./format";

type Props = {
  config: SessionConfig;
  onAnswer: (q: Question, choice: Choice) => void;
  onFinish: (answers: AnswerMap) => void;
  onQuit: () => void;
};

export function Session({ config, onAnswer, onFinish, onQuit }: Props) {
  const total = config.questions.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(config.timeLimitSec ?? null);
  const [imageError, setImageError] = useState(false);
  const answersRef = useRef<AnswerMap>({});
  const finishedRef = useRef(false);

  const q = config.questions[index];
  const isLast = index === total - 1;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(answersRef.current);
  };

  // タイマー（模試のみ）
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const commit = (choice: Choice) => {
    answersRef.current = { ...answersRef.current, [q.id]: choice };
    onAnswer(q, choice);
  };

  const select = (choice: Choice) => {
    if (revealed) return;
    setSelected(choice);
    if (config.instantFeedback) {
      setRevealed(true);
      commit(choice);
    }
  };

  const next = () => {
    if (!config.instantFeedback && selected !== null && !(q.id in answersRef.current)) commit(selected);
    if (isLast) {
      finish();
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setRevealed(false);
    setImageError(false);
  };

  const quit = () => {
    if (window.confirm("演習を中断してホームに戻りますか？（回答済みの記録は残ります）")) onQuit();
  };

  return (
    <div className="stack">
      <div className="topbar">
        <span>{index + 1} / {total}</span>
        {remaining !== null && (
          <span className={`timer${remaining < 300 ? " urgent" : ""}`}>残り {formatTime(remaining)}</span>
        )}
        <button className="btn small" onClick={quit}>中断</button>
      </div>

      <div className="card">
        <p className="question-text"><b>問{q.number}</b>　{q.text}</p>
        {q.image && !imageError && (
          <img className="figure" src={`${import.meta.env.BASE_URL}data/${q.image}`} alt="問題の図表" onError={() => setImageError(true)} />
        )}
        {q.image && imageError && <div className="figure-error">画像を読み込めません</div>}
        <p className="muted">{formatSource(q)}</p>
      </div>

      <div className="stack">
        {q.choices.map((text, i) => {
          const c = i as Choice;
          let cls = "btn choice";
          if (revealed) {
            if (c === q.answerIndex) cls += " correct";
            else if (c === selected) cls += " wrong";
          } else if (c === selected) cls += " selected";
          return (
            <button key={i} className={cls} onClick={() => select(c)} disabled={revealed}>
              <span className="label">{CHOICE_LABEL[i]}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>

      {revealed && selected !== null && (
        <p className={`feedback ${isCorrect(q, selected) ? "ok" : "ng"}`}>
          {isCorrect(q, selected) ? "正解！" : `不正解… 正解は ${CHOICE_LABEL[q.answerIndex]}`}
        </p>
      )}

      {(revealed || !config.instantFeedback) && (
        <button className="btn primary" onClick={next}>
          {isLast ? (config.instantFeedback ? "結果を見る" : "採点する") : "次へ"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Result.tsx**

```tsx
import type { SessionConfig } from "../domain/types";
import { CHOICE_LABEL, FIELDS, FIELD_LABEL } from "../domain/types";
import type { GradeResult } from "../domain/grading";
import { formatPercent, formatSource } from "./format";

type Props = {
  config: SessionConfig;
  result: GradeResult;
  onHome: () => void;
};

const TITLE = { drill: "ドリル結果", review: "復習結果", exam: "模試結果" } as const;

export function Result({ config, result, onHome }: Props) {
  return (
    <div className="stack">
      <h1>{TITLE[config.mode]}</h1>
      <div className="card">
        <p style={{ fontSize: "1.6rem", margin: 0 }}>
          <b>{result.score}</b> / {result.total}
          <span className="muted">（{formatPercent(result.total ? result.score / result.total : null)}）</span>
        </p>
        <table>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f}>
                <td>{FIELD_LABEL[f]}</td>
                <td className="num">{result.byField[f].correct} / {result.byField[f].total}</td>
                <td className="num">
                  {formatPercent(result.byField[f].total ? result.byField[f].correct / result.byField[f].total : null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>間違えた問題（{result.wrong.length}）</h2>
      {result.wrong.map((q) => (
        <details key={q.id} className="card">
          <summary>{q.exam} 問{q.number}　正解: {CHOICE_LABEL[q.answerIndex]}</summary>
          <p className="question-text">{q.text}</p>
          {q.image && <img className="figure" src={`${import.meta.env.BASE_URL}data/${q.image}`} alt="問題の図表" />}
          <ol className="stack" style={{ listStyle: "none", padding: 0 }}>
            {q.choices.map((c, i) => (
              <li key={i} className={i === q.answerIndex ? "choice correct card" : "choice card"}>
                <span className="label">{CHOICE_LABEL[i]}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          <p className="muted">{formatSource(q)}</p>
        </details>
      ))}

      <button className="btn primary" onClick={onHome}>ホームへ</button>
    </div>
  );
}
```

- [ ] **Step 4: App.tsx に画面を接続**

App.tsx の import に追加:

```tsx
import type { AnswerMap } from "./domain/grading";
import { grade, isCorrect } from "./domain/grading";
import { recordAnswer } from "./domain/progress";
import type { Choice } from "./domain/types";
import { Setup } from "./ui/Setup";
import { Session } from "./ui/Session";
import { Result } from "./ui/Result";
```

`void updateProgress;` の行を削除し、その位置にハンドラを追加:

```tsx
  const handleAnswer = (q: Question, choice: Choice) => {
    updateProgress((prev) => recordAnswer(prev, q.id, isCorrect(q, choice), new Date().toISOString()));
  };

  const handleFinish = (config: SessionConfig, answers: AnswerMap) => {
    const result = grade(config.questions, answers);
    setScreen({ name: "result", config, result });
  };
```

`body` の分岐を差し替え:

```tsx
  } else if (screen.name === "home") {
    body = (
      <Home
        summary={summary}
        reviewCount={reviewCount}
        onDrill={() => setScreen({ name: "setup" })}
        onExam={() => window.alert("模試は Task 13 で実装")}
        onReview={() => window.alert("復習は Task 13 で実装")}
      />
    );
  } else if (screen.name === "setup") {
    body = (
      <Setup
        questions={questions}
        onStart={(config) => setScreen({ name: "session", config })}
        onBack={() => setScreen({ name: "home" })}
      />
    );
  } else if (screen.name === "session") {
    body = (
      <Session
        key={screen.config.questions.map((q) => q.id).join(",")}
        config={screen.config}
        onAnswer={handleAnswer}
        onFinish={(answers) => handleFinish(screen.config, answers)}
        onQuit={() => setScreen({ name: "home" })}
      />
    );
  } else {
    body = <Result config={screen.config} result={screen.result} onHome={() => setScreen({ name: "home" })} />;
  }
```

- [ ] **Step 5: 動作確認**

Run: `npm run build && npm test`
Expected: エラーなし、テストすべて PASS

ブラウザ（`npm run dev`）で確認:
1. ホーム → ドリル → 分野・回次を選び 10 問で開始
2. 選択肢をタップすると正誤と正解が出て、「次へ」で進む
3. 10 問目で「結果を見る」→ スコアと分野別、間違えた問題が展開できる
4. ホームに戻ると回答済み数と正答率が更新されている。リロードしても残る
5. 図表問題（`image` あり）で画像が表示される
6. DevTools の Application → Local Storage に `it-passport/v1/progress` がある

- [ ] **Step 6: Commit & push**

```bash
git add -A
git commit -m "feat(ui): 出題設定・演習・結果画面を追加（ドリル）"
git push
```

---

### Task 13: 模試モードと復習モード

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `buildExam`, `buildReview`, `EXAM_TIME_LIMIT_SEC`, `recordExam`

- [ ] **Step 1: App.tsx にモード開始ハンドラを追加**

import に追加:

```tsx
import { buildExam, EXAM_TIME_LIMIT_SEC } from "./domain/quiz";
import { recordExam } from "./domain/progress";
```

（`buildReview` は既に import 済み）

ハンドラ:

```tsx
  const startExam = () => {
    if (!questions) return;
    const list = buildExam(questions, Date.now());
    setScreen({
      name: "session",
      config: { mode: "exam", questions: list, instantFeedback: false, timeLimitSec: EXAM_TIME_LIMIT_SEC },
    });
  };

  const startReview = () => {
    if (!questions || !progress) return;
    const list = buildReview(questions, progress, Date.now());
    if (list.length === 0) return;
    setScreen({ name: "session", config: { mode: "review", questions: list, instantFeedback: true } });
  };
```

`handleFinish` を模試対応にする:

```tsx
  const handleFinish = (config: SessionConfig, answers: AnswerMap) => {
    const result = grade(config.questions, answers);
    if (config.mode === "exam") {
      updateProgress((prev) =>
        recordExam(prev, { finishedAt: new Date().toISOString(), score: result.score, byField: result.byField }),
      );
    }
    setScreen({ name: "result", config, result });
  };
```

Home の `onExam={startExam}` / `onReview={startReview}` に差し替え（`window.alert` を削除）。

- [ ] **Step 2: 動作確認**

Run: `npm run build && npm test`
Expected: エラーなし

ブラウザで確認:
1. 模試を開始 → 「残り 120:00」が減っていく。選択しても正誤は出ず「次へ」。未選択でも「次へ」で飛ばせる
2. 100 問目で「採点する」→ 結果画面。ホームに「直近の模試 N / 100」が出る
3. 動作確認を早くするため、一時的に `EXAM_TIME_LIMIT_SEC` を 5 にしてタイムアップで自動採点されることを確認し、7200 に戻す
4. ドリルで何問か間違えたあと、ホームの復習ボタンに件数が出て、押すとその問題だけ出る。正解すると次回の復習から外れる

- [ ] **Step 3: Commit & push**

```bash
git add -A
git commit -m "feat(ui): 模試モードと復習モードを追加"
git push
```

---

### Task 14: 令和7年度・令和6年度の書き起こしと図表

**Files:**
- Create: `tools/import/transcripts/r07/page-NN.json`, `tools/import/transcripts/r06/page-NN.json`, `public/data/images/r07-*.png`, `public/data/images/r06-*.png`
- Modify: `tools/import/overrides.json`, `public/data/questions.json`

**Interfaces:**
- Consumes: Task 9・10 と同じ手順を r07, r06 に適用

- [ ] **Step 1: r07 の書き起こし**

Task 9 の Step 1〜3 を `r07` で行う（`pages/r07/p-NN.png` → `transcripts/r07/page-NN.json`）。
途中確認: `npm run import:build -- r07 --allow-missing-images`
完了条件: `r07: 100 questions` でエラーなし

- [ ] **Step 2: r07 をコミット**

```bash
git add tools/import/transcripts/r07
git commit -m "data: 令和7年度 ITパスポート公開問題の書き起こしを追加"
git push
```

- [ ] **Step 3: r07 の図表切り出し**

Task 10 の Step 1〜4 を `r07` で行う。完了条件: `npm run import:build -- r07` が WARN なし

```bash
git add tools/import/overrides.json public/data
git commit -m "data: 令和7年度の図表画像を追加"
git push
```

- [ ] **Step 4: r06 の書き起こし**

Task 9 の Step 1〜3 を `r06` で行う。完了条件: `r06: 100 questions` でエラーなし

```bash
git add tools/import/transcripts/r06
git commit -m "data: 令和6年度 ITパスポート公開問題の書き起こしを追加"
git push
```

- [ ] **Step 5: r06 の図表切り出し**

Task 10 の Step 1〜4 を `r06` で行う。完了条件: `npm run import:build -- r06` が WARN なし

- [ ] **Step 6: 全体ビルドと確認**

Run: `npm run import:build`
Expected: `r08: 100 questions, ...` / `r07: 100 questions, ...` / `r06: 100 questions, ...` / `wrote ... (300 questions)`。WARN なし

Run: `npm run build && npm test`
Expected: エラーなし

ブラウザで出題設定の回次に 3 つ並び、「全問」で対象 300 問と出ることを確認。

- [ ] **Step 7: Commit & push**

```bash
git add tools/import/overrides.json public/data
git commit -m "data: 令和6年度の図表画像を追加し、3回分 300 問を揃える"
git push
```

---

### Task 15: GitHub Pages デプロイ

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: `https://acropapa330.github.io/it-passport/` で公開

- [ ] **Step 1: リポジトリをパブリックにする（ユーザー確認済みであること）**

無料プランでは GitHub Pages はパブリックリポジトリでのみ使える。ユーザーに確認してから:

```bash
gh repo edit acropapa330/it-passport --visibility public --accept-visibility-change-consequences
```

- [ ] **Step 2: deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Pages のソースを GitHub Actions にする**

```bash
gh api -X POST repos/acropapa330/it-passport/pages -f build_type=workflow
```

（既に有効なら `-X PUT` で `build_type=workflow` に更新）

- [ ] **Step 4: README.md**

```markdown
# ITパスポート 過去問演習

IPA 公開の ITパスポート試験 過去問題（直近3回・300問）をブラウザで演習するアプリ。

公開URL: https://acropapa330.github.io/it-passport/

## 開発

- `npm run dev` — 開発サーバー（http://localhost:5173/it-passport/）
- `npm test` — テスト
- `npm run build` — 本番ビルド（`dist/`）

## 問題データ

`tools/import/README.md` を参照。

## 出典

問題は IPA（独立行政法人情報処理推進機構）公開の ITパスポート試験 過去問題を使用しています。
問題文・選択肢は改変していません。
```

- [ ] **Step 5: Commit & push、デプロイを確認**

```bash
git add -A
git commit -m "chore: GitHub Pages へのデプロイを追加"
git push
gh run watch --exit-status
```

Expected: workflow が成功し、`curl -sI https://acropapa330.github.io/it-passport/ | head -1` が `HTTP/2 200`。
スマホのブラウザで URL を開き、ドリルを 1 周できることを確認。

---

## Self-Review 結果

- **Spec coverage**: ドリル(12) / 絞り込み(12) / 復習(13) / 模試(13) / 進捗表示(11) / localStorage と version(5,11) / 保存不可バナー(11) / 取得失敗(11) / 画像失敗(12) / 出典表示(11,12) / 取り込み・検証(7,8,9,10,14) / テスト(2〜8,11) / デプロイ(15) — 漏れなし
- **Type consistency**: `Choice`, `AnswerMap`, `GradeResult`, `SessionConfig`, `StorageLike`, `summarize` の戻り値を各 Task で同名・同型で参照していることを確認
- **注意点**: Task 11 の `void updateProgress;` は Task 12 で必ず消す
