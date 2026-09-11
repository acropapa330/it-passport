# 過去問の取り込み手順

IPA の問題 PDF は全ページが画像なので、本文の書き起こしは Claude Code がページ画像を読んで行う。

## 手順

1. `raw/` に IPA の問題 PDF・解答 PDF を置く（`exams.json` の `qsPdf` / `ansPdf`）
2. `tools/import/render.sh r08` — `pages/r08/p-NN.png` を生成（200dpi）
3. `npm run import:answers` — `answers/r08.json` を生成
4. `pages/r08/p-NN.png` を 1 枚ずつ Read し、`transcripts/r08/page-NN.json` を書く（下記形式）
5. `hasFigure: true` の問題は `overrides.json` に切り出し範囲を追加し `npm run import:crop`
6. `npm run import:build` — 検証して `public/data/questions.json` を生成
   （画像がまだ無い段階で試すなら `npm run import:build -- --allow-missing-images`。
   全 exam を対象に実行する場合、`transcripts/<code>` が無い試験があるとエラーになる。
   一部の試験だけを対象にビルドしたいときは exam コードを引数で指定するとスキップされる）

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
