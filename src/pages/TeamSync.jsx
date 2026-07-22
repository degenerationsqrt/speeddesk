import { useTeamSync } from "../sync/useTeamSync";

function programName(programs, id) {
  return programs.find((program) => program.id === id)?.name || "No program";
}

function formatSyncTime(value) {
  if (!value) return "Not synced";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TeamSync({ athletes, programs, calendarEvents, activeRoutine, dailyRoutines = [], onFlash }) {
  const sync = useTeamSync({ athletes, programs, calendarEvents, activeRoutine, dailyRoutines, onFlash });
  const activeAthletes = athletes.filter((athlete) => athlete.status !== "Inactive");
  const upcomingSessions = calendarEvents.slice(0, 5);
  const connectionLabel = sync.setup.isConfigured ? "Cloud ready" : "Setup needed";

  const copyInvite = async () => {
    if (!sync.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(sync.inviteUrl);
      onFlash?.("Invite copied");
    } catch (error) {
      onFlash?.("Copy the link field");
    }
  };

  return (
    <>
      <Panel title="Team Sync" sub="Share one invite code so player apps get an individual workout every day">
        <div className="sync-status-row">
          <StatusPill tone={sync.setup.isConfigured ? "green" : "gold"} label={connectionLabel} />
          <span className="muted">Last sync: {formatSyncTime(sync.team.lastSyncedAt)}</span>
        </div>

        <div className="metric-grid">
          <Metric label="Active athletes" value={activeAthletes.length} accent="green" />
          <Metric label="Daily workouts" value={dailyRoutines.length || 1} accent="orange" />
          <Metric label="Scheduled" value={calendarEvents.length} accent="gold" />
        </div>

        {activeRoutine && (
          <div className="sync-note">
            <strong>Selected day preview:</strong> {activeRoutine.day} - {activeRoutine.focus} ({activeRoutine.minutes} min)
          </div>
        )}

        {dailyRoutines.length > 1 && (
          <div className="mini-program-list">
            {dailyRoutines.map((routine) => (
              <div className="mini-row" key={routine.id || routine.day}>
                <span className="badge" style={{ "--badge-color": routine.intensity === "Rest" ? "#38bdf8" : "#a3e635" }}>
                  {routine.day.slice(0, 3)}
                </span>
                <span>{routine.focus}</span>
                <strong>{routine.minutes} min</strong>
              </div>
            ))}
          </div>
        )}

        <div className="form-grid">
          <Field label="Team name">
            <input className="input" value={sync.team.name} onChange={(event) => sync.updateTeam({ name: event.target.value })} />
          </Field>
          <Field label="Coach label">
            <input className="input" value={sync.team.coachLabel} onChange={(event) => sync.updateTeam({ coachLabel: event.target.value })} />
          </Field>
          <Field label="Invite code">
            <input className="input" value={sync.team.inviteCode} readOnly />
          </Field>
        </div>

        <div className="button-row sync-actions">
          <button className="ghost-btn" type="button" onClick={sync.regenerateInvite}>New invite code</button>
          <button className="ghost-btn gold" type="button" onClick={copyInvite}>Copy invite link</button>
        </div>

        <Field label="Athlete invite link">
          <input className="input" value={sync.inviteUrl} readOnly />
        </Field>

        {sync.message && <div className="callout">{sync.message}</div>}
        {!sync.setup.isConfigured && (
          <div className="sync-note">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel or Netlify, then paste the SQL from `supabase/schema.sql` into Supabase.
          </div>
        )}

        <button className="save-btn" type="button" onClick={sync.syncNow}>
          {sync.status === "syncing" ? "Syncing..." : "Sync Daily Plan"}
        </button>
      </Panel>

      <Panel title="Roster Access" sub="Everyone active here receives whole-roster scheduled sessions">
        {activeAthletes.length === 0 ? (
          <Empty text="Add athletes before sharing the invite link." />
        ) : (
          <div className="sync-list">
            {activeAthletes.map((athlete) => (
              <div className="sync-row" key={athlete.id}>
                <div>
                  <div className="item-title">{athlete.name || "Unnamed athlete"}</div>
                  <div className="muted">{athlete.group || "No group"} - {athlete.email || "No email"}</div>
                </div>
                <StatusPill tone={athlete.email ? "green" : "gold"} label={athlete.email ? "Ready" : "Needs email"} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Shared Schedule" sub="What athletes will see when they open the invite link">
        {upcomingSessions.length === 0 ? (
          <Empty text="Schedule a program to create the shared team calendar." />
        ) : (
          <div className="sync-list">
            {upcomingSessions.map((event) => (
              <div className="sync-row" key={event.id}>
                <div>
                  <div className="item-title">{event.title}</div>
                  <div className="muted">{event.date} {event.time} - {programName(programs, event.programId)}</div>
                </div>
                <StatusPill tone="green" label="Whole roster" />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
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

function Metric({ label, value, accent }) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ tone, label }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
