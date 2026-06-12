# UIリスタイル仕様書（画面別）

> **改訂（2026-06-12）**: R1〜R22 は実装済み。その後のレビューで縦長レイアウトの解消が決定したため、**画面の配置・スクロール構造に関する記述は `docs/layout-onescreen-spec.md` が本書より優先する**。本書は色・様式・各画面の情報設計（何を見せるか）の正として引き続き有効。

タイトル画面の新設仕様と、既存14 ViewMode の画面別リスタイル指示、幕間CG/タイトル素材の組み込み手順、実装タスク分解の正。デザイントークンと様式の定義は `docs/design-system.md`、色とアセットの発注内容は `docs/art-direction.md`、機能仕様は `docs/production-spec.md` を正とし、本書はそれらを壊さずに「見た目と画面の重心」だけを作り替える指示書である。実装担当（Codex）は §5 のタスクを上から順に、1タスク=1差分で進める。

## 1. 共通の前提と制約

- 機能・分岐・フラグ・保存（`midnight-will-case-02:save:v1` / `:audio:v1`）は一切変更しない
- `src/app/AppShell.tsx` の大規模分割はしない。スタイル適用のための className 追加・小さなマークアップ修正は可
- 新規依存パッケージ禁止。フォントはシステムフォントスタック（design-system §2.3）
- `docs/qa-checklist.md`「表示」節の全項目を維持する。特に「デスクトップとスマホで横にはみ出さない」系は全タスク共通の受け入れ基準
- disabled 表示と遷移可否の条件共有（architecture.md）を崩さない。スタイルだけ変える
- 検証コマンド: `npm.cmd run build` / `npm.cmd run validate:episode` / `npm.cmd run test:playthrough`（playthrough は `npm.cmd run dev` を起動した状態で実行。スクリーンショットは `.codex/screenshots/` に出る）

## 2. タイトル画面（新設）

### 2.1 実装方式: briefing 前段オーバーレイ（推奨）

| 観点 | 案A: オーバーレイ（推奨） | 案B: ViewMode `title` 追加 |
| --- | --- | --- |
| 状態モデル | `AppShell` のローカル state（例 `const [titleVisible, setTitleVisible] = useState(true)`）のみ。`GameState` 無変更 | `ViewMode` union 変更が `src/game/types.ts` / `logic.ts` / `LocationScene.getModeLabel` / `CommandBar` に波及 |
| 保存互換 | 影響なし（タイトル表示状態は保存しない） | `mode` は保存対象のため「`title` で保存されたセーブ」の復元規約が必要。保存キー変更禁止の制約に接触しやすい |
| 既存テスト | `tests/playthrough.mjs` に「タイトルを1クリックで閉じる」手順を足すだけ | モード遷移 assert の広範な書き換え |
| リスク | モード一覧（14種）に現れない画面が1つ増える → 本書を正として文書化することで補う | AppShell 内のモード分岐約100コンポーネントへの影響調査が必要 |

**推奨理由**: 案Aは `GameState`・保存・`logic.ts` の純関数群に触れず、「やらないこと」（保存キー変更禁止・大規模分割禁止）と両立する唯一の低リスク経路。タイトルは進行状態ではなく入口演出であり、ゲーム状態機械に組み込む必然性がない。

### 2.2 画面仕様

- **表示条件**: アプリ初回マウント時に常に表示（リロード時も表示）。閉じたらそのセッション中は再表示しない
- **背景**: `resolveAsset('scene.title')` → `public/assets/scenes/title-key-visual.png`（1536×1024、art-direction §6.5）。`object-fit: cover`、中央寄せ。上1/3はロゴ用の闇が確保されている前提（同仕様）。下部に `--noir-night-deep` → 透明の縦スクリムを敷きボタンの可読性を確保
- **画像未到着時のフォールバック**: 素材生成前でも成立させる。`--noir-night` 地＋中央下に `--noir-amber-glow` のラジアルグラデ1灯＋ビネット。画像の有無で実装を分岐させず、`background-image` の重ね順（グラデの下に画像）で自然に両立させる
- **ロゴ（CSS組版。画像化しない）**:
  - 上段: 「午前0時の遺言書 Case 02」 — `--font-mono` または `--font-sans`、`--text-s`、`--noir-amber`、`letter-spacing: var(--tracking-label)`
  - 罫: 幅 6em 程度の 1px `--noir-amber` の横罫
  - 題字: 「消えた準備書面」（= `episode.title`） — `--font-serif` 700、`--text-display` 以上（デスクトップ 3.2rem 目安、モバイル 2.2rem）、`--noir-paper`、`--tracking-display`。`text-shadow` は琥珀の縁光1段まで（`0 0 24px var(--noir-amber-glow)`）
