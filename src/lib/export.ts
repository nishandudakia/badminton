import type { Player } from "./types";

export function standingsToCsv(players: Array<Player & { rank?: number }>) {
  const rows = [
    ["Rank", "Player", "Championship Points", "Sessions Played"],
    ...players.map((player, index) => [
      String(player.rank ?? index + 1),
      player.name,
      String(player.totalChampionshipPoints),
      String(player.sessionsPlayed),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function downloadTextFile(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
