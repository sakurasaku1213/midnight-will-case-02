# データ仕様書（data/episode-02.json）

シナリオJSONのスキーマ、ID・フラグの命名規則、フラグ辞書、正解ルート、整合性ルールを定める。型の正は `src/game/types.ts` の `Episode` 型。この文書は型に「意味」と「現在値」を補うもの。

変更後は必ず `npm.cmd run validate:episode` → `npm.cmd run build` を通すこと。

## トップレベル構造

| キー | 現在の規模 | 役割 |
| --- | --- | --- |
| `id` / `caseNumber` / `title` / `subtitle` | `case-02` | エピソード識別。`id` はセーブの `episodeId` と一致させる |
| `startLocationId` | `conference-room` | 開始地点 |
| `finalFlag` | `final_unlocked` | このフラグが立つと自動で争点整理モードへ遷移する |
| `premise` | 文配列 | 開始時の導入文。先頭がメイン本文の初期値 |
| `openingScenes` | 3幕 | 開幕の幕送り（`StoryScene`） |
| `progressBeats` | 7件 | 進行の節目表示。`flag` の取得有無で進捗を出す |
| `characters` | 4人 | 登場人物と表情差分キー |
| `evidence` | 8点 | 証拠品 |
| `timeline` | 4件 | 時系列イベント。`evidenceIds` で裏付け証拠を紐付け |
| `locations` | 4箇所 | 場所と調査アクション |
| `talks` | 5件 | 会話トピック |
| `presentReactions` | 4件 | 証拠提示の正解組み合わせ |
| `analysisLinks` | 3件 | 争点整理（証拠2点の組み合わせ） |
| `hearing` | 証言3・矛盾2 | 対決 |
| `deduction` | 4問 | 最終推理 |
| `caseBoard` | 論点4 | 事件ファイルの論点タブ（誰・理由・機会・決め手） |
| `caseReview` | — | クリア後の事件解剖の本文 |
| `productionMaterials` | 6カード | クリア後の制作資料 |
| `endings` | 成功3幕・失敗2幕 | 終幕 |

## 共通の仕組み（InteractionEffect）

`locations[].actions` / `talks` / `presentReactions` / `analysisLinks` / `hearing.contradictions` は同じ効果フィールドを共有する:

| フィールド | 意味 |
| --- | --- |
| `text` | 実行時にメイン本文へ出す文章 |
| `addEvidence` | 取得する証拠ID配列 |
| `setFlags` | 立てるフラグ配列 |
| `requiresFlags` | 実行（表示解放）に必要なフラグ配列 |
| `log` | 行動ログへ残す短文 |
| `speakerId` / `tone` | 話者と演出トーン（表情差分・効果音・色に影響） |
| `once` | 省略時は1回限り。`false` で繰り返し実行可 |

セクション固有のフィールド:

- `talks[]`: `characterId`（話し相手）、`availableAt`（聞ける場所ID配列）
- `presentReactions[]`: `characterId` + `evidenceId` の組が「正解の提示」。一覧にない組み合わせは誤提示扱いで信用−1
- `analysisLinks[]`: `evidenceIds`（並べる証拠2点）、`prompt`（問いの文章）。誤った組み合わせは信用−1
- `hearing.statements[]`: `pressText`（詳しく聞いた時の補足）、`pressFlag`（聞いた記録として立つフラグ）、`note`（読み筋）
- `hearing.contradictions[]`: `statementId` + `evidenceId` の組が「正しい矛盾指摘」。`requiresFlags` で2段階の順番を強制する
- `deduction.questions[]`: `answer`（正解の選択肢ID）、`evidenceAnswer`（正解の根拠証拠ID）、`opponentClaim` / `rebuttal` / `wrongHint`（反論ステージの文章）

## ID・キーの命名規則

- すべて小文字ケバブケース
- 場所アクション: `inspect-*`、会話: `talk-*`、整理: `link-*`、証言: `statement-*`、進行節目: `beat-*`、論点: `board-*`
- `assetKey`: `種別.名前(.トーン)`（例: `location.copy-room`、`character.client-b.pressure`）。実ファイルパスはJSONに書かず `src/game/assets.ts` の `assetRegistry` で解決する

