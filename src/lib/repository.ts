import { createInitialState } from "./seed";
import { hasSupabaseConfig, supabase } from "./supabase";
import { loadStoredState, saveStoredState } from "./storage";
import type { AppState, ChampionshipHistory, Match, MatchScore, Player, Session, SessionResult, SessionStatus } from "./types";

type PlayerRow = {
  id: string;
  name: string;
  nickname: string | null;
  is_guest: boolean;
  archived_at: string | null;
  created_at: string;
  total_championship_points: number;
  sessions_played: number;
};

type SessionRow = {
  id: string;
  session_date: string;
  target_score: number;
  court_count: number;
  player_ids: string[] | null;
  status: SessionStatus;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  id: string;
  session_id: string;
  match_number: number;
  court_number: number;
  team_a_player_ids: string[];
  team_b_player_ids: string[];
  bye_player_ids: string[];
  status: "scheduled" | "complete";
  created_at: string;
};

type MatchScoreRow = {
  match_id: string;
  team_a_score: number;
  team_b_score: number;
  override_target: boolean;
  admin_note: string | null;
  entered_at: string;
};

type SessionResultRow = {
  session_id: string;
  player_id: string;
  session_points: number;
  position: number;
  championship_points_awarded: number;
  wins: number;
  draws: number;
  losses: number;
  matches_played: number;
};

type HistoryRow = {
  id: string;
  session_id: string | null;
  player_id: string;
  points: number;
  reason: ChampionshipHistory["reason"];
  awarded_at: string;
  metadata: Record<string, unknown> | null;
};

export async function loadPersistedState(): Promise<AppState> {
  if (!hasSupabaseConfig || !supabase) {
    return loadStoredState();
  }

  try {
    const state = await loadSupabaseState();
    saveStoredState(state);
    return state;
  } catch {
    return loadStoredState();
  }
}

export async function savePersistedState(state: AppState) {
  saveStoredState(state);

  if (!hasSupabaseConfig || !supabase) {
    return;
  }

  try {
    await saveSupabaseState(state);
  } catch {
    saveStoredState(state);
  }
}

async function loadSupabaseState(): Promise<AppState> {
  if (!supabase) return loadStoredState();

  const [playersResponse, sessionsResponse, matchesResponse, scoresResponse, resultsResponse, historyResponse] = await Promise.all([
    supabase.from("players").select("*").order("created_at"),
    supabase.from("sessions").select("*").order("session_date", { ascending: false }),
    supabase.from("matches").select("*").order("match_number"),
    supabase.from("match_scores").select("*"),
    supabase.from("session_results").select("*"),
    supabase.from("championship_history").select("*").order("awarded_at"),
  ]);

  if (playersResponse.error) throw playersResponse.error;
  if (sessionsResponse.error) throw sessionsResponse.error;
  if (matchesResponse.error) throw matchesResponse.error;
  if (scoresResponse.error) throw scoresResponse.error;
  if (resultsResponse.error) throw resultsResponse.error;
  if (historyResponse.error) throw historyResponse.error;

  const players = ((playersResponse.data ?? []) as PlayerRow[]).map(mapPlayerFromRow);
  if (!players.length) {
    return createInitialState();
  }

  const scoresByMatchId = new Map(((scoresResponse.data ?? []) as MatchScoreRow[]).map((row) => [row.match_id, mapScoreFromRow(row)]));
  const matchesBySessionId = new Map<string, Match[]>();
  for (const row of (matchesResponse.data ?? []) as MatchRow[]) {
    const match = mapMatchFromRow(row, scoresByMatchId.get(row.id));
    const sessionMatches = matchesBySessionId.get(row.session_id) ?? [];
    sessionMatches.push(match);
    matchesBySessionId.set(row.session_id, sessionMatches);
  }

  const resultsBySessionId = new Map<string, SessionResult[]>();
  for (const row of (resultsResponse.data ?? []) as SessionResultRow[]) {
    const result = mapResultFromRow(row);
    const sessionResults = resultsBySessionId.get(row.session_id) ?? [];
    sessionResults.push(result);
    resultsBySessionId.set(row.session_id, sessionResults);
  }

  const sessions = ((sessionsResponse.data ?? []) as SessionRow[]).map((row) =>
    mapSessionFromRow(row, matchesBySessionId.get(row.id) ?? [], resultsBySessionId.get(row.id)),
  );

  return {
    players,
    sessions,
    history: ((historyResponse.data ?? []) as HistoryRow[]).map(mapHistoryFromRow),
    activeSessionId: sessions.find((session) => session.status === "active")?.id,
  };
}

