"use client";

import {
  Activity,
  Archive,
  BarChart3,
  CalendarPlus,
  Check,
  Download,
  FileImage,
  Gauge,
  History,
  Medal,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sun,
  Table2,
  Target,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  addPlayer,
  archivePlayer,
  clearMatchScore,
  createSession,
  deleteSession,
  finalizeSession,
  importHistoricalSessions,
  recalculateSeason,
  regenerateSessionSchedule,
  reopenSession,
  setMatchScore,
  updateMatchTeams,
  updatePlayer,
  updateSessionBasics,
} from "@/lib/championship";
import { createInitialState } from "@/lib/seed";
import { validateMatchScore, calculateSessionResults } from "@/lib/scoring";
import { loadPersistedState, savePersistedState } from "@/lib/repository";
import { clearStoredState } from "@/lib/storage";
import { standingsToCsv, downloadTextFile } from "@/lib/export";
import {
  getChampionshipLeaderboard,
  getHeadToHeadRecords,
  getPartnerRecords,
  getPlayerAverages,
  getPlayerName,
  getPointsPerSessionData,
  getProgressionData,
} from "@/lib/stats";
import type { AppState, Match, MatchScore, Player, Session } from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/supabase";

type View =
  | "dashboard"
  | "create"
  | "active"
  | "results"
  | "leaderboard"
  | "players"
  | "stats"
  | "settings";

type UndoEntry = {
  sessionId: string;
  matchId: string;
  previous?: MatchScore;
};

const navItems: Array<{ id: View; label: string; icon: typeof Trophy }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "create", label: "Create", icon: CalendarPlus },
  { id: "active", label: "Active", icon: Play },
  { id: "results", label: "Results", icon: Medal },
  { id: "leaderboard", label: "Table", icon: Table2 },
  { id: "players", label: "Players", icon: Users },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const chartColors = ["#16a34a", "#0f766e", "#2563eb", "#dc2626", "#ca8a04", "#7c3aed", "#0891b2", "#db2777"];

