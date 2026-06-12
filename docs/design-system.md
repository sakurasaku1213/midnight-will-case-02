# デザインシステム仕様書

UI全体のデザイントークン（CSSカスタムプロパティ）、コンポーネント様式、演出原則、`src/styles/global.css` への適用方針の正。色の出典は `docs/art-direction.md` §2（ノワール調パレット）であり、HEX値はそこからそのまま使う。画面別の適用指示と実装タスク順は `docs/ui-restyle-spec.md` を正とする。本書は実装手段（クラス名の新設可否、移行手順の段階分け）まで含めて Codex 向けに確定する。

## 1. 現状の前提（2026-06-12 調査時点）

- `src/styles/global.css` は約12,500行・**CSS変数の使用0件**。全色がHEX直書き（ライトテーマ: 地 `#eef2f3`、アクセント `#7a1f3d` のワインレッド、アイコン `#0f766e`）で、art-direction のノワールパレットと不一致
- 例外的に `.soundtrack-panel` だけが既に暗色＋金（`#0e1424` 系＋ `#d6aa4b`）。これが目指す方向の先行例
- メディアクエリは2つだけ: `@media (max-width: 820px)`（11649行〜、モバイル一括）と `@media (prefers-reduced-motion: no-preference)`（12496行〜、アニメ定義のガード）
- フォントは `Inter, "Yu Gothic", ...` のゴシック一本。明朝・等幅の使い分けなし

## 2. デザイントークン定義

`global.css` の先頭 `:root` に以下を追加する。**以後、色・字・間隔・影・モーションの値は必ず `var()` 経由で参照し、新しいHEX直書きを増やさない。**

### 2.1 色（基礎パレット = art-direction §2 のまま）

| トークン | 値 | 出典・用途 |
| --- | --- | --- |
| `--noir-night` | `#0B1220` | 基調（夜の闇）。ページ背景、最暗部 |
| `--noir-shadow` | `#16213A` | 第二の闇。パネル・カード地 |
| `--noir-amber` | `#D9A441` | 琥珀（キーライト）。主要アクション、強調、アクセント |
| `--noir-amber-bright` | `#F2C879` | 琥珀ハイライト。ホバー・選択・フォーカス |
| `--noir-paper` | `#E8E2D4` | 古紙の白。本文テキスト、書面 |
| `--noir-vermilion` | `#B3433C` | 朱。危険、信用低下、誤答、赤入れ |
| `--noir-steel` | `#5C7A99` | 鋼青。デジタル記録、ログ、リンク、前提待ち |
| `--noir-green` | `#5B8A72` | 成立の緑。突破・成立（控えめに） |

### 2.2 色（派生トークン。本書で確定する追加値）

基礎8色から導出した状態バリエーション。値は確定値として使う（再調整する場合も本書を先に更新する）。

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--noir-night-deep` | `#070D18` | モーダル背面、ビネット、最暗段 |
| `--noir-shadow-raised` | `#1C2A47` | パネルのホバー・選択面、一段浮いた面 |
| `--noir-line` | `#2A3A5C` | 標準ボーダー・罫線 |
| `--noir-line-soft` | `rgba(92, 122, 153, 0.28)` | 弱い区切り罫、点線罫 |
| `--noir-amber-press` | `#B8862F` | 琥珀ボタンの押下面 |
| `--noir-amber-glow` | `rgba(217, 164, 65, 0.18)` | 琥珀の面光（背景にじみ） |
| `--noir-amber-ring` | `rgba(217, 164, 65, 0.55)` | フォーカスリング、選択枠 |
| `--noir-vermilion-bright` | `#C75D54` | 危険ボタンのホバー |
| `--noir-vermilion-dim` | `rgba(179, 67, 60, 0.16)` | 危険・誤答の面（背景） |
| `--noir-green-bright` | `#74A98D` | 成立状態のホバー・強調 |
| `--noir-green-dim` | `rgba(91, 138, 114, 0.16)` | 成立状態の面（背景） |
| `--noir-steel-bright` | `#7E9DBC` | リンクホバー、鋼青の強調 |
| `--noir-steel-dim` | `rgba(92, 122, 153, 0.16)` | 前提待ち・情報面の背景 |
| `--text-main` | `var(--noir-paper)` | 本文 |
| `--text-muted` | `rgba(232, 226, 212, 0.72)` | 補足、ラベル |
| `--text-faint` | `rgba(232, 226, 212, 0.5)` | 無効、最弱（大きい字専用） |
| `--text-on-amber` | `#1A1408` | 琥珀ボタン上の文字（黒に近い墨色） |
| `--text-on-vermilion` | `#F5EDE4` | 朱の面上の文字 |

