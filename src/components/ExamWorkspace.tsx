import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { summarize } from "../domain/ledger";
import { isChoiceQuestion, isClosedQuestion } from "../exam/sessionTasks";
import { normalizePoints } from "../exam/questionTypes";
import { Board } from "./Board";
import { AccountDialog, ConfirmDialog, EntryDialog, LogDialog } from "./Dialogs";
import { IconChevronLeft, IconLog, IconPanel, IconRedo, IconReset, IconUndo } from "./Icons";
import { LessonPanel, SummaryPanel } from "./Panels";
import { RightRail } from "./Sidebar";
import { getActiveTask, reducer, type AppState, type Task } from "../state";

type DialogName = "account" | "entry" | "log" | null;

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => void;
}

export interface GradingState {
  /** Przyznane punkty per taskId; null = jeszcze nie wpisane. */
  grades: Record<string, number | null>;
  onGradeChange: (taskId: string, value: number | null) => void;
  /** Tryb podglądu odpowiedzi zamkniętych (kolory). */
  reviewAnswers?: boolean;
  /** Blokada edycji punktów (po zakończeniu sprawdzania). */
  readOnlyGrades?: boolean;
}

interface ExamWorkspaceProps {
  initialTasks: Task[];
  readOnly?: boolean;
  /** Gdy true (panel), pokazuje też numer z banku zadań, np. „Zadanie 2 · 1.5”. */
  showBankNumbers?: boolean;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onTasksChange?: (tasks: Task[]) => void;
  /** Stopka lewego sidebara (np. zakończenie testu). */
  sidebarFooter?: ReactNode;
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
  /** Tryb oceniania (panel prowadzącego). */
  grading?: GradingState;
}

function sessionTaskIndex(index: number): number {
  return index + 1;
}

function buildState(tasks: Task[]): AppState {
  return {
    tasks,
    activeTaskId: tasks[0]?.id ?? null,
    leftOpen: true,
    rightOpen: true,
    notice: null,
    activeEntryId: null,
  };
}

function formatScoreLabel(earned: number | null | undefined, max: number): string {
  if (earned == null || Number.isNaN(earned)) return `—/${max}`;
  return `${earned}/${max}`;
}

