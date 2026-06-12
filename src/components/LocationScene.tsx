import { useState } from 'react';
import { ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import { withBasePath } from '../game/assets';
import { getCharacterPortrait } from '../game/portraits';
import type { Episode, GameState, Location, StoryScene } from '../game/types';

interface LocationSceneProps {
  episode: Episode;
  state: GameState;
  location: Location;
  storyScene?: StoryScene;
  storyScenes?: StoryScene[];
  storySceneIndex?: number;
  onStoryScene?: (index: number) => void;
  onStart?: () => void;
}

export function LocationScene({
  episode,
  state,
  location,
  storyScene,
  storyScenes = [],
  storySceneIndex = 0,
  onStoryScene,
  onStart,
}: LocationSceneProps) {
  const [dialogueExpanded, setDialogueExpanded] = useState(false);
  const isBriefing = state.mode === 'briefing';
  const isStoryMode = isBriefing || state.mode === 'ending';
  const heading = storyScene?.title ?? (isBriefing ? episode.title : location.name);
  const subheading = storyScene?.label ?? (isBriefing ? '事件概要' : location.summary);
  const speaker =
    episode.characters.find((character) => character.id === storyScene?.speakerId) ??
    episode.characters.find((character) => character.id === state.speakerId) ??
    episode.characters.find((character) => character.id === 'assistant');
  const tone = storyScene?.tone ?? state.tone ?? (isBriefing ? 'investigation' : 'neutral');
  const speakerName = isStoryMode && !storyScene?.speakerId ? '事件記録' : speaker?.name ?? '主人公';
  const speakerRole = isStoryMode && !storyScene?.speakerId ? '幕間' : speaker?.role ?? '進行';
  const narrative = storyScene?.text ?? state.narrative;
  const artSrc = storyScene?.image ?? location.image ?? withBasePath('/assets/locations/conference-room.webp');
  const caption = storyScene?.label ?? (isBriefing ? '深夜の法律事務所' : location.name);
  const hasStoryScenes = storyScenes.length > 0;
  const canGoPrevious = hasStoryScenes && storySceneIndex > 0;
  const canGoNext = hasStoryScenes && storySceneIndex < storyScenes.length - 1;
  const canStart = isBriefing && hasStoryScenes && !canGoNext && onStart;

  return (
    <section className="scene-panel" aria-label="現在の状況">
      <img className="stage-background" src={artSrc} alt="" />
      <div className="stage-scrim" aria-hidden="true" />
      <img className="stage-portrait" src={getCharacterPortrait(speaker, tone)} alt="" />
      <div className="scene-copy">
        <div className="scene-heading">
          <Scale aria-hidden="true" />
          <div>
            <p>{subheading}</p>
            <h2>{heading}</h2>
          </div>
        </div>
        <div className={`dialogue-box tone-${tone}`}>
          <div className="dialogue-content">
            <div className="dialogue-meta">
              <div>
                <strong>{speakerName}</strong>
                <span>{speakerRole}</span>
              </div>
              <small>{getModeLabel(state.mode)}</small>
            </div>
            <p className={dialogueExpanded ? 'narrative expanded' : 'narrative'}>{narrative}</p>
            {narrative.length > 92 ? (
              <button
                className="dialogue-more"
                type="button"
                onClick={() => setDialogueExpanded((expanded) => !expanded)}
              >
                {dialogueExpanded ? '▲閉じる' : '▼続き'}
              </button>
            ) : null}
          </div>
          {hasStoryScenes ? (
            <div className="story-chip-controls" aria-label="幕送り">
              <button type="button" disabled={!canGoPrevious} onClick={() => onStoryScene?.(storySceneIndex - 1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <span>
                {String(storySceneIndex + 1).padStart(2, '0')}/{String(storyScenes.length).padStart(2, '0')}
              </span>
              {canStart ? (
                <button type="button" onClick={onStart}>
                  開始
                </button>
              ) : (
                <button type="button" disabled={!canGoNext} onClick={() => onStoryScene?.(storySceneIndex + 1)}>
                  <ChevronRight aria-hidden="true" />
                </button>
              )}
            </div>
          ) : null}
        </div>
        {storyScene?.detail ? <p className="story-detail">{storyScene.detail}</p> : null}
        {storyScenes.length ? (
          <ol className="story-step-list" aria-label="幕構成">
            {storyScenes.map((scene, index) => (
              <li key={scene.id} className={scene.id === storyScene?.id ? 'active' : undefined}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{scene.title}</strong>
              </li>
            ))}
          </ol>
        ) : null}
        {isBriefing && !storyScenes.length ? (
          <ol className="premise-list">
            {episode.premise.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : null}
      </div>
      <span className="stage-caption">{caption}</span>
    </section>
  );
}

function getModeLabel(mode: GameState['mode']): string {
  switch (mode) {
    case 'briefing':
      return '導入';
    case 'move':
      return '移動';
    case 'inspect':
      return '調査';
    case 'talk':
      return '尋問前';
    case 'present':
      return '提示';
    case 'consult':
      return '相談';
    case 'analysis':
      return '整理';
    case 'hearing':
      return '対決';
    case 'deduction':
      return '推理';
    case 'evidence':
      return '事件ファイル';
    case 'log':
      return 'ログ';
    case 'review':
      return '事件解剖';
    case 'materials':
      return '制作資料';
    case 'ending':
      return '結末';
  }
}

