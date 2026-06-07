export type Player = {
  id: string;
  name: string;
  nickname?: string;
  isGuest: boolean;
  archivedAt?: string;
  createdAt: string;
  totalChampionshipPoints: number;
  sessionsPlayed: number;
};

export type SessionStatus = "draft" | "active" | "finalized";

export type Match = {
  id: string;
  sessionId: string;
  matchNumber: number;
  courtNumber: number;
  teamA: string[];
  teamB: string[];
  byes: string[];
  score?: MatchScore;
  status: "scheduled" | "complete";
};

export type MatchScore = {
  teamA: number;
  teamB: number;
  overrideTarget: boolean;
  adminNote?: string;
  enteredAt: string;
};

export type Session = {
  id: string;
  date: string;
  targetScore: number;
  courtCount: number;
  playerIds: string[];
  matches: Match[];
  status: SessionStatus;
  finalizedAt?: string;
  results?: SessionResult[];
  createdAt: string;
  updatedAt: string;
};

export type SessionResult = {
  sessionId: string;
  playerId: string;
  sessionPoints: number;
  position: number;
  championshipPointsAwarded: number;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
};

export type ChampionshipHistory = {
  id: string;
  sessionId?: string;
  playerId: string;
  points: number;
  reason: "initial_seed" | "session_award" | "manual_adjustment";
  awardedAt: string;
  metadata?: Record<string, unknown>;
};

export type AppState = {
  players: Player[];
  sessions: Session[];
  history: ChampionshipHistory[];
  activeSessionId?: string;
};

export type ImportedSessionResult = {
  player: string;
  sessionPoints: number;
  position: number;
  championshipPointsAwarded: number;
};

export type HistoricalImportSession = {
  date: string;
  players: string[];
  targetScore: number;
  results: ImportedSessionResult[];
};

export type PartnerRecord = {
  playerId: string;
  partnerId: string;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type HeadToHeadRecord = {
  playerId: string;
  opponentId: string;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};
