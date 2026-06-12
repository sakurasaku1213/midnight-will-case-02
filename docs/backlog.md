# 残作業バックログ

実装・データ・検証ツール・**全デザインアセット**は完成済み（`docs/codex-handoff.md` の監査参照）。残りは以下のタスクだけ。原則として P1 → P4 の順に、タスク単位で完結させる。各タスクは「受け入れ基準」をすべて満たした時点で完了。

進め方の共通ルール:

- 1タスク = 1つの小さな差分。複数タスクをまとめて巨大な変更にしない
- 完了したタスクはこのファイルのチェックボックスを `[x]` にして、日付を添える
- 検証コマンドの前提は `docs/codex-handoff.md` の「コマンド」節を参照

## P0: 完了済み — 素材差し替え（2026-06-12）

全35点をノワール調シネマティックで生成・配置済み（経緯と発注内容は `docs/art-direction.md`、生成は ChatGPT Web UI 経由・API不使用）。

- [x] **T1 背景4点** — `public/assets/locations/*.png`（1536×1024）
- [x] **T2 証拠8点** — `public/assets/evidence/*.png`（1254×1254）。予備のE9（case-folder）は未生成・任意のまま
- [x] **T3 人物14点** — `public/assets/characters/*.png`（1024×1536）。4人とも同一人物性・表情差分を目視確認済み
- [x] **T4 幕間CG8点＋タイトル1点** — `public/assets/scenes/*.png`（新設フォルダ）。`assetRegistry` に `scene.*` 9キーを追加し、`episode-02.json` の開幕3幕・成功2幕・失敗2幕の `assetKey` を差し替え済み
  - 意図的な例外: 成功終幕2幕目（ending-motive、久世の理由）は `evidence.scheduled-message` のままにした（送信予約メモが理由そのものを示すため）。`scene.ed-dawn` はエピローグ用の予備
  - 付随修正: `tests/playthrough.mjs` の素材パス期待値を拡張子非依存に変更、制作資料の ASSET KEY MANIFEST に scenes 行を追加
  - 検証済み: `validate:episode` エラー0件 / `build` 成功 / `test:playthrough` 完走（2026-06-12）

## P1: 完了済み — UI全面リスタイル実装（2026-06-12）

- [x] **T5 ノワールテーマへの全面リスタイル**: `docs/ui-restyle-spec.md` §5 のタスク R1〜R22 を上から順に実施済み
  - デザイントークンと様式の正: `docs/design-system.md`
  - タイトル画面（briefing 前段オーバーレイ、`scene.title` 使用）を含む
  - 実装内容: トークン導入、ノワール夜間テーマ、画面別再塗装、タイトル画面、playthroughタイトル通過、QAチェックリスト追記
  - 検証済み: `node --check tests\playthrough.mjs` / `npm.cmd run validate:episode`（エラー0件・既知警告5件） / `npm.cmd run build` / `npm.cmd run test:playthrough`
  - 追加確認: `rg "#[0-9a-fA-F]{3,8}" src/styles/global.css` はトークン定義部のみ。`docs/qa-checklist.md` 記載スクリーンショット130種は `.codex/screenshots/` に存在

## P1-2: 一画面固定レイアウト実装（次の最優先・2026-06-12 追加）

リスタイル後のレビューで「PC・スマホとも縦に長すぎる（実測: ページ全長4030px＝ビューポートの4.4倍。原因は右サイドバーの補助カード11枚の縦積み3811px）」というユーザー判断が出た。ページスクロールを廃止し、常に1画面（100dvh）へ収める。

- [x] **T12 一画面固定レイアウト**: `docs/layout-onescreen-spec.md` のタスク S1〜S10 を上から順に実施する
  - 核心: 補助カードを「積む」から「切り替える」へ（PC=手控えタブ、スマホ=下部ドック＋ボトムシート）。ステージは画像に台詞を重ねるADV標準形へ
  - 機能・フラグ・保存・文言は不変。スクロールは作業面と手控えパネル内部のみ
  - 受け入れ基準・検証は同仕様書 §6 の表に記載済み。最終確認: デスクトップとモバイルの全モードで `document.documentElement.scrollHeight <= window.innerHeight + 1`

