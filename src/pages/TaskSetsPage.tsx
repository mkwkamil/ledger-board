import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ConfirmDialog } from "../components/Dialogs";
import {
  IconArrowLeft,
  IconClose,
  IconCopy,
  IconLogout,
  IconPaste,
  IconPractice,
  IconTrash,
} from "../components/Icons";
import { OptionPicker } from "../components/OptionPicker";
import {
  parseImportedQuestions,
  QUESTIONS_CHAT_TEMPLATE,
  toSetQuestionDocs,
} from "../exam/importQuestions";
import {
  newOptionId,
  normalizePoints,
  questionKindLabel,
  type QuestionOption,
  type SetQuestion,
  type SetQuestionDoc,
  type SetQuestionKind,
  type TaskSet,
} from "../exam/questionTypes";
import {
  createTaskSet,
  deleteSetQuestion,
  deleteTaskSet,
  ensureDefaultTaskSet,
  importSetQuestions,
  listSetQuestionsWithAnswers,
  renameTaskSet,
  upsertSetQuestion,
} from "../exam/taskSetsApi";

const KIND_OPTIONS = [
  { value: "ledger", primary: "Obliczeniowe (tablica)" },
  { value: "single", primary: "Jednokrotny wybór" },
  { value: "multiple", primary: "Wielokrotny wybór" },
  { value: "open", primary: "Otwarte" },
];

interface DraftQuestion {
  id?: string;
  order: number;
  kind: SetQuestionKind;
  prompt: string;
  number: string;
  points: number;
  options: QuestionOption[];
  correctOptionIds: string[];
}

function emptyDraft(order: number): DraftQuestion {
  return {
    order,
    kind: "single",
    prompt: "",
    number: String(order),
    points: 1,
    options: [
      { id: newOptionId(), text: "" },
      { id: newOptionId(), text: "" },
    ],
    correctOptionIds: [],
  };
}

function fromQuestion(q: SetQuestion): DraftQuestion {
  return {
    id: q.id,
    order: q.order,
    kind: q.kind,
    prompt: q.prompt,
    number: q.number,
    points: normalizePoints(q.points),
    options: q.options?.length
      ? q.options.map((o) => ({ ...o }))
      : [
          { id: newOptionId(), text: "" },
          { id: newOptionId(), text: "" },
        ],
    correctOptionIds: [...(q.correctOptionIds ?? [])],
  };
}

