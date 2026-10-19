# AGENTS.md — このリポジトリで作業するAI向けのルール

## 前提

- GitHub Pages で公開する静的Webアプリ。ビルド不要の ES Modules。外部ライブラリ・外部通信・解析ツールを足さない（CSPで `connect-src 'none'`）。
- ユーザー入力は `textContent` / `value` でだけ扱う。`innerHTML` は使わない。
- アプリ内でAI APIを呼ばない。APIキーなどの秘密情報をコードに書かない。

## 守ること

- 依頼された範囲以外（他の入口、出力文言、保存形式）を変えない。
- 保存形式（`src/logic/persist.js` の `STORAGE_KEY`・`FORMAT_VERSION`、`src/data/modes.js` の項目ID・選択肢の value）は、既存ユーザーの下書きとJSONに影響する。変える場合は互換処理を入れる。
- 依頼文の文言を変えたら `node tests/update-fixtures.mjs` でスナップショットを更新し、差分を確認する。意図しない文言の変化があれば戻す。
- 改修モード（③）の依頼文から「変更してはいけないこと」「必要最小限」「元に戻せるようにすること」を消さない（テストで確認している）。

## 確認方法

```sh
npm test            # ユニットテスト
npm run test:e2e    # ブラウザ操作テスト（Playwright）
```

両方が通ることを確認してから完了とする。実行できなかったテストは「未実施」と報告する。
