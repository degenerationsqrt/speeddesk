import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTeamInvite,
  decideJoinRequest,
  getAuthSession,
  loadCoachHub,
  loadCoachTeam,
  reviewWorkout,
  revokeTeamInvite,
  sendSignInLink,
  signOut,
  subscribeCoachUpdates,
  subscribeToAuth,
} from "../api/teamAccount";
import { buildInviteUrl, buildPlayerLoginUrl, createInviteCode } from "../api/teamSync";
import { useTeamSync } from "../sync/useTeamSync";

const EMPTY_HUB = {
  invitations: [],
  requests: [],
  attempts: [],
  reviews: [],
  groups: [],
  athletes: [],
  memberships: [],
};

function programName(programs, id) {
  return programs.find((program) => program.id === id)?.name || "No program";
}

function formatSyncTime(value) {
  if (!value) return "Not synced";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatShortDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function groupNamesFromRoster(athletes) {
  return Array.from(new Set(
    athletes
      .map((athlete) => String(athlete.group || "").trim())
      .filter(Boolean)
  )).sort();
}

export default function TeamSync({ athletes, programs, calendarEvents, activeRoutine, dailyRoutines = [], onFlash }) {
  const sync = useTeamSync({ athletes, programs, calendarEvents, activeRoutine, dailyRoutines, onFlash });
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [accountStatus, setAccountStatus] = useState("idle");
  const [accountMessage, setAccountMessage] = useState("");
  const [hub, setHub] = useState(EMPTY_HUB);
  const [hubStatus, setHubStatus] = useState("idle");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [assignmentGroup, setAssignmentGroup] = useState("all");
  const [latestInvite, setLatestInvite] = useState(null);
  const activeAthletes = athletes.filter((athlete) => athlete.status !== "Inactive");
  const localGroups = useMemo(() => groupNamesFromRoster(activeAthletes), [activeAthletes]);
  const groups = hub.groups.length ? hub.groups.map((group) => group.name) : localGroups;
  const upcomingSessions = calendarEvents.slice(0, 5);
  const connectionLabel = sync.setup.isConfigured ? (session ? "Coach connected" : "Sign in to connect") : "Setup needed";
  const assignmentTarget = assignmentGroup === "all"
    ? { type: "all", name: "" }
    : { type: "group", name: assignmentGroup };
  const assignmentLabel = assignmentGroup === "all" ? "All players" : assignmentGroup;
  const playerLoginUrl = buildPlayerLoginUrl();

  const copyText = async (value, success = "Copied") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onFlash?.(success);
    } catch (_error) {
      onFlash?.("Select and copy the link");
    }
  };

  const refreshHub = useCallback(async ({ quiet = false } = {}) => {
    if (!session || !sync.team.id) return;
    if (!quiet) setHubStatus("loading");
    try {
      const nextHub = await loadCoachHub(sync.team.id);
      setHub(nextHub);
      setHubStatus("ready");
    } catch (error) {
      setHubStatus("error");
      setAccountMessage(error.message || "Coach dashboard could not load.");
    }
  }, [session, sync.team.id]);

  useEffect(() => {
    if (!sync.setup.isConfigured) return undefined;
    let active = true;
    let stopAuth = null;

    getAuthSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch((error) => {
        if (active) setAccountMessage(error.message || "Coach sign-in could not load.");
      });

    subscribeToAuth((nextSession) => {
      if (active) setSession(nextSession);
    }).then((unsubscribe) => {
      if (active) stopAuth = unsubscribe;
      else unsubscribe();
    });

    return () => {
      active = false;
      stopAuth?.();
    };
  }, [sync.setup.isConfigured]);

  useEffect(() => {
    if (!session) {
      setHub(EMPTY_HUB);
      return undefined;
    }
    refreshHub();
    let stopRealtime = null;
    let active = true;
    subscribeCoachUpdates(sync.team.id, () => refreshHub({ quiet: true }))
      .then((unsubscribe) => {
        if (active) stopRealtime = unsubscribe;
        else unsubscribe();
      })
      .catch(() => {});
    return () => {
      active = false;
      stopRealtime?.();
    };
  }, [refreshHub, session, sync.team.id]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    loadCoachTeam(sync.team.id)
      .then((cloudTeam) => {
        if (active && cloudTeam) sync.adoptCloudTeam(cloudTeam);
      })
      .catch((error) => {
        if (active) setAccountMessage(error.message || "Your cloud team could not be reopened.");
      });
    return () => {
      active = false;
    };
  }, [session, sync.adoptCloudTeam, sync.team.id]);

  const sendMagicLink = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setAccountStatus("sending");
    setAccountMessage("");
    try {
      await sendSignInLink(email);
      setAccountStatus("sent");
      setAccountMessage("Check your email and tap the secure SpeedDesk sign-in link.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error.message || "Sign-in link could not be sent.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSession(null);
      setHub(EMPTY_HUB);
      setAccountMessage("Signed out.");
    } catch (error) {
      setAccountMessage(error.message || "Could not sign out.");
    }
  };

  const syncAndRefresh = async () => {
    const synced = await sync.syncNow(assignmentTarget);
    if (!synced) return;
    const nextHub = await loadCoachHub(synced.team.id);
    setHub(nextHub);
    setHubStatus("ready");
  };

  const createInvite = async () => {
    if (!session) {
      setAccountMessage("Sign in and sync the team before creating player invites.");
      return;
    }
    setHubStatus("working");
    const code = createInviteCode();
    try {
      const synced = await sync.syncNow(assignmentTarget);
      if (!synced) {
        setHubStatus("error");
        return;
      }
      const invitation = await createTeamInvite({
        teamId: synced.team.id,
        code,
        groupName: assignmentGroup === "all" ? "" : assignmentGroup,
        autoApprove: true,
        expiresInDays: 30,
        maxUses: 30,
      });
      setLatestInvite({
        ...invitation,
        code,
        groupName: assignmentLabel,
        url: buildInviteUrl(code),
      });
      const nextHub = await loadCoachHub(synced.team.id);
      setHub(nextHub);
      setHubStatus("ready");
      onFlash?.("Player code ready");
    } catch (error) {
      setAccountMessage(error.message || "Player code could not be created.");
      setHubStatus("error");
    }
  };

  const removeInvite = async (inviteId) => {
    try {
      await revokeTeamInvite(inviteId);
      await refreshHub({ quiet: true });
      onFlash?.("Invite closed");
    } catch (error) {
      setAccountMessage(error.message || "Invite could not be closed.");
    }
  };

  const decideRequest = async (requestId, status) => {
    try {
      await decideJoinRequest(requestId, status);
      await refreshHub({ quiet: true });
      onFlash?.(status === "approved" ? "Player approved" : "Request declined");
    } catch (error) {
      setAccountMessage(error.message || "Request could not be updated.");
    }
  };

  const setReview = async (attemptId, decision) => {
    try {
      await reviewWorkout({
        attemptId,
        teamId: sync.team.id,
        decision,
        note: decision === "verified" ? "Reviewed in SpeedDesk." : "Coach follow-up requested.",
      });
      await refreshHub({ quiet: true });
      onFlash?.(decision === "verified" ? "Workout verified" : "Follow-up marked");
    } catch (error) {
      setAccountMessage(error.message || "Workout review could not be saved.");
    }
  };

  const hubGroupIds = useMemo(() => {
    if (selectedGroup === "all") return null;
    return new Set(hub.groups.filter((group) => group.name === selectedGroup).map((group) => group.id));
  }, [hub.groups, selectedGroup]);

  const athleteIdsInView = useMemo(() => {
    if (!hubGroupIds) return new Set(hub.athletes.map((athlete) => athlete.id));
    return new Set(
      hub.memberships
        .filter((membership) => hubGroupIds.has(membership.group_id))
        .map((membership) => membership.athlete_id)
    );
  }, [hub.athletes, hub.memberships, hubGroupIds]);

  const pendingRequests = hub.requests.filter((request) => {
    if (request.status !== "pending") return false;
    if (!hubGroupIds) return true;
    return request.group_id ? hubGroupIds.has(request.group_id) : true;
  });
  const attempts = hub.attempts.filter((attempt) => athleteIdsInView.has(attempt.athlete_id));
  const athleteById = new Map(hub.athletes.map((athlete) => [athlete.id, athlete]));
  const reviewByAttempt = new Map(hub.reviews.map((review) => [review.attempt_id, review]));
  const completed = attempts.filter((attempt) => attempt.status === "completed");
  const verified = completed.filter((attempt) => reviewByAttempt.get(attempt.id)?.decision === "verified");
  const needsAttention = completed.filter((attempt) => Number(attempt.pain || 0) > 0 || reviewByAttempt.get(attempt.id)?.decision === "follow_up");

  return (
    <>
      <Panel title="Coach Account" sub="One secure sign-in controls the team, player requests, groups, and workout reviews">
        {!sync.setup.isConfigured ? (
          <div className="sync-note">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then install `supabase/schema.sql`.
          </div>
        ) : session ? (
          <div className="account-strip">
            <div>
              <StatusPill tone="green" label="Signed in" />
              <div className="item-title">{session.user.email}</div>
              <div className="muted">Only approved team members can see player data.</div>
            </div>
            <button className="ghost-btn" type="button" onClick={handleSignOut}>Sign out this device</button>
          </div>
        ) : (
          <form className="coach-login" onSubmit={sendMagicLink}>
            <Field label="Coach email">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="coach@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <button className="save-btn" type="submit" disabled={accountStatus === "sending"}>
              {accountStatus === "sending" ? "Sending..." : "Email me a sign-in link"}
            </button>
          </form>
        )}
        {accountMessage && <div className="callout">{accountMessage}</div>}
      </Panel>

      <Panel title="Push Workout & Player Access" sub="Assign the plan, send it, and give players their entry code from one place">
        <div className="sync-status-row">
          <StatusPill tone={sync.setup.isConfigured && session ? "green" : "gold"} label={connectionLabel} />
          <span className="muted">Last sync: {formatSyncTime(sync.team.lastSyncedAt)}</span>
        </div>

        <div className="workflow-step">
          <div className="workflow-step-head">
            <span>1</span>
            <div>
              <strong>Choose who gets this plan</strong>
              <small>The selected group receives the seven-day workout shown below.</small>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Assign workout to">
              <select className="select" value={assignmentGroup} onChange={(event) => setAssignmentGroup(event.target.value)}>
                <option value="all">All players</option>
                {groups.map((group) => <option value={group} key={group}>{group}</option>)}
              </select>
            </Field>
            <Field label="Team name">
              <input className="input" value={sync.team.name} onChange={(event) => sync.updateTeam({ name: event.target.value })} />
            </Field>
            <Field label="Coach label">
              <input className="input" value={sync.team.coachLabel} onChange={(event) => sync.updateTeam({ coachLabel: event.target.value })} />
            </Field>
          </div>
        </div>

        <div className="workflow-step">
          <div className="workflow-step-head">
            <span>2</span>
            <div>
              <strong>Review and push the workout</strong>
              <small>{dailyRoutines.length || (activeRoutine ? 1 : 0)} workout days ready for {assignmentLabel}.</small>
            </div>
          </div>
          <div className="assignment-preview">
            {(dailyRoutines.length ? dailyRoutines : activeRoutine ? [activeRoutine] : []).map((routine) => (
              <div className="assignment-day" key={routine.id || `${routine.day}-${routine.focus}`}>
                <strong>{routine.day}</strong>
                <span>{routine.focus}</span>
                <small>{routine.minutes ?? "--"} min</small>
              </div>
            ))}
            {!dailyRoutines.length && !activeRoutine && (
              <Empty text="Choose or build a workout plan before pushing." />
            )}
          </div>
          <button
            className="save-btn"
            type="button"
            onClick={syncAndRefresh}
            disabled={!session || sync.status === "syncing" || (!dailyRoutines.length && !activeRoutine)}
          >
            {sync.status === "syncing" ? "Pushing..." : `Push Workout Plan to ${assignmentLabel}`}
          </button>
        </div>

        {sync.message && <div className="callout">{sync.message}</div>}

        <div className="workflow-step">
          <div className="workflow-step-head">
            <span>3</span>
            <div>
              <strong>Create the player entry code</strong>
              <small>Players enter once with their name—no email or password. The code opens {assignmentLabel}.</small>
            </div>
          </div>
          <div className="sync-note">
            One-time setup: Supabase Authentication → Sign In / Providers → turn on <strong>Allow anonymous sign-ins</strong>.
          </div>
          <div className="player-access-actions">
            <button
              className="save-btn"
              type="button"
              onClick={createInvite}
              disabled={!session || hubStatus === "working" || (!dailyRoutines.length && !activeRoutine)}
            >
              {hubStatus === "working" ? "Creating..." : `Create Code + Push Plan`}
            </button>
            <button className="ghost-btn" type="button" onClick={() => copyText(playerLoginUrl, "Player login link copied")}>
              Copy Player Login Page
            </button>
          </div>
        </div>

        {latestInvite && (
          <div className="invite-result">
            <div>
              <span className="eyebrow">{latestInvite.groupName}</span>
              <strong className="invite-code">{latestInvite.code}</strong>
              <span className="muted">Instant access · expires in 30 days · up to 30 players</span>
            </div>
            <div className="button-row">
              <button className="ghost-btn gold" type="button" onClick={() => copyText(latestInvite.code, "Code copied")}>Copy code</button>
              <button className="ghost-btn" type="button" onClick={() => copyText(latestInvite.url, "Player link copied")}>Copy player link</button>
            </div>
          </div>
        )}

        {hub.invitations.length > 0 && (
          <>
            <div className="workflow-subtitle">Active player codes</div>
            <div className="sync-list">
              {hub.invitations.slice(0, 8).map((invite) => {
                const group = hub.groups.find((item) => item.id === invite.group_id)?.name || "Any group";
                const active = !invite.revoked_at && (!invite.expires_at || new Date(invite.expires_at) > new Date());
                return (
                  <div className="sync-row" key={invite.id}>
                    <div>
                      <div className="item-title">{group} · ends in {invite.code_hint}</div>
                      <div className="muted">{invite.uses}/{invite.max_uses || "∞"} joins · expires {formatShortDate(invite.expires_at)}</div>
                    </div>
                    {active ? (
                      <button className="text-button danger" type="button" onClick={() => removeInvite(invite.id)}>Close</button>
                    ) : (
                      <StatusPill tone="muted" label="Closed" />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="workflow-step compact">
          <div className="workflow-step-head">
            <span>4</span>
            <div>
              <strong>Choose the group you want to oversee</strong>
              <small>This filters join requests and workout proof below.</small>
            </div>
          </div>
          <div className="group-switcher" role="group" aria-label="Coach group view">
            <button
              className={`group-chip ${selectedGroup === "all" ? "active" : ""}`}
              type="button"
              onClick={() => setSelectedGroup("all")}
            >
              All players
            </button>
            {groups.map((group) => (
              <button
                className={`group-chip ${selectedGroup === group ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedGroup(group)}
                key={group}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Join Requests" sub="No player enters the roster until a coach approves the request">
        {pendingRequests.length === 0 ? (
          <Empty text={session ? "No player requests are waiting." : "Sign in to review player requests."} />
        ) : (
          <div className="sync-list">
            {pendingRequests.map((request) => (
              <div className="sync-row request-row" key={request.id}>
                <div>
                  <div className="item-title">{request.player_name || "Player"}</div>
                  <div className="muted">{request.email || "No email"} · {request.requested_role} · {formatShortDate(request.requested_at)}</div>
                </div>
                <div className="button-row compact">
                  <button className="ghost-btn" type="button" onClick={() => decideRequest(request.id, "rejected")}>Decline</button>
                  <button className="ghost-btn gold" type="button" onClick={() => decideRequest(request.id, "approved")}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Workout Proof" sub="Completion is evidence-based: checked steps, time, effort, pain, and coach review">
        <div className="metric-grid">
          <Metric label="Completed logs" value={completed.length} accent="green" />
          <Metric label="Coach verified" value={verified.length} accent="orange" />
          <Metric label="Needs attention" value={needsAttention.length} accent="gold" />
        </div>

        {attempts.length === 0 ? (
          <Empty text={session ? "No workout activity for this group yet." : "Sign in to see player workout activity."} />
        ) : (
          <div className="proof-list">
            {attempts.slice(0, 20).map((attempt) => {
              const athlete = athleteById.get(attempt.athlete_id);
              const review = reviewByAttempt.get(attempt.id);
              const evidence = [
                `${attempt.checked_steps?.length || 0} steps`,
                attempt.duration_seconds ? `${Math.round(attempt.duration_seconds / 60)} min` : null,
                attempt.effort ? `effort ${attempt.effort}` : null,
                attempt.pain != null ? `pain ${attempt.pain}/10` : null,
                attempt.sync_source === "wearable" ? "watch" : "web",
              ].filter(Boolean).join(" · ");
              return (
                <div className="proof-card" key={attempt.id}>
                  <div className="proof-card-main">
                    <div>
                      <div className="item-title">{athlete?.display_name || "Player"} · {attempt.workout_title}</div>
                      <div className="muted">{attempt.workout_date} · {evidence}</div>
                    </div>
                    <StatusPill
                      tone={review?.decision === "verified" ? "green" : attempt.status === "completed" ? "gold" : "muted"}
                      label={review?.decision === "verified" ? "Verified" : review?.decision === "follow_up" ? "Follow up" : attempt.status === "completed" ? "Player logged" : "In progress"}
                    />
                  </div>
                  {attempt.status === "completed" && (
                    <div className="button-row compact">
                      <button className="ghost-btn" type="button" onClick={() => setReview(attempt.id, "follow_up")}>Follow up</button>
                      <button className="ghost-btn gold" type="button" onClick={() => setReview(attempt.id, "verified")}>Verify workout</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Shared Schedule" sub="What approved players will see in their account">
        {upcomingSessions.length === 0 ? (
          <Empty text="Schedule a program to create the shared team calendar." />
        ) : (
          <div className="sync-list">
            {upcomingSessions.map((event) => (
              <div className="sync-row" key={event.id}>
                <div>
                  <div className="item-title">{event.title}</div>
                  <div className="muted">{event.date} {event.time} - {programName(programs, event.programId)}</div>
                </div>
                <StatusPill tone="green" label={event.targetType === "group" ? event.targetName || "Group" : "Assigned"} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
      {sub && <div className="panel-sub">{sub}</div>}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ tone, label }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
