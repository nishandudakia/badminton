import type { Match, SessionResult } from "./types";

export type PairKey = string;

export type GeneratorOptions = {
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

export type FairnessPlayerSummary = {
  playerId: string;
  matches: number;
  uniquePartners: number;
  uniqueOpponents: number;
  byes: number;
};

export type FairnessSummary = {
  players: FairnessPlayerSummary[];
  repeatedPartnerships: number;
  repeatedOpponentMatchups: number;
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

  if (uniquePlayerIds.length === 8 && targetRounds === undefined) {
    return generateEightPlayerAmericano(sessionId, uniquePlayerIds);
  }

  const rounds = targetRounds ?? defaultRoundCount(uniquePlayerIds.length);
  const counters = createCounters(uniquePlayerIds);
  const matches: Match[] = [];

  for (let round = 1; round <= rounds; round += 1) {
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
      matches.push(createMatch(sessionId, matches.length + 1, round, courtNumber, candidate.teamA, candidate.teamB, roundByes));
    }

    for (const playerId of available) {
      counters.byes.set(playerId, (counters.byes.get(playerId) ?? 0) + 1);
    }
  }

  return matches;
}

export function generateFinalsMatches({
  sessionId,
  existingMatchCount,
  finalRoundNumber,
  leaderboard,
}: {
  sessionId: string;
  existingMatchCount: number;
  finalRoundNumber?: number;
  leaderboard: SessionResult[];
}): Match[] {
  const rankedPlayerIds = [...leaderboard].sort((a, b) => a.position - b.position || b.sessionPoints - a.sessionPoints).map((row) => row.playerId);
  if (rankedPlayerIds.length < 4) return [];

  const roundNumber = finalRoundNumber ?? Math.floor(existingMatchCount / 2) + 1;
  const finals: Match[] = [];

  for (let index = 0; index + 3 < rankedPlayerIds.length; index += 4) {
    const finalistGroup = rankedPlayerIds.slice(index, index + 4);
    finals.push(createMatch(
      sessionId,
      existingMatchCount + finals.length + 1,
      roundNumber,
      finals.length + 1,
      [finalistGroup[0], finalistGroup[3]],
      [finalistGroup[1], finalistGroup[2]],
      rankedPlayerIds.filter((playerId) => !finalistGroup.includes(playerId)),
      true,
    ));
  }

  return finals;
}

export function getFairnessSummary(matches: Match[], playerIds: string[]): FairnessSummary {
  const summary = new Map<string, { partners: Set<string>; opponents: Set<string>; matches: number; byes: number }>();
  const partnerships = new Map<PairKey, number>();
  const opponents = new Map<PairKey, number>();

  for (const playerId of playerIds) {
    summary.set(playerId, { partners: new Set(), opponents: new Set(), matches: 0, byes: 0 });
  }

  for (const match of matches.filter((item) => !item.isFinal)) {
    for (const playerId of [...match.teamA, ...match.teamB]) {
      const row = summary.get(playerId);
      if (row) row.matches += 1;
    }
    for (const playerId of match.byes) {
      const row = summary.get(playerId);
      if (row) row.byes += 1;
    }

    addPartnershipSummary(summary, partnerships, match.teamA[0], match.teamA[1]);
    addPartnershipSummary(summary, partnerships, match.teamB[0], match.teamB[1]);
    for (const playerA of match.teamA) {
      for (const playerB of match.teamB) {
        summary.get(playerA)?.opponents.add(playerB);
        summary.get(playerB)?.opponents.add(playerA);
        incrementPair(opponents, playerA, playerB);
      }
    }
  }

  return {
    players: playerIds.map((playerId) => {
      const row = summary.get(playerId);
      return {
        playerId,
        matches: row?.matches ?? 0,
        uniquePartners: row?.partners.size ?? 0,
        uniqueOpponents: row?.opponents.size ?? 0,
        byes: row?.byes ?? 0,
      };
    }),
    repeatedPartnerships: countRepeats(partnerships),
    repeatedOpponentMatchups: countRepeats(opponents),
  };
}

function generateEightPlayerAmericano(sessionId: string, playerIds: string[]) {
  const partnerRounds = createRoundRobinPairRounds(playerIds);
  const roundPairings = chooseBalancedPairPairings(partnerRounds);
  const matches: Match[] = [];

  roundPairings.forEach((roundMatches, roundIndex) => {
    roundMatches.forEach(([teamA, teamB], courtIndex) => {
      matches.push(createMatch(sessionId, matches.length + 1, roundIndex + 1, courtIndex + 1, teamA, teamB, []));
    });
  });

  return matches;
}

function createRoundRobinPairRounds(playerIds: string[]) {
  const fixed = playerIds[0];
  let rotating = playerIds.slice(1);
  const rounds: string[][][] = [];

  for (let round = 0; round < playerIds.length - 1; round += 1) {
    const lineup = [fixed, ...rotating];
    const pairs: string[][] = [];
    for (let index = 0; index < lineup.length / 2; index += 1) {
      pairs.push([lineup[index], lineup[lineup.length - 1 - index]]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

function chooseBalancedPairPairings(rounds: string[][][]) {
  const options = rounds.map((pairs) => [
    [[pairs[0], pairs[1]], [pairs[2], pairs[3]]],
    [[pairs[0], pairs[2]], [pairs[1], pairs[3]]],
    [[pairs[0], pairs[3]], [pairs[1], pairs[2]]],
  ]);
  let best: string[][][][] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  function visit(roundIndex: number, selected: string[][][][], opponentCounts: Map<PairKey, number>) {
    if (roundIndex === options.length) {
      const values = Array.from(opponentCounts.values());
      const repeats = values.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
      const spread = Math.max(...values) - Math.min(...values);
      const cost = repeats + spread * 20;
      if (cost < bestCost) {
        bestCost = cost;
        best = selected.map((round) => round.map((match) => match.map((team) => [...team])));
      }
      return;
    }

    for (const option of options[roundIndex]) {
      const nextCounts = new Map(opponentCounts);
      for (const [teamA, teamB] of option) {
        for (const playerA of teamA) {
          for (const playerB of teamB) {
            incrementPair(nextCounts, playerA, playerB);
          }
        }
      }
      visit(roundIndex + 1, [...selected, option], nextCounts);
    }
  }

  visit(0, [], new Map());
  return best;
}

function defaultRoundCount(playerCount: number) {
  if (playerCount <= 4) return 6;
  if (playerCount <= 6) return 8;
  if (playerCount <= 8) return 7;
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
    cost: partnershipPenalty * 12 + opponentPenalty * 5 + matchBalancePenalty * 8 + byePenalty * 2 + spreadPenalty,
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

function addPartnershipSummary(
  summary: Map<string, { partners: Set<string>; opponents: Set<string>; matches: number; byes: number }>,
  partnerships: Map<PairKey, number>,
  a: string,
  b: string,
) {
  summary.get(a)?.partners.add(b);
  summary.get(b)?.partners.add(a);
  incrementPair(partnerships, a, b);
}

function countRepeats(map: Map<PairKey, number>) {
  return Array.from(map.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
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

function createMatch(
  sessionId: string,
  matchNumber: number,
  roundNumber: number,
  courtNumber: number,
  teamA: string[],
  teamB: string[],
  byes: string[],
  isFinal = false,
): Match {
  return {
    id: createMatchId(sessionId, matchNumber),
    sessionId,
    matchNumber,
    roundNumber,
    courtNumber,
    teamA,
    teamB,
    byes,
    isFinal,
    status: "scheduled",
  };
}

function createMatchId(sessionId: string, matchNumber: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `match-${sessionId}-${matchNumber}`;
}
