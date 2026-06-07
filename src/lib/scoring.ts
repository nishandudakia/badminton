import type { Match, Player, Session, SessionResult } from "./types";

export type ScoreValidation = {
  valid: boolean;
  message?: string;
};

type PlayerAccumulator = {
  playerId: string;
  sessionPoints: number;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
};

export function validateMatchScore(
  scoreA: number,
  scoreB: number,
  targetScore: number,
  overrideTarget = false,
): ScoreValidation {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    return { valid: false, message: "Scores must be numbers." };
  }

  if (scoreA < 0 || scoreB < 0) {
    return { valid: false, message: "Scores cannot be negative." };
  }

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { valid: false, message: "Scores must be whole numbers." };
  }

  if (!overrideTarget && scoreA + scoreB !== targetScore) {
    return {
      valid: false,
      message: `Scores should add up to ${targetScore}. Use override for exceptions.`,
    };
  }

  return { valid: true };
}

export function calculateSessionResults(session: Session): SessionResult[] {
  const accumulators = new Map<string, PlayerAccumulator>();

  for (const playerId of session.playerIds) {
    accumulators.set(playerId, {
      playerId,
      sessionPoints: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      matchesPlayed: 0,
    });
  }

  for (const match of session.matches) {
    if (!match.score) {
      continue;
    }

    applyMatchPoints(accumulators, match, match.score.teamA, match.score.teamB);
  }

  const ordered = Array.from(accumulators.values()).sort((a, b) => {
    if (b.sessionPoints !== a.sessionPoints) {
      return b.sessionPoints - a.sessionPoints;
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return a.playerId.localeCompare(b.playerId);
  });

  return applyCompetitionRanking(ordered, session.playerIds.length).map((result) => ({
    sessionId: session.id,
    ...result,
  }));
}

function applyMatchPoints(
  accumulators: Map<string, PlayerAccumulator>,
  match: Match,
  teamAScore: number,
  teamBScore: number,
) {
  const teamAResult = resultForScore(teamAScore, teamBScore);
  const teamBResult = resultForScore(teamBScore, teamAScore);

  for (const playerId of match.teamA) {
    const acc = accumulators.get(playerId);
    if (!acc) continue;
    acc.sessionPoints += teamAScore;
    acc.matchesPlayed += 1;
    acc[teamAResult] += 1;
  }

  for (const playerId of match.teamB) {
    const acc = accumulators.get(playerId);
    if (!acc) continue;
    acc.sessionPoints += teamBScore;
    acc.matchesPlayed += 1;
    acc[teamBResult] += 1;
  }
}

function resultForScore(scoreFor: number, scoreAgainst: number): "wins" | "draws" | "losses" {
  if (scoreFor > scoreAgainst) return "wins";
  if (scoreFor === scoreAgainst) return "draws";
  return "losses";
}

function applyCompetitionRanking(
  rows: PlayerAccumulator[],
  participantCount: number,
): Array<Omit<SessionResult, "sessionId">> {
  let previousPoints: number | undefined;
  let position = 0;

  return rows.map((row, index) => {
    if (previousPoints === undefined || row.sessionPoints !== previousPoints) {
      position = index + 1;
      previousPoints = row.sessionPoints;
    }

    return {
      ...row,
      position,
      championshipPointsAwarded: Math.max(participantCount - position + 1, 0),
    };
  });
}

export function sortChampionshipPlayers(players: Player[]) {
  return [...players].sort((a, b) => {
    if (b.totalChampionshipPoints !== a.totalChampionshipPoints) {
      return b.totalChampionshipPoints - a.totalChampionshipPoints;
    }

    if (b.sessionsPlayed !== a.sessionsPlayed) {
      return b.sessionsPlayed - a.sessionsPlayed;
    }

    return a.name.localeCompare(b.name);
  });
}

export function rankRows<T>(
  rows: T[],
  getPoints: (row: T) => number,
): Array<T & { rank: number }> {
  let previousPoints: number | undefined;
  let rank = 0;

  return rows.map((row, index) => {
    const points = getPoints(row);
    if (previousPoints === undefined || points !== previousPoints) {
      rank = index + 1;
      previousPoints = points;
    }

    return { ...row, rank };
  });
}
