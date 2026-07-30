import { useEffect, useMemo, useState } from "react";
import { buildInviteUrl, buildTeamSnapshot, createInviteCode, createTeamId, upsertTeamSnapshot } from "../api/teamSync";
import { getSupabaseSetupState } from "../api/supabaseConfig";

const TEAM_SYNC_STORAGE_KEY = "apex-predator-elite:team-sync";

function defaultTeam() {
  return {
    id: createTeamId(),
    name: "Apex Predator Elite",
    coachLabel: "Coach",
    inviteCode: createInviteCode(),
    lastSyncedAt: "",
  };
}

export function useTeamSync({ athletes, programs, calendarEvents, activeRoutine, dailyRoutines, onFlash }) {
  const [team, setTeam] = useState(defaultTeam);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const setup = getSupabaseSetupState();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEAM_SYNC_STORAGE_KEY);
      if (saved) setTeam((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch (error) {
      setMessage("Team Sync settings could not be loaded.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(TEAM_SYNC_STORAGE_KEY, JSON.stringify(team));
  }, [loaded, team]);

  const inviteUrl = useMemo(() => buildInviteUrl(team.inviteCode), [team.inviteCode]);

  const snapshot = useMemo(
    () => buildTeamSnapshot({ team, athletes, programs, calendarEvents, activeRoutine, dailyRoutines }),
    [team, athletes, programs, calendarEvents, activeRoutine, dailyRoutines]
  );

  const updateTeam = (patch) => {
    setTeam((current) => ({ ...current, ...patch }));
  };

  const regenerateInvite = () => {
    setTeam((current) => ({ ...current, inviteCode: createInviteCode() }));
    setMessage("New invite code created.");
  };

  const syncNow = async () => {
    if (!setup.isConfigured) {
      setStatus("setup");
      setMessage(`Add ${setup.missing.join(" and ")} before cloud sync can run.`);
      onFlash?.("Supabase setup needed");
      return false;
    }

    setStatus("syncing");
    setMessage("Syncing roster, schedule, and daily workouts...");

    try {
      const synced = await upsertTeamSnapshot(snapshot, athletes);
      setTeam((current) => ({ ...current, lastSyncedAt: synced.syncedAt }));
      setStatus("synced");
      setMessage("Daily workout plan synced. Player apps will update on refresh or polling.");
      onFlash?.("Team synced");
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Team sync failed.");
      onFlash?.("Team sync failed");
      return false;
    }
  };

  return {
    inviteUrl,
    message,
    regenerateInvite,
    setup,
    snapshot,
    status,
    syncNow,
    team,
    updateTeam,
  };
}
