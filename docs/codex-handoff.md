# Codex引き継ぎ書

このリポジトリで作業を始めるときは、最初にこの文書を読む。現状の監査結果、文書の読み順、作業ルール、完了定義をここに集約する。残作業の具体的なタスクは `docs/backlog.md` にある。

## 現状監査（2026-06-12 時点）

### 完成済み（検証済み）

| 項目 | 状態 | 検証方法 |
| --- | --- | --- |
| シナリオデータ `data/episode-02.json` | 完成。キャラ4 / 証拠8 / 場所4 / フラグ25 | `npm.cmd run validate:episode` エラー0件・警告5件（警告は既知。`docs/data-spec.md` の「validator警告の扱い」参照） |
| ゲーム実装 `src/` | 完成。調査〜最終推理〜事件解剖まで全導線実装済み | `npm.cmd run build` 成功（tsc + vite。JS約470KB / CSS約178KB） |
| **デザインアセット**（2026-06-12 完了） | ノワール調シネマティックで全35点（背景4・証拠8・人物14・幕間CG8・タイトル1）を生成・組み込み済み。PNG原本は `assets-src/`、配信用は `public/assets/` のWebP。`assetRegistry` は WebP 参照＋ `scene.*` 9キー | `validate:episode` エラー0件 / `build` 成功 / `test:playthrough` 完走 |
| 検証ツール | `scripts/validate-episode.mjs` と `tests/playthrough.mjs` が動作 | 本書「コマンド」参照 |
| CI | `.github/workflows/build.yml`（main への push / PR で build） | ブランチは `main` に統一済み。リモート未設定 |
| ドキュメント | 企画・物語・制作仕様・QA・素材・デザイン・機能ノート一式 | 本書「文書マップ」参照 |

### 未完了（残作業）

1. **公開作業**: 一般配布が決定。手順は `docs/release-spec.md`（D1〜D7）。D1〜D3は完了済みのため、次は D4 GitHub Pages 公開
2. **任意のデータ衛生**: validator警告5件は既知仕様。警告0化する場合は `docs/backlog.md` T10

→ 作業手順・受け入れ基準は `docs/backlog.md` を正とする。

## 文書マップと読み順

| 順 | 文書 | 役割（何の「正」か） |
| --- | --- | --- |
| 1 | `AGENTS.md` | 作業ルール、コマンド、UIガードレールの正 |
| 2 | `docs/codex-handoff.md`（本書） | 現状把握と作業の入口 |
| 3 | `docs/backlog.md` | 残作業タスクと受け入れ基準の正 |
| 4 | `docs/architecture.md` | コード構成・状態モデル・画面遷移の技術設計の正 |
| 5 | `docs/data-spec.md` | `episode-02.json` のスキーマ・フラグ辞書・正解ルートの正 |
| 6 | `docs/production-spec.md` | 画面・機能仕様（プレイヤー体験レベル）の正 |
| 7 | `docs/qa-checklist.md` | 受け入れ試験項目の正 |
| 8 | `docs/art-direction.md` | 画風・パレット・全素材の発注内容と組み込み手順の正 |
| 9 | `docs/design-system.md` | UIデザイントークン・コンポーネント様式の正 |
| 10 | `docs/ui-restyle-spec.md` | タイトル画面と画面別の情報設計・様式指示（R1〜R22、実装済み）の正 |
| 11 | `docs/layout-onescreen-spec.md` | 一画面固定レイアウト（ページスクロール禁止）の正。配置・スクロール構造はこれが最優先 |
| 12 | `docs/release-spec.md` | 配布（GitHub Pages / itch.io）・アセット軽量化・公開手順の正 |
| 13 | `docs/asset-plan.md` | 素材の置き場・命名・生成方針の正 |
| 14 | `docs/story-bible.md` / `docs/case-02-outline.md` | 物語のトーン・真相・ミスリード設計の正 |
| 15 | 機能ノート8本（下記） | 個別UIの設計意図とQAスクリーンショット名 |

機能ノート: `theory-progress-card.md` `evidence-next-use.md` `hearing-case-note.md` `hearing-breakthrough.md` `hearing-recovery-note.md` `deduction-ready-panel.md` `review-scorecard.md` `session-bookmark-resume.md`

文書間で矛盾を見つけたら、コードとデータの実態を確認した上で文書側を直し、その旨を報告する。

## コマンド

```powershell
npm.cmd install              # 依存導入（node_modules は導入済みのことが多い）
npm.cmd run dev              # http://127.0.0.1:5174/
npm.cmd run build            # tsc --noEmit && vite build（型チェック兼ビルド）
npm.cmd run typecheck        # 型チェックのみ
npm.cmd run validate:episode # シナリオJSONの参照整合性チェック
npm.cmd run test:playthrough # ブラウザ自動プレイ＋スクリーンショット
npm.cmd run preview          # ビルド成果物の確認 http://127.0.0.1:4174/
```

`test:playthrough` の前提:

- `npm.cmd run dev` で dev server（ポート5174）が起動していること
- ローカルの Chrome（`C:/Program Files/Google/Chrome/Application/chrome.exe`）を使用する
- スクリーンショットは `.codex/screenshots/` に出力される（git管理外）

## 変更種別ごとの完了定義（DoD）

| 変更対象 | 必須の検証 |
| --- | --- |
| `data/episode-02.json` | `validate:episode` エラー0件 → `build` 成功 → 進行に関わる変更なら `test:playthrough` |
| `src/`（UI・ロジック） | `build` 成功 → デスクトップとモバイル幅の両方で表示確認（`qa-checklist.md` の「表示」節） |
| `public/assets/` と `src/game/assets.ts` | `validate:episode`（素材パス存在チェックを含む）→ 該当画面の表示確認 |
| `assets-src/` と `scripts/optimize-assets.mjs` | `npm.cmd run optimize:assets` → `validate:episode` → `build`。PNG原本からWebP/OGP/faviconを再生成 |
| `docs/` | 対応する実装・データと矛盾していないこと |

## やらないこと

- `src/app/AppShell.tsx` の大規模分割・全面リファクタ（約1万行超だが動作している。タスクで明示されない限り構造には触らない）
- 新規依存パッケージの追加（明示的に必要な場合のみ提案して合意を取る）
- `src/App.tsx` への機能追加（薄いラッパーのまま維持。AGENTS.md 参照）
- `data/` への実在事件・実在依頼者情報の混入（AGENTS.md 参照）
- 保存キー `midnight-will-case-02:save:v1` の予告なし変更（既存セーブを壊す。変更する場合は `logic.ts` のマイグレーション処理とセットで行う）