## P2: リポジトリ整備

- [x] **T6 初回コミット（2026-06-12）**: コミットが1件もない。現状の完成形を最初のコミットとして記録する
  - 受け入れ基準: `git status` がクリーン（`.gitignore` は設定済み: node_modules / dist / .codex/screenshots 等は除外される）
- [x] **T7 ブランチ不一致の解消（2026-06-12）**: 現ブランチは `master`、CI（`.github/workflows/build.yml`）は `main` への push / PR が対象
  - 推奨: ブランチを `main` へ統一（`git branch -m master main`）。リモート追加時は default branch も `main` にする
  - 受け入れ基準: リモートへ push した際に CI の build ジョブが実際に走ること（リモート未設定のうちはブランチ名の統一まで）

## P3: QA完走

- [x] **T8 自動プレイスルー**: 2026-06-12 実行済み・完走（新素材・UIリスタイル・タイトル画面込み）。
  - 受け入れ基準: スクリプトが assert 失敗なく完走し、`.codex/screenshots/` にスクリーンショットが出力される
- [x] **T9 手動QA（2026-06-12）**: `docs/qa-checklist.md` の全項目（ゲーム進行・表示）を通しで確認
  - 正解手順は `docs/data-spec.md` の「正解ルート」を使う
  - 受け入れ基準: 全項目にチェックが付くこと。落ちた項目は修正タスクとして本ファイルの P3 に追記してから直す

## P4: データ衛生（任意）

- [ ] **T10 validator 警告5件の扱いを決める**: 現状の警告は仕様として正常（`docs/data-spec.md` の「validator 警告の扱い」参照）
  - 案A（推奨）: `scripts/validate-episode.mjs` にエンジン参照フラグのホワイトリスト（`analysis_time_window` / `analysis_final_chain` / `analysis_complete`）と記録用フラグ（`printer_mislead_cleared` / `pressed_visit_only`）を追加し、警告0件にする
  - 案B: 現状維持（文書で既知警告として管理）
  - 受け入れ基準（案Aの場合）: `validate:episode` がエラー0件・警告0件になり、未知のフラグを足した時には引き続き警告が出ること
- [ ] **T11 旧プレースホルダSVGの削除（UIリスタイル完了後）**: `public/assets/` 配下の `.svg` は全て未参照になった。T5完了・QA通過後にまとめて削除する
  - 受け入れ基準: 削除後に `validate:episode` エラー0件・`build` 成功・`test:playthrough` 完走
  - 注: 配布タスク D1（アセット軽量化）の中で一緒に実施してよい

## P5: 配布（2026-06-12 追加）

一般配布が決定した。作業の正は `docs/release-spec.md`（タスク D1〜D7）。本線は GitHub Pages、任意で itch.io。

- [ ] **T13 アセット軽量化（D1）**: 現状 `public/assets` が67.4MBで配布不可級。WebP化で合計8MB以下へ。**配布の必須条件**
- [ ] **T14 メタ整備（D2）**: title/OGP/favicon/フィクション表記
- [ ] **T15 ビルド・配布物検証（D3）**
- [ ] **T16 GitHub Pages 公開（D4）**: リポジトリ作成とPages有効化はユーザー操作。deploy.yml 追加と push は Codex
- [ ] **T17 v1.0.0 タグとリリース（D5）**
- [ ] **T18 itch.io 配布（D6・任意）**
- [ ] **T19 公開後スモークチェック（D7）**

リリースゲート: T12（一画面レイアウト）・T9（手動QA）・T6/T7（Git整備）が完了するまで T16 以降（公開）へ進まない。D1〜D3 は先行着手可。

## やらないこと（再掲）

- `src/app/AppShell.tsx` の大規模分割・リファクタ
- 新規依存パッケージの追加
- 保存キー `midnight-will-case-02:save:v1` の予告なし変更
- `data/` への実在事件・実在依頼者情報の混入
