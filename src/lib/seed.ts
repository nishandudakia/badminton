import type { AppState, ChampionshipHistory, Player } from "./types";

const now = "2026-06-07T00:00:00.000Z";
const referenceSource = "round-score-reference-v1";
const legacyReferenceSources = new Set(["round-score-reference-v1"]);

type HistoricalRoundScore = {
  round: number;
  scores: Record<string, number>;
};

export const historicalRoundScores: HistoricalRoundScore[] = [
  {
    round: 1,
    scores: {
      Siva: 7,
      Sam: 6,
      Jayson: 5,
      Thush: 4,
      Abi: 4,
      Thambi: 3,
      Hursh: 2,
      Nishan: 2,
    },
  },
  {
    round: 2,
    scores: {
      Sam: 13,
      Siva: 12,
      Thush: 12,
      Thambi: 10,
      Jayson: 7,
      Nishan: 6,
      Hursh: 5,
      Abi: 5,
    },
  },
  {
    round: 3,
    scores: {
      Siva: 16,
      Thush: 14,
      Thambi: 13,
      Sam: 13,
      Jayson: 7,
      Nishan: 7,
      Hursh: 5,
      Abi: 5,
    },
  },
  {
    round: 4,
    scores: {
      Siva: 21,
      Thush: 18,
      Sam: 16,
      Thambi: 14,
      Jayson: 7,
      Nishan: 7,
      Hursh: 7,
      Abi: 5,
    },
  },
  {
    round: 5,
    scores: {
      Thush: 24,
      Siva: 22,
      Sam: 19,
      Thambi: 17,
      Hursh: 14,
      Nishan: 12,
      Abi: 10,
      Jayson: 7,
    },
  },
  {
    round: 6,
    scores: {
      Siva: 29,
      Thush: 29,
      Sam: 23,
      Thambi: 20,
      Abi: 16,
      Hursh: 15,
      Nishan: 14,
      Jayson: 7,
    },
  },
  {
    round: 7,
    scores: {
      Thush: 29,
      Siva: 29,
      Sam: 23,
      Thambi: 20,
      Abi: 16,
      Hursh: 15,
      Nishan: 14,
      Jayson: 7,
    },
  },
  {
    round: 8,
    scores: {
      Thush: 38,
      Siva: 37,
      Sam: 23,
      Thambi: 23,
      Nishan: 20,
      Abi: 16,
      Hursh: 15,
      Jayson: 12,
    },
  },
  {
    round: 9,
    scores: {
      Thush: 40,
      Siva: 37,
      Thambi: 24,
      Nishan: 23,
      Sam: 23,
      Abi: 16,
      Hursh: 15,
      Jayson: 12,
    },
  },
  {
    round: 10,
    scores: {
      Thush: 44,
      Siva: 42,
      Nishan: 26,
      Thambi: 25,
      Sam: 23,
      Abi: 16,
      Hursh: 15,
      Jayson: 15,
    },
  },
  {
    round: 11,
    scores: {
      Siva: 54,
      Thush: 50,
      Nishan: 33,
      Thambi: 32,
      Sam: 23,
      Hursh: 21,
      Jayson: 20,
      Abi: 16,
    },
  },
  {
    round: 12,
    scores: {
      Siva: 63,
      Thush: 60,
      Nishan: 44,
      Thambi: 34,
      Sam: 33,
      Hursh: 27,
      Abi: 26,
      Jayson: 20,
    },
  },
];

export const regularPlayerSeeds: Array<Pick<Player, "id" | "name">> = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Siva" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Thush" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Nishan" },
  { id: "00000000-0000-4000-8000-000000000004", name: "Thambi" },
  { id: "00000000-0000-4000-8000-000000000005", name: "Sam" },
  { id: "00000000-0000-4000-8000-000000000006", name: "Hursh" },
  { id: "00000000-0000-4000-8000-000000000007", name: "Abi" },
  { id: "00000000-0000-4000-8000-000000000008", name: "Jayson" },
];

export function slugId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function createInitialState(): AppState {
  const players: Player[] = regularPlayerSeeds.map((player) => ({
    id: player.id,
    name: player.name,
    nickname: "",
    isGuest: false,
    createdAt: now,
    totalChampionshipPoints: getLatestReferenceScore(player.name),
    sessionsPlayed: historicalRoundScores.length,
  }));

  return ensureReferenceHistory({
    players,
    sessions: [],
    history: [],
  });
}

