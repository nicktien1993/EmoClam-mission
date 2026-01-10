
export type EmotionZone = '開心' | '不開心';

export interface Card {
  id: string;
  type: EmotionZone;
  subType?: 'safe';
  cn: string;
  icon: string;
  isBoss?: boolean;
  suggest?: {
    emo: string;
    need: string;
  };
}

export interface MissionConfig {
  cardCount: number;
  enablePressure: boolean;
  enableBreath: boolean;
  enableReport: boolean;
  pressureDuration: number;
  breathCycles: number;
  inhaleTime: number;
  holdTime: number;
  exhaleTime: number;
}

export interface GameState {
  score: number;
  xp: number;
  round: number;
  totalRounds: number;
  streak: number;
  history: LogEntry[];
  currentRoute: string | null;
  deck: Card[];
  currentCard: Card | null;
  status: 'splash' | 'routing' | 'ready' | 'picking' | 'playing' | 'sop' | 'result';
  sopStep: number;
  missionConfig: MissionConfig;
}

export interface LogEntry {
  timestamp: string;
  type: 'card' | 'decision' | 'sop';
  content: string;
  details?: any;
}

export interface EmotionOption {
  id: string;
  cn: string;
  icon: string;
}

export interface NeedOption {
  id: string;
  cn: string;
  icon: string;
}
