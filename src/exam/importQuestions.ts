import { newOptionId, normalizePoints, type SetQuestionDoc, type SetQuestionKind } from "./questionTypes";

export interface ImportOptionDraft {
  text: string;
  correct?: boolean;
}

export interface ImportQuestionDraft {
  kind: SetQuestionKind;
  prompt: string;
  points?: number;
  options?: ImportOptionDraft[];
}

/** Wiadomość do wklejenia w chat — szablon JSON + instrukcja po polsku. */
export const QUESTIONS_CHAT_TEMPLATE = `Przygotuj listę pytań testowych w formacie JSON dokładnie według poniższego wzorca.
Zwróć wyłącznie poprawny JSON (możesz owinąć go w blok \`\`\`json … \`\`\`).

Dozwolone typy pola "kind":
- "ledger" — zadanie obliczeniowe / na tablicę księgową (tylko "prompt" + opcjonalnie "points")
- "single" — jednokrotny wybór ("options" z dokładnie jedną pozycją "correct": true)
- "multiple" — wielokrotny wybór ("options" z co najmniej jedną "correct": true)
- "open" — pytanie otwarte (tylko "prompt" + opcjonalnie "points")

Pole "points" to wartość punktowa pytania (liczba > 0). Jeśli pominięte — domyślnie 1.

Wzór:
{
  "questions": [
    {
      "kind": "single",
      "points": 1,
      "prompt": "Treść pytania jednokrotnego wyboru?",
      "options": [
        { "text": "Odpowiedź A", "correct": false },
        { "text": "Odpowiedź B", "correct": true },
        { "text": "Odpowiedź C", "correct": false }
      ]
    },
    {
      "kind": "multiple",
      "points": 2,
      "prompt": "Zaznacz wszystkie poprawne odpowiedzi.",
      "options": [
        { "text": "Opcja A", "correct": true },
        { "text": "Opcja B", "correct": true },
        { "text": "Opcja C", "correct": false }
      ]
    },
    {
      "kind": "open",
      "points": 1,
      "prompt": "Napisz krótką odpowiedź własnymi słowami."
    },
    {
      "kind": "ledger",
      "points": 3,
      "prompt": "Zaksięguj operację na kontach i ustal wynik."
    }
  ]
}

Poniżej lista pytań do przekształcenia:

`;

const KINDS = new Set<SetQuestionKind>(["ledger", "single", "multiple", "open"]);

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function asKind(value: unknown): SetQuestionKind | null {
  return typeof value === "string" && KINDS.has(value as SetQuestionKind) ? (value as SetQuestionKind) : null;
}

function parseOne(raw: unknown, index: number): ImportQuestionDraft {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Pytanie #${index + 1}: nieprawidłowy obiekt.`);
  }
  const item = raw as Record<string, unknown>;
  const kind = asKind(item.kind);
  if (!kind) {
    throw new Error(`Pytanie #${index + 1}: nieprawidłowy kind (ledger | single | multiple | open).`);
  }
  const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
  if (!prompt) {
    throw new Error(`Pytanie #${index + 1}: brak treści (prompt).`);
  }
  const points = item.points === undefined ? 1 : normalizePoints(item.points);

  if (kind === "ledger" || kind === "open") {
    return { kind, prompt, points };
  }

  const optionsRaw = item.options;
  if (!Array.isArray(optionsRaw) || optionsRaw.length < 2) {
    throw new Error(`Pytanie #${index + 1}: wymagane co najmniej 2 opcje odpowiedzi.`);
  }
  const options: ImportOptionDraft[] = optionsRaw.map((opt, oi) => {
    if (!opt || typeof opt !== "object") {
      throw new Error(`Pytanie #${index + 1}, opcja #${oi + 1}: nieprawidłowa.`);
    }
    const o = opt as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) {
      throw new Error(`Pytanie #${index + 1}, opcja #${oi + 1}: pusta treść.`);
    }
    return { text, correct: o.correct === true };
  });

  const correctCount = options.filter((o) => o.correct).length;
  if (kind === "single" && correctCount !== 1) {
    throw new Error(`Pytanie #${index + 1}: przy jednokrotnym wyborze zaznacz dokładnie jedną poprawną (correct: true).`);
  }
  if (kind === "multiple" && correctCount < 1) {
    throw new Error(`Pytanie #${index + 1}: przy wielokrotnym wyborze zaznacz co najmniej jedną poprawną (correct: true).`);
  }

  return { kind, prompt, points, options };
}

/** Parsuje wklejony JSON: `{ "questions": [...] }` albo samo `[...]`. */
export function parseImportedQuestions(raw: string): ImportQuestionDraft[] {
  const text = stripCodeFence(raw);
  if (!text) throw new Error("Wklej JSON z pytaniami.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Nie udało się odczytać JSON. Sprawdź składnię.");
  }

  let list: unknown[];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)) {
    list = (parsed as { questions: unknown[] }).questions;
  } else {
    throw new Error('Oczekiwano obiektu { "questions": [...] } albo tablicy pytań.');
  }

  if (list.length === 0) throw new Error("Lista pytań jest pusta.");
  return list.map((item, index) => parseOne(item, index));
}

/** Zamienia draft importu na dokumenty Firestore (kolejność od startOrder). */
export function toSetQuestionDocs(drafts: ImportQuestionDraft[], startOrder: number): SetQuestionDoc[] {
  return drafts.map((draft, index) => {
    const order = startOrder + index;
    const number = String(order);
    const points = normalizePoints(draft.points);
    if (draft.kind === "single" || draft.kind === "multiple") {
      const options = (draft.options ?? []).map((o) => ({ id: newOptionId(), text: o.text }));
      const correctOptionIds = (draft.options ?? [])
        .map((o, i) => (o.correct ? options[i]?.id : null))
        .filter((id): id is string => !!id);
      return {
        order,
        number,
        kind: draft.kind,
        prompt: draft.prompt,
        points,
        options,
        correctOptionIds,
      };
    }
    return {
      order,
      number,
      kind: draft.kind,
      prompt: draft.prompt,
      points,
    };
  });
}
