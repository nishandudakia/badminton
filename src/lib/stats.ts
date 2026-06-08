import { pairKey } from "./schedule";
import { rankRows, sortChampionshipPlayers } from "./scoring";
import type { AppState, HeadToHeadRecord, PartnerRecord, Player } from "./types";

export function getChampionshipLeaderboard(players: Player[]) {
  return rankRows(sortChampionshipPlayers(players), (player) => player.totalChampionshipPoints);
}

export function getPlayerName(state: AppState, playerId: string) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Unknown";
}

export function getProgressionData(state: AppState) {
  const players = getChampionshipLeaderboard(state.players).slice(0, 8);
  const totals = new Map(players.map((player) => [player.id, 0]));
  const events = [...state.history].sort((a, b) => a.awardedAt.localeCompare(b.awardedAt));
  const groups = new Map<string, { label: string; order: string; events: typeof events }>();
  const rows: Array<Record<string, string | number>> = [];

  for (const event of events) {
    const roundNumber = typeof event.metadata?.referenceRound === "number" ? event.metadata.referenceRound : undefined;
    const key = roundNumber ? `reference-round-${roundNumber}` : event.sessionId ? `session-${event.sessionId}` : event.id;
    const label =
      typeof event.metadata?.sessionDate === "string"
        ? event.metadata.sessionDate
        : event.reason === "initial_seed"
          ? "Seed"
          : event.awardedAt.slice(0, 10);
    const order = roundNumber ? `0000-${String(roundNumber).padStart(4, "0")}` : event.awardedAt;
    const group = groups.get(key) ?? { label, order, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }

  for (const group of Array.from(groups.values()).sort((a, b) => a.order.localeCompare(b.order))) {
    for (const event of group.events) {
      if (!totals.has(event.playerId)) continue;
      totals.set(event.playerId, (totals.get(event.playerId) ?? 0) + event.points);
    }

    rows.push({
      label: group.label,
      ...Object.fromEntries(players.map((player) => [player.name, totals.get(player.id) ?? 0])),
    });
  }

  return rows.length ? rows : [{ label: "Seed", ...Object.fromEntries(players.map((player) => [player.name, player.totalChampionshipPoints])) }];
}

export function getPointsPerSessionData(state: AppState) {
  return sortSessionsForStats(state.sessions)
    .filter((session) => session.status === "finalized" && session.results)
    .flatMap((session) =>
      session.results!.map((result) => ({
        session: session.date,
        player: getPlayerName(state, result.playerId),
        points: result.championshipPointsAwarded,
      })),
    )
    .slice(-40);
}

function sortSessionsForStats(sessions: AppState["sessions"]) {
  return [...sessions].sort((a, b) => getSessionSortValue(a) - getSessionSortValue(b));
}

function getSessionSortValue(session: AppState["sessions"][number]) {
  const referenceRound = /^Round (\d+)$/.exec(session.date)?.[1];
  if (referenceRound) {
    return Number(referenceRound);
  }

  const timestamp = Date.parse(session.finalizedAt ?? session.createdAt ?? session.date);
  return 10_000 + (Number.isFinite(timestamp) ? timestamp : 0);
}

export function getPlayerAverages(state: AppState) {
  return state.players.map((player) => {
    const results = state.sessions
      .filter((session) => session.status === "finalized" && session.results)
      .flatMap((session) => session.results ?? [])
      .filter((result) => result.playerId === player.id);

    const matchesPlayed = results.reduce((sum, result) => sum + result.matchesPlayed, 0);
    const wins = results.reduce((sum, result) => sum + result.wins, 0);

    return {
      player,
      averageFinish: results.length ? results.reduce((sum, result) => sum + result.position, 0) / results.length : 0,
      winPercentage: matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0,
      sessions: results.length,
    };
  });
}

export function getPartnerRecords(state: AppState): PartnerRecord[] {
  const records = new Map<string, PartnerRecord>();

  for (const session of state.sessions) {
    for (const match of session.matches) {
      if (!match.score) continue;
      addPartner(records, match.teamA[0], match.teamA[1], match.score.teamA, match.score.teamB);
      addPartner(records, match.teamB[0], match.teamB[1], match.score.teamB, match.score.teamA);
    }
  }

  return Array.from(records.values()).sort((a, b) => b.matches - a.matches);
}

export function getHeadToHeadRecords(state: AppState): HeadToHeadRecord[] {
  const records = new Map<string, HeadToHeadRecord>();

  for (const session of state.sessions) {
    for (const match of session.matches) {
      if (!match.score) continue;

      for (const playerId of match.teamA) {
        for (const opponentId of match.teamB) {
          addHeadToHead(records, playerId, opponentId, match.score.teamA, match.score.teamB);
          addHeadToHead(records, opponentId, playerId, match.score.teamB, match.score.teamA);
        }
      }
    }
  }

  return Array.from(records.values()).sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
}

function addPartner(records: Map<string, PartnerRecord>, playerId: string, partnerId: string, pointsFor: number, pointsAgainst: number) {
  if (!playerId || !partnerId) return;
  const sorted = [playerId, partnerId].sort();
  const key = pairKey(sorted[0], sorted[1]);
  const existing =
    records.get(key) ??
    ({
      playerId: sorted[0],
      partnerId: sorted[1],
      matches: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    } satisfies PartnerRecord);

  existing.matches += 1;
  existing.pointsFor += pointsFor;
  existing.pointsAgainst += pointsAgainst;
  records.set(key, existing);
}

function addHeadToHead(records: Map<string, HeadToHeadRecord>, playerId: string, opponentId: string, pointsFor: number, pointsAgainst: number) {
  const key = `${playerId}__${opponentId}`;
  const existing =
    records.get(key) ??
    ({
      playerId,
      opponentId,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    } satisfies HeadToHeadRecord);

  if (pointsFor > pointsAgainst) existing.wins += 1;
  else if (pointsFor === pointsAgainst) existing.draws += 1;
  else existing.losses += 1;

  existing.pointsFor += pointsFor;
  existing.pointsAgainst += pointsAgainst;
  records.set(key, existing);
}
