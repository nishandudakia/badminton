import type { Match } from "./types";

type PairKey = string;

type GeneratorOptions = {
  sessionId: string;
  playerIds: string[];
  courtCount: number;
  targetRounds?: number;
};

type Candidate = {
  teamA: string[];
  teamB: string[];
  players: string[];
  cost: number;
};

type Counters = {
  matches: Map<string, number>;
  byes: Map<string, number>;
  partners: Map<PairKey, number>;
  opponents: Map<PairKey, number>;
};

export function generateAmericanoSchedule({
  sessionId,
  playerIds,
  courtCount,
  targetRounds,
}: GeneratorOptions): Match[] {
  const uniquePlayerIds = Array.from(new Set(playerIds));
  if (uniquePlayerIds.length < 4) {
    return [];
  }

  const rounds = targetRounds ?? defaultRoundCount(uniquePlayerIds.length);
  const counters = createCounters(uniquePlayerIds);
  const matches: Match[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const available = new Set(uniquePlayerIds);
    const courtsThisRound = Math.max(1, Math.min(courtCount, Math.floor(uniquePlayerIds.length / 4)));
    const roundCandidates: Array<{ candidate: Candidate; courtNumber: number }> = [];

    for (let court = 1; court <= courtsThisRound; court += 1) {
      const candidate = selectBestCandidate(Array.from(available), counters);
      if (!candidate) break;

      roundCandidates.push({ candidate, courtNumber: court });
      recordCandidate(candidate, counters);
      for (const playerId of candidate.players) {
        available.delete(playerId);
      }
    }

    const roundByes = Array.from(available);
    for (const { candidate, courtNumber } of roundCandidates) {
      matches.push({
        id: createMatchId(sessionId, matches.length + 1),
        sessionId,
        matchNumber: matches.length + 1,
        courtNumber,
        teamA: candidate.teamA,
        teamB: candidate.teamB,
        byes: roundByes,
        status: "scheduled",
      });
    }

    for (const playerId of available) {
      counters.byes.set(playerId, (counters.byes.get(playerId) ?? 0) + 1);
    }
  }

  return matches;
}

function defaultRoundCount(playerCount: number) {
  if (playerCount <= 4) return 6;
  if (playerCount <= 6) return 8;
  if (playerCount <= 8) return 10;
  return Math.min(14, playerCount + 3);
}

function createCounters(playerIds: string[]): Counters {
  return {
    matches: new Map(playerIds.map((playerId) => [playerId, 0])),
    byes: new Map(playerIds.map((playerId) => [playerId, 0])),
    partners: new Map(),
    opponents: new Map(),
  };
}

function selectBestCandidate(playerIds: string[], counters: Counters): Candidate | undefined {
  if (playerIds.length < 4) return undefined;

  const candidates: Candidate[] = [];

  for (let a = 0; a < playerIds.length - 3; a += 1) {
    for (let b = a + 1; b < playerIds.length - 2; b += 1) {
      for (let c = b + 1; c < playerIds.length - 1; c += 1) {
        for (let d = c + 1; d < playerIds.length; d += 1) {
          const group = [playerIds[a], playerIds[b], playerIds[c], playerIds[d]];
          const splits = [
            [[group[0], group[1]], [group[2], group[3]]],
            [[group[0], group[2]], [group[1], group[3]]],
            [[group[0], group[3]], [group[1], group[2]]],
          ];

          for (const [teamA, teamB] of splits) {
            candidates.push(scoreCandidate(teamA, teamB, counters));
          }
        }
      }
    }
  }

  return candidates.sort((a, b) => a.cost - b.cost)[0];
}

function scoreCandidate(teamA: string[], teamB: string[], counters: Counters): Candidate {
  const players = [...teamA, ...teamB];
  const currentMatchCounts = players.map((playerId) => counters.matches.get(playerId) ?? 0);
  const currentByeCounts = players.map((playerId) => counters.byes.get(playerId) ?? 0);
  const minMatches = Math.min(...Array.from(counters.matches.values()));
  const maxMatches = Math.max(...Array.from(counters.matches.values()));

  const partnershipPenalty = pairCount(counters.partners, teamA[0], teamA[1]) + pairCount(counters.partners, teamB[0], teamB[1]);
  const opponentPenalty =
    pairCount(counters.opponents, teamA[0], teamB[0]) +
    pairCount(counters.opponents, teamA[0], teamB[1]) +
    pairCount(counters.opponents, teamA[1], teamB[0]) +
    pairCount(counters.opponents, teamA[1], teamB[1]);
  const matchBalancePenalty = currentMatchCounts.reduce((sum, count) => sum + Math.max(0, count - minMatches), 0);
  const byePenalty = currentByeCounts.reduce((sum, count) => sum + count, 0);
  const spreadPenalty = maxMatches - minMatches;

  return {
    teamA,
    teamB,
    players,
    cost:
      partnershipPenalty * 12 +
      opponentPenalty * 5 +
      matchBalancePenalty * 8 +
      byePenalty * 2 +
      spreadPenalty,
  };
}

function recordCandidate(candidate: Candidate, counters: Counters) {
  for (const playerId of candidate.players) {
    counters.matches.set(playerId, (counters.matches.get(playerId) ?? 0) + 1);
  }

  incrementPair(counters.partners, candidate.teamA[0], candidate.teamA[1]);
  incrementPair(counters.partners, candidate.teamB[0], candidate.teamB[1]);

  for (const playerA of candidate.teamA) {
    for (const playerB of candidate.teamB) {
      incrementPair(counters.opponents, playerA, playerB);
    }
  }
}

function pairCount(map: Map<PairKey, number>, a: string, b: string) {
  return map.get(pairKey(a, b)) ?? 0;
}

function incrementPair(map: Map<PairKey, number>, a: string, b: string) {
  const key = pairKey(a, b);
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function pairKey(a: string, b: string): PairKey {
  return [a, b].sort().join("__");
}

function createMatchId(sessionId: string, matchNumber: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `match-${sessionId}-${matchNumber}`;
}
