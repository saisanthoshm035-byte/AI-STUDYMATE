import type { LearningSession } from '../types';

const KEY = 'studymate.sessions.v1';
const XP_KEY = 'studymate.xp.v1';
const MAX_SESSIONS = 20;

export function loadSessions(): LearningSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LearningSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: LearningSession): void {
  try {
    const sessions = loadSessions();
    sessions.unshift(session);
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    /* storage unavailable — app still works */
  }
}

export function loadXp(): number {
  try {
    return Number(localStorage.getItem(XP_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function addXp(amount: number): void {
  try {
    localStorage.setItem(XP_KEY, String(loadXp() + amount));
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(XP_KEY);
  } catch {
    /* ignore */
  }
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
