# 素材方針

## 置き場所

```text
public/assets/characters/   人物立ち絵、顔アイコン
public/assets/evidence/     証拠品画像
public/assets/locations/    事務所背景、コピー室、受付
public/assets/audio/        将来の本素材SE、環境音
```

## 初期優先度

1. 背景4点: 第2会議室、記録棚、コピー室、受付前
2. 証拠画像8点: 旧版、赤入れメモ、電話聴取メモ、更新履歴、来訪カード履歴、メール下書き、送信予約メモ、プリンタ履歴
3. 人物アイコン4点: 主任弁護士、事務員、依頼者、主人公
4. 開幕/終幕の専用絵: 提出前夜、記録棚、真相、提出判断
5. 音響: 現段階はWeb Audio生成音。本素材化する場合はコマンド、証拠取得、追及、突破、信用低下を差し替える

## 命名規則

- 小文字英数字とハイフンのみ
- 例: `conference-room-night.webp`
- データ側にはファイル名を直接散らさず、`assetKey` で参照する
- 実ファイルのパス、素材カテゴリ、生成ブリーフは `src/game/assets.ts` の `assetRegistry` に集約する
- 高品質画像へ差し替える時は、`assetRegistry` の `src` をPNG/WebPへ向けるか、同じキーのまま参照先だけを更新する

## 生成素材の注意

画像生成を使う場合は、このPCの上位ルールに従い `gpt-image-2` を確認できる経路だけを使う。

## 現在の状態（2026-06-12 更新）

本番素材への差し替えと配布軽量化は完了した。PNG原本は `assets-src/locations/`（4点）、`evidence/`（8点）、`characters/`（14点）、`scenes/`（幕間CG8点＋タイトル1点）に保管し、配信用の `public/assets/` はWebPのみを置く。`assetRegistry` は WebP を参照し `scene.*` 9キーを含む計35キーになっている。画風・各素材の発注内容・再発注手順は `docs/art-direction.md` を正とする。

生成は ChatGPT Web UI（ログイン済みブラウザ操作）で行った。従量課金APIは使用していない。旧プレースホルダSVGはD1で削除済み（backlog T11）。効果音は引き続きWeb Audio生成音。
