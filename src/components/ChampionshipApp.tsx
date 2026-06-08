"use client";

import {
  Check,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
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
  recalculateSeason,
  regenerateSessionSchedule,
  setMatchScore,
  updateMatchTeams,
  updateSessionBasics,
} from "@/lib/championship";
import { createInitialState } from "@/lib/seed";
import { calculateSessionResults } from "@/lib/scoring";
import { loadPersistedState, savePersistedState } from "@/lib/repository";
import type { AppState, Match, MatchScore, Session } from "@/lib/types";

type Mode = "create" | "tournament";

export function ChampionshipApp() {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPersistedState().then((loadedState) => {
        const nextState = recalculateSeason(loadedState);
        setState(nextState);
        setMode(findCurrentTournament(nextState) ? "tournament" : "create");
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
            {currentTournament && (
              <Button variant={mode === "tournament" ? "primary" : "ghost"} onClick={() => setMode("tournament")}>
                <Play size={16} />
                Current tournament
              </Button>
            )}
          </div>
        </header>

        <div className="py-5">
          {mode === "create" || !currentTournament ? (
            <CreateTournament
              state={state}
              onCreate={(playerIds, targetScore, courtCount) => {
                commit((current) =>
                  createSession(current, {
                    playerIds,
                    targetScore,
                    courtCount,
                    includeFinals: false,
                    finalsCountTowardsLeaderboard: false,
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
                showToast("Score saved");
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
            />
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-[#17201b] px-4 py-3 text-sm font-black text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function CreateTournament({
  state,
  onCreate,
  onAddPlayer,
}: {
  state: AppState;
  onCreate: (playerIds: string[], targetScore: number, courtCount: number) => void;
  onAddPlayer: (name: string) => void;
}) {
  const activePlayers = state.players.filter((player) => !player.archivedAt);
  const [selected, setSelected] = useState<string[]>(activePlayers.filter((player) => !player.isGuest).map((player) => player.id));
  const [targetScore, setTargetScore] = useState(15);
  const [courtCount, setCourtCount] = useState(1);
  const [newPlayer, setNewPlayer] = useState("");

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

        {!activePlayers.length && <EmptyInline text="Add at least four players to generate a tournament." />}
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
          <Button className="mt-3 w-full" disabled={selected.length < 4} onClick={() => onCreate(selected, targetScore, courtCount)}>
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
}: {
  state: AppState;
  session: Session;
  onSetScore: (match: Match, score: Omit<MatchScore, "enteredAt">) => void;
  onClearScore: (matchId: string) => void;
  onTeamsChange: (matchId: string, teamA: string[], teamB: string[]) => void;
  onBasicsChange: (targetScore: number, courtCount: number) => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const completedMatches = session.matches.filter((match) => match.score).length;
  const leaderboard = calculateSessionResults(session);
  const groupedMatches = groupMatchesByRound(session.matches);

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
                key={`${match.id}-${match.score?.enteredAt ?? "empty"}-${session.targetScore}`}
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
  const [scoreA, setScoreA] = useState(match.score?.teamA ?? 0);
  const [scoreB, setScoreB] = useState(match.score?.teamB ?? 0);
  const selectedPlayerIds = [...match.teamA, ...match.teamB];
  const duplicate = selectedPlayerIds.some((playerId, index) => selectedPlayerIds.indexOf(playerId) !== index);
  const completed = Boolean(match.score);

  return (
    <article className={`rounded-lg border p-4 ${completed ? "border-[#16a34a]/50 bg-[#f4fbf5]" : "border-black/10 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">
            Match {match.matchNumber} / Court {match.courtNumber}
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
          onChange={(teamA) => onTeamsChange(match.id, teamA, match.teamB)}
        />
        <div className="text-center text-xs font-black uppercase tracking-[0.14em] text-black/35">vs</div>
        <TeamEditor
          label="Team B"
          value={match.teamB}
          playerIds={session.playerIds}
          state={state}
          onChange={(teamB) => onTeamsChange(match.id, match.teamA, teamB)}
        />
      </div>

      {duplicate && <p className="mt-3 text-sm font-bold text-[#dc2626]">A player is selected more than once.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <NumberField label="Team A score" value={scoreA} min={0} onChange={setScoreA} />
        <NumberField label="Team B score" value={scoreB} min={0} onChange={setScoreB} />
        <Button onClick={() => onSetScore(match, { teamA: scoreA, teamB: scoreB, overrideTarget: scoreA + scoreB !== session.targetScore })}>
          <Save size={16} />
          Save
        </Button>
        <IconButton title="Clear score" disabled={!completed} onClick={() => onClearScore(match.id)}>
          <RotateCcw size={18} />
        </IconButton>
      </div>
    </article>
  );
}

function TeamEditor({
  label,
  value,
  playerIds,
  state,
  onChange,
}: {
  label: string;
  value: string[];
  playerIds: string[];
  state: AppState;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafafa] p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-black/45">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1].map((index) => (
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
        <p className="text-xs font-black uppercase tracking-[0.1em] text-black/40">pts</p>
      </div>
    </div>
  );
}

function findCurrentTournament(state: AppState) {
  const sessionsWithMatches = state.sessions.filter((session) => session.matches.length > 0);
  return (
    sessionsWithMatches.find((session) => session.id === state.activeSessionId) ??
    sessionsWithMatches.find((session) => session.status === "active") ??
    sessionsWithMatches[0]
  );
}

function groupMatchesByRound(matches: Match[]) {
  const groups = new Map<string, { key: string; label: string; matches: Match[]; sort: number }>();
  matches.forEach((match, index) => {
    const roundNumber = match.roundNumber ?? Math.floor(index / 2) + 1;
    const key = `round-${roundNumber}`;
    const existing = groups.get(key) ?? { key, label: `Round ${roundNumber}`, matches: [], sort: roundNumber };
    existing.matches.push(match);
    groups.set(key, existing);
  });
  return Array.from(groups.values()).sort((a, b) => a.sort - b.sort);
}

function getPlayerName(state: AppState, playerId: string) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Unknown";
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

function EmptyInline({ text }: { text: string }) {
  return <p className="mt-4 rounded-lg border border-dashed border-black/15 p-4 text-sm font-bold text-black/50">{text}</p>;
}
