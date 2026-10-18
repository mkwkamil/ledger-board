import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/Dialogs";
import { ExamWorkspace } from "../components/ExamWorkspace";
import { IconCheck } from "../components/Icons";
import { saveSessionTaskBoard, fetchSession, fetchSessionTasks, submitExamSession } from "../exam/api";
import { clearLocalExamSession, loadLocalExamSession } from "../exam/sessionStorage";
import { sessionTaskToTask, taskToBoard, taskToSummary } from "../exam/sessionTasks";
import type { SessionDoc } from "../firebase/types";
import type { Task } from "../state";

const SAVE_DEBOUNCE_MS = 2500;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function taskFingerprint(task: Task): string {
  return JSON.stringify({
    board: taskToBoard(task),
    summary: taskToSummary(task),
    studentAnswer: task.studentAnswer ?? null,
  });
}

function ExamDonePage({ session }: { session: SessionDoc & { id: string } }) {
  const timedOut = session.status === "expired";
  return (
    <div className="exam-done-screen">
      <div className="exam-done-card">
        <div className="exam-done-mark" aria-hidden="true">
          <IconCheck />
        </div>
        <p className="exam-done-eyebrow">Sesja testowa</p>
        <h1>Rozwiązywanie zakończone</h1>
        <p className="exam-done-lead">
          {timedOut
            ? "Czas się skończył. Twoje rozwiązanie zostało automatycznie wysłane do prowadzącego."
            : "Pomyślnie wysłano rozwiązanie do prowadzącego."}
        </p>
        <dl className="exam-done-meta">
          <div>
            <dt>Student</dt>
            <dd>
              {session.firstName} {session.lastName}
            </dd>
          </div>
          <div>
            <dt>Indeks</dt>
            <dd>{session.studentIndex}</dd>
          </div>
          {session.examTitle ? (
            <div>
              <dt>Test</dt>
              <dd>{session.examTitle}</dd>
            </div>
          ) : null}
        </dl>
        <p className="exam-done-note">
          Podgląd odpowiedzi nie jest już dostępny. Dalszą oceną zajmuje się prowadzący — możesz zamknąć tę
          stronę.
        </p>
      </div>
    </div>
  );
}

export default function ExamSessionPage() {
  const { sessionId } = useParams();
  const local = useMemo(() => loadLocalExamSession(), []);
  const [session, setSession] = useState<(SessionDoc & { id: string }) | null>(null);
  const [initialTasks, setInitialTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const tasksRef = useRef<Task[]>([]);
  const lastSavedRef = useRef<Map<string, string>>(new Map());
  const saveTimer = useRef<number | null>(null);
  const autoSubmitted = useRef(false);
  const finishing = useRef(false);

  const canEdit =
    !!session &&
    session.status === "in_progress" &&
    !!local &&
    local.sessionId === sessionId &&
    local.sessionToken === session.sessionToken;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSession(sessionId);
        if (cancelled) return;
        if (!s) {
          setError("Sesja nie istnieje.");
          return;
        }
        if (local?.sessionId === sessionId && local.sessionToken !== s.sessionToken) {
          setError("Brak dostępu do tej sesji na tym urządzeniu.");
          return;
        }
        setSession(s);

        if (s.status !== "in_progress") {
          clearLocalExamSession();
          return;
        }

        const t = await fetchSessionTasks(sessionId);
        if (cancelled) return;
        const converted = t.map(sessionTaskToTask);
        setInitialTasks(converted);
        tasksRef.current = converted;
        lastSavedRef.current = new Map(converted.map((task) => [task.id, taskFingerprint(task)]));
      } catch {
        if (!cancelled) setError("Nie udało się wczytać sesji.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, local]);

  const persistTasks = useCallback(
    async (tasks: Task[]) => {
      if (!sessionId || !canEdit) return;
      const dirty = tasks.filter((task) => lastSavedRef.current.get(task.id) !== taskFingerprint(task));
      if (dirty.length === 0) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("saving");
      try {
        await Promise.all(
          dirty.map((task) =>
            saveSessionTaskBoard(
              sessionId,
              task.id,
              taskToBoard(task),
              taskToSummary(task),
              task.studentAnswer ?? null,
            ),
          ),
        );
        for (const task of dirty) {
          lastSavedRef.current.set(task.id, taskFingerprint(task));
        }
        setSaveStatus("saved");
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
      }
    },
    [sessionId, canEdit],
  );

  const handleTasksChange = useCallback(
    (tasks: Task[]) => {
      tasksRef.current = tasks;
      if (!canEdit) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void persistTasks(tasks);
      }, SAVE_DEBOUNCE_MS);
    },
    [canEdit, persistTasks],
  );

  const finishSession = useCallback(
    async (reason: "manual" | "timeout") => {
      if (!sessionId || !local || local.sessionId !== sessionId) return;
      if (finishing.current) return;
      if (reason === "timeout" && autoSubmitted.current) return;
      finishing.current = true;
      setSubmitting(true);
      setError(null);
      try {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        const snapshots = tasksRef.current.map((task) => ({
          id: task.id,
          board: taskToBoard(task),
          summary: taskToSummary(task),
          studentAnswer: task.studentAnswer ?? null,
        }));
        await submitExamSession(sessionId, local.sessionToken, snapshots);
        if (reason === "timeout") autoSubmitted.current = true;
        const refreshed = await fetchSession(sessionId);
        clearLocalExamSession();
        setInitialTasks(null);
        if (refreshed) setSession(refreshed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nie udało się oddać testu.");
        finishing.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, local],
  );

  const remainingMs = session ? new Date(session.endsAt).getTime() - now : 0;

  useEffect(() => {
    if (!canEdit || remainingMs > 0) return;
    void finishSession("timeout");
  }, [remainingMs, canEdit, finishSession]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="muted">Ładowanie sesji…</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="form-error">{error}</p>
          <Link to="/" className="text-link">
            Strona główna
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (session.status !== "in_progress") {
    return <ExamDonePage session={session} />;
  }

  if (!initialTasks) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="muted">Ładowanie zadań…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-session-root">
      <div className="exam-session-banner">
        <div>
          <strong>
            {session.firstName} {session.lastName}
          </strong>{" "}
          · {session.studentIndex}
          {error ? <span className="form-error"> · {error}</span> : null}
        </div>
        <div className="exam-session-banner-actions">
          <span className="exam-timer">
            {remainingMs > 0 ? `Pozostało ${formatRemaining(remainingMs)}` : "Czas minął — oddawanie…"}
          </span>
        </div>
      </div>
      <ExamWorkspace
        key={session.id}
        initialTasks={initialTasks}
        readOnly={!canEdit}
        saveStatus={canEdit ? saveStatus : "idle"}
        onTasksChange={canEdit ? handleTasksChange : undefined}
        sidebarFooter={
          canEdit ? (
            <button
              type="button"
              className="exam-finish-btn"
              disabled={submitting}
              onClick={() => setConfirmFinish(true)}
            >
              {submitting ? "Kończenie…" : "Zakończ rozwiązywanie"}
            </button>
          ) : null
        }
      />
      {confirmFinish ? (
        <ConfirmDialog
          title="Zakończyć rozwiązywanie?"
          message="Po potwierdzeniu odpowiedzi zostaną oddane i nie będzie już można ich edytować ani podglądać. Tej operacji nie da się cofnąć."
          confirmLabel="Zakończ rozwiązywanie"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => {
            setConfirmFinish(false);
            void finishSession("manual");
          }}
          onClose={() => setConfirmFinish(false)}
        />
      ) : null}
    </div>
  );
}