function ChoiceReviewPanel({ task }: { task: Task }) {
  const options = task.options ?? [];
  const correct = new Set(task.correctOptionIds ?? []);
  const selected =
    task.kind === "multiple"
      ? new Set(Array.isArray(task.studentAnswer) ? task.studentAnswer : [])
      : new Set(typeof task.studentAnswer === "string" && task.studentAnswer ? [task.studentAnswer] : []);

  return (
    <div className="exam-answer-panel exam-answer-review">
      <p className="exam-answer-hint">
        {task.kind === "single" ? "Jednokrotny wybór — podgląd odpowiedzi" : "Wielokrotny wybór — podgląd odpowiedzi"}
      </p>
      <ul className="exam-option-list">
        {options.map((opt) => {
          const isSelected = selected.has(opt.id);
          const isCorrect = correct.has(opt.id);
          let tone = "is-neutral";
          let mark = "";
          if (isSelected && isCorrect) {
            tone = "is-review-ok";
            mark = "✓";
          } else if (isSelected && !isCorrect) {
            tone = "is-review-bad";
            mark = "✗";
          } else if (!isSelected && isCorrect) {
            tone = "is-review-missed";
            mark = "○";
          }
          return (
            <li key={opt.id}>
              <div className={`exam-option-item exam-option-review ${tone}`}>
                <span className="exam-option-mark" aria-hidden="true">
                  {mark || "·"}
                </span>
                <span>{opt.text}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="exam-review-legend muted">
        <span className="leg-ok">✓ zaznaczone poprawnie</span>
        <span className="leg-bad">✗ zaznaczone błędnie</span>
        <span className="leg-missed">○ pominięta poprawna</span>
      </p>
    </div>
  );
}

function ClosedAnswerPanel({
  task,
  readOnly,
  onAnswer,
}: {
  task: Task;
  readOnly: boolean;
  onAnswer: (answer: string | string[] | null) => void;
}) {
  if (task.kind === "open") {
    const value = typeof task.studentAnswer === "string" ? task.studentAnswer : "";
    return (
      <div className="exam-answer-panel">
        <label className="exam-answer-label">
          Odpowiedź studenta
          <textarea
            className="exam-open-answer"
            rows={8}
            value={value}
            disabled={readOnly}
            placeholder="Brak odpowiedzi"
            onChange={(e) => onAnswer(e.target.value)}
          />
        </label>
      </div>
    );
  }

  const options = task.options ?? [];
  const selected =
    task.kind === "multiple"
      ? Array.isArray(task.studentAnswer)
        ? task.studentAnswer
        : []
      : typeof task.studentAnswer === "string"
        ? task.studentAnswer
        : "";

  function toggleMultiple(optionId: string) {
    const current = Array.isArray(task.studentAnswer) ? task.studentAnswer : [];
    if (current.includes(optionId)) {
      onAnswer(current.filter((id) => id !== optionId));
    } else {
      onAnswer([...current, optionId]);
    }
  }

  return (
    <div className="exam-answer-panel">
      <p className="exam-answer-hint">
        {task.kind === "single" ? "Wybierz jedną odpowiedź" : "Zaznacz wszystkie poprawne odpowiedzi"}
      </p>
      <ul className="exam-option-list">
        {options.map((opt) => {
          const checked =
            task.kind === "multiple" ? selected.includes(opt.id) : selected === opt.id;
          return (
            <li key={opt.id}>
              <label className={`exam-option-item${checked ? " is-checked" : ""}`}>
                <input
                  type={task.kind === "single" ? "radio" : "checkbox"}
                  name={`q-${task.id}`}
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => {
                    if (task.kind === "multiple") toggleMultiple(opt.id);
                    else onAnswer(opt.id);
                  }}
                />
                <span>{opt.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ExamWorkspace({
  initialTasks,
  readOnly = false,
  showBankNumbers = false,
  saveStatus = "idle",
  onTasksChange,
  sidebarFooter,
  headerExtra,
  footerExtra,
  grading,
}: ExamWorkspaceProps) {
  const [state, dispatch] = useReducer(reducer, initialTasks, buildState);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [entryPreset, setEntryPreset] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const skipFirstNotify = useRef(true);

  const task = getActiveTask(state);
  const activeIndex = task ? state.tasks.findIndex((item) => item.id === task.id) : -1;
  const summary = summarize(task?.opened ?? [], task?.entries ?? [], task?.resultMode ?? "nature");
  const closed = task ? isClosedQuestion(task.kind) : false;
  const choice = task ? isChoiceQuestion(task.kind) : false;
  const showLedgerUi = task ? !closed : true;
  const gradingOn = !!grading;
  const taskPoints = task ? normalizePoints(task.points) : 1;
  const currentGrade = task && grading ? grading.grades[task.id] : null;

  useEffect(() => {
    if (!onTasksChange) return;
    if (skipFirstNotify.current) {
      skipFirstNotify.current = false;
      return;
    }
    onTasksChange(state.tasks);
  }, [state.tasks, onTasksChange]);

  const activeGradeValue = task && grading ? grading.grades[task.id] : null;
  useEffect(() => {
    if (!task || !grading) {
      setScoreDraft("");
      return;
    }
    setScoreDraft(activeGradeValue == null ? "" : String(activeGradeValue));
  }, [task?.id, activeGradeValue, grading, task]);

  function openEntry(presetAccountCode = "") {
    if (readOnly) return;
    setEntryPreset(presetAccountCode);
    setDialog("entry");
  }

  function commitScoreDraft() {
    if (!task || !grading || grading.readOnlyGrades) return;
    const raw = scoreDraft.trim().replace(",", ".");
    if (raw === "") {
      grading.onGradeChange(task.id, null);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setScoreDraft(currentGrade == null ? "" : String(currentGrade));
      return;
    }
    const clamped = Math.max(0, Math.min(taskPoints, Math.round(n * 100) / 100));
    grading.onGradeChange(task.id, clamped);
    setScoreDraft(String(clamped));
  }

  return (
    <div
      className={`app exam-app ${state.leftOpen ? "" : "left-closed"} ${state.rightOpen && showLedgerUi ? "" : "right-closed"}`}
    >
      <aside className={`sidebar ${state.leftOpen ? "" : "collapsed"}`}>
        {state.leftOpen ? (
          <div className="sidebar-exam-body">
            <div className="sidebar-top">
              <div className="brand">
                <p className="eyebrow">Zadania sesji</p>
              </div>
              <button
                type="button"
                className="icon-button ghost"
                onClick={() => dispatch({ type: "toggle-left" })}
                aria-label="Ukryj listę zadań"
                title="Ukryj listę zadań"
              >
                <IconChevronLeft />
              </button>
            </div>
            <ul className="side-list lessons exam-task-list">
              {state.tasks.map((item, index) => {
                const max = normalizePoints(item.points);
                const earned = grading ? grading.grades[item.id] : item.manualScore;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={state.activeTaskId === item.id ? "is-current" : ""}
                      onClick={() => dispatch({ type: "select-task", id: item.id })}
                    >
                      <span className="exam-task-side-main">
                        <strong>{`Zadanie ${sessionTaskIndex(index)}`}</strong>
                        {showBankNumbers && item.number.trim() ? <span>Nr {item.number.trim()}</span> : null}
                      </span>
                      {gradingOn || item.manualScore != null || item.autoScore != null ? (
                        <span className="exam-task-side-score">{formatScoreLabel(earned, max)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {headerExtra}
            {sidebarFooter ? <div className="exam-sidebar-footer">{sidebarFooter}</div> : null}
          </div>
        ) : (
          <button
            type="button"
            className="icon-button rail"
            onClick={() => dispatch({ type: "toggle-left" })}
            aria-label="Pokaż listę zadań"
            title="Pokaż listę zadań"
          >
            <IconPanel />
          </button>
        )}
      </aside>

      <main>
        <header className="topbar">
          <div className="title-block">
            <div className="exam-title-row">
              {task && activeIndex >= 0 ? (
                <h2>
                  <span className="exam-task-heading">{`Zadanie ${sessionTaskIndex(activeIndex)}`}</span>
                  {showBankNumbers && task.number.trim() ? (
                    <span className="exam-task-bank-no"> · {task.number.trim()}</span>
                  ) : null}
                </h2>
              ) : (
                <h2>Brak zadania</h2>
              )}
              {gradingOn && task ? (
                <div className="exam-grade-input">
                  <label>
                    <span className="sr-only">Punkty uzyskane</span>
                    <input
                      type="number"
                      min={0}
                      max={taskPoints}
                      step={0.5}
                      inputMode="decimal"
                      value={scoreDraft}
                      disabled={grading.readOnlyGrades}
                      placeholder="0"
                      onChange={(e) => setScoreDraft(e.target.value)}
                      onBlur={commitScoreDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </label>
                  <span className="exam-grade-max">/ {taskPoints}</span>
                </div>
              ) : null}
              {showLedgerUi ? (
                <button
                  type="button"
                  className="icon-button exam-log-btn"
                  onClick={() => setDialog("log")}
                  disabled={!task}
                  aria-label="Log operacji"
                  title="Log operacji"
                >
                  <IconLog />
                </button>
              ) : null}
            </div>
            {saveStatus === "saving" ? <p className="muted">Zapisywanie…</p> : null}
            {saveStatus === "saved" ? <p className="muted">Zapisano</p> : null}
            {saveStatus === "error" ? <p className="form-error">Błąd zapisu</p> : null}
          </div>
          {!readOnly && showLedgerUi ? (
            <div className="row-actions wrap">
              <button type="button" className="primary" onClick={() => setDialog("account")} disabled={!task}>
                Otwórz konto
              </button>
              <button type="button" className="primary" onClick={() => openEntry()} disabled={!task}>
                Nowa operacja
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => dispatch({ type: "undo" })}
                disabled={!task || task.past.length === 0}
                aria-label="Cofnij"
                title="Cofnij"
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => dispatch({ type: "redo" })}
                disabled={!task || task.future.length === 0}
                aria-label="Ponów"
                title="Ponów"
              >
                <IconRedo />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (!task) return;
                  setConfirm({
                    title: "Resetuj zadanie",
                    message: "Wyczyścić konta i zapisy na tablicy tego zadania?",
                    confirmLabel: "Resetuj",
                    danger: true,
                    action: () => dispatch({ type: "reset-task" }),
                  });
                }}
                disabled={!task}
                aria-label="Resetuj zadanie"
                title="Resetuj zadanie"
              >
                <IconReset />
              </button>
            </div>
          ) : null}
        </header>
        {task ? <LessonPanel task={task} /> : null}
        {task && choice && grading?.reviewAnswers ? <ChoiceReviewPanel task={task} /> : null}
        {task && closed && !(choice && grading?.reviewAnswers) ? (
          <ClosedAnswerPanel
            task={task}
            readOnly={readOnly}
            onAnswer={(answer) => dispatch({ type: "set-student-answer", answer })}
          />
        ) : null}
        {showLedgerUi ? (
          <Board
            opened={task?.opened ?? []}
            entries={task?.entries ?? []}
            activeEntryId={state.activeEntryId}
            readOnly={readOnly}
            onClose={(code) => dispatch({ type: "close-account", code })}
            onDeleteEntry={(id) => dispatch({ type: "delete-entry", id })}
            onUpdateEntryLine={(entryId, lineIndex, amount) =>
              dispatch({ type: "update-entry-line", entryId, lineIndex, amount })
            }
            onOpen={() => setDialog("account")}
            onAccountClick={(code) => openEntry(code)}
          />
        ) : null}
        {footerExtra}
      </main>

      {showLedgerUi ? (
        <RightRail open={state.rightOpen} onToggle={() => dispatch({ type: "toggle-right" })}>
          <SummaryPanel
            summary={summary}
            mode={task?.resultMode ?? "nature"}
            readOnly={readOnly}
            onMode={(mode) => dispatch({ type: "set-result-mode", mode })}
          />
        </RightRail>
      ) : null}

      {state.notice ? (
        <div className="notice" role="status">
          <p>{state.notice}</p>
          <button type="button" onClick={() => dispatch({ type: "dismiss-notice" })}>
            Dobrze
          </button>
        </div>
      ) : null}

      {!readOnly && dialog === "account" ? (
        <AccountDialog
          prompt={task?.prompt}
          onClose={() => setDialog(null)}
          onOpen={(account) => dispatch({ type: "open-account", account })}
        />
      ) : null}
      {!readOnly && dialog === "entry" ? (
        <EntryDialog
          opened={task?.opened ?? []}
          presetAccountCode={entryPreset}
          prompt={task?.prompt}
          onClose={() => setDialog(null)}
          onPost={(entry) => dispatch({ type: "post-entry", entry })}
        />
      ) : null}
      {dialog === "log" ? (
        <LogDialog
          log={task?.log ?? []}
          activeEntryId={state.activeEntryId}
          liveEntryIds={new Set((task?.entries ?? []).map((entry) => entry.id))}
          onSelect={(id) => dispatch({ type: "select-entry", id })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
