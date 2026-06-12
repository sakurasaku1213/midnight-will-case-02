# アートディレクション仕様書（素材発注書）

全デザインアセットの統一基準。画風は**ノワール調シネマティック**で確定（2026-06-12 ユーザー決定）。生成・差し替え・追加発注はすべて本書を正とする。

> **進捗（2026-06-12）**: §6 の素材は E9（予備）を除く全点を生成・配置・組み込み済み。実際の割り当てで本書と異なる点は2つ — 成功終幕2幕目（ending-motive）は `scene.ed-judgment` ではなく `evidence.scheduled-message` を維持（送信予約メモが「怖くなった理由」そのものを示すため）、`scene.ed-dawn` はエピローグ用の予備として登録のみ。

生成経路の制約（ユーザー指定）: **ChatGPT / Gemini の Web UI をブラウザ操作で使う。従量課金APIは使わない。**

## 1. 画風の核

深夜の法律事務所。事件は派手ではなく、「記録のわずかなズレ」を読む静かな緊張感。絵作りの原則:

- **暗部基調**: 画面の6〜8割は深い藍黒の影。黒つぶれは許容するが、ディテールは琥珀色の光が当たる場所にだけ置く
- **単一の暖色光源**: デスクライト・複合機のLED・モニタなど、光源は画面内に1〜2個。光は琥珀色〜電球色
- **シネマティック**: 映画的なフレーミング（ローキー、浅い被写界深度、ブラインド越しの光条）。劇画寄りのペインタリーな質感で、写真そのものにはしない
- **静けさ**: 人物の感情表現は抑制的に。叫ばない、泣き崩れない。「記録を突きつけられた人の顔」を描く
- **文字を描かせない**: 書面・モニタ内の文字は判読不能なかすれ・ぼかしで処理（生成文字は破綻するため）

## 2. カラーパレット（UI側のデザイントークンと共通）

| 役割 | HEX | 用途 |
| --- | --- | --- |
| 基調（夜の闇） | `#0B1220` | 背景の最暗部、UI地色 |
| 第二の闇 | `#16213A` | 影の中の面、UIパネル |
| 琥珀（キーライト） | `#D9A441` | デスクライト、強調、UIアクセント |
| 琥珀ハイライト | `#F2C879` | 光源中心、ホバー・選択状態 |
| 古紙の白 | `#E8E2D4` | 書面、本文テキスト |
| 朱（赤入れ・危険） | `#B3433C` | 赤入れメモ、信用低下、誤答 |
| 鋼青（記録・デジタル） | `#5C7A99` | モニタ光、ログ系証拠、リンク |
| 成立の緑 | `#5B8A72` | 突破・成立の状態色（控えめに） |

## 3. 共通プロンプト部品

すべての生成プロンプトの先頭に付ける（英語で生成する。日本語プロンプトより安定するため）:

```text
Cinematic noir digital painting, late-night Japanese law office mystery game art.
Deep blue-black shadows (#0B1220), single warm amber key light (#D9A441),
painterly realism with film grain, dramatic chiaroscuro, muted palette,
quiet tension, high detail only in lit areas.
No text, no letters, no watermark, no logo. Any documents or screens show
only illegible blurred marks instead of readable writing.
```

末尾に付ける共通制約:

```text
Constraints: no readable text anywhere; no watermark; single coherent light
source; consistent with a serious legal mystery for adults; no horror gore.
```

## 4. 登場人物の外見設定（全表情差分で厳守）

前作フォルダは本PCに無いため、外見は本書で新規確定する。**同一人物の差分はChatGPT/Geminiの同一スレッド内で「同じ人物のまま表情だけ変更」と指示して生成し、顔・髪・服装・ライティングを固定する。**