- **ボタン（縦並び・中央下）**:
  - 「はじめから」: 常時表示。セーブが存在する場合は既存 `resetGame` と同様の確認（`window.confirm`）を経て `resetSavedState` → `createInitialState` で初期化し、オーバーレイを閉じる
  - 「つづきから」: `loadSavedState(episode)` が非 null（= 起動時に `loadInitialState` が復元済み）の場合のみ表示。押すとオーバーレイを閉じるだけ。表示時はこれを既定フォーカスにする
  - 「設定」: タイトル上に音響設定シート（既存の `AudioControls` 相当: 効果音オン/オフ・音量・演出テンポ）を開く。状態・保存キーは既存の `AudioSettings`（`midnight-will-case-02:audio:v1`）をそのまま使う
  - 様式: design-system §3.1。「つづきから」（あれば）または「はじめから」を主要（琥珀塗り）、他は副次
- **マークアップ**: `role="dialog"` `aria-modal="true"` `aria-label="タイトル"`。`.app-shell` の外側（兄弟）に `position: fixed; inset: 0` で重ねる。Escape では閉じない（誤操作防止）
- **モーション**: フェードイン `--dur-slow`。題字の琥珀明滅などのキーフレームは reduced-motion ガード内のみ。低モーション環境では静止表示
- **クラス接頭辞**: `title-`（例 `.title-screen` / `.title-logo` / `.title-actions`）。既存クラスと衝突させない

### 2.3 受け入れ基準

- 初回起動でタイトルが表示され、「はじめから」で briefing 第1幕から開始する
- セーブがある状態でリロードすると「つづきから」が出て、押すと保存時点の画面に戻る（`GameState` 復元は既存挙動のまま）
- セーブが無い状態では「つづきから」が表示されない
- 「設定」で音量を変えてリロードしても保持される（既存キー）
- 画像ファイルが無くてもフォールバック背景で成立し、`npm.cmd run build` が通る
- モバイル幅（〜820px）で題字・ボタンがはみ出さない
- `npm.cmd run test:playthrough` がタイトル通過手順込みで完走する（§5 R19）

## 3. 画面別の再設計指示

各画面とも「現状の課題 → 変更点 → 受け入れ基準」。対象コンポーネントは `AppShell.tsx` 内の関数名（architecture.md の区画表）で示す。クラス名はその関数の JSX から特定する。様式の詳細はすべて design-system §3 を参照。

### 3.1 トップバー（`.topbar` / `AudioControls`）

- 課題: 白地の管理画面風ヘッダで、題・話数・音響操作が事務ツールに見える。アクセントのワインレッド `#7a1f3d` がノワールパレット外
- 変更点:
  - `eyebrow`（第2話）を `--font-mono` の「CASE 02」風インデックスタグ（琥珀枠チップ）に
  - `h1` を `--font-serif`、下に 1px `--noir-line` の罫。subtitle は `--text-muted`
  - `AudioControls` / リセットボタンを暗色面＋枠線様式へ。リセットは危険様式（朱枠）
- 受け入れ基準: モバイルで折り返してもはみ出さない（既存QA）。音響設定の機能・保存は無変更

### 3.2 コマンドバー（`CommandBar` / `.command-panel` サイドバー一式）

- 課題: 10コマンドが均質な明色ボタンで「今押すべき一手」が光らない。状態チップが事務的
- 変更点:
  - 現在=琥珀点灯（左罫2px＋`--shadow-amber`）、実行可=紙色文字＋琥珀アイコン、前提待ち=減光＋鋼青の理由チップ（design-system §3.1/3.3）
  - サイドバーの各カード（現在の焦点 / `CaseDirector` / `CaseMap` / `.status-strip` / `CredibilityRiskCard` / `SessionBookmark` / `ProgressTrail`）を調書カード様式（上辺アクセント罫で種別分け）に統一
  - 信用表示を5灯ゲージ様式（design-system §3.4）へ。数値併記は維持
