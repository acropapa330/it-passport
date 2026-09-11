# ITパスポート過去問演習アプリ 設計書

作成日: 2026-09-11

## 1. 目的

ブラウザ（主にスマホ）で IPA 公開の ITパスポート過去問を演習するアプリ。
利用者は作者本人。作る過程を Zenn 記事のネタにもする。

## 2. 要件

### 必須機能

| 機能 | 内容 |
|---|---|
| ドリル | 1問ずつ出題。選択肢を選ぶと即採点し、正解記号を表示して次へ進む |
| 絞り込み | 分野（ストラテジ/マネジメント/テクノロジ）・回次・出題数・順序（ランダム/番号順）を指定して出題 |
| 復習 | 直近の回答が不正解だった問題だけを出題する |
| 模試 | 100問・120分。採点は最後にまとめて。分野別正答率を表示する |
| 進捗表示 | ホームに累計正答率・回答済み問題数を表示する |

### 非機能要件

- 静的サイト（GitHub Pages）として配信できること。サーバー不要
- 学習記録はブラウザの localStorage に保存する。端末間同期はしない
- スマホ幅（約 400px）で操作しやすいこと
- 出典表記をフッターに常時表示する

### やらないこと（YAGNI）

- ログイン・複数ユーザー管理
- 解説文（データ構造に後付けできる余地だけ残す）
- 端末間同期
- SEO 対策

## 3. 技術構成

- Vite + React + TypeScript
- テスト: Vitest（`src/domain/` を対象）
- デプロイ: GitHub Pages（`gh-pages` ブランチ or Actions）
- 取り込みスクリプト: Node.js（`tools/import/`）。`pdftotext` / `pdftoppm`（poppler-utils）を利用

### ディレクトリ

```
it-passport/
├─ src/
│  ├─ domain/         純粋ロジック。React に依存しない
│  │   ├─ quiz.ts       出題キュー生成（絞り込み・シャッフル・復習・模試抽出）
│  │   ├─ grading.ts    採点・分野別集計
│  │   └─ progress.ts   学習記録の読み書き（ストレージは注入可能）
│  ├─ ui/             React コンポーネント（画面）
│  └─ main.tsx
├─ public/data/
│  ├─ questions.json  問題データ
│  └─ images/         図表問題の画像
├─ tools/import/      PDF → JSON 変換スクリプト（アプリのビルドには関与しない）
│  └─ raw/            IPA からDLした PDF（git 管理外）
└─ docs/
```

`domain/` は React に依存させない。これにより出題順・採点・進捗を UI なしでテストできる。

## 4. データモデル

### 問題（静的データ `public/data/questions.json`）

```ts
type Field = "strategy" | "management" | "technology";

type Question = {
  id: string;           // 例 "r6-012"（回次コード + 3桁問番号）
  exam: string;         // 例 "令和6年度公開問題"
  examCode: string;     // 例 "r6"（絞り込み用）
  number: number;       // 問番号 1..100
  field: Field;
  text: string;         // 問題文
  image?: string;       // 図表問題のみ。"images/r6-012.png"
  choices: [string, string, string, string];  // ア/イ/ウ/エ の順
  answerIndex: 0 | 1 | 2 | 3;
  // explanation?: string  ← 将来の解説用。現時点では持たない
};

type QuestionSet = {
  version: 1;
  questions: Question[];
};
```

### 学習記録（localStorage キー `it-passport/v1/progress`）

```ts
type Attempt = {
  correct: number;          // 正解回数
  wrong: number;            // 不正解回数
  lastAnsweredAt: string;   // ISO 8601
  lastCorrect: boolean;     // 直近の回答が正解か（復習抽出に使う）
};

type ExamResult = {
  finishedAt: string;
  score: number;            // 正解数（0..100）
  byField: Record<Field, { total: number; correct: number }>;
};

type Progress = {
  version: 1;
  attempts: Record<string, Attempt>;   // Question.id → Attempt
  examResults: ExamResult[];
};
```

`version` が一致しない保存データは、ユーザー確認のうえ初期化する。

## 5. 画面と振る舞い

### 画面一覧

| 画面 | 役割 |
|---|---|
| ホーム | モード選択（ドリル / 模試 / 復習）と進捗サマリ（回答済み数・累計正答率・直近の模試スコア） |
| 出題設定 | 分野・回次（複数選択可）・出題数・順序を指定して「開始」 |
| 演習 | 1問ずつ表示。問題文・画像（あれば）・選択肢4つ。進捗（n / N）を表示 |
| 結果 | スコア、分野別正答率、間違えた問題の一覧。一覧の問題をタップで問題と正解を再表示 |

模試は演習画面を設定違いで使う。復習は出題設定のプリセット。独立画面は作らない。

### セッション設定（ドリル・模試・復習の共通エンジン）

