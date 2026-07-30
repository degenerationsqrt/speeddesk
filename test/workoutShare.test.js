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
    focus: "Speed + Touch",
    minutes: 35,
    blocks: [{ name: "Two-Foot Wall Passing", category: "Ball Mastery" }],
  },
];

describe("simple workout sharing", () => {
  it("round-trips the small player-link settings", () => {
    const payload = createWorkoutSharePayload({
      teamName: "Apex Predátor Elite",
      coachLabel: "Coach",
      audienceName: "Attackers",
      readiness: 3,
      sharedAt: "2026-07-30T22:00:00.000Z",
    });

    const decoded = decodeWorkoutShare(encodeWorkoutShare(payload));

    assert.equal(decoded.team.name, "Apex Predátor Elite");
    assert.deepEqual(decoded.assignmentTarget, { type: "group", name: "Attackers" });
    assert.equal(decoded.readiness, 3);
    assert.equal("inviteCode" in decoded, false);
    assert.equal("dailyRoutines" in decoded, false);
  });

  it("builds the full player view locally without a database", () => {
    const snapshot = createWorkoutShareSnapshot({
      teamName: "Apex Predator Elite",
      audienceName: "Attackers",
      dailyRoutines: routines,
    });

    assert.equal(snapshot.shareMode, true);
    assert.equal(snapshot.dailyRoutines[0].blocks[0].name, "Two-Foot Wall Passing");
    assert.deepEqual(snapshot.sessions, []);
  });

  it("creates a short player URL and removes old sign-in parameters", () => {
    const payload = createWorkoutSharePayload({
      teamName: "Apex Predator Elite",
      audienceName: "all",
    });

    const linkText = buildWorkoutShareUrl(
      payload,
      "https://speeddesk.vercel.app/?team=OLD&player=1#old"
    );
    const link = new URL(linkText);

    assert.equal(link.origin, "https://speeddesk.vercel.app");
    assert.equal(link.searchParams.has("team"), false);
    assert.equal(link.searchParams.has("player"), false);
    assert.ok(link.searchParams.get("workout"));
    assert.equal(link.hash, "");
    assert.ok(linkText.length < 500);
  });

  it("rejects damaged workout links with a clear message", () => {
    assert.throws(
      () => decodeWorkoutShare("not-a-workout"),
      /damaged|invalid/i
    );
  });

  it("rejects a payload that is not a supported workout link", () => {
    assert.throws(
      () => encodeWorkoutShare({ team: { name: "Apex" } }),
      /could not be created/i
    );
  });
});
