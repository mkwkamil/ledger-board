import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/Dialogs";
import { ExamWorkspace } from "../components/ExamWorkspace";
import { IconArrowLeft } from "../components/Icons";
import {
  fetchSession,
  fetchSessionTasks,
  finishSessionGrading,
  saveSessionTaskManualScore,
} from "../exam/api";
import { formatSessionResult } from "../exam/grade";
import { normalizePoints } from "../exam/questionTypes";
import { sessionTaskToTask } from "../exam/sessionTasks";
import type { SessionDoc } from "../firebase/types";
import type { Task } from "../state";

function sessionStatusLabel(status: SessionDoc["status"]): string {
  if (status === "in_progress") return "W trakcie";
  if (status === "submitted") return "Oddane";
  if (status === "expired") return "Wygasłe";
  return status;
}

function initialGrades(tasks: Task[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const task of tasks) {
    out[task.id] = task.manualScore ?? null;
  }
  return out;
}

export default function AdminSessionDetailPage() {
  const { id } = useParams();
  const [session, setSession] = useState<(SessionDoc & { id: string }) | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [grades, setGrades] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [saveHint, setSaveHint] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const reload = useCallback(async () => {
    if (!id) return;
    const [s, t] = await Promise.all([fetchSession(id), fetchSessionTasks(id)]);
    if (!s) {
      setError("Sesja nie istnieje.");
      return;
    }
    const converted = t.map(sessionTaskToTask);
    setSession(s);
    setTasks(converted);
    setGrades(initialGrades(converted));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setError("Nie udało się wczytać sesji.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const gradingComplete = !!session && session.needsManualReview === false && session.scoreManual != null;
  const canGrade = !!session && session.status !== "in_progress";

  const allGraded = useMemo(() => {
    if (!tasks || tasks.length === 0) return false;
    return tasks.every((task) => {
      const g = grades[task.id];
      return g != null && Number.isFinite(g);
    });
  }, [tasks, grades]);

  const liveTotal = useMemo(() => {
    if (!tasks) return { earned: 0, max: 0 };
    let earned = 0;
    let max = 0;
    for (const task of tasks) {
      const points = normalizePoints(task.points);
      max += points;
      const g = grades[task.id];
      if (g != null) earned += g;
    }
    return { earned, max };
  }, [tasks, grades]);

  async function handleGradeChange(taskId: string, value: number | null) {
    setGrades((prev) => ({ ...prev, [taskId]: value }));
    if (!id || value == null || gradingComplete) return;
    setSaveHint("saving");
    try {
      await saveSessionTaskManualScore(id, taskId, value);
      setSaveHint("saved");
      window.setTimeout(() => setSaveHint("idle"), 1200);
    } catch {
      setSaveHint("error");
    }
  }

  async function confirmFinishAction() {
    if (!id || !tasks) return;
    setConfirmFinish(false);
    setFinishing(true);
    setError(null);
    try {
      const payload = tasks.map((task) => ({
        id: task.id,
        manualScore: grades[task.id] ?? 0,
      }));
      await finishSessionGrading(id, payload);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zakończyć sprawdzania.");
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="muted">Ładowanie…</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="form-error">{error}</p>
          <Link to="/panel" className="text-link">
            ← Panel
          </Link>
        </div>
      </div>
    );
  }

  if (!session || !tasks) {
    return (
      <div className="page-shell">
        <div className="page-shell-body">
          <p className="form-error">Brak danych.</p>
          <Link to="/panel" className="text-link">
            ← Panel
          </Link>
        </div>
      </div>
    );
  }

  const backTo = session.examId ? `/panel/exams/${session.examId}` : "/panel";
  const showFinish = canGrade && !gradingComplete;
  const resultLabel = gradingComplete
    ? formatSessionResult(session)
    : allGraded
      ? `${liveTotal.earned}/${liveTotal.max}`
      : formatSessionResult(session);

  return (
    <div className="exam-session-root">
      <div className="exam-session-banner exam-admin-banner">
        <div className="exam-admin-banner-left">
          <Link to={backTo} className="icon-button exam-admin-back" aria-label="Wróć do testu" title="Wróć">
            <IconArrowLeft />
          </Link>
          <div className="exam-admin-banner-copy">
            <div className="exam-admin-banner-title">
              <strong>
                {session.firstName} {session.lastName}
              </strong>
              <span className={`status-pill status-session-${session.status}`}>
                {sessionStatusLabel(session.status)}
              </span>
              {canGrade ? (
                <span className="exam-admin-result-pill" title="Wynik">
                  Wynik {resultLabel}
                  {!gradingComplete && session.needsManualReview ? " · sprawdzanie" : ""}
                </span>
              ) : null}
            </div>
            <p className="exam-admin-banner-meta">
              {session.studentIndex}
              <span aria-hidden="true"> · </span>
              {session.email}
            </p>
          </div>
        </div>
        <div className="exam-session-banner-actions exam-admin-banner-times">
          <span>
            Start {new Date(session.startedAt).toLocaleString("pl-PL")}
            {session.submittedAt
              ? ` · Oddane ${new Date(session.submittedAt).toLocaleString("pl-PL")}`
              : null}
          </span>
          {showFinish ? (
            <button
              type="button"
              className="primary exam-admin-finish-btn"
              disabled={!allGraded || finishing}
              onClick={() => setConfirmFinish(true)}
              title={!allGraded ? "Uzupełnij punkty przy każdym zadaniu" : "Zakończ sprawdzanie"}
            >
              {finishing ? "Zapisywanie…" : "Zakończ sprawdzanie"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="form-error exam-admin-inline-error">{error}</p> : null}
      <ExamWorkspace
        key={session.id}
        initialTasks={tasks}
        readOnly
        showBankNumbers
        saveStatus={saveHint}
        grading={
          canGrade
            ? {
                grades,
                onGradeChange: (taskId, value) => void handleGradeChange(taskId, value),
                reviewAnswers: true,
                readOnlyGrades: gradingComplete,
              }
            : undefined
        }
      />
      {confirmFinish ? (
        <ConfirmDialog
          title="Zakończyć sprawdzanie?"
          message={`Zapisany zostanie wynik ${liveTotal.earned}/${liveTotal.max} pkt. Później będzie można go zmienić tylko przez ponowne zapisanie punktów.`}
          confirmLabel="Zakończ sprawdzanie"
          cancelLabel="Anuluj"
          onConfirm={() => void confirmFinishAction()}
          onClose={() => setConfirmFinish(false)}
        />
      ) : null}
    </div>
  );
}
