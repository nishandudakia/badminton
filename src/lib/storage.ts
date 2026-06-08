import { createInitialState, ensureReferenceHistory } from "./seed";
import type { AppState } from "./types";

const storageKey = "badminton-championship-state-v1";

export function loadStoredState(): AppState {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    const seeded = createInitialState();
    saveStoredState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    if (hasLegacyIds(parsed)) {
      const seeded = createInitialState();
      saveStoredState(seeded);
      return seeded;
    }

    const migrated = ensureReferenceHistory(parsed);
    if (migrated !== parsed) {
      saveStoredState(migrated);
    }

    return migrated;
  } catch {
    const seeded = createInitialState();
    saveStoredState(seeded);
    return seeded;
  }
}

function hasLegacyIds(state: AppState) {
  return state.players.some((player) => !isUuid(player.id)) || state.sessions.some((session) => !isUuid(session.id));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function saveStoredState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function clearStoredState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