## 登場人物と証拠（現在値）

| characterId | 名前 | 役割 |
| --- | --- | --- |
| `assistant` | 主人公 | 若手弁護士（プレイヤー視点） |
| `lead-lawyer` | 小野寺 | 主任弁護士。ログイン名のミスリード元 |
| `clerk-a` | 真壁 | 事務員。深夜印刷で最初に疑われる |
| `client-b` | 久世 | 依頼者。真犯人（一文を削除した人物） |

| evidenceId | 名称 | 入手方法 |
| --- | --- | --- |
| `old-draft` | 準備書面旧版 | 会議室 `inspect-old-draft` |
| `redline-note` | 赤入れメモ | 会議室 `inspect-redline` |
| `file-history` | ファイル更新履歴 | 会議室 `inspect-file-history`（要 `saw_old_draft`） |
| `phone-note` | 電話聴取メモ | 記録棚 `inspect-phone-note`（要 `saw_old_draft`） |
| `printer-log` | プリンタ履歴 | コピー室 `inspect-printer-log` |
| `visitor-log` | 来訪カード履歴 | 受付前 `inspect-visitor-log` |
| `email-draft` | メール下書き | 受付前 `inspect-mail-draft`（要 `saw_file_history` + `saw_visitor_log`） |
| `scheduled-message` | 送信予約メモ | **久世に `email-draft` を提示した時に同時入手** |

## フラグ辞書（全26）

「立つ場所」はデータ内の操作。「参照」は requiresFlags での後続解放（→）とエンジン（AppShell）参照（◆）。

### 調査（saw_*）

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `saw_old_draft` | 会議室: 旧版を調べる | → 更新履歴・電話聴取メモの解放、progressBeat |
| `saw_redline` | 会議室: 赤入れメモを調べる | → 小野寺との「危険性」会話 |
| `saw_file_history` | 会議室: 更新履歴を調べる | → メール下書き解放、小野寺との「PC」会話、論点「誰」 |
| `saw_phone_note` | 記録棚: 電話聴取メモを調べる | → 「危険性」会話、整理 link-sentence-risk |
| `saw_printer_log` | コピー室: プリンタ履歴を調べる | → 真壁との会話 |
| `saw_visitor_log` | 受付前: 来訪カード履歴を調べる | → メール下書き解放、真壁「来訪」会話、整理 link-time-window |
| `saw_email_draft` | 受付前: メール下書きを調べる | → 久世への email-draft 提示 |

### 会話

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `understood_sentence_risk` | 小野寺: 一文の危険性を聞く | → 久世との会話、progressBeat |
| `unlocked_pc_known` | 小野寺: 共用PCのログイン状態を聞く | → 久世への visitor-log 提示 |
| `clerk_alibi` | 真壁: 深夜印刷の説明を聞く | → 「来訪」会話、真壁への printer-log 提示、progressBeat |
| `client_route_confirmed` | 真壁: 来訪者の動きを聞く | → 久世への email-draft 提示、progressBeat |
| `client_pressure` | 久世: 一文への執着を聞く | → 久世への old-draft 提示 |

### 証拠提示（present）

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `printer_mislead_cleared` | 真壁 + printer-log | なし（ミスリード解消の記録。任意行動） |
| `client_knows_risk` | 久世 + old-draft | → 次の提示、◆章マップの提示進捗 |
| `client_visit_confirmed` | 久世 + visitor-log | → 最終提示、◆章マップの提示進捗 |
| `final_unlocked` | 久世 + email-draft（scheduled-message 同時入手） | ◆ `finalFlag`。争点整理へ自動遷移、対決解放の前提、焦点ガイド |

