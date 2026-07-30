import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAuthSession,
  loadPlayerPortal,
  loadWorkoutAttempt,
  saveWorkoutAttempt,
  sendSignInLink,
  signInPlayerAnonymously,
  signOut,
  submitJoinRequest,
  subscribeToAuth,
} from "../api/teamAccount";
import { getSupabaseSetupState } from "../api/supabaseConfig";
import { snapshotForPlayer } from "../sync/workoutAssignments";

const POLL_MS = 20000;
const PROGRESS_KEY_PREFIX = "speeddesk:player-progress";
const ATTEMPT_QUEUE_KEY = "speeddesk:attempt-queue";
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

function playerProgressKey(athleteId, routineId) {
  return `${PROGRESS_KEY_PREFIX}:${athleteId || "player"}:${routineId}`;
}

function emptyProgress() {
  return {
    started: false,
    completed: false,
    checked: [],
    startedAt: "",
    completedAt: "",
    effort: null,
    pain: null,
    playerNote: "",
  };
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
  if (typeof window === "undefined") return emptyProgress();
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return emptyProgress();
    const parsed = JSON.parse(saved);
    return {
      ...emptyProgress(),
      ...parsed,
      started: Boolean(parsed.started),
      completed: Boolean(parsed.completed),
      checked: Array.isArray(parsed.checked) ? parsed.checked : [],
    };
  } catch (error) {
    return emptyProgress();
  }
}

function saveProgress(key, progress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(progress));
}

function queuedAttempts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ATTEMPT_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function queueAttempt(payload) {
  const key = `${payload.athleteId}:${payload.workoutKey}:${payload.workoutDate}`;
  const remaining = queuedAttempts().filter((item) => item.queueKey !== key);
  remaining.push({ ...payload, queueKey: key, syncSource: "offline_queue" });
  window.localStorage.setItem(ATTEMPT_QUEUE_KEY, JSON.stringify(remaining.slice(-30)));
}