無効状態は `opacity` 一括減光ではなく `--text-faint` ＋ `--noir-line` 枠で表現する（背景が暗いため opacity だと読めなくなる）。

### 2.3 タイポグラフィ

Webフォントの新規依存は追加しない。システムフォントスタックで構成し、フォールバックを必ず置く。

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--font-serif` | `"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", "BIZ UDMincho", serif` | 見出し、題字、ナレーション本文、証言、カットインの決め文字 |
| `--font-sans` | `"Noto Sans JP", "Yu Gothic", "YuGothic", "Hiragino Kaku Gothic ProN", "Meiryo", system-ui, sans-serif` | UI本文、ボタン、チップ、フォーム |
| `--font-mono` | `"Consolas", "BIZ UDGothic", "MS Gothic", "Courier New", monospace` | 証拠ログ、タイムスタンプ、証拠ID、CASE番号タグ |

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--text-xs` | `0.72rem` | チップ、ラベル（現行最小値を踏襲） |
| `--text-s` | `0.8rem` | 補足文 |
| `--text-m` | `0.92rem` | UI本文 |
| `--text-l` | `1.05rem` | ナレーション本文、証言 |
| `--text-xl` | `1.3rem` | パネル見出し |
| `--text-2xl` | `1.7rem` | 画面見出し、カットイン副題 |
| `--text-display` | `2.4rem` | タイトル題字、カットイン決め文字 |
| `--leading-ui` | `1.55` | UI本文 |
| `--leading-narrative` | `1.9` | ナレーション・証言（読み物として広く） |
| `--leading-dense` | `1.45` | ログ、表 |
| `--tracking-label` | `0.08em` | 英字ラベルの字間（現行値を踏襲） |
| `--tracking-display` | `0.14em` | 題字・カットイン決め文字の字間 |

運用規則:

- 明朝（`--font-serif`）の font-weight は **400 / 600 / 700 のみ**。現行コードに多い 800〜950 はゴシックUI文字（チップ・ラベル）に限定する。游明朝はウェイトが少なく、合成ボールドで滲むため
- ナレーション・証言・幕間本文は `--font-serif` ＋ `--leading-narrative`。ボタン・チップ・フォームは `--font-sans`。時刻・証拠ID・履歴行のメタ情報は `--font-mono`
- 英字小ラベル（`SOUNDTRACK` 等）は現行どおり uppercase ＋ `--tracking-label` を維持する

### 2.4 スペーシング・角丸・ボーダー・影

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--space-1`〜`--space-7` | `4px / 8px / 12px / 16px / 24px / 32px / 48px` | 余白スケール。中間値を新設しない |
| `--radius-s` | `3px` | チップ、タグ、調査ポイント番号（証拠タグ風の硬さ） |
| `--radius-m` | `6px` | ボタン、入力、カード |
| `--radius-l` | `10px` | パネル、モーダル |
| `--border-width` | `1px` | 標準。強調時のみ 2px（左罫・上罫アクセント） |
| `--shadow-panel` | `0 18px 40px rgba(2, 6, 16, 0.55)` | パネルの落ち影（現行の白影を置換） |
| `--shadow-amber` | `0 0 0 1px var(--noir-amber-ring), 0 0 24px var(--noir-amber-glow)` | 琥珀の灯り。現在地・選択・突破にだけ使う |
| `--shadow-inset-paper` | `inset 0 1px 0 rgba(232, 226, 212, 0.06)` | 紙面の起毛感（上辺の微ハイライト） |

角丸 12px 超は禁止（§4 演出原則）。現行の一律 8px は `--radius-m` へ寄せる。

### 2.5 モーション

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--dur-instant` | `80ms` | ホバー色変化 |
| `--dur-fast` | `140ms` | チップ・ボタンの状態遷移 |
| `--dur-base` | `220ms` | パネル開閉、タブ切替 |
| `--dur-slow` | `420ms` | 幕間フェード、タイトルフェード |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 出現系 |
| `--ease-cinematic` | `cubic-bezier(0.65, 0, 0.35, 1)` | カットイン、幕送り |

