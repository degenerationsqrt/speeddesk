import { useMemo, useState } from "react";
import TeamSync from "./TeamSync";

const INTENSITY_RPE = {
  Rest: 0,
  Low: 3,
  Medium: 6,
  High: 8,
};

function planFromProgram(program, day, drillById) {
  const intensity = program.intensity || "Medium";
  const minutes = Number(program.duration) || Math.max(20, (program.drills || []).length * 6);
  const rpe = INTENSITY_RPE[intensity] ?? 6;
  const firstDrill = drillById[program.drills?.[0]];

  return {
    day,
    focus: program.name,
    sessionType: program.name,
    intent: program.notes || `Build ${String(program.focus || "athletic quality").toLowerCase()} with clean, focused work.`,
    minutes,
    rpe,
    trainingLoad: minutes * rpe,
    intensity,
    parentMode: program.parentMode || "Coach",
    nonNegotiable: firstDrill?.cues?.[0] || "Quality work over tired volume",
    notes: program.notes || "",
    meters: 0,
    contacts: 0,
    programId: program.id,
    blocks: (program.drills || []).map((drillId) => ({ drillId })),
  };
}

function restPlan(day) {
  return {
    day,
    focus: "Rest/Recovery",
    sessionType: "Rest/Recovery",
    intent: "Protect the body and mind with no extra high-intensity training.",
    minutes: 0,
    rpe: 0,
    trainingLoad: 0,
    intensity: "Rest",
    parentMode: "Coach",
    nonNegotiable: "Recover fully",
    notes: "Walk, stretch, hydrate, and sleep.",
    meters: 0,
    contacts: 0,
    blocks: [{ name: "Rest/Recovery", category: "Recovery", dose: "Full day", cue: "Come back fresh" }],
  };
}

function blankCustomDraft(day) {
  return {
    day,
    name: `${day} Custom Workout`,
    focus: "Ball Mastery",
    duration: 30,
    intensity: "Medium",
    notes: "Clean quality reps with clear coaching cues.",
    blocks: [],
  };
}

function customPlanFromDraft(draft, drillById) {
  const minutes = Math.max(0, Number(draft.duration) || 0);
  const rpe = INTENSITY_RPE[draft.intensity] ?? 6;
  const blocks = draft.blocks.map((block) => {
    const drill = drillById[block.drillId];
    return {
      name: drill?.name || "Training block",
      category: drill?.category || draft.focus,
      dose: block.dose || drill?.dose || "",
      cue: block.cue || drill?.cues?.[0] || "",
    };
  });

  return {
    day: draft.day,
    focus: draft.name.trim() || `${draft.day} Workout`,
    sessionType: draft.name.trim() || "Custom Workout",
    intent: draft.notes.trim() || `Build ${draft.focus.toLowerCase()} with purposeful work.`,
    minutes,
    rpe,
    trainingLoad: minutes * rpe,
    intensity: draft.intensity,
    parentMode: "Coach",
    nonNegotiable: blocks[0]?.cue || "Quality work over tired volume",
    notes: draft.notes.trim(),
    meters: 0,
    contacts: 0,
    programId: "",
    blocks,
  };
}

