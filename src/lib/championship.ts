import { createId } from "./id";
import { calculateSessionResults } from "./scoring";
import { generateAmericanoSchedule, generateFinalsMatches } from "./schedule";
import type {
  AppState,
  ChampionshipHistory,
  HistoricalImportSession,
  Match,
  MatchScore,
  Player,
  Session,
  SessionResult,
} from "./types";

export type PlayerInput = {
  name: string;
  nickname?: string;
  isGuest?: boolean;
};

export type SessionInput = {
  playerIds: string[];
  targetScore: number;
  courtCount: number;
  date?: string;
  finalsCountTowardsLeaderboard?: boolean;
  includeFinals?: boolean;
};

export function addPlayer(state: AppState, input: PlayerInput): AppState {
  const name = input.name.trim();
  if (!name) return state;

  const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return {
      ...state,
      players: state.players.map((player) =>
        player.id === existing.id
          ? {
              ...player,
              nickname: input.nickname?.trim() ?? player.nickname,
              isGuest: input.isGuest ?? player.isGuest,
              archivedAt: undefined,
            }
          : player,
      ),
    };
  }

  const now = new Date().toISOString();
  const player: Player = {
    id: createId("player"),
    name,
    nickname: input.nickname?.trim() ?? "",
    isGuest: Boolean(input.isGuest),
    createdAt: now,
    totalChampionshipPoints: 0,
    sessionsPlayed: 0,
  };

  return { ...state, players: [...state.players, player] };
}

export function updatePlayer(state: AppState, playerId: string, input: PlayerInput): AppState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            name: input.name.trim() || player.name,
            nickname: input.nickname?.trim() ?? "",
            isGuest: Boolean(input.isGuest),
          }
        : player,
    ),
  };
}

export function archivePlayer(state: AppState, playerId: string): AppState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, archivedAt: new Date().toISOString() } : player,
    ),
  };
}

export function createSession(state: AppState, input: SessionInput): AppState {
  const uniquePlayerIds = Array.from(new Set(input.playerIds));
  const now = new Date().toISOString();
  const sessionId = createId("session");
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const targetScore = Math.max(1, Math.round(input.targetScore || 15));
  const courtCount = Math.max(1, Math.round(input.courtCount || 1));
  const includeFinals = input.includeFinals ?? uniquePlayerIds.length >= 4;

  const session: Session = {
    id: sessionId,
    date,
    targetScore,
    courtCount,
    playerIds: uniquePlayerIds,
    matches: generateAmericanoSchedule({
      sessionId,
      playerIds: uniquePlayerIds,
      courtCount,
    }),
    status: "active",
    finalsCountTowardsLeaderboard: input.finalsCountTowardsLeaderboard ?? true,
    includeFinals,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    sessions: [session, ...state.sessions],
    activeSessionId: session.id,
  };
}

export function updateSessionBasics(
  state: AppState,
  sessionId: string,
  input: Pick<SessionInput, "targetScore" | "courtCount">,
): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            targetScore: Math.max(1, Math.round(input.targetScore || session.targetScore)),
            courtCount: Math.max(1, Math.round(input.courtCount || session.courtCount)),
            updatedAt: new Date().toISOString(),
          }
        : session,
    ),
  };
}

export function regenerateSessionSchedule(state: AppState, sessionId: string): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            matches: generateAmericanoSchedule({
              sessionId,
              playerIds: session.playerIds,
              courtCount: session.courtCount,
            }),
            status: "active",
            updatedAt: new Date().toISOString(),
          }
        : session,
    ),
  };
}

export function updateMatchTeams(
  state: AppState,
  sessionId: string,
  matchId: string,
  nextTeams: Pick<Match, "teamA" | "teamB">,
): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            matches: session.matches.map((match) =>
              match.id === matchId
                ? {
                    ...match,
                    teamA: nextTeams.teamA,
                    teamB: nextTeams.teamB,
                    byes: session.playerIds.filter(
                      (playerId) => ![...nextTeams.teamA, ...nextTeams.teamB].includes(playerId),
                    ),
                  }
                : match,
            ),
            updatedAt: new Date().toISOString(),
          }
        : session,
    ),
  };
}

export function setMatchScore(
  state: AppState,
  sessionId: string,
  matchId: string,
  score: Omit<MatchScore, "enteredAt">,
): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) => {
      if (session.id !== sessionId) return session;

      const scoredMatches = session.matches.map((match) =>
        match.id === matchId
          ? {
              ...match,
              score: { ...score, enteredAt: new Date().toISOString() },
              status: "complete" as const,
            }
          : match,
      );
      const nextSession = { ...session, matches: scoredMatches, updatedAt: new Date().toISOString() };
      return ensureFinalsGenerated(nextSession);
    }),
  };
}

function ensureFinalsGenerated(session: Session): Session {
  const includeFinals = session.includeFinals ?? true;
  if (!includeFinals || session.matches.some((match) => match.isFinal)) {
    return session;
  }

  const normalMatches = session.matches.filter((match) => !match.isFinal);
  if (!normalMatches.length || normalMatches.some((match) => !match.score)) {
    return session;
  }

  const interimResults = calculateSessionResults({ ...session, matches: normalMatches }, { includeFinals: false });
  const finals = generateFinalsMatches({
    sessionId: session.id,
    existingMatchCount: normalMatches.length,
    leaderboard: interimResults,
  });

  if (!finals.length) return session;
  return { ...session, matches: [...normalMatches, ...finals] };
}

