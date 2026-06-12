# 配布作業指示書（リリース手順）

Webゲームとして一般配布するための作業の正。タスクは D1〜D7 を上から順に、1タスク=1差分で実施する。配布形態は **GitHub Pages（推奨・無料・URL配布）** を本線とし、**itch.io（ZIP配布）** を任意の追加経路として扱う。

## 0. リリースゲート（着手前の前提）

以下が完了するまで D4 以降（公開）に進まない:

- [x] T12 一画面固定レイアウト（`docs/layout-onescreen-spec.md`）
- [x] T9 手動QA（`docs/qa-checklist.md` 全項目）
- [x] T6 初回コミット / T7 ブランチ `main` 統一（`docs/backlog.md`）

D1〜D3（軽量化・メタ整備・ビルド検証）はゲート前でも並行して進めてよい。

## 1. 現状診断（2026-06-12 実測。本指示書の根拠）

| 項目 | 実測 | 評価 |
| --- | --- | --- |
| `public/assets` のPNG 35点 | **67.4MB** | 配布不可級。1点平均約2MB。モバイル回線で初回ロードが破綻する |
| `dist` 総量 | **68.1MB** | 上記がそのまま同梱されるため |
| JS/CSS | 約650KB（gzip約160KB） | 問題なし |
| `vite.config.ts` | `GITHUB_PAGES=true` で base `/midnight-will-case-02/` に切替済み | Pages対応の下地あり |
| `index.html` | `lang="ja"`・title・description あり。**OGP・favicon なし、説明文に「開発版」表記** | D2で整備 |

結論: **D1（画像軽量化）が配布の必須条件**。目標は「全アセット合計 ≤ 8MB、タイトル画面の初回転送 ≤ 1.5MB」。

追記（2026-06-12）: D1〜D3は完了。`public/assets` はWebP 35点・約1.5MB、`dist` は約3.2MBまで軽量化済み。PNG原本は `assets-src/` で管理する。

## 2. タスク

### D1: アセット軽量化（必須）

PNG原本を保管用に退避し、配信用は WebP に変換して差し替える。

1. devDependency に `sharp` を追加する（新規依存だが、35点×今後の追加分を手作業変換するのは現実的でないため明示的に正当化する。実行時依存は増えない）
2. `scripts/optimize-assets.mjs` を新規作成: `assets-src/` 配下のPNGを読み、以下の仕様で `public/assets/` へ WebP 出力する
   - 背景・幕間CG・タイトル（1536×1024）: 長辺1536のまま quality 80 → 目安150〜300KB/点
   - 人物（1024×1536）: 長辺1152へ縮小、quality 80 → 目安80〜150KB/点（表示最大値より十分大きい）
   - 証拠（1254×1254）: 長辺1024へ縮小、quality 80 → 目安100〜180KB/点
   - 出力先は元と同じ相対パス・同じベース名（拡張子のみ `.webp`）
3. 原本PNGを `assets-src/`（新設、git管理する）へ **移動**し、`public/assets/` 配下は WebP のみにする
4. `src/game/assets.ts` の `assetRegistry` の `src` を一括で `.png` → `.webp` に変更
5. `tests/playthrough.mjs` の素材パス期待値は拡張子非依存化済み（`client-b-pressure.` 等）のため変更不要。`scripts/validate-episode.mjs` は実在チェックのみで拡張子非依存のため変更不要
6. `package.json` に `"optimize:assets": "node scripts/optimize-assets.mjs"` を追加

受け入れ基準:

- `public/assets` 合計 ≤ 8MB（`Get-ChildItem -Recurse | Measure-Object Length -Sum`）
- 画質目視: 背景の暗部の階調割れ（バンディング）が出ていない。出る場合は該当カテゴリのみ quality 88 へ上げ再変換
- `npm.cmd run validate:episode` エラー0件 / `build` 成功 / `test:playthrough` 完走
- 旧プレースホルダSVGはこのタスクで一緒に削除する（backlog T11 を充足）

### D2: index.html とメタ情報の整備

1. `<title>` を「消えた準備書面 — 午前0時の遺言書 Case 02」へ、description から「開発版」を外し1〜2文の紹介文に
2. OGP/Twitterカード: `og:title` / `og:description` / `og:type=website` / `og:image` / `twitter:card=summary_large_image` を追加
   - `og:image` 用に `public/ogp.png`（1200×630）を `assets-src/title-key-visual.png` から sharp でクロップ生成（`scripts/optimize-assets.mjs` に含めてよい）
   - `og:image` のURLは絶対URLが必要。D4で公開URL確定後に埋める（それまで相対で置き、D4の受け入れ基準で確認）
3. favicon: `public/favicon.ico`（32px）と `public/apple-touch-icon.png`（180px）をタイトルキービジュアルの中心部から生成し、`<link>` を追加
4. 任意: タイトル画面の下部に小さく「本作はフィクションです。実在の事件・人物・団体とは関係ありません。」の一行を追加（`AppShell` のタイトル区画。法律事務所題材のため推奨）