### 争点整理（analysis）

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `analysis_sentence_risk` | 整理: old-draft + phone-note | → 論点「理由」、◆章マップ・焦点ガイド |
| `analysis_time_window` | 整理: visitor-log + file-history | ◆章マップ・焦点ガイド |
| `analysis_final_chain` | 整理: email-draft + scheduled-message（要 `final_unlocked`） | ◆章マップ |
| `analysis_complete` | 上記 link-final-chain と同時 | ◆対決解放の条件、整理完了表示 |

### 対決（hearing）

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `pressed_visit_only` | 証言1「様子を見に行っただけ」を詳しく聞く | なし（ゆさぶり記録。任意行動） |
| `pressed_no_edit` | 証言2「PCには触っていない」を詳しく聞く | → 矛盾1の前提、◆章マップ |
| `pressed_later_fear` | 証言3「怖くなったのは後から」を詳しく聞く | → 矛盾2の前提、◆章マップ |
| `hearing_pc_contradiction` | 矛盾1: 証言2 × file-history | → 矛盾2の前提、論点「機会」、◆章マップ |
| `hearing_cleared` | 矛盾2: 証言3 × scheduled-message | ◆推理解放の条件、論点「決め手」、`hearing.requiredFlag` |

### エンジン専用

| フラグ | 立つ場所 | 参照 |
| --- | --- | --- |
| `case_cleared` | 成功エンド到達時に AppShell が立てる（JSONには存在しない） | ◆事件解剖の解放、焦点ガイド |

## 正解ルート（依存グラフの一本道）

`tests/playthrough.mjs` の `clearedFlags` と同じ到達順。QA時の最短手順でもある。

1. 会議室: 旧版 → 赤入れメモ → 更新履歴を調べる
2. 記録棚: 電話聴取メモを調べる
3. 小野寺に「危険性」「共用PC」を聞く
4. コピー室: プリンタ履歴を調べ、真壁に説明を聞く（ミスリード切り分け）
5. 受付前: 来訪カード履歴を調べ、真壁に来訪者の動きを聞く
6. 受付前: メール下書きを調べる
7. 久世に聞く → old-draft 提示 → visitor-log 提示 → email-draft 提示（`final_unlocked`、送信予約メモ入手、自動で整理へ）
8. 整理3件: 旧版+電話聴取 / 来訪+更新履歴 / 下書き+送信予約（`analysis_complete`）
9. 対決: 証言2を詳しく聞く → file-history で矛盾1 → 証言3を詳しく聞く → scheduled-message で矛盾2（`hearing_cleared`）
10. 最終推理4問: `client-b` / `counterattack-risk` / `shared-pc` / `email-history-visitor` ＋ 根拠証拠 `visitor-log` / `phone-note` / `file-history` / `scheduled-message`

## 整合性ルールと validator 警告の扱い

`npm.cmd run validate:episode` が検査するもの:

- ID重複、`characterId` / `evidenceId` / `addEvidence` / `evidenceAnswer` / `availableAt` の未定義参照
- 要求されるのにどこでも set されないフラグ（**エラー**）
- set されるのにどこからも参照されないフラグ（**警告**）
- `image` / `portrait` に解決された素材ファイルの実在

**既知の警告5件（仕様として正常）:**

| フラグ | 警告の理由 |
| --- | --- |
| `analysis_time_window` / `analysis_final_chain` / `analysis_complete` | JSON内ではなく AppShell（エンジン）が参照するため validator から見えない |
| `printer_mislead_cleared` / `pressed_visit_only` | 任意行動の記録用。現状どこからも参照しない設計 |

validator が検査**できない**もの: エンジン参照フラグの綴り（リネーム時は `src/app/AppShell.tsx` も grep する）、正解ルートの到達可能性（`test:playthrough` と手動QAで担保）。

## 変更時の手順

1. 物語の整合は `docs/case-02-outline.md`（真相・ミスリード）と `docs/story-bible.md`（トーン）に合わせる
2. フラグ・証拠を追加したらこの文書のフラグ辞書と入手表も更新する
3. `npm.cmd run validate:episode` エラー0件を確認（新たな警告が出たら上の表に追記するか設計を見直す）
4. `npm.cmd run build` → 進行に関わる変更は `npm.cmd run test:playthrough`
