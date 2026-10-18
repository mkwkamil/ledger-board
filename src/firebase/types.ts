import type { AccountDef } from "../domain/accounts";
import type { JournalEntry, ResultMode } from "../domain/ledger";
import type { ActivityItem } from "../storage";

/** Dokument `examConfig/default` (globalne domyślne). */
export interface ExamConfigDoc {
  durationMinutes: number;
  emailDomain?: string | null;
}

/**
 * Terminarz kolokwium — kolekcja `exams`.
 * Student: `/exams/{id}` gdy okno czasowe otwarte i acceptingSubmissions.
 */
export interface ExamEventDoc {
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  /** Ile pytań wylosować z zestawu (domyślnie 5). */
  questionCount: number;
  /** Zestaw pytań (`taskSets`). */
  taskSetId: string;
  /** Legacy — stare testy z bezpośrednią listą zadań. */
  taskIds?: string[];
  /** false = zablokuj nowe podejścia (istniejące sesje mogą dokończyć). */
  acceptingSubmissions: boolean;
  createdAt: string;
  createdBy: string;
}

/** Bank zadań — kolekcja `tasks`. */
export interface TaskDoc {
  number: string;
  prompt: string;
  active: boolean;
  kind: "ledger" | "quiz" | "principles";
  quiz?: Array<{ question: string }>;
}

export type SessionStatus = "in_progress" | "submitted" | "expired";

/** Sesja kolokwium — kolekcja `sessions`. */
export interface SessionDoc {
  firstName: string;
  lastName: string;
  email: string;
  studentIndex: string;
  status: SessionStatus;
  startedAt: string;
  endsAt: string;
  submittedAt?: string | null;
  configSnapshot: ExamConfigDoc;
  /** Token sesji (student bez Firebase Auth). */
  sessionToken: string;
  examId: string;
  examTitle: string;
  /** Punkty z automatycznie ocenionych (zamkniętych) pytań. */
  scoreAuto?: number | null;
  /** Punkty z ręcznej oceny (open/ledger); null = jeszcze nie ocenione. */
  scoreManual?: number | null;
  /** Suma punktów możliwych w sesji. */
  scoreMax?: number | null;
  /** Czy zostały pytania wymagające ręcznej oceny. */
  needsManualReview?: boolean;
}

export interface BoardState {
  opened: AccountDef[];
  entries: JournalEntry[];
  log: ActivityItem[];
  resultMode: ResultMode;
}

export interface SessionSummary {
  revenue: number;
  cost: number;
  result: number;
  inflow: number;
  outflow: number;
}

/** Zadanie w sesji — `sessions/{id}/tasks/{taskId}`. */
export interface SessionTaskDoc {
  order: number;
  sourceTaskId?: string | null;
  sourceQuestionId?: string | null;
  number: string;
  prompt: string;
  kind: "ledger" | "quiz" | "principles" | "single" | "multiple" | "open";
  /** Wartość punktowa pytania. */
  points?: number;
  quiz?: Array<{ question: string }>;
  options?: Array<{ id: string; text: string }>;
  /** Poprawne opcje (snapshot do auto-oceny przy oddaniu). */
  correctOptionIds?: string[];
  /** Odpowiedź studenta: ID opcji lub tekst otwarty. */
  studentAnswer?: string | string[] | null;
  /** Punkty przyznane automatycznie (zamknięte). */
  autoScore?: number | null;
  /** Punkty przyznane ręcznie / ostatecznie przez prowadzącego. */
  manualScore?: number | null;
  /** Wynik auto-oceny; null = wymaga ręcznej. */
  isCorrect?: boolean | null;
  board: BoardState;
  summary?: SessionSummary | null;
}