| ID | 名前 | 外見の固定設定 |
| --- | --- | --- |
| `assistant` | 主人公（若手弁護士） | 20代後半の日本人女性。黒髪のショートボブ、ネイビーのパンツスーツに白シャツ、ノーネクタイ。疲れと集中が同居する目。化粧は薄く、装飾はなし |
| `lead-lawyer` | 小野寺（主任弁護士） | 50代の日本人男性。白髪まじりの短髪、銀縁眼鏡、チャコールグレーの三つ揃いからベストのみ着用（上着は脱いでいる）。責任を背負う落ち着きと迷い |
| `clerk-a` | 真壁（事務員） | 40代の日本人女性。肩までの黒髪を後ろでまとめる、ベージュのカーディガンに事務服。ベテランの手際と深夜残業の疲労 |
| `client-b` | 久世（依頼者） | 40代の日本人男性。整えた短髪、仕立ての良いダークスーツ、ネクタイ着用。経営者の強気と、隠しきれない不安 |

表情差分の演技指定（トーン別）:

| トーン | 演技 |
| --- | --- |
| neutral | 抑えた無表情。視線はカメラやや外し |
| pressure | 追及される/する緊張。眉と口元に力。視線は正面 |
| damage | 記録を突きつけられた動揺。視線が泳ぐ、口が薄く開く。大げさにしない |
| success | 静かな納得・決着。微かな表情のゆるみ。笑顔にしすぎない |

## 5. カテゴリ別仕様

| カテゴリ | サイズ/比率 | 構図ルール |
| --- | --- | --- |
| 背景（場所） | 1536×1024 横長 | アイレベル〜やや俯瞰。**中央〜下部に調査ポイントの番号ラベルを重ねるため、極端に密な構図にしない**。人物は描かない |
| 証拠品 | 1024×1024 正方形 | 暗い机上に対象物1点を琥珀光で照らす「物撮り」。サムネイル（約96px）でも何の証拠か判別できる形・色にする |
| 人物 | 1024×1536 縦長 | バストアップ、正面〜やや斜め。背景は無地の藍黒グラデーション（UI上で切り抜かずそのまま使う）。ライティングは右上からの琥珀光で全員統一 |
| 幕間CG（OP/ED） | 1536×1024 横長 | 映画のワンカット。人物を入れてよい。本文テキストが下部に重なるため、下1/4は暗めに落とす |
| タイトル | 1536×1024 横長 | ポスター構図。中央上1/3にロゴを置く余白を確保 |

## 6. 素材マニフェスト（全35点）

ファイルは `public/assets/<カテゴリ>/<ファイル名>` に置く。プロンプトは「共通部品＋下記Subject」で1点ずつ生成する。

### 6.1 背景 4点 → `public/assets/locations/`

| # | ファイル | assetKey | Subject（プロンプト中核） |
| --- | --- | --- | --- |
| B1 | `conference-room.png` | `location.conference-room` | Second meeting room of a law office at 0:00 a.m. A shared desktop PC still logged in on a long table, scattered briefs, one amber desk lamp, blinds with faint city light. Empty chairs slightly pulled out. |
| B2 | `records-corner.png` | `location.records-corner` | Records shelf corner: tall steel shelves dense with case files and labeled boxes, a rolling step stool, one aisle lit by a warm ceiling spot, dust in the light beam. |
| B3 | `copy-room.png` | `location.copy-room` | Small copy room: a large multifunction printer with glowing status LEDs, paper stacks, the machine's panel light as main light source, door ajar to a dark corridor. |
| B4 | `reception.png` | `location.reception` | Office reception at night: card reader by the glass door, small visitor terminal on the counter, lobby in darkness, security lamp and card reader LED as lights. |

### 6.2 証拠品 9点 → `public/assets/evidence/`

