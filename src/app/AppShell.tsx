import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileSearch,
  GitBranch,
  Lightbulb,
  MapPin,
  MessageSquareText,
  RotateCcw,
  Scale,
  Search,
  Settings,
  ShieldQuestion,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LocationScene } from '../components/LocationScene';
import { getAssetRegistryStats, resolveAsset, withBasePath } from '../game/assets';
import { playSfx } from '../game/audio';
import type { SfxCue } from '../game/audio';
import { ProgressTrail } from '../components/ProgressTrail';
import { episode } from '../game/episode';
import {
  applyInteraction,
  applyCredibilityPenalty,
  appendHistory,
  canRunInteraction,
  createInitialState,
  hasAllFlags,
  loadSavedState,
  MAX_CREDIBILITY,
  resetSavedState,
  saveState,
} from '../game/logic';
import { getCharacterPortrait } from '../game/portraits';
import type {
  AnalysisLink,
  CaseBoardIssue,
  CaseReviewPoint,
  Character,
  DeductionQuestion,
  Evidence,
  GameLogEntry,
  GameState,
  HearingContradiction,
  HearingStatement,
  Interaction,
  Location,
  MessageTone,
  PresentReaction,
  ProductionNote,
  StoryScene,
  Talk,
  TimelineEvent,
  ViewMode,
} from '../game/types';

const commandItems: Array<{ mode: ViewMode; label: string; icon: LucideIcon }> = [
  { mode: 'move', label: '移動', icon: MapPin },
  { mode: 'inspect', label: '調べる', icon: Search },
  { mode: 'talk', label: '話す', icon: MessageSquareText },
  { mode: 'present', label: '見せる', icon: FileSearch },
  { mode: 'analysis', label: '整理する', icon: GitBranch },
  { mode: 'hearing', label: '対決', icon: Scale },
  { mode: 'deduction', label: '推理する', icon: ShieldQuestion },
  { mode: 'evidence', label: '事件ファイル', icon: Briefcase },
  { mode: 'log', label: 'ログ', icon: ClipboardList },
  { mode: 'review', label: '事件解剖', icon: FileCheck2 },
];

const AUDIO_SETTINGS_KEY = 'midnight-will-case-02:audio:v1';
const tempoOptions = [
  { id: 'fast', label: '速い', scale: 0.72 },
  { id: 'normal', label: '標準', scale: 1 },
  { id: 'cinematic', label: 'じっくり', scale: 1.32 },
] as const;

type CaseFileTab = 'evidence' | 'people' | 'timeline' | 'testimony' | 'theory';
type NotebookTab = 'focus' | 'chapter' | 'theory' | 'record' | 'sound';
type LogFilter = 'all' | 'evidence' | 'pressure' | 'hearing' | 'deduction';
type DeductionFeedback = Record<string, 'correct' | 'wrong'>;
type InteractionCueSource = Interaction & { characterId?: string; evidenceId?: string };
type TempoSetting = (typeof tempoOptions)[number]['id'];
type AudioSettings = { enabled: boolean; volume: number; tempo: TempoSetting };
type HearingRouteStatus = 'context' | 'needs-press' | 'locked' | 'ready' | 'cleared';
type AnalysisChainStatus = 'complete' | 'ready' | 'missing' | 'locked';
type HearingRouteInfo = {
  status: HearingRouteStatus;
  label: string;
  detail: string;
  cue: string;
  contradiction?: HearingContradiction;
};
type CutInCue = {
  id: number;
  tone: Exclude<MessageTone, 'neutral' | 'investigation'>;
  title: string;
  subtitle: string;
};
type EvidenceClashCue = {
  id: number;
  tone: 'pressure' | 'success';
  title: string;
  subtitle: string;
  prompt: string;
  conclusion: string;
  evidenceIds: string[];
  speakerId?: string;
};
type PursuitNote = {
  id: number;
  tone: 'pressure' | 'success';
  title: string;
  subtitle: string;
  conclusion: string;
  evidenceIds: string[];
};
type PresentBreakdown = {
  id: number;
  characterId: string;
  evidenceId: string;
  title: string;
  before: string;
  hit: string;
  concession: string;
  nextStep: string;
};
type PresentMissNote = {
  id: number;
  characterId?: string;
  evidenceId?: string;
  title: string;
  reason: string;
  nextCheck: string;
  recommendedEvidenceIds: string[];
};
type EvidenceUsage = {
  id: string;
  tone: 'present' | 'hearing' | 'deduction';
  label: string;
  meta: string;
  detail: string;
};
type EvidenceActionGuide = {
  id: string;
  mode: ViewMode;
  status: 'ready' | 'locked' | 'complete';
  label: string;
  title: string;
  detail: string;
  action: string;
};
type EvidenceCourtUseRoute = {
  id: string;
  mode: ViewMode;
  tone: 'present' | 'hearing' | 'deduction';
  status: 'ready' | 'locked' | 'complete';
  label: string;
  title: string;
  detail: string;
  fact: string;
  action: string;
};
type EvidenceComparisonInsight = {
  id: string;
  tone: 'time' | 'analysis' | 'issue';
  label: string;
  title: string;
  detail: string;
};
type EvidenceRelationNode = {
  id: string;
  tone: 'time' | 'analysis' | 'issue' | 'hearing' | 'deduction' | 'present';
  label: string;
  title: string;
  detail: string;
  status: string;
  relatedEvidenceIds: string[];
};
type LocationRouteInfo = {
  status: 'current' | 'ready' | 'blocked' | 'done';
  label: string;
  detail: string;
  readyCount: number;
  foundEvidenceCount: number;
  totalEvidenceCount: number;
};
type ImpactCue = {
  id: number;
  tone: 'pressure' | 'success';
  word: string;
  subtitle: string;
  detail: string;
  speakerId?: string;
  evidenceId?: string;
};
type HearingCue = {
  id: number;
  tone: 'pressure' | 'damage';
  title: string;
  subtitle: string;
  statement: string;
  response: string;
  nextAction: string;
  speakerId?: string;
  evidenceId?: string;
  candidateEvidenceIds?: string[];
  candidateReason?: string;
};
type HearingSubmitPreviewStatus =
  | 'empty'
  | 'missing'
  | 'blocked'
  | 'mismatch'
  | 'ready'
  | 'cleared';
type HearingSubmitCheckStatus = 'met' | 'missing' | 'blocked' | 'warning';
type HearingSubmitPreview = {
  status: HearingSubmitPreviewStatus;
  label: string;
  headline: string;
  detail: string;
  action: string;
  checks: Array<{
    label: string;
    detail: string;
    status: HearingSubmitCheckStatus;
  }>;
};
type HearingLedgerStatus = 'cleared' | 'ready' | 'missing' | 'locked';
type DeductionFitStatus =
  | 'empty'
  | 'partial'
  | 'aligned'
  | 'choice-gap'
  | 'evidence-gap'
  | 'mismatch';
type DeductionFit = {
  status: DeductionFitStatus;
  headline: string;
  detail: string;
  claim: string;
  evidencePoint: string;
  verdict: string;
};
type CommandAvailability = {
  disabled: boolean;
  status: 'current' | 'ready' | 'locked';
  label: string;
  detail: string;
};
type SoundtrackCue = {
  id: string;
  cue: SfxCue;
  label: string;
  title: string;
  detail: string;
  layer: string;
  tempo: string;
  nextStinger: string;
  intensity: number;
};

export function AppShell() {
  const [state, setState] = useState<GameState>(() => loadInitialState());
  const [titleVisible, setTitleVisible] = useState(true);
  const [titleSettingsOpen, setTitleSettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notebookTab, setNotebookTab] = useState<NotebookTab>('focus');
  const [notebookSheetOpen, setNotebookSheetOpen] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(() => hasSavedState());
  const [cutIn, setCutIn] = useState<CutInCue | undefined>();
  const [clashCue, setClashCue] = useState<EvidenceClashCue | undefined>();
  const [impactCue, setImpactCue] = useState<ImpactCue | undefined>();
  const [pursuitNotes, setPursuitNotes] = useState<PursuitNote[]>([]);
  const [presentBreakdown, setPresentBreakdown] = useState<PresentBreakdown | undefined>();
  const [presentMissNote, setPresentMissNote] = useState<PresentMissNote | undefined>();
  const [hearingCue, setHearingCue] = useState<HearingCue | undefined>();
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [openingSceneIndex, setOpeningSceneIndex] = useState(0);
  const [endingSceneIndex, setEndingSceneIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [deductionEvidenceAnswers, setDeductionEvidenceAnswers] = useState<Record<string, string>>({});
  const [deductionFeedback, setDeductionFeedback] = useState<DeductionFeedback>({});
  const [analysisSelections, setAnalysisSelections] = useState<
    Record<string, { first?: string; second?: string }>
  >({});
  const [hearingSelection, setHearingSelection] = useState<{
    statementId?: string;
    evidenceId?: string;
  }>({});
  const [presentSelection, setPresentSelection] = useState<{
    characterId?: string;
    evidenceId?: string;
  }>({});
  const [consultLevel, setConsultLevel] = useState(1);
  const [caseFileTab, setCaseFileTab] = useState<CaseFileTab>('evidence');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>();
  const [quickEvidenceId, setQuickEvidenceId] = useState<string | undefined>();
  const [evidenceNotice, setEvidenceNotice] = useState<string | undefined>();
  const [foundEvidenceId, setFoundEvidenceId] = useState<string | undefined>();

  const locationsById = useMemo(
    () => new Map(episode.locations.map((location) => [location.id, location])),
    [],
  );
  const charactersById = useMemo(
    () => new Map(episode.characters.map((character) => [character.id, character])),
    [],
  );
  const evidenceById = useMemo(
    () => new Map(episode.evidence.map((item) => [item.id, item])),
    [],
  );

  const currentLocation =
    locationsById.get(state.currentLocationId) ?? episode.locations[0];
  const acquiredEvidence = state.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const finalUnlocked = state.flags.includes(episode.finalFlag);
  const analysisComplete = state.flags.includes('analysis_complete');
  const hearingCleared = state.flags.includes(episode.hearing.requiredFlag);
  const reviewUnlocked = state.endingId === 'success' || state.flags.includes('case_cleared');
  const activeEnding = state.endingId === 'success' ? episode.endings.success : episode.endings.failure;
  const openingScenes = episode.openingScenes ?? [];
  const endingScenes = state.mode === 'ending' ? activeEnding.scenes ?? [] : [];
  const storyScene =
    state.mode === 'briefing'
      ? getStoryScene(openingScenes, openingSceneIndex)
      : state.mode === 'ending'
        ? getStoryScene(endingScenes, endingSceneIndex)
        : undefined;
  const storyScenes =
    state.mode === 'briefing' ? openingScenes : state.mode === 'ending' ? endingScenes : [];
  const nextObjective = getNextObjective(state);
  const canConsult = state.mode !== 'briefing' && state.mode !== 'ending';
  const focusConsultation = canConsult ? getConsultation(state) : undefined;
  const quickEvidence = quickEvidenceId ? evidenceById.get(quickEvidenceId) : undefined;
  const foundEvidence = foundEvidenceId ? evidenceById.get(foundEvidenceId) : undefined;
  const soundtrackCue = useMemo(() => getSoundtrackCue(state), [state.mode, state.tone, state.endingId]);
  const tempoScale = getTempoScale(audioSettings.tempo);

  useEffect(() => {
    if (!cutIn) return;
    const timer = window.setTimeout(() => setCutIn(undefined), getTempoDuration(900, tempoScale));
    return () => window.clearTimeout(timer);
  }, [cutIn, tempoScale]);

  useEffect(() => {
    if (!clashCue) return;
    const timer = window.setTimeout(() => setClashCue(undefined), getTempoDuration(5200, tempoScale));
    return () => window.clearTimeout(timer);
  }, [clashCue, tempoScale]);

  useEffect(() => {
    if (!impactCue) return;
    const timer = window.setTimeout(() => setImpactCue(undefined), getTempoDuration(1150, tempoScale));
    return () => window.clearTimeout(timer);
  }, [impactCue, tempoScale]);

  useEffect(() => {
    if (!hearingCue) return;
    const timer = window.setTimeout(() => setHearingCue(undefined), getTempoDuration(6800, tempoScale));
    return () => window.clearTimeout(timer);
  }, [hearingCue, tempoScale]);

  useEffect(() => {
    if (state.mode !== 'hearing') setHearingCue(undefined);
  }, [state.mode]);

  useEffect(() => {
    if (!evidenceNotice) return;
    const timer = window.setTimeout(() => setEvidenceNotice(undefined), getTempoDuration(3200, tempoScale));
    return () => window.clearTimeout(timer);
  }, [evidenceNotice, tempoScale]);

  useEffect(() => {
    if (!foundEvidenceId) return;
    const timer = window.setTimeout(() => setFoundEvidenceId(undefined), getTempoDuration(9000, tempoScale));
    return () => window.clearTimeout(timer);
  }, [foundEvidenceId, tempoScale]);

  useEffect(() => {
    setEndingSceneIndex(0);
  }, [state.endingId]);

  useEffect(() => {
    if (state.mode !== 'hearing' || hearingSelection.statementId) return;
    const firstStatement = episode.hearing.statements[0];
    if (firstStatement) setHearingSelection({ statementId: firstStatement.id });
  }, [state.mode, hearingSelection.statementId]);

  useEffect(() => {
    if (!audioSettings.enabled) return;
    playSfx(soundtrackCue.cue, audioSettings.volume * 0.72);
  }, [state.mode, state.tone, state.endingId]);

  function updateState(nextState: GameState) {
    const cue = createCutInCue(state, nextState);
    if (cue) {
      setCutIn(cue);
      playAudioCue(cue.tone);
      if (cue.tone === 'damage') setClashCue(undefined);
    }
    if (nextState.mode === 'ending') {
      setEvidenceNotice(undefined);
      setFoundEvidenceId(undefined);
    }
    setState(nextState);
    saveState(nextState);
    setHasSavedGame(true);
  }

  function updateStateWithNotice(nextState: GameState) {
    const addedEvidence = nextState.evidenceIds.filter((id) => !state.evidenceIds.includes(id));
    if (addedEvidence.length) {
      const names = addedEvidence
        .map((id) => evidenceById.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      if (names.length) {
        setEvidenceNotice(`証拠更新: ${names.join('、')}`);
        setSelectedEvidenceId(addedEvidence[addedEvidence.length - 1]);
        setFoundEvidenceId(addedEvidence[addedEvidence.length - 1]);
        playAudioCue('evidence');
      }
    }
    updateState(nextState);
  }

  function showEvidenceClash(cue: Omit<EvidenceClashCue, 'id'>) {
    setHearingCue(undefined);
    const id = Date.now();
    setImpactCue(createImpactCue(cue, id));
    setClashCue({ ...cue, id });
    setPursuitNotes((current) =>
      [
        {
          id,
          tone: cue.tone,
          title: cue.title,
          subtitle: cue.subtitle,
          conclusion: cue.conclusion,
          evidenceIds: cue.evidenceIds,
        },
        ...current,
      ].slice(0, 3),
    );
  }

  function showHearingCue(cue: Omit<HearingCue, 'id'>) {
    setHearingCue({ ...cue, id: Date.now() });
  }

  function openEvidenceQuickLook(evidenceId: string) {
    setSelectedEvidenceId(evidenceId);
    setQuickEvidenceId(evidenceId);
  }

  function openQuickEvidenceInCaseFile(evidenceId: string) {
    setFoundEvidenceId(undefined);
    setSelectedEvidenceId(evidenceId);
    setCaseFileTab('evidence');
    setQuickEvidenceId(undefined);
    setMode('evidence');
  }

  function playAudioCue(cue: SfxCue) {
    if (!audioSettings.enabled) return;
    playSfx(cue, audioSettings.volume);
  }

  function auditionSoundtrackCue() {
    playAudioCue(soundtrackCue.cue);
  }

  function updateAudioSettings(nextSettings: AudioSettings) {
    setAudioSettings(nextSettings);
    saveAudioSettings(nextSettings);
  }

  function toggleAudio() {
    const nextSettings = { ...audioSettings, enabled: !audioSettings.enabled };
    updateAudioSettings(nextSettings);
    if (nextSettings.enabled) playSfx('select', nextSettings.volume);
  }

  function updateAudioVolume(volume: number) {
    updateAudioSettings({
      ...audioSettings,
      volume: Math.min(1, Math.max(0, Number(volume.toFixed(2)))),
    });
  }

  function updateAudioTempo(tempo: TempoSetting) {
    updateAudioSettings({
      ...audioSettings,
      tempo,
    });
    if (audioSettings.enabled) playSfx(tempo === 'cinematic' ? 'chapter' : 'select', audioSettings.volume);
  }

  function startInvestigation() {
    updateState({
      ...state,
      mode: 'move',
      narrative: currentLocation.description,
      speakerId: 'assistant',
      tone: 'investigation',
      log: state.log.length ? state.log : ['提出前夜の調査を開始した。'],
      history: appendHistory(state, {
        mode: 'move',
        locationId: currentLocation.id,
        text: currentLocation.description,
        note: '調査開始',
        speakerId: 'assistant',
        tone: 'investigation',
      }),
    });
  }

  function setMode(mode: ViewMode) {
    if (mode === 'analysis' && acquiredEvidence.length < 2) return;
    if (mode === 'hearing' && (!finalUnlocked || !analysisComplete)) return;
    if (mode === 'deduction' && !hearingCleared) return;
    if (mode === 'present' && acquiredEvidence.length === 0) return;
    if (mode === 'review' && !reviewUnlocked) return;
    if (mode === 'materials' && !reviewUnlocked) return;
    setConsultLevel(1);
    setClashCue(undefined);
    setImpactCue(undefined);
    setHearingCue(undefined);
    setPresentBreakdown(undefined);
    updateState({ ...state, mode, endingId: undefined });
  }

  function openConsultation() {
    setConsultLevel(1);
    setClashCue(undefined);
    setImpactCue(undefined);
    setHearingCue(undefined);
    setPresentBreakdown(undefined);
    updateState({ ...state, mode: 'consult' });
  }

  function openTheoryBoard() {
    setCaseFileTab('theory');
    setMode('evidence');
  }

  function moveTo(locationId: string) {
    const nextLocation = locationsById.get(locationId);
    if (!nextLocation) return;
    setImpactCue(undefined);
    setHearingCue(undefined);
    setPresentBreakdown(undefined);

    updateState({
      ...state,
      mode: 'inspect',
      currentLocationId: locationId,
      narrative: nextLocation.description,
      speakerId: 'assistant',
      tone: 'investigation',
      log: [...state.log, `${nextLocation.name}へ移動した。`],
      history: appendHistory(state, {
        mode: 'move',
        locationId: nextLocation.id,
        text: nextLocation.description,
        note: `${nextLocation.name}へ移動`,
        speakerId: 'assistant',
        tone: 'investigation',
      }),
      endingId: undefined,
    });
  }

  function runInteraction(interaction: Interaction) {
    updateStateWithNotice(
      applyInteraction(
        state,
        {
          ...interaction,
          speakerId: interaction.speakerId ?? getInteractionSpeakerId(interaction),
          tone: interaction.tone ?? getInteractionTone(interaction),
        },
        episode,
      ),
    );
  }

  function updateHearingSelection(selection: { statementId?: string; evidenceId?: string }) {
    setHearingCue(undefined);
    setHearingSelection(selection);
  }

  function submitPresentReaction() {
    if (!presentSelection.characterId || !presentSelection.evidenceId) return;

    const match = episode.presentReactions.find(
      (reaction) =>
        reaction.characterId === presentSelection.characterId &&
        reaction.evidenceId === presentSelection.evidenceId &&
        (!reaction.availableAt?.length || reaction.availableAt.includes(state.currentLocationId)) &&
        state.evidenceIds.includes(reaction.evidenceId) &&
        canRunInteraction(state, reaction),
    );

    if (!match) {
      setPresentBreakdown(undefined);
      setPresentMissNote(
        createPresentMissNote(
          presentSelection,
          charactersById,
          evidenceById,
          episode.presentReactions,
          state,
        ),
      );
      updateState(
        applyCredibilityPenalty(
          state,
          'その証拠では相手の説明は動かない。相手が知っている事実と、証拠の役割を組み合わせて見直す。',
        ),
      );
      return;
    }

    setPresentMissNote(undefined);
    setPresentSelection({ characterId: match.characterId });
    setPresentBreakdown(createPresentBreakdown(match, charactersById, evidenceById));
    showEvidenceClash({
      tone: 'pressure',
      title: '提示成功',
      subtitle: evidenceById.get(match.evidenceId)?.name ?? '証拠提示',
      prompt: `${charactersById.get(match.characterId)?.name ?? '相手'}の説明に、証拠が食い込んだ。`,
      conclusion: match.log ?? match.text,
      evidenceIds: [match.evidenceId],
      speakerId: match.characterId,
    });
    runInteraction(match);
  }

  function runAnalysisLink(link: AnalysisLink) {
    const selected = analysisSelections[link.id];
    const selectedIds = [selected?.first, selected?.second].filter(Boolean).sort();
    const expectedIds = [...link.evidenceIds].sort();
    const correct =
      selectedIds.length === expectedIds.length &&
      selectedIds.every((id, index) => id === expectedIds[index]);

    if (!correct) {
      updateState(
        applyCredibilityPenalty(
          state,
          'その組み合わせでは、まだ争点の説明にならない。証拠の時刻と内容を見直す。',
        ),
      );
      return;
    }

    let nextState = applyInteraction(
      state,
      {
        id: link.id,
        label: link.label,
        text: link.text,
        addEvidence: link.addEvidence,
        setFlags: link.setFlags,
        log: link.log,
        speakerId: link.speakerId ?? 'assistant',
        tone: link.tone ?? 'success',
      },
      episode,
    );

    if (link.setFlags?.includes('analysis_complete') && nextState.flags.includes(episode.finalFlag)) {
      nextState = { ...nextState, mode: 'hearing' };
    }

    showEvidenceClash({
      tone: 'success',
      title: '記録照合',
      subtitle: link.label,
      prompt: link.prompt,
      conclusion: link.log ?? link.text,
      evidenceIds: link.evidenceIds,
      speakerId: link.speakerId ?? 'assistant',
    });
    updateStateWithNotice(nextState);
  }

  function submitHearing() {
    const statement = episode.hearing.statements.find(
      (item) => item.id === hearingSelection.statementId,
    );
    const selectedEvidence = hearingSelection.evidenceId
      ? evidenceById.get(hearingSelection.evidenceId)
      : undefined;
    const routeInfo = getHearingRouteInfo(state, statement);
    const match = episode.hearing.contradictions.find(
      (contradiction) =>
        contradiction.statementId === hearingSelection.statementId &&
        contradiction.evidenceId === hearingSelection.evidenceId &&
        hasAllFlags(state, contradiction.requiresFlags),
    );

    if (!match) {
      showHearingCue(createHearingMissCue(statement, selectedEvidence, routeInfo));
      updateState(
        applyCredibilityPenalty(
          state,
          'その指摘では相手の説明は崩れない。発言のどこが、どの証拠と食い違うのかを絞る。',
        ),
      );
      return;
    }

    const nextState = applyInteraction(
      state,
      {
        id: `${match.statementId}-${match.evidenceId}`,
        label: '矛盾を示す',
        text: match.text,
        addEvidence: match.addEvidence,
        setFlags: match.setFlags,
        log: match.log,
        speakerId: match.speakerId ?? 'assistant',
        tone: match.setFlags?.includes(episode.hearing.requiredFlag) ? 'success' : 'pressure',
      },
      episode,
    );
    showEvidenceClash({
      tone: match.setFlags?.includes(episode.hearing.requiredFlag) ? 'success' : 'pressure',
      title: '矛盾成立',
      subtitle: evidenceById.get(match.evidenceId)?.name ?? '証拠',
      prompt: statement?.text ?? '証言と証拠が食い違う。',
      conclusion: match.text,
      evidenceIds: [match.evidenceId],
      speakerId: statement?.characterId ?? match.speakerId ?? 'client-b',
    });

    updateStateWithNotice(
      match.setFlags?.includes(episode.hearing.requiredFlag)
        ? { ...nextState, mode: 'deduction' }
        : nextState,
    );
  }

  function pressHearingStatement() {
    const statement = episode.hearing.statements.find(
      (item) => item.id === hearingSelection.statementId,
    );
    if (!statement?.pressText) return;
    showHearingCue(createHearingPressCue(statement));

    updateStateWithNotice(
      applyInteraction(
        state,
        {
          id: `press-${statement.id}`,
          label: '詳しく聞く',
          text: statement.pressText,
          setFlags: statement.pressFlag ? [statement.pressFlag] : undefined,
          log: statement.pressLog,
          speakerId: 'client-b',
          tone: 'pressure',
        },
        episode,
      ),
    );
  }

  function submitDeduction() {
    const complete = episode.deduction.questions.every(
      (question) => answers[question.id] && deductionEvidenceAnswers[question.id],
    );
    if (!complete) return;

    const nextFeedback = episode.deduction.questions.reduce<DeductionFeedback>((acc, question) => {
      acc[question.id] =
        answers[question.id] === question.answer &&
        deductionEvidenceAnswers[question.id] === question.evidenceAnswer
          ? 'correct'
          : 'wrong';
      return acc;
    }, {});
    setDeductionFeedback(nextFeedback);

    const correct = Object.values(nextFeedback).every((result) => result === 'correct');

    if (!correct) {
      const penalized = applyCredibilityPenalty(
        state,
        '結論の一部が記録と合わない。赤い項目を事件ファイルと時系列で見直す。',
      );
      updateState({
        ...penalized,
        mode: penalized.endingId === 'failure' ? 'ending' : 'deduction',
        narrative:
          penalized.endingId === 'failure'
            ? episode.endings.failure.text
            : '結論の一部が記録と合わない。赤い項目を事件ファイルと時系列で見直す。',
        speakerId: 'assistant',
        tone: 'damage',
        log: [...penalized.log, '最終推理の結論を再検討した。'],
      });
      return;
    }

    updateState({
      ...state,
      mode: 'ending',
      endingId: 'success',
      narrative: episode.endings.success.text,
      speakerId: 'assistant',
      tone: 'success',
      flags: state.flags.includes('case_cleared') ? state.flags : [...state.flags, 'case_cleared'],
      log: [...state.log, '最終推理が成立した。'],
      history: appendHistory(state, {
        mode: 'ending',
        locationId: state.currentLocationId,
        text: episode.endings.success.text,
        note: episode.endings.success.title,
        speakerId: 'assistant',
        tone: 'success',
      }),
    });
  }

  function updateDeductionAnswers(nextAnswers: Record<string, string>) {
    const changedQuestionIds = episode.deduction.questions
      .filter((question) => answers[question.id] !== nextAnswers[question.id])
      .map((question) => question.id);
    setAnswers(nextAnswers);
    if (!changedQuestionIds.length) return;

    setDeductionFeedback((current) => {
      const next = { ...current };
      for (const questionId of changedQuestionIds) {
        delete next[questionId];
      }
      return next;
    });
  }

  function updateDeductionEvidenceAnswers(nextAnswers: Record<string, string>) {
    const changedQuestionIds = episode.deduction.questions
      .filter((question) => deductionEvidenceAnswers[question.id] !== nextAnswers[question.id])
      .map((question) => question.id);
    setDeductionEvidenceAnswers(nextAnswers);
    if (!changedQuestionIds.length) return;

    setDeductionFeedback((current) => {
      const next = { ...current };
      for (const questionId of changedQuestionIds) {
        delete next[questionId];
      }
      return next;
    });
  }

  function resetGame() {
    resetSavedState();
    setOpeningSceneIndex(0);
    setEndingSceneIndex(0);
    setAnswers({});
    setDeductionEvidenceAnswers({});
    setDeductionFeedback({});
    setAnalysisSelections({});
    setHearingSelection({});
    setPresentSelection({});
    setConsultLevel(1);
    setSelectedEvidenceId(undefined);
    setQuickEvidenceId(undefined);
    setPursuitNotes([]);
    setPresentBreakdown(undefined);
    setPresentMissNote(undefined);
    setEvidenceNotice(undefined);
    setFoundEvidenceId(undefined);
    setClashCue(undefined);
    setImpactCue(undefined);
    setHearingCue(undefined);
    setState(createInitialState(episode));
    setHasSavedGame(false);
  }

  function startFromTitle() {
    if (
      hasSavedGame &&
      typeof window !== 'undefined' &&
      !window.confirm('保存済みの進行を消して、はじめから開始しますか。')
    ) {
      return;
    }
    resetGame();
    setTitleSettingsOpen(false);
    setTitleVisible(false);
  }

  function continueFromTitle() {
    setTitleSettingsOpen(false);
    setTitleVisible(false);
  }

  const actionPanel = renderActionPanel({
    state,
    currentLocation,
    acquiredEvidence,
    answers,
    deductionEvidenceAnswers,
    caseFileTab,
    selectedEvidenceId,
    analysisSelections,
    hearingSelection,
    presentSelection,
    consultLevel,
    deductionFeedback,
    hearingCue,
    presentMissNote,
    finalUnlocked,
    analysisComplete,
    hearingCleared,
    reviewUnlocked,
    charactersById,
    evidenceById,
    openingSceneIndex,
    endingSceneIndex,
    onOpeningScene: setOpeningSceneIndex,
    onEndingScene: setEndingSceneIndex,
    onStart: startInvestigation,
    onMove: moveTo,
    onRunInteraction: runInteraction,
    onPresentSelection: (selection) => {
      setPresentMissNote(undefined);
      setPresentSelection(selection);
    },
    onSubmitPresent: submitPresentReaction,
    onConsultLevel: setConsultLevel,
    onOpenCaseEvidence: openQuickEvidenceInCaseFile,
    onRunAnalysisLink: runAnalysisLink,
    onAnalysisSelection: setAnalysisSelections,
    onHearingSelection: updateHearingSelection,
    onPressHearing: pressHearingStatement,
    onSubmitHearing: submitHearing,
    onCaseFileTab: setCaseFileTab,
    onSelectEvidence: setSelectedEvidenceId,
    onOpenEvidence: openEvidenceQuickLook,
    onAnswer: updateDeductionAnswers,
    onDeductionEvidenceAnswer: updateDeductionEvidenceAnswers,
    onSubmitDeduction: submitDeduction,
    onModeChange: setMode,
  });
  const notebookTabs: Array<{ id: NotebookTab; label: string }> = [
    { id: 'focus', label: '焦点' },
    { id: 'chapter', label: '章' },
    { id: 'theory', label: '論点' },
    { id: 'record', label: '記録' },
    { id: 'sound', label: '音響' },
  ];
  const activeNotebookLabel = notebookTabs.find((tab) => tab.id === notebookTab)?.label ?? '焦点';
  const riskTone =
    state.credibility <= 1 ? '危険' : state.credibility <= Math.ceil(MAX_CREDIBILITY / 2) ? '注意' : '安定';
  const notebookContent = (
    <div className="notebook-tab-panel" role="tabpanel" aria-label={`手控え: ${activeNotebookLabel}`}>
      {notebookTab === 'focus' ? (
        <>
          <div className="case-focus">
            <div className="focus-copy">
              <strong>現在の焦点</strong>
              <span>{nextObjective}</span>
            </div>
            {focusConsultation ? (
              <FocusActionCard
                guide={focusConsultation}
                onConsult={openConsultation}
                onNext={() => setMode(focusConsultation.nextMode)}
              />
            ) : null}
            {false && canConsult ? (
              <button className="focus-consult-button" type="button" onClick={openConsultation}>
                <Lightbulb aria-hidden="true" />
                <span>相談する</span>
              </button>
            ) : null}
          </div>
          <CredibilityRiskCard state={state} />
          <CaseDirector
            state={state}
            guide={focusConsultation ?? getConsultation(state)}
            onModeChange={setMode}
          />
          <ChapterGuide state={state} guide={focusConsultation ?? getConsultation(state)} />
        </>
      ) : null}
      {notebookTab === 'chapter' ? (
        <>
          <CaseMap state={state} onModeChange={setMode} />
          <ProgressTrail beats={episode.progressBeats ?? []} flags={state.flags} />
          <PursuitMemo notes={pursuitNotes} evidenceById={evidenceById} />
        </>
      ) : null}
      {notebookTab === 'theory' ? (
        <TheoryProgressCard
          state={state}
          evidenceById={evidenceById}
          onOpenTheoryBoard={openTheoryBoard}
        />
      ) : null}
      {notebookTab === 'record' ? (
        <SessionBookmark
          state={state}
          history={state.history ?? []}
          evidenceById={evidenceById}
          onOpenLog={() => setMode('log')}
          onGoNext={() => setMode(focusConsultation?.nextMode ?? getConsultation(state).nextMode)}
        />
      ) : null}
      {notebookTab === 'sound' ? (
        <SoundtrackPanel
          cue={soundtrackCue}
          audioEnabled={audioSettings.enabled}
          volume={audioSettings.volume}
          onAudition={auditionSoundtrackCue}
        />
      ) : null}
    </div>
  );

  return (
    <>
      {titleVisible ? (
        <TitleScreen
          hasSavedGame={hasSavedGame}
          settingsOpen={titleSettingsOpen}
          audioSettings={audioSettings}
          onStart={startFromTitle}
          onContinue={continueFromTitle}
          onToggleSettings={() => setTitleSettingsOpen((open) => !open)}
          onToggleAudio={toggleAudio}
          onVolume={updateAudioVolume}
          onTempo={updateAudioTempo}
        />
      ) : null}
      <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <p className="eyebrow">{episode.caseNumber}</p>
          <h1>{episode.title}</h1>
        </div>
        <div className="topbar-actions">
          <div className="settings-popover">
            <button
              className="icon-button"
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-expanded={settingsOpen}
              aria-label="設定"
              title="設定"
            >
              <Settings aria-hidden="true" />
            </button>
            {settingsOpen ? (
              <div className="settings-panel" role="dialog" aria-label="設定">
                <AudioControls
                  enabled={audioSettings.enabled}
                  volume={audioSettings.volume}
                  tempo={audioSettings.tempo}
                  onToggle={toggleAudio}
                  onVolume={updateAudioVolume}
                  onTempo={updateAudioTempo}
                />
                <button className="secondary-button settings-reset" type="button" onClick={resetGame}>
                  <RotateCcw aria-hidden="true" />
                  <span>最初から</span>
                </button>
              </div>
            ) : null}
          </div>
          <button className="icon-button topbar-reset" type="button" onClick={resetGame} title="最初から">
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="workspace">
        {impactCue ? (
          <ImpactBurst
            key={impactCue.id}
            cue={impactCue}
            charactersById={charactersById}
            evidenceById={evidenceById}
          />
        ) : cutIn ? (
          <CutIn key={cutIn.id} cue={cutIn} />
        ) : null}
        <LocationScene
          episode={episode}
          state={state}
          location={currentLocation}
          storyScene={storyScene}
          storyScenes={storyScenes}
          storySceneIndex={state.mode === 'briefing' ? openingSceneIndex : endingSceneIndex}
          onStoryScene={(index) =>
            state.mode === 'briefing' ? setOpeningSceneIndex(index) : setEndingSceneIndex(index)
          }
          onStart={state.mode === 'briefing' ? startInvestigation : undefined}
        />
        {clashCue ? (
          <EvidenceClash cue={clashCue} evidenceById={evidenceById} charactersById={charactersById} />
        ) : null}
        {presentBreakdown ? (
          <PresentBreakdownPanel
            breakdown={presentBreakdown}
            evidenceById={evidenceById}
            charactersById={charactersById}
          />
        ) : null}
        {evidenceNotice ? (
          <div className="evidence-notice" role="status">
            <span>{evidenceNotice}</span>
            <button type="button" onClick={() => setEvidenceNotice(undefined)}>
              閉じる
            </button>
          </div>
        ) : null}
        {foundEvidence ? (
          <FoundEvidencePanel
            evidence={foundEvidence}
            onClose={() => setFoundEvidenceId(undefined)}
            onOpenCaseFile={() => openQuickEvidenceInCaseFile(foundEvidence.id)}
          />
        ) : null}
        {quickEvidence ? (
          <EvidenceQuickLook
            evidence={quickEvidence}
            onClose={() => setQuickEvidenceId(undefined)}
            onOpenCaseFile={() => openQuickEvidenceInCaseFile(quickEvidence.id)}
          />
        ) : null}

        <aside className="command-panel" aria-label="コマンド">
          <CommandBar
            mode={state.mode}
            finalUnlocked={finalUnlocked}
            analysisComplete={analysisComplete}
            hearingCleared={hearingCleared}
            reviewUnlocked={reviewUnlocked}
            evidenceCount={acquiredEvidence.length}
            onSelect={setMode}
          />
          <div className={state.tone === 'damage' ? 'status-strip damage' : 'status-strip'}>
            <span>信用 {state.credibility ?? MAX_CREDIBILITY}/{MAX_CREDIBILITY}</span>
            <span>証拠 {acquiredEvidence.length}/{episode.evidence.length}</span>
            <span>{currentLocation.name}</span>
            <span>{riskTone}</span>
          </div>
          <section className="notebook-tabs" aria-label="手控え">
            <div className="notebook-tab-list" role="tablist" aria-label="手控えタブ">
              {notebookTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={notebookTab === tab.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={notebookTab === tab.id}
                  onClick={() => setNotebookTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {notebookContent}
          </section>
        </aside>

        <section className="work-panel" aria-label="操作">
          {actionPanel}
        </section>

        <aside className="mobile-dock" aria-label="下部コマンド">
          <CommandBar
            mode={state.mode}
            finalUnlocked={finalUnlocked}
            analysisComplete={analysisComplete}
            hearingCleared={hearingCleared}
            reviewUnlocked={reviewUnlocked}
            evidenceCount={acquiredEvidence.length}
            onSelect={setMode}
          />
          <button className="mobile-notebook-button" type="button" onClick={() => setNotebookSheetOpen(true)}>
            手控え
          </button>
        </aside>

        {notebookSheetOpen ? (
          <div
            className="notebook-sheet-backdrop"
            role="presentation"
            onClick={() => setNotebookSheetOpen(false)}
          >
            <section
              className="notebook-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="手控え"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="notebook-sheet-header">
                <strong>手控え</strong>
                <button className="icon-button" type="button" onClick={() => setNotebookSheetOpen(false)} aria-label="閉じる">
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="notebook-tab-list" role="tablist" aria-label="手控えタブ">
                {notebookTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={notebookTab === tab.id ? 'active' : ''}
                    type="button"
                    role="tab"
                    aria-selected={notebookTab === tab.id}
                    onClick={() => setNotebookTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {notebookContent}
            </section>
          </div>
        ) : null}
      </main>
    </div>
    </>
  );
}

function loadInitialState() {
  const saved = loadSavedState(episode);
  return saved ?? createInitialState(episode);
}

function hasSavedState() {
  return Boolean(loadSavedState(episode));
}

function TitleScreen({
  hasSavedGame,
  settingsOpen,
  audioSettings,
  onStart,
  onContinue,
  onToggleSettings,
  onToggleAudio,
  onVolume,
  onTempo,
}: {
  hasSavedGame: boolean;
  settingsOpen: boolean;
  audioSettings: AudioSettings;
  onStart: () => void;
  onContinue: () => void;
  onToggleSettings: () => void;
  onToggleAudio: () => void;
  onVolume: (volume: number) => void;
  onTempo: (tempo: TempoSetting) => void;
}) {
  const titleVisual = resolveAsset('scene.title');
  const titleStyle = titleVisual
    ? ({ '--title-art': `url("${titleVisual}")` } as CSSProperties)
    : undefined;

  return (
    <section className="title-screen" role="dialog" aria-modal="true" aria-label="タイトル" style={titleStyle}>
      <div className="title-logo" aria-label={`${episode.title} タイトル`}>
        <span>午前0時の遺言書 Case 02</span>
        <i aria-hidden="true" />
        <h1>{episode.title}</h1>
        <p>{episode.subtitle}</p>
      </div>
      <div className="title-actions">
        {hasSavedGame ? (
          <button className="title-button primary" type="button" onClick={onContinue} autoFocus>
            つづきから
          </button>
        ) : null}
        <button className={`title-button ${hasSavedGame ? 'secondary' : 'primary'}`} type="button" onClick={onStart} autoFocus={!hasSavedGame}>
          はじめから
        </button>
        <button
          className="title-button secondary"
          type="button"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
        >
          設定
        </button>
      </div>
      {settingsOpen ? (
        <div className="title-settings" aria-label="タイトル設定">
          <AudioControls
            enabled={audioSettings.enabled}
            volume={audioSettings.volume}
            tempo={audioSettings.tempo}
            onToggle={onToggleAudio}
            onVolume={onVolume}
            onTempo={onTempo}
          />
        </div>
      ) : null}
      <p className="title-disclaimer">
        本作はフィクションです。実在の事件・人物・団体とは関係ありません。
      </p>
    </section>
  );
}

function getStoryScene(scenes: StoryScene[], index: number): StoryScene | undefined {
  if (!scenes.length) return undefined;
  return scenes[Math.min(Math.max(index, 0), scenes.length - 1)];
}

function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return { enabled: true, volume: 0.55, tempo: 'normal' };

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { enabled: true, volume: 0.55, tempo: 'normal' };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      enabled: parsed.enabled ?? true,
      volume: Math.min(1, Math.max(0, parsed.volume ?? 0.55)),
      tempo: isTempoSetting(parsed.tempo) ? parsed.tempo : 'normal',
    };
  } catch {
    return { enabled: true, volume: 0.55, tempo: 'normal' };
  }
}

function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
}

function isTempoSetting(value: unknown): value is TempoSetting {
  return typeof value === 'string' && tempoOptions.some((option) => option.id === value);
}

function getTempoScale(tempo: TempoSetting): number {
  return tempoOptions.find((option) => option.id === tempo)?.scale ?? 1;
}

function getTempoDuration(duration: number, scale: number): number {
  return Math.round(duration * scale);
}

function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, select, textarea, button, [contenteditable="true"]'),
  );
}

function AudioControls({
  enabled,
  volume,
  tempo,
  onToggle,
  onVolume,
  onTempo,
}: {
  enabled: boolean;
  volume: number;
  tempo: TempoSetting;
  onToggle: () => void;
  onVolume: (volume: number) => void;
  onTempo: (tempo: TempoSetting) => void;
}) {
  const Icon = enabled ? Volume2 : VolumeX;

  return (
    <div className="audio-controls" aria-label="音響設定">
      <button
        className="icon-button"
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        title={enabled ? '効果音を切る' : '効果音を入れる'}
      >
        <Icon aria-hidden="true" />
      </button>
      <label className="volume-control">
        <span>効果音</span>
        <input
          aria-label="効果音の音量"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          disabled={!enabled}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
      <div className="tempo-control" aria-label="演出テンポ">
        <span>演出</span>
        <div>
          {tempoOptions.map((option) => (
            <button
              className={tempo === option.id ? 'active' : ''}
              type="button"
              key={option.id}
              aria-pressed={tempo === option.id}
              onClick={() => onTempo(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SoundtrackPanel({
  cue,
  audioEnabled,
  volume,
  onAudition,
}: {
  cue: SoundtrackCue;
  audioEnabled: boolean;
  volume: number;
  onAudition: () => void;
}) {
  return (
    <section className={`soundtrack-panel cue-${cue.id}`} aria-label="soundtrack director">
      <div className="soundtrack-heading">
        <div>
          <span>SOUNDTRACK</span>
          <strong>{cue.title}</strong>
          <p>{cue.detail}</p>
        </div>
        <em>{cue.tempo}</em>
      </div>
      <div className="soundtrack-meter" aria-label="音響テンション">
        {Array.from({ length: 5 }, (_, index) => (
          <span className={index < cue.intensity ? 'filled' : ''} key={index} />
        ))}
      </div>
      <div className="soundtrack-grid">
        <section>
          <span>Layer</span>
          <p>{cue.layer}</p>
        </section>
        <section>
          <span>Next stinger</span>
          <p>{cue.nextStinger}</p>
        </section>
      </div>
      <button
        className="secondary-button soundtrack-audition"
        type="button"
        disabled={!audioEnabled || volume <= 0}
        onClick={onAudition}
      >
        {audioEnabled ? 'モチーフ試聴' : '音響OFF'}
      </button>
    </section>
  );
}

function getSoundtrackCue(state: GameState): SoundtrackCue {
  if (state.mode === 'hearing') {
    if (state.tone === 'damage') {
      return {
        id: 'damage',
        cue: 'damage',
        label: 'Penalty',
        title: '信用が揺らぐ低音',
        detail: '誤った指摘の直後は低い下降音で、裁判長の警告と信用低下を強調する。',
        layer: 'low warning pulse',
        tempo: '64 BPM',
        nextStinger: 'RETURN TO RECORD',
        intensity: 4,
      };
    }
    return {
      id: 'court',
      cue: 'court',
      label: 'Court',
      title: '反対尋問の緊張',
      detail: '証言送り、ゆさぶり、証拠提示の間に短い法廷モチーフを置き、対決の圧を保つ。',
      layer: 'courtroom ostinato',
      tempo: '128 BPM',
      nextStinger: 'OBJECTION READY',
      intensity: 5,
    };
  }

  if (state.mode === 'deduction') {
    return {
      id: 'deduction',
      cue: 'deduction',
      label: 'Deduction',
      title: '最終推理の組み立て',
      detail: '4つの論点を一本にまとめる場面。音は上昇形で、結論へ近づく感覚を出す。',
      layer: 'logic arpeggio',
      tempo: '96 BPM',
      nextStinger: 'FINAL ARGUMENT',
      intensity: 4,
    };
  }

  if (state.mode === 'ending' || state.mode === 'review' || state.mode === 'materials') {
    return {
      id: 'verdict',
      cue: 'verdict',
      label: 'Verdict',
      title: '評決後の余韻',
      detail: '勝訴、事件解剖、制作資料では、決着後の低音と明るい上昇音を短く鳴らす。',
      layer: 'verdict cadence',
      tempo: '72 BPM',
      nextStinger: state.endingId === 'failure' ? 'RETRY' : 'CASE CLOSED',
      intensity: state.endingId === 'failure' ? 3 : 2,
    };
  }

  if (state.mode === 'analysis' || state.mode === 'evidence' || state.mode === 'log') {
    return {
      id: 'chapter',
      cue: 'chapter',
      label: 'Case file',
      title: '記録を読む静かな拍',
      detail: '事件ファイル、整理、ログでは短い三音モチーフで、証拠を読み込む間を作る。',
      layer: 'case file motif',
      tempo: '84 BPM',
      nextStinger: 'RECORD UPDATE',
      intensity: 2,
    };
  }

  if (state.tone === 'pressure') {
    return {
      id: 'pressure',
      cue: 'pressure',
      label: 'Pressure',
      title: '人物の発言が揺れる',
      detail: '会話や提示で反応が動いた時は、鋭い上昇音で次の証拠提示へつなぐ。',
      layer: 'pressure hit',
      tempo: '112 BPM',
      nextStinger: 'PRESENT',
      intensity: 3,
    };
  }

  return {
    id: 'investigation',
    cue: 'chapter',
    label: 'Investigation',
    title: '調査パートの下地',
    detail: '移動、調査、会話では控えめな拍を置き、法廷前の情報収集を邪魔しない。',
    layer: 'quiet investigation bed',
    tempo: '78 BPM',
    nextStinger: 'NEW FACT',
    intensity: 1,
  };
}

function CutIn({ cue }: { cue: CutInCue }) {
  return (
    <div className={`cut-in tone-${cue.tone}`} role="status" aria-live="polite">
      <div className="cut-in-panel">
        <span>{cue.subtitle}</span>
        <strong>{cue.title}</strong>
      </div>
    </div>
  );
}

function ImpactBurst({
  cue,
  charactersById,
  evidenceById,
}: {
  cue: ImpactCue;
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
}) {
  const speaker = cue.speakerId ? charactersById.get(cue.speakerId) : undefined;
  const evidence = cue.evidenceId ? evidenceById.get(cue.evidenceId) : undefined;

  return (
    <div className={`impact-burst tone-${cue.tone}`} role="status" aria-live="polite">
      <div className="impact-burst-panel">
        <span>{cue.subtitle}</span>
        <strong>{cue.word}</strong>
        <p>{cue.detail}</p>
        <div className="impact-burst-meta">
          <img src={getCharacterPortrait(speaker, cue.tone)} alt="" />
          <small>{evidence?.name ?? '記録照合'}</small>
        </div>
      </div>
    </div>
  );
}

function EvidenceClash({
  cue,
  evidenceById,
  charactersById,
}: {
  cue: EvidenceClashCue;
  evidenceById: Map<string, Evidence>;
  charactersById: Map<string, Character>;
}) {
  const speaker = cue.speakerId ? charactersById.get(cue.speakerId) : undefined;
  const speakerPortrait = getCharacterPortrait(speaker, cue.tone);
  const sequence = getEvidenceClashSequence(cue);

  return (
    <aside className={`evidence-clash tone-${cue.tone}`} role="status" aria-live="polite">
      <div className="clash-heading">
        <span>{cue.subtitle}</span>
        <strong>{cue.title}</strong>
      </div>
      <div className="clash-body">
        <section className="clash-speaker">
          <img src={speakerPortrait} alt="" />
          <div>
          <span>{speaker?.name ?? '記録'}</span>
          <p>{cue.prompt}</p>
          </div>
        </section>
        <section>
          <span>照合結果</span>
          <p>{cue.conclusion}</p>
        </section>
      </div>
      <div className="clash-sequence" aria-label="提示の流れ">
        {sequence.map((step, index) => (
          <section className="clash-sequence-step" key={step.label}>
            <em>{String(index + 1).padStart(2, '0')}</em>
            <div>
              <span>{step.label}</span>
              <p>{step.text}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="clash-evidence" aria-label="照合した証拠">
        {cue.evidenceIds.map((id) => {
          const evidence = evidenceById.get(id);
          return (
            <span key={id}>
              <img src={evidence?.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              {evidence?.name ?? id}
            </span>
          );
        })}
      </div>
    </aside>
  );
}

function getEvidenceClashSequence(cue: EvidenceClashCue) {
  const evidenceLabel = cue.evidenceIds.length > 1 ? `${cue.evidenceIds.length} records` : cue.subtitle;
  return [
    {
      label: 'STATEMENT',
      text: cue.prompt,
    },
    {
      label: 'RECORD',
      text: evidenceLabel,
    },
    {
      label: 'VERDICT',
      text: cue.conclusion,
    },
  ];
}

function PresentBreakdownPanel({
  breakdown,
  evidenceById,
  charactersById,
}: {
  breakdown: PresentBreakdown;
  evidenceById: Map<string, Evidence>;
  charactersById: Map<string, Character>;
}) {
  const character = charactersById.get(breakdown.characterId);
  const evidence = evidenceById.get(breakdown.evidenceId);
  const steps = [
    { label: '発言', text: breakdown.before },
    { label: '証拠', text: breakdown.hit },
    { label: '認めた点', text: breakdown.concession },
    { label: '次の一手', text: breakdown.nextStep },
  ];

  return (
    <aside className="present-breakdown" role="status" aria-live="polite">
      <div className="present-breakdown-heading">
        <img src={getCharacterPortrait(character, 'pressure')} alt="" />
        <div>
          <span>反応分析</span>
          <strong>{breakdown.title}</strong>
          <p>
            {character?.name ?? '相手'}の説明に、{evidence?.name ?? '証拠'}がどこまで食い込んだかを整理する。
          </p>
        </div>
      </div>
      <div className="present-breakdown-steps">
        {steps.map((step, index) => (
          <section key={step.label}>
            <em>{String(index + 1).padStart(2, '0')}</em>
            <span>{step.label}</span>
            <p>{step.text}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}

function createPresentBreakdown(
  reaction: PresentReaction,
  charactersById: Map<string, Character>,
  evidenceById: Map<string, Evidence>,
): PresentBreakdown {
  const character = charactersById.get(reaction.characterId);
  const evidence = evidenceById.get(reaction.evidenceId);
  const title = `${character?.name ?? '相手'}に${evidence?.name ?? '証拠'}を突きつけた`;
  const fallback = {
    before: character?.summary ?? '相手の説明を確認する。',
    hit: evidence?.detail ?? '提示した証拠の意味を確認する。',
    concession: reaction.log ?? reaction.text,
    nextStep: '崩れた点を事件ファイルと次の行動に結び直す。',
  };

  switch (reaction.id) {
    case 'present-printer-to-clerk':
      return {
        id: Date.now(),
        characterId: reaction.characterId,
        evidenceId: reaction.evidenceId,
        title,
        before: '真壁は23時台の印刷履歴だけで最初に疑われていた。',
        hit: 'プリンタ履歴のファイル名は、準備書面ではなく別件の照会回答書だった。',
        concession: '真壁の深夜帰所は、削除の機会ではなく別件印刷の説明として整理できる。',
        nextStep: '来訪カードと共用PCの更新時刻をつなぎ、疑いを久世側へ移す。',
      };
    case 'present-old-draft-to-client':
      return {
        id: Date.now(),
        characterId: reaction.characterId,
        evidenceId: reaction.evidenceId,
        title,
        before: '久世は問題の一文を入れるよう強く求めていた。',
        hit: '旧版には、裏付けが弱いまま出すと反撃を招く一文が残っている。',
        concession: '久世は一文の危険性を理解しており、削除する動機の入口が見えた。',
        nextStep: '来訪カードと共用PCの状態を合わせ、編集できた機会まで詰める。',
      };
    case 'present-visitor-to-client':
      return {
        id: Date.now(),
        characterId: reaction.characterId,
        evidenceId: reaction.evidenceId,
        title,
        before: '久世は書類を置きに来ただけだと説明していた。',
        hit: '来訪カード履歴は、23時39分に受付から会議室前へ進めた事実を示す。',
        concession: '久世には共用PCへ触れられる位置と時間があった。',
        nextStep: '削除後に説明する準備があったか、メール下書きで理由まで詰める。',
      };
    case 'present-email-to-client':
      return {
        id: Date.now(),
        characterId: reaction.characterId,
        evidenceId: reaction.evidenceId,
        title,
        before: '久世は削除に直接関わったとは認めていなかった。',
        hit: 'メール下書きは、削除理由と説明準備を削除後の時刻へ結びつける。',
        concession: '削除者、理由、説明準備が一本につながり、最終推理へ進める。',
        nextStep: '送信予約メモを事件ファイルで確認し、最終推理の根拠に組み込む。',
      };
    default:
      return {
        id: Date.now(),
        characterId: reaction.characterId,
        evidenceId: reaction.evidenceId,
        ...fallback,
        title,
      };
  }
}

function createImpactCue(cue: Omit<EvidenceClashCue, 'id'>, id: number): ImpactCue {
  const decisive = cue.tone === 'success';
  return {
    id,
    tone: cue.tone,
    word: decisive ? '突破!' : '異議あり!',
    subtitle: cue.title,
    detail: cue.subtitle,
    speakerId: cue.speakerId,
    evidenceId: cue.evidenceIds[0],
  };
}

function createCutInCue(previous: GameState, next: GameState): CutInCue | undefined {
  const tone = next.tone;
  const changed =
    previous.narrative !== next.narrative ||
    previous.credibility !== next.credibility ||
    previous.endingId !== next.endingId;

  if (!changed || tone === 'neutral' || tone === 'investigation' || !tone) return undefined;

  if (tone === 'damage') {
    return {
      id: Date.now(),
      tone,
      title: next.endingId === 'failure' ? '推理不成立' : '信用低下',
      subtitle: next.endingId === 'failure' ? '結論が崩れた' : '証拠の読み方を見直す',
    };
  }

  if (tone === 'pressure') {
    return {
      id: Date.now(),
      tone,
      title: '追及',
      subtitle: '発言が揺らぐ',
    };
  }

  return {
    id: Date.now(),
    tone,
    title: next.endingId === 'success' ? '結論成立' : '突破',
    subtitle: next.endingId === 'success' ? '記録が一本につながった' : '新しい筋道が見えた',
  };
}

function getInteractionSpeakerId(interaction: Interaction): string {
  const cueSource = interaction as InteractionCueSource;
  return cueSource.characterId ?? 'assistant';
}

function getInteractionTone(interaction: Interaction): MessageTone {
  const cueSource = interaction as InteractionCueSource;
  if (interaction.setFlags?.includes(episode.finalFlag)) return 'success';
  if (cueSource.evidenceId) return 'pressure';
  if (cueSource.characterId) return 'pressure';
  if (interaction.addEvidence?.length) return 'investigation';
  return 'neutral';
}

function getHearingReactionLabel(tone?: MessageTone): string | undefined {
  if (tone === 'damage') return '指摘が弱い。信用が下がった。';
  if (tone === 'pressure') return '証言が揺らいだ。次の矛盾を絞る。';
  if (tone === 'success') return '対決の突破口を押さえた。';
  return undefined;
}

function getHearingPortraitTone(
  routeInfo: HearingRouteInfo,
  stateTone?: MessageTone,
): MessageTone {
  if (stateTone === 'damage' || stateTone === 'success') return stateTone;
  if (routeInfo.status === 'cleared') return 'success';
  if (routeInfo.status === 'ready' || routeInfo.status === 'needs-press') return 'pressure';
  return stateTone === 'pressure' ? 'pressure' : 'neutral';
}

function getHearingRouteInfo(
  state: GameState,
  statement?: HearingStatement,
): HearingRouteInfo {
  if (!statement) {
    return {
      status: 'context',
      label: '証言選択',
      detail: '崩したい発言を選ぶ。',
      cue: '発言、証拠、時刻を同じ画面で比べる。',
    };
  }

  const pressed = Boolean(statement.pressFlag && state.flags.includes(statement.pressFlag));
  const contradiction = episode.hearing.contradictions.find(
    (item) => item.statementId === statement.id,
  );

  if (!contradiction) {
    return {
      status: pressed ? 'cleared' : 'context',
      label: pressed ? '背景確認済み' : '背景証言',
      detail: pressed
        ? '移動範囲は固まった。核心の発言へ移る。'
        : 'まず詳しく聞き、来訪目的と移動経路を固定する。',
      cue: getHearingEvidenceCue(statement.id),
    };
  }

  const cleared = contradiction.setFlags?.some((flag) => state.flags.includes(flag));
  if (cleared) {
    return {
      status: 'cleared',
      label: '突破済み',
      detail: 'この発言の逃げ道は証拠で崩れている。',
      cue: getHearingEvidenceCue(statement.id),
      contradiction,
    };
  }

  const needsPress =
    Boolean(statement.pressFlag && contradiction.requiresFlags?.includes(statement.pressFlag)) &&
    !pressed;

  if (needsPress) {
    return {
      status: 'needs-press',
      label: '要ゆさぶり',
      detail: '先に詳しく聞いて、発言の表現を固定する。',
      cue: getHearingEvidenceCue(statement.id),
      contradiction,
    };
  }

  if (!hasAllFlags(state, contradiction.requiresFlags)) {
    return {
      status: 'locked',
      label: '前提不足',
      detail: '先に前段の矛盾を崩さないと、この説明には逃げ道が残る。',
      cue: getHearingEvidenceCue(statement.id),
      contradiction,
    };
  }

  return {
    status: 'ready',
    label: '提示可能',
    detail: 'この発言は証拠で崩せる段階に入っている。',
    cue: getHearingEvidenceCue(statement.id),
    contradiction,
  };
}

function getHearingEvidenceCue(statementId: string): string {
  switch (statementId) {
    case 'statement-visit-only':
      return '来訪目的と会議室前まで案内された事実を固める。';
    case 'statement-no-edit':
      return '共用PCのログイン状態と保存時刻を見る。';
    case 'statement-later-fear':
      return '削除直後に説明を残した記録を見る。';
    default:
      return '発言の時刻と証拠の時刻を比べる。';
  }
}

function getWitnessReadout(
  state: GameState,
  statement: HearingStatement | undefined,
  routeInfo: HearingRouteInfo,
): string {
  if (!statement) return '証言を選ぶ。';
  if (state.tone === 'damage') {
    return '相手は反論できる余地を探している。証拠の役割を絞る必要がある。';
  }
  if (routeInfo.status === 'cleared') {
    return '説明の軸が崩れ、次の発言に逃げようとしている。';
  }
  if (routeInfo.status === 'ready') {
    return '発言の弱点が固定された。記録を示せば押し込める。';
  }
  if (routeInfo.status === 'needs-press') {
    return 'まだ曖昧に答えている。詳しく聞いて言い逃れを狭める。';
  }
  if (routeInfo.status === 'locked') {
    return 'ここを詰めるには、先に別の説明を崩す必要がある。';
  }
  return '背景を固める発言。核心に入る前の足場になる。';
}

function createHearingPressCue(statement: HearingStatement): Omit<HearingCue, 'id'> {
  const evidenceCandidate = getHearingPressEvidenceCandidate(statement.id);

  return {
    tone: 'pressure',
    title: 'ゆさぶり',
    subtitle: statement.speaker,
    statement: statement.text,
    response: statement.pressText ?? statement.note,
    nextAction: getHearingPressNextAction(statement.id),
    speakerId: statement.characterId,
    candidateEvidenceIds: evidenceCandidate.evidenceIds,
    candidateReason: evidenceCandidate.reason,
  };
}

function getHearingPressEvidenceCandidate(statementId: string): {
  evidenceIds: string[];
  reason: string;
} {
  switch (statementId) {
    case 'statement-visit-only':
      return {
        evidenceIds: ['visitor-log'],
        reason: '受付から会議室前までの動線が、書類を置いただけという説明の幅を狭める。',
      };
    case 'statement-no-edit':
      return {
        evidenceIds: ['file-history'],
        reason: '共用PCの更新履歴が、権限ではなく編集機会を示す。',
      };
    case 'statement-later-fear':
      return {
        evidenceIds: ['scheduled-message'],
        reason: '削除直後の説明準備が、怖くなった時期を帰宅後へずらす説明とぶつかる。',
      };
    default:
      return {
        evidenceIds: [],
        reason: '',
      };
  }
}

function createHearingMissCue(
  statement: HearingStatement | undefined,
  selectedEvidence: Evidence | undefined,
  routeInfo: HearingRouteInfo,
): Omit<HearingCue, 'id'> {
  return {
    tone: 'damage',
    title: '指摘が弱い',
    subtitle: selectedEvidence?.name ?? '証拠未選択',
    statement: statement?.text ?? '証言を選び直す。',
    response: selectedEvidence
      ? `${selectedEvidence.name}では、この発言の弱点にまだ届いていない。`
      : '証拠を示さなければ、発言は崩れない。',
    nextAction: getHearingMissNextAction(routeInfo),
    speakerId: statement?.characterId ?? 'client-b',
    evidenceId: selectedEvidence?.id,
    candidateEvidenceIds: routeInfo.contradiction ? [routeInfo.contradiction.evidenceId] : undefined,
    candidateReason: routeInfo.contradiction ? getHearingMissCandidateReason(routeInfo) : undefined,
  };
}

function getHearingMissCandidateReason(routeInfo: HearingRouteInfo): string {
  if (routeInfo.status === 'needs-press') {
    return '先に詳しく聞いて、証言を証拠に当てられる形へ絞る。';
  }
  if (routeInfo.status === 'locked') {
    return '先の矛盾を崩してから、この証言の候補証拠を読み直す。';
  }
  return 'この証言で崩すべき記録を読み直し、発言のどの部分と食い違うかを確認する。';
}

function getHearingPressNextAction(statementId: string): string {
  switch (statementId) {
    case 'statement-visit-only':
      return '来訪記録で、受付から会議室前までの動線を確認する。';
    case 'statement-no-edit':
      return '共用PCの更新履歴を示し、編集権限ではなく編集機会を問う。';
    case 'statement-later-fear':
      return '送信予約メモの時刻を示し、怖くなった時期の説明を崩す。';
    default:
      return '証言の言い切った部分と、記録の時刻を並べて読む。';
  }
}

function getHearingMissNextAction(routeInfo: HearingRouteInfo): string {
  if (routeInfo.status === 'needs-press') {
    return '先に詳しく聞いて、曖昧な説明を証拠に当てられる形まで狭める。';
  }
  if (routeInfo.status === 'locked') {
    return '前段の矛盾を崩してから、この発言へ戻る。';
  }
  if (routeInfo.contradiction) {
    return '発言のどの部分と証拠のどの時刻が食い違うか、事件ファイルで確認する。';
  }
  return 'ここは背景確認用。核心発言へ移動してから証拠を示す。';
}

function getDeductionHint(questionId: string): string {
  switch (questionId) {
    case 'culprit':
      return '削除者の特定を見直す。来訪記録と共用PCの更新時刻を合わせて読む。';
    case 'reason':
      return '削除理由を見直す。問題の一文が強みではなく危険にもなる理由を確認する。';
    case 'opportunity':
      return '機会を見直す。誰の名義かではなく、どの端末に触れられたかを確認する。';
    case 'proof':
      return '決め手を見直す。単独の記録ではなく、下書き、来訪、更新履歴のつながりを見る。';
    default:
      return '事件ファイルと時系列を見直す。';
  }
}

interface RenderContext {
  state: GameState;
  currentLocation: Location;
  acquiredEvidence: Evidence[];
  answers: Record<string, string>;
  deductionEvidenceAnswers: Record<string, string>;
  caseFileTab: CaseFileTab;
  selectedEvidenceId?: string;
  analysisSelections: Record<string, { first?: string; second?: string }>;
  hearingSelection: { statementId?: string; evidenceId?: string };
  presentSelection: { characterId?: string; evidenceId?: string };
  consultLevel: number;
  deductionFeedback: DeductionFeedback;
  hearingCue?: HearingCue;
  presentMissNote?: PresentMissNote;
  finalUnlocked: boolean;
  analysisComplete: boolean;
  hearingCleared: boolean;
  reviewUnlocked: boolean;
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
  openingSceneIndex: number;
  endingSceneIndex: number;
  onOpeningScene: (index: number) => void;
  onEndingScene: (index: number) => void;
  onStart: () => void;
  onMove: (locationId: string) => void;
  onRunInteraction: (interaction: Interaction) => void;
  onPresentSelection: (selection: { characterId?: string; evidenceId?: string }) => void;
  onSubmitPresent: () => void;
  onConsultLevel: (level: number) => void;
  onOpenCaseEvidence: (id: string) => void;
  onRunAnalysisLink: (link: AnalysisLink) => void;
  onAnalysisSelection: (
    selections: Record<string, { first?: string; second?: string }>,
  ) => void;
  onHearingSelection: (selection: { statementId?: string; evidenceId?: string }) => void;
  onPressHearing: () => void;
  onSubmitHearing: () => void;
  onCaseFileTab: (tab: CaseFileTab) => void;
  onSelectEvidence: (id: string) => void;
  onOpenEvidence: (id: string) => void;
  onAnswer: (answers: Record<string, string>) => void;
  onDeductionEvidenceAnswer: (answers: Record<string, string>) => void;
  onSubmitDeduction: () => void;
  onModeChange: (mode: ViewMode) => void;
}

function renderActionPanel(context: RenderContext) {
  const {
    state,
    currentLocation,
    acquiredEvidence,
    answers,
    deductionEvidenceAnswers,
    caseFileTab,
    selectedEvidenceId,
    analysisSelections,
    hearingSelection,
    presentSelection,
    consultLevel,
    deductionFeedback,
    hearingCue,
    presentMissNote,
    finalUnlocked,
    analysisComplete,
    hearingCleared,
    reviewUnlocked,
    charactersById,
    evidenceById,
    openingSceneIndex,
    endingSceneIndex,
    onOpeningScene,
    onEndingScene,
    onStart,
    onMove,
    onRunInteraction,
    onPresentSelection,
    onSubmitPresent,
    onConsultLevel,
    onOpenCaseEvidence,
    onRunAnalysisLink,
    onAnalysisSelection,
    onHearingSelection,
    onPressHearing,
    onSubmitHearing,
    onCaseFileTab,
    onSelectEvidence,
    onOpenEvidence,
    onAnswer,
    onDeductionEvidenceAnswer,
    onSubmitDeduction,
    onModeChange,
  } = context;

  if (state.mode === 'briefing') {
    const openingScenes = episode.openingScenes ?? [];
    const openingScene = getStoryScene(openingScenes, openingSceneIndex);

    return (
      <StoryStagePanel
        icon={BookOpen}
        title="事件の開幕"
        subtitle="提出前夜の違和感を追う"
        scene={openingScene}
        sceneIndex={openingSceneIndex}
        sceneCount={openingScenes.length}
        finalLabel="調査を始める"
        secondaryLabel="調査を始める"
        onSceneChange={onOpeningScene}
        onFinal={onStart}
        onSecondary={onStart}
      />
    );
  }

  if (state.mode === 'move') {
    return <MovePanel state={state} currentLocationId={state.currentLocationId} onMove={onMove} />;
  }

  if (state.mode === 'consult') {
    return (
      <ConsultPanel
        state={state}
        level={consultLevel}
        evidenceById={evidenceById}
        onLevel={onConsultLevel}
        onModeChange={onModeChange}
        onOpenEvidence={onOpenCaseEvidence}
      />
    );
  }

  if (state.mode === 'inspect') {
    const actions = currentLocation.actions.filter((action) => canRunInteraction(state, action));
    return (
      <InspectPanel
        state={state}
        location={currentLocation}
        emptyText="今ここで調べられるものはない。別の場所か会話を確認する。"
        items={actions}
        evidenceById={evidenceById}
        onRun={onRunInteraction}
      />
    );
  }

  if (state.mode === 'talk') {
    const talks = episode.talks.filter(
      (talk) =>
        (!talk.availableAt?.length || talk.availableAt.includes(state.currentLocationId)) &&
        canRunInteraction(state, talk),
    );
    const readyPresentReactions = episode.presentReactions.filter(
      (reaction) =>
        (!reaction.availableAt?.length ||
          reaction.availableAt.includes(state.currentLocationId)) &&
        state.evidenceIds.includes(reaction.evidenceId) &&
        canRunInteraction(state, reaction),
    );
    return (
      <TalkPanel
        state={state}
        talks={talks}
        presentReactions={readyPresentReactions}
        charactersById={charactersById}
        evidenceById={evidenceById}
        onRun={onRunInteraction}
        onModeChange={onModeChange}
      />
    );
  }

  if (state.mode === 'present') {
    const reactions = episode.presentReactions.filter(
      (reaction) =>
        (!reaction.availableAt?.length ||
          reaction.availableAt.includes(state.currentLocationId)) &&
        state.evidenceIds.includes(reaction.evidenceId) && canRunInteraction(state, reaction),
    );
    const targetCharacters = episode.characters.filter((character) =>
      episode.presentReactions.some(
        (reaction) =>
          reaction.characterId === character.id &&
          (!reaction.availableAt?.length || reaction.availableAt.includes(state.currentLocationId)),
      ),
    );
    return (
      <PresentPanel
        reactions={reactions}
        characters={targetCharacters}
        evidence={acquiredEvidence}
        selection={presentSelection}
        missNote={presentMissNote}
        onSelection={onPresentSelection}
        onSubmit={onSubmitPresent}
        onOpenEvidence={onOpenEvidence}
      />
    );
  }

  if (state.mode === 'analysis') {
    return (
      <AnalysisPanel
        state={state}
        evidence={acquiredEvidence}
        selections={analysisSelections}
        evidenceById={evidenceById}
        onSelection={onAnalysisSelection}
        onRun={onRunAnalysisLink}
      />
    );
  }

  if (state.mode === 'hearing') {
    return (
      <HearingPanel
        state={state}
        evidence={acquiredEvidence}
        cue={hearingCue}
        charactersById={charactersById}
        evidenceById={evidenceById}
        selection={hearingSelection}
        onSelection={onHearingSelection}
        onPress={onPressHearing}
        onSubmit={onSubmitHearing}
        onOpenEvidence={onOpenEvidence}
      />
    );
  }

  if (state.mode === 'deduction') {
    return (
      <DeductionPanel
        finalUnlocked={hearingCleared}
        answers={answers}
        evidenceAnswers={deductionEvidenceAnswers}
        evidence={acquiredEvidence}
        feedback={deductionFeedback}
        onAnswer={onAnswer}
        onEvidenceAnswer={onDeductionEvidenceAnswer}
        onSubmit={onSubmitDeduction}
        onOpenEvidence={onOpenEvidence}
      />
    );
  }

  if (state.mode === 'evidence') {
    return (
      <CaseFilePanel
        state={state}
        evidence={acquiredEvidence}
        characters={episode.characters}
        timeline={episode.timeline}
        evidenceById={evidenceById}
        tab={caseFileTab}
        selectedEvidenceId={selectedEvidenceId}
        onTabChange={onCaseFileTab}
        onSelectEvidence={onSelectEvidence}
        onModeChange={onModeChange}
      />
    );
  }

  if (state.mode === 'log') {
    return (
      <LogPanel
        log={state.log}
        history={state.history ?? []}
        charactersById={charactersById}
        evidenceById={evidenceById}
        onOpenEvidence={onOpenCaseEvidence}
        onModeChange={onModeChange}
      />
    );
  }

  if (state.mode === 'review') {
    return (
      <CaseReviewPanel
        state={state}
        unlocked={reviewUnlocked}
        evidenceById={evidenceById}
        onModeChange={onModeChange}
      />
    );
  }

  if (state.mode === 'materials') {
    return (
      <ProductionMaterialsPanel
        unlocked={reviewUnlocked}
        onModeChange={onModeChange}
      />
    );
  }

  const ending = state.endingId === 'success' ? episode.endings.success : episode.endings.failure;
  const endingScenes = ending.scenes ?? [];
  const endingScene = getStoryScene(endingScenes, endingSceneIndex);
  return (
    <StoryStagePanel
      icon={CheckCircle2}
      title={ending.title}
      subtitle="結末"
      scene={endingScene}
      sceneIndex={endingSceneIndex}
      sceneCount={endingScenes.length}
      fallbackText={ending.text}
      finalLabel={state.endingId === 'success' ? '事件解剖を見る' : '事件ファイルを見る'}
      secondaryLabel="推理を見直す"
      resultPanel={<EndingResultPanel state={state} evidenceById={evidenceById} />}
      onSceneChange={onEndingScene}
      onFinal={() => onModeChange(state.endingId === 'success' ? 'review' : 'evidence')}
      onSecondary={() => onModeChange('deduction')}
    />
  );
}

function StoryStagePanel({
  icon,
  title,
  subtitle,
  scene,
  sceneIndex,
  sceneCount,
  fallbackText,
  finalLabel,
  secondaryLabel,
  resultPanel,
  onSceneChange,
  onFinal,
  onSecondary,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  scene?: StoryScene;
  sceneIndex: number;
  sceneCount: number;
  fallbackText?: string;
  finalLabel: string;
  secondaryLabel?: string;
  resultPanel?: ReactNode;
  onSceneChange: (index: number) => void;
  onFinal: () => void;
  onSecondary?: () => void;
}) {
  const displayCount = Math.max(sceneCount, 1);
  const currentIndex = Math.min(Math.max(sceneIndex, 0), displayCount - 1);
  const hasPrevious = sceneCount > 0 && currentIndex > 0;
  const hasNext = sceneCount > 0 && currentIndex < sceneCount - 1;
  const showSecondary = Boolean(secondaryLabel && (hasNext || secondaryLabel !== finalLabel));

  return (
    <section className="action-stack story-stage-panel">
      <PanelTitle icon={icon} title={title} subtitle={subtitle} />
      <div className="story-progress" aria-live="polite">
        <span>幕 {currentIndex + 1}/{displayCount}</span>
        <strong>{scene?.title ?? title}</strong>
      </div>
      <p className="panel-copy">{scene?.detail ?? fallbackText}</p>
      {resultPanel}
      <div className="story-actions">
        {hasPrevious ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onSceneChange(currentIndex - 1)}
          >
            前の幕へ
          </button>
        ) : null}
        <button
          className="primary-button"
          type="button"
          onClick={() => (hasNext ? onSceneChange(currentIndex + 1) : onFinal())}
        >
          {hasNext ? '次の幕へ' : finalLabel}
        </button>
        {showSecondary ? (
          <button className="secondary-button" type="button" onClick={onSecondary ?? onFinal}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function EndingResultPanel({
  state,
  evidenceById,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
}) {
  const success = state.endingId === 'success';
  const items = episode.deduction.questions.map((question, index) => {
    const evidence = evidenceById.get(question.evidenceAnswer);
    return {
      id: question.id,
      index: String(index + 1).padStart(2, '0'),
      label: question.stageLabel ?? question.prompt,
      answer: question.choices.find((choice) => choice.id === question.answer)?.label ?? question.answer,
      evidenceName: evidence?.name ?? question.evidenceAnswer,
      evidenceImage: evidence?.image ?? withBasePath('/assets/evidence/document-stack.webp'),
    };
  });

  return (
    <aside className={success ? 'ending-result-panel success' : 'ending-result-panel failure'} aria-label="結論リザルト">
      {success ? <VerdictScenePanel evidenceById={evidenceById} /> : null}
      <div className="ending-result-heading">
        <span>{success ? 'Verdict locked' : 'Review route'}</span>
        <strong>{success ? '記録で立証できた4点' : '崩れた推理を戻す順番'}</strong>
        <p>
          {success
            ? '人物、理由、機会、決め手をそれぞれ別の記録で支えたため、結論が一本につながった。'
            : '結論が崩れた時は、人物と証拠の組み合わせを先に戻す。事件ファイルで証拠の役割を確認する。'}
        </p>
      </div>
      <div className="ending-result-grid">
        {items.map((item) => (
          <section key={item.id}>
            <img src={item.evidenceImage} alt="" />
            <div>
              <span>{item.index} {item.label}</span>
              <strong>{success ? item.answer : item.evidenceName}</strong>
              <p>{success ? item.evidenceName : 'この証拠を、どの問いに使うべきか見直す。'}</p>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function VerdictScenePanel({ evidenceById }: { evidenceById: Map<string, Evidence> }) {
  const points = episode.deduction.questions.map((question, index) => {
    const evidence = evidenceById.get(question.evidenceAnswer);
    const answer = question.choices.find((choice) => choice.id === question.answer)?.label ?? question.answer;
    return {
      id: question.id,
      index: String(index + 1).padStart(2, '0'),
      label: question.stageLabel ?? question.prompt,
      answer,
      evidence,
      text: question.rebuttal ?? question.prompt,
    };
  });

  return (
    <section className="verdict-scene-panel" aria-label="法廷最終弁論">
      <div className="verdict-scene-heading">
        <div>
          <span>FINAL VERDICT</span>
          <strong>書かない判断の責任を、記録で確定する</strong>
          <p>削除者、理由、機会、決め手を順に読み上げ、最後の逃げ道を塞ぐ。</p>
        </div>
        <em>成立</em>
      </div>
      <div className="verdict-scene-bench" aria-hidden="true">
        <span>弁護側</span>
        <strong>異議なし</strong>
        <span>証人席</span>
      </div>
      <div className="verdict-scene-grid">
        {points.map((point) => (
          <article key={point.id}>
            <div>
              <em>{point.index}</em>
              <span>{point.label}</span>
            </div>
            <strong>{point.answer}</strong>
            <p>{point.text}</p>
            {point.evidence ? (
              <small>
                <img src={point.evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                {point.evidence.name}
              </small>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

type ConsultationGuide = {
  title: string;
  summary: string;
  hints: string[];
  relatedEvidenceIds?: string[];
  nextMode: ViewMode;
  nextLabel: string;
};

type CaseDirectorStage = {
  id: string;
  label: string;
  detail: string;
  mode: ViewMode;
  current: number;
  total: number;
};

function FocusActionCard({
  guide,
  onNext,
  onConsult,
}: {
  guide: ConsultationGuide;
  onNext: () => void;
  onConsult: () => void;
}) {
  const command = commandItems.find((item) => item.mode === guide.nextMode);
  const Icon = command?.icon ?? Lightbulb;
  const reason = guide.hints[0] ?? guide.summary;

  return (
    <section className="focus-action-card" aria-label="次の一手">
      <div className="focus-action-copy">
        <span>次の一手</span>
        <strong>{guide.nextLabel}</strong>
        <p>{reason}</p>
      </div>
      <div className="focus-action-buttons">
        <button className="focus-next-button" type="button" onClick={onNext}>
          <Icon aria-hidden="true" />
          <span>{command?.label ?? guide.nextLabel}</span>
        </button>
        <button className="focus-consult-button" type="button" onClick={onConsult}>
          <Lightbulb aria-hidden="true" />
          <span>相談する</span>
        </button>
      </div>
    </section>
  );
}

function CaseDirector({
  state,
  guide,
  onModeChange,
}: {
  state: GameState;
  guide: ConsultationGuide;
  onModeChange: (mode: ViewMode) => void;
}) {
  const stages = getCaseDirectorStages(state);
  const currentStage = stages.find((stage) => stage.current < stage.total) ?? stages[stages.length - 1];
  const command = commandItems.find((item) => item.mode === guide.nextMode);
  const Icon = command?.icon ?? Lightbulb;

  return (
    <section className="case-director" aria-label="case director">
      <div className="case-director-heading">
        <div>
          <span>CASE DIRECTOR</span>
          <strong>{currentStage.label}</strong>
        </div>
        <em>
          {stages.filter((stage) => stage.current >= stage.total).length}/{stages.length}
        </em>
      </div>
      <button className="case-director-next" type="button" onClick={() => onModeChange(guide.nextMode)}>
        <Icon aria-hidden="true" />
        <span>
          <strong>{guide.nextLabel}</strong>
          <small>{guide.title}</small>
        </span>
      </button>
      <div className="case-director-arc">
        {stages.map((stage) => {
          const complete = stage.current >= stage.total;
          const active = stage.id === currentStage.id && !complete;
          const percent = Math.round((stage.current / stage.total) * 100);

          return (
            <button
              className={complete ? 'complete' : active ? 'active' : ''}
              type="button"
              key={stage.id}
              onClick={() => onModeChange(stage.mode)}
            >
              <span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </span>
              <em>{stage.current}/{stage.total}</em>
              <i aria-hidden="true">
                <b style={{ width: `${percent}%` }} />
              </i>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChapterGuide({ state, guide }: { state: GameState; guide: ConsultationGuide }) {
  const chapter = getChapterGuide(state, guide);

  return (
    <section className={`chapter-guide tone-${chapter.tone}`} aria-label="chapter guide">
      <div className="chapter-guide-heading">
        <div>
          <span>CHAPTER GUIDE</span>
          <strong>{chapter.title}</strong>
        </div>
        <em>{chapter.verb}</em>
      </div>
      <p>{chapter.summary}</p>
      <div className="chapter-guide-grid">
        {chapter.steps.map((step, index) => (
          <span key={step}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            {step}
          </span>
        ))}
      </div>
      <small>{chapter.fallback}</small>
    </section>
  );
}

function getChapterGuide(
  state: GameState,
  guide: ConsultationGuide,
): {
  title: string;
  verb: string;
  summary: string;
  steps: string[];
  fallback: string;
  tone: 'investigation' | 'pressure' | 'deduction' | 'review';
} {
  if (state.mode === 'present') {
    return {
      title: '人物に証拠を当てる',
      verb: '見せる',
      summary: '証拠は相手の説明を動かすために使う。人物、記録、場所条件の3つがそろう組み合わせを探す。',
      steps: ['人物を選ぶ', '証拠を選ぶ', '反応を読む'],
      fallback: '反応が弱い時は人物ファイルか相談メモで、証拠の相手を確認する。',
      tone: 'pressure',
    };
  }
  if (state.mode === 'analysis') {
    return {
      title: '証拠同士を争点に変える',
      verb: '整理',
      summary: '単独の証拠ではなく、2つの記録を組み合わせて「理由」「機会」「説明」を作る。',
      steps: ['争点を読む', '2証拠を選ぶ', '整理する'],
      fallback: '候補が分からない時は事件ファイルの理論タブと証拠用途を読む。',
      tone: 'deduction',
    };
  }
  if (state.mode === 'hearing') {
    return {
      title: '証言を狭めてから矛盾を示す',
      verb: '対決',
      summary: '曖昧な発言は先に詳しく聞く。発言が固定されたら、時刻や記録と食い違う一点を突く。',
      steps: ['発言を選ぶ', '必要なら詳しく聞く', '証拠を示す'],
      fallback: '詰まった時は崩し順メモで、先に崩すべき発言を確認する。',
      tone: 'pressure',
    };
  }
  if (state.mode === 'deduction') {
    return {
      title: '4つの問いを一本の結論にする',
      verb: '推理',
      summary: '削除者、理由、機会、決め手をそれぞれ別の証拠で支える。全てそろうと最終弁論へ進める。',
      steps: ['答えを選ぶ', '根拠証拠を選ぶ', '結論を提出'],
      fallback: '赤い判定が出たら、誤った問いだけ事件ファイルで証拠の役割を見直す。',
      tone: 'deduction',
    };
  }
  if (state.mode === 'ending' || state.mode === 'review' || state.mode === 'materials') {
    return {
      title: '真相を読み返す',
      verb: '復習',
      summary: '結論後は、どの証拠がどの役割を果たしたかを事件解剖で確認できる。',
      steps: ['結論を読む', '証拠の鎖を見る', '制作資料へ進む'],
      fallback: '別ルートを確認したい時は推理を見直す。',
      tone: 'review',
    };
  }
  if (state.mode === 'evidence' || state.mode === 'log' || state.mode === 'consult') {
    return {
      title: guide.title,
      verb: '確認',
      summary: guide.summary,
      steps: ['現在地を見る', '関連証拠を読む', guide.nextLabel],
      fallback: '迷ったら相談メモを1段階開き、次のモードへ戻る。',
      tone: 'investigation',
    };
  }
  return {
    title: '現場から記録を集める',
    verb: state.mode === 'talk' ? '話す' : state.mode === 'inspect' ? '調べる' : '移動',
    summary: '調査中は、場所、人物、証拠の順に前提を増やす。集めた記録が後の提示、対決、推理につながる。',
    steps: ['場所を選ぶ', '調べる・話す', '入手証拠を読む'],
    fallback: '次に迷った時は、現在の焦点か相談メモから進む。',
    tone: 'investigation',
  };
}

function CaseMap({
  state,
  onModeChange,
}: {
  state: GameState;
  onModeChange: (mode: ViewMode) => void;
}) {
  const chapters = getCaseMapChapters(state);
  const completeCount = chapters.filter((chapter) => chapter.status === 'complete').length;

  return (
    <section className="case-map" aria-label="章マップ">
      <div className="case-map-heading">
        <div>
          <span>CASE MAP</span>
          <strong>章の進行と戻り先</strong>
        </div>
        <em>{completeCount}/{chapters.length}</em>
      </div>
      <div className="case-map-rail">
        {chapters.map((chapter, index) => (
          <button
            className={`case-map-node status-${chapter.status}`}
            type="button"
            key={chapter.id}
            disabled={chapter.status === 'locked'}
            onClick={() => onModeChange(chapter.mode)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{chapter.label}</strong>
            <small>{chapter.detail}</small>
            <i aria-hidden="true">
              <b style={{ width: `${chapter.percent}%` }} />
            </i>
          </button>
        ))}
      </div>
    </section>
  );
}

function getCaseMapChapters(state: GameState): Array<{
  id: string;
  label: string;
  detail: string;
  mode: ViewMode;
  status: 'complete' | 'active' | 'locked';
  percent: number;
}> {
  const flags = state.flags;
  const count = (requiredFlags: string[]) => requiredFlags.filter((flag) => flags.includes(flag)).length;
  const make = (
    id: string,
    label: string,
    detail: string,
    mode: ViewMode,
    current: number,
    total: number,
    unlocked: boolean,
  ) => {
    const complete = current >= total;
    const activeModes: ViewMode[] =
      id === 'investigation'
        ? ['move', 'inspect', 'talk', 'present', 'analysis', 'evidence', 'log', 'consult']
        : id === 'ending'
          ? ['ending', 'review', 'materials']
          : [mode];
    const active = activeModes.includes(state.mode);
    return {
      id,
      label,
      detail,
      mode,
      status: complete ? 'complete' : active && unlocked ? 'active' : unlocked ? 'active' : 'locked',
      percent: Math.round((Math.min(current, total) / total) * 100),
    } as const;
  };

  const finalUnlocked = flags.includes(episode.finalFlag);
  const analysisComplete = flags.includes('analysis_complete');
  const hearingStarted = finalUnlocked || analysisComplete;
  const hearingCleared = flags.includes(episode.hearing.requiredFlag);
  const caseCleared = flags.includes('case_cleared');

  return [
    make('investigation', '調査', '証拠を集める', 'inspect', state.evidenceIds.length, episode.evidence.length, true),
    make('present', '提示', '人物に証拠を当てる', 'present', count(['client_knows_risk', 'client_visit_confirmed', 'final_unlocked']), 3, state.evidenceIds.length > 1),
    make('analysis', '整理', '証拠同士をつなぐ', 'analysis', count(['analysis_sentence_risk', 'analysis_time_window', 'analysis_final_chain']), 3, finalUnlocked),
    make('hearing', '対決', '証言を崩す', 'hearing', count(['pressed_no_edit', 'hearing_pc_contradiction', 'pressed_later_fear', 'hearing_cleared']), 4, hearingStarted),
    make('deduction', '推理', '4論点を提出する', 'deduction', hearingCleared ? 1 : 0, 1, hearingCleared),
    make('ending', '終幕', '真相を確認する', caseCleared ? 'review' : 'deduction', caseCleared ? 1 : 0, 1, hearingCleared),
  ];
}

function getCaseDirectorStages(state: GameState): CaseDirectorStage[] {
  const flags = state.flags;
  const count = (requiredFlags: string[]) => requiredFlags.filter((flag) => flags.includes(flag)).length;

  return [
    {
      id: 'investigation',
      label: '捜査',
      detail: '現場と記録を集める',
      mode: 'inspect',
      current: Math.min(state.evidenceIds.length, episode.evidence.length),
      total: episode.evidence.length,
    },
    {
      id: 'present',
      label: '提示',
      detail: '人物に証拠をぶつける',
      mode: 'present',
      current: count(['client_knows_risk', 'client_visit_confirmed', 'final_unlocked']),
      total: 3,
    },
    {
      id: 'analysis',
      label: '整理',
      detail: '証拠同士をつなぐ',
      mode: 'analysis',
      current: count(['analysis_sentence_risk', 'analysis_time_window', 'analysis_final_chain']),
      total: 3,
    },
    {
      id: 'hearing',
      label: '対決',
      detail: '証言の矛盾を崩す',
      mode: 'hearing',
      current: count(['pressed_no_edit', 'hearing_pc_contradiction', 'pressed_later_fear', 'hearing_cleared']),
      total: 4,
    },
    {
      id: 'deduction',
      label: '推理',
      detail: '犯人・理由・機会・証拠',
      mode: 'deduction',
      current: flags.includes('case_cleared') ? 1 : 0,
      total: 1,
    },
  ];
}

function CredibilityRiskCard({ state }: { state: GameState }) {
  const credibility = state.credibility ?? MAX_CREDIBILITY;
  const lost = MAX_CREDIBILITY - credibility;
  const danger = credibility <= 1;
  const warning = credibility <= 2;
  const tone = danger ? 'danger' : warning ? 'warning' : 'stable';

  return (
    <section className={`credibility-risk-card tone-${tone}`} aria-label="credibility risk">
      <div className="credibility-risk-heading">
        <div>
          <span>CREDIBILITY</span>
          <strong>{getCredibilityRiskTitle(credibility)}</strong>
        </div>
        <em>
          {credibility}/{MAX_CREDIBILITY}
        </em>
      </div>
      <div className="credibility-risk-pips" aria-hidden="true">
        {Array.from({ length: MAX_CREDIBILITY }, (_, index) => (
          <span className={index < credibility ? 'filled' : ''} key={index} />
        ))}
      </div>
      <p>{getCredibilityRiskDetail(credibility)}</p>
      <div className="credibility-risk-stats">
        <span>
          <strong>{lost}</strong>
          lost
        </span>
        <span>
          <strong>{Math.max(0, credibility - 1)}</strong>
          safe misses
        </span>
      </div>
    </section>
  );
}

function getCredibilityRiskTitle(credibility: number) {
  if (credibility <= 1) return 'One more miss can collapse the route';
  if (credibility <= 2) return 'High pressure';
  if (credibility < MAX_CREDIBILITY) return 'Recover by reading the record';
  return 'Full trust';
}

function getCredibilityRiskDetail(credibility: number) {
  if (credibility <= 1) {
    return 'Before presenting or concluding, open the case file and confirm who, why, opportunity, and proof.';
  }
  if (credibility <= 2) {
    return 'Avoid guessing. Use the route boards and evidence roles before spending another action.';
  }
  if (credibility < MAX_CREDIBILITY) {
    return 'A wrong move has narrowed the margin. The next answer should be supported by a matching record.';
  }
  return 'You can press harder, but every wrong presentation still costs trust.';
}

function ConsultPanel({
  state,
  level,
  evidenceById,
  onLevel,
  onModeChange,
  onOpenEvidence,
}: {
  state: GameState;
  level: number;
  evidenceById: Map<string, Evidence>;
  onLevel: (level: number) => void;
  onModeChange: (mode: ViewMode) => void;
  onOpenEvidence: (id: string) => void;
}) {
  const consultation = getConsultation(state);
  const maxLevel = consultation.hints.length;
  const visibleHints = consultation.hints.slice(0, Math.min(level, maxLevel));
  const relatedEvidence = (consultation.relatedEvidenceIds ?? [])
    .filter((id) => state.evidenceIds.includes(id))
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));

  return (
    <section className="action-stack consult-panel">
      <PanelTitle icon={Lightbulb} title="相談メモ" subtitle="詰まりどころを段階的に整理する" />
      <article className="consult-card">
        <div className="consult-heading">
          <span>現在の読み筋</span>
          <strong>{consultation.title}</strong>
        </div>
        <p>{consultation.summary}</p>
      </article>

      <ol className="consult-steps" aria-label="相談ヒント">
        {visibleHints.map((hint, index) => (
          <li className="consult-step visible" key={hint}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{hint}</p>
          </li>
        ))}
        {Array.from({ length: maxLevel - visibleHints.length }, (_, index) => (
          <li className="consult-step locked" key={`locked-${index}`}>
            <span>{String(visibleHints.length + index + 1).padStart(2, '0')}</span>
            <p>まだ伏せておく。</p>
          </li>
        ))}
      </ol>

      {relatedEvidence.length ? (
        <div className="consult-evidence" aria-label="関連証拠">
          {relatedEvidence.map((item) => (
            <button
              className="evidence-chip"
              type="button"
              key={item.id}
              onClick={() => onOpenEvidence(item.id)}
            >
              <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <span>
                <strong>{item.name}</strong>
                <small>事件ファイルで読む</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="consult-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={level >= maxLevel}
          onClick={() => onLevel(Math.min(level + 1, maxLevel))}
        >
          もう少し踏み込む
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => onModeChange(consultation.nextMode)}
        >
          {consultation.nextLabel}
        </button>
      </div>
    </section>
  );
}

function getNextObjective(state: GameState): string {
  const flags = state.flags;
  const has = (flag: string) => flags.includes(flag);

  if (state.mode === 'briefing') return 'まず調査を開始する。';
  if (state.mode === 'materials') return '制作資料で、脚本意図と次回への種を確認する。';
  if (state.mode === 'review') return '事件解剖で、真相と証拠の鎖を読み返す。';
  if (state.mode === 'ending') return '必要なら推理を見直す。';
  if (!has('saw_old_draft')) return '第2会議室で旧版の印刷束を確認する。';
  if (!has('saw_redline')) return '第2会議室で赤入れメモの意味を見る。';
  if (!has('saw_phone_note')) return '記録棚で問題の一文の根拠を確かめる。';
  if (!has('understood_sentence_risk')) return '小野寺に、消えた一文の危険性を聞く。';
  if (!has('saw_printer_log')) return 'コピー室で23時台の印刷履歴を見る。';
  if (!has('clerk_alibi')) return '真壁に、23時台に戻った理由を聞く。';
  if (!has('saw_file_history')) return '第2会議室で共用PCの更新履歴を見る。';
  if (!has('unlocked_pc_known')) return '小野寺に、共用PCのログイン状態を聞く。';
  if (!has('saw_visitor_log')) return '受付前で来訪カード履歴を確認する。';
  if (!has('client_route_confirmed')) return '真壁に、深夜の来客の動きを聞く。';
  if (!has('client_pressure')) return '久世に、消えた一文への考えを聞く。';
  if (!has('client_knows_risk')) return '久世に旧版を示し、一文への反応を見る。';
  if (!has('client_visit_confirmed')) return '受付前で久世に来訪カード履歴を示す。';
  if (!has('saw_email_draft')) return '受付前でメール下書きを確認する。';
  if (!has('final_unlocked')) return '受付前で久世にメール下書きを示す。';
  if (!has('analysis_sentence_risk')) return '争点整理で、旧版と電話聴取メモを結びつける。';
  if (!has('analysis_time_window')) return '争点整理で、来訪カード履歴と更新履歴を結びつける。';
  if (!has('analysis_complete')) return '争点整理で、メール下書きと送信予約メモを結びつける。';
  if (!has('pressed_no_edit')) return '対決で、編集できないという説明を詳しく聞く。';
  if (!has('hearing_pc_contradiction')) return '対決で、編集できないという説明を崩す。';
  if (!has('pressed_later_fear')) return '対決で、怖くなった時期の説明を詳しく聞く。';
  if (!has('hearing_cleared')) return '対決で、怖くなった時期の説明を崩す。';
  if (has('case_cleared')) return '事件解剖で、真相と提出判断を確認できる。';
  return '最終推理で削除者、理由、機会、証拠を答える。';
}

function getConsultation(state: GameState): ConsultationGuide {
  const flags = state.flags;
  const has = (flag: string) => flags.includes(flag);

  if (!has('saw_old_draft')) {
    return {
      title: 'まず削除前の文章を読む',
      summary: 'この事件の出発点は、書面にあった一文がなぜ消えたのか。最新版だけでは、消えた事実そのものを説明できない。',
      hints: [
        '最新版の書面は、消えた後の状態しか示さない。',
        '削除前の文章を見れば、誰にとって都合が悪い一文だったかを考えられる。',
        '第2会議室に移動し、「調べる」で旧版の印刷束を確認する。',
      ],
      nextMode: 'move',
      nextLabel: '移動を確認',
    };
  }

  if (!has('saw_redline')) {
    return {
      title: '一文の意味を限定する',
      summary: '旧版を見つけたら、次はその一文が単なる表現修正なのか、争点を動かす削除なのかを読む段階。',
      hints: [
        '赤入れは「誰が何を問題にしていたか」を短く残している。',
        '削除指示そのものではなく、削除された一文の危険性を読む。',
        '第2会議室で赤入れメモを確認し、旧版と並べて考える。',
      ],
      relatedEvidenceIds: ['old-draft'],
      nextMode: 'inspect',
      nextLabel: '調べるへ',
    };
  }

  if (!has('saw_phone_note')) {
    return {
      title: '一文が危険だった根拠を探す',
      summary: '旧版だけでは「危険そう」に見えるだけ。別の記録で、一文が相手方の反論材料になる理由を補強する。',
      hints: [
        '争点の危険性は、書面の外にある会話記録で強くなる。',
        '電話の聞き取りは、相手方の反論予定と旧版の一文をつなぐ。',
        '記録棚に移動し、電話聞き取りメモを調べる。',
      ],
      relatedEvidenceIds: ['old-draft', 'redline-note'],
      nextMode: 'move',
      nextLabel: '移動を確認',
    };
  }

  if (!has('understood_sentence_risk')) {
    return {
      title: '危険性を言葉にする',
      summary: '旧版と電話メモがそろったら、主任弁護士の説明で「なぜその一文が危ないのか」を確定する。',
      hints: [
        '証拠を持っているだけでは争点にならない。意味づけが必要。',
        '小城寺は、削除された一文が反論材料になる構造を説明できる。',
        '「話す」で小城寺に消えた一文の危険性を聞く。',
      ],
      relatedEvidenceIds: ['old-draft', 'phone-note'],
      nextMode: 'talk',
      nextLabel: '話すへ',
    };
  }

  if (!has('saw_printer_log')) {
    return {
      title: '機会の時間帯を絞る',
      summary: '一文の危険性が見えたら、次は誰がファイルに触れられたのかを時刻で絞る。',
      hints: [
        '印刷履歴は、本人の説明ではなく機械が残した時刻の記録。',
        '23時台の印刷は、通常の退勤後に動きがあったことを示す。',
        'コピー室に移動し、プリンタ履歴を調べる。',
      ],
      nextMode: 'move',
      nextLabel: '移動を確認',
    };
  }

  if (!has('clerk_alibi')) {
    return {
      title: '事務員の動きを先に確認する',
      summary: '印刷時刻だけでは削除者は決まらない。事務員がその時間帯に何をしていたかを聞いて、候補を狭める。',
      hints: [
        '疑う前に、23時台に戻った理由を聞く。',
        '印刷と編集は同じ行為ではない。ログの役割を分けて読む。',
        'コピー室で真島に、23時半に戻った理由を聞く。',
      ],
      relatedEvidenceIds: ['printer-log'],
      nextMode: 'talk',
      nextLabel: '話すへ',
    };
  }

  if (!has('saw_file_history')) {
    return {
      title: '編集された端末を特定する',
      summary: '印刷の時刻から、ファイル更新の時刻へ進む。削除行為を示すには、編集履歴が必要になる。',
      hints: [
        'プリンタ履歴は出力の記録。削除そのものはファイル履歴で見る。',
        '誰の個人PCかではなく、どの端末で更新されたかが重要。',
        '第2会議室に戻り、共有PCの更新履歴を調べる。',
      ],
      relatedEvidenceIds: ['printer-log'],
      nextMode: 'move',
      nextLabel: '移動を確認',
    };
  }

  if (!has('unlocked_pc_known')) {
    return {
      title: '共有PCに触れられた条件を読む',
      summary: '更新履歴だけでは、誰が操作できたかが弱い。共有PCがどんな状態だったかを確認する。',
      hints: [
        'ログイン済みの端末なら、本人以外でも触れられる。',
        '機会の立証は「その場にいた」と「触れられた」の両方が必要。',
        '小城寺に共有PCのログイン状態を聞く。',
      ],
      relatedEvidenceIds: ['file-history'],
      nextMode: 'talk',
      nextLabel: '話すへ',
    };
  }

  if (!has('saw_visitor_log')) {
    return {
      title: '来訪の足跡を拾う',
      summary: '端末に触れられた条件が見えたら、次はその場所に来た人物を記録で押さえる。',
      hints: [
        '来訪カードは、本人の供述より先に確認できる客観記録。',
        '時間帯と場所が合うなら、共有PCに触れた可能性が具体化する。',
        '受付前に移動し、来訪カード履歴を調べる。',
      ],
      relatedEvidenceIds: ['file-history'],
      nextMode: 'move',
      nextLabel: '移動を確認',
    };
  }

  if (!has('client_route_confirmed')) {
    return {
      title: '深夜来客の導線を確認する',
      summary: '来訪記録だけでは、会議室まで進んだかが曖昧。受付側の話で導線を補う。',
      hints: [
        '来た事実と、問題の端末に近づいた事実は別に考える。',
        '受付の証言は、来訪カードを実際の移動に変える。',
        '受付前で真島に深夜の来客について聞く。',
      ],
      relatedEvidenceIds: ['visitor-log', 'file-history'],
      nextMode: 'talk',
      nextLabel: '話すへ',
    };
  }

  if (!has('client_pressure')) {
    return {
      title: '依頼者の不安を聞く',
      summary: '機会の線が出たら、動機を聞く。ここでは断定よりも、何を恐れていたのかを拾う。',
      hints: [
        '削除の理由は、本人にとってその一文がどれほど不利かで見えてくる。',
        '強く詰めるより、まず一文への受け止め方を聞く。',
        '受付前で久世に、一文への考えを聞く。',
      ],
      relatedEvidenceIds: ['old-draft', 'phone-note'],
      nextMode: 'talk',
      nextLabel: '話すへ',
    };
  }

  if (!has('client_knows_risk')) {
    return {
      title: '依頼者に旧版を見せる',
      summary: '本人が危険性を知っていたかどうかは、証拠を見せた反応で強くなる。',
      hints: [
        'ここは話題選択ではなく、人物と証拠の組み合わせが鍵になる。',
        '相手は久世。見せるべき証拠は、削除された一文そのものが読めるもの。',
        '「見せる」で久世に準備書面旧版を提示する。',
      ],
      relatedEvidenceIds: ['old-draft', 'phone-note'],
      nextMode: 'present',
      nextLabel: '見せるへ',
    };
  }

  if (!has('client_visit_confirmed')) {
    return {
      title: '来訪記録を本人にぶつける',
      summary: '動機の反応が出たら、機会の記録を本人の説明と合わせる。',
      hints: [
        '本人の来訪は、受付の記録と合わせると逃げにくくなる。',
        '旧版への反応だけでは、会議室に入った説明が足りない。',
        '「見せる」で久世に来訪カード履歴を提示する。',
      ],
      relatedEvidenceIds: ['visitor-log', 'file-history'],
      nextMode: 'present',
      nextLabel: '見せるへ',
    };
  }

  if (!has('saw_email_draft')) {
    return {
      title: '削除後の説明を探す',
      summary: '来訪と更新だけでは、削除後に何をしようとしたかが弱い。下書きの記録を確認する。',
      hints: [
        '削除した後の説明準備は、意図を示す補助線になる。',
        'メール下書きは、本人が問題をどう処理しようとしたかを残す。',
        '受付前で来客用端末のメール下書きを調べる。',
      ],
      relatedEvidenceIds: ['visitor-log'],
      nextMode: 'inspect',
      nextLabel: '調べるへ',
    };
  }

  if (!has('final_unlocked')) {
    return {
      title: '最後の反応を取る',
      summary: '下書きを本人に見せれば、削除後の説明と送信予約の線がつながる。',
      hints: [
        '下書きは単体では弱い。本人に示して反応を取る必要がある。',
        '来訪、更新、下書きがそろうと、最後の記録が開く。',
        '「見せる」で久世にメール下書きを提示する。',
      ],
      relatedEvidenceIds: ['email-draft', 'visitor-log', 'file-history'],
      nextMode: 'present',
      nextLabel: '見せるへ',
    };
  }

  if (!has('analysis_sentence_risk')) {
    return {
      title: '危険な一文の組を作る',
      summary: '調査が終わったら、証拠同士の意味を結ぶ。まずは一文がなぜ危険かを説明する組み合わせ。',
      hints: [
        '旧版だけでも電話メモだけでも、争点の説明としては片方が足りない。',
        '削除された一文と、相手方の反論予定を並べる。',
        '「整理する」で準備書面旧版と電話聞き取りメモを結ぶ。',
      ],
      relatedEvidenceIds: ['old-draft', 'phone-note'],
      nextMode: 'analysis',
      nextLabel: '整理するへ',
    };
  }

  if (!has('analysis_time_window')) {
    return {
      title: '編集できた時間帯を組む',
      summary: '次は機会。来訪の足跡とファイル更新履歴を並べて、触れられた時間帯を説明する。',
      hints: [
        '来訪カードは「来た」。更新履歴は「触れた可能性のある時刻」。',
        '2つを合わせると、深夜の会議室と共有PCが一本につながる。',
        '「整理する」で来訪カード履歴とファイル更新履歴を結ぶ。',
      ],
      relatedEvidenceIds: ['visitor-log', 'file-history'],
      nextMode: 'analysis',
      nextLabel: '整理するへ',
    };
  }

  if (!has('analysis_complete')) {
    return {
      title: '削除後の説明を仕上げる',
      summary: '最後の整理は、削除後にどう説明しようとしたか。下書きと送信予約を組にする。',
      hints: [
        '下書きは意図を、送信予約は実行直前の段取りを示す。',
        'この組ができると、対決に進むための論理がそろう。',
        '「整理する」でメール下書きと送信予約メモを結ぶ。',
      ],
      relatedEvidenceIds: ['email-draft', 'scheduled-message'],
      nextMode: 'analysis',
      nextLabel: '整理するへ',
    };
  }

  if (!has('pressed_no_edit')) {
    return {
      title: 'まず否認の意味を聞く',
      summary: '対決ではいきなり証拠を出さず、発言の弱い部分を詳しく聞くと矛盾が見えやすい。',
      hints: [
        '「触っていない」という発言は、共有PCの状態とぶつかる。',
        '先に詳しく聞けば、どの部分を証拠で崩すべきかが明確になる。',
        '対決で「ファイルは触っていない」趣旨の発言を選び、詳しく聞く。',
      ],
      relatedEvidenceIds: ['file-history'],
      nextMode: 'hearing',
      nextLabel: '対決へ',
    };
  }

  if (!has('hearing_pc_contradiction')) {
    return {
      title: '共有PCの矛盾を示す',
      summary: '否認を聞いた後は、編集履歴を示して、触れられなかったという説明を崩す。',
      hints: [
        '争点は「個人PCを使ったか」ではなく「共有PCに触れられたか」。',
        'ファイル更新履歴は、発言と直接ぶつかる。',
        '対決で該当発言を選び、ファイル更新履歴を示す。',
      ],
      relatedEvidenceIds: ['file-history', 'visitor-log'],
      nextMode: 'hearing',
      nextLabel: '対決へ',
    };
  }

  if (!has('pressed_later_fear')) {
    return {
      title: '恐れた時期を聞く',
      summary: '編集できたことを示したら、次はなぜ削除したのか。怖くなった時期を詳しく聞く。',
      hints: [
        '理由の矛盾は、本人の感情の変化と記録の時刻で読む。',
        '恐れた時期を曖昧なままにすると、送信予約の意味が弱くなる。',
        '対決で「怖くなったのは帰宅後」趣旨の発言を選び、詳しく聞く。',
      ],
      relatedEvidenceIds: ['scheduled-message', 'email-draft'],
      nextMode: 'hearing',
      nextLabel: '対決へ',
    };
  }

  if (!has('hearing_cleared')) {
    return {
      title: '帰宅後説明の矛盾を示す',
      summary: '最後は、怖くなった時期と送信予約の時刻をぶつける。理由と段取りが同時に固まる。',
      hints: [
        '帰宅後に怖くなっただけなら、深夜の送信予約は説明しにくい。',
        '送信予約メモは、削除後の説明が事前に準備されていたことを示す。',
        '対決で該当発言を選び、送信予約メモを示す。',
      ],
      relatedEvidenceIds: ['scheduled-message', 'email-draft'],
      nextMode: 'hearing',
      nextLabel: '対決へ',
    };
  }

  if (has('case_cleared')) {
    return {
      title: '事件を解剖して次へつなげる',
      summary: 'クリア後は、真相だけでなく、どの証拠がどの判断を支えたかを読み返す段階。',
      hints: [
        '削除者、理由、機会、決め手をそれぞれ別の証拠で説明できるか確認する。',
        '事件解剖は、次回制作時の構造メモにもなる。',
        '事件解剖から制作資料へ進み、次のケースの改善点を読む。',
      ],
      relatedEvidenceIds: ['old-draft', 'visitor-log', 'file-history', 'scheduled-message'],
      nextMode: 'review',
      nextLabel: '事件解剖へ',
    };
  }

  return {
    title: '最終推理を四つに分ける',
    summary: '対決後は、削除者、理由、機会、決め手を一気に当てるのではなく、証拠の役割ごとに整理する。',
    hints: [
      '削除者は来訪と端末、理由は一文の危険性、決め手は削除後の段取りで考える。',
      '迷ったら事件ファイルの時系列を開き、23時台の動きを上から読む。',
      '最終推理で、削除者、理由、機会、決め手をそれぞれ対応する選択肢で答える。',
    ],
    relatedEvidenceIds: ['old-draft', 'phone-note', 'visitor-log', 'file-history', 'scheduled-message'],
    nextMode: 'deduction',
    nextLabel: '推理するへ',
  };
}

function CommandBar({
  mode,
  finalUnlocked,
  analysisComplete,
  hearingCleared,
  reviewUnlocked,
  evidenceCount,
  onSelect,
}: {
  mode: ViewMode;
  finalUnlocked: boolean;
  analysisComplete: boolean;
  hearingCleared: boolean;
  reviewUnlocked: boolean;
  evidenceCount: number;
  onSelect: (mode: ViewMode) => void;
}) {
  return (
    <nav className="command-grid">
      {commandItems.map((item) => {
        const Icon = item.icon;
        const availability = getCommandAvailability(item.mode, {
          activeMode: mode,
          finalUnlocked,
          analysisComplete,
          hearingCleared,
          reviewUnlocked,
          evidenceCount,
        });

        return (
          <button
            key={item.mode}
            className={[
              'command',
              mode === item.mode ? 'active' : '',
              `status-${availability.status}`,
            ].join(' ')}
            type="button"
            disabled={availability.disabled}
            onClick={() => onSelect(item.mode)}
            title={availability.detail}
          >
            <Icon aria-hidden="true" />
            <span>
              <strong>{item.label}</strong>
              <small>{availability.detail}</small>
            </span>
            <em>{availability.label}</em>
          </button>
        );
      })}
    </nav>
  );
}

function getCommandAvailability(
  commandMode: ViewMode,
  context: {
    activeMode: ViewMode;
    finalUnlocked: boolean;
    analysisComplete: boolean;
    hearingCleared: boolean;
    reviewUnlocked: boolean;
    evidenceCount: number;
  },
): CommandAvailability {
  if (commandMode === context.activeMode) {
    return {
      disabled: false,
      status: 'current',
      label: '現在',
      detail: '今開いている画面',
    };
  }

  if (commandMode === 'present' && context.evidenceCount === 0) {
    return {
      disabled: true,
      status: 'locked',
      label: '証拠待ち',
      detail: '証拠を1つ入手してから使う',
    };
  }

  if (commandMode === 'analysis' && context.evidenceCount < 2) {
    return {
      disabled: true,
      status: 'locked',
      label: '材料不足',
      detail: '証拠を2点そろえる',
    };
  }

  if (commandMode === 'hearing' && (!context.finalUnlocked || !context.analysisComplete)) {
    return {
      disabled: true,
      status: 'locked',
      label: '整理待ち',
      detail: '提示と争点整理を終える',
    };
  }

  if (commandMode === 'deduction' && !context.hearingCleared) {
    return {
      disabled: true,
      status: 'locked',
      label: '対決待ち',
      detail: '対決を突破してから進む',
    };
  }

  if (commandMode === 'review' && !context.reviewUnlocked) {
    return {
      disabled: true,
      status: 'locked',
      label: 'クリア後',
      detail: '成功エンド後に解放',
    };
  }

  return {
    disabled: false,
    status: 'ready',
    label: '実行可',
    detail: getCommandReadyDetail(commandMode),
  };
}

function getCommandReadyDetail(commandMode: ViewMode): string {
  switch (commandMode) {
    case 'move':
      return '調査場所を選ぶ';
    case 'inspect':
      return '現場を調べる';
    case 'talk':
      return '供述を聞く';
    case 'present':
      return '人物に証拠を示す';
    case 'analysis':
      return '証拠同士を整理する';
    case 'hearing':
      return '証言と証拠を比べる';
    case 'deduction':
      return '最終推理を組み立てる';
    case 'evidence':
      return '記録を読み返す';
    case 'log':
      return '履歴を確認する';
    case 'review':
      return '事件を解剖する';
    default:
      return '開く';
  }
}

function MovePanel({
  state,
  currentLocationId,
  onMove,
}: {
  state: GameState;
  currentLocationId: string;
  onMove: (locationId: string) => void;
}) {
  return (
    <section className="action-stack">
      <PanelTitle icon={MapPin} title="移動" subtitle="調査場所を選ぶ" />
      <div className="move-route-grid">
        {episode.locations.map((location) => {
          const routeInfo = getLocationRouteInfo(location, state);
          return (
            <button
              className={`move-route-card status-${routeInfo.status}`}
              type="button"
              key={location.id}
              disabled={location.id === currentLocationId}
              onClick={() => onMove(location.id)}
            >
              <img src={location.image ?? withBasePath('/assets/locations/conference-room.webp')} alt="" />
              <div className="move-route-body">
                <div>
                  <span>{routeInfo.label}</span>
                  <strong>{location.name}</strong>
                </div>
                <p>{location.summary}</p>
                <small>{routeInfo.detail}</small>
                <div className="move-route-stats">
                  <em>{routeInfo.readyCount} 未確認</em>
                  <em>
                    {routeInfo.foundEvidenceCount}/{routeInfo.totalEvidenceCount} 証拠
                  </em>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getLocationRouteInfo(location: Location, state: GameState): LocationRouteInfo {
  const unresolvedActions = location.actions.filter(
    (action) => action.once === false || !state.completedInteractionIds.includes(action.id),
  );
  const readyActions = unresolvedActions.filter((action) => canRunInteraction(state, action));
  const blockedActions = unresolvedActions.filter((action) => !canRunInteraction(state, action));
  const evidenceIds = Array.from(
    new Set(location.actions.flatMap((action) => action.addEvidence ?? [])),
  );
  const foundEvidenceCount = evidenceIds.filter((id) => state.evidenceIds.includes(id)).length;
  const isCurrent = location.id === state.currentLocationId;
  const firstReadyAction = readyActions[0];
  const firstBlockedAction = blockedActions[0];

  if (isCurrent) {
    return {
      status: 'current',
      label: '現在地',
      detail: firstReadyAction ? `次: ${firstReadyAction.label}` : 'この場所で読める記録は確認済み。',
      readyCount: readyActions.length,
      foundEvidenceCount,
      totalEvidenceCount: evidenceIds.length,
    };
  }

  if (firstReadyAction) {
    return {
      status: 'ready',
      label: '調査可',
      detail: `次: ${firstReadyAction.label}`,
      readyCount: readyActions.length,
      foundEvidenceCount,
      totalEvidenceCount: evidenceIds.length,
    };
  }

  if (firstBlockedAction) {
    return {
      status: 'blocked',
      label: '前提待ち',
      detail: firstBlockedAction.requiresFlags?.length
        ? '別の記録を先に押さえる。'
        : '進行後に再確認する。',
      readyCount: 0,
      foundEvidenceCount,
      totalEvidenceCount: evidenceIds.length,
    };
  }

  return {
    status: 'done',
    label: '確認済み',
    detail: foundEvidenceCount ? '主要な記録は事件ファイルに入っている。' : '今は追加記録なし。',
    readyCount: 0,
    foundEvidenceCount,
    totalEvidenceCount: evidenceIds.length,
  };
}

function InspectPanel({
  state,
  location,
  emptyText,
  items,
  evidenceById,
  onRun,
}: {
  state: GameState;
  location: Location;
  emptyText: string;
  items: Interaction[];
  evidenceById: Map<string, Evidence>;
  onRun: (interaction: Interaction) => void;
}) {
  return (
    <section className="action-stack inspect-panel">
      <PanelTitle icon={Search} title="調べる" subtitle="現場の違和感を拾う" />
      <InvestigationMemo
        state={state}
        location={location}
        readyItems={items}
        evidenceById={evidenceById}
        onRun={onRun}
      />
      {items.length ? (
        <>
          <figure className="investigation-board" aria-label={`${location.name}の調査ポイント`}>
            <img src={location.image ?? withBasePath('/assets/locations/conference-room.webp')} alt="" />
            {items.map((item, index) => {
              const spot = getInvestigationSpot(item.id, index, items.length);
              return (
                <button
                  className="investigation-hotspot"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  type="button"
                  key={item.id}
                  onClick={() => onRun(item)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.label}</strong>
                </button>
              );
            })}
            <figcaption>{location.name} / {location.summary}</figcaption>
          </figure>
          <div className="choice-list inspect-choice-list">
            {items.map((item, index) => (
              <button className="choice-button inspect-choice" type="button" key={item.id} onClick={() => onRun(item)}>
                <em>{String(index + 1).padStart(2, '0')}</em>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.log ?? item.text}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-text">{emptyText}</p>
      )}
    </section>
  );
}

function InvestigationMemo({
  state,
  location,
  readyItems,
  evidenceById,
  onRun,
}: {
  state: GameState;
  location: Location;
  readyItems: Interaction[];
  evidenceById: Map<string, Evidence>;
  onRun: (interaction: Interaction) => void;
}) {
  const readyIds = new Set(readyItems.map((item) => item.id));
  const evidenceIds = Array.from(
    new Set(location.actions.flatMap((action) => action.addEvidence ?? [])),
  );
  const foundEvidence = evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item && state.evidenceIds.includes(item.id)));
  const completedActions = location.actions.filter(
    (action) => action.once !== false && state.completedInteractionIds.includes(action.id),
  );
  const blockedActions = location.actions.filter(
    (action) =>
      !readyIds.has(action.id) &&
      !(action.once !== false && state.completedInteractionIds.includes(action.id)) &&
      !hasAllFlags(state, action.requiresFlags),
  );
  const nextAction = readyItems[0];
  const heading = nextAction
    ? `次は「${nextAction.label}」`
    : blockedActions.length
      ? '別の記録で前提を作る'
      : 'この場所の確認は一段落';
  const detail = nextAction
    ? nextAction.log ?? nextAction.text
    : blockedActions.length
      ? `${blockedActions[0].label}は、まだ前提が足りない。移動、会話、証拠提示で条件をそろえる。`
      : '入手した証拠を事件ファイルで読み、次の場所か会話へ進む。';

  return (
    <aside className="investigation-memo" aria-label="現場メモ">
      <div className="investigation-memo-heading">
        <div>
          <span>現場メモ</span>
          <strong>{heading}</strong>
          <p>{detail}</p>
        </div>
        <em>
          {foundEvidence.length}/{evidenceIds.length || 0}
          <small>証拠</small>
        </em>
      </div>
      <div className="investigation-memo-stats" aria-label="調査状況">
        <span>
          調査可
          <strong>{readyItems.length}</strong>
        </span>
        <span>
          確認済み
          <strong>{completedActions.length}</strong>
        </span>
        <span>
          前提待ち
          <strong>{blockedActions.length}</strong>
        </span>
      </div>
      <div className="investigation-ledger" aria-label="調査レジャー">
        {location.actions.map((action, index) => {
          const evidence = (action.addEvidence ?? [])
            .map((id) => evidenceById.get(id))
            .filter((item): item is Evidence => Boolean(item));
          const complete = action.once !== false && state.completedInteractionIds.includes(action.id);
          const ready = readyIds.has(action.id);
          const status = complete ? 'complete' : ready ? 'ready' : 'locked';

          return (
            <article className={`investigation-ledger-row status-${status}`} key={action.id}>
              <em>{String(index + 1).padStart(2, '0')}</em>
              <div>
                <span>{getInvestigationLedgerLabel(status)}</span>
                <strong>{action.label}</strong>
                <p>{complete ? action.log ?? action.text : ready ? action.log ?? action.text : '別の会話、移動、証拠確認で前提を作る。'}</p>
                {evidence.length ? (
                  <small>{evidence.map((item) => item.name).join(' / ')}</small>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <div className="investigation-memo-body">
        <section>
          <span>次に触れる場所</span>
          {readyItems.length ? (
            <div className="investigation-memo-actions">
              {readyItems.slice(0, 2).map((item) => (
                <button type="button" key={item.id} onClick={() => onRun(item)}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <p>この場所で今すぐ触れる記録はない。</p>
          )}
        </section>
        <section>
          <span>この場所の取得証拠</span>
          {foundEvidence.length ? (
            <div className="investigation-memo-evidence">
              {foundEvidence.map((item) => (
                <em key={item.id}>
                  <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  {item.name}
                </em>
              ))}
            </div>
          ) : (
            <p>まだ証拠は事件ファイルに入っていない。</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function getInvestigationLedgerLabel(status: 'complete' | 'ready' | 'locked'): string {
  if (status === 'complete') return '確認済み';
  if (status === 'ready') return '調査可';
  return '前提待ち';
}

function InteractionPanel({
  icon,
  title,
  emptyText,
  items,
  onRun,
}: {
  icon: LucideIcon;
  title: string;
  emptyText: string;
  items: Interaction[];
  onRun: (interaction: Interaction) => void;
}) {
  return (
    <section className="action-stack">
      <PanelTitle icon={icon} title={title} subtitle="手がかりを集める" />
      {items.length ? (
        <div className="choice-list">
          {items.map((item) => (
            <button className="choice-button" type="button" key={item.id} onClick={() => onRun(item)}>
              <strong>{item.label}</strong>
              <span>{item.log ?? item.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-text">{emptyText}</p>
      )}
    </section>
  );
}

function getInvestigationSpot(
  actionId: string,
  index: number,
  count: number,
): { x: number; y: number } {
  const fixedSpots: Record<string, { x: number; y: number }> = {
    'inspect-old-draft': { x: 32, y: 58 },
    'inspect-redline': { x: 68, y: 56 },
    'inspect-file-history': { x: 50, y: 39 },
    'inspect-phone-note': { x: 46, y: 55 },
    'inspect-printer-log': { x: 58, y: 43 },
    'inspect-visitor-log': { x: 38, y: 47 },
    'inspect-mail-draft': { x: 64, y: 62 },
  };
  if (fixedSpots[actionId]) return fixedSpots[actionId];

  const step = count <= 1 ? 0 : index / (count - 1);
  return {
    x: 28 + step * 44,
    y: 44 + (index % 2) * 18,
  };
}

function TalkPanel({
  state,
  talks,
  presentReactions,
  charactersById,
  evidenceById,
  onRun,
  onModeChange,
}: {
  state: GameState;
  talks: Talk[];
  presentReactions: PresentReaction[];
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
  onRun: (talk: Talk) => void;
  onModeChange: (mode: ViewMode) => void;
}) {
  const talkGroups = talks.reduce<Array<{ character?: Character; talks: Talk[] }>>((groups, talk) => {
    const character = charactersById.get(talk.characterId);
    const group = groups.find((item) => item.character?.id === character?.id);
    if (group) {
      group.talks.push(talk);
      return groups;
    }
    return [...groups, { character, talks: [talk] }];
  }, []);
  const latestTalkEntry = [...(state.history ?? [])]
    .reverse()
    .find(
      (entry) =>
        entry.mode === 'talk' &&
        !entry.id.startsWith('legacy-') &&
        episode.talks.some((talk) => talk.label === entry.note),
    );
  const latestTalk = latestTalkEntry
    ? episode.talks.find((talk) => talk.label === latestTalkEntry.note)
    : undefined;
  const latestCharacter =
    (latestTalk ? charactersById.get(latestTalk.characterId) : undefined) ??
    (latestTalkEntry?.speakerId ? charactersById.get(latestTalkEntry.speakerId) : undefined);
  const readyEvidence = presentReactions.reduce<Evidence[]>((items, reaction) => {
    const item = evidenceById.get(reaction.evidenceId);
    if (!item || items.some((current) => current.id === item.id)) return items;
    return [...items, item];
  }, []);

  return (
    <section className="action-stack">
      <PanelTitle icon={MessageSquareText} title="話す" subtitle="供述の矛盾を拾う" />
      {latestTalkEntry ? (
        <article className="talk-followup-panel">
          <div className="talk-followup-heading">
            <img src={getCharacterPortrait(latestCharacter, state.tone)} alt="" />
            <div>
              <span>供述メモ更新</span>
              <h3>{latestTalkEntry.note ?? '直近の会話'}</h3>
              <p>{latestTalkEntry.text}</p>
            </div>
          </div>
          <div className="talk-followup-grid">
            <section>
              <span>次に聞ける話題</span>
              {talks.length ? (
                <div className="talk-followup-leads">
                  {talks.slice(0, 3).map((talk) => (
                    <em key={talk.id}>
                      {charactersById.get(talk.characterId)?.name ?? '人物'}: {talk.label}
                    </em>
                  ))}
                </div>
              ) : (
                <p>この場所で聞ける話題は一度聞き終えた。</p>
              )}
            </section>
            <section>
              <span>証拠で詰める候補</span>
              {readyEvidence.length ? (
                <div className="talk-followup-leads">
                  {readyEvidence.slice(0, 3).map((item) => (
                    <em key={item.id}>{item.name}</em>
                  ))}
                </div>
              ) : (
                <p>まだ提示で崩せる組み合わせは見えていない。</p>
              )}
            </section>
          </div>
          <TalkPreparationCard
            talk={latestTalk}
            state={state}
            presentReactions={presentReactions}
            evidenceById={evidenceById}
          />
          <div className="talk-followup-actions">
            {readyEvidence.length ? (
              <button className="secondary-button" type="button" onClick={() => onModeChange('present')}>
                証拠を示す
              </button>
            ) : null}
            {state.evidenceIds.length ? (
              <button className="secondary-button" type="button" onClick={() => onModeChange('evidence')}>
                事件ファイルを見る
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
      {talkGroups.length ? (
        <div className="talk-dossier-list">
          {talkGroups.map((group) => (
            <article className="talk-dossier" key={group.character?.id ?? group.talks[0]?.characterId}>
              <div className="talk-witness-card">
                <img src={getCharacterPortrait(group.character, 'neutral')} alt="" />
                <div>
                  <span>{group.character?.role ?? '人物'}</span>
                  <h3>{group.character?.name ?? '人物'}</h3>
                  <p>{group.character?.summary ?? '供述を確認する。'}</p>
                </div>
                <strong>{group.talks.length}件</strong>
              </div>
              <div className="talk-topic-list">
                {group.talks.map((talk, index) => (
                  <button className="talk-topic" type="button" key={talk.id} onClick={() => onRun(talk)}>
                    <em>{String(index + 1).padStart(2, '0')}</em>
                    <span>
                      <strong>{talk.label}</strong>
                      <small>{talk.log ?? talk.text}</small>
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-text">今聞ける話はない。証拠を増やすか、別の場所へ移動する。</p>
      )}
    </section>
  );
}

function TalkPreparationCard({
  talk,
  state,
  presentReactions,
  evidenceById,
}: {
  talk?: Talk;
  state: GameState;
  presentReactions: PresentReaction[];
  evidenceById: Map<string, Evidence>;
}) {
  if (!talk) return null;

  const addedEvidence = (talk.addEvidence ?? [])
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const flags = talk.setFlags ?? [];
  const readyPresentEvidence = presentReactions
    .filter(
      (reaction) =>
        reaction.characterId === talk.characterId &&
        state.evidenceIds.includes(reaction.evidenceId) &&
        canRunInteraction(state, reaction),
    )
    .map((reaction) => evidenceById.get(reaction.evidenceId))
    .filter((item): item is Evidence => Boolean(item));
  const uniqueReadyEvidence = readyPresentEvidence.filter(
    (item, index, list) => list.findIndex((current) => current.id === item.id) === index,
  );

  return (
    <aside className="talk-prep-card" aria-label="会話後の準備">
      <div className="talk-prep-heading">
        <span>Preparation</span>
        <strong>{talk.label}</strong>
        <p>{talk.log ?? talk.text}</p>
      </div>
      <div className="talk-prep-grid">
        <section>
          <span>Confirmed</span>
          {flags.length ? (
            <div className="talk-prep-chips">
              {flags.map((flag) => (
                <em key={flag}>{getFlagLabel(flag)}</em>
              ))}
            </div>
          ) : (
            <p>この会話は状況整理として記録される。</p>
          )}
        </section>
        <section>
          <span>Evidence</span>
          {addedEvidence.length ? (
            <div className="talk-prep-chips">
              {addedEvidence.map((item) => (
                <em key={item.id}>{item.name}</em>
              ))}
            </div>
          ) : uniqueReadyEvidence.length ? (
            <div className="talk-prep-chips">
              {uniqueReadyEvidence.slice(0, 3).map((item) => (
                <em key={item.id}>{item.name}</em>
              ))}
            </div>
          ) : (
            <p>次の調査か事件ファイルで補強する。</p>
          )}
        </section>
        <section>
          <span>Next move</span>
          <p>
            {uniqueReadyEvidence.length
              ? 'この人物には証拠提示で反応を取れる候補がある。'
              : '証拠提示に進む前に、会話か調査で前提を増やす。'}
          </p>
        </section>
      </div>
    </aside>
  );
}

function getFlagLabel(flag: string): string {
  const compact = flag.replace(/^saw_/, '').replace(/^client_/, '').replace(/^analysis_/, '');
  return compact.split('_').filter(Boolean).join(' ');
}

function PresentPanel({
  reactions,
  characters,
  evidence,
  selection,
  missNote,
  onSelection,
  onSubmit,
  onOpenEvidence,
}: {
  reactions: PresentReaction[];
  characters: Character[];
  evidence: Evidence[];
  selection: { characterId?: string; evidenceId?: string };
  missNote?: PresentMissNote;
  onSelection: (selection: { characterId?: string; evidenceId?: string }) => void;
  onSubmit: () => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const selectedCharacter = characters.find((character) => character.id === selection.characterId);
  const selectedEvidence = evidence.find((item) => item.id === selection.evidenceId);
  const selectedReaction = reactions.find(
    (reaction) =>
      reaction.characterId === selection.characterId && reaction.evidenceId === selection.evidenceId,
  );
  const canSubmit = Boolean(selection.characterId && selection.evidenceId);

  return (
    <section className="action-stack">
      <PanelTitle icon={FileSearch} title="証拠を見せる" subtitle="証拠と相手を結びつける" />
      <p className="panel-copy">
        相手と証拠を選び、発言を動かせる組み合わせを突きつける。外すと信用が下がる。
      </p>
      {reactions.length ? (
        <>
          <div className="select-row present-control-row">
            <select
              aria-label="見せる相手"
              value={selection.characterId ?? ''}
              onChange={(event) =>
                onSelection({ ...selection, characterId: event.target.value || undefined })
              }
            >
              <option value="">相手を選ぶ</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
            <select
              aria-label="見せる証拠"
              value={selection.evidenceId ?? ''}
              onChange={(event) =>
                onSelection({ ...selection, evidenceId: event.target.value || undefined })
              }
            >
              <option value="">証拠を選ぶ</option>
              {evidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <PresentPreview character={selectedCharacter} evidence={selectedEvidence} />
          <PresentPressureBoard
            character={selectedCharacter}
            evidence={selectedEvidence}
            reaction={selectedReaction}
          />
          <PresentVerdictPanel
            character={selectedCharacter}
            evidence={selectedEvidence}
            reaction={selectedReaction}
            routeCount={reactions.length}
          />
          <PresentTargetBoard
            reactions={reactions}
            characters={characters}
            evidence={evidence}
            selectedCharacter={selectedCharacter}
            selectedEvidence={selectedEvidence}
            onSelection={onSelection}
          />
          <PresentMissNotePanel note={missNote} evidence={evidence} onOpenEvidence={onOpenEvidence} />
          <button className="primary-button" type="button" disabled={!canSubmit} onClick={onSubmit}>
            この証拠を見せる
          </button>
          <div className="mini-list" aria-label="未解決の提示点">
            <span>反応未確認 {reactions.length}</span>
          </div>
        </>
      ) : (
        <p className="empty-text">今は突きつけられる組み合わせがない。</p>
      )}
    </section>
  );
}

function PresentPreview({
  character,
  evidence,
}: {
  character?: Character;
  evidence?: Evidence;
}) {
  return (
    <aside className="present-preview" aria-label="提示内容">
      <section>
        <span>相手</span>
        {character ? (
          <div className="present-person">
            <img src={getCharacterPortrait(character, evidence ? 'pressure' : 'neutral')} alt="" />
            <div>
              <strong>{character.name}</strong>
              <small>{character.role}</small>
              <p>{character.summary}</p>
            </div>
          </div>
        ) : (
          <p className="empty-text">誰に見せるかを選ぶ。</p>
        )}
      </section>
      <section>
        <span>証拠</span>
        {evidence ? (
          <div className="present-evidence">
            <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
            <div>
              <strong>{evidence.name}</strong>
              <p>{evidence.description}</p>
              <small>{evidence.detail}</small>
            </div>
          </div>
        ) : (
          <p className="empty-text">見せる証拠を選ぶ。</p>
        )}
      </section>
    </aside>
  );
}

function PresentPressureBoard({
  character,
  evidence,
  reaction,
}: {
  character?: Character;
  evidence?: Evidence;
  reaction?: PresentReaction;
}) {
  const pressure = getPresentPressure(character, evidence, reaction);

  return (
    <article className={`present-pressure-board status-${pressure.status}`}>
      <div className="present-pressure-heading">
        <span>{pressure.label}</span>
        <strong>{pressure.title}</strong>
        <p>{pressure.detail}</p>
      </div>
      <div className="present-pressure-grid">
        <section>
          <span>相手の言い分</span>
          <p>{character?.summary ?? 'まず誰に証拠を見せるかを決める。'}</p>
        </section>
        <section>
          <span>証拠の読み方</span>
          <p>{evidence?.detail ?? 'どの記録で発言を動かすかを決める。'}</p>
        </section>
        <section>
          <span>突きつける問い</span>
          <p>{pressure.question}</p>
        </section>
      </div>
    </article>
  );
}

function PresentVerdictPanel({
  character,
  evidence,
  reaction,
  routeCount,
}: {
  character?: Character;
  evidence?: Evidence;
  reaction?: PresentReaction;
  routeCount: number;
}) {
  const status = reaction ? 'ready' : character && evidence ? 'weak' : 'waiting';
  const checks = [
    {
      label: 'Person',
      met: Boolean(character),
      detail: character?.role ?? 'Choose the person whose statement should move.',
    },
    {
      label: 'Record',
      met: Boolean(evidence),
      detail: evidence?.name ?? 'Choose the record that answers that statement.',
    },
    {
      label: 'Route',
      met: Boolean(reaction),
      detail: reaction?.label ?? `${routeCount} route candidates are visible in this scene.`,
    },
  ];
  const filled = checks.filter((check) => check.met).length;

  return (
    <aside className={`present-verdict-panel status-${status}`} aria-label="present verdict">
      <div className="present-verdict-heading">
        <div>
          <span>PRESENT VERDICT</span>
          <strong>{getPresentVerdictTitle(status)}</strong>
          <p>{getPresentVerdictDetail(status, character, evidence)}</p>
        </div>
        <em>{filled}/3</em>
      </div>
      <div className="present-verdict-meter" aria-hidden="true">
        {checks.map((check) => (
          <span className={check.met ? 'filled' : ''} key={check.label} />
        ))}
      </div>
      <div className="present-verdict-checks">
        {checks.map((check) => (
          <section className={check.met ? 'met' : 'missing'} key={check.label}>
            <span>{check.label}</span>
            <p>{check.detail}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}

function getPresentVerdictTitle(status: 'ready' | 'weak' | 'waiting'): string {
  if (status === 'ready') return 'Press now';
  if (status === 'weak') return 'Hold the evidence';
  return 'Build the pair';
}

function getPresentVerdictDetail(
  status: 'ready' | 'weak' | 'waiting',
  character?: Character,
  evidence?: Evidence,
): string {
  if (status === 'ready') {
    return 'The chosen record has a live reaction for this person. Presenting it should move the case.';
  }
  if (status === 'weak') {
    return `${character?.name ?? 'This person'} and ${evidence?.name ?? 'this record'} are both selected, but the current testimony route does not connect them yet.`;
  }
  return 'Pick a person and a record, then check whether the route meter reaches 3/3 before presenting.';
}

function PresentTargetBoard({
  reactions,
  characters,
  evidence,
  selectedCharacter,
  selectedEvidence,
  onSelection,
}: {
  reactions: PresentReaction[];
  characters: Character[];
  evidence: Evidence[];
  selectedCharacter?: Character;
  selectedEvidence?: Evidence;
  onSelection: (selection: { characterId?: string; evidenceId?: string }) => void;
}) {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const characterLeads = selectedCharacter
    ? reactions
        .filter((reaction) => reaction.characterId === selectedCharacter.id)
        .map((reaction) => ({ reaction, evidence: evidenceById.get(reaction.evidenceId) }))
        .filter((lead): lead is { reaction: PresentReaction; evidence: Evidence } => Boolean(lead.evidence))
    : [];
  const evidenceLeads = selectedEvidence
    ? reactions
        .filter((reaction) => reaction.evidenceId === selectedEvidence.id)
        .map((reaction) => ({ reaction, character: characterById.get(reaction.characterId) }))
        .filter((lead): lead is { reaction: PresentReaction; character: Character } => Boolean(lead.character))
    : [];
  const unlockedPairs = reactions.filter((reaction) => evidenceById.has(reaction.evidenceId)).length;

  return (
    <aside className="present-target-board" aria-label="present target board">
      <div className="present-target-heading">
        <div>
          <span>PRESENT ROUTES</span>
          <strong>{getPresentTargetHeadline(selectedCharacter, selectedEvidence, unlockedPairs)}</strong>
          <p>{getPresentTargetDetail(selectedCharacter, selectedEvidence)}</p>
        </div>
        <em>{unlockedPairs}</em>
      </div>
      <div className="present-target-grid">
        <section>
          <span>For person</span>
          {characterLeads.length ? (
            characterLeads.map(({ reaction, evidence: item }) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() =>
                  onSelection({ characterId: reaction.characterId, evidenceId: reaction.evidenceId })
                }
              >
                <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <strong>{item.name}</strong>
                <small>{reaction.label}</small>
              </button>
            ))
          ) : (
            <p>{selectedCharacter ? 'No unlocked direct evidence for this person yet.' : 'Select a person to see usable evidence.'}</p>
          )}
        </section>
        <section>
          <span>For record</span>
          {evidenceLeads.length ? (
            evidenceLeads.map(({ reaction, character }) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() =>
                  onSelection({ characterId: reaction.characterId, evidenceId: reaction.evidenceId })
                }
              >
                <img src={getCharacterPortrait(character, 'pressure')} alt="" />
                <strong>{character.name}</strong>
                <small>{reaction.label}</small>
              </button>
            ))
          ) : (
            <p>{selectedEvidence ? 'This record does not currently move a visible witness.' : 'Select evidence to see who it pressures.'}</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function getPresentTargetHeadline(
  character: Character | undefined,
  evidence: Evidence | undefined,
  routeCount: number,
) {
  if (character && evidence) return 'Selected route is being checked';
  if (character) return `${character.name} has ${routeCount} visible route candidates`;
  if (evidence) return `${evidence.name} can be checked against witnesses`;
  return 'Read the available pressure routes before presenting';
}

function getPresentTargetDetail(character?: Character, evidence?: Evidence) {
  if (character && evidence) {
    return 'Use this board to compare the chosen pair with adjacent valid routes before spending credibility.';
  }
  if (character) return 'The left column lists evidence that can currently move this person.';
  if (evidence) return 'The right column lists people whose statements can currently be moved by this record.';
  return 'Routes shown here come from unlocked testimony and acquired evidence only.';
}

function PresentMissNotePanel({
  note,
  evidence,
  onOpenEvidence,
}: {
  note?: PresentMissNote;
  evidence: Evidence[];
  onOpenEvidence: (evidenceId: string) => void;
}) {
  if (!note) return null;
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const recommended = note.recommendedEvidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item))
    .slice(0, 3);

  return (
    <aside className="present-miss-note" aria-label="提示ミスの見直し">
      <div className="present-miss-heading">
        <span>Mismatch</span>
        <strong>{note.title}</strong>
        <p>{note.reason}</p>
      </div>
      <div className="present-miss-next">
        <span>Next check</span>
        <p>{note.nextCheck}</p>
      </div>
      {recommended.length ? (
        <div className="present-miss-evidence">
          {recommended.map((item) => (
            <button type="button" key={item.id} onClick={() => onOpenEvidence(item.id)}>
              <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function createPresentMissNote(
  selection: { characterId?: string; evidenceId?: string },
  charactersById: Map<string, Character>,
  evidenceById: Map<string, Evidence>,
  reactions: PresentReaction[],
  state: GameState,
): PresentMissNote {
  const character = selection.characterId ? charactersById.get(selection.characterId) : undefined;
  const evidence = selection.evidenceId ? evidenceById.get(selection.evidenceId) : undefined;
  const availableForCharacter = reactions.filter(
    (reaction) =>
      reaction.characterId === selection.characterId &&
      state.evidenceIds.includes(reaction.evidenceId) &&
      canRunInteraction(state, reaction),
  );
  const availableForEvidence = reactions.filter(
    (reaction) =>
      reaction.evidenceId === selection.evidenceId &&
      state.evidenceIds.includes(reaction.evidenceId) &&
      canRunInteraction(state, reaction),
  );
  const recommendedEvidenceIds = availableForCharacter.length
    ? availableForCharacter.map((reaction) => reaction.evidenceId)
    : availableForEvidence.map((reaction) => reaction.evidenceId);

  return {
    id: Date.now(),
    characterId: selection.characterId,
    evidenceId: selection.evidenceId,
    title: '今の組み合わせでは動かない',
    reason: `${character?.name ?? '相手'}の現在の説明に、${evidence?.name ?? 'その証拠'}はまだ直接届いていない。先に人物の言い分、時刻、機会のどれと結びつくかを確認する。`,
    nextCheck: availableForCharacter.length
      ? `${character?.name ?? '相手'}に効く証拠候補を事件ファイルで確認する。`
      : 'この証拠が誰の説明を崩すものか、事件ファイルと会話ログで確認する。',
    recommendedEvidenceIds: [...new Set(recommendedEvidenceIds)],
  };
}

function getPresentPressure(
  character?: Character,
  evidence?: Evidence,
  reaction?: PresentReaction,
): { status: 'empty' | 'ready' | 'weak'; label: string; title: string; detail: string; question: string } {
  if (!character && !evidence) {
    return {
      status: 'empty',
      label: '提示準備',
      title: '人物と証拠を結ぶ',
      detail: '相手の説明と記録のどこが食い違うかを、提示前に組み立てる。',
      question: '誰の発言に、どの記録を当てるか。',
    };
  }

  if (!character) {
    return {
      status: 'empty',
      label: '相手待ち',
      title: 'この記録を誰に読ませるか',
      detail: `${evidence?.name ?? '証拠'}の意味を知っている人物を選ぶ。`,
      question: 'この証拠で説明を動かせる相手は誰か。',
    };
  }

  if (!evidence) {
    return {
      status: 'empty',
      label: '証拠待ち',
      title: `${character.name}の説明を崩す記録を選ぶ`,
      detail: '会話で出た違和感に、具体的な記録を当てる。',
      question: 'この人物の説明に足りない時刻、動機、機会はどれか。',
    };
  }

  if (!reaction) {
    return {
      status: 'weak',
      label: '組み合わせが弱い',
      title: '今のままでは発言が動かない',
      detail: `${evidence.name}は重要だが、${character.name}の現在の説明にはまだ直接届いていない。`,
      question: '先に会話、調査、事件ファイルで前提をつなぐべきではないか。',
    };
  }

  return {
    status: 'ready',
    label: '詰め筋あり',
    title: reaction.label,
    detail: reaction.log ?? reaction.text,
    question: getPresentPressureQuestion(reaction.id, character, evidence),
  };
}

function getPresentPressureQuestion(
  reactionId: string,
  character: Character,
  evidence: Evidence,
): string {
  switch (reactionId) {
    case 'present-printer-to-clerk':
      return 'この印刷履歴は、本当に準備書面の編集と同じ意味なのか。';
    case 'present-old-draft-to-client':
      return '削られた一文の危険性を、いつから分かっていたのか。';
    case 'present-visitor-to-client':
      return '来訪時刻と共用PCの状態を合わせると、編集機会は残らないか。';
    case 'present-email-to-client':
      return '削除後に説明する準備までしていたなら、誰が削除したのか。';
    default:
      return `${character.name}の説明に、${evidence.name}のどの部分が食い込むか。`;
  }
}

function AnalysisPanel({
  state,
  evidence,
  selections,
  evidenceById,
  onSelection,
  onRun,
}: {
  state: GameState;
  evidence: Evidence[];
  selections: Record<string, { first?: string; second?: string }>;
  evidenceById: Map<string, Evidence>;
  onSelection: (selections: Record<string, { first?: string; second?: string }>) => void;
  onRun: (link: AnalysisLink) => void;
}) {
  const completedLinks = episode.analysisLinks.filter((link) =>
    (link.setFlags ?? []).every((flag) => state.flags.includes(flag)),
  );
  const readyLinks = episode.analysisLinks.filter(
    (link) =>
      hasAllFlags(state, link.requiresFlags) &&
      link.evidenceIds.every((id) => state.evidenceIds.includes(id)) &&
      !(link.setFlags ?? []).every((flag) => state.flags.includes(flag)),
  );

  return (
    <section className="action-stack">
      <PanelTitle icon={GitBranch} title="争点整理" subtitle="証拠同士の関係を結ぶ" />
      <p className="panel-copy">
        取得済みの証拠を2つ選び、争点を説明できる組み合わせを作る。
      </p>
      {completedLinks.length ? (
        <div className="mini-list" aria-label="整理済み">
          {completedLinks.map((link) => (
            <span key={link.id}>{link.label}</span>
          ))}
        </div>
      ) : null}
      <AnalysisChainBoard
        state={state}
        evidenceById={evidenceById}
        selections={selections}
        onSelection={onSelection}
      />
      {readyLinks.length ? (
        <div className="analysis-list">
          {readyLinks.map((link) => {
            const current = selections[link.id] ?? {};
            const canSubmit = Boolean(current.first && current.second && current.first !== current.second);

            return (
              <article className="analysis-card" key={link.id}>
                <div>
                  <h3>{link.label}</h3>
                  <p>{link.prompt}</p>
                </div>
                <div className="select-row">
                  <select
                    aria-label={`${link.label} 1つ目の証拠`}
                    value={current.first ?? ''}
                    onChange={(event) =>
                      onSelection({
                        ...selections,
                        [link.id]: { ...current, first: event.target.value || undefined },
                      })
                    }
                  >
                    <option value="">証拠を選ぶ</option>
                    {evidence.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${link.label} 2つ目の証拠`}
                    value={current.second ?? ''}
                    onChange={(event) =>
                      onSelection({
                        ...selections,
                        [link.id]: { ...current, second: event.target.value || undefined },
                      })
                    }
                  >
                    <option value="">証拠を選ぶ</option>
                    {evidence.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => onRun(link)}
                >
                  関係を整理する
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-text">
          今整理できる組み合わせはない。必要な証拠を集めるか、対決へ進む。
        </p>
      )}
      {state.flags.includes('analysis_complete') ? (
        <p className="success-text">
          {evidenceById.get('scheduled-message')?.name ?? '最後の記録'}までつながった。
        </p>
      ) : null}
    </section>
  );
}

function AnalysisChainBoard({
  state,
  evidenceById,
  selections,
  onSelection,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
  selections: Record<string, { first?: string; second?: string }>;
  onSelection: (selections: Record<string, { first?: string; second?: string }>) => void;
}) {
  const steps = episode.analysisLinks.map((link, index) => {
    const complete = (link.setFlags ?? []).every((flag) => state.flags.includes(flag));
    const prereqReady = hasAllFlags(state, link.requiresFlags);
    const ownedEvidence = link.evidenceIds.filter((id) => state.evidenceIds.includes(id));
    const evidenceReady = ownedEvidence.length === link.evidenceIds.length;
    const status: AnalysisChainStatus = complete
      ? 'complete'
      : !prereqReady
        ? 'locked'
        : evidenceReady
          ? 'ready'
          : 'missing';
    const requiredEvidence = link.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((item): item is Evidence => Boolean(item));
    return { link, index, status, requiredEvidence, ownedEvidence };
  });

  return (
    <aside className="analysis-chain-board" aria-label="analysis chain">
      <div className="analysis-chain-heading">
        <div>
          <span>ANALYSIS CHAIN</span>
          <strong>{steps.filter((step) => step.status === 'complete').length}/{steps.length} links built</strong>
          <p>Build each issue by pairing records. Ready links can be filled from the required evidence chips.</p>
        </div>
      </div>
      <div className="analysis-chain-track">
        {steps.map((step) => (
          <article className={`analysis-chain-step status-${step.status}`} key={step.link.id}>
            <div className="analysis-chain-step-heading">
              <span>{String(step.index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{step.link.label}</strong>
                <p>{getAnalysisChainStatusDetail(step.status, step.link, step.ownedEvidence.length)}</p>
              </div>
              <em>{getAnalysisChainStatusLabel(step.status)}</em>
            </div>
            <div className="analysis-chain-evidence">
              {step.requiredEvidence.map((item) => {
                const owned = state.evidenceIds.includes(item.id);
                return (
                  <button
                    className={owned ? 'owned' : 'missing'}
                    disabled={!owned}
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const current = selections[step.link.id] ?? {};
                      const next =
                        current.first && current.first !== item.id
                          ? { first: current.first, second: item.id }
                          : { first: item.id, second: current.second };
                      onSelection({ ...selections, [step.link.id]: next });
                    }}
                  >
                    <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function getAnalysisChainStatusLabel(status: AnalysisChainStatus) {
  switch (status) {
    case 'complete':
      return 'done';
    case 'ready':
      return 'ready';
    case 'missing':
      return 'record';
    case 'locked':
      return 'locked';
  }
}

function getAnalysisChainStatusDetail(
  status: AnalysisChainStatus,
  link: AnalysisLink,
  ownedCount: number,
) {
  if (status === 'complete') return 'This relation is already part of the case theory.';
  if (status === 'ready') return 'Required records are in hand. Fill the pair and organize it.';
  if (status === 'missing') return `${ownedCount}/${link.evidenceIds.length} required records are in the file.`;
  return 'A previous issue or witness route must be resolved first.';
}

function HearingPanel({
  state,
  evidence,
  cue,
  charactersById,
  evidenceById,
  selection,
  onSelection,
  onPress,
  onSubmit,
  onOpenEvidence,
}: {
  state: GameState;
  evidence: Evidence[];
  cue?: HearingCue;
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
  selection: { statementId?: string; evidenceId?: string };
  onSelection: (selection: { statementId?: string; evidenceId?: string }) => void;
  onPress: () => void;
  onSubmit: () => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const complete = state.flags.includes(episode.hearing.requiredFlag);
  const canSubmit = Boolean(selection.statementId && selection.evidenceId);
  const selectedIndex = Math.max(
    0,
    episode.hearing.statements.findIndex((statement) => statement.id === selection.statementId),
  );
  const selectedStatement = episode.hearing.statements[selectedIndex];
  const selectedEvidence = evidence.find((item) => item.id === selection.evidenceId);
  const routeInfo = getHearingRouteInfo(state, selectedStatement);
  const selectedStatementPressed = Boolean(
    selectedStatement?.pressFlag && state.flags.includes(selectedStatement.pressFlag),
  );
  const canPress = Boolean(selection.statementId && selectedStatement?.pressText && !selectedStatementPressed && !complete);
  const speakerCharacter = selectedStatement?.characterId
    ? charactersById.get(selectedStatement.characterId)
    : undefined;
  const selectStatement = (statementId: string) => onSelection({ ...selection, statementId });
  const moveStatement = (offset: number) => {
    const nextIndex =
      (selectedIndex + offset + episode.hearing.statements.length) %
      episode.hearing.statements.length;
    const nextStatement = episode.hearing.statements[nextIndex];
    if (nextStatement) selectStatement(nextStatement.id);
  };
  const reactionLabel = getHearingReactionLabel(state.tone);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const formTarget =
        target instanceof HTMLElement
          ? target.closest('input, select, textarea, [contenteditable="true"]')
          : null;
      if (formTarget) return;
      if (event.key === 'Enter' && target instanceof HTMLElement && target.closest('button')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveStatement(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveStatement(1);
      }
      if (event.key.toLowerCase() === 'p' && canPress) {
        event.preventDefault();
        onPress();
      }
      if (event.key === 'Enter' && canSubmit && !complete) {
        event.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIndex, selection, canPress, canSubmit, complete, onPress, onSubmit]);

  return (
    <section className="action-stack">
      <PanelTitle icon={Scale} title="対決" subtitle="発言と証拠の矛盾を示す" />
      <p className="panel-copy">{episode.hearing.intro}</p>
      <div className="credibility-meter" aria-label="信用">
        {Array.from({ length: MAX_CREDIBILITY }, (_, index) => (
          <span
            className={index < (state.credibility ?? MAX_CREDIBILITY) ? 'filled' : ''}
            key={index}
          />
        ))}
      </div>
      <CrossExaminationBanner
        state={state}
        statement={selectedStatement}
        selectedIndex={selectedIndex}
        speaker={speakerCharacter}
        routeInfo={routeInfo}
      />
      {reactionLabel ? (
        <p className={`hearing-reaction tone-${state.tone}`}>{reactionLabel}</p>
      ) : null}
      <HearingCourtHud
        state={state}
        routeInfo={routeInfo}
        selectedEvidence={selectedEvidence}
        evidenceCount={evidence.length}
      />
      <HearingShortcutHelp canPress={canPress} canSubmit={canSubmit && !complete} routeInfo={routeInfo} />
      <CourtroomBench
        state={state}
        statement={selectedStatement}
        routeInfo={routeInfo}
        charactersById={charactersById}
      />
      <HearingTrialFlowPanel
        state={state}
        statement={selectedStatement}
        routeInfo={routeInfo}
        selectedEvidence={selectedEvidence}
        evidenceById={evidenceById}
      />
      <div className="testimony-board" aria-label="証言送り">
        <div className="testimony-nav">
          <button className="secondary-button testimony-prev" type="button" onClick={() => moveStatement(-1)}>
            <ChevronLeft aria-hidden="true" />
            前の証言
          </button>
          <div className="testimony-counter">
            <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
            <strong>{episode.hearing.statements.length}件中</strong>
          </div>
          <button className="secondary-button testimony-next" type="button" onClick={() => moveStatement(1)}>
            次の証言
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        <article className={`testimony-card status-${routeInfo.status}`}>
          <img
            className="testimony-portrait"
            src={getCharacterPortrait(speakerCharacter, getHearingPortraitTone(routeInfo, state.tone))}
            alt=""
          />
          <div className="testimony-body">
            <div className="testimony-speaker">
              <span>{routeInfo.label}</span>
              <strong>{speakerCharacter?.name ?? selectedStatement?.speaker ?? '証言者'}</strong>
            </div>
            <p className="testimony-line">{selectedStatement?.text ?? '証言を選ぶ。'}</p>
            <small>
              {selectedStatementPressed ? '詳しく確認済み' : selectedStatement?.note}
            </small>
            <p className="testimony-readout">
              {getWitnessReadout(state, selectedStatement, routeInfo)}
            </p>
          </div>
        </article>
        <HearingReadingGuide
          state={state}
          statement={selectedStatement}
          routeInfo={routeInfo}
          evidenceById={evidenceById}
          onOpenEvidence={onOpenEvidence}
        />
        <HearingStatementDock
          state={state}
          statement={selectedStatement}
          routeInfo={routeInfo}
          evidenceById={evidenceById}
          onOpenEvidence={onOpenEvidence}
        />
        <HearingAmendmentPanel
          state={state}
          statement={selectedStatement}
          evidenceById={evidenceById}
          onOpenEvidence={onOpenEvidence}
        />

        <div className="testimony-strip" aria-label="証言一覧">
          {episode.hearing.statements.map((statement, index) => {
            const active = statement.id === selectedStatement?.id;
            const markerInfo = getHearingRouteInfo(state, statement);
            return (
              <button
                className={[
                  'testimony-marker',
                  `status-${markerInfo.status}`,
                  active ? 'active' : '',
                ].join(' ')}
                type="button"
                key={statement.id}
                onClick={() => selectStatement(statement.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <small>{markerInfo.label}</small>
              </button>
            );
          })}
        </div>
        <HearingSequencePanel
          state={state}
          activeStatementId={selectedStatement?.id}
          evidenceById={evidenceById}
          onSelectStatement={selectStatement}
          onOpenEvidence={onOpenEvidence}
        />
        <HearingRoutePanel
          routeInfo={routeInfo}
          selectedEvidence={selectedEvidence}
        />
        <HearingCaseNote
          state={state}
          statement={selectedStatement}
          evidence={selectedEvidence}
          routeInfo={routeInfo}
        />
        <HearingLedger
          state={state}
          activeStatementId={selectedStatement?.id}
          evidenceById={evidenceById}
          onSelectStatement={selectStatement}
        />
        {cue ? (
          <HearingCuePanel
            cue={cue}
            charactersById={charactersById}
            evidenceById={evidenceById}
            onOpenEvidence={onOpenEvidence}
          />
        ) : null}
      </div>
      <HearingBreakthroughPanel state={state} evidenceById={evidenceById} />
      <HearingRecordTray
        evidence={evidence}
        selectedEvidenceId={selection.evidenceId}
        routeInfo={routeInfo}
        onSelectEvidence={(evidenceId) => onSelection({ ...selection, evidenceId })}
        onOpenEvidence={onOpenEvidence}
      />
      <div className="select-row hearing-control-row">
        <select
          aria-label="示す証拠"
          value={selection.evidenceId ?? ''}
          onChange={(event) =>
            onSelection({ ...selection, evidenceId: event.target.value || undefined })
          }
        >
          <option value="">示す証拠を選ぶ</option>
          {evidence.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          className="secondary-button"
          type="button"
          disabled={!canPress}
          onClick={onPress}
        >
          {selectedStatementPressed ? '確認済み' : '詳しく聞く'}
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!canSubmit || complete}
          onClick={onSubmit}
        >
          矛盾を示す
        </button>
      </div>
      <ConfrontationDock
        state={state}
        statement={selectedStatement}
        evidence={selectedEvidence}
        onOpenEvidence={onOpenEvidence}
      />
      {state.flags.includes('hearing_pc_contradiction') ? (
        <p className="success-text">編集機会の否定は崩した。次は、怖くなった時期の説明を崩す。</p>
      ) : null}
      {complete ? <p className="success-text">対決は突破した。最終推理へ進める。</p> : null}
    </section>
  );
}

function CourtroomBench({
  state,
  statement,
  routeInfo,
  charactersById,
}: {
  state: GameState;
  statement?: HearingStatement;
  routeInfo: HearingRouteInfo;
  charactersById: Map<string, Character>;
}) {
  const defense = charactersById.get('assistant');
  const witness = statement?.characterId ? charactersById.get(statement.characterId) : undefined;
  const pressure = state.tone === 'damage' ? 'damage' : routeInfo.status === 'ready' ? 'pressure' : 'neutral';
  const clearedCount = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;

  return (
    <section className={`courtroom-bench status-${routeInfo.status}`} aria-label="法廷配置">
      <div className="courtroom-bench-header">
        <div>
          <span>COURTROOM</span>
          <strong>{getCourtroomBenchHeadline(routeInfo.status)}</strong>
          <p>{getCourtroomBenchDetail(routeInfo, statement)}</p>
        </div>
        <em>
          {clearedCount}/{episode.hearing.contradictions.length}
          <small>breaks</small>
        </em>
      </div>
      <div className="courtroom-bench-stage">
        <article className="courtroom-seat seat-judge">
          <div className="courtroom-symbol" aria-hidden="true">
            <Scale size={24} />
          </div>
          <span>裁判長</span>
          <strong>発言の筋を確認中</strong>
        </article>
        <article className="courtroom-seat seat-defense">
          <img src={getCharacterPortrait(defense, pressure === 'damage' ? 'damage' : 'pressure')} alt="" />
          <span>弁護側</span>
          <strong>{defense?.name ?? '主人公'}</strong>
        </article>
        <article className="courtroom-seat seat-witness">
          <img src={getCharacterPortrait(witness, pressure)} alt="" />
          <span>証人席</span>
          <strong>{witness?.name ?? statement?.speaker ?? '証人'}</strong>
        </article>
        <article className="courtroom-seat seat-prosecution">
          <div className="courtroom-symbol" aria-hidden="true">
            検
          </div>
          <span>反対側</span>
          <strong>{getCourtroomOppositionLabel(routeInfo.status)}</strong>
        </article>
      </div>
    </section>
  );
}

function getCourtroomBenchHeadline(status: HearingRouteStatus) {
  switch (status) {
    case 'ready':
      return '証言と記録が衝突している';
    case 'cleared':
      return 'この発言は崩れている';
    case 'needs-press':
      return 'まだ言葉を絞れる';
    case 'locked':
      return '先に別の前提を崩す';
    case 'context':
      return '証言の背景を読む';
  }
}

function getCourtroomBenchDetail(routeInfo: HearingRouteInfo, statement?: HearingStatement) {
  if (!statement) return '証言を選ぶと、法廷上の立ち位置と攻め筋が更新される。';
  if (routeInfo.status === 'ready') return `「${statement.text}」に対し、記録を突きつける局面。`;
  if (routeInfo.status === 'cleared') return 'この争点では証人の逃げ道を塞いだ。残った発言へ進む。';
  if (routeInfo.status === 'needs-press') return '詳しく聞くことで、曖昧な説明を証拠へ当てられる形にする。';
  if (routeInfo.status === 'locked') return routeInfo.detail;
  return statement.note;
}

function CrossExaminationBanner({
  state,
  statement,
  selectedIndex,
  speaker,
  routeInfo,
}: {
  state: GameState;
  statement?: HearingStatement;
  selectedIndex: number;
  speaker?: Character;
  routeInfo: HearingRouteInfo;
}) {
  const clearedCount = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;
  const phase = getCrossExaminationPhase(routeInfo.status);

  return (
    <section className={`cross-examination-banner status-${routeInfo.status}`} aria-label="尋問タイトル">
      <div className="cross-examination-banner-main">
        <span>CROSS EXAMINATION</span>
        <strong>{speaker?.name ?? statement?.speaker ?? '証人'}の証言</strong>
        <p>{phase}</p>
      </div>
      <div className="cross-examination-banner-count">
        <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
        <small>{episode.hearing.statements.length} TESTIMONIES</small>
      </div>
      <div className="cross-examination-banner-breaks">
        <span>{clearedCount}/{episode.hearing.contradictions.length}</span>
        <small>BREAKS</small>
      </div>
    </section>
  );
}

function getCrossExaminationPhase(status: HearingRouteStatus) {
  switch (status) {
    case 'ready':
      return '記録を突きつける局面';
    case 'cleared':
      return 'この証言は崩れている';
    case 'needs-press':
      return '詳しく聞いて証言を動かす';
    case 'locked':
      return '先に別の証言を崩す';
    case 'context':
      return '発言と背景を読む';
  }
}

function HearingCourtHud({
  state,
  routeInfo,
  selectedEvidence,
  evidenceCount,
}: {
  state: GameState;
  routeInfo: HearingRouteInfo;
  selectedEvidence?: Evidence;
  evidenceCount: number;
}) {
  const credibility = state.credibility ?? MAX_CREDIBILITY;
  const statusLabel = getHearingHudStatus(routeInfo.status);

  return (
    <section className={`hearing-court-hud status-${routeInfo.status}`} aria-label="法廷HUD">
      <div className="hearing-court-hud-main">
        <span>TRIAL HUD</span>
        <strong>{statusLabel}</strong>
      </div>
      <div className="hearing-court-hud-lives" aria-label={`信用 ${credibility}/${MAX_CREDIBILITY}`}>
        <Scale size={16} aria-hidden="true" />
        {Array.from({ length: MAX_CREDIBILITY }, (_, index) => (
          <i className={index < credibility ? 'filled' : ''} key={index}>
            ◆
          </i>
        ))}
      </div>
      <div className="hearing-court-hud-record">
        <span>RECORD</span>
        <strong>{selectedEvidence?.name ?? `証拠 ${evidenceCount}件`}</strong>
      </div>
      <div className="hearing-court-hud-command">
        <span>{routeInfo.status === 'ready' ? 'つきつける' : 'ゆさぶる'}</span>
      </div>
    </section>
  );
}

function getHearingHudStatus(status: HearingRouteStatus) {
  switch (status) {
    case 'ready':
      return '異議あり準備';
    case 'cleared':
      return '崩し済み';
    case 'needs-press':
      return 'ゆさぶり待ち';
    case 'locked':
      return '前提ロック';
    case 'context':
      return '証言確認';
  }
}

function HearingShortcutHelp({
  canPress,
  canSubmit,
  routeInfo,
}: {
  canPress: boolean;
  canSubmit: boolean;
  routeInfo: HearingRouteInfo;
}) {
  return (
    <aside className={`hearing-shortcuts status-${routeInfo.status}`} aria-label="対決ショートカット">
      <span>SHORTCUTS</span>
      <div>
        <kbd>←</kbd>
        <kbd>→</kbd>
        <strong>証言送り</strong>
      </div>
      <div className={canPress ? 'ready' : ''}>
        <kbd>P</kbd>
        <strong>{canPress ? '詳しく聞く' : 'ゆさぶり不可'}</strong>
      </div>
      <div className={canSubmit ? 'ready' : ''}>
        <kbd>Enter</kbd>
        <strong>{canSubmit ? '矛盾を示す' : '証拠待ち'}</strong>
      </div>
    </aside>
  );
}

function HearingRecordTray({
  evidence,
  selectedEvidenceId,
  routeInfo,
  onSelectEvidence,
  onOpenEvidence,
}: {
  evidence: Evidence[];
  selectedEvidenceId?: string;
  routeInfo: HearingRouteInfo;
  onSelectEvidence: (evidenceId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const targetEvidenceId = routeInfo.contradiction?.evidenceId;
  const sortedEvidence = [...evidence].sort((a, b) => {
    const aScore = getHearingRecordPriority(a, selectedEvidenceId, targetEvidenceId);
    const bScore = getHearingRecordPriority(b, selectedEvidenceId, targetEvidenceId);
    return bScore - aScore || a.name.localeCompare(b.name, 'ja');
  });

  return (
    <aside className={`hearing-record-tray status-${routeInfo.status}`} aria-label="法廷記録トレイ">
      <div className="hearing-record-tray-heading">
        <div>
          <span>COURT RECORD</span>
          <strong>{selectedEvidenceId ? '示す記録を確認する' : '示す記録を選ぶ'}</strong>
          <p>{getHearingRecordTrayHint(routeInfo)}</p>
        </div>
        <em>{evidence.length} records</em>
      </div>
      <div className="hearing-record-grid">
        {sortedEvidence.map((item) => {
          const selected = item.id === selectedEvidenceId;
          const target = item.id === targetEvidenceId;
          return (
            <article
              className={[
                'hearing-record-card',
                selected ? 'selected' : '',
                target ? 'target' : '',
              ].join(' ')}
              data-evidence-id={item.id}
              key={item.id}
            >
              <button type="button" onClick={() => onSelectEvidence(item.id)}>
                <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <span>{target ? '矛盾候補' : item.isKey ? '重要記録' : '記録'}</span>
                <strong>{item.name}</strong>
                <small>{getEvidenceFactPoint(item.id, item.detail)}</small>
              </button>
              <button className="hearing-record-detail" type="button" onClick={() => onOpenEvidence(item.id)}>
                詳細
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function getHearingRecordPriority(item: Evidence, selectedEvidenceId?: string, targetEvidenceId?: string) {
  if (item.id === selectedEvidenceId) return 4;
  if (item.id === targetEvidenceId) return 3;
  if (item.isKey) return 2;
  return 1;
}

function getHearingRecordTrayHint(routeInfo: HearingRouteInfo) {
  if (routeInfo.status === 'ready') return '証言とぶつかる記録を選ぶと、そのまま矛盾提示へ進める。';
  if (routeInfo.status === 'needs-press') return '先に詳しく聞くと、当てるべき記録が絞られる。';
  if (routeInfo.status === 'locked') return '順序が残っている。別の証言を崩してから記録を当てる。';
  if (routeInfo.status === 'cleared') return 'この発言は崩れている。残った証言に記録を回す。';
  return '発言の内容に近い記録を選び、比較欄で届くかを確認する。';
}

function getCourtroomOppositionLabel(status: HearingRouteStatus) {
  if (status === 'ready') return '異議を警戒';
  if (status === 'cleared') return '主張後退';
  if (status === 'needs-press') return '発言維持';
  if (status === 'locked') return '順序を主張';
  return '反論待機';
}

function HearingTrialFlowPanel({
  state,
  statement,
  routeInfo,
  selectedEvidence,
  evidenceById,
}: {
  state: GameState;
  statement?: HearingStatement;
  routeInfo: HearingRouteInfo;
  selectedEvidence?: Evidence;
  evidenceById: Map<string, Evidence>;
}) {
  const expectedEvidence = routeInfo.contradiction
    ? evidenceById.get(routeInfo.contradiction.evidenceId)
    : undefined;
  const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
  const selectedMatches = Boolean(
    selectedEvidence && expectedEvidence && selectedEvidence.id === expectedEvidence.id,
  );
  const steps = getHearingTrialFlowSteps(routeInfo, statement, selectedEvidence, expectedEvidence, pressed);
  const completedSteps = steps.filter((step) => step.status === 'met').length;

  return (
    <aside className={`hearing-trial-flow status-${routeInfo.status}`} aria-label="法廷進行">
      <div className="hearing-trial-flow-heading">
        <div>
          <span>TRIAL FLOW</span>
          <strong>{getHearingTrialFlowHeadline(routeInfo, selectedMatches)}</strong>
          <p>{getHearingTrialFlowDetail(routeInfo, statement, expectedEvidence)}</p>
        </div>
        <em>
          {completedSteps}/{steps.length}
          <small>beats</small>
        </em>
      </div>
      <div className="hearing-trial-flow-steps">
        {steps.map((step, index) => (
          <section className={`hearing-trial-flow-step status-${step.status}`} key={step.label}>
            <em>{String(index + 1).padStart(2, '0')}</em>
            <div>
              <span>{step.label}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function getHearingTrialFlowSteps(
  routeInfo: HearingRouteInfo,
  statement?: HearingStatement,
  selectedEvidence?: Evidence,
  expectedEvidence?: Evidence,
  pressed = false,
): Array<{
  label: string;
  title: string;
  detail: string;
  status: HearingSubmitCheckStatus;
}> {
  const hasStatement = Boolean(statement);
  const selectedMatches = Boolean(
    selectedEvidence && expectedEvidence && selectedEvidence.id === expectedEvidence.id,
  );
  const canAttack = routeInfo.status === 'ready' || routeInfo.status === 'cleared';
  const needsPress = routeInfo.status === 'needs-press';
  const locked = routeInfo.status === 'locked';

  return [
    {
      label: 'CLAIM',
      title: statement ? getContradictionAxis(statement.id) : '証言を選ぶ',
      detail: statement
        ? getStatementClaimPoint(statement.id, statement.text)
        : 'まず証言を送り、検察側が何を言い切ったかを読む。',
      status: hasStatement ? 'met' : 'missing',
    },
    {
      label: 'PRESSURE',
      title: needsPress && !pressed ? 'ゆさぶりで言葉を狭める' : '攻撃できる形まで読む',
      detail: needsPress
        ? pressed
          ? statement?.pressText ?? '追及で補足を引き出した。'
          : 'この発言はまだ広い。詳しく聞くと証拠へ当てられる。'
        : routeInfo.detail,
      status: needsPress && !pressed ? 'blocked' : locked ? 'warning' : 'met',
    },
    {
      label: 'RECORD',
      title: expectedEvidence?.name ?? selectedEvidence?.name ?? '記録を選ぶ',
      detail: expectedEvidence
        ? `${expectedEvidence.name}: ${getEvidenceFactPoint(expectedEvidence.id, expectedEvidence.detail)}`
        : selectedEvidence
          ? `${selectedEvidence.name}は背景確認用。核心発言へ移る。`
          : '発言の弱点へ届く記録を法廷記録から選ぶ。',
      status: expectedEvidence ? (selectedMatches ? 'met' : 'missing') : selectedEvidence ? 'warning' : 'missing',
    },
    {
      label: 'TURNABOUT',
      title: getHearingTrialFlowTurnTitle(routeInfo, selectedMatches),
      detail: getHearingTrialFlowTurnDetail(routeInfo, statement, expectedEvidence, selectedMatches),
      status:
        routeInfo.status === 'cleared'
          ? 'met'
          : canAttack && selectedMatches
            ? 'met'
            : locked || needsPress
              ? 'blocked'
              : 'warning',
    },
  ];
}

function getHearingTrialFlowHeadline(routeInfo: HearingRouteInfo, selectedMatches: boolean): string {
  if (routeInfo.status === 'cleared') return 'この節の反論は崩れている';
  if (routeInfo.status === 'ready' && selectedMatches) return 'ここで異議ありを切れる';
  if (routeInfo.status === 'ready') return '記録を選べば崩せる局面';
  if (routeInfo.status === 'needs-press') return '先に言葉を引き出す局面';
  if (routeInfo.status === 'locked') return '順番を飛ばすと反論が残る';
  return '証言の役割を読む';
}

function getHearingTrialFlowDetail(
  routeInfo: HearingRouteInfo,
  statement?: HearingStatement,
  expectedEvidence?: Evidence,
): string {
  if (!statement) return '証言を選ぶと、主張、追及、記録、反転の4拍で進行が見える。';
  if (routeInfo.status === 'ready') {
    return expectedEvidence
      ? `${expectedEvidence.name}で、発言の前提を法廷上で反転させる。`
      : 'この発言は攻撃できる形になっている。';
  }
  if (routeInfo.status === 'needs-press') {
    return '詳しく聞いて、曖昧な言い方を証拠へ当てられる形に変える。';
  }
  if (routeInfo.status === 'locked') return routeInfo.detail;
  if (routeInfo.status === 'cleared') return 'この節は突破済み。未解決の発言へ視線を移す。';
  return getStatementClaimPoint(statement.id, statement.text);
}

function getHearingTrialFlowTurnTitle(routeInfo: HearingRouteInfo, selectedMatches: boolean): string {
  if (routeInfo.status === 'cleared') return '反論成立';
  if (routeInfo.status === 'ready' && selectedMatches) return '矛盾を示す';
  if (routeInfo.status === 'ready') return '証拠選択待ち';
  if (routeInfo.status === 'needs-press') return '追及待ち';
  if (routeInfo.status === 'locked') return '前段待ち';
  return '次の証言へ';
}

function getHearingTrialFlowTurnDetail(
  routeInfo: HearingRouteInfo,
  statement?: HearingStatement,
  expectedEvidence?: Evidence,
  selectedMatches = false,
): string {
  if (routeInfo.status === 'cleared') return 'この主張は記録と両立しないものとして整理済み。';
  if (routeInfo.status === 'ready' && selectedMatches) {
    return getContradictionVerdict(statement?.id ?? '');
  }
  if (routeInfo.status === 'ready') {
    return expectedEvidence
      ? `${expectedEvidence.name}を選ぶと、異議ありの根拠がそろう。`
      : '対応する記録を選んで提出前チェックを見る。';
  }
  if (routeInfo.status === 'needs-press') return '詳しく聞くで補足を引き出す。';
  if (routeInfo.status === 'locked') return routeInfo.detail;
  return '背景を確認し、核心発言へ移る。';
}

function HearingBreakthroughPanel({
  state,
  evidenceById,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
}) {
  const pcCleared = state.flags.includes('hearing_pc_contradiction');
  const finalCleared = state.flags.includes(episode.hearing.requiredFlag);
  if (!pcCleared && !finalCleared) return null;

  const items = [
    {
      label: '突破済み',
      title: '編集できないという説明を崩した',
      detail: 'ファイル更新履歴で、準備書面へ触れられた機会を示した。',
      evidenceId: 'file-history',
      status: 'cleared',
    },
    {
      label: finalCleared ? '突破済み' : '次の狙い',
      title: '怖くなった時期を崩す',
      detail: finalCleared
        ? '削除直後に説明を用意していたことまでつながった。'
        : '送信予約メモを使い、削除後に慌てたという説明を崩す。',
      evidenceId: 'scheduled-message',
      status: finalCleared ? 'cleared' : 'next',
    },
  ];

  return (
    <aside className={`hearing-breakthrough status-${finalCleared ? 'complete' : 'partial'}`} aria-label="対決突破">
      <div className="hearing-breakthrough-heading">
        <div>
          <span>突破シーケンス</span>
          <strong>{finalCleared ? '対決は突破した' : '証言が揺らいだ。次の矛盾を絞る。'}</strong>
          <p>
            {finalCleared
              ? '2つの矛盾が記録と接続した。最終推理で結論を組み立てる。'
              : '同じ人物の説明を続けて崩すことで、削除の意図に届く。'}
          </p>
        </div>
        <em>{finalCleared ? '完了' : '続行'}</em>
      </div>
      <div className="hearing-breakthrough-track">
        {items.map((item, index) => {
          const evidence = evidenceById.get(item.evidenceId);
          return (
            <section className={`hearing-breakthrough-step status-${item.status}`} key={item.evidenceId}>
              <span>{String(index + 1).padStart(2, '0')} {item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              {evidence ? (
                <small>
                  <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  {evidence.name}
                </small>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function HearingLedger({
  state,
  activeStatementId,
  evidenceById,
  onSelectStatement,
}: {
  state: GameState;
  activeStatementId?: string;
  evidenceById: Map<string, Evidence>;
  onSelectStatement: (statementId: string) => void;
}) {
  const steps = episode.hearing.contradictions.map((contradiction, index) => {
    const statement = episode.hearing.statements.find(
      (item) => item.id === contradiction.statementId,
    );
    const evidence = evidenceById.get(contradiction.evidenceId);
    const cleared = Boolean(contradiction.setFlags?.some((flag) => state.flags.includes(flag)));
    const prereqReady = hasAllFlags(state, contradiction.requiresFlags);
    const evidenceReady = state.evidenceIds.includes(contradiction.evidenceId);
    const status: HearingLedgerStatus = cleared
      ? 'cleared'
      : prereqReady && evidenceReady
        ? 'ready'
        : prereqReady
          ? 'missing'
          : 'locked';

    return {
      contradiction,
      evidence,
      index,
      statement,
      status,
    };
  });
  const completed = steps.filter((step) => step.status === 'cleared').length;
  const nextStep = steps.find((step) => step.status !== 'cleared');

  return (
    <section className="hearing-ledger" aria-label="対決の崩し順">
      <div className="hearing-ledger-heading">
        <div>
          <span>崩し順メモ</span>
          <strong>{nextStep ? getHearingLedgerHeadline(nextStep.status) : '対決は突破済み'}</strong>
          <p>{nextStep ? getHearingLedgerDetail(nextStep) : '2つの矛盾はどちらも記録で崩れている。'}</p>
        </div>
        <em>
          {completed}/{steps.length}
          <small>突破</small>
        </em>
      </div>
      <div className="hearing-ledger-grid">
        {steps.map((step) => (
          <button
            className={[
              'hearing-ledger-card',
              `status-${step.status}`,
              activeStatementId === step.statement?.id ? 'active' : '',
            ].join(' ')}
            type="button"
            key={step.contradiction.statementId}
            onClick={() => step.statement && onSelectStatement(step.statement.id)}
          >
            <span>{String(step.index + 1).padStart(2, '0')} {getContradictionAxis(step.contradiction.statementId)}</span>
            <strong>{step.statement?.text ?? '証言を確認する'}</strong>
            <p>{getHearingLedgerCardDetail(step)}</p>
            <div>
              <em>{getHearingLedgerStatusLabel(step.status)}</em>
              {step.evidence && state.evidenceIds.includes(step.evidence.id) ? (
                <small>
                  <img src={step.evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  {step.evidence.name}
                </small>
              ) : (
                <small>必要な記録</small>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function HearingReadingGuide({
  state,
  statement,
  routeInfo,
  evidenceById,
  onOpenEvidence,
}: {
  state: GameState;
  statement?: HearingStatement;
  routeInfo: HearingRouteInfo;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const guide = getHearingReadingGuide(state, statement, routeInfo, evidenceById);

  return (
    <aside className={`hearing-reading-guide status-${routeInfo.status}`} aria-label="証言読み筋">
      <div className="hearing-reading-heading">
        <div>
          <span>証言読み筋</span>
          <strong>{guide.headline}</strong>
          <p>{guide.detail}</p>
        </div>
        <em>{guide.label}</em>
      </div>
      <div className="hearing-reading-grid">
        <section>
          <span>発言の芯</span>
          <p>{guide.claim}</p>
        </section>
        <section>
          <span>読む記録</span>
          {guide.evidence ? (
            <button type="button" onClick={() => onOpenEvidence(guide.evidence!.id)}>
              <img src={guide.evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <strong>{guide.evidence.name}</strong>
            </button>
          ) : (
            <p>{guide.record}</p>
          )}
          {guide.evidence ? <p>{guide.record}</p> : null}
        </section>
        <section>
          <span>次の操作</span>
          <p>{guide.nextAction}</p>
        </section>
      </div>
    </aside>
  );
}

function getHearingReadingGuide(
  state: GameState,
  statement: HearingStatement | undefined,
  routeInfo: HearingRouteInfo,
  evidenceById: Map<string, Evidence>,
): {
  label: string;
  headline: string;
  detail: string;
  claim: string;
  record: string;
  nextAction: string;
  evidence?: Evidence;
} {
  if (!statement) {
    return {
      label: '発言待ち',
      headline: 'まず証言を1件選ぶ',
      detail: '証言を送って、相手が言い切った部分を探す。',
      claim: 'まだ発言が選ばれていない。',
      record: '発言に対応する記録は、選択後に表示される。',
      nextAction: '前後の証言か証言マーカーから発言を選ぶ。',
    };
  }

  const contradiction = routeInfo.contradiction;
  const evidence = contradiction ? evidenceById.get(contradiction.evidenceId) : undefined;
  const pressed = Boolean(statement.pressFlag && state.flags.includes(statement.pressFlag));

  if (routeInfo.status === 'cleared') {
    return {
      label: '突破済み',
      headline: 'この発言の逃げ道は塞いだ',
      detail: '同じ発言をもう一度崩すより、残った論点へ移る。',
      claim: getStatementClaimPoint(statement.id, statement.text),
      record: evidence
        ? `${evidence.name}で成立済みの矛盾として記録されている。`
        : 'この発言は突破済みとして扱う。',
      nextAction: '崩し順メモから未突破の発言を選ぶ。',
      evidence,
    };
  }

  if (!contradiction) {
    const evidence = evidenceById.get('visitor-log');
    return {
      label: '背景確認',
      headline: '移動経路の足場を作る',
      detail: 'ここは矛盾を示すより、会議室前までの動線を固める発言。',
      claim: getStatementClaimPoint(statement.id, statement.text),
      record: evidence
        ? '来訪カード履歴で受付から会議室前までの動きを確認する。'
        : '来訪経路を示す記録を先に探す。',
      nextAction: pressed ? '核心発言へ移り、編集機会の否定を読む。' : '詳しく聞いて、発言の幅を狭める。',
      evidence,
    };
  }

  if (routeInfo.status === 'needs-press') {
    return {
      label: '要ゆさぶり',
      headline: '証拠へ当てる前に言葉を絞る',
      detail: '今の発言はまだ抽象的で、記録に直接ぶつけるには逃げ道が残っている。',
      claim: getStatementClaimPoint(statement.id, statement.text),
      record: evidence
        ? `${evidence.name}は近い。先に詳しく聞くと、比較軸が記録へ寄る。`
        : '候補記録を読む前に、発言の言い換えを引き出す。',
      nextAction: '詳しく聞くを押す。',
      evidence,
    };
  }

  if (routeInfo.status === 'locked') {
    return {
      label: '前提待ち',
      headline: '順番を飛ばすと逃げられる',
      detail: 'この発言の前に、別の矛盾を成立させておく必要がある。',
      claim: getStatementClaimPoint(statement.id, statement.text),
      record: evidence
        ? `${evidence.name}は最後に使う記録。先に前段の矛盾を崩す。`
        : '前段の矛盾を崩す記録を先に読む。',
      nextAction: getHearingLedgerRequirement(contradiction),
      evidence,
    };
  }

  return {
    label: '提示可能',
    headline: '発言と記録が同じ比較軸に乗った',
    detail: '発言の言い切りと、記録が示す時刻・操作が両立しない。',
    claim: getStatementClaimPoint(statement.id, statement.text),
    record: evidence
      ? `${evidence.name}: ${getEvidenceFactPoint(evidence.id, evidence.detail)}`
      : routeInfo.cue,
    nextAction: evidence
      ? `${evidence.name}を選び、矛盾を示す。`
      : '示す証拠を選ぶ。',
    evidence,
  };
}

function HearingStatementDock({
  state,
  statement,
  routeInfo,
  evidenceById,
  onOpenEvidence,
}: {
  state: GameState;
  statement?: HearingStatement;
  routeInfo: HearingRouteInfo;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const contradiction = routeInfo.contradiction;
  const expectedEvidence = contradiction ? evidenceById.get(contradiction.evidenceId) : undefined;
  const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
  const timelineHits = expectedEvidence
    ? episode.timeline.filter((event) => event.evidenceIds?.includes(expectedEvidence.id))
    : [];
  const statusNotes = getHearingStatementDockNotes(routeInfo, pressed, expectedEvidence);

  return (
    <aside className={`hearing-statement-dock status-${routeInfo.status}`} aria-label="statement dock">
      <div className="hearing-statement-dock-heading">
        <div>
          <span>STATEMENT DOCK</span>
          <strong>{statement ? getContradictionAxis(statement.id) : 'Select a statement'}</strong>
          <p>{statement ? getStatementClaimPoint(statement.id, statement.text) : 'Choose testimony to inspect its claim, pressure state, and record link.'}</p>
        </div>
        <em>{routeInfo.label}</em>
      </div>
      <div className="hearing-statement-dock-grid">
        <section>
          <span>Pressure</span>
          <strong>{pressed ? 'Pressed' : statement?.pressText ? 'Can press' : 'No press lead'}</strong>
          <p>{statusNotes.pressure}</p>
        </section>
        <section>
          <span>Record</span>
          {expectedEvidence ? (
            <button type="button" onClick={() => onOpenEvidence(expectedEvidence.id)}>
              <img src={expectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <strong>{expectedEvidence.name}</strong>
            </button>
          ) : (
            <strong>Background</strong>
          )}
          <p>{statusNotes.record}</p>
        </section>
        <section>
          <span>Timing</span>
          <strong>{timelineHits[0]?.time ?? 'Unpinned'}</strong>
          <p>{timelineHits[0]?.title ?? statusNotes.timing}</p>
        </section>
      </div>
      <div className="hearing-statement-dock-checks" aria-label="statement dock checks">
        {statusNotes.checks.map((check) => (
          <span className={check.done ? 'done' : 'pending'} key={check.label}>
            {check.label}
          </span>
        ))}
      </div>
    </aside>
  );
}

function getHearingStatementDockNotes(
  routeInfo: HearingRouteInfo,
  pressed: boolean,
  evidence?: Evidence,
): {
  pressure: string;
  record: string;
  timing: string;
  checks: Array<{ label: string; done: boolean }>;
} {
  const hasContradiction = Boolean(routeInfo.contradiction);
  const needsPress = routeInfo.status === 'needs-press';
  const locked = routeInfo.status === 'locked';
  const cleared = routeInfo.status === 'cleared';
  return {
    pressure: pressed
      ? 'The testimony has been narrowed; compare it with the record.'
      : needsPress
        ? 'Press first to turn the broad claim into an attackable line.'
        : 'The current line can be evaluated from the visible record state.',
    record: evidence
      ? getEvidenceFactPoint(evidence.id, evidence.detail)
      : hasContradiction
        ? 'The matching record is not available in the case file yet.'
        : 'This line mainly sets movement and opportunity context.',
    timing: evidence
      ? 'No timeline event is pinned to this record yet.'
      : 'Use this line to decide which later contradiction can be attacked.',
    checks: [
      { label: 'claim', done: true },
      { label: 'pressure', done: !needsPress || pressed },
      { label: 'record', done: Boolean(evidence) },
      { label: 'order', done: !locked },
      { label: 'cleared', done: cleared },
    ],
  };
}

function getHearingLedgerHeadline(status: HearingLedgerStatus): string {
  switch (status) {
    case 'ready':
      return '次の矛盾を示せる';
    case 'missing':
      return '必要な記録を先に集める';
    case 'locked':
      return '先に発言を狭める';
    case 'cleared':
      return 'この矛盾は突破済み';
  }
}

function getHearingLedgerDetail(step: {
  contradiction: HearingContradiction;
  evidence?: Evidence;
  statement?: HearingStatement;
  status: HearingLedgerStatus;
}) {
  if (step.status === 'ready') {
    return `${step.evidence?.name ?? '記録'}を示し、${getContradictionAxis(step.contradiction.statementId)}の矛盾を突く。`;
  }
  if (step.status === 'missing') {
    return `${step.evidence?.name ?? '必要な記録'}を事件ファイルに入れてから戻る。`;
  }
  if (step.status === 'locked') {
    return getHearingLedgerRequirement(step.contradiction);
  }
  return `${step.statement?.speaker ?? '証言者'}の説明は、この論点では崩れている。`;
}

function getHearingLedgerRequirement(contradiction: HearingContradiction): string {
  const required = contradiction.requiresFlags ?? [];
  if (required.includes('pressed_no_edit')) {
    return '編集権限の説明を詳しく聞き、発言を証拠に当てられる形へ狭める。';
  }
  if (required.includes('hearing_pc_contradiction')) {
    return '先に編集機会の否定を崩す。そこで初めて怖くなった時期を詰められる。';
  }
  if (required.includes('pressed_later_fear')) {
    return '怖くなった時期を詳しく聞き、削除直後の記録とぶつける。';
  }
  return '前提となる発言か証拠を先に確認する。';
}

function getHearingLedgerCardDetail(step: {
  contradiction: HearingContradiction;
  evidence?: Evidence;
  statement?: HearingStatement;
  status: HearingLedgerStatus;
}) {
  if (step.status === 'cleared') {
    return step.contradiction.log ?? 'この矛盾は突破済み。';
  }
  if (step.status === 'ready') {
    return getContradictionVerdict(step.contradiction.statementId);
  }
  if (step.status === 'missing') {
    return `${step.evidence?.name ?? '必要な証拠'}があれば、この発言を記録に当てられる。`;
  }
  return getHearingLedgerRequirement(step.contradiction);
}

function getHearingLedgerStatusLabel(status: HearingLedgerStatus) {
  switch (status) {
    case 'cleared':
      return '突破済み';
    case 'ready':
      return '指摘可能';
    case 'missing':
      return '証拠待ち';
    case 'locked':
      return '前提待ち';
  }
}

function HearingAmendmentPanel({
  state,
  statement,
  evidenceById,
  onOpenEvidence,
}: {
  state: GameState;
  statement?: HearingStatement;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  if (!statement?.pressText) return null;

  const pressed = Boolean(statement.pressFlag && state.flags.includes(statement.pressFlag));
  const candidate = getHearingPressEvidenceCandidate(statement.id);
  const candidateEvidence = candidate.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const sequence = getHearingAmendmentSequence(statement, pressed, candidateEvidence, candidate.reason);

  return (
    <aside
      className={`hearing-amendment status-${pressed ? 'pressed' : 'pending'}`}
      aria-label="証言更新"
    >
      <div className="hearing-amendment-heading">
        <div>
          <span>証言更新</span>
          <strong>{pressed ? '詳しく聞いて発言が絞れた' : 'まだ追及できる余地がある'}</strong>
          <p>
            {pressed
              ? '押した後の補足を、次に当てる記録と一緒に残す。'
              : '詳しく聞くと、曖昧な説明が証拠へ当てられる形に狭まる。'}
          </p>
        </div>
        <em>{pressed ? '更新済み' : '未更新'}</em>
      </div>
      <div className="hearing-amendment-sequence" aria-label="ゆさぶりの流れ">
        {sequence.map((step, index) => (
          <section className="hearing-amendment-sequence-step" key={step.label}>
            <em>{String(index + 1).padStart(2, '0')}</em>
            <div>
              <span>{step.label}</span>
              <p>{step.text}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="hearing-amendment-grid">
        <section>
          <span>元の発言</span>
          <p>{statement.text}</p>
        </section>
        <section>
          <span>追及後の補足</span>
          <p>
            {pressed
              ? statement.pressText
              : 'まだ引き出していない。詳しく聞くと、発言の弱点が記録と照合しやすくなる。'}
          </p>
        </section>
        <section>
          <span>次に当てる記録</span>
          {pressed && candidateEvidence.length ? (
            <div className="hearing-amendment-evidence">
              {candidateEvidence.map((item) => (
                <button type="button" key={item.id} onClick={() => onOpenEvidence(item.id)}>
                  <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  <strong>{item.name}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>{pressed ? candidate.reason : '追及後に候補証拠を表示する。'}</p>
          )}
          {pressed && candidate.reason ? <small>{candidate.reason}</small> : null}
        </section>
      </div>
    </aside>
  );
}

function getHearingAmendmentSequence(
  statement: HearingStatement,
  pressed: boolean,
  candidateEvidence: Evidence[],
  candidateReason: string,
) {
  return [
    {
      label: 'QUESTION',
      text: pressed ? statement.text : 'この発言を詳しく聞いて、逃げ道を狭める。',
    },
    {
      label: 'ANSWER',
      text: pressed
        ? statement.pressText ?? statement.note
        : 'まだ補足を引き出していない。詳しく聞くで証言を更新する。',
    },
    {
      label: 'NEXT RECORD',
      text: pressed
        ? candidateEvidence.map((item) => item.name).join(' / ') || candidateReason
        : '更新後に候補証拠が表示される。',
    },
  ];
}

function HearingCuePanel({
  cue,
  charactersById,
  evidenceById,
  onOpenEvidence,
}: {
  cue: HearingCue;
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const speaker = cue.speakerId ? charactersById.get(cue.speakerId) : undefined;
  const evidence = cue.evidenceId ? evidenceById.get(cue.evidenceId) : undefined;
  const candidateEvidence =
    cue.candidateEvidenceIds
      ?.map((id) => evidenceById.get(id))
      .filter((item): item is Evidence => Boolean(item)) ?? [];

  return (
    <aside className={`hearing-cue tone-${cue.tone}`} role="status" aria-live="polite">
      <div className="hearing-cue-heading">
        <img src={getCharacterPortrait(speaker, cue.tone)} alt="" />
        <div>
          <span>{cue.subtitle}</span>
          <strong>{cue.title}</strong>
        </div>
      </div>
      <div className="hearing-cue-grid">
        <section>
          <span>押した発言</span>
          <p>{cue.statement}</p>
        </section>
        <section>
          <span>{cue.tone === 'damage' ? '弱い理由' : '引き出した反応'}</span>
          <p>{cue.response}</p>
        </section>
        <section>
          <span>次の一手</span>
          <p>{cue.nextAction}</p>
        </section>
      </div>
      {candidateEvidence.length ? (
        <div className="hearing-cue-candidates">
          <span>次に当てる証拠候補</span>
          <p>{cue.candidateReason}</p>
          <div>
            {candidateEvidence.map((item) => (
              <button
                className="hearing-cue-candidate"
                key={item.id}
                type="button"
                onClick={() => onOpenEvidence(item.id)}
              >
                <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                {item.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {cue.tone === 'damage' ? (
        <>
          <HearingPenaltyPanel cue={cue} candidateEvidence={candidateEvidence} />
          <HearingRecoveryNote
            cue={cue}
            candidateEvidence={candidateEvidence}
            onOpenEvidence={onOpenEvidence}
          />
        </>
      ) : null}
      {evidence ? (
        <div className="hearing-cue-evidence">
          <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
          <span>{evidence.name}</span>
        </div>
      ) : null}
    </aside>
  );
}

function HearingPenaltyPanel({
  cue,
  candidateEvidence,
}: {
  cue: HearingCue;
  candidateEvidence: Evidence[];
}) {
  const nextRecord = candidateEvidence[0]?.name ?? '証言と記録の対応';
  return (
    <aside className="hearing-penalty-panel" aria-label="裁判長ペナルティ">
      <div className="hearing-penalty-ruling">
        <span>JUDGE WARNING</span>
        <strong>その指摘は採用できません</strong>
        <p>発言のどこが、どの記録と食い違うのかを具体的に示しなさい。</p>
      </div>
      <div className="hearing-penalty-grid">
        <section>
          <span>PENALTY</span>
          <strong>-1</strong>
          <p>信用が下がった。次の提示は記録の役割を確認してから行う。</p>
        </section>
        <section>
          <span>MISS POINT</span>
          <strong>{cue.response}</strong>
          <p>{cue.statement}</p>
        </section>
        <section>
          <span>RETURN TO RECORD</span>
          <strong>{nextRecord}</strong>
          <p>{cue.candidateReason ?? cue.nextAction}</p>
        </section>
      </div>
    </aside>
  );
}

function HearingRecoveryNote({
  cue,
  candidateEvidence,
  onOpenEvidence,
}: {
  cue: HearingCue;
  candidateEvidence: Evidence[];
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const primaryEvidence = candidateEvidence[0];
  return (
    <aside className="hearing-recovery-note" aria-label="対決リカバリーノート">
      <div className="hearing-recovery-heading">
        <span>読み直しノート</span>
        <strong>弱い指摘を、次の一手に変える</strong>
        <p>誤答後は信用を失うだけで終わらせず、発言の弱点と記録の当て先を読み直す。</p>
      </div>
      <div className="hearing-recovery-grid">
        <section>
          <span>戻る証言</span>
          <p>{cue.statement}</p>
        </section>
        <section>
          <span>外れた理由</span>
          <p>{cue.response}</p>
        </section>
        <section>
          <span>読み直す記録</span>
          {primaryEvidence ? (
            <button type="button" onClick={() => onOpenEvidence(primaryEvidence.id)}>
              <img src={primaryEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <strong>{primaryEvidence.name}</strong>
            </button>
          ) : (
            <p>{cue.candidateReason ?? cue.nextAction}</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function HearingSequencePanel({
  state,
  activeStatementId,
  evidenceById,
  onSelectStatement,
  onOpenEvidence,
}: {
  state: GameState;
  activeStatementId?: string;
  evidenceById: Map<string, Evidence>;
  onSelectStatement: (statementId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const contradictionCount = episode.hearing.contradictions.length;
  const clearedCount = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;

  return (
    <aside className="hearing-sequence-panel" aria-label="testimony sequence">
      <div className="hearing-sequence-heading">
        <div>
          <span>TESTIMONY SEQUENCE</span>
          <strong>{getHearingSequenceTitle(clearedCount, contradictionCount)}</strong>
        </div>
        <em>{clearedCount}/{contradictionCount}</em>
      </div>
      <div className="hearing-sequence-list">
        {episode.hearing.statements.map((statement, index) => {
          const routeInfo = getHearingRouteInfo(state, statement);
          const evidence = routeInfo.contradiction
            ? evidenceById.get(routeInfo.contradiction.evidenceId)
            : undefined;
          const active = statement.id === activeStatementId;

          return (
            <article
              className={[
                'hearing-sequence-item',
                `status-${routeInfo.status}`,
                active ? 'active' : '',
              ].join(' ')}
              key={statement.id}
            >
              <button type="button" onClick={() => onSelectStatement(statement.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{getContradictionAxis(statement.id)}</strong>
                <small>{routeInfo.label}</small>
              </button>
              <p>{routeInfo.detail}</p>
              {evidence ? (
                <button
                  className="hearing-sequence-evidence"
                  type="button"
                  onClick={() => onOpenEvidence(evidence.id)}
                >
                  <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  <span>{evidence.name}</span>
                </button>
              ) : (
                <em>{routeInfo.cue}</em>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function getHearingSequenceTitle(clearedCount: number, total: number): string {
  if (clearedCount >= total) return 'All contradictions are broken';
  if (clearedCount > 0) return 'Press the remaining weak line';
  return 'Find the first line that can be moved';
}

function HearingRoutePanel({
  routeInfo,
  selectedEvidence,
}: {
  routeInfo: HearingRouteInfo;
  selectedEvidence?: Evidence;
}) {
  const evidenceInfo = getHearingEvidenceComparison(routeInfo, selectedEvidence);

  return (
    <div className="hearing-route-grid" aria-label="対決進行">
      <article className={`hearing-route-card status-${routeInfo.status}`}>
        <span>現在の証言</span>
        <strong>{routeInfo.label}</strong>
        <p>{routeInfo.detail}</p>
      </article>
      <article className="hearing-route-card">
        <span>読むべき記録</span>
        <strong>時刻と機会</strong>
        <p>{routeInfo.cue}</p>
      </article>
      <article className={`hearing-route-card status-${evidenceInfo.status}`}>
        <span>選択中の証拠</span>
        <strong>{evidenceInfo.label}</strong>
        <p>{evidenceInfo.detail}</p>
      </article>
    </div>
  );
}

function HearingCaseNote({
  state,
  statement,
  evidence,
  routeInfo,
}: {
  state: GameState;
  statement?: HearingStatement;
  evidence?: Evidence;
  routeInfo: HearingRouteInfo;
}) {
  const status = getHearingSubmitPreviewStatus(routeInfo, statement, evidence);
  const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
  const expectedEvidence = routeInfo.contradiction?.evidenceId;
  const evidenceMatched = Boolean(evidence && expectedEvidence && evidence.id === expectedEvidence);
  const steps = [
    {
      label: '証言',
      value: statement ? getContradictionAxis(statement.id) : '証言を選ぶ',
      state: statement ? 'met' : 'missing',
    },
    {
      label: '前提',
      value: getHearingCaseNotePrerequisite(routeInfo, pressed),
      state:
        routeInfo.status === 'ready' || routeInfo.status === 'cleared'
          ? 'met'
          : routeInfo.status === 'needs-press' || routeInfo.status === 'locked'
            ? 'blocked'
            : 'warning',
    },
    {
      label: '証拠',
      value: evidence ? evidence.name : '証拠を選ぶ',
      state: evidence ? 'met' : 'missing',
    },
    {
      label: '照合',
      value: getHearingCaseNoteMatch(status, evidenceMatched),
      state: evidenceMatched ? 'met' : evidence ? 'warning' : 'missing',
    },
  ];

  return (
    <aside className={`hearing-case-note status-${status}`} aria-label="対決ケースノート">
      <div className="hearing-case-note-heading">
        <div>
          <span>ケースノート</span>
          <strong>{getHearingCaseNoteHeadline(status)}</strong>
          <p>{getHearingCaseNoteDetail(status, routeInfo)}</p>
        </div>
        <em>{getHearingCaseNoteLabel(status)}</em>
      </div>
      <div className="hearing-case-note-steps">
        {steps.map((step) => (
          <section className={`hearing-case-note-step status-${step.state}`} key={step.label}>
            <span>{step.label}</span>
            <p>{step.value}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}

function getHearingCaseNoteHeadline(status: HearingSubmitPreviewStatus): string {
  switch (status) {
    case 'ready':
      return '今なら矛盾を示せる';
    case 'mismatch':
      return '証拠の当て先がずれている';
    case 'blocked':
      return '先に証言を絞る';
    case 'missing':
      return '証拠を選ぶ';
    case 'cleared':
      return 'この矛盾は整理済み';
    default:
      return '証言と証拠を並べる';
  }
}

function getHearingCaseNoteDetail(
  status: HearingSubmitPreviewStatus,
  routeInfo: HearingRouteInfo,
): string {
  if (status === 'ready') {
    return '証言の主張、記録の時刻、選んだ証拠が同じ論点に集まっている。';
  }
  if (status === 'mismatch') {
    return '証拠は重要だが、この発言の弱点とは別の論点を指している。';
  }
  if (status === 'blocked') {
    return routeInfo.status === 'needs-press'
      ? '詳しく聞くことで、証拠を当てられる発言へ変わる。'
      : routeInfo.detail;
  }
  if (status === 'cleared') {
    return '同じ組み合わせを繰り返すより、未解決の証言へ移る。';
  }
  if (status === 'missing') {
    return '発言の弱点を読んでから、対応する記録を選ぶ。';
  }
  return '証言送りと証拠選択で、矛盾の軸を作る。';
}

function getHearingCaseNoteLabel(status: HearingSubmitPreviewStatus): string {
  switch (status) {
    case 'ready':
      return '提出可';
    case 'mismatch':
      return '再照合';
    case 'blocked':
      return '保留';
    case 'missing':
      return '未選択';
    case 'cleared':
      return '済';
    default:
      return '準備';
  }
}

function getHearingCaseNotePrerequisite(routeInfo: HearingRouteInfo, pressed: boolean): string {
  if (routeInfo.status === 'needs-press') return '詳しく聞く';
  if (routeInfo.status === 'locked') return routeInfo.detail;
  if (routeInfo.status === 'cleared') return '突破済み';
  if (routeInfo.contradiction?.requiresFlags?.length && !pressed) return '前段の矛盾を確認';
  return '提出可能';
}

function getHearingCaseNoteMatch(
  status: HearingSubmitPreviewStatus,
  evidenceMatched: boolean,
): string {
  if (evidenceMatched) return '発言の弱点に届く';
  if (status === 'mismatch') return '論点が違う';
  if (status === 'blocked') return 'まだ当てられない';
  return '照合待ち';
}

function getHearingEvidenceComparison(
  routeInfo: HearingRouteInfo,
  selectedEvidence?: Evidence,
): { status: 'context' | 'ready' | 'locked' | 'cleared'; label: string; detail: string } {
  if (!selectedEvidence) {
    return {
      status: 'context',
      label: '未選択',
      detail: '証拠を選ぶと、この発言との噛み合わせを確認できる。',
    };
  }

  if (!routeInfo.contradiction) {
    return {
      status: 'context',
      label: selectedEvidence.name,
      detail: 'この発言は背景確認用。証拠で崩す核心発言を探す。',
    };
  }

  const matches = selectedEvidence.id === routeInfo.contradiction.evidenceId;

  if (!matches) {
    return {
      status: 'locked',
      label: '照合外',
      detail: `${selectedEvidence.name}では、この発言の弱点に届いていない。`,
    };
  }

  if (routeInfo.status === 'ready') {
    return {
      status: 'ready',
      label: '矛盾に届く',
      detail: `${selectedEvidence.name}は、この発言の弱点に触れている。`,
    };
  }

  if (routeInfo.status === 'cleared') {
    return {
      status: 'cleared',
      label: '突破済み',
      detail: `${selectedEvidence.name}で、この発言の説明は崩れている。`,
    };
  }

  return {
    status: 'locked',
    label: '前提待ち',
    detail: '証拠は近いが、先に詳しく聞くか前段の矛盾を崩す必要がある。',
  };
}

function ConfrontationDock({
  state,
  statement,
  evidence,
  onOpenEvidence,
}: {
  state: GameState;
  statement?: HearingStatement;
  evidence?: Evidence;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const relatedTimeline = evidence
    ? episode.timeline.filter((event) => event.evidenceIds?.includes(evidence.id))
    : [];
  const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
  const routeInfo = getHearingRouteInfo(state, statement);
  const insight = getConfrontationInsight(routeInfo, statement, evidence, relatedTimeline);
  const submitPreview = getHearingSubmitPreview(state, routeInfo, statement, evidence);

  return (
    <aside className="confrontation-dock" aria-label="対決支援">
      <div className="dock-heading">
        <p>対決支援</p>
        <h3>発言と証拠を同じ机に置く</h3>
      </div>
      <div className={`dock-comparison status-${insight.status}`} aria-label="照合レーン">
        <section>
          <span>比較軸</span>
          <strong>{insight.label}</strong>
          <p>{insight.timelinePoint}</p>
        </section>
        <section>
          <span>発言の主張</span>
          <p>{insight.statementPoint}</p>
        </section>
        <section>
          <span>記録の示す事実</span>
          <p>{insight.evidencePoint}</p>
        </section>
        <section>
          <span>照合結果</span>
          <p>{insight.verdict}</p>
        </section>
      </div>
      <CourtroomObjectionCue preview={submitPreview} statement={statement} evidence={evidence} />
      <HearingSubmitPreviewPanel preview={submitPreview} />
      <div className="dock-grid">
        <section>
          <span>選択中の発言</span>
          {statement ? (
            <>
              <strong>{statement.speaker}</strong>
              <p>{statement.text}</p>
              <small>{pressed ? '詳しく確認済み' : statement.note}</small>
            </>
          ) : (
            <p className="empty-text">まず崩したい発言を選ぶ。</p>
          )}
        </section>
        <section>
          <span>示す証拠</span>
          {evidence ? (
            <>
              <div className="dock-evidence">
                <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <div>
                  <strong>{evidence.name}</strong>
                  <p>{evidence.description}</p>
                  <button
                    className="inline-detail-button"
                    type="button"
                    onClick={() => onOpenEvidence(evidence.id)}
                  >
                    詳しく読む
                  </button>
                </div>
              </div>
              <small>{evidence.detail}</small>
            </>
          ) : (
            <p className="empty-text">証拠を選ぶと要点がここに出る。</p>
          )}
        </section>
        <section>
          <span>時系列候補</span>
          {relatedTimeline.length ? (
            <ol className="dock-timeline">
              {relatedTimeline.map((event) => (
                <li key={event.id}>
                  <time>{event.time}</time>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-text">証拠に対応する時刻があれば表示する。</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function CourtroomObjectionCue({
  preview,
  statement,
  evidence,
}: {
  preview: HearingSubmitPreview;
  statement?: HearingStatement;
  evidence?: Evidence;
}) {
  if (preview.status !== 'ready') return null;

  return (
    <section className="courtroom-objection-cue" aria-label="異議あり準備完了">
      <div className="courtroom-objection-cue-heading">
        <div>
          <span>OBJECTION READY</span>
          <strong>異議あり!</strong>
        </div>
        <em>{preview.label}</em>
      </div>
      <p>
        {statement?.speaker ?? '証人'}の発言に、{evidence?.name ?? 'この証拠'}を突きつけられる。
      </p>
      <div className="courtroom-objection-meter" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}

function HearingSubmitPreviewPanel({ preview }: { preview: HearingSubmitPreview }) {
  return (
    <section className={`hearing-submit-preview status-${preview.status}`} aria-label="提出前チェック">
      <div className="hearing-submit-heading">
        <div>
          <span>提出前チェック</span>
          <strong>{preview.headline}</strong>
          <p>{preview.detail}</p>
        </div>
        <em>{preview.label}</em>
      </div>
      <div className="hearing-submit-checks">
        {preview.checks.map((check) => (
          <article className={`status-${check.status}`} key={check.label}>
            <span>{check.label}</span>
            <p>{check.detail}</p>
          </article>
        ))}
      </div>
      <p className="hearing-submit-action">
        <span>次の操作</span>
        {preview.action}
      </p>
    </section>
  );
}

function getHearingSubmitPreview(
  state: GameState,
  routeInfo: HearingRouteInfo,
  statement?: HearingStatement,
  evidence?: Evidence,
): HearingSubmitPreview {
  const status = getHearingSubmitPreviewStatus(routeInfo, statement, evidence);
  const hasCoreContradiction = Boolean(routeInfo.contradiction);
  const evidenceMatches = Boolean(
    evidence && routeInfo.contradiction && evidence.id === routeInfo.contradiction.evidenceId,
  );
  const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
  const copy = getHearingSubmitPreviewCopy(status, routeInfo, hasCoreContradiction);

  return {
    ...copy,
    status,
    checks: [
      {
        label: '発言',
        detail: statement
          ? hasCoreContradiction
            ? getContradictionAxis(statement.id)
            : '背景を固める発言'
          : '証言を1件選ぶ',
        status: statement ? 'met' : 'missing',
      },
      {
        label: '証拠',
        detail: evidence ? evidence.name : '示す証拠を選ぶ',
        status: evidence ? 'met' : 'missing',
      },
      {
        label: '前提',
        detail: getHearingSubmitPrerequisiteLabel(routeInfo, pressed, hasCoreContradiction),
        status:
          routeInfo.status === 'ready' || routeInfo.status === 'cleared'
            ? 'met'
            : routeInfo.status === 'needs-press' || routeInfo.status === 'locked'
              ? 'blocked'
              : hasCoreContradiction
                ? 'warning'
                : 'warning',
      },
      {
        label: '照合',
        detail: getHearingSubmitMatchLabel(routeInfo, evidence, evidenceMatches),
        status: evidenceMatches ? 'met' : evidence ? 'warning' : 'missing',
      },
    ],
  };
}

function getHearingSubmitPreviewStatus(
  routeInfo: HearingRouteInfo,
  statement?: HearingStatement,
  evidence?: Evidence,
): HearingSubmitPreviewStatus {
  if (!statement) return 'empty';
  if (routeInfo.status === 'cleared') return 'cleared';
  if (!evidence) return 'missing';
  if (!routeInfo.contradiction) return 'blocked';
  if (evidence.id !== routeInfo.contradiction.evidenceId) return 'mismatch';
  if (routeInfo.status === 'ready') return 'ready';
  return 'blocked';
}

function getHearingSubmitPreviewCopy(
  status: HearingSubmitPreviewStatus,
  routeInfo: HearingRouteInfo,
  hasCoreContradiction: boolean,
): Omit<HearingSubmitPreview, 'status' | 'checks'> {
  if (status === 'ready') {
    return {
      label: '提出可',
      headline: '今なら矛盾を示せる',
      detail: '発言の言い切りと記録の時刻が同じ比較軸に乗っている。',
      action: '矛盾を示すを押す前に、どの一文とどの記録が食い違うかを読み切る。',
    };
  }

  if (status === 'mismatch') {
    return {
      label: '照合外',
      headline: '証拠の当て所がずれている',
      detail: '選んだ証拠は近いが、この発言が言い切った点をまだ崩していない。',
      action: '証拠を替えるか、事件ファイルで時刻と争点を読み直す。',
    };
  }

  if (status === 'cleared') {
    return {
      label: '突破済み',
      headline: 'この矛盾は崩れている',
      detail: '同じ筋をもう一度出す必要はない。崩し順メモから次の発言へ移る。',
      action: '未突破の発言を選び直す。',
    };
  }

  if (status === 'missing') {
    return {
      label: '証拠待ち',
      headline: 'まだ提出できない',
      detail: '発言は選ばれている。どの証拠で主張を狭めるかを決める。',
      action: '示す証拠を選ぶ。',
    };
  }

  if (status === 'empty') {
    return {
      label: '発言待ち',
      headline: 'まず証言を読む',
      detail: '証言を1件ずつ送り、言い切りが記録とずれる部分を探す。',
      action: '前後の証言か証言マーカーから発言を選ぶ。',
    };
  }

  if (!hasCoreContradiction) {
    return {
      label: '背景確認',
      headline: 'ここは足場を固める発言',
      detail: '今は矛盾提示より、詳しく聞いて移動経路や前提を固める場面。',
      action: '詳しく聞くを押して、核心発言へ進む準備をする。',
    };
  }

  return {
    label: routeInfo.status === 'needs-press' ? '要ゆさぶり' : '前提待ち',
    headline: routeInfo.status === 'needs-press' ? '発言をまだ絞れていない' : '順番がまだ早い',
    detail:
      routeInfo.status === 'needs-press'
        ? '証拠は近いが、先に詳しく聞いて発言を証拠へ当てられる形にする必要がある。'
        : '前段の矛盾を崩すまで、相手にはまだ逃げ道が残っている。',
    action: routeInfo.status === 'needs-press' ? '詳しく聞くを押す。' : '崩し順メモから先の矛盾へ戻る。',
  };
}

function getHearingSubmitPrerequisiteLabel(
  routeInfo: HearingRouteInfo,
  pressed: boolean,
  hasCoreContradiction: boolean,
): string {
  if (routeInfo.status === 'ready') return '前提はそろっている';
  if (routeInfo.status === 'cleared') return '突破済み';
  if (routeInfo.status === 'needs-press') return pressed ? '追加質問済み' : '先に詳しく聞く';
  if (routeInfo.status === 'locked') return '前段の矛盾が未成立';
  return hasCoreContradiction ? '条件を読み直す' : '背景確認の発言';
}

function getHearingSubmitMatchLabel(
  routeInfo: HearingRouteInfo,
  evidence: Evidence | undefined,
  evidenceMatches: boolean,
): string {
  if (!evidence) return '証拠未選択';
  if (!routeInfo.contradiction) return '核心矛盾ではない';
  if (evidenceMatches) return '発言の弱点に届いている';
  return `${evidence.name}では主題がずれる`;
}

function getConfrontationInsight(
  routeInfo: HearingRouteInfo,
  statement: HearingStatement | undefined,
  evidence: Evidence | undefined,
  timeline: TimelineEvent[],
): {
  status: 'context' | 'ready' | 'locked' | 'cleared';
  label: string;
  statementPoint: string;
  evidencePoint: string;
  timelinePoint: string;
  verdict: string;
} {
  const statementPoint = statement
    ? getStatementClaimPoint(statement.id, statement.text)
    : '崩したい発言を選ぶ。';
  const evidencePoint = evidence
    ? getEvidenceFactPoint(evidence.id, evidence.detail)
    : '証拠を選ぶと、記録が示す事実を比較できる。';
  const timelinePoint = timeline.length
    ? timeline.map((event) => `${event.time} ${event.title}`).join(' / ')
    : 'まだ時刻に結びつく証拠が選ばれていない。';

  if (!statement) {
    return {
      status: 'context',
      label: '発言未選択',
      statementPoint,
      evidencePoint,
      timelinePoint,
      verdict: '証言を1件ずつ送り、主張が時刻や記録とずれる部分を探す。',
    };
  }

  if (!evidence) {
    return {
      status: routeInfo.status === 'cleared' ? 'cleared' : 'context',
      label: '証拠待ち',
      statementPoint,
      evidencePoint,
      timelinePoint,
      verdict: 'この発言に対して、どの記録なら主張を狭められるかを選ぶ。',
    };
  }

  if (!routeInfo.contradiction) {
    return {
      status: 'context',
      label: '背景確認',
      statementPoint,
      evidencePoint,
      timelinePoint,
      verdict: 'この発言は核心の矛盾より前の足場。詳しく聞いて移動経路を固める。',
    };
  }

  const matches = evidence.id === routeInfo.contradiction.evidenceId;
  if (!matches) {
    return {
      status: 'locked',
      label: '照合外',
      statementPoint,
      evidencePoint,
      timelinePoint,
      verdict: `${evidence.name}は、この発言が言い切った点とは主題がずれている。`,
    };
  }

  if (routeInfo.status === 'ready' || routeInfo.status === 'cleared') {
    return {
      status: routeInfo.status,
      label: getContradictionAxis(statement.id),
      statementPoint,
      evidencePoint,
      timelinePoint,
      verdict: getContradictionVerdict(statement.id),
    };
  }

  return {
    status: 'locked',
    label: '前提待ち',
    statementPoint,
    evidencePoint,
    timelinePoint,
    verdict:
      routeInfo.status === 'needs-press'
        ? '証拠は近いが、先に詳しく聞いて発言を証拠に当てられる形へ狭める。'
        : '証拠は近いが、前段の矛盾を崩すまで相手の逃げ道が残る。',
  };
}

function getStatementClaimPoint(statementId: string, fallback: string): string {
  switch (statementId) {
    case 'statement-visit-only':
      return '来訪目的を「書類を置いただけ」に限定し、会議室側への移動を弱めている。';
    case 'statement-no-edit':
      return '編集権限がないことを理由に、準備書面へ触れていないと説明している。';
    case 'statement-later-fear':
      return '一文を怖くなった時期を帰宅後へずらし、削除時点の認識を薄めている。';
    default:
      return fallback;
  }
}

function getEvidenceFactPoint(evidenceId: string, fallback: string): string {
  switch (evidenceId) {
    case 'visitor-log':
      return '23時39分、久世は受付から会議室前へ移動できる位置にいた。';
    case 'file-history':
      return '23時47分、ログイン済みの会議室共用PCで最新版が保存されている。';
    case 'scheduled-message':
      return '削除後すぐ、説明するための文章と送信予約が残っている。';
    case 'phone-note':
      return '問題の一文は裏付けが薄く、強みと同時に反撃材料にもなる。';
    case 'printer-log':
      return '23時12分の印刷は別件で、準備書面の削除とは直接つながらない。';
    default:
      return fallback;
  }
}

function getContradictionAxis(statementId: string): string {
  switch (statementId) {
    case 'statement-no-edit':
      return '権限ではなく機会';
    case 'statement-later-fear':
      return '怖くなった時期';
    default:
      return '発言と記録のずれ';
  }
}

function getContradictionVerdict(statementId: string): string {
  switch (statementId) {
    case 'statement-no-edit':
      return '発言は「編集できる立場」を否定するが、記録はログイン済み端末へ触れられた機会を示す。';
    case 'statement-later-fear':
      return '発言は帰宅後の心変わりにしているが、記録は削除直後に説明を準備していたことを示す。';
    default:
      return '発言の言い切った部分と、記録が示す時刻・内容が両立しない。';
  }
}

function HearingStatementOption({
  statement,
  checked,
  pressed,
  onSelect,
}: {
  statement: HearingStatement;
  checked: boolean;
  pressed: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={checked ? 'statement-option active' : 'statement-option'}>
      <input type="radio" name="hearing-statement" checked={checked} onChange={onSelect} />
      <span>
        <strong>{statement.speaker}</strong>
        {statement.text}
        <small>{statement.note}</small>
        {pressed ? <em>詳しく確認済み</em> : null}
      </span>
    </label>
  );
}

function DeductionPanel({
  finalUnlocked,
  answers,
  evidenceAnswers,
  evidence,
  feedback,
  onAnswer,
  onEvidenceAnswer,
  onSubmit,
  onOpenEvidence,
}: {
  finalUnlocked: boolean;
  answers: Record<string, string>;
  evidenceAnswers: Record<string, string>;
  evidence: Evidence[];
  feedback: DeductionFeedback;
  onAnswer: (answers: Record<string, string>) => void;
  onEvidenceAnswer: (answers: Record<string, string>) => void;
  onSubmit: () => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const [activeQuestionId, setActiveQuestionId] = useState(
    episode.deduction.questions[0]?.id ?? '',
  );
  const [stageFeedback, setStageFeedback] = useState<DeductionFeedback>({});
  const complete = episode.deduction.questions.every(
    (question) => answers[question.id] && evidenceAnswers[question.id],
  );
  const reviewedCount = Object.keys(feedback).length;
  const wrongCount = Object.values(feedback).filter((result) => result === 'wrong').length;
  const activeQuestionIndex = Math.max(
    0,
    episode.deduction.questions.findIndex((question) => question.id === activeQuestionId),
  );
  const activeQuestion = episode.deduction.questions[activeQuestionIndex] ?? episode.deduction.questions[0];
  const confirmedCount = episode.deduction.questions.filter(
    (question) => (feedback[question.id] ?? stageFeedback[question.id]) === 'correct',
  ).length;
  const clearStageFeedback = (questionId: string) => {
    setStageFeedback((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };
  const answerQuestion = (questionId: string, choiceId: string) => {
    clearStageFeedback(questionId);
    onAnswer({ ...answers, [questionId]: choiceId });
  };
  const answerQuestionEvidence = (questionId: string, evidenceId: string) => {
    clearStageFeedback(questionId);
    onEvidenceAnswer({ ...evidenceAnswers, [questionId]: evidenceId });
  };
  const goNextQuestion = () => {
    const nextQuestion =
      episode.deduction.questions[
        Math.min(activeQuestionIndex + 1, episode.deduction.questions.length - 1)
      ];
    if (nextQuestion) setActiveQuestionId(nextQuestion.id);
  };
  const moveActiveQuestion = (offset: number) => {
    const questions = episode.deduction.questions;
    if (!questions.length) return;
    const nextIndex = (activeQuestionIndex + offset + questions.length) % questions.length;
    const nextQuestion = questions[nextIndex];
    if (nextQuestion) setActiveQuestionId(nextQuestion.id);
  };
  const challengeActiveQuestion = () => {
    if (!activeQuestion) return;
    const correct =
      answers[activeQuestion.id] === activeQuestion.answer &&
      evidenceAnswers[activeQuestion.id] === activeQuestion.evidenceAnswer;
    setStageFeedback((current) => ({
      ...current,
      [activeQuestion.id]: correct ? 'correct' : 'wrong',
    }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!finalUnlocked || isKeyboardInputTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveActiveQuestion(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveActiveQuestion(1);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActiveQuestionId(episode.deduction.questions[0]?.id ?? '');
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActiveQuestionId(
          episode.deduction.questions[episode.deduction.questions.length - 1]?.id ?? '',
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeQuestionIndex, finalUnlocked]);

  return (
    <section className="action-stack">
      <PanelTitle icon={ShieldQuestion} title="最終推理" subtitle="削除者、理由、機会、証拠を整理する" />
      <p>{episode.deduction.intro}</p>
      {!finalUnlocked ? (
        <p className="empty-text">最終推理には、メール下書きと更新履歴を結びつける必要がある。</p>
      ) : (
        <>
          {reviewedCount ? (
            <div className={wrongCount ? 'deduction-review damage' : 'deduction-review success'}>
              <strong>{wrongCount ? '結論を再検討する' : '結論は記録と整合する'}</strong>
              <span>
                {wrongCount
                  ? `${wrongCount}件の論点が証拠と合っていない。赤い項目を直して、もう一度結論を出す。`
                  : '4つの論点が一本につながった。'}
              </span>
            </div>
          ) : null}
          {wrongCount ? (
            <DeductionMissBoard
              answers={answers}
              evidenceAnswers={evidenceAnswers}
              evidence={evidence}
              feedback={feedback}
              onSelectQuestion={setActiveQuestionId}
              onOpenEvidence={onOpenEvidence}
            />
          ) : null}
          {activeQuestion ? (
            <DeductionArgumentStage
              question={activeQuestion}
              questionIndex={activeQuestionIndex}
              questionCount={episode.deduction.questions.length}
              confirmedCount={confirmedCount}
              value={answers[activeQuestion.id]}
              evidenceValue={evidenceAnswers[activeQuestion.id]}
              evidence={evidence}
              feedback={feedback[activeQuestion.id]}
              stageFeedback={stageFeedback[activeQuestion.id]}
              onSelect={(choiceId) => answerQuestion(activeQuestion.id, choiceId)}
              onEvidenceSelect={(evidenceId) =>
                answerQuestionEvidence(activeQuestion.id, evidenceId)
              }
              onChallenge={challengeActiveQuestion}
              onNext={goNextQuestion}
              onOpenEvidence={onOpenEvidence}
            />
          ) : null}
          <DeductionBrief
            activeQuestionId={activeQuestion?.id}
            answers={answers}
            evidenceAnswers={evidenceAnswers}
            evidence={evidence}
            feedback={feedback}
            stageFeedback={stageFeedback}
            onSelectQuestion={setActiveQuestionId}
          />
          <FinalEvidenceChain
            activeQuestionId={activeQuestion?.id}
            evidence={evidence}
            evidenceAnswers={evidenceAnswers}
            feedback={feedback}
            stageFeedback={stageFeedback}
            onSelectQuestion={setActiveQuestionId}
            onOpenEvidence={onOpenEvidence}
          />
          <div className="deduction-stepper" aria-label="最終推理の論点">
            {episode.deduction.questions.map((question, index) => {
              const answered = Boolean(answers[question.id] && evidenceAnswers[question.id]);
              const result = feedback[question.id] ?? stageFeedback[question.id];
              return (
                <button
                  className={[
                    'deduction-step',
                    activeQuestion?.id === question.id ? 'active' : '',
                    answered ? 'answered' : '',
                    result ? `review-${result}` : '',
                  ].join(' ')}
                  type="button"
                  key={question.id}
                  onClick={() => setActiveQuestionId(question.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{question.stageLabel ?? question.prompt}</strong>
                </button>
              );
            })}
          </div>
          <DeductionFinalArgumentPanel
            answers={answers}
            evidenceAnswers={evidenceAnswers}
            evidence={evidence}
            feedback={feedback}
            stageFeedback={stageFeedback}
            onSelectQuestion={setActiveQuestionId}
            onOpenEvidence={onOpenEvidence}
          />
          <FinalSummationPanel
            answers={answers}
            evidenceAnswers={evidenceAnswers}
            evidence={evidence}
            onSelectQuestion={setActiveQuestionId}
            onOpenEvidence={onOpenEvidence}
          />
          <div className="deduction-question-list">
            {episode.deduction.questions.map((question) => (
              <QuestionBlock
                key={question.id}
                question={question}
                value={answers[question.id]}
                evidenceValue={evidenceAnswers[question.id]}
                evidence={evidence}
                feedback={feedback[question.id]}
                onSelect={(choiceId) => answerQuestion(question.id, choiceId)}
                onEvidenceSelect={(evidenceId) =>
                  answerQuestionEvidence(question.id, evidenceId)
                }
                onOpenEvidence={onOpenEvidence}
              />
            ))}
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!complete}
            onClick={onSubmit}
          >
            結論を出す
          </button>
        </>
      )}
    </section>
  );
}

function DeductionBrief({
  activeQuestionId,
  answers,
  evidenceAnswers,
  evidence,
  feedback,
  stageFeedback,
  onSelectQuestion,
}: {
  activeQuestionId?: string;
  answers: Record<string, string>;
  evidenceAnswers: Record<string, string>;
  evidence: Evidence[];
  feedback: DeductionFeedback;
  stageFeedback: DeductionFeedback;
  onSelectQuestion: (questionId: string) => void;
}) {
  const selectedCount = episode.deduction.questions.filter(
    (question) => answers[question.id] && evidenceAnswers[question.id],
  ).length;
  const correctCount = episode.deduction.questions.filter(
    (question) => (feedback[question.id] ?? stageFeedback[question.id]) === 'correct',
  ).length;
  const wrongQuestion = episode.deduction.questions.find(
    (question) => (feedback[question.id] ?? stageFeedback[question.id]) === 'wrong',
  );
  const missingQuestion = episode.deduction.questions.find(
    (question) => !answers[question.id] || !evidenceAnswers[question.id],
  );
  const heading = wrongQuestion
    ? '赤い論点を戻す'
    : missingQuestion
      ? '証拠の鎖をつなぐ'
      : '提出できる鎖が見えた';
  const detail = wrongQuestion
    ? `${wrongQuestion.stageLabel ?? wrongQuestion.prompt}の結論か証拠が、相手の反論をまだ崩せていない。`
    : missingQuestion
      ? `${missingQuestion.stageLabel ?? missingQuestion.prompt}に、結論と根拠証拠をそろえる。`
      : '来訪、理由、機会、削除後の説明準備が一本の流れになっている。';

  return (
    <section className="deduction-brief" aria-label="最終推理メモ">
      <div className="deduction-brief-heading">
        <div>
          <span>反論設計メモ</span>
          <strong>{heading}</strong>
          <p>{detail}</p>
        </div>
        <em>
          {selectedCount}/{episode.deduction.questions.length} 選択
          <small>{correctCount}確認済み</small>
        </em>
      </div>
      <div className="deduction-brief-grid">
        {episode.deduction.questions.map((question, index) => {
          const choice = question.choices.find((item) => item.id === answers[question.id]);
          const selectedEvidence = evidence.find((item) => item.id === evidenceAnswers[question.id]);
          const result = feedback[question.id] ?? stageFeedback[question.id];
          const ready = Boolean(choice && selectedEvidence);
          return (
            <button
              className={[
                'deduction-brief-card',
                activeQuestionId === question.id ? 'active' : '',
                ready ? 'ready' : 'missing',
                result ? `review-${result}` : '',
              ].join(' ')}
              type="button"
              key={question.id}
              onClick={() => onSelectQuestion(question.id)}
            >
              <span>{String(index + 1).padStart(2, '0')} {question.stageLabel ?? question.prompt}</span>
              <strong>{choice?.label ?? '結論未選択'}</strong>
              {selectedEvidence ? (
                <em>
                  <img src={selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  {selectedEvidence.name}
                </em>
              ) : (
                <p>証拠未選択</p>
              )}
              <small>{getDeductionBriefRole(question.id, result, ready)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DeductionFinalArgumentPanel({
  answers,
  evidenceAnswers,
  evidence,
  feedback,
  stageFeedback,
  onSelectQuestion,
  onOpenEvidence,
}: {
  answers: Record<string, string>;
  evidenceAnswers: Record<string, string>;
  evidence: Evidence[];
  feedback: DeductionFeedback;
  stageFeedback: DeductionFeedback;
  onSelectQuestion: (questionId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  type FinalArgumentStatus = 'correct' | 'wrong' | 'ready' | 'missing';
  const rows = episode.deduction.questions.map((question) => {
    const choice = question.choices.find((item) => item.id === answers[question.id]);
    const selectedEvidence = evidenceById.get(evidenceAnswers[question.id]);
    const result = feedback[question.id] ?? stageFeedback[question.id];
    const complete = Boolean(choice && selectedEvidence);
    const correct =
      answers[question.id] === question.answer &&
      evidenceAnswers[question.id] === question.evidenceAnswer;
    const status: FinalArgumentStatus =
      result === 'wrong'
        ? 'wrong'
        : result === 'correct' || correct
          ? 'correct'
          : complete
            ? 'ready'
            : 'missing';

    return { question, choice, selectedEvidence, status };
  });
  const completeCount = rows.filter((row) => row.status !== 'missing').length;
  const correctCount = rows.filter((row) => row.status === 'correct').length;
  const wrongCount = rows.filter((row) => row.status === 'wrong').length;
  const ready = completeCount === rows.length && wrongCount === 0;

  return (
    <aside className={`deduction-final-argument status-${ready ? 'ready' : wrongCount ? 'wrong' : 'building'}`} aria-label="final argument">
      <div className="deduction-final-heading">
        <div>
          <span>FINAL ARGUMENT</span>
          <strong>{getFinalArgumentTitle(ready, wrongCount, completeCount)}</strong>
          <p>{getFinalArgumentDetail(ready, wrongCount, completeCount, rows.length)}</p>
        </div>
        <em>{completeCount}/{rows.length}</em>
      </div>
      <div className="deduction-final-meter" aria-hidden="true">
        {rows.map((row) => (
          <span className={`status-${row.status}`} key={row.question.id} />
        ))}
      </div>
      <div className="deduction-final-grid">
        {rows.map((row, index) => (
          <article className={`status-${row.status}`} key={row.question.id}>
            <button type="button" onClick={() => onSelectQuestion(row.question.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{row.question.stageLabel ?? row.question.prompt}</strong>
              <small>{getFinalArgumentStatusLabel(row.status)}</small>
            </button>
            <p>{row.choice?.label ?? 'Conclusion missing'}</p>
            {row.selectedEvidence ? (
              <button
                className="deduction-final-evidence"
                type="button"
                onClick={() => onOpenEvidence(row.selectedEvidence!.id)}
              >
                <img src={row.selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <span>{row.selectedEvidence.name}</span>
              </button>
            ) : (
              <em>Evidence missing</em>
            )}
          </article>
        ))}
      </div>
      <p className="deduction-final-note">
        {correctCount}/{rows.length} confirmed. The final submit should only happen when each point has both a conclusion and a supporting record.
      </p>
    </aside>
  );
}

function getFinalArgumentTitle(ready: boolean, wrongCount: number, completeCount: number): string {
  if (ready) return 'The argument is ready to submit';
  if (wrongCount) return 'One link still contradicts the record';
  if (completeCount > 0) return 'The argument is taking shape';
  return 'Build the closing theory';
}

function getFinalArgumentDetail(
  ready: boolean,
  wrongCount: number,
  completeCount: number,
  total: number,
): string {
  if (ready) return 'All four points have a conclusion and record. Review the chain once, then submit.';
  if (wrongCount) return 'A reviewed point is still wrong. Open that card and repair the conclusion or evidence.';
  return `${completeCount}/${total} points have both a conclusion and evidence. Fill every gap before the final answer.`;
}

function getFinalArgumentStatusLabel(status: 'correct' | 'wrong' | 'ready' | 'missing'): string {
  if (status === 'correct') return 'confirmed';
  if (status === 'wrong') return 'repair';
  if (status === 'ready') return 'ready';
  return 'missing';
}

function FinalSummationPanel({
  answers,
  evidenceAnswers,
  evidence,
  onSelectQuestion,
  onOpenEvidence,
}: {
  answers: Record<string, string>;
  evidenceAnswers: Record<string, string>;
  evidence: Evidence[];
  onSelectQuestion: (questionId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const rows = episode.deduction.questions.map((question) => {
    const choice = question.choices.find((item) => item.id === answers[question.id]);
    const selectedEvidence = evidenceById.get(evidenceAnswers[question.id]);
    const correct =
      answers[question.id] === question.answer &&
      evidenceAnswers[question.id] === question.evidenceAnswer;
    return { question, choice, selectedEvidence, correct };
  });
  const ready = rows.every((row) => row.choice && row.selectedEvidence);
  if (!ready) return null;

  const correctCount = rows.filter((row) => row.correct).length;
  const culprit = rows.find((row) => row.question.id === 'culprit');
  const proof = rows.find((row) => row.question.id === 'proof');

  return (
    <aside
      className={`final-summation-panel status-${correctCount === rows.length ? 'ready' : 'review'}`}
      aria-label="最終弁論サマリー"
    >
      <div className="final-summation-heading">
        <div>
          <span>COURT SUMMATION</span>
          <strong>{correctCount === rows.length ? '評決へ進める弁論が揃った' : '提出前に論点を再確認する'}</strong>
          <p>
            {culprit?.choice?.label ?? '削除者'}が削除できた理由を、4つの論点と記録で裁判長に提示する。
          </p>
        </div>
        <em>
          {correctCount}/{rows.length}
          <small>matched</small>
        </em>
      </div>
      <div className="final-summation-verdict">
        <span>FINAL CLAIM</span>
        <strong>{culprit?.choice?.label ?? '結論未確認'}による削除を主張する</strong>
        <p>{proof?.selectedEvidence ? `${proof.selectedEvidence.name}までつなげて、削除後の説明準備を示す。` : '最後の証拠を確認する。'}</p>
      </div>
      <div className="final-summation-grid">
        {rows.map((row, index) => (
          <article className={row.correct ? 'matched' : 'review'} key={row.question.id}>
            <button type="button" onClick={() => onSelectQuestion(row.question.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{row.question.stageLabel ?? row.question.prompt}</strong>
              <small>{row.correct ? '成立' : '要確認'}</small>
            </button>
            <p>{row.choice?.label ?? '結論未選択'}</p>
            {row.selectedEvidence ? (
              <button
                className="final-summation-evidence"
                type="button"
                onClick={() => onOpenEvidence(row.selectedEvidence!.id)}
              >
                <img src={row.selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <span>{row.selectedEvidence.name}</span>
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  );
}

function getDeductionBriefRole(
  questionId: string,
  result: 'correct' | 'wrong' | undefined,
  ready: boolean,
): string {
  if (result === 'correct') return 'この反論は崩れている。';
  if (result === 'wrong') return '結論と証拠の組み合わせを直す。';
  if (!ready) return '結論と証拠をそろえる。';

  switch (questionId) {
    case 'culprit':
      return '来訪位置で、削除者の名義論を外す。';
    case 'reason':
      return '旧版と電話メモで、消す動機を説明する。';
    case 'opportunity':
      return '共用PCで、権限ではなく機会へずらす。';
    case 'proof':
      return '送信予約で、削除後の説明準備までつなぐ。';
    default:
      return '相手の反論に当たる証拠として使う。';
  }
}

function DeductionMissBoard({
  answers,
  evidenceAnswers,
  evidence,
  feedback,
  onSelectQuestion,
  onOpenEvidence,
}: {
  answers: Record<string, string>;
  evidenceAnswers: Record<string, string>;
  evidence: Evidence[];
  feedback: DeductionFeedback;
  onSelectQuestion: (questionId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const wrongQuestions = episode.deduction.questions.filter((question) => feedback[question.id] === 'wrong');
  if (!wrongQuestions.length) return null;

  return (
    <aside className="deduction-miss-board" aria-label="推理ミス比較">
      <div className="deduction-miss-heading">
        <span>Mismatch review</span>
        <strong>崩れた論点を先に直す</strong>
        <p>結論を押し直す前に、選択肢と証拠のどちらがズレたかを確認する。</p>
      </div>
      <div className="deduction-miss-list">
        {wrongQuestions.map((question) => {
          const selectedChoice = question.choices.find((choice) => choice.id === answers[question.id]);
          const correctChoice = question.choices.find((choice) => choice.id === question.answer);
          const selectedEvidence = evidenceById.get(evidenceAnswers[question.id]);
          const correctEvidence = evidenceById.get(question.evidenceAnswer);
          const choiceWrong = answers[question.id] !== question.answer;
          const evidenceWrong = evidenceAnswers[question.id] !== question.evidenceAnswer;

          return (
            <article className="deduction-miss-card" key={question.id}>
              <div className="deduction-miss-title">
                <span>{question.stageLabel ?? question.prompt}</span>
                <strong>{question.prompt}</strong>
              </div>
              <div className="deduction-miss-compare">
                <section className={choiceWrong ? 'status-wrong' : 'status-correct'}>
                  <span>Answer</span>
                  <p>{selectedChoice?.label ?? '未選択'}</p>
                  {choiceWrong ? <small>正: {correctChoice?.label ?? question.answer}</small> : <small>一致</small>}
                </section>
                <section className={evidenceWrong ? 'status-wrong' : 'status-correct'}>
                  <span>Evidence</span>
                  <p>{selectedEvidence?.name ?? '未選択'}</p>
                  {evidenceWrong ? (
                    <button className="inline-detail-button" type="button" onClick={() => onOpenEvidence(question.evidenceAnswer)}>
                      正: {correctEvidence?.name ?? question.evidenceAnswer}
                    </button>
                  ) : (
                    <small>一致</small>
                  )}
                </section>
              </div>
              <button className="secondary-button" type="button" onClick={() => onSelectQuestion(question.id)}>
                この論点を直す
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function FinalEvidenceChain({
  activeQuestionId,
  evidence,
  evidenceAnswers,
  feedback,
  stageFeedback,
  onSelectQuestion,
  onOpenEvidence,
}: {
  activeQuestionId?: string;
  evidence: Evidence[];
  evidenceAnswers: Record<string, string>;
  feedback: DeductionFeedback;
  stageFeedback: DeductionFeedback;
  onSelectQuestion: (questionId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const selectedCount = episode.deduction.questions.filter(
    (question) => evidenceAnswers[question.id],
  ).length;
  const ready = selectedCount === episode.deduction.questions.length;

  return (
    <section className="deduction-chain" aria-label="最終証拠チェーン">
      <div className="deduction-chain-heading">
        <div>
          <span>最終証拠チェーン</span>
          <strong>削除者から決め手まで、証拠を一本に並べる</strong>
        </div>
        <em>{selectedCount}/{episode.deduction.questions.length}</em>
      </div>
      <div className="chain-track">
        {episode.deduction.questions.map((question, index) => {
          const selectedEvidence = evidence.find((item) => item.id === evidenceAnswers[question.id]);
          const result = feedback[question.id] ?? stageFeedback[question.id];
          const timeline = selectedEvidence
            ? episode.timeline.filter((event) => event.evidenceIds?.includes(selectedEvidence.id))
            : [];
          const issues = selectedEvidence
            ? episode.analysisLinks.filter((link) => link.evidenceIds.includes(selectedEvidence.id))
            : [];
          return (
            <article
              className={[
                'chain-node',
                selectedEvidence ? 'has-evidence' : 'missing',
                activeQuestionId === question.id ? 'active' : '',
                result ? `review-${result}` : '',
              ].join(' ')}
              key={question.id}
            >
              <button
                className="chain-node-main"
                type="button"
                onClick={() => onSelectQuestion(question.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{question.stageLabel ?? question.prompt}</strong>
                <small>
                  {result === 'correct'
                    ? '成立'
                    : result === 'wrong'
                      ? '再検討'
                      : selectedEvidence
                        ? '照合待ち'
                        : '証拠未選択'}
                </small>
              </button>
              {selectedEvidence ? (
                <div className="chain-evidence">
                  <img src={selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  <div>
                    <strong>{selectedEvidence.name}</strong>
                    <p>{getChainPlacementLabel(timeline, issues)}</p>
                    <button
                      className="inline-detail-button"
                      type="button"
                      onClick={() => onOpenEvidence(selectedEvidence.id)}
                    >
                      詳しく読む
                    </button>
                  </div>
                </div>
              ) : (
                <p className="empty-text">この論点に置く証拠を選ぶ。</p>
              )}
            </article>
          );
        })}
      </div>
      {ready ? (
        <aside className="deduction-ready-panel" aria-label="最終提出前チェック">
          <div className="deduction-ready-heading">
            <div>
              <span>提出前チェック</span>
              <strong>4つの根拠証拠が一本の結論につながった</strong>
              <p>削除者、理由、機会、決め手を、それぞれ別の記録で支えてから結論を出す。</p>
            </div>
            <em>{selectedCount}/{episode.deduction.questions.length}</em>
          </div>
          <div className="deduction-ready-grid">
            {episode.deduction.questions.map((question, index) => {
              const selectedEvidence = evidence.find((item) => item.id === evidenceAnswers[question.id]);
              return (
                <section key={question.id}>
                  <span>{String(index + 1).padStart(2, '0')} {question.stageLabel ?? question.prompt}</span>
                  <strong>{getDeductionBriefRole(question.id, undefined, true)}</strong>
                  {selectedEvidence ? (
                    <small>
                      <img src={selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                      {selectedEvidence.name}
                    </small>
                  ) : null}
                </section>
              );
            })}
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function getChainPlacementLabel(timeline: TimelineEvent[], issues: AnalysisLink[]): string {
  if (timeline.length) {
    return timeline.map((event) => `${event.time} ${event.title}`).join(' / ');
  }
  if (issues.length) {
    return issues.map((issue) => issue.label).join(' / ');
  }
  return '時刻ではなく、証拠の意味で支える論点。';
}

function DeductionArgumentStage({
  question,
  questionIndex,
  questionCount,
  confirmedCount,
  value,
  evidenceValue,
  evidence,
  feedback,
  stageFeedback,
  onSelect,
  onEvidenceSelect,
  onChallenge,
  onNext,
  onOpenEvidence,
}: {
  question: DeductionQuestion;
  questionIndex: number;
  questionCount: number;
  confirmedCount: number;
  value?: string;
  evidenceValue?: string;
  evidence: Evidence[];
  feedback?: 'correct' | 'wrong';
  stageFeedback?: 'correct' | 'wrong';
  onSelect: (choiceId: string) => void;
  onEvidenceSelect: (evidenceId: string) => void;
  onChallenge: () => void;
  onNext: () => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const selectedChoice = question.choices.find((choice) => choice.id === value);
  const selectedEvidence = evidence.find((item) => item.id === evidenceValue);
  const fit = getDeductionFit(question, selectedChoice, selectedEvidence);
  const ready = Boolean(value && evidenceValue);
  const visibleFeedback = feedback ?? stageFeedback;
  const canAdvance = visibleFeedback === 'correct';
  const actionLabel = canAdvance
    ? questionIndex + 1 >= questionCount
      ? 'この論点を保持'
      : '次の論点へ'
    : 'この論点を突きつける';

  return (
    <article className={visibleFeedback ? `deduction-stage review-${visibleFeedback}` : 'deduction-stage'}>
      <div className="deduction-stage-header">
        <div>
          <span>論点 {String(questionIndex + 1).padStart(2, '0')} / {questionCount}</span>
          <h3>{question.stageLabel ?? question.prompt}</h3>
        </div>
        <strong>{confirmedCount}/{questionCount}</strong>
      </div>
      <div className="deduction-exchange">
        <section className="opponent-claim">
          <span>相手の反論</span>
          <p>{question.opponentClaim ?? question.prompt}</p>
        </section>
        <section className="player-rebuttal">
          <span>こちらの筋</span>
          <p>{question.rebuttal ?? '結論と根拠証拠をそろえて、記録に沿う説明を出す。'}</p>
        </section>
      </div>
      <div className="deduction-stage-controls">
        <label>
          <span>結論</span>
          <select
            aria-label={`trial-${question.id}-choice`}
            value={value ?? ''}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="">結論を選ぶ</option>
            {question.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>突きつける証拠</span>
          <select
            aria-label={`trial-${question.id}-evidence`}
            value={evidenceValue ?? ''}
            onChange={(event) => onEvidenceSelect(event.target.value)}
          >
            <option value="">証拠を選ぶ</option>
            {evidence.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DeductionFitPanel fit={fit} />
      <div className="deduction-stage-preview">
        <section>
          <span>提出する結論</span>
          <p>{selectedChoice?.label ?? 'まだ結論を選んでいない。'}</p>
        </section>
        <section>
          <span>根拠証拠</span>
          {selectedEvidence ? (
            <div className="deduction-stage-evidence">
              <img src={selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <div>
                <strong>{selectedEvidence.name}</strong>
                <p>{selectedEvidence.description}</p>
                <button
                  className="inline-detail-button"
                  type="button"
                  onClick={() => onOpenEvidence(selectedEvidence.id)}
                >
                  詳しく読む
                </button>
              </div>
            </div>
          ) : (
            <p>反論を支える証拠を選ぶ。</p>
          )}
        </section>
      </div>
      {visibleFeedback ? (
        <p className={`deduction-stage-feedback deduction-stage-verdict ${visibleFeedback}`}>
          <strong>{visibleFeedback === 'correct' ? '反論が崩れた' : 'まだ崩れない'}</strong>
          {visibleFeedback === 'correct'
            ? `相手の言い分は記録と両立しない。${question.rebuttal ?? 'この筋で次の反論へ進める。'}`
            : `この組み合わせでは相手の反論が残る。${
                question.wrongHint ?? getDeductionHint(question.id)
              }`}
        </p>
      ) : null}
      {visibleFeedback === 'wrong' ? (
        <DeductionRecoveryPanel
          question={question}
          selectedChoice={selectedChoice}
          selectedEvidence={selectedEvidence}
          evidence={evidence}
          onOpenEvidence={onOpenEvidence}
        />
      ) : null}
      <button
        className="secondary-button"
        type="button"
        disabled={!ready}
        onClick={canAdvance ? onNext : onChallenge}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function DeductionRecoveryPanel({
  question,
  selectedChoice,
  selectedEvidence,
  evidence,
  onOpenEvidence,
}: {
  question: DeductionQuestion;
  selectedChoice?: DeductionQuestion['choices'][number];
  selectedEvidence?: Evidence;
  evidence: Evidence[];
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const expectedEvidence = evidence.find((item) => item.id === question.evidenceAnswer);
  const weakPair = [
    selectedChoice?.label ?? '結論未選択',
    selectedEvidence?.name ?? '証拠未選択',
  ].join(' / ');
  const recoveryHint = question.wrongHint ?? getDeductionHint(question.id);

  return (
    <aside className="deduction-recovery" aria-label="再検討メモ">
      <div className="deduction-recovery-heading">
        <span>再検討メモ</span>
        <strong>{question.stageLabel ?? question.prompt}を立て直す</strong>
        <p>{recoveryHint}</p>
      </div>
      <div className="deduction-recovery-grid">
        <section>
          <span>残る反論</span>
          <p>{question.opponentClaim ?? question.prompt}</p>
        </section>
        <section>
          <span>弱い組み合わせ</span>
          <p>{weakPair}</p>
        </section>
        <section>
          <span>読み直す記録</span>
          <p>{expectedEvidence?.name ?? '根拠証拠を事件ファイルで確認する'}</p>
          {expectedEvidence ? (
            <button
              className="inline-detail-button"
              type="button"
              onClick={() => onOpenEvidence(expectedEvidence.id)}
            >
              記録を開く
            </button>
          ) : null}
        </section>
      </div>
    </aside>
  );
}

function DeductionFitPanel({ fit }: { fit: DeductionFit }) {
  return (
    <aside className={`deduction-fit status-${fit.status}`} aria-label="反論照合">
      <div className="deduction-fit-heading">
        <span>反論照合</span>
        <strong>{fit.headline}</strong>
        <p>{fit.detail}</p>
      </div>
      <div className="deduction-fit-grid">
        <section>
          <span>相手の残る反論</span>
          <p>{fit.claim}</p>
        </section>
        <section>
          <span>選択中の証拠読み</span>
          <p>{fit.evidencePoint}</p>
        </section>
        <section>
          <span>照合結果</span>
          <p>{fit.verdict}</p>
        </section>
      </div>
    </aside>
  );
}

function getDeductionFit(
  question: DeductionQuestion,
  choice?: DeductionQuestion['choices'][number],
  evidence?: Evidence,
): DeductionFit {
  const claim = question.opponentClaim ?? question.prompt;
  const evidencePoint = evidence
    ? `${evidence.name}: ${evidence.detail}`
    : '証拠を選ぶと、記録の示す事実がここに出る。';

  if (!choice && !evidence) {
    return {
      status: 'empty',
      headline: '結論と証拠を選ぶ',
      detail: 'この論点で何を認定し、どの記録で支えるかをそろえる。',
      claim,
      evidencePoint,
      verdict: 'まだ相手の反論に当てる材料がない。',
    };
  }

  if (!choice || !evidence) {
    return {
      status: 'partial',
      headline: choice ? '根拠待ち' : '結論待ち',
      detail: choice
        ? `${choice.label}を支える記録を選ぶ。`
        : `${evidence?.name ?? '選択中の証拠'}をどの結論へつなげるかを決める。`,
      claim,
      evidencePoint,
      verdict: '片方だけでは、反論のどこを崩すのかがまだ読めない。',
    };
  }

  const choiceMatches = choice.id === question.answer;
  const evidenceMatches = evidence.id === question.evidenceAnswer;

  if (choiceMatches && evidenceMatches) {
    return {
      status: 'aligned',
      headline: '反論に届く',
      detail: '結論と証拠が同じ弱点を向いている。突きつければ、この論点は次へ進める。',
      claim,
      evidencePoint,
      verdict: question.rebuttal ?? '記録に沿った説明として通せる。',
    };
  }

  if (choiceMatches) {
    return {
      status: 'evidence-gap',
      headline: '結論は近い',
      detail: `${choice.label}は論点に届いているが、${evidence.name}では支える地点が弱い。`,
      claim,
      evidencePoint,
      verdict: question.wrongHint ?? getDeductionHint(question.id),
    };
  }

  if (evidenceMatches) {
    return {
      status: 'choice-gap',
      headline: '証拠は近い',
      detail: `${evidence.name}はこの論点の記録だが、結論が相手の反論をまだ受け止めていない。`,
      claim,
      evidencePoint,
      verdict: question.wrongHint ?? getDeductionHint(question.id),
    };
  }

  return {
    status: 'mismatch',
    headline: '組み合わせを見直す',
    detail: `${choice.label}と${evidence.name}では、相手の反論に当たる場所がずれている。`,
    claim,
    evidencePoint,
    verdict: question.wrongHint ?? getDeductionHint(question.id),
  };
}

function QuestionBlock({
  question,
  value,
  evidenceValue,
  evidence,
  feedback,
  onSelect,
  onEvidenceSelect,
  onOpenEvidence,
}: {
  question: DeductionQuestion;
  value?: string;
  evidenceValue?: string;
  evidence: Evidence[];
  feedback?: 'correct' | 'wrong';
  onSelect: (choiceId: string) => void;
  onEvidenceSelect: (evidenceId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const selectedEvidence = evidence.find((item) => item.id === evidenceValue);

  return (
    <fieldset className={feedback ? `question-block review-${feedback}` : 'question-block'}>
      <legend>{question.prompt}</legend>
      {question.choices.map((choice) => (
        <label key={choice.id}>
          <input
            type="radio"
            name={question.id}
            checked={value === choice.id}
            onChange={() => onSelect(choice.id)}
          />
          <span>{choice.label}</span>
        </label>
      ))}
      <div className="deduction-evidence-row">
        <label>
          <span>根拠証拠</span>
          <select
            aria-label={`deduction-${question.id}-evidence`}
            value={evidenceValue ?? ''}
            onChange={(event) => onEvidenceSelect(event.target.value)}
          >
            <option value="">証拠を選ぶ</option>
            {evidence.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {selectedEvidence ? (
          <div className="deduction-evidence-preview">
            <img src={selectedEvidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
            <div>
              <strong>{selectedEvidence.name}</strong>
              <small>{selectedEvidence.description}</small>
              <button
                className="inline-detail-button"
                type="button"
                onClick={() => onOpenEvidence(selectedEvidence.id)}
              >
                詳しく読む
              </button>
            </div>
          </div>
        ) : (
          <p className="empty-text">この結論を支える証拠を添える。</p>
        )}
      </div>
      {feedback ? (
        <p className={`question-feedback ${feedback}`}>
          {feedback === 'correct'
            ? `この結論は記録と整合する。根拠: ${
                evidence.find((item) => item.id === question.evidenceAnswer)?.name ?? '証拠'
              }`
            : getDeductionHint(question.id)}
        </p>
      ) : null}
    </fieldset>
  );
}

function CaseFilePanel({
  state,
  evidence,
  characters,
  timeline,
  evidenceById,
  tab,
  selectedEvidenceId,
  onTabChange,
  onSelectEvidence,
  onModeChange,
}: {
  state: GameState;
  evidence: Evidence[];
  characters: Character[];
  timeline: TimelineEvent[];
  evidenceById: Map<string, Evidence>;
  tab: CaseFileTab;
  selectedEvidenceId?: string;
  onTabChange: (tab: CaseFileTab) => void;
  onSelectEvidence: (id: string) => void;
  onModeChange: (mode: ViewMode) => void;
}) {
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const selectedEvidence = evidence.find((item) => item.id === selectedEvidenceId) ?? evidence[0];

  return (
    <section className="action-stack">
      <PanelTitle icon={Briefcase} title="事件ファイル" subtitle="証拠、人物、時系列を確認する" />
      <div className="tab-bar" role="tablist" aria-label="事件ファイル">
        <button
          className={tab === 'evidence' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onTabChange('evidence')}
        >
          証拠
        </button>
        <button
          className={tab === 'people' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onTabChange('people')}
        >
          人物
        </button>
        <button
          className={tab === 'timeline' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onTabChange('timeline')}
        >
          時系列
        </button>
        <button
          className={tab === 'testimony' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onTabChange('testimony')}
        >
          証言
        </button>
        <button
          className={tab === 'theory' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onTabChange('theory')}
        >
          論点
        </button>
      </div>
      {tab === 'evidence' ? (
        <EvidenceFile
          state={state}
          evidence={evidence}
          selectedEvidence={selectedEvidence}
          onSelectEvidence={onSelectEvidence}
          onOpenTestimony={() => onTabChange('testimony')}
          onModeChange={onModeChange}
        />
      ) : null}
      {tab === 'people' ? (
        <PeopleFile
          state={state}
          characters={characters}
          evidenceById={evidenceById}
          onModeChange={onModeChange}
        />
      ) : null}
      {tab === 'timeline' ? (
        <TimelineFile
          state={state}
          events={timeline.filter(
            (event) => !event.evidenceIds?.length || event.evidenceIds.every((id) => evidenceIds.has(id)),
          )}
          evidenceById={evidenceById}
        />
      ) : null}
      {tab === 'testimony' ? (
        <TestimonyFile
          state={state}
          evidenceById={evidenceById}
          onOpenEvidence={(evidenceId) => {
            onSelectEvidence(evidenceId);
            onTabChange('evidence');
          }}
        />
      ) : null}
      {tab === 'theory' ? <TheoryBoard state={state} evidenceById={evidenceById} /> : null}
    </section>
  );
}

function EvidenceFile({
  state,
  evidence,
  selectedEvidence,
  onSelectEvidence,
  onOpenTestimony,
  onModeChange,
}: {
  state: GameState;
  evidence: Evidence[];
  selectedEvidence?: Evidence;
  onSelectEvidence: (id: string) => void;
  onOpenTestimony: () => void;
  onModeChange: (mode: ViewMode) => void;
}) {
  const [comparisonEvidenceId, setComparisonEvidenceId] = useState<string | undefined>();
  if (!evidence.length) return <p className="empty-text">まだ証拠はない。</p>;

  const fallbackComparisonId = evidence.find((item) => item.id !== selectedEvidence?.id)?.id;
  const activeComparisonId =
    comparisonEvidenceId &&
    comparisonEvidenceId !== selectedEvidence?.id &&
    evidence.some((item) => item.id === comparisonEvidenceId)
      ? comparisonEvidenceId
      : fallbackComparisonId;
  const comparisonEvidence = evidence.find((item) => item.id === activeComparisonId);

  return (
    <div className="evidence-file-layout">
      <div className="evidence-grid">
        {evidence.map((item) => (
          <button
            className={selectedEvidence?.id === item.id ? 'evidence-card active' : 'evidence-card'}
            key={item.id}
            type="button"
            onClick={() => onSelectEvidence(item.id)}
          >
            <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
            <div>
              <h3>{item.name}</h3>
              {item.isKey ? <span>重要</span> : null}
            </div>
            <p>{item.description}</p>
          </button>
        ))}
      </div>
      {selectedEvidence ? (
        <div className="evidence-side-stack">
          <EvidenceDetail
            state={state}
            evidence={selectedEvidence}
            onModeChange={onModeChange}
          />
          <EvidenceTestimonyLinkPanel
            state={state}
            evidence={selectedEvidence}
            onOpenTestimony={onOpenTestimony}
          />
          <EvidenceComparisonNote
            state={state}
            evidence={evidence}
            primary={selectedEvidence}
            comparison={comparisonEvidence}
            comparisonEvidenceId={activeComparisonId}
            onComparisonEvidence={setComparisonEvidenceId}
          />
          <EvidenceRelationMap
            state={state}
            evidence={selectedEvidence}
            evidenceById={new Map(evidence.map((item) => [item.id, item]))}
            onSelectEvidence={onSelectEvidence}
          />
        </div>
      ) : null}
    </div>
  );
}

function getCharacterName(characterId?: string) {
  if (!characterId) return '';
  return episode.characters.find((character) => character.id === characterId)?.name ?? characterId;
}

function getEvidenceUsages(evidenceId: string): EvidenceUsage[] {
  const presentUsages: EvidenceUsage[] = episode.presentReactions
    .filter((reaction) => reaction.evidenceId === evidenceId)
    .map((reaction) => ({
      id: `present-${reaction.id}`,
      tone: 'present',
      label: '提示',
      meta: getCharacterName(reaction.characterId),
      detail: reaction.label,
    }));

  const hearingUsages: EvidenceUsage[] = episode.hearing.contradictions
    .filter((contradiction) => contradiction.evidenceId === evidenceId)
    .map((contradiction) => {
      const statement = episode.hearing.statements.find(
        (item) => item.id === contradiction.statementId,
      );
      return {
        id: `hearing-${contradiction.statementId}-${contradiction.evidenceId}`,
        tone: 'hearing',
        label: '対決',
        meta: statement?.speaker ?? '証言',
        detail: statement?.text ?? contradiction.text,
      };
    });

  const deductionUsages: EvidenceUsage[] = episode.deduction.questions
    .filter((question) => question.evidenceAnswer === evidenceId)
    .map((question) => ({
      id: `deduction-${question.id}`,
      tone: 'deduction',
      label: '最終推理',
      meta: question.stageLabel ?? question.prompt,
      detail: question.prompt,
    }));

  return [...presentUsages, ...hearingUsages, ...deductionUsages];
}

function getEvidenceActionGuides(evidenceId: string, state: GameState): EvidenceActionGuide[] {
  const acquiredCount = state.evidenceIds.length;
  const finalUnlocked = state.flags.includes(episode.finalFlag);
  const analysisComplete = state.flags.includes('analysis_complete');
  const hearingCleared = state.flags.includes(episode.hearing.requiredFlag);

  const analysisGuides = episode.analysisLinks
    .filter((link) => link.evidenceIds.includes(evidenceId))
    .map((link): EvidenceActionGuide => {
      const complete = hasAllFlags(state, link.setFlags);
      const ready =
        acquiredCount >= 2 &&
        hasAllFlags(state, link.requiresFlags) &&
        link.evidenceIds.every((id) => state.evidenceIds.includes(id));
      return {
        id: `next-analysis-${link.id}`,
        mode: 'analysis',
        status: complete ? 'complete' : ready ? 'ready' : 'locked',
        label: '整理',
        title: link.label,
        detail: complete ? link.text : ready ? link.prompt : '関連証拠か前提フラグがまだ足りない。',
        action: complete ? '整理を見直す' : ready ? '整理で使う' : '前提待ち',
      };
    });

  const hearingGuides = episode.hearing.contradictions
    .filter((contradiction) => contradiction.evidenceId === evidenceId)
    .map((contradiction): EvidenceActionGuide => {
      const statement = episode.hearing.statements.find(
        (item) => item.id === contradiction.statementId,
      );
      const routeInfo = getHearingRouteInfo(state, statement);
      const ready = finalUnlocked && analysisComplete && routeInfo.status === 'ready';
      const complete = routeInfo.status === 'cleared';
      return {
        id: `next-hearing-${contradiction.statementId}`,
        mode: 'hearing',
        status: complete ? 'complete' : ready ? 'ready' : 'locked',
        label: '対決',
        title: getContradictionAxis(contradiction.statementId),
        detail: complete
          ? 'この証拠で発言の逃げ道は崩れている。'
          : ready
            ? statement?.text ?? contradiction.text
            : routeInfo.detail,
        action: complete ? '証言録を見直す' : ready ? '対決で示す' : '前提待ち',
      };
    });

  const deductionGuides = episode.deduction.questions
    .filter((question) => question.evidenceAnswer === evidenceId)
    .map((question): EvidenceActionGuide => ({
      id: `next-deduction-${question.id}`,
      mode: 'deduction',
      status: hearingCleared ? 'ready' : 'locked',
      label: '推理',
      title: question.stageLabel ?? question.prompt,
      detail: question.rebuttal ?? question.prompt,
      action: hearingCleared ? '最終推理で使う' : '対決後に使用',
    }));

  const presentGuides = episode.presentReactions
    .filter((reaction) => reaction.evidenceId === evidenceId)
    .map((reaction): EvidenceActionGuide => {
      const complete = hasAllFlags(state, reaction.setFlags);
      return {
        id: `next-present-${reaction.id}`,
        mode: 'present',
        status: complete ? 'complete' : 'ready',
        label: '提示',
        title: getCharacterName(reaction.characterId),
        detail: reaction.label,
        action: complete ? '提示を見直す' : '人物に示す',
      };
    });

  return [...hearingGuides, ...deductionGuides, ...analysisGuides, ...presentGuides].slice(0, 4);
}

function EvidenceNextUsePanel({
  guides,
  onModeChange,
}: {
  guides: EvidenceActionGuide[];
  onModeChange: (mode: ViewMode) => void;
}) {
  const primary = guides.find((guide) => guide.status === 'ready') ?? guides[0];
  if (!primary) return null;

  return (
    <section className="evidence-next-use" aria-label="次に使う場面">
      <div className="evidence-next-heading">
        <span>次に使う場面</span>
        <strong>{primary.title}</strong>
        <p>{primary.detail}</p>
      </div>
      <div className="evidence-next-list">
        {guides.map((guide) => (
          <button
            className={`status-${guide.status}`}
            type="button"
            key={guide.id}
            disabled={guide.status === 'locked'}
            onClick={() => onModeChange(guide.mode)}
          >
            <span>{guide.label}</span>
            <div>
              <strong>{guide.title}</strong>
              <small>{guide.action}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function evidencePairIncludes(evidenceIds: string[] | undefined, primaryId: string, comparisonId: string) {
  return Boolean(evidenceIds?.includes(primaryId) && evidenceIds.includes(comparisonId));
}

function getEvidenceComparisonInsights(
  primaryId: string,
  comparisonId: string,
  state: GameState,
): EvidenceComparisonInsight[] {
  const sharedTimeline = episode.timeline
    .filter((event) => evidencePairIncludes(event.evidenceIds, primaryId, comparisonId))
    .map((event) => ({
      id: `time-${event.id}`,
      tone: 'time' as const,
      label: '時刻',
      title: `${event.time} ${event.title}`,
      detail: event.detail,
    }));

  const sharedAnalysis = episode.analysisLinks
    .filter((link) => evidencePairIncludes(link.evidenceIds, primaryId, comparisonId))
    .map((link) => ({
      id: `analysis-${link.id}`,
      tone: 'analysis' as const,
      label: '争点',
      title: link.label,
      detail: hasAllFlags(state, link.setFlags) ? link.text : link.prompt,
    }));

  const sharedIssues =
    episode.caseBoard?.issues
      .filter((issue) => evidencePairIncludes(issue.evidenceIds, primaryId, comparisonId))
      .map((issue) => {
        const issueComplete = hasAllFlags(state, issue.requiresFlags);
        return {
          id: `issue-${issue.id}`,
          tone: 'issue' as const,
          label: issueComplete ? '成立' : '候補',
          title: issue.title,
          detail: issueComplete ? issue.answer : issue.nextAction,
        };
      }) ?? [];

  return [...sharedTimeline, ...sharedAnalysis, ...sharedIssues];
}

function getEvidenceComparisonSummary(insightCount: number) {
  if (insightCount > 2) return '複数の記録が同じ筋を向いている。';
  if (insightCount > 0) return 'この2点は同じ争点にかかる。';
  return '直接の組ではない。別の証拠と並べる。';
}

function EvidenceComparisonNote({
  state,
  evidence,
  primary,
  comparison,
  comparisonEvidenceId,
  onComparisonEvidence,
}: {
  state: GameState;
  evidence: Evidence[];
  primary: Evidence;
  comparison?: Evidence;
  comparisonEvidenceId?: string;
  onComparisonEvidence: (id: string) => void;
}) {
  const insights = comparison
    ? getEvidenceComparisonInsights(primary.id, comparison.id, state)
    : [];
  const options = evidence.filter((item) => item.id !== primary.id);

  if (!comparison || !comparisonEvidenceId) return null;

  return (
    <aside className="evidence-comparison" aria-label="証拠照合ノート">
      <div className="comparison-heading">
        <div>
          <p>照合ノート</p>
          <h3>証拠を並べる</h3>
        </div>
        <strong>{getEvidenceComparisonSummary(insights.length)}</strong>
      </div>
      <label className="comparison-select">
        <span>照合する証拠</span>
        <select
          aria-label="照合する証拠"
          value={comparisonEvidenceId}
          onChange={(event) => onComparisonEvidence(event.target.value)}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="comparison-pair">
        <EvidenceComparisonMini evidence={primary} label="基準" />
        <EvidenceComparisonMini evidence={comparison} label="照合" />
      </div>
      {insights.length ? (
        <div className="comparison-insight-list">
          {insights.map((insight) => (
            <article className={`comparison-insight insight-${insight.tone}`} key={insight.id}>
              <span>{insight.label}</span>
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="comparison-empty">この2点だけでは争点がつながらない。</p>
      )}
    </aside>
  );
}

function EvidenceComparisonMini({ evidence, label }: { evidence: Evidence; label: string }) {
  return (
    <div className="comparison-mini">
      <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
      <div>
        <span>{label}</span>
        <strong>{evidence.name}</strong>
      </div>
    </div>
  );
}

function EvidenceRelationMap({
  state,
  evidence,
  evidenceById,
  onSelectEvidence,
}: {
  state: GameState;
  evidence: Evidence;
  evidenceById: Map<string, Evidence>;
  onSelectEvidence: (id: string) => void;
}) {
  const nodes = getEvidenceRelationNodes(evidence, state);
  const relatedEvidence = Array.from(
    new Set(nodes.flatMap((node) => node.relatedEvidenceIds).filter((id) => id !== evidence.id)),
  )
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));

  return (
    <aside className="evidence-relation-map" aria-label="記録相関図">
      <div className="relation-heading">
        <div>
          <p>記録相関図</p>
          <h3>{evidence.name}の役割を俯瞰する</h3>
        </div>
        <strong>{getEvidenceRelationSummary(nodes)}</strong>
      </div>
      <div className="relation-node-list">
        {nodes.map((node) => (
          <article className={`relation-node relation-${node.tone}`} key={node.id}>
            <span>{node.label}</span>
            <div>
              <strong>{node.title}</strong>
              <p>{node.detail}</p>
              <small>{node.status}</small>
            </div>
          </article>
        ))}
      </div>
      {relatedEvidence.length ? (
        <div className="relation-evidence-links">
          <span>一緒に読む記録</span>
          <div>
            {relatedEvidence.map((item) => (
              <button type="button" key={item.id} onClick={() => onSelectEvidence(item.id)}>
                <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="relation-empty">この証拠は単独で読む記録として扱う。</p>
      )}
    </aside>
  );
}

function getEvidenceRelationNodes(evidence: Evidence, state: GameState): EvidenceRelationNode[] {
  const timelineNodes = episode.timeline
    .filter((event) => event.evidenceIds?.includes(evidence.id))
    .map((event) => ({
      id: `relation-time-${event.id}`,
      tone: 'time' as const,
      label: '時刻',
      title: `${event.time} ${event.title}`,
      detail: event.detail,
      status: '時系列で読む',
      relatedEvidenceIds: event.evidenceIds ?? [],
    }));

  const analysisNodes = episode.analysisLinks
    .filter((link) => link.evidenceIds.includes(evidence.id))
    .map((link) => {
      const completed = hasAllFlags(state, link.setFlags);
      const ready =
        hasAllFlags(state, link.requiresFlags) &&
        link.evidenceIds.every((id) => state.evidenceIds.includes(id));
      return {
        id: `relation-analysis-${link.id}`,
        tone: 'analysis' as const,
        label: '争点',
        title: link.label,
        detail: completed ? link.text : link.prompt,
        status: completed ? '整理済み' : ready ? '整理可能' : '前提待ち',
        relatedEvidenceIds: link.evidenceIds,
      };
    });

  const issueNodes =
    episode.caseBoard?.issues
      .filter((issue) => issue.evidenceIds.includes(evidence.id))
      .map((issue) => {
        const complete = hasAllFlags(state, issue.requiresFlags);
        return {
          id: `relation-issue-${issue.id}`,
          tone: 'issue' as const,
          label: '論点',
          title: issue.title,
          detail: complete ? issue.answer : issue.nextAction,
          status: complete ? '成立' : '未完成',
          relatedEvidenceIds: issue.evidenceIds,
        };
      }) ?? [];

  const hearingNodes = episode.hearing.contradictions
    .filter((contradiction) => contradiction.evidenceId === evidence.id)
    .map((contradiction) => {
      const statement = episode.hearing.statements.find(
        (item) => item.id === contradiction.statementId,
      );
      const routeInfo = getHearingRouteInfo(state, statement);
      return {
        id: `relation-hearing-${contradiction.statementId}`,
        tone: 'hearing' as const,
        label: '対決',
        title: getContradictionAxis(contradiction.statementId),
        detail: statement?.text ?? contradiction.text,
        status: routeInfo.label,
        relatedEvidenceIds: [contradiction.evidenceId],
      };
    });

  const deductionNodes = episode.deduction.questions
    .filter((question) => question.evidenceAnswer === evidence.id)
    .map((question) => ({
      id: `relation-deduction-${question.id}`,
      tone: 'deduction' as const,
      label: '最終推理',
      title: question.stageLabel ?? question.prompt,
      detail: question.rebuttal ?? question.prompt,
      status: '根拠証拠',
      relatedEvidenceIds: [question.evidenceAnswer],
    }));

  const presentNodes = episode.presentReactions
    .filter((reaction) => reaction.evidenceId === evidence.id)
    .map((reaction) => ({
      id: `relation-present-${reaction.id}`,
      tone: 'present' as const,
      label: '提示',
      title: getCharacterName(reaction.characterId),
      detail: reaction.label,
      status: hasAllFlags(state, reaction.setFlags) ? '提示済み' : '提示候補',
      relatedEvidenceIds: [reaction.evidenceId],
    }));

  return [
    ...timelineNodes,
    ...analysisNodes,
    ...issueNodes,
    ...hearingNodes,
    ...deductionNodes,
    ...presentNodes,
  ];
}

function getEvidenceRelationSummary(nodes: EvidenceRelationNode[]) {
  const hasHearing = nodes.some((node) => node.tone === 'hearing');
  const hasDeduction = nodes.some((node) => node.tone === 'deduction');
  const hasAnalysis = nodes.some((node) => node.tone === 'analysis' || node.tone === 'issue');
  if (hasHearing && hasDeduction) return '対決と最終推理の両方で使う中核記録。';
  if (hasHearing) return '対決で発言を崩す記録。';
  if (hasDeduction) return '最終推理の根拠になる記録。';
  if (hasAnalysis) return '争点整理で意味が変わる記録。';
  if (nodes.length) return '時系列の位置を押さえる記録。';
  return 'まだ他の記録との接続は薄い。';
}

function EvidenceDetail({
  state,
  evidence,
  onModeChange,
}: {
  state?: GameState;
  evidence: Evidence;
  onModeChange?: (mode: ViewMode) => void;
}) {
  const relatedTimeline = episode.timeline.filter((event) =>
    event.evidenceIds?.includes(evidence.id),
  );
  const relatedAnalysis = episode.analysisLinks.filter((link) =>
    link.evidenceIds.includes(evidence.id),
  );
  const usages = getEvidenceUsages(evidence.id);
  const actionGuides = state ? getEvidenceActionGuides(evidence.id, state) : [];
  const roleStats = [
    { label: 'Usage', value: usages.length },
    { label: 'Next', value: actionGuides.filter((guide) => guide.status === 'ready').length },
    { label: 'Links', value: relatedTimeline.length + relatedAnalysis.length },
  ];

  return (
    <aside className="evidence-detail" aria-label="証拠詳細">
      <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
      <div>
        <p>{evidence.isKey ? '重要証拠' : '証拠'}</p>
        <h3>{evidence.name}</h3>
      </div>
      <p>{evidence.description}</p>
      <small>{evidence.detail}</small>
      <section className="evidence-role-card" aria-label="証拠の役割">
        <div>
          <span>Case role</span>
          <strong>{getEvidenceRoleHeadline(evidence.id, usages.length, actionGuides.length)}</strong>
          <p>{getEvidenceRoleDetail(evidence.id)}</p>
        </div>
        <div className="evidence-role-stats">
          {roleStats.map((item) => (
            <em key={item.label}>
              {item.label}
              <strong>{item.value}</strong>
            </em>
          ))}
        </div>
      </section>
      {relatedTimeline.length ? (
        <section>
          <h4>関係する時刻</h4>
          {relatedTimeline.map((event) => (
            <span key={event.id}>{event.time} {event.title}</span>
          ))}
        </section>
      ) : null}
      {relatedAnalysis.length ? (
        <section>
          <h4>使う争点</h4>
          {relatedAnalysis.map((link) => (
            <span key={link.id}>{link.label}</span>
          ))}
        </section>
      ) : null}
      {actionGuides.length && onModeChange ? (
        <EvidenceNextUsePanel guides={actionGuides} onModeChange={onModeChange} />
      ) : null}
      {state && onModeChange ? (
        <EvidenceCourtUsePanel evidence={evidence} state={state} onModeChange={onModeChange} />
      ) : null}
      {usages.length ? (
        <section className="evidence-usage-map">
          <h4>使う場面</h4>
          <div className="evidence-usage-list">
            {usages.map((usage) => (
              <article className={`evidence-usage usage-${usage.tone}`} key={usage.id}>
                <span>{usage.label}</span>
                <div>
                  <strong>{usage.meta}</strong>
                  <p>{usage.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function EvidenceCourtUsePanel({
  evidence,
  state,
  onModeChange,
}: {
  evidence: Evidence;
  state: GameState;
  onModeChange: (mode: ViewMode) => void;
}) {
  const routes = getEvidenceCourtUseRoutes(evidence, state);
  if (!routes.length) return null;

  const readyCount = routes.filter((route) => route.status === 'ready').length;
  const completeCount = routes.filter((route) => route.status === 'complete').length;
  const primary = routes.find((route) => route.status === 'ready') ?? routes[0];

  return (
    <section className="evidence-court-use" aria-label="法廷での使い方">
      <div className="evidence-court-use-heading">
        <span>COURT USE</span>
        <strong>{getEvidenceCourtUseHeadline(primary, readyCount, completeCount)}</strong>
        <p>{getEvidenceFactPoint(evidence.id, evidence.detail)}</p>
      </div>
      <div className="evidence-court-use-grid">
        {routes.map((route) => (
          <article className={`evidence-court-use-card route-${route.tone} status-${route.status}`} key={route.id}>
            <div className="evidence-court-use-card-head">
              <span>{route.label}</span>
              <em>{getEvidenceCourtUseStatus(route.status)}</em>
            </div>
            <strong>{route.title}</strong>
            <p>{route.detail}</p>
            <small>{route.fact}</small>
            <button
              className="secondary-button"
              type="button"
              disabled={route.status === 'locked'}
              onClick={() => onModeChange(route.mode)}
            >
              {route.action}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function getEvidenceCourtUseRoutes(evidence: Evidence, state: GameState): EvidenceCourtUseRoute[] {
  const finalUnlocked = state.flags.includes(episode.finalFlag);
  const analysisComplete = state.flags.includes('analysis_complete');
  const hearingCleared = state.flags.includes(episode.hearing.requiredFlag);

  const presentRoutes = episode.presentReactions
    .filter((reaction) => reaction.evidenceId === evidence.id)
    .map((reaction): EvidenceCourtUseRoute => {
      const complete = hasAllFlags(state, reaction.setFlags);
      return {
        id: `court-present-${reaction.id}`,
        mode: 'present',
        tone: 'present',
        status: complete ? 'complete' : 'ready',
        label: 'PRESENT',
        title: `${getCharacterName(reaction.characterId)}に提示`,
        detail: reaction.label,
        fact: reaction.text,
        action: complete ? '提示済みを確認' : '提示へ移動',
      };
    });

  const hearingRoutes = episode.hearing.contradictions
    .filter((contradiction) => contradiction.evidenceId === evidence.id)
    .map((contradiction): EvidenceCourtUseRoute => {
      const statement = episode.hearing.statements.find(
        (item) => item.id === contradiction.statementId,
      );
      const routeInfo = getHearingRouteInfo(state, statement);
      const ready = finalUnlocked && analysisComplete && routeInfo.status === 'ready';
      const complete = routeInfo.status === 'cleared';
      return {
        id: `court-hearing-${contradiction.statementId}`,
        mode: 'hearing',
        tone: 'hearing',
        status: complete ? 'complete' : ready ? 'ready' : 'locked',
        label: 'PRESS',
        title: getContradictionAxis(contradiction.statementId),
        detail: statement?.text ?? contradiction.text,
        fact: getContradictionVerdict(contradiction.statementId),
        action: complete ? '対決を確認' : ready ? 'つきつける' : '前提待ち',
      };
    });

  const deductionRoutes = episode.deduction.questions
    .filter((question) => question.evidenceAnswer === evidence.id)
    .map((question): EvidenceCourtUseRoute => ({
      id: `court-deduction-${question.id}`,
      mode: 'deduction',
      tone: 'deduction',
      status: hearingCleared ? 'ready' : 'locked',
      label: 'FINAL',
      title: question.stageLabel ?? question.prompt,
      detail: question.opponentClaim ?? question.prompt,
      fact: question.rebuttal ?? getDeductionHint(question.id),
      action: hearingCleared ? '推理へ移動' : '対決後に使用',
    }));

  return [...presentRoutes, ...hearingRoutes, ...deductionRoutes];
}

function getEvidenceCourtUseHeadline(
  primary: EvidenceCourtUseRoute,
  readyCount: number,
  completeCount: number,
): string {
  if (readyCount > 1) return `${readyCount}つの法廷アクションで使える`;
  if (readyCount === 1) return `${primary.label}で今使える`;
  if (completeCount > 0) return '成立済みの法廷記録';
  return '後半で効く法廷記録';
}

function getEvidenceCourtUseStatus(status: EvidenceCourtUseRoute['status']): string {
  if (status === 'ready') return '使用可';
  if (status === 'complete') return '成立済';
  return '前提待ち';
}

function getEvidenceRoleHeadline(evidenceId: string, usageCount: number, guideCount: number): string {
  if (guideCount > 0) return '次の行動に使える記録';
  if (usageCount >= 3) return '複数の論点をつなぐ中核記録';
  if (usageCount > 0) return '特定場面で効く記録';
  if (evidenceId === 'old-draft') return '事件の出発点になる記録';
  return '単独で読み返す記録';
}

function getEvidenceRoleDetail(evidenceId: string): string {
  switch (evidenceId) {
    case 'old-draft':
      return '削除された一文の意味と、誰がその危険性を知っていたかを考える出発点。';
    case 'file-history':
      return '触れられた端末と時刻を特定し、証言の逃げ道を狭める。';
    case 'visitor-log':
      return '誰が現場に来たかを時刻で押さえ、機会の論点を支える。';
    case 'scheduled-message':
      return '削除後に説明を準備していたことを示し、最終推理の決め手になる。';
    case 'phone-note':
      return '問題の一文が反撃材料になる危険性を示し、理由の論点を支える。';
    default:
      return '事件ファイル、会話、対決のどこへ接続するかを確認する。';
  }
}

function EvidenceTestimonyLinkPanel({
  state,
  evidence,
  onOpenTestimony,
}: {
  state: GameState;
  evidence: Evidence;
  onOpenTestimony: () => void;
}) {
  const links = episode.hearing.contradictions
    .filter((contradiction) => contradiction.evidenceId === evidence.id)
    .map((contradiction) => {
      const statement = episode.hearing.statements.find(
        (item) => item.id === contradiction.statementId,
      );
      const routeInfo = getHearingRouteInfo(state, statement);
      const pressed = Boolean(statement?.pressFlag && state.flags.includes(statement.pressFlag));
      return { contradiction, pressed, routeInfo, statement };
    });

  if (!links.length) return null;

  return (
    <aside className="evidence-testimony-link" aria-label="証言録リンク">
      <div className="evidence-testimony-heading">
        <div>
          <span>証言録リンク</span>
          <strong>{evidence.name}で崩す発言</strong>
          <p>この証拠が対決のどの発言へ当たるかを確認し、証言録へ戻る。</p>
        </div>
        <button className="secondary-button" type="button" onClick={onOpenTestimony}>
          証言録で読む
        </button>
      </div>
      <div className="evidence-testimony-list">
        {links.map(({ contradiction, pressed, routeInfo, statement }) => (
          <article className={`status-${routeInfo.status}`} key={contradiction.statementId}>
            <span>{getTestimonyFileStatusLabel(routeInfo.status, pressed)}</span>
            <strong>{statement?.speaker ?? '証言者'}</strong>
            <p>{statement?.text ?? contradiction.text}</p>
            <small>{getEvidenceTestimonyLinkDetail(routeInfo, pressed)}</small>
          </article>
        ))}
      </div>
    </aside>
  );
}

function getEvidenceTestimonyLinkDetail(
  routeInfo: HearingRouteInfo,
  pressed: boolean,
): string {
  if (routeInfo.status === 'cleared') return 'この証拠で成立済みの矛盾として記録されている。';
  if (routeInfo.status === 'ready') return '証言録で発言を読み直せば、そのまま提示できる。';
  if (routeInfo.status === 'needs-press') {
    return pressed
      ? '追及後の補足は残っている。証言録で当てる記録として確認する。'
      : '先に詳しく聞くと、この証拠を当てる形に発言が狭まる。';
  }
  if (routeInfo.status === 'locked') return 'まだ前段の矛盾を崩す必要がある。';
  return '背景発言として、証言録で流れを確認する。';
}

function EvidenceQuickLook({
  evidence,
  onClose,
  onOpenCaseFile,
}: {
  evidence: Evidence;
  onClose: () => void;
  onOpenCaseFile: () => void;
}) {
  return (
    <aside className="evidence-quicklook" aria-label="証拠クイック詳細" role="dialog">
      <div className="quicklook-heading">
        <div>
          <span>証拠詳細</span>
          <strong>{evidence.name}</strong>
        </div>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <EvidenceDetail evidence={evidence} />
      <button className="secondary-button" type="button" onClick={onOpenCaseFile}>
        事件ファイルで開く
      </button>
    </aside>
  );
}

function getEvidenceDiscoveryCue(evidence: Evidence) {
  const timeline = episode.timeline.find((event) => event.evidenceIds?.includes(evidence.id));
  const analysis = episode.analysisLinks.find((link) => link.evidenceIds.includes(evidence.id));
  const usage = getEvidenceUsages(evidence.id)[0];

  if (analysis) {
    return {
      label: '次に読む争点',
      detail: analysis.label,
    };
  }
  if (usage) {
    return {
      label: '使う場面',
      detail: `${usage.label}: ${usage.meta}`,
    };
  }
  if (timeline) {
    return {
      label: '関係する時刻',
      detail: `${timeline.time} ${timeline.title}`,
    };
  }
  return {
    label: '次の確認',
    detail: '事件ファイルで役割を確認する。',
  };
}

function FoundEvidencePanel({
  evidence,
  onClose,
  onOpenCaseFile,
}: {
  evidence: Evidence;
  onClose: () => void;
  onOpenCaseFile: () => void;
}) {
  const cue = getEvidenceDiscoveryCue(evidence);

  return (
    <aside className="evidence-found-panel" aria-label="証拠入手" role="status">
      <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
      <div className="found-evidence-copy">
        <span>{evidence.isKey ? '重要証拠を入手' : '証拠を入手'}</span>
        <h3>{evidence.name}</h3>
        <p>{evidence.description}</p>
        <small>
          {cue.label}: {cue.detail}
        </small>
      </div>
      <div className="found-evidence-actions">
        <button className="secondary-button" type="button" onClick={onOpenCaseFile}>
          事件ファイルで見る
        </button>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </aside>
  );
}

function TheoryProgressCard({
  state,
  evidenceById,
  onOpenTheoryBoard,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
  onOpenTheoryBoard: () => void;
}) {
  const board = episode.caseBoard;
  if (!board) return null;

  const rows = board.issues.map((issue) => {
    const complete = isTheoryIssueComplete(state, issue);
    const unlocked = !issue.requiresFlags?.length || hasAllFlags(state, issue.requiresFlags);
    const acquiredEvidence = issue.evidenceIds.filter((id) => state.evidenceIds.includes(id));
    const status: 'complete' | 'active' | 'locked' = complete
      ? 'complete'
      : unlocked
        ? 'active'
        : 'locked';
    return {
      issue,
      complete,
      unlocked,
      acquiredEvidence,
      status,
    };
  });
  const completeCount = rows.filter((row) => row.complete).length;
  const nextRow = rows.find((row) => !row.complete);
  const nextEvidence = nextRow
    ? nextRow.issue.evidenceIds
        .map((id) => evidenceById.get(id))
        .filter((item): item is Evidence => Boolean(item && state.evidenceIds.includes(item.id)))
        .slice(0, 2)
    : [];

  return (
    <section className="theory-progress-card" aria-label="推理ボード進行">
      <div className="theory-progress-heading">
        <div>
          <span>推理ボード</span>
          <strong>{completeCount}/{rows.length} 論点成立</strong>
        </div>
        <em>{nextRow ? getTheoryProgressLabel(nextRow.issue, nextRow.status) : '成立'}</em>
      </div>
      <div className="theory-progress-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(8, (completeCount / rows.length) * 100)}%` }} />
      </div>
      <p>
        {nextRow
          ? nextRow.complete
            ? nextRow.issue.answer
            : nextRow.unlocked
              ? nextRow.issue.nextAction
              : nextRow.issue.question
          : '4つの論点は証拠でつながっている。最終推理で一本の説明にする。'}
      </p>
      <div className="theory-progress-issues">
        {rows.map(({ issue, status, acquiredEvidence }) => (
          <span className={`status-${status}`} key={issue.id}>
            <CheckCircle2 aria-hidden="true" />
            <small>{issue.label}</small>
            <em>{acquiredEvidence.length}/{issue.evidenceIds.length}</em>
          </span>
        ))}
      </div>
      {nextEvidence.length ? (
        <div className="theory-progress-evidence" aria-label="次の論点の取得済み証拠">
          {nextEvidence.map((item) => (
            <span key={item.id}>
              <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              {item.name}
            </span>
          ))}
        </div>
      ) : null}
      <button className="secondary-button" type="button" onClick={onOpenTheoryBoard}>
        <GitBranch aria-hidden="true" />
        <span>理論タブを開く</span>
      </button>
    </section>
  );
}

function getTheoryProgressLabel(
  issue: CaseBoardIssue,
  status: 'complete' | 'active' | 'locked',
): string {
  if (status === 'complete') return '成立';
  if (status === 'active') return issue.label;
  return '前提待ち';
}

function SessionBookmark({
  state,
  history,
  evidenceById,
  onOpenLog,
  onGoNext,
}: {
  state: GameState;
  history: GameLogEntry[];
  evidenceById: Map<string, Evidence>;
  onOpenLog: () => void;
  onGoNext: () => void;
}) {
  const latest = history[history.length - 1];
  const guide = getConsultation(state);
  const command = commandItems.find((item) => item.mode === guide.nextMode);
  const CommandIcon = command?.icon ?? Lightbulb;
  const currentLocation = episode.locations.find((location) => location.id === state.currentLocationId);
  const clearedContradictions = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;
  const completedIssues = episode.caseBoard?.issues.filter((issue) => isTheoryIssueComplete(state, issue)).length ?? 0;
  const progressItems = [
    { label: 'Evidence', value: `${state.evidenceIds.length}/${episode.evidence.length}` },
    { label: 'Hearing', value: `${clearedContradictions}/${episode.hearing.contradictions.length}` },
    { label: 'Theory', value: `${completedIssues}/${episode.caseBoard?.issues.length ?? 0}` },
  ];
  const evidence =
    latest?.evidenceIds
      ?.map((id) => evidenceById.get(id))
      .filter((item): item is Evidence => Boolean(item))
      .slice(0, 3) ?? [];

  return (
    <section className="session-bookmark" aria-label="再開メモ">
      <div className="session-bookmark-heading">
        <div>
          <span>{latest ? '自動保存' : '再開メモ'}</span>
          <strong>{latest?.note ?? '操作ごとに進行を保存'}</strong>
        </div>
        <em>{latest ? getModeName(latest.mode) : '準備中'}</em>
      </div>
      <p>{latest?.text ?? '調査を進めると、直近の行動がここに残る。'}</p>
      <div className="session-resume-route" aria-label="Resume route">
        <span>Location</span>
        <strong>{currentLocation?.name ?? getModeName(state.mode)}</strong>
        <em>{command?.label ?? guide.nextLabel}</em>
      </div>
      <div className="session-next-step" aria-label="Next resume action">
        <span>Next</span>
        <strong>{guide.title}</strong>
        <p>{guide.summary}</p>
      </div>
      <div className="session-progress-mini" aria-label="Resume progress">
        {progressItems.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      {latest ? (
        <small>
          {formatBookmarkTime(latest.createdAt)} 保存 / {getModeName(latest.mode)}
        </small>
      ) : null}
      {evidence.length ? (
        <div className="session-bookmark-evidence" aria-label="直近の関連証拠">
          {evidence.map((item) => (
            <span key={item.id}>
              <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              {item.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="session-bookmark-actions">
        <button className="secondary-button" type="button" onClick={onOpenLog}>
          <BookOpen aria-hidden="true" />
          <span>
        ログを読む
          </span>
        </button>
        <button className="secondary-button session-next-button" type="button" onClick={onGoNext}>
          <CommandIcon aria-hidden="true" />
          <span>{guide.nextLabel}</span>
        </button>
      </div>
    </section>
  );
}

function formatBookmarkTime(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return '保存済み';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt));
}

function PursuitMemo({
  notes,
  evidenceById,
}: {
  notes: PursuitNote[];
  evidenceById: Map<string, Evidence>;
}) {
  if (!notes.length) return null;

  return (
    <section className="pursuit-memo" aria-label="追及メモ">
      <div className="pursuit-memo-heading">
        <span>追及メモ</span>
        <strong>直近の突破点</strong>
      </div>
      {notes.map((note) => {
        const evidenceNames = note.evidenceIds
          .map((id) => evidenceById.get(id)?.name)
          .filter((name): name is string => Boolean(name));

        return (
          <article className={`pursuit-note tone-${note.tone}`} key={note.id}>
            <span>{note.title}</span>
            <strong>{note.subtitle}</strong>
            <p>{note.conclusion}</p>
            {evidenceNames.length ? (
              <div className="pursuit-note-evidence">
                {evidenceNames.map((name) => (
                  <em key={name}>{name}</em>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function PeopleFile({
  state,
  characters,
  evidenceById,
  onModeChange,
}: {
  state: GameState;
  characters: Character[];
  evidenceById: Map<string, Evidence>;
  onModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="people-grid">
      {characters.map((character) => {
        const dossier = getCharacterDossier(character, state, evidenceById);
        return (
          <article className={`person-card status-${dossier.status}`} key={character.id}>
            <img src={getCharacterPortrait(character, dossier.status === 'pressure' ? 'pressure' : 'neutral')} alt="" />
            <div className="person-card-main">
              <div className="person-card-heading">
                <div>
                  <h3>{character.name}</h3>
                  <span>{character.role}</span>
                </div>
                <em>{dossier.label}</em>
              </div>
              <p>{character.summary}</p>
              <div className="person-dossier-grid">
                <section>
                  <span>Role</span>
                  <strong>{dossier.role}</strong>
                  <p>{dossier.detail}</p>
                </section>
                <section>
                  <span>Next use</span>
                  <strong>{dossier.nextTitle}</strong>
                  <p>{dossier.nextDetail}</p>
                </section>
              </div>
              {dossier.evidence.length ? (
                <div className="person-evidence-row" aria-label={`${character.name} related evidence`}>
                  {dossier.evidence.map((item) => (
                    <span key={item.id}>
                      <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                      {item.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="person-card-actions">
                <button className="secondary-button" type="button" onClick={() => onModeChange('present')}>
                  見せる
                </button>
                <button className="secondary-button" type="button" onClick={() => onModeChange('talk')}>
                  話す
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function getCharacterDossier(
  character: Character,
  state: GameState,
  evidenceById: Map<string, Evidence>,
): {
  status: 'neutral' | 'pressure' | 'cleared';
  label: string;
  role: string;
  detail: string;
  nextTitle: string;
  nextDetail: string;
  evidence: Evidence[];
} {
  const presentRoutes = episode.presentReactions.filter(
    (reaction) => reaction.characterId === character.id,
  );
  const readyRoutes = presentRoutes.filter(
    (reaction) =>
      state.evidenceIds.includes(reaction.evidenceId) &&
      canRunInteraction(state, reaction) &&
      (!reaction.availableAt?.length || reaction.availableAt.includes(state.currentLocationId)),
  );
  const relatedEvidence = presentRoutes
    .map((reaction) => evidenceById.get(reaction.evidenceId))
    .filter((item): item is Evidence => Boolean(item && state.evidenceIds.includes(item.id)));

  if (readyRoutes.length) {
    return {
      status: 'pressure',
      label: `${readyRoutes.length} route`,
      role: getCharacterRoleSummary(character.id),
      detail: 'この人物には、今の場所と取得済み証拠で動かせる提示ルートがある。',
      nextTitle: readyRoutes[0].label,
      nextDetail: '提示画面で人物と証拠を組み合わせ、発言を動かす。',
      evidence: relatedEvidence.slice(0, 3),
    };
  }

  if (presentRoutes.some((reaction) => reaction.setFlags?.some((flag) => state.flags.includes(flag)))) {
    return {
      status: 'cleared',
      label: 'cleared',
      role: getCharacterRoleSummary(character.id),
      detail: 'この人物から必要な反応は引き出している。次は別の人物か論点整理へ進む。',
      nextTitle: '整理へ回す',
      nextDetail: '人物の発言を証拠同士の関係に変換する。',
      evidence: relatedEvidence.slice(0, 3),
    };
  }

  return {
    status: 'neutral',
    label: 'watch',
    role: getCharacterRoleSummary(character.id),
    detail: 'まだ直接動かせる提示ルートは見えていない。会話、調査、事件ファイルで前提を増やす。',
    nextTitle: '前提を集める',
    nextDetail: 'この人物に刺さる証拠が取得済みか、場所条件を満たしているか確認する。',
    evidence: relatedEvidence.slice(0, 3),
  };
}

function getCharacterRoleSummary(characterId: string) {
  switch (characterId) {
    case 'clerk-a':
      return '最初に疑われるが、時刻と印刷履歴で切り分ける人物。';
    case 'client-b':
      return '消えた一文の危険性と削除後の説明をつなぐ中心人物。';
    case 'assistant':
      return '証拠の読み筋を整理し、プレイヤーの次手を支える相棒。';
    default:
      return '事件の説明を動かす関係者。';
  }
}

function TimelineFile({
  state,
  events,
  evidenceById,
}: {
  state: GameState;
  events: TimelineEvent[];
  evidenceById: Map<string, Evidence>;
}) {
  if (!events.length) return <p className="empty-text">時系列に置ける記録はまだない。</p>;

  const acquiredEvidenceIds = new Set(state.evidenceIds);
  const eventEvidenceCount = events.reduce(
    (count, event) =>
      count + (event.evidenceIds ?? []).filter((id) => acquiredEvidenceIds.has(id)).length,
    0,
  );

  return (
    <div className="timeline-file">
      <section className="timeline-brief" aria-label="時系列解析">
        <div>
          <span>時系列解析</span>
          <strong>{getTimelineBriefTitle(events)}</strong>
          <p>{getTimelineBriefDetail(events)}</p>
        </div>
        <em>
          {events.length}/{episode.timeline.length}
          <small>{eventEvidenceCount}証拠</small>
        </em>
      </section>
      <ol className="timeline-list">
        {events.map((event) => {
          const eventEvidence = (event.evidenceIds ?? [])
            .map((id) => evidenceById.get(id))
            .filter((item): item is Evidence => Boolean(item && acquiredEvidenceIds.has(item.id)));
          return (
            <li key={event.id}>
              <time>{event.time}</time>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <div className="timeline-event-roles">
                  {getTimelineEventRoles(event.id).map((role) => (
                    <span key={role}>{role}</span>
                  ))}
                </div>
                {eventEvidence.length ? (
                  <div className="timeline-event-evidence" aria-label={`${event.title}の証拠`}>
                    {eventEvidence.map((item) => (
                      <em key={item.id}>
                        <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                        {item.name}
                      </em>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function getTimelineBriefTitle(events: TimelineEvent[]): string {
  const eventIds = new Set(events.map((event) => event.id));
  if (eventIds.has('timeline-draft')) return '削除後の説明準備までつながった';
  if (eventIds.has('timeline-edit') && eventIds.has('timeline-visit')) return '編集機会の時間帯が見えた';
  if (eventIds.has('timeline-visit')) return '来訪者の動線が残っている';
  if (eventIds.has('timeline-print')) return '最初の疑いを時刻で外す';
  return '取得済み記録を時刻順に読む';
}

function getTimelineBriefDetail(events: TimelineEvent[]): string {
  const eventIds = new Set(events.map((event) => event.id));
  if (eventIds.has('timeline-draft')) {
    return '来訪、保存、削除後の説明準備が並び、最終推理の決め手まで読める。';
  }
  if (eventIds.has('timeline-edit') && eventIds.has('timeline-visit')) {
    return '来訪カードと更新履歴を並べると、権限ではなく触れられた機会が焦点になる。';
  }
  if (eventIds.has('timeline-visit')) {
    return '誰が深夜の事務所内にいたかを、人物説明ではなく記録から確認する。';
  }
  return '各時刻がどの証拠で裏付けられているかを確認し、事件ファイルで読み返す。';
}

function getTimelineEventRoles(eventId: string): string[] {
  switch (eventId) {
    case 'timeline-print':
      return ['誤誘導を外す', '真壁犯人説を弱める'];
    case 'timeline-visit':
      return ['久世の動線', '削除者の前提'];
    case 'timeline-edit':
      return ['権限ではなく機会', '対決で使う時刻'];
    case 'timeline-draft':
      return ['削除後の説明準備', '最終推理の決め手'];
    default:
      return ['時刻の裏付け'];
  }
}

function TestimonyFile({
  state,
  evidenceById,
  onOpenEvidence,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const updatedStatements = episode.hearing.statements.filter(
    (statement) => statement.pressFlag && state.flags.includes(statement.pressFlag),
  );
  const clearedContradictions = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  );

  return (
    <div className="testimony-file">
      <section className="testimony-file-brief" aria-label="証言録">
        <div>
          <span>証言録</span>
          <strong>{getTestimonyFileHeadline(updatedStatements.length, clearedContradictions.length)}</strong>
          <p>
            対決で詳しく聞いた発言を、追及後の補足と次に当てる記録ごと読み返す。
          </p>
        </div>
        <em>
          {updatedStatements.length}/{episode.hearing.statements.filter((statement) => statement.pressText).length}
          <small>{clearedContradictions.length}突破</small>
        </em>
      </section>
      <div className="testimony-file-grid">
        {episode.hearing.statements.map((statement, index) => (
          <TestimonyFileCard
            key={statement.id}
            index={index}
            state={state}
            statement={statement}
            evidenceById={evidenceById}
            onOpenEvidence={onOpenEvidence}
          />
        ))}
      </div>
    </div>
  );
}

function TestimonyFileCard({
  state,
  statement,
  evidenceById,
  index,
  onOpenEvidence,
}: {
  state: GameState;
  statement: HearingStatement;
  evidenceById: Map<string, Evidence>;
  index: number;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const routeInfo = getHearingRouteInfo(state, statement);
  const pressed = Boolean(statement.pressFlag && state.flags.includes(statement.pressFlag));
  const speaker = statement.characterId
    ? episode.characters.find((character) => character.id === statement.characterId)
    : undefined;
  const contradiction = episode.hearing.contradictions.find(
    (item) => item.statementId === statement.id,
  );
  const contradictionEvidence = contradiction ? evidenceById.get(contradiction.evidenceId) : undefined;
  const pressCandidate = getHearingPressEvidenceCandidate(statement.id);
  const candidateEvidence = pressCandidate.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const evidenceToShow = contradictionEvidence ? [contradictionEvidence] : candidateEvidence;

  return (
    <article className={`testimony-file-card status-${routeInfo.status}`}>
      <header>
        <img
          src={getCharacterPortrait(speaker, getHearingPortraitTone(routeInfo, state.tone))}
          alt=""
        />
        <div>
          <span>
            {String(index + 1).padStart(2, '0')} {routeInfo.label}
          </span>
          <strong>{speaker?.name ?? statement.speaker}</strong>
          <p>{getTestimonyFileStatusDetail(routeInfo, pressed)}</p>
        </div>
        <em>{getTestimonyFileStatusLabel(routeInfo.status, pressed)}</em>
      </header>
      <div className="testimony-file-body">
        <section>
          <span>元の発言</span>
          <p>{statement.text}</p>
        </section>
        <section>
          <span>{pressed ? '追及後の補足' : '追及の狙い'}</span>
          <p>
            {pressed
              ? statement.pressText ?? statement.note
              : statement.pressText
                ? '詳しく聞くと、発言が証拠へ当てられる形まで狭まる。'
                : statement.note}
          </p>
        </section>
        <section>
          <span>当てる記録</span>
          {evidenceToShow.length ? (
            <div className="testimony-file-evidence">
              {evidenceToShow.map((item) => (
                <button type="button" key={item.id} onClick={() => onOpenEvidence(item.id)}>
                  <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                  <strong>{item.name}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>背景確認用の発言。詳しく聞いてから核心発言へ移る。</p>
          )}
          <small>{getTestimonyFileEvidenceReason(statement.id, routeInfo)}</small>
        </section>
      </div>
    </article>
  );
}

function getTestimonyFileHeadline(updatedCount: number, clearedCount: number): string {
  if (clearedCount >= episode.hearing.contradictions.length) return '証言の逃げ道は崩れている';
  if (updatedCount) return '追及後の補足を証拠に当てる';
  return 'まず詳しく聞いて発言を狭める';
}

function getTestimonyFileStatusLabel(status: HearingRouteStatus, pressed: boolean): string {
  if (status === 'cleared') return '突破済み';
  if (status === 'ready') return '提示可能';
  if (status === 'locked') return '前提待ち';
  if (status === 'needs-press') return pressed ? '更新済み' : '要追及';
  return pressed ? '確認済み' : '背景';
}

function getTestimonyFileStatusDetail(routeInfo: HearingRouteInfo, pressed: boolean): string {
  if (routeInfo.status === 'ready') return 'この発言は記録で崩せる段階に入っている。';
  if (routeInfo.status === 'cleared') return 'すでに対決で崩した発言。';
  if (routeInfo.status === 'locked') return '先に別の矛盾を崩す必要がある。';
  if (routeInfo.status === 'needs-press') {
    return pressed ? '追及後の補足が残っている。' : '詳しく聞いて発言の弱点を固定する。';
  }
  return pressed ? '背景は固まっている。' : '対決の足場にする発言。';
}

function getTestimonyFileEvidenceReason(
  statementId: string,
  routeInfo: HearingRouteInfo,
): string {
  if (routeInfo.status === 'cleared') return '成立済みの矛盾として記録を保持する。';
  if (routeInfo.status === 'ready') return 'この記録を示すと証言の主張が狭まる。';
  if (routeInfo.status === 'locked') return 'まだ順番が早い。崩し順メモで前提を確認する。';
  const candidate = getHearingPressEvidenceCandidate(statementId);
  return candidate.reason || 'この発言は移動経路や前提の確認に使う。';
}

function TheoryBoard({
  state,
  evidenceById,
}: {
  state: GameState;
  evidenceById: Map<string, Evidence>;
}) {
  const board = episode.caseBoard;
  if (!board) return <p className="empty-text">論点ボードはまだ用意されていない。</p>;

  const completedIssues = board.issues.filter((issue) => isTheoryIssueComplete(state, issue));

  return (
    <div className="theory-board">
      <header className="theory-board-header">
        <div>
          <span>{board.subtitle}</span>
          <h3>{board.title}</h3>
          <p>{board.summary}</p>
        </div>
        <strong>{completedIssues.length}/{board.issues.length}</strong>
      </header>
      <div className="theory-issue-grid">
        {board.issues.map((issue) => (
          <TheoryIssueCard
            key={issue.id}
            issue={issue}
            state={state}
            evidenceById={evidenceById}
          />
        ))}
      </div>
    </div>
  );
}

function TheoryIssueCard({
  issue,
  state,
  evidenceById,
}: {
  issue: CaseBoardIssue;
  state: GameState;
  evidenceById: Map<string, Evidence>;
}) {
  const acquiredEvidenceIds = issue.evidenceIds.filter((id) => state.evidenceIds.includes(id));
  const issueComplete = isTheoryIssueComplete(state, issue);
  const issueUnlocked = !issue.requiresFlags?.length || hasAllFlags(state, issue.requiresFlags);
  const status = issueComplete ? 'complete' : issueUnlocked ? 'active' : 'locked';

  return (
    <article className={`theory-issue-card status-${status}`}>
      <div className="theory-issue-title">
        <span>{issue.label}</span>
        <div>
          <h4>{issue.title}</h4>
          <small>{acquiredEvidenceIds.length}/{issue.evidenceIds.length} 証拠</small>
        </div>
      </div>
      <p className="theory-question">{issue.question}</p>
      <p className="theory-answer">
        {issueComplete ? issue.answer : issueUnlocked ? issue.nextAction : 'まだ材料が足りない。調査、整理、対決で前提を固める。'}
      </p>
      <div className="theory-evidence-row" aria-label={`${issue.title}の証拠`}>
        {issue.evidenceIds.map((id) => {
          const evidence = evidenceById.get(id);
          const acquired = state.evidenceIds.includes(id);
          return (
            <span className={acquired ? 'acquired' : 'locked'} key={id}>
              {acquired && evidence ? (
                <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              ) : null}
              {acquired && evidence ? evidence.name : '未入手'}
            </span>
          );
        })}
      </div>
    </article>
  );
}

function isTheoryIssueComplete(state: GameState, issue: CaseBoardIssue): boolean {
  return (
    issue.evidenceIds.every((id) => state.evidenceIds.includes(id)) &&
    (!issue.requiresFlags?.length || hasAllFlags(state, issue.requiresFlags))
  );
}

function CaseReviewPanel({
  state,
  unlocked,
  evidenceById,
  onModeChange,
}: {
  state: GameState;
  unlocked: boolean;
  evidenceById: Map<string, Evidence>;
  onModeChange: (mode: ViewMode) => void;
}) {
  const review = episode.caseReview;

  if (!unlocked || !review) {
    return (
      <section className="action-stack">
        <PanelTitle icon={FileCheck2} title="事件解剖" subtitle="クリア後に解放" />
        <p className="empty-text">最終推理を成立させると、真相と証拠の役割を読み返せる。</p>
      </section>
    );
  }

  return (
    <section className="action-stack case-review-panel">
      <PanelTitle icon={FileCheck2} title={review.title} subtitle={review.subtitle} />
      <p className="panel-copy">{review.summary}</p>
      <ReviewScorecard state={state} />
      <ReviewRankPanel state={state} />
      <div className="review-hero">
        <strong>結論成立</strong>
        <span>削除者、理由、機会、決め手を記録で説明できる状態になった。</span>
      </div>
      <ReviewSection title="結論" points={review.conclusions} evidenceById={evidenceById} />
      <ReviewSection title="証拠の鎖" points={review.evidenceChain} evidenceById={evidenceById} />
      <ReviewSection title="提出前の判断メモ" points={review.practiceNotes} evidenceById={evidenceById} />
      <div className="story-actions">
        <button className="primary-button" type="button" onClick={() => onModeChange('materials')}>
          制作資料へ
        </button>
        <button className="secondary-button" type="button" onClick={() => onModeChange('evidence')}>
          事件ファイルへ
        </button>
        <button className="secondary-button" type="button" onClick={() => onModeChange('log')}>
          ログを読む
        </button>
      </div>
    </section>
  );
}

function ReviewRankPanel({ state }: { state: GameState }) {
  const evidenceCount = state.evidenceIds.length;
  const totalEvidence = episode.evidence.length;
  const clearedContradictions = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;
  const totalContradictions = episode.hearing.contradictions.length;
  const completedIssues =
    episode.caseBoard?.issues.filter((issue) => isTheoryIssueComplete(state, issue)).length ?? 0;
  const totalIssues = episode.caseBoard?.issues.length ?? 0;
  const credibility = state.credibility ?? MAX_CREDIBILITY;
  const score =
    evidenceCount * 8 +
    clearedContradictions * 14 +
    completedIssues * 10 +
    credibility * 6;
  const maxScore = totalEvidence * 8 + totalContradictions * 14 + totalIssues * 10 + MAX_CREDIBILITY * 6;
  const percent = Math.round((score / maxScore) * 100);
  const rank = percent >= 95 ? 'S' : percent >= 85 ? 'A' : percent >= 70 ? 'B' : 'C';
  const nextItems = [
    {
      label: 'Case file',
      value: `${evidenceCount}/${totalEvidence}`,
      detail: evidenceCount >= totalEvidence ? 'All records secured.' : 'Recover the missing records.',
    },
    {
      label: 'Hearing',
      value: `${clearedContradictions}/${totalContradictions}`,
      detail:
        clearedContradictions >= totalContradictions
          ? 'Witness contradictions are broken.'
          : 'Finish the remaining contradiction.',
    },
    {
      label: 'Theory',
      value: `${completedIssues}/${totalIssues}`,
      detail:
        completedIssues >= totalIssues
          ? 'The theory board is complete.'
          : 'Connect the remaining issue.',
    },
  ];

  return (
    <section className={`review-rank-panel rank-${rank.toLowerCase()}`} aria-label="clear rank">
      <div className="review-rank-heading">
        <div>
          <span>CLEAR RANK</span>
          <strong>Rank {rank}</strong>
          <p>{getReviewRankDetail(rank, percent)}</p>
        </div>
        <em>{percent}%</em>
      </div>
      <div className="review-rank-meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="review-rank-grid">
        {nextItems.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function getReviewRankDetail(rank: string, percent: number): string {
  if (rank === 'S') return `Near-complete clear. The case reads as a finished sequel route at ${percent}%.`;
  if (rank === 'A') return 'Strong clear. A few optional confirmations remain before a perfect case file.';
  if (rank === 'B') return 'Solid clear. The truth is reached, but supporting routes can still be sharpened.';
  return 'Clear achieved. Review the missing records and contradictions to strengthen the route.';
}

function ReviewScorecard({ state }: { state: GameState }) {
  const evidenceCount = state.evidenceIds.length;
  const totalEvidence = episode.evidence.length;
  const clearedContradictions = episode.hearing.contradictions.filter((contradiction) =>
    contradiction.setFlags?.some((flag) => state.flags.includes(flag)),
  ).length;
  const completedIssues =
    episode.caseBoard?.issues.filter((issue) => isTheoryIssueComplete(state, issue)).length ?? 0;
  const totalIssues = episode.caseBoard?.issues.length ?? 0;
  const stats = [
    {
      label: '証拠収集',
      value: `${evidenceCount}/${totalEvidence}`,
      detail: '事件ファイルに残った記録',
    },
    {
      label: '対決突破',
      value: `${clearedContradictions}/${episode.hearing.contradictions.length}`,
      detail: '証言と証拠の矛盾',
    },
    {
      label: '論点成立',
      value: `${completedIssues}/${totalIssues}`,
      detail: '推理ボードの完成度',
    },
    {
      label: '信用',
      value: `${state.credibility ?? MAX_CREDIBILITY}/${MAX_CREDIBILITY}`,
      detail: '最終時点の信用',
    },
  ];

  return (
    <section className="review-scorecard" aria-label="クリア成績">
      <div className="review-scorecard-heading">
        <span>クリア成績</span>
        <strong>読み切った筋道</strong>
        <p>調査、対決、最終推理で積み上げた到達内容を確認する。</p>
      </div>
      <div className="review-score-grid">
        {stats.map((stat) => (
          <article key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewSection({
  title,
  points,
  evidenceById,
}: {
  title: string;
  points: CaseReviewPoint[];
  evidenceById: Map<string, Evidence>;
}) {
  return (
    <section className="review-section">
      <h3>{title}</h3>
      <div className="review-grid">
        {points.map((point) => (
          <article className="review-card" key={point.id}>
            <span>{point.label}</span>
            <strong>{point.title}</strong>
            <p>{point.text}</p>
            {point.evidenceIds?.length ? (
              <div className="review-evidence" aria-label={`${point.title}の関連証拠`}>
                {point.evidenceIds.map((id) => {
                  const evidence = evidenceById.get(id);
                  if (!evidence) return null;
                  return (
                    <span key={id}>
                      <img src={evidence.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                      {evidence.name}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductionMaterialsPanel({
  unlocked,
  onModeChange,
}: {
  unlocked: boolean;
  onModeChange: (mode: ViewMode) => void;
}) {
  const materials = episode.productionMaterials;

  if (!unlocked || !materials) {
    return (
      <section className="action-stack">
        <PanelTitle icon={BookOpen} title="制作資料" subtitle="クリア後に解放" />
        <p className="empty-text">事件解剖を読める状態になると、脚本メモも開ける。</p>
      </section>
    );
  }

  return (
    <section className="action-stack materials-panel">
      <PanelTitle icon={BookOpen} title={materials.title} subtitle={materials.subtitle} />
      <p className="panel-copy">{materials.summary}</p>
      <ProductionRoadmapPanel />
      <FinishAuditPanel />
      <ReleaseGatePanel />
      <AssetSwapPlanPanel />
      <div className="materials-grid">
        {materials.notes.map((note, index) => (
          <ProductionNoteCard key={note.id} note={note} index={index} />
        ))}
      </div>
      <div className="story-actions">
        <button className="secondary-button" type="button" onClick={() => onModeChange('review')}>
          事件解剖へ戻る
        </button>
        <button className="secondary-button" type="button" onClick={() => onModeChange('evidence')}>
          事件ファイルへ
        </button>
      </div>
    </section>
  );
}

function AssetSwapPlanPanel() {
  const storyScenes = [
    ...(episode.openingScenes ?? []),
    ...(episode.endings.success.scenes ?? []),
    ...(episode.endings.failure.scenes ?? []),
  ];
  const assetStats = getAssetRegistryStats();
  const portraitVariants = episode.characters.reduce(
    (count, character) => count + Object.keys(character.portraitVariants ?? {}).length,
    0,
  );
  const imageSlots = {
    locations: episode.locations.filter((location) => Boolean(location.image)).length,
    evidence: episode.evidence.filter((item) => Boolean(item.image)).length,
    characters: episode.characters.filter((character) => Boolean(character.portrait)).length + portraitVariants,
    story: storyScenes.filter((scene) => Boolean(scene.image)).length,
  };

  const assetGroups = [
    {
      label: 'Locations',
      count: `${imageSlots.locations} slots`,
      path: 'public/assets/locations/',
      target: '会議室、記録棚、コピー室、受付前の背景を先に高品質化する。',
      rule: '同じ画角でPNG/WebPへ差し替え、場所名と調査ポイントの読みやすさを優先する。',
    },
    {
      label: 'Evidence',
      count: `${imageSlots.evidence} slots`,
      path: 'public/assets/evidence/',
      target: '旧版、赤入れ、履歴、メモ類を証拠カードとして判別できる絵にする。',
      rule: '証拠名と形状が一目で分かる構図にして、UI上のサムネイルでも潰れない密度にする。',
    },
    {
      label: 'Characters',
      count: `${episode.characters.length} roles / ${imageSlots.characters} portraits`,
      path: 'public/assets/characters/',
      target: '主人公、主任弁護士、事務員、依頼者の役割差を表情とシルエットで出す。',
      rule: 'neutral、pressure、damageなど既存toneの参照を維持し、顔の向きと明度をそろえる。',
    },
    {
      label: 'Story CG',
      count: `${imageSlots.story} beats`,
      path: 'openingScenes / endings',
      target: '提出前夜、記録棚、真相、提出判断を章間CGとして強く見せる。',
      rule: '本編背景を流用する場合も、開幕と終幕では余白と焦点を変えて幕絵として成立させる。',
    },
  ];

  return (
    <section className="asset-swap-plan" aria-label="asset swap plan">
      <div className="asset-swap-heading">
        <div>
          <span>ASSET SWAP PLAN</span>
          <strong>仮画像から高品質画像へ差し替える設計</strong>
          <p>いまの仮SVGを壊さず、後から生成画像を同じスロットへ入れるための制作順と差し替えルール。</p>
        </div>
        <em>{imageSlots.locations + imageSlots.evidence + imageSlots.characters + imageSlots.story} slots</em>
      </div>
      <div className="asset-swap-grid">
        {assetGroups.map((group, index) => (
          <article className="asset-swap-card" key={group.label}>
            <div>
              <span>{String(index + 1).padStart(2, '0')} {group.label}</span>
              <em>{group.count}</em>
            </div>
            <strong>{group.path}</strong>
            <p>{group.target}</p>
            <small>{group.rule}</small>
          </article>
        ))}
      </div>
      <div className="asset-swap-brief">
        <span>GENERATION BRIEF</span>
        <p>法廷ミステリー向けの落ち着いた照明、読みやすい証拠形状、UIサムネイルで潰れない構図を基準にする。</p>
      </div>
      <div className="asset-manifest-strip" aria-label="asset key manifest">
        <span>ASSET KEY MANIFEST</span>
        <p>
          <strong>{assetStats.total} keys</strong>
          <em>{assetStats.locations} locations</em>
          <em>{assetStats.evidence} evidence</em>
          <em>{assetStats.characters} portraits</em>
          <em>{assetStats.scenes} scenes</em>
        </p>
      </div>
    </section>
  );
}

function FinishAuditPanel() {
  const auditItems = [
    {
      label: 'Core loop',
      score: 'Ready',
      title: '調査から最終弁論まで1本で遊べる',
      detail: '調査、提示、整理、対決、推理、事件解剖までが保存付きの1周ルートとして成立している。',
    },
    {
      label: 'Courtroom feel',
      score: 'Strong',
      title: '対決と証拠提示の手触りが出ている',
      detail: '法廷ベンチ、異議ありキュー、記録照合、ゆさぶり更新、最終評決で見せ場を作れている。',
    },
    {
      label: 'Guidance',
      score: 'Strong',
      title: '初見でも戻り先が分かる',
      detail: 'Case Director、Chapter Guide、相談メモ、事件ファイルの用途表示で次の操作を追える。',
    },
    {
      label: 'Presentation',
      score: 'Ready',
      title: '音響、テンポ、章間密度を調整済み',
      detail: 'SOUNDTRACK、演出テンポ、TRIAL FLOW、COURT USEで、法廷ゲームとしての間と読み筋を補強している。',
    },
  ];

  return (
    <section className="finish-audit" aria-label="finish audit">
      <div className="finish-audit-heading">
        <div>
          <span>FINISH AUDIT</span>
          <strong>Case 02の仕上げ評価</strong>
          <p>現時点で完成している体験と、最後に磨くべき項目を制作目線で切り分ける。</p>
        </div>
        <em>4 checks</em>
      </div>
      <div className="finish-audit-grid">
        {auditItems.map((item, index) => (
          <article key={item.label}>
            <div>
              <span>{String(index + 1).padStart(2, '0')} {item.label}</span>
              <em>{item.score}</em>
            </div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReleaseGatePanel() {
  const gates = [
    {
      label: 'Playable route',
      status: 'pass',
      title: 'クリアまでの1周ルート',
      detail: '調査、提示、整理、対決、推理、終幕、事件解剖、制作資料まで通しで確認済み。',
    },
    {
      label: 'Court systems',
      status: 'pass',
      title: '法廷の手触り',
      detail: '異議あり、ゆさぶり、ペナルティ、証言更新、証拠照合、評決演出をUIとテストで保持している。',
    },
    {
      label: 'Audio pacing',
      status: 'pass',
      title: '音響と演出尺',
      detail: 'Web Audioモチーフ、SOUNDTRACKパネル、速い/標準/じっくりのテンポ設定を実装済み。',
    },
    {
      label: 'Asset swap',
      status: 'external',
      title: '高品質画像への差し替え',
      detail: '仮SVGの参照パスは安定。後から生成画像を同じスロットへ差し替えられる。',
    },
  ];

  const passed = gates.filter((gate) => gate.status === 'pass').length;

  return (
    <section className="release-gate" aria-label="release gate">
      <div className="release-gate-heading">
        <div>
          <span>RELEASE GATE</span>
          <strong>Case 02の出荷前ゲート</strong>
          <p>コード側で完了した項目と、外部素材差し替えに残す項目を分けて確認する。</p>
        </div>
        <em>{passed}/{gates.length}</em>
      </div>
      <div className="release-gate-grid">
        {gates.map((gate, index) => (
          <article className={`status-${gate.status}`} key={gate.label}>
            <span>{String(index + 1).padStart(2, '0')} {gate.label}</span>
            <strong>{gate.title}</strong>
            <p>{gate.detail}</p>
            <em>{gate.status === 'pass' ? 'PASS' : 'ASSET WAIT'}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductionRoadmapPanel() {
  const roadmap = [
    {
      label: 'Core loop',
      title: '調査、提示、対決、推理を1本の圧にする',
      detail: 'Case 02で増やした各ボードを、次回は章ごとのテンポ差に合わせて出し分ける。',
    },
    {
      label: 'Character',
      title: '人物の弱点を証拠ルートに直結させる',
      detail: '人物ファイルのdossierを起点に、会話、提示、対決で同じ人物像が変化して見える設計にする。',
    },
    {
      label: 'Evidence',
      title: '証拠の役割を最初から複数段に置く',
      detail: '一つの証拠が調査では発見、提示では反応、対決では矛盾、推理では決め手になる流れを作る。',
    },
  ];

  return (
    <section className="production-roadmap" aria-label="case 03 roadmap">
      <div className="production-roadmap-heading">
        <div>
          <span>CASE 03 SEEDS</span>
          <strong>次回に持ち越す設計メモ</strong>
          <p>このCase 02で強くなったシステムを、次の事件でどう使うかを制作ブリーフとして残す。</p>
        </div>
        <em>3 notes</em>
      </div>
      <div className="production-roadmap-grid">
        {roadmap.map((item, index) => (
          <article key={item.label}>
            <span>{String(index + 1).padStart(2, '0')} {item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductionNoteCard({ note, index }: { note: ProductionNote; index: number }) {
  return (
    <article className="materials-card">
      <div className="materials-card-index">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{note.label}</strong>
      </div>
      <div>
        <h3>{note.title}</h3>
        <p>{note.text}</p>
      </div>
      {note.detail ? <small>{note.detail}</small> : null}
    </article>
  );
}

function HistoryCaseSummary({
  entries,
  evidenceById,
  onOpenEvidence,
}: {
  entries: GameLogEntry[];
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const evidenceIds = [
    ...new Set(entries.flatMap((entry) => entry.evidenceIds ?? [])),
  ];
  const evidence = evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item))
    .slice(0, 4);
  const pressureCount = entries.filter((entry) =>
    ['pressure', 'success', 'damage'].includes(entry.tone ?? ''),
  ).length;
  const hearingCount = entries.filter((entry) => entry.mode === 'hearing').length;
  const deductionCount = entries.filter((entry) => ['analysis', 'deduction'].includes(entry.mode)).length;
  const latest = entries[0];

  return (
    <section className="history-case-summary" aria-label="case note summary">
      <div className="history-summary-heading">
        <div>
          <span>CASE NOTE SUMMARY</span>
          <strong>{latest?.note ?? 'No notebook entries yet'}</strong>
          <p>{latest?.text ?? 'Play actions will be summarized here as the case develops.'}</p>
        </div>
        <em>{entries.length}</em>
      </div>
      <div className="history-summary-grid">
        <span>
          <strong>{evidenceIds.length}</strong>
          evidence links
        </span>
        <span>
          <strong>{pressureCount}</strong>
          pressure beats
        </span>
        <span>
          <strong>{hearingCount}</strong>
          hearing notes
        </span>
        <span>
          <strong>{deductionCount}</strong>
          theory notes
        </span>
      </div>
      {evidence.length ? (
        <div className="history-summary-evidence" aria-label="summary evidence">
          {evidence.map((item) => (
            <button type="button" key={item.id} onClick={() => onOpenEvidence(item.id)}>
              <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LogPanel({
  log,
  history,
  charactersById,
  evidenceById,
  onOpenEvidence,
  onModeChange,
}: {
  log: string[];
  history: GameLogEntry[];
  charactersById: Map<string, Character>;
  evidenceById: Map<string, Evidence>;
  onOpenEvidence: (id: string) => void;
  onModeChange: (mode: ViewMode) => void;
}) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const locationById = new Map(episode.locations.map((location) => [location.id, location]));
  const entries = [...history].reverse();
  const filters: Array<{ id: LogFilter; label: string; count: number }> = [
    { id: 'all', label: 'すべて', count: entries.length },
    {
      id: 'evidence',
      label: '証拠付き',
      count: entries.filter((entry) => entry.evidenceIds?.length).length,
    },
    {
      id: 'pressure',
      label: '追及/突破',
      count: entries.filter((entry) => ['pressure', 'success', 'damage'].includes(entry.tone ?? ''))
        .length,
    },
    {
      id: 'hearing',
      label: '対決',
      count: entries.filter((entry) => entry.mode === 'hearing').length,
    },
    {
      id: 'deduction',
      label: '推理',
      count: entries.filter((entry) => ['analysis', 'deduction'].includes(entry.mode)).length,
    },
  ];
  const filteredEntries = entries.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'evidence') return Boolean(entry.evidenceIds?.length);
    if (filter === 'pressure') return ['pressure', 'success', 'damage'].includes(entry.tone ?? '');
    if (filter === 'hearing') return entry.mode === 'hearing';
    return ['analysis', 'deduction'].includes(entry.mode);
  });
  const evidenceEntryCount = filters.find((item) => item.id === 'evidence')?.count ?? 0;
  const pressureEntryCount = filters.find((item) => item.id === 'pressure')?.count ?? 0;

  return (
    <section className="action-stack">
      <PanelTitle icon={ClipboardList} title="ログ" subtitle="会話と調査の履歴" />
      {entries.length ? (
        <div className="history-notebook">
          <div className="history-overview" aria-label="調書ノート集計">
            <span>
              <strong>{entries.length}</strong>
              記録
            </span>
            <span>
              <strong>{evidenceEntryCount}</strong>
              証拠付き
            </span>
            <span>
              <strong>{pressureEntryCount}</strong>
              追及点
            </span>
          </div>
          <HistoryCaseSummary entries={entries} evidenceById={evidenceById} onOpenEvidence={onOpenEvidence} />
          <div className="history-filter-bar" aria-label="ログ絞り込み">
            {filters.map((item) => (
              <button
                className={filter === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          {filteredEntries.length ? (
            <div className="history-list">
              {filteredEntries.map((entry) => {
                const character = entry.speakerId ? charactersById.get(entry.speakerId) : undefined;
                const location = locationById.get(entry.locationId);
                const entryEvidence = entry.evidenceIds
                  ?.map((id) => evidenceById.get(id))
                  .filter((item): item is Evidence => Boolean(item)) ?? [];
                const modeLabel = getModeName(entry.mode);

                return (
                  <article className={`history-entry tone-${entry.tone ?? 'neutral'}`} key={entry.id}>
                    <div className="history-meta">
                      <strong>{character?.name ?? '記録'}</strong>
                      <span>{entry.note ?? modeLabel}</span>
                      <small>{location?.name ?? '場所不明'} / {getModeName(entry.mode)}</small>
                    </div>
                    <div className="history-entry-context" aria-label="log context">
                      <span>
                        <strong>Mode</strong>
                        {modeLabel}
                      </span>
                      <span>
                        <strong>Place</strong>
                        {location?.name ?? 'Unknown'}
                      </span>
                      <span>
                        <strong>Evidence</strong>
                        {entryEvidence.length ? `${entryEvidence.length}` : '0'}
                      </span>
                    </div>
                    <p>{entry.text}</p>
                    {entryEvidence.length ? (
                      <div className="history-evidence" aria-label="取得証拠">
                        {entryEvidence.map((item) => (
                          <button key={item.id} type="button" onClick={() => onOpenEvidence(item.id)}>
                            <img src={item.image ?? withBasePath('/assets/evidence/document-stack.webp')} alt="" />
                            <span>{item.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="history-entry-actions">
                      <button type="button" onClick={() => onModeChange(entry.mode)}>
                        {getModeName(entry.mode)}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-text">この条件に合う記録はまだない。</p>
          )}
        </div>
      ) : log.length ? (
        <ol className="log-list">
          {log.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ol>
      ) : (
        <p className="empty-text">まだ行動ログはない。</p>
      )}
    </section>
  );
}

function getModeName(mode: ViewMode): string {
  switch (mode) {
    case 'briefing':
      return '導入';
    case 'move':
      return '移動';
    case 'inspect':
      return '調査';
    case 'talk':
      return '会話';
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

function PanelTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-title">
      <Icon aria-hidden="true" />
      <div>
        <p>{subtitle}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

