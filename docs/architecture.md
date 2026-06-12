# 技術設計書

コード構成、状態モデル、画面遷移、素材解決、検証ツールの設計を定める。プレイヤー体験レベルの機能仕様は `docs/production-spec.md`、データの中身は `docs/data-spec.md` を正とする。

## 全体像

データ駆動型のADV。シナリオ・分岐・正解はすべて `data/episode-02.json` に置き、実装側は薄いゲームエンジンとして動く。

```text
data/episode-02.json
        │  import
        ▼
src/game/episode.ts ── hydrateEpisodeAssets()（assets.ts: assetKey → 実ファイルパス解決）
        │
        ▼
src/app/AppShell.tsx（全画面の合成・操作ハンドリング）
        │  状態更新は純関数を呼ぶ
        ▼
src/game/logic.ts（GameState 生成・更新・信用判定・保存境界）
        │
        ▼
localStorage（自動保存）
```

## モジュール構成と責務

| パス | 責務 |
| --- | --- |
| `src/main.tsx` / `src/App.tsx` | エントリのみ。機能を足さない |
| `src/app/AppShell.tsx` | 全モードの画面合成、コマンド解放判定、演出（カットイン・記録照合・効果音呼び出し）。約1万行・約100個の内部コンポーネント関数で構成 |
| `src/components/LocationScene.tsx` | 現場画像の上に番号付き調査ポイントを重ねる再利用UI |
| `src/components/ProgressTrail.tsx` | `progressBeats` ベースの進行表示 |
| `src/game/types.ts` | データ契約。`Episode` 型がシナリオJSONのスキーマ定義そのもの |
| `src/game/logic.ts` | `GameState` の生成・更新の純関数群と保存境界（下記） |
| `src/game/assets.ts` | `assetRegistry`（素材スロット27件＋生成ブリーフ）と解決関数 |
| `src/game/audio.ts` | Web Audio による生成効果音（外部音源なし） |
| `src/game/portraits.ts` | 話者ID＋トーン → 表情差分画像の解決 |

### AppShell.tsx 内部の区画

単一ファイルだが、コンポーネント関数は役割ごとに固まっている。修正時は対象区画だけ触る。

- 音響・設定: `AudioControls` `SoundtrackPanel`
- 演出: `CutIn` `ImpactBurst` `EvidenceClash`（カットイン・異議あり演出・記録照合）
- 進行支援: `CommandBar` `CaseDirector` `CaseMap` `FocusActionCard` `ConsultPanel` `SessionBookmark` `TheoryProgressCard`
- 調査・移動・会話・提示: `MovePanel` `InspectPanel` `InvestigationMemo` `TalkPanel` `PresentPanel`（＋ `PresentPressureBoard` 等の補助）
- 争点整理: `AnalysisPanel` `AnalysisChainBoard`
- 対決: `HearingPanel` ほか `Hearing*` 群（証言送り・照合レーン・提出前チェック・崩し順メモ等）
- 最終推理: `DeductionPanel` ほか `Deduction*` / `FinalSummationPanel` / `FinalEvidenceChain`
- 事件ファイル: `CaseFilePanel` `EvidenceFile` `EvidenceDetail` `PeopleFile` `TimelineFile` `TestimonyFile`（＋照合ノート・記録相関図）
- 開幕・終幕・クリア後: `StoryStagePanel` `EndingResultPanel` `VerdictScenePanel`（事件解剖・制作資料パネル群）

## 状態モデル

### GameState（`src/game/types.ts`）

| フィールド | 役割 |
| --- | --- |
| `episodeId` | セーブとエピソードの対応付け。ID不一致のセーブは読み込まない |
| `mode` | 現在の画面（ViewMode、下記） |
| `currentLocationId` | 現在地 |
| `narrative` / `speakerId` / `tone` | メイン本文と話者・演出トーン |
| `credibility` | 信用ゲージ。最大 `MAX_CREDIBILITY = 5`。0で失敗エンド |
| `evidenceIds` | 取得済み証拠ID集合（重複なし追加） |
| `flags` | 進行フラグ集合（重複なし追加。削除はしない） |
| `log` | 短い行動ログ（文字列配列） |
| `history` | 詳細履歴（話者・場所・モード・トーン・取得証拠つき）。最大120件に切り詰め |
| `completedInteractionIds` | 消費済みインタラクション（`once: false` 以外は1回限り） |
| `endingId` | `'success'` / `'failure'`。終幕分岐 |

### 状態更新の原則

- 更新は `logic.ts` の純関数（`applyInteraction` / `applyCredibilityPenalty` 等）を通す。AppShell 側で `flags` や `evidenceIds` を直接書き換える処理を新設しない
- `applyInteraction` は `finalFlag`（= `final_unlocked`）が立った瞬間にモードを `analysis` へ送る
- 誤提示・誤整理・誤指摘・誤推理は `applyCredibilityPenalty` で信用を1下げ、0になった時点で失敗エンドへ送る

### 保存仕様

| キー | 内容 |
| --- | --- |
| `midnight-will-case-02:save:v1` | `GameState` 全体（JSON）。操作のたびに自動保存 |
| `midnight-will-case-02:audio:v1` | 効果音オン/オフ・音量・演出テンポ |

