import { createSign } from "node:crypto";
import fs from "node:fs/promises";

import { recalculateSeason } from "./championship";
import { createInitialState, regularPlayerSeeds } from "./seed";
import type { AppState, ChampionshipHistory, Player, Session, SessionResult } from "./types";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type SheetValuesResponse = {
  values?: string[][];
};

type SpreadsheetResponse = {
  sheets?: Array<{ properties?: { title?: string } }>;
};

type ScoreRow = {
  round: number;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  player: string;
  cumulativeScore: number;
  pointsAwarded: number;
  position: number;
  source: string;
};

const appStateSheetName = "app_state";
const scoreSheetCandidates = ["scores", "Scores", "all_scores_so_far", "all_scores_so_far.csv", "All Scores So Far", "Sheet1"];
const chunkSize = 45_000;
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";

let cachedAccessToken: { token: string; expiresAt: number } | undefined;

export function hasGoogleSheetsConfig() {
  return Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && getCredentialsSource());
}

export async function loadGoogleSheetsState(): Promise<AppState> {
  const spreadsheetId = getSpreadsheetId();
  const token = await getAccessToken();
  await ensureSheet(spreadsheetId, appStateSheetName, token);

  const storedState = await readStoredState(spreadsheetId, token);
  if (storedState) {
    return storedState;
  }

  const scoreRows = await readScoreRows(spreadsheetId, token);
  if (scoreRows.length) {
    return buildStateFromScoreRows(scoreRows);
  }

  return createInitialState();
}

export async function saveGoogleSheetsState(state: AppState) {
  const spreadsheetId = getSpreadsheetId();
  const token = await getAccessToken();
  await ensureSheet(spreadsheetId, appStateSheetName, token);

  const serialized = JSON.stringify({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    state,
  });
  const chunks = serialized.match(new RegExp(`.{1,${chunkSize}}`, "gs")) ?? [serialized];
  const rows = [
    ["key", "value"],
    ["schema_version", "1"],
    ["updated_at", new Date().toISOString()],
    ["chunk_count", String(chunks.length)],
    ...chunks.map((chunk, index) => [`chunk_${String(index).padStart(4, "0")}`, chunk]),
  ];

  await clearValues(spreadsheetId, appStateSheetName, token);
  await updateValues(spreadsheetId, `${quoteSheetName(appStateSheetName)}!A1:B${rows.length}`, rows, token);
}

async function readStoredState(spreadsheetId: string, token: string): Promise<AppState | undefined> {
  const values = await getValues(spreadsheetId, `${quoteSheetName(appStateSheetName)}!A:B`, token);
  if (values.length < 2) return undefined;

  const entries = new Map(values.slice(1).map((row) => [row[0], row[1] ?? ""]));
  const chunkCount = Number(entries.get("chunk_count") ?? 0);
  if (!chunkCount) return undefined;

  const json = Array.from({ length: chunkCount }, (_, index) => entries.get(`chunk_${String(index).padStart(4, "0")}`) ?? "").join("");
  if (!json) return undefined;

  const parsed = JSON.parse(json) as { state?: AppState };
  if (!parsed.state) return undefined;

  return recalculateSeason(parsed.state);
}

async function readScoreRows(spreadsheetId: string, token: string): Promise<ScoreRow[]> {
  for (const sheetName of scoreSheetCandidates) {
    const values = await getValues(spreadsheetId, `${quoteSheetName(sheetName)}!A:I`, token, true);
    const rows = parseScoreRows(values);
    if (rows.length) return rows;
  }

  return [];
}

function parseScoreRows(values: string[][]): ScoreRow[] {
  if (values.length < 2) return [];

  const headers = values[0].map((header) => normalizeHeader(header));
  const index = (name: string) => headers.indexOf(name);
  const required = ["round", "session_id", "session_date", "player_id", "player", "cumulative_score", "points_awarded", "position"];
  if (required.some((header) => index(header) === -1)) return [];

  return values
    .slice(1)
    .map((row) => ({
      round: Number(row[index("round")]),
      sessionId: row[index("session_id")] ?? "",
      sessionDate: row[index("session_date")] ?? "",
      playerId: row[index("player_id")] ?? "",
      player: row[index("player")] ?? "",
      cumulativeScore: Number(row[index("cumulative_score")]),
      pointsAwarded: Number(row[index("points_awarded")]),
      position: Number(row[index("position")]),
      source: row[index("source")] ?? "google-sheets-import",
    }))
    .filter(
      (row) =>
        Number.isFinite(row.round) &&
        row.sessionId &&
        row.playerId &&
        row.player &&
        Number.isFinite(row.cumulativeScore) &&
        Number.isFinite(row.pointsAwarded) &&
        Number.isFinite(row.position),
    );
}

