import { describe, expect, it } from "vitest";
import type { TaskDoc } from "../firebase/types";
import { pickExamTasks } from "./pickTasks";

function task(partial: Partial<TaskDoc> & Pick<TaskDoc, "number">): TaskDoc {
  return {
    prompt: `Treść ${partial.number}`,
    active: true,
    kind: "ledger",
    ...partial,
  };
}

describe("pickExamTasks", () => {
  it("losuje dokładnie N zadań bez powtórzeń", () => {
    const bank = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      task: task({ number: `1.${i}` }),
    }));
    const picked = pickExamTasks(bank, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((p) => p.id)).size).toBe(5);
  });

  it("rzuca gdy za mało zadań", () => {
    const bank = [
      { id: "a", task: task({ number: "1" }) },
      { id: "b", task: task({ number: "2" }) },
    ];
    expect(() => pickExamTasks(bank, 5)).toThrow();
  });
});
