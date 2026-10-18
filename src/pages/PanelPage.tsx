import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { IconClose, IconLogout, IconPractice } from "../components/Icons";
import { OptionPicker } from "../components/OptionPicker";
import { EXAM_CONFIG } from "../exam/config";
import { createExam, isExamAccepting, listExams, type ExamEvent } from "../exam/examsApi";
import type { TaskSet } from "../exam/questionTypes";
import { ensureDefaultTaskSet } from "../exam/taskSetsApi";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function examStatus(exam: ExamEvent): { key: string; label: string } {
  if (exam.acceptingSubmissions === false) return { key: "paused", label: "Wstrzymane" };
  if (isExamAccepting(exam)) return { key: "open", label: "Otwarte" };
  if (Date.now() < new Date(exam.opensAt).getTime()) return { key: "scheduled", label: "Zaplanowane" };
  return { key: "closed", label: "Zamknięte" };
}

function formatPanelDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function examQuestionMeta(exam: ExamEvent): string {
  const n = exam.questionCount ?? exam.taskIds?.length;
  if (n == null) return "—";
  return `${n} pytań`;
}

export default function PanelPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamEvent[]>([]);
  const [sets, setSets] = useState<TaskSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState("Test 1 Gr. 1");
  const [opensAt, setOpensAt] = useState(() => toLocalInputValue(now));
  const [closesAt, setClosesAt] = useState(() => {
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return toLocalInputValue(end);
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(EXAM_CONFIG.durationMinutes);
  const [questionCount, setQuestionCount] = useState(5);
  const [taskSetId, setTaskSetId] = useState("");

  async function reload() {
    if (!user?.email) return;
    const [examList, taskSets] = await Promise.all([listExams(), ensureDefaultTaskSet(user.email)]);
    setExams(examList);
    setSets(taskSets);
    setTaskSetId((prev) => prev || taskSets[0]?.id || "");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setError("Nie udało się wczytać panelu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount when user ready
  }, [user?.email]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function openCreateModal() {
    setError(null);
    setTitle("Test 1 Gr. 1");
    const n = new Date();
    setOpensAt(toLocalInputValue(n));
    setClosesAt(toLocalInputValue(new Date(n.getTime() + 7 * 24 * 60 * 60 * 1000)));
    setDurationMinutes(EXAM_CONFIG.durationMinutes);
    setQuestionCount(5);
    setTaskSetId(sets[0]?.id ?? "");
    setModalOpen(true);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!user?.email) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createExam({
        title,
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        durationMinutes,
        questionCount,
        taskSetId,
        createdBy: user.email,
      });
      setModalOpen(false);
      navigate(`/panel/exams/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć testu.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell panel-wide">
      <header className="page-shell-header">
        <div>
          <p className="eyebrow">Panel prowadzącego</p>
          <h1>Testy i wyniki</h1>
        </div>
        <nav className="page-shell-nav page-shell-nav-icons">
          <Link to="/" className="icon-button" aria-label="Ćwiczenia" title="Ćwiczenia">
            <IconPractice />
          </Link>
          <button type="button" className="icon-button" onClick={() => logout()} aria-label="Wyloguj" title="Wyloguj">
            <IconLogout />
          </button>
        </nav>
      </header>

      <div className="page-shell-body panel-body panel-body-elevated">
        <div className="panel-toolbar">
          <div>
            <h2 className="panel-section-title">Testy</h2>
            <p className="muted panel-section-sub">Zarządzaj terminami i wynikami studentów.</p>
          </div>
          <div className="panel-toolbar-actions">
            <Link to="/panel/zestawy" className="primary panel-create-btn">
              Zestawy zadań
            </Link>
            <button type="button" className="primary panel-create-btn" onClick={openCreateModal}>
              Utwórz test
            </button>
          </div>
        </div>

        {loading ? <p className="muted">Ładowanie…</p> : null}
        {error && !modalOpen ? <p className="form-error">{error}</p> : null}

        {!loading && exams.length === 0 ? (
          <div className="panel-empty">
            <p className="panel-empty-title">Brak testów</p>
            <p className="muted">Utwórz pierwszy test — studenci dostaną bezpośredni link do rozwiązania.</p>
            <button type="button" className="primary panel-create-btn" onClick={openCreateModal}>
              Utwórz test
            </button>
          </div>
        ) : null}

        {exams.length > 0 ? (
          <ul className="exam-card-list">
            {exams.map((exam) => {
              const status = examStatus(exam);
              return (
                <li key={exam.id}>
                  <button type="button" className="exam-card" onClick={() => navigate(`/panel/exams/${exam.id}`)}>
                    <div className="exam-card-main">
                      <div className="exam-card-title-row">
                        <h3>{exam.title}</h3>
                        <span className={`status-pill status-${status.key}`}>{status.label}</span>
                      </div>
                      <p className="exam-card-dates">
                        {formatPanelDate(exam.opensAt)}
                        <span aria-hidden="true"> — </span>
                        {formatPanelDate(exam.closesAt)}
                      </p>
                    </div>
                    <div className="exam-card-meta">
                      <div className="exam-card-stat">
                        <span className="exam-card-stat-label">Czas</span>
                        <span className="exam-card-stat-value">{exam.durationMinutes} min</span>
                      </div>
                      <div className="exam-card-stat">
                        <span className="exam-card-stat-label">Pytania</span>
                        <span className="exam-card-stat-value">{examQuestionMeta(exam)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="modal-panel modal-panel-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-exam-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel-head">
              <div>
                <p className="modal-eyebrow">Panel prowadzącego</p>
                <h2 id="create-exam-title">Utwórz test</h2>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Zamknij"
                title="Zamknij"
              >
                <IconClose />
              </button>
            </div>
            <form className="stack-form exam-create-form" onSubmit={onCreate}>
              <label>
                Tytuł
                <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Test 1 Gr. 1" />
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
                  placeholder={sets.length === 0 ? "Brak zestawów" : "Wybierz zestaw…"}
                  value={taskSetId}
                  options={sets.map((set) => ({ value: set.id, primary: set.name }))}
                  wide
                  onChange={setTaskSetId}
                />
              </label>
              <p className="muted modal-hint">
                Student dostanie losowo wybrane pytania z zestawu. Zarządzaj zestawami w{" "}
                <Link to="/panel/zestawy">Zestawy zadań</Link>.
              </p>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="modal-panel-actions">
                <button type="button" className="secondary modal-chip-btn" onClick={() => setModalOpen(false)}>
                  Anuluj
                </button>
                <button type="submit" className="primary panel-create-btn" disabled={creating || !taskSetId}>
                  {creating ? "Zapisywanie…" : "Zapisz test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
