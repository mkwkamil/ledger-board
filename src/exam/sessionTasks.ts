import { summarize } from "../domain/ledger";
import type { BoardState, SessionSummary, SessionTaskDoc } from "../firebase/types";
import { normalizePoints } from "./questionTypes";
import type { Task } from "../state";

export function sessionTaskToTask(doc: SessionTaskDoc & { id: string }): Task {
  const board = doc.board ?? {
    opened: [],
    entries: [],
    log: [],
    resultMode: "nature" as const,
  };
  const points = normalizePoints(doc.points);
  const isClosed = doc.kind === "single" || doc.kind === "multiple";
  const autoScore = doc.autoScore ?? null;
  const manualScore =
    doc.manualScore != null
      ? doc.manualScore
      : isClosed && autoScore != null
        ? autoScore
        : null;

  return {
    id: doc.id,
    number: doc.number,
    title: "",
    prompt: doc.prompt,
    kind: doc.kind,
    quiz: doc.quiz,
    options: doc.options,
    studentAnswer: doc.studentAnswer ?? null,
    points,
    correctOptionIds: doc.correctOptionIds,
    autoScore,
    manualScore,
    isCorrect: doc.isCorrect ?? null,
    opened: board.opened ?? [],
    entries: board.entries ?? [],
    log: board.log ?? [],
    resultMode: board.resultMode === "function" ? "function" : "nature",
    past: [],
    future: [],
  };
}

export function taskToBoard(task: Task): BoardState {
  return {
    opened: task.opened,
    entries: task.entries,
    log: task.log,
    resultMode: task.resultMode,
  };
}

export function taskToSummary(task: Task): SessionSummary {
  const s = summarize(task.opened, task.entries, task.resultMode);
  return {
    revenue: s.revenue,
    cost: s.cost,
    result: s.result,
    inflow: s.inflow,
    outflow: s.outflow,
  };
}

export function isClosedQuestion(kind: Task["kind"]): boolean {
  return kind === "single" || kind === "multiple" || kind === "open";
}

export function isChoiceQuestion(kind: Task["kind"]): boolean {
  return kind === "single" || kind === "multiple";
}
