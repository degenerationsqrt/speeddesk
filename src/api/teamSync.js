import { isSupabaseConfigured } from "./supabaseConfig";
import { syncSecureTeam } from "./teamAccount";

export function createInviteCode() {
  const source = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(source, (value) => value.toString(36)).join("").slice(0, 10).toUpperCase();
}

export function createTeamId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `team_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function buildInviteUrl(inviteCode) {
  if (!inviteCode || typeof window === "undefined") return "";

  if (window.location.protocol === "file:") {
    return `https://your-live-domain.com/?team=${encodeURIComponent(inviteCode)}`;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("team", inviteCode);
  return url.toString();
}

export function buildPlayerLoginUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.delete("team");
  url.searchParams.set("player", "1");
  return url.toString();
}

export function buildTeamSnapshot({
  team,
  athletes,
  programs,
  calendarEvents,
  activeRoutine,
  dailyRoutines,
  assignmentTarget = { type: "all", name: "" },
}) {
  return {
    team: {
      id: team.id,
      name: team.name,
      coachLabel: team.coachLabel,
    },
    sessions: calendarEvents,
    activeRoutine,
    dailyRoutines: Array.isArray(dailyRoutines) ? dailyRoutines : activeRoutine ? [activeRoutine] : [],
    assignmentTarget,
    syncedAt: new Date().toISOString(),
    version: 4,
  };
}

export async function upsertTeamSnapshot(snapshot, athletes = []) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return syncSecureTeam({ snapshot, athletes });
}

export async function fetchTeamSnapshotByInvite(inviteCode) {
  throw new Error(`Sign in to redeem team invite ${String(inviteCode || "").slice(-4)}.`);
}
