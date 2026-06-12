export type ViewMode =
  | 'briefing'
  | 'move'
  | 'inspect'
  | 'talk'
  | 'present'
  | 'consult'
  | 'analysis'
  | 'hearing'
  | 'deduction'
  | 'evidence'
  | 'log'
  | 'review'
  | 'materials'
  | 'ending';

export type MessageTone = 'neutral' | 'investigation' | 'success' | 'pressure' | 'damage';

export interface Character {
  id: string;
  name: string;
  role: string;
  summary: string;
  portraitAssetKey?: string;
  portrait?: string;
  portraitVariantAssetKeys?: Partial<Record<MessageTone, string>>;
  portraitVariants?: Partial<Record<MessageTone, string>>;
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  detail: string;
  assetKey?: string;
  image?: string;
  isKey?: boolean;
}

export interface ProgressBeat {
  id: string;
  label: string;
  flag: string;
}

export interface StoryScene {
  id: string;
  label: string;
  title: string;
  text: string;
  detail?: string;
  assetKey?: string;
  image?: string;
  speakerId?: string;
  tone?: MessageTone;
}

export interface GameLogEntry {
  id: string;
  mode: ViewMode;
  locationId: string;
  text: string;
  note?: string;
  speakerId?: string;
  tone?: MessageTone;
  evidenceIds?: string[];
  createdAt: number;
}

export interface InteractionEffect {
  text: string;
  addEvidence?: string[];
  setFlags?: string[];
  log?: string;
  speakerId?: string;
  tone?: MessageTone;
}

export interface Interaction extends InteractionEffect {
  id: string;
  label: string;
  requiresFlags?: string[];
  once?: boolean;
}

export interface Location {
  id: string;
  name: string;
  summary: string;
  description: string;
  assetKey?: string;
  image?: string;
  actions: Interaction[];
}

export interface Talk extends Interaction {
  characterId: string;
  availableAt?: string[];
}

export interface PresentReaction extends Interaction {
  characterId: string;
  evidenceId: string;
  availableAt?: string[];
}

export interface AnalysisLink extends InteractionEffect {
  id: string;
  label: string;
  prompt: string;
  evidenceIds: string[];
  requiresFlags?: string[];
}

export interface HearingStatement {
  id: string;
  speaker: string;
  characterId?: string;
  text: string;
  note: string;
  pressText?: string;
  pressFlag?: string;
  pressLog?: string;
}

export interface HearingContradiction extends InteractionEffect {
  statementId: string;
  evidenceId: string;
  requiresFlags?: string[];
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  evidenceIds?: string[];
}

export interface DeductionChoice {
  id: string;
  label: string;
}

export interface DeductionQuestion {
  id: string;
  prompt: string;
  stageLabel?: string;
  opponentClaim?: string;
  rebuttal?: string;
  wrongHint?: string;
  answer: string;
  evidenceAnswer: string;
  choices: DeductionChoice[];
}

export interface CaseReviewPoint {
  id: string;
  label: string;
  title: string;
  text: string;
  evidenceIds?: string[];
}

export interface CaseReview {
  title: string;
  subtitle: string;
  summary: string;
  conclusions: CaseReviewPoint[];
  evidenceChain: CaseReviewPoint[];
  practiceNotes: CaseReviewPoint[];
}

export interface CaseBoardIssue {
  id: string;
  label: string;
  title: string;
  question: string;
  answer: string;
  evidenceIds: string[];
  requiresFlags?: string[];
  nextAction: string;
}

export interface CaseBoard {
  title: string;
  subtitle: string;
  summary: string;
  issues: CaseBoardIssue[];
}

export interface ProductionNote {
  id: string;
  label: string;
  title: string;
  text: string;
  detail?: string;
}

export interface ProductionMaterials {
  title: string;
  subtitle: string;
  summary: string;
  notes: ProductionNote[];
}

export interface Episode {
  id: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  startLocationId: string;
  finalFlag: string;
  premise: string[];
  openingScenes?: StoryScene[];
  progressBeats?: ProgressBeat[];
  characters: Character[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  locations: Location[];
  talks: Talk[];
  presentReactions: PresentReaction[];
  analysisLinks: AnalysisLink[];
  hearing: {
    intro: string;
    requiredFlag: string;
    statements: HearingStatement[];
    contradictions: HearingContradiction[];
  };
  deduction: {
    intro: string;
    questions: DeductionQuestion[];
  };
  caseBoard?: CaseBoard;
  caseReview?: CaseReview;
  productionMaterials?: ProductionMaterials;
  endings: {
    success: {
      title: string;
      text: string;
      scenes?: StoryScene[];
    };
    failure: {
      title: string;
      text: string;
      scenes?: StoryScene[];
    };
  };
}

export interface GameState {
  episodeId: string;
  mode: ViewMode;
  currentLocationId: string;
  narrative: string;
  speakerId?: string;
  tone?: MessageTone;
  credibility: number;
  evidenceIds: string[];
  flags: string[];
  log: string[];
  history: GameLogEntry[];
  completedInteractionIds: string[];
  endingId?: 'success' | 'failure';
}