- 受け入れ基準: disabled と遷移可否の条件・チップ文言は無変更。状態チップと短い理由がデスクトップ/スマホで横にはみ出さない（既存QA）

### 3.3 メイン本文・ナレーション枠（`LocationScene` / `.scene-panel` / `.dialogue-box`）

- 課題: 白カード＋汎用吹き出しで「深夜に調書を読む」感がない。ナレーションがゴシックで読み物の重さが出ない
- 変更点:
  - `.dialogue-box` を「調書/ファイル」様式に: 上辺に `--font-mono` の小ラベル（話者名・役割・モード名は既存のまま）、本文 `.narrative` を `--font-serif`＋`--leading-narrative`、左に 2px のトーン罫（`tone-pressure`=朱 / `tone-success`=緑 / `tone-damage`=朱 / 通常=罫色）
  - `.dialogue-portrait` を写真貼付風（細枠＋角の留めタブ風疑似要素1つ）に。白フチは使わない
  - `.location-art` の `figcaption` を証拠写真キャプション風（`--font-mono`、`--text-xs`、`--text-muted`）に
- 受け入れ基準: tone 別の表情差分切り替え（既存QA）と人物画像のはみ出し防止（既存QA）を維持

### 3.4 移動カード（`MovePanel`）

- 課題: 場所カードの状態（現在地/調査可/前提待ち/確認済み）がチップ色頼みで、現場ファイルの質感がない
- 変更点: カードを「現場ファイル」様式に。場所画像の下部に `--noir-night` への減衰スクリム、左上に `--font-mono` の場所番号タグ、現在地は琥珀枠＋「現在地」チップを琥珀塗りに。未確認数・証拠数は `--font-mono` で罫線下に
- 受け入れ基準: モバイルで縦積み・画像と進捗チップがはみ出さない（既存QA）。4状態が文字＋色で判別できる

### 3.5 調査画面（`InspectPanel` / `InvestigationMemo` / 調査ポイントオーバーレイ）

- 課題: 調査ポイントの番号ラベルが汎用バッジで、証拠タグの世界観がない
- 変更点: 調査ポイントを証拠タグ様式マーカー（`--radius-s`、`--font-mono` 番号、琥珀枠。確認済みは鋼青の消灯、前提待ちは `--text-faint`）に。hover/focus で `--shadow-amber`。現場メモは罫線ノート様式（項目間に `--noir-line-soft` の点罫）
- 受け入れ基準: デスクトップ=ラベル付き / モバイル=番号中心の既存仕様と横スクロール禁止（既存QA）を維持。背景画像差し替え後（art-direction B1〜B4）も番号が読める

### 3.6 会話（`TalkPanel` / `TalkPreparationCard`）

- 課題: 人物カードが名簿風で、深夜の聴取の緊張がない
- 変更点: 供述カードを「人物ファイル」様式に — ポートレート左、役割を `--font-mono` タグ、話題ボタンは番号付き罫線行（聴取項目リスト風）。消費済み話題は消灯＋確認済みチップ。会話後の追及メモは上辺琥珀罫のメモカード
- 受け入れ基準: 人物カード・話題ボタン・追及メモのモバイル縦積みと横スクロール禁止（既存QA）を維持

### 3.7 提示（`PresentPanel` / `PresentPressureBoard` / `PresentVerdictPanel` / `PresentMissNotePanel`）

- 課題: 人物と証拠のセレクトが事務フォーム風で「突きつける」緊張がない
- 変更点: 人物枠と証拠枠を左右対置し、間を照合線（`--noir-line-soft` の点罫）で結ぶ。圧力ボードは詰め筋あり=琥珀罫 / 弱い=鋼青減光で区別（文言は既存）。提示実行ボタンをこの画面唯一の琥珀塗りに。誤提示ペナルティは朱罫＋ `--noir-vermilion-dim` 面
- 受け入れ基準: 圧力ボード・反応分析の縦積み、誤提示時の裁判長ペナルティ可読性（既存QA）を維持。信用低下ロジック無変更

### 3.8 整理（`AnalysisPanel` / `AnalysisChainBoard`）

- 課題: 証拠2点の関係づけが汎用セレクト2個で、「記録を綴じる」感がない
- 変更点: 選択した2証拠を証拠タグ2枚＋結合線の表示で見せ、成立済みリンクは緑罫＋「綴じ済み」状態に。チェーンボードは結合線を罫線で描く（SVG不要、border で可）
- 受け入れ基準: セレクトUIのモバイル縦積み（既存QA）を維持。3つの組み合わせ正解判定は無変更