- カットイン等の表示時間は JS 側（`AppShell.tsx` の `getTempoDuration`: カットイン900ms・インパクト1150ms・記録照合5200ms、演出テンポ 0.72/1/1.32 倍）が正。CSSアニメの尺はこれを超えない
- **キーフレームアニメーションの新設は、既存の `@media (prefers-reduced-motion: no-preference)` ブロック（global.css 12496行〜）の中にのみ置く。** ガード外には transition の色変化だけを許す（移動を伴わないため）
- 低モーション環境ではカットイン・幕間はフェード（opacity）のみとする

## 3. コンポーネント様式

各コンポーネントの見た目規範。状態名はコマンドバーの既存仕様（現在/実行可/前提待ち 等）と一致させる。

### 3.1 ボタン

| 種別 | 様式 |
| --- | --- |
| 主要（実行可） | `--noir-amber` 塗り＋ `--text-on-amber`。**1画面に琥珀塗りは原則1つ**（=その画面の「次の一手」）。hover で `--noir-amber-bright`、active で `--noir-amber-press` |
| 副次 | 透明地＋ `--noir-line` 枠＋ `--text-main`。hover で `--noir-shadow-raised` 地＋ `--noir-amber-ring` 枠。インクの枠線という扱い |
| 現在（選択中コマンド） | `--noir-shadow-raised` 地＋左罫 2px `--noir-amber` ＋ `--shadow-amber`。点灯した琥珀ランプのメタファー |
| 前提待ち（disabled） | 透明地＋ `--noir-line-soft` 枠＋ `--text-faint`。理由チップ（後述）を `--noir-steel` 系で添える。**disabled 判定と遷移可否の条件共有（architecture.md）は変えない** |
| 危険 | 透明地＋ `--noir-vermilion` 枠＋朱文字。hover で `--noir-vermilion-dim` 地。リセット・やり直し系のみに使い、提出系には使わない |

フォーカスリングは全ボタン共通で `outline: 2px solid var(--noir-amber-ring); outline-offset: 2px`。

### 3.2 カード（調書ファイル様式）

- 地 `--noir-shadow`、枠 `1px var(--noir-line)`、角丸 `--radius-m`、影 `--shadow-panel` ＋ `--shadow-inset-paper`
- 上辺 2px のアクセント罫で種別を示す: 琥珀=操作・焦点 / 鋼青=記録・情報 / 朱=危険・誤答 / 緑=成立（`.soundtrack-panel` の `border-top: 3px` 金罫の先行例を 2px に統一）
- カード見出しは `--font-serif` 600、メタ情報（番号・件数）は `--font-mono` の小ラベル
- ホバー可能なカード（移動カード等）は hover で地を `--noir-shadow-raised` に、選択中は `--shadow-amber`

### 3.3 状態チップ

- 形: `--radius-s`、`--text-xs`、`--font-sans` 800、padding `2px 8px`。**文字を省かない**（色だけで状態を伝えない）
- 配色: 実行可/調査可=琥珀枠＋琥珀文字（透明地）/ 現在=琥珀塗り＋墨文字 / 前提待ち・材料不足=鋼青枠＋ `--noir-steel-dim` 地 / 確認済み・成立=緑枠＋ `--noir-green-dim` 地 / 危険・誤答=朱枠＋ `--noir-vermilion-dim` 地
- モバイルで折り返し可能にし、横スクロールを出さない（qa-checklist「表示」節の既存要件）

### 3.4 信用ゲージ

