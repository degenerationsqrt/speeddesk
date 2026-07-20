import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTeamSnapshotByInvite } from "../api/teamSync";
import { getSupabaseSetupState } from "../api/supabaseConfig";

const POLL_MS = 20000;

const today = () => new Date().toISOString().slice(0, 10);

function programName(programs, id) {
  return programs.find((program) => program.id === id)?.name || "Assigned program";
}

function programDrills(program) {
  return Array.isArray(program?.drills) ? program.drills : [];
}

function notificationSupport() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function routineKey(snapshot) {
  const routine = snapshot?.activeRoutine;
  if (!routine) return snapshot?.syncedAt || "";
  return [snapshot?.syncedAt, routine.day, routine.focus, routine.trainingLoad].filter(Boolean).join("|");
}

function formatSyncTime(value) {
  if (!value) return "Not synced";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function showRoutineNotification(routine) {
  if (notificationSupport() !== "granted" || !routine) return;

  const title = "Routine updated";
  const body = `${routine.day}: ${routine.focus}`;
  const icon = new URL("./icons/icon-192.png", window.location.href).toString();
  const options = {
    body,
    icon,
    badge: icon,
    tag: "speeddesk-routine",
    renotify: true,
    data: { url: window.location.href },
  };

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch (error) {
      // Fall back to the page Notification API below.
    }
  }

  new Notification(title, options);
}

export default function AthletePortal({ inviteCode }) {
  const setup = getSupabaseSetupState();
  const [status, setStatus] = useState(setup.isConfigured ? "loading" : "setup");
  const [message, setMessage] = useState(setup.isConfigured ? "Loading team schedule..." : "Team Sync is not configured yet.");
  const [snapshot, setSnapshot] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(notificationSupport);
  const lastRoutineKey = useRef("");

  useEffect(() => {
    if (!setup.isConfigured) return;

    let cancelled = false;

    async function loadSnapshot({ notify } = { notify: false }) {
      try {
        const data = await fetchTeamSnapshotByInvite(inviteCode);
        if (cancelled) return;

        const nextKey = routineKey(data);
        const previousKey = lastRoutineKey.current;
        setSnapshot(data);
        setStatus("ready");
        setMessage("");

        if (notify && previousKey && nextKey && nextKey !== previousKey) {
          setMessage("Routine updated by coach.");
          showRoutineNotification(data.activeRoutine);
        }
        lastRoutineKey.current = nextKey;
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message || "Could not load this team invite.");
      }
    }

    loadSnapshot({ notify: false });
    const poll = window.setInterval(() => loadSnapshot({ notify: true }), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [inviteCode, setup.isConfigured]);

  const programs = snapshot?.programs || [];
  const sessions = snapshot?.sessions || [];
  const activeRoutine = snapshot?.activeRoutine;
  const todaysSessions = useMemo(() => sessions.filter((event) => event.date === today()), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((event) => event.date >= today()).slice(0, 5), [sessions]);

  const requestNotifications = async () => {
    if (notificationSupport() === "unsupported") {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setMessage("Routine alerts enabled.");
      showRoutineNotification(activeRoutine || { day: "Team", focus: "Routine alerts enabled" });
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div>
            <div className="brand">APEX<span>PREDATOR</span><strong>ELITE</strong></div>
            <div className="tagline">Team schedule</div>
          </div>
          <span className={`status-pill ${status === "ready" ? "green" : "gold"}`}>{status === "ready" ? "Connected" : "Setup"}</span>
        </div>
      </header>

      <main className="content">
        <section className="panel">
          <div className="panel-title">{snapshot?.team?.name || "Team Invite"}</div>
          <div className="panel-sub">Workouts assigned by {snapshot?.team?.coachLabel || "your coach"}</div>

          {message && <div className="callout">{message}</div>}
          {status === "setup" && (
            <div className="sync-note">
              Ask the coach to deploy the app with Supabase environment variables before using this invite.
            </div>
          )}
        </section>

        {status === "ready" && (
          <>
            <section className="panel">
              <div className="panel-title">Active Routine</div>
              <div className="panel-sub">Synced {formatSyncTime(snapshot?.syncedAt)}</div>
              {!activeRoutine ? (
                <div className="empty">No selected routine has been synced yet.</div>
              ) : (
                <RoutineCard routine={activeRoutine} />
              )}
            </section>

            <section className="panel">
              <div className="panel-title">Alerts</div>
              <div className="panel-sub">Routine-change notifications</div>
              <div className="sync-status-row">
                <span className={`status-pill ${notificationPermission === "granted" ? "green" : "gold"}`}>
                  {notificationPermission === "granted" ? "On" : notificationPermission === "denied" ? "Blocked" : "Off"}
                </span>
                <button className="ghost-btn small-btn" type="button" onClick={requestNotifications}>
                  Enable Alerts
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">Today</div>
              <div className="panel-sub">Scheduled team sessions</div>
              {todaysSessions.length === 0 ? (
                <div className="empty">No team session assigned for today.</div>
              ) : (
                <SessionList sessions={todaysSessions} programs={programs} />
              )}
            </section>

            <section className="panel">
              <div className="panel-title">Upcoming</div>
              <div className="panel-sub">Next team sessions</div>
              {upcomingSessions.length === 0 ? (
                <div className="empty">No upcoming team sessions yet.</div>
              ) : (
                <SessionList sessions={upcomingSessions} programs={programs} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RoutineCard({ routine }) {
  return (
    <div className="coach-card">
      <div className="coach-card-head">
        <div>
          <div className="item-title">{routine.day} - {routine.focus}</div>
          <div className="muted">{routine.minutes} min - load {routine.trainingLoad} - RPE {routine.rpe ?? "-"}</div>
        </div>
        <span className="status-pill green">{routine.intensity || "Routine"}</span>
      </div>
      <p className="muted tight">{routine.intent}</p>
      <div className="detail-row">
        {routine.parentMode && <span>{routine.parentMode}</span>}
        {routine.nonNegotiable && <span>{routine.nonNegotiable}</span>}
      </div>
      <div className="mini-program-list">
        {(routine.blocks || []).map((block, index) => (
          <div className="mini-row" key={`${block.name}-${index}`}>
            <span className="badge" style={{ "--badge-color": "#a3e635" }}>{block.category || "Block"}</span>
            <span>{block.name}</span>
            <strong>{block.dose}</strong>
          </div>
        ))}
      </div>
      {routine.notes && <div className="cue-line">{routine.notes}</div>}
    </div>
  );
}

function SessionList({ sessions, programs }) {
  return (
    <div className="sync-list">
      {sessions.map((event) => {
        const program = programs.find((item) => item.id === event.programId);
        return (
          <div className="sync-row athlete-session" key={event.id}>
            <div>
              <div className="item-title">{event.title}</div>
              <div className="muted">{event.date} {event.time} - {event.location || "Location TBD"}</div>
              <div className="cue-line">{programName(programs, event.programId)}</div>
              {program?.notes && <div className="muted tight">{program.notes}</div>}
              <div className="muted tight">{programDrills(program).length} drills assigned</div>
            </div>
            <span className="status-pill green">Whole roster</span>
          </div>
        );
      })}
    </div>
  );
}
