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
  selectedDay = "",
  readiness = 4,
  onFlash,
}) {
  const [settings, setSettings] = useState(loadShareSettings);
  const [audience, setAudience] = useState("all");
  const [shareScope, setShareScope] = useState("day");
  const [shareState, setShareState] = useState({ status: "idle", link: "", message: "" });
  const groups = useMemo(() => groupNamesFromRoster(athletes), [athletes]);
  const audienceLabel = audience === "all" ? "All players" : audience;
  const routines = shareScope === "week"
    ? dailyRoutines
    : activeRoutine
      ? [activeRoutine]
      : [];
  const scopeLabel = shareScope === "week" ? "Full week" : activeRoutine?.day || "Selected day";

  useEffect(() => {
    window.localStorage.setItem(SHARE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const makePlayerLink = () => {
    const payload = createWorkoutSharePayload({
      teamName: settings.teamName,
      coachLabel: settings.coachLabel,
      audienceName: audience,
      readiness,
      dailyRoutines: routines,
      selectedDay,
    });
    return buildWorkoutShareUrl(payload);
  };

  const saveShareResult = (link, message) => {
    setShareState({ status: "ready", link, message });
    onFlash?.("Workout ready to send");
  };

  const copyLink = async () => {
    try {
      const link = makePlayerLink();
      await navigator.clipboard.writeText(link);
      saveShareResult(link, `${scopeLabel} link copied for ${audienceLabel}.`);
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
          text: `${audienceLabel}: open your ${scopeLabel.toLowerCase()} workout. No sign-in or code needed.`,
          url: link,
        });
        saveShareResult(link, `${scopeLabel} shared with ${audienceLabel}.`);
        return;
      }
      await navigator.clipboard.writeText(link);
      saveShareResult(link, `${scopeLabel} link copied for ${audienceLabel}.`);
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
      const link = makePlayerLink();
      saveShareResult(link, `${scopeLabel} player preview opened.`);
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
    <section className="panel planner-share-panel">
      <div className="panel-title">Assign & Share</div>
      <div className="panel-sub">Choose the players and send the workout from this page</div>

      <div className="share-choice-grid">
        <label className="field">
          <span>Send to</span>
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
        </label>

        <div className="field">
          <span>Send</span>
          <div className="scope-switcher" role="group" aria-label="Workout share range">
            <button
              className={shareScope === "day" ? "active" : ""}
              type="button"
              aria-pressed={shareScope === "day"}
              onClick={() => {
                setShareScope("day");
                setShareState({ status: "idle", link: "", message: "" });
              }}
            >
              {activeRoutine?.day || "Day"}
            </button>
            <button
              className={shareScope === "week" ? "active" : ""}
              type="button"
              aria-pressed={shareScope === "week"}
              onClick={() => {
                setShareScope("week");
                setShareState({ status: "idle", link: "", message: "" });
              }}
            >
              Full week
            </button>
          </div>
        </div>
      </div>

      <div className="share-summary">
        <strong>{scopeLabel}</strong>
        <span>{routines.length} workout{routines.length === 1 ? "" : "s"} · {audienceLabel}</span>
      </div>

      <div className="player-access-actions">
        <button className="save-btn" type="button" onClick={shareLink} disabled={!routines.length}>
          Share {scopeLabel}
        </button>
        <button className="ghost-btn gold" type="button" onClick={copyLink} disabled={!routines.length}>
          Copy Link
        </button>
        <button className="ghost-btn" type="button" onClick={previewLink} disabled={!routines.length}>
          Player Preview
        </button>
      </div>

      <details className="share-settings">
        <summary>Team name settings</summary>
        <div className="form-grid">
          <label className="field">
            <span>Team name</span>
            <input
              className="input"
              value={settings.teamName}
              onChange={(event) => setSettings((current) => ({ ...current, teamName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Coach label</span>
            <input
              className="input"
              value={settings.coachLabel}
              onChange={(event) => setSettings((current) => ({ ...current, coachLabel: event.target.value }))}
            />
          </label>
        </div>
      </details>

      {shareState.message ? (
        <div className={`callout simple-share-result ${shareState.status === "error" ? "error" : ""}`}>
          <strong>{shareState.status === "error" ? "Could not share" : "Ready to send"}</strong>
          <span>{shareState.message}</span>
          {shareState.status === "ready" ? (
            <small>Players tap the link and start. No account, email, or code.</small>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