### 3.9 対決（`HearingPanel` ほか `Hearing*` 群・`CourtroomBench` / `ConfrontationDock`）

- 課題: 補助パネル（読み筋・照合レーン・提出前チェック・崩し順メモ）が証言と同格に並び、法廷の重心（証言者と発言）が埋もれる
- 変更点（スタイルと既存マークアップ内の強弱付けに限る。パネルの増減・ロジック変更はしない）:
  - 証言カードを主役に: 証言本文を `--font-serif`＋`--text-l`、尋問タイトル幕（`CrossExaminationBanner`）を幕布風の暗帯＋明朝に
  - 法廷HUD（`HearingCourtHud`: 信用・選択中証拠・ゆさぶり/つきつけ状態）を上部の細い帯として視覚的に固定階層へ。信用は5灯ゲージ様式
  - 補助パネル群は二次階層の見た目（地を一段暗く、見出しを `--text-xs` ラベル化）に落とす
  - 「異議あり」「突破」（`CourtroomObjectionCue` / `ImpactBurst`）はカットイン様式（design-system §3.9）: 琥珀光罫の帯＋明朝決め文字。誤提示は朱
- 受け入れ基準: HUD可読・記録トレイ・ショートカット表示・各カードの縦積み（既存QAの対決系全項目）と左右キー/P/Enter 操作を維持

### 3.10 最終推理（`DeductionPanel` ほか `Deduction*` / `FinalSummationPanel` / `FinalEvidenceChain`）

- 課題: 反論ステージのステージ感が薄く、最終弁論の高揚がない
- 変更点: 論点番号を「第N論点」明朝大見出しに。相手の反論=鋼青罫の上段、こちらの結論=紙色の下段という対置を罫線で組む。「突きつける」をこの画面唯一の琥珀塗りに。最終証拠チェーンは証拠タグ4枚を結合線で繋ぐ横帯（モバイルは縦）。成立=緑 / 再検討=朱のチップ
- 受け入れ基準: 反論照合3カードの縦積み・設計メモ等のはみ出し禁止・キーボード操作（既存QA）を維持。正誤判定・信用低下は無変更

### 3.11 事件ファイル（`CaseFilePanel` / `EvidenceFile` / `EvidenceDetail` / `PeopleFile` / `TimelineFile` / `TestimonyFile` / `TheoryBoard`）

- 課題: 5タブが汎用タブで、証拠閲覧が資料管理画面に見える
- 変更点: タブをファイルフォルダ見出し様式（design-system §3.7）に。証拠グリッドは証拠保管袋風サムネカード（96px 判別基準）、証拠詳細は調書様式（項目名 `--font-mono` 左・値右の定義リスト罫）。時系列は `--font-mono` の時刻軸＋左罫。証言録は対決と同じ明朝証言様式
- 受け入れ基準: 5タブ・照合ノート・記録相関図・時系列解析・証言録の表示系既存QA全項目を維持

### 3.12 ログ（`LogPanel` / `HistoryCaseSummary`）

- 課題: 履歴カードが均質で読み返す動機が弱い
- 変更点: 業務日誌様式（design-system §3.8）: `--font-mono` のメタ行＋モード別左罫＋交互地。絞り込みボタンはタグ群（選択中=琥珀塗り）
- 受け入れ基準: 詳細ログカード・集計・絞り込みのはみ出し禁止（既存QA）を維持

### 3.13 開幕・終幕（`StoryStagePanel` / `EndingResultPanel` / `LocationScene` の幕間表示）

- 課題: 幕間が通常パネルと同じ見た目で、映画のワンカット（art-direction §6.4）を受け止める器がない
- 変更点:
  - 幕間CG（scene.* 導入後）を `.location-art` 相当の枠で大きく見せ、画像下1/4の暗部に本文帯を重ねられる比率を保つ（アート側が下1/4を暗く落とす仕様と整合）
  - 「幕 N/M」を `--font-mono`、幕タイトルを明朝に。`story-step-list` は章送りの目次様式（現在幕のみ琥珀点灯）
  - 幕送りボタンは主要=琥珀塗り1つ（次の幕へ/調査開始）、他は副次
  - 終幕（成功/失敗）はトーン罫で差を付ける: 成功=琥珀→夜明けの紙色、失敗=朱罫＋減光