- `MAX_CREDIBILITY = 5` の5灯。メタファーは「琥珀のランプが1つずつ消えていく」
- 点灯 = `--noir-amber` 塗り＋微グロー、消灯 = `--noir-line` 枠のみの空灯
- 残2で点灯色を `--noir-amber-bright`（警告の明滅は reduced-motion ガード内）、残1で `--noir-vermilion`
- 数値表記（`信用 n/5`）は `--font-mono` で併記し、色覚に依存させない

### 3.5 証拠チップ

- 「証拠タグ（evidence tag）」様式: `--radius-s`、左端に `--font-mono` の証拠連番または略号、紙色文字、`--noir-line` 枠
- 左端にパンチ穴風の小円（疑似要素、`--noir-night` 塗り＋ `--noir-line` 枠）を1つ置きタグらしさを出す
- 取得済み=紙色 / 重要マーク=琥珀枠 / 未取得は名称を見せない（production-spec の既存規則を維持）
- サムネイル併置時は 96px 角を基準にし、判別性（art-direction §7.2）を損なう縮小をしない

### 3.6 モーダル・オーバーレイパネル

- 背面スクリム `rgba(7, 13, 24, 0.78)`（`--noir-night-deep` ベース）
- 本体: 地 `--noir-shadow`、上辺 2px 琥珀罫、角丸 `--radius-l`、`--shadow-panel`
- 証拠クイック表示・入手パネル・記録照合は本様式に統一。閉じる操作は明示ボタン＋既存の自動消滅時間を維持

### 3.7 タブ（事件ファイル）

- ファイルフォルダの見出しタブ様式: 上辺に並ぶ角丸上のみ `--radius-s` のタブ、非選択=透明地＋ `--text-muted`、選択=地 `--noir-shadow-raised` ＋紙色文字＋下辺 2px `--noir-amber`
- タブ列はモバイルで折り返し、横スクロールを出さない（既存QA要件）

### 3.8 ログ行

- `--leading-dense`。行頭にモード別の左罫 2px（調査=鋼青 / 追及=朱 / 突破=緑 / その他=罫色）
- タイムスタンプ・場所・モード名は `--font-mono` の `--text-xs`、本文は `--font-sans`
- 偶数行に `rgba(232, 226, 212, 0.03)` の地を敷き、帳簿の交互罫を作る

### 3.9 カットイン演出

- 横帯（バンド）様式: 画面中央の帯に決め文字。地は `--noir-night-deep` の半透明、上下辺に琥珀（成功・追及）または朱（信用低下）の 1px 光罫
- 決め文字（「異議あり」「突破」等）は `--font-serif` 700・`--text-display`・`--tracking-display`、副題は `--font-sans`
- グラデは「帯の左右端が闇に溶ける」1方向のみ可。閃光・フラッシュは1回、120ms以内
- 表示尺・自動消滅は既存のJS制御（§2.5）に従い、CSS側で延長しない

## 4. 「ゲームらしさ」の演出原則

ノワール法律事務所の世界観をUIに落とす規範。迷ったら「深夜の事務所で、琥珀のデスクライト1灯の下、紙の調書を読んでいる」かどうかで判定する。

### 4.1 メタファー3点

| メタファー | UIへの落とし方 |
| --- | --- |
| 紙（調書・書面） | パネル=綴じられたファイル。見出しに明朝、本文罫線（`--noir-line-soft` の下線・点線）、証拠タグ、`第N幕` `第N論点` の番号様式 |
| インク | 文字とボーダーが主役。塗り面は最小限にし、枠線・罫線・下線で構造を描く。朱は「赤入れ」の意味を持つ場面（危険・誤答・赤入れメモ）にだけ使う |
| 琥珀光 | 琥珀は「いま光が当たっている場所」。1画面で琥珀塗りボタン1つ・グロー1〜2箇所まで。全部を琥珀にすると光源の意味が消える |

### 4.2 禁止事項

- ガラスモーフィズム（`backdrop-filter: blur` の多用、半透明白パネル）
- 3色以上の多色グラデーション、虹色の影。グラデは「闇への減衰」1方向のみ
- 大面積の純白 `#FFFFFF`（紙は必ず `--noir-paper` の古紙色）
- 彩度の高い青・緑・紫（art-direction §7.2 と同基準）。`--noir-steel` / `--noir-green` の範囲を超えない
- 角丸 12px 超、ピル形状の多用（タグ・チップは角の硬い `--radius-s`）
- UIラベルへの絵文字使用
- 文字を読ませる装飾的な背景画像（生成画像の文字は破綻するため。art-direction §1）