受け入れ基準: `build` 成功。OGPはD4後に https://www.opengraph.xyz/ 等のプレビューで画像・文言が出ること。

### D3: ビルド設定と配布物の検証

1. GitHub Pages 用ビルドが通ることを確認: `$env:GITHUB_PAGES='true'; npm.cmd run build` → `dist/index.html` 内のアセット参照が `/midnight-will-case-02/` 始まりであること
2. `npm.cmd run preview`（通常 base）で、タイトル→開幕→調査開始→セーブ→リロード復帰を手動確認
3. dist 合計が 10MB 以下であることを確認

受け入れ基準: 上記3点すべて。

### D4: GitHub リポジトリ作成と Pages 公開

**ユーザー操作（アカウント権限が必要なため Codex は代行しない）**: GitHub に空リポジトリ `midnight-will-case-02`（public）を作成する。

Codex の作業:

1. リモート登録と初回 push（T6/T7 完了後）: `git remote add origin <URL>` → `git push -u origin main`
2. `.github/workflows/deploy.yml` を新規作成（既存 `build.yml` は CI として残す）:
   - トリガー: `push: branches: [main]` ＋ `workflow_dispatch`
   - 手順: checkout → setup-node(24, npm cache) → `npm ci`（lockfileあり）→ `npm run validate:episode` → `GITHUB_PAGES=true` を環境変数にして `npm run build` → `actions/configure-pages` → `actions/upload-pages-artifact`（`dist`）→ `actions/deploy-pages`
   - `permissions: pages: write, id-token: read` と `concurrency: group: pages` を設定
3. **ユーザー操作**: リポジトリ Settings → Pages → Source を「GitHub Actions」にする
4. デプロイ完了後、公開URL `https://<ユーザー名>.github.io/midnight-will-case-02/` を `README.md` と D2 の `og:image` 絶対URLに反映して再push

受け入れ基準:

- 公開URLでタイトル画面が表示され、開幕→調査開始まで動く
- スマホ実機（またはDevToolsモバイルエミュレーション）で表示・操作できる
- リロードでセーブが復帰する（localStorageは公開オリジンで独立。開発時のセーブが引き継がれないのは正常）
- ブラウザのプライベートウィンドウでも初回ロードが体感数秒以内（D1の効果確認）

### D5: バージョンとリリースタグ

1. `package.json` の `version` を `1.0.0` に
2. `git tag v1.0.0` → `git push origin v1.0.0`
3. GitHub Releases に v1.0.0 を作成し、本文に公開URL・対応環境（PC/スマホの主要ブラウザ）・既知の制約を記載

受け入れ基準: Releases ページから誰でも公開URLへ到達できる。

### D6（任意）: itch.io 配布

1. 相対パスでビルド: `npx vite build --base=./`（設定変更不要。CLIフラグで足りる）
2. `dist` の中身を ZIP 化（フォルダごとではなく中身を直接。`index.html` がZIPルートに来ること）
3. **ユーザー操作**: itch.io でプロジェクト作成 → 「HTML」タイプ → ZIPをアップロード → 「This file will be played in the browser」にチェック → ビューポートは 1280×800 推奨・フルスクリーン許可ON
4. 価格は無料または任意（itch側の設定。ユーザー判断）

受け入れ基準: itch.io のプレビューでタイトルから調査開始まで動作し、iframe内でもページスクロールが発生しない（T12 が効いていること）。

追記（2026-06-12）: 相対パスビルドとZIP作成は完了。成果物は `dist-release/midnight-will-case-02-v1.0.0-itch.zip`（`index.html` がZIPルート）。`butler` は未インストールのため、itch.ioサイトへのアップロードは手動操作または `butler` 導入後に実施する。

### D7: 公開後スモークチェック（リリース毎に実施）

- [ ] PC Chrome / Edge、スマホ（iOS Safari または Android Chrome）で1周（正解ルートは `docs/data-spec.md`）
- [ ] 誤答→信用低下→不成立エンド→再挑戦の分岐確認
- [ ] OGPプレビュー（SNS貼り付け確認）
- [ ] 公開URLを `docs/codex-handoff.md` の監査表に追記

## 3. 配布形態の比較（参考）

| 経路 | 費用 | 向き | 備考 |
| --- | --- | --- | --- |
| GitHub Pages（本線） | 無料 | URL共有・常時公開 | CI連動で main へ push するだけで更新。独自ドメインも可 |
| itch.io（任意） | 無料 | ゲームとしての見つかりやすさ・配布ページ | 更新は手動ZIP。コメント欄・アナリティクスあり |
| Vercel / Netlify / Cloudflare Pages | 無料枠 | 代替静的ホスティング | Pages で足りるため本指示書では扱わない。移行時は `--base=/` でビルドするだけ |

## 4. やらないこと

- アナリティクス・広告・外部トラッキングの追加（プライバシー上、明示依頼があるまで入れない）
- 実行時依存パッケージの追加（sharp は devDependency のみ）
- セーブデータのクラウド同期（localStorage のままでよい）