- 受け入れ基準: 幕送り・スキップ・開幕中の調査開始（既存QA）を維持。幕リストと操作ボタンがはみ出さない（既存QA）

## 4. 幕間CG・タイトル素材の組み込み

生成・QA・差し替えの運用は `docs/art-direction.md` §7.3 が正。本節はコード側の手順だけ確定する。

1. `src/game/assets.ts`:
   - `AssetKind` に `'scene'` を追加
   - `assetRegistry` に9キーを追加: `scene.op-missing-line` / `scene.op-risk` / `scene.op-resolve` / `scene.ed-truth` / `scene.ed-judgment` / `scene.ed-dawn` / `scene.ed-fail-records` / `scene.ed-fail-morning` / `scene.title`。`src` は `/assets/scenes/<ファイル名>.png`（art-direction §6.4/6.5 の表）、`kind: 'scene'`、`priority: 4`、`brief` は同表の場面説明を流用
   - `getAssetRegistryStats` に `scenes` 件数を追加（制作資料の `AssetSwapPlanPanel` が manifest 件数を表示しているため、合計値の変化を文言と整合させる）
2. `data/episode-02.json`: `openingScenes` 3件 / `endings.success.scenes` 3件 / `endings.failure.scenes` 2件 の `assetKey` を上記 `scene.*` に差し替える（現在は場所・証拠キーを共用中）
3. タイトル画面（§2）は `resolveAsset('scene.title')` で参照する
4. 注意事項:
   - `scripts/validate-episode.mjs` は **assetKey 文字列と registry の対応を検査しない**（`resolveAsset` が未知キーで fallback を返すだけ）。また素材パス実在チェックの対象は JSON 直書きの `image` / `portrait` であり、scene 画像は対象外。**差し替え後は開幕3幕・成功3幕・失敗2幕の幕送りを目視（またはスクリーンショット）で必ず確認する**
   - 画像ファイルが `public/assets/scenes/` に置かれるまで手順2に着手しない（参照切れ防止）。手順1のキー追加とタイトル画面実装はフォールバック前提で先行してよい
   - 旧プレースホルダSVGは全差し替え完了まで削除しない（art-direction §7.3）

## 5. 実装タスク分解（Codex 着手順）

1タスク=1つの小さな差分。各タスク完了時に検証コマンドを実行し、表示系タスクはデスクトップ/モバイル両幅で確認する。R2 以降の全タスク共通の受け入れ基準: 「qa-checklist『表示』節の該当項目を満たす」「新規HEX直書きを増やさない（var() 経由）」。

