import { useEffect, useMemo, useState } from "react";
import { fetchTeamSnapshotByInvite } from "../api/teamSync";
import { getSupabaseSetupState } from "../api/supabaseConfig";

const today = () => new Date().toISOString().slice(0, 10);

function programName(programs, id) {
  return programs.find((program) => program.id === id)?.name || "Assigned program";
}

function programDrills(program) {
  return Array.isArray(program?.drills) ? program.drills : [];
}

export default function AthletePortal({ inviteCode }) {
  const setup = getSupabaseSetupState();
  const [status, setStatus] = useState(setup.isConfigured ? "loading" : "setup");
  const [message, setMessage] = useState(setup.isConfigured ? "Loading team schedule..." : "Team Sync is not configured yet.");
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!setup.isConfigured) return;

    let cancelled = false;
    fetchTeamSnapshotByInvite(inviteCode)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setStatus("ready");
        setMessage("");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message || "Could not load this team invite.");
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCode, setup.isConfigured]);

  const programs = snapshot?.programs || [];
  const sessions = snapshot?.sessions || [];
  const todaysSessions = useMemo(() => sessions.filter((event) => event.date === today()), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((event) => event.date >= today()).slice(0, 5), [sessions]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div>
            <div className="brand">APEX<span>PREDATOR</span><strong>ELITE</strong></div>
            <div className="tagline">Team schedule</div>
          </div>
          <span className={`status-pill ${status === "ready" ? "green" : "gold"}`}>{status === "ready" ? "Connected" : "Setup"}</span>
        </div>
      </header>

      <main className="content">
        <section className="panel">
          <div className="panel-title">{snapshot?.team?.name || "Team Invite"}</div>
          <div className="panel-sub">Workouts assigned by {snapshot?.team?.coachLabel || "your coach"}</div>

          {message && <div className="callout">{message}</div>}
          {status === "setup" && (
            <div className="sync-note">
              Ask the coach to deploy the app with Supabase environment variables before using this invite.
            </div>
          )}
        </section>

        {status === "ready" && (
          <>
            <section className="panel">
              <div className="panel-title">Today</div>
              <div className="panel-sub">Your assigned sessions</div>
              {todaysSessions.length === 0 ? (
                <div className="empty">No team session assigned for today.</div>
              ) : (
                <SessionList sessions={todaysSessions} programs={programs} />
              )}
            </section>

            <section className="panel">
              <div className="panel-title">Upcoming</div>
              <div className="panel-sub">Next team sessions</div>
              {upcomingSessions.length === 0 ? (
                <div className="empty">No upcoming team sessions yet.</div>
              ) : (
                <SessionList sessions={upcomingSessions} programs={programs} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SessionList({ sessions, programs }) {
  return (
    <div className="sync-list">
      {sessions.map((event) => {
        const program = programs.find((item) => item.id === event.programId);
        return (
          <div className="sync-row athlete-session" key={event.id}>
            <div>
              <div className="item-title">{event.title}</div>
              <div className="muted">{event.date} {event.time} - {event.location || "Location TBD"}</div>
              <div className="cue-line">{programName(programs, event.programId)}</div>
              {program?.notes && <div className="muted tight">{program.notes}</div>}
              <div className="muted tight">{programDrills(program).length} drills assigned</div>
            </div>
            <span className="status-pill green">Whole roster</span>
          </div>
        );
      })}
    </div>
  );
}