export default function TaskSetsPage() {
  const { user, logout } = useAuth();
  const [sets, setSets] = useState<TaskSet[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [questions, setQuestions] = useState<SetQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingQ, setSavingQ] = useState(false);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState<SetQuestion | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  const selected = sets.find((s) => s.id === selectedId) ?? null;

  const reloadSets = useCallback(async () => {
    if (!user?.email) return;
    const list = await ensureDefaultTaskSet(user.email);
    setSets(list);
    setSelectedId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
  }, [user?.email]);

  const reloadQuestions = useCallback(async (setId: string) => {
    if (!setId) {
      setQuestions([]);
      return;
    }
    const list = await listSetQuestionsWithAnswers(setId);
    setQuestions(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reloadSets();
      } catch {
        if (!cancelled) setError("Nie udało się wczytać zestawów.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadSets]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        await reloadQuestions(selectedId);
        const current = sets.find((s) => s.id === selectedId);
        if (current && !cancelled) setRenameValue(current.name);
      } catch {
        if (!cancelled) setError("Nie udało się wczytać pytań zestawu.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, reloadQuestions, sets]);

  useEffect(() => {
    if (!createOpen && !editOpen && !importOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setCreateOpen(false);
      setEditOpen(false);
      setImportOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, editOpen, importOpen]);

  async function onCreateSet(event: FormEvent) {
    event.preventDefault();
    if (!user?.email) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createTaskSet(newSetName, user.email);
      setCreateOpen(false);
      setNewSetName("");
      await reloadSets();
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zestawu.");
    } finally {
      setBusy(false);
    }
  }

  async function onRename() {
    if (!selectedId || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameTaskSet(selectedId, renameValue);
      await reloadSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić nazwy.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteSetAction() {
    if (!selected) return;
    setConfirmDeleteSet(false);
    setBusy(true);
    setError(null);
    try {
      await deleteTaskSet(selected.id);
      setSelectedId("");
      await reloadSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć zestawu.");
    } finally {
      setBusy(false);
    }
  }

  function openNewQuestion() {
    setEditError(null);
    setDraft(emptyDraft(questions.length + 1));
    setEditOpen(true);
  }

  function openEditQuestion(q: SetQuestion) {
    setEditError(null);
    setDraft(fromQuestion(q));
    setEditOpen(true);
  }

  function setKind(kind: SetQuestionKind) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (kind === "single" || kind === "multiple") {
        return {
          ...prev,
          kind,
          options: prev.options.length >= 2 ? prev.options : emptyDraft(prev.order).options,
          correctOptionIds: kind === "single" ? prev.correctOptionIds.slice(0, 1) : prev.correctOptionIds,
        };
      }
      return { ...prev, kind, correctOptionIds: [], options: prev.options };
    });
  }

  function toggleCorrect(optionId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.kind === "single") {
        return { ...prev, correctOptionIds: [optionId] };
      }
      const has = prev.correctOptionIds.includes(optionId);
      return {
        ...prev,
        correctOptionIds: has
          ? prev.correctOptionIds.filter((id) => id !== optionId)
          : [...prev.correctOptionIds, optionId],
      };
    });
  }

  async function copyImportTemplate() {
    try {
      await navigator.clipboard.writeText(QUESTIONS_CHAT_TEMPLATE);
      setTemplateCopied(true);
      window.setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      setImportError("Nie udało się skopiować szablonu.");
    }
  }

  function openImportModal() {
    setImportText("");
    setImportError(null);
    setTemplateCopied(false);
    setImportOpen(true);
  }

  async function onImportQuestions(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setImporting(true);
    setImportError(null);
    try {
      const drafts = parseImportedQuestions(importText);
      const docs = toSetQuestionDocs(drafts, questions.length + 1);
      await importSetQuestions(selectedId, docs);
      setImportOpen(false);
      setImportText("");
      await reloadQuestions(selectedId);
      await reloadSets();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Nie udało się zaimportować pytań.");
    } finally {
      setImporting(false);
    }
  }

  async function onSaveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft) return;
    setSavingQ(true);
    setEditError(null);
    try {
      const order = draft.id ? draft.order : questions.length + 1;
      const payload: SetQuestionDoc & { id?: string } = {
        id: draft.id,
        order,
        kind: draft.kind,
        prompt: draft.prompt,
        number: String(order),
        points: normalizePoints(draft.points),
      };
      if (draft.kind === "single" || draft.kind === "multiple") {
        payload.options = draft.options.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text);
        payload.correctOptionIds = draft.correctOptionIds.filter((id) =>
          (payload.options ?? []).some((o) => o.id === id),
        );
      }
      await upsertSetQuestion(selectedId, payload);
      setEditOpen(false);
      setDraft(null);
      await reloadQuestions(selectedId);
      await reloadSets();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Nie udało się zapisać pytania.");
    } finally {
      setSavingQ(false);
    }
  }

  async function confirmDeleteQuestionAction() {
    if (!selectedId || !confirmDeleteQuestion) return;
    const questionId = confirmDeleteQuestion.id;
    setConfirmDeleteQuestion(null);
    setBusy(true);
    try {
      await deleteSetQuestion(selectedId, questionId);
      await reloadQuestions(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć pytania.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell panel-wide">
      <header className="page-shell-header page-shell-header-split">
        <Link to="/panel" className="icon-button header-back" aria-label="Wróć do testów" title="Wróć do testów">
          <IconArrowLeft />
        </Link>
        <div className="page-shell-header-main">
          <p className="eyebrow">Panel prowadzącego</p>
          <h1>Zestawy zadań</h1>
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
        {loading ? <p className="muted">Ładowanie…</p> : null}
        {error && !createOpen && !editOpen ? <p className="form-error">{error}</p> : null}

        {!loading ? (
          <>
            <div className="panel-toolbar">
              <div className="task-set-select-block">
                <label>
                  Obecny zestaw
                  <OptionPicker
                    label="Obecny zestaw"
                    placeholder={sets.length === 0 ? "Brak zestawów" : "Wybierz zestaw…"}
                    value={selectedId}
                    options={sets.map((set) => ({ value: set.id, primary: set.name }))}
                    wide
                    onChange={setSelectedId}
                  />
                </label>
              </div>
              <button type="button" className="primary panel-create-btn" onClick={() => setCreateOpen(true)}>
                Utwórz nowy zestaw
              </button>
            </div>

            {selected ? (
              <section className="panel-section">
                <div className="task-set-rename-row">
                  <label className="task-set-rename">
                    Nazwa zestawu
                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                  </label>
                  <button type="button" className="secondary modal-chip-btn" disabled={busy} onClick={() => void onRename()}>
                    Zapisz nazwę
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    disabled={busy || sets.length <= 1}
                    onClick={() => setConfirmDeleteSet(true)}
                    aria-label="Usuń zestaw"
                    title={sets.length <= 1 ? "Zostaw przynajmniej jeden zestaw" : "Usuń zestaw"}
                  >
                    <IconTrash />
                  </button>
                </div>

                <div className="panel-toolbar" style={{ marginTop: 18 }}>
                  <div>
                    <h2 className="panel-section-title">Pytania ({questions.length})</h2>
                    <p className="muted panel-section-sub">
                      Typy: obliczeniowe, jednokrotny / wielokrotny wybór, otwarte.
                    </p>
                  </div>
                  <div className="panel-toolbar-actions">
                    <button
                      type="button"
                      className="secondary modal-chip-btn panel-import-btn"
                      onClick={openImportModal}
                      aria-label="Wklej pytania"
                      title="Wklej pytania (JSON)"
                    >
                      <IconPaste />
                      <span>Wklej pytania</span>
                    </button>
                    <button type="button" className="primary panel-create-btn" onClick={openNewQuestion}>
                      Dodaj pytanie
                    </button>
                  </div>
                </div>

                {questions.length === 0 ? (
                  <p className="muted">Ten zestaw nie ma jeszcze pytań.</p>
                ) : (
                  <ul className="set-question-list">
                    {questions.map((q, index) => (
                      <li key={q.id} className="set-question-card">
                        <div className="set-question-card-head">
                          <strong>{index + 1}</strong>
                          <span className="kind-pill">{questionKindLabel(q.kind)}</span>
                          <span className="points-pill">{normalizePoints(q.points)} pkt</span>
                        </div>
                        <p className="set-question-prompt">{q.prompt}</p>
                        {q.kind === "single" || q.kind === "multiple" ? (
                          <ul className="set-question-options muted">
                            {(q.options ?? []).map((opt) => (
                              <li key={opt.id}>
                                {(q.correctOptionIds ?? []).includes(opt.id) ? "✓ " : ""}
                                {opt.text}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="set-question-actions">
                          <button type="button" className="secondary modal-chip-btn" onClick={() => openEditQuestion(q)}>
                            Edytuj
                          </button>
                          <button
                            type="button"
                            className="secondary modal-chip-btn"
                            disabled={busy}
                            onClick={() => setConfirmDeleteQuestion(q)}
                          >
                            Usuń
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {createOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-set-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel-head">
              <div>
                <p className="modal-eyebrow">Zestawy</p>
                <h2 id="create-set-title">Nowy zestaw</h2>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                onClick={() => setCreateOpen(false)}
                aria-label="Zamknij"
              >
                <IconClose />
              </button>
            </div>
            <form className="stack-form" onSubmit={onCreateSet}>
              <label>
                Nazwa
                <input
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  required
                  placeholder="np. Kolokwium 2 — teoria"
                  autoFocus
                />
              </label>
              {error && createOpen ? <p className="form-error">{error}</p> : null}
              <div className="modal-panel-actions">
                <button type="button" className="secondary modal-chip-btn" onClick={() => setCreateOpen(false)}>
                  Anuluj
                </button>
                <button type="submit" className="primary panel-create-btn" disabled={busy}>
                  {busy ? "Tworzenie…" : "Utwórz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen && draft ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditOpen(false)}>
          <div
            className="modal-panel modal-panel-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-q-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel-head">
              <div>
                <p className="modal-eyebrow">Zestaw</p>
                <h2 id="edit-q-title">{draft.id ? "Edytuj pytanie" : "Nowe pytanie"}</h2>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                onClick={() => setEditOpen(false)}
                aria-label="Zamknij"
              >
                <IconClose />
              </button>
            </div>
            <form className="stack-form exam-create-form" onSubmit={onSaveQuestion}>
              <div className="form-grid-2">
                <label>
                  Typ pytania
                  <OptionPicker
                    label="Typ pytania"
                    value={draft.kind}
                    options={KIND_OPTIONS}
                    onChange={(value) => setKind(value as SetQuestionKind)}
                  />
                </label>
                <label>
                  Punkty
                  <input
                    type="number"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={draft.points}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, points: normalizePoints(Number(e.target.value)) } : prev,
                      )
                    }
                    required
                  />
                </label>
              </div>
              <label>
                Treść pytania
                <textarea
                  rows={5}
                  value={draft.prompt}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, prompt: e.target.value } : prev))}
                  required
                />
              </label>

              {draft.kind === "single" || draft.kind === "multiple" ? (
                <div className="set-options-editor">
                  <div className="modal-pool-head">
                    <strong>Opcje odpowiedzi</strong>
                    <button
                      type="button"
                      className="secondary modal-chip-btn"
                      onClick={() =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, options: [...prev.options, { id: newOptionId(), text: "" }] }
                            : prev,
                        )
                      }
                    >
                      Dodaj opcję
                    </button>
                  </div>
                  <p className="muted modal-hint">
                    Zaznacz poprawną{draft.kind === "multiple" ? "e" : ""} odpowiedź
                    {draft.kind === "multiple" ? "i" : ""}.
                  </p>
                  <ul className="set-options-list">
                    {draft.options.map((opt, index) => (
                      <li key={opt.id} className="set-option-row">
                        <label className="set-option-correct">
                          <input
                            type={draft.kind === "single" ? "radio" : "checkbox"}
                            name="correct-opt"
                            checked={draft.correctOptionIds.includes(opt.id)}
                            onChange={() => toggleCorrect(opt.id)}
                            title="Poprawna odpowiedź"
                          />
                          <span className="sr-only">Poprawna</span>
                        </label>
                        <input
                          value={opt.text}
                          placeholder={`Opcja ${index + 1}`}
                          onChange={(e) => {
                            const text = e.target.value;
                            setDraft((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                options: prev.options.map((o) => (o.id === opt.id ? { ...o, text } : o)),
                              };
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="icon-button"
                          disabled={draft.options.length <= 2}
                          onClick={() =>
                            setDraft((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                options: prev.options.filter((o) => o.id !== opt.id),
                                correctOptionIds: prev.correctOptionIds.filter((id) => id !== opt.id),
                              };
                            })
                          }
                          aria-label="Usuń opcję"
                        >
                          <IconClose />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {editError ? <p className="form-error">{editError}</p> : null}
              <div className="modal-panel-actions">
                <button type="button" className="secondary modal-chip-btn" onClick={() => setEditOpen(false)}>
                  Anuluj
                </button>
                <button type="submit" className="primary panel-create-btn" disabled={savingQ}>
                  {savingQ ? "Zapisywanie…" : "Zapisz pytanie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setImportOpen(false)}>
          <div
            className="modal-panel modal-panel-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-q-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel-head">
              <div>
                <p className="modal-eyebrow">Zestaw</p>
                <h2 id="import-q-title">Wklej pytania</h2>
              </div>
              <button
                type="button"
                className="icon-button modal-close"
                onClick={() => setImportOpen(false)}
                aria-label="Zamknij"
              >
                <IconClose />
              </button>
            </div>
            <form className="stack-form exam-create-form" onSubmit={onImportQuestions}>
              <div className="import-template-row">
                <p className="muted modal-hint" style={{ margin: 0 }}>
                  Skopiuj szablon do chata, dołącz listę pytań, a gotowy JSON wklej poniżej.
                </p>
                <button
                  type="button"
                  className={`secondary modal-chip-btn panel-import-btn${templateCopied ? " is-copied" : ""}`}
                  onClick={() => void copyImportTemplate()}
                >
                  <IconCopy />
                  <span>{templateCopied ? "Skopiowano" : "Skopiuj template"}</span>
                </button>
              </div>
              <label>
                JSON z pytaniami
                <textarea
                  className="import-json-input"
                  rows={16}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={'{\n  "questions": [ … ]\n}'}
                  spellCheck={false}
                  required
                />
              </label>
              {importError ? <p className="form-error">{importError}</p> : null}
              <div className="modal-panel-actions">
                <button type="button" className="secondary modal-chip-btn" onClick={() => setImportOpen(false)}>
                  Anuluj
                </button>
                <button type="submit" className="primary panel-create-btn" disabled={importing || !importText.trim()}>
                  {importing ? "Importowanie…" : "Dodaj pytania"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDeleteSet && selected ? (
        <ConfirmDialog
          title="Usunąć zestaw?"
          message={`Zestaw „${selected.name}” zostanie usunięty wraz z wszystkimi pytaniami. Tej operacji nie da się cofnąć.`}
          confirmLabel="Usuń zestaw"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => void confirmDeleteSetAction()}
          onClose={() => setConfirmDeleteSet(false)}
        />
      ) : null}

      {confirmDeleteQuestion ? (
        <ConfirmDialog
          title="Usunąć pytanie?"
          message={`Pytanie ${confirmDeleteQuestion.number || confirmDeleteQuestion.order} zostanie usunięte z zestawu. Tej operacji nie da się cofnąć.`}
          confirmLabel="Usuń pytanie"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => void confirmDeleteQuestionAction()}
          onClose={() => setConfirmDeleteQuestion(null)}
        />
      ) : null}
    </div>
  );
}