```ts
type SessionConfig = {
  questions: Question[];      // 出題順に並んだリスト
  instantFeedback: boolean;   // true: 回答直後に正誤表示 / false: 最後にまとめて
  timeLimitSec?: number;      // 模試のみ 7200
};
```

| モード | questions | instantFeedback | timeLimitSec |
|---|---|---|---|
| ドリル | 出題設定に従い絞り込み → 順序適用 | true | なし |
| 復習 | `lastCorrect === false` の問題 → ランダム | true | なし |
| 模試 | 全回次から分野比率で100問抽出 → 分野順（ストラテジ→マネジメント→テクノロジ）に整列、分野内はランダム | false | 7200 |

模試の分野比率は本番に合わせ、ストラテジ 35 / マネジメント 20 / テクノロジ 45 とする。
ある分野の在庫が足りない場合は、他分野からランダムに補充して合計100問にする。

### 演習画面の遷移

```
ドリル: 問題表示 → 選択肢タップ → 正誤+正解記号を表示 → 「次へ」 → ... → 結果
模試:   問題表示 → 選択肢タップ → 即「次へ」（正誤は出さない） → ... → 「採点する」 → 結果
        タイマー 0 で自動的に採点へ。未回答は不正解扱い
```

- 回答した瞬間に `progress.attempts` を更新する（模試も同様）。途中離脱しても回答済み分は残る
- 模試の途中離脱時、`examResults` には記録しない（採点まで到達したものだけ記録）
- 演習中はブラウザの「戻る」やリロードで進行中セッションは失われる（セッションの永続化はしない）

### 順序と再現性

シャッフルは seed 付き乱数（例: mulberry32）で行い、テストで順序を固定できるようにする。

## 6. 取り込みパイプライン（`tools/import/`）

### 前提

- IPA の過去問利用条件を公式ページで確認してから着手する。出典表記（試験名・年度・IPA）をアプリのフッターに入れる
- 初回は直近3回分（300問）を対象にする

### 手順

1. IPA から「問題PDF」と「解答PDF」を手動でダウンロードし `tools/import/raw/<examCode>/` に置く（git 管理外）
2. `pdftotext -layout` でテキスト化する
3. 「問N」の見出しで問題ブロックに分割し、各ブロックを「ア/イ/ウ/エ」で本文と選択肢に切り出す
4. 解答PDFから「問番号 → 正解記号」を読み取り `answerIndex` に変換する
5. 分野は問番号の範囲で付与する（公開問題は分野順に並んでいる前提。範囲は回次ごとに設定ファイルで指定する）
6. 図表問題の候補を検出して一覧出力する（本文に「図」「表」を含む、本文または選択肢が極端に短い、など）
7. 候補について `pdftoppm` でページを PNG 化し、**人が**必要範囲を切り出して `public/data/images/<id>.png` に置き、`image` を設定する（設定ファイル `tools/import/overrides.json` に記述）
8. 検証を通過したら `public/data/questions.json` に書き出す

### 検証（失敗したらスクリプトが止まる）

- 各回次で問題が100問揃っている
- 全問に選択肢がちょうど4つある
- 全問に `answerIndex` がある
- `image` を指定した問題のファイルが実在する
- `id` が重複していない

### 手作業の見積もり

図表問題は3回分で十数問を見込む。切り出しは 1 問あたり数分。

## 7. エラー処理

| 状況 | 振る舞い |
|---|---|
| localStorage が使えない（プライベートモード等） | メモリ上で動作を継続し、「記録は保存されません」バナーを表示 |
| 保存データの `version` 不一致 / JSON 破損 | 確認ダイアログのうえ初期化 |
| `questions.json` の取得失敗 | エラー画面と再読込ボタン |
| 画像の読み込み失敗 | 画像枠に「画像を読み込めません」と表示。回答は可能 |

## 8. テスト

Vitest で `src/domain/` を検証する。

- `quiz.ts`: 分野・回次の絞り込み / 出題数の切り詰め / seed による順序の再現性 / 復習抽出（`lastCorrect === false` のみ）/ 模試の分野比率抽出と在庫不足時の補充
- `grading.ts`: 正解数・分野別集計 / 未回答の扱い
- `progress.ts`: 初回読み込み / 回答の加算 / `version` 不一致の検知 / JSON 破損時の扱い（ストレージをモックして注入）

UI は手動で動作確認する（スマホ幅でのレイアウト、タイマー、画面遷移）。

## 9. 工程

1. 取り込みパイプライン（最もリスクが高いため先行）— 1回次分で動かして検証
2. `domain/` + テスト
3. UI（ホーム → 出題設定 → 演習 → 結果 → 模試タイマー）
4. 残り2回次の取り込みと図表画像の手作業
5. GitHub Pages デプロイ

## 10. 出典

問題データは IPA（独立行政法人情報処理推進機構）公開の ITパスポート試験 過去問題を使用する。
アプリのフッターに出典を明記する。