async function saveSupabaseState(state: AppState) {
  if (!supabase) return;

  const currentSessionIds = state.sessions.map((session) => session.id);
  const existingSessions = await supabase.from("sessions").select("id");
  if (existingSessions.error) throw existingSessions.error;

  const staleSessionIds = ((existingSessions.data ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !currentSessionIds.includes(id));

  if (staleSessionIds.length) {
    const deleted = await supabase.from("sessions").delete().in("id", staleSessionIds);
    if (deleted.error) throw deleted.error;
  }

  await checkedUpsert("players", state.players.map(mapPlayerToRow), "id");
  await checkedUpsert("sessions", state.sessions.map(mapSessionToRow), "id");
  await checkedUpsert("matches", state.sessions.flatMap((session) => session.matches.map(mapMatchToRow)), "id");

  const scoredMatches = state.sessions.flatMap((session) => session.matches.filter((match) => match.score));
  const unscoredMatchIds = state.sessions.flatMap((session) => session.matches.filter((match) => !match.score).map((match) => match.id));
  if (unscoredMatchIds.length) {
    const deletedScores = await supabase.from("match_scores").delete().in("match_id", unscoredMatchIds);
    if (deletedScores.error) throw deletedScores.error;
  }
  await checkedUpsert("match_scores", scoredMatches.map(mapScoreToRow), "match_id");

  const sessionIds = state.sessions.map((session) => session.id);
  if (sessionIds.length) {
    const deletedResults = await supabase.from("session_results").delete().in("session_id", sessionIds);
    if (deletedResults.error) throw deletedResults.error;

    const deletedAwards = await supabase
      .from("championship_history")
      .delete()
      .eq("reason", "session_award")
      .in("session_id", sessionIds);
    if (deletedAwards.error) throw deletedAwards.error;
  }

  await checkedUpsert(
    "session_results",
    state.sessions.flatMap((session) => session.results ?? []).map(mapResultToRow),
    "session_id,player_id",
  );
  await checkedUpsert("championship_history", state.history.map(mapHistoryToRow), "id");
}

async function checkedUpsert(table: string, rows: Array<Record<string, unknown>>, onConflict: string) {
  if (!supabase || !rows.length) return;
  const response = await supabase.from(table).upsert(rows, { onConflict });
  if (response.error) throw response.error;
}

function mapPlayerFromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? "",
    isGuest: row.is_guest,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    totalChampionshipPoints: row.total_championship_points,
    sessionsPlayed: row.sessions_played,
  };
}

function mapPlayerToRow(player: Player): Record<string, unknown> {
  return {
    id: player.id,
    name: player.name,
    nickname: player.nickname || null,
    is_guest: player.isGuest,
    archived_at: player.archivedAt ?? null,
    created_at: player.createdAt,
    total_championship_points: player.totalChampionshipPoints,
    sessions_played: player.sessionsPlayed,
  };
}

function mapSessionFromRow(row: SessionRow, matches: Match[], results?: SessionResult[]): Session {
  return {
    id: row.id,
    date: row.session_date,
    targetScore: row.target_score,
    courtCount: row.court_count,
    playerIds: row.player_ids ?? derivePlayerIds(matches, results),
    matches,
    status: row.status,
    finalizedAt: row.finalized_at ?? undefined,
    finalsCountTowardsLeaderboard: true,
    includeFinals: true,
    results,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionToRow(session: Session): Record<string, unknown> {
  return {
    id: session.id,
    session_date: session.date,
    target_score: session.targetScore,
    court_count: session.courtCount,
    player_ids: session.playerIds,
    status: session.status,
    finalized_at: session.finalizedAt ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function mapMatchFromRow(row: MatchRow, score?: MatchScore): Match {
  return {
    id: row.id,
    sessionId: row.session_id,
    matchNumber: row.match_number,
    courtNumber: row.court_number,
    teamA: row.team_a_player_ids,
    teamB: row.team_b_player_ids,
    byes: row.bye_player_ids,
    roundNumber: Math.floor((row.match_number - 1) / 2) + 1,
    isFinal: false,
    score,
    status: row.status,
  };
}

function mapMatchToRow(match: Match): Record<string, unknown> {
  return {
    id: match.id,
    session_id: match.sessionId,
    match_number: match.matchNumber,
    court_number: match.courtNumber,
    team_a_player_ids: match.teamA,
    team_b_player_ids: match.teamB,
    bye_player_ids: match.byes,
    status: match.status,
  };
}

function mapScoreFromRow(row: MatchScoreRow): MatchScore {
  return {
    teamA: row.team_a_score,
    teamB: row.team_b_score,
    overrideTarget: row.override_target,
    adminNote: row.admin_note ?? undefined,
    enteredAt: row.entered_at,
  };
}

function mapScoreToRow(match: Match): Record<string, unknown> {
  return {
    match_id: match.id,
    team_a_score: match.score?.teamA ?? 0,
    team_b_score: match.score?.teamB ?? 0,
    override_target: match.score?.overrideTarget ?? false,
    admin_note: match.score?.adminNote ?? null,
    entered_at: match.score?.enteredAt ?? new Date().toISOString(),
  };
}

function mapResultFromRow(row: SessionResultRow): SessionResult {
  return {
    sessionId: row.session_id,
    playerId: row.player_id,
    sessionPoints: row.session_points,
    position: row.position,
    championshipPointsAwarded: row.championship_points_awarded,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    matchesPlayed: row.matches_played,
  };
}

function mapResultToRow(result: SessionResult): Record<string, unknown> {
  return {
    session_id: result.sessionId,
    player_id: result.playerId,
    session_points: result.sessionPoints,
    position: result.position,
    championship_points_awarded: result.championshipPointsAwarded,
    wins: result.wins,
    draws: result.draws,
    losses: result.losses,
    matches_played: result.matchesPlayed,
  };
}

function mapHistoryFromRow(row: HistoryRow): ChampionshipHistory {
  return {
    id: row.id,
    sessionId: row.session_id ?? undefined,
    playerId: row.player_id,
    points: row.points,
    reason: row.reason,
    awardedAt: row.awarded_at,
    metadata: row.metadata ?? undefined,
  };
}

function mapHistoryToRow(history: ChampionshipHistory): Record<string, unknown> {
  return {
    id: history.id,
    session_id: history.sessionId ?? null,
    player_id: history.playerId,
    points: history.points,
    reason: history.reason,
    awarded_at: history.awardedAt,
    metadata: history.metadata ?? {},
  };
}

function derivePlayerIds(matches: Match[], results?: SessionResult[]) {
  return Array.from(
    new Set([
      ...matches.flatMap((match) => [...match.teamA, ...match.teamB, ...match.byes]),
      ...(results ?? []).map((result) => result.playerId),
    ]),
  );
}
