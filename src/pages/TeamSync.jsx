import { useEffect, useMemo, useState } from "react";
import {
  buildWorkoutShareUrl,
  createWorkoutSharePayload,
} from "../sync/workoutShare";

const SHARE_SETTINGS_KEY = "speeddesk:workout-share-settings";

function loadShareSettings() {
  const fallback = {
    teamName: "Apex Predator Elite",
    coachLabel: "Coach",
  };

  try {
    const saved = JSON.parse(window.localStorage.getItem(SHARE_SETTINGS_KEY) || "null");
    return saved && typeof saved === "object" ? { ...fallback, ...saved } : fallback;
  } catch (_error) {
    return fallback;
  }
}

function groupNamesFromRoster(athletes) {
  return Array.from(new Set(
    athletes
      .filter((athlete) => athlete.status !== "Inactive")
      .map((athlete) => String(athlete.group || "").trim())
      .filter(Boolean)
  )).sort();
}

export default function TeamSync({
  athletes,
  activeRoutine,
  dailyRoutines = [],
  readiness = 4,
  onFlash,
}) {
  const [settings, setSettings] = useState(loadShareSettings);
  const [audience, setAudience] = useState("all");
  const [shareState, setShareState] = useState({ status: "idle", link: "", message: "" });
  const groups = useMemo(() => groupNamesFromRoster(athletes), [athletes]);
  const routines = dailyRoutines.length ? dailyRoutines : activeRoutine ? [activeRoutine] : [];
  const audienceLabel = audience === "all" ? "All players" : audience;

  useEffect(() => {
    window.localStorage.setItem(SHARE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const makePlayerLink = () => {
    const payload = createWorkoutSharePayload({
      teamName: settings.teamName,
      coachLabel: settings.coachLabel,
      audienceName: audience,
      readiness,
    });
    return buildWorkoutShareUrl(payload);
  };

  const copyLink = async () => {
    try {
      const link = makePlayerLink();
      await navigator.clipboard.writeText(link);
      setShareState({
        status: "ready",
        link,
        message: `Workout link copied for ${audienceLabel}.`,
      });
      onFlash?.("Workout link copied");
    } catch (error) {
      setShareState({
        status: "error",
        link: "",
        message: error.message || "The workout link could not be copied.",
      });
    }
  };

  const shareLink = async () => {
    try {
      const link = makePlayerLink();
      if (navigator.share) {
        await navigator.share({
          title: `${settings.teamName} workout`,
          text: `${audienceLabel}: open your SpeedDesk workout. No sign-in or code needed.`,
          url: link,
        });
        setShareState({
          status: "ready",
          link,
          message: `Workout shared with ${audienceLabel}.`,
        });
        onFlash?.("Workout shared");
        return;
      }

      await navigator.clipboard.writeText(link);
      setShareState({
        status: "ready",
        link,
        message: `Workout link copied for ${audienceLabel}.`,
      });
      onFlash?.("Workout link copied");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setShareState({
        status: "error",
        link: "",
        message: error.message || "The workout could not be shared.",
      });
    }
  };

  const previewLink = () => {
    try {
      const link = shareState.link || makePlayerLink();
      setShareState({
        status: "ready",
        link,
        message: `Player preview ready for ${audienceLabel}.`,
      });
      window.open(link, "_blank", "noopener,noreferrer");
    } catch (error) {
      setShareState({
        status: "error",
        link: "",
        message: error.message || "The player preview could not be opened.",
      });
    }
  };

  return (
    <Panel
      title="Share Workout with Players"
      sub="One link opens the workout immediately—no code, email, account, approval, or database sync"
    >
      <div className="sync-note simple-share-note">
        <strong>Simple player flow:</strong> choose the group, tap Share Workout, and send the link. Players see this seven-day plan immediately.
      </div>

      <div className="workflow-step">
        <div className="workflow-step-head">
          <span>1</span>
          <div>
            <strong>Choose who the link is for</strong>
            <small>The group name is only a label on the player screen.</small>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Send workout to">
            <select
              className="select"
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value);
                setShareState({ status: "idle", link: "", message: "" });
              }}
            >
              <option value="all">All players</option>
              {groups.map((group) => <option value={group} key={group}>{group}</option>)}
            </select>
          </Field>
          <Field label="Team name">
            <input
              className="input"
              value={settings.teamName}
              onChange={(event) => setSettings((current) => ({ ...current, teamName: event.target.value }))}
            />
          </Field>
          <Field label="Coach label">
            <input
              className="input"
              value={settings.coachLabel}
              onChange={(event) => setSettings((current) => ({ ...current, coachLabel: event.target.value }))}
            />
          </Field>
        </div>
      </div>

      <div className="workflow-step">
        <div className="workflow-step-head">
          <span>2</span>
          <div>
            <strong>Review and share the workout</strong>
            <small>{routines.length} workout days ready for {audienceLabel}.</small>
          </div>
        </div>

        <div className="assignment-preview">
          {routines.map((routine) => (
            <div className="assignment-day" key={routine.id || `${routine.day}-${routine.focus}`}>
              <strong>{routine.day}</strong>
              <span>{routine.focus}</span>
              <small>{routine.minutes ?? "--"} min</small>
            </div>
          ))}
          {!routines.length && <Empty text="Choose or build a workout plan before sharing." />}
        </div>

        <div className="player-access-actions">
          <button
            className="save-btn"
            type="button"
            onClick={shareLink}
            disabled={!routines.length}
          >
            Share Workout with {audienceLabel}
          </button>
          <button
            className="ghost-btn gold"
            type="button"
            onClick={copyLink}
            disabled={!routines.length}
          >
            Copy Workout Link
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={previewLink}
            disabled={!routines.length}
          >
            Open Player Preview
          </button>
        </div>
      </div>

      {shareState.message && (
        <div className={`callout simple-share-result ${shareState.status === "error" ? "error" : ""}`}>
          <strong>{shareState.status === "error" ? "Could not share" : "Ready to send"}</strong>
          <span>{shareState.message}</span>
          {shareState.status === "ready" && <small>The player taps the link and the workout opens. Nothing else to enter.</small>}
        </div>
      )}
    </Panel>
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

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