### 4.3 アクセシビリティ下限

- 本文（`--text-main` on `--noir-shadow`）はコントラスト比 4.5:1 以上を維持（紙色×第二の闇は十分満たす）
- `--text-faint` は `--text-l` 以上の大きい字か無効状態にのみ使う
- 状態は色＋文字（チップ文言）の二重符号化。既存チップ文言（「証拠待ち」「整理待ち」等）を削らない
- `prefers-reduced-motion: reduce` 環境で移動を伴うアニメーションを出さない（既存ガード方式を踏襲）

## 5. 既存 global.css への適用方針（移行戦略）

**「ルートのCSS変数を一括導入 → クラス単位で段階的に再塗装」** の2段方式。レイアウト（display / grid / breakpoint 構造）は変えず、色・字・影・罫のプロパティだけを差し替えるのを基本とする。レイアウト変更が必要な画面は `docs/ui-restyle-spec.md` の該当節に列挙されたものに限る。

### 5.1 手順

1. **トークン導入（見た目変化なし）**: `:root` に §2 の全トークンを追加するだけのコミット。既存ルールは触らない。`npm.cmd run build` 成功を確認
2. **ベース一括差し替え**: `:root` の `color` / `background` / `font-family`、`body`、`.app-shell`、`.topbar`、共有面（`.scene-panel` / `.command-panel` / `.work-panel`）、`.primary-button` / `.secondary-button` / `.icon-button`、フォーム要素を `var()` 化して夜間テーマへ反転。この1差分でアプリ全体が「暗い地に読める文字」の整合状態になる
3. **クラス単位の再塗装**: 画面（コンポーネント区画）ごとに、ハードコードHEXをトークンへ置換し §3 の様式を適用。順序と粒度は `docs/ui-restyle-spec.md` §5 のタスク表が正。1タスク=1区画=1差分
4. **最終掃除**: `rg "#[0-9a-fA-F]{3,6}" src/styles/global.css` で残存HEXを洗い、トークン外の直書きを0件にする（SVGプレースホルダ参照等の例外はコメントで明示）

### 5.2 置換対応表（主要な現行値）

| 現行HEX（直書き） | 置換先トークン |
| --- | --- |
| `#eef2f3`（ページ地） | `--noir-night` |
| `#fbfcfc` / `#ffffff`（パネル・ボタン地） | `--noir-shadow`（面）/ 透明＋枠（ボタン） |
| `#1d252c`（本文） | `--text-main` |
| `#53606a` / `#697781`（補足） | `--text-muted` |
| `#ccd5d9` / `#dbe3e6`（枠） | `--noir-line` / `--noir-line-soft` |
| `#7a1f3d`（ワインレッドのアクセント） | 役割で分割: 主要アクション→`--noir-amber`、危険→`--noir-vermilion` |
| `#0f766e`（アイコンのティール） | `--noir-amber`（焦点）または `--noir-steel`（情報） |
| `#d6aa4b` / `#f8d56b` / `#fff7dc`（soundtrack系の金） | `--noir-amber` / `--noir-amber-bright` / `--noir-paper` |
| `#8f1d14`（soundtrack damage） | `--noir-vermilion` |

機械的な一括置換は禁止。`#7a1f3d` のように「主要」と「危険」が混在している色は、クラスの意味を見て振り分ける。

### 5.3 維持事項

- ブレークポイントは既存の `820px` 1本のみ。新設しない。モバイル系の上書きは既存の `@media (max-width: 820px)` ブロック内で行う
- クラス名は原則維持（`tests/playthrough.mjs` がセレクタ参照しているため）。新設クラスは `title-` / `noir-` 等の接頭辞で既存と衝突させない
- `qa-checklist.md`「表示」節の全項目（特に「横にはみ出さない」系）を各タスクの受け入れ基準に含める