function buildStateFromScoreRows(scoreRows: ScoreRow[]): AppState {
  const createdAt = new Date().toISOString();
  const playerRows = new Map<string, ScoreRow>();
  for (const row of scoreRows) {
    playerRows.set(row.playerId, row);
  }

  const players: Player[] = regularPlayerSeeds.map((seed) => {
    const latest = scoreRows
      .filter((row) => row.playerId === seed.id)
      .sort((a, b) => b.round - a.round)[0];

    return {
      id: seed.id,
      name: latest?.player ?? seed.name,
      nickname: "",
      isGuest: false,
      createdAt,
      totalChampionshipPoints: latest?.cumulativeScore ?? 0,
      sessionsPlayed: scoreRows.filter((row) => row.playerId === seed.id).length,
    };
  });

  for (const row of playerRows.values()) {
    if (players.some((player) => player.id === row.playerId)) continue;
    players.push({
      id: row.playerId,
      name: row.player,
      nickname: "",
      isGuest: false,
      createdAt,
      totalChampionshipPoints: row.cumulativeScore,
      sessionsPlayed: scoreRows.filter((scoreRow) => scoreRow.playerId === row.playerId).length,
    });
  }

  const sessions: Session[] = [];
  const history: ChampionshipHistory[] = [];
  const rowsBySession = new Map<string, ScoreRow[]>();
  for (const row of scoreRows) {
    rowsBySession.set(row.sessionId, [...(rowsBySession.get(row.sessionId) ?? []), row]);
  }

  for (const rows of rowsBySession.values()) {
    const first = rows[0];
    const timestamp = referenceTimestamp(first.round);
    const results: SessionResult[] = rows
      .slice()
      .sort((a, b) => a.position - b.position || b.cumulativeScore - a.cumulativeScore || a.player.localeCompare(b.player))
      .map((row) => ({
        sessionId: row.sessionId,
        playerId: row.playerId,
        sessionPoints: row.cumulativeScore,
        position: row.position,
        championshipPointsAwarded: row.pointsAwarded,
        wins: 0,
        draws: 0,
        losses: 0,
        matchesPlayed: 0,
      }));

    sessions.push({
      id: first.sessionId,
      date: first.sessionDate || `Round ${first.round}`,
      targetScore: 15,
      courtCount: 1,
      playerIds: rows.map((row) => row.playerId),
      matches: [],
      status: "finalized",
      finalizedAt: timestamp,
      finalsCountTowardsLeaderboard: true,
      includeFinals: false,
      results,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    for (const row of rows) {
      history.push({
        id: `google-sheets-${row.sessionId}-${row.playerId}`,
        sessionId: row.sessionId,
        playerId: row.playerId,
        points: row.pointsAwarded,
        reason: "session_award",
        awardedAt: timestamp,
        metadata: {
          source: row.source,
          sessionDate: row.sessionDate || `Round ${row.round}`,
          referenceRound: row.round,
          cumulativeScore: row.cumulativeScore,
        },
      });
    }
  }

  return recalculateSeason({
    players,
    sessions: sessions.sort((a, b) => (b.finalizedAt ?? b.date).localeCompare(a.finalizedAt ?? a.date)),
    history,
  });
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const credentials = await readCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: sheetsScope,
    aud: credentials.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(credentials.private_key, "base64url");
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch(credentials.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google auth failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

async function readCredentials(): Promise<ServiceAccountCredentials> {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson) as ServiceAccountCredentials;
  }

  const credentialsPath = getCredentialsSource();
  if (!credentialsPath) {
    throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.");
  }

  return JSON.parse(await fs.readFile(credentialsPath, "utf8")) as ServiceAccountCredentials;
}

async function ensureSheet(spreadsheetId: string, sheetName: string, token: string) {
  const response = await sheetsFetch<SpreadsheetResponse>(`/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, token);
  const exists = response.sheets?.some((sheet) => sheet.properties?.title === sheetName);
  if (exists) return;

  await sheetsFetch(`/v4/spreadsheets/${spreadsheetId}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    }),
  });
}

async function getValues(spreadsheetId: string, range: string, token: string, allowMissing = false) {
  try {
    const response = await sheetsFetch<SheetValuesResponse>(
      `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      token,
    );
    return response.values ?? [];
  } catch (error) {
    if (allowMissing && error instanceof Error && error.message.includes("Unable to parse range")) {
      return [];
    }
    throw error;
  }
}

async function updateValues(spreadsheetId: string, range: string, values: string[][], token: string) {
  await sheetsFetch(`/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

async function clearValues(spreadsheetId: string, sheetName: string, token: string) {
  await sheetsFetch(`/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quoteSheetName(sheetName)}!A:B`)}:clear`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function sheetsFetch<T = unknown>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://sheets.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Set GOOGLE_SHEETS_SPREADSHEET_ID to the target Google Sheet ID.");
  }
  return spreadsheetId;
}

function getCredentialsSource() {
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(" ", "_");
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function referenceTimestamp(roundNumber: number) {
  return `2026-01-${String(roundNumber).padStart(2, "0")}T00:00:00.000Z`;
}
