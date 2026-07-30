function normalizedGroupNames(groupNames = []) {
  return new Set(
    groupNames
      .map((name) => String(name || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

export function normalizeAssignmentTarget(target = {}) {
  const name = String(target.name || "").trim();
  if (target.type === "group" && name) {
    return { type: "group", name };
  }
  return { type: "all", name: "" };
}

export function assignmentKey(target = {}) {
  const normalized = normalizeAssignmentTarget(target);
  return normalized.type === "group"
    ? `group:${normalized.name.toLowerCase()}`
    : "all";
}

function assignmentFromSnapshot(snapshot, target, assignedAt) {
  const normalizedTarget = normalizeAssignmentTarget(target);
  return {
    key: assignmentKey(normalizedTarget),
    target: normalizedTarget,
    activeRoutine: snapshot.activeRoutine || null,
    dailyRoutines: Array.isArray(snapshot.dailyRoutines) ? snapshot.dailyRoutines : [],
    assignedAt: assignedAt || snapshot.syncedAt || new Date().toISOString(),
  };
}

export function mergeWorkoutAssignment(existingPayload, nextSnapshot) {
  const priorAssignments = Array.isArray(existingPayload?.workoutAssignments)
    ? existingPayload.workoutAssignments
    : [];
  const assignments = new Map(
    priorAssignments
      .filter((assignment) => assignment?.key)
      .map((assignment) => [assignment.key, assignment])
  );

  if (
    !priorAssignments.length
    && existingPayload
    && (
      existingPayload.activeRoutine
      || (Array.isArray(existingPayload.dailyRoutines) && existingPayload.dailyRoutines.length)
    )
  ) {
    const legacy = assignmentFromSnapshot(
      existingPayload,
      { type: "all" },
      existingPayload.syncedAt
    );
    assignments.set(legacy.key, legacy);
  }

  const nextAssignment = assignmentFromSnapshot(
    nextSnapshot,
    nextSnapshot.assignmentTarget,
    nextSnapshot.syncedAt
  );
  assignments.set(nextAssignment.key, nextAssignment);

  return {
    ...existingPayload,
    ...nextSnapshot,
    assignmentTarget: nextAssignment.target,
    workoutAssignments: Array.from(assignments.values()),
    version: 4,
  };
}

export function selectWorkoutAssignment(snapshot, groupNames = []) {
  const assignments = Array.isArray(snapshot?.workoutAssignments)
    ? snapshot.workoutAssignments
    : null;

  if (!assignments) {
    if (
      snapshot?.activeRoutine
      || (Array.isArray(snapshot?.dailyRoutines) && snapshot.dailyRoutines.length)
    ) {
      return assignmentFromSnapshot(snapshot, { type: "all" }, snapshot.syncedAt);
    }
    return null;
  }

  const normalizedGroups = normalizedGroupNames(groupNames);
  const eligible = assignments.filter((assignment) => {
    const target = normalizeAssignmentTarget(assignment?.target);
    return target.type === "all" || normalizedGroups.has(target.name.toLowerCase());
  });

  return eligible.sort((a, b) => {
    const aTime = new Date(a.assignedAt || 0).getTime();
    const bTime = new Date(b.assignedAt || 0).getTime();
    return bTime - aTime;
  })[0] || null;
}

export function snapshotForPlayer(snapshot, groupNames = []) {
  if (!snapshot) return null;
  const assignment = selectWorkoutAssignment(snapshot, groupNames);

  return {
    ...snapshot,
    activeRoutine: assignment?.activeRoutine || null,
    dailyRoutines: assignment?.dailyRoutines || [],
    syncedAt: assignment?.assignedAt || snapshot.syncedAt,
    playerAssignment: assignment
      ? {
          key: assignment.key,
          target: normalizeAssignmentTarget(assignment.target),
          assignedAt: assignment.assignedAt,
        }
      : null,
  };
}