| # | ファイル | assetKey | Subject |
| --- | --- | --- | --- |
| E1 | `document-stack.png` | `evidence.old-draft` | A thick stack of legal brief drafts on a dark desk, one older version pulled halfway out, pages dense with blurred print, paper edges worn. |
| E2 | `redline-note.png` | `evidence.redline-note` | A single brief page with handwritten red pen circles and a strike-through over one blurred line, red pencil resting beside it. |
| E3 | `phone-note.png` | `evidence.phone-note` | A handwritten phone memo on a small notepad, hurried pen strokes (illegible), a desk phone out of focus behind it. |
| E4 | `printer-log.png` | `evidence.printer-log` | A freshly printed printer job-log sheet emerging from the output tray, rows of blurred entries, one row faintly highlighted by the machine's LED glow. |
| E5 | `file-history.png` | `evidence.file-history` | A dark PC monitor showing a file version-history panel, rows of blurred timestamps, one row glowing slightly, reflection of an empty chair in the screen. |
| E6 | `visitor-card.png` | `evidence.visitor-log` | A visitor card reader terminal with a printed access-log slip beside it, one entry row faintly lit, midnight timestamp implied by darkness. |
| E7 | `email-draft.png` | `evidence.email-draft` | A laptop screen showing an unsent email draft window (blurred text), cursor in an empty subject line, screen glow as the only light. |
| E8 | `scheduled-message.png` | `evidence.scheduled-message` | A smartphone on a dark table showing a scheduled-send message screen (blurred), a small clock icon glowing, hesitant atmosphere. |
| E9 | （予備・任意）`case-folder.png` | — 未割当 | A closed kraft case folder tied with string, evidence tag clipped on, for future UI use. |

### 6.3 人物 14点 → `public/assets/characters/`

同一人物は同一スレッドで連続生成し、`neutral` を最初に作ってから差分を依頼する。

| # | ファイル | assetKey | 内容 |
| --- | --- | --- | --- |
| P1 | `assistant.png` | `character.assistant.neutral` | 主人公 通常 |
| P2 | `assistant-pressure.png` | `character.assistant.pressure` | 主人公 追及（踏み込む目） |
| P3 | `assistant-damage.png` | `character.assistant.damage` | 主人公 再検討（読み違いに気づく） |
| P4 | `assistant-success.png` | `character.assistant.success` | 主人公 突破（静かな手応え） |
| P5 | `lead-lawyer.png` | `character.lead-lawyer.neutral` | 小野寺 通常 |
| P6 | `lead-lawyer-pressure.png` | `character.lead-lawyer.pressure` | 小野寺 追及（職業的な厳しさ） |
| P7 | `lead-lawyer-success.png` | `character.lead-lawyer.success` | 小野寺 解決（苦い納得） |
| P8 | `clerk-a.png` | `character.clerk-a.neutral` | 真壁 通常 |
| P9 | `clerk-a-pressure.png` | `character.clerk-a.pressure` | 真壁 追及（身構える） |
| P10 | `clerk-a-damage.png` | `character.clerk-a.damage` | 真壁 動揺（疑いが外れた後の戸惑い） |
| P11 | `client-b.png` | `character.client-b.neutral` | 久世 通常（強気の建前） |
| P12 | `client-b-pressure.png` | `character.client-b.pressure` | 久世 追及（言い訳を探す） |
| P13 | `client-b-damage.png` | `character.client-b.damage` | 久世 動揺（隠しきれない） |
| P14 | `client-b-success.png` | `character.client-b.success` | 久世 納得（説明責任を受け入れる） |

人物プロンプト例（P1）:

```text
[共通部品] Bust-up portrait of a Japanese woman in her late 20s, a young
lawyer: black short bob hair, navy pantsuit with white shirt, tired but
focused eyes, subtle makeup. Neutral restrained expression, gaze slightly
off-camera. Plain dark blue-black gradient background. Warm amber key light
from upper right. Vertical 2:3 composition. [共通制約]
```

差分依頼例（P2、同一スレッドで続けて）:

```text
Same person, same outfit, same lighting, same background, same framing.
Change only the facial expression: pressing intensity, brows tense,
gaze straight at camera. Keep everything else identical.
```

### 6.4 幕間CG 8点 → `public/assets/scenes/`（新設フォルダ）

