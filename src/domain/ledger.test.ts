import { describe, expect, it } from "vitest";
import { summarize } from "./ledger";
import { zl } from "./money";
import { createInitialState, reducer, getActiveTask } from "../state";

describe("workspace zadań", () => {
  it("seeduje zadania z materiałów przy pierwszym starcie", () => {
    const state = createInitialState();
    expect(state.tasks.length).toBeGreaterThan(10);
    expect(state.activeTaskId).toBeTruthy();
  });

  it("przyjmuje niezbilansowany zapis na aktywnym zadaniu", () => {
    let state = createInitialState();
    const task = getActiveTask(state)!;
    state = reducer(state, { type: "select-task", id: task.id });
    state = reducer(state, { type: "open-account", account: { code: "201", name: "Odbiorcy", kind: "asset" } });
    state = reducer(state, {
      type: "post-entry",
      entry: {
        description: "Tylko Wn 201",
        period: "grudzień",
        opening: false,
        lines: [{ accountCode: "201", side: "Wn", amount: zl(22140) }],
      },
    });
    const active = getActiveTask(state)!;
    expect(state.notice).toBeNull();
    expect(active.entries).toHaveLength(1);
  });

  it("cofa i ponawia zapis", () => {
    let state = createInitialState();
    state = reducer(state, { type: "open-account", account: { code: "201", name: "Odbiorcy", kind: "asset" } });
    state = reducer(state, {
      type: "post-entry",
      entry: {
        description: "A",
        period: "",
        opening: false,
        lines: [{ accountCode: "201", side: "Wn", amount: 100 }],
      },
    });
    expect(getActiveTask(state)!.entries).toHaveLength(1);
    state = reducer(state, { type: "undo" });
    expect(getActiveTask(state)!.entries).toHaveLength(0);
    state = reducer(state, { type: "redo" });
    expect(getActiveTask(state)!.entries).toHaveLength(1);
  });

  it("tworzy nowe zadanie i przełącza na nie", () => {
    let state = createInitialState();
    state = reducer(state, {
      type: "create-task",
      number: "99",
      prompt: "Zrób coś",
    });
    const active = getActiveTask(state)!;
    expect(active.number).toBe("99");
    expect(active.prompt).toBe("Zrób coś");
    expect(active.entries).toHaveLength(0);
  });

  it("zachowuje tablicę przy przełączaniu zadań", () => {
    let state = createInitialState();
    const first = state.tasks[0].id;
    const second = state.tasks[1].id;
    state = reducer(state, { type: "select-task", id: first });
    state = reducer(state, { type: "open-account", account: { code: "130", name: "Bank", kind: "cash" } });
    state = reducer(state, { type: "select-task", id: second });
    expect(getActiveTask(state)!.opened).toHaveLength(0);
    state = reducer(state, { type: "select-task", id: first });
    expect(getActiveTask(state)!.opened.some((account) => account.code === "130")).toBe(true);
  });

  it("liczy wynik z ręcznych zapisów", () => {
    let state = createInitialState();
    state = reducer(state, { type: "open-account", account: { code: "700", name: "Przychody", kind: "revenue" } });
    state = reducer(state, { type: "open-account", account: { code: "201", name: "Odbiorcy", kind: "asset" } });
    state = reducer(state, {
      type: "post-entry",
      entry: {
        description: "Sprzedaż",
        period: "",
        opening: false,
        lines: [
          { accountCode: "201", side: "Wn", amount: zl(18000) },
          { accountCode: "700", side: "Ma", amount: zl(18000) },
        ],
      },
    });
    const active = getActiveTask(state)!;
    expect(summarize(active.opened, active.entries, "nature").revenue).toBe(zl(18000));
  });
});