export function ensureReferenceHistory(state: AppState): AppState {
  const players = [...state.players];
  for (const seed of regularPlayerSeeds) {
    if (players.some((player) => player.name.toLowerCase() === seed.name.toLowerCase())) continue;

    players.push({
      id: seed.id,
      name: seed.name,
      nickname: "",
      isGuest: false,
      createdAt: now,
      totalChampionshipPoints: 0,
      sessionsPlayed: 0,
    });
  }

  const playersByName = new Map(players.map((player) => [player.name.toLowerCase(), player]));
  const referenceSessions = historicalRoundScores
    .map((round) => buildReferenceSession(round, playersByName))
    .reverse();
  const referenceHistory = historicalRoundScores.flatMap((round) => buildReferenceHistory(round, playersByName));
  const referenceSessionIds = new Set(historicalRoundScores.map((round) => referenceSessionId(round.round)));
  const referenceHistoryIds = new Set(referenceHistory.map((event) => event.id));
  const retainedSessions = state.sessions.filter((session) => !referenceSessionIds.has(session.id));
  const retainedHistory = state.history.filter(
    (event) =>
      !referenceHistoryIds.has(event.id) &&
      !referenceSessionIds.has(event.sessionId ?? "") &&
      !legacyReferenceSources.has(String(event.metadata?.source ?? "")) &&
      event.metadata?.label !== "Existing championship standings",
  );

  return {
    ...state,
    players,
    sessions: [...retainedSessions, ...referenceSessions],
    history: [...retainedHistory, ...referenceHistory],
  };
}

function buildReferenceSession(round: HistoricalRoundScore, playersByName: Map<string, Player>): AppState["sessions"][number] {
  const timestamp = referenceTimestamp(round.round);
  const playerIds = Object.keys(round.scores)
    .map((name) => playersByName.get(name.toLowerCase())?.id)
    .filter(Boolean) as string[];
  const results = Object.entries(round.scores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .map(([name, score]) => {
      const player = playersByName.get(name.toLowerCase());
      if (!player) return undefined;

      return {
        sessionId: referenceSessionId(round.round),
        playerId: player.id,
        sessionPoints: score,
        position: getReferencePosition(round.scores, score),
        championshipPointsAwarded: score - getPreviousReferenceScore(round.round, name),
        wins: 0,
        draws: 0,
        losses: 0,
        matchesPlayed: 0,
      };
    })
    .filter(Boolean) as AppState["sessions"][number]["results"];

  return {
    id: referenceSessionId(round.round),
    date: `Round ${round.round}`,
    targetScore: 15,
    courtCount: 1,
    playerIds,
    matches: [],
    status: "finalized",
    finalizedAt: timestamp,
    finalsCountTowardsLeaderboard: true,
    includeFinals: false,
    results,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildReferenceHistory(round: HistoricalRoundScore, playersByName: Map<string, Player>): ChampionshipHistory[] {
  return Object.entries(round.scores)
    .map(([name, score]) => {
      const player = playersByName.get(name.toLowerCase());
      if (!player) return undefined;

      return {
        id: referenceHistoryId(round.round, player.id),
        sessionId: referenceSessionId(round.round),
        playerId: player.id,
        points: score - getPreviousReferenceScore(round.round, name),
        reason: "session_award" as const,
        awardedAt: referenceTimestamp(round.round),
        metadata: {
          source: referenceSource,
          sessionDate: `Round ${round.round}`,
          referenceRound: round.round,
          cumulativeScore: score,
        },
      };
    })
    .filter(Boolean) as ChampionshipHistory[];
}

function getReferencePosition(scores: Record<string, number>, score: number) {
  return Object.values(scores).filter((otherScore) => otherScore > score).length + 1;
}

function getLatestReferenceScore(playerName: string) {
  return historicalRoundScores.at(-1)?.scores[playerName] ?? 0;
}

function getPreviousReferenceScore(roundNumber: number, playerName: string) {
  const previousRound = historicalRoundScores.find((round) => round.round === roundNumber - 1);
  return previousRound?.scores[playerName] ?? 0;
}

function referenceSessionId(roundNumber: number) {
  return `20000000-0000-4000-8000-${String(roundNumber).padStart(12, "0")}`;
}

function referenceHistoryId(roundNumber: number, playerId: string) {
  const playerNumber = playerId.slice(-3);
  return `30000000-0000-4000-8000-${String(roundNumber).padStart(9, "0")}${playerNumber}`;
}

function referenceTimestamp(roundNumber: number) {
  return `2026-01-${String(roundNumber).padStart(2, "0")}T00:00:00.000Z`;
}
