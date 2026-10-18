import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import PracticePage from "./PracticePage";

export default function HomePage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card-loading">
          <p className="muted">Ładowanie…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <PracticePage />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/admin-only") {
        setError("Tylko konto prowadzącego ma dostęp.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Nieprawidłowy email lub hasło.");
      } else if (code === "auth/too-many-requests") {
        setError("Za dużo prób. Spróbuj za chwilę.");
      } else {
        setError("Nie udało się zalogować.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="auth-brand">ledger-board</p>
        <h1>Panel prowadzącego</h1>
        <p className="auth-lead">Zaloguj się, aby kontynuować.</p>
        <form className="stack-form auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label>
            Hasło
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary auth-submit" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