export function ChampionshipApp() {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<string>("");
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPersistedState().then((loadedState) => {
        setState(recalculateSeason(loadedState));
        const storedTheme = window.localStorage.getItem("badminton-theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDarkMode(storedTheme ? storedTheme === "dark" : prefersDark);
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
    if (!hasLoaded) return;
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("badminton-theme", darkMode ? "dark" : "light");
  }, [darkMode, hasLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const leaderboard = useMemo(() => getChampionshipLeaderboard(state.players), [state]);
  const activeSession = useMemo(() => {
    return (
      state.sessions.find((session) => session.id === state.activeSessionId) ??
      state.sessions.find((session) => session.status === "active")
    );
  }, [state]);

  function commit(updater: (current: AppState) => AppState) {
    setState((current) => {
      return recalculateSeason(updater(current));
    });
  }

  function showToast(message: string) {
    setToast(message);
  }

  if (!hasLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f7f6ef] text-[#17201b] dark:bg-[#101412] dark:text-[#f5f4ec]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d8d2be] border-t-[#16a34a]" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f7f6ef] text-[#17201b] dark:bg-[#101412] dark:text-[#f5f4ec]">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-64 shrink-0 border-r border-black/10 bg-white/78 p-4 backdrop-blur dark:border-white/10 dark:bg-[#151a17]/88 lg:block">
          <BrandMark />
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f7f6ef]/88 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#101412]/88 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e] dark:text-[#5eead4]">
                  Badminton Championship
                </p>
                <h1 className="truncate text-2xl font-black tracking-normal sm:text-3xl">{pageTitle(view)}</h1>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  title={darkMode ? "Use light mode" : "Use dark mode"}
                  onClick={() => setDarkMode((value) => !value)}
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </IconButton>
                <Button
                  compact
                  onClick={() => {
                    setView("create");
                  }}
                >
                  <Plus size={16} />
                  Session
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:pb-8">
            {view === "dashboard" && (
              <Dashboard
                state={state}
                leaderboard={leaderboard}
                activeSession={activeSession}
                onView={setView}
                onReopen={(sessionId) => {
                  commit((current) => reopenSession(current, sessionId));
                  setView("active");
                }}
              />
            )}
            {view === "create" && (
              <CreateSession
                state={state}
                onCreate={(playerIds, targetScore, courtCount) => {
                  commit((current) => createSession(current, { playerIds, targetScore, courtCount }));
                  setView("active");
                  showToast("Session generated");
                }}
                onAddPlayer={(name, isGuest) => {
                  commit((current) => addPlayer(current, { name, isGuest }));
                  showToast(isGuest ? "Guest added" : "Player added");
                }}
              />
            )}
            {view === "active" && activeSession && (
              <ActiveSession
                state={state}
                session={activeSession}
                undoCount={undoStack.length}
                onSetScore={(match, score) => {
                  const validation = validateMatchScore(score.teamA, score.teamB, activeSession.targetScore, score.overrideTarget);
                  if (!validation.valid) {
                    showToast(validation.message ?? "Invalid score");
                    return;
                  }
                  setUndoStack((stack) => [...stack, { sessionId: activeSession.id, matchId: match.id, previous: match.score }]);
                  commit((current) => setMatchScore(current, activeSession.id, match.id, score));
                  showToast("Score saved");
                }}
                onUndo={() => {
                  const last = undoStack.at(-1);
                  if (!last) return;
                  setUndoStack((stack) => stack.slice(0, -1));
                  commit((current) =>
                    last.previous
                      ? setMatchScore(current, last.sessionId, last.matchId, last.previous)
                      : clearMatchScore(current, last.sessionId, last.matchId),
                  );
                  showToast("Last score undone");
                }}
                onTeamsChange={(matchId, teamA, teamB) => {
                  commit((current) => updateMatchTeams(current, activeSession.id, matchId, { teamA, teamB }));
                }}
                onBasicsChange={(targetScore, courtCount) => {
                  commit((current) => updateSessionBasics(current, activeSession.id, { targetScore, courtCount }));
                  showToast("Session settings saved");
                }}
                onRegenerate={() => {
                  commit((current) => regenerateSessionSchedule(current, activeSession.id));
                  showToast("Schedule regenerated");
                }}
                onFinalize={() => {
                  commit((current) => finalizeSession(current, activeSession.id));
                  setView("results");
                  showToast("Championship points awarded");
                }}
              />
            )}
            {view === "active" && !activeSession && <EmptyState title="No active session" action="Create session" onClick={() => setView("create")} />}
            {view === "results" && (
              <SessionResults
                state={state}
                activeSession={activeSession}
                onFinalize={(sessionId) => {
                  commit((current) => finalizeSession(current, sessionId));
                  showToast("Standings recalculated");
                }}
                onReopen={(sessionId) => {
                  commit((current) => reopenSession(current, sessionId));
                  setView("active");
                }}
                onDelete={(sessionId) => {
                  commit((current) => deleteSession(current, sessionId));
                  showToast("Session deleted");
                }}
              />
            )}
            {view === "leaderboard" && (
              <ChampionshipTable
                leaderboard={leaderboard}
                tableRef={tableRef}
                onCsv={() => {
                  downloadTextFile("badminton-championship-standings.csv", standingsToCsv(leaderboard));
                  showToast("CSV exported");
                }}
                onImage={async () => {
                  if (!tableRef.current) return;
                  const { toPng } = await import("html-to-image");
                  const dataUrl = await toPng(tableRef.current, { pixelRatio: 2, backgroundColor: darkMode ? "#101412" : "#f7f6ef" });
                  const link = document.createElement("a");
                  link.href = dataUrl;
                  link.download = "badminton-championship-standings.png";
                  link.click();
                  showToast("Image exported");
                }}
              />
            )}
            {view === "players" && (
              <PlayersPage
                state={state}
                onAdd={(name, nickname, isGuest) => {
                  commit((current) => addPlayer(current, { name, nickname, isGuest }));
                  showToast("Player saved");
                }}
                onUpdate={(playerId, name, nickname, isGuest) => {
                  commit((current) => updatePlayer(current, playerId, { name, nickname, isGuest }));
                  showToast("Player updated");
                }}
                onArchive={(playerId) => {
                  commit((current) => archivePlayer(current, playerId));
                  showToast("Player archived");
                }}
              />
            )}
            {view === "stats" && <StatsPage state={state} />}
            {view === "settings" && (
              <SettingsPage
                state={state}
                onImport={(payload) => {
                  try {
                    commit((current) => importHistoricalSessions(current, JSON.parse(payload)));
                    showToast("Historical sessions imported");
                  } catch {
                    showToast("Import JSON could not be read");
                  }
                }}
                onReset={() => {
                  clearStoredState();
                  setState(createInitialState());
                  showToast("Local data reset");
                }}
              />
            )}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/94 px-2 py-2 backdrop-blur dark:border-white/10 dark:bg-[#151a17]/94 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navItems.slice(0, 5).map((item) => (
            <MobileNavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-[#17201b] px-4 py-3 text-sm font-bold text-white shadow-xl dark:bg-[#f5f4ec] dark:text-[#101412]">
          {toast}
        </div>
      )}
    </main>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#16a34a] text-white shadow-sm">
        <Trophy size={22} />
      </div>
      <div>
        <p className="text-sm font-black">Badminton</p>
        <p className="text-sm font-black text-[#0f766e] dark:text-[#5eead4]">Championship</p>
      </div>
    </div>
  );
}

function Dashboard({
  state,
  leaderboard,
  activeSession,
  onView,
  onReopen,
}: {
  state: AppState;
  leaderboard: Array<Player & { rank: number }>;
  activeSession?: Session;
  onView: (view: View) => void;
  onReopen: (sessionId: string) => void;
}) {
  const finalizedSessions = state.sessions.filter((session) => session.status === "finalized").length;
  const completed = activeSession?.matches.filter((match) => match.score).length ?? 0;
  const total = activeSession?.matches.length ?? 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Players" value={state.players.filter((player) => !player.archivedAt).length} icon={Users} tone="green" />
        <StatTile label="Sessions" value={finalizedSessions} icon={History} tone="blue" />
        <StatTile label="Active progress" value={total ? `${completed}/${total}` : "0/0"} icon={Target} tone="yellow" />
        <StatTile label="Leader" value={leaderboard[0]?.name ?? "-"} icon={Trophy} tone="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={Play} title="Tonight" />
            <Button compact onClick={() => onView(activeSession ? "active" : "create")}>
              <Plus size={16} />
              {activeSession ? "Open" : "Create"}
            </Button>
          </div>
          {activeSession ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Date" value={activeSession.date} />
                <MiniMetric label="Target" value={activeSession.targetScore} />
                <MiniMetric label="Players" value={activeSession.playerIds.length} />
              </div>
              <ProgressBar value={total ? (completed / total) * 100 : 0} />
              <div className="flex flex-wrap gap-2">
                {activeSession.playerIds.map((playerId) => (
                  <Pill key={playerId}>{getPlayerName(state, playerId)}</Pill>
                ))}
              </div>
            </div>
          ) : (
            <EmptyInline text="No live session." />
          )}
        </Panel>

        <Panel>
          <SectionTitle icon={Trophy} title="Top Table" />
          <div className="mt-4 space-y-3">
            {leaderboard.slice(0, 5).map((player) => (
              <LeaderboardRow key={player.id} player={player} compact />
            ))}
          </div>
        </Panel>
      </section>

      <Panel>
        <div className="flex items-center justify-between">
          <SectionTitle icon={History} title="Recent Sessions" />
          <Button compact variant="ghost" onClick={() => onView("results")}>
            <History size={16} />
            History
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.sessions.slice(0, 6).map((session) => (
            <button
              key={session.id}
              className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#16a34a]/40 dark:border-white/10 dark:bg-[#151a17]"
              onClick={() => onReopen(session.id)}
            >
              <div className="flex items-center justify-between">
                <p className="font-black">{session.date}</p>
                <StatusBadge status={session.status} />
              </div>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                {session.playerIds.length} players, {session.matches.length} matches, target {session.targetScore}
              </p>
            </button>
          ))}
          {!state.sessions.length && <EmptyInline text="No sessions yet." />}
        </div>
      </Panel>
    </div>
  );
}

