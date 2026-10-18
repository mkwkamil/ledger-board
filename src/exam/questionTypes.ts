/** Typ pytania w zestawie. */
export type SetQuestionKind = "ledger" | "single" | "multiple" | "open";

export interface QuestionOption {
  id: string;
  text: string;
}

/** Pytanie w zestawie — `taskSets/{setId}/questions/{id}`. */
export interface SetQuestionDoc {
  order: number;
  kind: SetQuestionKind;
  prompt: string;
  /** Numer / etykieta (np. 1.5 dla ledger). */
  number: string;
  /** Wartość punktowa (domyślnie 1). */
  points: number;
  /** Opcje dla single/multiple. */
  options?: QuestionOption[];
  /** ID poprawnych opcji (1 dla single, ≥1 dla multiple). */
  correctOptionIds?: string[];
  /** Opcjonalne powiązanie z bankiem `tasks`. */
  sourceTaskId?: string | null;
}

export function normalizePoints(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(100, Math.round(n * 100) / 100);
}

export interface TaskSetDoc {
  name: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type TaskSet = TaskSetDoc & { id: string };
export type SetQuestion = SetQuestionDoc & { id: string };

export function questionKindLabel(kind: SetQuestionKind): string {
  if (kind === "ledger") return "Obliczeniowe";
  if (kind === "single") return "Jednokrotny wybór";
  if (kind === "multiple") return "Wielokrotny wybór";
  return "Otwarte";
}

export function newOptionId(): string {
  return `o_${Math.random().toString(36).slice(2, 10)}`;
}
