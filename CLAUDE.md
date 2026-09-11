# このプロジェクトについて

<!-- プロジェクト名と一言説明をここに書く（README.md にも同じものを） -->

## 共通ルール

- 日本語で応答する
- 変更を加えたら、関係するテストや動作確認を必ず行ってから完了報告する
- 秘密情報（APIキーなど）は `.env` にあり、`~/ClaudeAgentBot/.env` への symlink。
  **`.env` の中身をコミット・出力・コピーしないこと**

## git のルール

- **コミットしたら、そのリポジトリの `origin` に push する。** コミットで止めない
- push したくない事情があるとき（作業途中の WIP、内容に自信がない等）は、
  push せずにその旨を報告して指示を仰ぐ
- このプロジェクトと `zenn/` は**別リポジトリ**。それぞれのリポジトリで
  コミットし、それぞれ push する

## Zenn 記事

`zenn/` は Zenn 記事リポジトリ (`acropapa330/zenn-content`) への symlink。
記事を書いたらここに置いて push すれば公開できる。

- `zenn/articles/` — 単発記事（`.md`、frontmatter に `published` あり）
- `zenn/books/` — 本（章立て。`config.yaml` の `chapters` に章を登録する）
- `zenn/images/` — 画像
- 記事の書き方・命名規則は `zenn/CLAUDE.md` に詳しくあるので、書く前に読むこと
- 公開状態は frontmatter の `published`。**意図せず `true` にしないこと**
- `zenn/` は `.gitignore` 済み。このプロジェクトのリポジトリには含めない
- ⚠️ `zenn/` の remote URL には認証情報が埋め込まれている。
  **`git remote -v` の出力をそのまま貼り付けたりログに残したりしないこと**

## フォルダ構成

- `src/` — コード
- `docs/` — ドキュメント
- `notes/` — 作業メモ・調査記録
- `zenn/` — Zenn 記事リポジトリへの symlink（別リポジトリ）

## よく使うコマンド

<!-- ビルド・テスト・実行コマンドが決まったらここに追記する -->
