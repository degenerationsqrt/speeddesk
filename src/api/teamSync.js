import { isSupabaseConfigured } from "./supabaseConfig";

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

export function buildTeamSnapshot({ team, athletes, programs, calendarEvents, activeRoutine }) {
  return {
    team: {
      id: team.id,
      name: team.name,
      coachLabel: team.coachLabel,
      inviteCode: team.inviteCode,
    },
    athletes,
    programs,
    sessions: calendarEvents,
    activeRoutine,
    syncedAt: new Date().toISOString(),
    version: 2,
  };
}

export async function upsertTeamSnapshot(snapshot) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { supabase } = await import("./supabaseClient");
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("team_snapshots")
    .upsert({
      team_id: snapshot.team.id,
      team_name: snapshot.team.name,
      invite_code: snapshot.team.inviteCode,
      payload: snapshot,
      updated_at: snapshot.syncedAt,
    }, { onConflict: "team_id" });

  if (error) throw error;
  return snapshot;
}

export async function fetchTeamSnapshotByInvite(inviteCode) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { supabase } = await import("./supabaseClient");
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("team_snapshots")
    .select("payload")
    .eq("invite_code", inviteCode)
    .single();

  if (error) throw error;
  return data?.payload;
}
