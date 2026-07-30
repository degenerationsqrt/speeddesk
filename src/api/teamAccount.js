import { isSupabaseConfigured } from "./supabaseConfig";
import { mergeWorkoutAssignment } from "../sync/workoutAssignments";

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Team Sync is not configured yet.");
  }
  return import("./supabaseClient").then(({ supabase }) => {
    if (!supabase) throw new Error("Team Sync is not configured yet.");
    return supabase;
  });
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeName(value, fallback = "Player") {
  return String(value || "").trim() || fallback;
}

function isoNow() {
  return new Date().toISOString();
}

async function currentUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in before using Team Sync.");
  return data.user;
}

async function findCoachTeam(client, user, preferredTeamId = "") {
  const { data: ownedTeams, error: ownedError } = await client
    .from("teams")
    .select("id,name,coach_label,owner_user_id,created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(25);
  if (ownedError) throw ownedError;
  if (ownedTeams?.length) {
    return ownedTeams.find((team) => team.id === preferredTeamId) || ownedTeams[0];
  }

  const { data: staffRows, error: staffError } = await client
    .from("team_staff")
    .select("team_id,role,created_at")
    .eq("user_id", user.id)
    .in("role", ["owner", "head_coach"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (staffError) throw staffError;
  if (!staffRows?.[0]?.team_id) return null;

  const { data: staffTeam, error: teamError } = await client
    .from("teams")
    .select("id,name,coach_label,owner_user_id,created_at")
    .eq("id", staffRows[0].team_id)
    .maybeSingle();
  if (teamError) throw teamError;
  return staffTeam || null;
}

export async function getAuthSession() {
  const client = await requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function loadCoachTeam(preferredTeamId = "") {
  const client = await requireClient();
  const user = await currentUser(client);
  const team = await findCoachTeam(client, user, preferredTeamId);
  if (!team) return null;

  const { data: plan, error } = await client
    .from("team_plan_snapshots")
    .select("updated_at")
    .eq("team_id", team.id)
    .maybeSingle();
  if (error) throw error;

  return {
    ...team,
    lastSyncedAt: plan?.updated_at || "",
  };
}

export async function sendSignInLink(email) {
  const client = await requireClient();
  const redirect = new URL(window.location.href);
  redirect.hash = "";
  redirect.searchParams.delete("code");

  const { error } = await client.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: redirect.toString(),
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signInPlayerAnonymously() {
  const client = await requireClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    if (/anonymous|disabled|provider/i.test(error.message || "")) {
      throw new Error("Player code login needs Anonymous Sign-Ins enabled in Supabase Authentication settings.");
    }
    throw error;
  }
  return data.session || null;
}

export async function signOut() {
  const client = await requireClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function subscribeToAuth(callback) {
  const client = await requireClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function saveProfile({ displayName, accountType, guardianConsent = false }) {
  const client = await requireClient();
  const user = await currentUser(client);
  const profile = {
    id: user.id,
    display_name: normalizeName(displayName, user.email?.split("@")[0] || "Player"),
    account_type: accountType,
    guardian_consent_at: guardianConsent ? isoNow() : null,
  };
  const { data, error } = await client
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function hashInviteCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureTeamRow(client, user, snapshot) {
  const existingTeam = await findCoachTeam(client, user, snapshot.team.id);
  const row = {
    id: existingTeam?.id || snapshot.team.id,
    name: normalizeName(snapshot.team.name, "SpeedDesk Team"),
    coach_label: normalizeName(snapshot.team.coachLabel, "Coach"),
    owner_user_id: existingTeam?.owner_user_id || user.id,
  };

  if (!existingTeam) {
    const { error: insertError } = await client.from("teams").insert(row);
    if (insertError && insertError.code !== "23505") throw insertError;
  }

  const { error: updateError } = await client
    .from("teams")
    .update({ name: row.name, coach_label: row.coach_label })
    .eq("id", row.id);
  if (updateError) throw updateError;

  if (row.owner_user_id === user.id) {
    const { error: staffError } = await client.from("team_staff").insert({
      team_id: row.id,
      user_id: user.id,
      role: "owner",
    });
    if (staffError && staffError.code !== "23505") throw staffError;
  }

  return row.id;
}

async function syncGroups(client, teamId, athletes) {
  const groupNames = Array.from(new Set(
    athletes
      .map((athlete) => String(athlete.group || "").trim())
      .filter(Boolean)
  )).sort();

  if (groupNames.length) {
    const { error } = await client
      .from("groups")
      .upsert(
        groupNames.map((name) => ({ team_id: teamId, name })),
        { onConflict: "team_id,name" }
      );
    if (error) throw error;
  }

  const { data, error } = await client
    .from("groups")
    .select("id,name")
    .eq("team_id", teamId);
  if (error) throw error;
  return new Map((data || []).map((group) => [group.name, group.id]));
}

async function syncAthletes(client, teamId, userId, athletes, groupIds) {
  if (!athletes.length) return [];

  const rows = athletes.map((athlete) => ({
    team_id: teamId,
    source_key: String(athlete.id),
    display_name: normalizeName(athlete.name),
    email: normalizeEmail(athlete.email),
    status: athlete.status || "Active",
  }));

  const { data, error } = await client
    .from("athletes")
    .upsert(rows, { onConflict: "team_id,source_key" })
    .select("id,source_key");
  if (error) throw error;

  const cloudBySource = new Map((data || []).map((athlete) => [athlete.source_key, athlete.id]));
  const noteRows = [];
  const membershipRows = [];

  athletes.forEach((athlete) => {
    const athleteId = cloudBySource.get(String(athlete.id));
    if (!athleteId) return;

    if (athlete.notes) {
      noteRows.push({
        athlete_id: athleteId,
        team_id: teamId,
        note: String(athlete.notes),
        updated_by: userId,
        updated_at: isoNow(),
      });
    }

    const groupId = groupIds.get(String(athlete.group || "").trim());
    if (groupId) {
      membershipRows.push({
        athlete_id: athleteId,
        group_id: groupId,
        team_id: teamId,
      });
    }
  });

  if (noteRows.length) {
    const { error: noteError } = await client
      .from("athlete_private_notes")
      .upsert(noteRows, { onConflict: "athlete_id" });
    if (noteError) throw noteError;
  }

  if (membershipRows.length) {
    const { error: membershipError } = await client
      .from("athlete_groups")
      .upsert(membershipRows, { onConflict: "athlete_id,group_id" });
    if (membershipError) throw membershipError;
  }

  return data || [];
}

export async function syncSecureTeam({ snapshot, athletes }) {
  const client = await requireClient();
  const user = await currentUser(client);

  await saveProfile({
    displayName: snapshot.team.coachLabel || user.email?.split("@")[0] || "Coach",
    accountType: "coach",
  });

  const teamId = await ensureTeamRow(client, user, snapshot);
  const groupIds = await syncGroups(client, teamId, athletes);
  await syncAthletes(client, teamId, user.id, athletes, groupIds);

  const canonicalSnapshot = {
    ...snapshot,
    team: {
      id: teamId,
      name: snapshot.team.name,
      coachLabel: snapshot.team.coachLabel,
    },
  };
  const { data: existingPlan, error: existingPlanError } = await client
    .from("team_plan_snapshots")
    .select("payload")
    .eq("team_id", teamId)
    .maybeSingle();
  if (existingPlanError) throw existingPlanError;

  const playerPlan = mergeWorkoutAssignment(existingPlan?.payload || null, canonicalSnapshot);
  const { error: planError } = await client.from("team_plan_snapshots").upsert({
    team_id: teamId,
    payload: playerPlan,
    updated_by: user.id,
    updated_at: snapshot.syncedAt,
  }, { onConflict: "team_id" });
  if (planError) throw planError;

  return canonicalSnapshot;
}

export async function createTeamInvite({
  teamId,
  code,
  groupName = "",
  athleteId = null,
  role = "player",
  autoApprove = false,
  expiresInDays = 14,
  maxUses = 30,
}) {
  const client = await requireClient();
  const user = await currentUser(client);
  let groupId = null;

  if (groupName) {
    const { data: group, error: groupError } = await client
      .from("groups")
      .select("id")
      .eq("team_id", teamId)
      .eq("name", groupName)
      .maybeSingle();
    if (groupError) throw groupError;
    groupId = group?.id || null;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  const codeHash = await hashInviteCode(code);
  const { data, error } = await client
    .from("team_invites")
    .insert({
      team_id: teamId,
      group_id: groupId,
      athlete_id: athleteId,
      code_hash: codeHash,
      code_hint: String(code).slice(-4).toUpperCase(),
      role,
      auto_approve: autoApprove,
      expires_at: expiresAt.toISOString(),
      max_uses: maxUses,
      created_by: user.id,
    })
    .select("id,team_id,group_id,athlete_id,code_hint,role,auto_approve,expires_at,max_uses,uses,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function revokeTeamInvite(inviteId) {
  const client = await requireClient();
  const { error } = await client
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function submitJoinRequest({ inviteCode, playerName, accountType }) {
  const client = await requireClient();
  const user = await currentUser(client);
  const requestedRole = accountType === "guardian" ? "guardian" : "player";

  await saveProfile({
    displayName: requestedRole === "guardian" ? user.email?.split("@")[0] || "Guardian" : playerName,
    accountType: requestedRole,
    guardianConsent: requestedRole === "guardian",
  });

  const { data, error } = await client
    .from("join_requests")
    .insert({
      invite_id: crypto.randomUUID(),
      team_id: crypto.randomUUID(),
      user_id: user.id,
      requested_role: requestedRole,
      player_name: normalizeName(playerName),
      email: normalizeEmail(user.email),
      submitted_code: String(inviteCode || "").trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadPlayerPortal() {
  const client = await requireClient();
  const user = await currentUser(client);

  const [profileResult, requestResult, athleteResult] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client
      .from("join_requests")
      .select("id,team_id,group_id,athlete_id,status,player_name,requested_role,requested_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false }),
    client
      .from("athletes")
      .select("id,team_id,source_key,display_name,status,profile_id,guardian_profile_id")
      .or(`profile_id.eq.${user.id},guardian_profile_id.eq.${user.id}`),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (requestResult.error) throw requestResult.error;
  if (athleteResult.error) throw athleteResult.error;

  const requests = requestResult.data || [];
  const athletes = athleteResult.data || [];
  const approved = requests.find((request) => request.status === "approved");
  const athlete = approved?.athlete_id
    ? athletes.find((item) => item.id === approved.athlete_id)
    : athletes[0];

  if (!athlete) {
    return {
      user,
      profile: profileResult.data,
      request: requests[0] || null,
      athlete: null,
      snapshot: null,
      team: null,
      groups: [],
    };
  }

  const [teamResult, planResult, groupResult] = await Promise.all([
    client.from("teams").select("id,name,coach_label").eq("id", athlete.team_id).single(),
    client.from("team_plan_snapshots").select("payload,updated_at").eq("team_id", athlete.team_id).maybeSingle(),
    client
      .from("athlete_groups")
      .select("group_id")
      .eq("athlete_id", athlete.id),
  ]);
  if (teamResult.error) throw teamResult.error;
  if (planResult.error) throw planResult.error;
  if (groupResult.error) throw groupResult.error;

  const groupIds = (groupResult.data || []).map((membership) => membership.group_id);
  let groups = [];
  if (groupIds.length) {
    const { data, error } = await client.from("groups").select("id,name").in("id", groupIds);
    if (error) throw error;
    groups = data || [];
  }

  return {
    user,
    profile: profileResult.data,
    request: approved || requests[0] || null,
    athlete,
    snapshot: planResult.data?.payload || null,
    team: teamResult.data,
    groups,
  };
}

export async function loadWorkoutAttempt({ athleteId, workoutKey, workoutDate }) {
  const client = await requireClient();
  const { data, error } = await client
    .from("workout_attempts")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("workout_key", workoutKey)
    .eq("workout_date", workoutDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveWorkoutAttempt(payload) {
  const client = await requireClient();
  const row = {
    team_id: payload.teamId,
    athlete_id: payload.athleteId,
    workout_key: payload.workoutKey,
    workout_date: payload.workoutDate,
    workout_title: payload.workoutTitle,
    status: payload.completed ? "completed" : "in_progress",
    started_at: payload.startedAt,
    completed_at: payload.completedAt || null,
    checked_steps: payload.checked || [],
    effort: payload.effort || null,
    pain: payload.pain ?? null,
    duration_seconds: payload.durationSeconds ?? null,
    player_note: payload.playerNote || "",
    sync_source: payload.syncSource || "web",
  };
  const { data, error } = await client
    .from("workout_attempts")
    .upsert(row, { onConflict: "athlete_id,workout_key,workout_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadCoachHub(teamId) {
  const client = await requireClient();
  const [inviteResult, requestResult, attemptResult, reviewResult, groupResult, athleteResult, membershipResult] = await Promise.all([
    client
      .from("team_invites")
      .select("id,team_id,group_id,code_hint,role,auto_approve,expires_at,max_uses,uses,revoked_at,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    client
      .from("join_requests")
      .select("id,team_id,group_id,athlete_id,user_id,requested_role,player_name,email,status,requested_at,reviewed_at")
      .eq("team_id", teamId)
      .order("requested_at", { ascending: false }),
    client
      .from("workout_attempts")
      .select("*")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false })
      .limit(100),
    client.from("workout_reviews").select("*").eq("team_id", teamId),
    client.from("groups").select("id,name").eq("team_id", teamId).order("name"),
    client.from("athletes").select("id,display_name,email,status").eq("team_id", teamId),
    client.from("athlete_groups").select("athlete_id,group_id").eq("team_id", teamId),
  ]);

  for (const result of [inviteResult, requestResult, attemptResult, reviewResult, groupResult, athleteResult, membershipResult]) {
    if (result.error) throw result.error;
  }

  return {
    invitations: inviteResult.data || [],
    requests: requestResult.data || [],
    attempts: attemptResult.data || [],
    reviews: reviewResult.data || [],
    groups: groupResult.data || [],
    athletes: athleteResult.data || [],
    memberships: membershipResult.data || [],
  };
}

export async function decideJoinRequest(requestId, status) {
  const client = await requireClient();
  const { data, error } = await client
    .from("join_requests")
    .update({ status })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reviewWorkout({ attemptId, teamId, decision, note = "" }) {
  const client = await requireClient();
  const user = await currentUser(client);
  const { data, error } = await client
    .from("workout_reviews")
    .upsert({
      attempt_id: attemptId,
      team_id: teamId,
      coach_user_id: user.id,
      decision,
      note,
      reviewed_at: isoNow(),
    }, { onConflict: "attempt_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function subscribeCoachUpdates(teamId, onChange) {
  const client = await requireClient();
  const channel = client
    .channel(`speeddesk-coach-${teamId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "join_requests",
      filter: `team_id=eq.${teamId}`,
    }, onChange)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "workout_attempts",
      filter: `team_id=eq.${teamId}`,
    }, onChange)
    .subscribe();

  return () => client.removeChannel(channel);
}
