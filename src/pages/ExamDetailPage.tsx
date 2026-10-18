import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  IconArrowLeft,
  IconClose,
  IconCopy,
  IconDownload,
  IconEdit,
  IconEye,
  IconLogout,
  IconPause,
  IconPlay,
  IconPractice,
  IconTrash,
} from "../components/Icons";
import { ConfirmDialog } from "../components/Dialogs";
import { OptionPicker } from "../components/OptionPicker";
import {
  computeExamStats,
  deleteExam,
  getExam,
  isExamAccepting,
  isExamWindowOpen,
  listSessionsForExam,
  setExamAcceptingSubmissions,
  updateExam,
  type ExamEvent,
} from "../exam/examsApi";
import { exportExamProtocolPdf } from "../exam/exportProtocol";
import { formatSessionResult } from "../exam/grade";
import type { TaskSet } from "../exam/questionTypes";
import { ensureDefaultTaskSet, getTaskSet } from "../exam/taskSetsApi";
import type { SessionDoc } from "../firebase/types";

function statusLabel(status: SessionDoc["status"]): string {
  if (status === "in_progress") return "W trakcie";
  if (status === "submitted") return "Oddane";
  if (status === "expired") return "Wygasłe";
  return status;
}

function examWindowLabel(exam: ExamEvent): string {
  if (exam.acceptingSubmissions === false) return "Nowe podejścia wstrzymane";
  if (isExamAccepting(exam)) return "Przyjmuje podejścia";
  if (!isExamWindowOpen(exam)) {
    const now = Date.now();
    if (now < new Date(exam.opensAt).getTime()) return "Jeszcze nieotwarte";
    return "Okno czasowe zamknięte";
  }
  return "Niedostępne";
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ExamDetailPage() {
  const { examId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamEvent | null>(null);
  const [sessions, setSessions] = useState<Array<SessionDoc & { id: string }>>([]);
  const [sets, setSets] = useState<TaskSet[]>([]);
  const [setName, setSetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [title, setTitle] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questionCount, setQuestionCount] = useState(5);
  const [taskSetId, setTaskSetId] = useState("");

  const studentUrl = useMemo(() => {
    if (!examId || typeof window === "undefined") return "";
    return `${window.location.origin}/exams/${examId}`;
  }, [examId]);

  const reload = useCallback(async () => {
    if (!examId || !user?.email) return;
    const [found, sessionList, taskSets] = await Promise.all([
      getExam(examId),
      listSessionsForExam(examId),
      ensureDefaultTaskSet(user.email),
    ]);
    setExam(found);
    setSessions(sessionList);
    setSets(taskSets);
    if (found?.taskSetId) {
      const named = taskSets.find((s) => s.id === found.taskSetId);
      if (named) setSetName(named.name);
      else {
        const remote = await getTaskSet(found.taskSetId);
        setSetName(remote?.name ?? null);
      }
    } else {
      setSetName(null);
    }
    if (!found) setError("Nie znaleziono testu.");
  }, [examId, user?.email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setError("Nie udało się wczytać testu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!editOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setEditOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editOpen]);

  const stats = useMemo(() => computeExamStats(sessions), [sessions]);
  const paused = exam?.acceptingSubmissions === false;

  function openEdit() {
    if (!exam) return;
    setEditError(null);
    setTitle(exam.title);
    setOpensAt(toLocalInputValue(exam.opensAt));
    setClosesAt(toLocalInputValue(exam.closesAt));
    setDurationMinutes(exam.durationMinutes);
    setQuestionCount(exam.questionCount ?? 5);
    setTaskSetId(exam.taskSetId || sets[0]?.id || "");
    setEditOpen(true);
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!exam) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateExam(exam, {
        title,
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        durationMinutes,
        questionCount,
        taskSetId,
      });
      setEditOpen(false);
      await reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!studentUrl) return;
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nie udało się skopiować linku.");
    }
  }

  async function toggleAccepting() {
    if (!exam) return;
    setBusy(true);
    setError(null);
    try {
      await setExamAcceptingSubmissions(exam, paused);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić ustawienia.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteAction() {
    if (!exam) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await deleteExam(exam.id);
      navigate("/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć testu.");
      setBusy(false);
    }
  }

  async function onExportProtocol() {
    if (!exam) return;
    setExporting(true);
    setError(null);
    try {
      await exportExamProtocolPdf(exam, setName, sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wygenerować protokołu.");
    } finally {
      setExporting(false);
    }
  }

  const questionMeta = exam
    ? `${exam.questionCount ?? exam.taskIds?.length ?? "—"} pytań${setName ? ` · ${setName}` : ""}`
    : "";

  return (
    <div className="page-shell panel-wide">
      <header className="page-shell-header page-shell-header-split">
        <Link to="/panel" className="icon-button header-back" aria-label="Wróć do listy testów" title="Wróć do listy">
          <IconArrowLeft />
        </Link>
        <div className="page-shell-header-main">
          <p className="eyebrow">Panel prowadzącego</p>
          <h1>{exam?.title ?? "Test"}</h1>
        </div>
        <nav className="page-shell-nav page-shell-nav-icons">
          <Link to="/" className="icon-button" aria-label="Ćwiczenia" title="Ćwiczenia">
            <IconPractice />
          </Link>
          <button
            type="button"
            className="icon-button"
            onClick={() => logout()}
            aria-label="Wyloguj"
            title="Wyloguj"
          >
            <IconLogout />
          </button>
        </nav>
      </header>

      <div className="page-shell-body panel-body panel-body-elevated">
        {loading ? <p className="muted">Ładowanie…</p> : null}
        {error && !editOpen ? <p className="form-error">{error}</p> : null}

        {exam ? (
          <>
            <section className="panel-section">
              <div className="exam-detail-top">
                <div className="exam-detail-meta">
                  <p className="exam-detail-status">{examWindowLabel(exam)}</p>
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    {exam.durationMinutes} min · {questionMeta}
                  </p>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {new Date(exam.opensAt).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" — "}
                    {new Date(exam.closesAt).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="exam-detail-box-actions">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy || exporting || sessions.length === 0}
                    onClick={() => void onExportProtocol()}
                    aria-label="Zapisz protokół podejść"
                    title={
                      sessions.length === 0
                        ? "Brak podejść do zapisania"
                        : exporting
                          ? "Generowanie protokołu…"
                          : "Zapisz protokół (PDF)"
                    }
                  >
                    <IconDownload />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    onClick={openEdit}
                    aria-label="Edytuj test"
                    title="Edytuj test"
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    onClick={() => void toggleAccepting()}
                    aria-label={paused ? "Wznów nowe podejścia" : "Zatrzymaj nowe podejścia"}
                    title={paused ? "Wznów nowe podejścia" : "Zatrzymaj nowe podejścia"}
                  >
                    {paused ? <IconPlay /> : <IconPause />}
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Usuń test"
                    title="Usuń test"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              <div className="exam-link-box">
                <div className="exam-link-box-head">
                  <strong>Link dla studentów</strong>
                  <button
                    type="button"
                    className={`icon-button exam-copy-btn${copied ? " is-copied" : ""}`}
                    onClick={copyLink}
                    aria-label={copied ? "Skopiowano" : "Kopiuj link"}
                    title={copied ? "Skopiowano" : "Kopiuj link"}
                  >
                    <IconCopy />
                  </button>
                </div>
                <code className="exam-link-code">{studentUrl}</code>
              </div>

              <div className="stats-row">
                <div className="stat-card">
                  <span className="stat-value">{stats.inProgress}</span>
                  <span className="stat-label">Rozwiązuje</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.submitted}</span>
                  <span className="stat-label">Oddało</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.expired}</span>
                  <span className="stat-label">Wygasłe</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">Razem</span>
                </div>
              </div>
            </section>

            <section className="panel-section">
              <h2 className="panel-section-title">Podejścia studentów</h2>
              {sessions.length === 0 ? <p className="muted">Brak podejść do tego testu.</p> : null}
              {sessions.length > 0 ? (
                <div className="table-wrap panel-table-wrap">
                  <table className="data-table panel-data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Indeks</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>Oddanie</th>
                        <th>Wynik</th>
                        <th className="col-action" />
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>
                              {row.firstName} {row.lastName}
                            </strong>
                          </td>
                          <td>{row.studentIndex}</td>
                          <td>
                            <span className={`status-pill status-session-${row.status}`}>{statusLabel(row.status)}</span>
                          </td>
                          <td>
                            {new Date(row.startedAt).toLocaleString("pl-PL", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td>
                            {row.submittedAt
                              ? new Date(row.submittedAt).toLocaleString("pl-PL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td>
                            <span className="result-cell">
                              {formatSessionResult(row)}
                              {row.status !== "in_progress" && row.needsManualReview && row.scoreManual == null
                                ? " · do sprawdzenia"
                                : ""}
                            </span>
                          </td>
                          <td className="col-action">
                            <Link
                              to={`/panel/sesje/${row.id}`}
                              className="icon-button table-action"
                              aria-label={`Podgląd: ${row.firstName} ${row.lastName}`}
                              title="Podgląd"
                            >
                              <IconEye />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      {editOpen && exam ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditOpen(false)}>
          <div
            className="modal-panel modal-panel-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-exam-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel-head">
              <div>
                <p className="modal-eyebrow">Panel prowadzącego</p>
                <h2 id="edit-exam-title">Edytuj test</h2>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                onClick={() => setEditOpen(false)}
                aria-label="Zamknij"
                title="Zamknij"
              >
                <IconClose />
              </button>
            </div>
            <form className="stack-form exam-create-form" onSubmit={onSaveEdit}>
              <label>
                Tytuł
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <div className="form-grid-2">
                <label>
                  Otwarcie
                  <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
                </label>
                <label>
                  Zamknięcie
                  <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
                </label>
              </div>
              <div className="form-grid-2">
                <label>
                  Czas na rozwiązanie (minuty)
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    required
                  />
                </label>
                <label>
                  Liczba pytań
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    required
                  />
                </label>
              </div>
              <label>
                Zestaw pytań
                <OptionPicker
                  label="Zestaw pytań"
                  placeholder="Wybierz zestaw…"
                  value={taskSetId}
                  options={sets.map((set) => ({ value: set.id, primary: set.name }))}
                  wide
                  onChange={setTaskSetId}
                />
              </label>
              {editError ? <p className="form-error">{editError}</p> : null}
              <div className="modal-panel-actions">
                <button type="button" className="secondary modal-chip-btn" onClick={() => setEditOpen(false)}>
                  Anuluj
                </button>
                <button type="submit" className="primary panel-create-btn" disabled={saving || !taskSetId}>
                  {saving ? "Zapisywanie…" : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDelete && exam ? (
        <ConfirmDialog
          title="Usunąć test?"
          message={`Test „${exam.title}” zostanie usunięty. Sesje studentów pozostaną w bazie, ale link przestanie działać. Tej operacji nie da się cofnąć.`}
          confirmLabel="Usuń test"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => void confirmDeleteAction()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}
