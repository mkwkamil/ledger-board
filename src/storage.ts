import type { AccountDef } from "./domain/accounts";
import type { JournalEntry, JournalLine, ResultMode } from "./domain/ledger";

export type ActivityKind = "open-account" | "close-account" | "post-entry" | "delete-entry";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  entryId?: string;
  accountCode?: string;
  accountName?: string;
  description?: string;
  period?: string;
  opening?: boolean;
  lines?: JournalLine[];
}

export interface BoardSnap {
  opened: AccountDef[];
  entries: JournalEntry[];
  log: ActivityItem[];
}

export interface StoredTask {
  id: string;
  number: string;
  title: string;
  prompt: string;
  kind: "ledger" | "quiz" | "principles";
  quiz?: Array<{ question: string }>;
  opened: AccountDef[];
  entries: JournalEntry[];
  log: ActivityItem[];
  resultMode: ResultMode;
  past: BoardSnap[];
  future: BoardSnap[];
}

export interface Workspace {
  version: 2;
  tasks: StoredTask[];
  activeTaskId: string | null;
  leftOpen: boolean;
  rightOpen: boolean;
}

const WORKSPACE_KEY = "entryflow.workspace.v2";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadWorkspace(): Workspace | null {
  return read<Workspace>(WORKSPACE_KEY);
}

export function saveWorkspace(workspace: Workspace): void {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}
