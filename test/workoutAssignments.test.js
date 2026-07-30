import test from "node:test";
import assert from "node:assert/strict";

import {
  assignmentKey,
  mergeWorkoutAssignment,
  selectWorkoutAssignment,
  snapshotForPlayer,
} from "../src/sync/workoutAssignments.js";

const mondayPlan = {
  activeRoutine: { day: "Monday", focus: "Speed", minutes: 20 },
  dailyRoutines: [{ day: "Monday", focus: "Speed", minutes: 20 }],
  syncedAt: "2026-07-30T10:00:00.000Z",
};

test("assignment keys normalize group names", () => {
  assert.equal(assignmentKey({ type: "all" }), "all");
  assert.equal(assignmentKey({ type: "group", name: " Attackers " }), "group:attackers");
});

test("a targeted push preserves the previous team-wide plan", () => {
  const next = {
    ...mondayPlan,
    activeRoutine: { day: "Tuesday", focus: "Finishing", minutes: 25 },
    dailyRoutines: [{ day: "Tuesday", focus: "Finishing", minutes: 25 }],
    assignmentTarget: { type: "group", name: "Attackers" },
    syncedAt: "2026-07-30T11:00:00.000Z",
  };

  const merged = mergeWorkoutAssignment(mondayPlan, next);

  assert.equal(merged.workoutAssignments.length, 2);
  assert.equal(
    selectWorkoutAssignment(merged, ["Attackers"]).activeRoutine.focus,
    "Finishing"
  );
  assert.equal(
    selectWorkoutAssignment(merged, ["Defenders"]).activeRoutine.focus,
    "Speed"
  );
});

test("the newest eligible assignment wins", () => {
  const first = mergeWorkoutAssignment(null, {
    ...mondayPlan,
    assignmentTarget: { type: "all" },
  });
  const second = mergeWorkoutAssignment(first, {
    ...mondayPlan,
    activeRoutine: { day: "Wednesday", focus: "Agility", minutes: 18 },
    dailyRoutines: [{ day: "Wednesday", focus: "Agility", minutes: 18 }],
    assignmentTarget: { type: "group", name: "Attackers" },
    syncedAt: "2026-07-30T12:00:00.000Z",
  });

  assert.equal(
    snapshotForPlayer(second, ["Attackers"]).activeRoutine.focus,
    "Agility"
  );
});

test("players outside every assignment receive an empty workout plan", () => {
  const groupOnly = mergeWorkoutAssignment(null, {
    ...mondayPlan,
    assignmentTarget: { type: "group", name: "Attackers" },
  });
  const playerSnapshot = snapshotForPlayer(groupOnly, ["Defenders"]);

  assert.equal(playerSnapshot.activeRoutine, null);
  assert.deepEqual(playerSnapshot.dailyRoutines, []);
  assert.equal(playerSnapshot.playerAssignment, null);
});

test("legacy snapshots remain visible to every team member", () => {
  const playerSnapshot = snapshotForPlayer(mondayPlan, ["Attackers"]);

  assert.equal(playerSnapshot.activeRoutine.focus, "Speed");
  assert.equal(playerSnapshot.playerAssignment.target.type, "all");
});