export function clearMatchScore(state: AppState, sessionId: string, matchId: string): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            matches: session.matches.map((match) =>
              match.id === matchId ? { ...match, score: undefined, status: "scheduled" } : match,
            ),
            updatedAt: new Date().toISOString(),
          }
        : session,
    ),
  };
}

export function finalizeSession(state: AppState, sessionId: string): AppState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return state;
  if (session.matches.length > 0 && session.matches.some((match) => !match.score)) return state;

  const includeFinalsInAwards = session.finalsCountTowardsLeaderboard ?? true;
  const results = calculateSessionResults(session, { includeFinals: includeFinalsInAwards });
  const now = new Date().toISOString();
  const historyWithoutSession = state.history.filter((item) => item.sessionId !== sessionId);
  const awards = results.map<ChampionshipHistory>((result) => ({
    id: createId("history"),
    sessionId,
    playerId: result.playerId,
    points: result.championshipPointsAwarded,
    reason: "session_award",
    awardedAt: now,
    metadata: {
      sessionDate: session.date,
      sessionPoints: result.sessionPoints,
      position: result.position,
      finalsCounted: includeFinalsInAwards,
    },
  }));

  return recalculateSeason({
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            results,
            status: "finalized",
            finalizedAt: now,
            updatedAt: now,
          }
        : item,
    ),
    history: [...historyWithoutSession, ...awards],
  });
}

export function reopenSession(state: AppState, sessionId: string): AppState {
  return recalculateSeason({
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, status: "active", finalizedAt: undefined, updatedAt: new Date().toISOString() }
        : session,
    ),
    activeSessionId: sessionId,
  });
}

export function deleteSession(state: AppState, sessionId: string): AppState {
  return recalculateSeason({
    ...state,
    sessions: state.sessions.filter((session) => session.id !== sessionId),
    history: state.history.filter((item) => item.sessionId !== sessionId),
    activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
  });
}

export function importHistoricalSessions(
  state: AppState,
  payload: HistoricalImportSession | HistoricalImportSession[],
): AppState {
  const sessionsToImport = Array.isArray(payload) ? payload : [payload];
  let nextState = state;

  for (const imported of sessionsToImport) {
    const playerIds: string[] = [];
    for (const playerName of imported.players) {
      nextState = addPlayer(nextState, { name: playerName });
      const player = nextState.players.find((item) => item.name.toLowerCase() === playerName.toLowerCase());
      if (player) playerIds.push(player.id);
    }

    const sessionId = createId("imported-session");
    const now = new Date().toISOString();
    const results: SessionResult[] = imported.results
      .map((result) => {
        const player = nextState.players.find((item) => item.name.toLowerCase() === result.player.toLowerCase());
        if (!player) return undefined;

        return {
          sessionId,
          playerId: player.id,
          sessionPoints: result.sessionPoints,
          position: result.position,
          championshipPointsAwarded: result.championshipPointsAwarded,
          wins: 0,
          draws: 0,
          losses: 0,
          matchesPlayed: 0,
        };
      })
      .filter(Boolean) as SessionResult[];

    const session: Session = {
      id: sessionId,
      date: imported.date,
      targetScore: imported.targetScore,
      courtCount: 1,
      playerIds,
      matches: [],
      status: "finalized",
      finalizedAt: now,
      finalsCountTowardsLeaderboard: true,
      includeFinals: false,
      results,
      createdAt: now,
      updatedAt: now,
    };

    const awards = results.map<ChampionshipHistory>((result) => ({
      id: createId("history"),
      sessionId,
      playerId: result.playerId,
      points: result.championshipPointsAwarded,
      reason: "session_award",
      awardedAt: now,
      metadata: { imported: true, sessionDate: imported.date },
    }));

    nextState = {
      ...nextState,
      sessions: [session, ...nextState.sessions],
      history: [...nextState.history, ...awards],
    };
  }

  return recalculateSeason(nextState);
}

export function recalculateSeason(state: AppState): AppState {
  const pointsByPlayer = new Map<string, number>();
  const sessionsByPlayer = new Map<string, Set<string>>();

  for (const player of state.players) {
    pointsByPlayer.set(player.id, 0);
    sessionsByPlayer.set(player.id, new Set());
  }

  for (const event of state.history) {
    pointsByPlayer.set(event.playerId, (pointsByPlayer.get(event.playerId) ?? 0) + event.points);
  }

  for (const session of state.sessions) {
    if (session.status !== "finalized" || !session.results) continue;
    for (const result of session.results) {
      sessionsByPlayer.get(result.playerId)?.add(session.id);
    }
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      totalChampionshipPoints: pointsByPlayer.get(player.id) ?? 0,
      sessionsPlayed: sessionsByPlayer.get(player.id)?.size ?? 0,
    })),
  };
}