- 読み込み時に `episodeId` 不一致なら破棄して新規開始
- 旧形式セーブは `normalizeHistory` で `log` から `history` を補完（後方互換の前例。フィールド追加時はここで既定値を埋める）
- 記録照合パネル・カットイン・入手通知などの一時UIは保存対象に含めない

## ViewMode と解放条件

`ViewMode` は14種。コマンドバーに並ぶのは10種で、解放条件はAppShell内の `CommandBar` 周辺（コマンド状態判定）に実装されている。仕様レベルの正は `production-spec.md` の「コマンド導線」。

| モード | コマンド | 解放条件 |
| --- | --- | --- |
| `briefing` | （開幕） | 起動直後。スキップ可、途中から調査開始可 |
| `move` / `inspect` / `talk` | 移動・調べる・話す | 常時 |
| `present` | 見せる | 証拠1点以上 |
| `analysis` | 整理する | 証拠2点以上 |
| `hearing` | 対決 | `final_unlocked` と `analysis_complete` の両方 |
| `deduction` | 推理する | `hearing_cleared` |
| `evidence` / `log` | 事件ファイル・ログ | 常時 |
| `review` | 事件解剖 | 成功エンド後（`endingId === 'success'` または `case_cleared`） |
| `consult` | （相談メモ） | コマンドには並べず「現在の焦点」から開く |
| `materials` | （制作資料） | 事件解剖からのみ入る |
| `ending` | （終幕） | 推理成立 or 信用切れで遷移 |

- disabled 表示と実際の遷移可否は同じ条件を共有する（「押せる見た目なのに進まない」を作らない）
- 「証拠待ち」「整理待ち」「対決待ち」などの状態チップ文言もここで決まる

## フラグシステム

進行はすべて文字列フラグの集合で表現する。フラグの一覧と意味は `docs/data-spec.md` のフラグ辞書を正とする。設計上の要点:

- データ内で完結するフラグ（`requiresFlags` で互いに参照）と、**エンジンが直接参照するフラグ**の2種類がある
- エンジン参照フラグ: `final_unlocked`（=`finalFlag`）、`analysis_sentence_risk` / `analysis_time_window` / `analysis_final_chain` / `analysis_complete`、`pressed_no_edit` / `hearing_pc_contradiction` / `pressed_later_fear`、`hearing_cleared`、`case_cleared`。これらは AppShell がコマンド解放・章マップ・焦点ガイドの判定にハードコードで使う
- `case_cleared` はJSONには存在せず、成功エンド到達時に AppShell が立てるエンジン専用フラグ
- **フラグをリネームする場合は `data/episode-02.json` と `src/app/AppShell.tsx` の両方を grep して全箇所を直す**

## 素材パイプライン

- シナリオJSONは実ファイルパスを持たず、`assetKey`（例: `evidence.old-draft`）だけを持つ
- `src/game/assets.ts` の `assetRegistry` がキー → `{src, label, kind, priority, brief}` を一元管理（現在27スロット: 背景4・証拠9・人物14）
- 起動時に `hydrateEpisodeAssets` が `assetKey` を既存UI互換の `image` / `portrait` フィールドへ解決する
- 高品質画像への差し替えは、`public/assets/` に新ファイルを置いて `assetRegistry` の `src` を書き換えるだけ。JSONは触らない
- `brief` フィールドは画像生成用の発注メモ。差し替え時の生成プロンプトの素として使う
- 開幕/終幕シーンは現状、場所・証拠のキーを共用している。専用CGを作る場合はレジストリにキーを追加してからJSONの `assetKey` を差し替える（backlog 参照）

## 演出・音響

- 効果音は `src/game/audio.ts` が Web Audio で生成（外部音源ファイルなし）。証拠取得・追及・突破・信用低下・選択で音色を変える
- 設定（オン/オフ・音量・テンポ）は `midnight-will-case-02:audio:v1` に保存
- カットインは約900msで自動消滅し操作を塞がない。`prefers-reduced-motion` で強いモーションを抑制する
- 表情差分は `portraits.ts` が `speakerId` ＋ `tone`（neutral / investigation / success / pressure / damage）から解決する

## 検証ツールとCI

| ツール | 内容 |
| --- | --- |
| `scripts/validate-episode.mjs` | JSONの参照整合性チェック。ID重複、`characterId` / `evidenceId` / `addEvidence` / `evidenceAnswer` / `availableAt` の未定義参照、「要求されるが set されないフラグ」（エラー）、「set されるが参照されないフラグ」（警告）、素材パスの実在を検査 |
| `tests/playthrough.mjs` | playwright-core ＋ ローカルChrome で実プレイを自動操作。localStorage に検証用 `GameState` を直接書き込んで任意の進行状態を作り、デスクトップ/モバイルのスクリーンショットを `.codex/screenshots/` へ保存、主要パネルの表示を assert する |
| `.github/workflows/build.yml` | main への push / PR で `npm install` → `npm run build`（Node 24） |

validator は「エンジン参照フラグ」と「正解ルートの到達可能性」を検査できない。前者は警告として現れ（既知5件、`data-spec.md` 参照）、後者は `test:playthrough` と手動QA（`qa-checklist.md`）で担保する。