async function flushAttemptQueue() {
  const queue = queuedAttempts();
  if (!queue.length) return 0;
  const failed = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const { queueKey: _queueKey, ...payload } = item;
      await saveWorkoutAttempt(payload);
      synced += 1;
    } catch (error) {
      failed.push(item);
    }
  }

  window.localStorage.setItem(ATTEMPT_QUEUE_KEY, JSON.stringify(failed));
  return synced;
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
  const [session, setSession] = useState(null);
  const [accessCode, setAccessCode] = useState(String(inviteCode || "").trim().toUpperCase());
  const [email, setEmail] = useState("");
  const [emailMode, setEmailMode] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [accountType, setAccountType] = useState("player");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [team, setTeam] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [groups, setGroups] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(notificationSupport);
  const [progress, setProgress] = useState(emptyProgress);
  const [selectedDay, setSelectedDay] = useState(currentDayName);
  const [syncState, setSyncState] = useState("local");
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishEffort, setFinishEffort] = useState(null);
  const [finishPain, setFinishPain] = useState(0);
  const lastRoutineKey = useRef("");
  const syncTimer = useRef(null);

  const loadContext = useCallback(async ({ notify = false } = {}) => {
    if (!setup.isConfigured) return;

    try {
      const authSession = await getAuthSession();
      setSession(authSession);
      if (!authSession) {
        setStatus("auth");
        setMessage("");
        return;
      }

      const context = await loadPlayerPortal();
      if (!context.athlete) {
        if (context.request?.status === "pending") {
          setStatus("pending");
          setPlayerName(context.request.player_name || "");
          setMessage("Your coach will approve this account soon.");
        } else {
          setStatus("join");
          setPlayerName(context.request?.player_name || context.profile?.display_name || "");
          setMessage(context.request?.status === "rejected" ? "Ask your coach for help or try a new invite." : "");
        }
        return;
      }

      const playerSnapshot = snapshotForPlayer(
        context.snapshot,
        (context.groups || []).map((group) => group.name)
      );
      const nextKey = routineKey(playerSnapshot);
      const previousKey = lastRoutineKey.current;
      setAthlete(context.athlete);
      setTeam(context.team);
      setGroups(context.groups || []);
      setSnapshot(playerSnapshot);
      setStatus("ready");
      setMessage("");

      if (notify && previousKey && nextKey && nextKey !== previousKey) {
        setMessage("Coach updated your workout.");
        showRoutineNotification(routineForDay(playerSnapshot));
      }
      lastRoutineKey.current = nextKey;

      const synced = await flushAttemptQueue();
      if (synced) {
        setSyncState("synced");
        setMessage(`${synced} saved workout update${synced === 1 ? "" : "s"} synced.`);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "SpeedDesk could not load this account.");
    }
  }, [setup.isConfigured]);

  useEffect(() => {
    if (!setup.isConfigured) return undefined;
    let mounted = true;
    let stopAuth = () => {};

    loadContext();
    subscribeToAuth((nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      loadContext();
    }).then((unsubscribe) => {
      stopAuth = unsubscribe;
    });

    const poll = window.setInterval(() => loadContext({ notify: true }), POLL_MS);
    const handleOnline = () => loadContext();
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      stopAuth();
      window.clearInterval(poll);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadContext, setup.isConfigured]);

  const sessions = useMemo(() => {
    const groupNames = new Set(groups.map((group) => group.name));
    return (snapshot?.sessions || []).filter((event) => {
      if (!event.targetType || event.targetType === "squad") return true;
      if (event.targetType === "group") return groupNames.has(event.targetId);
      if (event.targetType === "athlete") return String(event.targetId) === String(athlete?.source_key);
      return false;
    });
  }, [athlete?.source_key, groups, snapshot?.sessions]);
  const dailyRoutines = useMemo(() => routineListFromSnapshot(snapshot), [snapshot]);
  const displayRoutines = useMemo(
    () => [...dailyRoutines].sort((a, b) => dayOffsetFromToday(a.day) - dayOffsetFromToday(b.day)),
    [dailyRoutines]
  );
  const todaysRoutine = useMemo(() => routineForDay(snapshot), [snapshot]);
  const activeRoutine = dailyRoutines.find((routine) => normalizedDayName(routine.day) === normalizedDayName(selectedDay)) || todaysRoutine;
  const selectedIsToday = normalizedDayName(activeRoutine?.day) === currentDayName();
  const routineId = useMemo(() => routineProgressId(activeRoutine), [activeRoutine]);
  const progressKey = useMemo(() => playerProgressKey(athlete?.id, routineId), [athlete?.id, routineId]);
  const todaysSessions = useMemo(() => sessions.filter((event) => event.date === today()), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((event) => event.date >= today()).slice(0, 3), [sessions]);
  const blocks = activeRoutine?.blocks || [];
  const checkedCount = progress.checked.length;
  const progressPercent = blocks.length ? Math.round((checkedCount / blocks.length) * 100) : 0;

  useEffect(() => {
    if (!dailyRoutines.length) return;
    setSelectedDay((current) => {
      if (dailyRoutines.some((routine) => normalizedDayName(routine.day) === normalizedDayName(current))) {
        return normalizedDayName(current) || current;
      }
      return todaysRoutine?.day || dailyRoutines[0].day;
    });
  }, [dailyRoutines, todaysRoutine?.day]);

  useEffect(() => {
    if (!athlete || !activeRoutine) return;
    let cancelled = false;
    const local = loadProgress(progressKey);
    setProgress(local);
    setFinishEffort(local.effort);
    setFinishPain(local.pain ?? 0);

    loadWorkoutAttempt({
      athleteId: athlete.id,
      workoutKey: routineId,
      workoutDate: activeRoutine.date || today(),
    }).then((cloud) => {
      if (cancelled || !cloud) return;
      const cloudProgress = {
        started: true,
        completed: cloud.status === "completed",
        checked: Array.isArray(cloud.checked_steps) ? cloud.checked_steps : [],
        startedAt: cloud.started_at || "",
        completedAt: cloud.completed_at || "",
        effort: cloud.effort,
        pain: cloud.pain,
        playerNote: cloud.player_note || "",
      };
      setProgress(cloudProgress);
      saveProgress(progressKey, cloudProgress);
      setFinishEffort(cloudProgress.effort);
      setFinishPain(cloudProgress.pain ?? 0);
      setSyncState("synced");
    }).catch(() => {
      setSyncState("local");
    });

    return () => {
      cancelled = true;
    };
  }, [activeRoutine, athlete, progressKey, routineId]);

  const attemptPayload = (nextProgress, syncSource = "web") => {
    const startedAt = nextProgress.startedAt || new Date().toISOString();
    const completedAt = nextProgress.completedAt || null;
    const durationSeconds = completedAt
      ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000))
      : null;

    return {
      teamId: athlete.team_id,
      athleteId: athlete.id,
      workoutKey: routineId,
      workoutDate: activeRoutine.date || today(),
      workoutTitle: activeRoutine.focus || "Workout",
      startedAt,
      completedAt,
      completed: nextProgress.completed,
      checked: nextProgress.checked,
      effort: nextProgress.effort,
      pain: nextProgress.pain,
      durationSeconds,
      playerNote: nextProgress.playerNote,
      syncSource,
    };
  };

  const syncProgress = async (nextProgress, immediate = false) => {
    if (!athlete || !activeRoutine || !nextProgress.started) return;
    const payload = attemptPayload(nextProgress);
    setSyncState("syncing");

    const write = async () => {
      try {
        await saveWorkoutAttempt(payload);
        setSyncState("synced");
      } catch (error) {
        queueAttempt(payload);
        setSyncState("queued");
      }
    };

    if (immediate) {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      await write();
      return;
    }

    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(write, 500);
  };

  const updateProgress = (nextProgress, immediate = false) => {
    setProgress(nextProgress);
    saveProgress(progressKey, nextProgress);
    syncProgress(nextProgress, immediate);
  };

  const startWorkout = () => {
    const next = {
      ...progress,
      started: true,
      completed: false,
      startedAt: progress.startedAt || new Date().toISOString(),
      completedAt: "",
    };
    updateProgress(next, true);
    setMessage("Workout started. Tap each step when you finish it.");
  };

  const toggleBlock = (index) => {
    const checked = progress.checked.includes(index)
      ? progress.checked.filter((item) => item !== index)
      : [...progress.checked, index].sort((a, b) => a - b);
    updateProgress({
      ...progress,
      started: true,
      completed: false,
      startedAt: progress.startedAt || new Date().toISOString(),
      completedAt: "",
      checked,
    });
  };

  const completeWorkout = async () => {
    if (!finishEffort) return;
    const next = {
      ...progress,
      started: true,
      completed: true,
      startedAt: progress.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      effort: finishEffort,
      pain: finishPain,
    };
    updateProgress(next, true);
    setFinishOpen(false);
    setMessage(finishPain > 0 ? "Saved. Your coach can see that something hurt." : "Workout saved. Nice work.");
  };

  const resetWorkout = () => {
    const next = emptyProgress();
    setProgress(next);
    saveProgress(progressKey, next);
    setFinishEffort(null);
    setFinishPain(0);
    setFinishOpen(false);
    setSyncState("local");
    setMessage("Ready to do this workout again.");
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

  const emailSignIn = async () => {
    if (!email.trim()) {
      setMessage("Enter the player or parent email.");
      return;
    }
    setAccountBusy(true);
    try {
      await sendSignInLink(email);
      setMessage("Check your email and tap the SpeedDesk sign-in link.");
    } catch (error) {
      setMessage(error.message || "The sign-in email could not be sent.");
    } finally {
      setAccountBusy(false);
    }
  };

  const enterWithPlayerCode = async () => {
    if (!accessCode.trim()) {
      setMessage("Enter the player code from your coach.");
      return;
    }
    if (!playerName.trim()) {
      setMessage("Enter the player name.");
      return;
    }

    setAccountBusy(true);
    setMessage("Opening your team...");
    try {
      const currentSession = await getAuthSession();
      if (!currentSession) await signInPlayerAnonymously();
      await submitJoinRequest({
        inviteCode: accessCode,
        playerName,
        accountType: "player",
      });
      await loadContext();
    } catch (error) {
      setMessage(error.message || "That player code could not be used.");
    } finally {
      setAccountBusy(false);
    }
  };

  const joinTeam = async () => {
    if (!accessCode.trim()) {
      setMessage("Enter the player code from your coach.");
      return;
    }
    if (!playerName.trim()) {
      setMessage("Enter the player name.");
      return;
    }
    if (accountType === "guardian" && !guardianConsent) {
      setMessage("A parent or guardian must approve the account.");
      return;
    }
    setAccountBusy(true);
    try {
      await submitJoinRequest({ inviteCode: accessCode, playerName, accountType });
      await loadContext();
    } catch (error) {
      setMessage(error.message || "This invitation could not be used.");
    } finally {
      setAccountBusy(false);
    }
  };

  const leaveAccount = async () => {
    await signOut();
    setSession(null);
    setAthlete(null);
    setSnapshot(null);
    setStatus("auth");
    setMessage("");
  };

  const syncLabel = syncState === "synced"
    ? "Synced"
    : syncState === "syncing"
      ? "Saving"
      : syncState === "queued"
        ? "Saved offline"
        : "On this device";

  return (
    <div className="app-shell player-shell">
      <header className="player-topbar">
        <div>
          <div className="player-brand">SpeedDesk Player</div>
          <div className="player-team">
            {team?.name || "Join your team"}
            {groups.length ? ` · ${groups.map((group) => group.name).join(", ")}` : ""}
          </div>
        </div>
        {status === "ready" && <span className={`status-pill ${syncState === "queued" ? "gold" : "green"}`}>{syncLabel}</span>}
      </header>

      <main className="player-content">
        {message && <div className="player-message">{message}</div>}

        {status === "setup" && (
          <PlayerEmpty
            title="Coach is setting this up"
            text="This invitation will work after secure Team Sync is connected."
          />
        )}

        {status === "loading" && (
          <PlayerEmpty title="Loading SpeedDesk" text="Getting your team and workout ready." />
        )}

        {status === "auth" && (
          <PlayerAccessCard eyebrow="Player access" title={emailMode ? "Use email instead" : "Enter your player code"}>
            {emailMode ? (
              <>
                <p>Use a player or parent email when you want an account that can move between devices.</p>
                <label className="player-field">
                  <span>Email</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="player-or-parent@email.com"
                    autoComplete="email"
                  />
                </label>
                <button className="player-primary" type="button" onClick={emailSignIn} disabled={accountBusy}>
                  {accountBusy ? "Sending..." : "Email My Sign-In Link"}
                </button>
                <button className="text-button" type="button" onClick={() => setEmailMode(false)}>Use player code</button>
              </>
            ) : (
              <>
                <p>Enter the code from your coach and the player name. No email or password is needed.</p>
                <label className="player-field">
                  <span>Player code</span>
                  <input
                    className="input player-code-input"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                    placeholder="TEAM CODE"
                    autoComplete="one-time-code"
                  />
                </label>
                <label className="player-field">
                  <span>Player name</span>
                  <input
                    className="input"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Player name"
                    autoComplete="name"
                  />
                </label>
                <button className="player-primary" type="button" onClick={enterWithPlayerCode} disabled={accountBusy}>
                  {accountBusy ? "Opening..." : "Enter SpeedDesk"}
                </button>
                <small>This access stays on this device. A parent can help younger players enter the code.</small>
                <button className="text-button" type="button" onClick={() => setEmailMode(true)}>Use email for multiple devices</button>
              </>
            )}
          </PlayerAccessCard>
        )}

        {status === "join" && session && (
          <PlayerAccessCard eyebrow="Almost there" title="Who is training?">
            <label className="player-field">
              <span>Player code</span>
              <input
                className="input player-code-input"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                placeholder="TEAM CODE"
                autoComplete="one-time-code"
              />
            </label>
            <div className="account-choice" role="group" aria-label="Account type">
              <button
                className={accountType === "player" ? "active" : ""}
                type="button"
                onClick={() => setAccountType("player")}
              >
                <strong>Player</strong>
                <span>I use my own email</span>
              </button>
              <button
                className={accountType === "guardian" ? "active" : ""}
                type="button"
                onClick={() => setAccountType("guardian")}
              >
                <strong>Parent / Guardian</strong>
                <span>I manage this player</span>
              </button>
            </div>
            <label className="player-field">
              <span>Player name</span>
              <input
                className="input"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Player name"
                autoComplete="name"
              />
            </label>
            {accountType === "guardian" && (
              <label className="guardian-check">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(event) => setGuardianConsent(event.target.checked)}
                />
                <span>I am this player&apos;s parent or guardian and approve this account.</span>
              </label>
            )}
            <button className="player-primary" type="button" onClick={joinTeam} disabled={accountBusy}>
              {accountBusy ? "Joining..." : "Join Team"}
            </button>
            <button className="text-button" type="button" onClick={leaveAccount}>Use a different email</button>
          </PlayerAccessCard>
        )}

        {status === "pending" && (
          <PlayerAccessCard eyebrow="Request sent" title="Waiting for coach">
            <p>Your workout will appear as soon as the coach approves {playerName || "the player"}.</p>
            <div className="pending-mark" aria-hidden="true">✓</div>
            <button className="player-secondary" type="button" onClick={() => loadContext()}>Check Again</button>
            <button className="text-button" type="button" onClick={leaveAccount}>Sign out this device</button>
          </PlayerAccessCard>
        )}

        {status === "error" && (
          <PlayerAccessCard eyebrow="We hit a problem" title="Could not load">
            <p>{message || "Ask your coach for the newest invitation."}</p>
            <button className="player-primary" type="button" onClick={() => loadContext()}>Try Again</button>
            {session && <button className="text-button" type="button" onClick={leaveAccount}>Sign out this device</button>}
          </PlayerAccessCard>
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
                  title="No workout assigned yet"
                  text={groups.length
                    ? `Your coach has not pushed a plan to ${groups.map((group) => group.name).join(", ")} yet.`
                    : "Your coach can push one from the Sync page."}
                />
              ) : (
                <>
                  <div className="today-card-head">
                    <div>
                      <h1>{activeRoutine.focus}</h1>
                      <p>{activeRoutine.intent || "Start, follow the steps, and finish."}</p>
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
                      <button className="player-primary" type="button" onClick={() => setFinishOpen(true)}>
                        Finish Workout
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

            {activeRoutine && progress.started && (
              <section className="player-card">
                <div className="player-section-head">
                  <div>
                    <div className="player-eyebrow">Workout steps</div>
                    <h2>Tap each one when done</h2>
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
                      disabled={progress.completed}
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
                    <strong>Coach says</strong>
                    {activeRoutine.nonNegotiable && <span>{activeRoutine.nonNegotiable}</span>}
                    {activeRoutine.parentMode && <span>{activeRoutine.parentMode}</span>}
                    {activeRoutine.notes && <span>{activeRoutine.notes}</span>}
                  </div>
                )}
              </section>
            )}

            {finishOpen && (
              <section className="player-card finish-card" aria-live="polite">
                <div className="player-eyebrow">Finish workout</div>
                <h2>How hard was it?</h2>
                <div className="effort-grid">
                  {[
                    { value: 3, emoji: "😄", label: "Easy" },
                    { value: 5, emoji: "🙂", label: "Good" },
                    { value: 8, emoji: "😓", label: "Hard" },
                    { value: 10, emoji: "🔥", label: "Max" },
                  ].map((option) => (
                    <button
                      className={finishEffort === option.value ? "active" : ""}
                      type="button"
                      key={option.value}
                      onClick={() => setFinishEffort(option.value)}
                    >
                      <span>{option.emoji}</span>
                      <strong>{option.label}</strong>
                    </button>
                  ))}
                </div>

                <h2>Did anything hurt?</h2>
                <div className="pain-choice">
                  <button
                    className={finishPain === 0 ? "active safe" : ""}
                    type="button"
                    onClick={() => setFinishPain(0)}
                  >
                    No pain
                  </button>
                  <button
                    className={finishPain > 0 ? "active alert" : ""}
                    type="button"
                    onClick={() => setFinishPain(5)}
                  >
                    Something hurt
                  </button>
                </div>

                <div className="player-action-row">
                  <button className="player-secondary" type="button" onClick={() => setFinishOpen(false)}>Back</button>
                  <button className="player-primary" type="button" onClick={completeWorkout} disabled={!finishEffort}>
                    Save Workout
                  </button>
                </div>
              </section>
            )}

            <section className="player-card player-setup-card">
              <div>
                <div className="player-eyebrow">Updates</div>
                <h2>Your work saves to coach</h2>
                <p>
                  Plan synced {formatSyncTime(snapshot?.syncedAt)}. A watch is optional; Apple, Samsung, and Strava connections can be added without changing this simple flow.
                </p>
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

            <button className="player-signout text-button" type="button" onClick={leaveAccount}>
              Sign out this device
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function PlayerAccessCard({ eyebrow, title, children }) {
  return (
    <section className="player-card access-card">
      <div className="player-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {children}
    </section>
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
