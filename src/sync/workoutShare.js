import LZString from "lz-string";

const SHARE_VERSION = 3;
const LEGACY_SHARE_VERSION = 2;
const MAX_SHARE_TOKEN_LENGTH = 12000;
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

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
  dailyRoutines = [],
  selectedDay = "",
  sharedAt = new Date().toISOString(),
}) {
  const routines = (Array.isArray(dailyRoutines) ? dailyRoutines : [])
    .slice(0, 7)
    .map(normalizeRoutine);

  return {
    version: SHARE_VERSION,
    team: {
      name: cleanText(teamName, "SpeedDesk Team"),
      coachLabel: cleanText(coachLabel, "Coach"),
    },
    assignmentTarget: normalizeAudience(audienceName),
    readiness: normalizeReadiness(readiness),
    selectedDay: cleanText(selectedDay, routines[0]?.day),
    dailyRoutines: routines,
    syncedAt: cleanText(sharedAt, new Date().toISOString()),
  };
}

export function createWorkoutShareSnapshot({
  teamName,
  coachLabel,
  audienceName = "",
  dailyRoutines = [],
  activeRoutine = null,
  selectedDay = "",
  sharedAt = new Date().toISOString(),
}) {
  const sourceRoutines = Array.isArray(dailyRoutines) && dailyRoutines.length
    ? dailyRoutines
    : activeRoutine
      ? [activeRoutine]
      : [];
  const routines = sourceRoutines.slice(0, 7).map(normalizeRoutine);
  const chosenDay = cleanText(selectedDay, activeRoutine?.day || routines[0]?.day);
  const chosenRoutine = routines.find((routine) => routine.day === chosenDay) || routines[0] || null;

  return {
    version: SHARE_VERSION,
    shareMode: true,
    team: {
      id: "shared-workout",
      name: cleanText(teamName, "SpeedDesk Team"),
      coachLabel: cleanText(coachLabel, "Coach"),
    },
    assignmentTarget: normalizeAudience(audienceName),
    selectedDay: chosenDay,
    activeRoutine: chosenRoutine,
    dailyRoutines: routines,
    sessions: [],
    syncedAt: sharedAt,
  };
}

export function encodeWorkoutShare(payload) {
  if (payload?.version !== SHARE_VERSION || !payload?.team?.name || !payload?.dailyRoutines?.length) {
    throw new Error("Choose or build a workout before sharing.");
  }
  const compressed = compressToEncodedURIComponent(JSON.stringify(payload));
  if (!compressed) throw new Error("The workout link could not be created.");
  return `v${SHARE_VERSION}.${compressed}`;
}

export function decodeWorkoutShare(token) {
  const value = cleanText(token);
  if (!value || value.length > MAX_SHARE_TOKEN_LENGTH) {
    throw new Error("This workout link is invalid.");
  }

  try {
    if (value.startsWith(`v${SHARE_VERSION}.`)) {
      const json = decompressFromEncodedURIComponent(value.slice(3));
      const parsed = JSON.parse(json);
      if (parsed?.version !== SHARE_VERSION || !parsed?.team?.name || !parsed?.dailyRoutines?.length) {
        throw new Error("Unsupported workout link.");
      }
      return createWorkoutSharePayload({
        teamName: parsed.team.name,
        coachLabel: parsed.team.coachLabel,
        audienceName: parsed.assignmentTarget?.type === "group"
          ? parsed.assignmentTarget.name
          : "all",
        readiness: parsed.readiness,
        dailyRoutines: parsed.dailyRoutines,
        selectedDay: parsed.selectedDay,
        sharedAt: parsed.syncedAt,
      });
    }

    const legacy = JSON.parse(fromBase64Url(value));
    if (legacy?.version !== LEGACY_SHARE_VERSION || !legacy?.team?.name) {
      throw new Error("Unsupported workout link.");
    }
    return {
      version: LEGACY_SHARE_VERSION,
      team: {
        name: cleanText(legacy.team.name, "SpeedDesk Team"),
        coachLabel: cleanText(legacy.team.coachLabel, "Coach"),
      },
      assignmentTarget: normalizeAudience(
        legacy.assignmentTarget?.type === "group" ? legacy.assignmentTarget.name : "all"
      ),
      readiness: normalizeReadiness(legacy.readiness),
      selectedDay: "",
      dailyRoutines: [],
      syncedAt: cleanText(legacy.syncedAt, new Date().toISOString()),
    };
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
