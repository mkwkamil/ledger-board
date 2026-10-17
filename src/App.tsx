import { useEffect, useReducer, useState } from "react";
import { summarize } from "./domain/ledger";
import { Board } from "./components/Board";
import { AccountDialog, ConfirmDialog, EntryDialog, LogDialog, TaskDialog } from "./components/Dialogs";
import { IconEdit, IconLog, IconRedo, IconReset, IconTrash, IconUndo } from "./components/Icons";
import { LessonPanel, SummaryPanel } from "./components/Panels";
import { RightRail, Sidebar, taskLabel } from "./components/Sidebar";
import { createInitialState, getActiveTask, nextSuggestedNumber, persistState, reducer } from "./state";

type DialogName = "account" | "entry" | "task-create" | "task-edit" | "log" | null;

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => void;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [entryPreset, setEntryPreset] = useState("");
  const [query, setQuery] = useState("");
  const task = getActiveTask(state);
  const summary = summarize(task?.opened ?? [], task?.entries ?? [], task?.resultMode ?? "nature");

  useEffect(() => {
    persistState(state);
  }, [state]);

  function openEntry(presetAccountCode = "") {
    setEntryPreset(presetAccountCode);
    setDialog("entry");
  }

  return (
    <div className={`app ${state.leftOpen ? "" : "left-closed"} ${state.rightOpen ? "" : "right-closed"}`}>
      <Sidebar
        open={state.leftOpen}
        tasks={state.tasks}
        activeTaskId={state.activeTaskId}
        query={query}
        onQuery={setQuery}
        onToggle={() => dispatch({ type: "toggle-left" })}
        onNew={() => setDialog("task-create")}
        onSelect={(id) => dispatch({ type: "select-task", id })}
        onResetAll={() =>
          setConfirm({
            title: "Resetuj wszystkie zadania",
            message: "Wyczyścić tablice wszystkich zadań? Konta, zapisy i logi zostaną usunięte. Lista zadań zostanie.",
            confirmLabel: "Resetuj wszystko",
            danger: true,
            action: () => dispatch({ type: "reset-all-tasks" }),
          })
        }
      />
      <main>
        <header className="topbar">
          <div className="title-block">
            {task ? (
              <h2>{taskLabel(task)}</h2>
            ) : (
              <>
                <h2>Brak zadania</h2>
                <p>Utwórz nowe zadanie albo wybierz je z listy po lewej.</p>
              </>
            )}
          </div>
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
              onClick={() => setDialog("log")}
              disabled={!task}
              aria-label="Log operacji"
              title="Log operacji"
            >
              <IconLog />
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
                  message: "Czy na pewno chcesz zresetować zadanie? Konta i zapisy na tablicy zostaną wyczyszczone.",
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
            <button
              type="button"
              className="icon-button"
              onClick={() => setDialog("task-edit")}
              disabled={!task}
              aria-label="Edytuj zadanie"
              title="Edytuj zadanie"
            >
              <IconEdit />
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={() => {
                if (!task) return;
                setConfirm({
                  title: "Usuń zadanie",
                  message: `Usunąć zadanie ${task.number}? Tej operacji nie da się cofnąć z listy zadań.`,
                  confirmLabel: "Usuń zadanie",
                  danger: true,
                  action: () => dispatch({ type: "delete-task", id: task.id }),
                });
              }}
              disabled={!task}
              aria-label="Usuń zadanie"
              title="Usuń zadanie"
            >
              <IconTrash />
            </button>
          </div>
        </header>
        {task ? <LessonPanel task={task} /> : null}
        <Board
          opened={task?.opened ?? []}
          entries={task?.entries ?? []}
          activeEntryId={state.activeEntryId}
          onClose={(code) => dispatch({ type: "close-account", code })}
          onDeleteEntry={(id) => dispatch({ type: "delete-entry", id })}
          onOpen={() => setDialog("account")}
          onAccountClick={(code) => openEntry(code)}
        />
      </main>
      <RightRail open={state.rightOpen} onToggle={() => dispatch({ type: "toggle-right" })}>
        <SummaryPanel
          summary={summary}
          mode={task?.resultMode ?? "nature"}
          onMode={(mode) => dispatch({ type: "set-result-mode", mode })}
        />
      </RightRail>
      {state.notice ? (
        <div className="notice" role="status">
          <p>{state.notice}</p>
          <button type="button" onClick={() => dispatch({ type: "dismiss-notice" })}>
            Dobrze
          </button>
        </div>
      ) : null}
      {dialog === "account" ? <AccountDialog onClose={() => setDialog(null)} onOpen={(account) => dispatch({ type: "open-account", account })} /> : null}
      {dialog === "entry" ? (
        <EntryDialog
          opened={task?.opened ?? []}
          presetAccountCode={entryPreset}
          onClose={() => setDialog(null)}
          onPost={(entry) => dispatch({ type: "post-entry", entry })}
        />
      ) : null}
      {dialog === "task-create" ? (
        <TaskDialog
          mode="create"
          initialNumber={nextSuggestedNumber(state)}
          initialPrompt=""
          onClose={() => setDialog(null)}
          onSubmit={(values) => dispatch({ type: "create-task", ...values })}
        />
      ) : null}
      {dialog === "task-edit" && task ? (
        <TaskDialog
          mode="edit"
          initialNumber={task.number}
          initialPrompt={task.prompt}
          onClose={() => setDialog(null)}
          onSubmit={(values) => dispatch({ type: "update-task", id: task.id, ...values })}
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
