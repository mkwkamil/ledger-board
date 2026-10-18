import type { TaskDoc } from "../firebase/types";

export interface PickedTask {
  id: string;
  task: TaskDoc;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Losuje `count` aktywnych zadań z banku (legacy — bez zestawów). */
export function pickExamTasks(
  tasks: Array<{ id: string; task: TaskDoc }>,
  count: number,
): PickedTask[] {
  const active = tasks.filter((t) => t.task.active);
  const n = Math.max(1, count);
  if (active.length < n) {
    throw new Error("Za mało aktywnych zadań w banku, żeby wylosować zestaw testu.");
  }
  return shuffle(active)
    .slice(0, n)
    .map(({ id, task }) => ({ id, task }));
}
