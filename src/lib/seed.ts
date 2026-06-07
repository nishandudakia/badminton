import type { AppState, ChampionshipHistory, Player } from "./types";

const now = "2026-06-07T00:00:00.000Z";

export const regularPlayerSeeds: Array<Pick<Player, "id" | "name" | "totalChampionshipPoints">> = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Siva", totalChampionshipPoints: 63 },
  { id: "00000000-0000-4000-8000-000000000002", name: "Thush", totalChampionshipPoints: 60 },
  { id: "00000000-0000-4000-8000-000000000003", name: "Nishan", totalChampionshipPoints: 44 },
  { id: "00000000-0000-4000-8000-000000000004", name: "Thambi", totalChampionshipPoints: 34 },
  { id: "00000000-0000-4000-8000-000000000005", name: "Sam", totalChampionshipPoints: 33 },
  { id: "00000000-0000-4000-8000-000000000006", name: "Hursh", totalChampionshipPoints: 27 },
  { id: "00000000-0000-4000-8000-000000000007", name: "Abi", totalChampionshipPoints: 26 },
  { id: "00000000-0000-4000-8000-000000000008", name: "Jayson", totalChampionshipPoints: 20 },
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
    totalChampionshipPoints: player.totalChampionshipPoints,
    sessionsPlayed: 0,
  }));

  const history: ChampionshipHistory[] = players.map((player) => ({
    id: `10000000-0000-4000-8000-${player.id.slice(-12)}`,
    playerId: player.id,
    points: player.totalChampionshipPoints,
    reason: "initial_seed",
    awardedAt: now,
    metadata: { label: "Existing championship standings" },
  }));

  return {
    players,
    sessions: [],
    history,
  };
}
