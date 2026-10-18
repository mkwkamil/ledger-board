import type { SessionTaskDoc } from "../firebase/types";

export function isAutoGradableKind(kind: SessionTaskDoc["kind"]): boolean {
  return kind === "single" || kind === "multiple";
}

export function isManualKind(kind: SessionTaskDoc["kind"]): boolean {
  return !isAutoGradableKind(kind);
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

/** Czy odpowiedź zamknięta jest w pełni poprawna. */
export function isClosedAnswerCorrect(
  kind: "single" | "multiple",
  studentAnswer: string | string[] | null | undefined,
  correctOptionIds: string[] | undefined,
): boolean {
  const correct = correctOptionIds ?? [];
  if (correct.length === 0) return false;

  if (kind === "single") {
    const picked = typeof studentAnswer === "string" ? studentAnswer : "";
    return picked !== "" && correct.length === 1 && picked === correct[0];
  }

  const picked = Array.isArray(studentAnswer) ? studentAnswer : [];
  return sameIdSet(picked, correct);
}

export interface TaskGradeResult {
  taskId: string;
  points: number;
  autoScore: number;
  isCorrect: boolean | null;
}

export interface SessionGradeResult {
  scoreAuto: number;
  scoreMax: number;
  needsManualReview: boolean;
  tasks: TaskGradeResult[];
}

function taskPoints(task: SessionTaskDoc): number {
  const n = task.points;
  return typeof n === "number" && n > 0 ? n : 1;
}

/** Ocenia zadania sesji: zamknięte automatycznie, reszta czeka na ręczne. */
export function gradeSessionTasks(
  tasks: Array<SessionTaskDoc & { id: string }>,
): SessionGradeResult {
  let scoreAuto = 0;
  let scoreMax = 0;
  let needsManualReview = false;
  const graded: TaskGradeResult[] = [];

  for (const task of tasks) {
    const points = taskPoints(task);
    scoreMax += points;

    if (task.kind === "single" || task.kind === "multiple") {
      const ok = isClosedAnswerCorrect(
        task.kind,
        task.studentAnswer,
        task.correctOptionIds,
      );
      const autoScore = ok ? points : 0;
      scoreAuto += autoScore;
      graded.push({
        taskId: task.id,
        points,
        autoScore,
        isCorrect: ok,
      });
    } else {
      needsManualReview = true;
      graded.push({
        taskId: task.id,
        points,
        autoScore: 0,
        isCorrect: null,
      });
    }
  }

  return { scoreAuto, scoreMax, needsManualReview, tasks: graded };
}

/** Tekst kolumny Wynik w panelu. */
export function formatSessionResult(
  session: {
    status: string;
    scoreAuto?: number | null;
    scoreMax?: number | null;
    scoreManual?: number | null;
    needsManualReview?: boolean;
  },
): string {
  if (session.status === "in_progress") return "—";
  if (session.scoreMax == null || session.scoreMax <= 0) return "—";

  const auto = session.scoreAuto ?? 0;
  const manualDone = session.scoreManual != null;
  const total = auto + (session.scoreManual ?? 0);

  if (session.needsManualReview && !manualDone) {
    return `${auto}/${session.scoreMax}`;
  }
  return `${total}/${session.scoreMax}`;
}

/** Czy sesja ma już zamkniętą ocenę (auto + ewentualne ręczne). */
export function isGradingComplete(session: {
  needsManualReview?: boolean;
  scoreManual?: number | null;
  scoreMax?: number | null;
}): boolean {
  if (session.scoreMax == null) return false;
  if (session.needsManualReview) return session.scoreManual != null;
  return session.scoreManual != null;
}
