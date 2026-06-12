import type { Character, MessageTone } from './types';

const DEFAULT_PORTRAIT = '/assets/characters/assistant.svg';

export function getCharacterPortrait(character?: Character, tone?: MessageTone): string {
  if (!character) return DEFAULT_PORTRAIT;

  return (
    (tone ? character.portraitVariants?.[tone] : undefined) ??
    character.portraitVariants?.neutral ??
    character.portrait ??
    DEFAULT_PORTRAIT
  );
}