function CreateSession({
  state,
  onCreate,
  onAddPlayer,
}: {
  state: AppState;
  onCreate: (playerIds: string[], targetScore: number, courtCount: number) => void;
  onAddPlayer: (name: string, isGuest: boolean) => void;
}) {
  const activePlayers = state.players.filter((player) => !player.archivedAt);
  const [selected, setSelected] = useState<string[]>(activePlayers.filter((player) => !player.isGuest).map((player) => player.id));
  const [targetScore, setTargetScore] = useState(15);
  const [courtCount, setCourtCount] = useState(1);
  const [guestName, setGuestName] = useState("");

  function togglePlayer(playerId: string) {
    setSelected((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={CalendarPlus} title="Create Session" />
          <div className="flex gap-2">
            <NumberField label="Target" value={targetScore} min={1} onChange={setTargetScore} />
            <NumberField label="Courts" value={courtCount} min={1} onChange={setCourtCount} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activePlayers.map((player) => (
            <button
              key={player.id}
              className={`rounded-lg border p-4 text-left transition ${
                selected.includes(player.id)
                  ? "border-[#16a34a] bg-[#e7f7e9] shadow-sm dark:bg-[#12351f]"
                  : "border-black/10 bg-white hover:border-[#16a34a]/50 dark:border-white/10 dark:bg-[#151a17]"
              }`}
              onClick={() => togglePlayer(player.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">{player.name}</p>
                  <p className="text-sm text-black/55 dark:text-white/55">
                    {player.isGuest ? "Guest" : `${player.totalChampionshipPoints} pts`}
                  </p>
                </div>
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg ${
                    selected.includes(player.id) ? "bg-[#16a34a] text-white" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {selected.includes(player.id) && <Check size={16} />}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={UserPlus} title="Quick Guest" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <TextField label="Guest name" value={guestName} onChange={setGuestName} />
          <Button
            onClick={() => {
              const name = guestName.trim();
              if (!name) return;
              onAddPlayer(name, true);
              setGuestName("");
            }}
          >
            <Plus size={16} />
            Add guest
          </Button>
        </div>
      </Panel>

      <div className="sticky bottom-[72px] z-10 rounded-lg border border-black/10 bg-white/94 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#151a17]/94 lg:bottom-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-black/65 dark:text-white/65">{selected.length} attending</p>
          <Button disabled={selected.length < 4} onClick={() => onCreate(selected, targetScore, courtCount)}>
            <Play size={16} />
            Generate schedule
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActiveSession({
  state,
  session,
  undoCount,
  onSetScore,
  onUndo,
  onTeamsChange,
  onBasicsChange,
  onRegenerate,
  onFinalize,
}: {
  state: AppState;
  session: Session;
  undoCount: number;
  onSetScore: (match: Match, score: Omit<MatchScore, "enteredAt">) => void;
  onUndo: () => void;
  onTeamsChange: (matchId: string, teamA: string[], teamB: string[]) => void;
  onBasicsChange: (targetScore: number, courtCount: number) => void;
  onRegenerate: () => void;
  onFinalize: () => void;
}) {
  const results = calculateSessionResults(session);
  const completedMatches = session.matches.filter((match) => match.score).length;

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <SectionTitle icon={Play} title={`Session ${session.date}`} />
            <p className="mt-2 text-sm font-medium text-black/60 dark:text-white/60">
              {completedMatches}/{session.matches.length} matches complete
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NumberField label="Target" value={session.targetScore} min={1} onChange={(value) => onBasicsChange(value, session.courtCount)} />
            <NumberField label="Courts" value={session.courtCount} min={1} onChange={(value) => onBasicsChange(session.targetScore, value)} />
            <IconButton title="Regenerate schedule" onClick={onRegenerate}>
              <RefreshCw size={18} />
            </IconButton>
            <IconButton title="Undo last score" disabled={!undoCount} onClick={onUndo}>
              <Undo2 size={18} />
            </IconButton>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={session.matches.length ? (completedMatches / session.matches.length) * 100 : 0} />
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {session.matches.map((match) => (
            <MatchCard
              key={`${match.id}-${match.score?.enteredAt ?? "empty"}-${session.targetScore}`}
              state={state}
              session={session}
              match={match}
              onSetScore={onSetScore}
              onTeamsChange={onTeamsChange}
            />
          ))}
          {!session.matches.length && <EmptyState title="Need at least four players" action="Create session" />}
        </div>
        <div className="space-y-5">
          <Panel>
            <SectionTitle icon={Medal} title="Live Results" />
            <div className="mt-4 space-y-3">
              {results.map((result) => (
                <ResultRow key={result.playerId} state={state} result={result} />
              ))}
            </div>
            <Button className="mt-5 w-full" disabled={!session.matches.length} onClick={onFinalize}>
              <Trophy size={16} />
              Award points
            </Button>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function MatchCard({
  state,
  session,
  match,
  onSetScore,
  onTeamsChange,
}: {
  state: AppState;
  session: Session;
  match: Match;
  onSetScore: (match: Match, score: Omit<MatchScore, "enteredAt">) => void;
  onTeamsChange: (matchId: string, teamA: string[], teamB: string[]) => void;
}) {
  const [scoreA, setScoreA] = useState(match.score?.teamA ?? Math.ceil(session.targetScore / 2));
  const [scoreB, setScoreB] = useState(match.score?.teamB ?? Math.floor(session.targetScore / 2));
  const [overrideTarget, setOverrideTarget] = useState(match.score?.overrideTarget ?? false);
  const [note, setNote] = useState(match.score?.adminNote ?? "");

  const selectedPlayerIds = [...match.teamA, ...match.teamB];
  const duplicate = selectedPlayerIds.some((playerId, index) => selectedPlayerIds.indexOf(playerId) !== index);

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151a17]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">
            Match {match.matchNumber} / Court {match.courtNumber}
          </p>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">{match.score ? "Complete" : "Scheduled"}</p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <TeamEditor
          label="Team A"
          value={match.teamA}
          playerIds={session.playerIds}
          state={state}
          onChange={(teamA) => onTeamsChange(match.id, teamA, match.teamB)}
        />
        <div className="grid place-items-center text-xs font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/40">vs</div>
        <TeamEditor
          label="Team B"
          value={match.teamB}
          playerIds={session.playerIds}
          state={state}
          onChange={(teamB) => onTeamsChange(match.id, match.teamA, teamB)}
        />
      </div>

      {duplicate && <p className="mt-3 text-sm font-bold text-[#dc2626]">A player is selected more than once.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <NumberField label="Team A score" value={scoreA} min={0} onChange={setScoreA} />
        <NumberField label="Team B score" value={scoreB} min={0} onChange={setScoreB} />
        <Button onClick={() => onSetScore(match, { teamA: scoreA, teamB: scoreB, overrideTarget, adminNote: note })}>
          <Save size={16} />
          Save
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={overrideTarget}
            onChange={(event) => setOverrideTarget(event.target.checked)}
            className="h-4 w-4 accent-[#16a34a]"
          />
          Admin override
        </label>
        {overrideTarget && <TextField label="Note" value={note} onChange={setNote} />}
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
    <div className="rounded-lg border border-black/10 bg-[#f8f7f1] p-3 dark:border-white/10 dark:bg-[#101412]">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45">{label}</p>
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
            className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#16a34a] dark:border-white/10 dark:bg-[#151a17]"
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

function SessionResults({
  state,
  activeSession,
  onFinalize,
  onReopen,
  onDelete,
}: {
  state: AppState;
  activeSession?: Session;
  onFinalize: (sessionId: string) => void;
  onReopen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}) {
  const displaySession = activeSession ?? state.sessions[0];
  const displayResults = displaySession
    ? displaySession.status === "finalized" && displaySession.results
      ? displaySession.results
      : calculateSessionResults(displaySession)
    : [];

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Medal} title="Session Results" />
          {displaySession && (
            <div className="flex gap-2">
              <Button compact variant="ghost" onClick={() => onReopen(displaySession.id)}>
                <Play size={16} />
                Open
              </Button>
              <Button compact onClick={() => onFinalize(displaySession.id)}>
                <RefreshCw size={16} />
                Recalculate
              </Button>
            </div>
          )}
        </div>
        {displaySession ? (
          <div className="mt-4 space-y-3">
            {displayResults.map((result) => (
              <ResultRow key={result.playerId} state={state} result={result} />
            ))}
          </div>
        ) : (
          <EmptyInline text="No session results yet." />
        )}
      </Panel>

      <Panel>
        <SectionTitle icon={History} title="Session History" />
        <div className="mt-4 space-y-3">
          {state.sessions.map((session) => (
            <div
              key={session.id}
              className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#151a17] md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{session.date}</p>
                  <StatusBadge status={session.status} />
                </div>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {session.playerIds.length} players, target {session.targetScore}, {session.matches.length} matches
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <IconButton title="Open session" onClick={() => onReopen(session.id)}>
                  <Play size={17} />
                </IconButton>
                <IconButton title="Recalculate standings" onClick={() => onFinalize(session.id)}>
                  <RefreshCw size={17} />
                </IconButton>
                <IconButton title="Delete session" danger onClick={() => onDelete(session.id)}>
                  <Trash2 size={17} />
                </IconButton>
              </div>
            </div>
          ))}
          {!state.sessions.length && <EmptyInline text="No stored sessions." />}
        </div>
      </Panel>
    </div>
  );
}

function ChampionshipTable({
  leaderboard,
  tableRef,
  onCsv,
  onImage,
}: {
  leaderboard: Array<Player & { rank: number }>;
  tableRef: React.RefObject<HTMLDivElement | null>;
  onCsv: () => void;
  onImage: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={Table2} title="Championship Table" />
        <div className="flex gap-2">
          <Button compact variant="ghost" onClick={onCsv}>
            <Download size={16} />
            CSV
          </Button>
          <Button compact onClick={onImage}>
            <FileImage size={16} />
            Image
          </Button>
        </div>
      </div>

      <div ref={tableRef} className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#151a17]">
        <div className="space-y-3">
          {leaderboard.map((player) => (
            <LeaderboardRow key={player.id} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayersPage({
  state,
  onAdd,
  onUpdate,
  onArchive,
}: {
  state: AppState;
  onAdd: (name: string, nickname: string, isGuest: boolean) => void;
  onUpdate: (playerId: string, name: string, nickname: string, isGuest: boolean) => void;
  onArchive: (playerId: string) => void;
}) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [isGuest, setIsGuest] = useState(false);

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle icon={UserPlus} title="Add Player" />
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Nickname" value={nickname} onChange={setNickname} />
          <label className="flex h-11 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold dark:border-white/10 dark:bg-[#151a17]">
            <input type="checkbox" checked={isGuest} onChange={(event) => setIsGuest(event.target.checked)} className="h-4 w-4 accent-[#16a34a]" />
            Guest
          </label>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onAdd(name, nickname, isGuest);
              setName("");
              setNickname("");
              setIsGuest(false);
            }}
          >
            <Plus size={16} />
            Add
          </Button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {state.players.map((player) => (
          <PlayerProfileCard key={player.id} state={state} player={player} onUpdate={onUpdate} onArchive={onArchive} />
        ))}
      </div>
    </div>
  );
}

function PlayerProfileCard({
  state,
  player,
  onUpdate,
  onArchive,
}: {
  state: AppState;
  player: Player;
  onUpdate: (playerId: string, name: string, nickname: string, isGuest: boolean) => void;
  onArchive: (playerId: string) => void;
}) {
  const [name, setName] = useState(player.name);
  const [nickname, setNickname] = useState(player.nickname ?? "");
  const [isGuest, setIsGuest] = useState(player.isGuest);
  const playerHistory = state.sessions
    .filter((session) => session.results?.some((result) => result.playerId === player.id))
    .map((session) => ({
      session,
      result: session.results!.find((result) => result.playerId === player.id)!,
    }));

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${player.archivedAt ? "border-[#ca8a04]/50 bg-[#fff8db] dark:bg-[#31280b]" : "border-black/10 bg-white dark:border-white/10 dark:bg-[#151a17]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black">{player.name}</p>
          <p className="text-sm text-black/60 dark:text-white/60">
            {player.totalChampionshipPoints} pts, {player.sessionsPlayed} sessions
          </p>
        </div>
        {player.isGuest && <Pill>Guest</Pill>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label="Nickname" value={nickname} onChange={setNickname} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold dark:border-white/10 dark:bg-[#101412]">
          <input type="checkbox" checked={isGuest} onChange={(event) => setIsGuest(event.target.checked)} className="h-4 w-4 accent-[#16a34a]" />
          Guest
        </label>
        <IconButton title="Save player" onClick={() => onUpdate(player.id, name, nickname, isGuest)}>
          <Save size={17} />
        </IconButton>
        {!player.archivedAt && (
          <IconButton title="Archive player" onClick={() => onArchive(player.id)}>
            <Archive size={17} />
          </IconButton>
        )}
      </div>
      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45">History</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {playerHistory.slice(0, 8).map(({ session, result }) => (
            <Pill key={session.id}>
              {session.date}: +{result.championshipPointsAwarded}
            </Pill>
          ))}
          {!playerHistory.length && <span className="text-sm text-black/50 dark:text-white/50">No appearances.</span>}
        </div>
      </div>
    </article>
  );
}

function StatsPage({ state }: { state: AppState }) {
  const progression = getProgressionData(state);
  const pointsPerSession = getPointsPerSessionData(state);
  const averages = getPlayerAverages(state).filter((row) => row.sessions > 0 || row.player.totalChampionshipPoints > 0);
  const partners = getPartnerRecords(state).slice(0, 8);
  const headToHead = getHeadToHeadRecords(state).slice(0, 8);
  const leaderboard = getChampionshipLeaderboard(state.players).slice(0, 8);

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle icon={Activity} title="Progression" />
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progression}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {leaderboard.map((player, index) => (
                <Line key={player.id} type="monotone" dataKey={player.name} stroke={chartColors[index % chartColors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <SectionTitle icon={BarChart3} title="Points Per Session" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pointsPerSession}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" />
                <XAxis dataKey="player" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="points" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Users} title="Player Metrics" />
          <div className="mt-4 space-y-3">
            {averages.map((row) => (
              <div key={row.player.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#151a17]">
                <div>
                  <p className="font-black">{row.player.name}</p>
                  <p className="text-sm text-black/55 dark:text-white/55">
                    Avg finish {row.averageFinish ? row.averageFinish.toFixed(1) : "-"} / Win {row.winPercentage}%
                  </p>
                </div>
                <Pill>{row.sessions} sessions</Pill>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <SectionTitle icon={Users} title="Common Partners" />
          <div className="mt-4 space-y-3">
            {partners.map((record) => (
              <MiniMetric
                key={`${record.playerId}-${record.partnerId}`}
                label={`${getPlayerName(state, record.playerId)} + ${getPlayerName(state, record.partnerId)}`}
                value={`${record.matches} matches`}
              />
            ))}
            {!partners.length && <EmptyInline text="Partner records appear after scored matches." />}
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Target} title="Head To Head" />
          <div className="mt-4 space-y-3">
            {headToHead.map((record) => (
              <MiniMetric
                key={`${record.playerId}-${record.opponentId}`}
                label={`${getPlayerName(state, record.playerId)} vs ${getPlayerName(state, record.opponentId)}`}
                value={`${record.wins}-${record.draws}-${record.losses}`}
              />
            ))}
            {!headToHead.length && <EmptyInline text="Head-to-head records appear after scored matches." />}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function SettingsPage({
  state,
  onImport,
  onReset,
}: {
  state: AppState;
  onImport: (payload: string) => void;
  onReset: () => void;
}) {
  const [payload, setPayload] = useState(`{
  "date": "2026-06-01",
  "players": ["Siva", "Nishan", "Sam", "Thush", "Abi"],
  "targetScore": 15,
  "results": [
    {
      "player": "Siva",
      "sessionPoints": 56,
      "position": 1,
      "championshipPointsAwarded": 5
    }
  ]
}`);

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle icon={Settings} title="Settings" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Storage" value="Local autosave" />
          <MiniMetric label="Supabase" value={hasSupabaseConfig ? "Configured" : "Not connected"} />
          <MiniMetric label="Sessions stored" value={state.sessions.length} />
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={Upload} title="Historical Import" />
        <textarea
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          className="mt-4 min-h-64 w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-sm outline-none focus:border-[#16a34a] dark:border-white/10 dark:bg-[#151a17]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => onImport(payload)}>
            <Upload size={16} />
            Import
          </Button>
          <Button variant="danger" onClick={onReset}>
            <Trash2 size={16} />
            Reset local data
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function ResultRow({ state, result }: { state: AppState; result: ReturnType<typeof calculateSessionResults>[number] }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#151a17]">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f7e9] font-black text-[#166534] dark:bg-[#12351f] dark:text-[#86efac]">
        {result.position}
      </div>
      <div>
        <p className="font-black">{getPlayerName(state, result.playerId)}</p>
        <p className="text-sm text-black/55 dark:text-white/55">
          {result.sessionPoints} match pts, {result.wins}-{result.draws}-{result.losses}
        </p>
      </div>
      <Pill>+{result.championshipPointsAwarded}</Pill>
    </div>
  );
}

function LeaderboardRow({ player, compact = false }: { player: Player & { rank: number }; compact?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-[#fbfaf5] p-3 dark:border-white/10 dark:bg-[#101412]">
      <div className={`grid place-items-center rounded-lg bg-[#17201b] font-black text-white dark:bg-[#f5f4ec] dark:text-[#101412] ${compact ? "h-9 w-9" : "h-11 w-11"}`}>
        {player.rank}
      </div>
      <div className="min-w-0">
        <p className="truncate font-black">{player.name}</p>
        <p className="text-sm text-black/55 dark:text-white/55">{player.sessionsPlayed} sessions</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-black text-[#0f766e] dark:text-[#5eead4]">{player.totalChampionshipPoints}</p>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">pts</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Trophy; tone: "green" | "blue" | "yellow" | "red" }) {
  const tones = {
    green: "bg-[#e7f7e9] text-[#166534] dark:bg-[#12351f] dark:text-[#86efac]",
    blue: "bg-[#e8f0ff] text-[#1d4ed8] dark:bg-[#14294d] dark:text-[#93c5fd]",
    yellow: "bg-[#fff4d6] text-[#a16207] dark:bg-[#31280b] dark:text-[#fde68a]",
    red: "bg-[#ffe9e5] text-[#b91c1c] dark:bg-[#3b1712] dark:text-[#fca5a5]",
  };

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151a17]">
      <div className="flex items-center justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-4 text-sm font-bold text-black/55 dark:text-white/55">{label}</p>
      <p className="mt-1 truncate text-2xl font-black">{value}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Trophy; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#17201b] text-white dark:bg-[#f5f4ec] dark:text-[#101412]">
        <Icon size={18} />
      </span>
      <h2 className="text-lg font-black tracking-normal">{title}</h2>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-lg border border-black/10 bg-white/78 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#151a17]/88 sm:p-5">{children}</section>;
}

function Button({
  children,
  onClick,
  disabled,
  compact,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const variants = {
    primary: "bg-[#17201b] text-white hover:bg-[#0f766e] dark:bg-[#f5f4ec] dark:text-[#101412] dark:hover:bg-[#5eead4]",
    ghost: "border border-black/10 bg-white text-[#17201b] hover:border-[#16a34a] dark:border-white/10 dark:bg-[#101412] dark:text-[#f5f4ec]",
    danger: "bg-[#dc2626] text-white hover:bg-[#991b1b]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${compact ? "h-10 px-3" : ""} ${variants[variant]} ${className}`}
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
  disabled?: boolean | number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={Boolean(disabled)}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? "border-[#dc2626]/30 bg-[#fff1ef] text-[#dc2626] hover:bg-[#dc2626] hover:text-white dark:bg-[#351512]"
          : "border-black/10 bg-white text-[#17201b] hover:border-[#16a34a] hover:text-[#0f766e] dark:border-white/10 dark:bg-[#151a17] dark:text-[#f5f4ec]"
      }`}
    >
      {children}
    </button>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof navItems)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-black transition ${
        active
          ? "bg-[#17201b] text-white dark:bg-[#f5f4ec] dark:text-[#101412]"
          : "text-black/65 hover:bg-black/5 dark:text-white/65 dark:hover:bg-white/10"
      }`}
    >
      <Icon size={18} />
      {item.label}
    </button>
  );
}

function MobileNavButton({ item, active, onClick }: { item: (typeof navItems)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 flex-col items-center justify-center rounded-lg text-[11px] font-black transition ${
        active ? "bg-[#17201b] text-white dark:bg-[#f5f4ec] dark:text-[#101412]" : "text-black/62 dark:text-white/62"
      }`}
    >
      <Icon size={17} />
      {item.label}
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fbfaf5] p-3 dark:border-white/10 dark:bg-[#101412]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-28">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-black/45 dark:text-white/45">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm font-black outline-none focus:border-[#16a34a] dark:border-white/10 dark:bg-[#151a17]"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-black/45 dark:text-white/45">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#16a34a] dark:border-white/10 dark:bg-[#151a17]"
      />
    </label>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-8 items-center rounded-lg bg-[#e7f7e9] px-3 text-xs font-black text-[#166534] dark:bg-[#12351f] dark:text-[#86efac]">{children}</span>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-lg bg-black/8 dark:bg-white/10">
      <div className="h-full rounded-lg bg-[#16a34a] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-black/55 dark:bg-white/10 dark:text-white/65">{label}</span>;
}

function EmptyInline({ text }: { text: string }) {
  return <p className="mt-4 rounded-lg border border-dashed border-black/15 p-4 text-sm font-bold text-black/50 dark:border-white/15 dark:text-white/50">{text}</p>;
}

function EmptyState({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-[#151a17]/60">
      <p className="text-xl font-black">{title}</p>
      {action && (
        <Button className="mt-4" onClick={onClick}>
          <Plus size={16} />
          {action}
        </Button>
      )}
    </div>
  );
}

function pageTitle(view: View) {
  const titles: Record<View, string> = {
    dashboard: "Dashboard",
    create: "Create Session",
    active: "Active Session",
    results: "Session Results",
    leaderboard: "Championship Table",
    players: "Player Profiles",
    stats: "Statistics",
    settings: "Settings",
  };

  return titles[view];
}
