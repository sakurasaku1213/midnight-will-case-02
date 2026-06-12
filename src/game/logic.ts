import type { Episode, GameLogEntry, GameState, Interaction } from './types';

const SAVE_KEY = 'midnight-will-case-02:save:v1';
export const MAX_CREDIBILITY = 5;

export function createInitialState(episode: Episode): GameState {
  return {
    episodeId: episode.id,
    mode: 'briefing',
    currentLocationId: episode.startLocationId,
    narrative: episode.premise[0] ?? episode.subtitle,
    speakerId: 'assistant',
    tone: 'investigation',
    credibility: MAX_CREDIBILITY,
    evidenceIds: [],
    flags: [],
    log: [],
    history: [
      createHistoryEntry({
        mode: 'briefing',
        locationId: episode.startLocationId,
        text: episode.premise[0] ?? episode.subtitle,
        note: '事件概要',
        speakerId: 'assistant',
        tone: 'investigation',
      }),
    ],
    completedInteractionIds: [],
  };
}

export function addUnique<T>(items: T[], additions: T[] = []): T[] {
  const next = [...items];
  for (const item of additions) {
    if (!next.includes(item)) next.push(item);
  }
  return next;
}

export function hasAllFlags(state: GameState, requiredFlags: string[] = []): boolean {
  return requiredFlags.every((flag) => state.flags.includes(flag));
}

export function canRunInteraction(state: GameState, interaction: Interaction): boolean {
  if (!hasAllFlags(state, interaction.requiresFlags)) return false;
  return interaction.once === false || !state.completedInteractionIds.includes(interaction.id);
}

export function createHistoryEntry(
  entry: Omit<GameLogEntry, 'id' | 'createdAt'>,
): GameLogEntry {
  const createdAt = Date.now();
  return {
    ...entry,
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
  };
}

export function appendHistory(
  state: GameState,
  entry: Omit<GameLogEntry, 'id' | 'createdAt'>,
): GameLogEntry[] {
  return [...(state.history ?? []), createHistoryEntry(entry)].slice(-120);
}

export function applyInteraction(
  state: GameState,
  interaction: Interaction,
  episode: Episode,
): GameState {
  const speakerId = interaction.speakerId ?? state.speakerId ?? 'assistant';
  const tone = interaction.tone ?? 'neutral';
  const nextState: GameState = {
    ...state,
    narrative: interaction.text,
    speakerId,
    tone,
    evidenceIds: addUnique(state.evidenceIds, interaction.addEvidence),
    flags: addUnique(state.flags, interaction.setFlags),
    completedInteractionIds:
      interaction.once === false
        ? state.completedInteractionIds
        : addUnique(state.completedInteractionIds, [interaction.id]),
    log: interaction.log ? [...state.log, interaction.log] : state.log,
    history: appendHistory(state, {
      mode: state.mode,
      locationId: state.currentLocationId,
      text: interaction.text,
      note: interaction.label,
      speakerId,
      tone,
      evidenceIds: interaction.addEvidence,
    }),
  };

  if (interaction.setFlags?.includes(episode.finalFlag) && nextState.mode !== 'ending') {
    return {
      ...nextState,
      mode: 'analysis',
    };
  }

  return nextState;
}

export function applyCredibilityPenalty(state: GameState, message: string): GameState {
  const credibility = Math.max(0, (state.credibility ?? MAX_CREDIBILITY) - 1);
  const failed = credibility <= 0;

  return {
    ...state,
    credibility,
    mode: failed ? 'ending' : state.mode,
    endingId: failed ? 'failure' : state.endingId,
    speakerId: 'assistant',
    tone: 'damage',
    narrative: failed
      ? '信用が尽きた。証拠の読み違いが重なり、提出前夜の真相には届かなかった。'
      : message,
    log: [
      ...state.log,
      failed ? '信用が尽き、推理は不成立になった。' : '証拠の示し方を誤り、信用が下がった。',
    ],
    history: appendHistory(state, {
      mode: failed ? 'ending' : state.mode,
      locationId: state.currentLocationId,
      text: failed
        ? '信用が尽きた。証拠の読み違いが重なり、提出前夜の真相には届かなかった。'
        : message,
      note: failed ? '信用切れ' : '信用低下',
      speakerId: 'assistant',
      tone: 'damage',
    }),
  };
}

export function loadSavedState(episode: Episode): GameState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.episodeId !== episode.id) return null;
    return {
      ...parsed,
      speakerId: parsed.speakerId ?? 'assistant',
      tone: parsed.tone ?? 'neutral',
      credibility: parsed.credibility ?? MAX_CREDIBILITY,
      history: normalizeHistory(parsed),
    };
  } catch {
    return null;
  }
}

function normalizeHistory(state: GameState): GameLogEntry[] {
  if (Array.isArray(state.history) && state.history.length) return state.history;

  return (state.log ?? []).map((text, index) => ({
    id: `legacy-${index}`,
    mode: state.mode,
    locationId: state.currentLocationId,
    text,
    note: '旧ログ',
    speakerId: 'assistant',
    tone: 'neutral',
    createdAt: index,
  }));
}

export function saveState(state: GameState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function resetSavedState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_KEY);
}
