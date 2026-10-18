import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../auth/AuthProvider";
import { listSessions } from "../exam/api";
import type { SessionDoc } from "../firebase/types";

export default function AdminSessionsPage() {
  const { user, logout } = useAuth();
  const [rows, setRows] = useState<Array<SessionDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listSessions();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setError("Nie udało się pobrać sesji.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell title="Sesje testu" eyebrow="Admin">
      <div className="row-actions wrap" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          Zalogowany: {user?.email}
        </p>
        <button type="button" onClick={() => logout()}>
          Wyloguj
        </button>
      </div>
      {loading ? <p className="muted">Ładowanie…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="muted">Brak sesji. Studenci startują z /exams.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Indeks</th>
                <th>Status</th>
                <th>Start</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.firstName} {row.lastName}
                  </td>
                  <td>{row.studentIndex}</td>
                  <td>{row.status}</td>
                  <td>{new Date(row.startedAt).toLocaleString("pl-PL")}</td>
                  <td>
                    <Link to={`/admin/sesje/${row.id}`}>Podgląd</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageShell>
  );
}