`assetRegistry` に `scene.*` キーを新設して割り当てる（実装手順は 7.3）。

| # | ファイル | 新assetKey | 場面 |
| --- | --- | --- | --- |
| S1 | `op-missing-line.png` | `scene.op-missing-line` | 開幕1: 深夜、モニタの新旧書面を見比べ、消えた一文に気づく主人公の横顔 |
| S2 | `op-risk.png` | `scene.op-risk` | 開幕2: 旧版の問題の一文（ぼかし）に赤線、机上の緊張の静物 |
| S3 | `op-resolve.png` | `scene.op-resolve` | 開幕3: 暗い廊下を歩き出す主人公の後ろ姿、先に会議室の灯り |
| S4 | `ed-truth.png` | `scene.ed-truth` | 成功1: 久世がうつむき、主人公が記録を差し出す対峙 |
| S5 | `ed-judgment.png` | `scene.ed-judgment` | 成功2: 小野寺が書面に向き直り、提出判断を固める手元 |
| S6 | `ed-dawn.png` | `scene.ed-dawn` | 成功3: 夜明けの事務所、整った書面の束、窓から朝光 |
| S7 | `ed-fail-records.png` | `scene.ed-fail-records` | 失敗1: 散らばった記録、読み解けないまま積まれた紙の山 |
| S8 | `ed-fail-morning.png` | `scene.ed-fail-morning` | 失敗2: 朝、確信のないまま提出鞄を持つ主人公の影 |

### 6.5 タイトル 1点 → `public/assets/scenes/`

| # | ファイル | 新assetKey | 内容 |
| --- | --- | --- | --- |
| T1 | `title-key-visual.png` | `scene.title` | ポスター構図: 暗い机上の準備書面、1行分だけ空白が琥珀光で浮かぶ。上1/3はロゴ用の闇 |

## 7. 生成と組み込みの運用手順

### 7.1 生成（ブラウザ経由のみ）

1. ログイン済みの Chrome（Defaultプロファイル）で ChatGPT または Gemini を開く
2. ChatGPT の場合は画像生成（GPT-Image系）であることを確認。Gemini の場合は画像生成モードを使用
3. 1スレッド=1カテゴリを原則とし、人物は1スレッド=1人物で差分まで生成
4. 横長は「landscape 3:2」、縦長は「vertical 2:3」、正方形は「square」と明示
5. 生成結果を確認: 文字が読める形で描かれていたら再生成（No text 制約を再掲）
6. ダウンロードして `public/assets/` の所定フォルダへ、本書のファイル名で保存

### 7.2 品質QA（各点共通）

- パレットが §2 の範囲に収まっている（彩度の高い青・緑・紫が支配しない）
- 光源が1〜2個で方向が一貫している
- 読める文字・透かし・署名が無い
- サムネイルサイズ（96px）で内容が判別できる（証拠品）
- 同一人物の差分で顔・髪・服が変わっていない（人物）

### 7.3 組み込み

1. `src/game/assets.ts` の該当キーの `src` を新ファイルへ変更（背景・証拠・人物）
2. 幕間CG・タイトルは `assetRegistry` に `scene.*` キーを追加し、`data/episode-02.json` の `openingScenes` / `endings.*.scenes` の `assetKey` を差し替え、タイトル画面実装（`docs/ui-restyle-spec.md`）から参照する
3. `npm.cmd run validate:episode` エラー0件 → `npm.cmd run build` → 該当画面の表示確認（デスクトップ/モバイル）
4. 旧プレースホルダSVGは、全差し替え完了までは削除しない（参照切れ防止）。完了後にまとめて削除する

## 8. 再発注・追加発注のルール

- 画風がぶれた場合は §3 の共通部品を必ず再掲して再生成する
- 新キャラ・新場所を追加する場合は、本書 §4 / §6 に行を追加してから生成する
- 本書のプロンプトを変更した場合は、同カテゴリの既存素材との統一感を確認する