export default function CoachPlanner({
  athletes,
  programs,
  drills,
  weekPlan,
  setWeekPlan,
  selectedDay,
  setSelectedDay,
  activeRoutine,
  dailyRoutines,
  readiness,
  setReadiness,
  onFlash,
}) {
  const [editor, setEditor] = useState("closed");
  const [presetQuery, setPresetQuery] = useState("");
  const [focusFilter, setFocusFilter] = useState("All");
  const [copySource, setCopySource] = useState("");
  const [draft, setDraft] = useState(() => blankCustomDraft(selectedDay));
  const drillById = useMemo(
    () => Object.fromEntries(drills.map((drill) => [drill.id, drill])),
    [drills]
  );
  const selectedPlan = weekPlan.find((item) => item.day === selectedDay) || weekPlan[0];
  const presetFocuses = useMemo(
    () => ["All", ...Array.from(new Set(programs.map((program) => program.focus).filter(Boolean))).sort()],
    [programs]
  );
  const filteredPrograms = useMemo(() => {
    const query = presetQuery.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesFocus = focusFilter === "All" || program.focus === focusFilter;
      const matchesQuery = !query
        || program.name.toLowerCase().includes(query)
        || String(program.notes || "").toLowerCase().includes(query);
      return matchesFocus && matchesQuery;
    });
  }, [focusFilter, presetQuery, programs]);

  const replaceDay = (nextPlan, message) => {
    setWeekPlan((current) => current.map((item) => (
      item.day === selectedDay ? { ...nextPlan, day: selectedDay } : item
    )));
    setEditor("closed");
    onFlash(message);
  };

  const choosePreset = (program) => {
    replaceDay(planFromProgram(program, selectedDay, drillById), `${program.name} assigned to ${selectedDay}`);
  };

  const openCustomBuilder = () => {
    setDraft(blankCustomDraft(selectedDay));
    setEditor("custom");
  };

  const addCustomDrill = () => {
    const drill = drills[0];
    if (!drill) return;
    setDraft((current) => ({
      ...current,
      blocks: [
        ...current.blocks,
        { drillId: drill.id, dose: drill.dose || "", cue: drill.cues?.[0] || "" },
      ],
    }));
  };

  const updateBlock = (index, patch) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block, blockIndex) => (
        blockIndex === index ? { ...block, ...patch } : block
      )),
    }));
  };

  const chooseBlockDrill = (index, drillId) => {
    const drill = drillById[drillId];
    updateBlock(index, {
      drillId,
      dose: drill?.dose || "",
      cue: drill?.cues?.[0] || "",
    });
  };

  const moveBlock = (index, direction) => {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, blocks };
    });
  };

  const removeBlock = (index) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index),
    }));
  };

  const saveCustomWorkout = () => {
    if (!draft.blocks.length) {
      onFlash("Add at least one drill");
      return;
    }
    replaceDay(customPlanFromDraft({ ...draft, day: selectedDay }, drillById), `Custom workout saved to ${selectedDay}`);
  };

  const copyWorkout = () => {
    const source = weekPlan.find((item) => item.day === copySource);
    if (!source || source.day === selectedDay) return;
    replaceDay({ ...source, day: selectedDay }, `${source.focus} copied to ${selectedDay}`);
  };

  const selectDay = (day) => {
    setSelectedDay(day);
    setEditor("closed");
    setCopySource("");
  };

  return (
    <div className="planner-shell">
      <section className="panel planner-hero">
        <div className="planner-title-row">
          <div>
            <div className="planner-kicker">Coach plan</div>
            <h1>Build the week. Send it once.</h1>
            <p>Tap a day, choose a proven workout or build your own, then share it with the team.</p>
          </div>
          <div className="planner-readiness">
            <span>Team readiness</span>
            <strong>{readiness}/5</strong>
            <input
              aria-label="Team readiness"
              type="range"
              min="1"
              max="5"
              value={readiness}
              onChange={(event) => setReadiness(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="week-board" aria-label="Weekly workout plan">
          {dailyRoutines.map((routine) => (
            <button
              className={`week-day-card ${routine.day === selectedDay ? "active" : ""}`}
              type="button"
              key={routine.day}
              onClick={() => selectDay(routine.day)}
            >
              <span>{routine.day.slice(0, 3)}</span>
              <strong>{routine.focus}</strong>
              <small>{routine.minutes || 0} min · {routine.intensity || "Session"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel selected-workout-panel">
        <div className="selected-workout-head">
          <div>
            <div className="planner-kicker">{selectedDay}</div>
            <h2>{activeRoutine?.focus || selectedPlan?.focus || "Add a workout"}</h2>
            <p>{activeRoutine?.intent || selectedPlan?.intent}</p>
          </div>
          <div className="workout-duration-badge">
            <strong>{activeRoutine?.minutes || 0}</strong>
            <span>min</span>
          </div>
        </div>

        <div className="planner-actions">
          <button className={editor === "presets" ? "active" : ""} type="button" onClick={() => setEditor("presets")}>
            Choose Preset
          </button>
          <button className={editor === "custom" ? "active" : ""} type="button" onClick={openCustomBuilder}>
            Build Custom
          </button>
          <button type="button" onClick={() => replaceDay(restPlan(selectedDay), `${selectedDay} set as recovery`)}>
            Rest Day
          </button>
        </div>

        <div className="selected-blocks">
          {(activeRoutine?.blocks || []).map((block, index) => (
            <div className="selected-block" key={`${block.name}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{block.name}</strong>
                <small>{block.dose}</small>
              </div>
              <em>{block.category}</em>
            </div>
          ))}
        </div>

        <div className="copy-day-row">
          <label>
            <span>Copy another day here</span>
            <select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
              <option value="">Choose day</option>
              {weekPlan.filter((item) => item.day !== selectedDay).map((item) => (
                <option value={item.day} key={item.day}>{item.day} · {item.focus}</option>
              ))}
            </select>
          </label>
          <button className="ghost-btn" type="button" onClick={copyWorkout} disabled={!copySource}>
            Copy to {selectedDay}
          </button>
        </div>
      </section>

      {editor === "presets" ? (
        <section className="panel workout-picker">
          <div className="picker-heading">
            <div>
              <div className="planner-kicker">Workout library</div>
              <h2>Choose a proven workout</h2>
            </div>
            <button className="text-button" type="button" onClick={() => setEditor("closed")}>Close</button>
          </div>
          <div className="picker-filters">
            <input
              className="input"
              value={presetQuery}
              onChange={(event) => setPresetQuery(event.target.value)}
              placeholder="Search workouts"
            />
            <select className="select" value={focusFilter} onChange={(event) => setFocusFilter(event.target.value)}>
              {presetFocuses.map((focus) => <option key={focus}>{focus}</option>)}
            </select>
          </div>
          <div className="preset-grid">
            {filteredPrograms.map((program) => (
              <article className="preset-card" key={program.id}>
                <div className="preset-card-head">
                  <span>{program.focus}</span>
                  <strong>{program.duration || Math.max(20, (program.drills || []).length * 6)} min</strong>
                </div>
                <h3>{program.name}</h3>
                <p>{program.notes}</p>
                <small>{program.drills?.length || 0} drills · {program.intensity || "Medium"}</small>
                <button type="button" onClick={() => choosePreset(program)}>Use on {selectedDay}</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editor === "custom" ? (
        <section className="panel custom-workout-builder">
          <div className="picker-heading">
            <div>
              <div className="planner-kicker">{selectedDay}</div>
              <h2>Build a custom workout</h2>
            </div>
            <button className="text-button" type="button" onClick={() => setEditor("closed")}>Close</button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Workout name</span>
              <input className="input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="field">
              <span>Goal</span>
              <select className="select" value={draft.focus} onChange={(event) => setDraft((current) => ({ ...current, focus: event.target.value }))}>
                {["Acceleration", "Max Velocity", "Agility", "Deceleration", "Plyometrics", "Ball Mastery", "Recovery"].map((focus) => (
                  <option key={focus}>{focus}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Duration</span>
              <select className="select" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: Number(event.target.value) }))}>
                {[10, 15, 20, 30, 45, 60, 75, 90].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
            <label className="field">
              <span>Intensity</span>
              <select className="select" value={draft.intensity} onChange={(event) => setDraft((current) => ({ ...current, intensity: event.target.value }))}>
                {["Low", "Medium", "High"].map((intensity) => <option key={intensity}>{intensity}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Coach objective</span>
            <textarea className="text-area" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          <div className="custom-block-list">
            {draft.blocks.map((block, index) => (
              <div className="custom-block-row" key={`${block.drillId}-${index}`}>
                <div className="custom-block-number">{index + 1}</div>
                <div className="custom-block-fields">
                  <select
                    className="select"
                    value={block.drillId}
                    onChange={(event) => chooseBlockDrill(index, event.target.value)}
                    aria-label={`Drill ${index + 1}`}
                  >
                    {drills.map((drill) => <option value={drill.id} key={drill.id}>{drill.name}</option>)}
                  </select>
                  <input
                    className="input"
                    value={block.dose}
                    onChange={(event) => updateBlock(index, { dose: event.target.value })}
                    placeholder="Sets, reps, time or distance"
                    aria-label={`Drill ${index + 1} sets, reps, time, or distance`}
                  />
                  <input
                    className="input"
                    value={block.cue}
                    onChange={(event) => updateBlock(index, { cue: event.target.value })}
                    placeholder="Coaching cue"
                    aria-label={`Drill ${index + 1} coaching cue`}
                  />
                </div>
                <div className="custom-block-actions">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label={`Move drill ${index + 1} up`}>↑</button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === draft.blocks.length - 1} aria-label={`Move drill ${index + 1} down`}>↓</button>
                  <button type="button" onClick={() => removeBlock(index)} aria-label={`Remove drill ${index + 1}`}>×</button>
                </div>
              </div>
            ))}
            {!draft.blocks.length ? <div className="empty">Add the first drill to build this workout.</div> : null}
          </div>

          <div className="builder-footer">
            <button className="ghost-btn" type="button" onClick={addCustomDrill}>Add Drill</button>
            <button className="save-btn" type="button" onClick={saveCustomWorkout}>Save to {selectedDay}</button>
          </div>
        </section>
      ) : null}

      <TeamSync
        athletes={athletes}
        activeRoutine={activeRoutine}
        dailyRoutines={dailyRoutines}
        selectedDay={selectedDay}
        readiness={readiness}
        onFlash={onFlash}
      />
    </div>
  );
}
