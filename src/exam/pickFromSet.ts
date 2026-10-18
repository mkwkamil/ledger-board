import type { SetQuestion } from "./questionTypes";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Losuje `count` pytań z zestawu (bez powtórzeń). */
export function pickQuestionsFromSet(questions: SetQuestion[], count: number): SetQuestion[] {
  if (questions.length === 0) {
    throw new Error("Wybrany zestaw nie ma pytań.");
  }
  const n = Math.min(Math.max(1, count), questions.length);
  return shuffle(questions).slice(0, n);
}
