import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTeamSnapshotByInvite } from "../api/teamSync";
import { getSupabaseSetupState } from "../api/supabaseConfig";

const POLL_MS = 20000;
const PROGRESS_KEY_PREFIX = "speeddesk:player-progress";
const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localDateString(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

const today = () => localDateString();
const currentDayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });

function normalizedDayName(dayName) {
  const value = String(dayName || "").trim().toLowerCase();
  return DAY_ORDER.find((day) => day.toLowerCase() === value) || "";
}

function notificationSupport() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function routineListFromSnapshot(snapshot) {
  const routines = Array.isArray(snapshot?.dailyRoutines) && snapshot.dailyRoutines.length
    ? snapshot.dailyRoutines
    : snapshot?.activeRoutine ? [snapshot.activeRoutine] : [];

  return routines
    .filter((routine) => routine && typeof routine === "object")
    .map((routine, index) => ({
      ...routine,
      id: routine.id || `routine-${normalizedDayName(routine.day) || index}`,
      day: normalizedDayName(routine.day) || routine.day || `Day ${index + 1}`,
      focus: routine.focus || routine.sessionType || "Workout",
      blocks: Array.isArray(routine.blocks) ? routine.blocks : [],
    }));
}

function routineForDay(snapshot, dayName = currentDayName()) {
  const routines = routineListFromSnapshot(snapshot);
  const targetDay = normalizedDayName(dayName);
  return routines.find((routine) => normalizedDayName(routine.day) === targetDay) || routines[0] || null;
}

function dayOffsetFromToday(dayName) {
  const targetIndex = DAY_ORDER.indexOf(normalizedDayName(dayName));
  if (targetIndex < 0) return 99;
  const todayIndex = new Date().getDay();
  return (targetIndex - todayIndex + 7) % 7;
}

function routineKey(snapshot) {
  const routines = routineListFromSnapshot(snapshot);
  if (!routines.length) return snapshot?.syncedAt || "";
  return [
    snapshot?.syncedAt,
    ...routines.map((routine) => [routine.day, routine.focus, routine.minutes, routine.trainingLoad].filter(Boolean).join(":")),
  ].filter(Boolean).join("|");
}

function routineProgressId(routine) {
  if (!routine) return "no-routine";
  const blocks = (Array.isArray(routine.blocks) ? routine.blocks : []).map((block) => `${block.name}:${block.dose}`).join(",");
  return [routine.date || today(), routine.day, routine.focus, routine.minutes, blocks].filter(Boolean).join("|");
}

function playerProgressKey(inviteCode, routineId) {
  return `${PROGRESS_KEY_PREFIX}:${inviteCode || "team"}:${routineId}`;
}

function formatSyncTime(value) {
  if (!value) return "Waiting for coach";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function formatSessionDate(value) {
  if (!value) return "Soon";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Soon";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function loadProgress(key) {
  if (typeof window === "undefined") return { started: false, completed: false, checked: [] };
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return { started: false, completed: false, checked: [] };
    const parsed = JSON.parse(saved);
    return {
      started: Boolean(parsed.started),
      completed: Boolean(parsed.completed),
      checked: Array.isArray(parsed.checked) ? parsed.checked : [],
    };
  } catch (error) {
    return { started: false, completed: false, checked: [] };
  }
}

function saveProgress(key, progress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(progress));
}