| # | タスク | 対象ファイル | 固有の受け入れ基準 | 検証 |
| --- | --- | --- | --- | --- |
| R1 | デザイントークン導入（design-system §2 の `:root` ブロック追加のみ。既存ルール不変） | `src/styles/global.css` | 画面の見た目が一切変わらない | `npm.cmd run build` |
| R2 | ベース一括差し替え（root/body/`.app-shell`/`.topbar`/共有面/ボタン/フォームの夜間反転。design-system §5.1-2） | `src/styles/global.css` | 全画面で本文コントラスト4.5:1以上。明地の取り残しがあっても文字が読める | `npm.cmd run build` ＋ test:playthrough スクショ目視 |
| R3 | トップバー再塗装（§3.1） | `src/styles/global.css`（必要なら `AppShell.tsx` の className 追加） | CASE タグ・明朝題・暗色コントロール。モバイル折返しOK | `npm.cmd run build` |
| R4 | コマンドバー＋サイドバー（§3.2） | `src/styles/global.css` / `AppShell.tsx`（className のみ） | 現在/実行可/前提待ちが点灯差で判別。チップはみ出しなし | `npm.cmd run build` |
| R5 | メイン本文の調書化（§3.3） | `src/styles/global.css` / `src/components/LocationScene.tsx`（className のみ） | ナレーションが明朝・行間1.9。tone罫4種 | `npm.cmd run build` |
| R6 | 移動カード（§3.4） | `src/styles/global.css` | 4状態判別・縦積みOK | `npm.cmd run build` |
| R7 | 調査画面（§3.5） | `src/styles/global.css` / `src/components/LocationScene.tsx` | 証拠タグ風マーカー。モバイル番号中心を維持 | `npm.cmd run build` |
| R8 | 会話（§3.6） | `src/styles/global.css` | 人物ファイル様式。縦積みOK | `npm.cmd run build` |
| R9 | 提示（§3.7） | `src/styles/global.css` | 琥珀塗りは提示実行のみ。ペナルティ朱表示 | `npm.cmd run build` |
| R10 | 整理（§3.8) | `src/styles/global.css` | タグ2枚＋結合線。縦積みOK | `npm.cmd run build` |
| R11 | 対決（§3.9） | `src/styles/global.css` / `AppShell.tsx`（className・強弱付けのみ） | 証言が主役の階層。対決系QA全項目・キー操作維持 | `npm.cmd run build` ＋ test:playthrough |
| R12 | 最終推理（§3.10） | `src/styles/global.css` | 第N論点見出し・チェーン帯。キー操作維持 | `npm.cmd run build` ＋ test:playthrough |
| R13 | 事件ファイル（§3.11） | `src/styles/global.css` | フォルダタブ・調書様式詳細。タブはみ出しなし | `npm.cmd run build` |
| R14 | ログ（§3.12） | `src/styles/global.css` | 日誌様式・絞り込みタグ | `npm.cmd run build` |
| R15 | 開幕・終幕（§3.13） | `src/styles/global.css` | 幕間の器が完成（CG差し替え前でも成立） | `npm.cmd run build` |
| R16 | カットイン・記録照合・入手/クイック表示の演出統一（design-system §3.6/3.9。reduced-motion ガード内へ） | `src/styles/global.css` | 既存の表示尺（JS制御）不変。低モーションでフェードのみ | `npm.cmd run build` |
| R17 | 残存HEX掃除（design-system §5.1-4） | `src/styles/global.css` | `rg "#[0-9a-fA-F]{3,6}" src/styles/global.css` がトークン定義部と明示コメント例外のみ | `npm.cmd run build` |
| R18 | タイトル画面実装（§2。`scene.title` キー追加＋フォールバック背景込み） | `AppShell.tsx` / `src/game/assets.ts` / `src/styles/global.css` | §2.3 の全項目 | `npm.cmd run build` ＋ `npm.cmd run validate:episode` |
| R19 | playthrough のタイトル通過対応＋ `desktop-title.png` / `mobile-title.png` 追加 | `tests/playthrough.mjs` | assert 失敗なく完走。タイトルスクショ出力 | `npm.cmd run test:playthrough` |
| R20 | 幕間CGの assetRegistry キー追加（**素材PNG到着後**。§4 手順1） | `src/game/assets.ts` | キー9件・stats 整合 | `npm.cmd run validate:episode` ＋ `npm.cmd run build` |
| R21 | episode JSON の assetKey 差し替え（§4 手順2） | `data/episode-02.json` | 開幕3・成功3・失敗2幕の表示を目視確認（validator は assetKey を検査しない） | `npm.cmd run validate:episode` ＋ `npm.cmd run build` ＋ test:playthrough |
| R22 | 回帰QA: qa-checklist 全項目＋タイトル/トーン項目の追記 | `docs/qa-checklist.md`（追記のみ。既存項目は削らない） | 全項目チェック。落ちた項目は修正タスク化 | `npm.cmd run test:playthrough` ほか手動 |

順序の根拠: R1→R2 で全体を読める夜間テーマに反転してから画面別に磨く（中間状態でも常にプレイ可能）。タイトル（R18）はフォールバック背景があるため素材到着を待たず実装でき、CG組み込み（R20-21）だけが素材待ちでブロックされる。

## 6. やらないこと（再掲）

- `AppShell.tsx` の大規模分割・コンポーネント抽出リファクタ
- 新規依存パッケージの追加（フォント・アニメーションライブラリ含む）
- 保存キー `midnight-will-case-02:save:v1` / `midnight-will-case-02:audio:v1` の変更、`GameState` スキーマ変更
- `ViewMode` の追加・変更（タイトルはオーバーレイ方式で実現する）
- 進行ロジック・フラグ・正誤判定・信用ゲージ計算への変更
- 既存QAチェックリスト項目の削除・緩和（特にモバイルではみ出さない系）
- ブレークポイントの新設（820px 1本を維持）
