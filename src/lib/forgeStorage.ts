// SKILLFORGE AI — local persistence for simulation sessions & results.
// Mirrors the app's existing localStorage patterns (no accounts, no backend).

import type { ForgeResults, ForgeSession } from '../forge/types';

const SESSIONS_KEY = 'skillforge.sessions.v1';
const RESULTS_KEY = 'skillforge.results.v1';

export function loadForgeSessions(): ForgeSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ForgeSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveForgeSession(session: ForgeSession): void {
  try {
    const sessions = loadForgeSessions().filter((s) => s.id !== session.id);
    sessions.push(session);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(-10)));
  } catch {
    /* storage unavailable — the simulation still works in memory */
  }
}

export function loadForgeResults(): ForgeResults[] {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ForgeResults[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveForgeResults(results: ForgeResults): void {
  try {
    const all = loadForgeResults().filter((r) => r.completedAt !== results.completedAt);
    all.push(results);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all.slice(-10)));
  } catch {
    /* in-memory only */
  }
}

export function clearForgeData(): void {
  try {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(RESULTS_KEY);
  } catch {
    /* ignore */
  }
}
