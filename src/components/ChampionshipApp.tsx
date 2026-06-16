"use client";

import {
  AlertTriangle,
  LineChart,
  Check,
  Copy,
  Medal,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  addPlayer,
  clearMatchScore,
  createSession,
  deleteSession,
  finalizeSession,
  recalculateSeason,
  regenerateSessionSchedule,
  resetChampionship,
  setMatchScore,
  updateMatchTeams,
  updateSessionBasics,
} from "@/lib/championship";
import { createInitialState } from "@/lib/seed";
import { calculateSessionResults, sortChampionshipPlayers } from "@/lib/scoring";
import { loadPersistedState, savePersistedState } from "@/lib/repository";
import type { AppState, Match, MatchScore, Player, Session } from "@/lib/types";

type Mode = "dashboard" | "create" | "tournament" | "past" | "board";

export function ChampionshipApp() {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [toast, setToast] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [championshipWinner, setChampionshipWinner] = useState<{ name: string; points: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPersistedState().then((loadedState) => {
        const nextState = recalculateSeason(loadedState);
        setState(nextState);
        setMode("dashboard");
        document.documentElement.classList.remove("dark");
        setHasLoaded(true);
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    void savePersistedState(state);
  }, [hasLoaded, state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentTournament = useMemo(() => findCurrentTournament(state), [state]);

  function commit(updater: (current: AppState) => AppState) {
    setState((current) => recalculateSeason(updater(current)));
  }

  function showToast(message: string) {
    setToast(message);
  }

  if (!hasLoaded) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white text-[#17201b]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#16a34a]" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-white text-[#17201b]">
      <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#16a34a] text-white">
              <Trophy size={22} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Badminton</p>
              <h1 className="text-2xl font-black tracking-normal">Tournament Generator</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "create" ? "primary" : "ghost"} onClick={() => setMode("create")}>
              <Plus size={16} />
              New tournament
            </Button>
            <Button variant={mode === "dashboard" ? "primary" : "ghost"} onClick={() => setMode("dashboard")}>
              <LineChart size={16} />
              Dashboard
            </Button>
            <Button variant={mode === "past" ? "primary" : "ghost"} onClick={() => setMode("past")}>
              <Trophy size={16} />
              Past tournaments
            </Button>
            <Button variant={mode === "board" ? "primary" : "ghost"} onClick={() => setMode("board")}>
              <Medal size={16} />
              Championship board
            </Button>
            {currentTournament && (
              <Button variant={mode === "tournament" ? "primary" : "ghost"} onClick={() => setMode("tournament")}>
                <Play size={16} />
                Current tournament
              </Button>
            )}
          </div>
        </header>

        <div className="py-5">
          {mode === "dashboard" ? (
            <Dashboard state={state} onToast={showToast} onReset={() => setShowResetConfirm(true)} />
          ) : mode === "board" ? (
            <ChampionshipBoard state={state} />
          ) : mode === "past" ? (
            <PastTournaments
              state={state}
              onDelete={(sessionId) => {
                commit((current) => deleteSession(current, sessionId));
                showToast("Past tournament deleted");
              }}
            />
          ) : mode === "create" || !currentTournament ? (
            <CreateTournament
              state={state}
              onCreate={(playerIds, targetScore, courtCount, includeFinals) => {
                commit((current) =>
                  createSession(current, {
                    playerIds,
                    targetScore,
                    courtCount,
                    includeFinals,
                    finalsCountTowardsLeaderboard: includeFinals,
                  }),
                );
                setMode("tournament");
                showToast("Tournament generated");
              }}
              onAddPlayer={(name) => {
                commit((current) => addPlayer(current, { name }));
                showToast("Player added");
              }}
            />
          ) : (
            <TournamentWorkspace
              state={state}
              session={currentTournament}
              onSetScore={(match, score) => {
                commit((current) => setMatchScore(current, currentTournament.id, match.id, score));
              }}
              onClearScore={(matchId) => {
                commit((current) => clearMatchScore(current, currentTournament.id, matchId));
                showToast("Score cleared");
              }}
              onTeamsChange={(matchId, teamA, teamB) => {
                commit((current) => updateMatchTeams(current, currentTournament.id, matchId, { teamA, teamB }));
              }}
              onBasicsChange={(targetScore, courtCount) => {
                commit((current) => updateSessionBasics(current, currentTournament.id, { targetScore, courtCount }));
                showToast("Tournament settings saved");
              }}
              onRegenerate={() => {
                commit((current) => regenerateSessionSchedule(current, currentTournament.id));
                showToast("Schedule regenerated");
              }}
              onDelete={() => {
                commit((current) => deleteSession(current, currentTournament.id));
                setMode("create");
                showToast("Tournament deleted");
              }}
              onSubmitChampionshipPoints={() => {
                commit((current) => finalizeSession(current, currentTournament.id));
                setMode("dashboard");
                showToast("Championship points submitted");
              }}
            />
          )}
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmResetModal
          state={state}
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            const winner = sortChampionshipPlayers(state.players.filter((player) => !player.isGuest && !player.archivedAt))[0];
            commit((current) => resetChampionship(current));
            setShowResetConfirm(false);
            if (winner) {
              setChampionshipWinner({ name: winner.name, points: winner.totalChampionshipPoints });
            }
            setMode("board");
            showToast("Championship reset");
          }}
        />
      )}

      {championshipWinner && (
        <WinnerModal winner={championshipWinner} onClose={() => setChampionshipWinner(null)} />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-[#17201b] px-4 py-3 text-sm font-black text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function ConfirmResetModal({ state, onCancel, onConfirm }: { state: AppState; onCancel: () => void; onConfirm: () => void }) {
  const rankedPlayers = sortChampionshipPlayers(state.players.filter((player) => !player.isGuest && !player.archivedAt));
  const leader = rankedPlayers[0];

  return (
    <ModalShell>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#fff1ef] text-[#dc2626]">
          <AlertTriangle size={22} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-normal">Reset championship?</h2>
          <p className="mt-2 text-sm font-semibold text-black/55">
            This will declare the current leader as champion, save them to the championship board, and restart the live points table from zero.
          </p>
          {leader && (
            <div className="mt-4 rounded-lg border border-[#16a34a]/30 bg-[#edf8ef] p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#0f766e]">Current winner</p>
              <p className="mt-1 text-lg font-black">{leader.name}</p>
              <p className="text-sm font-black text-[#0f766e]">{leader.totalChampionshipPoints} pts</p>
            </div>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!leader} onClick={onConfirm}>
              <RotateCcw size={16} />
              Reset championship
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function WinnerModal({ winner, onClose }: { winner: { name: string; points: number }; onClose: () => void }) {
  return (
    <ModalShell>
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#f59e0b]/30 bg-[#fff7ed] text-[#d97706]">
          <Medal size={42} />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Championship winner</p>
        <h2 className="mt-2 text-3xl font-black tracking-normal">{winner.name}</h2>
        <p className="mt-2 text-sm font-semibold text-black/55">{winner.points} championship points</p>
        <Button className="mt-6 w-full" onClick={onClose}>
          View championship board
        </Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 py-6">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 shadow-2xl sm:p-6">
        {children}
      </section>
    </div>
  );
}

function PastTournaments({ state, onDelete }: { state: AppState; onDelete: (sessionId: string) => void }) {
  const pastSessions = state.sessions
    .filter((session) => session.status === "finalized")
    .sort((a, b) => (b.finalizedAt ?? b.date).localeCompare(a.finalizedAt ?? a.date));

  return (
    <Panel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle icon={Trophy} title="Past Tournaments" />
          <p className="mt-2 text-sm font-semibold text-black/55">
            {pastSessions.length ? `${pastSessions.length} completed tournaments saved.` : "Completed tournaments will appear here."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {pastSessions.map((session) => {
          const results = session.results ?? calculateSessionResults(session);
          const winner = results[0];
          const completedMatches = session.matches.filter((match) => match.score).length;

          return (
            <article
              key={session.id}
              className="grid gap-3 rounded-lg border border-black/10 bg-[#fafafa] p-4 lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black tracking-normal">Tournament {session.date}</h3>
                  <StatusBadge complete />
                </div>
                <div className="mt-2 grid gap-2 text-sm font-semibold text-black/55 sm:grid-cols-4">
                  <p>{session.playerIds.length} players</p>
                  <p>{completedMatches}/{session.matches.length || completedMatches} matches</p>
                  <p>{session.targetScore} target</p>
                  <p>{session.courtCount} {session.courtCount === 1 ? "court" : "courts"}</p>
                </div>
                {winner && (
                  <p className="mt-3 text-sm font-black text-[#0f766e]">
                    Winner: {getPlayerName(state, winner.playerId)} ({winner.sessionPoints} pts)
                  </p>
                )}
              </div>
              <IconButton
                title="Delete past tournament"
                danger
                onClick={() => {
                  if (window.confirm(`Delete tournament ${session.date}? This removes its championship points.`)) {
                    onDelete(session.id);
                  }
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </article>
          );
        })}
      </div>

      {!pastSessions.length && <EmptyInline text="Submit championship points from a tournament to move it into this tab." />}
    </Panel>
  );
}

function ChampionshipBoard({ state }: { state: AppState }) {
  const winners = getChampionshipWinners(state);

  return (
    <Panel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle icon={Medal} title="Championship Board" />
          <p className="mt-2 text-sm font-semibold text-black/55">
            {winners.length ? `${winners.length} championship ${winners.length === 1 ? "winner" : "winners"} recorded.` : "Championship winners will appear here after a reset."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {winners.map((winner, index) => (
          <article
            key={winner.id}
            className="grid gap-3 rounded-lg border border-black/10 bg-[#fafafa] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
          >
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
              <Medal size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-black/40">Championship {winner.championshipNumber ?? winners.length - index}</p>
              <h3 className="mt-1 truncate text-lg font-black tracking-normal">{winner.playerName}</h3>
              <p className="mt-1 text-sm font-semibold text-black/55">{formatDateTime(winner.awardedAt)}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl font-black text-[#0f766e]">{winner.points}</p>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-black/40">winning pts</p>
            </div>
          </article>
        ))}
      </div>

      {!winners.length && <EmptyInline text="Reset the current championship from the dashboard to record the first winner." />}
    </Panel>
  );
}

function Dashboard({ state, onToast, onReset }: { state: AppState; onToast: (message: string) => void; onReset: () => void }) {
  const rankedPlayers = sortChampionshipPlayers(state.players.filter((player) => !player.isGuest && !player.archivedAt));
  const timeline = buildChampionshipTimeline(state);
  const leader = rankedPlayers[0];
  const podium = rankedPlayers.slice(0, 3);

  async function copyPointsTable() {
    if (!rankedPlayers.length) return;

    const table = formatChampionshipPointsTable(rankedPlayers);
    try {
      await copyTextToClipboard(table);
      onToast("Championship points table copied");
    } catch {
      onToast("Could not copy points table");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:gap-5">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SectionTitle icon={LineChart} title="Championship Dashboard" />
            <p className="mt-2 text-sm font-semibold text-black/55">
              Current standings after {timeline.length ? timeline.at(-1)?.label : "no recorded rounds"}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {leader && (
              <div className="rounded-lg border border-[#16a34a]/30 bg-[#edf8ef] px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#0f766e]">Leader</p>
                <p className="mt-1 text-lg font-black sm:text-xl">{leader.name}</p>
                <p className="text-sm font-black text-[#0f766e]">{leader.totalChampionshipPoints} pts</p>
              </div>
            )}
            <Button variant="danger" disabled={!leader || leader.totalChampionshipPoints <= 0} onClick={onReset}>
              <RotateCcw size={16} />
              Reset championship
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {podium.map((player, index) => (
            <div key={player.id} className="rounded-lg border border-black/10 bg-[#fafafa] px-2.5 py-2">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-black/40">#{index + 1}</p>
              <p className="mt-1 truncate text-sm font-black">{player.name}</p>
              <p className="text-lg font-black text-[#0f766e]">{player.totalChampionshipPoints}</p>
            </div>
          ))}
        </div>

        <ChampionshipLineChart players={rankedPlayers.slice(0, 8)} timeline={timeline} />
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle icon={Trophy} title="Points Table" />
          <IconButton title="Copy points table" disabled={!rankedPlayers.length} onClick={copyPointsTable}>
            <Copy size={18} />
          </IconButton>
        </div>
        <div className="mt-4 space-y-2">
          {rankedPlayers.map((player, index) => (
            <div key={player.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-black/10 bg-white p-2.5 sm:gap-3 sm:p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#17201b] text-sm font-black text-white sm:h-10 sm:w-10 sm:text-base">{index + 1}</div>
              <div className="min-w-0">
                <p className="truncate font-black">{player.name}</p>
                <p className="text-sm font-semibold text-black/50">{player.sessionsPlayed} sessions</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-[#0f766e] sm:text-xl">{player.totalChampionshipPoints}</p>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-black/40">pts</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CreateTournament({
  state,
  onCreate,
  onAddPlayer,
}: {
  state: AppState;
  onCreate: (playerIds: string[], targetScore: number, courtCount: number, includeFinals: boolean) => void;
  onAddPlayer: (name: string) => void;
}) {
  const activePlayers = state.players.filter((player) => !player.archivedAt);
  const [selected, setSelected] = useState<string[]>(activePlayers.filter((player) => !player.isGuest).map((player) => player.id));
  const [targetScore, setTargetScore] = useState(15);
  const [courtCount, setCourtCount] = useState(1);
  const [includeFinals, setIncludeFinals] = useState(true);
  const [newPlayer, setNewPlayer] = useState("");
  const canIncludeFinals = selected.length >= 4;

  function togglePlayer(playerId: string) {
    setSelected((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle icon={Users} title="Players" />
          <div className="grid grid-cols-2 gap-2 sm:w-64">
            <NumberField label="Target" value={targetScore} min={1} onChange={setTargetScore} />
            <NumberField label="Courts" value={courtCount} min={1} onChange={setCourtCount} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activePlayers.map((player) => {
            const checked = selected.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayer(player.id)}
                className={`min-h-20 rounded-lg border p-4 text-left transition ${
                  checked ? "border-[#16a34a] bg-[#edf8ef]" : "border-black/10 bg-white hover:border-[#16a34a]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-black">{player.name}</span>
                    <span className="mt-1 block text-sm font-semibold text-black/50">{player.isGuest ? "Guest" : "Regular"}</span>
                  </span>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${checked ? "bg-[#16a34a] text-white" : "bg-black/5"}`}>
                    {checked && <Check size={17} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {!activePlayers.length && <EmptyInline text="Add at least two players to generate a tournament." />}
      </Panel>

      <div className="space-y-5">
        <Panel>
          <SectionTitle icon={UserPlus} title="Add Player" />
          <div className="mt-4 space-y-3">
            <TextField label="Name" value={newPlayer} onChange={setNewPlayer} />
            <Button
              className="w-full"
              onClick={() => {
                const name = newPlayer.trim();
                if (!name) return;
                onAddPlayer(name);
                setNewPlayer("");
              }}
            >
              <Plus size={16} />
              Add player
            </Button>
          </div>
        </Panel>

        <Panel>
          <p className="text-sm font-black text-black/55">{selected.length} players selected</p>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-black/10 bg-[#fafafa] p-3">
            <span>
              <span className="block text-sm font-black text-[#17201b]">Finals</span>
              <span className="mt-1 block text-xs font-bold text-black/50">
                {canIncludeFinals ? "Seeded from the leaderboard" : "Available for 4+ players"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={canIncludeFinals && includeFinals}
              disabled={!canIncludeFinals}
              onChange={(event) => setIncludeFinals(event.target.checked)}
              className="h-5 w-5 accent-[#16a34a]"
            />
          </label>
          <Button className="mt-3 w-full" disabled={selected.length < 2} onClick={() => onCreate(selected, targetScore, courtCount, canIncludeFinals && includeFinals)}>
            <Play size={16} />
            Generate schedule
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function TournamentWorkspace({
  state,
  session,
  onSetScore,
  onClearScore,
  onTeamsChange,
  onBasicsChange,
  onRegenerate,
  onDelete,
  onSubmitChampionshipPoints,
}: {
  state: AppState;
  session: Session;
  onSetScore: (match: Match, score: Omit<MatchScore, "enteredAt">) => void;
  onClearScore: (matchId: string) => void;
  onTeamsChange: (matchId: string, teamA: string[], teamB: string[]) => void;
  onBasicsChange: (targetScore: number, courtCount: number) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onSubmitChampionshipPoints: () => void;
}) {
  const completedMatches = session.matches.filter((match) => match.score).length;
  const leaderboard = calculateSessionResults(session);
  const groupedMatches = groupMatchesByRound(session.matches);
  const submitted = session.status === "finalized";
  const hasFinals = session.matches.some((match) => match.isFinal);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionTitle icon={Trophy} title={`Tournament ${session.date}`} />
              <p className="mt-2 text-sm font-semibold text-black/55">
                {completedMatches}/{session.matches.length} matches scored
              </p>
              {session.includeFinals && !hasFinals && (
                <p className="mt-1 text-sm font-black text-[#0f766e]">Finals unlock after the scheduled rounds.</p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <NumberField label="Target" value={session.targetScore} min={1} onChange={(value) => onBasicsChange(value, session.courtCount)} />
              <NumberField label="Courts" value={session.courtCount} min={1} onChange={(value) => onBasicsChange(session.targetScore, value)} />
              <IconButton title="Regenerate schedule" onClick={onRegenerate}>
                <RefreshCw size={18} />
              </IconButton>
              <IconButton title="Delete tournament" danger onClick={onDelete}>
                <Trash2 size={18} />
              </IconButton>
            </div>
          </div>
          <ProgressBar value={session.matches.length ? (completedMatches / session.matches.length) * 100 : 0} />
        </Panel>

        {groupedMatches.map((round) => (
          <section key={round.key} className="space-y-3">
            <div className="sticky top-0 z-10 border-b border-black/10 bg-white/95 py-3 backdrop-blur">
              <h2 className="text-lg font-black">{round.label}</h2>
            </div>
            {round.matches.map((match) => (
              <MatchCard
                key={`${match.id}-${session.targetScore}`}
                state={state}
                session={session}
                match={match}
                onSetScore={onSetScore}
                onClearScore={onClearScore}
                onTeamsChange={onTeamsChange}
              />
            ))}
          </section>
        ))}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
        <Panel>
          <SectionTitle icon={Trophy} title="Leaderboard" />
          <div className="mt-4 space-y-2">
            {leaderboard.map((result) => (
              <LeaderboardRow key={result.playerId} state={state} result={result} />
            ))}
          </div>
          {hasFinals && (
            <p className="mt-3 rounded-lg border border-[#16a34a]/30 bg-[#edf8ef] p-3 text-sm font-black text-[#0f766e]">
              Finals count toward championship points.
            </p>
          )}
          <Button
            className="mt-4 w-full"
            disabled={submitted}
            onClick={onSubmitChampionshipPoints}
          >
            <Trophy size={16} />
            {submitted ? "Championship points submitted" : "Submit championship points"}
          </Button>
        </Panel>
      </aside>
    </div>
  );
}

function MatchCard({
  state,
  session,
  match,
  onSetScore,
  onClearScore,
  onTeamsChange,
}: {
  state: AppState;
  session: Session;
  match: Match;
  onSetScore: (match: Match, score: Omit<MatchScore, "enteredAt">) => void;
  onClearScore: (matchId: string) => void;
  onTeamsChange: (matchId: string, teamA: string[], teamB: string[]) => void;
}) {
  const defaultTeamAScore = Math.ceil(session.targetScore / 2);
  const [draftScore, setDraftScore] = useState<{ teamA: number; teamB: number } | null>(null);
  const scoreA = draftScore?.teamA ?? match.score?.teamA ?? defaultTeamAScore;
  const scoreB = draftScore?.teamB ?? match.score?.teamB ?? session.targetScore - defaultTeamAScore;
  const selectedPlayerIds = [...match.teamA, ...match.teamB];
  const duplicate = selectedPlayerIds.some((playerId, index) => selectedPlayerIds.indexOf(playerId) !== index);
  const completed = Boolean(match.score);

  useEffect(() => {
    if (!draftScore || duplicate) return;

    const timer = window.setTimeout(() => {
      onSetScore(match, {
        teamA: draftScore.teamA,
        teamB: draftScore.teamB,
        overrideTarget: draftScore.teamA + draftScore.teamB !== session.targetScore,
      });
      setDraftScore(null);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draftScore, duplicate, match, onSetScore, session.targetScore]);

  return (
    <article className={`rounded-lg border p-4 ${completed ? "border-[#16a34a]/50 bg-[#f4fbf5]" : "border-black/10 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">
            {match.isFinal ? "Final" : `Match ${match.matchNumber}`} / Court {match.courtNumber}
          </p>
          <p className="mt-1 text-sm font-semibold text-black/55">{completed ? "Scored" : "Not scored"}</p>
        </div>
        <StatusBadge complete={completed} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <TeamEditor
          label="Team A"
          value={match.teamA}
          playerIds={session.playerIds}
          state={state}
          slots={Math.max(match.teamA.length, 1)}
          onChange={(teamA) => onTeamsChange(match.id, teamA, match.teamB)}
        />
        <div className="text-center text-xs font-black uppercase tracking-[0.14em] text-black/35">vs</div>
        <TeamEditor
          label="Team B"
          value={match.teamB}
          playerIds={session.playerIds}
          state={state}
          slots={Math.max(match.teamB.length, 1)}
          onChange={(teamB) => onTeamsChange(match.id, match.teamA, teamB)}
        />
      </div>

      {duplicate && <p className="mt-3 text-sm font-bold text-[#dc2626]">A player is selected more than once.</p>}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <ScoreSlider
          targetScore={session.targetScore}
          teamAScore={scoreA}
          teamBScore={scoreB}
          onScoreChange={(nextScoreA, nextScoreB) => {
            setDraftScore({ teamA: nextScoreA, teamB: nextScoreB });
          }}
        />
        <IconButton
          title="Clear score"
          disabled={!completed}
          onClick={() => {
            setDraftScore(null);
            onClearScore(match.id);
          }}
        >
          <RotateCcw size={18} />
        </IconButton>
      </div>
    </article>
  );
}

function ScoreSlider({
  targetScore,
  teamAScore,
  teamBScore,
  onScoreChange,
}: {
  targetScore: number;
  teamAScore: number;
  teamBScore: number;
  onScoreChange: (teamA: number, teamB: number) => void;
}) {
  const sliderMax = Math.max(targetScore, 1);

  function setSliderValue(value: number) {
    const nextTeamA = Math.max(0, Math.min(targetScore, Math.round(value)));
    onScoreChange(nextTeamA, targetScore - nextTeamA);
  }

  return (
    <div className="min-w-0 rounded-lg border border-black/10 bg-[#fafafa] p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ScoreReadout label="Team A" value={teamAScore} />
        <div className="text-center text-xs font-black uppercase tracking-[0.14em] text-black/35">vs</div>
        <ScoreReadout label="Team B" value={teamBScore} />
      </div>
      <input
        type="range"
        min={0}
        max={sliderMax}
        value={Math.min(teamAScore, sliderMax)}
        onInput={(event) => setSliderValue(Number(event.currentTarget.value))}
        onChange={(event) => setSliderValue(Number(event.target.value))}
        className="score-slider mt-3 w-full appearance-none bg-transparent"
        aria-label="Set score split"
      />
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.1em] text-black/40">
        <span>0</span>
        <span className="text-[#0f766e]">{targetScore} total</span>
        <span>{targetScore}</span>
      </div>
    </div>
  );
}

function ScoreReadout({ label, value }: { label: string; value: number }) {
  return (
    <div className="block min-w-0">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-black/45">{label}</span>
      <span className="grid h-11 w-full place-items-center rounded-lg border border-black/10 bg-white px-3 text-center text-lg font-black">
        {value}
      </span>
    </div>
  );
}

function TeamEditor({
  label,
  value,
  playerIds,
  state,
  slots,
  onChange,
}: {
  label: string;
  value: string[];
  playerIds: string[];
  state: AppState;
  slots?: number;
  onChange: (next: string[]) => void;
}) {
  const slotCount = Math.max(1, slots ?? 2);

  return (
    <div className="rounded-lg border border-black/10 bg-[#fafafa] p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-black/45">{label}</p>
      <div className={slotCount === 1 ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
        {Array.from({ length: slotCount }, (_, index) => (
          <select
            key={index}
            value={value[index] ?? ""}
            onChange={(event) => {
              const next = [...value];
              next[index] = event.target.value;
              onChange(next);
            }}
            className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#16a34a]"
          >
            {playerIds.map((playerId) => (
              <option key={playerId} value={playerId}>
                {getPlayerName(state, playerId)}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}

function LeaderboardRow({ state, result }: { state: AppState; result: ReturnType<typeof calculateSessionResults>[number] }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#17201b] font-black text-white">{result.position}</div>
      <div className="min-w-0">
        <p className="truncate font-black">{getPlayerName(state, result.playerId)}</p>
        <p className="text-sm font-semibold text-black/50">
          {result.wins}-{result.draws}-{result.losses}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-black text-[#0f766e]">{result.sessionPoints}</p>
        <p className="text-xs font-black uppercase tracking-[0.1em] text-black/40">
          {result.championshipPointsAwarded} champ pts
        </p>
      </div>
    </div>
  );
}

function findCurrentTournament(state: AppState) {
  const sessionsWithMatches = state.sessions.filter((session) => session.matches.length > 0 && session.status !== "finalized");
  return (
    sessionsWithMatches.find((session) => session.id === state.activeSessionId) ??
    sessionsWithMatches.find((session) => session.status === "active")
  );
}

function groupMatchesByRound(matches: Match[]) {
  const groups = new Map<string, { key: string; label: string; matches: Match[]; sort: number }>();
  matches.forEach((match, index) => {
    const roundNumber = match.roundNumber ?? Math.floor(index / 2) + 1;
    const key = match.isFinal ? "finals" : `round-${roundNumber}`;
    const existing = groups.get(key) ?? {
      key,
      label: match.isFinal ? "Finals" : `Round ${roundNumber}`,
      matches: [],
      sort: match.isFinal ? Number.MAX_SAFE_INTEGER : roundNumber,
    };
    existing.matches.push(match);
    groups.set(key, existing);
  });
  return Array.from(groups.values()).sort((a, b) => a.sort - b.sort);
}

function getPlayerName(state: AppState, playerId: string) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Unknown";
}

function getChampionshipWinners(state: AppState) {
  return state.history
    .filter((event) => event.metadata?.type === "championship_win")
    .map((event) => ({
      id: event.id,
      playerName: getPlayerName(state, event.playerId),
      points: Number(event.metadata?.winnerPoints ?? 0),
      championshipNumber:
        typeof event.metadata?.championshipNumber === "number" ? event.metadata.championshipNumber : undefined,
      awardedAt: event.awardedAt,
    }))
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatChampionshipPointsTable(players: Player[]) {
  return players
    .map((player, index) => `${index + 1}. ${player.name} — ${player.totalChampionshipPoints}`)
    .join("\n");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some browser surfaces expose the Clipboard API but deny writes.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command failed");
    }
  } finally {
    document.body.removeChild(textArea);
  }
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Trophy; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#17201b] text-white">
        <Icon size={18} />
      </span>
      <h2 className="text-lg font-black tracking-normal">{title}</h2>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5">{children}</section>;
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const variants = {
    primary: "bg-[#17201b] text-white hover:bg-[#0f766e]",
    ghost: "border border-black/10 bg-white text-[#17201b] hover:border-[#16a34a]",
    danger: "bg-[#dc2626] text-white hover:bg-[#991b1b]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? "border-[#dc2626]/30 bg-[#fff1ef] text-[#dc2626] hover:bg-[#dc2626] hover:text-white"
          : "border-black/10 bg-white text-[#17201b] hover:border-[#16a34a] hover:text-[#0f766e]"
      }`}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-24">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-black/45">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm font-black outline-none focus:border-[#16a34a]"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-black/45">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#16a34a]"
      />
    </label>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4 h-3 overflow-hidden rounded-lg bg-black/10">
      <div className="h-full rounded-lg bg-[#16a34a] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span className={`rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] ${complete ? "bg-[#e7f7e9] text-[#166534]" : "bg-black/5 text-black/55"}`}>
      {complete ? "Complete" : "Open"}
    </span>
  );
}

type TimelinePoint = {
  label: string;
  totals: Map<string, number>;
};

function buildChampionshipTimeline(state: AppState): TimelinePoint[] {
  const eventsBySession = new Map<string, { label: string; sort: string; events: typeof state.history }>();

  for (const event of state.history) {
    const resetId = typeof event.metadata?.resetId === "string" ? event.metadata.resetId : undefined;
    const key = event.sessionId ?? resetId ?? event.id;
    const session = event.sessionId ? state.sessions.find((item) => item.id === event.sessionId) : undefined;
    const isResetEvent = event.metadata?.type === "championship_win" || event.metadata?.type === "championship_reset";
    const existing = eventsBySession.get(key) ?? {
      label: isResetEvent ? "Championship reset" : String(event.metadata?.sessionDate ?? session?.date ?? "Adjustment"),
      sort: event.awardedAt,
      events: [],
    };
    existing.events.push(event);
    eventsBySession.set(key, existing);
  }

  const totals = new Map(state.players.map((player) => [player.id, 0]));
  return Array.from(eventsBySession.values())
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((bucket) => {
      for (const event of bucket.events) {
        totals.set(event.playerId, (totals.get(event.playerId) ?? 0) + event.points);
      }

      return {
        label: bucket.label,
        totals: new Map(totals),
      };
    });
}

function ChampionshipLineChart({ players, timeline }: { players: Player[]; timeline: TimelinePoint[] }) {
  const width = 720;
  const height = 280;
  const padding = { top: 18, right: 18, bottom: 42, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxPoints = Math.max(1, ...players.flatMap((player) => timeline.map((point) => point.totals.get(player.id) ?? 0)));
  const colors = ["#16a34a", "#2563eb", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#4f46e5", "#65a30d"];

  function x(index: number) {
    return padding.left + (timeline.length <= 1 ? 0 : (index / (timeline.length - 1)) * plotWidth);
  }

  function y(points: number) {
    return padding.top + plotHeight - (points / maxPoints) * plotHeight;
  }

  function pathFor(player: Player) {
    return timeline
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point.totals.get(player.id) ?? 0).toFixed(1)}`)
      .join(" ");
  }

  return (
    <div className="mt-5">
      <div className="rounded-lg border border-black/10 bg-white p-2 sm:p-3">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Championship points progression" className="h-56 w-full sm:h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const tickY = padding.top + plotHeight - tick * plotHeight;
            return (
              <g key={tick}>
                <line x1={padding.left} y1={tickY} x2={width - padding.right} y2={tickY} stroke="#e5e7eb" />
                <text x={padding.left - 10} y={tickY + 4} textAnchor="end" className="fill-black/45 text-[11px] font-bold">
                  {Math.round(maxPoints * tick)}
                </text>
              </g>
            );
          })}

          {timeline.map((point, index) => {
            if (index !== 0 && index !== timeline.length - 1 && index % 2 === 1) return null;
            return (
              <text key={point.label} x={x(index)} y={height - 12} textAnchor="middle" className="fill-black/45 text-[11px] font-bold">
                {point.label.replace("Round ", "R")}
              </text>
            );
          })}

          {players.map((player, index) => (
            <path key={player.id} d={pathFor(player)} fill="none" stroke={colors[index % colors.length]} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {players.map((player, index) => {
            const last = timeline.at(-1);
            if (!last) return null;
            const points = last.totals.get(player.id) ?? 0;
            return <circle key={`${player.id}-dot`} cx={x(timeline.length - 1)} cy={y(points)} r={4} fill={colors[index % colors.length]} />;
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {players.map((player, index) => (
          <span key={player.id} className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-black">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            <span className="truncate">{player.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="mt-4 rounded-lg border border-dashed border-black/15 p-4 text-sm font-bold text-black/50">{text}</p>;
}
