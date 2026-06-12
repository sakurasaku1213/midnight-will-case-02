import type { Character, Episode, Evidence, Location, MessageTone, StoryScene } from './types';

export type AssetKind = 'location' | 'evidence' | 'character' | 'scene';

export interface AssetSlot {
  src: string;
  label: string;
  kind: AssetKind;
  priority: number;
  brief: string;
}

export const assetRegistry = {
  'location.conference-room': {
    src: '/assets/locations/conference-room.png',
    label: '第2会議室',
    kind: 'location',
    priority: 1,
    brief: '深夜の法律事務所、共用PC、提出前夜の緊張が読める背景。',
  },
  'location.records-corner': {
    src: '/assets/locations/records-corner.png',
    label: '記録棚',
    kind: 'location',
    priority: 1,
    brief: '事件記録と聴取メモが残る棚。紙資料の密度と探索感を優先する。',
  },
  'location.copy-room': {
    src: '/assets/locations/copy-room.png',
    label: 'コピー室',
    kind: 'location',
    priority: 1,
    brief: '複合機の履歴と深夜印刷の違和感が見える小部屋。',
  },
  'location.reception': {
    src: '/assets/locations/reception.png',
    label: '受付前',
    kind: 'location',
    priority: 1,
    brief: 'カードリーダーと来訪端末が目に入る、暗い受付前の背景。',
  },
  'evidence.old-draft': {
    src: '/assets/evidence/document-stack.png',
    label: '準備書面旧版',
    kind: 'evidence',
    priority: 2,
    brief: '旧版と最新版の差分が想像できる紙束。赤字なしでも重要証拠だと分かる構図。',
  },
  'evidence.redline-note': {
    src: '/assets/evidence/redline-note.png',
    label: '赤入れメモ',
    kind: 'evidence',
    priority: 2,
    brief: '削除された一文と危険性の指摘が、サムネイルでも赤入れ資料として読める証拠。',
  },
  'evidence.phone-note': {
    src: '/assets/evidence/phone-note.png',
    label: '電話聴取メモ',
    kind: 'evidence',
    priority: 2,
    brief: '相手名と日付の曖昧さが残る、手書き感のある電話聴取メモ。',
  },
  'evidence.printer-log': {
    src: '/assets/evidence/printer-log.png',
    label: 'プリンタ履歴',
    kind: 'evidence',
    priority: 2,
    brief: '複合機の印刷ログ。ミスリード証拠として時刻だけが強く見える画面。',
  },
  'evidence.file-history': {
    src: '/assets/evidence/file-history.png',
    label: 'ファイル更新履歴',
    kind: 'evidence',
    priority: 2,
    brief: '共有PC上の保存時刻とユーザー名を想起できる、デジタルログ系の証拠。',
  },
  'evidence.visitor-log': {
    src: '/assets/evidence/visitor-card.png',
    label: '来訪カード履歴',
    kind: 'evidence',
    priority: 2,
    brief: '深夜来訪の足跡。カードリーダーの無機質な記録が中心になる証拠。',
  },
  'evidence.email-draft': {
    src: '/assets/evidence/email-draft.png',
    label: 'メール下書き',
    kind: 'evidence',
    priority: 2,
    brief: '削除理由が残った未送信メール。スマホまたはPCの下書き画面として成立させる。',
  },
  'evidence.scheduled-message': {
    src: '/assets/evidence/scheduled-message.png',
    label: '送信予約メモ',
    kind: 'evidence',
    priority: 2,
    brief: '削除後に説明するつもりだった予約メモ。時刻とためらいが読める証拠。',
  },
  'character.lead-lawyer.neutral': {
    src: '/assets/characters/lead-lawyer.png',
    label: '小野寺 弁護士 通常',
    kind: 'character',
    priority: 3,
    brief: '提出判断の責任を背負う主任弁護士。落ち着きと迷いを同居させる。',
  },
  'character.lead-lawyer.pressure': {
    src: '/assets/characters/lead-lawyer-pressure.png',
    label: '小野寺 弁護士 追及',
    kind: 'character',
    priority: 3,
    brief: '記録の危険性に踏み込む表情。厳しさを出しすぎず、職業的な緊張を優先する。',
  },
  'character.lead-lawyer.success': {
    src: '/assets/characters/lead-lawyer-success.png',
    label: '小野寺 弁護士 解決',
    kind: 'character',
    priority: 3,
    brief: '提出判断を固めた後の静かな納得。派手な笑顔より責任感を残す。',
  },
  'character.clerk-a.neutral': {
    src: '/assets/characters/clerk-a.png',
    label: '真壁 事務員 通常',
    kind: 'character',
    priority: 3,
    brief: '最初に疑われる事務員。疲れと緊張があるが、犯人らしさに寄せすぎない。',
  },
  'character.clerk-a.pressure': {
    src: '/assets/characters/clerk-a-pressure.png',
    label: '真壁 事務員 追及',
    kind: 'character',
    priority: 3,
    brief: '深夜印刷を問われて身構える表情。ミスリードの圧を出す。',
  },
  'character.clerk-a.damage': {
    src: '/assets/characters/clerk-a-damage.png',
    label: '真壁 事務員 動揺',
    kind: 'character',
    priority: 3,
    brief: '疑いが外れた後の戸惑い。弱さと安心が混ざる表情。',
  },
  'character.client-b.neutral': {
    src: '/assets/characters/client-b.png',
    label: '久世 依頼者 通常',
    kind: 'character',
    priority: 3,
    brief: '有利な一文を求めた依頼者。強気だが、内心の不安を隠している。',
  },
  'character.client-b.pressure': {
    src: '/assets/characters/client-b-pressure.png',
    label: '久世 依頼者 追及',
    kind: 'character',
    priority: 3,
    brief: '来訪と更新履歴を突きつけられ、言い訳を探している表情。',
  },
  'character.client-b.damage': {
    src: '/assets/characters/client-b-damage.png',
    label: '久世 依頼者 動揺',
    kind: 'character',
    priority: 3,
    brief: '削除の理由を隠しきれなくなった瞬間。大げさすぎない崩れ方にする。',
  },
  'character.client-b.success': {
    src: '/assets/characters/client-b-success.png',
    label: '久世 依頼者 納得',
    kind: 'character',
    priority: 3,
    brief: '説明責任を受け入れた表情。勝利感ではなく、苦い納得を出す。',
  },
  'character.assistant.neutral': {
    src: '/assets/characters/assistant.png',
    label: '主人公 通常',
    kind: 'character',
    priority: 3,
    brief: '若手弁護士として記録を読む主人公。プレイヤーの視点に近い冷静さ。',
  },
  'character.assistant.pressure': {
    src: '/assets/characters/assistant-pressure.png',
    label: '主人公 追及',
    kind: 'character',
    priority: 3,
    brief: '矛盾へ踏み込む表情。異議ありの勢いと法律実務の落ち着きを両立する。',
  },
  'character.assistant.damage': {
    src: '/assets/characters/assistant-damage.png',
    label: '主人公 再検討',
    kind: 'character',
    priority: 3,
    brief: '読み違いに気づいた表情。失敗しても次の記録へ戻れる雰囲気を残す。',
  },
  'character.assistant.success': {
    src: '/assets/characters/assistant-success.png',
    label: '主人公 突破',
    kind: 'character',
    priority: 3,
    brief: '証拠の鎖がつながった瞬間。派手すぎない達成感を出す。',
  },
  'scene.op-missing-line': {
    src: '/assets/scenes/op-missing-line.png',
    label: '開幕1 消えた一文',
    kind: 'scene',
    priority: 4,
    brief: '深夜、新旧書面を見比べて消えた一文に気づく主人公の横顔。',
  },
  'scene.op-risk': {
    src: '/assets/scenes/op-risk.png',
    label: '開幕2 危うい一文',
    kind: 'scene',
    priority: 4,
    brief: '赤丸の付いた旧版書面と冷めたコーヒー。緊張の静物。',
  },
  'scene.op-resolve': {
    src: '/assets/scenes/op-resolve.png',
    label: '開幕3 初動',
    kind: 'scene',
    priority: 4,
    brief: '暗い廊下を会議室の灯りへ歩き出す主人公の後ろ姿。',
  },
  'scene.ed-truth': {
    src: '/assets/scenes/ed-truth.png',
    label: '成功終幕1 真相',
    kind: 'scene',
    priority: 4,
    brief: '記録を差し出す主人公と、目を伏せる久世の対峙。',
  },
  'scene.ed-judgment': {
    src: '/assets/scenes/ed-judgment.png',
    label: '成功終幕3 提出判断',
    kind: 'scene',
    priority: 4,
    brief: '小野寺が訂正済み書面に署名する手元。判断の重さ。',
  },
  'scene.ed-dawn': {
    src: '/assets/scenes/ed-dawn.png',
    label: '成功終幕 予備 夜明け',
    kind: 'scene',
    priority: 5,
    brief: '夜明けの事務所と整えられた書面の束。エピローグ用の予備。',
  },
  'scene.ed-fail-records': {
    src: '/assets/scenes/ed-fail-records.png',
    label: '不成立終幕1 散らばる記録',
    kind: 'scene',
    priority: 4,
    brief: '読み解けないまま散乱した記録。冷たい青が支配する。',
  },
  'scene.ed-fail-morning': {
    src: '/assets/scenes/ed-fail-morning.png',
    label: '不成立終幕2 確信のない朝',
    kind: 'scene',
    priority: 4,
    brief: '灰色の朝、鞄を持ち事務所を出る主人公の後ろ姿。',
  },
  'scene.title': {
    src: '/assets/scenes/title-key-visual.png',
    label: 'タイトルキービジュアル',
    kind: 'scene',
    priority: 4,
    brief: '一行分だけ琥珀色に光る空白を残した書面のポスター構図。上1/3はロゴ用の闇。',
  },
} as const satisfies Record<string, AssetSlot>;

