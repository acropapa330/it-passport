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
- 出典表記をフッターに常時表示し、各問題にも「出典：令和8年度 ITパスポート試験 公開問題 問1」の形式で表示する

### やらないこと（YAGNI）

- ログイン・複数ユーザー管理
- 解説文（データ構造に後付けできる余地だけ残す）
- 端末間同期
- SEO 対策

## 3. 技術構成

- Vite + React + TypeScript
- テスト: Vitest（`src/domain/` を対象）
- デプロイ: GitHub Pages（`gh-pages` ブランチ or Actions）
- 取り込みスクリプト: Node.js（`tools/import/`）。`pdftotext` / `pdftoppm`（poppler-utils）を利用。問題文の書き起こしは Claude Code セッションがページ画像を読んで行う

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
│  ├─ raw/            IPA からDLした PDF（git 管理外）
│  ├─ pages/          PDF をページごとに PNG 化したもの（git 管理外）
│  ├─ transcripts/    Claude が書き起こした問題 JSON（git 管理）
│  └─ answers/        解答 PDF から抽出した正解 JSON（git 管理）
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

- ドリル・復習では選択肢をタップした瞬間に、模試では「次へ」または採点（タイムアップ含む）で確定した時点で `progress.attempts` を更新する。途中離脱しても確定済みの分は残る
- 模試の途中離脱時、`examResults` には記録しない（採点まで到達したものだけ記録）
- 演習中はブラウザの「戻る」やリロードで進行中セッションは失われる（セッションの永続化はしない）

### 順序と再現性

シャッフルは seed 付き乱数（例: mulberry32）で行い、テストで順序を固定できるようにする。

## 6. 取り込みパイプライン（`tools/import/`）

### 前提（2026-09-11 調査済み）

- IPA の問題 PDF は**全ページが画像（200dpi JPEG）でテキストを含まない**。`pdftotext` は使えない
- 解答 PDF はテキスト PDF。`pdftotext -layout` で「問 N  記号」の表として読める
- 問題 PDF の冒頭に「問1から問34までは，ストラテジ系の問題です」のように分野の範囲が明記されている
- 利用条件（IPA FAQ）: 教育目的なら許諾・使用料不要。出典を「出典：令和8年度 ITパスポート試験 公開問題 問1」の形式で明記する。改変した場合はその旨を明記する
- 初回は直近3回分（令和8年度・令和7年度・令和6年度、計300問）を対象にする

### 書き起こしの方法

Tesseract は誤読が多い（100問中「問N」見出しを74問しか検出できない）ため使わない。
**Claude Code セッションがページ画像を直接読み、問題ごとの JSON（transcript）を書く。**
外部 API やキーは使わない。

### 手順

1. IPA から「問題PDF」と「解答PDF」を `tools/import/raw/` にダウンロードする（git 管理外）
2. `pdftoppm -r 200 -png` で問題 PDF を 1 ページ 1 PNG にする（`tools/import/pages/<code>/`、git 管理外）
3. Claude がページ画像を読み、`tools/import/transcripts/<code>/page-NN.json` を書く（git 管理する）。
   1 問がページをまたぐ場合は、問題が始まるページの JSON にまとめて書く
4. 解答 PDF を `pdftotext -layout` → 正規表現で「問番号 → 正解記号」を読み `tools/import/answers/<code>.json` に書く
5. 分野は `tools/import/exams.json` に回次ごとの範囲を書き、問番号で付与する（範囲は PDF 冒頭の記述を目視で確認して転記する）
6. transcript で `hasFigure: true` の問題は、`tools/import/overrides.json` に切り出し範囲（ページ・上端・高さ）を書き、
   `pdftoppm -x -y -W -H` で `public/data/images/<id>.png` を切り出す。範囲は Claude がページ画像を見て決め、切り出し結果を目視確認する
7. `tools/import/build.mjs` が transcript + answers + exams.json + 画像の有無を突き合わせ、検証を通過したら `public/data/questions.json` を書く

### transcript の形式

```json
{
  "page": 3,
  "questions": [
    {
      "number": 3,
      "text": "投資会社であるA社が，…理論である。",
      "choices": ["−15", "0", "5", "20"],
      "hasFigure": true,
      "figureNote": "表：投資戦略a/b × 市況好転/悪化"
    }
  ]
}
```

- 本文と選択肢は原文どおりに写す（句読点「，」「。」も PDF のまま）。改変はしない
- 表・図・プログラム片など、テキストで再現できないものは `hasFigure: true` にして画像に任せる。本文には写さない

### 検証（失敗したらスクリプトが止まる）

- 各回次で問題が 1〜100 まで欠けも重複もなく揃っている
- 全問に選択肢がちょうど 4 つある
- 全問に正解がある（answers.json と突合できる）
- `hasFigure: true` の問題に画像ファイルが実在する（`--allow-missing-images` を付けたときだけ警告に緩和）
- `id` が重複していない

### 手作業の見積もり

書き起こしは 1 回次あたり 52〜56 ページ。図表問題は 1 回次 10 問前後を見込む。

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
IPA の FAQ に従い、アプリのフッターと各問題に「出典：<年度> ITパスポート試験 公開問題 問<番号>」を表示する。
問題文・選択肢は改変しない（改変した場合はその旨を明記する義務があるため）。
