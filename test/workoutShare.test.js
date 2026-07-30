import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkoutShareUrl,
  createWorkoutSharePayload,
  createWorkoutShareSnapshot,
  decodeWorkoutShare,
  encodeWorkoutShare,
} from "../src/sync/workoutShare.js";

const routines = [
  {
    id: "monday-speed",
    date: "2026-08-03",
    day: "Monday",
    focus: "Coach Speed Builder",
    intent: "Build a clean first step.",
    minutes: 35,
    intensity: "High",
    blocks: [
      {
        name: "Two-Foot Wall Passing",
        category: "Ball Mastery",
        dose: "25 each foot",
        cue: "Clean passes on the floor",
      },
      {
        name: "10 Yard Start",
        category: "Acceleration",
        dose: "6 reps, full rest",
        cue: "Win the first three steps",
      },
    ],
  },
];

describe("editable workout sharing", () => {
  it("round-trips the coach-built workout rather than a fixed plan", () => {
    const payload = createWorkoutSharePayload({
      teamName: "Apex Predátor Elite",
      coachLabel: "Coach",
      audienceName: "Attackers",
      readiness: 3,
      dailyRoutines: routines,
      selectedDay: "Monday",
      sharedAt: "2026-07-30T22:00:00.000Z",
    });

    const decoded = decodeWorkoutShare(encodeWorkoutShare(payload));

    assert.equal(decoded.team.name, "Apex Predátor Elite");
    assert.deepEqual(decoded.assignmentTarget, { type: "group", name: "Attackers" });
    assert.equal(decoded.selectedDay, "Monday");
    assert.equal(decoded.dailyRoutines[0].focus, "Coach Speed Builder");
    assert.equal(decoded.dailyRoutines[0].blocks[1].name, "10 Yard Start");
  });

  it("builds the player snapshot from the selected custom day", () => {
    const snapshot = createWorkoutShareSnapshot({
      teamName: "Apex Predator Elite",
      audienceName: "Attackers",
      dailyRoutines: routines,
      selectedDay: "Monday",
    });

    assert.equal(snapshot.shareMode, true);
    assert.equal(snapshot.activeRoutine.focus, "Coach Speed Builder");
    assert.equal(snapshot.dailyRoutines[0].blocks[0].name, "Two-Foot Wall Passing");
    assert.deepEqual(snapshot.sessions, []);
  });

  it("compresses a full editable week into a practical player URL", () => {
    const fullWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      .map((day, index) => ({ ...routines[0], id: `day-${index}`, day, focus: `${day} Athlete Plan` }));
    const payload = createWorkoutSharePayload({
      teamName: "Apex Predator Elite",
      audienceName: "all",
      dailyRoutines: fullWeek,
      selectedDay: "Thursday",
    });

    const linkText = buildWorkoutShareUrl(
      payload,
      "https://speeddesk.vercel.app/?team=OLD&player=1#old"
    );
    const link = new URL(linkText);

    assert.equal(link.origin, "https://speeddesk.vercel.app");
    assert.equal(link.searchParams.has("team"), false);
    assert.equal(link.searchParams.has("player"), false);
    assert.ok(link.searchParams.get("workout")?.startsWith("v3."));
    assert.equal(link.hash, "");
    assert.ok(linkText.length < 3000);
    assert.equal(decodeWorkoutShare(link.searchParams.get("workout")).dailyRoutines.length, 7);
  });

  it("keeps already-published version 2 links readable", () => {
    const legacy = {
      version: 2,
      team: { name: "Legacy Team", coachLabel: "Coach" },
      assignmentTarget: { type: "all", name: "" },
      readiness: 4,
      syncedAt: "2026-07-30T22:00:00.000Z",
    };
    const legacyToken = Buffer.from(JSON.stringify(legacy), "utf8").toString("base64url");
    const decoded = decodeWorkoutShare(legacyToken);

    assert.equal(decoded.version, 2);
    assert.equal(decoded.team.name, "Legacy Team");
    assert.deepEqual(decoded.dailyRoutines, []);
  });

  it("rejects damaged workout links with a clear message", () => {
    assert.throws(
      () => decodeWorkoutShare("not-a-workout"),
      /damaged|invalid/i
    );
  });

  it("requires at least one assigned workout before sharing", () => {
    const payload = createWorkoutSharePayload({
      teamName: "Apex Predator Elite",
      dailyRoutines: [],
    });

    assert.throws(
      () => encodeWorkoutShare(payload),
      /choose or build a workout/i
    );
  });
});