export type AssetKey = keyof typeof assetRegistry;

export function resolveAsset(assetKey?: string, fallback?: string): string | undefined {
  if (!assetKey) return fallback;
  return assetRegistry[assetKey as AssetKey]?.src ?? fallback;
}

export function getAssetRegistryStats() {
  const assets = Object.values(assetRegistry);
  return {
    total: assets.length,
    locations: assets.filter((asset) => asset.kind === 'location').length,
    evidence: assets.filter((asset) => asset.kind === 'evidence').length,
    characters: assets.filter((asset) => asset.kind === 'character').length,
    scenes: assets.filter((asset) => asset.kind === 'scene').length,
  };
}

export function hydrateEpisodeAssets(episode: Episode): Episode {
  return {
    ...episode,
    openingScenes: hydrateScenes(episode.openingScenes),
    characters: episode.characters.map(hydrateCharacter),
    evidence: episode.evidence.map(hydrateEvidence),
    locations: episode.locations.map(hydrateLocation),
    endings: {
      success: {
        ...episode.endings.success,
        scenes: hydrateScenes(episode.endings.success.scenes),
      },
      failure: {
        ...episode.endings.failure,
        scenes: hydrateScenes(episode.endings.failure.scenes),
      },
    },
  };
}

function hydrateScenes(scenes?: StoryScene[]): StoryScene[] | undefined {
  return scenes?.map((scene) => ({
    ...scene,
    image: resolveAsset(scene.assetKey, scene.image),
  }));
}

function hydrateLocation(location: Location): Location {
  return {
    ...location,
    image: resolveAsset(location.assetKey, location.image),
  };
}

function hydrateEvidence(evidence: Evidence): Evidence {
  return {
    ...evidence,
    image: resolveAsset(evidence.assetKey, evidence.image),
  };
}

function hydrateCharacter(character: Character): Character {
  const variantKeys = character.portraitVariantAssetKeys ?? {};
  const resolvedVariants = Object.entries(variantKeys).reduce<Partial<Record<MessageTone, string>>>(
    (variants, [tone, assetKey]) => {
      const resolved = resolveAsset(assetKey, character.portraitVariants?.[tone as MessageTone]);
      if (resolved) variants[tone as MessageTone] = resolved;
      return variants;
    },
    { ...character.portraitVariants },
  );

  return {
    ...character,
    portrait: resolveAsset(character.portraitAssetKey, character.portrait),
    portraitVariants: resolvedVariants,
  };
}