async function showRoutineNotification(routine) {
  if (notificationSupport() !== "granted" || !routine) return;

  const title = "New workout from coach";
  const body = `${routine.day || "Today"}: ${routine.focus || "Workout"}`;
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
  const [message, setMessage] = useState(setup.isConfigured ? "Getting today ready..." : "Team Sync is not set up yet.");
  const [snapshot, setSnapshot] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(notificationSupport);
  const [progress, setProgress] = useState({ started: false, completed: false, checked: [] });
  const [selectedDay, setSelectedDay] = useState(currentDayName);
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
          setMessage("Coach updated your workout.");
          showRoutineNotification(routineForDay(data));
        }
        lastRoutineKey.current = nextKey;
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage("");
      }
    }

    loadSnapshot({ notify: false });
    const poll = window.setInterval(() => loadSnapshot({ notify: true }), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [inviteCode, setup.isConfigured]);

  const sessions = snapshot?.sessions || [];
  const dailyRoutines = useMemo(() => routineListFromSnapshot(snapshot), [snapshot]);
  const displayRoutines = useMemo(
    () => [...dailyRoutines].sort((a, b) => dayOffsetFromToday(a.day) - dayOffsetFromToday(b.day)),
    [dailyRoutines]
  );
  const todaysRoutine = useMemo(() => routineForDay(snapshot), [snapshot]);
  const activeRoutine = dailyRoutines.find((routine) => normalizedDayName(routine.day) === normalizedDayName(selectedDay)) || todaysRoutine;
  const selectedIsToday = normalizedDayName(activeRoutine?.day) === currentDayName();
  const routineId = useMemo(() => routineProgressId(activeRoutine), [activeRoutine]);
  const progressKey = useMemo(() => playerProgressKey(inviteCode, routineId), [inviteCode, routineId]);
  const todaysSessions = useMemo(() => sessions.filter((event) => event.date === today()), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((event) => event.date >= today()).slice(0, 3), [sessions]);
  const blocks = activeRoutine?.blocks || [];
  const checkedCount = progress.checked.length;
  const progressPercent = blocks.length ? Math.round((checkedCount / blocks.length) * 100) : 0;

  useEffect(() => {
    if (!dailyRoutines.length) return;
    setSelectedDay((current) => {
      if (dailyRoutines.some((routine) => normalizedDayName(routine.day) === normalizedDayName(current))) return normalizedDayName(current) || current;
      return todaysRoutine?.day || dailyRoutines[0].day;
    });
  }, [dailyRoutines, todaysRoutine?.day]);

  useEffect(() => {
    setProgress(loadProgress(progressKey));
  }, [progressKey]);

  const updateProgress = (nextProgress) => {
    setProgress(nextProgress);
    saveProgress(progressKey, nextProgress);
  };

  const startWorkout = () => {
    updateProgress({ ...progress, started: true, completed: false });
  };

  const toggleBlock = (index) => {
    const checked = progress.checked.includes(index)
      ? progress.checked.filter((item) => item !== index)
      : [...progress.checked, index].sort((a, b) => a - b);
    updateProgress({ ...progress, started: true, completed: false, checked });
  };

  const completeWorkout = () => {
    updateProgress({ started: true, completed: true, checked: blocks.map((_, index) => index) });
    setMessage("Workout marked done. Nice work.");
  };

  const resetWorkout = () => {
    updateProgress({ started: false, completed: false, checked: [] });
    setMessage("Workout reset.");
  };

  const requestNotifications = async () => {
    if (notificationSupport() === "unsupported") {
      setNotificationPermission("unsupported");
      setMessage("Alerts are not supported on this device.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setMessage("Workout alerts are on.");
      showRoutineNotification(activeRoutine || { day: "Team", focus: "Workout alerts are on" });
    } else if (permission === "denied") {
      setMessage("Alerts are blocked in browser settings.");
    }
  };

  return (
    <div className="app-shell player-shell">
      <header className="player-topbar">
        <div>
          <div className="player-brand">SpeedDesk Player</div>
          <div className="player-team">{snapshot?.team?.name || "Team workout"}</div>
        </div>
      </header>

      <main className="player-content">
        {message && <div className="player-message">{message}</div>}

        {status === "setup" && (
          <PlayerEmpty
            title="Coach is setting this up"
            text="This invite will work after the team sync is connected."
          />
        )}

        {status === "error" && (
          <PlayerEmpty
            title="Invite did not load"
            text="Ask your coach for the newest team link."
          />
        )}

        {status === "loading" && (
          <PlayerEmpty
            title="Loading your workout"
            text="Keep this page open for a second."
          />
        )}

        {status === "ready" && (
          <>
            {displayRoutines.length > 1 && (
              <section className="player-day-picker" aria-label="Daily workouts">
                {displayRoutines.map((routine) => {
                  const isSelected = normalizedDayName(routine.day) === normalizedDayName(activeRoutine?.day);
                  const isToday = normalizedDayName(routine.day) === currentDayName();
                  return (
                    <button
                      className={`player-day ${isSelected ? "active" : ""}`}
                      type="button"
                      key={routine.id || routine.day}
                      onClick={() => setSelectedDay(routine.day)}
                    >
                      <strong>{isToday ? "Today" : routine.day.slice(0, 3)}</strong>
                      <span>{routine.focus}</span>
                    </button>
                  );
                })}
              </section>
            )}

            <section className="player-card today-card">
              <div className="player-eyebrow">{selectedIsToday ? "Today" : activeRoutine?.day || "Workout plan"}</div>
              {!activeRoutine ? (
                <PlayerEmpty
                  title="No daily workout yet"
                  text="Ask your coach to sync the daily workout plan."
                />
              ) : (
                <>
                  <div className="today-card-head">
                    <div>
                      <h1>{activeRoutine.focus}</h1>
                      <p>{activeRoutine.intent || "Follow the steps below and check them off as you go."}</p>
                    </div>
                    <div className="time-badge">
                      <strong>{activeRoutine.minutes ?? "--"}</strong>
                      <span>min</span>
                    </div>
                  </div>

                  <div className="player-progress">
                    <div>
                      <strong>{progress.completed ? "Done" : progress.started ? "In progress" : "Ready"}</strong>
                      <span>{checkedCount} of {blocks.length} steps checked</span>
                    </div>
                    <div className="progress-ring" style={{ "--progress": `${progress.completed ? 100 : progressPercent}%` }}>
                      {progress.completed ? "100%" : `${progressPercent}%`}
                    </div>
                  </div>

                  <div className="player-action-row">
                    {!progress.started && (
                      <button className="player-primary" type="button" onClick={startWorkout}>
                        Start Workout
                      </button>
                    )}
                    {progress.started && !progress.completed && (
                      <button className="player-primary" type="button" onClick={completeWorkout}>
                        Mark Done
                      </button>
                    )}
                    {progress.completed && (
                      <button className="player-secondary" type="button" onClick={resetWorkout}>
                        Do Again
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            {activeRoutine && (
              <section className="player-card">
                <div className="player-section-head">
                  <div>
                    <div className="player-eyebrow">Workout steps</div>
                    <h2>Do these in order</h2>
                  </div>
                  <span className="status-pill gold">{activeRoutine.intensity || "Training"}</span>
                </div>

                <div className="player-step-list">
                  {blocks.map((block, index) => (
                    <button
                      className={`player-step ${progress.checked.includes(index) ? "checked" : ""}`}
                      type="button"
                      key={`${block.name}-${index}`}
                      onClick={() => toggleBlock(index)}
                    >
                      <span className="step-number">{progress.checked.includes(index) ? "OK" : index + 1}</span>
                      <span>
                        <strong>{block.name}</strong>
                        <em>{block.dose || "Follow coach notes"}</em>
                        {block.category && <small>{block.category}</small>}
                      </span>
                    </button>
                  ))}
                </div>

                {(activeRoutine.nonNegotiable || activeRoutine.parentMode || activeRoutine.notes) && (
                  <div className="coach-note">
                    <strong>Coach notes</strong>
                    {activeRoutine.nonNegotiable && <span>{activeRoutine.nonNegotiable}</span>}
                    {activeRoutine.parentMode && <span>{activeRoutine.parentMode}</span>}
                    {activeRoutine.notes && <span>{activeRoutine.notes}</span>}
                  </div>
                )}
              </section>
            )}

            <section className="player-card player-setup-card">
              <div>
                <div className="player-eyebrow">Updates</div>
                <h2>Daily plan syncs here</h2>
                <p>Synced {formatSyncTime(snapshot?.syncedAt)}. Leave alerts on so you know when a daily workout changes.</p>
              </div>
              <button className="player-secondary" type="button" onClick={requestNotifications}>
                {notificationPermission === "granted" ? "Alerts On" : notificationPermission === "denied" ? "Alerts Blocked" : "Turn On Alerts"}
              </button>
            </section>

            <section className="player-card">
              <div className="player-section-head">
                <div>
                  <div className="player-eyebrow">Schedule</div>
                  <h2>{todaysSessions.length ? "Team session today" : "Next team sessions"}</h2>
                </div>
              </div>
              <SimpleSchedule sessions={todaysSessions.length ? todaysSessions : upcomingSessions} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function PlayerEmpty({ title, text }) {
  return (
    <div className="player-empty">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function SimpleSchedule({ sessions }) {
  if (!sessions.length) {
    return <div className="player-empty"><strong>No sessions posted</strong><span>Your coach can add one later.</span></div>;
  }

  return (
    <div className="player-schedule">
      {sessions.map((event) => (
        <div className="player-session" key={event.id}>
          <div className="session-date">
            <strong>{formatSessionDate(event.date).split(" ")[0]}</strong>
            <span>{formatSessionDate(event.date).replace(/^[^ ]+ /, "")}</span>
          </div>
          <div>
            <strong>{event.title}</strong>
            <span>{event.time || "Time TBD"} - {event.location || "Location TBD"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
