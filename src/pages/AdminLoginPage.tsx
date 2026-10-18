import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../auth/AuthProvider";

export default function AdminLoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/admin-only") {
        setError("Tylko konto prowadzącego ma dostęp do panelu.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Nieprawidłowy email lub hasło.");
      } else if (code === "auth/too-many-requests") {
        setError("Za dużo prób. Spróbuj za chwilę.");
      } else if (code === "auth/admin-restricted-operation") {
        setError("Rejestracja nowych kont jest wyłączona.");
      } else {
        setError("Nie udało się zalogować.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Panel admina" eyebrow="Logowanie" narrow>
      <form className="stack-form" onSubmit={onSubmit}>
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
        <button type="submit" className="primary" disabled={busy || loading}>
          {busy ? "Logowanie…" : "Zaloguj"}
        </button>
      </form>
    </PageShell>
  );
}
