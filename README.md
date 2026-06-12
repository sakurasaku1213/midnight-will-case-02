# 消えた準備書面

`午前0時の遺言書` の続編として作る、法律事務所ミステリーADVの開発ルートです。

前作は `React / TypeScript / Vite` のデータ駆動型Webゲームだったため、続編も同じ方向で開始します。シナリオ、証拠品、会話、争点整理、対決、最終推理を `data/episode-02.json` に寄せ、実装側は再利用しやすい薄いゲームエンジンとして切り出します。

## 起動

```powershell
npm.cmd install
npm.cmd run dev
```

ローカルURL:

```text
http://127.0.0.1:5174/
```

## 構成

```text
data/episode-02.json        続編シナリオの実装データ
docs/                       企画、制作仕様、QA、素材方針
public/assets/              画像・音声などの静的素材
src/app/                    画面構成
src/components/             再利用UI
src/game/                   型、状態、進行ロジック、保存境界
src/styles/                 グローバルCSS
tests/                      手動/自動テストの置き場
```

## ドキュメント

作業を引き継ぐ場合は `docs/codex-handoff.md` から読む。残作業と受け入れ基準は `docs/backlog.md`、技術設計は `docs/architecture.md`、シナリオデータの仕様は `docs/data-spec.md` にまとまっている。

## 最初の開発順

1. `data/episode-02.json` で場所、証拠、会話、証拠提示、争点整理、対決、最終推理を調整する。
2. 進行条件は `requiresFlags`、証拠取得は `addEvidence`、節目は `progressBeats` に寄せる。
3. UIは `src/app` と `src/components`、保存・信用ゲージ・分岐は `src/game` に分ける。
4. `npm.cmd run build` と `npm.cmd run test:playthrough` で、調査開始から正解エンドまで通す。

## 検証

```powershell
npm.cmd run build
npm.cmd run test:playthrough
```

`test:playthrough` は dev server 起動中の `http://127.0.0.1:5174/` を操作し、デスクトップ開始画面、成功エンド、モバイル開始画面のスクリーンショットを `.codex/screenshots/` に保存します。
