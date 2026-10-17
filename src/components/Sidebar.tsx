import type { ReactNode } from "react";
import type { Task } from "../state";
import { IconChevronLeft, IconChevronRight, IconPanel, IconReset } from "./Icons";

interface SidebarProps {
  open: boolean;
  tasks: Task[];
  activeTaskId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onToggle: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onResetAll: () => void;
}

function taskLabel(task: Task): string {
  const name = task.number.trim();
  return /^\d+(\.\d+)?[a-zA-Z]?$/.test(name) ? `Zadanie ${name}` : name;
}

export function Sidebar({ open, tasks, activeTaskId, query, onQuery, onToggle, onNew, onSelect, onResetAll }: SidebarProps) {
  const needle = query.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    if (!needle) return true;
    return `${taskLabel(task)} ${task.number} ${task.prompt}`.toLowerCase().includes(needle);
  });

  if (!open) {
    return (
      <aside className="sidebar collapsed">
        <button type="button" className="icon-button rail" onClick={onToggle} aria-label="Pokaż listę zadań" title="Pokaż listę zadań">
          <IconPanel />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <p className="eyebrow">Rachunkowość finansowa</p>
        </div>
        <button type="button" className="icon-button ghost" onClick={onToggle} aria-label="Ukryj listę zadań" title="Ukryj listę zadań">
          <IconChevronLeft />
        </button>
      </div>
      <hr className="side-rule" />
      <button className="primary full" type="button" onClick={onNew}>
        Nowe zadanie
      </button>
      <section className="side-block">
        <div className="side-block-head">
          <h2>Lista zadań</h2>
          <button
            type="button"
            className="icon-button ghost side-reset"
            onClick={onResetAll}
            aria-label="Resetuj wszystkie zadania"
            title="Resetuj wszystkie zadania"
          >
            <IconReset />
          </button>
        </div>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Szukaj zadania" aria-label="Szukaj zadania" />
        <ul className="side-list lessons">
          {filtered.map((task) => (
            <li key={task.id}>
              <button type="button" className={activeTaskId === task.id ? "is-current" : ""} onClick={() => onSelect(task.id)}>
                <strong>{taskLabel(task)}</strong>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function RightRail({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return (
      <aside className="right-rail collapsed">
        <button type="button" className="icon-button rail" onClick={onToggle} aria-label="Pokaż podsumowanie" title="Pokaż podsumowanie">
          <IconChevronLeft />
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-rail">
      <div className="right-rail-head">
        <h2>Podsumowanie</h2>
        <button type="button" className="icon-button ghost" onClick={onToggle} aria-label="Ukryj podsumowanie" title="Ukryj podsumowanie">
          <IconChevronRight />
        </button>
      </div>
      {children}
    </aside>
  );
}

export { taskLabel };
