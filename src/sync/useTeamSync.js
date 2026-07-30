import { useCallback, useEffect, useState } from "react";
import { buildTeamSnapshot, createTeamId, upsertTeamSnapshot } from "../api/teamSync";
import { getSupabaseSetupState } from "../api/supabaseConfig";

const TEAM_SYNC_STORAGE_KEY = "apex-predator-elite:team-sync";

function defaultTeam() {
  return {
    id: createTeamId(),
    name: "Apex Predator Elite",
    coachLabel: "Coach",
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

  const updateTeam = (patch) => {
    setTeam((current) => ({ ...current, ...patch }));
  };

  const adoptCloudTeam = useCallback((cloudTeam) => {
    if (!cloudTeam?.id) return;
    setTeam((current) => ({
      ...current,
      id: cloudTeam.id,
      name: cloudTeam.name || current.name,
      coachLabel: cloudTeam.coach_label || cloudTeam.coachLabel || current.coachLabel,
      lastSyncedAt: cloudTeam.lastSyncedAt || current.lastSyncedAt,
    }));
  }, []);

  const syncNow = async (assignmentTarget = { type: "all", name: "" }) => {
    if (!setup.isConfigured) {
      setStatus("setup");
      setMessage(`Add ${setup.missing.join(" and ")} before cloud sync can run.`);
      onFlash?.("Supabase setup needed");
      return null;
    }

    setStatus("syncing");
    const targetLabel = assignmentTarget.type === "group" && assignmentTarget.name
      ? assignmentTarget.name
      : "all players";
    setMessage(`Pushing the workout plan to ${targetLabel}...`);

    try {
      const snapshot = buildTeamSnapshot({
        team,
        athletes,
        programs,
        calendarEvents,
        activeRoutine,
        dailyRoutines,
        assignmentTarget,
      });
      const synced = await upsertTeamSnapshot(snapshot, athletes);
      setTeam((current) => ({
        ...current,
        id: synced.team.id,
        name: synced.team.name || current.name,
        coachLabel: synced.team.coachLabel || current.coachLabel,
        lastSyncedAt: synced.syncedAt,
      }));
      setStatus("synced");
      setMessage(`Workout plan pushed to ${targetLabel}. Player apps will update within 20 seconds.`);
      onFlash?.("Workout plan pushed");
      return synced;
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Workout plan could not be pushed.");
      onFlash?.("Workout push failed");
      return null;
    }
  };

  return {
    adoptCloudTeam,
    message,
    setup,
    status,
    syncNow,
    team,
    updateTeam,
  };
}
