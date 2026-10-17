import type { AccountDef } from "./domain/accounts";
import type { JournalEntry, ResultMode } from "./domain/ledger";
import { LESSONS } from "./data/lessons";
import {
  loadWorkspace,
  saveWorkspace,
  type ActivityItem,
  type BoardSnap,
  type StoredTask,
  type Workspace,
} from "./storage";

export type Task = StoredTask;
export type { ActivityItem };

export interface AppState {
  tasks: Task[];
  activeTaskId: string | null;
  leftOpen: boolean;
  rightOpen: boolean;
  notice: string | null;
  activeEntryId: string | null;
}

export type Action =
  | { type: "select-task"; id: string }
  | { type: "create-task"; number: string; prompt: string }
  | { type: "update-task"; id: string; number: string; prompt: string }
  | { type: "delete-task"; id: string }
  | { type: "set-result-mode"; mode: ResultMode }
  | { type: "open-account"; account: AccountDef }
  | { type: "close-account"; code: string }
  | { type: "post-entry"; entry: Omit<JournalEntry, "id"> }
  | { type: "delete-entry"; id: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset-task" }
  | { type: "reset-all-tasks" }
  | { type: "toggle-left" }
  | { type: "toggle-right" }
  | { type: "select-entry"; id: string | null }
  | { type: "notice"; message: string }
  | { type: "dismiss-notice" };

function nextOperationId(entries: JournalEntry[]): string {
  let serial = entries.length + 1;
  let id = `op-${serial}`;
  while (entries.some((entry) => entry.id === id)) {
    serial += 1;
    id = `op-${serial}`;
  }
  return id;
}

function nextTaskId(tasks: Task[]): string {
  let serial = tasks.length + 1;
  let id = `task-${serial}`;
  while (tasks.some((task) => task.id === id)) {
    serial += 1;
    id = `task-${serial}`;
  }
  return id;
}

function suggestNumber(tasks: Task[]): string {
  const nums = tasks.map((task) => Number(task.number)).filter((value) => Number.isFinite(value) && value > 0);
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

function seedTask(lesson: (typeof LESSONS)[number]): Task {
  return {
    id: `builtin-${lesson.id}`,
    number: lesson.number,
    title: "",
    prompt: lesson.prompt,
    kind: lesson.kind,
    quiz: lesson.quiz?.map((item) => ({ question: item.question })),
    opened: [],
    entries: [],
    log: [],
    resultMode: "nature",
    past: [],
    future: [],
  };
}

function seedTasks(): Task[] {
  return LESSONS.map(seedTask);
}

function migrateLog(task: Task): ActivityItem[] {
  if (Array.isArray(task.log) && task.log.length > 0) return task.log;
  return (task.entries ?? []).map((entry) => ({
    id: `log-mig-${entry.id}`,
    kind: "post-entry" as const,
    entryId: entry.id,
    description: entry.description,
    period: entry.period,
    opening: entry.opening,
    lines: entry.lines,
  }));
}

function hydrateTask(task: Task): Task {
  const log = migrateLog(task);
  return {
    ...task,
    past: (task.past ?? []).map((snap) => ({
      opened: snap.opened ?? [],
      entries: snap.entries ?? [],
      log: snap.log ?? [],
    })),
    future: (task.future ?? []).map((snap) => ({
      opened: snap.opened ?? [],
      entries: snap.entries ?? [],
      log: snap.log ?? [],
    })),
    opened: task.opened ?? [],
    entries: task.entries ?? [],
    log,
    resultMode: task.resultMode === "function" ? "function" : "nature",
  };
}

/** Odświeża treść zadań wbudowanych z LESSONS, zachowuje tablice i własne zadania. */
function mergeWithSeed(stored: Task[]): Task[] {
  const custom = stored.filter((task) => !task.id.startsWith("builtin-")).map(hydrateTask);
  const previous = new Map(stored.map((task) => [task.id, task]));
  const builtins = LESSONS.map((lesson) => {
    const seeded = seedTask(lesson);
    const prev = previous.get(seeded.id);
    if (!prev) return seeded;
    return hydrateTask({
      ...seeded,
      opened: prev.opened ?? [],
      entries: prev.entries ?? [],
      log: prev.log ?? [],
      past: prev.past ?? [],
      future: prev.future ?? [],
      resultMode: prev.resultMode === "function" ? "function" : "nature",
    });
  });
  return [...builtins, ...custom];
}

function emptyBoard(): BoardSnap {
  return { opened: [], entries: [], log: [] };
}

function snapOf(task: Task): BoardSnap {
  return { opened: task.opened, entries: task.entries, log: task.log };
}

function withHistory(task: Task, next: BoardSnap): Task {
  return {
    ...task,
    opened: next.opened,
    entries: next.entries,
    log: next.log,
    past: [...task.past, snapOf(task)].slice(-80),
    future: [],
  };
}

function nextLogId(log: ActivityItem[]): string {
  let serial = log.length + 1;
  let id = `log-${serial}`;
  while (log.some((item) => item.id === id)) {
    serial += 1;
    id = `log-${serial}`;
  }
  return id;
}

function appendLog(log: ActivityItem[], item: Omit<ActivityItem, "id">): ActivityItem[] {
  return [...log, { ...item, id: nextLogId(log) }];
}

function active(state: AppState): Task | null {
  return state.tasks.find((task) => task.id === state.activeTaskId) ?? null;
}

function patchActive(state: AppState, updater: (task: Task) => Task, extras: Partial<AppState> = {}): AppState {
  const current = active(state);
  if (!current) return { ...state, ...extras };
  return {
    ...state,
    ...extras,
    tasks: state.tasks.map((task) => (task.id === current.id ? updater(task) : task)),
  };
}

function withAccount(opened: AccountDef[], account: AccountDef): AccountDef[] | string {
  const existing = opened.find((item) => item.code === account.code);
  if (existing) {
    return `Konto ${account.code} jest już otwarte jako „${existing.name}”. Zamknij je, jeśli chcesz użyć innej nazwy.`;
  }
  return [...opened, account];
}

export function createInitialState(): AppState {
  const stored = loadWorkspace();
  if (stored?.version === 2 && Array.isArray(stored.tasks) && stored.tasks.length > 0) {
    const tasks = mergeWithSeed(stored.tasks);
    const activeStillThere = tasks.some((task) => task.id === stored.activeTaskId);
    return {
      tasks,
      activeTaskId: activeStillThere ? stored.activeTaskId : tasks[0]?.id ?? null,
      leftOpen: stored.leftOpen ?? true,
      rightOpen: stored.rightOpen ?? true,
      notice: null,
      activeEntryId: null,
    };
  }
  const tasks = seedTasks();
  return {
    tasks,
    activeTaskId: tasks[0]?.id ?? null,
    leftOpen: true,
    rightOpen: true,
    notice: null,
    activeEntryId: null,
  };
}

export function persistState(state: AppState): void {
  const workspace: Workspace = {
    version: 2,
    tasks: state.tasks,
    activeTaskId: state.activeTaskId,
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
  };
  saveWorkspace(workspace);
}

export function getActiveTask(state: AppState): Task | null {
  return active(state);
}

export function nextSuggestedNumber(state: AppState): string {
  return suggestNumber(state.tasks);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "select-task":
      if (action.id === state.activeTaskId) return state;
      if (!state.tasks.some((task) => task.id === action.id)) return state;
      return { ...state, activeTaskId: action.id, activeEntryId: null, notice: null };
    case "create-task": {
      const number = action.number.trim() || suggestNumber(state.tasks);
      const prompt = action.prompt.trim();
      const task: Task = {
        id: nextTaskId(state.tasks),
        number,
        title: "",
        prompt,
        kind: "ledger",
        opened: [],
        entries: [],
        log: [],
        resultMode: "nature",
        past: [],
        future: [],
      };
      return {
        ...state,
        tasks: [...state.tasks, task],
        activeTaskId: task.id,
        activeEntryId: null,
        notice: null,
      };
    }
    case "update-task": {
      const number = action.number.trim();
      if (!number) return { ...state, notice: "Podaj numer lub nazwę zadania." };
      return {
        ...state,
        notice: null,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, number, title: "", prompt: action.prompt.trim() } : task,
        ),
      };
    }
    case "delete-task": {
      const remaining = state.tasks.filter((task) => task.id !== action.id);
      if (remaining.length === state.tasks.length) return state;
      const activeTaskId =
        state.activeTaskId === action.id ? remaining[0]?.id ?? null : state.activeTaskId;
      return { ...state, tasks: remaining, activeTaskId, activeEntryId: null, notice: null };
    }
    case "set-result-mode":
      return patchActive(state, (task) => ({ ...task, resultMode: action.mode }));
    case "open-account": {
      const current = active(state);
      if (!current) return state;
      const opened = withAccount(current.opened, action.account);
      if (typeof opened === "string") return { ...state, notice: opened };
      return patchActive(
        state,
        (task) =>
          withHistory(task, {
            opened,
            entries: task.entries,
            log: appendLog(task.log, {
              kind: "open-account",
              accountCode: action.account.code,
              accountName: action.account.name,
            }),
          }),
        { notice: null },
      );
    }
    case "close-account": {
      const current = active(state);
      if (!current) return state;
      return patchActive(
        state,
        (task) => {
          const closing = task.opened.find((account) => account.code === action.code);
          const removed = task.entries.filter((entry) => entry.lines.some((line) => line.accountCode === action.code));
          let nextLog = task.log;
          for (const entry of removed) {
            nextLog = appendLog(nextLog, {
              kind: "delete-entry",
              entryId: entry.id,
              description: entry.description,
              period: entry.period,
              opening: entry.opening,
              lines: entry.lines,
            });
          }
          nextLog = appendLog(nextLog, {
            kind: "close-account",
            accountCode: action.code,
            accountName: closing?.name ?? action.code,
          });
          return withHistory(task, {
            opened: task.opened.filter((account) => account.code !== action.code),
            entries: task.entries.filter((entry) => !entry.lines.some((line) => line.accountCode === action.code)),
            log: nextLog,
          });
        },
        { notice: null, activeEntryId: null },
      );
    }
    case "post-entry": {
      const current = active(state);
      if (!current) return state;
      if (action.entry.lines.length === 0) {
        return { ...state, notice: "Dodaj przynajmniej jedną pozycję z kontem, stroną i kwotą." };
      }
      const missing = action.entry.lines.find((line) => !current.opened.some((account) => account.code === line.accountCode));
      if (missing) return { ...state, notice: `Najpierw otwórz konto ${missing.accountCode}.` };
      const entryId = nextOperationId(current.entries);
      return patchActive(
        state,
        (task) =>
          withHistory(task, {
            opened: task.opened,
            entries: [
              ...task.entries,
              {
                id: entryId,
                description: action.entry.description,
                period: action.entry.period,
                lines: action.entry.lines,
                opening: action.entry.opening,
              },
            ],
            log: appendLog(task.log, {
              kind: "post-entry",
              entryId,
              description: action.entry.description,
              period: action.entry.period,
              opening: action.entry.opening,
              lines: action.entry.lines,
            }),
          }),
        { notice: null, activeEntryId: null },
      );
    }
    case "delete-entry": {
      const current = active(state);
      if (!current) return state;
      const entry = current.entries.find((item) => item.id === action.id);
      if (!entry) return state;
      return patchActive(
        state,
        (task) =>
          withHistory(task, {
            opened: task.opened,
            entries: task.entries.filter((item) => item.id !== action.id),
            log: appendLog(task.log, {
              kind: "delete-entry",
              entryId: entry.id,
              description: entry.description,
              period: entry.period,
              opening: entry.opening,
              lines: entry.lines,
            }),
          }),
        { activeEntryId: null },
      );
    }
    case "undo": {
      const current = active(state);
      if (!current || current.past.length === 0) return state;
      const previous = current.past[current.past.length - 1];
      return patchActive(
        state,
        (task) => ({
          ...task,
          opened: previous.opened,
          entries: previous.entries,
          log: previous.log ?? [],
          past: task.past.slice(0, -1),
          future: [snapOf(task), ...task.future].slice(0, 80),
        }),
        { activeEntryId: null },
      );
    }
    case "redo": {
      const current = active(state);
      if (!current || current.future.length === 0) return state;
      const next = current.future[0];
      return patchActive(
        state,
        (task) => ({
          ...task,
          opened: next.opened,
          entries: next.entries,
          log: next.log ?? [],
          past: [...task.past, snapOf(task)].slice(-80),
          future: task.future.slice(1),
        }),
        { activeEntryId: null },
      );
    }
    case "reset-task":
      return patchActive(state, (task) => withHistory(task, emptyBoard()), { activeEntryId: null, notice: null });
    case "reset-all-tasks":
      return {
        ...state,
        activeEntryId: null,
        notice: null,
        tasks: state.tasks.map((task) => ({
          ...task,
          opened: [],
          entries: [],
          log: [],
          past: [],
          future: [],
        })),
      };
    case "toggle-left":
      return { ...state, leftOpen: !state.leftOpen };
    case "toggle-right":
      return { ...state, rightOpen: !state.rightOpen };
    case "select-entry":
      return { ...state, activeEntryId: state.activeEntryId === action.id ? null : action.id };
    case "notice":
      return { ...state, notice: action.message };
    case "dismiss-notice":
      return { ...state, notice: null };
    default:
      return state;
  }
}
