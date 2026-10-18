import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageShellProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  narrow?: boolean;
}

export function PageShell({ title, eyebrow = "ledger-board", children, narrow }: PageShellProps) {
  return (
    <div className={`page-shell ${narrow ? "narrow" : ""}`}>
      <header className="page-shell-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <nav className="page-shell-nav">
          <Link to="/">Ćwiczenia</Link>
          <Link to="/panel">Panel</Link>
        </nav>
      </header>
      <div className="page-shell-body">{children}</div>
    </div>
  );
}
