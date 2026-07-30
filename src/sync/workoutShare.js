const SHARE_VERSION = 2;
const MAX_SHARE_TOKEN_LENGTH = 2000;

function cleanText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAudience(audienceName) {
  const name = cleanText(audienceName);
  return name.toLowerCase() === "all" || !name
    ? { type: "all", name: "" }
    : { type: "group", name };
}

function normalizeBlock(block) {
  return {
    name: cleanText(block?.name, "Training block"),
    category: cleanText(block?.category),
    dose: cleanText(block?.dose),
    cue: cleanText(block?.cue),
  };
}

function normalizeRoutine(routine, index) {
  const blocks = Array.isArray(routine?.blocks)
    ? routine.blocks.slice(0, 30).map(normalizeBlock)
    : [];

  return {
    id: cleanText(routine?.id, `shared-routine-${index + 1}`),
    date: cleanText(routine?.date),
    day: cleanText(routine?.day, `Day ${index + 1}`),
    focus: cleanText(routine?.focus || routine?.sessionType, "Workout"),
    sessionType: cleanText(routine?.sessionType || routine?.focus, "Workout"),
    intent: cleanText(routine?.intent),
    minutes: cleanNumber(routine?.minutes),
    trainingLoad: cleanNumber(routine?.trainingLoad),
    rpe: cleanNumber(routine?.rpe),
    intensity: cleanText(routine?.intensity),
    parentMode: cleanText(routine?.parentMode),
    nonNegotiable: cleanText(routine?.nonNegotiable),
    notes: cleanText(routine?.notes),
    blocks,
  };
}

function normalizeReadiness(value) {
  const readiness = Number(value);
  if (!Number.isFinite(readiness)) return 4;
  return Math.min(5, Math.max(1, Math.round(readiness)));
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createWorkoutSharePayload({
  teamName,
  coachLabel,
  audienceName = "",
  readiness = 4,
  sharedAt = new Date().toISOString(),
}) {
  return {
    version: SHARE_VERSION,
    team: {
      name: cleanText(teamName, "SpeedDesk Team"),
      coachLabel: cleanText(coachLabel, "Coach"),
    },
    assignmentTarget: normalizeAudience(audienceName),
    readiness: normalizeReadiness(readiness),
    syncedAt: cleanText(sharedAt, new Date().toISOString()),
  };
}

export function createWorkoutShareSnapshot({
  teamName,
  coachLabel,
  audienceName = "",
  dailyRoutines = [],
  activeRoutine = null,
  sharedAt = new Date().toISOString(),
}) {
  const sourceRoutines = Array.isArray(dailyRoutines) && dailyRoutines.length
    ? dailyRoutines
    : activeRoutine
      ? [activeRoutine]
      : [];
  const routines = sourceRoutines.slice(0, 14).map(normalizeRoutine);

  return {
    version: SHARE_VERSION,
    shareMode: true,
    team: {
      id: "shared-workout",
      name: cleanText(teamName, "SpeedDesk Team"),
      coachLabel: cleanText(coachLabel, "Coach"),
    },
    assignmentTarget: normalizeAudience(audienceName),
    activeRoutine: routines[0] || null,
    dailyRoutines: routines,
    sessions: [],
    syncedAt: sharedAt,
  };
}

export function encodeWorkoutShare(payload) {
  if (payload?.version !== SHARE_VERSION || !payload?.team?.name) {
    throw new Error("The workout link could not be created.");
  }
  return toBase64Url(JSON.stringify(payload));
}

export function decodeWorkoutShare(token) {
  const value = cleanText(token);
  if (!value || value.length > MAX_SHARE_TOKEN_LENGTH) {
    throw new Error("This workout link is invalid.");
  }

  try {
    const parsed = JSON.parse(fromBase64Url(value));
    if (parsed?.version !== SHARE_VERSION || !parsed?.team?.name) {
      throw new Error("Unsupported workout link.");
    }

    return createWorkoutSharePayload({
      teamName: parsed.team.name,
      coachLabel: parsed.team.coachLabel,
      audienceName: parsed.assignmentTarget?.type === "group"
        ? parsed.assignmentTarget.name
        : "all",
      readiness: parsed.readiness,
      sharedAt: parsed.syncedAt,
    });
  } catch (error) {
    if (error?.message === "Unsupported workout link.") throw error;
    throw new Error("This workout link is damaged. Ask the coach to share it again.");
  }
}

export function buildWorkoutShareUrl(payload, currentHref) {
  const href = currentHref || (typeof window !== "undefined" ? window.location.href : "");
  if (!href) throw new Error("The player link could not be created.");

  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("workout", encodeWorkoutShare(payload));
  return url.toString();
}
