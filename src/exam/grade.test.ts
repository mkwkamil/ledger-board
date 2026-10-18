import { describe, expect, it } from "vitest";
import type { SessionTaskDoc } from "../firebase/types";
import { formatSessionResult, gradeSessionTasks, isClosedAnswerCorrect } from "./grade";

function board(): SessionTaskDoc["board"] {
  return { opened: [], entries: [], log: [], resultMode: "nature" };
}

describe("isClosedAnswerCorrect", () => {
  it("single — dokładnie wybrana poprawna", () => {
    expect(isClosedAnswerCorrect("single", "a", ["a"])).toBe(true);
    expect(isClosedAnswerCorrect("single", "b", ["a"])).toBe(false);
  });

  it("multiple — ten sam zbiór id", () => {
    expect(isClosedAnswerCorrect("multiple", ["b", "a"], ["a", "b"])).toBe(true);
    expect(isClosedAnswerCorrect("multiple", ["a"], ["a", "b"])).toBe(false);
  });
});

describe("gradeSessionTasks", () => {
  it("sumuje punkty zamkniętych i oznacza ręczne", () => {
    const tasks: Array<SessionTaskDoc & { id: string }> = [
      {
        id: "t1",
        order: 1,
        number: "1",
        prompt: "Q1",
        kind: "single",
        points: 2,
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
        correctOptionIds: ["b"],
        studentAnswer: "b",
        board: board(),
      },
      {
        id: "t2",
        order: 2,
        number: "2",
        prompt: "Open",
        kind: "open",
        points: 3,
        studentAnswer: "tekst",
        board: board(),
      },
    ];
    const result = gradeSessionTasks(tasks);
    expect(result.scoreAuto).toBe(2);
    expect(result.scoreMax).toBe(5);
    expect(result.needsManualReview).toBe(true);
    expect(result.tasks[0]?.isCorrect).toBe(true);
    expect(result.tasks[1]?.isCorrect).toBeNull();
  });

  it("tylko zamknięte — bez ręcznej oceny", () => {
    const tasks: Array<SessionTaskDoc & { id: string }> = [
      {
        id: "t1",
        order: 1,
        number: "1",
        prompt: "Q",
        kind: "single",
        points: 1,
        correctOptionIds: ["a"],
        studentAnswer: "a",
        board: board(),
      },
    ];
    expect(gradeSessionTasks(tasks).needsManualReview).toBe(false);
  });
});

describe("formatSessionResult", () => {
  it("pokazuje myślnik w trakcie", () => {
    expect(formatSessionResult({ status: "in_progress" })).toBe("—");
  });

  it("pokazuje auto/max po oddaniu", () => {
    expect(
      formatSessionResult({
        status: "submitted",
        scoreAuto: 2,
        scoreMax: 5,
        needsManualReview: true,
        scoreManual: null,
      }),
    ).toBe("2/5");
  });
});
